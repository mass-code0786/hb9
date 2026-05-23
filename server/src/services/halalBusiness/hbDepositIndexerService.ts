import type pg from "pg";
import { ethers, formatUnits, getAddress } from "ethers";
import { config } from "../../config.js";
import { pool, query } from "../../db/pool.js";
import { logger } from "../../logger.js";
import { VerificationError, verifyBlockchainTransaction } from "../blockchainVerifier.js";
import { createLedgerProof } from "./hbLedgerProofService.js";

const USDT_TRANSFER_ABI = ["event Transfer(address indexed from,address indexed to,uint256 value)"];
const transferInterface = new ethers.Interface(USDT_TRANSFER_ABI);
const TRANSFER_TOPIC = transferInterface.getEvent("Transfer")!.topicHash;
const BSC_MAINNET_CHAIN_ID = 56;
const DEPOSIT_CURSOR_KEY = "usdt_deposits";

let timer: NodeJS.Timeout | null = null;
let running = false;

function isValidAddress(value?: string | null) {
  return Boolean(value && ethers.isAddress(value));
}

function normalizedAddress(value: string) {
  return getAddress(value).toLowerCase();
}

function eventId(txHash: string, logIndex: number) {
  return `${BSC_MAINNET_CHAIN_ID}:${txHash.toLowerCase()}:${logIndex}`;
}

function provider() {
  return new ethers.JsonRpcProvider(config.bscRpcUrl, BSC_MAINNET_CHAIN_ID);
}

export function hbDepositIndexerConfigReady() {
  return Boolean(
    pool &&
    config.bscRpcUrl &&
    config.hbChainId === BSC_MAINNET_CHAIN_ID &&
    isValidAddress(config.hbTreasuryDepositAddress) &&
    isValidAddress(config.usdtBep20Contract)
  );
}

async function indexerEmergencyStopped() {
  if (config.hbEmergencyIndexerStop || config.hbEmergencyDepositFreeze || config.hbRollbackMode) return true;
  const rows = await query<{ value: string }>(
    "select value from hb_production_controls where key in ('emergency_indexer_stop','emergency_deposit_freeze','rollback_mode') and value = 'true' limit 1"
  ).catch(() => []);
  return Boolean(rows[0]);
}

function isGetLogsRangeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return normalized.includes("eth_getlogs") || normalized.includes("getlogs") || normalized.includes("block range") || normalized.includes("limit exceeded") || normalized.includes("query returned more than");
}

