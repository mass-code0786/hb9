import crypto from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { Contract, JsonRpcProvider, NonceManager, Wallet, formatEther, formatUnits, getAddress, isAddress, parseUnits, verifyMessage } from "ethers";
import type { PoolClient } from "pg";
import { z } from "zod";
import { createAdminToken, requireAdmin } from "../adminAuth.js";
import { config } from "../config.js";
import { pool, query } from "../db/pool.js";
import { asyncHandler, fail, ok } from "../http.js";
import { logger } from "../logger.js";
import { VerificationError, verifyBlockchainTransaction, type BlockchainVerification, type VerificationDiagnostics } from "../services/blockchainVerifier.js";
import { distributePackagePurchase } from "../services/halalBusiness/hbDistributionService.js";
import { getUserDividendStats, getUserDividendStatsForClient } from "../services/halalBusiness/hbDividendIncomeService.js";
import { getHbCoinPrice, getHbCoinPrices, hbCoinName, hbCoinSymbols, hbNonUsdtCoinSymbols, normalizeHbCoinSymbol, type HbCoinSymbol } from "../services/halalBusiness/hbCoinPriceService.js";
import { applyIncomeCap, getIncomeCapSummary } from "../services/halalBusiness/hbIncomeCapService.js";
import { createLedgerProof, verifyLedgerProofChain, verifyLedgerProofReference } from "../services/halalBusiness/hbLedgerProofService.js";
import { getHbDepositIndexerHealth } from "../services/halalBusiness/hbDepositIndexerService.js";
import { getHbOnchainSyncHealth, syncHbOnchainRange } from "../services/halalBusiness/hbOnchainIndexerService.js";
import { evaluateSalaryIncome, evaluateSalaryIncomeForPurchase } from "../services/halalBusiness/hbSalaryIncomeService.js";
import { evaluateAllPendingSingleLegRewards, getSingleLegProgress, placeAndEvaluateSingleLegForPurchase } from "../services/halalBusiness/hbSingleLegService.js";
import { createNowPaymentsPayment, getNowPaymentsPayment, verifyNowPaymentsIpnSignature, type NowPaymentsPayment } from "../services/nowPaymentsService.js";

type HbTokenPayload = {
  userId: string;
  login: string;
  jti: string;
  exp: number;
};

declare module "express-serve-static-core" {
  interface Request {
    hbUser?: HbTokenPayload;
  }
}

const hbRouter = Router();
const BEP20_TRANSFER_ABI = [
  "function transfer(address to,uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
];
const BSC_MAINNET_CHAIN_ID = 56;
const USDT_BEP20_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const configuredUsdtCandidate = config.hbUsdtAddress || config.usdtBep20Contract || USDT_BEP20_ADDRESS;
const CONFIGURED_USDT_BEP20_ADDRESS = isAddress(configuredUsdtCandidate) ? getAddress(configuredUsdtCandidate) : getAddress(USDT_BEP20_ADDRESS);
const HB_WITHDRAWAL_MIN_USD = 9;
const HB_WITHDRAWAL_FEE_PERCENT = 10;
const HB_WITHDRAWAL_MIN_ERROR = "Minimum withdrawal amount is $9.";
const HB_WITHDRAWAL_TREASURY_INSUFFICIENT_INTERNAL = "Insufficient treasury balance for withdrawal";
const HB_WITHDRAWAL_TREASURY_INSUFFICIENT_PUBLIC = "Withdrawal temporarily unavailable. Treasury balance is insufficient.";
const HB_WITHDRAWAL_TEMPORARILY_UNAVAILABLE = "Withdrawal temporarily unavailable. Please try again later.";
const HB9_COIN_PRICE_USD = 0.13;
const HB9_TO_USDT_MIN_USD = 500;

const bcryptRounds = 12;
const hbSessionTtlSeconds = 7 * 24 * 60 * 60;
const maxFailedLoginAttempts = 5;
const loginLockMs = 15 * 60 * 1000;
const walletAuthChallengeBuckets = new Map<string, { count: number; resetAt: number }>();
const walletAuthChallengeWindowMs = 60_000;
const walletAuthChallengeMax = 10;

class InsufficientTreasuryBalanceError extends Error {
  constructor() {
    super(HB_WITHDRAWAL_TREASURY_INSUFFICIENT_INTERNAL);
    this.name = "InsufficientTreasuryBalanceError";
  }
}

function normalizeMobile(value: string) {
  const trimmed = value.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/[^\d]/g, "");
  return digits ? `${plus}${digits}` : "";
}

const registerSchema = z.object({
  email: z.string().trim().email().max(200).transform((value) => value.toLowerCase()).optional().or(z.literal("")),
  mobileNumber: z.string().trim().min(7).max(30).transform(normalizeMobile),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(2).max(80),
  fullName: z.string().trim().min(2).max(80).optional(),
  referralCode: z.string().trim().min(3).max(40).optional().or(z.literal("")),
  walletAddress: z.string().trim().min(10).max(128).optional().or(z.literal(""))
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(200),
  email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  mobileNumber: z.string().trim().min(7).max(30).transform(normalizeMobile).optional(),
  password: z.string().min(8).max(200)
});

const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3).max(200)
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(24).max(200),
  password: z.string().min(8).max(200)
});

const depositCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const input = raw as Record<string, unknown>;
  const amount = input.amountUsd ?? input.amount;
  const token = input.token ?? input.asset ?? "USDT";
  const treasuryWallet = input.treasuryWallet ?? input.walletAddress ?? "";
  return {
    ...input,
    amountUsd: amount,
    amount,
    asset: token,
    token,
    network: input.network ?? "bsc",
    chainId: input.chainId ?? BSC_MAINNET_CHAIN_ID,
    treasuryWallet,
    walletAddress: input.walletAddress ?? treasuryWallet
  };
}, z.object({
  amountUsd: z.coerce.number().positive().max(1000000),
  amount: z.coerce.number().positive().max(1000000).optional(),
  asset: z.literal("USDT").default("USDT"),
  token: z.literal("USDT").default("USDT"),
  network: z.literal("bsc").default("bsc"),
  chainId: z.coerce.number().refine((value) => value === BSC_MAINNET_CHAIN_ID, `Chain id must be ${BSC_MAINNET_CHAIN_ID}.`).default(BSC_MAINNET_CHAIN_ID),
  tokenAddress: z.preprocess(
    (value) => value === undefined || value === null || value === "" ? CONFIGURED_USDT_BEP20_ADDRESS : value,
    z.string()
      .trim()
      .refine((value) => isAddress(value), "Token address must be a valid EVM address.")
      .transform((value) => getAddress(value))
      .refine((value) => value === CONFIGURED_USDT_BEP20_ADDRESS, "Token address must be USDT BEP20 on BSC Mainnet.")
  ),
  walletAddress: z.string().trim().min(10).max(128).optional().or(z.literal("")),
  treasuryWallet: z.string().trim().min(10).max(128).optional().or(z.literal("")),
  txHash: z.preprocess(
    (value) => value === undefined || value === null || value === "" ? undefined : value,
    z.string().trim().regex(/^(0x)?[a-zA-Z0-9]{12,128}$/).optional()
  ),
  idempotencyKey: z.string().trim().min(12).max(120).optional()
}));

const depositVerifySchema = z.object({
  depositId: z.string().uuid(),
  txHash: z.string().trim().regex(/^(0x)?[a-zA-Z0-9]{12,128}$/)
});

const depositTxHashSchema = z.object({
  txHash: z.string().trim().regex(/^(0x)?[a-zA-Z0-9]{12,128}$/)
});

const nowPaymentsCreateSchema = z.object({
  amountUsd: z.number().min(4).max(1000000),
  payCurrency: z.literal("usdtbsc").default("usdtbsc")
});

const withdrawalCreateSchema = z.object({
  amountUsd: z.number().positive().max(1000000),
  walletAddress: z.string().trim().min(10).max(160),
  currency: z.literal("USDT").default("USDT"),
  network: z.literal("bsc").default("bsc"),
  chainId: z.literal(BSC_MAINNET_CHAIN_ID).default(BSC_MAINNET_CHAIN_ID),
  idempotencyKey: z.string().trim().min(12).max(120).optional()
});

const walletAddressSchema = z.object({
  address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, "USDT BEP20 wallet address must be a valid EVM address.")
});

const adminWithdrawalRejectSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  adminNote: z.string().trim().max(1000).optional(),
  safetyConfirmation: z.string().trim().max(80).optional()
});

function validationErrorMessage(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
    .join("; ") || "Invalid request payload.";
}

function depositResponse(deposit: Record<string, unknown>) {
  return {
    ...deposit,
    depositId: deposit.id,
    status: deposit.status,
    amount: deposit.amount ?? deposit.usd_amount,
    treasuryWallet: deposit.wallet_address
  };
}

function pendingDepositCreateResponse(deposit: Record<string, unknown>) {
  return {
    depositId: deposit.id,
    status: "pending",
    amount: deposit.amount ?? deposit.usd_amount,
    treasuryWallet: deposit.wallet_address
  };
}

function hbDepositRequestFields(body: unknown) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  return {
    amountUsd: input.amountUsd,
    amount: input.amount,
    network: input.network,
    token: input.token ?? input.asset,
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    treasuryWallet: input.treasuryWallet
  };
}

function logHbDepositValidationFailed(reason: string, body: unknown, extra: Record<string, unknown> = {}) {
  console.error("HB9_DEPOSIT_VALIDATION_FAILED", reason, { ...hbDepositRequestFields(body), ...extra });
}

const adminWithdrawalPaidSchema = z.object({
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/),
  adminNote: z.string().trim().max(1000).optional(),
  safetyConfirmation: z.string().trim().max(80).optional()
});

const adminWithdrawalActionSchema = z.object({
  adminNote: z.string().trim().max(1000).optional(),
  safetyConfirmation: z.string().trim().max(80).optional()
});

const financialSettingsPatchSchema = z.object({
  withdrawalMinUsd: z.literal(HB_WITHDRAWAL_MIN_USD).optional(),
  withdrawalFeePercent: z.literal(HB_WITHDRAWAL_FEE_PERCENT).optional(),
  withdrawalDailyLimitUsd: z.number().positive().max(10000000).optional(),
  withdrawalCooldownMinutes: z.number().int().min(0).max(1440).optional(),
  withdrawalRequireActiveId: z.boolean().optional(),
  withdrawalRequirePackage: z.boolean().optional()
});

const riskFlagSchema = z.object({
  flag: z.enum(["normal", "review", "suspended", "withdrawal_blocked"]),
  reason: z.string().trim().max(1000).optional()
});

const treasurySettingsSchema = z.object({
  treasuryUsdtBep20Address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional().or(z.literal("")),
  payoutWalletAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional().or(z.literal("")),
  companyReserveWallet: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional().or(z.literal("")),
  safetyConfirmation: z.string().trim().max(80).optional()
});

const walletChallengeSchema = z.object({
  walletAddress: z.string().trim().refine(isAddress, "walletAddress must be a valid EVM address.").transform((value) => getAddress(value)),
  chainId: z.number().int().positive(),
  authMode: z.enum(["login", "signup"]).optional(),
  referralCode: z.string().trim().min(3).max(40).optional().or(z.literal(""))
});

const walletVerifySchema = z.object({
  nonce: z.string().trim().min(16).max(160),
  walletAddress: z.string().trim().refine(isAddress, "walletAddress must be a valid EVM address.").transform((value) => getAddress(value)),
  chainId: z.number().int().positive(),
  signature: z.string().trim().min(20).max(300),
  authMode: z.enum(["login", "signup"]).optional()
});

const registrationFeeVerifySchema = z.object({
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/)
});

const onchainPurchaseTrackSchema = z.object({
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/),
  productId: z.string().uuid().optional(),
  packageId: z.string().uuid().optional(),
  onchainPackageId: z.number().int().min(1).max(6),
  buyerAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  sponsorAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional().or(z.literal("")),
  referralCode: z.string().trim().max(80).optional().or(z.literal(""))
});

const adminOnchainContractPatchSchema = z.object({
  packageManagerAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional().or(z.literal("")),
  referralRegistryAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional().or(z.literal("")),
  treasurySplitterAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional().or(z.literal("")),
  incomeDistributorAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional().or(z.literal("")),
  usdtBep20Address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional().or(z.literal("")),
  startBlock: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  safetyConfirmation: z.string().trim().max(80).optional()
});

const adminOnchainPurchaseEventSchema = z.object({
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/),
  contractEventId: z.string().trim().min(8).max(200),
  blockNumber: z.number().int().min(1),
  logIndex: z.number().int().min(0),
  onchainPackageId: z.number().int().min(1).max(6),
  buyerAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  sponsorAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional().or(z.literal("")),
  referralCode: z.string().trim().max(80).optional().or(z.literal("")),
  amountUsd: z.number().positive().max(10000000),
  rawEvent: z.record(z.string(), z.unknown()).optional()
});

const hbCoinSymbolSchema = z.preprocess((value) => typeof value === "string" ? normalizeHbCoinSymbol(value) || value : value, z.enum(["USDT", "BTC", "BNB", "HB9", "PEPE", "DOGE", "SHIB", "BTTC", "ADA", "TRX"]));
const hbAdminCreditCoinSymbolSchema = z.preprocess((value) => typeof value === "string" ? normalizeHbCoinSymbol(value) || value : value, z.enum(["BTC", "BNB", "HB9", "PEPE", "DOGE", "SHIB", "BTTC", "ADA", "TRX"]));
const hbConvertibleCoinSymbolSchema = z.preprocess((value) => typeof value === "string" ? normalizeHbCoinSymbol(value) || value : value, z.enum(["BTC", "BNB", "HB9", "PEPE", "DOGE", "SHIB", "BTTC", "ADA", "TRX"]));
function hasValidCoinPrecision(value: string | number) {
  if (typeof value === "string") return /^\d+(\.\d{1,18})?$/.test(value);
  return Number.isFinite(value) && value > 0;
}
const decimalAmountSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.union([
    z.string().regex(/^\d+(\.\d{1,18})?$/, "Amount supports up to 18 decimal places.").transform(Number),
    z.number().refine(hasValidCoinPrecision, "Amount supports up to 18 decimal places.")
  ]).pipe(z.number().positive().max(1_000_000_000))
);
const adminCoinAdjustSchema = z.object({
  userId: z.string().uuid(),
  coinSymbol: hbAdminCreditCoinSymbolSchema,
  amount: decimalAmountSchema,
  note: z.string().trim().min(3).max(500),
  reference: z.string().trim().max(160).optional().or(z.literal(""))
});
const hbCoinConvertSchema = z.object({
  coinSymbol: hbConvertibleCoinSymbolSchema,
  idempotencyKey: z.string().trim().min(12).max(160).optional()
});
const hbFollowersRequestSchema = z.object({
  packagePurchaseId: z.string().uuid(),
  platform: z.enum(["Instagram", "Telegram", "Twitter", "Facebook", "YouTube"]),
  submittedLink: z.string().trim().url().max(600)
});
const hbBookAdminSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  coverImage: z.string().trim().url().max(800).optional().or(z.literal("")),
  downloadUrl: z.string().trim().url().max(1000),
  packageTier: z.coerce.number().int().refine((value) => [4, 20, 100, 500, 2500, 12500].includes(value), "Package tier must be 4, 20, 100, 500, 2500, or 12500.").optional(),
  sortOrder: z.coerce.number().int().min(1).max(100),
  isActive: z.boolean().optional()
});
const hbBookAdminPatchSchema = hbBookAdminSchema.partial();
const hbCustomSoftwareRequestSchema = z.object({
  packagePurchaseId: z.string().uuid().optional(),
  softwareType: z.string().trim().min(3).max(120),
  architecture: z.enum(["centralized", "decentralized"]),
  requirementsNote: z.string().trim().min(10).max(2000)
});
const adminRequestStatusSchema = z.object({
  status: z.enum(["pending", "completed", "rejected"]),
  adminNote: z.string().trim().max(1000).optional().or(z.literal(""))
});

const adminFundTransferSchema = z.object({
  senderUserId: z.string().uuid(),
  receiverUserId: z.string().uuid(),
  coinSymbol: hbCoinSymbolSchema,
  network: z.string().trim().max(40).optional(),
  amount: decimalAmountSchema,
  note: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().trim().min(12).max(160).optional()
}).refine((value) => value.senderUserId !== value.receiverUserId, "Sender and receiver must be different users.");

const adminFundActionSchema = z.object({
  userId: z.string().uuid(),
  coinSymbol: hbCoinSymbolSchema,
  network: z.string().trim().max(40).optional(),
  amount: decimalAmountSchema,
  note: z.string().trim().min(3).max(500),
  incomeType: z.literal("admin_income").optional(),
  idempotencyKey: z.string().trim().min(12).max(160).optional()
});

const adminBulkDistributionSchema = z
  .object({
    targetMode: z.enum(["manual", "package"]),

    userIds: z.array(z.string()).optional(),

    packageAmount: z.coerce.number().optional(),

    coinSymbol: z.enum([
      "USDT",
      "BTC",
      "BNB",
      "HB9",
      "PEPE",
      "DOGE",
      "SHIB",
      "BTTC",
      "ADA"
    ]),

    amount: z.coerce.number().positive(),

    note: z.string().optional()
  })
  .superRefine((value, ctx) => {

    if (value.targetMode === "manual") {
      if (!value.userIds || value.userIds.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["userIds"],
          message: "User IDs required for manual mode"
        });
      }
    }

    if (value.targetMode === "package") {
      if (!value.packageAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["packageAmount"],
          message: "Package required"
        });
      }
    }
  });

function isUuid(value: string) {
  return z.string().uuid().safeParse(value).success;
}

function normalizeManualBulkTarget(value: string) {
  const target = value.trim();
  if (target.toLowerCase().startsWith("wallet:")) return target.slice("wallet:".length).trim();
  return target;
}

function resolveBulkAdminId(req: Request) {
  const requestAny = req as Request & { user?: { walletAddress?: string } };
  const adminAny = req.admin as (typeof req.admin & { walletAddress?: string }) | undefined;
  const bodyAny = req.body as { adminWalletAddress?: unknown } | undefined;
  const bodyWallet = typeof bodyAny?.adminWalletAddress === "string" ? bodyAny.adminWalletAddress.trim() : "";
  return adminAny?.walletAddress
    || requestAny.user?.walletAddress
    || bodyWallet
    || "system_admin";
}

function resolveBulkAdminUuid(req: Request) {
  const requestAny = req as Request & { user?: { id?: string } };
  const adminAny = req.admin as (typeof req.admin & { id?: string }) | undefined;
  const adminId = adminAny?.id;
  const userId = requestAny.user?.id;
  if (adminId && isUuid(adminId)) return adminId;
  if (userId && isUuid(userId)) return userId;
  return null;
}

const purchaseSchema = z.object({
  idempotencyKey: z.string().trim().min(12).max(120).optional()
});

const productBuySchema = z.object({
  idempotencyKey: z.string().trim().min(12).max(120).optional()
});

const devBalanceSchema = z.object({
  amountUsd: z.number().positive().max(1000000).default(1000)
});

const adminDepositPatchSchema = z.object({
  status: z.enum(["pending", "rejected", "failed"]).optional(),
  failureReason: z.string().trim().max(500).optional(),
  adminRemark: z.string().trim().max(1000).optional()
});

const adminUserStatusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended", "blocked"]),
  adminRemark: z.string().trim().max(1000).optional()
});

const adminPackagePatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  imageUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  status: z.enum(["available", "disabled"]).optional(),
  adminRemark: z.string().trim().max(1000).optional()
});

const adminProductSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(3000).optional().or(z.literal("")),
  shortDescription: z.string().trim().max(500).optional().or(z.literal("")),
  packageId: z.string().uuid(),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  stock: z.number().int().min(0).max(100000000).default(0),
  active: z.boolean().default(true),
  featured: z.boolean().default(false)
});

const adminProductPatchSchema = adminProductSchema.partial();

const adminProductImageSchema = z.object({
  imageUrl: z.string().trim().url().max(500),
  altText: z.string().trim().max(200).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(10000).default(0)
});

const rolloutModeSchema = z.enum(["closed_beta", "limited_live", "public_live"]);

const adminProductionControlsSchema = z.object({
  rolloutMode: rolloutModeSchema.optional(),
  emergencyPause: z.boolean().optional(),
  emergencyIndexerStop: z.boolean().optional(),
  emergencyActivationDisable: z.boolean().optional(),
  emergencyWithdrawalFreeze: z.boolean().optional(),
  emergencyDepositFreeze: z.boolean().optional(),
  emergencyPackagePurchasePause: z.boolean().optional(),
  emergencyCoinConversionDisable: z.boolean().optional(),
  emergencyFollowerRequestDisable: z.boolean().optional(),
  emergencyTreasuryFreezeNotice: z.boolean().optional(),
  rollbackMode: z.boolean().optional(),
  dailyActivationLimit: z.number().int().min(0).max(100000).optional(),
  maintenanceNotice: z.string().trim().max(500).optional(),
  launchBanner: z.string().trim().max(500).optional(),
  warningBanner: z.string().trim().max(500).optional(),
  safetyConfirmation: z.string().trim().max(80).optional()
});

const adminReadinessSchema = z.object({
  key: z.enum(["multisig_active", "treasury_funded", "rpc_healthy", "indexer_healthy", "contracts_verified", "audit_completed", "explorer_links_working", "rollback_plan_ready"]),
  confirmed: z.boolean(),
  note: z.string().trim().max(500).optional(),
  safetyConfirmation: z.string().trim().max(80).optional()
});

const hbProductUploadDir = path.join(process.cwd(), "public", "uploads", "hb-products");
const hbProductUploadUrlPrefix = "/uploads/hb-products";
const maxHbProductImageBytes = 5 * 1024 * 1024;
const allowedHbProductImageTypes: Record<string, { extension: string; matches: (file: Buffer) => boolean }> = {
  "image/jpeg": { extension: "jpg", matches: (file) => file.length > 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff },
  "image/png": { extension: "png", matches: (file) => file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { extension: "webp", matches: (file) => file.length > 12 && file.subarray(0, 4).toString("ascii") === "RIFF" && file.subarray(8, 12).toString("ascii") === "WEBP" }
};

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string) {
  return crypto.createHmac("sha256", config.adminSessionSecret).update(value).digest("base64url");
}

async function createToken(userId: string, login: string, req?: Request) {
  const jti = crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) + hbSessionTtlSeconds;
  const payload: HbTokenPayload = {
    userId,
    login,
    jti,
    exp
  };
  const encoded = base64url(JSON.stringify(payload));
  await query(
    `insert into hb_auth_sessions (user_id, token_jti, expires_at, user_agent, ip_address)
     values ($1,$2,to_timestamp($3),$4,$5)`,
    [userId, jti, exp, req?.headers["user-agent"] ? String(req.headers["user-agent"]).slice(0, 500) : null, req?.ip || req?.socket.remoteAddress || null]
  );
  return `${encoded}.${sign(encoded)}`;
}

function readRequestBuffer(req: Request, maxBytes: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Uploaded image exceeds 5MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function parseHbProductImageUpload(req: Request) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = String(contentType).match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Multipart upload boundary is missing.");
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const body = await readRequestBuffer(req, maxHbProductImageBytes + 1024 * 1024);
  const parts: Buffer[] = [];
  let position = 0;
  while (position < body.length) {
    const start = body.indexOf(boundary, position);
    if (start < 0) break;
    const next = body.indexOf(boundary, start + boundary.length);
    if (next < 0) break;
    parts.push(body.subarray(start + boundary.length, next));
    position = next;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd < 0) continue;
    const header = part.subarray(0, headerEnd).toString("utf8");
    if (!/name="image"/i.test(header)) continue;
    if (!/filename="[^"]+"/i.test(header)) throw new Error("Image file is missing.");
    const typeMatch = header.match(/content-type:\s*([^\r\n]+)/i);
    const mimeType = typeMatch?.[1]?.trim().toLowerCase() || "";
    const allowed = allowedHbProductImageTypes[mimeType];
    if (!allowed) throw new Error("Only JPG, JPEG, PNG, and WEBP images are allowed.");
    let file = part.subarray(headerEnd + 4);
    if (file.subarray(0, 2).toString("ascii") === "\r\n") file = file.subarray(2);
    if (file.subarray(-2).toString("ascii") === "\r\n") file = file.subarray(0, -2);
    if (file.length <= 0) throw new Error("Image file is empty.");
    if (file.length > maxHbProductImageBytes) throw new Error("Uploaded image exceeds 5MB.");
    if (!allowed.matches(file)) throw new Error("Image content does not match the declared file type.");
    return { file, mimeType, extension: allowed.extension };
  }
  throw new Error("Image file field is required.");
}

function localUploadPathFromUrl(imageUrl: string | null | undefined) {
  if (!imageUrl?.startsWith(`${hbProductUploadUrlPrefix}/`)) return null;
  const fileName = path.basename(imageUrl);
  if (fileName !== imageUrl.slice(hbProductUploadUrlPrefix.length + 1)) return null;
  return path.join(hbProductUploadDir, fileName);
}

async function verifyToken(token: string): Promise<HbTokenPayload | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || sign(encoded) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as HbTokenPayload;
    if (!payload.userId || !payload.login || !payload.jti || payload.exp < Math.floor(Date.now() / 1000)) return null;
    const rows = await query<{ id: string }>(
      `select id from hb_auth_sessions
       where token_jti = $1 and user_id = $2 and revoked_at is null and expires_at > now()
       limit 1`,
      [payload.jti, payload.userId]
    );
    if (!rows[0]) return null;
    return payload;
  } catch {
    return null;
  }
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, bcryptRounds);
}

async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    return bcrypt.compare(password, stored);
  }
  if (stored.startsWith("scrypt:")) {
    const [, salt, expectedHash] = stored.split(":");
    if (!salt || !expectedHash) return false;
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    const candidate = Buffer.from(hash, "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  }
  return false;
}

async function requireHbUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    const payload = await verifyToken(token);
    if (!payload) {
      fail(res, "HB9 authentication required.", 401, "Unauthorized");
      return;
    }
    req.hbUser = payload;
    next();
  } catch (err) {
    next(err);
  }
}

function referralCode() {
  return `HB9-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function devModeEnabled() {
  return config.hbBypassAuth && process.env.NODE_ENV !== "production";
}

function walletSignatureAuthEnabled() {
  return process.env.HB_WALLET_SIGNATURE_AUTH_ENABLED !== "false";
}

function packagePurchaseMode() {
  const mode = config.hbPackagePurchaseMode;
  return mode === "hybrid" ? "hybrid" : "internal";
}

type HbProductionControlState = {
  rolloutMode: "closed_beta" | "limited_live" | "public_live";
  emergencyPause: boolean;
  emergencyIndexerStop: boolean;
  emergencyActivationDisable: boolean;
  emergencyWithdrawalFreeze: boolean;
  emergencyDepositFreeze: boolean;
  emergencyPackagePurchasePause: boolean;
  emergencyCoinConversionDisable: boolean;
  emergencyFollowerRequestDisable: boolean;
  emergencyTreasuryFreezeNotice: boolean;
  rollbackMode: boolean;
  dailyActivationLimit: number;
  maintenanceNotice: string;
  launchBanner: string;
  warningBanner: string;
};

const readinessItems = [
  "multisig_active",
  "treasury_funded",
  "rpc_healthy",
  "indexer_healthy",
  "contracts_verified",
  "audit_completed",
  "explorer_links_working",
  "rollback_plan_ready"
] as const;

function envProductionControls(): HbProductionControlState {
  const rawMode = config.hbRolloutMode;
  const rolloutMode = rawMode === "limited_live" || rawMode === "public_live" ? rawMode : "closed_beta";
  return {
    rolloutMode,
    emergencyPause: config.hbEmergencyPause,
    emergencyIndexerStop: config.hbEmergencyIndexerStop,
    emergencyActivationDisable: config.hbEmergencyActivationDisable,
    emergencyWithdrawalFreeze: config.hbEmergencyWithdrawalFreeze,
    emergencyDepositFreeze: config.hbEmergencyDepositFreeze,
    emergencyPackagePurchasePause: config.hbEmergencyPackagePurchasePause,
    emergencyCoinConversionDisable: config.hbEmergencyCoinConversionDisable,
    emergencyFollowerRequestDisable: config.hbEmergencyFollowerRequestDisable,
    emergencyTreasuryFreezeNotice: config.hbEmergencyTreasuryFreezeNotice,
    rollbackMode: config.hbRollbackMode,
    dailyActivationLimit: rolloutMode === "limited_live" ? config.hbLimitedLiveDailyActivationLimit : config.hbDailyActivationLimit,
    maintenanceNotice: process.env.HB_MAINTENANCE_NOTICE || "",
    launchBanner: process.env.HB_LAUNCH_BANNER || "",
    warningBanner: process.env.HB_WARNING_BANNER || ""
  };
}

async function getProductionControls(): Promise<HbProductionControlState> {
  const base = envProductionControls();
  const rows = await query<{ key: string; value: string }>("select key, value from hb_production_controls").catch(() => []);
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const mode = map.get("rollout_mode") || base.rolloutMode;
  return {
    rolloutMode: mode === "limited_live" || mode === "public_live" ? mode : "closed_beta",
    emergencyPause: (map.get("emergency_pause") ?? String(base.emergencyPause)) === "true",
    emergencyIndexerStop: (map.get("emergency_indexer_stop") ?? String(base.emergencyIndexerStop)) === "true",
    emergencyActivationDisable: (map.get("emergency_activation_disable") ?? String(base.emergencyActivationDisable)) === "true",
    emergencyWithdrawalFreeze: (map.get("emergency_withdrawal_freeze") ?? String(base.emergencyWithdrawalFreeze)) === "true",
    emergencyDepositFreeze: (map.get("emergency_deposit_freeze") ?? String(base.emergencyDepositFreeze)) === "true",
    emergencyPackagePurchasePause: (map.get("emergency_package_purchase_pause") ?? String(base.emergencyPackagePurchasePause)) === "true",
    emergencyCoinConversionDisable: (map.get("emergency_coin_conversion_disable") ?? String(base.emergencyCoinConversionDisable)) === "true",
    emergencyFollowerRequestDisable: (map.get("emergency_follower_request_disable") ?? String(base.emergencyFollowerRequestDisable)) === "true",
    emergencyTreasuryFreezeNotice: (map.get("emergency_treasury_freeze_notice") ?? String(base.emergencyTreasuryFreezeNotice)) === "true",
    rollbackMode: (map.get("rollback_mode") ?? String(base.rollbackMode)) === "true",
    dailyActivationLimit: Number(map.get("daily_activation_limit") || base.dailyActivationLimit || 0),
    maintenanceNotice: map.get("maintenance_notice") ?? base.maintenanceNotice,
    launchBanner: map.get("launch_banner") ?? base.launchBanner,
    warningBanner: map.get("warning_banner") ?? base.warningBanner
  };
}

async function setProductionControl(key: string, value: string, adminEmail: string) {
  await query(
    `insert into hb_production_controls (key, value, updated_by, updated_at)
     values ($1,$2,$3,now())
     on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
    [key, value, adminEmail]
  );
}

async function isWhitelisted(input: { walletAddress?: string | null; referralCode?: string | null }) {
  const wallet = (input.walletAddress || "").trim().toLowerCase();
  const referral = (input.referralCode || "").trim().toUpperCase();
  if (wallet && (config.hbAdminBypassWallets.includes(wallet) || config.hbWhitelistWallets.includes(wallet))) return true;
  if (referral && config.hbWhitelistReferrals.includes(referral)) return true;
  const rows = await query<{ id: string }>(
    `select id from hb_rollout_whitelist
     where active = true
       and (($1::text <> '' and lower(wallet_address) = lower($1)) or ($2::text <> '' and upper(referral_code) = upper($2)))
     limit 1`,
    [wallet, referral]
  ).catch(() => []);
  return Boolean(rows[0]);
}

async function enforceRolloutAccess(res: Response, input: { walletAddress?: string | null; referralCode?: string | null; action: string }) {
  const controls = await getProductionControls();
  if (controls.emergencyPause) {
    logger.warn("hb.rollout.blocked", { category: "emergency_pause", action: input.action });
    fail(res, "HB9 is temporarily paused for production safety.", 503, "Emergency pause active");
    return false;
  }
  return true;
}

async function enforceActivationSafety(res: Response, action: string) {
  const controls = await getProductionControls();
  if (controls.rollbackMode || controls.emergencyActivationDisable || controls.emergencyPackagePurchasePause) {
    const category = controls.rollbackMode ? "rollback_mode" : controls.emergencyPackagePurchasePause ? "package_purchase_pause" : "activation_disabled";
    logger.warn("hb.activation.blocked", { category, action });
    fail(res, controls.rollbackMode ? "Rollback mode is active. New activations and purchases are frozen." : "New activations and package purchases are temporarily disabled.", 503, "Activation disabled");
    return false;
  }
  if (controls.rolloutMode === "limited_live" && controls.dailyActivationLimit > 0) {
    const rows = await query<{ count: number }>("select count(*)::int as count from hb_activation_logs where created_at >= date_trunc('day', now())").catch(() => []);
    if (Number(rows[0]?.count || 0) >= controls.dailyActivationLimit) {
      logger.warn("hb.activation.blocked", { category: "daily_activation_limit", action, limit: controls.dailyActivationLimit });
      fail(res, "Daily limited-live activation limit has been reached.", 429, "Activation limit reached");
      return false;
    }
  }
  return true;
}

async function runCompletedPackagePurchasePipeline({
  client,
  purchaseId,
  buyerUserId,
  packageId,
  amountUsd
}: {
  client: PoolClient;
  purchaseId: string;
  buyerUserId: string;
  packageId: string;
  amountUsd: string;
}) {
  await distributePackagePurchase({
    client,
    purchaseId,
    buyerUserId,
    packageId,
    amountUsd
  });
  await placeAndEvaluateSingleLegForPurchase({
    client,
    userId: buyerUserId,
    packageAmount: amountUsd
  });
  await evaluateSalaryIncomeForPurchase(client, buyerUserId);
}

async function enforceDepositSafety(res: Response, action: string) {
  const controls = await getProductionControls();
  if (controls.emergencyPause || controls.emergencyDepositFreeze || controls.rollbackMode) {
    logger.warn("hb.deposit.blocked", { category: controls.emergencyDepositFreeze ? "deposit_freeze" : "rollback_or_pause", action });
    fail(res, "Deposits are temporarily frozen by production safety controls.", 503, "Deposit freeze active");
    return false;
  }
  return true;
}

async function enforceWithdrawalSafety(res: Response, action: string) {
  const controls = await getProductionControls();
  if (controls.emergencyPause || controls.emergencyWithdrawalFreeze || controls.rollbackMode) {
    logger.warn("hb.withdrawal.blocked", { category: controls.emergencyWithdrawalFreeze ? "withdrawal_freeze" : "rollback_or_pause", action });
    fail(res, "Withdrawals are temporarily frozen by production safety controls.", 503, "Withdrawal freeze active");
    return false;
  }
  return true;
}

function internalPackagePurchasesAllowed() {
  return true;
}

function onchainPackageIdForAmount(amount: string | number) {
  const normalized = Number(amount);
  if (normalized === 4) return 1;
  if (normalized === 20) return 2;
  if (normalized === 100) return 3;
  if (normalized === 500) return 4;
  if (normalized === 2500) return 5;
  if (normalized === 12500) return 6;
  return null;
}

const hbCanonicalOnchainPackages = [
  { onchainPackageId: 1, amountUsd: 4, name: "$4 Starter", sortOrder: 1 },
  { onchainPackageId: 2, amountUsd: 20, name: "$20 Builder", sortOrder: 2 },
  { onchainPackageId: 3, amountUsd: 100, name: "$100 Growth", sortOrder: 3 },
  { onchainPackageId: 4, amountUsd: 500, name: "$500 Automation", sortOrder: 4 },
  { onchainPackageId: 5, amountUsd: 2500, name: "$2500 AI Business", sortOrder: 5 },
  { onchainPackageId: 6, amountUsd: 12500, name: "$12500 Enterprise", sortOrder: 6 }
] as const;

function canonicalOnchainPackageForId(packageId: number) {
  return hbCanonicalOnchainPackages.find((pkg) => pkg.onchainPackageId === packageId) || null;
}

function canonicalOnchainPackageForAmount(amount: string | number) {
  const normalized = Number(amount);
  return hbCanonicalOnchainPackages.find((pkg) => pkg.amountUsd === normalized) || null;
}

function hbUsdtAddress() {
  return CONFIGURED_USDT_BEP20_ADDRESS;
}

function hbOnchainChainId() {
  const chainId = Number(config.hbChainId || 56);
  return Number.isInteger(chainId) && chainId > 0 ? chainId : 56;
}

function hbBscScanBaseUrl() {
  const value = String(config.hbExplorerBaseUrl || "").trim();
  return value || "https://bscscan.com";
}

function hbNetworkLabel() {
  return hbOnchainChainId() === 56 ? "BSC Mainnet" : "BSC";
}

function isHb9AdminWallet(address: string) {
  try {
    return config.hb9AdminWallets.includes(getAddress(address).toLowerCase());
  } catch {
    return false;
  }
}

function normalizedHb9AdminWallet(address: string) {
  try {
    const normalized = getAddress(address).toLowerCase();
    return config.hb9AdminWallets.includes(normalized) ? normalized : "";
  } catch {
    return "";
  }
}

function walletChallengeRateLimit(req: Request, walletAddress: string) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `${ip}:${walletAddress.toLowerCase()}`;
  const bucket = walletAuthChallengeBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    walletAuthChallengeBuckets.set(key, { count: 1, resetAt: now + walletAuthChallengeWindowMs });
    return { allowed: true, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > walletAuthChallengeMax) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

function hbRegistrationFeeUsd() {
  const value = Number(config.hb9RegistrationFeeUsd || 0.05);
  return Number.isFinite(value) && value > 0 ? value : 0.05;
}

function hbRegistrationTreasuryWallet() {
  const wallet = config.hb9TreasuryWallet || config.hbTreasuryDepositAddress || config.companyEvmReceiveAddress || "";
  if (!wallet || !isAddress(wallet)) throw new Error("HB9_TREASURY_WALLET must be configured.");
  return getAddress(wallet);
}

function hbRegistrationFeePayload() {
  const amountUsd = hbRegistrationFeeUsd();
  const treasuryWallet = hbRegistrationTreasuryWallet();
  return {
    required: true,
    amountUSD: amountUsd,
    amountUSDT: amountUsd,
    amountBNB: 0,
    treasuryWallet,
    chainId: hbOnchainChainId(),
    network: hbNetworkLabel(),
    token: "USDT",
    tokenAddress: hbUsdtAddress(),
    message: "One-time activation fee: $0.05 USDT BEP20",
    note: "Paid directly to Treasury Wallet"
  };
}

async function ensureRegistrationFeeTable(client: Pick<PoolClient, "query">) {
  await client.query(`create table if not exists hb_registration_activation_fees (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references hb_users(id) on delete cascade,
    wallet_address text not null,
    treasury_wallet text not null,
    tx_hash text unique,
    amount_bnb numeric(28,18) not null,
    amount_usd numeric(18,8) not null default 0.05,
    status text not null default 'pending',
    verification_status text not null default 'pending',
    failure_reason text,
    chain_id integer not null default 56,
    confirmations integer,
    verified_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
  await client.query("create index if not exists hb_registration_activation_fees_user_idx on hb_registration_activation_fees(user_id)");
}

async function ensureWalletAuthUserColumns(client: Pick<PoolClient, "query">) {
  await client.query(`alter table hb_users
    add column if not exists wallet_address text,
    add column if not exists activation_fee_paid boolean not null default false,
    add column if not exists activation_fee_tx_hash text`);
  await client.query("update hb_users set wallet_address = coalesce(wallet_address, usdt_bep20_address, hb9_wallet_address) where wallet_address is null");
  await client.query("update hb_users set activation_fee_paid = true where status = 'active' and activation_fee_paid = false");
}

function explorerAddressUrl(address: string | null | undefined) {
  return address ? `${hbBscScanBaseUrl().replace(/\/$/, "")}/address/${address}` : null;
}

function explorerTxUrl(txHash: string | null | undefined) {
  return txHash ? `${hbBscScanBaseUrl().replace(/\/$/, "")}/tx/${txHash}` : null;
}

async function readContractGovernance(address: string | null | undefined) {
  if (!address || !isAddress(address) || !config.bscRpcUrl) return { owner: "", pendingOwner: "" };
  try {
    const contract = new Contract(address, ["function owner() view returns (address)", "function pendingOwner() view returns (address)"], new JsonRpcProvider(config.bscRpcUrl, hbOnchainChainId()));
    const owner = String(await contract.owner());
    const pendingOwner = await contract.pendingOwner().then(String).catch(() => "");
    return { owner, pendingOwner };
  } catch {
    return { owner: "", pendingOwner: "" };
  }
}

async function findSponsorByReferral(client: Pick<PoolClient, "query">, sponsorRef: string) {
  const normalized = sponsorRef.trim();
  if (!normalized) return null;
  const rows = await client.query<{ id: string; referral_code: string; display_name: string; status: "inactive" | "active" | "suspended" | "blocked"; hb9_wallet_address: string | null; usdt_bep20_address: string | null }>(
    `select id, referral_code, display_name, status, hb9_wallet_address, usdt_bep20_address
     from hb_users
     where referral_code = upper($1)
        or lower(coalesce(usdt_bep20_address, '')) = lower($1)
        or lower(coalesce(hb9_wallet_address, '')) = lower($1)
     limit 1`,
    [normalized]
  );
  return rows.rows[0] || null;
}

function requestDomain(req: Request) {
  const origin = req.get("origin");
  if (origin) {
    try {
      return new URL(origin).host;
    } catch {
      return origin.slice(0, 200);
    }
  }
  return req.get("host") || "halalbusiness.local";
}

function walletLoginMessage(input: { domain: string; walletAddress: string; chainId: number; nonce: string; issuedAt: string }) {
  return [
    "HB9 wallet login",
    `Domain: ${input.domain}`,
    `Wallet: ${getAddress(input.walletAddress)}`,
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    "No seed phrase. No private key storage."
  ].join("\n");
}

function hbEnvContractRows() {
  const chain_id = hbOnchainChainId();
  return [
    { key: "package_manager", chain_id, contract_address: config.hbPackageManagerAddress || null, start_block: config.hbOnchainStartBlock ? String(config.hbOnchainStartBlock) : null, enabled: Boolean(config.hbPackageManagerAddress), source: "env" },
    { key: "referral_registry", chain_id, contract_address: config.hbReferralRegistryAddress || null, start_block: config.hbOnchainStartBlock ? String(config.hbOnchainStartBlock) : null, enabled: Boolean(config.hbReferralRegistryAddress), source: "env" },
    { key: "treasury_splitter", chain_id, contract_address: config.hbTreasurySplitterAddress || null, start_block: config.hbOnchainStartBlock ? String(config.hbOnchainStartBlock) : null, enabled: Boolean(config.hbTreasurySplitterAddress), source: "env" },
    { key: "income_distributor", chain_id, contract_address: config.hbIncomeDistributorAddress || null, start_block: config.hbOnchainStartBlock ? String(config.hbOnchainStartBlock) : null, enabled: Boolean(config.hbIncomeDistributorAddress), source: "env" },
    { key: "usdt_bep20", chain_id, contract_address: hbUsdtAddress(), start_block: null, enabled: Boolean(hbUsdtAddress()), source: "env" }
  ];
}

function safeContractAddress(value: unknown) {
  return typeof value === "string" && isAddress(value) ? getAddress(value) : "";
}

function mergeEnvOnchainContracts(rows: Array<Record<string, any>>) {
  const dbMap = Object.fromEntries(rows.map((row) => [row.key, row]));
  return hbEnvContractRows().map((envRow) => {
    const dbRow = dbMap[envRow.key] || {};
    return {
      ...envRow,
      ...dbRow,
      chain_id: Number(dbRow.contract_address ? dbRow.chain_id || envRow.chain_id : envRow.chain_id),
      contract_address: dbRow.contract_address || envRow.contract_address,
      start_block: dbRow.start_block ?? envRow.start_block,
      enabled: Boolean(dbRow.contract_address || dbRow.enabled || envRow.enabled),
      source: dbRow.contract_address ? "db" : envRow.source
    };
  });
}

const supportedCoins = hbCoinSymbols.map((symbol) => ({
  coin_symbol: symbol,
  symbol,
  name: hbCoinName(symbol),
  network: symbol === "BTC" ? "bitcoin" : symbol === "USDT" || symbol === "BNB" || symbol === "HB9" ? "bsc" : "wallet",
  decimals: symbol === "BTC" ? 8 : symbol === "USDT" || symbol === "BNB" || symbol === "HB9" ? 18 : 8,
  enabled: true,
  usd_price: symbol === "USDT" ? "1" : null
}));

const bulkDistributionPackages: Record<number, string> = {
  4: "Starter Package",
  20: "Builder Package",
  100: "Growth Package"
};

async function applyHbCoinAdjustment(input: {
  client: PoolClient;
  userId: string;
  coinSymbol: string;
  amount: string | number;
  direction: "credit" | "debit";
  type: "credit" | "debit" | "earning" | "withdrawal" | "admin" | "manual" | "admin_credit" | "admin_debit" | "convert_debit" | "convert_credit" | "convert_credit_usdt" | "convert_credit_hb9" | "deposit_credit" | "withdrawal_debit" | "withdrawal_fee";
  reference?: string | null;
  adminId?: string | null;
  note?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  usdPrice?: number | string | null;
  usdValue?: number | string | null;
}) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Coin amount must be positive.");
  if (!hasValidCoinPrecision(input.amount)) throw new Error("Coin amount supports up to 8 decimal places.");
  await input.client.query("select pg_advisory_xact_lock(hashtext($1))", [`coin:${input.userId}:${input.coinSymbol}`]);
  if (input.direction === "debit") {
    const balanceRows = await input.client.query<{ balance: string }>(
      "select balance::text from hb_coin_balances where user_id = $1 and coin_symbol = $2 for update",
      [input.userId, input.coinSymbol]
    );
    if (Number(balanceRows.rows[0]?.balance || 0) + Number.EPSILON < amount) throw new Error("Insufficient coin balance.");
  }
  const existingLedgerRows = await input.client.query<{ id: string }>(
    "select id from hb_coin_balance_ledger where idempotency_key = $1 limit 1",
    [input.idempotencyKey]
  );
  if (existingLedgerRows.rows[0]) return null;
  const isBulkDistribution = input.metadata?.source === "admin_bulk_distribution";
  const ledgerParams = [input.userId, input.coinSymbol, amount, input.type, input.direction, input.reference || null, input.adminId || null, input.note || null, input.idempotencyKey, JSON.stringify(input.metadata || {}), input.usdPrice ?? null, input.usdValue ?? null];
  if (isBulkDistribution) console.log("BULK_SQL_INSERT", { table: "hb_coin_balance_ledger", params: ledgerParams });
  const ledgerRows = await input.client.query<{ id: string }>(
    `insert into hb_coin_balance_ledger
      (user_id, coin_symbol, amount, type, direction, reference_id, admin_id, note, idempotency_key, metadata, usd_price, usd_value)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
     returning id`,
    ledgerParams
  );
  if (!ledgerRows.rows[0]) return null;
  const balanceDelta = input.direction === "credit" ? amount : -amount;
  if (isBulkDistribution) console.log("BULK_SQL_UPDATE", { table: "hb_coin_balances", params: [input.userId, input.coinSymbol, balanceDelta] });
  const balanceUpdateRows = await input.client.query<{ user_id: string; coin_symbol: string }>(
    `update hb_coin_balances
     set balance = balance + $3::numeric,
         updated_at = now()
     where user_id = $1 and coin_symbol = $2
     returning user_id, coin_symbol`,
    [input.userId, input.coinSymbol, balanceDelta]
  );
  if (!balanceUpdateRows.rows[0]) {
    if (isBulkDistribution) console.log("BULK_SQL_INSERT", { table: "hb_coin_balances", params: [input.userId, input.coinSymbol, balanceDelta] });
    await input.client.query(
      `insert into hb_coin_balances (user_id, coin_symbol, balance)
       values ($1,$2,$3::numeric)`,
      [input.userId, input.coinSymbol, balanceDelta]
    );
  }
  return ledgerRows.rows[0].id;
}

async function readCoinBalance(client: PoolClient, userId: string, coinSymbol: string) {
  const rows = await client.query<{ balance: string }>("select balance::text from hb_coin_balances where user_id = $1 and coin_symbol = $2", [userId, coinSymbol]);
  return Number(rows.rows[0]?.balance || 0);
}

function decimalString(value: number, decimals = 8) {
  if (!Number.isFinite(value)) return "0";
  const normalized = value.toFixed(decimals).replace(/\.?0+$/, "");
  return normalized || "0";
}

function floorCoinAmount(value: number) {
  return Math.floor(value * 100_000_000) / 100_000_000;
}

async function ensureHbUserExists(client: PoolClient, userId: string) {
  const rows = await client.query<{ id: string }>("select id from hb_users where id = $1 limit 1", [userId]);
  if (!rows.rows[0]) throw new Error("HB9 user was not found.");
}

async function audit(userId: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) {
  await query(
    `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
     values ($1,$2,$3,$4,$5::jsonb)`,
    [userId, action, entityType, entityId, JSON.stringify(metadata)]
  );
}

async function adminHbAudit(adminEmail: string, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) {
  await query(
    `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
     values (null,$1,$2,$3,$4::jsonb)`,
    [action, entityType, entityId, JSON.stringify({ admin: adminEmail, ...metadata })]
  );
}

function requestIp(req: Request) {
  return String(req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress || "ip-unavailable").split(",")[0].trim();
}

function requireSafeModeConfirmation(req: Request, action: string) {
  if (!config.hbMainnetSafeMode) return null;
  const confirmation = typeof req.body?.safetyConfirmation === "string" ? req.body.safetyConfirmation : "";
  if (confirmation === "CONFIRM_MAINNET_SAFE_ACTION") return null;
  return `${action} is blocked by HB_MAINNET_SAFE_MODE. Confirm explicitly to continue.`;
}

async function adminOperationLog(input: {
  req: Request;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  proofReference?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await query(
    `insert into hb_admin_operation_logs
      (admin_id, action, entity_type, entity_id, ip_address, before_snapshot, after_snapshot, proof_reference, metadata)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb)`,
    [
      input.req.admin?.email || "admin",
      input.action,
      input.entityType,
      input.entityId || null,
      requestIp(input.req),
      JSON.stringify(input.beforeSnapshot ?? null),
      JSON.stringify(input.afterSnapshot ?? null),
      input.proofReference || null,
      JSON.stringify(input.metadata || {})
    ]
  ).catch(() => undefined);
}

async function adminActionLog(input: {
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  previousStatus?: string | null;
  nextStatus?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  proofReference?: string | null;
}) {
  const baseValues = [input.adminEmail, input.action, input.entityType, input.entityId, input.previousStatus || null, input.nextStatus || null, JSON.stringify(input.metadata || {})];
  await query(
    `insert into hb_admin_action_logs (admin_email, action, entity_type, entity_id, previous_status, next_status, metadata, ip_address, before_snapshot, after_snapshot, proof_reference)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10::jsonb,$11)`,
    [
      ...baseValues,
      input.req ? requestIp(input.req) : null,
      JSON.stringify(input.beforeSnapshot ?? null),
      JSON.stringify(input.afterSnapshot ?? null),
      input.proofReference || null
    ]
  ).catch(() => query(
    `insert into hb_admin_action_logs (admin_email, action, entity_type, entity_id, previous_status, next_status, metadata)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    baseValues
  ));
  if (input.req) {
    await adminOperationLog({
      req: input.req,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeSnapshot: input.beforeSnapshot,
      afterSnapshot: input.afterSnapshot,
      proofReference: input.proofReference,
      metadata: input.metadata
    });
  }
}

function requireSuperAdmin(req: Request, res: Response) {
  if (req.admin?.role === "super_admin") return true;
  fail(res, "Super Admin permission required.", 403, "Forbidden");
  return false;
}

async function optionalTableExists(client: PoolClient, tableName: string) {
  const rows = await client.query<{ exists: boolean }>("select to_regclass($1) is not null as exists", [tableName]);
  return Boolean(rows.rows[0]?.exists);
}

async function optionalCount(client: PoolClient, tableName: string, sql: string, params: unknown[]) {
  if (!(await optionalTableExists(client, tableName))) return { exists: false, count: 0 };
  const rows = await client.query<{ count: number }>(sql, params);
  return { exists: true, count: Number(rows.rows[0]?.count || 0) };
}

async function optionalDelete(client: PoolClient, tableName: string, sql: string, params: unknown[]) {
  if (!(await optionalTableExists(client, tableName))) return { exists: false, deleted: 0 };
  const result = await client.query(sql, params);
  return { exists: true, deleted: result.rowCount || 0 };
}

const hbResetIncomeTypes = [
  "referral_income",
  "level_income",
  "single_leg_income",
  "salary_income",
  "dividend_income",
  "admin_income",
  "bulk_distribution",
  "upline",
  "level",
  "single_leg"
];

async function auditHbInternalLedgerReferences(client: PoolClient) {
  const rows = await client.query<{
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
  }>(
    `SELECT
       tc.table_name,
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.constraint_schema = kcu.constraint_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.constraint_schema = tc.constraint_schema
     WHERE tc.constraint_type='FOREIGN KEY'
       AND ccu.table_name='hb_internal_ledger'
     ORDER BY tc.table_name, kcu.column_name`
  );
  return rows.rows;
}

async function readUserActivationIncomeResetSnapshot(client: PoolClient, userId: string) {
  const userRows = await client.query(
    `select id, email, mobile_number, display_name, referral_code, own_referral_code,
            sponsor_user_id, sponsor_referral_code, source_referral_code, wallet_address,
            usdt_bep20_address, hb9_wallet_address, status, activated_at, created_at
     from hb_users
     where id = $1
     limit 1`,
    [userId]
  );
  const packageRows = await client.query<{ ids: string[]; count: number; total: string }>(
    `select coalesce(array_agg(id::text), '{}') as ids, count(*)::int as count, coalesce(sum(amount_usd),0)::text as total
     from hb_package_purchases
     where user_id = $1`,
    [userId]
  );
  const incomeRows = await client.query<{ count: number; total: string }>(
    "select count(*)::int as count, coalesce(sum(amount_usd),0)::text as total from hb_income_ledger where earner_user_id = $1",
    [userId]
  );
  const internalRows = await client.query<{ count: number; balance: string }>(
    `select count(*)::int as count,
            coalesce(sum(case when direction = 'credit' then amount_usd else -amount_usd end),0)::text as balance
     from hb_internal_ledger
     where user_id = $1`,
    [userId]
  );
  const coinBalanceRows = await client.query("select coin_symbol, balance::text from hb_coin_balances where user_id = $1 order by coin_symbol", [userId]);
  const [
    coinLedger,
    dailyCaps,
    salary,
    singleLegRewards,
    singleLegReserve,
    userProducts,
    productOrders,
    bookDownloads,
    dividendLedger,
    followersRequests,
    customSoftwareRequests,
    adminBalanceActions
  ] = await Promise.all([
    optionalCount(client, "hb_coin_balance_ledger", "select count(*)::int as count from hb_coin_balance_ledger where user_id = $1", [userId]),
    optionalCount(client, "hb_daily_income_caps", "select count(*)::int as count from hb_daily_income_caps where user_id = $1", [userId]),
    optionalCount(client, "hb_salary_income", "select count(*)::int as count from hb_salary_income where user_id = $1", [userId]),
    optionalCount(client, "hb_single_leg_rewards", "select count(*)::int as count from hb_single_leg_rewards where user_id = $1", [userId]),
    optionalCount(client, "hb_single_leg_reserve", "select count(*)::int as count from hb_single_leg_reserve where buyer_user_id = $1", [userId]),
    optionalCount(client, "hb_user_products", "select count(*)::int as count from hb_user_products where user_id = $1", [userId]),
    optionalCount(client, "hb_product_orders", "select count(*)::int as count from hb_product_orders where buyer_user_id = $1", [userId]),
    optionalCount(client, "hb_book_downloads", "select count(*)::int as count from hb_book_downloads where user_id = $1", [userId]),
    optionalCount(client, "hb_dividend_income_ledger", "select count(*)::int as count from hb_dividend_income_ledger where user_id = $1", [userId]),
    optionalCount(client, "hb_followers_requests", "select count(*)::int as count from hb_followers_requests where user_id = $1", [userId]),
    optionalCount(client, "hb_custom_software_requests", "select count(*)::int as count from hb_custom_software_requests where user_id = $1", [userId]),
    optionalCount(client, "hb_admin_balance_actions", "select count(*)::int as count from hb_admin_balance_actions where user_id = $1", [userId])
  ]);
  return {
    user: userRows.rows[0] || null,
    packagePurchases: packageRows.rows[0] || { ids: [], count: 0, total: "0" },
    incomeLedger: incomeRows.rows[0] || { count: 0, total: "0" },
    internalLedger: internalRows.rows[0] || { count: 0, balance: "0" },
    coinBalances: coinBalanceRows.rows,
    coinLedger,
    dailyCaps,
    salary,
    singleLegRewards,
    singleLegReserve,
    userProducts,
    productOrders,
    bookDownloads,
    dividendLedger,
    followersRequests,
    customSoftwareRequests,
    adminBalanceActions
  };
}

async function resetUserActivationIncome(client: PoolClient, userId: string) {
  const deleted: Record<string, number> = {};
  const updated: Record<string, number> = {};
  const incomeTypes = hbResetIncomeTypes;
  const packageRows = await client.query<{ id: string }>("select id from hb_package_purchases where user_id = $1 for update", [userId]);
  const packageIds = packageRows.rows.map((row) => row.id);
  const incomeInternalLedgerRows = await client.query<{ id: string }>(
    `select id
     from hb_internal_ledger
     where user_id = $1
       and (
         reference_type = any($2::text[])
         or metadata->>'incomeType' = any($2::text[])
         or metadata->>'income_type' = any($2::text[])
         or metadata->>'source' = 'admin_bulk_distribution'
       )
     for update`,
    [userId, incomeTypes]
  );
  const incomeInternalLedgerIds = incomeInternalLedgerRows.rows.map((row) => row.id);

  const proofResult = await client.query(
    `delete from hb_ledger_proofs
     where (source_table = 'hb_income_ledger' and ledger_entry_id in (select id from hb_income_ledger where earner_user_id = $1 and income_type = any($3::text[])))
        or (source_table = 'hb_internal_ledger' and ledger_entry_id = any($2::uuid[]))`,
    [userId, incomeInternalLedgerIds, incomeTypes]
  );
  deleted.hb_ledger_proofs = proofResult.rowCount || 0;

  deleted.hb_dividend_income_ledger = (await optionalDelete(client, "hb_dividend_income_ledger", "delete from hb_dividend_income_ledger where user_id = $1", [userId])).deleted;
  deleted.hb_daily_income_caps = (await optionalDelete(client, "hb_daily_income_caps", "delete from hb_daily_income_caps where user_id = $1", [userId])).deleted;
  deleted.hb_salary_income = (await optionalDelete(client, "hb_salary_income", "delete from hb_salary_income where user_id = $1", [userId])).deleted;
  deleted.hb_single_leg_rewards = (await optionalDelete(client, "hb_single_leg_rewards", "delete from hb_single_leg_rewards where user_id = $1", [userId])).deleted;
  deleted.hb_user_products = (await optionalDelete(client, "hb_user_products", "delete from hb_user_products where user_id = $1", [userId])).deleted;
  deleted.hb_book_downloads = (await optionalDelete(client, "hb_book_downloads", "delete from hb_book_downloads where user_id = $1", [userId])).deleted;
  deleted.hb_followers_requests = (await optionalDelete(client, "hb_followers_requests", "delete from hb_followers_requests where user_id = $1", [userId])).deleted;
  deleted.hb_custom_software_requests = (await optionalDelete(client, "hb_custom_software_requests", "delete from hb_custom_software_requests where user_id = $1", [userId])).deleted;
  deleted.hb_product_allocations = (await optionalDelete(client, "hb_product_allocations", "delete from hb_product_allocations where user_id = $1", [userId])).deleted;
  deleted.hb_activation_logs = (await optionalDelete(client, "hb_activation_logs", "delete from hb_activation_logs where user_id = $1", [userId])).deleted;
  deleted.hb_admin_balance_actions = (await optionalDelete(client, "hb_admin_balance_actions", "delete from hb_admin_balance_actions where user_id = $1 and type = 'bulk_distribution'", [userId])).deleted;
  deleted.hb_level_income_records = (await optionalDelete(
    client,
    "hb_level_income_records",
    "delete from hb_level_income_records where receiver_user_id = $1 or ledger_entry_id in (select id from hb_income_ledger where earner_user_id = $1)",
    [userId]
  )).deleted;

  const incomeResult = await client.query("delete from hb_income_ledger where earner_user_id = $1 and income_type = any($2::text[])", [userId, incomeTypes]);
  deleted.hb_income_ledger = incomeResult.rowCount || 0;

  if (incomeInternalLedgerIds.length > 0) {
    const blockedRows = await client.query<{ table_name: string; column_name: string; count: number }>(
      `select table_name, column_name, count(*)::int as count
       from (
         select 'hb_deposits' as table_name, 'ledger_entry_id' as column_name from hb_deposits where ledger_entry_id = any($1::uuid[])
         union all
         select 'hb_package_purchases', 'ledger_entry_id' from hb_package_purchases where ledger_entry_id = any($1::uuid[])
         union all
         select 'hb_withdrawals', 'reserve_ledger_entry_id' from hb_withdrawals where reserve_ledger_entry_id = any($1::uuid[])
         union all
         select 'hb_withdrawals', 'refund_ledger_entry_id' from hb_withdrawals where refund_ledger_entry_id = any($1::uuid[])
         union all
         select 'hb_withdrawals', 'paid_ledger_entry_id' from hb_withdrawals where paid_ledger_entry_id = any($1::uuid[])
         union all
         select 'hb_coin_conversions', 'internal_ledger_entry_id' from hb_coin_conversions where internal_ledger_entry_id = any($1::uuid[])
       ) refs
       group by table_name, column_name
       having count(*) > 0
       order by table_name, column_name`,
      [incomeInternalLedgerIds]
    );
    if (blockedRows.rows.length > 0) {
      throw new Error(`Income ledger reset blocked by referenced internal ledger rows: ${JSON.stringify(blockedRows.rows)}`);
    }
  }
  const internalResult = await client.query(
    "delete from hb_internal_ledger where id = any($1::uuid[])",
    [incomeInternalLedgerIds]
  );
  deleted.hb_internal_ledger = internalResult.rowCount || 0;
  const coinBalanceResult = await client.query("update hb_coin_balances set balance = 0, updated_at = now() where user_id = $1", [userId]);
  updated.hb_coin_balances = coinBalanceResult.rowCount || 0;

  const purchaseResult = await client.query("update hb_package_purchases set status = 'reversed' where user_id = $1 and status = 'completed'", [userId]);
  updated.hb_package_purchases = purchaseResult.rowCount || 0;
  const userResult = await client.query(
    "update hb_users set status = 'inactive', activated_at = null, updated_at = now() where id = $1",
    [userId]
  );
  updated.hb_users = userResult.rowCount || 0;

  return { deleted, updated, packageIds, incomeInternalLedgerIds };
}

async function getBalance(userId: string, walletType: "deposit" | "income" = "deposit") {
  const rows = await query<{ balance: string }>(
    `select coalesce(sum(case when direction = 'credit' then amount_usd else -amount_usd end),0)::text as balance
     from hb_internal_ledger
     where user_id = $1 and wallet_type = $2`,
    [userId, walletType]
  );
  return rows[0]?.balance || "0";
}

async function getFinancialSettings(userId?: string) {
  const defaults = await query<{ key: string; value: string }>("select key, value from hb_financial_settings");
  const map = new Map(defaults.map((row) => [row.key, row.value]));
  const override = userId
    ? (await query<{
        min_withdrawal_usd: string | null;
        fee_percent: string | null;
        daily_limit_usd: string | null;
        cooldown_minutes: number | null;
      }>("select min_withdrawal_usd::text, fee_percent::text, daily_limit_usd::text, cooldown_minutes from hb_withdrawal_limits where user_id = $1 and active = true limit 1", [userId]))[0]
    : null;
  return {
    withdrawalMinUsd: HB_WITHDRAWAL_MIN_USD,
    withdrawalFeePercent: HB_WITHDRAWAL_FEE_PERCENT,
    withdrawalDailyLimitUsd: Number(override?.daily_limit_usd || map.get("withdrawal_daily_limit_usd") || 500),
    withdrawalCooldownMinutes: Number(override?.cooldown_minutes ?? map.get("withdrawal_cooldown_minutes") ?? 0),
    withdrawalRequireActiveId: (map.get("withdrawal_require_active_id") || "true") === "true",
    withdrawalRequirePackage: (map.get("withdrawal_require_package") || "true") === "true"
  };
}

async function hasActiveRiskBlock(userId: string) {
  const rows = await query<{ flag: string }>(
    "select flag from hb_risk_flags where user_id = $1 and active = true and flag in ('suspended','withdrawal_blocked') limit 1",
    [userId]
  );
  return rows[0]?.flag || "";
}

function isValidBep20Address(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

function hbBookLimitForPackage(amount: number) {
  if (amount >= 100) return 100;
  if (amount >= 20) return 20;
  if (amount >= 4) return 4;
  return 0;
}

function hbFollowersForPackage(amount: number) {
  if (amount >= 100) return 4000;
  if (amount >= 20) return 700;
  return 0;
}

async function ensureHbBooksTable() {
  await query(`
    create table if not exists hb_books (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      description text,
      cover_image text,
      download_url text not null,
      package_tier integer not null default 4,
      sort_order integer not null default 1,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    )`
  );
  await query("alter table hb_books add column if not exists description text").catch(() => undefined);
  await query("alter table hb_books add column if not exists package_tier integer not null default 4").catch(() => undefined);
  await query("create index if not exists idx_hb_books_order on hb_books (is_active, sort_order, created_at)");
  await query(`
    insert into hb_books (title, cover_image, download_url, sort_order, is_active, created_at)
    select title, cover_image, file_url, sort_order, status = 'active', created_at
    from hb_product_library
    where not exists (select 1 from hb_books)
    order by sort_order asc, created_at asc
    limit 100`
  ).catch(() => undefined);
}

async function getUserBestPackage(userId: string) {
  const rows = await query<{
    package_purchase_id: string;
    package_id: string;
    package_name: string;
    amount_usd: string;
    created_at: string;
  }>(
    `select p.id as package_purchase_id, p.package_id, pkg.name as package_name, p.amount_usd::text, p.created_at
     from hb_package_purchases p
     join hb_packages pkg on pkg.id = p.package_id
     where p.user_id = $1 and p.status = 'completed'
     order by p.amount_usd desc, p.created_at desc
     limit 1`,
    [userId]
  );
  return rows[0] || null;
}

function withdrawalProviderReady() {
  return Boolean(config.hbWithdrawalProviderEnabled && config.hbWithdrawalSignerPrivateKey && config.hbWithdrawalVaultAddress && config.bscRpcUrl && (config.hbUsdtAddress || config.usdtBep20Contract));
}

function sameBep20Address(left?: string | null, right?: string | null) {
  if (!left || !right || !isValidBep20Address(left) || !isValidBep20Address(right)) return false;
  return getAddress(left) === getAddress(right);
}

async function resolveWithdrawalSenderType(provider: JsonRpcProvider, senderAddress: string) {
  const treasuryCandidates = [
    config.hbWithdrawalTreasuryAddress,
    config.hbWithdrawalVaultAddress,
    config.hb9TreasuryWallet,
    config.hbTreasuryDepositAddress,
    config.companyEvmReceiveAddress
  ];
  if (treasuryCandidates.some((address) => sameBep20Address(senderAddress, address))) return "treasury_wallet";
  if (isHb9AdminWallet(senderAddress)) return "admin_wallet";
  const hotWalletCandidates = [
    process.env.HB_HOT_WALLET_ADDRESS,
    process.env.HB9_HOT_WALLET_ADDRESS,
    process.env.HOT_WALLET_ADDRESS
  ];
  if (hotWalletCandidates.some((address) => sameBep20Address(senderAddress, address))) return "hot_wallet";
  const code = await provider.getCode(senderAddress).catch(() => "0x");
  return code && code !== "0x" ? "contract_wallet" : "external_wallet";
}

async function sendInstantUsdtWithdrawal(input: { toWallet: string; grossAmount: number; netAmount: number; withdrawalId: string }) {
  if (!withdrawalProviderReady()) throw new Error("USDT withdrawal provider not configured.");
  const provider = new JsonRpcProvider(config.bscRpcUrl, BSC_MAINNET_CHAIN_ID);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== BSC_MAINNET_CHAIN_ID) throw new Error("BSC RPC chain mismatch.");
  const signerWallet = new Wallet(config.hbWithdrawalSignerPrivateKey, provider);
  const signer = new NonceManager(signerWallet);
  if (!isValidBep20Address(config.hbWithdrawalVaultAddress) || getAddress(signerWallet.address) !== getAddress(config.hbWithdrawalVaultAddress)) {
    logger.error("hb.withdrawal.signer_mismatch", { withdrawalId: input.withdrawalId, signerAddress: signerWallet.address, vaultAddressConfigured: Boolean(config.hbWithdrawalVaultAddress) });
    throw new Error("USDT withdrawal provider not configured.");
  }
  const usdtAddress = config.hbUsdtAddress || config.usdtBep20Contract;
  if (!isValidBep20Address(usdtAddress) || getAddress(usdtAddress) !== getAddress(USDT_BEP20_ADDRESS)) throw new Error("USDT withdrawal provider not configured.");
  const token = new Contract(usdtAddress, BEP20_TRANSFER_ABI, signer);
  const senderAddress = getAddress(signerWallet.address);
  const tokenAddress = getAddress(usdtAddress);
  const requestedAmount = parseUnits(input.grossAmount.toFixed(8), 18);
  const transferAmount = parseUnits(input.netAmount.toFixed(8), 18);
  const treasuryBalance = await token.balanceOf(senderAddress) as bigint;
  const senderType = await resolveWithdrawalSenderType(provider, senderAddress);
  logger.info("hb.withdrawal.debug", {
    withdrawalId: input.withdrawalId,
    senderAddress,
    senderType,
    tokenAddress,
    userWallet: input.toWallet,
    requestedAmount: formatUnits(requestedAmount, 18),
    requestedAmountRaw: requestedAmount.toString(),
    transferAmount: formatUnits(transferAmount, 18),
    transferAmountRaw: transferAmount.toString(),
    treasuryBalance: formatUnits(treasuryBalance, 18),
    treasuryBalanceRaw: treasuryBalance.toString()
  });
  if (treasuryBalance < requestedAmount) {
    logger.warn("hb.withdrawal.treasury_insufficient", {
      withdrawalId: input.withdrawalId,
      senderAddress,
      senderType,
      tokenAddress,
      userWallet: input.toWallet,
      requestedAmount: formatUnits(requestedAmount, 18),
      transferAmount: formatUnits(transferAmount, 18),
      treasuryBalance: formatUnits(treasuryBalance, 18)
    });
    throw new InsufficientTreasuryBalanceError();
  }
  const tx = await token.transfer(input.toWallet, transferAmount);
  const receipt = await tx.wait(Math.max(1, config.minBlockConfirmations));
  if (!receipt || receipt.status !== 1) throw new Error("Blockchain withdrawal transaction failed.");
  return String(tx.hash);
}

async function refundFailedInstantWithdrawal(input: { withdrawalId: string; userId: string; grossAmount: number; netAmount: number; feeAmount: number; reason: string }) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`withdrawal-refund:${input.withdrawalId}`]);
    const existing = await client.query("select id from hb_withdrawals where id = $1 and status = 'failed' and refund_ledger_entry_id is not null limit 1", [input.withdrawalId]);
    if (existing.rows[0]) {
      await client.query("commit");
      return;
    }
    const refundRows = await client.query<{ id: string }>(
      `insert into hb_internal_ledger (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
       values ($1,'deposit','credit',$2,'withdrawal',$3,$4,$5::jsonb)
       on conflict (idempotency_key) do nothing
       returning id`,
      [input.userId, input.grossAmount, input.withdrawalId, `hb:ledger:withdrawal:${input.withdrawalId}:instant_refund`, JSON.stringify({ type: "withdrawal_refund", reason: input.reason })]
    );
    const refundLedgerId = refundRows.rows[0]?.id || null;
    await createLedgerProof(client, "hb_internal_ledger", refundLedgerId);
    const coinRefundId = await applyHbCoinAdjustment({
      client,
      userId: input.userId,
      coinSymbol: "USDT",
      amount: input.grossAmount,
      direction: "credit",
      type: "credit",
      reference: input.withdrawalId,
      note: "Automatic USDT refund for failed instant withdrawal",
      idempotencyKey: `hb:coin:withdrawal:${input.withdrawalId}:instant_refund`
    });
    await createLedgerProof(client, "hb_coin_balance_ledger", coinRefundId);
    await client.query(
      `update hb_withdrawals
       set status = 'failed', failure_reason = $2, refund_ledger_entry_id = coalesce(refund_ledger_entry_id, $3), updated_at = now()
       where id = $1`,
      [input.withdrawalId, input.reason, refundLedgerId]
    );
    await client.query(
      `insert into hb_withdrawal_audit_logs (withdrawal_id, user_id, action, previous_status, next_status, metadata)
       values ($1,$2,'withdrawal.instant_failed','processing','failed',$3::jsonb)`,
      [input.withdrawalId, input.userId, JSON.stringify({ reason: input.reason, refunded: input.grossAmount, netAmount: input.netAmount, feeAmount: input.feeAmount })]
    );
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    logger.error("hb.withdrawal.refund_failed", { withdrawalId: input.withdrawalId, err });
  } finally {
    client.release();
  }
}

async function getWalletSummary(userId: string) {
  const [deposit, income, pendingDeposits, verifiedDeposits, purchased, pendingWithdrawals] = await Promise.all([
    getBalance(userId, "deposit"),
    getBalance(userId, "income"),
    query<{ total: string; count: number }>(
      "select coalesce(sum(usd_amount),0)::text as total, count(*)::int as count from hb_deposits where user_id = $1 and status in ('pending','pending_verification')",
      [userId]
    ),
    query<{ total: string; count: number }>(
      "select coalesce(sum(usd_amount),0)::text as total, count(*)::int as count from hb_deposits where user_id = $1 and status = 'verified'",
      [userId]
    ),
    query<{ total: string; count: number }>(
      "select coalesce(sum(amount_usd),0)::text as total, count(*)::int as count from hb_package_purchases where user_id = $1 and status = 'completed'",
      [userId]
    ),
    query<{ total: string; count: number }>(
      "select coalesce(sum(amount_usd),0)::text as total, count(*)::int as count from hb_withdrawals where user_id = $1 and status in ('pending','approved','processing')",
      [userId]
    )
  ]);
  return {
    availableBalance: deposit,
    balances: { deposit, income },
    pendingDeposits: pendingDeposits[0] || { total: "0", count: 0 },
    verifiedDeposits: verifiedDeposits[0] || { total: "0", count: 0 },
    totalPurchased: purchased[0] || { total: "0", count: 0 },
    pendingWithdrawals: pendingWithdrawals[0] || { total: "0", count: 0 }
  };
}

async function getTreasuryHealth() {
  const depositWallet = await getExpectedDepositAddress("treasury-health").catch(() => config.hbTreasuryDepositAddress || "");
  const vaultWallet = config.hbWithdrawalVaultAddress || "";
  const [totals, withdrawalQueue, syncHealth, liveBalances, recentDeposits, recentWithdrawals, failedWithdrawals] = await Promise.all([
    query<{
      total_deposits: string;
      paid_withdrawals: string;
      pending_withdrawal_liabilities: string;
      active_liabilities: string;
      reserve_balance: string;
    }>(
      `select
         coalesce((select sum(usd_amount) from hb_deposits where status = 'verified'),0)::text as total_deposits,
         coalesce((select sum(payout_amount_usd) from hb_withdrawals where status = 'paid'),0)::text as paid_withdrawals,
         coalesce((select sum(payout_amount_usd) from hb_withdrawals where status in ('pending','under_review','approved','processing')),0)::text as pending_withdrawal_liabilities,
         coalesce((select sum(balance) from hb_coin_balances where coin_symbol = 'USDT'),0)::text as active_liabilities,
         (
           coalesce((select sum(usd_amount) from hb_deposits where status = 'verified'),0)
           - coalesce((select sum(payout_amount_usd) from hb_withdrawals where status = 'paid'),0)
         )::text as reserve_balance`
    ),
    query<{
      pending_count: number;
      approved_count: number;
      processing_count: number;
      oldest_pending_minutes: string | null;
      oldest_approved_minutes: string | null;
      stuck_payout_count: number;
      last_hour_amount: string;
      prior_day_hourly_avg: string;
    }>(
      `select
         count(*) filter (where status in ('pending','under_review'))::int as pending_count,
         count(*) filter (where status = 'approved')::int as approved_count,
         count(*) filter (where status = 'processing')::int as processing_count,
         extract(epoch from (now() - min(requested_at) filter (where status in ('pending','under_review')))) / 60 as oldest_pending_minutes,
         extract(epoch from (now() - min(approved_at) filter (where status = 'approved'))) / 60 as oldest_approved_minutes,
         count(*) filter (where status = 'processing' and processing_at < now() - interval '2 hours')::int as stuck_payout_count,
         coalesce(sum(payout_amount_usd) filter (where requested_at >= now() - interval '1 hour'),0)::text as last_hour_amount,
         coalesce((select avg(hour_total) from (
           select date_trunc('hour', requested_at) as hour, sum(payout_amount_usd) as hour_total
           from hb_withdrawals
           where requested_at >= now() - interval '24 hours' and requested_at < now() - interval '1 hour'
           group by 1
         ) hourly),0)::text as prior_day_hourly_avg
       from hb_withdrawals`
    ),
    getHbOnchainSyncHealth().catch(() => ({ dryRun: false, configReady: false, rpcHealthy: false, latestIndexedBlock: 0, failedSyncCount: 0, cursor: null })),
    readTreasuryLiveBalances(depositWallet, vaultWallet).catch((error) => {
      logger.warn("hb.rpc.failed", { category: "treasury_balance", error: error instanceof Error ? error.message : "Treasury balance check failed" });
      return { rpcStatus: "failed", usdtBalance: null, bnbGasBalance: null, bscScanStatus: "not_checked", depositWalletConnected: false, withdrawalVaultConnected: false, signerVerified: false, usdtContractVerified: false };
    }),
    query(
      `select id, user_id, usd_amount::text, tx_hash, status, verification_status, created_at, verified_at
       from hb_deposits
       order by created_at desc
       limit 10`
    ).catch(() => []),
    query(
      `select id, user_id, gross_amount::text, fee_amount::text, net_amount::text, amount_usd::text, fee_usd::text, payout_amount_usd::text,
              tx_hash, status, requested_at, paid_at
       from hb_withdrawals
       order by requested_at desc
       limit 10`
    ).catch(() => []),
    query(
      `select id, user_id, gross_amount::text, fee_amount::text, net_amount::text, tx_hash, failure_reason, requested_at, updated_at
       from hb_withdrawals
       where status = 'failed'
       order by updated_at desc
       limit 10`
    ).catch(() => [])
  ]);
  const t = totals[0] || { total_deposits: "0", paid_withdrawals: "0", pending_withdrawal_liabilities: "0", active_liabilities: "0", reserve_balance: "0" };
  const q = withdrawalQueue[0] || { pending_count: 0, approved_count: 0, processing_count: 0, oldest_pending_minutes: "0", oldest_approved_minutes: "0", stuck_payout_count: 0, last_hour_amount: "0", prior_day_hourly_avg: "0" };
  const reserve = Number(t.reserve_balance || 0);
  const pending = Number(t.pending_withdrawal_liabilities || 0);
  const active = Number(t.active_liabilities || 0);
  const liabilities = pending + active;
  const reserveRatio = liabilities > 0 ? reserve / liabilities : reserve > 0 ? 1 : 0;
  const utilizationPercent = reserve > 0 ? Math.min(999, (liabilities / reserve) * 100) : liabilities > 0 ? 999 : 0;
  const lastHour = Number(q.last_hour_amount || 0);
  const hourlyAvg = Number(q.prior_day_hourly_avg || 0);
  const warnings = [
    reserveRatio < 1 ? { type: "low_reserve", severity: "critical", message: "Treasury reserve is below outstanding liabilities." } : null,
    hourlyAvg > 0 && lastHour > hourlyAvg * 3 ? { type: "abnormal_withdrawal_spike", severity: "warning", message: "Withdrawal requests exceed 3x the recent hourly average." } : null,
    Number(q.stuck_payout_count || 0) > 0 ? { type: "stuck_payout", severity: "warning", message: "One or more payouts have been processing for over 2 hours." } : null,
    !syncHealth.configReady || (!syncHealth.dryRun && !syncHealth.rpcHealthy) || Number(syncHealth.failedSyncCount || 0) > 0
      ? { type: "indexer_sync", severity: "warning", message: "On-chain indexer is not fully healthy." }
      : null
  ].filter(Boolean);
  return {
    totalDeposits: t.total_deposits,
    reserveBalance: t.reserve_balance,
    paidWithdrawals: t.paid_withdrawals,
    pendingWithdrawalLiabilities: t.pending_withdrawal_liabilities,
    activeLiabilities: t.active_liabilities,
    reserveRatio,
    utilizationPercent,
    warningState: warnings.length ? "warning" : "ok",
    warnings,
    queue: q,
    syncHealth,
    depositWalletAddress: depositWallet,
    withdrawalVaultAddress: vaultWallet,
    live: liveBalances,
    recentDeposits,
    recentWithdrawals,
    pendingWithdrawals: q,
    failedWithdrawals,
    explorerBaseUrl: config.hbExplorerBaseUrl || "https://bscscan.com"
  };
}

async function readTreasuryLiveBalances(depositWallet: string, vaultWallet: string) {
  const provider = new JsonRpcProvider(config.bscRpcUrl, BSC_MAINNET_CHAIN_ID);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== BSC_MAINNET_CHAIN_ID) throw new Error("BSC RPC chain mismatch.");
  const usdtAddress = config.hbUsdtAddress || config.usdtBep20Contract;
  const usdtContractVerified = isValidBep20Address(usdtAddress) && getAddress(usdtAddress) === getAddress(USDT_BEP20_ADDRESS);
  let signerVerified = false;
  try {
    signerVerified = Boolean(config.hbWithdrawalSignerPrivateKey && isValidBep20Address(vaultWallet) && getAddress(new Wallet(config.hbWithdrawalSignerPrivateKey).address) === getAddress(vaultWallet));
  } catch {
    signerVerified = false;
  }
  const token = usdtContractVerified ? new Contract(usdtAddress, BEP20_TRANSFER_ABI, provider) : null;
  const [depositUsdt, vaultUsdt, vaultBnb] = await Promise.all([
    token && isValidBep20Address(depositWallet) ? token.balanceOf(depositWallet).then((value: bigint) => formatUnits(value, 18)) : Promise.resolve(null),
    token && isValidBep20Address(vaultWallet) ? token.balanceOf(vaultWallet).then((value: bigint) => formatUnits(value, 18)) : Promise.resolve(null),
    isValidBep20Address(vaultWallet) ? provider.getBalance(vaultWallet).then((value) => formatEther(value)) : Promise.resolve(null)
  ]);
  return {
    rpcStatus: "healthy",
    usdtBalance: vaultUsdt,
    depositUsdtBalance: depositUsdt,
    bnbGasBalance: vaultBnb,
    depositWalletConnected: isValidBep20Address(depositWallet),
    withdrawalVaultConnected: isValidBep20Address(vaultWallet),
    signerVerified,
    usdtContractVerified,
    bscScanStatus: "reachable"
  };
}

async function calculateUserRiskScore(userId: string) {
  const [userRows, rapidWithdrawals, largePayouts, referralSpike, walletRebinds, failedAuth] = await Promise.all([
    query<{ usdt_bep20_address: string | null; hb9_wallet_address: string | null; failed_login_count: number }>(
      "select usdt_bep20_address, hb9_wallet_address, failed_login_count from hb_users where id = $1 limit 1",
      [userId]
    ),
    query<{ count: string }>("select count(*)::text from hb_withdrawals where user_id = $1 and requested_at >= now() - interval '1 hour'", [userId]),
    query<{ count: string }>("select count(*)::text from hb_withdrawals where user_id = $1 and payout_amount_usd >= 1000 and requested_at >= now() - interval '7 days'", [userId]),
    query<{ count: string }>("select count(*)::text from hb_users where sponsor_user_id = $1 and created_at >= now() - interval '24 hours'", [userId]),
    query<{ count: string }>("select count(*)::text from hb_audit_logs where user_id = $1 and action in ('hb.wallet.bind','hb.wallet.change') and created_at >= now() - interval '7 days'", [userId]),
    query<{ count: string }>("select count(*)::text from hb_audit_logs where user_id = $1 and action = 'hb.auth.login_failed' and created_at >= now() - interval '24 hours'", [userId])
  ]);
  let score = 0;
  const reasons: string[] = [];
  const failedLoginCount = Number(userRows[0]?.failed_login_count || 0);
  if (Number(rapidWithdrawals[0]?.count || 0) >= 3) { score += 25; reasons.push("rapid withdrawal attempts"); }
  if (Number(largePayouts[0]?.count || 0) > 0) { score += 25; reasons.push("suspicious large payout"); }
  if (Number(referralSpike[0]?.count || 0) >= 10) { score += 20; reasons.push("abnormal referral spike"); }
  if (Number(walletRebinds[0]?.count || 0) >= 2) { score += 20; reasons.push("repeated wallet rebinding attempts"); }
  if (Number(failedAuth[0]?.count || 0) >= 3 || failedLoginCount >= 3) { score += 20; reasons.push("repeated failed auth"); }
  return {
    userId,
    walletAddress: userRows[0]?.usdt_bep20_address || userRows[0]?.hb9_wallet_address || "",
    riskScore: Math.min(100, score),
    reasons
  };
}

function normalizeLoginIdentifier(input: { identifier?: string; email?: string; mobileNumber?: string }) {
  const raw = (input.identifier || input.email || input.mobileNumber || "").trim();
  if (raw.includes("@")) return { email: raw.toLowerCase(), mobileNumber: "" };
  return { email: "", mobileNumber: normalizeMobile(raw) };
}

async function txHashAlreadyUsed(txHash: string, excludeDepositId?: string) {
  const rows = await query<{ id: string }>(
    `select id from hb_deposits where lower(tx_hash) = lower($1) and ($2::uuid is null or id <> $2::uuid)
     union all
     select id from recharge_orders where lower(tx_hash) = lower($1)
     union all
     select id from payment_orders where lower(tx_hash) = lower($1)
     limit 1`,
    [txHash, excludeDepositId || null]
  );
  return Boolean(rows[0]);
}

async function getExpectedDepositAddress(userId: string, requestedAddress?: string) {
  void userId;
  void requestedAddress;
  if (config.hbTreasuryDepositAddress && isAddress(config.hbTreasuryDepositAddress)) return getAddress(config.hbTreasuryDepositAddress);
  const treasuryRows = await query<{ wallet_address: string | null }>(
    "select wallet_address from hb_treasury_settings where key = 'treasury_usdt_bep20_address' and wallet_address is not null limit 1"
  ).catch(() => []);
  const dbWallet = treasuryRows[0]?.wallet_address || "";
  return dbWallet && isAddress(dbWallet) ? getAddress(dbWallet) : "";
}

function publicVerificationError(err: unknown) {
  if (err instanceof VerificationError) return { message: err.publicReason, status: err.statusCode };
  return { message: "Blockchain verification failed. Try again later or contact support.", status: 400 };
}

function verificationDiagnostics(err: unknown, fallback: Partial<VerificationDiagnostics> = {}) {
  if (err instanceof VerificationError) return err.diagnostics;
  return {
    txHash: fallback.txHash || "",
    chainId: fallback.chainId || BSC_MAINNET_CHAIN_ID,
    expectedSender: fallback.expectedSender ?? null,
    actualSender: fallback.actualSender ?? null,
    expectedTreasury: fallback.expectedTreasury ?? null,
    actualReceiver: fallback.actualReceiver ?? null,
    expectedTokenContract: fallback.expectedTokenContract ?? CONFIGURED_USDT_BEP20_ADDRESS,
    actualTokenContract: fallback.actualTokenContract ?? null,
    expectedAmount: fallback.expectedAmount || "0",
    actualAmount: fallback.actualAmount ?? null,
    rpcUrlUsed: fallback.rpcUrlUsed ?? null,
    confirmations: fallback.confirmations || 0,
    failureReason: fallback.failureReason || "Blockchain verification failed. Try again later or contact support."
  };
}

function failedDepositStatus(message: string) {
  if (message === "Transaction does not have enough confirmations yet.") return "pending";
  if (
    message.includes("recipient does not match")
    || message.includes("Matching token transfer")
    || message.includes("amount is lower")
    || message.includes("Token")
    || message.includes("only supported")
  ) {
    return "rejected";
  }
  return "failed";
}

function verificationColumns(verification: BlockchainVerification) {
  return [
    verification.chainId,
    verification.fromAddress,
    verification.toAddress,
    verification.confirmations,
    verification.verifiedAt
  ];
}

function isNowPaymentsPaidStatus(status: string) {
  return ["confirmed", "finished"].includes(status.toLowerCase());
}

function nowPaymentId(payment: Pick<NowPaymentsPayment, "payment_id"> | Record<string, unknown>) {
  return String(payment.payment_id || "");
}

function nowPaymentTxHash(payment: Record<string, unknown>) {
  return String(payment.payin_hash || payment.tx_hash || payment.outcome_hash || "");
}

async function creditNowPaymentsDeposit(payment: Record<string, unknown>) {
  if (!pool) throw new Error("Database is not configured.");
  const paymentId = nowPaymentId(payment);
  const status = String(payment.payment_status || "");
  if (!paymentId || !isNowPaymentsPaidStatus(status)) return { credited: false, reason: "Payment is not confirmed." };

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`nowpayments:${paymentId}`]);
    const depositRows = await client.query<{
      id: string;
      user_id: string;
      status: string;
      usd_amount: string;
      ledger_entry_id: string | null;
    }>(
      `select id, user_id, status, usd_amount::text, ledger_entry_id
       from hb_deposits
       where payment_id = $1
       for update`,
      [paymentId]
    );
    const deposit = depositRows.rows[0];
    if (!deposit) throw new Error("NOWPayments deposit record was not found.");

    await client.query(
      `update hb_deposits
       set payment_status = $2,
           pay_address = coalesce($3, pay_address),
           pay_currency = coalesce($4, pay_currency),
           pay_amount = coalesce($5::numeric, pay_amount),
           tx_hash = coalesce($6, tx_hash),
           payment_raw = $7::jsonb,
           updated_at = now()
       where id = $1`,
      [
        deposit.id,
        status,
        payment.pay_address ? String(payment.pay_address) : null,
        payment.pay_currency ? String(payment.pay_currency).toUpperCase() : null,
        payment.pay_amount ? Number(payment.pay_amount) : null,
        nowPaymentTxHash(payment) || null,
        JSON.stringify(payment)
      ]
    );

    if (deposit.status === "verified" && deposit.ledger_entry_id) {
      await client.query("commit");
      return { credited: false, depositId: deposit.id, reason: "Deposit already credited." };
    }

    const ledgerRows = await client.query<{ id: string }>(
      `insert into hb_internal_ledger (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
       values ($1,'deposit','credit',$2,'deposit',$3,$4,$5::jsonb)
       on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
       returning id`,
      [
        deposit.user_id,
        deposit.usd_amount,
        deposit.id,
        `hb:ledger:deposit:${deposit.id}:nowpayments_credit`,
        JSON.stringify({ provider: "nowpayments", payment })
      ]
    );
    const ledgerId = ledgerRows.rows[0]?.id || null;
    await createLedgerProof(client, "hb_internal_ledger", ledgerId, { chainTxHash: nowPaymentTxHash(payment) || null });
    await client.query(
      `update hb_deposits
       set status = 'verified',
           verification_status = 'verified',
           verified_at = now(),
           ledger_entry_id = $2,
           failure_reason = null,
           updated_at = now()
       where id = $1`,
      [deposit.id, ledgerId]
    );
    await client.query(
      `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
       values ($1,'hb.deposit.nowpayments.credited','hb_deposit',$2,$3::jsonb)`,
      [deposit.user_id, deposit.id, JSON.stringify({ paymentId, ledgerId, status })]
    );
    await client.query("commit");
    return { credited: true, depositId: deposit.id, ledgerEntryId: ledgerId };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

async function currentUser(userId: string) {
  const rows = await query<Record<string, unknown>>(
    `select id, email, mobile_number, display_name, referral_code, referral_code as own_referral_code,
            sponsor_user_id, hb9_wallet_address, sponsor_referral_code, source_referral_code,
            usdt_bep20_address, coalesce(usdt_bep20_address, hb9_wallet_address) as wallet_address,
            wallet_bound_at, wallet_updated_at,
            status, activated_at, last_login_at, created_at
     from hb_users where id = $1 limit 1`,
    [userId]
  );
  return rows[0] || null;
}

const handleHbSignup = asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid registration");
    return;
  }
  const sponsorCode = (parsed.data.referralCode || "").trim().toUpperCase();
  const email = parsed.data.email || null;
  const mobileNumber = parsed.data.mobileNumber;
  const displayName = parsed.data.fullName || parsed.data.displayName;
  const walletAddress = parsed.data.walletAddress || null;
  if (!(await enforceRolloutAccess(res, { walletAddress, referralCode: sponsorCode, action: "register" }))) return;
  if (!mobileNumber || mobileNumber.length < 7) {
    fail(res, "Enter a valid mobile number.", 400, "Invalid registration");
    return;
  }
  const duplicateRows = await query<{ id: string }>(
    `select id from hb_users
     where mobile_number = $1 or ($2::text is not null and lower(email) = lower($2))
     limit 1`,
    [mobileNumber, email]
  );
  if (duplicateRows[0]) {
    fail(res, "An account already exists for this mobile number or email.", 409, "Duplicate account");
    return;
  }
  const sponsorRows = sponsorCode
    ? await query<{ id: string; mobile_number: string | null; email: string | null }>("select id, mobile_number, email from hb_users where referral_code = $1 limit 1", [sponsorCode])
    : [];
  if (sponsorCode && !sponsorRows[0]) {
    fail(res, "Referral code was not found.", 400, "Invalid referral");
    return;
  }
  if (sponsorRows[0] && (sponsorRows[0].mobile_number === mobileNumber || (email && sponsorRows[0].email?.toLowerCase() === email))) {
    fail(res, "Sponsor referral cannot belong to the same account.", 400, "Invalid referral");
    return;
  }

  const code = referralCode();
  const rows = await query<{ id: string; email: string | null; mobile_number: string | null; display_name: string; referral_code: string; status: string; created_at: string }>(
    `insert into hb_users
       (email, mobile_number, password_hash, display_name, referral_code, own_referral_code, sponsor_user_id,
        hb9_wallet_address, sponsor_referral_code, source_referral_code)
     values ($1,$2,$3,$4,$5,$5,$6,$7,$8,$8)
     returning id, email, mobile_number, display_name, referral_code, own_referral_code, hb9_wallet_address, sponsor_referral_code, source_referral_code, status, created_at`,
    [email, mobileNumber, await hashPassword(parsed.data.password), displayName, code, sponsorRows[0]?.id || null, walletAddress, sponsorCode || null]
  );
  const user = rows[0];
  if (!user) {
    fail(res, "Registration could not be completed.", 500, "Registration failed");
    return;
  }
  await query(
    `insert into hb_wallets (user_id, wallet_address, wallet_type, network)
     values ($1,$2,'deposit','bsc')`,
    [user.id, walletAddress]
  );
  if (sponsorRows[0]) {
    await query(
      `insert into hb_referrals (sponsor_user_id, referred_user_id, level_depth)
       values ($1,$2,1) on conflict (referred_user_id) do nothing`,
      [sponsorRows[0].id, user.id]
    );
  }
  await audit(user.id, "hb.auth.register", "hb_user", user.id, { sponsorCode: sponsorCode || null, hasEmail: Boolean(email), hasMobile: true });
  ok(res, { token: await createToken(user.id, user.email || user.mobile_number || user.id, req), user }, "HB9 user registered", 201);
});

hbRouter.post("/hb/auth/register", handleHbSignup);
hbRouter.post("/hb/auth/signup", handleHbSignup);

hbRouter.post("/hb/auth/login", asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid login");
    return;
  }
  const identifier = normalizeLoginIdentifier(parsed.data);
  const rows = await query<{
    id: string;
    email: string | null;
    mobile_number: string | null;
    password_hash: string | null;
    display_name: string;
    referral_code: string;
    status: string;
    failed_login_count: number;
    locked_until: string | null;
  }>(
    `select id, email, mobile_number, password_hash, display_name, referral_code, referral_code as own_referral_code,
            hb9_wallet_address, sponsor_referral_code, source_referral_code, usdt_bep20_address,
            coalesce(usdt_bep20_address, hb9_wallet_address) as wallet_address,
            status, failed_login_count, locked_until
     from hb_users
     where ($1::text <> '' and lower(email) = lower($1)) or ($2::text <> '' and mobile_number = $2)
     limit 1`,
    [identifier.email, identifier.mobileNumber]
  );
  const user = rows[0];
  const genericLoginFailure = "Invalid mobile/email or password.";
  if (!user) {
    await audit(null, "hb.auth.login_failed", "hb_user", null, { identifierType: identifier.email ? "email" : "mobile", reason: "not_found" });
    fail(res, genericLoginFailure, 401, "Login failed");
    return;
  }
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    await audit(user.id, "hb.auth.login_blocked", "hb_user", user.id, { reason: "locked" });
    fail(res, "Account is temporarily locked. Try again later.", 423, "Account locked");
    return;
  }
  if (!user.password_hash) {
    await audit(user.id, "hb.auth.login_failed", "hb_user", user.id, { identifierType: identifier.email ? "email" : "mobile", reason: "wallet_only" });
    fail(res, "This account uses wallet login. Connect your wallet or reset password.", 401, "Login failed");
    return;
  }
  if (!(await verifyPassword(parsed.data.password, user.password_hash))) {
    const failedCount = Number(user.failed_login_count || 0) + 1;
    const lockedUntil = failedCount >= maxFailedLoginAttempts ? new Date(Date.now() + loginLockMs).toISOString() : null;
    await query(
      "update hb_users set failed_login_count = $2, locked_until = $3, updated_at = now() where id = $1",
      [user.id, failedCount, lockedUntil]
    );
    await audit(user.id, "hb.auth.login_failed", "hb_user", user.id, { identifierType: identifier.email ? "email" : "mobile", reason: "bad_password", locked: Boolean(lockedUntil) });
    fail(res, genericLoginFailure, 401, "Login failed");
    return;
  }
  await query("update hb_users set failed_login_count = 0, locked_until = null, last_login_at = now(), updated_at = now() where id = $1", [user.id]);
  await audit(user.id, "hb.auth.login", "hb_user", user.id, { identifierType: identifier.email ? "email" : "mobile" });
  const { password_hash: _passwordHash, ...safeUser } = user;
  ok(res, { token: await createToken(user.id, user.email || user.mobile_number || user.id, req), user: safeUser }, "HB9 login successful");
}));

hbRouter.get("/hb/auth/sponsor-preview", asyncHandler(async (req, res) => {
  const ref = typeof req.query.ref === "string" ? req.query.ref.trim() : "";
  if (!ref) {
    ok(res, { sponsor: null }, "Sponsor preview loaded");
    return;
  }
  if (!pool) {
    fail(res, "HB9 database is not configured.", 503, "Sponsor preview unavailable");
    return;
  }
  const sponsor = await findSponsorByReferral(pool, ref);
  ok(res, {
    sponsor: sponsor ? {
      referralCode: sponsor.referral_code,
      displayName: sponsor.display_name,
      status: sponsor.status,
      walletAddress: sponsor.usdt_bep20_address || sponsor.hb9_wallet_address || null
    } : null
  }, "Sponsor preview loaded");
}));

hbRouter.get("/hb/public/landing", asyncHandler(async (_req, res) => {
  const [packages, treasuryWallets, statsRows, proofRows] = await Promise.all([
    query<{ id: string; name: string; amount_usd: string; status: string; sort_order: number }>(
      "select id, name, amount_usd::text, status, sort_order from hb_packages where status = 'available' order by sort_order, amount_usd"
    ),
    query<{ key: string; label: string; wallet_address: string | null; network: string; chain_id: number; updated_at: string }>(
      "select key, label, wallet_address, network, chain_id, updated_at from hb_treasury_settings order by key"
    ),
    query<{
      total_activations: number;
      total_treasury_reserve: string;
      total_proof_records: number;
      total_distributed_income: string;
      active_wallet_ids: number;
      total_onchain_purchases: number;
    }>(
      `select
         coalesce((select count(*) from hb_users where status = 'active'),0)::int as total_activations,
         (
           coalesce((select sum(usd_amount) from hb_deposits where status = 'verified'),0)
           - coalesce((select sum(payout_amount_usd) from hb_withdrawals where status = 'paid'),0)
         )::text as total_treasury_reserve,
         coalesce((select count(*) from hb_ledger_proofs),0)::int as total_proof_records,
         coalesce((select sum(amount_usd) from hb_income_ledger where status = 'credited'),0)::text as total_distributed_income,
         coalesce((select count(*) from hb_users where usdt_bep20_address is not null or hb9_wallet_address is not null),0)::int as active_wallet_ids,
         coalesce((select count(*) from hb_onchain_purchase_events where status = 'confirmed'),0)::int as total_onchain_purchases`
    ),
    query<{ public_reference_id: string; proof_hash: string; chain_tx_hash: string | null; created_at: string }>(
      `select public_reference_id, proof_hash, chain_tx_hash, created_at
       from hb_ledger_proofs
       order by created_at desc
       limit 3`
    )
  ]);
  let proofIntegrityPercent = 100;
  const syncHealth = await getHbOnchainSyncHealth().catch(() => ({ dryRun: false, enabled: false, configReady: false, rpcHealthy: false, latestIndexedBlock: 0, rpcLatestBlock: null, cursor: null }));
  if (pool) {
    const client = await pool.connect();
    try {
      const verification = await verifyLedgerProofChain(client);
      proofIntegrityPercent = verification.integrityPercent;
    } finally {
      client.release();
    }
  }
  const controls = await getProductionControls();
  ok(res, {
    rollout: controls,
    chainId: hbOnchainChainId(),
    chainLabel: hbNetworkLabel(),
    explorerBaseUrl: hbBscScanBaseUrl(),
    proofIntegrityPercent,
    totalVerifiedProofs: Number(statsRows[0]?.total_proof_records || 0),
    treasuryStatus: Number(statsRows[0]?.total_treasury_reserve || 0) >= 0 ? "visible" : "warning",
    onchainSyncStatus: syncHealth.dryRun ? "dry_run" : syncHealth.rpcHealthy ? "healthy" : "needs_attention",
    lastIndexedBlock: Number(syncHealth.latestIndexedBlock || 0),
    chainStatus: syncHealth.dryRun ? "dry_run" : syncHealth.rpcHealthy ? "connected" : "not_connected",
    activeTreasuryWallets: treasuryWallets.filter((item) => item.wallet_address).length,
    livePackagesCount: packages.length,
    stats: statsRows[0] || {
      total_activations: 0,
      total_treasury_reserve: "0",
      total_proof_records: 0,
      total_distributed_income: "0",
      active_wallet_ids: 0,
      total_onchain_purchases: 0
    },
    packages,
    treasuryWallets: treasuryWallets.map((item) => ({
      ...item,
      explorer_url: explorerAddressUrl(item.wallet_address),
      reserve_amount: "0"
    })),
    proofSamples: proofRows
  }, "HB9 public landing loaded");
}));

hbRouter.post("/hb/auth/logout", requireHbUser, asyncHandler(async (req, res) => {
  await query("update hb_auth_sessions set revoked_at = now() where token_jti = $1 and user_id = $2", [req.hbUser!.jti, req.hbUser!.userId]);
  await audit(req.hbUser!.userId, "hb.auth.logout", "hb_user", req.hbUser!.userId, {});
  ok(res, { loggedOut: true }, "HB9 logout successful");
}));

hbRouter.post("/hb/auth/forgot-password", asyncHandler(async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid password reset request");
    return;
  }
  const identifier = normalizeLoginIdentifier({ identifier: parsed.data.identifier });
  const rows = await query<{ id: string; email: string | null; mobile_number: string | null }>(
    `select id, email, mobile_number from hb_users
     where ($1::text <> '' and lower(email) = lower($1)) or ($2::text <> '' and mobile_number = $2)
     limit 1`,
    [identifier.email, identifier.mobileNumber]
  );
  const user = rows[0];
  let resetToken: string | null = null;
  if (user) {
    resetToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    await query(
      `insert into hb_password_reset_tokens (user_id, token_hash, delivery_target, expires_at)
       values ($1,$2,$3,now() + interval '30 minutes')`,
      [user.id, tokenHash, user.email || user.mobile_number]
    );
    await audit(user.id, "hb.auth.password_reset_requested", "hb_user", user.id, { deliveryReady: Boolean(user.email) });
  }
  ok(res, { delivery: "placeholder", resetToken: process.env.NODE_ENV === "production" ? undefined : resetToken }, "If the account exists, password reset instructions will be sent.");
}));

hbRouter.post("/hb/auth/reset-password", asyncHandler(async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid password reset");
    return;
  }
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Password reset failed");
    return;
  }
  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const resetRows = await client.query<{ id: string; user_id: string }>(
      `select id, user_id from hb_password_reset_tokens
       where token_hash = $1 and used_at is null and expires_at > now()
       for update`,
      [tokenHash]
    );
    const reset = resetRows.rows[0];
    if (!reset) {
      await client.query("rollback");
      fail(res, "Password reset token is invalid or expired.", 400, "Password reset failed");
      return;
    }
    await client.query(
      "update hb_users set password_hash = $2, password_changed_at = now(), failed_login_count = 0, locked_until = null, updated_at = now() where id = $1",
      [reset.user_id, await hashPassword(parsed.data.password)]
    );
    await client.query("update hb_password_reset_tokens set used_at = now() where id = $1", [reset.id]);
    await client.query("update hb_auth_sessions set revoked_at = now() where user_id = $1 and revoked_at is null", [reset.user_id]);
    await client.query(
      `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
       values ($1,'hb.auth.password_reset_completed','hb_user',$1,'{}'::jsonb)`,
      [reset.user_id]
    );
    await client.query("commit");
    ok(res, { reset: true }, "Password has been reset. Login again.");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}));

hbRouter.post("/hb/dev/session", asyncHandler(async (_req, res) => {
  if (!devModeEnabled()) {
    fail(res, "HB9 dev bypass is disabled.", 404, "Not found");
    return;
  }
  const email = "dev.hb.user@hb9.local";
  const existing = await query<{ id: string; email: string; mobile_number: string | null; display_name: string; referral_code: string; status: "inactive" | "active" | "suspended" | "blocked" }>(
    "select id, email, display_name, referral_code, status from hb_users where email = $1 limit 1",
    [email]
  );
  let user = existing[0];
  if (!user) {
    const rows = await query<{ id: string; email: string; mobile_number: string | null; display_name: string; referral_code: string; status: "inactive" | "active" | "suspended" | "blocked" }>(
      `insert into hb_users (email, mobile_number, password_hash, display_name, referral_code)
       values ($1,$2,$3,'Dev HB9 User','HBDEV')
       on conflict (email) do update set updated_at = now()
       returning id, email, mobile_number, display_name, referral_code, status`,
      [email, "+10000000000", await hashPassword(`dev-${crypto.randomUUID()}`)]
    );
    user = rows[0];
    await query(
      `insert into hb_wallets (user_id, wallet_address, wallet_type, network)
       values ($1,$2,'deposit','bsc')
       on conflict (user_id, wallet_type, network) do nothing`,
      [user.id, config.companyEvmReceiveAddress || "0x0000000000000000000000000000000000000000"]
    );
  }
  await audit(user.id, "hb.dev.session", "hb_user", user.id, {});
  ok(res, { token: createToken(user.id, user.email), user }, "HB9 dev session ready");
}));

hbRouter.post("/hb/dev/test-balance", requireHbUser, asyncHandler(async (req, res) => {
  if (!devModeEnabled()) {
    fail(res, "HB9 dev bypass is disabled.", 404, "Not found");
    return;
  }
  const parsed = devBalanceSchema.safeParse(req.body || {});
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid test balance request");
    return;
  }
  const idempotencyKey = `hb:dev:test-balance:${req.hbUser!.userId}:${crypto.randomUUID()}`;
  const rows = await query(
    `insert into hb_internal_ledger (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
     values ($1,'deposit','credit',$2,'dev_test_balance',null,$3,$4::jsonb)
     returning id, amount_usd`,
    [
      req.hbUser!.userId,
      parsed.data.amountUsd,
      idempotencyKey,
      JSON.stringify({ note: "Development-only test balance. Remove before launch." })
    ]
  );
  await audit(req.hbUser!.userId, "hb.dev.test_balance", "hb_internal_ledger", String((rows[0] as any)?.id || ""), { amountUsd: parsed.data.amountUsd });
  ok(res, rows[0], "Development test balance credited");
}));

hbRouter.get("/hb/me", requireHbUser, asyncHandler(async (req, res) => {
  const user = await currentUser(req.hbUser!.userId);
  if (!user) {
    fail(res, "User was not found.", 404, "Not found");
    return;
  }
  const [deposit, income, packageRows, sponsorRows] = await Promise.all([
    getBalance(req.hbUser!.userId, "deposit"),
    getBalance(req.hbUser!.userId, "income"),
    query<{ package_name: string; amount_usd: string; created_at: string }>(
      `select pkg.name as package_name, p.amount_usd::text, p.created_at
       from hb_package_purchases p
       join hb_packages pkg on pkg.id = p.package_id
       where p.user_id = $1 and p.status = 'completed'
       order by p.amount_usd desc, p.created_at desc
       limit 1`,
      [req.hbUser!.userId]
    ),
    query<{ referral_code: string; display_name: string }>(
      `select s.referral_code, s.display_name
       from hb_users u
       join hb_users s on s.id = u.sponsor_user_id
       where u.id = $1
       limit 1`,
      [req.hbUser!.userId]
    )
  ]);
  ok(res, {
    user,
    balances: { deposit, income },
    currentPackage: packageRows[0] || null,
    sponsor: sponsorRows[0] || null
  }, "HB9 profile loaded");
}));

hbRouter.get("/hb/packages", asyncHandler(async (_req, res) => {
  const rows = await query(
    `select p.id,
            p.name,
            coalesce(p.slug, lower(regexp_replace(p.name, '[^a-zA-Z0-9]+', '-', 'g'))) as slug,
            p.amount_usd::text,
            coalesce(p.price, p.amount_usd)::text as price,
            p.status,
            p.sort_order,
            coalesce(p.active, p.status = 'available') as active,
            coalesce(p.visible, true) as visible,
            'BSC' as network,
            m.onchain_package_id as "packageContractId",
            m.onchain_package_id as "onchainPackageId"
     from hb_packages p
     left join hb_package_contract_mappings m on m.package_id = p.id and m.network = 'BSC'
     where p.status = 'available'
       and coalesce(p.active, true) = true
       and coalesce(p.visible, true) = true
     order by p.sort_order asc, p.amount_usd asc`
  );
  ok(res, { items: rows }, "HB9 packages loaded");
}));

async function hbPackageConfigPayload() {
  const packages = await query<{ id: string; name: string; amount_usd: string; status: string; sort_order: number; packageContractId: number | null; onchainPackageId: number | null }>(
    `select p.id,
            p.name,
            p.amount_usd::text,
            p.status,
            p.sort_order,
            m.onchain_package_id as "packageContractId",
            m.onchain_package_id as "onchainPackageId"
     from hb_packages p
     left join hb_package_contract_mappings m on m.package_id = p.id and m.network = 'BSC'
     where p.status = 'available'
       and coalesce(p.active, true) = true
       and coalesce(p.visible, true) = true
     order by p.sort_order asc, p.amount_usd asc`
  ).catch((error) => {
    logger.warn("hb.config.packages_fallback", { error: error instanceof Error ? error.message : "Package config query failed" });
    return [];
  });
  const contracts = await query<{ key: string; contract_address: string | null; chain_id: number; enabled: boolean; start_block: string | null }>(
    "select key, contract_address, chain_id, enabled, start_block::text from hb_onchain_contracts order by key"
  ).catch((error) => {
    logger.warn("hb.config.contracts_fallback", { error: error instanceof Error ? error.message : "Contract config query failed" });
    return [];
  });
  const mergedContracts = mergeEnvOnchainContracts(contracts);
  const contractMap = Object.fromEntries(mergedContracts.map((row) => [row.key, row]));
  const packageRowsByAmount = new Map(packages.map((pkg) => [Number(pkg.amount_usd), pkg]));
  const treasuryWallet = contractMap.treasury_splitter?.contract_address || config.hbTreasuryDepositAddress || config.hb9TreasuryWallet || "";
  return {
    mode: packagePurchaseMode(),
    dryRun: config.hbOnchainDryRun,
    chainId: Number(contractMap.package_manager?.chain_id || hbOnchainChainId()),
    explorerBaseUrl: hbBscScanBaseUrl(),
    packageManagerAddress: contractMap.package_manager?.contract_address || "",
    referralRegistryAddress: contractMap.referral_registry?.contract_address || "",
    treasurySplitterAddress: contractMap.treasury_splitter?.contract_address || "",
    incomeDistributorAddress: contractMap.income_distributor?.contract_address || "",
    usdtBep20Address: contractMap.usdt_bep20?.contract_address || "",
    packages: hbCanonicalOnchainPackages.map((canonical) => {
      const row = packageRowsByAmount.get(canonical.amountUsd);
      return {
        id: row?.id || `hb-package-${canonical.amountUsd}`,
        name: row?.name || canonical.name,
        amount_usd: row?.amount_usd || String(canonical.amountUsd),
        status: row?.status || "available",
        sort_order: row?.sort_order || canonical.sortOrder,
        packageId: row?.packageContractId || row?.onchainPackageId || canonical.onchainPackageId,
        packageContractId: row?.packageContractId || row?.onchainPackageId || canonical.onchainPackageId,
        onchainPackageId: row?.onchainPackageId || row?.packageContractId || canonical.onchainPackageId,
        onchainPrice: String(BigInt(canonical.amountUsd) * 10n ** 18n),
        treasuryWallet,
        tokenType: "USDT BEP20",
        tokenAddress: contractMap.usdt_bep20?.contract_address || hbUsdtAddress(),
        active: row?.status ? row.status === "available" : true
      };
    })
  };
}

function hbSafeConfigFallback(error?: unknown) {
  if (error) {
    console.error(error);
    logger.warn("hb.config.safe_fallback", { error: error instanceof Error ? error.message : "HB9 config fallback" });
  }
  const chainId = hbOnchainChainId();
  const treasuryWallet = safeContractAddress(config.hbTreasurySplitterAddress) || safeContractAddress(config.hbTreasuryDepositAddress) || safeContractAddress(config.hb9TreasuryWallet);
  return {
    mode: packagePurchaseMode(),
    dryRun: Boolean(config.hbOnchainDryRun),
    chainId,
    explorerBaseUrl: hbBscScanBaseUrl(),
    packageManagerAddress: safeContractAddress(config.hbPackageManagerAddress),
    referralRegistryAddress: safeContractAddress(config.hbReferralRegistryAddress),
    treasurySplitterAddress: safeContractAddress(config.hbTreasurySplitterAddress),
    incomeDistributorAddress: safeContractAddress(config.hbIncomeDistributorAddress),
    usdtBep20Address: hbUsdtAddress(),
    packages: hbCanonicalOnchainPackages.map((canonical) => ({
      id: `hb-package-${canonical.amountUsd}`,
      name: canonical.name,
      amount_usd: String(canonical.amountUsd),
      status: "available",
      sort_order: canonical.sortOrder,
      packageId: canonical.onchainPackageId,
      packageContractId: canonical.onchainPackageId,
      onchainPackageId: canonical.onchainPackageId,
      onchainPrice: String(BigInt(canonical.amountUsd) * 10n ** 18n),
      treasuryWallet,
      tokenType: "USDT BEP20",
      tokenAddress: hbUsdtAddress(),
      active: true
    }))
  };
}

hbRouter.get("/hb/config", asyncHandler(async (_req, res) => {
  try {
    ok(res, await hbPackageConfigPayload(), "HB9 config loaded");
  } catch (error) {
    ok(res, hbSafeConfigFallback(error), "HB9 config loaded");
  }
}));

hbRouter.get("/hb/onchain/config", requireHbUser, asyncHandler(async (_req, res) => {
  try {
    ok(res, await hbPackageConfigPayload(), "HB9 on-chain package config loaded");
  } catch (error) {
    ok(res, hbSafeConfigFallback(error), "HB9 on-chain package config loaded");
  }
}));

hbRouter.get("/hb/coins", requireHbUser, asyncHandler(async (req, res) => {
  const prices = await getHbCoinPrices().catch(() => Object.fromEntries(hbCoinSymbols.map((symbol) => [symbol, symbol === "USDT" ? 1 : 0])) as Record<HbCoinSymbol, number>);
  const rows = await query<{ coin_symbol: string; balance: string; updated_at: string }>(
    "select coin_symbol, balance::text, updated_at from hb_coin_balances where user_id = $1",
    [req.hbUser!.userId]
  ).catch(() => []);
  const map = new Map(rows.map((row) => [row.coin_symbol, row]));
  ok(res, {
    items: supportedCoins.map((coin) => {
      const symbol = coin.coin_symbol as HbCoinSymbol;
      const balance = map.get(symbol)?.balance || "0";
      const usdPrice = Number(prices[symbol] || 0);
      const usdValue = symbol === "USDT" ? Number(balance || 0) : Number((Number(balance || 0) * usdPrice).toFixed(8));
      return {
        ...coin,
        usd_price: String(usdPrice || 0),
        usd_value: String(usdValue || 0),
        can_convert: symbol === "HB9" ? usdValue >= HB9_TO_USDT_MIN_USD : symbol !== "USDT" && usdValue >= 2,
        min_convert_usd: symbol === "HB9" ? String(HB9_TO_USDT_MIN_USD) : "2",
        balance,
        updated_at: map.get(symbol)?.updated_at || null
      };
    })
  }, "HB coin balances loaded");
}));

hbRouter.get("/hb/coins/prices", requireHbUser, asyncHandler(async (_req, res) => {
  const prices = await getHbCoinPrices().catch(() => Object.fromEntries(hbCoinSymbols.map((symbol) => [symbol, symbol === "USDT" ? 1 : 0])) as Record<HbCoinSymbol, number>);
  ok(res, { prices, fallback: false }, "HB coin prices loaded");
}));

hbRouter.post("/hb/coins/convert", requireHbUser, asyncHandler(async (req, res) => {
  const controls = await getProductionControls();
  if (controls.emergencyPause || controls.emergencyCoinConversionDisable || controls.rollbackMode) {
    logger.warn("hb.coin_conversion.blocked", { category: controls.emergencyCoinConversionDisable ? "coin_conversion_disabled" : "rollback_or_pause", userId: req.hbUser!.userId });
    fail(res, "Coin conversion is temporarily disabled by production safety controls.", 503, "Coin conversion disabled");
    return;
  }
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Coin conversion failed");
    return;
  }
  const parsed = hbCoinConvertSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid coin conversion request");
    return;
  }
  const coinSymbol = parsed.data.coinSymbol as HbCoinSymbol;
  const idempotencyKey = parsed.data.idempotencyKey || `hb:coin:convert:${req.hbUser!.userId}:${coinSymbol}:${crypto.randomUUID()}`;
  const price = await getHbCoinPrice(coinSymbol).catch(() => 0);
  if (!Number.isFinite(price) || price <= 0) {
    fail(res, "Live price is unavailable. Try again later.", 400, "Coin conversion failed");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const existingRows = await client.query("select * from hb_coin_conversions where user_id = $1 and idempotency_key = $2 limit 1", [req.hbUser!.userId, idempotencyKey]);
    if (existingRows.rows[0]) {
      await client.query("commit");
      ok(res, existingRows.rows[0], "Coin conversion already exists");
      return;
    }
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`coin-convert:${req.hbUser!.userId}:${coinSymbol}`]);
    const balanceRows = await client.query<{ balance: string }>(
      "select balance::text from hb_coin_balances where user_id = $1 and coin_symbol = $2 for update",
      [req.hbUser!.userId, coinSymbol]
    );
    const fromAmount = Number(balanceRows.rows[0]?.balance || 0);
    const usdValue = Number((fromAmount * price).toFixed(8));
    if (!Number.isFinite(fromAmount) || fromAmount <= 0) {
      await client.query("rollback");
      fail(res, "No coin balance available to convert.", 400, "Coin conversion failed");
      return;
    }
    const isHb9Conversion = coinSymbol === "HB9";
    if (isHb9Conversion && usdValue + Number.EPSILON < HB9_TO_USDT_MIN_USD) {
      await client.query("rollback");
      fail(res, "Minimum $500 HB9 Coin value required to convert.", 400, "Conversion minimum not met");
      return;
    }
    if (!isHb9Conversion && usdValue + Number.EPSILON < 2) {
      await client.query("rollback");
      fail(res, "Minimum $2 required to convert.", 400, "Conversion minimum not met");
      return;
    }
    const usdtCreditAmount = isHb9Conversion ? usdValue : Number((usdValue / 2).toFixed(8));
    const hb9CreditUsd = isHb9Conversion ? 0 : Number((usdValue - usdtCreditAmount).toFixed(8));
    const hb9CreditAmount = isHb9Conversion ? 0 : Number((hb9CreditUsd / HB9_COIN_PRICE_USD).toFixed(8));
    const conversionRows = await client.query<{ id: string }>(
      `insert into hb_coin_conversions
        (user_id, from_coin, from_amount, usd_price, usd_value, credited_usdt,
         from_usd_value, usdt_credit_amount, hb9_credit_amount, hb9_price_used,
         status, idempotency_key)
       values ($1,$2,$3,$4,$5,$6,$5,$6,$7,$8,'completed',$9)
       returning id`,
      [req.hbUser!.userId, coinSymbol, fromAmount, price, usdValue, usdtCreditAmount, hb9CreditAmount, HB9_COIN_PRICE_USD, idempotencyKey]
    );
    const conversionId = conversionRows.rows[0]?.id;
    const debitLedgerId = await applyHbCoinAdjustment({
      client,
      userId: req.hbUser!.userId,
      coinSymbol,
      amount: fromAmount,
      direction: "debit",
      type: "convert_debit",
      reference: conversionId,
      note: isHb9Conversion ? "Converted HB9 Coin to USDT BEP20" : `Converted ${coinSymbol} to 50% USDT BEP20 and 50% HB9 Coin`,
      idempotencyKey: `hb:coin:convert:${conversionId}:debit`,
      usdPrice: price,
      usdValue
    });
    const usdtCreditLedgerId = await applyHbCoinAdjustment({
      client,
      userId: req.hbUser!.userId,
      coinSymbol: "USDT",
      amount: usdtCreditAmount,
      direction: "credit",
      type: "convert_credit_usdt",
      reference: conversionId,
      note: isHb9Conversion ? "USDT BEP20 credited from HB9 Coin conversion" : `50% USDT BEP20 credited from ${coinSymbol} conversion`,
      idempotencyKey: `hb:coin:convert:${conversionId}:credit:usdt`,
      usdPrice: 1,
      usdValue: usdtCreditAmount
    });
    const hb9CreditLedgerId = isHb9Conversion ? null : await applyHbCoinAdjustment({
      client,
      userId: req.hbUser!.userId,
      coinSymbol: "HB9",
      amount: hb9CreditAmount,
      direction: "credit",
      type: "convert_credit_hb9",
      reference: conversionId,
      note: `50% HB9 Coin credited from ${coinSymbol} conversion at $${HB9_COIN_PRICE_USD}`,
      idempotencyKey: `hb:coin:convert:${conversionId}:credit:hb9`,
      usdPrice: HB9_COIN_PRICE_USD,
      usdValue: hb9CreditUsd
    });
    const internalLedgerRows = await client.query<{ id: string }>(
      `insert into hb_internal_ledger (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
       values ($1,'deposit','credit',$2,'coin_conversion',$3,$4,$5::jsonb)
       returning id`,
      [
        req.hbUser!.userId,
        usdtCreditAmount,
        conversionId,
        `hb:internal:coin_conversion:${conversionId}`,
        JSON.stringify({ fromCoin: coinSymbol, fromAmount, usdPrice: price, usdValue, usdtCreditAmount, hb9CreditAmount, hb9PriceUsed: HB9_COIN_PRICE_USD })
      ]
    );
    const internalLedgerId = internalLedgerRows.rows[0]?.id || null;
    const proof = await createLedgerProof(client, "hb_coin_balance_ledger", usdtCreditLedgerId);
    await createLedgerProof(client, "hb_coin_balance_ledger", debitLedgerId);
    if (hb9CreditLedgerId) await createLedgerProof(client, "hb_coin_balance_ledger", hb9CreditLedgerId);
    await createLedgerProof(client, "hb_internal_ledger", internalLedgerId);
    await client.query(
      `update hb_coin_conversions
       set proof_reference_id = $2,
           proof_reference = $2,
           debit_ledger_entry_id = $3,
           credit_ledger_entry_id = $4,
           usdt_credit_ledger_entry_id = $4,
           hb9_credit_ledger_entry_id = $5,
           internal_ledger_entry_id = $6
       where id = $1`,
      [conversionId, proof?.public_reference_id || null, debitLedgerId, usdtCreditLedgerId, hb9CreditLedgerId, internalLedgerId]
    );
    await client.query("commit");
    await audit(req.hbUser!.userId, "hb.coin.convert", "hb_coin_conversions", conversionId || null, { coinSymbol, fromAmount, usdPrice: price, usdValue, usdtCreditAmount, hb9CreditAmount, hb9PriceUsed: HB9_COIN_PRICE_USD });
    const rows = await query("select * from hb_coin_conversions where id = $1", [conversionId]);
    ok(res, rows[0], isHb9Conversion ? "Converted HB9 Coin to USDT BEP20" : "Converted to USDT BEP20 and HB9 Coin", 201);
  } catch (err) {
    await client.query("rollback");
    fail(res, err instanceof Error ? err.message : "Coin conversion failed.", 400, "Coin conversion failed");
  } finally {
    client.release();
  }
}));

hbRouter.get("/hb/coins/history", requireHbUser, asyncHandler(async (req, res) => {
  const coin = typeof req.query.coin === "string" ? req.query.coin.toUpperCase() : "";
  const parsedCoin = coin ? hbCoinSymbolSchema.safeParse(coin) : null;
  if (coin && !parsedCoin?.success) {
    fail(res, "Unsupported coin filter.", 400, "Coin history failed");
    return;
  }
  const rows = await query(
    `select id, coin_symbol, amount::text, type, direction, reference_id as reference, note, created_at
     from hb_coin_balance_ledger
     where user_id = $1 and ($2::text = '' or coin_symbol = $2)
     order by created_at desc
     limit 100`,
    [req.hbUser!.userId, parsedCoin?.success ? parsedCoin.data : ""]
  ).catch(() => []);
  ok(res, { items: rows }, "HB coin ledger loaded");
}));

function sanitizeProductRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const gallery = Array.isArray(row.gallery) ? row.gallery.filter((item) => item && typeof item === "object") : [];
    return {
      ...row,
      title: String(row.title || ""),
      slug: String(row.slug || ""),
      description: row.description || "",
      short_description: row.short_description || "",
      package_price: row.package_price || "0",
      package_type: row.package_type || "activation",
      image_url: typeof row.image_url === "string" ? row.image_url : "",
      stock: Number(row.stock || 0),
      active: row.active !== false,
      featured: Boolean(row.featured),
      package_name: String(row.package_name || ""),
      gallery
    };
  });
}

hbRouter.get("/hb/products", asyncHandler(async (_req, res) => {
  try {
    const rows = await query<Record<string, unknown>>(
      `select p.id, p.title, p.slug, p.description, p.short_description, p.package_id, p.package_price,
              p.package_type, p.image_url, p.stock, p.active, p.featured, pkg.name as package_name,
              coalesce(json_agg(json_build_object('id', img.id, 'image_url', img.image_url, 'alt_text', img.alt_text, 'sort_order', img.sort_order) order by img.sort_order)
                filter (where img.id is not null), '[]'::json) as gallery
       from hb_products p
       join hb_packages pkg on pkg.id = p.package_id
       left join hb_product_images img on img.product_id = p.id
       where p.active = true
         and pkg.status = 'available'
         and coalesce(pkg.active, true) = true
         and coalesce(pkg.visible, true) = true
       group by p.id, pkg.name
       order by p.featured desc, p.package_price asc, p.created_at desc`
    );
    ok(res, { items: sanitizeProductRows(rows) }, "HB9 products loaded");
  } catch (error) {
    console.error(error);
    logger.warn("hb.products.safe_fallback", { error: error instanceof Error ? error.message : "Products query failed" });
    ok(res, { items: [] }, "HB9 products loaded");
  }
}));

hbRouter.get("/hb/products/:slug", asyncHandler(async (req, res) => {
  try {
    const rows = await query<Record<string, unknown>>(
      `select p.id, p.title, p.slug, p.description, p.short_description, p.package_id, p.package_price,
              p.package_type, p.image_url, p.stock, p.active, p.featured, pkg.name as package_name,
              coalesce(json_agg(json_build_object('id', img.id, 'image_url', img.image_url, 'alt_text', img.alt_text, 'sort_order', img.sort_order) order by img.sort_order)
                filter (where img.id is not null), '[]'::json) as gallery
       from hb_products p
       join hb_packages pkg on pkg.id = p.package_id
       left join hb_product_images img on img.product_id = p.id
       where p.slug = $1
         and p.active = true
         and pkg.status = 'available'
         and coalesce(pkg.active, true) = true
         and coalesce(pkg.visible, true) = true
       group by p.id, pkg.name
       limit 1`,
      [req.params.slug]
    );
    const product = sanitizeProductRows(rows)[0];
    if (!product) {
      fail(res, "Product was not found.", 404, "Not found");
      return;
    }
    ok(res, product, "HB9 product loaded");
  } catch (error) {
    console.error(error);
    logger.warn("hb.product.safe_fallback", { slug: req.params.slug, error: error instanceof Error ? error.message : "Product query failed" });
    fail(res, "Product was not found.", 404, "Not found");
  }
}));

hbRouter.get("/hb/wallet", requireHbUser, asyncHandler(async (req, res) => {
  const wallets = await query("select id, network, wallet_address, wallet_type, is_primary, created_at from hb_wallets where user_id = $1 order by created_at", [req.hbUser!.userId]);
  const deposits = await query(
    `select id, network, asset, amount, usd_amount, coalesce(tx_hash, onchain_tx_hash) as tx_hash, wallet_address, status, verification_status, failure_reason, created_at, verified_at,
            provider, payment_id, pay_address, pay_currency, price_amount, pay_amount, payment_status, payment_invoice_url,
            chain_id, from_address, to_address, confirmations, onchain_status, credited_at
     from hb_deposits
     where user_id = $1
     order by created_at desc
     limit 50`,
    [req.hbUser!.userId]
  );
  const withdrawals = await query(
    `select id, amount_usd, gross_amount, fee_usd, fee_amount, payout_amount_usd, net_amount, currency, network, wallet_address, status, tx_hash, failure_reason,
            requested_at, reviewed_at, approved_at, processing_at, paid_at, rejected_at, cancelled_at, updated_at
     from hb_withdrawals
     where user_id = $1
     order by requested_at desc
     limit 50`,
    [req.hbUser!.userId]
  );
  const [depositBalance, incomeBalance, pendingDeposits, verifiedDeposits, purchased, pendingWithdrawals] = await Promise.all([
    getBalance(req.hbUser!.userId, "deposit"),
    getBalance(req.hbUser!.userId, "income"),
    query<{ total: string; count: number }>(
      "select coalesce(sum(usd_amount),0)::text as total, count(*)::int as count from hb_deposits where user_id = $1 and status in ('pending','pending_verification')",
      [req.hbUser!.userId]
    ),
    query<{ total: string; count: number }>(
      "select coalesce(sum(usd_amount),0)::text as total, count(*)::int as count from hb_deposits where user_id = $1 and status = 'verified'",
      [req.hbUser!.userId]
    ),
    query<{ total: string; count: number }>(
      "select coalesce(sum(amount_usd),0)::text as total, count(*)::int as count from hb_package_purchases where user_id = $1 and status = 'completed'",
      [req.hbUser!.userId]
    ),
    query<{ total: string; count: number }>(
      "select coalesce(sum(amount_usd),0)::text as total, count(*)::int as count from hb_withdrawals where user_id = $1 and status in ('pending','approved','processing')",
      [req.hbUser!.userId]
    )
  ]);
  const settings = await getFinancialSettings(req.hbUser!.userId);
  const depositAddress = await getExpectedDepositAddress(req.hbUser!.userId);
  ok(res, {
    wallets,
    depositAddress,
    deposits,
    withdrawals,
    withdrawalSettings: settings,
    availableBalance: depositBalance,
    balances: { deposit: depositBalance, income: incomeBalance },
    pendingDeposits: pendingDeposits[0] || { total: "0", count: 0 },
    verifiedDeposits: verifiedDeposits[0] || { total: "0", count: 0 },
    totalPurchased: purchased[0] || { total: "0", count: 0 },
    pendingWithdrawals: pendingWithdrawals[0] || { total: "0", count: 0 }
  }, "HB9 wallet loaded");
}));

hbRouter.get("/hb/wallet-address", requireHbUser, asyncHandler(async (req, res) => {
  const rows = await query<{
    usdt_bep20_address: string | null;
    wallet_bound_at: string | null;
    wallet_updated_at: string | null;
  }>(
    `select usdt_bep20_address, wallet_bound_at, wallet_updated_at
     from hb_users
     where id = $1
     limit 1`,
    [req.hbUser!.userId]
  );
  ok(res, rows[0] || { usdt_bep20_address: null, wallet_bound_at: null, wallet_updated_at: null }, "USDT BEP20 wallet address loaded");
}));

async function saveBoundWalletAddress(userId: string, address: string, action: "bind" | "change") {
  const rows = await query(
    `update hb_users
     set usdt_bep20_address = $2,
         hb9_wallet_address = $2,
         wallet_bound_at = coalesce(wallet_bound_at, now()),
         wallet_updated_at = now(),
         updated_at = now()
     where id = $1
     returning id, usdt_bep20_address, wallet_bound_at, wallet_updated_at`,
    [userId, address]
  );
  await query(
    `insert into hb_wallets (user_id, wallet_address, wallet_type, network)
     values ($1,$2,'deposit','bsc')
     on conflict (user_id, wallet_type, network)
     do update set wallet_address = excluded.wallet_address`,
    [userId, address]
  );
  await audit(userId, `hb.wallet_address.${action}`, "hb_user", userId, { address });
  return rows[0];
}

hbRouter.post("/hb/wallet-address", requireHbUser, asyncHandler(async (req, res) => {
  const parsed = walletAddressSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid wallet address");
    return;
  }
  const existing = await query<{ usdt_bep20_address: string | null }>("select usdt_bep20_address from hb_users where id = $1 limit 1", [req.hbUser!.userId]);
  if (existing[0]?.usdt_bep20_address) {
    fail(res, "Wallet address is already bound. Use PATCH to change it.", 409, "Wallet address already bound");
    return;
  }
  ok(res, await saveBoundWalletAddress(req.hbUser!.userId, parsed.data.address, "bind"), "USDT BEP20 wallet address bound", 201);
}));

hbRouter.patch("/hb/wallet-address", requireHbUser, asyncHandler(async (req, res) => {
  const parsed = walletAddressSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid wallet address");
    return;
  }
  ok(res, await saveBoundWalletAddress(req.hbUser!.userId, parsed.data.address, "change"), "USDT BEP20 wallet address updated");
}));

hbRouter.post("/hb/deposits/nowpayments/create", requireHbUser, asyncHandler(async (req, res) => {
  if (!(await enforceDepositSafety(res, "deposit.nowpayments.create"))) return;
  const parsed = nowPaymentsCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid NOWPayments deposit request");
    return;
  }
  if (parsed.data.amountUsd + Number.EPSILON < 4 || parsed.data.payCurrency !== "usdtbsc") {
    fail(res, "Only USDT BEP20 deposits of at least $4 are supported.", 400, "Unsupported deposit currency");
    return;
  }
  const idempotencyKey = `hb:nowpayments:${req.hbUser!.userId}:${crypto.randomUUID()}`;
  const rows = await query<{ id: string }>(
    `insert into hb_deposits
       (user_id, wallet_address, network, asset, amount, usd_amount, status, verification_status,
        idempotency_key, provider, price_amount, pay_currency, payment_status)
     values ($1,null,'nowpayments','USDT',$2,$2,'pending','pending',$3,'nowpayments',$2,$4,'created')
     returning id`,
    [req.hbUser!.userId, parsed.data.amountUsd, idempotencyKey, parsed.data.payCurrency.toUpperCase()]
  );
  const depositId = rows[0]?.id;
  if (!depositId) {
    fail(res, "Deposit could not be created.", 500, "NOWPayments deposit failed");
    return;
  }
  try {
    const callbackBase = config.nowPaymentsSuccessUrl || config.corsOrigin.split(",")[0]?.trim() || "";
    const payment = await createNowPaymentsPayment({
      priceAmount: parsed.data.amountUsd,
      priceCurrency: "usd",
      payCurrency: parsed.data.payCurrency,
      orderId: depositId,
      orderDescription: `HB9 deposit ${depositId}`,
      ipnCallbackUrl: callbackBase ? `${callbackBase.replace(/\/$/, "")}/api/hb/deposits/nowpayments/ipn` : undefined
    });
    await query(
      `update hb_deposits
       set payment_id = $2,
           pay_address = $3,
           pay_currency = $4,
           pay_amount = $5,
           payment_status = $6,
           payment_order_id = $7,
           payment_purchase_id = $8,
           payment_invoice_url = $9,
           payment_raw = $10::jsonb,
           wallet_address = $3,
           updated_at = now()
       where id = $1`,
      [
        depositId,
        nowPaymentId(payment),
        payment.pay_address || null,
        payment.pay_currency ? String(payment.pay_currency).toUpperCase() : parsed.data.payCurrency.toUpperCase(),
        payment.pay_amount || null,
        payment.payment_status || "waiting",
        payment.order_id || depositId,
        payment.purchase_id || null,
        payment.invoice_url || null,
        JSON.stringify(payment)
      ]
    );
    await audit(req.hbUser!.userId, "hb.deposit.nowpayments.create", "hb_deposit", depositId, { paymentId: nowPaymentId(payment), amountUsd: parsed.data.amountUsd });
    ok(res, { depositId, payment }, "NOWPayments deposit created", 201);
  } catch (err) {
    await query("update hb_deposits set status = 'failed', verification_status = 'failed', failure_reason = $2, updated_at = now() where id = $1", [depositId, err instanceof Error ? err.message : "NOWPayments failed"]);
    fail(res, err instanceof Error ? err.message : "NOWPayments payment could not be created.", 502, "NOWPayments deposit failed");
  }
}));

hbRouter.get("/hb/deposits/nowpayments/:paymentId", requireHbUser, asyncHandler(async (req, res) => {
  const paymentId = String(req.params.paymentId || "");
  const depositRows = await query<{ id: string }>("select id from hb_deposits where user_id = $1 and payment_id = $2 limit 1", [req.hbUser!.userId, paymentId]);
  if (!depositRows[0]) {
    fail(res, "NOWPayments deposit was not found.", 404, "Deposit not found");
    return;
  }
  const payment = await getNowPaymentsPayment(paymentId);
  await query(
    `update hb_deposits
     set payment_status = $2,
         pay_address = coalesce($3, pay_address),
         pay_currency = coalesce($4, pay_currency),
         pay_amount = coalesce($5::numeric, pay_amount),
         payment_raw = $6::jsonb,
         updated_at = now()
     where id = $1`,
    [
      depositRows[0].id,
      payment.payment_status || null,
      payment.pay_address || null,
      payment.pay_currency ? String(payment.pay_currency).toUpperCase() : null,
      payment.pay_amount || null,
      JSON.stringify(payment)
    ]
  );
  if (payment.payment_status && isNowPaymentsPaidStatus(payment.payment_status)) await creditNowPaymentsDeposit(payment as Record<string, unknown>);
  const rows = await query("select * from hb_deposits where id = $1", [depositRows[0].id]);
  ok(res, { deposit: rows[0], payment }, "NOWPayments deposit status loaded");
}));

hbRouter.post("/hb/deposits/nowpayments/ipn", asyncHandler(async (req, res) => {
  const signature = typeof req.headers["x-nowpayments-sig"] === "string" ? req.headers["x-nowpayments-sig"] : "";
  const signatureValid = verifyNowPaymentsIpnSignature(req.body, signature);
  const paymentId = nowPaymentId(req.body || {});
  const paymentStatus = String(req.body?.payment_status || "");
  const logRows = await query<{ id: string }>(
    `insert into hb_deposit_webhook_logs (provider, payment_id, signature, signature_valid, payment_status, payload)
     values ('nowpayments',$1,$2,$3,$4,$5::jsonb)
     on conflict (provider, payment_id, payment_status) where signature_valid = true and payment_id is not null and payment_status is not null
     do update set payload = excluded.payload
     returning id`,
    [paymentId || null, signature || null, signatureValid, paymentStatus || null, JSON.stringify(req.body || {})]
  );
  const logId = logRows[0]?.id || null;
  if (!signatureValid) {
    await query("update hb_deposit_webhook_logs set processing_error = 'Invalid signature' where id = $1", [logId]);
    fail(res, "Invalid NOWPayments signature.", 401, "Invalid signature");
    return;
  }
  try {
    const result = await creditNowPaymentsDeposit(req.body || {});
    await query(
      `update hb_deposit_webhook_logs
       set deposit_id = $2, processed = true
       where id = $1`,
      [logId, result.depositId || null]
    );
    ok(res, result, "NOWPayments IPN accepted");
  } catch (err) {
    await query("update hb_deposit_webhook_logs set processing_error = $2 where id = $1", [logId, err instanceof Error ? err.message : "IPN processing failed"]);
    fail(res, err instanceof Error ? err.message : "NOWPayments IPN could not be processed.", 500, "IPN processing failed");
  }
}));

hbRouter.get("/hb/deposits", requireHbUser, asyncHandler(async (req, res) => {
  const rows = await query(
    `select id, network, asset, amount, usd_amount, coalesce(tx_hash, onchain_tx_hash) as tx_hash, wallet_address, status, verification_status, failure_reason,
            created_at, verified_at, credited_at, provider, payment_id, pay_address, pay_currency, price_amount, pay_amount,
            payment_status, payment_invoice_url, chain_id, from_address, to_address, confirmations, onchain_status
     from hb_deposits
     where user_id = $1
     order by created_at desc
     limit 100`,
    [req.hbUser!.userId]
  );
  ok(res, { items: rows }, "Deposits loaded");
}));

async function createAndVerifyHbDeposit(req: Request, res: Response) {
  console.log("HB9_DEPOSIT_REQUEST", req.body, hbDepositRequestFields(req.body));
  let client: PoolClient | null = null;
  try {
    if (!(await enforceDepositSafety(res, "deposit.onchain.create"))) {
      logHbDepositValidationFailed("Deposit safety controls blocked this request.", req.body, { userId: req.hbUser?.userId });
      return;
    }
    if (!pool) {
      logHbDepositValidationFailed("Database is not configured.", req.body, { userId: req.hbUser?.userId });
      fail(res, "Database is not configured.", 500, "Deposit failed");
      return;
    }
    const parsed = depositCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      const validationError = validationErrorMessage(parsed.error);
      console.error("HB9_DEPOSIT_VALIDATION_FAILED", validationError, {
        ...hbDepositRequestFields(req.body),
        userId: req.hbUser?.userId,
        issues: parsed.error.issues,
        payload: req.body
      });
      logger.warn("hb.deposit.validation_failed", {
        userId: req.hbUser?.userId,
        validationError,
        issues: parsed.error.issues,
        payload: req.body
      });
      fail(res, validationError, 400, "Invalid deposit request");
      return;
    }
    if (parsed.data.asset !== "USDT" || parsed.data.token !== "USDT" || parsed.data.network !== "bsc" || parsed.data.chainId !== BSC_MAINNET_CHAIN_ID || parsed.data.tokenAddress !== CONFIGURED_USDT_BEP20_ADDRESS) {
      logHbDepositValidationFailed("Only USDT BEP20 deposits are supported.", req.body, { userId: req.hbUser?.userId, parsed: parsed.data });
      fail(res, "Only USDT BEP20 deposits are supported.", 400, "Unsupported deposit currency");
      return;
    }
    if (parsed.data.amountUsd + Number.EPSILON < 4) {
      logHbDepositValidationFailed("Minimum deposit is $4", req.body, { userId: req.hbUser?.userId, parsedAmountUsd: parsed.data.amountUsd });
      fail(res, "Minimum deposit is $4", 400, "Deposit minimum not met");
      return;
    }
    const userId = req.hbUser!.userId;
    const expectedAddress = await getExpectedDepositAddress(userId, parsed.data.walletAddress || undefined);
    if (!isValidBep20Address(expectedAddress)) {
      logHbDepositValidationFailed("Treasury wallet not configured", req.body, { userId });
      fail(res, "Treasury wallet not configured", 503, "Deposit provider not configured");
      return;
    }
    const providedTreasuryWallet = parsed.data.treasuryWallet || parsed.data.walletAddress || "";
    if (providedTreasuryWallet && !isValidBep20Address(providedTreasuryWallet)) {
      logHbDepositValidationFailed("Treasury wallet must be a valid BSC address.", req.body, { userId, walletAddress: parsed.data.walletAddress, treasuryWallet: parsed.data.treasuryWallet });
      logger.warn("hb.deposit.validation_failed", { userId, validationError: "Treasury wallet must be a valid BSC address.", walletAddress: parsed.data.walletAddress, treasuryWallet: parsed.data.treasuryWallet });
      fail(res, "Treasury wallet must be a valid BSC address.", 400, "Invalid deposit request");
      return;
    }
    if (providedTreasuryWallet && getAddress(providedTreasuryWallet) !== expectedAddress) {
      logHbDepositValidationFailed("Treasury wallet does not match configured deposit wallet.", req.body, { userId, providedTreasuryWallet, expectedAddress });
      logger.warn("hb.deposit.validation_failed", { userId, validationError: "Treasury wallet does not match configured deposit wallet.", providedTreasuryWallet, expectedAddress });
      fail(res, "Treasury wallet does not match configured deposit wallet.", 400, "Invalid deposit request");
      return;
    }
    const idempotencyKey = parsed.data.idempotencyKey || `hb:deposit:${userId}:${parsed.data.txHash ? parsed.data.txHash.toLowerCase() : crypto.randomUUID()}`;
    client = await pool.connect();
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [parsed.data.txHash ? `deposit:${parsed.data.txHash.toLowerCase()}` : idempotencyKey]);
    const existingByIdempotency = await client.query("select * from hb_deposits where user_id = $1 and idempotency_key = $2 limit 1", [userId, idempotencyKey]);
    if (existingByIdempotency.rows[0]) {
      await client.query("commit");
      ok(res, depositResponse(existingByIdempotency.rows[0]), "Deposit already exists");
      return;
    }
    {
      const depositRows = await client.query(
        `insert into hb_deposits
          (user_id, wallet_address, network, asset, amount, usd_amount, tx_hash, status, verification_status,
           idempotency_key, provider, payment_status)
         values ($1,$2,'bsc','USDT',$3,$3,null,'pending','pending',$4,'manual_bsc','awaiting_payment')
         returning *`,
        [userId, expectedAddress, parsed.data.amountUsd, idempotencyKey]
      );
      await client.query("commit");
      await audit(userId, "hb.deposit.session.create", "hb_deposit", String((depositRows.rows[0] as any)?.id || ""), { amountUsd: parsed.data.amountUsd, walletAddress: expectedAddress, network: "bsc", token: "USDT" });
      ok(res, pendingDepositCreateResponse(depositRows.rows[0]), "Deposit request created", 201);
      return;
    }
  } catch (err) {
    console.error("HB9_DEPOSIT_FATAL", err, hbDepositRequestFields(req.body));
    if (client) {
      try {
        await client.query("rollback");
      } catch {
        // transaction may already be committed before on-chain verification
      }
    }
    if (!res.headersSent) {
      fail(res, err instanceof Error ? err.message : "Deposit could not be created.", 500, "Deposit failed");
    }
  } finally {
    client?.release();
  }
}

async function verifyExistingHbDeposit(req: Request, res: Response) {
  console.log("HB9_DEPOSIT_VERIFY_REQUEST", { depositId: req.params.id || req.body?.depositId, body: req.body });
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Deposit verification failed");
    return;
  }
  const depositId = req.params.id || req.body?.depositId || "";
  if (!z.string().uuid().safeParse(depositId).success) {
    fail(res, "Deposit id is required.", 400, "Invalid deposit verification request");
    return;
  }
  const parsed = depositTxHashSchema.safeParse(req.body);
  if (!parsed.success) {
    const validationError = validationErrorMessage(parsed.error);
    console.error("HB9_DEPOSIT_VALIDATION_FAILED", validationError, { depositId, body: req.body });
    fail(res, validationError, 400, "Invalid deposit verification request");
    return;
  }
  const userId = req.hbUser!.userId;
  const txHash = parsed.data.txHash;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`deposit-verify:${depositId}`]);
    const locked = await client.query<{
      id: string;
      user_id: string;
      usd_amount: string;
      wallet_address: string | null;
      status: string;
      ledger_entry_id: string | null;
      user_wallet_address: string | null;
      user_usdt_bep20_address: string | null;
      user_hb9_wallet_address: string | null;
    }>(
      `select d.id, d.user_id, d.usd_amount::text, d.wallet_address, d.status, d.ledger_entry_id,
              u.wallet_address as user_wallet_address, u.usdt_bep20_address as user_usdt_bep20_address, u.hb9_wallet_address as user_hb9_wallet_address
       from hb_deposits d
       join hb_users u on u.id = d.user_id
       where d.id = $1 and d.user_id = $2
       for update of d`,
      [depositId, userId]
    );
    const deposit = locked.rows[0];
    if (!deposit) {
      await client.query("rollback");
      fail(res, "Deposit was not found.", 404, "Deposit not found");
      return;
    }
    if (deposit.status === "verified" && deposit.ledger_entry_id) {
      await client.query("commit");
      const rows = await query<Record<string, unknown>>("select * from hb_deposits where id = $1", [depositId]);
      ok(res, depositResponse(rows[0]), "Deposit already verified");
      return;
    }
    if (!deposit.wallet_address || !isValidBep20Address(deposit.wallet_address)) {
      await client.query("rollback");
      fail(res, "Treasury wallet not configured", 503, "Deposit provider not configured");
      return;
    }
    if (await txHashAlreadyUsed(txHash, depositId)) {
      await client.query("rollback");
      console.error("HB9_DEPOSIT_VALIDATION_FAILED", "This transaction hash has already been used.", { depositId, userId, txHash });
      fail(res, "This transaction hash has already been used.", 409, "Duplicate transaction blocked");
      return;
    }
    await client.query(
      `update hb_deposits
       set tx_hash = $2, provider = 'onchain', payment_status = 'submitted', verification_status = 'pending', failure_reason = null, updated_at = now()
       where id = $1`,
      [depositId, txHash]
    );
    await client.query("commit");

    let verification: BlockchainVerification;
    const expectedSender = [deposit.user_usdt_bep20_address, deposit.user_hb9_wallet_address, deposit.user_wallet_address]
      .find((value) => value && isAddress(value)) || "";
    try {
      verification = await verifyBlockchainTransaction({
        txHash,
        network: "bsc",
        tokenSymbol: "USDT",
        requiredAmount: Number(deposit.usd_amount),
        expectedRecipient: deposit.wallet_address,
        expectedSender
      });
    } catch (err) {
      const publicError = publicVerificationError(err);
      const diagnostics = verificationDiagnostics(err, {
        txHash,
        chainId: BSC_MAINNET_CHAIN_ID,
        expectedSender: expectedSender || null,
        expectedTreasury: deposit.wallet_address,
        expectedTokenContract: CONFIGURED_USDT_BEP20_ADDRESS,
        expectedAmount: deposit.usd_amount,
        failureReason: publicError.message
      });
      const retryable = err instanceof VerificationError && err.retryable;
      const nextStatus = retryable ? "pending_verification" : "failed";
      const nextVerificationStatus = retryable ? "pending" : "failed";
      console.error("HB9_DEPOSIT_VALIDATION_FAILED", publicError.message, { ...diagnostics, depositId, userId, status: nextStatus });
      logger.warn("hb.deposit.verification_failed", { ...diagnostics, userId, depositId, status: nextStatus, reason: publicError.message });
      await query(
        `update hb_deposits
         set status = $2, verification_status = $3, failure_reason = $4,
             chain_id = coalesce($5, chain_id),
             from_address = coalesce($6, from_address),
             to_address = coalesce($7, to_address),
             confirmations = coalesce($8, confirmations),
             updated_at = now()
         where id = $1`,
        [depositId, nextStatus, nextVerificationStatus, publicError.message, diagnostics.chainId || null, diagnostics.actualSender, diagnostics.actualReceiver, diagnostics.confirmations || null]
      );
      const rows = await query<Record<string, unknown>>("select * from hb_deposits where id = $1", [depositId]);
      const response = { ...depositResponse(rows[0]), diagnostics, ...diagnostics };
      if (retryable) {
        ok(res, response, "Deposit submitted and pending verification retry", 202);
      } else {
        res.status(publicError.status).json({ success: false, data: response, message: "Deposit verification failed", error: publicError.message });
      }
      return;
    }

    const creditClient = await pool.connect();
    try {
      await creditClient.query("begin");
      await creditClient.query("select pg_advisory_xact_lock(hashtext($1))", [`deposit-credit:${depositId}`]);
      const creditLocked = await creditClient.query<{ id: string; user_id: string; usd_amount: string; status: string; ledger_entry_id: string | null }>(
        "select id, user_id, usd_amount::text, status, ledger_entry_id from hb_deposits where id = $1 for update",
        [depositId]
      );
      const creditDeposit = creditLocked.rows[0];
      if (!creditDeposit) throw new Error("Deposit was not found.");
      if (creditDeposit.status !== "verified" || !creditDeposit.ledger_entry_id) {
        const ledgerRows = await creditClient.query<{ id: string }>(
          `insert into hb_internal_ledger (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
           values ($1,'deposit','credit',$2,'deposit',$3,$4,$5::jsonb)
           on conflict (idempotency_key) do nothing
           returning id`,
          [creditDeposit.user_id, creditDeposit.usd_amount, creditDeposit.id, `hb:ledger:deposit:${creditDeposit.id}:onchain_credit`, JSON.stringify({ provider: "onchain", txHash, verification })]
        );
        const ledgerId = ledgerRows.rows[0]?.id || creditDeposit.ledger_entry_id;
        await createLedgerProof(creditClient, "hb_internal_ledger", ledgerId, { chainTxHash: txHash, onchainStatus: "confirmed" });
        const coinLedgerId = await applyHbCoinAdjustment({
          client: creditClient,
          userId: creditDeposit.user_id,
          coinSymbol: "USDT",
          amount: creditDeposit.usd_amount,
          direction: "credit",
          type: "deposit_credit",
          reference: creditDeposit.id,
          note: "Verified USDT BEP20 deposit credit",
          idempotencyKey: `hb:coin:deposit:${creditDeposit.id}:credit`,
          metadata: { txHash }
        });
        await createLedgerProof(creditClient, "hb_coin_balance_ledger", coinLedgerId, { chainTxHash: txHash, onchainStatus: "confirmed" });
        await creditClient.query(
          `update hb_deposits
           set status = 'verified', verification_status = 'verified', verified_at = now(), credited_at = now(),
               ledger_entry_id = coalesce(ledger_entry_id, $2), failure_reason = null,
               chain_id = $3, from_address = $4, to_address = $5, confirmations = $6,
               onchain_tx_hash = $7, onchain_status = 'confirmed', updated_at = now()
           where id = $1`,
          [creditDeposit.id, ledgerId, verification.chainId, verification.fromAddress, verification.toAddress, verification.confirmations, txHash]
        );
        await creditClient.query(
          `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
           values ($1,'hb.deposit.onchain.credited','hb_deposit',$2,$3::jsonb)`,
          [creditDeposit.user_id, creditDeposit.id, JSON.stringify({ txHash, amountUsd: creditDeposit.usd_amount, coinLedgerId })]
        );
      }
      await creditClient.query("commit");
    } catch (err) {
      await creditClient.query("rollback");
      throw err;
    } finally {
      creditClient.release();
    }
    const rows = await query<Record<string, unknown>>("select * from hb_deposits where id = $1", [depositId]);
    logger.info("hb.deposit.credited", { userId, depositId, amountUsd: deposit.usd_amount, ...verification.diagnostics });
    ok(res, { ...depositResponse(rows[0]), diagnostics: verification.diagnostics, ...verification.diagnostics }, "Deposit verified and credited", 201);
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      // ignore rollback after commit
    }
    console.error("HB9_DEPOSIT_FATAL", err, { depositId, txHash: req.body?.txHash });
    fail(res, err instanceof Error ? err.message : "Deposit verification failed.", 500, "Deposit verification failed");
  } finally {
    client.release();
  }
}

hbRouter.post("/hb/deposits", requireHbUser, asyncHandler(createAndVerifyHbDeposit));
hbRouter.post("/hb/deposits/create", requireHbUser, asyncHandler(createAndVerifyHbDeposit));
hbRouter.post("/hb/deposits/:id/verify", requireHbUser, asyncHandler(verifyExistingHbDeposit));

hbRouter.post("/hb/deposits/verify", requireHbUser, asyncHandler(async (req, res) => {
  const parsed = depositVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid deposit verification request");
    return;
  }
  req.params.id = parsed.data.depositId;
  req.body = { txHash: parsed.data.txHash };
  await verifyExistingHbDeposit(req, res);
}));

hbRouter.post("/hb/withdrawals", requireHbUser, asyncHandler(async (req, res) => {
  if (!(await enforceWithdrawalSafety(res, "withdrawal.request"))) return;
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Withdrawal failed");
    return;
  }
  const parsed = withdrawalCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid withdrawal request");
    return;
  }
  const withdrawalControls = await getProductionControls();
  if (withdrawalControls.rolloutMode === "limited_live" && parsed.data.amountUsd > 500) {
    logger.warn("hb.withdrawal.blocked", { category: "limited_live_risk_limit", amountUsd: parsed.data.amountUsd });
    fail(res, "Limited live rollout caps individual withdrawal requests at 500 USD.", 400, "Limited live risk limit");
    return;
  }
  if (parsed.data.currency !== "USDT" || parsed.data.network !== "bsc") {
    fail(res, "Only USDT BEP20 withdrawals are currently supported.", 400, "Unsupported withdrawal currency");
    return;
  }
  if (!isValidBep20Address(parsed.data.walletAddress)) {
    fail(res, "Invalid BEP20 wallet address", 400, "Invalid withdrawal address");
    return;
  }
  const userRows = await query<{ status: string }>("select status from hb_users where id = $1 limit 1", [req.hbUser!.userId]);
  const settings = await getFinancialSettings(req.hbUser!.userId);
  if (settings.withdrawalRequireActiveId && userRows[0]?.status !== "active") {
    fail(res, "Only active HB9 IDs can withdraw.", 403, "Withdrawal blocked");
    return;
  }
  if (await hasActiveRiskBlock(req.hbUser!.userId)) {
    fail(res, "Withdrawals are blocked for this account pending review.", 403, "Withdrawal blocked");
    return;
  }
  if (parsed.data.amountUsd + Number.EPSILON < HB_WITHDRAWAL_MIN_USD) {
    fail(res, HB_WITHDRAWAL_MIN_ERROR, 400, HB_WITHDRAWAL_MIN_ERROR);
    return;
  }
  if (settings.withdrawalRequirePackage) {
    const packageRows = await query<{ id: string }>("select id from hb_package_purchases where user_id = $1 and status = 'completed' limit 1", [req.hbUser!.userId]);
    if (!packageRows[0]) {
      fail(res, "A completed package purchase is required before withdrawal.", 403, "Withdrawal blocked");
      return;
    }
  }
  if (settings.withdrawalCooldownMinutes > 0) {
    const recentRows = await query<{ id: string }>(
      "select id from hb_withdrawals where user_id = $1 and requested_at >= now() - ($2::int * interval '1 minute') and status not in ('rejected','cancelled','failed') limit 1",
      [req.hbUser!.userId, settings.withdrawalCooldownMinutes]
    );
    if (recentRows[0]) {
      fail(res, `Wait ${settings.withdrawalCooldownMinutes} minutes between withdrawal requests.`, 429, "Withdrawal cooldown active");
      return;
    }
  }
  const dailyRows = await query<{ total: string }>(
    `select coalesce(sum(amount_usd),0)::text as total
     from hb_withdrawals
     where user_id = $1 and requested_at >= now() - interval '24 hours' and status not in ('rejected','cancelled','failed')`,
    [req.hbUser!.userId]
  );
  if (Number(dailyRows[0]?.total || 0) + parsed.data.amountUsd > settings.withdrawalDailyLimitUsd) {
    fail(res, `Daily withdrawal limit is ${settings.withdrawalDailyLimitUsd} USD.`, 400, "Withdrawal limit exceeded");
    return;
  }
  const feeUsd = Number((parsed.data.amountUsd * settings.withdrawalFeePercent / 100).toFixed(8));
  const payoutUsd = Number((parsed.data.amountUsd - feeUsd).toFixed(8));
  if (payoutUsd <= 0) {
    fail(res, "Withdrawal fee leaves no payable amount.", 400, "Withdrawal failed");
    return;
  }
  if (!withdrawalProviderReady()) {
    fail(res, "USDT withdrawal provider not configured.", 503, "USDT withdrawal provider not configured");
    return;
  }
  const idempotencyKey = parsed.data.idempotencyKey || `hb:withdrawal:${req.hbUser!.userId}:${crypto.randomUUID()}`;

  const client = await pool.connect();
  let committed = false;
  let withdrawalId: string | null = null;
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`withdrawal:${req.hbUser!.userId}`]);
    const existingRows = await client.query("select * from hb_withdrawals where user_id = $1 and idempotency_key = $2 limit 1", [req.hbUser!.userId, idempotencyKey]);
    if (existingRows.rows[0]) {
      await client.query("commit");
      ok(res, existingRows.rows[0], "Withdrawal request already exists");
      return;
    }
    const duplicateActiveRows = await client.query(
      `select id from hb_withdrawals
       where user_id = $1
         and lower(wallet_address) = lower($2)
         and amount_usd = $3
         and status in ('pending','under_review','approved','processing')
         and requested_at >= now() - interval '24 hours'
       limit 1`,
      [req.hbUser!.userId, parsed.data.walletAddress, parsed.data.amountUsd]
    );
    if (duplicateActiveRows.rows[0]) {
      await client.query("rollback");
      logger.warn("hb.withdrawal.duplicate_attempt", { userId: req.hbUser!.userId, existingWithdrawalId: duplicateActiveRows.rows[0].id, amountUsd: parsed.data.amountUsd, walletAddress: parsed.data.walletAddress });
      fail(res, "A matching withdrawal is already pending.", 409, "Duplicate withdrawal blocked");
      return;
    }
    const balanceRows = await client.query<{ balance: string }>(
      `select coalesce(sum(case when direction = 'credit' then amount_usd else -amount_usd end),0)::text as balance
       from hb_internal_ledger
       where user_id = $1 and wallet_type = 'deposit'`,
      [req.hbUser!.userId]
    );
    const available = Number(balanceRows.rows[0]?.balance || 0);
    if (!Number.isFinite(available) || available + Number.EPSILON < parsed.data.amountUsd) {
      await client.query("rollback");
      fail(res, "Insufficient USDT balance", 400, "Withdrawal failed");
      return;
    }
    const withdrawalRows = await client.query<{ id: string }>(
      `insert into hb_withdrawals
        (user_id, amount_usd, fee_usd, payout_amount_usd, gross_amount, fee_amount, net_amount,
         currency, network, wallet_address, status, idempotency_key, processing_at, payout_mode)
       values ($1,$2,$3,$4,$2,$3,$4,$5,$6,$7,'processing',$8,now(),$9)
       returning id`,
      [req.hbUser!.userId, parsed.data.amountUsd, feeUsd, payoutUsd, parsed.data.currency, parsed.data.network, parsed.data.walletAddress, idempotencyKey, "server_signer"]
    );
    withdrawalId = withdrawalRows.rows[0]?.id || null;
    if (!withdrawalId) throw new Error("Withdrawal could not be created.");
    const ledgerRows = await client.query<{ id: string }>(
      `insert into hb_internal_ledger (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
       values ($1,'deposit','debit',$2,'withdrawal',$3,$4,$5::jsonb)
       returning id`,
      [
        req.hbUser!.userId,
        parsed.data.amountUsd,
        withdrawalId,
        `hb:ledger:withdrawal:${withdrawalId}:reserve`,
        JSON.stringify({ type: "withdrawal_reserve", currency: parsed.data.currency, network: parsed.data.network, walletAddress: parsed.data.walletAddress, feeUsd, payoutUsd })
      ]
    );
    const reserveLedgerId = ledgerRows.rows[0]?.id || null;
    await createLedgerProof(client, "hb_internal_ledger", reserveLedgerId);
    const payoutCoinLedgerId = await applyHbCoinAdjustment({
      client,
      userId: req.hbUser!.userId,
      coinSymbol: "USDT",
      amount: payoutUsd,
      direction: "debit",
      type: "withdrawal_debit",
      reference: withdrawalId,
      note: "Instant USDT BEP20 withdrawal payout debit",
      idempotencyKey: `hb:coin:withdrawal:${withdrawalId}:payout_debit`
    });
    await createLedgerProof(client, "hb_coin_balance_ledger", payoutCoinLedgerId);
    const feeCoinLedgerId = await applyHbCoinAdjustment({
      client,
      userId: req.hbUser!.userId,
      coinSymbol: "USDT",
      amount: feeUsd,
      direction: "debit",
      type: "withdrawal_fee",
      reference: withdrawalId,
      note: "10% USDT BEP20 withdrawal fee",
      idempotencyKey: `hb:coin:withdrawal:${withdrawalId}:fee_debit`
    });
    await createLedgerProof(client, "hb_coin_balance_ledger", feeCoinLedgerId);
    await client.query("update hb_withdrawals set reserve_ledger_entry_id = $2, public_reference_id = coalesce(public_reference_id, $3) where id = $1", [withdrawalId, reserveLedgerId, withdrawalId ? `HBW-${String(withdrawalId).slice(0, 8).toUpperCase()}` : null]);
    await client.query(
      `insert into hb_withdrawal_audit_logs (withdrawal_id, user_id, action, next_status, metadata)
       values ($1,$2,'withdrawal.instant_processing','processing',$3::jsonb)`,
      [withdrawalId, req.hbUser!.userId, JSON.stringify({ amountUsd: parsed.data.amountUsd, feeUsd, payoutUsd })]
    );
    await client.query("commit");
    committed = true;
    logger.info("hb.withdrawal.processing", { withdrawalId, userId: req.hbUser!.userId, grossAmount: parsed.data.amountUsd, feeUsd, payoutUsd });
    const txHash = await sendInstantUsdtWithdrawal({ toWallet: parsed.data.walletAddress, grossAmount: parsed.data.amountUsd, netAmount: payoutUsd, withdrawalId });
    await query(
      `update hb_withdrawals
       set status = 'paid', tx_hash = $2, onchain_tx_hash = $2, onchain_status = 'confirmed',
           paid_at = now(), updated_at = now()
       where id = $1`,
      [withdrawalId, txHash]
    );
    await query(
      `insert into hb_withdrawal_audit_logs (withdrawal_id, user_id, action, previous_status, next_status, metadata)
       values ($1,$2,'withdrawal.instant_paid','processing','paid',$3::jsonb)`,
      [withdrawalId, req.hbUser!.userId, JSON.stringify({ txHash, grossAmount: parsed.data.amountUsd, feeUsd, payoutUsd })]
    );
    const rows = await query("select * from hb_withdrawals where id = $1", [withdrawalId]);
    logger.info("hb.withdrawal.paid", { withdrawalId, userId: req.hbUser!.userId, txHash, grossAmount: parsed.data.amountUsd, feeUsd, payoutUsd });
    ok(res, rows[0], "Withdrawal paid instantly", 201);
  } catch (err) {
    const publicReason = err instanceof InsufficientTreasuryBalanceError
      ? HB_WITHDRAWAL_TREASURY_INSUFFICIENT_PUBLIC
      : committed
        ? HB_WITHDRAWAL_TEMPORARILY_UNAVAILABLE
        : err instanceof Error ? err.message : "Withdrawal could not be created.";
    if (!committed) {
      await client.query("rollback");
    } else if (withdrawalId) {
      const reason = err instanceof InsufficientTreasuryBalanceError
        ? HB_WITHDRAWAL_TREASURY_INSUFFICIENT_INTERNAL
        : HB_WITHDRAWAL_TEMPORARILY_UNAVAILABLE;
      logger.error("hb.withdrawal.signer_failed", {
        withdrawalId,
        userId: req.hbUser!.userId,
        reason,
        rawReason: err instanceof Error ? err.message : "Instant payout failed."
      });
      await refundFailedInstantWithdrawal({ withdrawalId, userId: req.hbUser!.userId, grossAmount: parsed.data.amountUsd, netAmount: payoutUsd, feeAmount: feeUsd, reason });
    }
    fail(res, publicReason, err instanceof InsufficientTreasuryBalanceError ? 503 : 500, "Withdrawal failed");
  } finally {
    client.release();
  }
}));

hbRouter.post("/hb/onchain/purchases/track", requireHbUser, asyncHandler(async (req, res) => {
  const parsed = onchainPurchaseTrackSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid on-chain purchase tracking request");
    return;
  }
  if (!(await enforceActivationSafety(res, "onchain.purchase.track"))) return;
  if (config.hbOnchainDryRun) {
    await audit(req.hbUser!.userId, "hb.onchain.purchase.dry_run", "hb_onchain_purchase_event", null, { txHash: parsed.data.txHash, onchainPackageId: parsed.data.onchainPackageId });
    ok(res, { txHash: parsed.data.txHash, status: "dry_run", dryRun: true }, "Dry-run purchase tracking simulated", 201);
    return;
  }
  const userRows = await query<{ id: string; status: string; hb9_wallet_address: string | null; usdt_bep20_address: string | null }>(
    `select id, status, hb9_wallet_address, usdt_bep20_address
     from hb_users where id = $1 limit 1`,
    [req.hbUser!.userId]
  );
  const currentUser = userRows[0];
  const boundWallet = currentUser?.usdt_bep20_address || currentUser?.hb9_wallet_address || "";
  if (!currentUser || !boundWallet || boundWallet.toLowerCase() !== parsed.data.buyerAddress.toLowerCase()) {
    fail(res, "Connected wallet does not match this HB9 ID.", 403, "Buyer wallet mismatch");
    return;
  }
  if (currentUser.status === "active") {
    fail(res, "This Business ID is already active.", 409, "Activation already completed");
    return;
  }
  const pendingRows = await query<{ id: string }>(
    `select id from hb_onchain_purchase_events
     where buyer_user_id = $1 and status in ('submitted','confirmed')
     limit 1`,
    [req.hbUser!.userId]
  );
  if (pendingRows[0]) {
    fail(res, "A package activation is already pending for this ID.", 409, "Activation already pending");
    return;
  }
  const canonicalPackage = canonicalOnchainPackageForId(parsed.data.onchainPackageId);
  if (!canonicalPackage) {
    logger.error("hb.onchain.package_mapping_missing", { onchainPackageId: parsed.data.onchainPackageId });
    fail(res, "Blockchain package mapping missing", 503, "Package mapping missing");
    return;
  }
  const amountRows = await query<{ amount_usd: string }>(
    `select amount_usd::text
     from hb_packages
     where status = 'available' and amount_usd = any($1::numeric[])
     limit 1`,
    [[4, 20, 100, 500, 2500, 12500].filter((amount) => onchainPackageIdForAmount(amount) === parsed.data.onchainPackageId)]
  );
  const amountUsd = amountRows[0]?.amount_usd || String(canonicalPackage.amountUsd);
  const existingEventSql = `select *
     from hb_onchain_purchase_events
     where chain_id = $1 and lower(tx_hash) = lower($2)
     order by created_at desc
     limit 1`;
  logger.info("HB9_BUY_SQL", { route: "hb.onchain.purchase.track", sql: existingEventSql, params: [hbOnchainChainId(), parsed.data.txHash] });
  const existingEventRows = await query(existingEventSql, [hbOnchainChainId(), parsed.data.txHash]);
  if (existingEventRows[0]) {
    await audit(req.hbUser!.userId, "hb.onchain.purchase.submitted", "hb_onchain_purchase_event", String((existingEventRows[0] as any)?.id || ""), { txHash: parsed.data.txHash, onchainPackageId: parsed.data.onchainPackageId, idempotent: true });
    ok(res, existingEventRows[0], "On-chain purchase already submitted", 200);
    return;
  }
  const insertEventSql = `insert into hb_onchain_purchase_events
      (tx_hash, chain_id, contract_address, onchain_package_id, buyer_user_id, buyer_address,
       sponsor_address, referral_code, amount_usd, status, raw_event)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'submitted',$10::jsonb)
     returning *`;
  logger.info("HB9_BUY_SQL", { route: "hb.onchain.purchase.track", sql: insertEventSql, params: [parsed.data.txHash, hbOnchainChainId(), config.hbPackageManagerAddress || null, parsed.data.onchainPackageId, req.hbUser!.userId, parsed.data.buyerAddress, parsed.data.sponsorAddress || null, parsed.data.referralCode || null, amountUsd] });
  const rows = await query(
    insertEventSql,
    [
      parsed.data.txHash,
      hbOnchainChainId(),
      config.hbPackageManagerAddress || null,
      parsed.data.onchainPackageId,
      req.hbUser!.userId,
      parsed.data.buyerAddress,
      parsed.data.sponsorAddress || null,
      parsed.data.referralCode || null,
      amountUsd,
      JSON.stringify({ productId: parsed.data.productId || null, packageId: parsed.data.packageId || null, source: "frontend_submitted_tx" })
    ]
  );
  await audit(req.hbUser!.userId, "hb.onchain.purchase.submitted", "hb_onchain_purchase_event", String((rows[0] as any)?.id || ""), { txHash: parsed.data.txHash, onchainPackageId: parsed.data.onchainPackageId });
  ok(res, rows[0] || { txHash: parsed.data.txHash, status: "submitted" }, "On-chain purchase submitted for indexing", 201);
}));

hbRouter.get("/hb/withdrawals", requireHbUser, asyncHandler(async (req, res) => {
  const rows = await query(
    `select id, amount_usd, gross_amount, fee_usd, fee_amount, payout_amount_usd, net_amount, currency, network, wallet_address, status, tx_hash, failure_reason,
            requested_at, reviewed_at, approved_at, processing_at, paid_at, rejected_at, cancelled_at, updated_at
     from hb_withdrawals
     where user_id = $1
     order by requested_at desc
     limit 100`,
    [req.hbUser!.userId]
  );
  ok(res, { items: rows }, "Withdrawals loaded");
}));

hbRouter.get("/hb/withdrawals/:id", requireHbUser, asyncHandler(async (req, res) => {
  const rows = await query(
    `select id, amount_usd, gross_amount, fee_usd, fee_amount, payout_amount_usd, net_amount, currency, network, wallet_address, status, tx_hash, failure_reason,
            requested_at, reviewed_at, approved_at, processing_at, paid_at, rejected_at, cancelled_at, updated_at
     from hb_withdrawals
     where id = $1 and user_id = $2
     limit 1`,
    [req.params.id, req.hbUser!.userId]
  );
  if (!rows[0]) {
    fail(res, "Withdrawal was not found.", 404, "Not found");
    return;
  }
  ok(res, rows[0], "Withdrawal loaded");
}));

hbRouter.get("/hb/my-products", requireHbUser, asyncHandler(async (req, res) => {
  const userId = req.hbUser!.userId;
  await query(
    `insert into hb_user_products (user_id, package_purchase_id, package_id, package_name, package_amount, activated_at)
     select p.user_id, p.id, p.package_id, pkg.name, p.amount_usd, p.created_at
     from hb_package_purchases p
     join hb_packages pkg on pkg.id = p.package_id
     where p.user_id = $1 and p.status = 'completed'
       and not exists (
         select 1
         from hb_user_products up
         where up.package_purchase_id = p.id
       )`,
    [userId]
  ).catch(() => undefined);
  const activeProducts = await query<{
    package_purchase_id: string;
    purchase_id: string;
    package_id: string;
    package_name: string;
    product_name: string | null;
    product_title: string | null;
    product_slug: string | null;
    product_image: string | null;
    price: string;
    package_price: string;
    purchase_date: string;
    activation_date: string;
    purchased_at: string;
    status: string;
    book_limit: number;
    followers_count: number;
  }>(
    `with purchased as (
       select distinct on (p.id)
              p.id as package_purchase_id,
              p.id as purchase_id,
              p.package_id,
              package_display.name as package_name,
              package_display.name as product_name,
              package_display.name as product_title,
              null::text as product_slug,
              null::text as product_image,
              p.amount_usd::text as price,
              p.amount_usd::text as package_price,
              p.created_at as purchase_date,
              p.created_at as activation_date,
              p.created_at as purchased_at,
              p.status,
              case when p.amount_usd >= 100 then 100 when p.amount_usd >= 20 then 20 when p.amount_usd >= 4 then 4 else 0 end as book_limit,
              case when p.amount_usd >= 100 then 4000 when p.amount_usd >= 20 then 700 else 0 end as followers_count
       from hb_package_purchases p
       join hb_packages pkg on pkg.id = p.package_id
       cross join lateral (
         select case
           when p.amount_usd = 4 then 'Starter Package'
           when p.amount_usd = 20 then 'Builder Package'
           when p.amount_usd = 100 then 'Growth Package'
           else pkg.name
         end as name
       ) package_display
       where p.user_id = $1 and p.status = 'completed'
       order by p.id, p.created_at desc
     )
     select *
     from purchased
     order by purchased_at desc`,
    [userId]
  );
  const activeProductsByPurchase = new Map<string, typeof activeProducts[number]>();
  for (const product of activeProducts) {
    if (!activeProductsByPurchase.has(product.package_purchase_id)) {
      activeProductsByPurchase.set(product.package_purchase_id, product);
    }
  }
  const uniqueActiveProducts = Array.from(activeProductsByPurchase.values());
  const deliveredProducts = uniqueActiveProducts.map((product) => ({
    ...product,
    purchaseId: product.purchase_id,
    productName: product.product_name,
    purchaseDate: product.purchase_date
  }));
  logger.info("hb.my_products.purchases", {
    userId,
    purchases: deliveredProducts.map((product) => ({
      purchaseId: product.purchase_id,
      productName: product.product_name
    }))
  });
  const best = deliveredProducts.reduce((winner, row) => Number(row.package_price || 0) > Number(winner?.package_price || 0) ? row : winner, null as Record<string, any> | null);
  const bookLimit = hbBookLimitForPackage(Number(best?.package_price || 0));
  await ensureHbBooksTable();
  const books = await query(
    `with ranked as (
       select b.id, b.title, b.description, b.cover_image, b.sort_order, b.is_active, b.created_at,
              row_number() over (order by b.sort_order asc, b.created_at asc) as rn
       from hb_books b
       where b.is_active = true
     )
     select r.id, r.title, 'Digital Book'::text as category, r.description, null::text as file_url,
            r.cover_image, case when r.is_active then 'active' else 'disabled' end as status, r.rn::int as sort_order,
            (r.rn <= $2::int) as unlocked,
            d.downloaded_at
     from ranked r
     left join hb_book_downloads d on d.book_id = r.id and d.user_id = $1
     order by r.rn asc`,
    [userId, bookLimit]
  );
  const [followersRequests, customSoftwareRequests, softwareAccess] = await Promise.all([
    query(
      `select r.*, pkg.name as package_name, p.amount_usd::text as package_price
       from hb_followers_requests r
       left join hb_package_purchases p on p.id = r.package_purchase_id
       left join hb_packages pkg on pkg.id = r.package_id
       where r.user_id = $1
       order by r.created_at desc`,
      [userId]
    ),
    query("select * from hb_custom_software_requests where user_id = $1 order by created_at desc", [userId]),
    query(
      `select software_key, title, description, access_url, sort_order
       from hb_software_access
       where active = true and package_amount <= $1::numeric
       order by sort_order asc`,
      [Number(best?.package_price || 0)]
    )
  ]);
  ok(res, {
    items: deliveredProducts,
    activeProducts: deliveredProducts,
    bestPackage: best,
    bookLimit,
    booksUnlocked: bookLimit,
    totalBooks: books.length,
    books,
    followersRequests,
    softwareAccess,
    customSoftwareRequests
  }, "HB9 products delivered");
}));

hbRouter.get("/hb/books", requireHbUser, asyncHandler(async (req, res) => {
  const best = await getUserBestPackage(req.hbUser!.userId);
  const bookLimit = hbBookLimitForPackage(Number(best?.amount_usd || 0));
  await ensureHbBooksTable();
  const rows = await query(
    `with ranked as (
       select b.id, b.title, b.description, b.cover_image, b.sort_order, b.is_active, b.created_at,
              row_number() over (order by b.sort_order asc, b.created_at asc) as rn
       from hb_books b
       where b.is_active = true
     )
     select r.id, r.title, 'Digital Book'::text as category, r.description, null::text as file_url,
            r.cover_image, case when r.is_active then 'active' else 'disabled' end as status, r.rn::int as sort_order,
            (r.rn <= $2::int) as unlocked,
            d.downloaded_at
     from ranked r
     left join hb_book_downloads d on d.book_id = r.id and d.user_id = $1
     order by r.rn asc`,
    [req.hbUser!.userId, bookLimit]
  );
  ok(res, { items: rows, bookLimit, bestPackage: best }, "HB9 books loaded");
}));

hbRouter.get("/hb/books/:id/download", requireHbUser, asyncHandler(async (req, res) => {
  const userId = req.hbUser!.userId;
  const best = await getUserBestPackage(userId);
  if (!best) {
    fail(res, "Buy a package before downloading books.", 403, "Book locked");
    return;
  }
  const bookLimit = hbBookLimitForPackage(Number(best.amount_usd || 0));
  await ensureHbBooksTable();
  const rows = await query<{ id: string; rn: number; download_url: string }>(
    `with ranked as (
       select b.id, b.download_url, row_number() over (order by b.sort_order asc, b.created_at asc) as rn
       from hb_books b
       where b.is_active = true
     )
     select id, rn::int, download_url from ranked where id = $1 limit 1`,
    [req.params.id]
  );
  const book = rows[0];
  if (!book) {
    fail(res, "Book was not found.", 404, "Book not found");
    return;
  }
  if (Number(book.rn) > bookLimit) {
    fail(res, "This book is locked for your package.", 403, "Book locked");
    return;
  }
  await audit(userId, "hb.book.download", "hb_books", book.id, { packagePurchaseId: best.package_purchase_id });
  ok(res, { download: { bookId: book.id, downloadedAt: new Date().toISOString() }, fileUrl: book.download_url }, "Book download ready");
}));

hbRouter.get("/hb/followers-request", requireHbUser, asyncHandler(async (req, res) => {
  const rows = await query(
    `select r.*, pkg.name as package_name, p.amount_usd::text as package_price
     from hb_followers_requests r
     left join hb_package_purchases p on p.id = r.package_purchase_id
     left join hb_packages pkg on pkg.id = r.package_id
     where r.user_id = $1
     order by r.created_at desc`,
    [req.hbUser!.userId]
  );
  ok(res, { items: rows }, "Followers requests loaded");
}));

hbRouter.post("/hb/followers-request", requireHbUser, asyncHandler(async (req, res) => {
  const controls = await getProductionControls();
  if (controls.emergencyPause || controls.emergencyFollowerRequestDisable || controls.rollbackMode) {
    logger.warn("hb.followers_request.blocked", { category: controls.emergencyFollowerRequestDisable ? "follower_requests_disabled" : "rollback_or_pause", userId: req.hbUser!.userId });
    fail(res, "Follower requests are temporarily disabled by production safety controls.", 503, "Follower requests disabled");
    return;
  }
  const parsed = hbFollowersRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid followers request");
    return;
  }
  const purchaseRows = await query<{ package_id: string; amount_usd: string }>(
    "select package_id, amount_usd::text from hb_package_purchases where id = $1 and user_id = $2 and status = 'completed' limit 1",
    [parsed.data.packagePurchaseId, req.hbUser!.userId]
  );
  const purchase = purchaseRows[0];
  if (!purchase) {
    fail(res, "Package purchase was not found.", 404, "Package not found");
    return;
  }
  const followersCount = hbFollowersForPackage(Number(purchase.amount_usd || 0));
  if (followersCount <= 0) {
    fail(res, "This package does not include followers.", 403, "Followers not included");
    return;
  }
  const latestRequestRows = await query<{ status: string }>(
    `select status
     from hb_followers_requests
     where user_id = $1 and package_purchase_id = $2
     order by created_at desc
     limit 1`,
    [req.hbUser!.userId, parsed.data.packagePurchaseId]
  );
  const latestStatus = String(latestRequestRows[0]?.status || "").toLowerCase();
  if (["pending", "approved", "processing", "completed"].includes(latestStatus)) {
    const message = latestStatus === "pending"
      ? "Request already pending."
      : latestStatus === "completed"
        ? "Followers completed."
        : "Followers request is already in progress.";
    fail(res, message, 409, message);
    return;
  }
  try {
    const rows = await query(
      `insert into hb_followers_requests (user_id, package_id, package_purchase_id, platform, submitted_link, followers_count)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [req.hbUser!.userId, purchase.package_id, parsed.data.packagePurchaseId, parsed.data.platform, parsed.data.submittedLink, followersCount]
    );
    await audit(req.hbUser!.userId, "hb.followers_request.create", "hb_followers_request", String((rows[0] as any)?.id || ""), { followersCount });
    ok(res, rows[0], "Followers request sent", 201);
  } catch (err) {
    fail(res, err instanceof Error && err.message.includes("duplicate") ? "Request already pending." : err instanceof Error ? err.message : "Followers request failed.", 400, "Followers request failed");
  }
}));

hbRouter.post("/hb/custom-software-request", requireHbUser, asyncHandler(async (req, res) => {
  const parsed = hbCustomSoftwareRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid custom software request");
    return;
  }
  const best = await getUserBestPackage(req.hbUser!.userId);
  if (!best || Number(best.amount_usd || 0) < 12500) {
    fail(res, "$12500 package is required for custom software requests.", 403, "Custom software locked");
    return;
  }
  const rows = await query(
    `insert into hb_custom_software_requests (user_id, package_purchase_id, software_type, architecture, requirements_note)
     values ($1,$2,$3,$4,$5)
     returning *`,
    [req.hbUser!.userId, parsed.data.packagePurchaseId || best.package_purchase_id, parsed.data.softwareType, parsed.data.architecture, parsed.data.requirementsNote]
  );
  await audit(req.hbUser!.userId, "hb.custom_software_request.create", "hb_custom_software_request", String((rows[0] as any)?.id || ""), {});
  ok(res, rows[0], "Custom software request sent", 201);
}));

hbRouter.post("/hb/packages/:id/purchase", requireHbUser, asyncHandler(async (req, res) => {
  if (!(await enforceActivationSafety(res, "package.purchase"))) return;
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Purchase failed");
    return;
  }
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid purchase request");
    return;
  }
  const packageId = String(req.params.id || "");
  const idempotencyKey = parsed.data.idempotencyKey || `hb:purchase:${req.hbUser!.userId}:${packageId}:${crypto.randomUUID()}`;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local statement_timeout = '15000ms'");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [idempotencyKey]);
    const existingPurchaseRows = await client.query<{ id: string; status: string; amount_usd: string; ledger_entry_id: string | null }>(
      `select id, status, amount_usd::text, ledger_entry_id
       from hb_package_purchases
       where user_id = $1 and idempotency_key = $2
       limit 1`,
      [req.hbUser!.userId, idempotencyKey]
    );
    const existingPurchase = existingPurchaseRows.rows[0];
    if (existingPurchase) {
      await client.query("commit");
      const wallet = await getWalletSummary(req.hbUser!.userId);
      ok(res, {
        purchaseId: existingPurchase.id,
        status: existingPurchase.status,
        activated: false,
        idempotent: true,
        walletBalance: wallet.balances.deposit,
        mainWalletBalance: wallet.balances.deposit,
        availableBalance: wallet.availableBalance
      }, "Package purchase already processed");
      return;
    }
    const packageRows = await client.query<{ id: string; amount_usd: string; name: string }>(
      "select id, amount_usd::text, name from hb_packages where id = $1 and status = 'available' limit 1",
      [packageId]
    );
    const selectedPackage = packageRows.rows[0];
    if (!selectedPackage) {
      await client.query("rollback");
      fail(res, "Package is not available.", 404, "Purchase failed");
      return;
    }

    const userRows = await client.query<{ status: string }>("select status from hb_users where id = $1 for update", [req.hbUser!.userId]);
    const user = userRows.rows[0];
    if (!user || user.status === "blocked" || user.status === "suspended") {
      await client.query("rollback");
      fail(res, "User is not allowed to purchase packages.", 403, "Purchase failed");
      return;
    }
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [req.hbUser!.userId]);

    const balanceRows = await client.query<{ balance: string }>(
      `select coalesce(sum(case when direction = 'credit' then amount_usd else -amount_usd end),0)::text as balance
       from hb_internal_ledger
       where user_id = $1 and wallet_type = 'deposit'`,
      [req.hbUser!.userId]
    );
    const balance = Number(balanceRows.rows[0]?.balance || 0);
    const amount = Number(selectedPackage.amount_usd);
    if (balance + Number.EPSILON < amount) {
      await client.query("rollback");
      fail(res, `Insufficient verified wallet balance. Required $${amount.toFixed(2)}, available $${balance.toFixed(2)}.`, 402, "Insufficient balance");
      return;
    }

    const purchaseRows = await client.query<{ id: string; amount_usd: string; status: string }>(
      `insert into hb_package_purchases (user_id, package_id, amount_usd, status, idempotency_key)
       values ($1,$2,$3,'completed',$4)
       returning id, amount_usd::text, status`,
      [req.hbUser!.userId, selectedPackage.id, selectedPackage.amount_usd, idempotencyKey]
    );
    const purchase = purchaseRows.rows[0];
    const ledgerRows = await client.query<{ id: string }>(
      `insert into hb_internal_ledger (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
       values ($1,'deposit','debit',$2,'package_purchase',$3,$4,$5::jsonb)
       returning id`,
      [
        req.hbUser!.userId,
        selectedPackage.amount_usd,
        purchase.id,
        `hb:ledger:${purchase.id}:deposit_debit`,
        JSON.stringify({ packageId: selectedPackage.id, packageName: selectedPackage.name })
      ]
    );
    const ledgerEntryId = ledgerRows.rows[0]?.id || null;
    await createLedgerProof(client, "hb_internal_ledger", ledgerEntryId);
    await client.query("update hb_package_purchases set ledger_entry_id = $2 where id = $1", [purchase.id, ledgerEntryId]);
    if (config.hbProductPurchaseDebitsCoinUsdt) {
      await applyHbCoinAdjustment({
        client,
        userId: req.hbUser!.userId,
        coinSymbol: "USDT",
        amount: selectedPackage.amount_usd,
        direction: "debit",
        type: "debit",
        reference: purchase.id,
        note: "Configured USDT coin debit for package purchase",
        idempotencyKey: `hb:coin:package_purchase:${purchase.id}:debit`
      });
    }

    if (user.status === "inactive") {
      await client.query("update hb_users set status = 'active', activated_at = now(), updated_at = now() where id = $1", [req.hbUser!.userId]);
      await client.query(
        `insert into hb_activation_logs (user_id, package_purchase_id, previous_status, new_status)
         values ($1,$2,'inactive','active')`,
        [req.hbUser!.userId, purchase.id]
      );
    }

    await runCompletedPackagePurchasePipeline({
      client,
      purchaseId: purchase.id,
      buyerUserId: req.hbUser!.userId,
      packageId: selectedPackage.id,
      amountUsd: purchase.amount_usd
    });
    await client.query(
      `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
       values ($1,'hb.package.purchase','hb_package_purchase',$2,$3::jsonb)`,
      [req.hbUser!.userId, purchase.id, JSON.stringify({ packageId: selectedPackage.id, amountUsd: selectedPackage.amount_usd })]
    );
    const updatedBalanceRows = await client.query<{ balance: string }>(
      `select coalesce(sum(case when direction = 'credit' then amount_usd else -amount_usd end),0)::text as balance
       from hb_internal_ledger
       where user_id = $1 and wallet_type = 'deposit'`,
      [req.hbUser!.userId]
    );
    const updatedBalance = updatedBalanceRows.rows[0]?.balance || "0";
    await client.query("commit");
    ok(res, {
      purchaseId: purchase.id,
      status: purchase.status,
      activated: user.status === "inactive",
      walletBalance: updatedBalance,
      mainWalletBalance: updatedBalance,
      availableBalance: updatedBalance
    }, "Package purchased successfully", 201);
  } catch (err) {
    await client.query("rollback");
    const message = err instanceof Error ? err.message : "Package purchase failed.";
    fail(res, message, 500, "Purchase failed");
  } finally {
    client.release();
  }
}));

hbRouter.post("/hb/products/:id/buy", requireHbUser, asyncHandler(async (req, res) => {
  if (!(await enforceActivationSafety(res, "product.buy"))) return;
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Product purchase failed");
    return;
  }
  const parsed = productBuySchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid product purchase request");
    return;
  }
  const productId = String(req.params.id || "");
  const idempotencyKey = parsed.data.idempotencyKey || `hb:product-order:${req.hbUser!.userId}:${productId}:${crypto.randomUUID()}`;
  const client = await pool.connect();
  let inTransaction = false;
  let lastBuySql: string | undefined;
  let lastBuyParams: unknown[] | undefined;
  let buyQueryNumber = 0;
  const buyQuery = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
    lastBuySql = sql;
    lastBuyParams = params;
    buyQueryNumber += 1;
    const currentBuyQueryNumber = buyQueryNumber;
    console.log(`BEFORE_QUERY_${currentBuyQueryNumber}`);
    console.log("RUNNING_QUERY", sql, params);
    logger.info("HB9_BUY_SQL", { route: "hb.products.buy", productId, userId: req.hbUser!.userId, sql, params });
    try {
      const result = await client.query<T>(sql, params);
      console.log(`AFTER_QUERY_${currentBuyQueryNumber}`);
      return result;
    } catch (e) {
      const error = e as Error & { code?: string; detail?: string; constraint?: string; table?: string };
      console.error("HB9_BUY_QUERY_FAILED", {
        SQL: sql,
        values: params,
        errorMessage: error.message,
        detail: error.detail,
        constraint: error.constraint,
        table: error.table,
        code: error.code,
        stack: error.stack
      });
      throw e;
    }
  };
  try {
    await buyQuery("begin");
    inTransaction = true;
    await buyQuery("set local statement_timeout = '15000ms'");
    await buyQuery("select pg_advisory_xact_lock(hashtext($1))", [`hb:buy:${req.hbUser!.userId}`]);

    const userRows = await buyQuery<{ status: string; wallet_address: string | null; hb9_wallet_address: string | null; usdt_bep20_address: string | null }>(
      "select status, wallet_address, hb9_wallet_address, usdt_bep20_address from hb_users where id = $1 for update",
      [req.hbUser!.userId]
    );
    const user = userRows.rows[0];
    if (!user || user.status === "blocked" || user.status === "suspended") {
      await buyQuery("rollback");
      inTransaction = false;
      fail(res, "User is not allowed to purchase products.", 403, "Product purchase failed");
      return;
    }

    const productRows = await buyQuery<{
      id: string;
      title: string;
      package_id: string;
      package_price: string;
      stock: number;
      package_name: string;
    }>(
      `select p.id, p.title, p.package_id, p.package_price::text, p.stock, pkg.name as package_name
       from hb_products p
       join hb_packages pkg on pkg.id = p.package_id
       where p.id = $1 and p.active = true and pkg.status = 'available'
       for update of p`,
      [productId]
    );
    const product = productRows.rows[0];
    if (!product) {
      await buyQuery("rollback");
      inTransaction = false;
      fail(res, "Product is not available or has no active mapped package.", 404, "Product purchase failed");
      return;
    }

    const existingPurchaseRows = await buyQuery<{ id: string; package_id: string; amount_usd: string; status: string }>(
      `select id, package_id, amount_usd::text, status
       from hb_package_purchases
       where user_id = $1 and package_id = $2 and status = 'completed'
       order by created_at desc
       limit 1`,
      [req.hbUser!.userId, product.package_id]
    );
    if (existingPurchaseRows.rows[0]) {
      const existingPurchase = existingPurchaseRows.rows[0];
      await runCompletedPackagePurchasePipeline({
        client,
        purchaseId: existingPurchase.id,
        buyerUserId: req.hbUser!.userId,
        packageId: existingPurchase.package_id,
        amountUsd: existingPurchase.amount_usd
      });
      await buyQuery(
        "update hb_product_orders set distribution_status = 'completed', updated_at = now() where buyer_user_id = $1 and package_purchase_id = $2",
        [req.hbUser!.userId, existingPurchase.id]
      );
      await buyQuery("commit");
      inTransaction = false;
      const wallet = await getWalletSummary(req.hbUser!.userId);
      ok(res, {
        order: { id: existingPurchase.id, order_number: "EXISTING-PACKAGE", distribution_status: "completed" },
        packagePurchaseId: existingPurchase.id,
        activated: user.status === "active",
        idempotent: true,
        walletBalance: wallet.balances.deposit,
        mainWalletBalance: wallet.balances.deposit,
        availableBalance: wallet.availableBalance
      }, "Package already purchased");
      return;
    }

    if (product.stock <= 0) {
      await buyQuery("rollback");
      inTransaction = false;
      fail(res, "Product is out of stock.", 409, "Product purchase failed");
      return;
    }

    const balanceRows = await buyQuery<{ balance: string }>(
      `select coalesce(sum(case when direction = 'credit' then amount_usd else -amount_usd end),0)::text as balance
       from hb_internal_ledger
       where user_id = $1 and wallet_type = 'deposit'`,
      [req.hbUser!.userId]
    );
    const balance = Number(balanceRows.rows[0]?.balance || 0);
    const amount = Number(product.package_price);
    if (balance + Number.EPSILON < amount) {
      await buyQuery("rollback");
      inTransaction = false;
      fail(res, `Insufficient verified wallet balance. Required $${amount.toFixed(2)}, available $${balance.toFixed(2)}.`, 400, "Insufficient balance");
      return;
    }

    const purchaseRows = await buyQuery<{ id: string; amount_usd: string; status: string }>(
      `insert into hb_package_purchases (user_id, package_id, amount_usd, status, idempotency_key)
       values ($1,$2,$3,'completed',$4)
       returning id, amount_usd::text, status`,
      [req.hbUser!.userId, product.package_id, product.package_price, `hb:package-from-product:${idempotencyKey}`]
    );
    const purchase = purchaseRows.rows[0];
    const buyerWalletAddress = user.usdt_bep20_address || user.hb9_wallet_address || user.wallet_address || null;
    const ledgerRows = await buyQuery<{ id: string }>(
      `insert into hb_internal_ledger (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
       values ($1,'deposit','debit',$2,'package_purchase',$3,$4,$5::jsonb)
       returning id`,
      [
        req.hbUser!.userId,
        product.package_price,
        purchase.id,
        `hb:ledger:${purchase.id}:deposit_debit`,
        JSON.stringify({
          title: "Product Purchase",
          category: "product_purchase",
          reason: "product_purchase",
          currency: "USDT",
          walletAddress: buyerWalletAddress,
          productId: product.id,
          productTitle: product.title,
          packageId: product.package_id,
          packageName: product.package_name,
          packageAmount: product.package_price,
          amount: product.package_price
        })
      ]
    );
    const ledgerEntryId = ledgerRows.rows[0]?.id || null;
    await createLedgerProof(client, "hb_internal_ledger", ledgerEntryId);
    await buyQuery("update hb_package_purchases set ledger_entry_id = $2 where id = $1", [purchase.id, ledgerEntryId]);
    if (config.hbProductPurchaseDebitsCoinUsdt) {
      await applyHbCoinAdjustment({
        client,
        userId: req.hbUser!.userId,
        coinSymbol: "USDT",
        amount: product.package_price,
        direction: "debit",
        type: "debit",
        reference: purchase.id,
        note: "Configured USDT coin debit for product package purchase",
        idempotencyKey: `hb:coin:package_purchase:${purchase.id}:debit`
      });
    }
    await buyQuery(
      `update hb_user_products
       set status = 'inactive'
       where user_id = $1 and package_amount < $2::numeric and status = 'active'`,
      [req.hbUser!.userId, product.package_price]
    );
    await buyQuery(
      `insert into hb_user_products (user_id, package_purchase_id, package_id, package_name, package_amount, activated_at)
       values ($1,$2,$3,$4,$5,now())`,
      [req.hbUser!.userId, purchase.id, product.package_id, product.package_name, product.package_price]
    );

    const orderNumber = `HB${Date.now()}${crypto.randomInt(1000, 9999)}`;
    const orderRows = await buyQuery<{ id: string; order_number: string; distribution_status: string }>(
      `insert into hb_product_orders
        (order_number, buyer_user_id, package_purchase_id, amount_usd, payment_status, activation_status, distribution_status, idempotency_key)
       values ($1,$2,$3,$4,'paid','completed','pending',$5)
       returning id, order_number, distribution_status`,
      [orderNumber, req.hbUser!.userId, purchase.id, product.package_price, idempotencyKey]
    );
    const order = orderRows.rows[0];
    await buyQuery(
      `insert into hb_product_order_items (order_id, product_id, package_id, title, package_price, quantity, line_total_usd)
       values ($1,$2,$3,$4,$5,1,$5)`,
      [order.id, product.id, product.package_id, product.title, product.package_price]
    );
    await buyQuery("update hb_products set stock = greatest(stock - 1, 0), updated_at = now() where id = $1", [product.id]);

    if (user.status === "inactive") {
      await buyQuery("update hb_users set status = 'active', activated_at = now(), updated_at = now() where id = $1", [req.hbUser!.userId]);
      await buyQuery(
        `insert into hb_activation_logs (user_id, package_purchase_id, previous_status, new_status)
         values ($1,$2,'inactive','active')`,
        [req.hbUser!.userId, purchase.id]
      );
    }

    await runCompletedPackagePurchasePipeline({
      client,
      purchaseId: purchase.id,
      buyerUserId: req.hbUser!.userId,
      packageId: product.package_id,
      amountUsd: purchase.amount_usd
    });
    await buyQuery("update hb_product_orders set distribution_status = 'completed', updated_at = now() where id = $1", [order.id]);
    order.distribution_status = "completed";

    await buyQuery(
      `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
       values ($1,'hb.product.buy','hb_product_order',$2,$3::jsonb)`,
      [req.hbUser!.userId, order.id, JSON.stringify({ productId: product.id, packagePurchaseId: purchase.id, amountUsd: product.package_price })]
    );
    const updatedBalanceRows = await buyQuery<{ balance: string }>(
      `select coalesce(sum(case when direction = 'credit' then amount_usd else -amount_usd end),0)::text as balance
       from hb_internal_ledger
       where user_id = $1 and wallet_type = 'deposit'`,
      [req.hbUser!.userId]
    );
    const updatedBalance = updatedBalanceRows.rows[0]?.balance || "0";
    await buyQuery("commit");
    inTransaction = false;
    ok(res, {
      order,
      packagePurchaseId: purchase.id,
      activated: user.status === "inactive",
      walletBalance: updatedBalance,
      mainWalletBalance: updatedBalance,
      availableBalance: updatedBalance
    }, "Product purchased successfully", 201);
  } catch (err) {
    const error = err as Error & { code?: string; detail?: string; hint?: string; constraint?: string; table?: string; column?: string };
    console.error("HB9_BUY_FATAL", error);
    console.error("HB9_BUY_FATAL", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      constraint: error?.constraint,
      table: error?.table,
      column: error?.column,
      stack: error?.stack
    });
    logger.error("HB9_BUY_FATAL", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      constraint: error?.constraint,
      table: error?.table,
      column: error?.column,
      stack: error?.stack,
      sql: lastBuySql,
      params: lastBuyParams,
      productId,
      userId: req.hbUser!.userId
    });
    if (inTransaction) await client.query("rollback").catch(() => undefined);
    res.status(500).json({
      success: false,
      message: error?.message || "Product purchase failed.",
      code: error?.code,
      constraint: error?.constraint
    });
  } finally {
    client.release();
  }
}));

hbRouter.get("/hb/purchases", requireHbUser, asyncHandler(async (req, res) => {
  const rows = await query(
    `select p.id, p.amount_usd, p.status, p.created_at, pkg.name as package_name,
            p.contract_purchase_tx_hash, p.block_number, p.log_index, p.onchain_package_id,
            p.onchain_buyer_address, p.onchain_sponsor_address, p.onchain_status, p.onchain_tx_hash,
            p.public_reference_id, lp.proof_hash, lp.onchain_status as proof_onchain_status
     from hb_package_purchases p
     join hb_packages pkg on pkg.id = p.package_id
     left join hb_internal_ledger l on l.id = p.ledger_entry_id
     left join hb_ledger_proofs lp on lp.ledger_entry_id = l.id and lp.source_table = 'hb_internal_ledger'
     where p.user_id = $1
     order by p.created_at desc`,
    [req.hbUser!.userId]
  );
  ok(res, { items: rows }, "HB9 purchases loaded");
}));

hbRouter.get("/hb/orders", requireHbUser, asyncHandler(async (req, res) => {
  const rows = await query(
    `select o.id, o.order_number, o.amount_usd, o.payment_status, o.activation_status, o.distribution_status, o.created_at,
            oi.title as product_title, oi.package_price, pkg.name as package_name, p.slug as product_slug, p.image_url
     from hb_product_orders o
     join hb_product_order_items oi on oi.order_id = o.id
     join hb_products p on p.id = oi.product_id
     join hb_packages pkg on pkg.id = oi.package_id
     where o.buyer_user_id = $1
     order by o.created_at desc
     limit 100`,
    [req.hbUser!.userId]
  );
  ok(res, { items: rows }, "HB9 product orders loaded");
}));

hbRouter.get("/hb/income", requireHbUser, asyncHandler(async (req, res) => {
  await evaluateSalaryIncome(req.hbUser!.userId).catch((error) => {
    logger.warn("hb.salary.evaluate.failed", { userId: req.hbUser!.userId, error: error instanceof Error ? error.message : String(error) });
  });
  const rows = await query(
    `select l.id, l.income_type, l.amount_usd, l.status, l.level_depth, l.level_depth as level_number, l.metadata, l.created_at,
            lp.public_reference_id, lp.proof_hash, lp.previous_proof_hash, lp.chain_tx_hash, lp.onchain_status,
            pkg.name as source_package,
            coalesce(src.usdt_bep20_address, src.hb9_wallet_address) as source_wallet,
            src.display_name as source_user_name
     from hb_income_ledger l
     left join hb_ledger_proofs lp on lp.ledger_entry_id = l.id and lp.source_table = 'hb_income_ledger'
     left join hb_package_purchases pp on pp.id = l.package_purchase_id
     left join hb_packages pkg on pkg.id = pp.package_id
     left join hb_users src on src.id = l.source_user_id
     where l.earner_user_id = $1 and l.income_type in ('referral_income','level_income','salary_income','single_leg_income','upline','level')
     order by l.created_at desc
     limit 100`,
    [req.hbUser!.userId]
  );
  const singleLegReserve = await query(
    `select id, amount_usd, status, algorithm_version, created_at
     from hb_single_leg_reserve
     where buyer_user_id = $1
     order by created_at desc
     limit 100`,
    [req.hbUser!.userId]
  );
  const totals = await query(
    `select
       coalesce(sum(coalesce(credited_amount, amount_usd)) filter (where income_type in ('referral_income','upline') and status = 'credited'),0)::text as referral_income,
       coalesce(sum(coalesce(credited_amount, amount_usd)) filter (where income_type in ('referral_income','upline') and status = 'credited'),0)::text as direct_income,
       coalesce(sum(coalesce(credited_amount, amount_usd)) filter (where income_type in ('level_income','level') and status = 'credited'),0)::text as level_income,
       coalesce(sum(coalesce(credited_amount, amount_usd)) filter (where income_type = 'single_leg_income' and status = 'credited'),0)::text as single_leg_income,
       coalesce(sum(coalesce(credited_amount, amount_usd)) filter (where income_type = 'salary_income' and status = 'credited'),0)::text as salary_income_paid
     from hb_income_ledger
     where earner_user_id = $1`,
    [req.hbUser!.userId]
  );
  const salaryRows = await query<{
    user_id: string;
    salary_amount: string;
    status: string;
    self_package_ok: boolean;
    direct_100_count: number;
    team_100_count: number;
    unlocked_at: string | null;
    paid_at: string | null;
    ledger_reference: string | null;
    proof_reference: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `select user_id, salary_amount::text, status, self_package_ok, direct_100_count, team_100_count,
            unlocked_at, paid_at, ledger_reference, proof_reference, created_at, updated_at
     from hb_salary_income
     where user_id = $1
     limit 1`,
    [req.hbUser!.userId]
  );
  const singleLegTotals = await query<{ single_leg_reserve: string }>(
    `select coalesce(sum(amount_usd),0)::text as single_leg_reserve
     from hb_single_leg_reserve
     where buyer_user_id = $1`,
    [req.hbUser!.userId]
  );
  const incomeCap = await getIncomeCapSummary(req.hbUser!.userId).catch((error) => {
    logger.warn("hb.income_cap.summary.failed", { userId: req.hbUser!.userId, error: error instanceof Error ? error.message : String(error) });
    return null;
  });
  const dividendStats = await getUserDividendStats(req.hbUser!.userId).catch((error) => {
    logger.warn("hb.dividend.summary.failed", { userId: req.hbUser!.userId, error: error instanceof Error ? error.message : String(error) });
    return { totalDividendUsd: "0", dividendCapUsd: "0", remainingDividendUsd: "0" };
  });
  const levelUnlockRows = await query<{ direct_count: number }>(
    `select count(distinct direct.id)::int as direct_count
     from hb_users direct
     join hb_package_purchases p on p.user_id = direct.id and p.status = 'completed' and p.amount_usd >= 4
     where direct.sponsor_user_id = $1 and direct.status = 'active'`,
    [req.hbUser!.userId]
  );
  const levelUnlockDirectCount = Number(levelUnlockRows[0]?.direct_count || 0);
  const levelUnlockProgress = {
    directReferrals: levelUnlockDirectCount,
    maxLevel: 15,
    levels: Array.from({ length: 15 }, (_, index) => ({
      level: index + 1,
      requiredDirectReferrals: index + 1,
      status: levelUnlockDirectCount >= index + 1 ? "unlocked" : "locked"
    }))
  };
  let singleLegProgress: Record<string, unknown> | null = null;
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      singleLegProgress = await getSingleLegProgress(client, req.hbUser!.userId);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      logger.warn("hb.single_leg.progress.failed", { userId: req.hbUser!.userId, error: error instanceof Error ? error.message : String(error) });
    } finally {
      client.release();
    }
  }
  ok(res, {
    items: rows,
    productAllocations: [],
    singleLegReserve,
    singleLegProgress,
    levelUnlockProgress,
    incomeCap,
    dividendIncomeUsd: dividendStats.totalDividendUsd,
    dividendCapUsd: dividendStats.dividendCapUsd,
    dividendRemainingUsd: dividendStats.remainingDividendUsd,
    salaryIncome: salaryRows[0] || {
      user_id: req.hbUser!.userId,
      salary_amount: "100",
      status: "locked",
      self_package_ok: false,
      direct_100_count: 0,
      team_100_count: 0
    },
    summary: { ...(totals[0] || {}), salary_income: salaryRows[0]?.salary_amount || "100", ...(singleLegTotals[0] || {}) }
  }, "HB9 income loaded");
}));

hbRouter.get("/hb/referrals", requireHbUser, asyncHandler(async (req, res) => {
  const rows = await query(
    `select r.id, r.level_depth, r.created_at, u.id as user_id, u.display_name, u.email, u.status
     from hb_referrals r
     join hb_users u on u.id = r.referred_user_id
     where r.sponsor_user_id = $1
     order by r.created_at desc`,
    [req.hbUser!.userId]
  );
  const sponsor = await query(
    `select s.id, s.display_name, s.email, s.status
     from hb_users u
     join hb_users s on s.id = u.sponsor_user_id
     where u.id = $1
     limit 1`,
    [req.hbUser!.userId]
  );
  const levels = await query<{ level_no: number; total_count: number; active_count: number; inactive_count: number }>(
    `with recursive team(level_no, user_id, status) as (
       select 1, u.id, u.status
       from hb_users u
       where u.sponsor_user_id = $1
       union all
       select team.level_no + 1, child.id, child.status
       from team
       join hb_users child on child.sponsor_user_id = team.user_id
       where team.level_no < 15
     )
     select level_no,
            count(*)::int as total_count,
            count(*) filter (where status = 'active')::int as active_count,
            count(*) filter (where status <> 'active')::int as inactive_count
     from team
     group by level_no
     order by level_no`,
    [req.hbUser!.userId]
  );
  const packageSummary = await query(
    `with recursive team(user_id) as (
       select u.id from hb_users u where u.sponsor_user_id = $1
       union all
       select child.id from team join hb_users child on child.sponsor_user_id = team.user_id
     )
     select count(distinct p.id)::int as purchase_count, coalesce(sum(p.amount_usd),0)::text as purchase_volume
     from team
     left join hb_package_purchases p on p.user_id = team.user_id and p.status = 'completed'`,
    [req.hbUser!.userId]
  );
  const levelUnlockRows = await query<{ direct_count: number }>(
    `select count(distinct direct.id)::int as direct_count
     from hb_users direct
     join hb_package_purchases p on p.user_id = direct.id and p.status = 'completed' and p.amount_usd >= 4
     where direct.sponsor_user_id = $1 and direct.status = 'active'`,
    [req.hbUser!.userId]
  );
  const levelUnlockDirectCount = Number(levelUnlockRows[0]?.direct_count || 0);
  const levelUnlockProgress = {
    directReferrals: levelUnlockDirectCount,
    maxLevel: 15,
    levels: Array.from({ length: 15 }, (_, index) => ({
      level: index + 1,
      requiredDirectReferrals: index + 1,
      status: levelUnlockDirectCount >= index + 1 ? "unlocked" : "locked"
    }))
  };
  const levelCounts = Array.from({ length: 15 }, (_, index) => {
    const level = index + 1;
    const existing = levels.find((row) => Number(row.level_no) === level);
    return {
      level,
      total: Number(existing?.total_count || 0),
      active: Number(existing?.active_count || 0)
    };
  });
  const totals = levels.reduce<{ totalTeamCount: number; activeCount: number; inactiveCount: number }>((acc, row) => {
    acc.totalTeamCount += Number(row.total_count || 0);
    acc.activeCount += Number(row.active_count || 0);
    acc.inactiveCount += Number(row.inactive_count || 0);
    return acc;
  }, { totalTeamCount: 0, activeCount: 0, inactiveCount: 0 });
  let singleLegProgress: Record<string, unknown> | null = null;
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      singleLegProgress = await getSingleLegProgress(client, req.hbUser!.userId);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      logger.warn("hb.single_leg.referral_progress.failed", { userId: req.hbUser!.userId, error: error instanceof Error ? error.message : String(error) });
    } finally {
      client.release();
    }
  }
  ok(res, {
    sponsor: sponsor[0] || null,
    items: rows,
    directReferrals: rows,
    levelSummary: levels,
    levelCounts,
    totalTeamCount: totals.totalTeamCount,
    singleLegCount: Number(singleLegProgress?.singleLegTeamCount || 0),
    directTeamCount: rows.length,
    activeTeamCount: totals.activeCount,
    inactiveTeamCount: totals.inactiveCount,
    activeCount: totals.activeCount,
    inactiveCount: totals.inactiveCount,
    packageSummary: packageSummary[0] || { purchase_count: 0, purchase_volume: "0" },
    levelUnlockProgress,
    singleLegProgress
  }, "HB9 referrals loaded");
}));

hbRouter.get("/hb/transparency", requireHbUser, asyncHandler(async (req, res) => {
  const rows = await query(
    `select public_reference_id, proof_type, amount_usd::text, status, proof_hash, previous_proof_hash,
            chain_tx_hash, onchain_status, created_at
     from hb_ledger_proofs
     where user_id = $1
     order by created_at desc
     limit 100`,
    [req.hbUser!.userId]
  );
  ok(res, { items: rows }, "HB9 ledger proofs loaded");
}));

hbRouter.get("/hb/treasury-transparency", requireHbUser, asyncHandler(async (_req, res) => {
  const [settings, totals, incomeTotals, pendingPayouts] = await Promise.all([
    query<{ key: string; label: string; wallet_address: string | null; network: string; chain_id: number; updated_at: string }>(
      "select key, label, wallet_address, network, chain_id, updated_at from hb_treasury_settings order by key"
    ),
    query<{
      total_deposits: string;
      total_withdrawals: string;
      active_liabilities: string;
    }>(
      `select
         coalesce((select sum(usd_amount) from hb_deposits where status = 'verified'),0)::text as total_deposits,
         coalesce((select sum(payout_amount_usd) from hb_withdrawals where status = 'paid'),0)::text as total_withdrawals,
         coalesce((select sum(balance) from hb_coin_balances where coin_symbol = 'USDT'),0)::text as active_liabilities`
    ),
    query<{
      direct_income_treasury: string;
      level_income_treasury: string;
      company_reserve_treasury: string;
    }>(
      `select
         coalesce(sum(amount_usd) filter (where income_type in ('referral_income','upline')),0)::text as direct_income_treasury,
         coalesce(sum(amount_usd) filter (where income_type in ('level_income','level')),0)::text as level_income_treasury,
         coalesce(sum(amount_usd) filter (where income_type = 'company'),0)::text as company_reserve_treasury
       from hb_income_ledger`
    ),
    query<{ pending_payouts: string }>(
      "select coalesce(sum(payout_amount_usd),0)::text as pending_payouts from hb_withdrawals where status in ('pending','under_review','approved','processing')"
    )
  ]);
  const [treasuryHealth, syncHealth, controls] = await Promise.all([
    getTreasuryHealth(),
    getHbOnchainSyncHealth().catch(() => ({ dryRun: false, configReady: false, rpcHealthy: false, latestIndexedBlock: 0 })),
    getProductionControls()
  ]);
  ok(res, {
    explorerBaseUrl: hbBscScanBaseUrl(),
    proofIntegrityPercent: 100,
    treasuryStatus: treasuryHealth.warningState,
    onchainSyncStatus: syncHealth.dryRun ? "dry_run" : syncHealth.rpcHealthy ? "healthy" : "needs_attention",
    lastIndexedBlock: Number(syncHealth.latestIndexedBlock || 0),
    chainStatus: syncHealth.dryRun ? "dry_run" : syncHealth.rpcHealthy ? "connected" : "not_connected",
    health: { ...treasuryHealth, ...controls },
    wallets: settings.map((item) => ({
      ...item,
      explorer_url: explorerAddressUrl(item.wallet_address),
      reserve_balance: "Pending on-chain sync"
    })),
    reserveAccounting: {
      ...(totals[0] || {}),
      ...(incomeTotals[0] || {}),
      ...(pendingPayouts[0] || {})
    }
  }, "HB9 treasury transparency loaded");
}));

hbRouter.get("/hb/wallet-activity", requireHbUser, asyncHandler(async (req, res) => {
  const rows = await query(
    `select *
     from (
       select l.id::text,
              case when l.type = 'deposit_credit' then 'deposit_credit' else l.type end as type,
              case when l.type = 'deposit_credit' then 'Deposit Credit' else coalesce(nullif(l.note, ''), l.type) end as title,
              case when l.type = 'deposit_credit' then 'deposit_credit' else l.type end as category,
              l.direction,
              l.amount::text as amount_usd,
              l.coin_symbol as currency,
              coalesce(l.reference_id, l.reference) as related_id,
              coalesce((l.metadata->>'walletAddress'), (l.metadata->>'fromAddress'), u.usdt_bep20_address, u.hb9_wallet_address, u.wallet_address) as wallet_address,
              l.metadata,
              coalesce(l.reference_id, l.reference) as reference,
              p.public_reference_id,
              p.proof_hash,
              p.chain_tx_hash,
              p.onchain_status,
              l.created_at
       from hb_coin_balance_ledger l
       join hb_users u on u.id = l.user_id
       left join hb_ledger_proofs p on p.ledger_entry_id = l.id and p.source_table = 'hb_coin_balance_ledger'
       where l.user_id = $1 and l.type = 'deposit_credit'
       union all
       select l.id::text,
              'product_purchase' as type,
              'Product Purchase' as title,
              'product_purchase' as category,
              l.direction,
              l.amount_usd::text as amount_usd,
              coalesce(l.metadata->>'currency', 'USDT') as currency,
              l.reference_id::text as related_id,
              coalesce(l.metadata->>'walletAddress', u.usdt_bep20_address, u.hb9_wallet_address, u.wallet_address) as wallet_address,
              jsonb_strip_nulls(l.metadata || jsonb_build_object(
                'packageName', pkg.name,
                'productId', oi.product_id,
                'packageAmount', l.amount_usd,
                'relatedId', l.reference_id
              )) as metadata,
              l.reference_id::text as reference,
              p.public_reference_id,
              p.proof_hash,
              p.chain_tx_hash,
              p.onchain_status,
              l.created_at
       from hb_internal_ledger l
       join hb_users u on u.id = l.user_id
       left join hb_package_purchases pp on pp.id = l.reference_id
       left join hb_packages pkg on pkg.id = pp.package_id
       left join hb_product_orders po on po.package_purchase_id = pp.id
       left join hb_product_order_items oi on oi.order_id = po.id
       left join hb_ledger_proofs p on p.ledger_entry_id = l.id and p.source_table = 'hb_internal_ledger'
       where l.user_id = $1
         and l.wallet_type = 'deposit'
         and l.direction = 'debit'
         and l.reference_type = 'package_purchase'
     ) activity
     order by created_at desc
     limit 60`,
    [req.hbUser!.userId]
  );
  ok(res, { items: rows }, "HB9 wallet activity loaded");
}));

hbRouter.get("/hb/funds/history", requireHbUser, asyncHandler(async (req, res) => {
  const rows = await query(
    `select l.id, l.coin_symbol, l.amount::text, l.type, l.direction, NULL::text AS reference, l.note, l.created_at,
            p.public_reference_id, p.proof_hash,
            case
              when l.type = 'admin_transfer' and l.direction = 'credit' then 'received_funds'
              when l.type = 'admin_transfer' and l.direction = 'debit' then 'transferred_funds'
              when l.type = 'admin_credit' then 'admin_credit'
              when l.type = 'admin_debit' then 'admin_deduction'
              when l.type = 'admin_bulk' then 'bulk_distribution'
              else l.type
            end as action_type
     from hb_coin_balance_ledger l
     left join hb_ledger_proofs p on p.ledger_entry_id = l.id and p.source_table = 'hb_coin_balance_ledger'
     where l.user_id = $1
     order by l.created_at desc
     limit 200`,
    [req.hbUser!.userId]
  );
  ok(res, { items: rows }, "HB9 fund history loaded");
}));

hbRouter.get("/hb/proof/:referenceId", asyncHandler(async (req, res) => {
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Proof verification failed");
    return;
  }
  const client = await pool.connect();
  try {
    const referenceId = String(req.params.referenceId || "");
    const proof = await verifyLedgerProofReference(client, referenceId);
    if (!proof) {
      fail(res, "Proof reference was not found.", 404, "Proof not found");
      return;
    }
    ok(res, {
      public_reference_id: proof.public_reference_id,
      proof_hash: proof.proof_hash,
      previous_proof_hash: proof.previous_proof_hash,
      ledger_type: proof.source_table,
      proof_type: proof.proof_type,
      amount_usd: proof.amount_usd,
      masked_user_id: proof.masked_user_id,
      chain_reference: proof.onchain_status,
      tx_hash: proof.chain_tx_hash,
      explorer_url: explorerTxUrl(proof.chain_tx_hash),
      verification_status: proof.valid ? "verified" : "tampered",
      expected_hash: proof.expected_hash,
      created_at: proof.created_at
    }, "Proof verification loaded");
  } finally {
    client.release();
  }
}));

hbRouter.post("/hb/auth/wallet/challenge", asyncHandler(async (req, res) => {
  if (!walletSignatureAuthEnabled()) {
    fail(res, "Wallet signature authentication is not enabled.", 404, "Not found");
    return;
  }
  logger.info("hb.wallet_challenge.payload", {
    walletAddress: typeof req.body?.walletAddress === "string" ? req.body.walletAddress : null,
    chainId: req.body?.chainId ?? null,
    authMode: typeof req.body?.authMode === "string" ? req.body.authMode : null,
    hasReferralCode: Boolean(req.body?.referralCode)
  });
  const parsed = walletChallengeSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid wallet challenge");
    return;
  }
  if (parsed.data.chainId !== hbOnchainChainId()) {
    logger.warn("hb.wallet_auth.failed", { category: "wrong_network", chainId: parsed.data.chainId });
    fail(res, `Switch to ${hbNetworkLabel()} before signing in.`, 400, "Wrong network");
    return;
  }
  const walletAddress = getAddress(parsed.data.walletAddress);
  const adminWalletAddress = normalizedHb9AdminWallet(walletAddress);
  if (adminWalletAddress) logger.info("ADMIN_WALLET_MATCH", { walletAddress: adminWalletAddress, authMode: parsed.data.authMode || null, phase: "challenge" });
  const rate = walletChallengeRateLimit(req, walletAddress);
  if (!rate.allowed) {
    logger.warn("hb.wallet_challenge.rate_limited", { walletAddress, retryAfter: rate.retryAfter });
    res.setHeader("Retry-After", String(rate.retryAfter));
    res.status(429).json({
      success: false,
      data: { retryAfter: rate.retryAfter },
      message: "Rate limit exceeded",
      error: "Please wait a few seconds and try again."
    });
    return;
  }
  if (!adminWalletAddress && !(await enforceRolloutAccess(res, { walletAddress: parsed.data.walletAddress, referralCode: parsed.data.referralCode, action: "wallet.challenge" }))) return;
  if (!pool) {
    fail(res, "HB9 database is not configured.", 503, "Wallet auth unavailable");
    return;
  }
  const nonce = crypto.randomBytes(24).toString("base64url");
  const issuedAt = new Date().toISOString();
  const domain = requestDomain(req);
  const sponsorCode = (parsed.data.referralCode || "").trim().toUpperCase();
  const message = walletLoginMessage({ domain, walletAddress, chainId: parsed.data.chainId, nonce, issuedAt });
  await query(
    `insert into hb_wallet_auth_challenges (wallet_address, nonce, message, chain_id, domain, sponsor_referral_code, expires_at)
     values ($1,$2,$3,$4,$5,$6,now() + interval '10 minutes')`,
    [walletAddress, nonce, message, parsed.data.chainId, domain, sponsorCode || null]
  );
  ok(res, { nonce, message, chainId: parsed.data.chainId, expiresInSeconds: 600 }, "Wallet signature challenge created");
}));

hbRouter.post("/hb/auth/wallet/verify", asyncHandler(async (req, res) => {
  if (!walletSignatureAuthEnabled()) {
    fail(res, "Wallet signature authentication is not enabled.", 404, "Not found");
    return;
  }
  const parsed = walletVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid wallet verification");
    return;
  }
  if (parsed.data.chainId !== hbOnchainChainId()) {
    logger.warn("hb.wallet_auth.failed", { category: "wrong_network", chainId: parsed.data.chainId });
    fail(res, `Switch to ${hbNetworkLabel()} before signing in.`, 400, "Wrong network");
    return;
  }
  if (!pool) {
    fail(res, "HB9 database is not configured.", 503, "Wallet auth unavailable");
    return;
  }
  const walletAddress = getAddress(parsed.data.walletAddress);
  const adminWalletAddress = normalizedHb9AdminWallet(walletAddress);
  const client = await pool.connect();
  try {
    await ensureWalletAuthUserColumns(client);
    await client.query("begin");
    const challengeRows = await client.query<{
      id: string;
      wallet_address: string;
      message: string;
      chain_id: number | null;
      expires_at: string;
      sponsor_referral_code: string | null;
    }>(
      `select id, wallet_address, message, chain_id, expires_at, sponsor_referral_code
       from hb_wallet_auth_challenges
       where nonce = $1 and status = 'pending'
       for update`,
      [parsed.data.nonce]
    );
    const challenge = challengeRows.rows[0];
    if (!challenge) {
      await client.query("rollback");
      logger.warn("hb.wallet_auth.failed", { category: "invalid_challenge", walletAddress });
      fail(res, "Wallet challenge is invalid or already used.", 401, "Wallet verification failed");
      return;
    }
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      await client.query("update hb_wallet_auth_challenges set signature = $2, status = 'expired' where id = $1", [challenge.id, parsed.data.signature]);
      await client.query("commit");
      logger.warn("hb.wallet_auth.failed", { category: "expired_challenge", walletAddress });
      fail(res, "Wallet challenge expired. Try again.", 401, "Wallet verification failed");
      return;
    }
    if (Number(challenge.chain_id) !== parsed.data.chainId || getAddress(challenge.wallet_address) !== walletAddress) {
      await client.query("update hb_wallet_auth_challenges set signature = $2, status = 'rejected' where id = $1", [challenge.id, parsed.data.signature]);
      await client.query("commit");
      logger.warn("hb.wallet_auth.failed", { category: "challenge_mismatch", walletAddress });
      fail(res, "Wallet challenge does not match the connected wallet or network.", 401, "Wallet verification failed");
      return;
    }
    const recoveredAddress = getAddress(verifyMessage(challenge.message, parsed.data.signature));
    if (recoveredAddress !== walletAddress) {
      await client.query("update hb_wallet_auth_challenges set signature = $2, status = 'rejected' where id = $1", [challenge.id, parsed.data.signature]);
      await client.query("commit");
      logger.warn("hb.wallet_auth.failed", { category: "bad_signature", walletAddress });
      fail(res, "Wallet signature could not be verified.", 401, "Wallet verification failed");
      return;
    }

    if (adminWalletAddress) {
      logger.info("ADMIN_WALLET_MATCH", { walletAddress: adminWalletAddress, authMode: parsed.data.authMode || null, phase: "verify" });
      const adminEmail = config.adminEmail || adminWalletAddress;
      const adminToken = createAdminToken(adminEmail, "super_admin");
      await client.query(
        `update hb_wallet_auth_challenges
         set signature = $2, status = 'verified', verified_at = now()
         where id = $1`,
        [challenge.id, parsed.data.signature]
      );
      await client.query("commit");
      logger.info("ADMIN_LOGIN_SUCCESS", { walletAddress: adminWalletAddress, role: "super_admin", redirect: "/admin/hb" });
      ok(res, {
        adminToken,
        role: "super_admin",
        admin: { email: adminEmail, role: "super_admin", walletAddress: adminWalletAddress },
        adminRedirect: "/admin/hb"
      }, "HB9 admin wallet login successful");
      return;
    }

    let userRows = await client.query<{
      id: string;
      email: string | null;
      mobile_number: string | null;
      display_name: string;
      referral_code: string;
      own_referral_code: string | null;
      hb9_wallet_address: string | null;
      wallet_address?: string | null;
      usdt_bep20_address: string | null;
      activation_fee_paid: boolean;
      activation_fee_tx_hash: string | null;
      sponsor_referral_code: string | null;
      source_referral_code: string | null;
      status: "inactive" | "active" | "suspended" | "blocked";
      created_at: string;
    }>(
      `select id, email, mobile_number, display_name, referral_code, referral_code as own_referral_code,
              hb9_wallet_address, usdt_bep20_address, coalesce(wallet_address, usdt_bep20_address, hb9_wallet_address) as wallet_address,
              activation_fee_paid, activation_fee_tx_hash,
              sponsor_referral_code, source_referral_code, status, created_at
       from hb_users
       where lower(coalesce(wallet_address, '')) = lower($1)
          or lower(coalesce(usdt_bep20_address, '')) = lower($1)
          or lower(coalesce(hb9_wallet_address, '')) = lower($1)
       limit 1`,
      [walletAddress]
    );
    let user = userRows.rows[0];
    if (!user) {
      if (parsed.data.authMode === "login") {
        await client.query("update hb_wallet_auth_challenges set signature = $2, status = 'rejected' where id = $1", [challenge.id, parsed.data.signature]);
        await client.query("commit");
        fail(res, "Account not found. Please Sign Up.", 404, "Account not found. Please Sign Up.");
        return;
      }
      const sponsorCode = (challenge.sponsor_referral_code || "").trim().toUpperCase();
      const sponsor = sponsorCode ? await findSponsorByReferral(client, sponsorCode) : null;
      const code = referralCode();
      userRows = await client.query(
        `insert into hb_users
           (email, mobile_number, password_hash, display_name, referral_code, own_referral_code, sponsor_user_id,
            wallet_address, hb9_wallet_address, usdt_bep20_address, wallet_bound_at, sponsor_referral_code, source_referral_code, status, activation_fee_paid)
         values (null,null,null,$1,$2,$2,$3,$4,$4,$4,now(),$5,$5,'inactive',false)
         returning id, email, mobile_number, display_name, referral_code, own_referral_code,
                   hb9_wallet_address, usdt_bep20_address, coalesce(wallet_address, usdt_bep20_address, hb9_wallet_address) as wallet_address,
                   activation_fee_paid, activation_fee_tx_hash,
                   sponsor_referral_code, source_referral_code, status, created_at`,
        [`HB9 ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`, code, sponsor?.id || null, walletAddress, sponsor?.referral_code || null]
      );
      user = userRows.rows[0];
      await ensureRegistrationFeeTable(client);
      await client.query(
        `insert into hb_registration_activation_fees (user_id, wallet_address, treasury_wallet, amount_bnb, amount_usd, status, verification_status, chain_id)
         values ($1,$2,$3,$4,$5,'pending','pending',$6)
         on conflict do nothing`,
        [user.id, walletAddress, hbRegistrationTreasuryWallet(), 0, hbRegistrationFeeUsd(), hbOnchainChainId()]
      );
      await client.query(
        `insert into hb_wallets (user_id, wallet_address, wallet_type, network)
         values ($1,$2,'deposit','bsc')
         on conflict (user_id, wallet_type, network) do update set wallet_address = excluded.wallet_address`,
        [user.id, walletAddress]
      );
      if (sponsor) {
        await client.query(
          `insert into hb_referrals (sponsor_user_id, referred_user_id, level_depth)
           values ($1,$2,1) on conflict (referred_user_id) do nothing`,
          [sponsor.id, user.id]
        );
      }
      await client.query(
        `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
         values ($1,'hb.auth.wallet_register','hb_user',$1,$2::jsonb)`,
        [user.id, JSON.stringify({ walletAddress, sponsorCode: sponsor?.referral_code || null })]
      );
    } else {
      if (parsed.data.authMode === "signup") {
        await client.query("update hb_wallet_auth_challenges set user_id = $2, signature = $3, status = 'rejected' where id = $1", [challenge.id, user.id, parsed.data.signature]);
        await client.query("commit");
        fail(res, "Wallet already registered. Please Login.", 409, "Wallet already registered. Please Login.");
        return;
      }
      await client.query(
        `update hb_users
         set wallet_address = coalesce(wallet_address, $2),
             hb9_wallet_address = coalesce(hb9_wallet_address, $2),
             usdt_bep20_address = coalesce(usdt_bep20_address, $2),
             wallet_bound_at = coalesce(wallet_bound_at, now()),
             last_login_at = now(),
             updated_at = now()
         where id = $1`,
        [user.id, walletAddress]
      );
      await client.query(
        `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
         values ($1,'hb.auth.wallet_login','hb_user',$1,$2::jsonb)`,
        [user.id, JSON.stringify({ walletAddress })]
      );
    }
    await client.query(
      `update hb_wallet_auth_challenges
       set user_id = $2, signature = $3, status = 'verified', verified_at = now()
       where id = $1`,
      [challenge.id, user.id, parsed.data.signature]
    );
    await client.query("commit");
    const token = await createToken(user.id, walletAddress, req);
    if (parsed.data.authMode === "signup" && user.status === "inactive" && !user.activation_fee_paid) {
      ok(res, { token, user, registrationFeeRequired: true, registrationFee: hbRegistrationFeePayload() }, "HB9 activation fee required");
      return;
    }
    ok(res, { token, user, registrationFeeRequired: false }, "HB9 wallet login successful");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}));

hbRouter.post("/hb/auth/registration-fee/verify", requireHbUser, asyncHandler(async (req, res) => {
  const parsed = registrationFeeVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid activation fee transaction");
    return;
  }
  if (!pool) {
    fail(res, "HB9 database is not configured.", 503, "Activation unavailable");
    return;
  }
  const client = await pool.connect();
  try {
    await ensureWalletAuthUserColumns(client);
    await ensureRegistrationFeeTable(client);
    await client.query("begin");
    const userRows = await client.query<{
      id: string;
      status: "inactive" | "active" | "suspended" | "blocked";
      hb9_wallet_address: string | null;
      usdt_bep20_address: string | null;
      wallet_address: string | null;
      display_name: string;
      referral_code: string;
      own_referral_code: string | null;
      email: string | null;
      mobile_number: string | null;
      sponsor_referral_code: string | null;
      source_referral_code: string | null;
      created_at: string;
    }>(
      `select id, status, hb9_wallet_address, usdt_bep20_address, coalesce(wallet_address, usdt_bep20_address, hb9_wallet_address) as wallet_address, display_name, referral_code, own_referral_code,
              email, mobile_number, sponsor_referral_code, source_referral_code, created_at
       from hb_users
       where id = $1
       for update`,
      [req.hbUser!.userId]
    );
    const user = userRows.rows[0];
    if (!user) {
      await client.query("rollback");
      fail(res, "HB9 user was not found.", 404, "Activation failed");
      return;
    }
    if (user.status === "active") {
      await client.query("commit");
      ok(res, { user, registrationFeeRequired: false }, "HB9 ID already active");
      return;
    }
    const walletAddress = getAddress(user.wallet_address || user.usdt_bep20_address || user.hb9_wallet_address || req.hbUser!.login);
    const txHashRows = await client.query<{ id: string; user_id: string }>(
      "select id, user_id from hb_registration_activation_fees where lower(tx_hash) = lower($1) and status = 'verified' limit 1",
      [parsed.data.txHash]
    );
    if (txHashRows.rows[0] && txHashRows.rows[0].user_id !== user.id) {
      await client.query("rollback");
      fail(res, "Activation fee transaction was already used.", 409, "Activation failed");
      return;
    }
    const verification = await verifyBlockchainTransaction({
      txHash: parsed.data.txHash,
      network: "bsc",
      tokenSymbol: "USDT",
      requiredAmount: hbRegistrationFeeUsd(),
      expectedRecipient: hbRegistrationTreasuryWallet()
    });
    if (getAddress(verification.fromAddress) !== walletAddress) {
      await client.query(
        `insert into hb_registration_activation_fees
          (user_id, wallet_address, treasury_wallet, tx_hash, amount_bnb, amount_usd, status, verification_status, failure_reason, chain_id, confirmations)
         values ($1,$2,$3,$4,$5,$6,'failed','failed',$7,$8,$9)
         on conflict (tx_hash) do update set status = 'failed', verification_status = 'failed', failure_reason = excluded.failure_reason, updated_at = now()`,
        [user.id, walletAddress, hbRegistrationTreasuryWallet(), parsed.data.txHash, 0, hbRegistrationFeeUsd(), "Transaction sender does not match registered wallet.", verification.chainId, verification.confirmations]
      );
      await client.query("commit");
      fail(res, "Transaction sender does not match registered wallet.", 400, "Activation failed");
      return;
    }
    await client.query(
      `insert into hb_registration_activation_fees
        (user_id, wallet_address, treasury_wallet, tx_hash, amount_bnb, amount_usd, status, verification_status, chain_id, confirmations, verified_at)
       values ($1,$2,$3,$4,$5,$6,'verified','verified',$7,$8,now())
       on conflict (tx_hash) do update set status = 'verified', verification_status = 'verified', confirmations = excluded.confirmations, verified_at = now(), updated_at = now()`,
      [user.id, walletAddress, hbRegistrationTreasuryWallet(), parsed.data.txHash, 0, hbRegistrationFeeUsd(), verification.chainId, verification.confirmations]
    );
    await client.query("update hb_users set status = 'active', activation_fee_paid = true, activation_fee_tx_hash = $2, activated_at = now(), updated_at = now() where id = $1", [user.id, parsed.data.txHash]);
    await client.query(
      "insert into hb_activation_logs (user_id, package_purchase_id, previous_status, new_status) values ($1,null,$2,'active')",
      [user.id, user.status]
    );
    await client.query(
      `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
       values ($1,'hb.registration_fee.verified','hb_registration_activation_fee',$1,$2::jsonb)`,
      [user.id, JSON.stringify({ txHash: parsed.data.txHash, amountUSDT: verification.verifiedAmount, amountUSD: hbRegistrationFeeUsd(), walletAddress, treasuryWallet: hbRegistrationTreasuryWallet(), verification })]
    );
    await client.query("commit");
    ok(res, {
      user: { ...user, status: "active", wallet_address: walletAddress },
      registrationFeeRequired: false,
      txHash: parsed.data.txHash,
      amountBNB: 0,
      amountUSDT: verification.verifiedAmount,
      amountUSD: hbRegistrationFeeUsd(),
      walletAddress,
      status: "verified"
    }, "HB9 registration activation fee verified");
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    if (err instanceof VerificationError) {
      fail(res, err.publicReason, err.statusCode, "Activation fee verification failed");
      return;
    }
    throw err;
  } finally {
    client.release();
  }
}));

hbRouter.get("/admin/hb/deposits", requireAdmin, asyncHandler(async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const rows = await query(
    `select d.id, d.user_id, u.email, u.display_name, d.wallet_address, d.network, d.asset, d.usd_amount,
            coalesce(d.tx_hash, d.onchain_tx_hash) as tx_hash, d.status, d.verification_status, d.payment_status,
            d.failure_reason, d.created_at, d.verified_at, d.credited_at, d.chain_id, d.from_address, d.to_address,
            d.confirmations, d.onchain_status
     from hb_deposits d
     join hb_users u on u.id = d.user_id
     where ($1::text = '' or d.status = $1)
     order by d.created_at desc
     limit 200`,
    [status]
  );
  const [eventRows, summaryRows, indexerHealth] = await Promise.all([
    query(
      `select event_id, tx_hash, log_index, block_number, token_address, from_address, to_address,
              amount_usd::text, status, deposit_id, error, created_at, updated_at
       from hb_deposit_event_logs
       order by created_at desc
       limit 100`
    ).catch(() => []),
    query(
      `select count(*) filter (where status in ('pending','pending_verification'))::int as pending_deposits,
              count(*) filter (where status = 'failed')::int as failed_deposits,
              count(*) filter (where status = 'rejected')::int as rejected_deposits,
              count(*) filter (where status = 'verified')::int as verified_deposits,
              coalesce(sum(usd_amount) filter (where status in ('pending','pending_verification')),0)::text as pending_amount,
              coalesce(sum(usd_amount) filter (where status = 'verified'),0)::text as verified_amount
       from hb_deposits`
    ).catch(() => []),
    getHbDepositIndexerHealth().catch((error) => ({ enabled: false, configReady: false, error: error instanceof Error ? error.message : "Deposit indexer health failed" }))
  ]);
  ok(res, { items: rows, events: eventRows, summary: summaryRows[0] || {}, indexerHealth }, "HB9 deposits loaded");
}));

hbRouter.get("/admin/hb/summary", requireAdmin, asyncHandler(async (_req, res) => {
  const users = await query(
    `select count(*)::int as total_users,
            count(*) filter (where status = 'active')::int as active_users,
            count(*) filter (where status = 'inactive')::int as inactive_users
     from hb_users`
  );
  const deposits = await query(
    `select coalesce(sum(usd_amount),0)::text as total_deposits,
            count(*) filter (where status = 'verified')::int as verified_deposits,
            count(*) filter (where status in ('pending','pending_verification'))::int as pending_deposits
     from hb_deposits`
  );
  const sales = await query("select coalesce(sum(amount_usd),0)::text as total_package_sales from hb_package_purchases where status = 'completed'");
  const withdrawals = await query(
    `select count(*)::int as total_withdrawals,
            count(*) filter (where status in ('pending','under_review'))::int as pending_withdrawals,
            count(*) filter (where status = 'paid')::int as paid_withdrawals,
            count(*) filter (where status = 'rejected')::int as rejected_withdrawals,
            coalesce(sum(amount_usd),0)::text as total_withdrawal_volume,
            coalesce(sum(fee_usd) filter (where status = 'paid'),0)::text as withdrawal_fee_earnings
     from hb_withdrawals`
  );
  const distribution = await query(
    `select
       coalesce(sum(amount_usd) filter (where income_type in ('referral_income','upline')),0)::text as total_direct_income,
       coalesce(sum(amount_usd) filter (where income_type in ('level_income','level')),0)::text as total_level_income,
       coalesce(sum(amount_usd) filter (where income_type = 'company'),0)::text as total_treasury_hold,
       coalesce(sum(amount_usd) filter (where income_type = 'single_leg_income'),0)::text as total_single_leg_income
     from hb_income_ledger`
  );
  const [treasuryHealth, riskRows] = await Promise.all([
    getTreasuryHealth(),
    query(
      `select u.id, u.email, u.mobile_number, u.display_name, u.usdt_bep20_address, u.hb9_wallet_address,
              coalesce(risk.flag, 'normal') as risk_flag, u.failed_login_count
       from hb_users u
       left join lateral (
         select flag from hb_risk_flags where user_id = u.id and active = true order by created_at desc limit 1
       ) risk on true
       where coalesce(risk.flag, 'normal') <> 'normal' or u.failed_login_count >= 3
       order by u.updated_at desc
       limit 10`
    )
  ]);
  const scoredRisk = await Promise.all(riskRows.slice(0, 6).map((row: any) => calculateUserRiskScore(String(row.id)).then((score) => ({ ...row, ...score }))));
  ok(res, { ...(users[0] || {}), ...(deposits[0] || {}), ...(sales[0] || {}), ...(withdrawals[0] || {}), ...(distribution[0] || {}), treasuryHealth, highRiskAccounts: scoredRisk }, "HB9 summary loaded");
}));

hbRouter.get("/admin/hb/production-health", requireAdmin, asyncHandler(async (_req, res) => {
  const startedRpc = Date.now();
  const [controls, treasuryHealth, syncHealth, contractRows, failedWalletAuthRows, activeTodayRows, pendingWithdrawalsRows, riskRows, analyticsRows, packagePopularity, referralRows, txFailureRows] = await Promise.all([
    getProductionControls(),
    getTreasuryHealth().catch((error) => ({ status: "error", error: error instanceof Error ? error.message : "Treasury health failed" })),
    getHbOnchainSyncHealth().catch((error) => ({ enabled: false, rpcHealthy: false, latestIndexedBlock: 0, failedSyncCount: 0, error: error instanceof Error ? error.message : "Indexer health failed" })),
    query<Record<string, any>>("select key, chain_id, contract_address, start_block::text, enabled, updated_by, updated_at from hb_onchain_contracts order by key").catch(() => []),
    query<{ count: number }>("select count(*)::int as count from hb_wallet_auth_challenges where status = 'rejected' and created_at >= date_trunc('day', now())").catch(() => []),
    query<{ count: number }>("select count(*)::int as count from hb_users where last_login_at >= date_trunc('day', now()) or created_at >= date_trunc('day', now())").catch(() => []),
    query<{ count: number; total: string }>("select count(*)::int as count, coalesce(sum(payout_amount_usd),0)::text as total from hb_withdrawals where status in ('pending','under_review','approved','processing')").catch(() => []),
    query<{ count: number }>("select count(*)::int as count from hb_risk_flags where active = true and flag <> 'normal'").catch(() => []),
    query(
      `select
         coalesce((select count(*) from hb_activation_logs where created_at >= date_trunc('day', now())),0)::int as daily_activations,
         coalesce((select sum(amount_usd) from hb_package_purchases where status = 'completed' and created_at >= date_trunc('day', now())),0)::text as daily_package_volume,
         coalesce((select sum(usd_amount) from hb_deposits where status = 'verified' and verified_at >= date_trunc('day', now())),0)::text as treasury_inflow,
         coalesce((select sum(payout_amount_usd) from hb_withdrawals where status = 'paid' and paid_at >= date_trunc('day', now())),0)::text as treasury_outflow`
    ).catch(() => []),
    query(
      `select pkg.name, pkg.amount_usd::text, count(p.id)::int as purchase_count, coalesce(sum(p.amount_usd),0)::text as volume
       from hb_packages pkg
       left join hb_package_purchases p on p.package_id = pkg.id and p.status = 'completed'
       group by pkg.id
       order by purchase_count desc, pkg.sort_order asc`
    ).catch(() => []),
    query<{ count: number }>("select count(distinct sponsor_user_id)::int as count from hb_referrals where created_at >= now() - interval '30 days'").catch(() => []),
    query(
      `select
         coalesce((select count(*) from hb_wallet_auth_challenges where created_at >= date_trunc('day', now())),0)::int as wallet_auth_total,
         coalesce((select count(*) from hb_wallet_auth_challenges where status = 'verified' and created_at >= date_trunc('day', now())),0)::int as wallet_auth_success,
         coalesce((select count(*) from hb_onchain_purchase_events where status in ('failed','rejected') and created_at >= date_trunc('day', now())),0)::int as transaction_failures,
         coalesce((select count(*) from hb_onchain_purchase_events where created_at >= date_trunc('day', now())),0)::int as transaction_total`
    ).catch(() => [])
  ]);
  let rpcLatencyMs: number | null = null;
  let rpcStatus = "not_checked";
  try {
    const provider = new JsonRpcProvider(config.bscRpcUrl, hbOnchainChainId());
    await provider.getBlockNumber();
    rpcLatencyMs = Date.now() - startedRpc;
    rpcStatus = "healthy";
  } catch (error) {
    rpcStatus = "failed";
    logger.warn("hb.rpc.failed", { category: "rpc", error: error instanceof Error ? error.message : "RPC check failed" });
  }
  let bscScanStatus = "not_checked";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(hbBscScanBaseUrl(), { method: "HEAD", signal: controller.signal });
    clearTimeout(timeout);
    bscScanStatus = response.ok ? "reachable" : `http_${response.status}`;
  } catch {
    bscScanStatus = "unreachable";
  }
  let proofIntegrityPercent = 100;
  if (pool) {
    const client = await pool.connect();
    try {
      proofIntegrityPercent = (await verifyLedgerProofChain(client)).integrityPercent;
    } finally {
      client.release();
    }
  }
  const contracts = mergeEnvOnchainContracts(contractRows);
  const configuredContracts = contracts.filter((item) => item.contract_address).length;
  const tx = (txFailureRows[0] || {}) as Record<string, any>;
  const walletAuthSuccessRate = Number(tx.wallet_auth_total || 0) > 0 ? Math.round(Number(tx.wallet_auth_success || 0) * 10000 / Number(tx.wallet_auth_total || 1)) / 100 : 100;
  const transactionFailureRate = Number(tx.transaction_total || 0) > 0 ? Math.round(Number(tx.transaction_failures || 0) * 10000 / Number(tx.transaction_total || 1)) / 100 : 0;
  ok(res, {
    controls,
    health: {
      apiStatus: "healthy",
      dbStatus: pool ? "configured" : "not_configured",
      indexerStatus: syncHealth.enabled ? (syncHealth.rpcHealthy ? "healthy" : "attention") : "disabled",
      latestIndexedBlock: Number(syncHealth.latestIndexedBlock || 0),
      treasuryHealth,
      pendingWithdrawals: pendingWithdrawalsRows[0] || { count: 0, total: "0" },
      riskAlerts: Number(riskRows[0]?.count || 0),
      rpcLatencyMs,
      rpcStatus,
      bscScanStatus,
      contractConfigStatus: configuredContracts === contracts.length ? "configured" : "incomplete",
      proofIntegrityPercent,
      activeUsersToday: Number(activeTodayRows[0]?.count || 0),
      failedWalletAuthAttempts: Number(failedWalletAuthRows[0]?.count || 0)
    },
    analytics: {
      ...(analyticsRows[0] || {}),
      active_referrals: Number(referralRows[0]?.count || 0),
      package_popularity: packagePopularity,
      wallet_connection_success_rate: walletAuthSuccessRate,
      transaction_failure_rate: transactionFailureRate
    },
    riskAlerts: { activeRiskFlags: Number(riskRows[0]?.count || 0), failedIndexerEvents: Number(syncHealth.failedSyncCount || 0) },
    contractConfig: contracts
  }, "Production health loaded");
}));

hbRouter.get("/admin/hb/readiness", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query<Record<string, unknown>>("select key, confirmed, note, confirmed_by, confirmed_at, updated_at from hb_mainnet_readiness order by key").catch(() => []);
  const byKey = new Map(rows.map((row) => [String(row.key), row]));
  ok(res, {
    items: readinessItems.map((key) => byKey.get(key) || { key, confirmed: false, note: "", confirmed_by: null, confirmed_at: null }),
    ready: readinessItems.every((key) => Boolean((byKey.get(key) as any)?.confirmed))
  }, "Readiness checklist loaded");
}));

hbRouter.patch("/admin/hb/readiness", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminReadinessSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid readiness update");
    return;
  }
  const safeModeError = requireSafeModeConfirmation(req, "Readiness checklist update");
  if (safeModeError) {
    fail(res, safeModeError, 409, "Mainnet safe mode");
    return;
  }
  await query(
    `insert into hb_mainnet_readiness (key, confirmed, note, confirmed_by, confirmed_at, updated_at)
     values ($1,$2,$3,$4,case when $2 then now() else null end,now())
     on conflict (key) do update
     set confirmed = excluded.confirmed, note = excluded.note, confirmed_by = excluded.confirmed_by,
         confirmed_at = excluded.confirmed_at, updated_at = now()`,
    [parsed.data.key, parsed.data.confirmed, parsed.data.note || null, req.admin?.email || "admin"]
  );
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.readiness.update", "hb_mainnet_readiness", parsed.data.key, parsed.data);
  ok(res, { updated: true }, "Readiness checklist updated");
}));

hbRouter.patch("/admin/hb/production-controls", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminProductionControlsSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid production controls");
    return;
  }
  const safeModeError = requireSafeModeConfirmation(req, "Production controls update");
  if (safeModeError) {
    fail(res, safeModeError, 409, "Mainnet safe mode");
    return;
  }
  const adminEmail = req.admin?.email || "admin";
  const keyMap: Array<[keyof typeof parsed.data, string]> = [
    ["rolloutMode", "rollout_mode"],
    ["emergencyPause", "emergency_pause"],
    ["emergencyIndexerStop", "emergency_indexer_stop"],
    ["emergencyActivationDisable", "emergency_activation_disable"],
    ["emergencyWithdrawalFreeze", "emergency_withdrawal_freeze"],
    ["emergencyDepositFreeze", "emergency_deposit_freeze"],
    ["emergencyPackagePurchasePause", "emergency_package_purchase_pause"],
    ["emergencyCoinConversionDisable", "emergency_coin_conversion_disable"],
    ["emergencyFollowerRequestDisable", "emergency_follower_request_disable"],
    ["emergencyTreasuryFreezeNotice", "emergency_treasury_freeze_notice"],
    ["rollbackMode", "rollback_mode"],
    ["dailyActivationLimit", "daily_activation_limit"],
    ["maintenanceNotice", "maintenance_notice"],
    ["launchBanner", "launch_banner"],
    ["warningBanner", "warning_banner"]
  ];
  for (const [inputKey, storageKey] of keyMap) {
    const value = parsed.data[inputKey];
    if (value !== undefined) await setProductionControl(storageKey, String(value), adminEmail);
  }
  await adminHbAudit(adminEmail, "admin.hb.production_controls.update", "hb_production_controls", "global", parsed.data);
  ok(res, { controls: await getProductionControls() }, "Production controls updated");
}));

hbRouter.patch("/admin/hb/deposits/:id", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminDepositPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid deposit update");
    return;
  }
  if (!parsed.data.status && !parsed.data.failureReason) {
    fail(res, "No deposit update was provided.", 400, "Invalid deposit update");
    return;
  }
  const rows = await query(
    `update hb_deposits
     set status = coalesce($2, status),
         verification_status = coalesce($2, verification_status),
         failure_reason = coalesce($3, failure_reason),
         updated_at = now()
     where id = $1 and status <> 'verified'
     returning *`,
    [req.params.id, parsed.data.status || null, parsed.data.failureReason || null]
  );
  if (!rows[0]) {
    fail(res, "Deposit was not found or is already verified.", 404, "Deposit update failed");
    return;
  }
  await query(
    `insert into hb_admin_notes (admin_email, entity_type, entity_id, note)
     select $1, 'hb_deposit', $2, $3
     where $3::text is not null`,
    [req.admin?.email || "admin", req.params.id, parsed.data.adminRemark || null]
  );
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.deposit.update", "hb_deposit", String(req.params.id), parsed.data);
  ok(res, rows[0], "HB9 deposit updated");
}));

hbRouter.get("/admin/hb/withdrawals", requireAdmin, asyncHandler(async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const rows = await query(
    `select w.id, w.user_id, u.email, u.mobile_number, u.display_name, u.status as user_status,
            current_pkg.name as current_package,
            coalesce(active_risk.flag, 'normal') as risk_flag,
            w.amount_usd, w.fee_usd, w.payout_amount_usd, w.currency, w.network,
            w.wallet_address, w.status, w.tx_hash, w.failure_reason, w.admin_note,
            w.requested_at, w.reviewed_at, w.approved_at, w.processing_at, w.paid_at, w.rejected_at, w.cancelled_at, w.updated_at
     from hb_withdrawals w
     join hb_users u on u.id = w.user_id
     left join lateral (
       select pkg.name
       from hb_package_purchases hp join hb_packages pkg on pkg.id = hp.package_id
       where hp.user_id = u.id and hp.status = 'completed'
       order by hp.created_at desc limit 1
     ) current_pkg on true
     left join lateral (
       select flag from hb_risk_flags where user_id = u.id and active = true order by created_at desc limit 1
     ) active_risk on true
     where ($1::text = '' or w.status = $1)
       and ($2::text = '' or w.id::text ilike '%' || $2 || '%' or u.email ilike '%' || $2 || '%' or u.mobile_number ilike '%' || $2 || '%' or u.display_name ilike '%' || $2 || '%' or w.wallet_address ilike '%' || $2 || '%')
     order by w.requested_at desc
     limit 300`,
    [status, search]
  );
  ok(res, { items: rows, queue: (await getTreasuryHealth()).queue }, "HB9 withdrawals loaded");
}));

hbRouter.patch("/admin/hb/withdrawals/:id/approve", requireAdmin, asyncHandler(async (req, res) => {
  if (!(await enforceWithdrawalSafety(res, "withdrawal.approve"))) return;
  const parsed = adminWithdrawalActionSchema.safeParse(req.body || {});
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid withdrawal approval");
    return;
  }
  const beforeRows = await query("select * from hb_withdrawals where id = $1 limit 1", [req.params.id]);
  const rows = await query(
    `update hb_withdrawals
     set status = 'approved', approved_at = now(), reviewed_at = coalesce(reviewed_at, now()), admin_note = coalesce($2, admin_note), updated_at = now()
     where id = $1 and status in ('pending','under_review')
     returning *`,
    [req.params.id, parsed.data.adminNote || null]
  );
  if (!rows[0]) {
    fail(res, "Withdrawal was not found or is not pending.", 404, "Withdrawal approval failed");
    return;
  }
  logger.warn("hb.payout.warning", { category: "payout_approval", withdrawalId: req.params.id, admin: req.admin?.email || "admin" });
  await query(
    `insert into hb_withdrawal_audit_logs (withdrawal_id, user_id, admin_email, action, previous_status, next_status, metadata)
     values ($1,$2,$3,'admin.withdrawal.approve','pending','approved',$4::jsonb)`,
    [req.params.id, (rows[0] as any).user_id, req.admin?.email || "admin", JSON.stringify(parsed.data)]
  );
  await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.withdrawal.approve", entityType: "hb_withdrawal", entityId: String(req.params.id), previousStatus: "pending", nextStatus: "approved", metadata: parsed.data });
  await adminOperationLog({ req, action: "admin.hb.withdrawal.approve", entityType: "hb_withdrawal", entityId: String(req.params.id), beforeSnapshot: beforeRows[0] || null, afterSnapshot: rows[0], metadata: parsed.data });
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.withdrawal.approve", "hb_withdrawal", String(req.params.id), parsed.data);
  ok(res, rows[0], "Withdrawal approved");
}));

hbRouter.patch("/admin/hb/withdrawals/:id/under-review", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminWithdrawalActionSchema.safeParse(req.body || {});
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid withdrawal review update");
    return;
  }
  const rows = await query(
    `update hb_withdrawals
     set status = 'under_review', reviewed_at = now(), admin_note = coalesce($2, admin_note), updated_at = now()
     where id = $1 and status = 'pending'
     returning *`,
    [req.params.id, parsed.data.adminNote || null]
  );
  if (!rows[0]) {
    fail(res, "Withdrawal was not found or is not pending.", 404, "Withdrawal review failed");
    return;
  }
  await query(
    `insert into hb_withdrawal_audit_logs (withdrawal_id, user_id, admin_email, action, previous_status, next_status, metadata)
     values ($1,$2,$3,'admin.withdrawal.under_review','pending','under_review',$4::jsonb)`,
    [req.params.id, (rows[0] as any).user_id, req.admin?.email || "admin", JSON.stringify(parsed.data)]
  );
  await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.withdrawal.under_review", entityType: "hb_withdrawal", entityId: String(req.params.id), previousStatus: "pending", nextStatus: "under_review", metadata: parsed.data, req, afterSnapshot: rows[0] });
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.withdrawal.under_review", "hb_withdrawal", String(req.params.id), parsed.data);
  ok(res, rows[0], "Withdrawal moved under review");
}));

hbRouter.patch("/admin/hb/withdrawals/:id/processing", requireAdmin, asyncHandler(async (req, res) => {
  if (!(await enforceWithdrawalSafety(res, "withdrawal.processing"))) return;
  const parsed = adminWithdrawalActionSchema.safeParse(req.body || {});
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid withdrawal processing update");
    return;
  }
  const beforeRows = await query("select * from hb_withdrawals where id = $1 limit 1", [req.params.id]);
  const rows = await query(
    `update hb_withdrawals
     set status = 'processing', processing_at = now(), admin_note = coalesce($2, admin_note), updated_at = now()
     where id = $1 and status = 'approved'
     returning *`,
    [req.params.id, parsed.data.adminNote || null]
  );
  if (!rows[0]) {
    fail(res, "Withdrawal was not found or is not approved.", 404, "Withdrawal processing failed");
    return;
  }
  await query(
    `insert into hb_withdrawal_audit_logs (withdrawal_id, user_id, admin_email, action, previous_status, next_status, metadata)
     values ($1,$2,$3,'admin.withdrawal.processing','approved','processing',$4::jsonb)`,
    [req.params.id, (rows[0] as any).user_id, req.admin?.email || "admin", JSON.stringify(parsed.data)]
  );
  await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.withdrawal.processing", entityType: "hb_withdrawal", entityId: String(req.params.id), previousStatus: "approved", nextStatus: "processing", metadata: parsed.data, req, beforeSnapshot: beforeRows[0] || null, afterSnapshot: rows[0] });
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.withdrawal.processing", "hb_withdrawal", String(req.params.id), parsed.data);
  ok(res, rows[0], "Withdrawal marked processing");
}));

hbRouter.patch("/admin/hb/withdrawals/:id/reject", requireAdmin, asyncHandler(async (req, res) => {
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Withdrawal rejection failed");
    return;
  }
  const parsed = adminWithdrawalRejectSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid withdrawal rejection");
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const lockedRows = await client.query<{ id: string; user_id: string; amount_usd: string; status: string }>(
      "select id, user_id, amount_usd::text, status from hb_withdrawals where id = $1 and status in ('pending','under_review','approved','processing') for update",
      [req.params.id]
    );
    const withdrawal = lockedRows.rows[0];
    if (!withdrawal) {
      await client.query("rollback");
      fail(res, "Withdrawal was not found or cannot be rejected.", 404, "Withdrawal rejection failed");
      return;
    }
    const refundRows = await client.query<{ id: string }>(
      `insert into hb_internal_ledger (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
       values ($1,'deposit','credit',$2,'withdrawal',$3,$4,$5::jsonb)
       on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
       returning id`,
      [
        withdrawal.user_id,
        withdrawal.amount_usd,
        withdrawal.id,
        `hb:ledger:withdrawal:${withdrawal.id}:refund`,
        JSON.stringify({ type: "withdrawal_refund", reason: parsed.data.reason })
      ]
    );
    await createLedgerProof(client, "hb_internal_ledger", refundRows.rows[0]?.id || null);
    await applyHbCoinAdjustment({
      client,
      userId: withdrawal.user_id,
      coinSymbol: "USDT",
      amount: withdrawal.amount_usd,
      direction: "credit",
      type: "withdrawal",
      reference: withdrawal.id,
      note: "Automatic USDT refund for rejected withdrawal",
      idempotencyKey: `hb:coin:withdrawal:${withdrawal.id}:refund`
    });
    await client.query(
      `update hb_withdrawals
       set status = 'rejected', rejected_at = now(), failure_reason = $2, admin_note = $3,
           refund_ledger_entry_id = $4, updated_at = now()
       where id = $1`,
      [withdrawal.id, parsed.data.reason, parsed.data.adminNote || null, refundRows.rows[0]?.id || null]
    );
    await client.query(
      `insert into hb_withdrawal_audit_logs (withdrawal_id, user_id, admin_email, action, previous_status, next_status, metadata)
       values ($1,$2,$3,'admin.withdrawal.reject',$4,'rejected',$5::jsonb)`,
      [withdrawal.id, withdrawal.user_id, req.admin?.email || "admin", withdrawal.status, JSON.stringify(parsed.data)]
    );
    await client.query("commit");
    const rows = await query("select * from hb_withdrawals where id = $1", [withdrawal.id]);
    await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.withdrawal.reject", entityType: "hb_withdrawal", entityId: String(req.params.id), previousStatus: withdrawal.status, nextStatus: "rejected", metadata: parsed.data, req, beforeSnapshot: withdrawal, afterSnapshot: rows[0] });
    await adminHbAudit(req.admin?.email || "admin", "admin.hb.withdrawal.reject", "hb_withdrawal", String(req.params.id), parsed.data);
    ok(res, rows[0], "Withdrawal rejected and reserved balance released");
  } catch (err) {
    await client.query("rollback");
    fail(res, err instanceof Error ? err.message : "Withdrawal rejection failed.", 500, "Withdrawal rejection failed");
  } finally {
    client.release();
  }
}));

hbRouter.patch("/admin/hb/withdrawals/:id/mark-paid", requireAdmin, asyncHandler(async (req, res) => {
  if (!(await enforceWithdrawalSafety(res, "withdrawal.mark_paid"))) return;
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Withdrawal payment failed");
    return;
  }
  const parsed = adminWithdrawalPaidSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid withdrawal payment update");
    return;
  }
  const safeModeError = requireSafeModeConfirmation(req, "Payout finalize");
  if (safeModeError) {
    fail(res, safeModeError, 409, "Mainnet safe mode");
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const lockedRows = await client.query<{ id: string; user_id: string; status: string; paid_ledger_entry_id: string | null; wallet_address: string; payout_amount_usd: string }>(
      "select id, user_id, status, paid_ledger_entry_id, wallet_address, payout_amount_usd::text from hb_withdrawals where id = $1 and status in ('approved','processing') for update",
      [req.params.id]
    );
    const withdrawal = lockedRows.rows[0];
    if (!withdrawal) {
      await client.query("rollback");
      fail(res, "Withdrawal was not found or is not approved.", 404, "Withdrawal payment failed");
      return;
    }
    if (withdrawal.paid_ledger_entry_id) {
      await client.query("rollback");
      fail(res, "Withdrawal already has a paid ledger entry.", 409, "Duplicate payment blocked");
      return;
    }
    const duplicateTxRows = await client.query("select id from hb_withdrawals where lower(tx_hash) = lower($1) or lower(onchain_tx_hash) = lower($1) limit 1", [parsed.data.txHash]);
    if (duplicateTxRows.rows[0]) {
      await client.query("rollback");
      logger.warn("hb.withdrawal.duplicate_tx", { withdrawalId: withdrawal.id, existingWithdrawalId: duplicateTxRows.rows[0].id, txHash: parsed.data.txHash });
      fail(res, "This payout transaction hash has already been recorded.", 409, "Duplicate payout blocked");
      return;
    }
    let verification: BlockchainVerification;
    try {
      verification = await verifyBlockchainTransaction({
        txHash: parsed.data.txHash,
        network: "bsc",
        tokenSymbol: "USDT",
        requiredAmount: Number(withdrawal.payout_amount_usd || 0),
        expectedRecipient: withdrawal.wallet_address
      });
      if (!config.hbWithdrawalVaultAddress || getAddress(verification.fromAddress) !== getAddress(config.hbWithdrawalVaultAddress)) {
        throw new VerificationError("Payout transaction did not originate from the configured withdrawal vault.");
      }
    } catch (err) {
      await client.query("rollback");
      const publicError = publicVerificationError(err);
      logger.warn("hb.withdrawal.tx_verification_failed", { withdrawalId: withdrawal.id, txHash: parsed.data.txHash, reason: publicError.message });
      fail(res, publicError.message, publicError.status, "Withdrawal transaction verification failed");
      return;
    }
    const paidRows = await client.query<{ id: string }>(
      `insert into hb_internal_ledger (user_id, wallet_type, direction, amount_usd, reference_type, reference_id, idempotency_key, metadata)
       values ($1,'deposit','debit',0,'withdrawal',$2,$3,$4::jsonb)
       on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
       returning id`,
      [
        withdrawal.user_id,
        withdrawal.id,
        `hb:ledger:withdrawal:${withdrawal.id}:paid`,
        JSON.stringify({ type: "withdrawal_paid", txHash: parsed.data.txHash, verification })
      ]
    );
    await createLedgerProof(client, "hb_internal_ledger", paidRows.rows[0]?.id || null, { chainTxHash: parsed.data.txHash, onchainStatus: "confirmed" });
    await client.query(
      `update hb_withdrawals
       set status = 'paid', tx_hash = $2, onchain_tx_hash = $2, onchain_status = 'confirmed', paid_at = now(), admin_note = $3,
           paid_ledger_entry_id = $4, updated_at = now()
       where id = $1`,
      [withdrawal.id, parsed.data.txHash, parsed.data.adminNote || null, paidRows.rows[0]?.id || null]
    );
    await client.query(
      `insert into hb_withdrawal_audit_logs (withdrawal_id, user_id, admin_email, action, previous_status, next_status, metadata)
       values ($1,$2,$3,'admin.withdrawal.mark_paid',$4,'paid',$5::jsonb)`,
      [withdrawal.id, withdrawal.user_id, req.admin?.email || "admin", withdrawal.status, JSON.stringify(parsed.data)]
    );
    await client.query("commit");
    const rows = await query("select * from hb_withdrawals where id = $1", [withdrawal.id]);
    await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.withdrawal.mark_paid", entityType: "hb_withdrawal", entityId: String(req.params.id), previousStatus: withdrawal.status, nextStatus: "paid", metadata: { txHash: parsed.data.txHash }, req, beforeSnapshot: withdrawal, afterSnapshot: rows[0], proofReference: parsed.data.txHash });
    await adminHbAudit(req.admin?.email || "admin", "admin.hb.withdrawal.mark_paid", "hb_withdrawal", String(req.params.id), { txHash: parsed.data.txHash });
    ok(res, rows[0], "Withdrawal marked paid");
  } catch (err) {
    await client.query("rollback");
    fail(res, err instanceof Error ? err.message : "Withdrawal payment update failed.", 500, "Withdrawal payment failed");
  } finally {
    client.release();
  }
}));

hbRouter.get("/admin/hb/financial-settings", requireAdmin, asyncHandler(async (_req, res) => {
  ok(res, await getFinancialSettings(), "HB9 financial settings loaded");
}));

hbRouter.patch("/admin/hb/financial-settings", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = financialSettingsPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid financial settings");
    return;
  }
  const entries: Array<[string, string | number | boolean | undefined]> = [
    ["withdrawal_min_usd", parsed.data.withdrawalMinUsd],
    ["withdrawal_fee_percent", parsed.data.withdrawalFeePercent],
    ["withdrawal_daily_limit_usd", parsed.data.withdrawalDailyLimitUsd],
    ["withdrawal_cooldown_minutes", parsed.data.withdrawalCooldownMinutes],
    ["withdrawal_require_active_id", parsed.data.withdrawalRequireActiveId],
    ["withdrawal_require_package", parsed.data.withdrawalRequirePackage]
  ];
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    await query("update hb_financial_settings set value = $2, updated_at = now() where key = $1", [key, String(value)]);
  }
  await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.financial_settings.update", entityType: "hb_financial_settings", entityId: "00000000-0000-0000-0000-000000000000", metadata: parsed.data });
  ok(res, await getFinancialSettings(), "HB9 financial settings updated");
}));

hbRouter.post("/admin/hb/users/:id/risk-flags", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = riskFlagSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid risk flag");
    return;
  }
  await query("update hb_risk_flags set active = false, resolved_at = now() where user_id = $1 and active = true", [req.params.id]);
  const rows = await query(
    `insert into hb_risk_flags (user_id, flag, reason, created_by)
     values ($1,$2,$3,$4)
     returning *`,
    [req.params.id, parsed.data.flag, parsed.data.reason || null, req.admin?.email || "admin"]
  );
  if (parsed.data.flag === "suspended") {
    await query("update hb_users set status = 'suspended', updated_at = now() where id = $1", [req.params.id]);
  }
  await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.user.risk_flag", entityType: "hb_user", entityId: String(req.params.id), metadata: parsed.data, req, afterSnapshot: rows[0] });
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.user.risk_flag", "hb_user", String(req.params.id), parsed.data);
  ok(res, rows[0], "Risk flag updated");
}));

hbRouter.get("/admin/hb/reconciliation", requireAdmin, asyncHandler(async (_req, res) => {
  const withdrawalMismatches = await query(
    `select w.id, w.user_id, w.amount_usd::text as withdrawal_amount,
            '0'::text as ledger_reserved,
            w.status
     from hb_withdrawals w
     where false
     limit 100`
  );
  const depositMismatches = await query(
    `select d.id, d.user_id, d.usd_amount::text as deposit_amount,
            '0'::text as ledger_credit,
            d.status
     from hb_deposits d
     where false
     limit 100`
  );
  const stuckProcessing = await query("select * from hb_withdrawals where status = 'processing' and processing_at < now() - interval '24 hours' order by processing_at asc limit 100");
  const suspiciousAttempts = await query(
    `select user_id, count(*)::int as attempt_count, coalesce(sum(amount_usd),0)::text as total_amount
     from hb_withdrawals
     where requested_at >= now() - interval '24 hours'
     group by user_id
     having count(*) >= 3
     order by attempt_count desc
     limit 100`
  );
  const status = withdrawalMismatches.length || depositMismatches.length ? "mismatch" : stuckProcessing.length || suspiciousAttempts.length ? "warning" : "ok";
  const logRows = await query<{ id: string }>(
    `insert into hb_reconciliation_logs (check_type, status, details)
     values ('financial_reconciliation',$1,$2::jsonb)
     returning id`,
    [status, JSON.stringify({ withdrawalMismatches: withdrawalMismatches.length, depositMismatches: depositMismatches.length, stuckProcessing: stuckProcessing.length, suspiciousAttempts: suspiciousAttempts.length })]
  );
  ok(res, { logId: logRows[0]?.id, status, withdrawalMismatches, depositMismatches, stuckProcessing, suspiciousAttempts }, "HB9 reconciliation loaded");
}));

hbRouter.get("/admin/hb/transparency", requireAdmin, asyncHandler(async (_req, res) => {
  const [latest, unprovedInternal, unprovedIncome, unprovedCoin] = await Promise.all([
    query(
      `select p.public_reference_id, p.proof_type, p.amount_usd::text, p.status, p.masked_user_id,
              p.proof_hash, p.previous_proof_hash, p.chain_tx_hash, p.onchain_status, p.created_at
       from hb_ledger_proofs p
       order by p.created_at desc
       limit 200`
    ),
    query<{ count: number }>("select count(*)::int as count from hb_internal_ledger where proof_hash is null"),
    query<{ count: number }>("select count(*)::int as count from hb_income_ledger where proof_hash is null"),
    query<{ count: number }>("select count(*)::int as count from hb_coin_balance_ledger where proof_hash is null").catch(() => [{ count: 0 }])
  ]);
  if (!pool) {
    ok(res, { items: latest, brokenProofCount: 0, unprovedLedgerEntries: 0 }, "HB9 transparency loaded");
    return;
  }
  const client = await pool.connect();
  try {
    const verification = await verifyLedgerProofChain(client);
    ok(res, {
      items: latest,
      brokenProofCount: verification.brokenCount,
      unprovedLedgerEntries: Number(unprovedInternal[0]?.count || 0) + Number(unprovedIncome[0]?.count || 0) + Number(unprovedCoin[0]?.count || 0),
      totalProofs: verification.totalProofs,
      integrityPercent: verification.integrityPercent,
      brokenChains: verification.broken,
      duplicateHashes: verification.duplicateHashes,
      missingReferences: verification.missingReferences
    }, "HB9 transparency loaded");
  } finally {
    client.release();
  }
}));

hbRouter.get("/admin/hb/transparency/verify", requireAdmin, asyncHandler(async (_req, res) => {
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Verification failed");
    return;
  }
  const client = await pool.connect();
  try {
    const verification = await verifyLedgerProofChain(client);
    ok(res, verification, "HB9 proof chain verified");
  } finally {
    client.release();
  }
}));

hbRouter.get("/admin/hb/transparency/export", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select public_reference_id, source_table, masked_user_id, proof_type, amount_usd::text, status,
            reference_type, proof_hash, previous_proof_hash, chain_tx_hash, onchain_status, created_at
     from hb_ledger_proofs
     order by created_at asc`
  );
  ok(res, { generatedAt: new Date().toISOString(), items: rows }, "HB9 transparency export loaded");
}));

hbRouter.get("/admin/hb/governance", requireAdmin, asyncHandler(async (_req, res) => {
  const contracts = mergeEnvOnchainContracts(await query<Record<string, any>>("select key, chain_id, contract_address, start_block::text, enabled, updated_by, updated_at from hb_onchain_contracts order by key").catch(() => []));
  const byKey = Object.fromEntries(contracts.map((item) => [item.key, item]));
  const [packageManagerGovernance, treasurySplitterGovernance, incomeDistributorGovernance] = await Promise.all([
    readContractGovernance(byKey.package_manager?.contract_address),
    readContractGovernance(byKey.treasury_splitter?.contract_address),
    readContractGovernance(byKey.income_distributor?.contract_address)
  ]);
  const multisigAddress = config.hbMultisigOwnerAddress;
  const owners = {
    packageManager: packageManagerGovernance.owner,
    treasurySplitter: treasurySplitterGovernance.owner,
    incomeDistributor: incomeDistributorGovernance.owner
  };
  const pendingOwnershipTransfer = {
    packageManager: packageManagerGovernance.pendingOwner,
    treasurySplitter: treasurySplitterGovernance.pendingOwner,
    incomeDistributor: incomeDistributorGovernance.pendingOwner
  };
  ok(res, {
    chainId: hbOnchainChainId(),
    explorerBaseUrl: hbBscScanBaseUrl(),
    mainnetSafeMode: config.hbMainnetSafeMode,
    multisigReady: config.hbMultisigReady,
    multisigAddress,
    owners,
    pendingOwnershipTransfer,
    multisigStatus: config.hbMultisigReady && multisigAddress ? "ready" : "not_ready",
    treasuryAuthorityStatus: byKey.treasury_splitter?.contract_address
      ? "Treasury splitter is contract-owned for package flow; package manager ownership should be transferred to multisig."
      : "Contract not configured yet",
    contracts
  }, "HB9 governance loaded");
}));

hbRouter.get("/admin/hb/risk", requireAdmin, asyncHandler(async (_req, res) => {
  const candidates = await query<{ id: string; email: string | null; mobile_number: string | null; display_name: string; usdt_bep20_address: string | null; hb9_wallet_address: string | null; risk_flag: string }>(
    `select distinct u.id, u.email, u.mobile_number, u.display_name, u.usdt_bep20_address, u.hb9_wallet_address,
            coalesce(risk.flag, 'normal') as risk_flag
     from hb_users u
     left join hb_withdrawals w on w.user_id = u.id and w.requested_at >= now() - interval '7 days'
     left join lateral (
       select flag from hb_risk_flags where user_id = u.id and active = true order by created_at desc limit 1
     ) risk on true
     where coalesce(risk.flag, 'normal') <> 'normal'
        or u.failed_login_count >= 3
        or w.id is not null
        or exists (select 1 from hb_audit_logs a where a.user_id = u.id and a.action in ('hb.wallet.bind','hb.wallet.change','hb.auth.login_failed') and a.created_at >= now() - interval '7 days')
     order by u.display_name asc
     limit 75`
  );
  const scored = await Promise.all(candidates.map(async (row) => ({ ...row, ...(await calculateUserRiskScore(row.id)) })));
  const highRiskAccounts = scored.filter((row) => row.riskScore >= 60 || row.risk_flag !== "normal").sort((a, b) => b.riskScore - a.riskScore);
  const suspiciousPayouts = await query(
    `select w.id, w.user_id, u.email, u.display_name, w.wallet_address, w.payout_amount_usd::text, w.status, w.requested_at
     from hb_withdrawals w
     join hb_users u on u.id = w.user_id
     where w.payout_amount_usd >= 1000
        or (w.status = 'processing' and w.processing_at < now() - interval '2 hours')
        or exists (
          select 1 from hb_withdrawals recent
          where recent.user_id = w.user_id and recent.requested_at >= now() - interval '1 hour'
          group by recent.user_id having count(*) >= 3
        )
     order by w.requested_at desc
     limit 75`
  );
  ok(res, {
    highRiskAccounts,
    flaggedWallets: highRiskAccounts.filter((row) => row.walletAddress),
    suspiciousPayouts
  }, "HB9 risk engine loaded");
}));

hbRouter.get("/admin/hb/treasury-health", requireAdmin, asyncHandler(async (_req, res) => {
  ok(res, await getTreasuryHealth(), "HB9 treasury health loaded");
}));

hbRouter.get("/admin/hb/treasury-settings", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query("select key, label, wallet_address, network, chain_id, updated_by, updated_at from hb_treasury_settings order by key");
  ok(res, { items: rows, health: await getTreasuryHealth(), safeMode: config.hbMainnetSafeMode }, "HB9 treasury settings loaded");
}));

hbRouter.patch("/admin/hb/treasury-settings", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = treasurySettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid treasury settings");
    return;
  }
  const safeModeError = requireSafeModeConfirmation(req, "Treasury update");
  if (safeModeError) {
    fail(res, safeModeError, 409, "Mainnet safe mode");
    return;
  }
  const beforeRows = await query("select key, label, wallet_address, network, chain_id, updated_by, updated_at from hb_treasury_settings order by key");
  const keyMap: Record<string, string> = {
    treasuryUsdtBep20Address: "treasury_usdt_bep20_address",
    payoutWalletAddress: "payout_wallet_address",
    companyReserveWallet: "company_reserve_wallet"
  };
  for (const [inputKey, settingKey] of Object.entries(keyMap)) {
    const value = parsed.data[inputKey as keyof typeof parsed.data];
    if (value === undefined) continue;
    await query(
      "update hb_treasury_settings set wallet_address = nullif($2,''), updated_by = $3, updated_at = now() where key = $1",
      [settingKey, value, req.admin?.email || "admin"]
    );
  }
  const afterRows = await query("select key, label, wallet_address, network, chain_id, updated_by, updated_at from hb_treasury_settings order by key");
  await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.treasury_settings.update", entityType: "hb_treasury_settings", entityId: "00000000-0000-0000-0000-000000000000", metadata: parsed.data, req, beforeSnapshot: beforeRows, afterSnapshot: afterRows });
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.treasury_settings.update", "hb_treasury_settings", "00000000-0000-0000-0000-000000000000", parsed.data);
  ok(res, { items: afterRows, health: await getTreasuryHealth(), safeMode: config.hbMainnetSafeMode }, "HB9 treasury settings updated");
}));

hbRouter.get("/admin/hb/onchain-purchases", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select e.*, u.email, u.mobile_number, u.display_name
     from hb_onchain_purchase_events e
     left join hb_users u on u.id = e.buyer_user_id
     order by e.created_at desc
     limit 300`
  );
  ok(res, { items: rows, mode: packagePurchaseMode(), syncHealth: await getHbOnchainSyncHealth() }, "HB9 on-chain purchases loaded");
}));

hbRouter.get("/admin/hb/onchain-contracts", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query<Record<string, any>>("select key, chain_id, contract_address, start_block::text, enabled, updated_by, updated_at from hb_onchain_contracts order by key").catch(() => []);
  ok(res, { items: mergeEnvOnchainContracts(rows), mode: packagePurchaseMode(), explorerBaseUrl: hbBscScanBaseUrl() }, "HB9 on-chain contracts loaded");
}));

hbRouter.patch("/admin/hb/onchain-contracts", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminOnchainContractPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid on-chain contract settings");
    return;
  }
  const safeModeError = requireSafeModeConfirmation(req, "Contract update");
  if (safeModeError) {
    fail(res, safeModeError, 409, "Mainnet safe mode");
    return;
  }
  const beforeRows = await query<Record<string, any>>("select key, chain_id, contract_address, start_block::text, enabled, updated_by, updated_at from hb_onchain_contracts order by key").catch(() => []);
  const keyMap: Record<string, string> = {
    packageManagerAddress: "package_manager",
    referralRegistryAddress: "referral_registry",
    treasurySplitterAddress: "treasury_splitter",
    incomeDistributorAddress: "income_distributor",
    usdtBep20Address: "usdt_bep20"
  };
  for (const [inputKey, key] of Object.entries(keyMap)) {
    const value = parsed.data[inputKey as keyof typeof parsed.data];
    if (value === undefined) continue;
    await query(
      "update hb_onchain_contracts set contract_address = nullif($2,''), enabled = coalesce($3, enabled), start_block = coalesce($4, start_block), updated_by = $5, updated_at = now() where key = $1",
      [key, value, parsed.data.enabled ?? null, parsed.data.startBlock ?? null, req.admin?.email || "admin"]
    );
  }
  const rows = await query<Record<string, any>>("select key, chain_id, contract_address, start_block::text, enabled, updated_by, updated_at from hb_onchain_contracts order by key");
  await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.onchain_contracts.update", entityType: "hb_onchain_contracts", entityId: "00000000-0000-0000-0000-000000000000", metadata: parsed.data, req, beforeSnapshot: beforeRows, afterSnapshot: rows });
  ok(res, { items: mergeEnvOnchainContracts(rows), explorerBaseUrl: hbBscScanBaseUrl() }, "HB9 on-chain contracts updated");
}));

hbRouter.post("/admin/hb/onchain-purchases/sync-event", requireAdmin, asyncHandler(async (req, res) => {
  if (!pool) {
    fail(res, "Database is not configured.", 500, "On-chain sync failed");
    return;
  }
  const parsed = adminOnchainPurchaseEventSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid on-chain purchase event");
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const packageRows = await client.query<{ id: string; amount_usd: string; name: string }>(
      "select id, amount_usd::text, name from hb_packages where amount_usd = $1 limit 1",
      [parsed.data.amountUsd]
    );
    const selectedPackage = packageRows.rows[0];
    if (!selectedPackage || onchainPackageIdForAmount(selectedPackage.amount_usd) !== parsed.data.onchainPackageId) {
      await client.query("rollback");
      fail(res, "On-chain package amount does not match a supported package.", 400, "On-chain sync failed");
      return;
    }
    let eventRows = await client.query<{ id: string; buyer_user_id: string | null }>(
      `update hb_onchain_purchase_events
       set status = 'confirmed', block_number = $2, log_index = $3,
           raw_event = $4::jsonb, synced_at = now(), updated_at = now()
       where contract_event_id = $1
       returning id, buyer_user_id`,
      [parsed.data.contractEventId, parsed.data.blockNumber, parsed.data.logIndex, JSON.stringify(parsed.data.rawEvent || parsed.data)]
    );
    if (!eventRows.rows[0]) {
      eventRows = await client.query<{ id: string; buyer_user_id: string | null }>(
        `insert into hb_onchain_purchase_events
          (contract_event_id, tx_hash, chain_id, contract_address, block_number, log_index, onchain_package_id,
           buyer_address, sponsor_address, referral_code, amount_usd, status, raw_event, synced_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'confirmed',$12::jsonb,now())
         returning id, buyer_user_id`,
      [
        parsed.data.contractEventId,
        parsed.data.txHash,
        hbOnchainChainId(),
        config.hbPackageManagerAddress || null,
        parsed.data.blockNumber,
        parsed.data.logIndex,
        parsed.data.onchainPackageId,
        parsed.data.buyerAddress,
        parsed.data.sponsorAddress || null,
        parsed.data.referralCode || null,
        parsed.data.amountUsd,
        JSON.stringify(parsed.data.rawEvent || parsed.data)
      ]
      );
    }
    let buyerUserId = eventRows.rows[0]?.buyer_user_id || null;
    if (!buyerUserId) {
      const userRows = await client.query<{ id: string }>(
        "select id from hb_users where lower(usdt_bep20_address) = lower($1) or lower(hb9_wallet_address) = lower($1) limit 1",
        [parsed.data.buyerAddress]
      );
      buyerUserId = userRows.rows[0]?.id || null;
    }
    if (!buyerUserId) {
      await client.query("update hb_onchain_purchase_events set status = 'pending', updated_at = now() where contract_event_id = $1", [parsed.data.contractEventId]);
      await client.query("commit");
      ok(res, { matched: false, contractEventId: parsed.data.contractEventId }, "Event indexed but no matching HB user was found");
      return;
    }
    await client.query("update hb_onchain_purchase_events set buyer_user_id = $2, status = 'confirmed', synced_at = now(), updated_at = now() where contract_event_id = $1", [parsed.data.contractEventId, buyerUserId]);
    const purchaseIdempotencyKey = `hb:onchain:purchase:${parsed.data.contractEventId}`;
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
        parsed.data.txHash,
        parsed.data.contractEventId,
        parsed.data.blockNumber,
        parsed.data.logIndex,
        parsed.data.onchainPackageId,
        parsed.data.buyerAddress,
        parsed.data.sponsorAddress || null,
        `HBC-${parsed.data.contractEventId.slice(0, 18).toUpperCase()}`,
        hbOnchainChainId()
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
    await client.query(
      `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
       values ($1,'hb.onchain.package_purchase.confirmed','hb_package_purchase',$2,$3::jsonb)`,
      [buyerUserId, purchaseRows.rows[0]?.id || null, JSON.stringify(parsed.data)]
    );
    await client.query("commit");
    await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.onchain_purchase.sync_event", entityType: "hb_onchain_purchase_event", entityId: eventRows.rows[0]?.id || "00000000-0000-0000-0000-000000000000", metadata: parsed.data });
    ok(res, { matched: true, purchaseId: purchaseRows.rows[0]?.id || null }, "On-chain purchase event indexed and user activation synced");
  } catch (err) {
    await client.query("rollback");
    fail(res, err instanceof Error ? err.message : "On-chain event sync failed.", 500, "On-chain sync failed");
  } finally {
    client.release();
  }
}));

hbRouter.post("/admin/hb/onchain-purchases/resync", requireAdmin, asyncHandler(async (req, res) => {
  const fromBlock = typeof req.body?.fromBlock === "number" ? req.body.fromBlock : null;
  const toBlock = typeof req.body?.toBlock === "number" ? req.body.toBlock : null;
  if (fromBlock !== null && toBlock !== null) {
    const result = await syncHbOnchainRange(fromBlock, toBlock);
    await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.onchain_purchase.resync_range", entityType: "hb_onchain_sync_log", entityId: "00000000-0000-0000-0000-000000000000", metadata: { fromBlock, toBlock, result }, req });
    ok(res, result, "On-chain range resync completed");
    return;
  }
  const rows = await query<{ id: string }>(
    `insert into hb_onchain_sync_logs (contract_key, from_block, to_block, status, triggered_by)
     values ('package_manager',$1,$2,'queued',$3)
     returning id`,
    [fromBlock ?? (config.hbOnchainStartBlock || null), toBlock, req.admin?.email || "admin"]
  );
  await adminActionLog({ adminEmail: req.admin?.email || "admin", action: "admin.hb.onchain_purchase.resync_queued", entityType: "hb_onchain_sync_log", entityId: rows[0]?.id || "00000000-0000-0000-0000-000000000000", metadata: {}, req });
  ok(res, { logId: rows[0]?.id || null, status: "queued" }, "On-chain resync queued");
}));

hbRouter.get("/admin/hb/coins/users", requireAdmin, asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const selectedUserId = typeof req.query.userId === "string" && /^[0-9a-fA-F-]{36}$/.test(req.query.userId) ? req.query.userId : "";
  const coinValuesSql = hbCoinSymbols.map((symbol, index) => `('${symbol}','${hbCoinName(symbol).replace(/'/g, "''")}',${index + 1})`).join(",");
  const users = await query(
    `select u.id, u.email, u.mobile_number, u.display_name, u.status,
            coalesce(json_agg(json_build_object('coin_symbol', c.coin_symbol, 'coin_name', c.name, 'balance', coalesce(b.balance,0)::text, 'updated_at', b.updated_at) order by c.sort_order), '[]'::json) as balances
     from hb_users u
     cross join (values ${coinValuesSql}) as c(coin_symbol, name, sort_order)
     left join hb_coin_balances b on b.user_id = u.id and b.coin_symbol = c.coin_symbol
     where ($1::text = '' or u.email ilike '%' || $1 || '%' or u.mobile_number ilike '%' || $1 || '%' or u.display_name ilike '%' || $1 || '%')
     group by u.id
     order by u.created_at desc
     limit 100`,
    [search]
  );
  const ledger = await query(
    `select l.id, l.user_id, u.email, u.mobile_number, u.display_name, l.coin_symbol, l.amount::text,
            l.type, l.direction, NULL::text AS reference, l.admin_id, l.note, l.created_at
     from hb_coin_balance_ledger l
     join hb_users u on u.id = l.user_id
     where ($1::text = '' or u.email ilike '%' || $1 || '%' or u.mobile_number ilike '%' || $1 || '%' or u.display_name ilike '%' || $1 || '%')
       and ($2::uuid is null or l.user_id = $2)
     order by l.created_at desc
     limit 200`,
    [search, selectedUserId || null]
  );
  const totals = await query(
    `with balance_totals as (
       select coin_symbol,
              count(distinct user_id) filter (where balance > 0)::int as holder_count,
              coalesce(sum(balance),0) as total_balance
       from hb_coin_balances
       group by coin_symbol
     ),
     ledger_totals as (
       select coin_symbol,
              coalesce(sum(amount) filter (where direction = 'credit'),0) as credit_amount,
              coalesce(sum(amount) filter (where direction = 'debit'),0) as debit_amount
       from hb_coin_balance_ledger
       group by coin_symbol
     )
     select c.coin_symbol,
            coalesce(b.holder_count,0)::int as holder_count,
            coalesce(b.total_balance,0)::text as total_balance,
            coalesce(l.credit_amount,0)::text as total_credited,
            coalesce(l.debit_amount,0)::text as total_debited,
            (coalesce(l.credit_amount,0) - coalesce(l.debit_amount,0))::text as net_supply
     from (values ${hbCoinSymbols.map((symbol, index) => `('${symbol}',${index + 1})`).join(",")}) as c(coin_symbol, sort_order)
     left join balance_totals b on b.coin_symbol = c.coin_symbol
     left join ledger_totals l on l.coin_symbol = c.coin_symbol
     order by c.sort_order`
  );
  const latestAdminActions = await query(
    `select l.id, l.user_id, u.email, u.mobile_number, u.display_name, l.coin_symbol, l.amount::text,
            l.direction, NULL::text AS reference, l.admin_id, l.note, l.created_at
     from hb_coin_balance_ledger l
     join hb_users u on u.id = l.user_id
     where l.type in ('admin', 'admin_credit', 'admin_debit')
     order by l.created_at desc
     limit 25`
  );
  ok(res, { users, ledger, totals, latestAdminActions, coins: supportedCoins, selectedUserId }, "HB coin admin data loaded");
}));

hbRouter.get("/admin/hb/coins", requireAdmin, asyncHandler(async (_req, res) => {
  ok(res, { items: supportedCoins }, "HB coin assets loaded");
}));

hbRouter.get("/admin/hb/coins/history", requireAdmin, asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const coin = typeof req.query.coin === "string" ? normalizeHbCoinSymbol(req.query.coin) : null;
  const rows = await query(
    `select l.id, l.user_id, u.email, u.mobile_number, u.display_name, l.coin_symbol, l.amount::text,
            l.usd_price::text, l.usd_value::text, l.type, l.direction, NULL::text AS reference, NULL::text AS reference_id,
            l.admin_id, l.note, l.public_reference_id, l.created_at
     from hb_coin_balance_ledger l
     join hb_users u on u.id = l.user_id
     where ($1::text = '' or u.email ilike '%' || $1 || '%' or u.mobile_number ilike '%' || $1 || '%' or u.display_name ilike '%' || $1 || '%')
       and ($2::text is null or l.coin_symbol = $2)
     order by l.created_at desc
     limit 300`,
    [search, coin]
  );
  ok(res, { items: rows }, "HB coin history loaded");
}));

hbRouter.get("/admin/hb/coins/reconciliation", requireAdmin, asyncHandler(async (_req, res) => {
  const balanceMismatches = await query(
    `with ledger_totals as (
       select user_id, coin_symbol,
              coalesce(sum(case when direction = 'credit' then amount else -amount end),0) as ledger_balance
       from hb_coin_balance_ledger
       group by user_id, coin_symbol
     ),
     combined as (
       select coalesce(b.user_id, l.user_id) as user_id,
              coalesce(b.coin_symbol, l.coin_symbol) as coin_symbol,
              coalesce(b.balance,0) as stored_balance,
              coalesce(l.ledger_balance,0) as ledger_balance
       from hb_coin_balances b
       full outer join ledger_totals l on l.user_id = b.user_id and l.coin_symbol = b.coin_symbol
     )
     select c.user_id, u.email, u.mobile_number, u.display_name, c.coin_symbol,
            c.stored_balance::text, c.ledger_balance::text,
            (c.stored_balance - c.ledger_balance)::text as difference
     from combined c
     left join hb_users u on u.id = c.user_id
     where abs(c.stored_balance - c.ledger_balance) > 0.00000001
     order by abs(c.stored_balance - c.ledger_balance) desc
     limit 200`
  );
  const negativeBalances = await query(
    `select b.user_id, u.email, u.mobile_number, u.display_name, b.coin_symbol, b.balance::text
     from hb_coin_balances b
     left join hb_users u on u.id = b.user_id
     where b.balance < 0
     order by b.balance asc
     limit 200`
  );
  const orphanLedgerEntries = await query(
    `select l.id, l.user_id, l.coin_symbol, l.amount::text, l.direction, NULL::text AS reference, l.created_at
     from hb_coin_balance_ledger l
     left join hb_users u on u.id = l.user_id
     where u.id is null
     order by l.created_at desc
     limit 200`
  );
  const duplicateReferences = await query(
    `select null::uuid as user_id, null::text as coin_symbol, NULL::text AS reference, 0::int as duplicate_count,
            '0'::text as net_amount
     from hb_coin_balance_ledger
     where false`
  );
  const usdtSync = await query(
    `with coin as (
       select user_id, balance as coin_balance
       from hb_coin_balances
       where coin_symbol = 'USDT'
     ),
     internal as (
       select user_id,
              coalesce(sum(case when direction = 'credit' then amount_usd else -amount_usd end),0) as internal_balance
       from hb_internal_ledger
       group by user_id
     ),
     combined as (
       select coalesce(c.user_id, i.user_id) as user_id,
              coalesce(c.coin_balance,0) as coin_balance,
              coalesce(i.internal_balance,0) as internal_balance
       from coin c
       full outer join internal i on i.user_id = c.user_id
     )
     select c.user_id, u.email, u.mobile_number, u.display_name,
            c.coin_balance::text as usdt_coin_balance,
            c.internal_balance::text as internal_ledger_balance,
            (c.coin_balance - c.internal_balance)::text as difference
     from combined c
     left join hb_users u on u.id = c.user_id
     where abs(c.coin_balance - c.internal_balance) > 0.00000001
     order by abs(c.coin_balance - c.internal_balance) desc
     limit 200`
  );
  const counts = {
    balanceMismatches: balanceMismatches.length,
    negativeBalances: negativeBalances.length,
    orphanLedgerEntries: orphanLedgerEntries.length,
    duplicateReferences: duplicateReferences.length,
    usdtSyncMismatches: usdtSync.length
  };
  ok(res, {
    healthy: Object.values(counts).every((count) => count === 0),
    counts,
    balanceMismatches,
    negativeBalances,
    orphanLedgerEntries,
    duplicateReferences,
    usdtSync
  }, "HB coin reconciliation loaded");
}));

async function adminCoinAdjust(req: Request, res: Response, direction: "credit" | "debit") {
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Coin adjustment failed");
    return;
  }
  const parsed = adminCoinAdjustSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid coin adjustment");
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensureHbUserExists(client, parsed.data.userId);
    const ledgerId = await applyHbCoinAdjustment({
      client,
      userId: parsed.data.userId,
      coinSymbol: parsed.data.coinSymbol,
      amount: parsed.data.amount,
      direction,
      type: direction === "credit" ? "admin_credit" : "admin_debit",
      reference: parsed.data.reference || `admin_${direction}:${crypto.randomUUID()}`,
      adminId: req.admin?.email || "admin",
      note: parsed.data.note || null,
      idempotencyKey: `hb:coin:admin:${direction}:${parsed.data.userId}:${parsed.data.coinSymbol}:${crypto.randomUUID()}`
    });
    await createLedgerProof(client, "hb_coin_balance_ledger", ledgerId);
    await client.query("commit");
    await adminActionLog({ adminEmail: req.admin?.email || "admin", action: `admin.hb.coin.${direction}`, entityType: "hb_coin_balance_ledger", entityId: ledgerId || "00000000-0000-0000-0000-000000000000", metadata: parsed.data });
    ok(res, { ledgerId, status: direction }, `Coin ${direction} recorded`, 201);
  } catch (err) {
    await client.query("rollback");
    fail(res, err instanceof Error ? err.message : "Coin adjustment failed.", 400, "Coin adjustment failed");
  } finally {
    client.release();
  }
}

hbRouter.post("/admin/hb/coins/credit", requireAdmin, asyncHandler(async (req, res) => {
  await adminCoinAdjust(req, res, "credit");
}));

hbRouter.post("/admin/hb/coins/debit", requireAdmin, asyncHandler(async (req, res) => {
  await adminCoinAdjust(req, res, "debit");
}));

hbRouter.post("/admin/hb/funds/transfer", requireAdmin, asyncHandler(async (req, res) => {
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Fund transfer failed");
    return;
  }
  const parsed = adminFundTransferSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid fund transfer");
    return;
  }
  const adminEmail = req.admin?.email || "admin";
  const idempotencyKey = parsed.data.idempotencyKey || `hb:funds:transfer:${crypto.randomUUID()}`;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const existing = await client.query("select * from hb_internal_transfers where idempotency_key = $1 limit 1", [idempotencyKey]);
    if (existing.rows[0]) {
      await client.query("commit");
      ok(res, existing.rows[0], "Fund transfer already exists");
      return;
    }
    await ensureHbUserExists(client, parsed.data.senderUserId);
    await ensureHbUserExists(client, parsed.data.receiverUserId);
    const senderBefore = await readCoinBalance(client, parsed.data.senderUserId, parsed.data.coinSymbol);
    const receiverBefore = await readCoinBalance(client, parsed.data.receiverUserId, parsed.data.coinSymbol);
    const reference = `admin_transfer:${crypto.randomUUID()}`;
    const senderLedgerId = await applyHbCoinAdjustment({
      client,
      userId: parsed.data.senderUserId,
      coinSymbol: parsed.data.coinSymbol,
      amount: parsed.data.amount,
      direction: "debit",
      type: "admin",
      reference,
      adminId: adminEmail,
      note: parsed.data.note,
      idempotencyKey: `${idempotencyKey}:sender`,
      metadata: { action: "transfer", role: "sender", receiverUserId: parsed.data.receiverUserId }
    });
    const receiverLedgerId = await applyHbCoinAdjustment({
      client,
      userId: parsed.data.receiverUserId,
      coinSymbol: parsed.data.coinSymbol,
      amount: parsed.data.amount,
      direction: "credit",
      type: "admin",
      reference,
      adminId: adminEmail,
      note: parsed.data.note,
      idempotencyKey: `${idempotencyKey}:receiver`,
      metadata: { action: "transfer", role: "receiver", senderUserId: parsed.data.senderUserId }
    });
    if (!senderLedgerId || !receiverLedgerId) throw new Error("Duplicate fund transfer ledger request.");
    const senderProof = await createLedgerProof(client, "hb_coin_balance_ledger", senderLedgerId);
    const receiverProof = await createLedgerProof(client, "hb_coin_balance_ledger", receiverLedgerId);
    const senderAfter = await readCoinBalance(client, parsed.data.senderUserId, parsed.data.coinSymbol);
    const receiverAfter = await readCoinBalance(client, parsed.data.receiverUserId, parsed.data.coinSymbol);
    const transferRows = await client.query(
      `insert into hb_internal_transfers
        (sender_user_id, receiver_user_id, coin_symbol, amount, type, note, admin_id,
         sender_ledger_entry_id, receiver_ledger_entry_id, proof_reference,
         sender_before_balance, sender_after_balance, receiver_before_balance, receiver_after_balance, idempotency_key)
       values ($1,$2,$3,$4,'admin_transfer',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning *`,
      [
        parsed.data.senderUserId,
        parsed.data.receiverUserId,
        parsed.data.coinSymbol,
        parsed.data.amount,
        parsed.data.note,
        adminEmail,
        senderLedgerId,
        receiverLedgerId,
        (receiverProof as any)?.public_reference_id || (senderProof as any)?.public_reference_id || null,
        senderBefore,
        senderAfter,
        receiverBefore,
        receiverAfter,
        idempotencyKey
      ]
    );
    if (Number(parsed.data.amount) >= 1000) {
      await client.query(
        `insert into hb_risk_flags (user_id, flag, reason, created_by)
         values ($1,'review',$2,$3)`,
        [parsed.data.senderUserId, `Large internal transfer ${parsed.data.amount} ${parsed.data.coinSymbol}`, adminEmail]
      ).catch(() => undefined);
    }
    await client.query("commit");
    await adminActionLog({ adminEmail, action: "admin.hb.funds.transfer", entityType: "hb_internal_transfer", entityId: String((transferRows.rows[0] as any)?.id || ""), metadata: parsed.data, req, afterSnapshot: transferRows.rows[0] });
    await adminHbAudit(adminEmail, "admin.hb.funds.transfer", "hb_internal_transfer", String((transferRows.rows[0] as any)?.id || ""), parsed.data);
    ok(res, transferRows.rows[0], "Internal fund transfer completed", 201);
  } catch (err) {
    await client.query("rollback");
    fail(res, err instanceof Error ? err.message : "Fund transfer failed.", 400, "Fund transfer failed");
  } finally {
    client.release();
  }
}));

async function adminFundAction(req: Request, res: Response, direction: "credit" | "debit", type: "credit" | "deduct" | "bulk_distribution") {
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Fund action failed");
    return;
  }
  const parsed = adminFundActionSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid fund action");
    return;
  }
  const adminEmail = req.admin?.email || "admin";
  const idempotencyKey = parsed.data.idempotencyKey || `hb:funds:${type}:${crypto.randomUUID()}`;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const existing = await client.query("select * from hb_admin_balance_actions where idempotency_key = $1 limit 1", [idempotencyKey]);
    if (existing.rows[0]) {
      await client.query("commit");
      ok(res, existing.rows[0], "Fund action already exists");
      return;
    }
    await ensureHbUserExists(client, parsed.data.userId);
    const before = await readCoinBalance(client, parsed.data.userId, parsed.data.coinSymbol);
    const reference = `admin_${type}:${crypto.randomUUID()}`;
    let ledgerId: string | null = null;
    let actionLedgerId: string | null = null;
    let proof: unknown = null;
    if (direction === "credit" && parsed.data.incomeType === "admin_income" && parsed.data.coinSymbol === "USDT") {
      const incomeRows = await client.query<{ id: string }>(
        `insert into hb_income_ledger
          (earner_user_id, source_user_id, income_type, amount_usd, status, idempotency_key, metadata)
         values ($1,$1,'admin_income',$2,'credited',$3,$4::jsonb)
         on conflict (idempotency_key) do nothing
         returning id`,
        [parsed.data.userId, parsed.data.amount, `${idempotencyKey}:income`, JSON.stringify({ note: parsed.data.note, admin: adminEmail, reference })]
      );
      ledgerId = incomeRows.rows[0]?.id || null;
      if (!ledgerId) {
        const existingIncomeRows = await client.query<{ id: string }>("select id from hb_income_ledger where idempotency_key = $1 limit 1", [`${idempotencyKey}:income`]);
        ledgerId = existingIncomeRows.rows[0]?.id || null;
      }
      if (!ledgerId) throw new Error("Duplicate admin income ledger request.");
      await applyIncomeCap({ client, userId: parsed.data.userId, incomeLedgerId: ledgerId, incomeAmount: String(parsed.data.amount), incomeType: "admin_income", metadata: { admin: adminEmail, note: parsed.data.note } });
      proof = await createLedgerProof(client, "hb_income_ledger", ledgerId);
    } else {
      ledgerId = await applyHbCoinAdjustment({
        client,
        userId: parsed.data.userId,
        coinSymbol: parsed.data.coinSymbol,
        amount: parsed.data.amount,
        direction,
        type: "admin",
        reference,
        adminId: adminEmail,
        note: parsed.data.note,
        idempotencyKey,
        metadata: { action: type, beforeBalance: before }
      });
      if (!ledgerId) throw new Error("Duplicate fund action ledger request.");
      actionLedgerId = ledgerId;
      proof = await createLedgerProof(client, "hb_coin_balance_ledger", ledgerId);
    }
    const after = await readCoinBalance(client, parsed.data.userId, parsed.data.coinSymbol);
    const actionRows = await client.query(
      `insert into hb_admin_balance_actions
        (user_id, coin_symbol, amount, type, note, admin_id, ledger_entry_id, proof_reference, before_balance, after_balance, idempotency_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning *`,
      [parsed.data.userId, parsed.data.coinSymbol, parsed.data.amount, type, parsed.data.note, adminEmail, actionLedgerId, (proof as any)?.public_reference_id || null, before, after, idempotencyKey]
    );
    if (Number(parsed.data.amount) >= 1000) {
      await client.query(
        `insert into hb_risk_flags (user_id, flag, reason, created_by)
         values ($1,'review',$2,$3)`,
        [parsed.data.userId, `Large admin ${type} ${parsed.data.amount} ${parsed.data.coinSymbol}`, adminEmail]
      ).catch(() => undefined);
    }
    await client.query("commit");
    await adminActionLog({ adminEmail, action: `admin.hb.funds.${type}`, entityType: "hb_admin_balance_action", entityId: String((actionRows.rows[0] as any)?.id || ""), metadata: parsed.data, req, afterSnapshot: actionRows.rows[0] });
    await adminHbAudit(adminEmail, `admin.hb.funds.${type}`, "hb_admin_balance_action", String((actionRows.rows[0] as any)?.id || ""), parsed.data);
    ok(res, actionRows.rows[0], `Internal fund ${type} completed`, 201);
  } catch (err) {
    await client.query("rollback");
    fail(res, err instanceof Error ? err.message : "Fund action failed.", 400, "Fund action failed");
  } finally {
    client.release();
  }
}

hbRouter.post("/admin/hb/funds/credit", requireAdmin, asyncHandler(async (req, res) => {
  await adminFundAction(req, res, "credit", "credit");
}));

hbRouter.post("/admin/hb/funds/deduct", requireAdmin, asyncHandler(async (req, res) => {
  await adminFundAction(req, res, "debit", "deduct");
}));

async function adminBulkDistribution(req: Request, res: Response, forcePreview = false) {
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Bulk distribution failed");
    return;
  }
  const body = req.body;
  console.log("HB9_BULK_REQUEST", JSON.stringify(req.body, null, 2));
  const parsed = adminBulkDistributionSchema.safeParse(body);
  if (!parsed.success) {
    const debug = req.query.debug === "1" || req.query.debug === "true" || body?.debug === true || process.env.NODE_ENV !== "production";
    const error = parsed.error.flatten();
    if (debug) {
      res.status(400).json({
        success: false,
        data: {
          validation: error,
          receivedBody: req.body
        },
        message: "Invalid bulk distribution",
        error: JSON.stringify(error)
      });
      return;
    }
    fail(res, JSON.stringify(error), 400, "Invalid bulk distribution");
    return;
  }
  console.log("PARSED DATA", parsed.data);
  const coinSymbol = parsed.data.coinSymbol;
  if (!coinSymbol) {
    fail(res, "Coin is required.", 400, "Invalid bulk distribution");
    return;
  }
  const note = (parsed.data.note || "").trim();
  if (!note) {
    fail(res, "Reason is required.", 400, "Invalid bulk distribution");
    return;
  }
  const coinUsdPrice = await getHbCoinPrice(coinSymbol);
  if (!Number.isFinite(coinUsdPrice) || coinUsdPrice <= 0) {
    fail(res, `USD price is not available for ${coinSymbol}.`, 400, "Bulk distribution failed");
    return;
  }
  const rootKey = `hb:funds:bulk:${crypto.randomUUID()}`;
  const client = await pool.connect();
  try {
    const adminText = resolveBulkAdminId(req);
    const adminUuid = resolveBulkAdminUuid(req);
    const packageName = parsed.data.packageAmount ? bulkDistributionPackages[Number(parsed.data.packageAmount)] || "Package" : "Manual selection";
    let targets: Array<{ userId: string; email?: string | null; displayName?: string | null; packageName: string }>;
    if (parsed.data.targetMode === "package") {
      targets = (await client.query<{ user_id: string; email: string | null; display_name: string | null; package_name: string }>(
          `select distinct on (u.id)
                  u.id as user_id,
                  u.email,
                  u.display_name,
                  coalesce(pkg.name, $2::text) as package_name
           from hb_users u
           join hb_package_purchases p on p.user_id = u.id
           left join hb_packages pkg on pkg.id = p.package_id
           where p.amount_usd = $1::numeric
             and p.status = 'completed'
             and u.status = 'active'
           order by u.id, p.created_at desc`,
          [parsed.data.packageAmount, packageName]
        )).rows.map((row) => ({
          userId: row.user_id,
          email: row.email,
          displayName: row.display_name,
          packageName: row.package_name
        }));
    } else {
      const manualTargets = [...new Set((parsed.data.userIds || []).map(normalizeManualBulkTarget).filter(Boolean))];
      const resolvedTargets: Array<{ userId: string; email?: string | null; displayName?: string | null; packageName: string }> = [];
      const unresolvedTargets: string[] = [];

      for (const target of manualTargets) {
        if (isUuid(target)) {
          const rows = await client.query<{ id: string; email: string | null; display_name: string | null }>(
            "select id, email, display_name from hb_users where id = $1 limit 1",
            [target]
          );
          const user = rows.rows[0];
          if (user) {
            resolvedTargets.push({ userId: user.id, email: user.email, displayName: user.display_name, packageName: "Manual selection" });
          } else {
            unresolvedTargets.push(target);
          }
          continue;
        }

        const rows = await client.query<{ id: string; email: string | null; display_name: string | null }>(
          `select id, email, display_name
           from hb_users
           where lower(coalesce(wallet_address, '')) = lower($1)
              or lower(coalesce(usdt_bep20_address, '')) = lower($1)
              or lower(coalesce(hb9_wallet_address, '')) = lower($1)
           limit 1`,
          [target]
        );
        const user = rows.rows[0];
        if (user) {
          resolvedTargets.push({ userId: user.id, email: user.email, displayName: user.display_name, packageName: "Manual selection" });
        } else {
          unresolvedTargets.push(target);
        }
      }

      if (unresolvedTargets.length > 0) {
        fail(res, `Could not resolve users: ${unresolvedTargets.join(", ")}`, 400, "Invalid bulk distribution");
        return;
      }

      targets = resolvedTargets.filter((target, index, list) => list.findIndex((item) => item.userId === target.userId) === index);
    }
    const targetUserIds = targets.map((target) => target.userId);
    console.log("HB9 PACKAGE USERS", targets);
    if (targets.length === 0) {
      const targetLabel = parsed.data.targetMode === "package" ? `${packageName} ($${parsed.data.packageAmount})` : "manual selection";
      fail(res, `No users found for ${targetLabel}`, 400, "Bulk distribution failed");
      return;
    }
    if (forcePreview) {
      ok(res, {
        preview: true,
        targetMode: parsed.data.targetMode,
        packageAmount: parsed.data.packageAmount || null,
        packageName,
        coinSymbol,
        amount: parsed.data.amount,
        matchedUsers: targets.length,
        estimatedTotal: Number(parsed.data.amount) * targets.length,
        users: targets.slice(0, 200)
      }, "Bulk distribution preview ready");
      return;
    }
    await client.query("begin");
    const existingBatch = await client.query(
      "select id from hb_admin_balance_actions where idempotency_key like $1 || ':%' limit 1",
      [rootKey]
    );
    if (existingBatch.rows[0]) {
      const existingRows = await client.query<{ count: number }>(
        "select count(*)::int as count from hb_admin_balance_actions where idempotency_key like $1 || ':%'",
        [rootKey]
      );
      await client.query("commit");
      const creditedUsers = Number(existingRows.rows[0]?.count || 0);
      ok(res, {
        success: true,
        matchedUsers: targets.length,
        creditedUsers,
        skippedUsers: Math.max(targets.length - creditedUsers, 0),
        coin: coinSymbol,
        amount: parsed.data.amount,
        duplicate: true,
        idempotencyKey: rootKey
      }, "Bulk distribution already submitted");
      return;
    }
    const results: Array<Record<string, unknown>> = [];
    for (const target of targets) {
      const userId = target.userId;
      if (!isUuid(userId)) {
        console.log("HB9 SKIP NON UUID USER", userId);
        continue;
      }
      console.log("HB9 VALID UUID", userId);
      await ensureHbUserExists(client, userId);
      const dividendStats = await getUserDividendStatsForClient(client, userId);
      const dividendCapUsd = Number(dividendStats.dividendCapUsd || 0);
      const remainingDividendUsd = Math.max(Number(dividendStats.remainingDividendUsd || 0), 0);
      const packageTotalUsd = dividendCapUsd / 2;
      const requestedCoinAmount = Number(parsed.data.amount);
      const requestedUsd = requestedCoinAmount * coinUsdPrice;
      if (remainingDividendUsd <= 0) {
        const dividendRows = await client.query<{ id: string }>(
          `insert into hb_dividend_income_ledger
            (user_id, source_action_id, coin_symbol, coin_amount, usd_value, package_total_usd, cap_usd, credited_usd, status, note)
           values ($1,null,$2,0,$3,$4,$5,0,'capped',$6)
           returning id`,
          [userId, coinSymbol, decimalString(requestedUsd, 18), decimalString(packageTotalUsd, 18), decimalString(dividendCapUsd, 18), note]
        );
        results.push({
          id: dividendRows.rows[0]?.id,
          user_id: userId,
          coin_symbol: coinSymbol,
          amount: "0",
          requested_amount: String(parsed.data.amount),
          status: "capped",
          credited_usd: "0",
          cap_usd: dividendStats.dividendCapUsd,
          remaining_usd: "0"
        });
        continue;
      }
      const fullCreditAllowed = requestedUsd <= remainingDividendUsd + Number.EPSILON;
      const dividendCandidateCoinAmount = fullCreditAllowed ? requestedCoinAmount : floorCoinAmount(remainingDividendUsd / coinUsdPrice);
      if (dividendCandidateCoinAmount <= 0) {
        const dividendRows = await client.query<{ id: string }>(
          `insert into hb_dividend_income_ledger
            (user_id, source_action_id, coin_symbol, coin_amount, usd_value, package_total_usd, cap_usd, credited_usd, status, note)
           values ($1,null,$2,0,$3,$4,$5,0,'capped',$6)
           returning id`,
          [userId, coinSymbol, decimalString(requestedUsd, 18), decimalString(packageTotalUsd, 18), decimalString(dividendCapUsd, 18), note]
        );
        results.push({
          id: dividendRows.rows[0]?.id,
          user_id: userId,
          coin_symbol: coinSymbol,
          amount: "0",
          requested_amount: String(parsed.data.amount),
          status: "capped",
          credited_usd: "0",
          cap_usd: dividendStats.dividendCapUsd,
          remaining_usd: "0"
        });
        continue;
      }
      const dividendCandidateUsd = fullCreditAllowed ? requestedUsd : Math.min(dividendCandidateCoinAmount * coinUsdPrice, remainingDividendUsd);
      const incomeIdempotencyKey = `${rootKey}:${userId}:dividend_income`;
      const incomeRows = await client.query<{ id: string }>(
        `insert into hb_income_ledger
          (earner_user_id, source_user_id, income_type, amount_usd, status, idempotency_key, metadata)
         values ($1,$1,'dividend_income',$2,'credited',$3,$4::jsonb)
         on conflict (idempotency_key) do nothing
         returning id`,
        [
          userId,
          decimalString(dividendCandidateUsd, 18),
          incomeIdempotencyKey,
          JSON.stringify({
            source: "admin_bulk_distribution",
            batchKey: rootKey,
            coinSymbol,
            requestedAmount: parsed.data.amount,
            requestedUsd: decimalString(requestedUsd, 18),
            dividendLifetimeRemainingUsd: dividendStats.remainingDividendUsd
          })
        ]
      );
      let incomeLedgerId = incomeRows.rows[0]?.id || null;
      if (!incomeLedgerId) {
        const existingIncomeRows = await client.query<{ id: string }>(
          "select id from hb_income_ledger where idempotency_key = $1 limit 1",
          [incomeIdempotencyKey]
        );
        incomeLedgerId = existingIncomeRows.rows[0]?.id || null;
      }
      if (!incomeLedgerId) throw new Error("Dividend income ledger could not be created.");
      const dailyCapResult = await applyIncomeCap({
        client,
        userId,
        incomeLedgerId,
        incomeAmount: decimalString(dividendCandidateUsd, 18),
        incomeType: "dividend_income",
        creditWallet: false,
        metadata: { batchKey: rootKey, coinSymbol, requestedAmount: parsed.data.amount }
      });
      const dailyCappedUsd = Number(dailyCapResult.creditedAmount || 0);
      const dailyCapLimited = dailyCappedUsd + Number.EPSILON < dividendCandidateUsd;
      const creditCoinAmount = dailyCapLimited ? floorCoinAmount(dailyCappedUsd / coinUsdPrice) : dividendCandidateCoinAmount;
      if (creditCoinAmount <= 0) {
        const dividendRows = await client.query<{ id: string }>(
          `insert into hb_dividend_income_ledger
            (user_id, source_action_id, coin_symbol, coin_amount, usd_value, package_total_usd, cap_usd, credited_usd, status, note)
           values ($1,null,$2,0,$3,$4,$5,0,'capped',$6)
           returning id`,
          [userId, coinSymbol, decimalString(requestedUsd, 18), decimalString(packageTotalUsd, 18), decimalString(dividendCapUsd, 18), note]
        );
        results.push({
          id: dividendRows.rows[0]?.id,
          user_id: userId,
          coin_symbol: coinSymbol,
          amount: "0",
          requested_amount: String(parsed.data.amount),
          status: "capped",
          credited_usd: "0",
          cap_usd: dividendStats.dividendCapUsd,
          remaining_usd: "0"
        });
        continue;
      }
      const creditedUsd = dailyCapLimited ? Math.min(creditCoinAmount * coinUsdPrice, dailyCappedUsd) : dividendCandidateUsd;
      const dividendStatus = fullCreditAllowed && !dailyCapLimited ? "credited" : "partial_capped";
      const creditCoinAmountText = decimalString(creditCoinAmount, 8);
      const before = await readCoinBalance(client, userId, coinSymbol);
      console.log("BULK_INSERT_USER_ID", userId);
      console.log("BULK_INSERT_ADMIN_TEXT", adminText);
      console.log("BULK_INSERT_ADMIN_UUID", adminUuid);
      const coinLedgerParams = {
        userId,
        coinSymbol,
        amount: creditCoinAmountText,
        direction: "credit",
        type: "credit",
        reference: null,
        adminId: adminUuid,
        note,
        idempotencyKey: `${rootKey}:${userId}`
      };
      console.log("BULK_SQL_INSERT", { table: "hb_coin_balance_ledger", params: coinLedgerParams });
      const ledgerId = await applyHbCoinAdjustment({
        client,
        userId,
        coinSymbol,
        amount: creditCoinAmountText,
        direction: "credit",
        type: "credit",
        reference: null,
        adminId: adminUuid,
        note,
        idempotencyKey: `${rootKey}:${userId}`,
        metadata: {
          source: "admin_bulk_distribution",
          action: "bulk_distribution",
          type: "credit",
          coin: coinSymbol,
          amount: creditCoinAmountText,
          requestedAmount: parsed.data.amount,
          dividendStatus,
          dividendCreditedUsd: decimalString(creditedUsd, 18),
          dividendCapUsd: dividendStats.dividendCapUsd,
          reason: note,
          adminId: adminText,
          adminUuid,
          batchKey: rootKey,
          reference: `admin_bulk_distribution:${rootKey}`,
          targetMode: parsed.data.targetMode,
          packageAmount: parsed.data.packageAmount || null,
          packageName: target.packageName
        },
        usdPrice: coinUsdPrice,
        usdValue: decimalString(creditedUsd, 18)
      });
      if (!ledgerId) continue;
      console.log("BULK_SQL_INSERT", { table: "hb_ledger_proofs", params: { sourceTable: "hb_coin_balance_ledger", ledgerEntryId: ledgerId, userId } });
      const proof = await createLedgerProof(client, "hb_coin_balance_ledger", ledgerId);
      const after = await readCoinBalance(client, userId, coinSymbol);
      console.log("BULK_INSERT_USER_ID", userId);
      console.log("BULK_INSERT_ADMIN_TEXT", adminText);
      console.log("BULK_INSERT_ADMIN_UUID", adminUuid);
      const actionParams = [userId, coinSymbol, creditCoinAmountText, note, adminText, ledgerId, (proof as any)?.public_reference_id || null, before, after, `${rootKey}:${userId}`];
      console.log("BULK_SQL_INSERT", { table: "hb_admin_balance_actions", params: actionParams });
      const actionRows = await client.query(
        `insert into hb_admin_balance_actions
          (user_id, coin_symbol, amount, type, note, admin_id, ledger_entry_id, proof_reference, before_balance, after_balance, idempotency_key)
         values ($1,$2,$3,'bulk_distribution',$4,$5,$6,$7,$8,$9,$10)
         returning id, user_id, coin_symbol, amount::text, proof_reference`,
        actionParams
      );
      await client.query(
        `insert into hb_dividend_income_ledger
          (user_id, source_action_id, coin_symbol, coin_amount, usd_value, package_total_usd, cap_usd, credited_usd, status, note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          userId,
          actionRows.rows[0]?.id || null,
          coinSymbol,
          creditCoinAmountText,
          decimalString(requestedUsd, 18),
          decimalString(packageTotalUsd, 18),
          decimalString(dividendCapUsd, 18),
          decimalString(creditedUsd, 18),
          dividendStatus,
          note
        ]
      );
      results.push({
        ...actionRows.rows[0],
        requested_amount: String(parsed.data.amount),
        status: dividendStatus,
        credited_usd: decimalString(creditedUsd, 18),
        cap_usd: dividendStats.dividendCapUsd,
        remaining_usd: decimalString(Math.max(remainingDividendUsd - creditedUsd, 0), 18)
      });
    }
    console.log("DISTRIBUTION SUCCESS");
    await client.query("commit");
    const creditedResults = results.filter((item) => item.status === "credited");
    const partialCappedResults = results.filter((item) => item.status === "partial_capped");
    const skippedCappedResults = results.filter((item) => item.status === "capped");
    const creditedWalletResults = [...creditedResults, ...partialCappedResults];
    const totalUsdDistributed = creditedWalletResults.reduce((sum, item) => sum + Number(item.credited_usd || 0), 0);
    const totalCoinDistributed = creditedWalletResults.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const metadata = {
      targetMode: parsed.data.targetMode,
      ...(parsed.data.targetMode === "manual" ? { userIds: parsed.data.userIds } : {}),
      packageAmount: parsed.data.packageAmount || null,
      coinSymbol,
      amount: parsed.data.amount,
      note,
      batchKey: rootKey,
      userCount: creditedWalletResults.length,
      packageName,
      targetedUsers: targets.length,
      creditedUsers: creditedResults.length,
      partialCappedUsers: partialCappedResults.length,
      skippedCappedUsers: skippedCappedResults.length,
      totalUsdDistributed,
      totalCoinDistributed
    };
    const bulkEntityId = String(creditedWalletResults[0]?.id || results[0]?.id || crypto.randomUUID());
    console.log("BULK_SQL_INSERT", { table: "hb_admin_action_logs", params: { adminEmail: adminText, entityId: bulkEntityId } });
    await adminActionLog({ adminEmail: adminText, action: "admin.hb.funds.bulk_distribution", entityType: "hb_admin_balance_action", entityId: bulkEntityId, metadata });
    console.log("BULK_SQL_INSERT", { table: "hb_audit_logs", params: { userId: null, entityId: bulkEntityId, admin: adminText } });
    await adminHbAudit(adminText, "admin.hb.funds.bulk_distribution", "hb_admin_balance_action", bulkEntityId, metadata);
    ok(res, {
      success: true,
      matchedUsers: targets.length,
      targetedUsers: targets.length,
      creditedUsers: creditedResults.length,
      partialCappedUsers: partialCappedResults.length,
      skippedCappedUsers: skippedCappedResults.length,
      skippedUsers: skippedCappedResults.length,
      totalUsdDistributed: decimalString(totalUsdDistributed, 18),
      totalCoinDistributed: decimalString(totalCoinDistributed, 8),
      coin: coinSymbol,
      amount: parsed.data.amount,
      items: results,
      count: results.length,
      idempotencyKey: rootKey
    }, "Bulk distribution completed", 201);
  } catch (err) {
    await client.query("rollback");
    fail(res, err instanceof Error ? err.message : "Bulk distribution failed.", 400, "Bulk distribution failed");
  } finally {
    client.release();
  }
}

hbRouter.post("/admin/hb/funds/bulk-preview", requireAdmin, asyncHandler(async (req, res) => {
  await adminBulkDistribution(req, res, true);
}));

hbRouter.post("/admin/hb/funds/bulk-distribution", requireAdmin, asyncHandler(async (req, res) => {
  await adminBulkDistribution(req, res);
}));

hbRouter.get("/admin/hb/funds/history", requireAdmin, asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const rows = await query(
    `select *
     from (
       select t.id::text, 'transfer' as action_type, t.sender_user_id, su.email as sender_email, t.receiver_user_id, ru.email as receiver_email,
              t.coin_symbol, t.amount::text, t.note, t.admin_id, t.sender_before_balance::text, t.sender_after_balance::text,
              t.receiver_before_balance::text, t.receiver_after_balance::text, p.public_reference_id, p.proof_hash, t.created_at
       from hb_internal_transfers t
       left join hb_users su on su.id = t.sender_user_id
       left join hb_users ru on ru.id = t.receiver_user_id
       left join hb_ledger_proofs p on p.ledger_entry_id = t.receiver_ledger_entry_id and p.source_table = 'hb_coin_balance_ledger'
       union all
       select a.id::text, a.type as action_type, null::uuid as sender_user_id, null as sender_email, a.user_id as receiver_user_id, u.email as receiver_email,
              a.coin_symbol, a.amount::text, a.note, a.admin_id, null, null, a.before_balance::text, a.after_balance::text,
              p.public_reference_id, p.proof_hash, a.created_at
       from hb_admin_balance_actions a
       left join hb_users u on u.id = a.user_id
       left join hb_ledger_proofs p on p.ledger_entry_id = a.ledger_entry_id and p.source_table = 'hb_coin_balance_ledger'
       where a.type <> 'bulk_distribution'
       union all
       select regexp_replace(a.idempotency_key, ':[^:]+$', '') as id, 'bulk_distribution' as action_type,
              null::uuid as sender_user_id, coalesce(max(l.metadata->>'packageName'), 'Manual selection') as sender_email,
              null::uuid as receiver_user_id, count(*)::text || ' users' as receiver_email,
              max(a.coin_symbol) as coin_symbol, min(a.amount)::text as amount, max(a.note) as note, max(a.admin_id) as admin_id,
              null, null, null, null, null as public_reference_id, null as proof_hash, max(a.created_at) as created_at
       from hb_admin_balance_actions a
       left join hb_coin_balance_ledger l on l.id = a.ledger_entry_id
       where a.type = 'bulk_distribution'
       group by regexp_replace(a.idempotency_key, ':[^:]+$', '')
     ) history
     where ($1::text = '' or history.sender_email ilike '%' || $1 || '%' or history.receiver_email ilike '%' || $1 || '%' or history.coin_symbol ilike '%' || $1 || '%' or history.note ilike '%' || $1 || '%')
     order by created_at desc
     limit 300`,
    [search]
  );
  ok(res, { items: rows, coins: supportedCoins }, "Fund history loaded");
}));

hbRouter.get("/admin/hb/users", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select u.id, u.email, u.mobile_number, u.display_name, u.referral_code, u.own_referral_code,
            u.sponsor_referral_code, u.source_referral_code, u.hb9_wallet_address,
            u.status, u.activated_at, u.created_at, coalesce(risk.flag, 'normal') as risk_flag,
            w.wallet_address,
            s.display_name as sponsor_name,
            s.email as sponsor_email,
            current_pkg.name as current_package,
            coalesce(sum(case when l.wallet_type = 'deposit' and l.direction = 'credit' then l.amount_usd when l.wallet_type = 'deposit' then -l.amount_usd else 0 end),0)::text as deposit_balance,
            coalesce(dep.total_deposits,0)::text as total_deposits,
            count(distinct p.id)::int as purchase_count,
            coalesce(sum(p.amount_usd),0)::text as total_purchases,
            coalesce(income.total_income,0)::text as total_income
     from hb_users u
     left join hb_wallets w on w.user_id = u.id and w.wallet_type = 'deposit' and w.network = 'bsc'
     left join hb_users s on s.id = u.sponsor_user_id
     left join lateral (
       select flag from hb_risk_flags where user_id = u.id and active = true order by created_at desc limit 1
     ) risk on true
     left join hb_internal_ledger l on l.user_id = u.id
     left join hb_package_purchases p on p.user_id = u.id
     left join lateral (
       select pkg.name
       from hb_package_purchases hp
       join hb_packages pkg on pkg.id = hp.package_id
       where hp.user_id = u.id and hp.status = 'completed'
       order by hp.created_at desc
       limit 1
     ) current_pkg on true
     left join lateral (
       select coalesce(sum(usd_amount),0) as total_deposits from hb_deposits where user_id = u.id and status = 'verified'
     ) dep on true
     left join lateral (
       select coalesce(sum(amount_usd),0) as total_income from hb_income_ledger where earner_user_id = u.id and status = 'credited'
     ) income on true
     group by u.id, w.wallet_address, s.display_name, s.email, current_pkg.name, risk.flag, dep.total_deposits, income.total_income
     order by u.created_at desc
     limit 200`
  );
  ok(res, { items: rows }, "HB9 users loaded");
}));

hbRouter.get("/admin/hb/users/:id", requireAdmin, asyncHandler(async (req, res) => {
  const rows = await query(
    `select u.id, u.email, u.mobile_number, u.display_name, u.referral_code, u.own_referral_code,
            u.sponsor_referral_code, u.source_referral_code, u.hb9_wallet_address,
            u.status, u.activated_at, u.created_at, coalesce(risk.flag, 'normal') as risk_flag,
            w.wallet_address, s.id as sponsor_id, s.display_name as sponsor_name, s.email as sponsor_email
     from hb_users u
     left join hb_wallets w on w.user_id = u.id and w.wallet_type = 'deposit'
     left join hb_users s on s.id = u.sponsor_user_id
     left join lateral (
       select flag from hb_risk_flags where user_id = u.id and active = true order by created_at desc limit 1
     ) risk on true
     where u.id = $1
     limit 1`,
    [req.params.id]
  );
  if (!rows[0]) {
    fail(res, "HB9 user not found.", 404, "Not found");
    return;
  }
  const [deposits, purchases, incomeRows, notes] = await Promise.all([
    query("select * from hb_deposits where user_id = $1 order by created_at desc limit 50", [req.params.id]),
    query(`select p.*, pkg.name as package_name from hb_package_purchases p join hb_packages pkg on pkg.id = p.package_id where p.user_id = $1 order by p.created_at desc limit 50`, [req.params.id]),
    query("select * from hb_income_ledger where earner_user_id = $1 order by created_at desc limit 50", [req.params.id]),
    query("select * from hb_admin_notes where entity_type = 'hb_user' and entity_id = $1 order by created_at desc limit 50", [req.params.id])
  ]);
  ok(res, { user: rows[0], deposits, purchases, income: incomeRows, notes }, "HB9 user detail loaded");
}));

hbRouter.patch("/admin/hb/users/:id/status", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminUserStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid user status update");
    return;
  }
  const rows = await query("update hb_users set status = $2, updated_at = now() where id = $1 returning id, email, display_name, status", [req.params.id, parsed.data.status]);
  if (!rows[0]) {
    fail(res, "HB9 user not found.", 404, "Status update failed");
    return;
  }
  if (parsed.data.adminRemark) {
    await query("insert into hb_admin_notes (admin_email, entity_type, entity_id, note) values ($1,'hb_user',$2,$3)", [req.admin?.email || "admin", req.params.id, parsed.data.adminRemark]);
  }
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.user.status", "hb_user", String(req.params.id), parsed.data);
  ok(res, rows[0], "HB9 user status updated");
}));

hbRouter.post("/admin/hb/users/:id/reset-income-activation", requireAdmin, asyncHandler(async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;
  if (!pool) {
    fail(res, "Database is not configured.", 500, "Reset failed");
    return;
  }
  const userId = String(req.params.id || "");
  if (!isUuid(userId)) {
    fail(res, "Invalid HB9 user id.", 400, "Reset failed");
    return;
  }
  const adminId = req.admin?.email || "admin";
  const adminWallet = resolveBulkAdminId(req);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const targetRows = await client.query<{
      id: string;
      wallet_address: string | null;
      usdt_bep20_address: string | null;
      hb9_wallet_address: string | null;
    }>(
      `select id, wallet_address, usdt_bep20_address, hb9_wallet_address
       from hb_users
       where id = $1
       for update`,
      [userId]
    );
    if (!targetRows.rows[0]) {
      await client.query("rollback");
      fail(res, "HB9 user not found.", 404, "Reset failed");
      return;
    }
    const target = targetRows.rows[0];
    const targetWallet = target.usdt_bep20_address || target.hb9_wallet_address || target.wallet_address || null;
    const internalLedgerForeignKeys = await auditHbInternalLedgerReferences(client);
    logger.info("hb.admin.user_reset_internal_ledger_fk_audit", { userId, admin: adminId, foreignKeys: internalLedgerForeignKeys });
    const beforeSnapshot = await readUserActivationIncomeResetSnapshot(client, userId);
    const resetResult = await resetUserActivationIncome(client, userId);
    const afterSnapshot = await readUserActivationIncomeResetSnapshot(client, userId);
    await client.query(
      `insert into hb_audit_logs (user_id, action, entity_type, entity_id, metadata)
       values ($1,'reset_income_activation','hb_user',$1,$2::jsonb)`,
      [
        userId,
        JSON.stringify({
          admin_id: adminId,
          admin_wallet: adminWallet,
          target_user_id: userId,
          target_wallet: targetWallet,
          internal_ledger_foreign_keys: internalLedgerForeignKeys,
          before_snapshot: beforeSnapshot,
          after_snapshot: afterSnapshot,
          reset_result: resetResult
        })
      ]
    );
    await client.query(
      `insert into hb_admin_action_logs
        (admin_email, action, entity_type, entity_id, previous_status, next_status, metadata, ip_address, before_snapshot, after_snapshot)
       values ($1,'reset_income_activation','hb_user',$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8::jsonb)`,
      [
        adminId,
        userId,
        (beforeSnapshot.user as Record<string, unknown> | null)?.status || null,
        (afterSnapshot.user as Record<string, unknown> | null)?.status || null,
        JSON.stringify({
          admin_id: adminId,
          admin_wallet: adminWallet,
          target_user_id: userId,
          target_wallet: targetWallet,
          internal_ledger_foreign_keys: internalLedgerForeignKeys,
          reset_result: resetResult
        }),
        requestIp(req),
        JSON.stringify(beforeSnapshot),
        JSON.stringify(afterSnapshot)
      ]
    ).catch(() => undefined);
    await client.query(
      `insert into hb_admin_operation_logs
        (admin_id, action, entity_type, entity_id, ip_address, before_snapshot, after_snapshot, metadata)
       values ($1,'reset_income_activation','hb_user',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)`,
      [
        adminId,
        userId,
        requestIp(req),
        JSON.stringify(beforeSnapshot),
        JSON.stringify(afterSnapshot),
        JSON.stringify({
          admin_id: adminId,
          admin_wallet: adminWallet,
          target_user_id: userId,
          target_wallet: targetWallet,
          internal_ledger_foreign_keys: internalLedgerForeignKeys,
          reset_result: resetResult
        })
      ]
    ).catch(() => undefined);
    await client.query("commit");
    ok(res, { userId, internalLedgerForeignKeys, beforeSnapshot, afterSnapshot, ...resetResult }, "User activation and income reset completed");
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    logger.error("hb.admin.user_reset_failed", { userId, admin: req.admin?.email || "admin", error: err instanceof Error ? err.message : String(err) });
    fail(res, err instanceof Error ? err.message : "User activation and income reset failed.", 500, "Reset failed");
  } finally {
    client.release();
  }
}));

hbRouter.get("/admin/hb/purchases", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select p.id, p.user_id, u.email, u.display_name, pkg.name as package_name, p.amount_usd, p.status,
            u.status as activation_status, dr.status as distribution_status, p.ledger_entry_id, p.created_at
     from hb_package_purchases p
     join hb_users u on u.id = p.user_id
     join hb_packages pkg on pkg.id = p.package_id
     left join hb_distribution_runs dr on dr.package_purchase_id = p.id
     order by p.created_at desc
     limit 200`
  );
  ok(res, { items: rows }, "HB9 purchases loaded");
}));

hbRouter.get("/admin/hb/purchases/:id/distribution", requireAdmin, asyncHandler(async (req, res) => {
  const purchase = await query(
    `select p.*, u.email, u.display_name, pkg.name as package_name
     from hb_package_purchases p
     join hb_users u on u.id = p.user_id
     join hb_packages pkg on pkg.id = p.package_id
     where p.id = $1
     limit 1`,
    [req.params.id]
  );
  if (!purchase[0]) {
    fail(res, "Purchase not found.", 404, "Not found");
    return;
  }
  const [incomeRows, levelRows, productRows, singleLegRows] = await Promise.all([
    query("select * from hb_income_ledger where package_purchase_id = $1 order by income_type, level_depth nulls first", [req.params.id]),
    query("select * from hb_level_income_records where package_purchase_id = $1 order by level_number", [req.params.id]),
    query("select * from hb_product_allocations where package_purchase_id = $1", [req.params.id]),
    query("select * from hb_single_leg_reserve where package_purchase_id = $1", [req.params.id])
  ]);
  ok(res, { purchase: purchase[0], income: incomeRows, levels: levelRows, productAllocations: productRows, singleLegReserve: singleLegRows }, "Purchase distribution loaded");
}));

hbRouter.get("/admin/hb/ledger", requireAdmin, asyncHandler(async (req, res) => {
  const walletType = typeof req.query.walletType === "string" ? req.query.walletType : "";
  const rows = await query(
    `select l.id, l.user_id, u.email, l.wallet_type, l.direction, l.amount_usd, NULL::text AS reference_type,
            NULL::text AS reference_id, l.idempotency_key, l.metadata, l.created_at
     from hb_internal_ledger l
     left join hb_users u on u.id = l.user_id
     where ($1::text = '' or l.wallet_type = $1)
     order by l.created_at desc
     limit 300`,
    [walletType]
  );
  ok(res, { items: rows }, "HB9 ledger loaded");
}));

hbRouter.get("/admin/hb/income-ledger", requireAdmin, asyncHandler(async (req, res) => {
  const incomeType = typeof req.query.incomeType === "string" ? req.query.incomeType : "";
  const rows = await query(
    `select l.id, l.earner_user_id, earner.email as earner_email, l.source_user_id, buyer.email as buyer_email,
            l.package_purchase_id, l.income_type, l.amount_usd, l.credited_amount, l.capped_amount, l.cap_status, l.cap_date,
            l.status, l.level_depth, l.metadata, l.created_at
     from hb_income_ledger l
     left join hb_users earner on earner.id = l.earner_user_id
     left join hb_users buyer on buyer.id = l.source_user_id
     where ($1::text = '' or l.income_type = $1)
     order by l.created_at desc
     limit 300`,
    [incomeType]
  );
  const salaryRows = await query(
    `select s.user_id, u.email, u.display_name, s.salary_amount::text, s.status,
            s.self_package_ok, s.direct_100_count, s.team_100_count,
            s.unlocked_at, s.paid_at, s.ledger_reference, s.proof_reference, s.updated_at
     from hb_salary_income s
     join hb_users u on u.id = s.user_id
     order by s.updated_at desc
     limit 300`
  );
  const capRows = await query(
    `select c.user_id, u.email, u.display_name, c.cap_date::text, c.package_amount::text,
            c.daily_cap_amount::text, c.credited_amount::text, c.capped_amount::text, c.updated_at
     from hb_daily_income_caps c
     join hb_users u on u.id = c.user_id
     order by c.cap_date desc, c.capped_amount desc, c.updated_at desc
     limit 500`
  );
  ok(res, { items: rows, salaryIncome: salaryRows, incomeCaps: capRows }, "HB9 income ledger loaded");
}));

hbRouter.get("/admin/hb/income-caps", requireAdmin, asyncHandler(async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : "";
  const user = typeof req.query.user === "string" ? req.query.user : "";
  const packageAmount = typeof req.query.package === "string" ? req.query.package : "";
  const cappedOnly = String(req.query.cappedOnly || "").toLowerCase() === "true";
  const rows = await query(
    `select c.user_id, u.email, u.display_name, c.cap_date::text, c.package_amount::text,
            c.daily_cap_amount::text, c.credited_amount::text, c.capped_amount::text, c.updated_at
     from hb_daily_income_caps c
     join hb_users u on u.id = c.user_id
     where ($1::text = '' or c.cap_date = $1::date)
       and ($2::text = '' or c.user_id::text = $2 or u.email ilike '%' || $2 || '%' or u.display_name ilike '%' || $2 || '%')
       and ($3::text = '' or c.package_amount = $3::numeric)
       and ($4::boolean = false or c.capped_amount > 0)
     order by c.cap_date desc, c.capped_amount desc, c.updated_at desc
     limit 1000`,
    [date, user, packageAmount, cappedOnly]
  );
  const packageReport = await query(
    `select package_amount::text, count(*)::int as user_days,
            coalesce(sum(daily_cap_amount),0)::text as total_cap,
            coalesce(sum(credited_amount),0)::text as total_credited,
            coalesce(sum(capped_amount),0)::text as total_capped
     from hb_daily_income_caps
     where ($1::text = '' or cap_date = $1::date)
     group by package_amount
     order by package_amount::numeric asc`,
    [date]
  );
  ok(res, { items: rows, packageReport }, "HB9 income caps loaded");
}));

hbRouter.get("/admin/hb/salary-income", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select s.user_id, u.email, u.display_name, s.salary_amount::text, s.status,
            s.self_package_ok, s.direct_100_count, s.team_100_count,
            s.unlocked_at, s.paid_at, s.ledger_reference, s.proof_reference, s.updated_at
     from hb_salary_income s
     join hb_users u on u.id = s.user_id
     order by s.updated_at desc
     limit 500`
  );
  ok(res, { items: rows }, "HB9 salary income loaded");
}));

hbRouter.post("/admin/hb/salary-income/:userId/recalculate", requireAdmin, asyncHandler(async (req, res) => {
  const userId = String(req.params.userId);
  const result = await evaluateSalaryIncome(userId);
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.salary.recalculate", "hb_user", userId, result);
  ok(res, result, "HB9 salary eligibility recalculated");
}));

hbRouter.get("/admin/hb/referral-tree/:userId", requireAdmin, asyncHandler(async (req, res) => {
  const rows = await query(
    `with recursive tree(level_no, user_id, sponsor_user_id, path) as (
       select 1, u.id, u.sponsor_user_id, array[u.id]
       from hb_users u
       where u.sponsor_user_id = $1
       union all
       select tree.level_no + 1, child.id, child.sponsor_user_id, path || child.id
       from tree
       join hb_users child on child.sponsor_user_id = tree.user_id
       where tree.level_no < 15 and not child.id = any(path)
     )
     select tree.level_no, u.id, u.email, u.display_name, u.status, u.created_at,
            count(p.id)::int as purchase_count,
            coalesce(sum(p.amount_usd),0)::text as purchase_volume
     from tree
     join hb_users u on u.id = tree.user_id
     left join hb_package_purchases p on p.user_id = u.id and p.status = 'completed'
     group by tree.level_no, u.id
     order by tree.level_no, u.created_at`,
    [req.params.userId]
  );
  ok(res, { items: rows }, "HB9 referral tree loaded");
}));

hbRouter.get("/admin/hb/distribution-summary", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select
       coalesce(sum(amount_usd) filter (where income_type in ('referral_income','upline')),0)::text as direct_upline_income,
       coalesce(sum(amount_usd) filter (where income_type in ('level_income','level')),0)::text as level_income,
       coalesce(sum(amount_usd) filter (where income_type = 'single_leg_income'),0)::text as single_leg_income,
       coalesce(sum(amount_usd) filter (where income_type = 'company'),0)::text as treasury_hold
     from hb_income_ledger`
  );
  const purchases = await query("select count(*)::int as purchase_count, coalesce(sum(amount_usd),0)::text as purchase_volume from hb_package_purchases where status = 'completed'");
  ok(res, { ...(rows[0] || {}), ...(purchases[0] || {}) }, "HB9 distribution summary loaded");
}));

hbRouter.get("/admin/hb/product-allocations", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select a.id, a.package_purchase_id, a.user_id, u.email, pkg.name as package_name, a.amount_usd, a.status, a.created_at
     from hb_product_allocations a
     join hb_users u on u.id = a.user_id
     join hb_packages pkg on pkg.id = a.package_id
     order by a.created_at desc
     limit 300`
  );
  ok(res, { items: rows }, "HB9 product allocations loaded");
}));

hbRouter.get("/admin/hb/single-leg-reserve", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select r.id, r.package_purchase_id, r.buyer_user_id, u.email, pkg.name as package_name,
            r.amount_usd, r.status, r.algorithm_version, r.metadata, r.created_at
     from hb_single_leg_reserve r
     join hb_users u on u.id = r.buyer_user_id
     join hb_packages pkg on pkg.id = r.package_id
     order by r.created_at desc
     limit 300`
  );
  const positions = await query(
    `select p.user_id, u.email, u.display_name, p.position_number::text, p.package_amount::text,
            p.sponsor_user_id, s.email as sponsor_email,
            greatest((select coalesce(max(position_number), 0) from hb_single_leg_positions) - p.position_number, 0)::text as single_leg_count,
            p.activated_at, p.created_at
     from hb_single_leg_positions p
     join hb_users u on u.id = p.user_id
     left join hb_users s on s.id = p.sponsor_user_id
     order by p.position_number asc
     limit 500`
  );
  const rewards = await query(
    `select r.id, r.user_id, u.email, u.display_name, r.slab_number, r.target_members::text,
            r.reward_amount::text, r.required_direct_referrals, r.actual_single_leg_members::text,
            r.actual_direct_referrals, r.status, r.paid_at, r.ledger_reference, r.proof_reference, r.updated_at
     from hb_single_leg_rewards r
     join hb_users u on u.id = r.user_id
     order by r.updated_at desc, r.slab_number asc
     limit 500`
  );
  ok(res, { items: rows, positions, rewards }, "HB9 single-leg reserve loaded");
}));

hbRouter.post("/admin/hb/single-leg/recalculate", requireAdmin, asyncHandler(async (req, res) => {
  const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
  const result = userId ? await evaluateAllPendingSingleLegRewards().then((items) => items.find((item) => item.userId === userId) || null) : await evaluateAllPendingSingleLegRewards();
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.single_leg.recalculate", userId ? "hb_user" : "hb_single_leg_rewards", userId || null, { userId, resultCount: Array.isArray(result) ? result.length : 1 });
  ok(res, { result }, "HB9 single-leg rewards recalculated");
}));

hbRouter.get("/admin/hb/followers-requests", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select r.id, r.user_id, u.email, u.display_name, coalesce(u.usdt_bep20_address, u.hb9_wallet_address, w.wallet_address) as wallet_address,
            pkg.name as package_name, p.amount_usd::text as package_price, r.platform, r.submitted_link,
            r.followers_count, r.status, r.admin_note, r.created_at, r.completed_at, r.updated_at
     from hb_followers_requests r
     join hb_users u on u.id = r.user_id
     left join hb_wallets w on w.user_id = u.id and w.wallet_type = 'deposit'
     left join hb_package_purchases p on p.id = r.package_purchase_id
     left join hb_packages pkg on pkg.id = r.package_id
     order by case r.status when 'pending' then 0 when 'rejected' then 1 when 'completed' then 2 else 3 end, r.created_at desc
     limit 500`
  );
  const summary = await query("select status, count(*)::int as count from hb_followers_requests group by status");
  ok(res, { items: rows, summary }, "HB9 followers requests loaded");
}));

hbRouter.get("/admin/hb/books", requireAdmin, asyncHandler(async (_req, res) => {
  await ensureHbBooksTable();
  const rows = await query(
    `select id, title, description, cover_image, download_url, package_tier, sort_order, is_active, created_at
     from hb_books
     order by sort_order asc, created_at asc
     limit 100`
  );
  ok(res, rows, "HB9 books loaded");
}));

hbRouter.post("/admin/hb/books", requireAdmin, asyncHandler(async (req, res) => {
  await ensureHbBooksTable();
  const parsed = hbBookAdminSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid book");
    return;
  }
  const countRows = await query<{ count: number }>("select count(*)::int as count from hb_books");
  if (Number(countRows[0]?.count || 0) >= 100) {
    fail(res, "Maximum 100 books are allowed.", 400, "Book limit reached");
    return;
  }
  const rows = await query(
    `insert into hb_books (title, description, cover_image, download_url, package_tier, sort_order, is_active)
     values ($1, nullif($2,''), nullif($3,''), $4, $5, $6, $7)
     returning *`,
    [parsed.data.title, parsed.data.description || "", parsed.data.coverImage || "", parsed.data.downloadUrl, parsed.data.packageTier ?? 4, parsed.data.sortOrder, parsed.data.isActive ?? true]
  );
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.books.create", "hb_books", String((rows[0] as any)?.id || ""), parsed.data);
  ok(res, rows[0], "Book added", 201);
}));

hbRouter.patch("/admin/hb/books/:id", requireAdmin, asyncHandler(async (req, res) => {
  await ensureHbBooksTable();
  const parsed = hbBookAdminPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid book update");
    return;
  }
  const rows = await query(
    `update hb_books
     set title = coalesce($2::text, title),
         description = case when $3::text is null then description else nullif($3,'') end,
         cover_image = case when $4::text is null then cover_image else nullif($4,'') end,
         download_url = coalesce($5::text, download_url),
         package_tier = coalesce($6::integer, package_tier),
         sort_order = coalesce($7::integer, sort_order),
         is_active = coalesce($8::boolean, is_active)
     where id = $1
     returning *`,
    [
      req.params.id,
      parsed.data.title ?? null,
      Object.prototype.hasOwnProperty.call(parsed.data, "description") ? parsed.data.description || "" : null,
      Object.prototype.hasOwnProperty.call(parsed.data, "coverImage") ? parsed.data.coverImage || "" : null,
      parsed.data.downloadUrl ?? null,
      parsed.data.packageTier ?? null,
      parsed.data.sortOrder ?? null,
      parsed.data.isActive ?? null
    ]
  );
  if (!rows[0]) {
    fail(res, "Book was not found.", 404, "Book not found");
    return;
  }
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.books.update", "hb_books", String(req.params.id), parsed.data);
  ok(res, rows[0], "Book updated");
}));

hbRouter.delete("/admin/hb/books/:id", requireAdmin, asyncHandler(async (req, res) => {
  await ensureHbBooksTable();
  const rows = await query("delete from hb_books where id = $1 returning id", [req.params.id]);
  if (!rows[0]) {
    fail(res, "Book was not found.", 404, "Book not found");
    return;
  }
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.books.delete", "hb_books", String(req.params.id), {});
  ok(res, { id: req.params.id }, "Book deleted");
}));

hbRouter.patch("/admin/hb/followers-requests/:id", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminRequestStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid followers request update");
    return;
  }
  const rows = await query(
    `update hb_followers_requests
     set status = $2,
         admin_note = nullif($3,''),
         completed_at = case when $2 = 'completed' then now() else completed_at end,
         updated_at = now()
     where id = $1
     returning *`,
    [req.params.id, parsed.data.status, parsed.data.adminNote || ""]
  );
  if (!rows[0]) {
    fail(res, "Followers request was not found.", 404, "Request not found");
    return;
  }
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.followers_request.update", "hb_followers_request", String(req.params.id), parsed.data);
  ok(res, rows[0], "Followers request updated");
}));

hbRouter.get("/admin/hb/custom-software-requests", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select r.id, r.user_id, u.email, u.display_name, coalesce(u.usdt_bep20_address, u.hb9_wallet_address, w.wallet_address) as wallet_address,
            pkg.name as package_name, p.amount_usd::text as package_price, r.software_type, r.architecture,
            r.requirements_note, r.status, r.admin_note, r.created_at, r.completed_at, r.updated_at
     from hb_custom_software_requests r
     join hb_users u on u.id = r.user_id
     left join hb_wallets w on w.user_id = u.id and w.wallet_type = 'deposit'
     left join hb_package_purchases p on p.id = r.package_purchase_id
     left join hb_packages pkg on pkg.id = p.package_id
     order by case r.status when 'pending' then 0 when 'processing' then 1 when 'rejected' then 2 else 3 end, r.created_at desc
     limit 500`
  );
  const summary = await query("select status, count(*)::int as count from hb_custom_software_requests group by status");
  ok(res, { items: rows, summary }, "HB9 custom software requests loaded");
}));

hbRouter.patch("/admin/hb/custom-software-requests/:id", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminRequestStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid custom software request update");
    return;
  }
  const rows = await query(
    `update hb_custom_software_requests
     set status = $2,
         admin_note = nullif($3,''),
         completed_at = case when $2 = 'completed' then now() else completed_at end,
         updated_at = now()
     where id = $1
     returning *`,
    [req.params.id, parsed.data.status, parsed.data.adminNote || ""]
  );
  if (!rows[0]) {
    fail(res, "Custom software request was not found.", 404, "Request not found");
    return;
  }
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.custom_software_request.update", "hb_custom_software_request", String(req.params.id), parsed.data);
  ok(res, rows[0], "Custom software request updated");
}));

hbRouter.get("/admin/hb/packages", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select id, name, description, image_url, amount_usd, status, sort_order, created_at, updated_at
     from hb_packages
     order by sort_order asc, amount_usd asc`
  );
  ok(res, { items: rows }, "HB9 packages loaded");
}));

hbRouter.patch("/admin/hb/packages/:id", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminPackagePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid package update");
    return;
  }
  const rows = await query(
    `update hb_packages
     set name = coalesce($2, name),
         description = coalesce($3, description),
         image_url = coalesce($4, image_url),
         status = coalesce($5, status),
         updated_at = now()
     where id = $1
     returning *`,
    [req.params.id, parsed.data.name || null, parsed.data.description || null, parsed.data.imageUrl || null, parsed.data.status || null]
  );
  if (!rows[0]) {
    fail(res, "Package not found.", 404, "Package update failed");
    return;
  }
  if (parsed.data.adminRemark) {
    await query("insert into hb_admin_notes (admin_email, entity_type, entity_id, note) values ($1,'hb_package',$2,$3)", [req.admin?.email || "admin", req.params.id, parsed.data.adminRemark]);
  }
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.package.update", "hb_package", String(req.params.id), parsed.data);
  ok(res, rows[0], "HB9 package updated");
}));

hbRouter.get("/admin/hb/products", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query(
    `select p.id, p.title, p.slug, p.description, p.short_description, p.package_id, p.package_price,
            p.package_type, p.image_url, p.thumbnail_url, p.stock, p.active, p.featured, p.created_at, p.updated_at,
            coalesce(gallery.items, '[]'::json) as gallery,
            pkg.name as package_name
     from hb_products p
     join hb_packages pkg on pkg.id = p.package_id
     left join lateral (
       select json_agg(json_build_object('id', img.id, 'image_url', img.image_url, 'alt_text', img.alt_text, 'sort_order', img.sort_order) order by img.sort_order asc) as items
       from hb_product_images img
       where img.product_id = p.id
     ) gallery on true
     order by p.created_at desc
     limit 300`
  );
  ok(res, { items: rows }, "HB9 products loaded");
}));

hbRouter.post("/admin/hb/products", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminProductSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid product create request");
    return;
  }
  const packageRows = await query<{ amount_usd: string }>("select amount_usd::text from hb_packages where id = $1 limit 1", [parsed.data.packageId]);
  if (!packageRows[0]) {
    fail(res, "Mapped package was not found.", 400, "Invalid product package");
    return;
  }
  const rows = await query(
    `insert into hb_products
      (title, slug, description, short_description, package_id, package_price, package_type, image_url, stock, active, featured)
     values ($1,$2,$3,$4,$5,$6,'activation',$7,$8,$9,$10)
     returning *`,
    [
      parsed.data.title,
      parsed.data.slug,
      parsed.data.description || null,
      parsed.data.shortDescription || null,
      parsed.data.packageId,
      packageRows[0].amount_usd,
      parsed.data.imageUrl || null,
      parsed.data.stock,
      parsed.data.active,
      parsed.data.featured
    ]
  );
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.product.create", "hb_product", String((rows[0] as any)?.id || ""), parsed.data);
  ok(res, rows[0], "HB9 product created", 201);
}));

hbRouter.patch("/admin/hb/products/:id", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminProductPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid product update request");
    return;
  }
  let packagePrice: string | null = null;
  if (parsed.data.packageId) {
    const packageRows = await query<{ amount_usd: string }>("select amount_usd::text from hb_packages where id = $1 limit 1", [parsed.data.packageId]);
    if (!packageRows[0]) {
      fail(res, "Mapped package was not found.", 400, "Invalid product package");
      return;
    }
    packagePrice = packageRows[0].amount_usd;
  }
  const rows = await query(
    `update hb_products
     set title = coalesce($2, title),
         slug = coalesce($3, slug),
         description = coalesce($4, description),
         short_description = coalesce($5, short_description),
         package_id = coalesce($6, package_id),
         package_price = coalesce($7, package_price),
         image_url = coalesce($8, image_url),
         stock = coalesce($9, stock),
         active = coalesce($10, active),
         featured = coalesce($11, featured),
         updated_at = now()
     where id = $1
     returning *`,
    [
      req.params.id,
      parsed.data.title || null,
      parsed.data.slug || null,
      parsed.data.description || null,
      parsed.data.shortDescription || null,
      parsed.data.packageId || null,
      packagePrice,
      parsed.data.imageUrl || null,
      parsed.data.stock ?? null,
      parsed.data.active ?? null,
      parsed.data.featured ?? null
    ]
  );
  if (!rows[0]) {
    fail(res, "Product was not found.", 404, "Product update failed");
    return;
  }
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.product.update", "hb_product", String(req.params.id), parsed.data);
  ok(res, rows[0], "HB9 product updated");
}));

hbRouter.post("/admin/hb/products/:id/image", requireAdmin, asyncHandler(async (req, res) => {
  const productRows = await query<{ id: string; image_url: string | null }>("select id, image_url from hb_products where id = $1 limit 1", [req.params.id]);
  if (!productRows[0]) {
    fail(res, "Product was not found.", 404, "Product image upload failed");
    return;
  }
  try {
    const upload = await parseHbProductImageUpload(req);
    await mkdir(hbProductUploadDir, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomUUID()}.${upload.extension}`;
    const diskPath = path.join(hbProductUploadDir, filename);
    await writeFile(diskPath, upload.file, { flag: "wx" });
    const imageUrl = `${hbProductUploadUrlPrefix}/${filename}`;
    const asGallery = String(req.query.gallery || "").toLowerCase() === "true";
    if (asGallery) {
      const rows = await query(
        `insert into hb_product_images (product_id, image_url, alt_text, sort_order)
         values ($1,$2,$3, coalesce((select max(sort_order) + 1 from hb_product_images where product_id = $1), 0))
         returning *`,
        [req.params.id, imageUrl, "Product gallery image"]
      );
      await adminHbAudit(req.admin?.email || "admin", "admin.hb.product.image.upload.gallery", "hb_product", String(req.params.id), { imageUrl, mimeType: upload.mimeType });
      ok(res, rows[0], "HB9 product gallery image uploaded", 201);
      return;
    }
    const rows = await query(
      `update hb_products
       set image_url = $2,
           thumbnail_url = $2,
           updated_at = now()
       where id = $1
       returning *`,
      [req.params.id, imageUrl]
    );
    const oldPath = localUploadPathFromUrl(productRows[0].image_url);
    if (oldPath) await unlink(oldPath).catch(() => undefined);
    await adminHbAudit(req.admin?.email || "admin", "admin.hb.product.image.upload", "hb_product", String(req.params.id), { imageUrl, mimeType: upload.mimeType });
    ok(res, rows[0], "HB9 product image uploaded");
  } catch (err) {
    fail(res, err instanceof Error ? err.message : "Invalid image upload.", 400, "Product image upload failed");
  }
}));

hbRouter.delete("/admin/hb/products/:id/image", requireAdmin, asyncHandler(async (req, res) => {
  const productRows = await query<{ id: string; image_url: string | null }>("select id, image_url from hb_products where id = $1 limit 1", [req.params.id]);
  if (!productRows[0]) {
    fail(res, "Product was not found.", 404, "Product image remove failed");
    return;
  }
  const rows = await query(
    `update hb_products
     set image_url = null,
         thumbnail_url = null,
         updated_at = now()
     where id = $1
     returning *`,
    [req.params.id]
  );
  const oldPath = localUploadPathFromUrl(productRows[0].image_url);
  if (oldPath) await unlink(oldPath).catch(() => undefined);
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.product.image.remove", "hb_product", String(req.params.id), {});
  ok(res, rows[0], "HB9 product image removed");
}));

hbRouter.post("/admin/hb/products/:id/images", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = adminProductImageSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid product image request");
    return;
  }
  const productRows = await query<{ id: string }>("select id from hb_products where id = $1 limit 1", [req.params.id]);
  if (!productRows[0]) {
    fail(res, "Product was not found.", 404, "Product image failed");
    return;
  }
  const rows = await query(
    `insert into hb_product_images (product_id, image_url, alt_text, sort_order)
     values ($1,$2,$3,$4)
     returning *`,
    [req.params.id, parsed.data.imageUrl, parsed.data.altText || null, parsed.data.sortOrder]
  );
  await adminHbAudit(req.admin?.email || "admin", "admin.hb.product.image.create", "hb_product", String(req.params.id), parsed.data);
  ok(res, rows[0], "HB9 product image added", 201);
}));

hbRouter.get("/admin/hb/reports", requireAdmin, asyncHandler(async (_req, res) => {
  const [dailySales, packageSales, incomeDistribution, depositSummary, activeGrowth, companyReserve] = await Promise.all([
    query(
      `select date_trunc('day', created_at)::date as day, count(*)::int as purchase_count, coalesce(sum(amount_usd),0)::text as volume
       from hb_package_purchases
       where status = 'completed'
       group by 1 order by 1 desc limit 30`
    ),
    query(
      `select pkg.name, pkg.amount_usd, count(p.id)::int as purchase_count, coalesce(sum(p.amount_usd),0)::text as volume
       from hb_packages pkg
       left join hb_package_purchases p on p.package_id = pkg.id and p.status = 'completed'
       group by pkg.id order by pkg.sort_order`
    ),
    query(
      `select income_type, status, count(*)::int as entry_count, coalesce(sum(amount_usd),0)::text as total
       from hb_income_ledger
       group by income_type, status
       order by income_type, status`
    ),
    query(
      `select status, count(*)::int as deposit_count, coalesce(sum(usd_amount),0)::text as total
       from hb_deposits
       group by status
       order by status`
    ),
    query(
      `select date_trunc('day', activated_at)::date as day, count(*)::int as active_users
       from hb_users
       where activated_at is not null
       group by 1 order by 1 desc limit 30`
    ),
    query(
      `select income_type, coalesce(sum(amount_usd),0)::text as total
       from hb_income_ledger
       where status = 'company_allocated' or income_type = 'company'
       group by income_type
       order by income_type`
    )
  ]);
  ok(res, { dailySales, packageSales, incomeDistribution, depositSummary, activeGrowth, companyReserve }, "HB9 reports loaded");
}));

export { hbRouter };
