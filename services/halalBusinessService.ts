type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  message: string;
  error: string | null;
};

export type HbUser = {
  id: string;
  email?: string | null;
  mobile_number?: string | null;
  display_name: string;
  referral_code: string;
  own_referral_code?: string | null;
  sponsor_referral_code?: string | null;
  source_referral_code?: string | null;
  hb9_wallet_address?: string | null;
  wallet_address?: string | null;
  usdt_bep20_address?: string | null;
  wallet_bound_at?: string | null;
  wallet_updated_at?: string | null;
  sponsor_user_id?: string | null;
  status: "inactive" | "active" | "suspended" | "blocked";
  activated_at?: string | null;
  last_login_at?: string | null;
  created_at?: string;
};

export type HbPackage = {
  id: string;
  name: string;
  amount_usd: string | number;
  price?: string | number;
  status: "available" | "disabled";
  sort_order: number;
  slug?: string | null;
  active?: boolean;
  visible?: boolean;
  network?: "BSC" | string | null;
  packageContractId?: number | null;
  onchainPackageId?: number | null;
};

export type HbCoinBalance = {
  coin_symbol: "USDT" | "BTC" | "BNB" | "HB9" | "PEPE" | "DOGE" | "SHIB" | "BTTC" | "ADA";
  name: string;
  symbol: string;
  balance: string | number;
  usd_price?: string | number | null;
  usd_value?: string | number | null;
  can_convert?: boolean;
  min_convert_usd?: string | number;
  updated_at?: string | null;
};

export type HbCoinLedgerEntry = {
  id: string;
  coin_symbol: string;
  amount: string | number;
  type: string;
  direction: "credit" | "debit";
  reference?: string | null;
  note?: string | null;
  created_at: string;
};

export type HbProduct = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  package_id: string;
  package_price: string | number;
  package_type: string;
  image_url?: string | null;
  thumbnail_url?: string | null;
  stock: number;
  active: boolean;
  featured: boolean;
  package_name: string;
  gallery?: Array<{ id: string; image_url: string; alt_text?: string; sort_order: number }>;
};

export type HbOrder = {
  id: string;
  order_number: string;
  amount_usd: string | number;
  payment_status: string;
  activation_status: string;
  distribution_status: string;
  created_at: string;
  product_title: string;
  package_price: string | number;
  package_name: string;
  product_slug: string;
  image_url?: string | null;
};

export type HbPurchase = {
  id: string;
  package_name: string;
  amount_usd: string | number;
  status: string;
  created_at: string;
  contract_purchase_tx_hash?: string | null;
  block_number?: number | null;
  log_index?: number | null;
  onchain_package_id?: number | null;
  onchain_buyer_address?: string | null;
  onchain_sponsor_address?: string | null;
  onchain_status?: string | null;
  onchain_tx_hash?: string | null;
  public_reference_id?: string | null;
  proof_hash?: string | null;
  proof_onchain_status?: string | null;
};

export type HbDeposit = {
  id: string;
  depositId?: string;
  network: string;
  asset: "USDT";
  amount: string | number;
  usd_amount: string | number;
  tx_hash?: string | null;
  wallet_address?: string | null;
  status: "pending" | "pending_verification" | "verified" | "rejected" | "failed";
  verification_status: string;
  failure_reason?: string | null;
  created_at: string;
  verified_at?: string | null;
  provider?: string | null;
  payment_id?: string | null;
  pay_address?: string | null;
  pay_currency?: string | null;
  price_amount?: string | number | null;
  pay_amount?: string | number | null;
  payment_status?: string | null;
  payment_invoice_url?: string | null;
  chain_id?: number | null;
  from_address?: string | null;
  to_address?: string | null;
  confirmations?: number | string | null;
  onchain_status?: string | null;
  credited_at?: string | null;
};

export type HbWithdrawal = {
  id: string;
  amount_usd: string | number;
  gross_amount?: string | number | null;
  fee_usd?: string | number;
  fee_amount?: string | number | null;
  payout_amount_usd?: string | number;
  net_amount?: string | number | null;
  currency: string;
  network: string;
  wallet_address: string;
  status: "pending" | "under_review" | "approved" | "processing" | "paid" | "rejected" | "cancelled" | "failed";
  tx_hash?: string | null;
  failure_reason?: string | null;
  requested_at: string;
  reviewed_at?: string | null;
  approved_at?: string | null;
  processing_at?: string | null;
  paid_at?: string | null;
  rejected_at?: string | null;
  cancelled_at?: string | null;
  updated_at?: string | null;
};

