import { ethers } from "ethers";
import { config } from "../config.js";

export type VerificationRequest = {
  txHash: string;
  network: string;
  tokenSymbol: "BNB" | "USDT";
  requiredAmount: number;
  expectedRecipient?: string;
  expectedSender?: string;
};

export type BlockchainVerification = {
  chainId: number;
  network: string;
  tokenSymbol: string;
  tokenContract: string | null;
  fromAddress: string;
  toAddress: string;
  verifiedAmount: string;
  confirmations: number;
  verifiedAt: string;
  verificationStatus: "verified";
  diagnostics: VerificationDiagnostics;
};

export type VerificationDiagnostics = {
  txHash: string;
  chainId: number;
  expectedSender: string | null;
  actualSender: string | null;
  expectedTreasury: string | null;
  actualReceiver: string | null;
  expectedTokenContract: string | null;
  actualTokenContract: string | null;
  expectedAmount: string;
  actualAmount: string | null;
  rpcUrlUsed: string | null;
  confirmations: number;
  failureReason: string | null;
};

export class VerificationError extends Error {
  statusCode = 400;
  publicReason: string;
  diagnostics: VerificationDiagnostics;
  retryable: boolean;

  constructor(publicReason: string, diagnostics?: Partial<VerificationDiagnostics>, retryable = false) {
    super(publicReason);
    this.publicReason = publicReason;
    this.retryable = retryable;
    this.diagnostics = buildDiagnostics(diagnostics);
  }
}

const ERC20_TRANSFER_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];
const transferInterface = new ethers.Interface(ERC20_TRANSFER_ABI);

function normalizeEvmAddress(value: string) {
  return value ? ethers.getAddress(value) : "";
}

function sameEvmAddress(left: string, right: string) {
  try {
    return normalizeEvmAddress(left) === normalizeEvmAddress(right);
  } catch {
    return false;
  }
}

function buildDiagnostics(input: Partial<VerificationDiagnostics> = {}): VerificationDiagnostics {
  return {
    txHash: input.txHash || "",
    chainId: input.chainId || 0,
    expectedSender: input.expectedSender ?? null,
    actualSender: input.actualSender ?? null,
    expectedTreasury: input.expectedTreasury ?? null,
    actualReceiver: input.actualReceiver ?? null,
    expectedTokenContract: input.expectedTokenContract ?? null,
    actualTokenContract: input.actualTokenContract ?? null,
    expectedAmount: input.expectedAmount || "0",
    actualAmount: input.actualAmount ?? null,
    rpcUrlUsed: input.rpcUrlUsed ?? null,
    confirmations: input.confirmations || 0,
    failureReason: input.failureReason ?? null
  };
}

function minConfirmations() {
  return Number.isFinite(config.minBlockConfirmations) && config.minBlockConfirmations > 0 ? config.minBlockConfirmations : 3;
}

function assertAmount(verified: string, required: number) {
  if (Number(verified) + Number.EPSILON < required) {
    throw new VerificationError("Transaction amount is lower than the required amount.");
  }
}

function assertConfirmations(confirmations: number) {
  if (confirmations < minConfirmations()) {
    throw new VerificationError("Transaction does not have enough confirmations yet.");
  }
}

function getEvmNetwork(network: string) {
  const key = network.toLowerCase();
  if (key === "bsc") return { chainId: 56, rpcUrls: config.bscRpcUrls, receiveAddress: config.companyEvmReceiveAddress };
  return null;
}

export async function verifyBlockchainTransaction(input: VerificationRequest): Promise<BlockchainVerification> {
  const network = input.network.toLowerCase();
  const evm = getEvmNetwork(network);
  if (!evm) throw new VerificationError(`Blockchain verification is not supported for ${input.network}.`);
  return verifyEvmTransactionWithFallback(input, evm.chainId, evm.rpcUrls, input.expectedRecipient || evm.receiveAddress);
}

