"use client";

import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, Banknote, Bell, Box, ChevronDown, ChevronRight, ChevronUp, CircleDollarSign, Copy, Download, Eye, Home, Layers3, PackageCheck, Plus, ReceiptText, RefreshCw, Send, Settings, Share2, Sparkles, TrendingUp, Users, Wallet, X } from "lucide-react";
import { BrowserProvider, Contract, encodeBytes32String, parseUnits, ZeroAddress } from "ethers";
import { createPublicClient, encodeFunctionData, http, parseUnits as viemParseUnits, type Hash } from "viem";
import { bsc } from "viem/chains";
import { HbLandingPage } from "@/components/halal-business/HbLandingPage";
import { HbAllPackagesList, HbPackageProductCard, HbPackageVisual, buildDefaultHbPackageProducts, featuresForHbPackageAmount, hbPackageAmounts, hbPackageNames } from "@/components/halal-business/HbPackageCards";
import { HB9Logo } from "@/components/brand/HB9Logo";
import { CoinLogo as CryptoCoinLogo } from "@/components/crypto/CoinLogo";
import { HB9VoiceAssistant, type HB9VoiceEvent, type HB9VoiceScript } from "@/components/voice/HB9VoiceAssistant";
import {
  buyHbProduct,
  HB_ACTIVE_WALLET_KEY,
  clearHbSessionStorageState,
  clearHbWalletCacheStorage,
  clearHbToken,
  convertHbCoinToUsdt,
  createHbCustomSoftwareRequest,
  createHbDeposit,
  createHbFollowersRequest,
  createHbWithdrawal,
  downloadHbBook,
  fetchHbCoins,
  fetchHbIncome,
  fetchHbMe,
  fetchHbMyProducts,
  fetchHbOnchainPackageConfig,
  fetchHbOrders,
  fetchHbPackages,
  fetchHbProducts,
  fetchHbPurchases,
  fetchHbReferrals,
  fetchHbWallet,
  fetchHbWalletActivity,
  verifyHbDeposit,
  createHbDevDashboardUser,
  getHbDevWallet,
  getHbToken,
  hbDevDashboardProducts,
  isHbDevDashboardBypassEnabled,
  normalizeHbWalletAddress,
  purchaseHbPackage,
  requestHbWalletChallenge,
  saveHbToken,
  trackHbOnchainPurchase,
  verifyHbWalletSignature,
  type HbCoinBalance,
  type HbDeposit,
  type HbIncome,
  type HbMyProductsDelivery,
  type HbOnchainPackageConfig,
  type HbOrder,
  type HbFollowersPlatform,
  type HbPackage,
  type HbProduct,
  type HbPurchase,
  type HbReferralSummary,
  type HbSingleLegProgress,
  type HbSingleLegReserve,
  type HbUser,
  type HbWalletActivity,
  type HbWithdrawal
} from "@/services/halalBusinessService";
import { captureHbReferralFromUrl, getStoredHbReferral } from "@/lib/referral";
import { BSC_RPC_URL, USDT_CONTRACT } from "@/lib/config";

type TabId = "home" | "products" | "team" | "income" | "wallet" | "packages";
type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};
type WalletWindow = Window & { ethereum?: EthereumProvider };
type OnchainPackageItem = HbOnchainPackageConfig["packages"][number];
type PurchaseStage = "review" | "approving" | "submitting" | "pending" | "activated";
type PurchaseMode = "internal" | "onchain";
type DepositPaymentStatus = "idle" | "pending_wallet_signature" | "pending_blockchain_confirmation" | "confirmed" | "failed";
type PurchaseReview = {
  product: HbProduct;
  config: HbOnchainPackageConfig;
  packageConfig: OnchainPackageItem | null;
  buyerAddress: string;
  sponsorRef: string;
  stage: PurchaseStage;
  purchaseMode: PurchaseMode;
  txHash?: string;
};

const followerPlatforms: Array<{ value: HbFollowersPlatform; label: string }> = [
  { value: "Instagram", label: "Instagram" },
  { value: "Facebook", label: "Facebook" },
  { value: "Telegram", label: "Telegram" },
  { value: "Twitter", label: "Twitter" },
  { value: "YouTube", label: "YouTube" }
];
const HB_PRODUCTS_CACHE_KEY = "hb9.dashboard.products.v1";
const ADMIN_TOKEN_KEY = "hb9.admin.token";
const HB_PACKAGE_API_FAILURE = "Package configuration missing";
const HB_TREASURY_MISSING = "Treasury wallet not configured";
const HB_MAPPING_MISSING = "Blockchain package mapping missing";
const HB_PACKAGE_INACTIVE = "Package inactive";

const PACKAGE_MANAGER_ABI = ["function buyPackage(uint256 packageId,address sponsorAddress,bytes32 referralCode)"];
const ERC20_ABI = ["function approve(address spender,uint256 amount) returns (bool)", "function transfer(address to,uint256 amount) returns (bool)"];
const ERC20_TRANSFER_ABI = [{
  type: "function",
  name: "transfer",
  stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }]
}] as const;
const bscPublicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC_URL) });
const HB_DEV_DASHBOARD_BYPASS = isHbDevDashboardBypassEnabled();
const LOGIN_SUCCESS_MESSAGE = "Login successful.";
const HB_WITHDRAWAL_MIN_USD = 9;
const HB_WITHDRAWAL_MIN_ERROR = "Minimum withdrawal amount is $9.";
const HB9_COIN_PRICE_USD = 0.13;
const HB9_TO_USDT_MIN_USD = 500;
const PACKAGE_AMOUNT_TO_ONCHAIN_ID: Record<number, number> = {
  4: 1,
  20: 2,
  100: 3,
  500: 4,
  2500: 5,
  12500: 6
};

function adminRedirectTarget(response: { adminToken?: string; role?: string; admin?: { role?: string }; adminRedirect?: string }) {
  const role = response.admin?.role || response.role || "";
  return response.adminToken && (role === "super_admin" || role === "support_admin") ? response.adminRedirect || "/admin/hb" : "";
}

function readCachedProducts() {
  if (typeof window === "undefined") return buildDefaultHbPackageProducts();
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(HB_PRODUCTS_CACHE_KEY) || "") as HbProduct[];
    return Array.isArray(parsed) && parsed.length ? parsed : buildDefaultHbPackageProducts();
  } catch {
    return buildDefaultHbPackageProducts();
  }
}

function cacheProducts(items: HbProduct[]) {
  if (typeof window === "undefined" || items.length === 0) return;
  try {
    window.sessionStorage.setItem(HB_PRODUCTS_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Cache is a performance hint; storage failures should not affect the dashboard.
  }
}

const navItems: Array<{ id: TabId; label: string; icon: ElementType }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "products", label: "My Product", icon: PackageCheck },
  { id: "team", label: "Team", icon: Users },
  { id: "income", label: "Income", icon: TrendingUp },
  { id: "wallet", label: "Wallet", icon: Wallet }
];

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00";
}

function signedMoney(value: unknown, direction?: string) {
  const prefix = direction === "debit" ? "-" : "+";
  return `${prefix}${money(value)}`;
}

function walletActivityTitle(item: HbWalletActivity) {
  if (item.title) return item.title;
  if (item.type === "deposit_credit" || item.type === "deposit") return "Deposit Credit";
  if (item.type === "product_purchase" || item.type === "package_purchase") return "Product Purchase";
  return item.type.replace(/_/g, " ");
}

function shortAddress(value?: string | null) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "Not bound";
}

function chainLabel(chainId: number | string) {
  return Number(chainId) === 56 ? "BSC Mainnet" : "BSC";
}

function txUrl(config: HbOnchainPackageConfig, txHash: string) {
  return `${(config.explorerBaseUrl || "https://bscscan.com").replace(/\/$/, "")}/tx/${txHash}`;
}

function getInjectedProvider() {
  if (typeof window === "undefined") return null;
  return (window as WalletWindow).ethereum || null;
}

async function readProviderAddress(provider = getInjectedProvider()) {
  if (!provider) return "";
  const accounts = await provider.request({ method: "eth_accounts" }).catch(() => []);
  return Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
}

function resolveClientTreasuryWallet(apiWallet?: string | null) {
  const configured = apiWallet || process.env.NEXT_PUBLIC_BSC_TREASURY_WALLET || process.env.NEXT_PUBLIC_COMPANY_RECEIVING_WALLET_BSC || "";
  return /^0x[a-fA-F0-9]{40}$/.test(configured) ? configured : "";
}

async function switchConnectedWalletToBsc(ethereum: EthereumProvider) {
  const chainId = await ethereum.request({ method: "eth_chainId" }).catch(() => "0x0");
  const current = typeof chainId === "string" ? Number.parseInt(chainId, 16) : Number(chainId);
  if (current === 56) return;
  await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
}

async function sendConnectedWalletUsdtTransfer(input: { from: string; to: string; amount: number; tokenAddress?: string; onSubmitted?: (txHash: string) => void }) {
  const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  if (!ethereum) throw new Error("External wallet not found. Open HB9 in a BSC wallet browser.");
  await ethereum.request({ method: "eth_requestAccounts" });
  await switchConnectedWalletToBsc(ethereum);
  const txHash = await ethereum.request({
    method: "eth_sendTransaction",
    params: [{
      from: input.from,
      to: input.tokenAddress || USDT_CONTRACT,
      value: "0x0",
      data: encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [input.to as `0x${string}`, viemParseUnits(String(input.amount), 18)]
      })
    }]
  });
  if (typeof txHash !== "string") throw new Error("USDT transfer transaction was not returned by wallet.");
  input.onSubmitted?.(txHash);
  await bscPublicClient.waitForTransactionReceipt({ hash: txHash as Hash, confirmations: 3 });
  return txHash;
}

function onchainPackageIdForProduct(product: HbProduct) {
  return PACKAGE_AMOUNT_TO_ONCHAIN_ID[Number(product.package_price)] || null;
}

function packageConfigForProduct(config: HbOnchainPackageConfig, product: HbProduct): OnchainPackageItem | null {
  const amount = Number(product.package_price);
  const expectedOnchainId = onchainPackageIdForProduct(product);
  const configured = config.packages.find((item) => item.id === product.package_id || Number(item.amount_usd) === amount || item.onchainPackageId === expectedOnchainId || item.packageContractId === expectedOnchainId || item.packageId === expectedOnchainId);
  if (configured) return configured;
  const onchainPackageId = onchainPackageIdForProduct(product);
  if (!onchainPackageId) return null;
  return {
    id: product.package_id || `hb-package-${amount}`,
    name: product.package_name || product.title,
    amount_usd: amount,
    status: "available",
    sort_order: onchainPackageId,
    packageContractId: onchainPackageId,
    onchainPackageId
  };
}

function validatePackageForPurchase(config: HbOnchainPackageConfig, packageConfig: OnchainPackageItem | null) {
  if (!packageConfig) return HB_MAPPING_MISSING;
  if (packageConfig.status === "disabled" || packageConfig.active === false) return HB_PACKAGE_INACTIVE;
  const packageContractId = packageConfig.onchainPackageId ?? packageConfig.packageContractId ?? packageConfig.packageId;
  if ((config.mode === "onchain" || config.mode === "hybrid") && !packageContractId) return HB_MAPPING_MISSING;
  if ((config.mode === "onchain" || config.mode === "hybrid") && !packageConfig.treasuryWallet && !config.treasurySplitterAddress) return HB_TREASURY_MISSING;
  if ((config.mode === "onchain" || config.mode === "hybrid") && (!config.packageManagerAddress || !config.usdtBep20Address)) return HB_PACKAGE_API_FAILURE;
  return "";
}

function onchainPurchaseReady(config: HbOnchainPackageConfig, packageConfig: OnchainPackageItem | null) {
  if (config.mode !== "onchain" && config.mode !== "hybrid") return false;
  if (!packageConfig) return false;
  const packageContractId = packageConfig.onchainPackageId ?? packageConfig.packageContractId ?? packageConfig.packageId;
  return Boolean(packageContractId && config.packageManagerAddress && config.usdtBep20Address);
}

function isPurchasedStatusActive(status?: string | null) {
  return Boolean(status && !/fail|cancel|reject|expire/i.test(status));
}

function isPackageAlreadyActive(product: HbProduct, purchases: HbPurchase[], orders: HbOrder[]) {
  const amount = Number(product.package_price);
  const packageName = (product.package_name || product.title || "").toLowerCase();
  return purchases.some((item) => {
    const itemAmount = Number(item.amount_usd);
    return isPurchasedStatusActive(item.status) && (itemAmount === amount || item.package_name?.toLowerCase() === packageName);
  }) || orders.some((item) => {
    const itemAmount = Number(item.amount_usd || item.package_price);
    return isPurchasedStatusActive(item.payment_status) && isPurchasedStatusActive(item.activation_status) && (itemAmount === amount || item.package_name?.toLowerCase() === packageName);
  });
}

function packageProductFromPackage(pkg: HbPackage, fallbackProduct?: HbProduct): HbProduct {
  const amount = Number(pkg.amount_usd);
  const defaultProduct = buildDefaultHbPackageProducts().find((item) => Number(item.package_price) === amount);
  const fallback = fallbackProduct || defaultProduct;
  const packageName = pkg.name || hbPackageNames[amount] || fallback?.package_name || "HB9 Package";
  return {
    id: fallback?.id || `hb-package-${amount}`,
    title: fallback?.title || `${money(amount)} ${packageName}`,
    slug: fallback?.slug || pkg.slug || `hb-package-${amount}`,
    short_description: fallback?.short_description || null,
    description: fallback?.description || null,
    package_id: pkg.id,
    package_price: pkg.amount_usd,
    package_type: fallbackProduct?.package_type || "package",
    image_url: fallback?.image_url || "",
    thumbnail_url: fallback?.thumbnail_url || "",
    stock: fallback?.stock ?? 999,
    active: fallback?.active ?? pkg.status === "available",
    featured: fallback?.featured ?? true,
    package_name: packageName,
    gallery: fallback?.gallery
  };
}

function completePackageProductList(products: HbProduct[], packages: HbPackage[], devDashboardActive: boolean) {
  const defaults = buildDefaultHbPackageProducts();
  const sourceProducts = devDashboardActive ? hbDevDashboardProducts : products;
  const productByAmount = new Map<number, HbProduct>();
  for (const product of sourceProducts) {
    const amount = Number(product.package_price);
    if (!hbPackageAmounts.includes(amount as (typeof hbPackageAmounts)[number])) continue;
    if (!productByAmount.has(amount)) productByAmount.set(amount, product);
  }

  const packageByAmount = new Map<number, HbPackage>();
  for (const pkg of packages) {
    const amount = Number(pkg.amount_usd);
    if (!hbPackageAmounts.includes(amount as (typeof hbPackageAmounts)[number])) continue;
    if (pkg.status !== "available" || pkg.active === false || pkg.visible === false) continue;
    if (!packageByAmount.has(amount)) packageByAmount.set(amount, pkg);
  }

  return hbPackageAmounts.map((amount) => {
    const product = productByAmount.get(amount);
    const pkg = packageByAmount.get(amount);
    if (pkg) return packageProductFromPackage(pkg, product);
    return product || defaults.find((item) => Number(item.package_price) === amount)!;
  });
}

async function resolveFreshProductForBuy(product: HbProduct) {
  const amount = Number(product.package_price);
  const productData = await fetchHbProducts();
  if (productData.items.length) cacheProducts(productData.items);
  return productData.items.find((item) => item.id === product.id)
    || productData.items.find((item) => item.package_id === product.package_id)
    || productData.items.find((item) => Number(item.package_price) === amount)
    || product;
}