export type HbIncome = {
  id: string;
  income_type: string;
  amount_usd: string | number;
  credited_amount?: string | number | null;
  capped_amount?: string | number | null;
  cap_status?: "within_cap" | "partially_capped" | "capped" | null;
  cap_date?: string | null;
  status: string;
  level_depth?: number | null;
  level_number?: number | null;
  created_at: string;
  public_reference_id?: string | null;
  proof_hash?: string | null;
  previous_proof_hash?: string | null;
  chain_tx_hash?: string | null;
  onchain_status?: string | null;
  source_package?: string | null;
  source_wallet?: string | null;
  source_user_name?: string | null;
};

export type HbLedgerProof = {
  public_reference_id: string;
  proof_type: string;
  amount_usd: string | number;
  status?: string | null;
  proof_hash: string;
  previous_proof_hash?: string | null;
  chain_tx_hash?: string | null;
  onchain_status?: string | null;
  created_at: string;
};

export type HbTreasuryTransparency = {
  explorerBaseUrl: string;
  proofIntegrityPercent?: number;
  treasuryStatus?: string;
  onchainSyncStatus?: string;
  lastIndexedBlock?: number;
  chainStatus?: string;
  health?: Record<string, unknown>;
  wallets: Array<{
    key: string;
    label: string;
    wallet_address: string | null;
    network: string;
    chain_id: number;
    updated_at: string;
    explorer_url?: string | null;
    reserve_balance: string;
  }>;
  reserveAccounting: Record<string, string | number | null>;
};

export type HbWalletActivity = {
  id: string;
  type: string;
  title?: string | null;
  category?: string | null;
  direction: string;
  amount_usd: string | number;
  currency?: string | null;
  related_id?: string | null;
  wallet_address?: string | null;
  reference?: string | null;
  metadata?: Record<string, unknown> | null;
  public_reference_id?: string | null;
  proof_hash?: string | null;
  chain_tx_hash?: string | null;
  onchain_status?: string | null;
  created_at: string;
};

export type HbFundHistoryItem = {
  id: string;
  coin_symbol: string;
  amount: string | number;
  type: string;
  direction: string;
  reference?: string | null;
  note?: string | null;
  action_type: string;
  public_reference_id?: string | null;
  proof_hash?: string | null;
  created_at: string;
};

export type PublicHbProof = {
  public_reference_id: string;
  proof_hash: string;
  previous_proof_hash?: string | null;
  ledger_type: string;
  proof_type: string;
  amount_usd: string | number;
  masked_user_id?: string | null;
  chain_reference?: string | null;
  tx_hash?: string | null;
  explorer_url?: string | null;
  verification_status: string;
  expected_hash: string;
  created_at: string;
};

export type HbPublicLanding = {
  rollout?: {
    rolloutMode: "closed_beta" | "limited_live" | "public_live";
    emergencyPause: boolean;
    emergencyActivationDisable: boolean;
    emergencyWithdrawalFreeze: boolean;
    emergencyTreasuryFreezeNotice: boolean;
    rollbackMode: boolean;
    maintenanceNotice: string;
    launchBanner: string;
    warningBanner: string;
  };
  chainId: number;
  chainLabel: string;
  explorerBaseUrl: string;
  proofIntegrityPercent: number;
  totalVerifiedProofs?: number;
  treasuryStatus?: string;
  onchainSyncStatus?: string;
  lastIndexedBlock?: number;
  chainStatus?: string;
  activeTreasuryWallets: number;
  livePackagesCount: number;
  stats: {
    total_activations: number;
    total_treasury_reserve: string | number;
    total_proof_records: number;
    total_distributed_income: string | number;
    active_wallet_ids: number;
    total_onchain_purchases: number;
  };
  packages: Array<{ id: string; name: string; amount_usd: string | number; status: string; sort_order: number }>;
  treasuryWallets: Array<{
    key: string;
    label: string;
    wallet_address: string | null;
    network: string;
    chain_id: number;
    updated_at: string;
    explorer_url?: string | null;
    reserve_amount: string | number;
  }>;
  proofSamples: Array<{ public_reference_id: string; proof_hash: string; chain_tx_hash?: string | null; created_at: string }>;
};