function baseDiagnostics(input: VerificationRequest, chainId: number, expectedRecipient: string, rpcUrl?: string | null, expectedContract?: string | null): VerificationDiagnostics {
  return buildDiagnostics({
    txHash: input.txHash,
    chainId,
    expectedSender: input.expectedSender && ethers.isAddress(input.expectedSender) ? normalizeEvmAddress(input.expectedSender) : input.expectedSender || null,
    expectedTreasury: expectedRecipient && ethers.isAddress(expectedRecipient) ? normalizeEvmAddress(expectedRecipient) : expectedRecipient || null,
    expectedTokenContract: expectedContract && ethers.isAddress(expectedContract) ? normalizeEvmAddress(expectedContract) : expectedContract || null,
    expectedAmount: String(input.requiredAmount),
    rpcUrlUsed: rpcUrl || null
  });
}

function mergeFailure(reason: string, diagnostics: VerificationDiagnostics, retryable = false) {
  return new VerificationError(reason, { ...diagnostics, failureReason: reason }, retryable);
}

function isTransientRpcError(error: unknown) {
  if (error instanceof VerificationError) return error.retryable;
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return normalized.includes("timeout")
    || normalized.includes("network")
    || normalized.includes("could not coalesce")
    || normalized.includes("server response")
    || normalized.includes("bad gateway")
    || normalized.includes("service unavailable")
    || normalized.includes("too many requests")
    || normalized.includes("rate limit")
    || normalized.includes("econn")
    || normalized.includes("socket")
    || normalized.includes("fetch failed")
    || normalized.includes("missing response");
}

async function verifyEvmTransactionWithFallback(input: VerificationRequest, chainId: number, rpcUrls: string[], expectedRecipient: string) {
  const urls = rpcUrls.length ? rpcUrls : [config.bscRpcUrl].filter(Boolean);
  if (!urls.length) throw mergeFailure("RPC configuration is missing for this network.", baseDiagnostics(input, chainId, expectedRecipient));
  if (!expectedRecipient || !ethers.isAddress(expectedRecipient)) throw mergeFailure("Company receiving wallet is not configured for this network.", baseDiagnostics(input, chainId, expectedRecipient));

  let lastNotFound: VerificationError | null = null;
  let lastRetryable: VerificationError | null = null;
  for (const rpcUrl of urls) {
    try {
      return await verifyEvmTransaction(input, chainId, rpcUrl, expectedRecipient);
    } catch (error) {
      if (error instanceof VerificationError && error.publicReason === "Transaction was not found on the selected chain.") {
        lastNotFound = error;
        continue;
      }
      if (isTransientRpcError(error)) {
        const diagnostics = error instanceof VerificationError ? error.diagnostics : baseDiagnostics(input, chainId, expectedRecipient, rpcUrl);
        lastRetryable = mergeFailure("BSC RPC/network verification failed. Deposit remains pending_verification for retry.", diagnostics, true);
        continue;
      }
      throw error;
    }
  }
  if (lastNotFound) throw lastNotFound;
  if (lastRetryable) throw lastRetryable;
  throw mergeFailure("BSC RPC/network verification failed. Deposit remains pending_verification for retry.", baseDiagnostics(input, chainId, expectedRecipient), true);
}