async function ensureDepositEventLogTable() {
  await query(`
    create table if not exists hb_deposit_event_logs (
      id uuid primary key default gen_random_uuid(),
      event_id text not null unique,
      tx_hash text not null,
      log_index integer,
      block_number bigint,
      chain_id integer not null default 56,
      token_address text,
      from_address text,
      to_address text,
      amount_usd numeric(20,8),
      status text not null check (status in ('matched','unmatched','duplicate','failed')),
      deposit_id uuid references hb_deposits(id),
      error text,
      raw_event jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query("create index if not exists idx_hb_deposit_event_logs_tx on hb_deposit_event_logs (lower(tx_hash))");
  await query("create index if not exists idx_hb_deposit_event_logs_status on hb_deposit_event_logs (status, created_at desc)");
  await query("create index if not exists idx_hb_deposit_event_logs_deposit on hb_deposit_event_logs (deposit_id)");
}

async function updateCursor(input: {
  status: string;
  lastSyncedBlock?: number;
  lastCheckedBlock?: number;
  error?: string | null;
}) {
  await query(
    `insert into hb_onchain_sync_cursors
      (contract_key, chain_id, contract_address, last_block, last_synced_block, last_scanned_block, last_checked_block, last_status, last_error, updated_at)
     values ($1,$2,$3,$5,$4,$4,$5,$6,$7,now())
     on conflict (contract_key) do update
     set chain_id = excluded.chain_id,
         contract_address = excluded.contract_address,
         last_block = greatest(coalesce(hb_onchain_sync_cursors.last_block, 0), coalesce(excluded.last_block, 0)),
         last_synced_block = greatest(coalesce(hb_onchain_sync_cursors.last_synced_block, 0), coalesce(excluded.last_synced_block, 0)),
         last_scanned_block = greatest(coalesce(hb_onchain_sync_cursors.last_scanned_block, 0), coalesce(excluded.last_scanned_block, 0)),
         last_checked_block = excluded.last_checked_block,
         last_status = excluded.last_status,
         last_error = excluded.last_error,
         updated_at = now()`,
    [
      DEPOSIT_CURSOR_KEY,
      BSC_MAINNET_CHAIN_ID,
      config.usdtBep20Contract || null,
      input.lastSyncedBlock || 0,
      input.lastCheckedBlock || null,
      input.status,
      input.error || null
    ]
  );
}

async function recordDepositEvent(input: {
  eventId: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  tokenAddress: string;
  fromAddress: string;
  toAddress: string;
  amountUsd: string;
  status: "matched" | "unmatched" | "duplicate" | "failed";
  depositId?: string | null;
  error?: string | null;
  rawEvent: Record<string, unknown>;
}) {
  await query(
    `insert into hb_deposit_event_logs
      (event_id, tx_hash, log_index, block_number, chain_id, token_address, from_address, to_address, amount_usd, status, deposit_id, error, raw_event)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     on conflict (event_id) do update
     set status = excluded.status,
         deposit_id = coalesce(excluded.deposit_id, hb_deposit_event_logs.deposit_id),
         error = excluded.error,
         raw_event = excluded.raw_event,
         updated_at = now()`,
    [
      input.eventId,
      input.txHash,
      input.logIndex,
      input.blockNumber,
      BSC_MAINNET_CHAIN_ID,
      input.tokenAddress,
      input.fromAddress,
      input.toAddress,
      input.amountUsd,
      input.status,
      input.depositId || null,
      input.error || null,
      JSON.stringify(input.rawEvent)
    ]
  );
}

async function creditDeposit(client: pg.PoolClient, input: {
  depositId: string;
  userId: string;
  amountUsd: string;
  txHash: string;
  eventId: string;
  fromAddress: string;
  toAddress: string;
  blockNumber: number;
  logIndex: number;
  confirmations: number;
}) {
  const ledgerRows = await client.query<{ id: string }>(
    `insert into hb_internal_ledger (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
     values ($1,'deposit','credit',$2,'deposit',$3,$4,$5::jsonb)
     on conflict (idempotency_key) do nothing
     returning id`,
    [
      input.userId,
      input.amountUsd,
      input.depositId,
      `hb:ledger:deposit:${input.depositId}:onchain_credit`,
      JSON.stringify({ provider: "bsc_usdt_indexer", txHash: input.txHash, eventId: input.eventId, blockNumber: input.blockNumber, logIndex: input.logIndex })
    ]
  );
  let ledgerId = ledgerRows.rows[0]?.id || null;
  if (!ledgerId) {
    const existingLedger = await client.query<{ id: string }>("select id from hb_internal_ledger where idempotency_key = $1 limit 1", [`hb:ledger:deposit:${input.depositId}:onchain_credit`]);
    ledgerId = existingLedger.rows[0]?.id || null;
  }
  await createLedgerProof(client, "hb_internal_ledger", ledgerId, { chainTxHash: input.txHash, onchainStatus: "confirmed" });

  const coinRows = await client.query<{ id: string }>(
    `insert into hb_coin_balance_ledger
      (user_id, coin_symbol, amount, type, direction, reference_id, note, idempotency_key, metadata, usd_price, usd_value)
     values ($1,'USDT',$2,'deposit_credit','credit',$3,'Verified USDT BEP20 deposit credit',$4,$5::jsonb,1,$2)
     on conflict (idempotency_key) do nothing
     returning id`,
    [
      input.userId,
      input.amountUsd,
      input.depositId,
      `hb:coin:deposit:${input.depositId}:credit`,
      JSON.stringify({ txHash: input.txHash, eventId: input.eventId, provider: "bsc_usdt_indexer" })
    ]
  );
  let coinLedgerId = coinRows.rows[0]?.id || null;
  if (!coinLedgerId) {
    const existingCoinLedger = await client.query<{ id: string }>("select id from hb_coin_balance_ledger where idempotency_key = $1 limit 1", [`hb:coin:deposit:${input.depositId}:credit`]);
    coinLedgerId = existingCoinLedger.rows[0]?.id || null;
  }
  if (coinLedgerId) {
    await client.query(
      `insert into hb_coin_balances (user_id, coin_symbol, balance)
       values ($1,'USDT',$2::numeric)
       on conflict (user_id, coin_symbol) do update
       set balance = hb_coin_balances.balance + $2::numeric,
           updated_at = now()`,
      [input.userId, input.amountUsd]
    );
  }
  await createLedgerProof(client, "hb_coin_balance_ledger", coinLedgerId, { chainTxHash: input.txHash, onchainStatus: "confirmed" });
  return { ledgerId, coinLedgerId };
}

async function applyTransfer(input: {
  eventId: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  tokenAddress: string;
  fromAddress: string;
  toAddress: string;
  amountUsd: string;
  confirmations: number;
  rawEvent: Record<string, unknown>;
}) {
  if (!pool) return { matched: false, reason: "Database is not configured." };
  const treasury = normalizedAddress(config.hbTreasuryDepositAddress);
  const token = normalizedAddress(config.usdtBep20Contract);
  if (normalizedAddress(input.tokenAddress) !== token || normalizedAddress(input.toAddress) !== treasury) {
    await recordDepositEvent({ ...input, status: "failed", error: "Wrong token or treasury wallet." });
    return { matched: false, reason: "Wrong token or treasury wallet." };
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`hb-usdt-deposit:${input.txHash.toLowerCase()}:${input.logIndex}`]);

    const creditedRows = await client.query<{ id: string }>(
      "select id from hb_deposits where lower(tx_hash) = lower($1) and ledger_entry_id is not null limit 1",
      [input.txHash]
    );
    if (creditedRows.rows[0]) {
      await recordDepositEvent({ ...input, status: "duplicate", depositId: creditedRows.rows[0].id, error: "Transaction hash was already credited." });
      await client.query("commit");
      return { matched: false, duplicate: true, depositId: creditedRows.rows[0].id };
    }

    const depositRows = await client.query<{
      id: string;
      user_id: string;
      usd_amount: string;
      status: string;
      ledger_entry_id: string | null;
    }>(
      `select d.id, d.user_id, d.usd_amount::text, d.status, d.ledger_entry_id
       from hb_deposits d
       join hb_users u on u.id = d.user_id
       where d.status = 'pending'
         and d.network = 'bsc'
         and d.asset = 'USDT'
         and lower(d.wallet_address) = lower($1)
         and (d.tx_hash is null or lower(d.tx_hash) = lower($2))
         and abs(d.usd_amount - $3::numeric) <= 0.00000001
         and (lower(coalesce(u.usdt_bep20_address, '')) = lower($4)
              or lower(coalesce(u.hb9_wallet_address, '')) = lower($4)
              or lower(coalesce(u.wallet_address, '')) = lower($4))
       order by d.created_at asc
       limit 1
       for update of d`,
      [input.toAddress, input.txHash, input.amountUsd, input.fromAddress]
    );
    const deposit = depositRows.rows[0];
    if (!deposit) {
      await recordDepositEvent({ ...input, status: "unmatched", error: "No pending deposit matched sender, treasury wallet, and amount." });
      await client.query("commit");
      return { matched: false, reason: "No pending deposit matched sender, treasury wallet, and amount." };
    }

    await client.query(
      `update hb_deposits
       set tx_hash = $2,
           payment_status = 'verifying',
           verification_status = 'pending',
           chain_id = $3,
           from_address = $4,
           to_address = $5,
           confirmations = $6,
           onchain_tx_hash = $2,
           onchain_status = 'confirming',
           updated_at = now()
       where id = $1`,
      [deposit.id, input.txHash, BSC_MAINNET_CHAIN_ID, input.fromAddress, input.toAddress, input.confirmations]
    );

    const credit = await creditDeposit(client, {
      depositId: deposit.id,
      userId: deposit.user_id,
      amountUsd: deposit.usd_amount,
      txHash: input.txHash,
      eventId: input.eventId,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      blockNumber: input.blockNumber,
      logIndex: input.logIndex,
      confirmations: input.confirmations
    });

    await client.query(
      `update hb_deposits
       set status = 'verified',
           verification_status = 'verified',
           payment_status = 'confirmed',
           verified_at = now(),
           credited_at = now(),
           ledger_entry_id = coalesce(ledger_entry_id, $2),
           failure_reason = null,
           confirmations = $3,
           onchain_status = 'confirmed',
           updated_at = now()
       where id = $1`,
      [deposit.id, credit.ledgerId, input.confirmations]
    );
    await recordDepositEvent({ ...input, status: "matched", depositId: deposit.id });
    await client.query(
      `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
       values ($1,'hb.deposit.usdt_bep20.auto_credited','hb_deposit',$2,$3::jsonb)`,
      [deposit.user_id, deposit.id, JSON.stringify({ txHash: input.txHash, eventId: input.eventId, confirmations: input.confirmations, coinLedgerId: credit.coinLedgerId })]
    );
    await client.query("commit");
    return { matched: true, depositId: deposit.id };
  } catch (error) {
    await client.query("rollback");
    await recordDepositEvent({ ...input, status: "failed", error: error instanceof Error ? error.message : "Deposit event processing failed" }).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function fetchTransferLogs(fromBlock: number, toBlock: number): Promise<ethers.Log[]> {
  const treasuryTopic = ethers.zeroPadValue(getAddress(config.hbTreasuryDepositAddress), 32);
  try {
    return await provider().getLogs({
      address: config.usdtBep20Contract,
      fromBlock,
      toBlock,
      topics: [TRANSFER_TOPIC, null, treasuryTopic]
    });
  } catch (error) {
    if (fromBlock < toBlock && isGetLogsRangeError(error)) {
      const midBlock = Math.floor((fromBlock + toBlock) / 2);
      const [left, right] = await Promise.all([fetchTransferLogs(fromBlock, midBlock), fetchTransferLogs(midBlock + 1, toBlock)]);
      return left.concat(right);
    }
    throw error;
  }
}

async function processLog(log: ethers.Log, latestBlock: number) {
  const parsed = transferInterface.parseLog({ topics: log.topics, data: log.data });
  if (!parsed) return;
  const blockNumber = Number(log.blockNumber);
  const logIndex = Number(log.index);
  const txHash = log.transactionHash;
  const amountUsd = formatUnits(parsed.args.value, 18);
  await applyTransfer({
    eventId: eventId(txHash, logIndex),
    txHash,
    logIndex,
    blockNumber,
    tokenAddress: getAddress(log.address),
    fromAddress: getAddress(String(parsed.args.from)),
    toAddress: getAddress(String(parsed.args.to)),
    amountUsd,
    confirmations: Math.max(0, latestBlock - blockNumber + 1),
    rawEvent: {
      topics: log.topics,
      data: log.data,
      amountRaw: parsed.args.value.toString(),
      amountUsd,
      txHash,
      blockNumber,
      logIndex
    }
  });
}

export async function retryHbFailedDepositVerifications(limit = 25) {
  if (!pool) return { retried: 0, verified: 0, pending: 0, failed: 0, skipped: true, reason: "Database is not configured." };
  const rows = await query<{
    id: string;
    user_id: string;
    usd_amount: string;
    tx_hash: string;
    wallet_address: string | null;
    user_wallet_address: string | null;
    user_usdt_bep20_address: string | null;
    user_hb9_wallet_address: string | null;
  }>(
    `select d.id, d.user_id, d.usd_amount::text, d.tx_hash, d.wallet_address,
            u.wallet_address as user_wallet_address, u.usdt_bep20_address as user_usdt_bep20_address, u.hb9_wallet_address as user_hb9_wallet_address
     from hb_deposits d
     join hb_users u on u.id = d.user_id
     where d.tx_hash is not null
       and d.ledger_entry_id is null
       and d.status in ('failed', 'pending_verification')
       and d.provider in ('onchain', 'manual_bsc', 'manual')
     order by d.updated_at asc
     limit $1`,
    [limit]
  ).catch(() => []);

  let verified = 0;
  let pending = 0;
  let failed = 0;
  for (const deposit of rows) {
    const txHash = deposit.tx_hash;
    const expectedSender = [deposit.user_usdt_bep20_address, deposit.user_hb9_wallet_address, deposit.user_wallet_address]
      .find((value) => value && ethers.isAddress(value)) || "";
    try {
      if (!deposit.wallet_address || !ethers.isAddress(deposit.wallet_address)) throw new VerificationError("Company receiving wallet is not configured for this network.", { txHash, chainId: BSC_MAINNET_CHAIN_ID, expectedSender: expectedSender || null, expectedAmount: deposit.usd_amount });
      const verification = await verifyBlockchainTransaction({
        txHash,
        network: "bsc",
        tokenSymbol: "USDT",
        requiredAmount: Number(deposit.usd_amount),
        expectedRecipient: deposit.wallet_address,
        expectedSender
      });
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("select pg_advisory_xact_lock(hashtext($1))", [`deposit-retry:${deposit.id}`]);
        const locked = await client.query<{ id: string; ledger_entry_id: string | null; status: string }>("select id, ledger_entry_id, status from hb_deposits where id = $1 for update", [deposit.id]);
        if (locked.rows[0] && !locked.rows[0].ledger_entry_id) {
          const credit = await creditDeposit(client, {
            depositId: deposit.id,
            userId: deposit.user_id,
            amountUsd: deposit.usd_amount,
            txHash,
            eventId: `manual-retry:${BSC_MAINNET_CHAIN_ID}:${txHash.toLowerCase()}`,
            fromAddress: verification.fromAddress,
            toAddress: verification.toAddress,
            blockNumber: 0,
            logIndex: 0,
            confirmations: verification.confirmations
          });
          await client.query(
            `update hb_deposits
             set status = 'verified', verification_status = 'verified', payment_status = 'confirmed',
                 verified_at = now(), credited_at = now(), ledger_entry_id = coalesce(ledger_entry_id, $2),
                 failure_reason = null, chain_id = $3, from_address = $4, to_address = $5,
                 confirmations = $6, onchain_tx_hash = $7, onchain_status = 'confirmed', updated_at = now()
             where id = $1`,
            [deposit.id, credit.ledgerId, verification.chainId, verification.fromAddress, verification.toAddress, verification.confirmations, txHash]
          );
          await client.query(
            `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
             values ($1,'hb.deposit.retry_verified','hb_deposit',$2,$3::jsonb)`,
            [deposit.user_id, deposit.id, JSON.stringify({ txHash, verification })]
          );
          verified += 1;
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
      logger.info("hb.deposit.retry_verified", { depositId: deposit.id, userId: deposit.user_id, ...verification.diagnostics });
    } catch (error) {
      const retryable = error instanceof VerificationError && error.retryable;
      const reason = error instanceof VerificationError ? error.publicReason : error instanceof Error ? error.message : "Deposit verification retry failed";
      const diagnostics = error instanceof VerificationError ? error.diagnostics : { txHash, chainId: BSC_MAINNET_CHAIN_ID, failureReason: reason };
      await query(
        `update hb_deposits
         set status = $2, verification_status = $3, failure_reason = $4, updated_at = now()
         where id = $1`,
        [deposit.id, retryable ? "pending_verification" : "failed", retryable ? "pending" : "failed", reason]
      ).catch(() => undefined);
      if (retryable) pending += 1;
      else failed += 1;
      logger.warn("hb.deposit.retry_verification_failed", { depositId: deposit.id, userId: deposit.user_id, status: retryable ? "pending_verification" : "failed", ...diagnostics, reason });
    }
  }
  return { retried: rows.length, verified, pending, failed };
}

export async function syncHbDepositRange(fromBlock: number, toBlock: number) {
  if (!pool) return { synced: 0, failed: 0, skipped: true, reason: "Database is not configured." };
  if (!hbDepositIndexerConfigReady()) {
    await updateCursor({ status: "missing_config", error: "Deposit indexer config is incomplete." });
    return { synced: 0, failed: 0, skipped: true, reason: "Deposit indexer config is incomplete." };
  }
  await ensureDepositEventLogTable();
  const latest = await provider().getBlockNumber();
  let synced = 0;
  let failed = 0;
  let chunkFrom = Math.max(0, fromBlock);
  const finalToBlock = Math.max(chunkFrom, toBlock);
  const chunkSize = Math.max(1, config.hbDepositIndexerBlockStep);
  while (chunkFrom <= finalToBlock) {
    const chunkTo = Math.min(finalToBlock, chunkFrom + chunkSize - 1);
    const logs = await fetchTransferLogs(chunkFrom, chunkTo);
    for (const log of logs) {
      try {
        await processLog(log, latest);
        synced += 1;
      } catch (error) {
        failed += 1;
        logger.warn("hb.deposit_indexer.event_failed", {
          category: "deposit_indexer",
          txHash: log.transactionHash,
          blockNumber: Number(log.blockNumber),
          error: error instanceof Error ? error.message : "Deposit event failed"
        });
      }
    }
    await updateCursor({ status: failed > 0 ? "partial" : "ok", lastCheckedBlock: chunkTo, lastSyncedBlock: chunkTo });
    chunkFrom = chunkTo + 1;
  }
  return { synced, failed, fromBlock, toBlock: finalToBlock };
}

async function tick() {
  if (running) return;
  running = true;
  try {
    if (!pool) return;
    await ensureDepositEventLogTable();
    if (await indexerEmergencyStopped()) {
      await updateCursor({ status: "emergency_stopped" });
      return;
    }
    if (!config.hbDepositIndexerEnabled) {
      await updateCursor({ status: "disabled" });
      return;
    }
    if (!hbDepositIndexerConfigReady()) {
      await updateCursor({ status: "missing_config", error: "Deposit indexer config is incomplete." });
      return;
    }
    await retryHbFailedDepositVerifications().catch((error) => {
      logger.warn("hb.deposit.retry_batch_failed", { category: "deposit_retry", error: error instanceof Error ? error.message : "Deposit retry batch failed" });
    });
    const cursorRows = await query<{ last_synced_block: string | number }>("select last_synced_block from hb_onchain_sync_cursors where contract_key = $1 limit 1", [DEPOSIT_CURSOR_KEY]);
    const latest = await provider().getBlockNumber();
    const safeLatest = Math.max(0, latest - Math.max(0, config.hbDepositIndexerConfirmations));
    const defaultStart = Math.max(0, safeLatest - Math.max(5000, config.hbDepositIndexerBlockStep));
    const fromBlock = Math.max(0, Number(cursorRows[0]?.last_synced_block || config.hbOnchainStartBlock || defaultStart) + 1);
    if (fromBlock > safeLatest) {
      await updateCursor({ status: "idle", lastCheckedBlock: latest, lastSyncedBlock: Number(cursorRows[0]?.last_synced_block || 0) });
      return;
    }
    const toBlock = Math.min(safeLatest, fromBlock + Math.max(1, config.hbDepositIndexerBlockStep) - 1);
    await syncHbDepositRange(fromBlock, toBlock);
  } catch (error) {
    logger.warn("hb.deposit_indexer.tick_failed", { category: "deposit_indexer", error: error instanceof Error ? error.message : "Deposit indexer tick failed" });
    await updateCursor({ status: "failed", error: error instanceof Error ? error.message : "Deposit indexer tick failed" }).catch(() => undefined);
  } finally {
    running = false;
  }
}

export function startHbDepositIndexer() {
  if (timer) return;
  if (!config.hbDepositIndexerEnabled) return;
  timer = setInterval(() => {
    tick().catch(() => undefined);
  }, Math.max(5000, config.hbDepositIndexerIntervalMs));
  tick().catch(() => undefined);
}

export async function getHbDepositIndexerHealth() {
  const [cursorRows, eventRows] = await Promise.all([
    query<Record<string, unknown>>("select * from hb_onchain_sync_cursors where contract_key = $1 limit 1", [DEPOSIT_CURSOR_KEY]).catch(() => []),
    query<Record<string, unknown>>(
      `select
         count(*) filter (where status = 'matched')::int as matched_events,
         count(*) filter (where status = 'unmatched')::int as unmatched_events,
         count(*) filter (where status = 'failed')::int as failed_events
       from hb_deposit_event_logs`
    ).catch(() => [])
  ]);
  let rpcLatestBlock: number | null = null;
  let rpcHealthy = false;
  if (hbDepositIndexerConfigReady()) {
    try {
      rpcLatestBlock = await provider().getBlockNumber();
      rpcHealthy = true;
    } catch {
      rpcHealthy = false;
    }
  }
  return {
    enabled: config.hbDepositIndexerEnabled,
    configReady: hbDepositIndexerConfigReady(),
    chainId: BSC_MAINNET_CHAIN_ID,
    tokenAddress: config.usdtBep20Contract,
    treasuryConfigured: isValidAddress(config.hbTreasuryDepositAddress),
    rpcHealthy,
    rpcLatestBlock,
    cursor: cursorRows[0] || null,
    events: eventRows[0] || null
  };
}