export type HbOnchainPackageConfig = {
  mode: "onchain" | "internal" | "hybrid";
  dryRun?: boolean;
  chainId: number;
  explorerBaseUrl?: string | null;
  packageManagerAddress?: string | null;
  referralRegistryAddress?: string | null;
  treasurySplitterAddress?: string | null;
  incomeDistributorAddress?: string | null;
  usdtBep20Address?: string | null;
  packages: Array<HbPackage & {
    packageId?: number | null;
    packageContractId?: number | null;
    onchainPackageId: number | null;
    onchainPrice?: string | number | null;
    treasuryWallet?: string | null;
    tokenType?: "USDT BEP20" | string;
    tokenAddress?: string | null;
    active?: boolean;
  }>;
};

export type HbRegistrationFee = {
  required: boolean;
  amountUSD: number;
  amountUSDT?: number;
  amountBNB: number;
  treasuryWallet: string;
  chainId: number;
  network: string;
  token?: "USDT" | string;
  tokenAddress?: string;
  message: string;
  note: string;
};

export type HbWalletAuthResponse = {
  token?: string;
  user?: HbUser;
  registrationFeeRequired?: boolean;
  registrationFee?: HbRegistrationFee;
  adminToken?: string;
  role?: "super_admin" | "support_admin";
  admin?: { email: string; role: "super_admin" | "support_admin"; walletAddress?: string };
  adminRedirect?: string;
};

export type HbProductAllocation = {
  id: string;
  amount_usd: string | number;
  status: string;
  created_at: string;
};

export type HbSingleLegReserve = {
  id: string;
  amount_usd: string | number;
  status: string;
  algorithm_version: string;
  created_at: string;
};

export type HbSalaryIncome = {
  user_id: string;
  salary_amount: string | number;
  status: "locked" | "unlocked" | "paid";
  self_package_ok: boolean;
  direct_100_count: number;
  team_100_count: number;
  unlocked_at?: string | null;
  paid_at?: string | null;
  ledger_reference?: string | null;
  proof_reference?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type HbSingleLegProgress = {
  eligible: boolean;
  positionNumber?: string | number | null;
  packageAmount?: string | number | null;
  singleLegTeamCount: number;
  eligibleDirectReferralCount: number;
  nextReward?: Record<string, unknown> | null;
  rewards: Array<Record<string, unknown>>;
  countingRule?: string;
};

export type HbDeliveredProduct = {
  package_purchase_id: string;
  purchase_id?: string;
  purchaseId?: string;
  package_id: string;
  package_name: string;
  product_name?: string | null;
  productName?: string | null;
  product_title?: string | null;
  product_slug?: string | null;
  product_image?: string | null;
  price?: string | number;
  package_price: string | number;
  purchase_date?: string;
  purchaseDate?: string;
  activation_date: string;
  purchased_at?: string;
  status: string;
  book_limit: number;
  followers_count: number;
};

export type HbBook = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  file_url: string;
  cover_image?: string | null;
  status: string;
  sort_order: number;
  unlocked: boolean;
  downloaded_at?: string | null;
};

export type HbFollowersRequest = {
  id: string;
  package_purchase_id?: string | null;
  package_id?: string | null;
  package_name?: string | null;
  package_price?: string | number | null;
  platform: HbFollowersPlatform;
  submitted_link: string;
  followers_count: number;
  status: "pending" | "approved" | "processing" | "completed" | "rejected" | "failed" | "cancelled";
  admin_note?: string | null;
  created_at: string;
  completed_at?: string | null;
};

export type HbFollowersPlatform = "Instagram" | "Telegram" | "Twitter" | "Facebook" | "YouTube";

export type HbSoftwareAccess = {
  software_key: string;
  title: string;
  description?: string | null;
  access_url?: string | null;
  sort_order: number;
};

