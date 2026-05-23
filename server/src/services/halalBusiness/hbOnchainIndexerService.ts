import { ethers } from "ethers";
import { config } from "../../config.js";
import { pool, query } from "../../db/pool.js";
import { logger } from "../../logger.js";
import { distributePackagePurchase } from "./hbDistributionService.js";
import { evaluateSalaryIncomeForPurchase } from "./hbSalaryIncomeService.js";
import { placeAndEvaluateSingleLegForPurchase } from "./hbSingleLegService.js";

const PACKAGE_MANAGER_ABI = [
  "event PackagePurchased(bytes32 indexed purchaseId,address indexed buyer,uint256 indexed packageId,uint256 price,address sponsor,bytes32 referralCode)"
];

const packageManagerInterface = new ethers.Interface(PACKAGE_MANAGER_ABI);
let timer: NodeJS.Timeout | null = null;
let running = false;

async function indexerEmergencyStopped() {
  if (config.hbEmergencyIndexerStop || config.hbRollbackMode) return true;
  const rows = await query<{ value: string }>("select value from hb_production_controls where key in ('emergency_indexer_stop','rollback_mode') and value = 'true' limit 1").catch(() => []);
  return Boolean(rows[0]);
}

function packageAmountForOnchainId(packageId: number) {
  if (packageId === 1) return 4;
  if (packageId === 2) return 20;
  if (packageId === 3) return 100;
  if (packageId === 4) return 500;
  if (packageId === 5) return 2500;
  if (packageId === 6) return 12500;
  return 0;
}

function eventId(chainId: number, txHash: string, logIndex: number) {
  return `${chainId}:${txHash.toLowerCase()}:${logIndex}`;
}

function isAddress(value: string) {
  return Boolean(value && ethers.isAddress(value));
}

export function hbIndexerConfigReady() {
  return Boolean(
    config.hbChainId &&
    isAddress(config.hbPackageManagerAddress) &&
    config.bscRpcUrl &&
    (config.hbOnchainDryRun || !config.hbOnchainIndexerEnabled || isAddress(config.hbUsdtAddress))
  );
}

function provider() {
  return new ethers.JsonRpcProvider(config.bscRpcUrl, config.hbChainId);
}

function isGetLogsRangeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return normalized.includes("eth_getlogs") || normalized.includes("getlogs") || normalized.includes("block range") || normalized.includes("limit exceeded") || normalized.includes("query returned more than");
}

