import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { computeAddress, getAddress, isAddress } from "ethers";

const serverEnvFile = process.env.NODE_ENV === "production" ? "server/.env.production" : "server/.env";
const serverEnvPath = resolve(process.cwd(), serverEnvFile);
const rootEnvFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env";
const rootEnvPath = resolve(process.cwd(), rootEnvFile);

if (existsSync(serverEnvPath)) {
  loadEnv({ path: serverEnvPath, quiet: true });
}

if (existsSync(rootEnvPath)) {
  loadEnv({ path: rootEnvPath, quiet: true });
}
loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true });

const defaultAdminSessionSecret = "hb9-admin-dev-secret";
const rawAdminSessionSecret = process.env.HB_SESSION_SECRET || process.env.JWT_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD_HASH || defaultAdminSessionSecret;
const usdtBep20MainnetAddress = "0x55d398326f99059fF775485246999027B3197955";
const hbTreasuryDepositAddress = process.env.BSC_TREASURY_WALLET || process.env.HB9_COMPANY_RECEIVING_WALLET_BSC || process.env.NEXT_PUBLIC_BSC_TREASURY_WALLET || process.env.HB_TREASURY_DEPOSIT_ADDRESS || process.env.COMPANY_EVM_RECEIVE_ADDRESS || "";
const hbRegistrationTreasuryWallet = process.env.HB9_TREASURY_WALLET || hbTreasuryDepositAddress;
const hbWithdrawalVaultAddress = process.env.HB_WITHDRAWAL_VAULT_ADDRESS || process.env.HB_WITHDRAWAL_TREASURY_ADDRESS || "";
const defaultHbOnchainIndexerBlockStep = process.env.NODE_ENV === "production" ? 100 : 500;
const bscRpcUrls = [
  process.env.BSC_MAINNET_RPC_URL,
  process.env.BSC_RPC_URL,
  "https://bsc-mainnet.public.blastapi.io",
  "https://bsc-dataseed1.binance.org"
].map((item) => (item || "").trim()).filter((item, index, list) => item && list.indexOf(item) === index);

if (process.env.NODE_ENV === "production") {
  if (!process.env.ADMIN_SESSION_SECRET || rawAdminSessionSecret === defaultAdminSessionSecret) {
    throw new Error("ADMIN_SESSION_SECRET must be configured with a non-default value in production.");
  }
}