export type HbCustomSoftwareRequest = {
  id: string;
  package_purchase_id?: string | null;
  software_type: string;
  architecture: "centralized" | "decentralized";
  requirements_note: string;
  status: "pending" | "processing" | "completed" | "rejected";
  admin_note?: string | null;
  created_at: string;
  completed_at?: string | null;
};

export type HbMyProductsDelivery = {
  items?: HbDeliveredProduct[];
  activeProducts: HbDeliveredProduct[];
  bestPackage: HbDeliveredProduct | null;
  bookLimit: number;
  booksUnlocked: number;
  totalBooks: number;
  books: HbBook[];
  followersRequests: HbFollowersRequest[];
  softwareAccess: HbSoftwareAccess[];
  customSoftwareRequests: HbCustomSoftwareRequest[];
};

export type HbIncomeCapSummary = {
  capDate: string;
  packageAmount: string | number;
  dailyCapAmount: string | number;
  creditedAmount: string | number;
  cappedAmount: string | number;
  remainingAmount: string | number;
  timezone: string;
} | null;

export type HbLevelUnlockProgress = {
  directReferrals: number;
  maxLevel: number;
  levels: Array<{ level: number; requiredDirectReferrals: number; status: "unlocked" | "locked" }>;
};

export type HbReferral = {
  id: string;
  display_name: string;
  email: string;
  status: string;
  created_at: string;
};

export type HbReferralSummary = {
  sponsor: { id: string; display_name: string; email: string; status: string } | null;
  items: HbReferral[];
  directReferrals: HbReferral[];
  levelSummary: Array<{ level_no: number; total_count: number; active_count: number; inactive_count: number }>;
  levelCounts?: Array<{ level: number; total: number; active: number }>;
  totalTeamCount: number;
  singleLegCount?: number;
  directTeamCount?: number;
  activeTeamCount?: number;
  inactiveTeamCount?: number;
  activeCount: number;
  inactiveCount: number;
  packageSummary: { purchase_count: number; purchase_volume: string };
  levelUnlockProgress?: HbLevelUnlockProgress;
  singleLegProgress?: HbSingleLegProgress | null;
};

export type HbSponsorPreview = {
  referralCode: string;
  displayName: string;
  status: HbUser["status"];
  walletAddress?: string | null;
} | null;

export const HB_TOKEN_KEY = "hb9.user.token";
export const HB_ACTIVE_WALLET_KEY = "hb9.wallet.activeAddress";
export const HB_DEV_WALLET_KEY = "hb9.dev.wallet";
export const HB_DEV_MOCK_WALLET = "0xA1B2000000000000000000000000000000007890";
const LEGACY_HB_TOKEN_KEYS = ["hb9.token", "token", "authToken", "adminToken"];

export type HbPurchaseBalanceSnapshot = {
  walletBalance: string;
  mainWalletBalance: string;
  availableBalance: string;
};

export function isHbDevDirectDashboardEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.HB9_DEV_DIRECT_DASHBOARD === "true";
}

export function isHbDevDashboardBypassEnabled() {
  return process.env.NODE_ENV !== "production" && (process.env.HB9_DEV_DASHBOARD_BYPASS === "true" || isHbDevDirectDashboardEnabled());
}

export function saveHbDevWallet(address: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HB_DEV_WALLET_KEY, address);
}

export function getHbDevWallet() {
  if (typeof window === "undefined") return HB_DEV_MOCK_WALLET;
  return window.localStorage.getItem(HB_DEV_WALLET_KEY) || HB_DEV_MOCK_WALLET;
}

export function normalizeHbWalletAddress(address?: string | null) {
  return String(address || "").trim().toLowerCase();
}

export function hbWalletScopedStorageKey(address?: string | null) {
  const normalized = normalizeHbWalletAddress(address);
  return normalized ? `hb9_wallet_${normalized}` : "";
}

export function createHbDevDashboardUser(walletAddress = HB_DEV_MOCK_WALLET): HbUser {
  return {
    id: "dev-hb-dashboard-user",
    email: "dev@halalbusiness.local",
    display_name: "Dev Mode User",
    referral_code: "HB9DEV",
    status: "inactive",
    wallet_address: walletAddress || null,
    usdt_bep20_address: walletAddress || null,
    hb9_wallet_address: walletAddress || null
  };
}