async function verifyEvmTransaction(input: VerificationRequest, chainId: number, rpcUrl: string, expectedRecipient: string) {
  const expectedContract = input.tokenSymbol === "USDT" ? config.usdtBep20Contract : null;
  let diagnostics = baseDiagnostics(input, chainId, expectedRecipient, rpcUrl, expectedContract);

  const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
  let network;
  try {
    network = await provider.getNetwork();
  } catch (error) {
    throw mergeFailure(`RPC network check failed: ${error instanceof Error ? error.message : "unknown RPC error"}`, diagnostics, true);
  }
  if (Number(network.chainId) !== chainId) throw mergeFailure("RPC chain does not match the requested network.", diagnostics);

  let transaction: ethers.TransactionResponse | null;
  let receipt: ethers.TransactionReceipt | null;
  let currentBlock: number;
  try {
    [transaction, receipt, currentBlock] = await Promise.all([
      provider.getTransaction(input.txHash),
      provider.getTransactionReceipt(input.txHash),
      provider.getBlockNumber()
    ]);
  } catch (error) {
    throw mergeFailure(`RPC transaction lookup failed: ${error instanceof Error ? error.message : "unknown RPC error"}`, diagnostics, true);
  }

  if (!transaction || !receipt) throw mergeFailure("Transaction was not found on the selected chain.", diagnostics);
  diagnostics = { ...diagnostics, actualSender: normalizeEvmAddress(transaction.from) };
  if (receipt.status !== 1) throw mergeFailure("Transaction failed on-chain.", diagnostics);
  if (receipt.blockNumber == null) throw mergeFailure("Transaction is not confirmed yet.", diagnostics, true);

  const confirmations = currentBlock - receipt.blockNumber + 1;
  diagnostics = { ...diagnostics, confirmations };
  if (confirmations < minConfirmations()) throw mergeFailure("Transaction does not have enough confirmations yet.", diagnostics, true);
  if (input.expectedSender && !sameEvmAddress(transaction.from, input.expectedSender)) {
    throw mergeFailure("Transaction sender does not match expected wallet.", diagnostics);
  }

  if (input.tokenSymbol === "BNB") {
    const to = transaction.to || "";
    diagnostics = { ...diagnostics, actualReceiver: to && ethers.isAddress(to) ? normalizeEvmAddress(to) : to || null };
    if (!sameEvmAddress(to, expectedRecipient)) throw mergeFailure("BNB receiver does not match treasury wallet.", diagnostics);
    const amount = ethers.formatEther(transaction.value);
    diagnostics = { ...diagnostics, actualAmount: amount };
    if (Number(amount) + Number.EPSILON < input.requiredAmount) throw mergeFailure("Transaction amount is lower than the required amount.", diagnostics);
    return {
      chainId,
      network: input.network,
      tokenSymbol: "BNB",
      tokenContract: null,
      fromAddress: normalizeEvmAddress(transaction.from),
      toAddress: normalizeEvmAddress(to),
      verifiedAmount: amount,
      confirmations,
      verifiedAt: new Date().toISOString(),
      verificationStatus: "verified" as const,
      diagnostics
    };
  }
  if (input.tokenSymbol !== "USDT") throw mergeFailure(`Token ${input.tokenSymbol} is not supported for verification.`, diagnostics);
  if (chainId !== 56) throw mergeFailure("USDT verification is only supported for BEP20 on BSC.", diagnostics);
  if (!expectedContract || !ethers.isAddress(expectedContract)) throw mergeFailure("USDT BEP20 contract is not configured.", diagnostics);

  let sawExpectedContract = false;
  let sawAnyTransfer = false;

  for (const log of receipt.logs) {
    try {
      const parsed = transferInterface.parseLog({ topics: [...log.topics], data: log.data });
      if (!parsed || parsed.name !== "Transfer") continue;
      sawAnyTransfer = true;
      const actualContract = normalizeEvmAddress(log.address);
      const from = normalizeEvmAddress(String(parsed.args.from));
      const to = String(parsed.args.to);
      const amount = ethers.formatUnits(parsed.args.value as bigint, 18);
      const transferDiagnostics = {
        ...diagnostics,
        actualSender: from,
        actualReceiver: normalizeEvmAddress(to),
        actualTokenContract: actualContract,
        actualAmount: amount
      };
      if (!sameEvmAddress(log.address, expectedContract)) continue;
      sawExpectedContract = true;
      if (input.expectedSender && !sameEvmAddress(from, input.expectedSender)) throw mergeFailure("Transaction sender does not match expected wallet.", transferDiagnostics);
      if (!sameEvmAddress(to, expectedRecipient)) throw mergeFailure("Token receiver does not match treasury wallet.", transferDiagnostics);
      if (Number(amount) + Number.EPSILON < input.requiredAmount) throw mergeFailure("Transaction amount is lower than the required amount.", transferDiagnostics);
      return {
        chainId,
        network: input.network,
        tokenSymbol: "USDT",
        tokenContract: normalizeEvmAddress(log.address),
        fromAddress: normalizeEvmAddress(String(parsed.args.from)),
        toAddress: normalizeEvmAddress(to),
        verifiedAmount: amount,
        confirmations,
        verifiedAt: new Date().toISOString(),
        verificationStatus: "verified" as const,
        diagnostics: transferDiagnostics
      };
    } catch (error) {
      if (error instanceof VerificationError) throw error;
      continue;
    }
  }

  if (sawAnyTransfer && !sawExpectedContract) throw mergeFailure("Token contract does not match expected USDT BEP20 contract.", diagnostics);
  if (sawExpectedContract) throw mergeFailure("Matching token transfer to the company receiving wallet was not found.", diagnostics);
  throw mergeFailure("Matching token transfer to the company receiving wallet was not found.", diagnostics);
}