async function updateCursor(input: {
  status: string;
  contractAddress?: string | null;
  lastSyncedBlock?: number;
  lastCheckedBlock?: number;
  error?: string | null;
}) {
  await query(
    `insert into hb_onchain_sync_cursors
      (contract_key, chain_id, contract_address, last_block, last_synced_block, last_scanned_block, last_checked_block, last_status, last_error, updated_at)
     values ('package_manager',$1,$2,$4,$3,$3,$4,$5,$6,now())
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
      config.hbChainId,
      input.contractAddress || config.hbPackageManagerAddress || null,
      input.lastSyncedBlock || 0,
      input.lastCheckedBlock || null,
      input.status,
      input.error || null
    ]
  );
}

async function fetchPackagePurchaseLogs(fromBlock: number, toBlock: number): Promise<ethers.Log[]> {
  try {
    return await provider().getLogs({
      address: config.hbPackageManagerAddress,
      fromBlock,
      toBlock,
      topics: [packageManagerInterface.getEvent("PackagePurchased")!.topicHash]
    });
  } catch (error) {
    if (fromBlock < toBlock && isGetLogsRangeError(error)) {
      const midBlock = Math.floor((fromBlock + toBlock) / 2);
      logger.warn("hb.indexer.get_logs_range_split", {
        category: "indexer",
        fromBlock,
        toBlock,
        midBlock,
        error: error instanceof Error ? error.message : "eth_getLogs range failed"
      });
      const [leftLogs, rightLogs] = await Promise.all([
        fetchPackagePurchaseLogs(fromBlock, midBlock),
        fetchPackagePurchaseLogs(midBlock + 1, toBlock)
      ]);
      return leftLogs.concat(rightLogs);
    }
    throw error;
  }
}

async function recordFailedEvent(input: {
  contractEventId?: string | null;
  txHash: string;
  blockNumber?: number | null;
  logIndex?: number | null;
  error: string;
  rawEvent: Record<string, unknown>;
}) {
  await query(
    `insert into hb_onchain_failed_events
      (contract_event_id, tx_hash, chain_id, block_number, log_index, error, raw_event, retry_count, next_retry_at, status)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,0,now() + interval '1 minute','pending')
     on conflict do nothing`,
    [
      input.contractEventId || null,
      input.txHash,
      config.hbChainId,
      input.blockNumber || null,
      input.logIndex || null,
      input.error,
      JSON.stringify(input.rawEvent)
    ]
  );
}

async function applyPackagePurchaseEvent(input: {
  contractEventId: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  onchainPackageId: number;
  buyerAddress: string;
  sponsorAddress: string;
  referralCode: string;
  amountUsd: number;
  rawEvent: Record<string, unknown>;
}) {
  if (!pool) return { matched: false, reason: "Database is not configured." };
  const client = await pool.connect();
  try {
    await client.query("begin");
    let eventRows = await client.query<{ id: string; buyer_user_id: string | null }>(
      `update hb_onchain_purchase_events
       set status = 'confirmed', block_number = $2, log_index = $3,
           raw_event = $4::jsonb, synced_at = now(), updated_at = now()
       where contract_event_id = $1
       returning id, buyer_user_id`,
      [input.contractEventId, input.blockNumber, input.logIndex, JSON.stringify(input.rawEvent)]
    );
    if (!eventRows.rows[0]) {
      eventRows = await client.query<{ id: string; buyer_user_id: string | null }>(
        `insert into hb_onchain_purchase_events
          (contract_event_id, tx_hash, chain_id, contract_address, block_number, log_index, onchain_package_id,
           buyer_address, sponsor_address, referral_code, amount_usd, status, raw_event, synced_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'confirmed',$12::jsonb,now())
         returning id, buyer_user_id`,
      [
        input.contractEventId,
        input.txHash,
        config.hbChainId,
        config.hbPackageManagerAddress,
        input.blockNumber,
        input.logIndex,
        input.onchainPackageId,
        input.buyerAddress,
        input.sponsorAddress || null,
        input.referralCode || null,
        input.amountUsd,
        JSON.stringify(input.rawEvent)
      ]
      );
    }
    let buyerUserId = eventRows.rows[0]?.buyer_user_id || null;
    if (!buyerUserId) {
      const userRows = await client.query<{ id: string }>(
        "select id from hb_users where lower(usdt_bep20_address) = lower($1) or lower(hb9_wallet_address) = lower($1) limit 1",
        [input.buyerAddress]
      );
      buyerUserId = userRows.rows[0]?.id || null;
    }
    if (!buyerUserId) {
      await client.query("update hb_onchain_purchase_events set status = 'pending', updated_at = now() where contract_event_id = $1", [input.contractEventId]);
      await client.query("commit");
      return { matched: false, reason: "No matching HB user." };
    }
    const packageRows = await client.query<{ id: string; amount_usd: string }>(
      "select id, amount_usd::text from hb_packages where status = 'available' and amount_usd = $1::numeric limit 1",
      [input.amountUsd]
    );
    const selectedPackage = packageRows.rows[0];
    if (!selectedPackage) {
      throw new Error("On-chain package amount does not match a supported package.");
    }
    await client.query("update hb_onchain_purchase_events set buyer_user_id = $2, status = 'confirmed', synced_at = now(), updated_at = now() where contract_event_id = $1", [input.contractEventId, buyerUserId]);
    const purchaseIdempotencyKey = `hb:onchain:purchase:${input.contractEventId}`;
    let purchaseRows = await client.query<{ id: string }>(
      `update hb_package_purchases
       set onchain_status = 'confirmed', synced_at = now()
       where idempotency_key = $1
       returning id`,
      [purchaseIdempotencyKey]
    );
    if (!purchaseRows.rows[0]) {
      purchaseRows = await client.query<{ id: string }>(
        `insert into hb_package_purchases
          (user_id, package_id, amount_usd, status, idempotency_key, contract_purchase_tx_hash, contract_event_id,
           block_number, log_index, onchain_package_id, onchain_buyer_address, onchain_sponsor_address, onchain_status, synced_at,
           public_reference_id, onchain_tx_hash, chain_id, payout_mode)
         values ($1,$2,$3,'completed',$4,$5,$6,$7,$8,$9,$10,$11,'confirmed',now(),$12,$5,$13,'onchain')
         returning id`,
      [
        buyerUserId,
        selectedPackage.id,
        selectedPackage.amount_usd,
        purchaseIdempotencyKey,
        input.txHash,
        input.contractEventId,
        input.blockNumber,
        input.logIndex,
        input.onchainPackageId,
        input.buyerAddress,
        input.sponsorAddress || null,
        `HBC-${input.contractEventId.slice(0, 18).toUpperCase()}`,
        config.hbChainId
      ]
      );
    }
    const previousRows = await client.query<{ status: string }>("select status from hb_users where id = $1 for update", [buyerUserId]);
    if (previousRows.rows[0]?.status === "inactive") {
      await client.query("update hb_users set status = 'active', activated_at = now(), updated_at = now() where id = $1", [buyerUserId]);
      await client.query(
        "insert into hb_activation_logs (user_id, package_purchase_id, previous_status, new_status) values ($1,$2,'inactive','active')",
        [buyerUserId, purchaseRows.rows[0]?.id || null]
      );
    }
    const purchaseId = purchaseRows.rows[0]?.id || null;
    if (purchaseId) {
      await distributePackagePurchase({
        client,
        purchaseId,
        buyerUserId,
        packageId: selectedPackage.id,
        amountUsd: selectedPackage.amount_usd
      });
      await placeAndEvaluateSingleLegForPurchase({
        client,
        userId: buyerUserId,
        packageAmount: selectedPackage.amount_usd
      });
      await evaluateSalaryIncomeForPurchase(client, buyerUserId);
    }
    await client.query(
      `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
       values ($1,'hb.onchain.package_purchase.confirmed','hb_package_purchase',$2,$3::jsonb)`,
      [buyerUserId, purchaseId, JSON.stringify({ txHash: input.txHash, contractEventId: input.contractEventId, source: "indexer" })]
    );
    await client.query("commit");
    return { matched: true, purchaseId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function processLog(log: ethers.Log) {
  const parsed = packageManagerInterface.parseLog({ topics: log.topics, data: log.data });
  if (!parsed) return;
  const onchainPackageId = Number(parsed.args.packageId);
  const amountUsd = packageAmountForOnchainId(onchainPackageId);
  if (!amountUsd) throw new Error(`Unsupported on-chain package ID ${onchainPackageId}`);
  const txHash = log.transactionHash;
  const blockNumber = Number(log.blockNumber);
  const logIndex = Number(log.index);
  const contractEventId = eventId(config.hbChainId, txHash, logIndex);
  await applyPackagePurchaseEvent({
    contractEventId,
    txHash,
    blockNumber,
    logIndex,
    onchainPackageId,
    buyerAddress: String(parsed.args.buyer),
    sponsorAddress: String(parsed.args.sponsor),
    referralCode: String(parsed.args.referralCode),
    amountUsd,
    rawEvent: {
      purchaseId: String(parsed.args.purchaseId),
      packageId: onchainPackageId,
      price: parsed.args.price.toString(),
      txHash,
      blockNumber,
      logIndex
    }
  });
}

export async function syncHbOnchainRange(fromBlock: number, toBlock: number) {
  if (!pool) return { synced: 0, failed: 0, skipped: true, reason: "Database is not configured." };
  if (config.hbOnchainDryRun) {
    await updateCursor({ status: "dry_run", lastCheckedBlock: toBlock, lastSyncedBlock: fromBlock - 1 });
    return { synced: 0, failed: 0, dryRun: true };
  }
  if (!hbIndexerConfigReady()) {
    await updateCursor({ status: "missing_config", error: "Indexer config is incomplete." });
    return { synced: 0, failed: 0, skipped: true, reason: "Indexer config is incomplete." };
  }
  let synced = 0;
  let failed = 0;
  const chunkSize = Math.max(1, config.hbOnchainIndexerBlockStep);
  let chunkFrom = Math.max(0, fromBlock);
  const finalToBlock = Math.max(chunkFrom, toBlock);
  while (chunkFrom <= finalToBlock) {
    const chunkTo = Math.min(finalToBlock, chunkFrom + chunkSize - 1);
    const logs = await fetchPackagePurchaseLogs(chunkFrom, chunkTo);
    for (const log of logs) {
      try {
        await processLog(log);
        synced += 1;
      } catch (error) {
        failed += 1;
        logger.warn("hb.indexer.event_failed", {
          category: "indexer_retry",
          txHash: log.transactionHash,
          blockNumber: Number(log.blockNumber),
          error: error instanceof Error ? error.message : "Unknown indexer error"
        });
        await recordFailedEvent({
          txHash: log.transactionHash,
          contractEventId: eventId(config.hbChainId, log.transactionHash, Number(log.index)),
          blockNumber: Number(log.blockNumber),
          logIndex: Number(log.index),
          error: error instanceof Error ? error.message : "Unknown indexer error",
          rawEvent: { topics: log.topics, data: log.data }
        });
      }
    }
    await updateCursor({ status: failed > 0 ? "partial" : "ok", lastCheckedBlock: chunkTo, lastSyncedBlock: chunkTo });
    chunkFrom = chunkTo + 1;
  }
  return { synced, failed, fromBlock, toBlock: finalToBlock };
}

async function processQueuedResyncs() {
  const jobs = await query<{ id: string; from_block: string | number | null; to_block: string | number | null }>(
    `select id, from_block, to_block
     from hb_onchain_sync_logs
     where contract_key = 'package_manager' and status in ('queued','pending')
     order by created_at asc
     limit 3`
  );
  for (const job of jobs) {
    try {
      await query("update hb_onchain_sync_logs set status = 'running', last_status = 'running', updated_at = now() where id = $1", [job.id]);
      const fromBlock = Number(job.from_block || 0);
      const latest = Number(job.to_block || await provider().getBlockNumber());
      const result = await syncHbOnchainRange(fromBlock, latest);
      const completedBlock = Number("toBlock" in result ? result.toBlock : latest);
      await query(
        `update hb_onchain_sync_logs
         set status = $2, last_status = $2, events_found = $3, error = null, last_error = null,
             last_block = $4, last_synced_block = $4, last_scanned_block = $4, last_checked_block = $4, updated_at = now()
         where id = $1`,
        [job.id, result.failed ? "partial" : "completed", result.synced || 0, completedBlock]
      );
    } catch (error) {
      logger.warn("hb.indexer.retry_failed", { category: "indexer_retry", jobId: job.id, error: error instanceof Error ? error.message : "Resync failed" });
      await query("update hb_onchain_sync_logs set status = 'failed', last_status = 'failed', error = $2, last_error = $2, updated_at = now() where id = $1", [job.id, error instanceof Error ? error.message : "Resync failed"]);
    }
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    if (!pool) return;
    if (await indexerEmergencyStopped()) {
      await updateCursor({ status: "emergency_stopped" });
      logger.warn("hb.indexer.stopped", { category: "emergency_control" });
      return;
    }
    await processQueuedResyncs();
    if (!config.hbOnchainIndexerEnabled) {
      await updateCursor({ status: config.hbOnchainDryRun ? "dry_run" : "disabled" });
      return;
    }
    if (!hbIndexerConfigReady()) {
      await updateCursor({ status: "missing_config", error: "Indexer config is incomplete." });
      return;
    }
    const cursorRows = await query<{ last_synced_block: string | number }>("select last_synced_block from hb_onchain_sync_cursors where contract_key = 'package_manager' limit 1");
    const latest = await provider().getBlockNumber();
    const safeLatest = Math.max(0, latest - Math.max(0, config.hbOnchainIndexerConfirmations));
    const fromBlock = Math.max(0, Number(cursorRows[0]?.last_synced_block || config.hbOnchainStartBlock || safeLatest) + 1);
    if (fromBlock > safeLatest) {
      await updateCursor({ status: "idle", lastCheckedBlock: latest, lastSyncedBlock: Number(cursorRows[0]?.last_synced_block || 0) });
      return;
    }
    const toBlock = Math.min(safeLatest, fromBlock + Math.max(1, config.hbOnchainIndexerBlockStep) - 1);
    await syncHbOnchainRange(fromBlock, toBlock);
  } catch (error) {
    logger.warn("hb.indexer.tick_failed", { category: "indexer", error: error instanceof Error ? error.message : "Indexer tick failed" });
    await updateCursor({ status: "failed", error: error instanceof Error ? error.message : "Indexer tick failed" }).catch(() => undefined);
  } finally {
    running = false;
  }
}

export function startHbOnchainIndexer() {
  if (timer) return;
  if (!config.hbOnchainIndexerEnabled && !config.hbOnchainDryRun) return;
  timer = setInterval(() => {
    tick().catch(() => undefined);
  }, Math.max(5000, config.hbOnchainIndexerIntervalMs));
  tick().catch(() => undefined);
}

export async function getHbOnchainSyncHealth() {
  const [cursorRows, failedRows, pendingRows, latestRows] = await Promise.all([
    query<Record<string, unknown>>("select * from hb_onchain_sync_cursors where contract_key = 'package_manager' limit 1").catch(() => []),
    query<{ count: string }>("select count(*)::text from hb_onchain_failed_events where status in ('pending','retrying')").catch(() => []),
    query<{ count: string }>("select count(*)::text from hb_onchain_purchase_events where status in ('submitted','pending')").catch(() => []),
    query<{ block_number: string | number | null }>("select max(block_number) as block_number from hb_onchain_purchase_events").catch(() => [])
  ]);
  let rpcLatestBlock: number | null = null;
  let rpcHealthy = false;
  if (!config.hbOnchainDryRun && hbIndexerConfigReady()) {
    try {
      rpcLatestBlock = await provider().getBlockNumber();
      rpcHealthy = true;
    } catch {
      rpcHealthy = false;
    }
  }
  return {
    dryRun: config.hbOnchainDryRun,
    enabled: config.hbOnchainIndexerEnabled,
    configReady: hbIndexerConfigReady(),
    chainId: config.hbChainId,
    packageManagerAddress: config.hbPackageManagerAddress,
    rpcHealthy,
    rpcLatestBlock,
    latestIndexedBlock: Number(latestRows[0]?.block_number || cursorRows[0]?.last_synced_block || 0),
    pendingSyncCount: Number(pendingRows[0]?.count || 0),
    failedSyncCount: Number(failedRows[0]?.count || 0),
    cursor: cursorRows[0] || null
  };
}