export const hbDevDashboardPackages: HbPackage[] = [4, 20, 100, 500, 2500, 12500].map((amount, index) => ({
  id: `dev-package-${amount}`,
  name: `$${amount} Activation Package`,
  amount_usd: amount,
  status: "available",
  sort_order: index + 1
}));

export const hbDevDashboardProducts: HbProduct[] = hbDevDashboardPackages.map((pkg, index) => ({
  id: `dev-product-${pkg.amount_usd}`,
  title: `$${pkg.amount_usd} Activation Product`,
  slug: `dev-product-${pkg.amount_usd}`,
  short_description: "Development preview product.",
  description: "Development-only product placeholder for dashboard testing.",
  package_id: pkg.id,
  package_price: pkg.amount_usd,
  package_type: "activation",
  image_url: index % 2 === 0 ? "/tokens/bnb.svg" : "/tokens/usdt.svg",
  stock: 999,
  active: true,
  featured: index < 3,
  package_name: pkg.name
}));

function apiUrl(path: string) {
  const configured = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const localDefault = process.env.NODE_ENV === "development" ? "http://localhost:4000" : "";
  return `${configured || localDefault}/api${path}`;
}

const publicCache = new Map<string, { expiresAt: number; value: unknown }>();
const publicInflight = new Map<string, Promise<unknown>>();
const PUBLIC_CACHE_TTL_MS = 60_000;

async function hbRequest<T>(path: string, token?: string, init: RequestInit = {}) {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
  const envelope = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !envelope?.success) {
    throw new Error(envelope?.error || envelope?.message || "HB9 API request failed.");
  }
  return envelope.data as T;
}

async function hbRequestWithTimeout<T>(path: string, token: string | undefined, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await hbRequest<T>(path, token, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Purchase request timed out. Please check your wallet activity and try again.");
    }
    throw err;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function getHbToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(HB_TOKEN_KEY) || "";
}

export function saveHbToken(token: string, walletAddress?: string | null) {
  const normalizedWallet = normalizeHbWalletAddress(walletAddress || window.localStorage.getItem(HB_ACTIVE_WALLET_KEY));
  if (normalizedWallet) {
    window.localStorage.setItem(HB_ACTIVE_WALLET_KEY, normalizedWallet);
  }
  window.localStorage.setItem(HB_TOKEN_KEY, token);
  LEGACY_HB_TOKEN_KEYS.forEach((key) => window.localStorage.removeItem(key));
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith("hb9_wallet_"))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function clearHbToken() {
  window.localStorage.removeItem(HB_TOKEN_KEY);
  LEGACY_HB_TOKEN_KEYS.forEach((key) => window.localStorage.removeItem(key));
  window.localStorage.removeItem(HB_ACTIVE_WALLET_KEY);
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith("hb9_wallet_"))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function clearHbWalletCacheStorage() {
  if (typeof window === "undefined") return;
  const shouldRemove = (key: string) => {
    const normalized = key.toLowerCase();
    if (!normalized.startsWith("hb9.")) return false;
    if (normalized === HB_TOKEN_KEY || normalized === "hb9.admin.token" || normalized === HB_DEV_WALLET_KEY || normalized === "hb9.usdtbep20address") return false;
    if (normalized.includes("walletauth")) return false;
    return normalized.includes("balance") || normalized.includes("wallet");
  };
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean) as string[];
    keys.forEach((key) => {
      if (shouldRemove(key)) storage.removeItem(key);
    });
  });
}

export function clearHbSessionStorageState() {
  if (typeof window === "undefined") return;
  const removeFromStorage = (storage: Storage) => {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean) as string[];
    keys.forEach((key) => {
      const normalized = key.toLowerCase();
      if (normalized === "hb9.admin.token") return;
      if (normalized.startsWith("hb9.") || normalized.startsWith("hb9-") || normalized.startsWith("hb9_")) {
        storage.removeItem(key);
      }
    });
  };
  removeFromStorage(window.localStorage);
  removeFromStorage(window.sessionStorage);
}