export function HbPremiumMobileDashboard({ devMode = false }: { devMode?: boolean }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [token, setToken] = useState("");
  const [sourceReferralCode, setSourceReferralCode] = useState("");
  const [user, setUser] = useState<HbUser | null>(null);
  const [providerWalletAddress, setProviderWalletAddress] = useState("");
  const [products, setProducts] = useState<HbProduct[]>(() => buildDefaultHbPackageProducts());
  const [packages, setPackages] = useState<HbPackage[]>([]);
  const [purchases, setPurchases] = useState<HbPurchase[]>([]);
  const [orders, setOrders] = useState<HbOrder[]>([]);
  const [withdrawals, setWithdrawals] = useState<HbWithdrawal[]>([]);
  const [income, setIncome] = useState<HbIncome[]>([]);
  const [singleLegReserve, setSingleLegReserve] = useState<HbSingleLegReserve[]>([]);
  const [singleLegProgress, setSingleLegProgress] = useState<HbSingleLegProgress | null>(null);
  const [incomeSummary, setIncomeSummary] = useState({ direct_income: "0", level_income: "0", single_leg_income: "0", single_leg_reserve: "0", salaryIncome: "0" });
  const [dividendSummary, setDividendSummary] = useState({ dividendIncomeUsd: "0", dividendCapUsd: "0", dividendRemainingUsd: "0" });
  const [referralSummary, setReferralSummary] = useState<HbReferralSummary | null>(null);
  const [walletActivity, setWalletActivity] = useState<HbWalletActivity[]>([]);
  const [myProducts, setMyProducts] = useState<HbMyProductsDelivery | null>(null);
  const [coins, setCoins] = useState<HbCoinBalance[]>([]);
  const [onchainConfig, setOnchainConfig] = useState<HbOnchainPackageConfig | null>(null);
  const [walletData, setWalletData] = useState({
    depositAddress: "",
    deposits: [] as HbDeposit[],
    balances: { deposit: "0", income: "0" },
    pendingWithdrawals: { total: "0", count: 0 },
    verifiedDeposits: { total: "0", count: 0 },
    pendingDeposits: { total: "0", count: 0 }
  });
  const [currentPackage, setCurrentPackage] = useState("None");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loginToast, setLoginToast] = useState("");
  const [depositToast, setDepositToast] = useState("");
  const [purchaseReview, setPurchaseReview] = useState<PurchaseReview | null>(null);
  const [purchaseConfirming, setPurchaseConfirming] = useState(false);
  const [buyLoadingProductId, setBuyLoadingProductId] = useState("");
  const [lastBuyProduct, setLastBuyProduct] = useState<HbProduct | null>(null);
  const [voiceEvent, setVoiceEvent] = useState<HB9VoiceEvent>(null);
  const [convertingCoin, setConvertingCoin] = useState("");
  const [walletActionBusy, setWalletActionBusy] = useState("");
  const [depositPaymentStatus, setDepositPaymentStatus] = useState<DepositPaymentStatus>("idle");
  const [activeWalletModal, setActiveWalletModal] = useState<"deposit" | "withdraw" | null>(null);
  const providerWalletRef = useRef("");
  const providerAuthRef = useRef("");

  const devDashboardActive = devMode && HB_DEV_DASHBOARD_BYPASS;
  const authenticated = devDashboardActive || Boolean(token && user);
  const currentTitle = useMemo(() => activeTab === "packages" ? "All Packages" : navItems.find((item) => item.id === activeTab)?.label || "Home", [activeTab]);
  const dashboardUser = user || createHbDevDashboardUser(getHbDevWallet());
  const dashboardProducts = products;
  const boundWallet = providerWalletAddress || dashboardUser.usdt_bep20_address || dashboardUser.hb9_wallet_address || dashboardUser.wallet_address || walletData.depositAddress || "";
  const treasuryDepositAddress = useMemo(() => resolveClientTreasuryWallet(walletData.depositAddress), [walletData.depositAddress]);
  const totalBalance = Number(walletData.balances.deposit || 0) + Number(walletData.balances.income || 0);
  const availableBalanceUsd = useMemo(() => calculateAvailableBalanceUsd(coins, walletData.balances.deposit), [coins, walletData.balances.deposit]);
  const orderedProducts = useMemo(() => [...products].sort((a, b) => Number(a.package_price) - Number(b.package_price)), [products]);
  const completePackageProducts = useMemo(() => completePackageProductList(dashboardProducts, packages, devDashboardActive), [dashboardProducts, packages, devDashboardActive]);
  const hasActiveProduct = Boolean(myProducts?.activeProducts?.length || purchases.length || orders.length);

  function playAssistant(script: HB9VoiceScript) {
    if (typeof window !== "undefined" && window.__hb9PlayVoiceInstruction) {
      window.__hb9PlayVoiceInstruction(script);
      return;
    }
    setVoiceEvent({ script, id: Date.now() });
  }

  function handleTabChange(nextTab: TabId) {
    if (nextTab === "products") playAssistant(hasActiveProduct ? "myProductAvailable" : "myProductEmpty");
    setActiveTab(nextTab);
  }

  function openPackagesScreen() {
    playAssistant("buy");
    setActiveTab("packages");
  }

  function showLoginToast() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("hb9.loginSuccess");
      window.sessionStorage.removeItem("hb9.loginSuccess");
    }
    setLoginToast(LOGIN_SUCCESS_MESSAGE);
  }

  function clearDashboardStateForWallet(nextWallet = "") {
    if (devDashboardActive) return;
    clearHbSessionStorageState();
    queryClient.clear();
    if (nextWallet) window.localStorage.setItem(HB_ACTIVE_WALLET_KEY, normalizeHbWalletAddress(nextWallet));
    window.dispatchEvent(new CustomEvent("hb9:session-cleared", { detail: { walletAddress: nextWallet } }));
  }

  async function authenticateCurrentProviderWallet(provider: EthereumProvider, walletAddress: string) {
    const normalized = normalizeHbWalletAddress(walletAddress);
    if (!normalized || providerAuthRef.current === normalized) return;
    providerAuthRef.current = normalized;
    try {
      const chain = await provider.request({ method: "eth_chainId" }).catch(() => "0x38");
      const chainId = typeof chain === "string" ? Number.parseInt(chain, 16) : Number(chain || 56);
      const challenge = await requestHbWalletChallenge({ walletAddress, chainId: chainId || 56, referralCode: sourceReferralCode || getStoredHbReferral(), authMode: "login" });
      const signature = await provider.request({ method: "personal_sign", params: [challenge.message, walletAddress] });
      if (typeof signature !== "string") return;
      const response = await verifyHbWalletSignature({ walletAddress, chainId: challenge.chainId, nonce: challenge.nonce, signature, authMode: "login" });
      const adminRedirect = adminRedirectTarget(response);
      if (adminRedirect) {
        window.localStorage.setItem(ADMIN_TOKEN_KEY, response.adminToken!);
        window.localStorage.removeItem("hb9.user.redirect");
        console.info("ADMIN_REDIRECT", { role: response.admin?.role || response.role, redirect: adminRedirect });
        window.location.assign(adminRedirect);
        return;
      }
      if (!response.token) throw new Error("Wallet authentication failed.");
      saveHbToken(response.token, walletAddress);
      setToken(response.token);
      await Promise.all([
        fetchHbMe(response.token),
        fetchHbWallet(response.token),
        fetchHbMyProducts(response.token)
      ]);
      await refresh(response.token, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet verification failed.");
    } finally {
      providerAuthRef.current = "";
    }
  }

  async function syncProviderWallet(provider = getInjectedProvider(), authenticateChangedWallet = true) {
    if (devDashboardActive || !provider) return;
    const currentAddress = await readProviderAddress(provider);
    const normalizedCurrent = normalizeHbWalletAddress(currentAddress);
    const appWallet = normalizeHbWalletAddress(providerWalletRef.current || providerWalletAddress || dashboardUser.usdt_bep20_address || dashboardUser.hb9_wallet_address || dashboardUser.wallet_address || window.localStorage.getItem(HB_ACTIVE_WALLET_KEY));
    if (!normalizedCurrent) {
      if (appWallet || token || user) {
        providerWalletRef.current = "";
        setProviderWalletAddress("");
        clearDashboardStateForWallet("");
      }
      return;
    }
    setProviderWalletAddress(currentAddress);
    if (!appWallet) {
      providerWalletRef.current = currentAddress;
      window.localStorage.setItem(HB_ACTIVE_WALLET_KEY, normalizedCurrent);
      return;
    }
    if (normalizedCurrent !== appWallet) {
      providerWalletRef.current = currentAddress;
      setProviderWalletAddress(currentAddress);
      clearDashboardStateForWallet(currentAddress);
      if (authenticateChangedWallet) await authenticateCurrentProviderWallet(provider, currentAddress);
    }
  }

  function invalidateHbBuyQueries() {
    clearHbWalletCacheStorage();
    ["wallet", "me", "purchases", "my-products", "orders", "income"].forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  }

  function applyPurchaseBalanceSnapshot(snapshot: { walletBalance?: string; mainWalletBalance?: string; availableBalance?: string }) {
    const nextBalance = snapshot.availableBalance ?? snapshot.walletBalance ?? snapshot.mainWalletBalance;
    if (nextBalance === undefined) return;
    setWalletData((current) => ({
      ...current,
      balances: { ...current.balances, deposit: String(nextBalance) }
    }));
  }

  async function refetchAfterSuccessfulBuy(activeToken: string) {
    invalidateHbBuyQueries();
    const [wallet, me, purchaseData, deliveryData, orderData, incomeData] = await Promise.all([
      fetchHbWallet(activeToken),
      fetchHbMe(activeToken),
      fetchHbPurchases(activeToken),
      fetchHbMyProducts(activeToken),
      fetchHbOrders(activeToken),
      fetchHbIncome(activeToken)
    ]);
    setUser(me.user);
    setPurchases(purchaseData.items);
    setMyProducts(deliveryData);
    setOrders(orderData.items);
    setIncome(incomeData.items);
    setSingleLegReserve(incomeData.singleLegReserve);
    setSingleLegProgress(incomeData.singleLegProgress || null);
    setIncomeSummary({
      direct_income: incomeData.summary.direct_income || "0",
      level_income: incomeData.summary.level_income || "0",
      single_leg_income: incomeData.summary.single_leg_income || "0",
      single_leg_reserve: incomeData.summary.single_leg_reserve || "0",
      salaryIncome: "0"
    });
    setDividendSummary({
      dividendIncomeUsd: incomeData.dividendIncomeUsd || "0",
      dividendCapUsd: incomeData.dividendCapUsd || "0",
      dividendRemainingUsd: incomeData.dividendRemainingUsd || "0"
    });
    setWithdrawals(wallet.withdrawals);
    setWalletData({
      depositAddress: wallet.depositAddress,
      deposits: wallet.deposits,
      balances: wallet.balances,
      pendingWithdrawals: wallet.pendingWithdrawals,
      verifiedDeposits: wallet.verifiedDeposits,
      pendingDeposits: wallet.pendingDeposits
    });
    setCurrentPackage(me.currentPackage?.package_name || purchaseData.items[0]?.package_name || orderData.items[0]?.package_name || "None");
  }

  useEffect(() => {
    window.localStorage.removeItem("hb9.admin.redirect");
    setSourceReferralCode(captureHbReferralFromUrl());
    const cachedProducts = readCachedProducts();
    if (cachedProducts.length) setProducts(cachedProducts);
    if (devDashboardActive) {
      setError("");
      setUser(createHbDevDashboardUser(getHbDevWallet()));
      setProducts(hbDevDashboardProducts);
      setPackages([]);
      cacheProducts(hbDevDashboardProducts);
      setReferralSummary({
        sponsor: null,
        items: [],
        directReferrals: [],
        levelSummary: [],
        levelCounts: Array.from({ length: 15 }, (_, index) => ({ level: index + 1, total: 0, active: 0 })),
        totalTeamCount: 0,
        singleLegCount: 0,
        directTeamCount: 0,
        activeTeamCount: 0,
        inactiveTeamCount: 0,
        activeCount: 0,
        inactiveCount: 0,
        packageSummary: { purchase_count: 0, purchase_volume: "0" }
      });
      setWalletData({
        depositAddress: getHbDevWallet(),
        deposits: [],
        balances: { deposit: "0", income: "0" },
        pendingWithdrawals: { total: "0", count: 0 },
        verifiedDeposits: { total: "0", count: 0 },
        pendingDeposits: { total: "0", count: 0 }
      });
      setCurrentPackage("None");
      setLoading(false);
      return;
    }
    Promise.all([fetchHbProducts(), fetchHbPackages().catch(() => ({ items: [] as HbPackage[] }))])
      .then(([productData, packageData]) => {
        if (productData.items.length) {
          setProducts(productData.items);
          cacheProducts(productData.items);
        }
        setPackages(packageData.items);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Packages could not be loaded."));
    const stored = getHbToken();
    if (stored) {
      setToken(stored);
      refresh(stored, true);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loginToast) return;
    const timeout = window.setTimeout(() => setLoginToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [loginToast]);

  useEffect(() => {
    if (!depositToast) return;
    const timeout = window.setTimeout(() => setDepositToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [depositToast]);

  useEffect(() => {
    setLoginToast("");
  }, [pathname, activeTab]);

  useEffect(() => {
    if (devDashboardActive) return;
    const provider = getInjectedProvider();
    if (!provider) return;
    syncProviderWallet(provider, true).catch(() => undefined);
    const accountsChanged = () => syncProviderWallet(provider, true).catch(() => undefined);
    const chainChanged = () => syncProviderWallet(provider, true).catch(() => undefined);
    const focusHandler = () => syncProviderWallet(provider, true).catch(() => undefined);
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") syncProviderWallet(provider, true).catch(() => undefined);
    };
    provider.on?.("accountsChanged", accountsChanged);
    provider.on?.("chainChanged", chainChanged);
    window.addEventListener("focus", focusHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
      window.removeEventListener("focus", focusHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [devDashboardActive, providerWalletAddress, token, user]);

  useEffect(() => {
    const handleSessionCleared = (event: Event) => {
      if (devDashboardActive) return;
      setToken("");
      setUser(null);
      setPackages([]);
      setPurchases([]);
      setOrders([]);
      setWithdrawals([]);
      setIncome([]);
      setSingleLegReserve([]);
      setSingleLegProgress(null);
      setIncomeSummary({ direct_income: "0", level_income: "0", single_leg_income: "0", single_leg_reserve: "0", salaryIncome: "0" });
      setDividendSummary({ dividendIncomeUsd: "0", dividendCapUsd: "0", dividendRemainingUsd: "0" });
      setReferralSummary(null);
      setWalletActivity([]);
      setMyProducts(null);
      setCoins([]);
      setWalletData({
        depositAddress: "",
        deposits: [],
        balances: { deposit: "0", income: "0" },
        pendingWithdrawals: { total: "0", count: 0 },
        verifiedDeposits: { total: "0", count: 0 },
        pendingDeposits: { total: "0", count: 0 }
      });
      setCurrentPackage("None");
      const nextWallet = (event as CustomEvent<{ walletAddress?: string }>).detail?.walletAddress || "";
      providerWalletRef.current = nextWallet;
      setProviderWalletAddress(nextWallet);
      setNotice("");
      setError("");
      setActiveTab("home");
    };
    window.addEventListener("hb9:session-cleared", handleSessionCleared);
    return () => window.removeEventListener("hb9:session-cleared", handleSessionCleared);
  }, [devDashboardActive]);

  async function refresh(activeToken = token, initial = false) {
    if (devDashboardActive) {
      setError("");
      setUser(createHbDevDashboardUser(getHbDevWallet()));
      setProducts((current) => current.length > 0 ? current : []);
      setWalletData((current) => ({ ...current, depositAddress: getHbDevWallet() }));
      setRefreshing(false);
      setLoading(false);
      return;
    }
    if (!activeToken) return;
    if (initial && products.length === 0) setLoading(true);
    setRefreshing(true);
    setError("");
    try {
      const [me, productData, packageData, wallet, purchaseData, orderData, incomeData, referralData, activityData, coinData, config] = await Promise.all([
        fetchHbMe(activeToken),
        fetchHbProducts(),
        fetchHbPackages().catch(() => ({ items: [] as HbPackage[] })),
        fetchHbWallet(activeToken),
        fetchHbPurchases(activeToken),
        fetchHbOrders(activeToken),
        fetchHbIncome(activeToken),
        fetchHbReferrals(activeToken),
        fetchHbWalletActivity(activeToken),
        fetchHbCoins(activeToken).catch(() => ({ items: [] })),
        fetchHbOnchainPackageConfig(activeToken).catch(() => null)
      ]);
      const deliveryData = await fetchHbMyProducts(activeToken).catch(() => null);
      setUser(me.user);
      if (productData.items.length) {
        setProducts(productData.items);
        cacheProducts(productData.items);
      }
      setPackages(packageData.items);
      setPurchases(purchaseData.items);
      setOrders(orderData.items);
      setWithdrawals(wallet.withdrawals);
      setIncome(incomeData.items);
      setSingleLegReserve(incomeData.singleLegReserve);
      setSingleLegProgress(incomeData.singleLegProgress || referralData.singleLegProgress || null);
      setIncomeSummary({
        direct_income: incomeData.summary.direct_income || "0",
        level_income: incomeData.summary.level_income || "0",
        single_leg_income: incomeData.summary.single_leg_income || "0",
        single_leg_reserve: incomeData.summary.single_leg_reserve || "0",
        salaryIncome: "0"
      });
      setDividendSummary({
        dividendIncomeUsd: incomeData.dividendIncomeUsd || "0",
        dividendCapUsd: incomeData.dividendCapUsd || "0",
        dividendRemainingUsd: incomeData.dividendRemainingUsd || "0"
      });
      setReferralSummary(referralData);
      setWalletActivity(activityData.items);
      setMyProducts(deliveryData);
      setCoins(coinData.items);
      setOnchainConfig(config);
      setWalletData({
        depositAddress: wallet.depositAddress,
        deposits: wallet.deposits,
        balances: wallet.balances,
        pendingWithdrawals: wallet.pendingWithdrawals,
        verifiedDeposits: wallet.verifiedDeposits,
        pendingDeposits: wallet.pendingDeposits
      });
      setCurrentPackage(me.currentPackage?.package_name || purchaseData.items[0]?.package_name || orderData.items[0]?.package_name || "None");
    } catch (err) {
      setError(err instanceof Error ? err.message : "HB9 dashboard data could not be loaded.");
      if (initial) {
        clearHbToken();
        setToken("");
        setUser(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleAuthenticated(nextToken: string, nextUser: HbUser) {
    if (typeof window !== "undefined") {
      [
        "hb9.authError",
        "hb9.auth.error",
        "hb9.walletAuthError",
        "hb9.registrationFee",
        "hb9.registrationFeeRequired",
        "hb9.activationFee",
        "hb9.activationFeeRequired"
      ].forEach((key) => {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
      });
    }
    if (devDashboardActive) {
      setUser(createHbDevDashboardUser(getHbDevWallet() || nextUser.wallet_address || nextUser.usdt_bep20_address || ""));
      setNotice("");
      setLoading(false);
      return;
    }
    setError("");
    setNotice("");
    setActiveTab("home");
    saveHbToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    showLoginToast();
    refresh(nextToken, true);
  }

  function logout() {
    if (devDashboardActive) {
      setUser(createHbDevDashboardUser(getHbDevWallet()));
      setActiveTab("home");
      return;
    }
    clearHbToken();
    setToken("");
    setUser(null);
    setActiveTab("home");
  }

  async function convertCoin(coinSymbol: string, usdValue = 0) {
    if (devDashboardActive) return;
    if (coinSymbol === "HB9" && usdValue + Number.EPSILON < HB9_TO_USDT_MIN_USD) {
      setError("");
      setNotice("Minimum $500 HB9 Coin value required to convert.");
      return;
    }
    if (coinSymbol !== "HB9" && usdValue + Number.EPSILON < 2) {
      setError("");
      setNotice("Minimum $2 required to convert.");
      return;
    }
    if (!token) {
      setError("Login required to convert coin balance.");
      return;
    }
    setConvertingCoin(coinSymbol);
    setError("");
    setNotice("");
    try {
      await convertHbCoinToUsdt(token, coinSymbol);
      setNotice(coinSymbol === "HB9" ? "HB9 Coin converted to USDT BEP20." : `${coinSymbol} converted: 50% to USDT BEP20 and 50% to HB9 Coin.`);
      await refresh(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coin conversion failed.");
    } finally {
      setConvertingCoin("");
    }
  }

  async function submitDeposit(amountUsd: number) {
    if (devDashboardActive) return null;
    if (!token) {
      setDepositPaymentStatus("failed");
      return null;
    }
    if (amountUsd + Number.EPSILON < 4) {
      setError("");
      setDepositPaymentStatus("failed");
      return null;
    }
    const receiveAddress = treasuryDepositAddress;
    if (!/^0x[a-fA-F0-9]{40}$/.test(receiveAddress || "")) {
      setDepositPaymentStatus("failed");
      return null;
    }
    setWalletActionBusy("deposit");
    setDepositPaymentStatus("pending_wallet_signature");
    setError("");
    setNotice("");
    try {
      const deposit = await createHbDeposit(token, {
        amountUsd,
        amount: amountUsd,
        network: "bsc",
        token: "USDT",
        chainId: 56,
        walletAddress: receiveAddress,
        treasuryWallet: receiveAddress,
        idempotencyKey: `hb-ui-deposit-${Date.now()}-${crypto.randomUUID()}`
      });
      const expectedWallet = boundWallet;
      if (!/^0x[a-fA-F0-9]{40}$/.test(expectedWallet || "")) {
        throw new Error("Connected wallet address is not available.");
      }
      const txHash = await sendConnectedWalletUsdtTransfer({
        from: expectedWallet,
        to: receiveAddress,
        amount: amountUsd,
        tokenAddress: onchainConfig?.usdtBep20Address || USDT_CONTRACT,
        onSubmitted: () => {
          setDepositPaymentStatus("pending_blockchain_confirmation");
        }
      });
      const depositId = deposit.id || deposit.depositId || "";
      if (!depositId) throw new Error("Deposit id was not returned by HB9.");
      const verified = await verifyHbDeposit(token, depositId, txHash);
      setDepositPaymentStatus("confirmed");
      await refresh(token);
      setDepositToast("Deposit successful");
      return verified;
    } catch (err) {
      setDepositPaymentStatus("failed");
      setError("");
      return null;
    } finally {
      setWalletActionBusy("");
    }
  }

  async function submitWithdrawal(amountUsd: number, walletAddress: string) {
    if (devDashboardActive) return;
    if (!token) {
      setError("Login required to withdraw.");
      return;
    }
    if (amountUsd + Number.EPSILON < HB_WITHDRAWAL_MIN_USD) {
      setError("");
      setNotice(HB_WITHDRAWAL_MIN_ERROR);
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim())) {
      setError("Invalid BEP20 wallet address");
      return;
    }
    if (Number(walletData.balances.deposit || 0) + Number.EPSILON < amountUsd) {
      setError("Insufficient USDT balance");
      return;
    }
    setWalletActionBusy("withdraw");
    setError("");
    setNotice("");
    try {
      await createHbWithdrawal(token, {
        amountUsd,
        walletAddress: walletAddress.trim(),
        currency: "USDT",
        network: "bsc",
        chainId: 56,
        idempotencyKey: `hb-ui-withdraw-${Date.now()}-${crypto.randomUUID()}`
      });
      setNotice("Withdrawal sent on-chain.");
      await refresh(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed.");
    } finally {
      setWalletActionBusy("");
    }
  }

  async function handleBookDownload(bookId: string) {
    if (!token) return;
    setError("");
    setNotice("");
    try {
      const result = await downloadHbBook(token, bookId);
      setNotice("Book download unlocked.");
      if (result.fileUrl) window.open(result.fileUrl, "_blank", "noopener,noreferrer");
      await refresh(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Book download failed.");
    }
  }

  async function handleFollowersRequest(input: { packagePurchaseId: string; platform: HbFollowersPlatform; submittedLink: string }) {
    if (!token) return;
    setError("");
    setNotice("");
    try {
      await createHbFollowersRequest(token, input);
      setNotice("Followers request sent to admin.");
      await refresh(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Followers request failed.");
    }
  }

  async function handleCustomSoftwareRequest(input: { packagePurchaseId?: string; softwareType: string; architecture: "centralized" | "decentralized"; requirementsNote: string }) {
    if (!token) return;
    setError("");
    setNotice("");
    try {
      await createHbCustomSoftwareRequest(token, input);
      setNotice("Custom software request sent to admin.");
      await refresh(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Custom software request failed.");
    }
  }

  async function openBuyFlow(product: HbProduct) {
    console.log("HB9_BUY_CLICK", product.package_id || product.id, product.package_price);
    playAssistant("buy");
    setLastBuyProduct(product);
    setBuyLoadingProductId(product.id);
    if (devDashboardActive) {
      setNotice("");
      setBuyLoadingProductId("");
      return;
    }
    if (!token || !user) {
      setError("Please connect/login first.");
      setNotice("");
      setBuyLoadingProductId("");
      return;
    }
    if (isPackageAlreadyActive(product, purchases, orders)) {
      setError("");
      setNotice("Package already active.");
      setBuyLoadingProductId("");
      return;
    }
    setError("");
    setNotice("");
    try {
      const freshProduct = await resolveFreshProductForBuy(product).catch(() => product);
      if (isPackageAlreadyActive(freshProduct, purchases, orders)) {
        setNotice("Package already active.");
        return;
      }
      if (!freshProduct.active || freshProduct.stock <= 0) {
        setError(HB_PACKAGE_INACTIVE);
        return;
      }
      const config = { ...(onchainConfig || await fetchHbOnchainPackageConfig(token)), mode: "internal" as const };
      setOnchainConfig(config);
      const packageConfig = packageConfigForProduct(config, freshProduct);
      const baseReview: PurchaseReview = {
        product: freshProduct,
        config,
        packageConfig,
        buyerAddress: boundWallet,
        sponsorRef: user.sponsor_referral_code || user.source_referral_code || "",
        stage: "review",
        purchaseMode: "internal"
      };
      setPurchaseReview(baseReview);
    } catch (err) {
      setError(err instanceof Error ? err.message : HB_PACKAGE_API_FAILURE);
    } finally {
      setBuyLoadingProductId("");
    }
  }

  async function confirmBuy() {
    console.log("HB9_CONFIRM_BUY_CLICK", purchaseReview ? { productId: purchaseReview.product.id, packageId: purchaseReview.product.package_id, mode: purchaseReview.purchaseMode } : null);
    if (!token || !purchaseReview) return;
    setPurchaseConfirming(true);
    try {
      await executeBuy(purchaseReview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Package purchase failed.");
      setPurchaseReview((current) => current ? { ...current, stage: "review" } : current);
    } finally {
      setPurchaseConfirming(false);
    }
  }

  async function executeBuy(review: PurchaseReview) {
    if (!token) return;
    const { product, config, packageConfig, buyerAddress, sponsorRef } = review;
    const onchainPackageId = packageConfig ? packageConfig.onchainPackageId ?? packageConfig.packageContractId ?? packageConfig.packageId ?? null : null;
    if (review.purchaseMode === "internal") {
      setPurchaseReview((current) => current ? { ...current, stage: "pending" } : current);
      const previousWalletData = walletData;
      const optimisticDeposit = Math.max(0, Number(walletData.balances.deposit || 0) - Number(product.package_price || 0));
      setWalletData((current) => ({ ...current, balances: { ...current.balances, deposit: String(optimisticDeposit) } }));
      try {
        const result = product.package_type === "package" ? await purchaseHbPackage(token, product.package_id) : await buyHbProduct(token, product.id);
        applyPurchaseBalanceSnapshot(result);
        await refetchAfterSuccessfulBuy(token);
      } catch (err) {
        setWalletData(previousWalletData);
        throw err;
      }
      setPurchaseReview((current) => current ? { ...current, stage: "activated" } : current);
      setNotice("Product purchased. Activation updated from HB9 system.");
      playAssistant("activationSuccess");
      return;
    }
    if (!config.packageManagerAddress || !config.usdtBep20Address || onchainPackageId === null || onchainPackageId === undefined) {
      console.error("HB9 package purchase confirmation config incomplete.", {
        product,
        packageConfig,
        hasPackageManager: Boolean(config.packageManagerAddress),
        hasUsdtBep20: Boolean(config.usdtBep20Address)
      });
      setError(!onchainPackageId ? HB_MAPPING_MISSING : HB_PACKAGE_API_FAILURE);
      return;
    }
    if (config.dryRun) {
      const dryRunHash = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32))).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      setPurchaseReview((current) => current ? { ...current, stage: "pending", txHash: dryRunHash } : current);
      await trackHbOnchainPurchase(token, { txHash: dryRunHash, productId: product.id, packageId: product.package_id, onchainPackageId, buyerAddress, referralCode: sponsorRef });
      await waitForActivation(product.package_name || product.title);
      return;
    }
    const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setError("Please connect/login first.");
      return;
    }
    const browserProvider = new BrowserProvider(ethereum);
    const signer = await browserProvider.getSigner();
    setPurchaseReview((current) => current ? { ...current, stage: "approving" } : current);
    const approval = await new Contract(config.usdtBep20Address, ERC20_ABI, signer).approve(config.packageManagerAddress, parseUnits(String(product.package_price), 18));
    await approval.wait();
    setPurchaseReview((current) => current ? { ...current, stage: "submitting" } : current);
    const referralCode = sponsorRef ? encodeBytes32String(sponsorRef.slice(0, 31)) : "0x0000000000000000000000000000000000000000000000000000000000000000";
    const tx = await new Contract(config.packageManagerAddress, PACKAGE_MANAGER_ABI, signer).buyPackage(onchainPackageId, ZeroAddress, referralCode);
    setPurchaseReview((current) => current ? { ...current, stage: "pending", txHash: tx.hash } : current);
    await trackHbOnchainPurchase(token, { txHash: tx.hash, productId: product.id, packageId: product.package_id, onchainPackageId, buyerAddress, referralCode: sponsorRef });
    await waitForActivation(product.package_name || product.title);
  }

  async function waitForActivation(packageName: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 1500 : 3000));
      await refresh(token);
      const latest = await fetchHbMe(token);
      if (latest.user.status === "active") {
        setUser(latest.user);
        setCurrentPackage(packageName);
        setPurchaseReview((current) => current ? { ...current, stage: "activated" } : current);
        setNotice("Package event indexed. HB9 ID is active.");
        playAssistant("activationSuccess");
        return;
      }
    }
    setNotice("Transaction submitted. Activation will update after the PackagePurchased event is indexed.");
  }

  if (!authenticated) {
    return (
      <main className="min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#020817] text-white [touch-action:pan-y] [overscroll-behavior-y:auto] [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto w-full max-w-[430px] px-3 py-3">
          <HbLandingPage referralCode={sourceReferralCode || getStoredHbReferral()} onAuthenticated={handleAuthenticated} />
          {error ? <ErrorState message={error} /> : null}
        </div>
        <HB9VoiceAssistant activeTab="home" hasActiveProduct={false} loading={loading} event={voiceEvent} />
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#020817] text-white [touch-action:pan-y] [overscroll-behavior-y:auto] [-webkit-overflow-scrolling:touch]">
      <div className="hb-dashboard-bg pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,200,255,0.18),transparent_18rem),radial-gradient(circle_at_90%_22%,rgba(0,123,255,0.14),transparent_18rem),linear-gradient(180deg,#020817_0%,#03111f_46%,#020817_100%)]" />
      <div className="hb-dashboard-bg-grid pointer-events-none absolute inset-0 -z-0 opacity-35 [background-image:linear-gradient(rgba(125,211,252,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.035)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="hb-dashboard-dots pointer-events-none absolute inset-0 -z-0 overflow-x-hidden">
        <span className="absolute left-[12%] top-[13%] h-1 w-1 rounded-full bg-cyan-300/45 shadow-[0_0_14px_rgba(0,200,255,0.75)]" />
        <span className="absolute right-[18%] top-[31%] h-1.5 w-1.5 rounded-full bg-blue-300/35 shadow-[0_0_18px_rgba(0,123,255,0.65)]" />
        <span className="absolute bottom-[22%] left-[24%] h-1 w-1 rounded-full bg-cyan-200/35 shadow-[0_0_14px_rgba(0,200,255,0.6)]" />
        <span className="hb-dashboard-particle left-[28%] top-[42%]" />
        <span className="hb-dashboard-particle right-[12%] top-[58%] [animation-delay:1.2s]" />
        <span className="hb-dashboard-particle bottom-[15%] right-[34%] [animation-delay:2.1s]" />
        <span className="hb-dashboard-streak left-[-20%] top-[18%]" />
        <span className="hb-dashboard-streak right-[-30%] top-[64%] [animation-delay:1.8s]" />
      </div>

      <div className="relative z-10 mx-auto min-h-[100dvh] w-full max-w-[430px] overflow-y-visible px-3.5 pb-[140px] pt-3 [touch-action:pan-y]">
        <header className="sticky top-0 z-20 -mx-3.5 mb-3 border-b border-white/10 bg-[#031226]/70 px-3.5 pb-2.5 pt-2.5 shadow-[0_0_20px_rgba(0,180,255,0.12)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <HB9Logo size="sm" showText className="gap-2.5" textClassName="text-lg" />
                </div>
                <p className="mt-0.5 truncate font-mono text-[11px] text-cyan-100/45">{shortAddress(boundWallet)}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <IconButton label="Refresh dashboard" onClick={() => refresh(token)}><RefreshCw className={refreshing ? "animate-spin" : ""} size={17} /></IconButton>
              <IconButton label="Notifications"><Bell size={17} /></IconButton>
              <IconButton label="Settings" onClick={logout}><Settings size={17} /></IconButton>
            </div>
          </div>
        </header>

        {notice ? <InfoState message={notice} /> : null}
        {loginToast ? <LoginSuccessToast message={loginToast} /> : null}
        {depositToast ? <LoginSuccessToast message={depositToast} /> : null}
        {error && !devDashboardActive ? <ErrorState message={error} onRetry={lastBuyProduct ? () => openBuyFlow(lastBuyProduct) : undefined} retrying={Boolean(buyLoadingProductId)} /> : null}
        {loading ? <DashboardSkeleton /> : null}

        {!loading && activeTab === "home" ? <HomeScreen walletBalance={totalBalance} balances={walletData.balances} user={dashboardUser} boundWallet={boundWallet} currentPackage={currentPackage} products={completePackageProducts} coins={coins} convertingCoin={convertingCoin} buyLoadingProductId={buyLoadingProductId} onConvert={convertCoin} onTab={handleTabChange} onBuy={openBuyFlow} onInstruction={playAssistant} /> : null}
        {!loading && activeTab === "products" ? <MyProductsScreen purchases={purchases} orders={orders} delivery={myProducts} packages={completePackageProducts} buyLoadingProductId={buyLoadingProductId} onBuy={openPackagesScreen} onPackageBuy={openBuyFlow} onBookDownload={handleBookDownload} onFollowersRequest={handleFollowersRequest} onCustomSoftwareRequest={handleCustomSoftwareRequest} /> : null}
        {!loading && activeTab === "packages" ? <AllPackagesScreen products={completePackageProducts} buyLoadingProductId={buyLoadingProductId} onBuy={openBuyFlow} onBack={() => setActiveTab("home")} /> : null}
        {!loading && activeTab === "team" ? <TeamScreen user={dashboardUser} summary={referralSummary} /> : null}
        {!loading && activeTab === "income" ? <IncomeScreen income={income} singleLegReserve={singleLegReserve} singleLegProgress={singleLegProgress} summary={incomeSummary} dividendSummary={dividendSummary} availableBalance={availableBalanceUsd} totalWithdrawn={withdrawals.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amount_usd || 0), 0)} /> : null}
        {!loading && activeTab === "wallet" ? <WalletScreen walletBalance={totalBalance} balances={walletData.balances} deposits={walletData.deposits} withdrawals={withdrawals} activity={walletActivity} boundWallet={boundWallet} depositAddress={treasuryDepositAddress} coins={coins} convertingCoin={convertingCoin} walletActionBusy={walletActionBusy} depositPaymentStatus={depositPaymentStatus} onConvert={convertCoin} onDeposit={submitDeposit} onWithdraw={submitWithdrawal} onRefresh={() => token ? refresh(token) : Promise.resolve()} onInstruction={playAssistant} onModalChange={setActiveWalletModal} onResetDepositStatus={() => setDepositPaymentStatus("idle")} /> : null}
      </div>

      {activeWalletModal !== "deposit" && !purchaseReview ? <BottomNavigation activeTab={activeTab} onChange={handleTabChange} /> : null}
      <HB9VoiceAssistant activeTab={activeTab} hasActiveProduct={hasActiveProduct} loading={loading} event={voiceEvent} />
      {purchaseReview ? <BuyDialog purchase={purchaseReview} busy={purchaseConfirming} onCancel={() => setPurchaseReview(null)} onConfirm={confirmBuy} /> : null}
    </main>
  );
}

function HomeScreen({ walletBalance, balances, user, boundWallet, currentPackage, products, coins, convertingCoin, buyLoadingProductId, onConvert, onTab, onBuy, onInstruction }: { walletBalance: number; balances: { deposit: string; income: string }; user: HbUser; boundWallet: string; currentPackage: string; products: HbProduct[]; coins: HbCoinBalance[]; convertingCoin: string; buyLoadingProductId: string; onConvert: (coinSymbol: string, usdValue?: number) => void; onTab: (tab: TabId) => void; onBuy: (product: HbProduct) => void; onInstruction: (script: HB9VoiceScript) => void }) {
  const quickButtons = [
    { label: "Deposit", icon: Plus, action: () => { onInstruction("deposit"); onTab("wallet"); } },
    { label: "Withdraw", icon: ArrowDownToLine, action: () => { onInstruction("withdraw"); onTab("wallet"); } },
    { label: "My Product", icon: PackageCheck, action: () => onTab("products") },
    { label: "Team", icon: Users, action: () => onTab("team") },
    { label: "Transfer", icon: Send, action: () => onTab("wallet") }
  ];
  const featuredProducts = products.slice(0, 6);
  return (
    <div className="space-y-3">
      <section className="relative overflow-hidden rounded-[22px] border border-cyan-300/12 bg-gradient-to-br from-[#071120] to-[#0d1d35] p-4 shadow-[0_0_24px_rgba(0,200,255,0.12),0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.075),inset_0_-18px_48px_rgba(0,123,255,0.08)] transition duration-200 hover:border-cyan-200/18 hover:shadow-[0_0_28px_rgba(0,200,255,0.16),0_18px_42px_rgba(0,0,0,0.4)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/40 to-transparent" />
        <div className="absolute right-[-4rem] top-[-4rem] h-36 w-36 rounded-full bg-cyan-300/14 blur-3xl" />
        <div className="absolute bottom-[-5rem] left-[-4rem] h-40 w-40 rounded-full bg-blue-500/14 blur-3xl" />
        <span className="absolute right-12 top-8 h-1 w-1 rounded-full bg-cyan-200/60 shadow-[0_0_12px_rgba(0,200,255,0.8)]" />
        <span className="absolute bottom-10 right-20 h-1.5 w-1.5 rounded-full bg-blue-200/30 shadow-[0_0_14px_rgba(0,123,255,0.65)]" />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-cyan-300/8 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100/85">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]" /> Total Balance
            </div>
            <div className="mt-3 text-[1.72rem] font-black leading-none tracking-normal text-white drop-shadow-[0_0_12px_rgba(125,211,252,0.2)]">{money(walletBalance)}</div>
            <WalletAddressPill address={boundWallet} />
          </div>
          <PremiumIllustration type="wallet" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Main Wallet" value={money(balances.deposit)} />
        <MiniStat label="ID Status" value={user.status} />
        <div className="col-span-2"><MiniStat label="Current Package" value={currentPackage} /></div>
      </div>
      <section className="grid grid-cols-5 gap-2">
        {quickButtons.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} className="hb-interactive hb-glow-teal group flex min-h-[66px] flex-col items-center justify-center gap-1.5 rounded-[18px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,34,64,0.78),rgba(3,14,29,0.82))] px-1 text-center shadow-[0_0_12px_rgba(0,200,255,0.06),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/15 hover:bg-cyan-300/[0.055] active:scale-95" onClick={item.action} type="button">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-300/12 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.13)] group-active:bg-cyan-300"><Icon size={15} /></span>
              <span className="max-w-full truncate px-0.5 text-[9px] font-bold leading-3 text-sky-100/78">{item.label}</span>
            </button>
          );
        })}
      </section>
      <MultiCoinWallet coins={coins} withdrawableBalance={balances.deposit} convertingCoin={convertingCoin} onConvert={onConvert} />
      <SectionTitle title="Available Packages" action="All 6 packages" />
      <div className="grid grid-cols-3 gap-2">
        {featuredProducts.length === 0 ? <div className="col-span-3"><EmptyState title="No active packages available." /></div> : featuredProducts.map((product) => <HbPackageProductCard key={`package-${Number(product.package_price)}`} product={product} cta="Buy Now" onBuy={() => onBuy(product)} loading={buyLoadingProductId === product.id} compact />)}
      </div>
    </div>
  );
}

function MyProductsScreen({ purchases, orders, delivery, packages, buyLoadingProductId, onBuy, onPackageBuy, onBookDownload, onFollowersRequest, onCustomSoftwareRequest }: { purchases: HbPurchase[]; orders: HbOrder[]; delivery: HbMyProductsDelivery | null; packages: HbProduct[]; buyLoadingProductId: string; onBuy: () => void; onPackageBuy: (product: HbProduct) => void; onBookDownload: (bookId: string) => void; onFollowersRequest: (input: { packagePurchaseId: string; platform: HbFollowersPlatform; submittedLink: string }) => void; onCustomSoftwareRequest: (input: { packagePurchaseId?: string; softwareType: string; architecture: "centralized" | "decentralized"; requirementsNote: string }) => void }) {
  const [tab, setTab] = useState<"active" | "books" | "requests">("active");
  const [selectedFollowerPackageId, setSelectedFollowerPackageId] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<HbFollowersPlatform | "">("");
  const [packageSheetOpen, setPackageSheetOpen] = useState(false);
  const [platformSheetOpen, setPlatformSheetOpen] = useState(false);
  const [submittedLink, setSubmittedLink] = useState("");
  const [softwareType, setSoftwareType] = useState("");
  const [architecture, setArchitecture] = useState<"centralized" | "decentralized">("centralized");
  const [requirementsNote, setRequirementsNote] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const clearFollowersRequestKeys = (storage: Storage) => {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key));
      keys.forEach((key) => {
        const normalized = key.toLowerCase();
        if (normalized.includes("followersrequest") || normalized.includes("followers-request") || normalized.includes("followers_request") || normalized.includes("followerplatform") || normalized.includes("followers.platform")) {
          storage.removeItem(key);
        }
      });
    };
    clearFollowersRequestKeys(window.localStorage);
    clearFollowersRequestKeys(window.sessionStorage);
    setSelectedPlatform("");
    setSubmittedLink("");
  }, []);
  const deliveredProductsByPurchase = new Map<string, NonNullable<HbMyProductsDelivery["activeProducts"]>[number]>();
  (delivery?.activeProducts || []).forEach((item) => {
    const purchaseId = item.purchaseId || item.purchase_id || item.package_purchase_id;
    if (purchaseId && !deliveredProductsByPurchase.has(purchaseId)) deliveredProductsByPurchase.set(purchaseId, item);
  });
  const uniqueDeliveredProducts = Array.from(deliveredProductsByPurchase.values());
  const myProductPackageName = (amount: unknown, fallback: string) => {
    const packageAmount = Number(amount || 0);
    if (packageAmount === 4) return "Starter Package";
    if (packageAmount === 20) return "Builder Package";
    if (packageAmount === 100) return "Growth Package";
    return fallback;
  };
  const visibleOrders = orders.filter((order) => !/activation product/i.test(String(order.product_title || "")));
  const productRows = uniqueDeliveredProducts.length ? uniqueDeliveredProducts.map((item) => ({
    id: item.purchaseId || item.purchase_id || item.package_purchase_id,
    purchaseId: item.purchaseId || item.purchase_id || item.package_purchase_id,
    packageId: item.package_id,
    title: myProductPackageName(item.price || item.package_price, item.package_name),
    productTitle: myProductPackageName(item.price || item.package_price, item.package_name),
    productImage: "",
    price: item.price || item.package_price,
    status: item.status,
    date: item.purchaseDate || item.purchase_date || item.purchased_at || item.activation_date,
    imageAmount: item.price || item.package_price,
    followersCount: Number(item.followers_count || 0),
    bookLimit: Number(item.book_limit || 0)
  })) : purchases.map((purchase) => ({
    id: purchase.id,
    purchaseId: purchase.id,
    packageId: "",
    title: myProductPackageName(purchase.amount_usd, purchase.package_name),
    productTitle: myProductPackageName(purchase.amount_usd, purchase.package_name),
    productImage: "",
    price: purchase.amount_usd,
    status: purchase.status,
    date: purchase.created_at,
    imageAmount: purchase.amount_usd,
    followersCount: 0,
    bookLimit: 0
  })).concat(visibleOrders.map((order) => ({
    id: order.id,
    purchaseId: order.id,
    packageId: "",
    title: order.product_title,
    productTitle: order.product_title,
    productImage: order.image_url || "",
    price: order.package_price,
    status: order.payment_status,
    date: order.created_at,
    imageAmount: order.package_price,
    followersCount: 0,
    bookLimit: 0
  })));
  const hasPurchases = productRows.length > 0;
  const books = delivery?.books || [];
  const unlockedBooks = books.filter((book) => book.unlocked);
  const latestFollowersRequestsByPurchase = useMemo(() => {
    const requests = new Map<string, HbMyProductsDelivery["followersRequests"][number]>();
    (delivery?.followersRequests || []).forEach((request) => {
      const purchaseId = request.package_purchase_id || "";
      if (purchaseId && !requests.has(purchaseId)) requests.set(purchaseId, request);
    });
    return requests;
  }, [delivery?.followersRequests]);
  const visibleFollowersRequests = useMemo(() => {
    const requests = new Map<string, HbMyProductsDelivery["followersRequests"][number]>();
    (delivery?.followersRequests || []).forEach((request) => {
      const key = request.package_purchase_id || `${request.package_id || "package"}:${request.platform}:${request.submitted_link}`;
      if (!requests.has(key)) requests.set(key, request);
    });
    return Array.from(requests.values());
  }, [delivery?.followersRequests]);
  const completedFollowerPackageAmounts = useMemo(() => {
    const amounts = new Set<number>();
    (delivery?.followersRequests || []).forEach((request) => {
      if (String(request.status || "").toLowerCase() === "completed") amounts.add(Number(request.package_price || 0));
    });
    return amounts;
  }, [delivery?.followersRequests]);
  const followersRequestLabel = (status?: string, item?: { price?: unknown; followersCount?: number }) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "pending") return "Request already pending";
    if (normalized === "completed") return "Followers completed";
    if (normalized === "rejected") return "Rejected - resubmit allowed";
    if (normalized === "approved" || normalized === "processing") return "Request in progress";
    if (item && Number(item.followersCount || 0) <= 0) return "Followers not included";
    if (item && completedFollowerPackageAmounts.has(Number(item.price || 0))) return "Eligible again after rebuy";
    return "No request";
  };
  const isFollowersRequestBlocked = (status?: string) => ["pending", "approved", "processing", "completed"].includes(String(status || "").toLowerCase());
  const selectedFollowerProduct = productRows.find((item) => item.id === selectedFollowerPackageId) || null;
  const selectedFollowerRequest = selectedFollowerProduct ? latestFollowersRequestsByPurchase.get(selectedFollowerProduct.id) : undefined;
  const selectedFollowerRequestStatus = selectedFollowerRequest?.status;
  const selectedFollowerBlocked = isFollowersRequestBlocked(selectedFollowerRequestStatus);
  const hasSubmittedLink = submittedLink.trim().length > 0;
  const canSendFollowersRequest = Boolean(selectedFollowerProduct && selectedFollowerProduct.followersCount > 0 && selectedPlatform && hasSubmittedLink && !selectedFollowerBlocked);
  return (
    <div className="space-y-3">
      <HeroPanel title="My Product" subtitle={`${productRows.length} active products`} icon={PackageCheck} art="package" />
      <SegmentedTabs tabs={[["active", "Active"], ["books", "Books"], ["requests", "Requests"]]} active={tab} onChange={(next) => setTab(next as typeof tab)} />
      {!hasPurchases ? <EmptyState title="No purchased product yet." action={<PrimaryAction onClick={onBuy}>Buy Package</PrimaryAction>} /> : null}
      {tab === "active" ? productRows.map((item) => (
        <GlassCard key={item.id} className="p-3">
          <div className="flex gap-3">
            <HbPackageVisual amount={item.imageAmount} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 font-semibold">{item.productTitle}</h3>
                <span className="rounded-full border border-cyan-200/18 bg-cyan-300/10 px-2 py-1 text-[10px] font-bold capitalize text-cyan-100">{item.status}</span>
              </div>
              <p className="mt-1 text-xs text-sky-100/55">{item.title} - Purchased {new Date(item.date).toLocaleDateString()}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-xl font-black text-cyan-100">{money(item.price)}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-1.5 text-xs text-sky-100/68">
            {featuresForHbPackageAmount(item.imageAmount).slice(0, 3).map((feature) => <FeatureBullet key={feature}>{feature}</FeatureBullet>)}
          </div>
          <div className="mt-4 grid gap-2">
            <button className="hb-interactive hb-glow-purple flex items-center justify-center gap-2 rounded-[1rem] border border-cyan-200/18 bg-cyan-300/10 px-3 py-3 text-sm font-bold text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-200 disabled:opacity-45" disabled={item.followersCount <= 0 || isFollowersRequestBlocked(latestFollowersRequestsByPurchase.get(item.id)?.status)} onClick={() => { setSelectedFollowerPackageId(item.id); setTab("requests"); }} type="button"><Eye size={16} /> {followersRequestLabel(latestFollowersRequestsByPurchase.get(item.id)?.status, item)}</button>
          </div>
        </GlassCard>
      )) : null}
      {tab === "books" ? (
        <GlassCard className="p-3">
          <SectionTitle title="Books" action={`${delivery?.booksUnlocked || unlockedBooks.length} / 100 unlocked`} />
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {books.map((book) => (
              <div key={book.id} className={`hb-interactive hb-glow-cyan rounded-2xl border border-cyan-200/10 bg-[#071b34]/72 p-2.5 ${book.unlocked ? "" : "opacity-72"}`}>
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-cyan-200/10 bg-cyan-300/10">
                  {book.cover_image ? <img className={`h-full w-full object-cover ${book.unlocked ? "" : "blur-[2px] grayscale"}`} src={book.cover_image} alt="" /> : <div className={`grid h-full w-full place-items-center text-cyan-100 ${book.unlocked ? "" : "blur-[2px]"}`}><Download size={22} /></div>}
                  <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-[#031326]/80 px-2 py-0.5 text-[9px] font-black text-cyan-50">{book.unlocked ? "Unlocked" : "Locked"}</div>
                </div>
                <div className="mt-2 min-h-[2.5rem] text-sm font-black leading-5 text-cyan-50 line-clamp-2">{book.title}</div>
                <button className="mt-2 w-full rounded-xl bg-cyan-300 px-3 py-2 text-[10px] font-black text-[#031326] disabled:bg-slate-600 disabled:text-slate-300" disabled={!book.unlocked} onClick={() => onBookDownload(book.id)} type="button">{book.unlocked ? "Download" : "Locked"}</button>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : null}
      {tab === "requests" ? (
        <div className="space-y-3">
          <GlassCard className="p-3">
            <SectionTitle title="Followers Request" action={selectedFollowerProduct?.followersCount ? `${selectedFollowerProduct.followersCount} followers` : "Select package"} />
            <div className="mt-3 grid gap-4 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
              <div className="grid gap-2.5">
                {hasPurchases ? (
                  <button
                    className={`hb-interactive hb-glow-cyan flex min-h-[4.25rem] items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.98] ${selectedFollowerProduct ? "border-cyan-200/80 bg-cyan-300/18 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.34),inset_0_1px_0_rgba(255,255,255,0.10)]" : "border-cyan-200/16 bg-[#071b34]/78 text-sky-100/72"}`}
                    onClick={() => setPackageSheetOpen(true)}
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={packageSheetOpen}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{selectedFollowerProduct?.title || "Select Package"}</span>
                      <span className="mt-1 block text-[11px] font-bold text-sky-100/55">{selectedFollowerProduct ? `Purchase ${String(selectedFollowerProduct.purchaseId || selectedFollowerProduct.id).slice(0, 8)}` : "Only purchased packages are shown"}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs font-bold">
                      <span className="block">{selectedFollowerProduct ? money(selectedFollowerProduct.price) : `${productRows.length} available`}</span>
                      <span className={selectedFollowerRequestStatus === "rejected" ? "text-red-100/80" : "text-cyan-100/62"}>{selectedFollowerProduct ? followersRequestLabel(selectedFollowerRequestStatus, selectedFollowerProduct) : "No package selected"}</span>
                    </span>
                  </button>
                ) : <button className="rounded-2xl border border-cyan-200/16 bg-[#071b34]/78 px-3 py-3 text-sm font-black text-sky-100/72" onClick={onBuy} type="button">Buy a package first</button>}
              </div>
              <div className={`rounded-2xl border px-3.5 py-3 text-xs font-bold ${selectedFollowerRequestStatus === "rejected" ? "border-red-200/18 bg-red-500/10 text-red-100" : selectedFollowerProduct ? "border-cyan-200/18 bg-cyan-300/10 text-cyan-100/82" : "border-cyan-200/12 bg-[#071b34]/72 text-sky-100/56"}`}>
                <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/52">Status</div>
                <div className="mt-1">{selectedFollowerProduct ? followersRequestLabel(selectedFollowerRequestStatus, selectedFollowerProduct) : "Select a purchased package"}</div>
              </div>
              {selectedFollowerProduct ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-2xl border border-cyan-200/12 bg-[#071b34]/72 p-3">
                    <div className="text-sky-100/48">Followers</div>
                    <div className="mt-1 font-black text-cyan-50">{selectedFollowerProduct.followersCount}</div>
                  </div>
                  <div className="rounded-2xl border border-cyan-200/12 bg-[#071b34]/72 p-3">
                    <div className="text-sky-100/48">Package</div>
                    <div className="mt-1 truncate font-black text-cyan-50">{money(selectedFollowerProduct.price)}</div>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <label className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100/60">Platform</label>
                <button
                  className={`hb-interactive hb-glow-cyan flex min-h-[3.35rem] items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${selectedPlatform ? "border-cyan-200/40 bg-cyan-300/12 text-cyan-50" : "border-cyan-200/16 bg-[#071b34]/78 text-sky-100/48"}`}
                  onClick={() => setPlatformSheetOpen(true)}
                  disabled={!selectedFollowerProduct || selectedFollowerBlocked || selectedFollowerProduct.followersCount <= 0}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={platformSheetOpen}
                >
                  <span className="text-sm font-black">{selectedPlatform || "Select platform"}</span>
                  <ChevronDown size={18} className="shrink-0 text-cyan-100/70" />
                </button>
              </div>
              <input className="field disabled:cursor-not-allowed disabled:opacity-45" disabled={!selectedFollowerProduct || selectedFollowerBlocked || selectedFollowerProduct.followersCount <= 0} placeholder="Profile/page/channel/group link" value={submittedLink} onChange={(event) => setSubmittedLink(event.target.value)} />
              <button className="hb-interactive hb-glow-cyan rounded-2xl bg-cyan-300 px-4 py-3 font-black text-[#031326] disabled:opacity-45" disabled={!canSendFollowersRequest} onClick={() => canSendFollowersRequest && selectedFollowerProduct && selectedPlatform ? onFollowersRequest({ packagePurchaseId: selectedFollowerProduct.id, platform: selectedPlatform, submittedLink: submittedLink.trim() }) : undefined} type="button">Send Request</button>
            </div>
          </GlassCard>
          {packageSheetOpen ? (
            <div className="fixed inset-0 z-[120] flex items-end bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Select package">
              <button className="absolute inset-0 h-full w-full cursor-default" onClick={() => setPackageSheetOpen(false)} type="button" aria-label="Close package selector" />
              <div className="relative max-h-[86vh] w-full overflow-y-auto rounded-t-[26px] border border-cyan-200/16 bg-[#041225] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-[0_-22px_60px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.07)]">
                <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-cyan-100/25" />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-black text-cyan-50">Select Package</div>
                    <div className="text-xs font-bold text-sky-100/48">Purchased packages only</div>
                  </div>
                  <button className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/14 bg-[#071b34]/90 text-cyan-100" onClick={() => setPackageSheetOpen(false)} type="button" aria-label="Close package selector">
                    <X size={18} />
                  </button>
                </div>
                <div className="grid gap-2">
                  {productRows.map((item) => {
                    const selected = selectedFollowerProduct?.id === item.id;
                    const requestStatus = latestFollowersRequestsByPurchase.get(item.id)?.status;
                    const disabled = item.followersCount <= 0 || isFollowersRequestBlocked(requestStatus);
                    return (
                      <button
                        key={item.id}
                        className={`hb-interactive hb-glow-cyan flex min-h-[4.35rem] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-cyan-200/70 bg-cyan-300 text-[#031326] shadow-[0_0_22px_rgba(34,211,238,0.28)]" : "border-cyan-200/14 bg-[#071b34]/86 text-sky-100/80"}`}
                        disabled={disabled}
                        onClick={() => {
                          setSelectedFollowerPackageId(item.id);
                          setSelectedPlatform("");
                          setSubmittedLink("");
                          setPackageSheetOpen(false);
                        }}
                        type="button"
                        aria-pressed={selected}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black">{item.title}</span>
                          <span className={`mt-1 block text-xs font-bold ${selected ? "text-[#031326]/72" : "text-sky-100/52"}`}>{item.followersCount} followers</span>
                        </span>
                        <span className="shrink-0 text-right text-xs font-black">
                          <span className="block">{money(item.price)}</span>
                          <span className={requestStatus === "rejected" ? "text-red-100/90" : selected ? "text-[#031326]/72" : "text-cyan-100/62"}>{followersRequestLabel(requestStatus, item)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
          {platformSheetOpen ? (
            <div className="fixed inset-0 z-[120] flex items-end bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Select platform">
              <button className="absolute inset-0 h-full w-full cursor-default" onClick={() => setPlatformSheetOpen(false)} type="button" aria-label="Close platform selector" />
              <div className="relative w-full rounded-t-[26px] border border-cyan-200/16 bg-[#041225] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-[0_-22px_60px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.07)]">
                <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-cyan-100/25" />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-black text-cyan-50">Platform</div>
                    <div className="text-xs font-bold text-sky-100/48">Select platform</div>
                  </div>
                  <button className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/14 bg-[#071b34]/90 text-cyan-100" onClick={() => setPlatformSheetOpen(false)} type="button" aria-label="Close platform selector">
                    <X size={18} />
                  </button>
                </div>
                <div className="grid gap-2">
                  {followerPlatforms.map((platform) => {
                    const selected = selectedPlatform === platform.value;
                    return (
                      <button
                        key={platform.value}
                        className={`hb-interactive hb-glow-cyan flex min-h-[3.35rem] items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-black transition active:scale-[0.98] ${selected ? "border-cyan-200/70 bg-cyan-300 text-[#031326] shadow-[0_0_22px_rgba(34,211,238,0.28)]" : "border-cyan-200/14 bg-[#071b34]/86 text-sky-100/80"}`}
                        onClick={() => {
                          setSelectedPlatform(platform.value);
                          setPlatformSheetOpen(false);
                        }}
                        type="button"
                        aria-pressed={selected}
                      >
                        <span>{platform.label}</span>
                        {selected ? <span className="text-xs font-black">Selected</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
          <GlassCard className="p-3"><SectionTitle title="Request Status" /><div className="mt-2 space-y-2">{visibleFollowersRequests.length ? visibleFollowersRequests.map((item) => <HistoryRow key={item.id} title={`${item.platform} - ${item.status}`} meta={`${item.followers_count} followers - ${new Date(item.created_at).toLocaleString()}${item.admin_note ? ` - ${item.admin_note}` : ""}`} value={item.package_name || "Package"} />) : <EmptyState title="No followers requests yet." />}</div></GlassCard>
          {Number(delivery?.bestPackage?.package_price || 0) >= 12500 ? (
            <GlassCard className="p-3">
              <SectionTitle title="Custom Software Request" action="3 slots" />
              <div className="mt-3 grid gap-2">
                <input className="field" placeholder="Software type" value={softwareType} onChange={(event) => setSoftwareType(event.target.value)} />
                <select className="field" value={architecture} onChange={(event) => setArchitecture(event.target.value as typeof architecture)}><option value="centralized">Centralized</option><option value="decentralized">Decentralized</option></select>
                <textarea className="field min-h-24" placeholder="Requirements note" value={requirementsNote} onChange={(event) => setRequirementsNote(event.target.value)} />
                <button className="hb-interactive hb-glow-cyan rounded-2xl bg-cyan-300 px-4 py-3 font-black text-[#031326] disabled:opacity-45" disabled={!softwareType.trim() || requirementsNote.trim().length < 10} onClick={() => onCustomSoftwareRequest({ packagePurchaseId: delivery?.bestPackage?.package_purchase_id, softwareType, architecture, requirementsNote })} type="button">Send Custom Request</button>
              </div>
            </GlassCard>
          ) : null}
        </div>
      ) : null}
      {delivery?.softwareAccess?.length ? <GlassCard className="p-3"><SectionTitle title="Software Access" /><div className="mt-2 grid gap-2">{delivery.softwareAccess.map((item) => <HistoryRow key={item.software_key} title={item.title} meta={item.description || "Included software access"} value="Access" />)}</div></GlassCard> : null}
      <SectionTitle title="All Packages" action="Complete list" />
      <HbAllPackagesList products={packages} onBuy={onPackageBuy} loadingProductId={buyLoadingProductId} />
    </div>
  );
}

function ProductActions() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button className="hb-interactive hb-glow-cyan flex items-center justify-center gap-2 rounded-[1rem] bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-500 px-3 py-3 text-sm font-black text-[#03111f] shadow-[0_0_20px_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-200 active:scale-[0.97]" type="button"><Download size={16} /> Download</button>
      <button className="hb-interactive hb-glow-purple flex items-center justify-center gap-2 rounded-[1rem] border border-cyan-200/18 bg-cyan-300/10 px-3 py-3 text-sm font-bold text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-200 active:scale-[0.97]" type="button"><Eye size={16} /> View Details</button>
    </div>
  );
}

function WhatsAppBrandIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.04 2a9.86 9.86 0 0 0-8.45 14.93L2.2 22l5.2-1.36A9.95 9.95 0 1 0 12.04 2Zm5.82 14.08c-.24.67-1.39 1.29-1.94 1.37-.5.07-1.12.1-1.81-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.77-.36h.56c.18.01.43-.07.67.51.24.58.82 2 .89 2.15.07.14.12.31.02.5-.09.19-.14.31-.29.48-.14.17-.31.38-.43.51-.14.14-.29.3-.12.59.17.29.74 1.22 1.59 1.97 1.09.97 2.01 1.27 2.3 1.42.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.39-.24.65-.14.27.1 1.69.8 1.98.94.29.14.48.22.55.34.07.12.07.7-.17 1.39Z" />
    </svg>
  );
}

function TelegramBrandIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21.95 4.56c-.18-.7-.82-.96-1.47-.72L2.86 10.63c-.6.24-.59.84-.1 1l4.52 1.41 1.73 5.33c.22.61.55.75 1.11.38l2.5-1.82 4.64 3.43c.54.3.93.14 1.07-.5l3.62-15.3ZM8 12.72l8.86-5.6c.43-.26.82-.12.5.17l-7.16 6.46-.28 3.02L8 12.72Z" />
    </svg>
  );
}

function FacebookBrandIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14.12 8.67V6.9c0-.86.58-1.06.99-1.06h2.52V2.02L14.16 2c-3.86 0-4.74 2.89-4.74 4.74v1.93H6.89v3.93h2.53V22h4.7v-9.4h3.16l.42-3.93h-3.58Z" />
    </svg>
  );
}

function InstagramBrandIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <rect width="15.5" height="15.5" x="4.25" y="4.25" stroke="currentColor" strokeWidth="2" rx="4.3" />
      <circle cx="12" cy="12" r="3.15" stroke="currentColor" strokeWidth="2" />
      <circle cx="16.7" cy="7.3" r="1.1" fill="currentColor" />
    </svg>
  );
}

function getHb9ReferralPromoText(referralLink: string) {
  return ` Join HB9 — The Future of Decentralized Business

✅ AI Powered Business Packages
✅ Blockchain Technology
✅ HB9 Token Utility
✅ Global Community Growth
✅ Daily Opportunities
✅ Decentralized Ecosystem

Start your journey with HB9 today.

Register using my referral link:

${referralLink}

 www.hb9.live`;
}

function TeamScreen({ user, summary }: { user: HbUser; summary: HbReferralSummary | null }) {
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareToast, setShareToast] = useState("");
  const referralUrl = typeof window === "undefined" ? user.referral_code : `${window.location.origin}/halal-business?ref=${user.referral_code}`;
  const promoText = getHb9ReferralPromoText(referralUrl);
  const encodedPromoText = encodeURIComponent(promoText);
  const encodedUrl = encodeURIComponent(referralUrl);
  const sponsorWallet = summary?.sponsor?.id || user.sponsor_referral_code || user.source_referral_code || "No sponsor wallet";
  const totalTeamCount = Number(summary?.totalTeamCount || 0);
  const singleLegCount = Number(summary?.singleLegCount ?? summary?.singleLegProgress?.singleLegTeamCount ?? 0);
  const directTeamCount = Number(summary?.directTeamCount ?? summary?.directReferrals.length ?? 0);
  const activeTeamCount = Number(summary?.activeTeamCount ?? summary?.activeCount ?? 0);
  const inactiveTeamCount = Number(summary?.inactiveTeamCount ?? summary?.inactiveCount ?? 0);
  const levelRows = Array.from({ length: 15 }, (_, index) => {
    const levelNo = index + 1;
    const levelCount = summary?.levelCounts?.find((item) => Number(item.level) === levelNo);
    if (levelCount) {
      return {
        level_no: levelNo,
        total_count: Number(levelCount.total || 0),
        active_count: Number(levelCount.active || 0),
        inactive_count: Math.max(Number(levelCount.total || 0) - Number(levelCount.active || 0), 0)
      };
    }
    const existing = summary?.levelSummary.find((item) => Number(item.level_no) === levelNo);
    return existing || { level_no: levelNo, total_count: 0, active_count: 0, inactive_count: 0 };
  });
  const showShareToast = (message: string) => {
    setShareToast(message);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setShareToast(""), 2200);
    }
  };
  const copyReferralLink = async (message?: string) => {
    await navigator.clipboard?.writeText(referralUrl);
    if (message) showShareToast(message);
  };
  const copyPromotionText = async () => {
    await navigator.clipboard?.writeText(promoText);
    showShareToast("Promotion text and referral link copied successfully.");
  };
  const openShareUrl = (url: string) => {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setShareSheetOpen(false);
  };
  return (
    <div className="space-y-3 pb-8">
      <HeroPanel title="Total Team" subtitle={`${totalTeamCount} members`} icon={Users} art="team" />
      <div className="grid grid-cols-2 gap-3">
        <BigMetric label="Total Team" value={String(totalTeamCount)} icon={Users} />
        <BigMetric label="Single Leg" value={String(singleLegCount)} icon={Layers3} />
      </div>
      <div className="grid grid-cols-2 gap-3"><MiniStat label="Direct Team" value={String(directTeamCount)} /><MiniStat label="Active / Inactive" value={`${activeTeamCount} / ${inactiveTeamCount}`} /></div>
      <GlassCard className="p-3">
        <SectionTitle title="Team Overview" action="Level 1–15" />
        <div className="mt-3 max-h-[30rem] space-y-2 overflow-y-auto overscroll-contain pr-1 pb-1 [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.35)_transparent]">
          {levelRows.map((item) => <LevelTile key={item.level_no} level={`Level ${item.level_no}`} total={Number(item.total_count || 0)} active={Number(item.active_count || 0)} />)}
        </div>
      </GlassCard>
      <GlassCard className="hb-glow-purple p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/60">Referral Link</p>
        <div className="mt-2 break-all rounded-xl border border-cyan-200/10 bg-[#061a31]/75 p-2.5 font-mono text-[11px] text-sky-100/80">{referralUrl}</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="hb-interactive hb-glow-cyan flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-bold text-cyan-100" onClick={() => copyReferralLink()} type="button"><Copy size={14} /> Copy Referral Link</button>
          <button className="hb-interactive hb-glow-purple flex items-center justify-center gap-2 rounded-xl border border-cyan-200/15 bg-cyan-300/10 px-2 py-2 text-xs font-bold text-cyan-100" onClick={() => setShareSheetOpen(true)} type="button"><Share2 size={14} /> Share Referral Link</button>
        </div>
        {shareToast ? <div className="mt-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100">{shareToast}</div> : null}
      </GlassCard>
      {shareSheetOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/65 px-3 pb-28 backdrop-blur-sm" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }} onClick={() => setShareSheetOpen(false)} role="dialog" aria-modal="true" aria-label="Share referral link">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-[1.35rem] border border-cyan-200/12 bg-[#07172b] p-4 shadow-[0_-20px_50px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/60">Share via</p>
                <p className="mt-1 text-sm font-bold text-sky-100">Referral Link</p>
              </div>
              <button className="hb-interactive grid h-8 w-8 place-items-center rounded-xl border border-cyan-200/12 text-cyan-100" onClick={() => setShareSheetOpen(false)} type="button" aria-label="Close share sheet"><X size={16} /></button>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <button className="hb-interactive rounded-2xl border border-cyan-200/10 bg-white/[0.04] p-2.5 text-center" onClick={() => openShareUrl(`https://wa.me/?text=${encodedPromoText}`)} type="button" aria-label="Share on WhatsApp"><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#25D366] text-white"><WhatsAppBrandIcon /></span><span className="mt-2 block text-[11px] font-semibold text-sky-100/80">WhatsApp</span></button>
              <button className="hb-interactive rounded-2xl border border-cyan-200/10 bg-white/[0.04] p-2.5 text-center" onClick={() => openShareUrl(`https://t.me/share/url?url=${encodedUrl}&text=${encodedPromoText}`)} type="button" aria-label="Share on Telegram"><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#229ED9] text-white"><TelegramBrandIcon /></span><span className="mt-2 block text-[11px] font-semibold text-sky-100/80">Telegram</span></button>
              <button className="hb-interactive rounded-2xl border border-cyan-200/10 bg-white/[0.04] p-2.5 text-center" onClick={() => openShareUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)} type="button" aria-label="Share on Facebook"><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#1877F2] text-white"><FacebookBrandIcon /></span><span className="mt-2 block text-[11px] font-semibold text-sky-100/80">Facebook</span></button>
              <button className="hb-interactive rounded-2xl border border-cyan-200/10 bg-white/[0.04] p-2.5 text-center" onClick={() => { copyPromotionText(); setShareSheetOpen(false); }} type="button" aria-label="Copy promotion text for Instagram"><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] text-white"><InstagramBrandIcon /></span><span className="mt-2 block text-[11px] font-semibold text-sky-100/80">Instagram</span></button>
            </div>
          </div>
        </div>
      ) : null}
      <GlassCard className="hb-glow-teal p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/60">Sponsor Wallet</p><div className="mt-2 flex items-center gap-2.5"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300/12 text-cyan-100"><Users size={17} /></div><div className="min-w-0 flex-1"><div className="truncate font-mono text-xs font-semibold">{sponsorWallet}</div><div className="text-[11px] text-sky-100/55">{summary?.sponsor?.display_name || "Root account"}</div></div><button className="hb-interactive hb-glow-teal grid h-8 w-8 place-items-center rounded-xl text-cyan-100" onClick={() => navigator.clipboard?.writeText(sponsorWallet)} type="button" aria-label="Copy sponsor wallet"><Copy size={15} /></button></div></GlassCard>
    </div>
  );
}

function IncomeScreen({ income, singleLegReserve, singleLegProgress, summary, dividendSummary, availableBalance, totalWithdrawn }: { income: HbIncome[]; singleLegReserve: HbSingleLegReserve[]; singleLegProgress: HbSingleLegProgress | null; summary: { direct_income: string; level_income: string; single_leg_income: string; single_leg_reserve: string; salaryIncome: string }; dividendSummary: { dividendIncomeUsd: string; dividendCapUsd: string; dividendRemainingUsd: string }; availableBalance: string | number; totalWithdrawn: number }) {
  const totalIncome = Number(summary.direct_income || 0) + Number(summary.level_income || 0) + Number(summary.single_leg_income || 0) + Number(summary.salaryIncome || 0) + Number(dividendSummary.dividendIncomeUsd || 0);
  const rows = [
    { label: "Referral Income", value: summary.direct_income, icon: Users },
    { label: "Level Income", value: summary.level_income, icon: Layers3 },
    { label: "Single Leg Income", value: summary.single_leg_income || summary.single_leg_reserve, icon: TrendingUp },
    { label: "Salary Income", value: summary.salaryIncome, icon: CircleDollarSign },
    { label: "Total Withdrawn", value: totalWithdrawn, icon: Banknote }
  ];
  return (
    <div className="space-y-3">
      <section className="relative overflow-hidden rounded-[22px] border border-cyan-300/10 bg-gradient-to-br from-[#071120] to-[#0d1d35] p-4 shadow-[0_0_20px_rgba(0,200,255,0.1),inset_0_1px_0_rgba(255,255,255,0.065),inset_0_-18px_44px_rgba(0,123,255,0.07)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/35 to-transparent" />
        <span className="absolute right-12 top-8 h-1 w-1 rounded-full bg-cyan-200/55 shadow-[0_0_12px_rgba(0,200,255,0.7)]" />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100/62">Total Income</p><div className="mt-2 text-3xl font-black">{money(totalIncome)}</div><p className="mt-1 text-xs text-sky-100/58">All earning streams combined</p></div>
          <PremiumIllustration type="coins" />
        </div>
      </section>
      {rows.map((item) => <IncomeRow key={item.label} label={item.label} value={money(item.value)} icon={item.icon} />)}
      <GlassCard className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-sky-100/72">Dividend Income</p>
            <div className="mt-1 text-xl font-black">{money(dividendSummary.dividendIncomeUsd)} / {money(dividendSummary.dividendCapUsd)}</div>
            <p className="mt-1 text-xs text-sky-100/58">Remaining {money(dividendSummary.dividendRemainingUsd)}</p>
          </div>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300/12 text-cyan-100">
            <CircleDollarSign size={18} />
          </div>
        </div>
      </GlassCard>
      <GlassCard className="p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-sky-100/62">Available Balance</p><div className="mt-1 text-xl font-black">{money(availableBalance)}</div></div><PremiumIllustration type="wallet" compact /></div></GlassCard>
      <PremiumSingleLegMilestones progress={singleLegProgress} />
      <GlassCard className="p-3"><SectionTitle title="Income History" /><div className="mt-2 space-y-2">{income.length || singleLegReserve.length ? [...income, ...singleLegReserve].map((item) => <HistoryRow key={item.id} title={"income_type" in item ? item.income_type.replace(/_/g, " ") : "Single leg income"} meta={`${item.status} - ${new Date(item.created_at).toLocaleString()}`} value={`+${money(item.amount_usd)}`} positive />) : <EmptyState title="No income history yet." />}</div></GlassCard>
    </div>
  );
}

const singleLegMilestoneRows = [
  { level: 1, members: 100, reward: 10, referrals: 1 },
  { level: 2, members: 350, reward: 20, referrals: 2 },
  { level: 3, members: 1350, reward: 40, referrals: 3 },
  { level: 4, members: 2850, reward: 80, referrals: 5 },
  { level: 5, members: 7850, reward: 150, referrals: 8 },
  { level: 6, members: 22850, reward: 350, referrals: 12 },
  { level: 7, members: 72850, reward: 1500, referrals: 22 },
  { level: 8, members: 272850, reward: 5000, referrals: 42 },
  { level: 9, members: 1272850, reward: 10000, referrals: 92 }
];

function PremiumSingleLegMilestones({ progress }: { progress: HbSingleLegProgress | null }) {
  const teamCount = Number(progress?.singleLegTeamCount || 0);
  const rewards = progress?.rewards || [];
  return (
    <div className="mt-1 space-y-2">
      <h3 className="pt-1 text-left text-sm font-black text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.32)]">Single Leg Milestone</h3>
      {singleLegMilestoneRows.map((row) => {
        const status = String(rewards.find((reward) => Number(reward.slab_number) === row.level)?.status || "");
        const done = status === "paid";
        const active = !done && teamCount > 0 && teamCount <= row.members;
        const current = Math.min(teamCount, row.members);
        const pct = Math.min(100, current / row.members * 100);
        return <div key={row.level} className="hb-interactive hb-glow-cyan rounded-2xl border border-cyan-200/10 bg-[#071b34]/72 p-3 shadow-[0_0_14px_rgba(34,211,238,0.06)] transition duration-200 hover:border-cyan-200/22 hover:bg-cyan-300/[0.055] hover:shadow-[0_0_22px_rgba(34,211,238,0.15)] active:scale-[0.99]"><div className="flex items-center justify-between gap-2"><div className="font-black">Level {row.level}</div><StatusBadgeMini status={done ? "Completed" : active ? "In Progress" : "Pending"} /></div><div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-sky-100/65"><span>{row.members.toLocaleString()} members</span><span>{money(row.reward)}</span><span>{row.referrals} directs</span></div><div className="mt-2 flex items-center justify-between text-[10px] text-sky-100/50"><span>{current.toLocaleString()} / {row.members.toLocaleString()}</span><span>{pct.toFixed(0)}%</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#020817] shadow-[inset_0_1px_5px_rgba(0,0,0,0.42)]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 shadow-[0_0_12px_rgba(34,211,238,0.42)] transition-all duration-700" style={{ width: `${pct}%` }} /></div></div>;
      })}
    </div>
  );
}

function StatusBadgeMini({ status }: { status: "Completed" | "In Progress" | "Pending" }) {
  const cls = status === "Completed" ? "border-emerald-300/25 bg-emerald-300/15 text-emerald-100" : status === "In Progress" ? "border-cyan-300/25 bg-cyan-300/15 text-cyan-100 animate-pulse" : "border-slate-400/15 bg-slate-400/10 text-slate-300";
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${cls}`}>{status}</span>;
}

function WalletScreen({ walletBalance, balances, deposits, withdrawals, activity, boundWallet, depositAddress, coins, convertingCoin, walletActionBusy, depositPaymentStatus, onConvert, onDeposit, onWithdraw, onRefresh, onInstruction, onModalChange, onResetDepositStatus }: { walletBalance: number; balances: { deposit: string; income: string }; deposits: HbDeposit[]; withdrawals: HbWithdrawal[]; activity: HbWalletActivity[]; boundWallet: string; depositAddress: string; coins: HbCoinBalance[]; convertingCoin: string; walletActionBusy: string; depositPaymentStatus: DepositPaymentStatus; onConvert: (coinSymbol: string, usdValue?: number) => void; onDeposit: (amountUsd: number) => Promise<HbDeposit | null>; onWithdraw: (amountUsd: number, walletAddress: string) => Promise<void>; onRefresh: () => Promise<void>; onInstruction: (script: HB9VoiceScript) => void; onModalChange: (modal: "deposit" | "withdraw" | null) => void; onResetDepositStatus: () => void }) {
  const [walletModal, setWalletModal] = useState<"deposit" | "withdraw" | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawWallet, setWithdrawWallet] = useState(boundWallet || "");
  const depositValue = Number(depositAmount || 0);
  const hasDepositAddress = /^0x[a-fA-F0-9]{40}$/.test(depositAddress || "");
  const withdrawValue = Number(withdrawAmount || 0);
  const withdrawFee = Number((withdrawValue * 0.1).toFixed(8));
  const withdrawNet = Math.max(0, Number((withdrawValue - withdrawFee).toFixed(8)));
  const activeDepositWatch = walletModal === "deposit" && deposits.some((item) => item.status === "pending" || item.status === "pending_verification");
  const depositStatusText: Record<DepositPaymentStatus, string> = {
    idle: "",
    pending_wallet_signature: "Processing...",
    pending_blockchain_confirmation: "Processing...",
    confirmed: "Confirmed",
    failed: "Failed"
  };
  function closeDepositModal() {
    setWalletModal(null);
    setDepositAmount("");
    onResetDepositStatus();
  }
  useEffect(() => {
    onModalChange(walletModal);
    return () => onModalChange(null);
  }, [onModalChange, walletModal]);
  useEffect(() => {
    if (!activeDepositWatch) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      if (!cancelled) onRefresh().catch(() => undefined);
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeDepositWatch, onRefresh]);
  return (
    <div className="space-y-3">
      <section className="relative overflow-hidden rounded-[22px] border border-cyan-300/10 bg-gradient-to-br from-[#071120] to-[#0d1d35] p-4 shadow-[0_0_20px_rgba(0,200,255,0.1),inset_0_1px_0_rgba(255,255,255,0.065),inset_0_-18px_44px_rgba(0,123,255,0.07)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/35 to-transparent" />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100/62">Wallet Balance</p><div className="mt-2 text-3xl font-black">{money(walletBalance)}</div><WalletAddressPill address={boundWallet} className="mt-2 max-w-full rounded-xl" /></div>
          <PremiumIllustration type="wallet" />
        </div>
      </section>
      <div className="grid grid-cols-4 gap-2">
        <ActionChip label="Deposit" icon={Plus} onClick={() => { onInstruction("deposit"); onResetDepositStatus(); setWalletModal("deposit"); }} />
        <ActionChip label="Withdraw" icon={ArrowDownToLine} onClick={() => { onInstruction("withdraw"); setWalletModal("withdraw"); }} />
        <ActionChip label="Ledger" icon={ReceiptText} />
        <ActionChip label="Settings" icon={Settings} />
      </div>
      <div className="grid grid-cols-2 gap-2"><MiniStat label="Main Wallet" value={money(balances.deposit)} /><MiniStat label="Income Wallet" value={money(balances.income)} /></div>
      <MultiCoinWallet coins={coins} withdrawableBalance={balances.deposit} convertingCoin={convertingCoin} onConvert={onConvert} />
      <GlassCard className="p-3"><SectionTitle title="Withdrawal History" /><div className="mt-2 space-y-2">{withdrawals.length ? withdrawals.map((item) => <WithdrawalHistoryRow key={item.id} item={item} />) : <EmptyState title="No withdrawal history yet." />}</div></GlassCard>
      <GlassCard className="p-3"><SectionTitle title="Ledger" /><div className="mt-2 space-y-2">{activity.length ? activity.map((item) => <HistoryRow key={item.id} title={walletActivityTitle(item)} meta={`${item.direction} - ${item.currency || "USDT"} - ${new Date(item.created_at).toLocaleString()}`} value={signedMoney(item.amount_usd, item.direction)} positive={item.direction === "credit"} negative={item.direction === "debit"} />) : <EmptyState title="No ledger activity yet." />}</div></GlassCard>
      {walletModal === "deposit" ? (
        <WalletActionModal onClose={closeDepositModal} showClose={false}>
          <div className="space-y-3">
            <input className="w-full rounded-2xl border border-cyan-200/12 bg-[#020817] px-3 py-3 text-sm font-bold outline-none focus:border-cyan-300/45" inputMode="decimal" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="Amount" />
            <button
              className="hb-interactive hb-glow-cyan w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-[#031326] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={walletActionBusy === "deposit" || !hasDepositAddress || depositValue < 4}
              onClick={async () => {
                const deposit = await onDeposit(depositValue);
                if (!deposit) return;
                window.setTimeout(() => {
                  closeDepositModal();
                }, 2000);
              }}
              type="button"
            >
              Deposit
            </button>
          </div>
        </WalletActionModal>
      ) : null}
      {walletModal === "withdraw" ? (
        <WalletActionModal
          title="Withdraw USDT BEP20"
          onClose={() => setWalletModal(null)}
          panelClassName="max-h-[calc(100dvh-24px)] overflow-hidden"
          bodyClassName="max-h-[calc(100dvh-112px)] overflow-y-auto overscroll-contain pb-[calc(120px+env(safe-area-inset-bottom))] scroll-pb-[calc(120px+env(safe-area-inset-bottom))]"
        >
          <InfoLine label="Minimum withdrawal" value={`$${HB_WITHDRAWAL_MIN_USD}`} />
          <InfoLine label="Withdrawal charge" value="10%" />
          <InfoLine label="Network" value="BSC Mainnet" />
          <InfoLine label="Available USDT" value={money(balances.deposit)} />
          <label className="mt-3 block text-xs font-bold text-sky-100/62">Amount</label>
          <input className="mt-1 w-full rounded-2xl border border-cyan-200/12 bg-[#020817] px-3 py-3 text-sm font-bold outline-none focus:border-cyan-300/45" inputMode="decimal" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder="10.00" />
          <label className="mt-3 block text-xs font-bold text-sky-100/62">BEP20 wallet address</label>
          <input className="mt-1 w-full rounded-2xl border border-cyan-200/12 bg-[#020817] px-3 py-3 font-mono text-xs font-bold outline-none focus:border-cyan-300/45" value={withdrawWallet} onChange={(event) => setWithdrawWallet(event.target.value)} placeholder="0x..." />
          <div className="mt-3 rounded-2xl border border-cyan-200/10 bg-cyan-300/[0.06] p-3">
            <InfoLine label="Fee" value={money(withdrawFee)} />
            <InfoLine label="You receive" value={money(withdrawNet)} />
          </div>
          {withdrawValue > 0 && withdrawValue < HB_WITHDRAWAL_MIN_USD ? <p className="mt-2 text-xs font-semibold text-red-200">{HB_WITHDRAWAL_MIN_ERROR}</p> : null}
          {withdrawValue > Number(balances.deposit || 0) ? <p className="mt-2 text-xs font-semibold text-red-200">Insufficient USDT balance</p> : null}
          <button className="hb-interactive hb-glow-cyan mt-4 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-[#031326] disabled:cursor-not-allowed disabled:opacity-50" disabled={walletActionBusy === "withdraw" || withdrawValue < HB_WITHDRAWAL_MIN_USD || withdrawValue > Number(balances.deposit || 0)} onClick={async () => { await onWithdraw(withdrawValue, withdrawWallet); setWalletModal(null); }} type="button">{walletActionBusy === "withdraw" ? "Sending..." : "Withdraw Now"}</button>
        </WalletActionModal>
      ) : null}
    </div>
  );
}

function WalletActionModal({ title, children, onClose, panelClassName = "", bodyClassName = "", showClose = true }: { title?: string; children: ReactNode; onClose: () => void; panelClassName?: string; bodyClassName?: string; showClose?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-3 backdrop-blur-sm">
      <div className={`w-full max-w-[430px] rounded-[24px] border border-cyan-200/14 bg-[#061426] p-4 shadow-[0_0_30px_rgba(34,211,238,0.18)] ${panelClassName}`}>
        {title || showClose ? (
          <div className="flex items-center justify-between gap-3">
            {title ? <h3 className="text-lg font-black">{title}</h3> : <span />}
            {showClose ? <button className="rounded-xl border border-cyan-200/12 px-3 py-2 text-xs font-black text-cyan-100" onClick={onClose} type="button">Close</button> : null}
          </div>
        ) : null}
        <div className={`${title || showClose ? "mt-3" : ""} ${bodyClassName}`}>{children}</div>
      </div>
    </div>
  );
}

function depositStatusLabel(item: HbDeposit) {
  if (item.status === "verified") return "Confirmed";
  if (item.status === "failed" || item.status === "rejected") return "Failed";
  if (item.payment_status === "verifying" || item.onchain_status === "confirming" || item.tx_hash) return "Verifying";
  return "Pending";
}

function DepositStatusRow({ item }: { item: HbDeposit }) {
  const label = depositStatusLabel(item);
  const tone = label === "Confirmed" ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-100" : label === "Failed" ? "border-red-300/25 bg-red-400/10 text-red-100" : label === "Verifying" ? "border-cyan-300/25 bg-cyan-300/12 text-cyan-100" : "border-slate-300/15 bg-slate-300/10 text-slate-200";
  const confirmations = item.confirmations ? `${item.confirmations} conf` : "waiting";
  return (
    <div className="rounded-xl border border-white/10 bg-[#020817]/72 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black text-white">{money(item.usd_amount)}</span>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${tone}`}>{label}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-sky-100/55">
        <span>{item.tx_hash ? shortAddress(item.tx_hash) : "Awaiting transfer"}</span>
        <span>{label === "Confirmed" ? "credited" : confirmations}</span>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 py-1 text-xs"><span className="text-sky-100/55">{label}</span><span className="min-w-0 truncate font-black text-cyan-100">{value}</span></div>;
}

function WithdrawalHistoryRow({ item }: { item: HbWithdrawal }) {
  const gross = Number(item.gross_amount ?? item.amount_usd ?? 0);
  const fee = Number(item.fee_amount ?? item.fee_usd ?? 0);
  const net = Number(item.net_amount ?? item.payout_amount_usd ?? Math.max(0, gross - fee));
  const hash = item.tx_hash ? shortAddress(item.tx_hash) : "Pending tx";
  return <HistoryRow title={`${item.currency} ${item.network.toUpperCase()} - ${item.status}`} meta={`Fee ${money(fee)} - Receive ${money(net)} - ${hash} - ${new Date(item.requested_at).toLocaleString()}`} value={money(gross)} />;
}

function WalletAddressPill({ address, className = "" }: { address?: string | null; className?: string }) {
  const display = shortAddress(address);
  return (
    <div className={`inline-flex min-w-0 max-w-full items-center gap-2 overflow-hidden whitespace-nowrap border border-white/10 bg-[#031326]/70 px-2.5 py-1.5 align-middle shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className || "mt-2 rounded-full"}`}>
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-300 text-[10px] font-black text-[#031326]">US</span>
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-cyan-100/72">{display}</span>
      <button className="hb-interactive hb-glow-cyan grid h-6 w-6 shrink-0 place-items-center rounded-lg text-cyan-100 transition hover:bg-cyan-300/10" onClick={() => address ? navigator.clipboard?.writeText(address) : undefined} type="button" aria-label="Copy wallet address" disabled={!address}>
        <Copy size={13} />
      </button>
    </div>
  );
}

const walletCoinList = [
  { key: "USDT", label: "USDT BEP20", network: "" },
  { key: "BTC", label: "BTC", network: "BITCOIN" },
  { key: "ETH", label: "ETH", network: "Ethereum" },
  { key: "BNB", label: "BNB", network: "BINANCE COIN" },
  { key: "TRX", label: "TRX", network: "TRON" },
  { key: "HB9", label: "HB9", network: "HB9 COIN" },
  { key: "PEPE", label: "PEPE", network: "Pepe coin" },
  { key: "DOGE", label: "DOGE", network: "Dogecoin" },
  { key: "SHIB", label: "SHIBA", network: "Shiba Inu" },
  { key: "BTTC", label: "BTTC", network: "BitTorrent Chain" },
  { key: "ADA", label: "ADA", network: "Cardano" }
] as const;

function coinUsdValueFor(symbol: string, item: HbCoinBalance | undefined, usdtBalance: string | number) {
  if (symbol === "USDT") return Number(usdtBalance || 0);
  const balance = Number(item?.balance || 0);
  if (symbol === "HB9") return Number((balance * HB9_COIN_PRICE_USD).toFixed(8));
  const usdValue = Number(item?.usd_value || 0);
  if (Number.isFinite(usdValue) && usdValue > 0) return usdValue;
  const usdPrice = Number(item?.usd_price || 0);
  return Number.isFinite(balance) && Number.isFinite(usdPrice) ? Number((balance * usdPrice).toFixed(8)) : 0;
}

function calculateAvailableBalanceUsd(coins: HbCoinBalance[], usdtBalance: string | number) {
  return walletCoinList.reduce((sum, coin) => {
    const normalized = coin.key === "BTTC" ? ["BTTC", "BTCT"] : coin.key === "SHIB" ? ["SHIB", "SHIBA"] : [coin.key];
    const item = coins.find((entry) => normalized.includes(String(entry.coin_symbol).toUpperCase()) || normalized.includes(String(entry.symbol).toUpperCase()));
    const usdValue = item ? coinUsdValueFor(coin.key, item, item.balance) : coinUsdValueFor(coin.key, item, usdtBalance);
    return sum + (Number.isFinite(usdValue) ? usdValue : 0);
  }, 0);
}

function MultiCoinWallet({ coins, withdrawableBalance, convertingCoin, onConvert }: { coins: HbCoinBalance[]; withdrawableBalance: string | number; convertingCoin: string; onConvert: (coinSymbol: string, usdValue?: number) => void }) {
  const [expandedCoin, setExpandedCoin] = useState("");
  const [convertReview, setConvertReview] = useState<{ coinSymbol: string; usdValue: number } | null>(null);

  function coinFor(symbol: string) {
    const normalized = symbol === "BTTC" ? ["BTTC", "BTCT"] : [symbol];
    return coins.find((item) => normalized.includes(String(item.coin_symbol).toUpperCase()) || normalized.includes(String(item.symbol).toUpperCase()));
  }

  function balanceFor(symbol: string) {
    const coin = coinFor(symbol);
    const value = Number(symbol === "USDT" ? withdrawableBalance : coin?.balance || 0);
    return Number.isFinite(value) && value !== 0 ? value.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0";
  }

  function usdValueFor(symbol: string, item?: HbCoinBalance) {
    return coinUsdValueFor(symbol, item, withdrawableBalance);
  }

  function hb9AmountForReview(review: { coinSymbol: string; usdValue: number }) {
    if (review.coinSymbol === "HB9") return Number(review.usdValue / HB9_COIN_PRICE_USD);
    const usdtSplit = Number((review.usdValue / 2).toFixed(8));
    return Number((review.usdValue - usdtSplit) / HB9_COIN_PRICE_USD);
  }

  return (
    <div className="space-y-2">
      {walletCoinList.map((coin) => {
        const item = coinFor(coin.key);
        const usdValue = usdValueFor(coin.key, item);
        const converting = convertingCoin === coin.key;
        const expanded = expandedCoin === coin.key;
        const canConvert = coin.key !== "USDT";
        return (
          <div key={coin.key} className={`hb-interactive hb-glow-cyan group min-w-0 overflow-hidden rounded-[1.05rem] border bg-[linear-gradient(145deg,rgba(8,34,64,0.78),rgba(3,14,29,0.9))] shadow-[0_0_14px_rgba(0,200,255,0.075),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 ease-out ${expanded ? "hb-interactive-active border-cyan-200/32 shadow-[0_0_24px_rgba(0,200,255,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]" : "border-cyan-200/12 hover:border-cyan-200/22 hover:shadow-[0_0_20px_rgba(0,200,255,0.14)]"}`}>
            <button
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition duration-200 active:scale-[0.99]"
              onClick={() => setExpandedCoin((current) => current === coin.key ? "" : coin.key)}
              type="button"
              aria-expanded={expanded}
              aria-controls={`hb-coin-actions-${coin.key}`}
            >
              <CryptoCoinLogo symbol={coin.key} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black leading-4 text-white">{coin.label}</div>
                {coin.network ? <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-100/48">{coin.network}</div> : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="max-w-[7.25rem] truncate text-sm font-black leading-4 text-cyan-100">{balanceFor(coin.key)}</div>
                <div className="mt-0.5 text-[10px] font-semibold text-sky-100/45">{coin.key === "USDT" ? "USDT" : `$${usdValue.toFixed(2)}`}</div>
                {coin.key === "HB9" ? <div className="mt-0.5 text-[10px] font-semibold text-cyan-100/60">$0.13</div> : null}
              </div>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl border transition duration-200 ${expanded ? "border-cyan-200/24 bg-cyan-300/14 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.18)]" : "border-cyan-200/10 bg-white/[0.03] text-sky-100/42"}`}>
                {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </span>
            </button>
            {canConvert ? (
              <div id={`hb-coin-actions-${coin.key}`} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="px-3 pb-3 pt-0">
                    <div className="translate-y-0 rounded-[0.95rem] border border-cyan-200/12 bg-cyan-300/[0.06] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] transition duration-300">
                      <button
                        className="hb-interactive hb-glow-teal w-full rounded-[0.8rem] border border-cyan-200/18 bg-cyan-300/12 px-3 py-2 text-[10px] font-black text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.1),inset_0_1px_0_rgba(255,255,255,0.05)] transition enabled:hover:bg-cyan-300/18 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={converting}
                        onClick={() => {
                          if (usdValue + Number.EPSILON < 2) {
                            onConvert(coin.key, usdValue);
                            return;
                          }
                          if (coin.key === "HB9" && usdValue + Number.EPSILON < HB9_TO_USDT_MIN_USD) {
                            onConvert(coin.key, usdValue);
                            return;
                          }
                          setConvertReview({ coinSymbol: coin.key, usdValue });
                        }}
                        type="button"
                      >
                        {converting ? "Converting..." : "Convert to USDT BEP20"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {convertReview ? (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/65 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-[430px] overflow-y-auto rounded-[1.6rem] border border-cyan-200/15 bg-[#071827]/95 px-4 pb-28 pt-4 shadow-[0_0_40px_rgba(34,211,238,0.18)] backdrop-blur-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Coin conversion</p>
            <h2 className="mt-2 text-2xl font-semibold">Confirm Convert</h2>
            <p className="mt-2 text-sm leading-6 text-sky-100/62">{convertReview.coinSymbol === "HB9" ? "Convert HB9 Coin to USDT BEP20?" : `Convert ${convertReview.coinSymbol}?`}</p>
            <div className="mt-4 rounded-2xl border border-cyan-200/10 bg-cyan-300/[0.06] p-3 text-sm">
              {convertReview.coinSymbol === "HB9" ? (
                <>
                  <ReviewRow label="HB9 Balance" value={`${hb9AmountForReview(convertReview).toFixed(6)} HB9`} />
                  <ReviewRow label="HB9 Price" value={`$${HB9_COIN_PRICE_USD.toFixed(2)}`} />
                  <ReviewRow label="USDT Credit" value={`$${convertReview.usdValue.toFixed(2)}`} />
                </>
              ) : (
                <>
                  <ReviewRow label="Total Value" value={`$${convertReview.usdValue.toFixed(2)}`} />
                  <ReviewRow label="50% to USDT BEP20" value={`$${(convertReview.usdValue / 2).toFixed(2)}`} />
                  <ReviewRow label="50% to HB9 Coin" value={`${hb9AmountForReview(convertReview).toFixed(6)} HB9`} />
                  <ReviewRow label="HB9 Price" value={`$${HB9_COIN_PRICE_USD.toFixed(2)}`} />
                </>
              )}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button className="hb-interactive hb-glow-purple rounded-2xl border border-cyan-200/18 bg-cyan-300/10 px-4 py-3 font-bold text-cyan-100" onClick={() => setConvertReview(null)} type="button">Cancel</button>
              <button
                className="hb-interactive hb-glow-cyan rounded-2xl bg-cyan-300 px-4 py-3 font-bold text-[#03111f]"
                onClick={() => {
                  const review = convertReview;
                  setConvertReview(null);
                  onConvert(review.coinSymbol, review.usdValue);
                }}
                type="button"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AllPackagesScreen({ products, buyLoadingProductId, onBuy, onBack }: { products: HbProduct[]; buyLoadingProductId: string; onBuy: (product: HbProduct) => void; onBack: () => void }) {
  return (
    <div className="space-y-3 pb-28">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100/55">HB9 Premium</p>
          <h2 className="mt-1 text-2xl font-black">All Packages</h2>
        </div>
        <button className="hb-interactive hb-glow-cyan rounded-xl border border-cyan-200/12 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100" onClick={onBack} type="button">Home</button>
      </div>
      <HeroPanel title="$4 to $12,500" subtitle="Choose an HB9 activation package" icon={Box} art="package" />
      <HbAllPackagesList products={products} onBuy={onBuy} loadingProductId={buyLoadingProductId} />
    </div>
  );
}

function HeroPanel({ title, subtitle, icon: Icon, art }: { title: string; subtitle: string; icon: ElementType; art: "package" | "team" | "wallet" | "coins" }) {
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-cyan-300/10 bg-gradient-to-br from-[#071120] to-[#0d1d35] p-4 shadow-[0_0_20px_rgba(0,200,255,0.1),inset_0_1px_0_rgba(255,255,255,0.065),inset_0_-18px_44px_rgba(0,123,255,0.07)] transition duration-200 hover:border-cyan-200/15">
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/35 to-transparent" />
      <div className="absolute right-[-4rem] top-[-4rem] h-36 w-36 rounded-full bg-cyan-300/14 blur-3xl" />
      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/10 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.12)]"><Icon size={18} /></div>
          <h2 className="mt-3 text-2xl font-black tracking-normal">{title}</h2>
          <p className="mt-1 text-sm text-sky-100/58">{subtitle}</p>
        </div>
        <PremiumIllustration type={art} compact />
      </div>
    </section>
  );
}

function PremiumIllustration({ type, compact = false }: { type: "wallet" | "package" | "team" | "coins"; compact?: boolean }) {
  const box = compact ? "h-[4.5rem] w-20" : "h-20 w-24";
  if (type === "team") {
    return (
      <div className={`relative ${box} shrink-0`}>
        <div className="absolute inset-1 rounded-full bg-cyan-300/12 blur-2xl" />
        <svg className="absolute inset-0 h-full w-full drop-shadow-[0_0_14px_rgba(34,211,238,0.24)]" viewBox="0 0 112 96" fill="none" aria-hidden="true">
          <ellipse cx="56" cy="76" rx="38" ry="8" fill="#0284C7" opacity=".2" />
          <circle cx="56" cy="31" r="16" fill="url(#teamCore)" stroke="#A5F3FC" strokeOpacity=".35" />
          <path d="M32 75c2.4-14 11.2-23 24-23s21.6 9 24 23" fill="url(#teamBody)" stroke="#67E8F9" strokeOpacity=".32" />
          <circle cx="29" cy="42" r="11" fill="#155E75" stroke="#67E8F9" strokeOpacity=".28" />
          <path d="M12 74c1.8-11 8.3-18 17.8-18 6.6 0 12 3.5 15 9" fill="#0EA5E9" fillOpacity=".45" stroke="#38BDF8" strokeOpacity=".28" />
          <circle cx="83" cy="42" r="11" fill="#1D4ED8" stroke="#A5F3FC" strokeOpacity=".28" />
          <path d="M67 65c3-5.5 8.3-9 15.2-9 9.5 0 16 7 17.8 18" fill="#2563EB" fillOpacity=".5" stroke="#60A5FA" strokeOpacity=".28" />
          <defs><linearGradient id="teamCore" x1="42" y1="17" x2="73" y2="48"><stop stopColor="#67E8F9" /><stop offset="1" stopColor="#2563EB" /></linearGradient><linearGradient id="teamBody" x1="35" y1="52" x2="79" y2="78"><stop stopColor="#22D3EE" /><stop offset="1" stopColor="#1D4ED8" /></linearGradient></defs>
        </svg>
      </div>
    );
  }
  if (type === "coins") {
    return (
      <div className={`relative ${box} shrink-0`}>
        <div className="absolute right-1 top-1 h-16 w-16 rounded-full bg-cyan-300/14 blur-2xl" />
        <svg className="absolute inset-0 h-full w-full drop-shadow-[0_0_16px_rgba(34,211,238,0.2)]" viewBox="0 0 112 96" fill="none" aria-hidden="true">
          <ellipse cx="50" cy="78" rx="34" ry="7" fill="#0284C7" opacity=".18" />
          <path d="M25 67c0-5 14-9 31-9s31 4 31 9v8c0 5-14 9-31 9s-31-4-31-9v-8Z" fill="url(#coinA)" stroke="#A5F3FC" strokeOpacity=".3" />
          <ellipse cx="56" cy="67" rx="31" ry="9" fill="#67E8F9" fillOpacity=".88" />
          <path d="M31 51c0-5 14-9 31-9s31 4 31 9v8c0 5-14 9-31 9s-31-4-31-9v-8Z" fill="url(#coinB)" stroke="#A5F3FC" strokeOpacity=".28" />
          <ellipse cx="62" cy="51" rx="31" ry="9" fill="#38BDF8" />
          <path d="M21 35c0-5 13-9 29-9s29 4 29 9v8c0 5-13 9-29 9s-29-4-29-9v-8Z" fill="url(#coinC)" stroke="#A5F3FC" strokeOpacity=".28" />
          <ellipse cx="50" cy="35" rx="29" ry="9" fill="#2563EB" />
          <circle cx="82" cy="27" r="14" fill="#031326" stroke="#67E8F9" strokeOpacity=".45" />
          <path d="M82 19v16M77 23c1.4-2 8.5-2.3 10 1.2 1.2 2.8-1.5 4.8-5.1 4.8-3.3 0-5.8 1.5-4.6 4 1.4 3 8.2 2.2 10-.1" stroke="#E0F2FE" strokeWidth="2.4" strokeLinecap="round" />
          <defs><linearGradient id="coinA" x1="25" y1="58" x2="87" y2="84"><stop stopColor="#22D3EE" /><stop offset="1" stopColor="#0F3F73" /></linearGradient><linearGradient id="coinB" x1="31" y1="42" x2="93" y2="68"><stop stopColor="#60A5FA" /><stop offset="1" stopColor="#0EA5E9" /></linearGradient><linearGradient id="coinC" x1="21" y1="26" x2="79" y2="52"><stop stopColor="#38BDF8" /><stop offset="1" stopColor="#1D4ED8" /></linearGradient></defs>
        </svg>
      </div>
    );
  }
  if (type === "package") {
    return (
      <div className={`relative ${box} shrink-0`}>
        <div className="absolute right-2 top-1 h-16 w-16 rounded-full bg-cyan-300/12 blur-2xl" />
        <HbPackageVisual amount={100} size="md" />
        <Sparkles className="absolute right-3 top-3 text-cyan-100 drop-shadow-[0_0_10px_rgba(34,211,238,0.7)]" size={18} />
      </div>
    );
  }
  return (
    <div className={`relative ${box} shrink-0`}>
      <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-cyan-300/14 blur-2xl" />
      <svg className="absolute inset-0 h-full w-full drop-shadow-[0_0_18px_rgba(34,211,238,0.22)]" viewBox="0 0 112 96" fill="none" aria-hidden="true">
        <ellipse cx="57" cy="79" rx="37" ry="8" fill="#0284C7" opacity=".18" />
        <path d="M24 35c0-7 6-12 13-10l47 11c5 1.2 8 5.5 8 10.4v23.8c0 6.5-5.3 11.8-11.8 11.8H35.8C29.3 82 24 76.7 24 70.2V35Z" fill="url(#walletBack)" stroke="#A5F3FC" strokeOpacity=".32" />
        <path d="M18 42c0-6 4.9-11 11-11h49c6 0 11 4.9 11 11v27c0 6-4.9 11-11 11H29c-6 0-11-4.9-11-11V42Z" fill="url(#walletFront)" stroke="#67E8F9" strokeOpacity=".38" />
        <path d="M71 51h24v17H71c-4.7 0-8.5-3.8-8.5-8.5S66.3 51 71 51Z" fill="#031326" fillOpacity=".82" stroke="#A5F3FC" strokeOpacity=".32" />
        <circle cx="73.5" cy="59.5" r="4.5" fill="#67E8F9" />
        <path d="M29 43h31" stroke="#E0F2FE" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
        <circle cx="88" cy="23" r="8" fill="#38BDF8" fillOpacity=".88" stroke="#E0F2FE" strokeOpacity=".28" />
        <circle cx="73" cy="17" r="5" fill="#2563EB" stroke="#A5F3FC" strokeOpacity=".32" />
        <circle cx="25" cy="25" r="4" fill="#67E8F9" fillOpacity=".72" />
        <defs><linearGradient id="walletBack" x1="26" y1="24" x2="91" y2="82"><stop stopColor="#38BDF8" /><stop offset="1" stopColor="#0F3F73" /></linearGradient><linearGradient id="walletFront" x1="18" y1="31" x2="89" y2="80"><stop stopColor="#0B2B50" /><stop offset=".45" stopColor="#0EA5E9" /><stop offset="1" stopColor="#071120" /></linearGradient></defs>
      </svg>
    </div>
  );
}

function FeatureBullet({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.85)]" /><span>{children}</span></div>;
}

function SegmentedTabs({ tabs, active, onChange }: { tabs: Array<[string, string]>; active: string; onChange: (tab: string) => void }) {
  return (
    <div className="grid w-full auto-cols-fr grid-flow-col gap-1 overflow-hidden rounded-[1.1rem] border border-cyan-200/10 bg-[#061a31]/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {tabs.map(([id, label]) => <button key={id} className={`hb-interactive hb-glow-cyan flex min-h-9 min-w-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-xl px-1.5 text-center text-[10.5px] font-black leading-none transition sm:px-2 sm:text-[11px] ${active === id ? "hb-interactive-active bg-cyan-300 text-[#031326] shadow-[0_0_12px_rgba(34,211,238,0.2)]" : "text-sky-100/62"}`} onClick={() => onChange(id)} type="button"><span className="block max-w-full truncate">{label}</span></button>)}
    </div>
  );
}

function PrimaryAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="hb-interactive hb-glow-cyan rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-500 px-4 py-3 font-black text-[#03111f] shadow-[0_0_22px_rgba(34,211,238,0.24)]" onClick={onClick} type="button">{children}</button>;
}

function IconButton({ children, label, onClick }: { children: ReactNode; label: string; onClick?: () => void }) {
  return <button className="hb-interactive hb-glow-cyan grid h-8 w-8 place-items-center rounded-xl border border-cyan-200/12 bg-white/[0.05] text-cyan-100 shadow-[0_0_12px_rgba(0,180,255,0.1),inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-200 hover:bg-cyan-300/10 active:scale-95" onClick={onClick} type="button" aria-label={label}>{children}</button>;
}

function ActionChip({ label, icon: Icon, onClick }: { label: string; icon: ElementType; onClick?: () => void }) {
  return <button className="hb-interactive hb-glow-teal flex min-h-[58px] flex-col items-center justify-center gap-1.5 rounded-[1rem] border border-cyan-200/12 bg-[linear-gradient(160deg,rgba(8,34,64,0.82),rgba(3,14,29,0.84))] text-center shadow-[0_0_14px_rgba(34,211,238,0.09),inset_0_1px_0_rgba(255,255,255,0.05)] transition duration-200 active:scale-95" onClick={onClick} type="button"><Icon size={15} className="text-cyan-100" /><span className="max-w-full truncate px-1 text-[9px] font-bold text-sky-100/75">{label}</span></button>;
}

function BuyDialog({ purchase, busy: confirming, onCancel, onConfirm }: { purchase: PurchaseReview; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const busy = confirming || purchase.stage === "approving" || purchase.stage === "submitting";
  const internal = purchase.purchaseMode === "internal";
  const stageText = purchase.stage === "approving" ? "Confirm USDT approval in your wallet." : purchase.stage === "submitting" ? "Confirm package purchase transaction." : purchase.stage === "pending" ? internal ? "Processing purchase from your main wallet." : "Tx pending. Activation updates after indexed event." : purchase.stage === "activated" ? "Activation completed." : "Review package before confirming.";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-3 pb-3 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-[1.6rem] border border-cyan-200/15 bg-[#071827]/95 p-4 shadow-[0_0_40px_rgba(34,211,238,0.18)] backdrop-blur-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">USDT BEP20 Payment</p><h2 className="mt-2 text-2xl font-semibold">Confirm Purchase</h2><p className="mt-2 text-sm leading-6 text-sky-100/62">{stageText}</p>
        {busy ? <div className="my-4 h-2 overflow-hidden rounded-full bg-cyan-950"><div className="h-full w-2/3 animate-pulse rounded-full bg-cyan-300" /></div> : null}
        <div className="mt-4 space-y-2 text-sm">
          <ReviewRow label="Package" value={purchase.product.package_name || purchase.product.title} />
          <ReviewRow label="Payment amount" value={`${money(purchase.product.package_price)} USDT`} />
          <ReviewRow label="Payment mode" value={internal ? "Main wallet balance" : chainLabel(purchase.config.chainId)} />
          <ReviewRow label="Wallet" value={internal ? "HB9 Main Wallet" : purchase.buyerAddress || "External wallet required"} mono={!internal} />
          {purchase.txHash && !internal ? <a className="block break-all rounded-2xl border border-cyan-200/12 bg-cyan-300/10 p-3 font-mono text-xs text-cyan-100" href={txUrl(purchase.config, purchase.txHash)} target="_blank" rel="noreferrer">{purchase.txHash}</a> : null}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3"><button className="hb-interactive hb-glow-purple rounded-2xl border border-cyan-200/18 bg-cyan-300/10 px-4 py-3 font-bold text-cyan-100" onClick={onCancel} disabled={busy} type="button">{purchase.stage === "pending" || purchase.stage === "activated" ? "Close" : "Cancel"}</button><button className="hb-interactive hb-glow-cyan rounded-2xl bg-cyan-300 px-4 py-3 font-bold text-[#03111f]" onClick={purchase.stage === "pending" || purchase.stage === "activated" ? onCancel : onConfirm} disabled={busy} type="button">{busy ? "Processing" : purchase.stage === "pending" || purchase.stage === "activated" ? "Done" : "Confirm Buy"}</button></div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const displayValue = mono && value.startsWith("0x") ? shortAddress(value) : value;
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-200/10 bg-[#071b34]/72 p-3"><span className="shrink-0 text-sky-100/55">{label}</span><span className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right font-semibold text-white ${mono ? "font-mono text-xs" : ""}`}>{displayValue}</span></div>;
}

function IncomeRow({ label, value, icon: Icon }: { label: string; value: string; icon: ElementType }) {
  return <GlassCard className="hb-glow-purple p-3"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.1)]"><Icon size={17} /></div><div className="min-w-0"><p className="truncate text-xs text-sky-100/62">{label}</p><div className="truncate text-xl font-black">{value}</div></div></div><ChevronRight className="shrink-0 text-cyan-100/40" size={17} /></div></GlassCard>;
}

function BigMetric({ label, value, icon: Icon }: { label: string; value: string; icon: ElementType }) {
  return <GlassCard className="hb-glow-teal p-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/10 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.1)]"><Icon size={17} /></div><p className="mt-3 text-xs text-sky-100/62">{label}</p><div className="mt-0.5 text-2xl font-black">{value}</div></GlassCard>;
}

function LevelTile({ level, total, active }: { level: string; total: number; active: number }) {
  return <div className="hb-interactive hb-glow-cyan grid grid-cols-[4.2rem_1fr_2.5rem] items-center gap-2.5 rounded-xl border border-cyan-200/10 bg-[#071b34]/72 p-2.5"><span className="text-sm font-black text-cyan-100">{level}</span><div><div className="h-1.5 overflow-hidden rounded-full bg-sky-950"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500" style={{ width: `${Math.min(100, Math.max(8, total * 12))}%` }} /></div><div className="mt-0.5 text-[9px] text-sky-100/52">{active} active</div></div><span className="text-right text-base font-black">{total}</span></div>;
}

function HistoryRow({ title, meta, value, positive = false, negative = false }: { title: string; meta: string; value: string; positive?: boolean; negative?: boolean }) {
  return <div className="hb-interactive hb-glow-teal flex items-center justify-between gap-3 rounded-2xl border border-cyan-200/10 bg-[#071b34]/72 p-3"><div className="flex min-w-0 items-center gap-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${negative ? "bg-red-400/10 text-red-200" : "bg-cyan-300/10 text-cyan-100"}`}><ReceiptText size={17} /></div><div className="min-w-0"><div className="truncate text-sm font-semibold capitalize">{title}</div><div className="truncate text-xs text-sky-100/52">{meta}</div></div></div><div className={`shrink-0 text-sm font-black ${positive ? "text-emerald-300" : negative ? "text-red-300" : "text-cyan-100"}`}>{value}</div></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="hb-interactive hb-glow-purple min-w-0 rounded-[22px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,34,64,0.76),rgba(3,14,29,0.84))] p-2.5 shadow-[0_0_10px_rgba(0,200,255,0.045),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl transition duration-200 hover:border-cyan-200/14"><div className="truncate text-[10px] font-medium leading-4 text-sky-100/55">{label}</div><div className="mt-0.5 truncate text-sm font-black leading-5 capitalize text-white">{value}</div></div>;
}

function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`hb-interactive hb-glow-cyan rounded-[22px] border border-cyan-200/12 bg-[linear-gradient(150deg,rgba(8,34,64,0.74),rgba(3,14,29,0.9))] shadow-[0_0_16px_rgba(0,200,255,0.08),0_12px_28px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl transition duration-200 hover:border-cyan-200/18 hover:shadow-[0_0_22px_rgba(0,200,255,0.13),0_14px_32px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.07)] ${className}`}>{children}</section>;
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return <div className="flex items-center justify-between gap-3"><h2 className="text-base font-black">{title}</h2>{action ? <span className="text-[11px] font-bold text-cyan-100/52">{action}</span> : null}</div>;
}

function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="rounded-[1.1rem] border border-cyan-200/10 bg-white/[0.04] p-3.5 text-center text-xs text-sky-100/65">{title}{action ? <div className="mt-3">{action}</div> : null}</div>;
}

function ErrorState({ message, onRetry, retrying = false }: { message: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-red-300/30 bg-red-400/10 p-3 text-sm text-red-100">
      <span className="min-w-0">{message}</span>
      {onRetry ? <button className="shrink-0 rounded-xl border border-red-200/25 bg-red-100/10 px-3 py-1.5 text-xs font-bold text-red-50 disabled:cursor-wait disabled:opacity-60" onClick={onRetry} disabled={retrying} type="button">{retrying ? "Retrying" : "Retry"}</button> : null}
    </div>
  );
}

function InfoState({ message }: { message: string }) {
  return <div className="mb-4 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm text-cyan-100">{message}</div>;
}

function LoginSuccessToast({ message }: { message: string }) {
  return <div className="pointer-events-none fixed inset-x-3 top-4 z-50 mx-auto max-w-[390px] rounded-2xl border border-cyan-300/30 bg-[#062134]/95 p-3 text-sm font-semibold text-cyan-100 shadow-[0_18px_40px_rgba(0,0,0,0.34)] backdrop-blur-xl">{message}</div>;
}

function DashboardSkeleton() {
  return <div className="space-y-3"><div className="h-44 animate-pulse rounded-[1.5rem] bg-cyan-300/10" /><div className="grid grid-cols-5 gap-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[64px] animate-pulse rounded-[1rem] bg-cyan-300/10" />)}</div>{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-[1.25rem] bg-cyan-300/10" />)}</div>;
}

function BottomNavigation({ activeTab, onChange }: { activeTab: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-2 z-40 h-[calc(62px+env(safe-area-inset-bottom))] px-4 pb-[env(safe-area-inset-bottom)] [contain:layout_paint]">
      <div className="pointer-events-auto mx-auto grid h-[62px] max-w-[410px] grid-cols-5 rounded-[24px] border border-cyan-100/10 bg-[#020b18]/72 p-1.5 shadow-[0_0_24px_rgba(0,180,255,0.16),0_16px_38px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.065),inset_0_-12px_28px_rgba(0,123,255,0.07)] backdrop-blur-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return <button key={item.id} className={`hb-interactive hb-glow-cyan flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] transition duration-200 active:scale-95 ${active ? "hb-interactive-active hb-nav-active bg-cyan-300/[0.085] text-cyan-100 shadow-[0_0_16px_rgba(0,200,255,0.3),inset_0_0_0_1px_rgba(125,211,252,0.13)]" : "text-sky-100/48 hover:text-cyan-100 hover:bg-white/[0.035]"}`} onClick={() => onChange(item.id)} type="button"><Icon size={15} className={active ? "drop-shadow-[0_0_8px_rgba(34,211,238,0.75)]" : ""} /><span className="max-w-full truncate px-0.5 text-[8.5px] font-bold leading-3">{item.label}</span></button>;
        })}
      </div>
    </nav>
  );
}