export const config = {
  port: Number(process.env.PORT || process.env.API_PORT || 4000),
  host: process.env.HOST || process.env.API_HOST || (process.env.NODE_ENV === "production" ? "127.0.0.1" : ""),
  databaseUrl: process.env.DATABASE_URL || "",
  rechargeProvider: process.env.RECHARGE_PROVIDER || (process.env.NODE_ENV === "production" ? "" : "mock"),
  reloadlyClientId: process.env.RELOADLY_CLIENT_ID || "",
  reloadlyClientSecret: process.env.RELOADLY_CLIENT_SECRET || "",
  dtOneApiKey: process.env.DTONE_API_KEY || "",
  dtOneApiSecret: process.env.DTONE_API_SECRET || "",
  dingApiKey: process.env.DING_API_KEY || "",
  autoRefundEnabled: process.env.AUTO_REFUND_ENABLED === "true",
  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
  adminSessionSecret: rawAdminSessionSecret,
  companyEvmReceiveAddress: hbTreasuryDepositAddress,
  hbTreasuryDepositAddress,
  hb9RegistrationFeeUsd: Number(process.env.HB9_REGISTRATION_FEE_USD || 0.05),
  hb9TreasuryWallet: hbRegistrationTreasuryWallet,
  hb9BnbUsdPrice: Number(process.env.HB9_BNB_USD_PRICE || process.env.BNB_USD_PRICE || 600),
  usdtBep20Contract: process.env.HB9_USDT_BEP20_ADDRESS || process.env.USDT_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_USDT_TOKEN_ADDRESS || process.env.USDT_BEP20_CONTRACT || process.env.NEXT_PUBLIC_USDT_BEP20_ADDRESS || usdtBep20MainnetAddress,
  bscRpcUrl: bscRpcUrls[0] || process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed1.binance.org",
  bscRpcUrls: bscRpcUrls.length ? bscRpcUrls : ["https://bsc-mainnet.public.blastapi.io", "https://bsc-dataseed1.binance.org"],
  ethRpcUrl: process.env.ETH_RPC_URL || process.env.NEXT_PUBLIC_ETH_RPC_URL || "",
  polygonRpcUrl: process.env.POLYGON_RPC_URL || process.env.NEXT_PUBLIC_POLYGON_RPC_URL || "",
  rechargeWebhookSecret: process.env.RECHARGE_WEBHOOK_SECRET || "",
  minBlockConfirmations: Number(process.env.MIN_BLOCK_CONFIRMATIONS || 3),
  frontendUrl: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "",
  corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 120),
  hbBypassAuth: process.env.HB_BYPASS_AUTH === "true" || process.env.NEXT_PUBLIC_HB_BYPASS_AUTH === "true"
  ,
  nowPaymentsApiKey: process.env.NOWPAYMENTS_API_KEY || "",
  nowPaymentsIpnSecret: process.env.NOWPAYMENTS_IPN_SECRET || "",
  nowPaymentsBaseUrl: process.env.NOWPAYMENTS_BASE_URL || "https://api.nowpayments.io/v1",
  nowPaymentsSuccessUrl: process.env.NOWPAYMENTS_SUCCESS_URL || "",
  nowPaymentsCancelUrl: process.env.NOWPAYMENTS_CANCEL_URL || "",
  nowPaymentsMockEnabled: process.env.NOWPAYMENTS_MOCK_ENABLED === "true",
  hbWithdrawalDailyLimitUsd: Number(process.env.HB_WITHDRAWAL_DAILY_LIMIT_USD || 10000)
  ,
  hbPackagePurchaseMode: (process.env.HB_PACKAGE_PURCHASE_MODE || "onchain").toLowerCase(),
  hbProductPurchaseDebitsCoinUsdt: process.env.HB_PRODUCT_PURCHASE_DEBITS_COIN_USDT === "true",
  hbOnchainDryRun: process.env.HB_ONCHAIN_DRY_RUN === "true",
  hbOnchainIndexerEnabled: process.env.HB_ONCHAIN_INDEXER_ENABLED === "true",
  hbOnchainIndexerIntervalMs: Number(process.env.HB_ONCHAIN_INDEXER_INTERVAL_MS || 15000),
  hbOnchainIndexerConfirmations: Number(process.env.HB_ONCHAIN_INDEXER_CONFIRMATIONS || 3),
  hbOnchainIndexerBlockStep: Number(process.env.HB_ONCHAIN_INDEXER_BLOCK_STEP || defaultHbOnchainIndexerBlockStep),
  hbDepositIndexerEnabled: process.env.HB_DEPOSIT_INDEXER_ENABLED !== "false",
  hbDepositIndexerIntervalMs: Number(process.env.HB_DEPOSIT_INDEXER_INTERVAL_MS || process.env.HB_ONCHAIN_INDEXER_INTERVAL_MS || 15000),
  hbDepositIndexerConfirmations: Number(process.env.HB_DEPOSIT_INDEXER_CONFIRMATIONS || process.env.HB_ONCHAIN_INDEXER_CONFIRMATIONS || process.env.MIN_BLOCK_CONFIRMATIONS || 3),
  hbDepositIndexerBlockStep: Number(process.env.HB_DEPOSIT_INDEXER_BLOCK_STEP || process.env.HB_ONCHAIN_INDEXER_BLOCK_STEP || defaultHbOnchainIndexerBlockStep),
  hbMainnetSafeMode: process.env.HB_MAINNET_SAFE_MODE !== "false",
  hbMultisigReady: process.env.HB_MULTISIG_READY === "true",
  hbMultisigOwnerAddress: process.env.HB_MULTISIG_OWNER_ADDRESS || process.env.MULTISIG_OWNER_ADDRESS || "",
  hbChainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.NEXT_PUBLIC_HB_CHAIN_ID || process.env.HB_CHAIN_ID || 56),
  hbPackageManagerAddress: process.env.HB_PACKAGE_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_HB_PACKAGE_MANAGER_ADDRESS || "",
  hbReferralRegistryAddress: process.env.HB_REFERRAL_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_HB_REFERRAL_REGISTRY_ADDRESS || "",
  hbTreasurySplitterAddress: process.env.HB_TREASURY_SPLITTER_ADDRESS || process.env.NEXT_PUBLIC_HB_TREASURY_SPLITTER_ADDRESS || "",
  hbIncomeDistributorAddress: process.env.HB_INCOME_DISTRIBUTOR_ADDRESS || process.env.NEXT_PUBLIC_HB_INCOME_DISTRIBUTOR_ADDRESS || "",
  hbUsdtAddress: process.env.HB9_USDT_BEP20_ADDRESS || process.env.NEXT_PUBLIC_HB_USDT_ADDRESS || process.env.USDT_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_USDT_TOKEN_ADDRESS || process.env.USDT_BEP20_CONTRACT || process.env.NEXT_PUBLIC_USDT_BEP20_ADDRESS || "",
  hbExplorerBaseUrl: process.env.HB_EXPLORER_BASE_URL || process.env.NEXT_PUBLIC_BSCSCAN_URL || "https://bscscan.com",
  hbOnchainStartBlock: Number(process.env.HB_ONCHAIN_START_BLOCK || 0)
  ,
  hbWithdrawalSignerPrivateKey: process.env.HB_WITHDRAWAL_SIGNER_PRIVATE_KEY || process.env.HB_PAYOUT_PRIVATE_KEY || "",
  hbWithdrawalProviderEnabled: process.env.HB_WITHDRAWAL_PROVIDER_ENABLED === "true",
  hbWithdrawalVaultAddress,
  hbWithdrawalTreasuryAddress: hbWithdrawalVaultAddress,
  hbWithdrawalMockEnabled: false,
  hbRolloutMode: (process.env.HB_ROLLOUT_MODE || "closed_beta").toLowerCase(),
  hbDailyActivationLimit: Number(process.env.HB_DAILY_ACTIVATION_LIMIT || 25),
  hbLimitedLiveDailyActivationLimit: Number(process.env.HB_LIMITED_LIVE_DAILY_ACTIVATION_LIMIT || process.env.HB_DAILY_ACTIVATION_LIMIT || 25),
  hbWhitelistWallets: (process.env.HB_WHITELIST_WALLETS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
  hbWhitelistReferrals: (process.env.HB_WHITELIST_REFERRALS || "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean),
  hbAdminBypassWallets: (process.env.HB_ADMIN_BYPASS_WALLETS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
  hbRollbackMode: process.env.HB_ROLLBACK_MODE === "true",
  hbEmergencyPause: process.env.HB_EMERGENCY_PAUSE === "true",
  hbEmergencyIndexerStop: process.env.HB_EMERGENCY_INDEXER_STOP === "true",
  hbEmergencyActivationDisable: process.env.HB_EMERGENCY_ACTIVATION_DISABLE === "true",
  hbEmergencyWithdrawalFreeze: process.env.HB_EMERGENCY_WITHDRAWAL_FREEZE === "true",
  hbEmergencyDepositFreeze: process.env.HB_EMERGENCY_DEPOSIT_FREEZE === "true",
  hbEmergencyPackagePurchasePause: process.env.HB_EMERGENCY_PACKAGE_PURCHASE_PAUSE === "true",
  hbEmergencyCoinConversionDisable: process.env.HB_EMERGENCY_COIN_CONVERSION_DISABLE === "true",
  hbEmergencyFollowerRequestDisable: process.env.HB_EMERGENCY_FOLLOWER_REQUEST_DISABLE === "true",
  hbEmergencyTreasuryFreezeNotice: process.env.HB_EMERGENCY_TREASURY_FREEZE_NOTICE === "true"
};

function requireProductionEnv(name: string) {
  const value = process.env[name];
  const normalized = (value || "").trim().toLowerCase();
  const placeholderFragments = ["replace", "placeholder", "changeme", "change-me", "your_", "your-", "example.com", "api.example"];
  if (!value || !normalized || normalized.includes("<") || placeholderFragments.some((fragment) => normalized.includes(fragment))) {
    throw new Error(`${name} must be configured for production.`);
  }
  return value;
}

function requireProductionAddress(name: string) {
  const value = requireProductionEnv(name);
  if (!isAddress(value) || getAddress(value) === getAddress("0x0000000000000000000000000000000000000000")) {
    throw new Error(`${name} must be a valid non-zero BSC address for production.`);
  }
  return getAddress(value);
}

function requireWithdrawalSignerMatchesVault() {
  const signerKey = requireProductionEnv("HB_WITHDRAWAL_SIGNER_PRIVATE_KEY");
  const vaultAddress = process.env.HB_WITHDRAWAL_VAULT_ADDRESS ? requireProductionAddress("HB_WITHDRAWAL_VAULT_ADDRESS") : requireProductionAddress("HB_WITHDRAWAL_TREASURY_ADDRESS");
  try {
    if (getAddress(computeAddress(signerKey)) !== vaultAddress) {
      throw new Error("HB_WITHDRAWAL_SIGNER_PRIVATE_KEY must belong to HB_WITHDRAWAL_TREASURY_ADDRESS for direct server wallet payouts.");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("must belong")) throw err;
    throw new Error("HB_WITHDRAWAL_SIGNER_PRIVATE_KEY must be a valid EVM private key for production withdrawals.");
  }
}

if (process.env.NODE_ENV === "production") {
  [
    "DATABASE_URL",
    "JWT_SECRET",
    "ADMIN_PASSWORD_HASH",
    "FRONTEND_URL",
    "API_BASE_URL",
    "BSC_MAINNET_RPC_URL",
    "BSCSCAN_API_KEY",
    process.env.HB9_USDT_BEP20_ADDRESS ? "HB9_USDT_BEP20_ADDRESS" : "USDT_TOKEN_ADDRESS",
    process.env.BSC_TREASURY_WALLET ? "BSC_TREASURY_WALLET" : process.env.HB9_COMPANY_RECEIVING_WALLET_BSC ? "HB9_COMPANY_RECEIVING_WALLET_BSC" : process.env.NEXT_PUBLIC_BSC_TREASURY_WALLET ? "NEXT_PUBLIC_BSC_TREASURY_WALLET" : "HB_TREASURY_DEPOSIT_ADDRESS",
    "HB9_TREASURY_WALLET",
    process.env.HB_WITHDRAWAL_VAULT_ADDRESS ? "HB_WITHDRAWAL_VAULT_ADDRESS" : "HB_WITHDRAWAL_TREASURY_ADDRESS",
    "HB_PACKAGE_MANAGER_ADDRESS",
    "HB_REFERRAL_REGISTRY_ADDRESS",
    "HB_TREASURY_SPLITTER_ADDRESS",
    "HB_INCOME_DISTRIBUTOR_ADDRESS"
  ].forEach(requireProductionEnv);
  if (config.hbChainId !== 56) {
    throw new Error("NEXT_PUBLIC_HB_CHAIN_ID/HB_CHAIN_ID must be 56 for BSC Mainnet.");
  }
  if ((process.env.HB9_USDT_BEP20_ADDRESS || process.env.USDT_TOKEN_ADDRESS || "").toLowerCase() !== usdtBep20MainnetAddress.toLowerCase()) {
    throw new Error("HB9_USDT_BEP20_ADDRESS/USDT_TOKEN_ADDRESS must be BSC Mainnet USDT BEP20.");
  }
  requireProductionAddress(process.env.BSC_TREASURY_WALLET ? "BSC_TREASURY_WALLET" : process.env.HB9_COMPANY_RECEIVING_WALLET_BSC ? "HB9_COMPANY_RECEIVING_WALLET_BSC" : process.env.NEXT_PUBLIC_BSC_TREASURY_WALLET ? "NEXT_PUBLIC_BSC_TREASURY_WALLET" : "HB_TREASURY_DEPOSIT_ADDRESS");
  requireProductionAddress("HB9_TREASURY_WALLET");
  if (process.env.HB_WITHDRAWAL_VAULT_ADDRESS) requireProductionAddress("HB_WITHDRAWAL_VAULT_ADDRESS");
  else requireProductionAddress("HB_WITHDRAWAL_TREASURY_ADDRESS");
  if (config.hbWithdrawalProviderEnabled) {
    requireWithdrawalSignerMatchesVault();
  }
}