export function registerHb(input: { email?: string; mobileNumber: string; password: string; displayName: string; fullName?: string; referralCode?: string; walletAddress?: string }) {
  return hbRequest<{ token: string; user: HbUser }>("/hb/auth/signup", undefined, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function loginHb(input: { identifier: string; password: string }) {
  return hbRequest<{ token: string; user: HbUser }>("/hb/auth/login", undefined, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function fetchHbSponsorPreview(referralCode: string) {
  return hbRequest<{ sponsor: HbSponsorPreview }>(`/hb/auth/sponsor-preview?ref=${encodeURIComponent(referralCode)}`);
}

export function fetchHbPublicLanding() {
  return hbRequest<HbPublicLanding>("/hb/public/landing");
}

export type HbWalletAuthMode = "login" | "signup";

export function requestHbWalletChallenge(input: { walletAddress: string; chainId: number; referralCode?: string; authMode?: HbWalletAuthMode }) {
  return hbRequest<{ nonce: string; message: string; chainId: number; expiresInSeconds: number }>("/hb/auth/wallet/challenge", undefined, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function verifyHbWalletSignature(input: { walletAddress: string; chainId: number; nonce: string; signature: string; authMode?: HbWalletAuthMode }) {
  return hbRequest<HbWalletAuthResponse>("/hb/auth/wallet/verify", undefined, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function verifyHbRegistrationFee(token: string, input: { txHash: string }) {
  return hbRequest<{ user: HbUser; registrationFeeRequired: false; txHash: string; amountBNB: string | number; amountUSDT?: string | number; amountUSD: string | number; walletAddress: string; status: "verified" }>("/hb/auth/registration-fee/verify", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function logoutHb(token: string) {
  return hbRequest<{ loggedOut: boolean }>("/hb/auth/logout", token, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function forgotHbPassword(input: { identifier: string }) {
  return hbRequest<{ delivery: string; resetToken?: string }>("/hb/auth/forgot-password", undefined, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function resetHbPassword(input: { token: string; password: string }) {
  return hbRequest<{ reset: boolean }>("/hb/auth/reset-password", undefined, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function createHbDevSession() {
  return hbRequest<{ token: string; user: HbUser }>("/hb/dev/session", undefined, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function addHbDevTestBalance(token: string, amountUsd = 1000) {
  return hbRequest<Record<string, unknown>>("/hb/dev/test-balance", token, {
    method: "POST",
    body: JSON.stringify({ amountUsd })
  });
}

export function fetchHbMe(token: string) {
  return hbRequest<{
    user: HbUser;
    balances: { deposit: string; income: string };
    currentPackage: { package_name: string; amount_usd: string | number; created_at: string } | null;
    sponsor: { referral_code: string; display_name: string } | null;
  }>("/hb/me", token);
}

export function fetchHbPackages() {
  return hbCachedRequest<{ items: HbPackage[] }>("/hb/packages");
}

export function fetchHbProducts() {
  return hbCachedRequest<{ items: HbProduct[] }>("/hb/products");
}

export function fetchHbProduct(slug: string) {
  return hbRequest<HbProduct>(`/hb/products/${encodeURIComponent(slug)}`);
}

function hbCachedRequest<T>(path: string) {
  const now = Date.now();
  const cached = publicCache.get(path);
  if (cached && cached.expiresAt > now) return Promise.resolve(cached.value as T);
  const inflight = publicInflight.get(path);
  if (inflight) return inflight as Promise<T>;
  const promise = hbRequest<T>(path)
    .then((value) => {
      publicCache.set(path, { value, expiresAt: Date.now() + PUBLIC_CACHE_TTL_MS });
      return value;
    })
    .finally(() => publicInflight.delete(path));
  publicInflight.set(path, promise);
  return promise;
}

export function fetchHbWallet(token: string) {
  return hbRequest<{
    wallets: unknown[];
    depositAddress: string;
    deposits: HbDeposit[];
    withdrawals: HbWithdrawal[];
    availableBalance: string;
    balances: { deposit: string; income: string };
    pendingDeposits: { total: string; count: number };
    verifiedDeposits: { total: string; count: number };
    totalPurchased: { total: string; count: number };
    pendingWithdrawals: { total: string; count: number };
    withdrawalSettings?: {
      withdrawalMinUsd: number;
      withdrawalFeePercent: number;
      withdrawalDailyLimitUsd: number;
      withdrawalCooldownMinutes: number;
      withdrawalRequireActiveId: boolean;
      withdrawalRequirePackage: boolean;
    };
  }>("/hb/wallet", token);
}

export type HbWalletAddress = {
  usdt_bep20_address: string | null;
  wallet_bound_at: string | null;
  wallet_updated_at: string | null;
};

export function fetchHbWalletAddress(token: string) {
  return hbRequest<HbWalletAddress>("/hb/wallet-address", token);
}

export function fetchHbCoins(token: string) {
  return hbRequest<{ items: HbCoinBalance[] }>("/hb/coins", token);
}

export function fetchHbCoinPrices(token: string) {
  return hbRequest<{ prices: Record<string, number>; fallback?: boolean }>("/hb/coins/prices", token);
}

export function convertHbCoinToUsdt(token: string, coinSymbol: string) {
  return hbRequest<Record<string, unknown>>("/hb/coins/convert", token, {
    method: "POST",
    body: JSON.stringify({ coinSymbol, idempotencyKey: `hb-ui-convert-${coinSymbol}-${Date.now()}-${crypto.randomUUID()}` })
  });
}

export function fetchHbCoinHistory(token: string, coinSymbol?: string) {
  const suffix = coinSymbol ? `?coin=${encodeURIComponent(coinSymbol)}` : "";
  return hbRequest<{ items: HbCoinLedgerEntry[] }>(`/hb/coins/history${suffix}`, token);
}

export function bindHbWalletAddress(token: string, address: string, change = false) {
  return hbRequest<HbWalletAddress>("/hb/wallet-address", token, {
    method: change ? "PATCH" : "POST",
    body: JSON.stringify({ address })
  });
}

export function createNowPaymentsDeposit(token: string, input: { amountUsd: number; payCurrency: string }) {
  return hbRequest<{ depositId: string; payment: Record<string, unknown> }>("/hb/deposits/nowpayments/create", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function createHbDeposit(token: string, input: { amountUsd: number; amount?: number; txHash?: string; walletAddress?: string; treasuryWallet?: string; token?: "USDT"; asset?: "USDT"; network?: "bsc"; chainId?: 56; tokenAddress?: string; idempotencyKey?: string }) {
  return hbRequest<HbDeposit>("/hb/deposits", token, {
    method: "POST",
    body: JSON.stringify({ token: "USDT", network: "bsc", chainId: 56, ...input })
  });
}

export function verifyHbDeposit(token: string, depositId: string, txHash: string) {
  return hbRequest<HbDeposit>(`/hb/deposits/${encodeURIComponent(depositId)}/verify`, token, {
    method: "POST",
    body: JSON.stringify({ txHash })
  });
}

export function fetchHbDeposits(token: string) {
  return hbRequest<{ items: HbDeposit[] }>("/hb/deposits", token);
}

export function fetchNowPaymentsDeposit(token: string, paymentId: string) {
  return hbRequest<{ deposit: HbDeposit; payment: Record<string, unknown> }>(`/hb/deposits/nowpayments/${encodeURIComponent(paymentId)}`, token);
}

export function createHbWithdrawal(token: string, input: { amountUsd: number; walletAddress: string; currency: "USDT"; network: "bsc"; chainId?: 56; idempotencyKey?: string }) {
  return hbRequest<HbWithdrawal>("/hb/withdrawals", token, {
    method: "POST",
    body: JSON.stringify({ chainId: 56, ...input })
  });
}

export function fetchHbOnchainPackageConfig(token: string) {
  return hbRequest<HbOnchainPackageConfig>("/hb/onchain/config", token);
}

export function trackHbOnchainPurchase(token: string, input: {
  txHash: string;
  productId?: string;
  packageId?: string;
  onchainPackageId: number;
  buyerAddress: string;
  sponsorAddress?: string;
  referralCode?: string;
}) {
  return hbRequest<Record<string, unknown>>("/hb/onchain/purchases/track", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function fetchHbWithdrawals(token: string) {
  return hbRequest<{ items: HbWithdrawal[] }>("/hb/withdrawals", token);
}

export function purchaseHbPackage(token: string, packageId: string) {
  const payload = { idempotencyKey: `hb-ui-${Date.now()}-${crypto.randomUUID()}` };
  console.log("HB9_PURCHASE_REQUEST payload", payload);
  return hbRequestWithTimeout<{ purchaseId: string; status: string; activated: boolean } & Partial<HbPurchaseBalanceSnapshot>>(`/hb/packages/${packageId}/purchase`, token, {
    method: "POST",
    body: JSON.stringify(payload)
  }, 15_000)
    .then((response) => {
      console.log("HB9_PURCHASE_RESPONSE", response);
      return response;
    })
    .catch((err) => {
      console.error("HB9_PURCHASE_ERROR", err);
      throw err;
    });
}

export function buyHbProduct(token: string, productId: string) {
  const payload = { idempotencyKey: `hb-product-ui-${Date.now()}-${crypto.randomUUID()}` };
  console.log("HB9_PURCHASE_REQUEST payload", payload);
  return hbRequestWithTimeout<{ order: { id: string; order_number: string }; packagePurchaseId: string; activated: boolean } & Partial<HbPurchaseBalanceSnapshot>>(`/hb/products/${productId}/buy`, token, {
    method: "POST",
    body: JSON.stringify(payload)
  }, 15_000)
    .then((response) => {
      console.log("HB9_PURCHASE_RESPONSE", response);
      return response;
    })
    .catch((err) => {
      console.error("HB9_PURCHASE_ERROR", err);
      throw err;
    });
}

export function fetchHbPurchases(token: string) {
  return hbRequest<{ items: HbPurchase[] }>("/hb/purchases", token);
}

export function fetchHbOrders(token: string) {
  return hbRequest<{ items: HbOrder[] }>("/hb/orders", token);
}

export function fetchHbMyProducts(token: string) {
  return hbRequest<HbMyProductsDelivery>("/hb/my-products", token);
}

export function downloadHbBook(token: string, bookId: string) {
  return hbRequest<{ fileUrl: string; download: Record<string, unknown> }>(`/hb/books/${encodeURIComponent(bookId)}/download`, token, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function createHbFollowersRequest(token: string, input: { packagePurchaseId: string; platform: HbFollowersPlatform; submittedLink: string }) {
  return hbRequest<HbFollowersRequest>("/hb/followers-request", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function createHbCustomSoftwareRequest(token: string, input: { packagePurchaseId?: string; softwareType: string; architecture: "centralized" | "decentralized"; requirementsNote: string }) {
  return hbRequest<HbCustomSoftwareRequest>("/hb/custom-software-request", token, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function fetchHbIncome(token: string) {
  return hbRequest<{
    items: HbIncome[];
    productAllocations: HbProductAllocation[];
    singleLegReserve: HbSingleLegReserve[];
    singleLegProgress?: HbSingleLegProgress | null;
    levelUnlockProgress?: HbLevelUnlockProgress;
    incomeCap?: HbIncomeCapSummary;
    salaryIncome: HbSalaryIncome;
    summary: {
      referral_income?: string;
      direct_income?: string;
      level_income?: string;
      single_leg_income?: string;
      salary_income?: string;
      salary_income_paid?: string;
      single_leg_reserve?: string;
    };
  }>("/hb/income", token);
}

export function fetchHbReferrals(token: string) {
  return hbRequest<HbReferralSummary>("/hb/referrals", token);
}

export function fetchHbTransparency(token: string) {
  return hbRequest<{ items: HbLedgerProof[] }>("/hb/transparency", token);
}

export function fetchHbTreasuryTransparency(token: string) {
  return hbRequest<HbTreasuryTransparency>("/hb/treasury-transparency", token);
}

export function fetchHbWalletActivity(token: string) {
  return hbRequest<{ items: HbWalletActivity[] }>("/hb/wallet-activity", token);
}

export function fetchHbFundsHistory(token: string) {
  return hbRequest<{ items: HbFundHistoryItem[] }>("/hb/funds/history", token);
}

export function fetchPublicHbProof(referenceId: string) {
  return hbRequest<PublicHbProof>(`/hb/proof/${encodeURIComponent(referenceId)}`);
}
