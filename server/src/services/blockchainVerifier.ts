import { ethers } from "ethers";
import { config } from "../config.js";

export type VerificationRequest = {
  txHash: string;
  network: string;
  tokenSymbol: "BNB" | "USDT";
  requiredAmount: number;
  expectedRecipient?: string;
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
};

export class VerificationError extends Error {
  statusCode = 400;
  publicReason: string;

  constructor(publicReason: string) {
    super(publicReason);
    this.publicReason = publicReason;
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
  if (key === "bsc") return { chainId: 56, rpcUrl: config.bscRpcUrl, receiveAddress: config.companyEvmReceiveAddress };
  return null;
}

export async function verifyBlockchainTransaction(input: VerificationRequest): Promise<BlockchainVerification> {
  const network = input.network.toLowerCase();
  const evm = getEvmNetwork(network);
  if (!evm) throw new VerificationError(`Blockchain verification is not supported for ${input.network}.`);
  return verifyEvmTransaction(input, evm.chainId, evm.rpcUrl, input.expectedRecipient || evm.receiveAddress);
}

async function verifyEvmTransaction(input: VerificationRequest, chainId: number, rpcUrl: string, expectedRecipient: string) {
  if (!rpcUrl) throw new VerificationError("RPC configuration is missing for this network.");
  if (!expectedRecipient || !ethers.isAddress(expectedRecipient)) throw new VerificationError("Company receiving wallet is not configured for this network.");

  const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== chainId) throw new VerificationError("RPC chain does not match the requested network.");

  const [transaction, receipt, currentBlock] = await Promise.all([
    provider.getTransaction(input.txHash),
    provider.getTransactionReceipt(input.txHash),
    provider.getBlockNumber()
  ]);

  if (!transaction || !receipt) throw new VerificationError("Transaction was not found on the selected chain.");
  if (receipt.status !== 1) throw new VerificationError("Transaction failed on-chain.");
  if (receipt.blockNumber == null) throw new VerificationError("Transaction is not confirmed yet.");

  const confirmations = currentBlock - receipt.blockNumber + 1;
  assertConfirmations(confirmations);

  if (input.tokenSymbol !== "USDT") throw new VerificationError(`Token ${input.tokenSymbol} is not supported for verification.`);
  if (chainId !== 56) throw new VerificationError("USDT verification is only supported for BEP20 on BSC.");
  const expectedContract = config.usdtBep20Contract;
  if (!expectedContract || !ethers.isAddress(expectedContract)) throw new VerificationError("USDT BEP20 contract is not configured.");

  for (const log of receipt.logs) {
    if (!sameEvmAddress(log.address, expectedContract)) continue;
    try {
      const parsed = transferInterface.parseLog({ topics: [...log.topics], data: log.data });
      if (!parsed || parsed.name !== "Transfer") continue;
      const to = String(parsed.args.to);
      if (!sameEvmAddress(to, expectedRecipient)) continue;
      const amount = ethers.formatUnits(parsed.args.value as bigint, 18);
      assertAmount(amount, input.requiredAmount);
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
        verificationStatus: "verified" as const
      };
    } catch {
      continue;
    }
  }

  throw new VerificationError("Matching token transfer to the company receiving wallet was not found.");
}
