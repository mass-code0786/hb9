"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, Copy, DollarSign, FileSearch, LayoutDashboard, LogOut, PackageCheck, Sparkles, Target, Users, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { BrowserProvider, Contract, encodeBytes32String, parseUnits, ZeroAddress } from "ethers";
import { HalalBusinessLogo } from "@/components/brand/HalalBusinessLogo";
import { ExplorerButton } from "@/components/ExplorerButton";
import { HbLandingPage } from "@/components/halal-business/HbLandingPage";
import { PackageIllustration, packageIllustrationTypeForAmount } from "@/components/packages/PackageIllustration";
import { ExternalWalletConnect } from "@/components/wallet/ExternalWalletConnect";
import { EmptyState, ErrorText, Field, Panel, PrimaryButton, SecondaryButton, Skeleton, StatusBadge } from "@/components/ui/Primitives";
import {
  clearHbToken,
  buyHbProduct,
  fetchHbIncome,
  fetchHbMe,
  fetchHbOrders,
  fetchHbOnchainPackageConfig,
  fetchHbPackages,
  fetchHbProduct,
  fetchHbProducts,
  fetchHbPurchases,
  fetchHbReferrals,
  fetchHbSponsorPreview,
  fetchHbTransparency,
  fetchHbTreasuryTransparency,
  fetchHbWallet,
  fetchHbWalletActivity,
  getHbToken,
  isHbDevDashboardBypassEnabled,
  loginHb,
  logoutHb,
  saveHbToken,
  trackHbOnchainPurchase,
  type HbDeposit,
  type HbIncome,
  type HbLedgerProof,
  type HbIncomeCapSummary,
  type HbLevelUnlockProgress,
  type HbOnchainPackageConfig,
  type HbOrder,
  type HbPackage,
  type HbProduct,
  type HbPurchase,
  type HbReferral,
  type HbReferralSummary,
  type HbSalaryIncome,
  type HbSingleLegProgress,
  type HbSponsorPreview,
  type HbSingleLegReserve,
  type HbTreasuryTransparency,
  type HbUser,
  type HbWalletActivity,
  type HbWithdrawal
} from "@/services/halalBusinessService";
import { captureHbReferralFromUrl, getStoredHbReferral } from "@/lib/referral";

type View = "home" | "products" | "wallet" | "orders" | "purchases" | "income" | "team" | "profile" | "proofs" | "treasury";
type AuthMode = "login" | "register";
type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};
type HbMockState = {
  balance: number;
  status: HbUser["status"];
  currentPackage: string;
  purchases: HbPurchase[];
  orders: HbOrder[];
};
type OnchainPackageItem = HbOnchainPackageConfig["packages"][number];
type OnchainPurchaseReview = {
  product: HbProduct;
  config: HbOnchainPackageConfig;
  packageConfig: OnchainPackageItem;
  buyerAddress: string;
  sponsorRef: string;
  stage: "review" | "approving" | "submitting" | "pending" | "activated";
  txHash?: string;
};

const packageBenefits = [
  { amount: 4, direct: "20%", level: "30%", treasury: "50%" },
  { amount: 20, direct: "20%", level: "30%", treasury: "50%" },
  { amount: 100, direct: "20%", level: "30%", treasury: "50%" },
  { amount: 500, direct: "20%", level: "30%", treasury: "50%" },
  { amount: 2500, direct: "20%", level: "30%", treasury: "50%" },
  { amount: 12500, direct: "20%", level: "30%", treasury: "50%" }
];

function benefitsForAmount(amount: string | number) {
  return packageBenefits.find((item) => item.amount === Number(amount)) || packageBenefits[0];
}

const views: Array<{ id: View; label: string; icon: React.ElementType }> = [
  { id: "home", label: "Home", icon: LayoutDashboard },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "income", label: "Income", icon: PackageCheck },
  { id: "team", label: "Team", icon: Users },
  { id: "treasury", label: "Treasury", icon: FileSearch }
  // TODO: Re-enable separate Products tab if product catalog grows.
  // TODO: Re-enable profile after full HB user system is completed.
];

export function isHbBypassEnabled() {
  return isHbDevDashboardBypassEnabled();
}

const HB_BYPASS_AUTH = isHbBypassEnabled();
const HB_ROLLOUT_MODE = process.env.NEXT_PUBLIC_HB_ROLLOUT_MODE || "closed_beta";
const HB_LAUNCH_STATUS = process.env.NEXT_PUBLIC_HB_LAUNCH_STATUS || "Controlled mainnet rollout preparation";
const HB_MOCK_STATE_KEY = "hb9.mock.state";
const LOGIN_SUCCESS_MESSAGE = "Login successful.";
const PACKAGE_MANAGER_ABI = ["function buyPackage(uint256 packageId,address sponsorAddress,bytes32 referralCode)"];
const ERC20_ABI = ["function approve(address spender,uint256 amount) returns (bool)"];
const devUser: HbUser = {
  id: "dev-hb-user",
  email: "demo@halalbusiness.local",
  display_name: "Demo User",
  referral_code: "HBDEMO",
  status: "inactive"
};
const devPackages: HbPackage[] = [4, 20, 100, 500, 2500, 12500].map((amount, index) => ({
  id: `dev-package-${amount}`,
  name: `$${amount} Activation Package`,
  amount_usd: amount,
  status: "available",
  sort_order: index + 1
}));
const devProducts: HbProduct[] = devPackages.map((pkg, index) => ({
  id: `dev-product-${pkg.amount_usd}`,
  title: `$${pkg.amount_usd} Activation Product`,
  slug: `dev-product-${pkg.amount_usd}`,
  short_description: "Development preview product.",
  description: "Development-only product preview. Re-enable auth and API-backed products before production.",
  package_id: pkg.id,
  package_price: pkg.amount_usd,
  package_type: "activation",
  image_url: index % 2 === 0 ? "/tokens/bnb.svg" : "/tokens/usdt.svg",
  stock: 999,
  active: true,
  featured: index < 3,
  package_name: pkg.name
}));
const defaultMockState: HbMockState = {
  balance: 0,
  status: "inactive",
  currentPackage: "None",
  purchases: [],
  orders: []
};

function readMockState(): HbMockState {
  if (typeof window === "undefined") return defaultMockState;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HB_MOCK_STATE_KEY) || "") as Partial<HbMockState>;
    return { ...defaultMockState, ...parsed };
  } catch {
    return defaultMockState;
  }
}

function saveMockState(state: HbMockState) {
  window.localStorage.setItem(HB_MOCK_STATE_KEY, JSON.stringify(state));
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00";
}

function short(value: string) {
  return value.length > 18 ? `${value.slice(0, 9)}...${value.slice(-6)}` : value;
}

function bscScanTxUrl(config: HbOnchainPackageConfig, txHash: string) {
  const baseUrl = config.explorerBaseUrl || "https://bscscan.com";
  return `${baseUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

function hbChainLabel(chainId: number | string) {
  return Number(chainId) === 56 ? "BSC Mainnet" : "BSC";
}

function LaunchStatusBanner({ rolloutMode, chainStatus, notice, maintenance }: { rolloutMode: string; chainStatus: string; notice: string; maintenance: boolean }) {
  const modeTone = rolloutMode === "public_live" ? "border-mint/30 bg-mint/10 text-mint" : rolloutMode === "limited_live" ? "border-accent/30 bg-accent/10 text-accent" : "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
  return (
    <div className="mb-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/72 p-3 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full border px-2 py-1 font-semibold uppercase ${modeTone}`}>{rolloutMode.replace("_", " ")}</span>
        <span className="rounded-full border border-sky-200/15 bg-[#061624]/80 px-2 py-1 text-sky-100">Network: {chainStatus}</span>
        {maintenance ? <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-1 font-semibold text-red-100">Treasury freeze notice</span> : null}
      </div>
      <div className="mt-2 text-sm text-slate-300">{notice}</div>
    </div>
  );
}

export function HalalBusinessApp() {
  const pathname = usePathname();
  const [token, setToken] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authSurface, setAuthSurface] = useState<"landing" | "auth">("landing");
  const [view, setView] = useState<View>("home");
  const [user, setUser] = useState<HbUser | null>(null);
  const [packages, setPackages] = useState<HbPackage[]>([]);
  const [products, setProducts] = useState<HbProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<HbProduct | null>(null);
  const [depositBalance, setDepositBalance] = useState("0");
  const [walletBalances, setWalletBalances] = useState({ deposit: "0", income: "0" });
  const [walletSummary, setWalletSummary] = useState({
    depositAddress: "",
    pendingDeposits: { total: "0", count: 0 },
    verifiedDeposits: { total: "0", count: 0 },
    totalPurchased: { total: "0", count: 0 }
  });
  const [deposits, setDeposits] = useState<HbDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<HbWithdrawal[]>([]);
  const [purchases, setPurchases] = useState<HbPurchase[]>([]);
  const [orders, setOrders] = useState<HbOrder[]>([]);
  const [income, setIncome] = useState<HbIncome[]>([]);
  const [singleLegReserve, setSingleLegReserve] = useState<HbSingleLegReserve[]>([]);
  const [salaryIncome, setSalaryIncome] = useState<HbSalaryIncome | null>(null);
  const [singleLegProgress, setSingleLegProgress] = useState<HbSingleLegProgress | null>(null);
  const [incomeCap, setIncomeCap] = useState<HbIncomeCapSummary>(null);
  const [levelUnlockProgress, setLevelUnlockProgress] = useState<HbLevelUnlockProgress | null>(null);
  const [incomeSummary, setIncomeSummary] = useState({ referral_income: "0", direct_income: "0", level_income: "0", single_leg_income: "0", single_leg_reserve: "0", salaryIncome: "0" });
  const [referrals, setReferrals] = useState<HbReferral[]>([]);
  const [referralSummary, setReferralSummary] = useState<HbReferralSummary | null>(null);
  const [proofs, setProofs] = useState<HbLedgerProof[]>([]);
  const [treasuryTransparency, setTreasuryTransparency] = useState<HbTreasuryTransparency | null>(null);
  const [walletActivity, setWalletActivity] = useState<HbWalletActivity[]>([]);
  const [onchainConfig, setOnchainConfig] = useState<HbOnchainPackageConfig | null>(null);
  const [connectedWallet, setConnectedWallet] = useState("");
  const [onchainPurchase, setOnchainPurchase] = useState<OnchainPurchaseReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [loginToast, setLoginToast] = useState("");
  const [error, setError] = useState("");
  const [sourceReferralCode, setSourceReferralCode] = useState("");
  const [activationSuccess, setActivationSuccess] = useState<{ packageName: string; referralCode: string; sponsor: string } | null>(null);

  useEffect(() => {
    setSourceReferralCode(captureHbReferralFromUrl());
    if (window.location.pathname.includes("register")) {
      setAuthMode("register");
      setAuthSurface("auth");
    }
    if (HB_BYPASS_AUTH) {
      // TODO: Remove mock dashboard and re-enable API auth before production launch.
      const mockState = readMockState();
      setUser({ ...devUser, status: mockState.status });
      setDepositBalance(String(mockState.balance));
      setWalletBalances({ deposit: String(mockState.balance), income: "0" });
      setPackages(devPackages);
      setProducts(devProducts);
      setPurchases(mockState.purchases);
      setOrders(mockState.orders);
      setIncome([]);
      setSingleLegReserve([]);
      setIncomeSummary({ referral_income: "0", direct_income: "0", level_income: "0", single_leg_income: "0", single_leg_reserve: "0", salaryIncome: "0" });
      setSalaryIncome(null);
      setSingleLegProgress(null);
      setIncomeCap(null);
      setLevelUnlockProgress(null);
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
      setProofs([]);
      setTreasuryTransparency(null);
      setWalletActivity([]);
      return;
    }
    const stored = getHbToken();
    Promise.all([fetchHbPackages(), fetchHbProducts()])
      .then(([packageData, productData]) => {
        setPackages(packageData.items);
        setProducts(productData.items);
      })
      .catch((err) => {
        if (HB_BYPASS_AUTH) {
          console.warn("HB9 dev product API unavailable; using mock products.", err);
          setPackages(devPackages);
          setProducts(devProducts);
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load products.");
      });
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token || HB_BYPASS_AUTH) return;
    refreshUser(token);
  }, [token]);

  useEffect(() => {
    if (view === "products" || view === "profile") setView("home");
  }, [view]);

  useEffect(() => {
    if (!loginToast) return;
    const timeout = window.setTimeout(() => setLoginToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [loginToast]);

  useEffect(() => {
    setLoginToast("");
  }, [pathname, view]);

  async function refreshUser(activeToken = token) {
    if (HB_BYPASS_AUTH) return;
    setLoading(true);
    setError("");
    try {
      const [me, wallet, purchaseData, orderData, incomeData, referralData, proofData, onchainData, treasuryData, activityData] = await Promise.all([
        fetchHbMe(activeToken),
        fetchHbWallet(activeToken),
        fetchHbPurchases(activeToken),
        fetchHbOrders(activeToken),
        fetchHbIncome(activeToken),
        fetchHbReferrals(activeToken),
        fetchHbTransparency(activeToken),
        fetchHbOnchainPackageConfig(activeToken),
        fetchHbTreasuryTransparency(activeToken),
        fetchHbWalletActivity(activeToken)
      ]);
      setUser(me.user);
      setDepositBalance(me.balances.deposit);
      setWalletBalances(wallet.balances);
      setWalletSummary({
        depositAddress: wallet.depositAddress,
        pendingDeposits: wallet.pendingDeposits,
        verifiedDeposits: wallet.verifiedDeposits,
        totalPurchased: wallet.totalPurchased
      });
      setDeposits(wallet.deposits);
      setWithdrawals(wallet.withdrawals);
      setPurchases(purchaseData.items);
      setOrders(orderData.items);
      setIncome(incomeData.items);
      setSingleLegReserve(incomeData.singleLegReserve);
      setSalaryIncome(incomeData.salaryIncome || null);
      setSingleLegProgress(incomeData.singleLegProgress || referralData.singleLegProgress || null);
      setIncomeCap(incomeData.incomeCap || null);
      setLevelUnlockProgress(incomeData.levelUnlockProgress || referralData.levelUnlockProgress || null);
      setIncomeSummary({
        referral_income: incomeData.summary.referral_income || incomeData.summary.direct_income || "0",
        direct_income: incomeData.summary.direct_income || incomeData.summary.referral_income || "0",
        level_income: incomeData.summary.level_income || "0",
        single_leg_income: incomeData.summary.single_leg_income || "0",
        single_leg_reserve: incomeData.summary.single_leg_reserve || "0",
        salaryIncome: incomeData.summary.salary_income || "100"
      });
      setReferrals(referralData.items);
      setReferralSummary(referralData);
      setProofs(proofData.items);
      setTreasuryTransparency(treasuryData);
      setWalletActivity(activityData.items);
      setOnchainConfig(onchainData);
    } catch (err) {
      if (HB_BYPASS_AUTH) {
        console.warn("HB9 dev dashboard API refresh failed; keeping mock dashboard.", err);
        setUser(devUser);
        setReferralSummary((current) => current || {
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
        return;
      }
      clearHbToken();
      setToken("");
      setUser(null);
      setError(err instanceof Error ? err.message : "Session expired. Login again.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    if (token) logoutHb(token).catch(() => undefined);
    if (HB_BYPASS_AUTH) {
      setUser(devUser);
      setToken("");
      setView("home");
      return;
    }
    clearHbToken();
    setToken("");
    setUser(null);
    setView("home");
  }

  const authenticated = HB_BYPASS_AUTH || Boolean(token && user);
  const dashboardUser = user || devUser;
  const dashboardProducts = products.length > 0 ? products : HB_BYPASS_AUTH ? devProducts : products;
  const dashboardPackages = packages.length > 0 ? packages : HB_BYPASS_AUTH ? devPackages : packages;
  const currentPackage = purchases[0]?.package_name || orders[0]?.package_name || readMockState().currentPackage || "None";
  const isActive = HB_BYPASS_AUTH || dashboardUser.status === "active";
  const showAppChrome = authenticated || authSurface !== "landing";

  function showLoginToast() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("hb9.loginSuccess");
      window.sessionStorage.removeItem("hb9.loginSuccess");
    }
    setLoginToast(LOGIN_SUCCESS_MESSAGE);
  }

  function handleAuthenticated(nextToken: string, nextUser: HbUser) {
    saveHbToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    showLoginToast();
  }

  function applyMockState(nextState: HbMockState) {
    saveMockState(nextState);
    setUser({ ...devUser, status: nextState.status });
    setDepositBalance(String(nextState.balance));
    setWalletBalances({ deposit: String(nextState.balance), income: "0" });
    setPurchases(nextState.purchases);
    setOrders(nextState.orders);
  }

  function buyMockProduct(productId: string) {
    if (!HB_BYPASS_AUTH) return false;
    const product = products.find((item) => item.id === productId) || devProducts.find((item) => item.id === productId);
    if (!product) {
      setError("Mock product was not found.");
      return true;
    }
    const current = readMockState();
    const price = Number(product.package_price);
    if (current.balance + Number.EPSILON < price) {
      setError(`Insufficient mock balance. Required ${money(price)}, available ${money(current.balance)}.`);
      setNotice("");
      return true;
    }
    const createdAt = new Date().toISOString();
    const purchase: HbPurchase = {
      id: `mock-purchase-${Date.now()}`,
      package_name: product.package_name,
      amount_usd: price,
      status: "completed",
      created_at: createdAt
    };
    const order: HbOrder = {
      id: `mock-order-${Date.now()}`,
      order_number: `MOCK-${Date.now()}`,
      amount_usd: price,
      payment_status: "paid",
      activation_status: "completed",
      distribution_status: "mocked",
      created_at: createdAt,
      product_title: product.title,
      package_price: price,
      package_name: product.package_name,
      product_slug: product.slug,
      image_url: product.image_url
    };
    const next: HbMockState = {
      ...current,
      balance: current.balance - price,
      status: "active",
      currentPackage: product.package_name,
      purchases: [purchase, ...current.purchases],
      orders: [order, ...current.orders]
    };
    applyMockState(next);
    setSelectedProduct(null);
    setError("");
    setNotice("Purchase completed.");
    return true;
  }

  async function prepareOnchainProduct(productId: string) {
    if (!token) {
      setError("Login is required before on-chain package purchase.");
      return true;
    }
    const product = dashboardProducts.find((item) => item.id === productId);
    const config = onchainConfig || await fetchHbOnchainPackageConfig(token);
    setOnchainConfig(config);
    if (config.mode !== "onchain" && config.mode !== "hybrid") return false;
    if (!product) {
      setError("Product was not found.");
      return true;
    }
    const packageConfig = config.packages.find((item) => item.id === product.package_id || Number(item.amount_usd) === Number(product.package_price));
    if (!packageConfig?.onchainPackageId) {
      console.error("HB9 package contract mapping missing.", { product, packages: config.packages });
      setError("Package temporarily unavailable.");
      return true;
    }
    if (!config.packageManagerAddress || !config.usdtBep20Address) {
      console.error("HB9 package contract config incomplete.", {
        product,
        packageConfig,
        hasPackageManager: Boolean(config.packageManagerAddress),
        hasUsdtBep20: Boolean(config.usdtBep20Address)
      });
      setError("Package temporarily unavailable.");
      return true;
    }
    const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setError("External wallet not found. Install or open MetaMask, Trust Wallet, TokenPocket, or WalletConnect-compatible browser.");
      return true;
    }
    setError("");
    setNotice("");
    const browserProvider = new BrowserProvider(ethereum);
    await ethereum.request({ method: "eth_requestAccounts" });
    const network = await browserProvider.getNetwork();
    if (Number(network.chainId) !== Number(config.chainId)) {
      setNotice(`Wrong network. Switch your wallet to ${hbChainLabel(config.chainId)} to continue.`);
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${Number(config.chainId).toString(16)}` }]
      });
      const switchedChainId = await ethereum.request({ method: "eth_chainId" });
      const parsedChainId = typeof switchedChainId === "string" ? Number.parseInt(switchedChainId, 16) : Number(switchedChainId);
      if (parsedChainId !== Number(config.chainId)) {
        setError(`Wrong network. Switch to ${hbChainLabel(config.chainId)} and try again.`);
        return true;
      }
    }
    const signer = await browserProvider.getSigner();
    const buyerAddress = await signer.getAddress();
    const expectedWallet = dashboardUser.usdt_bep20_address || dashboardUser.hb9_wallet_address || dashboardUser.wallet_address || "";
    if (expectedWallet && expectedWallet.toLowerCase() !== buyerAddress.toLowerCase()) {
      setError("Connected wallet does not match this HB9 ID.");
      return true;
    }
    setConnectedWallet(buyerAddress);
    const sponsorRef = dashboardUser.sponsor_referral_code || dashboardUser.source_referral_code || "";
    setOnchainPurchase({
      product,
      config,
      packageConfig,
      buyerAddress,
      sponsorRef,
      stage: "review"
    });
    return true;
  }

  async function confirmOnchainPurchase() {
    if (!token || !onchainPurchase) return;
    const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setError("External wallet not found. Open this page with a BSC-compatible wallet browser.");
      return;
    }
    setError("");
    setNotice("");
    const { product, config, packageConfig, sponsorRef, buyerAddress } = onchainPurchase;
    const packageManagerAddress = config.packageManagerAddress;
    const usdtBep20Address = config.usdtBep20Address;
    const onchainPackageId = packageConfig.onchainPackageId;
    if (!packageManagerAddress || !usdtBep20Address || onchainPackageId === null || onchainPackageId === undefined) {
      console.error("HB9 package purchase confirmation config incomplete.", {
        product,
        packageConfig,
        hasPackageManager: Boolean(packageManagerAddress),
        hasUsdtBep20: Boolean(usdtBep20Address)
      });
      setError("Package temporarily unavailable.");
      return;
    }
    if (config.dryRun) {
      const dryRunHash = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32))).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      setOnchainPurchase((current) => current ? { ...current, stage: "pending", txHash: dryRunHash } : current);
      await trackHbOnchainPurchase(token, {
        txHash: dryRunHash,
        productId: product.id,
        packageId: product.package_id,
        onchainPackageId,
        buyerAddress,
        referralCode: sponsorRef
      });
      setNotice("Purchase completed.");
      await waitForActivation(product.package_name || product.title);
      return;
    }
    setOnchainPurchase((current) => current ? { ...current, stage: "approving" } : current);
    const browserProvider = new BrowserProvider(ethereum);
    const signer = await browserProvider.getSigner();
    const amount = parseUnits(String(product.package_price), 18);
    const usdt = new Contract(usdtBep20Address, ERC20_ABI, signer);
    const approval = await usdt.approve(packageManagerAddress, amount);
    await approval.wait();
    setOnchainPurchase((current) => current ? { ...current, stage: "submitting" } : current);
    const manager = new Contract(packageManagerAddress, PACKAGE_MANAGER_ABI, signer);
    const referralCode = sponsorRef ? encodeBytes32String(sponsorRef.slice(0, 31)) : "0x0000000000000000000000000000000000000000000000000000000000000000";
    const tx = await manager.buyPackage(onchainPackageId, ZeroAddress, referralCode);
    setOnchainPurchase((current) => current ? { ...current, stage: "pending", txHash: tx.hash } : current);
    await trackHbOnchainPurchase(token, {
      txHash: tx.hash,
      productId: product.id,
      packageId: product.package_id,
      onchainPackageId,
      buyerAddress,
      referralCode: sponsorRef
    });
    setNotice("Package purchase submitted. Activation will update after the PackagePurchased event is indexed.");
    await waitForActivation(product.package_name || product.title);
  }

  async function waitForActivation(packageName: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 1500 : 3000));
      await refreshUser();
      const latest = await fetchHbMe(token);
      if (latest.user.status === "active") {
        setUser(latest.user);
        setOnchainPurchase((current) => current ? { ...current, stage: "activated" } : current);
        setActivationSuccess({
          packageName,
          referralCode: latest.user.referral_code,
          sponsor: latest.sponsor?.display_name || latest.user.sponsor_referral_code || "No sponsor"
        });
        setNotice("");
        return;
      }
    }
    setNotice("Activation transaction is indexed asynchronously. Keep this page open or refresh in a moment.");
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-y-auto overflow-x-hidden px-3 pb-[140px] pt-3 text-slate-50 [touch-action:pan-y] [overscroll-behavior-y:auto] [-webkit-overflow-scrolling:touch] sm:px-4 md:max-w-5xl md:px-6">
      {showAppChrome ? <header className="sticky top-2 z-30 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-sky-200/10 bg-[#061624]/76 p-2 shadow-[0_0_24px_rgba(56,189,248,0.1)] backdrop-blur-2xl md:static md:bg-transparent md:p-0 md:shadow-none">
        <div className="flex min-w-0 items-center gap-3">
          <Link className="tap-feedback rounded-2xl border border-sky-200/15 bg-[#0b1728]/75 p-3 shadow-[0_0_16px_rgba(56,189,248,0.08)] backdrop-blur-xl hover:bg-[#0b1728]/90" href="/" aria-label="Back to HB9">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <HalalBusinessLogo size="sm" showText />
            <div className="mt-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-accent"><BriefcaseBusiness size={14} /> Business DApp</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {authenticated ? <div className="hidden sm:block">
            <ExternalWalletConnect compact />
          </div> : null}
          {authenticated ? (
            <button className="tap-feedback rounded-2xl border border-sky-200/15 bg-[#0b1728]/70 px-3 py-2 text-xs font-semibold text-slate-200 shadow-[0_0_16px_rgba(56,189,248,0.08)] backdrop-blur-xl hover:bg-[#0b1728]/90" onClick={logout} type="button" aria-label="Logout from HB9">
              <LogOut size={14} className="inline" /> Logout
            </button>
          ) : null}
        </div>
      </header> : null}
      {showAppChrome && !HB_BYPASS_AUTH ? <LaunchStatusBanner
        rolloutMode={HB_BYPASS_AUTH ? "dev" : HB_ROLLOUT_MODE}
        chainStatus={onchainConfig ? hbChainLabel(onchainConfig.chainId) : treasuryTransparency?.chainStatus || "BSC Mainnet"}
        notice={notice || HB_LAUNCH_STATUS}
        maintenance={Boolean(treasuryTransparency?.health?.emergencyTreasuryFreezeNotice)}
      /> : null}

      {authenticated ? <div className="mb-4 sm:hidden">
        <ExternalWalletConnect />
      </div> : null}

      {!authenticated ? (
        authSurface === "landing" ? (
          <HbLandingPage
            referralCode={sourceReferralCode || getStoredHbReferral()}
            onAuthenticated={handleAuthenticated}
          />
        ) : (
          <AuthPanel
            mode={authMode}
            sourceReferralCode={sourceReferralCode}
            setMode={setAuthMode}
            setError={setError}
            setNotice={setNotice}
            onAuthenticated={handleAuthenticated}
          />
        )
      ) : (
        <>
          <IdStatusStrip user={dashboardUser} currentPackage={currentPackage} walletBalance={depositBalance} />
          <OnchainModeStrip config={onchainConfig} connectedWallet={connectedWallet} />

          {!isActive && view !== "home" ? <LockedSection view={view} onActivate={() => setView("home")} user={dashboardUser} summary={referralSummary} /> : null}
          {view === "home" && !selectedProduct && !isActive ? <ActivationView products={dashboardProducts} packages={dashboardPackages} user={dashboardUser} loading={loading} sponsor={referralSummary?.sponsor?.display_name || dashboardUser.sponsor_referral_code || dashboardUser.source_referral_code || "No sponsor"} onBuy={async (productId) => {
            if (buyMockProduct(productId)) return;
            if (await prepareOnchainProduct(productId)) return;
            if (!token) {
              setError("Session unavailable. Please reconnect your wallet and try again.");
              return;
            }
            setError("");
            setNotice("");
            try {
              const result = await buyHbProduct(token, productId);
              setNotice(result.activated ? "Business ID Activated." : "Product purchased.");
              await refreshUser();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Product purchase failed.");
            }
          }} /> : null}
          {view === "home" && !selectedProduct && isActive ? <HomeView products={dashboardProducts} packages={dashboardPackages} user={dashboardUser} loading={loading} balances={walletBalances} currentPackage={currentPackage} activity={walletActivity} onProductOpen={async (slug) => {
            setError("");
            if (HB_BYPASS_AUTH) {
              setSelectedProduct(dashboardProducts.find((product) => product.slug === slug) || devProducts.find((product) => product.slug === slug) || null);
              return;
            }
            try {
              setSelectedProduct(await fetchHbProduct(slug));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Product could not be loaded.");
            }
          }} onBuy={async (productId) => {
            if (buyMockProduct(productId)) return;
            if (await prepareOnchainProduct(productId)) return;
            if (!token) {
              setError("Session unavailable. Please reconnect your wallet and try again.");
              return;
            }
            setError("");
            setNotice("");
            try {
              const result = await buyHbProduct(token, productId);
              setNotice(result.activated ? "Product purchased. Your ID is now active." : "Product purchased.");
              await refreshUser();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Product purchase failed.");
            }
          }} /> : null}
          {view === "home" && selectedProduct ? <ProductDetail product={selectedProduct} availableBalance={depositBalance} onBack={() => setSelectedProduct(null)} onBuy={async (productId) => {
            if (buyMockProduct(productId)) return;
            if (await prepareOnchainProduct(productId)) return;
            if (!token) {
              setError("Session unavailable. Please reconnect your wallet and try again.");
              return;
            }
            setError("");
            setNotice("");
            try {
              const result = await buyHbProduct(token, productId);
              setNotice(result.activated ? "Product purchased. Your ID is now active." : "Product purchased.");
              setSelectedProduct(null);
              await refreshUser();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Product purchase failed.");
            }
          }} /> : null}
          {view === "products" && !selectedProduct && isActive ? <ProductsView products={dashboardProducts} packages={dashboardPackages} loading={loading} availableBalance={depositBalance} onProductOpen={async (slug) => {
            setError("");
            if (HB_BYPASS_AUTH) {
              setSelectedProduct(dashboardProducts.find((product) => product.slug === slug) || devProducts.find((product) => product.slug === slug) || null);
              return;
            }
            try {
              setSelectedProduct(await fetchHbProduct(slug));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Product could not be loaded.");
            }
          }} onBuy={async (productId) => {
            if (buyMockProduct(productId)) return;
            if (await prepareOnchainProduct(productId)) return;
            if (!token) {
              setError("Session unavailable. Please reconnect your wallet and try again.");
              return;
            }
            setError("");
            setNotice("");
            try {
              const result = await buyHbProduct(token, productId);
              setNotice(result.activated ? "Product purchased. Your ID is now active." : "Product purchased.");
              await refreshUser();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Product purchase failed.");
            }
          }} /> : null}
          {view === "products" && selectedProduct && isActive ? <ProductDetail product={selectedProduct} availableBalance={depositBalance} onBack={() => setSelectedProduct(null)} onBuy={async (productId) => {
            if (buyMockProduct(productId)) return;
            if (await prepareOnchainProduct(productId)) return;
            if (!token) {
              setError("Session unavailable. Please reconnect your wallet and try again.");
              return;
            }
            setError("");
            setNotice("");
            try {
              const result = await buyHbProduct(token, productId);
              setNotice(result.activated ? "Product purchased. Your ID is now active." : "Product purchased.");
              setSelectedProduct(null);
              await refreshUser();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Product purchase failed.");
            }
          }} /> : null}
          {view === "wallet" && isActive ? <WalletView balances={walletBalances} deposits={deposits} withdrawals={withdrawals} summary={walletSummary} /> : null}
          {view === "purchases" && isActive ? <ListView title="My Purchases" empty="No package purchases yet." items={purchases.map((item) => ({
            id: item.id,
            title: item.package_name,
            value: money(item.amount_usd),
            meta: `${item.status} - ${new Date(item.created_at).toLocaleString()}`
          }))} /> : null}
          {view === "orders" && isActive ? <OrdersView orders={orders} /> : null}
          {view === "income" && isActive ? <IncomeView income={income} singleLegReserve={singleLegReserve} salaryIncome={salaryIncome} singleLegProgress={singleLegProgress} levelUnlockProgress={levelUnlockProgress} incomeCap={incomeCap} withdrawals={withdrawals} availableBalance={walletBalances.deposit} summary={incomeSummary} /> : null}
          {view === "team" && isActive ? <ReferralView user={dashboardUser} referrals={referrals} summary={referralSummary} singleLegProgress={singleLegProgress || referralSummary?.singleLegProgress || null} levelUnlockProgress={levelUnlockProgress || referralSummary?.levelUnlockProgress || null} /> : null}
          {view === "treasury" && isActive ? <TreasuryTransparencyView data={treasuryTransparency} purchases={purchases} proofs={proofs} /> : null}
          {view === "proofs" && isActive ? <TreasuryTransparencyView data={treasuryTransparency} purchases={purchases} proofs={proofs} /> : null}
          <DashboardTabs view={view} setView={(nextView) => {
            setSelectedProduct(null);
            setView(nextView);
          }} />
          {onchainPurchase ? (
            <OnchainPurchaseDialog
              purchase={onchainPurchase}
              onCancel={() => setOnchainPurchase(null)}
              onConfirm={async () => {
                try {
                  await confirmOnchainPurchase();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "On-chain package purchase failed.");
                  setOnchainPurchase((current) => current ? { ...current, stage: "review" } : current);
                }
              }}
            />
          ) : null}
          {activationSuccess ? <ActivationSuccessDialog success={activationSuccess} onClose={() => setActivationSuccess(null)} /> : null}
        </>
      )}

      {notice ? <div className="mt-4 rounded-2xl border border-mint/30 bg-mint/10 p-4 text-sm text-mint">{notice}</div> : null}
      {loginToast ? <LoginSuccessToast message={loginToast} /> : null}
      <ErrorText error={error} />
    </main>
  );
}

function AuthPanel({ mode, sourceReferralCode, setMode, setError, setNotice, onAuthenticated }: {
  mode: AuthMode;
  sourceReferralCode: string;
  setMode: (mode: AuthMode) => void;
  setError: (error: string) => void;
  setNotice: (notice: string) => void;
  onAuthenticated: (token: string, user: HbUser) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(sourceReferralCode || getStoredHbReferral());
  const [sponsorPreview, setSponsorPreview] = useState<HbSponsorPreview>(null);
  const [busy, setBusy] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);

  useEffect(() => {
    setReferralCode((current) => current || sourceReferralCode || getStoredHbReferral());
  }, [sourceReferralCode]);

  useEffect(() => {
    const code = referralCode || sourceReferralCode || getStoredHbReferral();
    if (!code) {
      setSponsorPreview(null);
      return;
    }
    fetchHbSponsorPreview(code)
      .then((result) => setSponsorPreview(result.sponsor))
      .catch(() => setSponsorPreview(null));
  }, [referralCode, sourceReferralCode]);

  async function submit() {
    if (mode !== "login") return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await loginHb({ identifier, password });
      onAuthenticated(response.token, response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="mb-5">
        <HalalBusinessLogo className="mb-4" size="lg" showText />
        <div className="mb-3 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
          {mode === "register" ? "Wallet-first account creation" : "Decentralized identity login"}
        </div>
        <h2 className="text-3xl font-semibold">{mode === "register" ? "Create your HB9 account with wallet signature" : "Connect your wallet to access HB9"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {mode === "register"
            ? "Connect your wallet, sign the verification message, and your HB9 ID, referral ID, and wallet-linked profile are generated automatically."
            : "No seed phrase. No private key storage."}
        </p>
      </div>
      <ExternalWalletConnect authenticate referralCode={referralCode} buttonLabel={mode === "register" ? "Sign Up" : "Connect Wallet"} onAuthenticated={onAuthenticated} />
      {referralCode ? <SponsorPreviewCard code={referralCode} sponsor={sponsorPreview} /> : null}
      {mode === "register" ? (
        <SecondaryButton className="mt-4 w-full" onClick={() => setMode("login")} type="button">
          I already have an account
        </SecondaryButton>
      ) : (
        <SecondaryButton className="mt-4 w-full" onClick={() => setShowPasswordLogin((current) => !current)} type="button">
          Use mobile/password instead
        </SecondaryButton>
      )}
      {mode === "login" && showPasswordLogin ? (
        <div className="mt-4 border-t border-sky-200/10 pt-4">
          <Field className="mb-3" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Mobile number or email" />
          <Field className="mb-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
          <PrimaryButton className="w-full" onClick={submit} disabled={busy} type="button">{busy ? "Please wait" : "Login"}</PrimaryButton>
          <SecondaryButton className="mt-3 w-full" onClick={() => setMode(mode === "login" ? "register" : "login")} type="button">
            {mode === "login" ? "Create account" : "I already have an account"}
          </SecondaryButton>
        </div>
      ) : null}
    </Panel>
  );
}

function LoginSuccessToast({ message }: { message: string }) {
  return <div className="pointer-events-none fixed inset-x-3 top-4 z-50 mx-auto max-w-sm rounded-2xl border border-mint/30 bg-[#052018]/95 p-3 text-sm font-semibold text-mint shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-xl">{message}</div>;
}

function StatusTile({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`premium-surface rounded-2xl p-3 sm:p-4 ${strong ? "treasury-glow" : ""}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 break-words text-base font-semibold capitalize sm:text-lg ${strong ? "text-mint" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}

function IdStatusStrip({ user, currentPackage, walletBalance }: { user: HbUser; currentPackage: string; walletBalance: string }) {
  return (
    <section className="mb-3 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 px-3 py-2 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-500">ID Status</div>
          <div className="mt-1"><StatusBadge value={user.status} tone={user.status === "active" ? "success" : "warning"} /></div>
        </div>
        <div>
          <div className="text-slate-500">Current Package</div>
          <div className="mt-0.5 truncate font-semibold text-slate-100">{currentPackage}</div>
        </div>
        <div>
          <div className="text-slate-500">Wallet Balance</div>
          <div className="mt-0.5 truncate font-semibold text-slate-100">{money(walletBalance)}</div>
        </div>
      </div>
    </section>
  );
}

function SponsorPreviewCard({ code, sponsor }: { code: string; sponsor: HbSponsorPreview }) {
  return (
    <div className="mt-3 rounded-2xl border border-accent/25 bg-accent/10 p-3 text-sm text-accent">
      <div className="text-xs uppercase tracking-[0.16em]">Auto Sponsor Bind</div>
      <div className="mt-1 font-semibold">{sponsor ? sponsor.displayName : "Sponsor preview pending"}</div>
      <div className="mt-1 break-all font-mono text-xs text-sky-100/80">{sponsor?.referralCode || code}</div>
    </div>
  );
}

function OnchainModeStrip({ config, connectedWallet }: { config: HbOnchainPackageConfig | null; connectedWallet: string }) {
  if (!config || config.mode === "internal") return null;
  return (
    <section className="mb-3 rounded-2xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-sky-100 shadow-[0_0_18px_rgba(34,211,238,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">On-chain package flow ready. External wallet signs every USDT approval and package purchase.</span>
        <span className="font-mono">{connectedWallet ? short(connectedWallet) : config.packageManagerAddress ? short(config.packageManagerAddress) : "Contract not configured yet"}</span>
      </div>
    </section>
  );
}

function ActivationView({ products, packages, user, loading, sponsor, onBuy }: { products: HbProduct[]; packages: HbPackage[]; user: HbUser; loading: boolean; sponsor: string; onBuy: (productId: string) => void }) {
  const orderedProducts = [...products].sort((a, b) => Number(a.package_price) - Number(b.package_price));
  const fallbackProducts = packages.map((pkg) => ({
    id: pkg.id,
    title: pkg.name,
    slug: pkg.id,
    package_price: pkg.amount_usd,
    package_name: pkg.name,
    stock: 1,
    image_url: "",
    thumbnail_url: "",
    short_description: "Activation package",
    description: "",
    package_id: pkg.id,
    package_type: "activation",
    active: true,
    featured: false
  } as HbProduct));
  const cards = orderedProducts.length ? orderedProducts : fallbackProducts;
  return (
    <div className="space-y-4">
      <Panel>
        <div className="relative overflow-hidden rounded-[1.5rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-300/15 via-[#0b1728]/80 to-sky-500/10 p-4 shadow-[0_0_34px_rgba(56,189,248,0.16)]">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"><Sparkles size={14} /> Decentralized onboarding</div>
            <h2 className="mt-4 text-3xl font-semibold">Activate your Business ID</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Referral Link to Wallet Connect to Auto Sponsor Bind to Package Buy to ID Activation</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <StatusTile label="Connected wallet" value={short(user.usdt_bep20_address || user.hb9_wallet_address || user.wallet_address || "Wallet")} />
              <StatusTile label="Sponsor" value={sponsor} />
              <StatusTile label="Account status" value={user.status} />
            </div>
          </div>
        </div>
      </Panel>
      <Panel>
        <div className="mb-4">
          <h3 className="text-2xl font-semibold">Activation Packages</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">Buy with USDT from your connected BSC wallet. Your ID unlocks after the on-chain event is indexed.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((product) => <ActivationPackageCard key={product.id} product={product} loading={loading} onBuy={onBuy} />)}
        </div>
      </Panel>
    </div>
  );
}

function ActivationPackageCard({ product, loading, onBuy }: { product: HbProduct; loading: boolean; onBuy: (productId: string) => void }) {
  const benefits = benefitsForAmount(product.package_price);
  return (
    <div className="rounded-[1.35rem] border border-sky-200/15 bg-[#0b1728]/70 p-4 shadow-[0_0_24px_rgba(56,189,248,0.1)] backdrop-blur-xl">
      <div className="grid items-center gap-3 min-[420px]:grid-cols-[minmax(8.5rem,0.42fr)_minmax(0,1fr)]">
        <div className="hb-dashboard-package-visual flex items-center justify-center rounded-[1.2rem] border border-sky-200/10 bg-sky-200/[0.045]">
          <PackageIllustration type={packageIllustrationTypeForAmount(product.package_price)} />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-slate-400">{product.package_name || product.title}</div>
          <div className="mt-1 text-3xl font-semibold text-accent">{money(product.package_price)}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Benefit label="Direct income" value={benefits.direct} />
        <Benefit label="Level income" value={benefits.level} />
        <Benefit label="Treasury hold" value={benefits.treasury} />
      </div>
      <PrimaryButton className="mt-4 w-full" onClick={() => onBuy(product.id)} disabled={loading || product.stock <= 0} type="button" aria-label={`Buy ${product.package_name || product.title} with USDT`}>
        {loading ? "Preparing transaction" : "Buy with USDT"}
      </PrimaryButton>
    </div>
  );
}

function Benefit({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-sky-200/10 bg-sky-200/[0.04] p-2"><div className="text-slate-500">{label}</div><div className="mt-1 break-words font-semibold text-slate-100">{value}</div></div>;
}

function LockedSection({ view, onActivate, user, summary }: { view: View; onActivate: () => void; user: HbUser; summary: HbReferralSummary | null }) {
  const title = view === "team" ? "Team preview locked" : view === "income" ? "Income locked" : "Section locked";
  return (
    <Panel>
      <div className="rounded-[1.5rem] border border-yellow-400/25 bg-yellow-400/10 p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-yellow-100">Inactive Business ID</div>
        <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-yellow-50/80">Activate with a package to unlock income, team tools, wallet operations, and proof sections.</p>
        <div className="mt-4 grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
          <StatusTile label="Referral ID" value={user.referral_code} />
          <StatusTile label="Direct team" value={String(summary?.directReferrals.length || 0)} />
          <StatusTile label="Status" value={user.status} />
        </div>
        <PrimaryButton className="mt-4 w-full" onClick={onActivate} type="button">Activate your Business ID</PrimaryButton>
      </div>
    </Panel>
  );
}

function ActivationSuccessDialog({ success, onClose }: { success: { packageName: string; referralCode: string; sponsor: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="w-full max-w-md rounded-[1.6rem] border border-mint/30 bg-[#071827]/95 p-5 text-center shadow-wallet backdrop-blur-2xl">
        <div className="proof-pulse mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-mint/30 bg-mint/10 text-mint shadow-[0_0_32px_rgba(20,241,149,0.22)]">
          <CheckCircle2 size={34} />
        </div>
        <h2 className="mt-4 text-3xl font-semibold">Business ID Activated</h2>
        <div className="mt-4 grid gap-2 text-left">
          <ReviewRow label="Package" value={success.packageName} />
          <ReviewRow label="Referral ID" value={success.referralCode} />
          <ReviewRow label="Sponsor" value={success.sponsor} />
        </div>
        <PrimaryButton className="mt-5 w-full" onClick={onClose} type="button">Enter Dashboard</PrimaryButton>
      </div>
    </div>
  );
}

function OnchainPurchaseDialog({ purchase, onCancel, onConfirm }: { purchase: OnchainPurchaseReview; onCancel: () => void; onConfirm: () => void }) {
  const busy = purchase.stage === "approving" || purchase.stage === "submitting";
  const txUrl = purchase.txHash ? bscScanTxUrl(purchase.config, purchase.txHash) : "";
  const stageText = purchase.stage === "approving"
    ? "Confirm USDT approval in your external wallet."
    : purchase.stage === "submitting"
      ? "USDT approved. Confirm the package purchase transaction."
      : purchase.stage === "activated"
        ? "Event indexed. Your Business ID is active."
        : purchase.stage === "pending"
        ? "Pending confirmation. Activation updates after the PackagePurchased event is indexed."
        : "Review package and contract details before confirming.";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="w-full max-w-lg rounded-[1.6rem] border border-sky-200/15 bg-[#071827]/95 p-4 shadow-wallet backdrop-blur-2xl">
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">USDT BEP20 Package Purchase</div>
          <h2 className="mt-2 text-2xl font-semibold">Confirm Buy with USDT</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{stageText}</p>
        </div>
        {busy ? (
          <div className="mb-4 rounded-2xl border border-accent/25 bg-accent/10 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">Pending transaction</div>
            <div className="shimmer-card h-2 rounded-full" />
          </div>
        ) : null}
        <div className="grid gap-2 text-sm">
          <ReviewRow label="Package" value={purchase.product.package_name || purchase.product.title} />
          <ReviewRow label="Package price" value={`${money(purchase.product.package_price)} USDT`} />
          <ReviewRow label="Contract" value={purchase.config.packageManagerAddress || "Contract not configured yet"} mono />
          <ReviewRow label="Connected wallet" value={purchase.buyerAddress} mono />
          <ReviewRow label="Sponsor/referral" value={purchase.sponsorRef || "None"} />
          <ReviewRow label="Network" value={hbChainLabel(purchase.config.chainId)} />
        </div>
        {purchase.txHash ? (
          <div className="mt-4 rounded-2xl border border-mint/30 bg-mint/10 p-3 text-sm text-mint">
            <div className="font-semibold">Pending confirmation</div>
            <div className="mt-2 break-all font-mono text-xs">{purchase.txHash}</div>
            <div className="mt-3"><ExplorerButton baseUrl={purchase.config.explorerBaseUrl || "https://bscscan.com"} type="tx" value={purchase.txHash} compact /></div>
          </div>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <SecondaryButton onClick={onCancel} disabled={busy} type="button">{purchase.stage === "pending" ? "Close" : "Cancel"}</SecondaryButton>
          {purchase.stage === "pending" ? (
            <PrimaryButton onClick={onCancel} type="button">Done</PrimaryButton>
          ) : (
            <PrimaryButton onClick={onConfirm} disabled={busy} type="button">
              {purchase.stage === "approving" ? "Approving" : purchase.stage === "submitting" ? "Submitting" : "Confirm Buy with USDT"}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 break-all font-semibold text-slate-100 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

function DashboardTabs({ view, setView }: { view: View; setView: (view: View) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-3 z-20 px-3">
      <div className="safe-bottom mx-auto flex max-w-md gap-2 overflow-x-auto rounded-full border border-sky-200/15 bg-[#0b1728]/82 p-1.5 shadow-[0_16px_46px_rgba(2,132,199,0.22)] backdrop-blur-2xl md:max-w-5xl">
        {views.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              className={`tap-feedback flex min-w-[68px] shrink-0 flex-col items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold ${active ? "bg-gradient-to-r from-sky-300 via-cyan-400 to-sky-500 text-[#031524] shadow-[0_0_22px_rgba(56,189,248,0.28)]" : "text-sky-100/75 hover:bg-[#0b1728]/75 hover:text-white"}`}
              onClick={() => setView(item.id)}
              type="button"
              aria-label={`Open ${item.label}`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function HomeView({ products, packages, user, loading, balances, currentPackage, activity, onProductOpen, onBuy }: { products: HbProduct[]; packages: HbPackage[]; user: HbUser; loading: boolean; balances: { deposit: string; income: string }; currentPackage: string; activity: HbWalletActivity[]; onProductOpen: (slug: string) => void; onBuy: (productId: string) => void }) {
  const balance = Number(balances.deposit || 0);
  const orderedProducts = [...products].sort((a, b) => Number(a.package_price) - Number(b.package_price));
  return (
    <Panel>
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Products & Packages</h2>
          <StatusBadge value={user.status === "active" ? "Active ID" : "Inactive ID"} tone={user.status === "active" ? "success" : "warning"} />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">Buy an activation product with USDT BEP20 from your connected external BSC wallet.</p>
      </div>
      {loading ? <DashboardSkeleton /> : null}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatusTile label="Main Wallet" value={money(balances.deposit)} />
        <StatusTile label="ID Status" value={user.status} strong={user.status === "active"} />
        <StatusTile label="Current Package" value={currentPackage} />
      </div>
      <WalletActivityTimeline items={activity} />
      <h3 className="mb-3 text-lg font-semibold">Activation Products</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {orderedProducts.map((product) => <ProductCard key={product.id} product={product} balance={balance} loading={loading} onOpen={onProductOpen} onBuy={onBuy} />)}
      </div>
      <div className="mt-5 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_22px_rgba(56,189,248,0.08)] backdrop-blur-xl">
        <h3 className="mb-3 text-sm font-semibold text-slate-300">Mapped Activation Packages</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {packages.map((pkg) => (
          <div key={pkg.id} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-400">{pkg.name}</div>
                <div className="mt-1 text-3xl font-semibold">{money(pkg.amount_usd)}</div>
              </div>
              <span className="rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">available</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">Used through mapped products only</p>
          </div>
        ))}
      </div>
      </div>
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3" aria-label="Dashboard loading">
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
}

function WalletActivityTimeline({ items }: { items: HbWalletActivity[] }) {
  const visible = items.slice(0, 6);
  return (
    <div className="mb-5 rounded-[1.35rem] border border-cyan-300/15 bg-[#0b1728]/70 p-4 shadow-[0_0_24px_rgba(56,189,248,0.1)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Wallet Activity Timeline</h3>
        <StatusBadge value="Indexed ledger" tone="success" />
      </div>
      {visible.length === 0 ? <EmptyState title="No wallet activity yet." /> : (
        <div className="space-y-3">
          {visible.map((item) => (
            <div key={item.id} className="relative pl-5">
              <div className="proof-pulse absolute left-0 top-1.5 h-3 w-3 rounded-full border border-accent bg-[#071827] shadow-[0_0_14px_rgba(56,189,248,0.8)]" />
              <div className="rounded-2xl border border-sky-200/10 bg-sky-200/[0.04] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold capitalize">{activityLabel(item.type, item.direction)}</div>
                    <div className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right font-semibold text-accent">{money(item.amount_usd)}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {item.public_reference_id ? <ProofBadge referenceId={item.public_reference_id} /> : null}
                  <StatusBadge value={item.onchain_status || "internal"} tone={item.onchain_status === "confirmed" ? "success" : "neutral"} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function activityLabel(type: string, direction: string) {
  if (type === "deposit") return "Deposit";
  if (type === "package_purchase") return "Package activation";
  if (type === "withdrawal") return direction === "credit" ? "Withdrawal released" : "Withdrawal reserve";
  if (type === "upline") return "Direct income credit";
  if (type === "level") return "Level income credit";
  if (type === "recharge_credit") return "Legacy allocation";
  if (type === "received_funds") return "Received funds";
  if (type === "transferred_funds") return "Transferred funds";
  if (type === "admin_credit") return "Admin credit";
  if (type === "admin_deduction") return "Admin deduction";
  if (type === "bulk_distribution") return "Distribution reward";
  return type.replace(/_/g, " ");
}

function ProofBadge({ referenceId }: { referenceId: string }) {
  return (
    <a className="rounded-full border border-accent/25 bg-accent/10 px-2 py-1 font-semibold text-accent" href={`/proof/${encodeURIComponent(referenceId)}`} target="_blank" rel="noreferrer">
      Proof {referenceId}
    </a>
  );
}

function ProductsView({ products, packages, loading, availableBalance, onProductOpen, onBuy }: { products: HbProduct[]; packages: HbPackage[]; loading: boolean; availableBalance: string; onProductOpen: (slug: string) => void; onBuy: (productId: string) => void }) {
  const balance = Number(availableBalance || 0);
  const orderedProducts = [...products].sort((a, b) => Number(a.package_price) - Number(b.package_price));
  return (
    <Panel>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">Products</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Full activation product list mapped to available packages.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {orderedProducts.map((product) => <ProductCard key={product.id} product={product} balance={balance} loading={loading} onOpen={onProductOpen} onBuy={onBuy} />)}
      </div>
      <div className="mt-5 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_22px_rgba(56,189,248,0.08)] backdrop-blur-xl">
        <h3 className="mb-3 text-sm font-semibold text-slate-300">Available Packages</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {packages.map((pkg) => (
            <div key={pkg.id} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-400">{pkg.name}</div>
                  <div className="mt-1 text-3xl font-semibold">{money(pkg.amount_usd)}</div>
                </div>
                <span className="rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">available</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function ProductCard({ product, balance, loading, onOpen, onBuy }: { product: HbProduct; balance: number; loading: boolean; onOpen: (slug: string) => void; onBuy: (productId: string) => void }) {
  const disabled = loading || product.stock <= 0;
  return (
    <div className="tap-feedback overflow-hidden rounded-[1.25rem] border border-sky-200/15 bg-[#0b1728]/70 shadow-[0_0_24px_rgba(56,189,248,0.1)] backdrop-blur-xl hover:border-sky-200/25 sm:rounded-[1.35rem]">
      <button className="block w-full text-left" onClick={() => onOpen(product.slug)} type="button" aria-label={`Open ${product.title}`}>
        <div className="hb-dashboard-product-visual flex aspect-[16/9] items-center justify-center bg-sky-200/[0.06]">
          <PackageIllustration type={packageIllustrationTypeForAmount(product.package_price)} />
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 font-semibold">{product.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">{product.short_description || product.package_name}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold text-accent">{money(product.package_price)}</div>
              <span className="mt-2 inline-flex max-w-[7.5rem] rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-xs text-accent"><span className="truncate">{product.package_name || "Activation"}</span></span>
            </div>
          </div>
        </div>
      </button>
      <div className="px-4 pb-4">
        <PrimaryButton className="w-full" onClick={() => onBuy(product.id)} disabled={disabled} type="button" aria-label={`Buy ${product.title} with USDT`}>
          {loading ? "Preparing" : product.stock <= 0 ? "Out of Stock" : "Buy with USDT"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function ProductDetail({ product, availableBalance, onBack, onBuy }: { product: HbProduct; availableBalance: string; onBack: () => void; onBuy: (productId: string) => void }) {
  const balance = Number(availableBalance || 0);
  const disabled = product.stock <= 0;
  return (
    <Panel>
      <button className="mb-4 text-sm font-semibold text-accent" onClick={onBack} type="button">Back to products</button>
      <div className="overflow-hidden rounded-[1.35rem] border border-sky-200/15 bg-[#0b1728]/70 shadow-[0_0_24px_rgba(56,189,248,0.1)] backdrop-blur-xl">
        <div className="hb-dashboard-product-visual hb-dashboard-product-visual-detail flex aspect-[16/9] items-center justify-center bg-sky-200/[0.06]">
          <PackageIllustration type={packageIllustrationTypeForAmount(product.package_price)} />
        </div>
        <div className="p-4">
          <div className="mb-3 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">{product.package_name} activation</div>
          <h2 className="text-2xl font-semibold">{product.title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{product.description || product.short_description || "Activation product."}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatusTile label="Price" value={money(product.package_price)} />
            <StatusTile label="Stock" value={String(product.stock)} />
          </div>
          <PrimaryButton className="mt-4 w-full" onClick={() => onBuy(product.id)} disabled={disabled} type="button">
            {product.stock <= 0 ? "Out of Stock" : "Buy with USDT"}
          </PrimaryButton>
        </div>
      </div>
    </Panel>
  );
}

function WalletView({ balances, deposits, withdrawals, summary }: {
  balances: { deposit: string; income: string };
  deposits: HbDeposit[];
  withdrawals: HbWithdrawal[];
  summary: {
    depositAddress: string;
    pendingDeposits: { total: string; count: number };
    verifiedDeposits: { total: string; count: number };
    totalPurchased: { total: string; count: number };
  };
}) {
  return (
    <div className="space-y-4">
      <Panel>
        <h2 className="text-2xl font-semibold">Wallet & Deposit</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatusTile label="Available" value={money(balances.deposit)} />
          <StatusTile label="Income" value={money(balances.income)} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatusTile label="Pending" value={`${summary.pendingDeposits.count}`} />
          <StatusTile label="Verified" value={`${summary.verifiedDeposits.count}`} />
          <StatusTile label="Purchased" value={money(summary.totalPurchased.total)} />
        </div>
        <div className="mt-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Deposit Method</div>
          <div className="mt-2 text-sm text-slate-200">Create deposits with a NOWPayments invoice from the main Deposit action. This wallet page is for internal balances and history.</div>
          {summary.depositAddress ? (
            <div className="mt-3 break-all font-mono text-xs text-slate-500">Company address: {summary.depositAddress}</div>
          ) : null}
        </div>
      </Panel>
      <Panel>
        <h3 className="mb-4 text-lg font-semibold">Deposit History</h3>
        {deposits.length === 0 ? <EmptyState title="No deposits yet." /> : (
          <div className="space-y-3">
            {deposits.map((deposit) => (
              <div key={deposit.id} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{money(deposit.usd_amount)} {deposit.asset}</div>
                    <div className="mt-1 text-xs text-slate-400">{deposit.status} - {new Date(deposit.created_at).toLocaleString()}</div>
                  </div>
                  {deposit.status === "verified" ? <CheckCircle2 className="text-mint" size={20} /> : <span className="rounded-full bg-[#0b1728]/70 px-2 py-1 text-xs capitalize text-slate-300">{deposit.status}</span>}
                </div>
                {deposit.failure_reason ? <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-red-100">{deposit.failure_reason}</div> : null}
                {deposit.payment_id || deposit.tx_hash ? <div className="mt-3 break-all font-mono text-xs text-slate-400">{deposit.payment_id || deposit.tx_hash}</div> : null}
              </div>
            ))}
          </div>
        )}
      </Panel>
      <ListView title="Withdrawal History" empty="No withdrawals yet." items={withdrawals.map((item) => ({ id: item.id, title: item.status, value: `${money(item.amount_usd)} ${item.currency}`, meta: `${item.network.toUpperCase()} - ${new Date(item.requested_at).toLocaleString()}` }))} />
      <ListView title="Ledger Entries" empty="No ledger entries yet." items={[
        { id: "deposit-balance", title: "Available balance", value: money(balances.deposit), meta: "Main wallet" },
        { id: "verified-deposits", title: "Verified deposits", value: money(summary.verifiedDeposits.total), meta: `${summary.verifiedDeposits.count} records` },
        { id: "pending-deposits", title: "Pending deposits", value: money(summary.pendingDeposits.total), meta: `${summary.pendingDeposits.count} records` }
      ]} />
    </div>
  );
}

function ListView({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; title: string; value: string; meta: string }> }) {
  return (
    <Panel>
      <h2 className="mb-4 text-2xl font-semibold">{title}</h2>
      {items.length === 0 ? <EmptyState title={empty} /> : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold capitalize">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.meta}</div>
                </div>
                <div className="font-semibold text-accent">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function OrdersView({ orders }: { orders: HbOrder[] }) {
  return (
    <Panel>
      <h2 className="mb-4 text-2xl font-semibold">Purchased Products</h2>
      {orders.length === 0 ? <EmptyState title="No product orders yet." /> : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)]">
              <div className="flex gap-3">
                <div className="hb-dashboard-order-visual flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#0b1728]/70">
                  <PackageIllustration type={packageIllustrationTypeForAmount(order.package_price)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{order.product_title}</div>
                  <div className="mt-1 text-xs text-slate-400">{order.package_name} - {order.order_number}</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <span className="rounded-full bg-[#0b1728]/70 px-2 py-1 text-center">{order.payment_status}</span>
                    <span className="rounded-full bg-[#0b1728]/70 px-2 py-1 text-center">{order.activation_status}</span>
                    <span className="rounded-full bg-[#0b1728]/70 px-2 py-1 text-center">{order.distribution_status}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-accent">{money(order.amount_usd)}</div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function IncomeView({ income, singleLegReserve, salaryIncome, singleLegProgress, levelUnlockProgress, incomeCap, withdrawals, availableBalance, summary }: {
  income: HbIncome[];
  singleLegReserve: HbSingleLegReserve[];
  salaryIncome: HbSalaryIncome | null;
  singleLegProgress: HbSingleLegProgress | null;
  levelUnlockProgress: HbLevelUnlockProgress | null;
  incomeCap: HbIncomeCapSummary;
  withdrawals: HbWithdrawal[];
  availableBalance: string | number;
  summary: { referral_income: string; direct_income: string; level_income: string; single_leg_income: string; single_leg_reserve: string; salaryIncome: string };
}) {
  const [tab, setTab] = useState<"direct" | "level" | "single" | "salary">("direct");
  const totalWithdrawn = withdrawals
    .filter((item) => item.status === "paid")
    .reduce((total, item) => total + Number(item.payout_amount_usd ?? item.amount_usd ?? 0), 0);
  const tabs = [
    { id: "direct" as const, label: "Referral Income", value: money(summary.referral_income || summary.direct_income) },
    { id: "level" as const, label: "Level Income", value: money(summary.level_income) },
    { id: "single" as const, label: "Single Leg Income", value: money(summary.single_leg_income) },
    { id: "salary" as const, label: "Salary Income", value: money(summary.salaryIncome) },
    { id: "withdrawn" as const, label: "Total Withdrawn", value: money(totalWithdrawn) },
    { id: "available" as const, label: "Available Balance", value: money(availableBalance) }
  ];
  const directItems = income.filter((item) => item.income_type === "referral_income" || item.income_type === "upline");
  const levelItems = income.filter((item) => item.income_type === "level_income" || item.income_type === "level");
  const salaryItems = income.filter((item) => item.income_type === "salary_income");
  const singleLegIncomeItems = income.filter((item) => item.income_type === "single_leg_income");
  const currentItems = tab === "direct" ? directItems : tab === "level" ? levelItems : tab === "single" ? singleLegIncomeItems : tab === "salary" ? salaryItems : [];
  const salaryStatus = salaryIncome?.status === "paid" ? "Unlocked" : salaryIncome?.status === "unlocked" ? "Unlocked" : "Locked / Pending";
  return (
    <>
    <Panel>
      <h2 className="mb-4 text-2xl font-semibold">Income History</h2>
      <div className="mb-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <StatusTile label="Daily Cap" value={money(incomeCap?.dailyCapAmount || 0)} />
          <StatusTile label="Earned Today" value={money(incomeCap?.creditedAmount || 0)} />
          <StatusTile label="Remaining" value={money(incomeCap?.remainingAmount || 0)} />
          <StatusTile label="Capped" value={money(incomeCap?.cappedAmount || 0)} />
        </div>
        {Number(incomeCap?.cappedAmount || 0) > 0 ? (
          <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">Daily income cap reached. Extra income is recorded as capped income.</div>
        ) : null}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tabs.map((item) => (
          <button key={item.id} className={`rounded-2xl border p-3 text-left transition ${tab === item.id ? "border-sky-200/30 bg-gradient-to-r from-sky-300 via-cyan-400 to-sky-500 text-[#031524] shadow-[0_0_24px_rgba(56,189,248,0.2)]" : "border-sky-200/10 bg-[#0b1728]/70 text-slate-200 hover:bg-[#0b1728]/80"}`} onClick={() => item.id === "withdrawn" || item.id === "available" ? undefined : setTab(item.id)} type="button">
            <div className="text-xs font-semibold">{item.label}</div>
            <div className="mt-1 text-lg font-semibold">{item.value}</div>
          </button>
        ))}
      </div>
      {tab === "salary" ? (
        <div className="mb-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-400">Salary Income</div>
              <div className="mt-1 text-2xl font-semibold text-accent">{money(salaryIncome?.salary_amount || summary.salaryIncome || 100)}</div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${salaryStatus === "Unlocked" ? "bg-mint/15 text-mint" : "bg-amber-300/15 text-amber-100"}`}>{salaryStatus}</span>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-xl border border-sky-200/10 bg-[#08111f]/70 p-3">Self $100 package: <span className="font-semibold text-slate-100">{salaryIncome?.self_package_ok ? "completed" : "pending"}</span></div>
            <div className="rounded-xl border border-sky-200/10 bg-[#08111f]/70 p-3">Direct $100 users: <span className="font-semibold text-slate-100">{salaryIncome?.direct_100_count || 0} / 5</span></div>
            <div className="rounded-xl border border-sky-200/10 bg-[#08111f]/70 p-3">Team $100 package users: <span className="font-semibold text-slate-100">{salaryIncome?.team_100_count || 0} / 5</span></div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Team count uses distinct referred team users up to 15 levels. Direct Level-1 users are included once when they qualify.</p>
        </div>
      ) : null}
      {tab === "single" ? (
        <div className="mb-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatusTile label="Single Leg Team" value={`${singleLegProgress?.singleLegTeamCount || 0}`} />
            <StatusTile label="Direct $20+ Referrals" value={`${singleLegProgress?.eligibleDirectReferralCount || 0}`} />
            <StatusTile label="Position" value={singleLegProgress?.positionNumber ? String(singleLegProgress.positionNumber) : "Not eligible"} />
          </div>
          {singleLegProgress?.nextReward ? (
            <div className="mt-3 rounded-xl border border-sky-200/10 bg-[#08111f]/70 p-3 text-sm text-slate-300">
              <div className="font-semibold text-slate-100">Next Reward: {money(singleLegProgress.nextReward.reward_amount)} at {String(singleLegProgress.nextReward.target_members)} members</div>
              <div className="mt-1">Single Leg Team: {singleLegProgress.singleLegTeamCount} / {String(singleLegProgress.nextReward.target_members)}</div>
              <div>Direct Referrals: {singleLegProgress.eligibleDirectReferralCount} / {String(singleLegProgress.nextReward.required_direct_referrals)}</div>
              <div>Status: <span className="capitalize text-slate-100">{String(singleLegProgress.nextReward.status || "locked")}</span></div>
            </div>
          ) : null}
        </div>
      ) : null}
      {tab === "level" ? <LevelUnlockProgress progress={levelUnlockProgress} /> : null}
      {currentItems.length === 0 ? <EmptyState title="No records for this tab." /> : (
        <div className="space-y-3">
          {currentItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold capitalize">{isIncomeItem(item) ? item.income_type.replace("_", " ") : "single leg"}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.status} - {new Date(item.created_at).toLocaleString()}</div>
                </div>
                <div className="font-semibold text-accent">{money(item.amount_usd)}</div>
              </div>
              {isIncomeItem(item) ? (
                <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                  <div className="break-all">Proof hash: <span className="font-mono text-slate-200">{item.proof_hash ? short(item.proof_hash) : "pending"}</span></div>
                  <div>Reference: {item.public_reference_id ? <ProofBadge referenceId={item.public_reference_id} /> : "pending"}</div>
                  <div>Source package: <span className="text-slate-200">{item.source_package || "N/A"}</span></div>
                  <div>Source user: <span className="text-slate-200">{item.source_user_name || "N/A"}</span></div>
                  <div>Level number: <span className="text-slate-200">{item.level_number || item.level_depth || "N/A"}</span></div>
                  <div>Credited: <span className="text-slate-200">{money(item.credited_amount ?? item.amount_usd)}</span></div>
                  <div>Capped: <span className="text-slate-200">{money(item.capped_amount || 0)}</span></div>
                  <div>Cap status: <span className="capitalize text-slate-200">{item.cap_status ? item.cap_status.replace("_", " ") : "N/A"}</span></div>
                  <div className="break-all">Source wallet: <span className="font-mono text-slate-200">{item.source_wallet ? short(item.source_wallet) : "N/A"}</span></div>
                  <div>Distribution: <span className="capitalize text-slate-200">{item.income_type.replace("_", " ")}</span></div>
                  <div>{item.public_reference_id ? <a className="font-semibold text-accent" href={`/proof/${encodeURIComponent(item.public_reference_id)}`} target="_blank" rel="noreferrer">Verify Proof</a> : null}</div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
    <SingleLegMilestonesSection progress={singleLegProgress} />
    </>
  );
}

function isIncomeItem(item: HbIncome | HbSingleLegReserve): item is HbIncome {
  return "income_type" in item;
}

function LevelUnlockProgress({ progress }: { progress: HbLevelUnlockProgress | null }) {
  const directReferrals = progress?.directReferrals || 0;
  const levels = progress?.levels || Array.from({ length: 15 }, (_, index) => ({
    level: index + 1,
    requiredDirectReferrals: index + 1,
    status: "locked" as const
  }));
  return (
    <div className="mb-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-100">Level Unlock Progress</h3>
          <p className="mt-1 text-xs text-slate-400">Every level requires matching direct active referrals with $4+ package.</p>
        </div>
        <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">Direct Referrals: {directReferrals} / 15</span>
      </div>
      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
        {levels.map((item) => (
          <div key={item.level} className="flex items-center justify-between gap-2 rounded-xl border border-sky-200/10 bg-[#08111f]/70 p-3">
            <span className="font-semibold text-slate-100">Level {item.level}</span>
            <span className="text-slate-400">Requires {item.requiredDirectReferrals} direct</span>
            <span className={`rounded-full px-2 py-1 font-semibold ${item.status === "unlocked" ? "bg-mint/15 text-mint" : "bg-slate-400/10 text-slate-300"}`}>{item.status === "unlocked" ? "Unlocked" : "Locked"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const singleLegMilestones = [
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

function SingleLegMilestonesSection({ progress }: { progress: HbSingleLegProgress | null }) {
  const teamCount = Number(progress?.singleLegTeamCount || 0);
  const directCount = Number(progress?.eligibleDirectReferralCount || 0);
  const rewardRows = progress?.rewards || [];
  const nextMilestone = singleLegMilestones.find((item) => {
    const live = rewardRows.find((reward) => Number(reward.slab_number) === item.level);
    return String(live?.status || "").toLowerCase() !== "paid";
  }) || singleLegMilestones[singleLegMilestones.length - 1];
  const maxTarget = singleLegMilestones[singleLegMilestones.length - 1].members;
  const overallPercent = Math.min(100, Math.max(0, (teamCount / maxTarget) * 100));

  function rowStatus(item: typeof singleLegMilestones[number]) {
    const live = rewardRows.find((reward) => Number(reward.slab_number) === item.level);
    if (String(live?.status || "").toLowerCase() === "paid") return "completed";
    if (teamCount > 0 && (teamCount >= item.members || item.level === nextMilestone.level)) return "in_progress";
    return "pending";
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="mt-5 overflow-hidden rounded-[1.35rem] border border-violet-300/20 bg-[#070b1d]/78 p-4 shadow-[0_0_42px_rgba(124,58,237,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="bg-gradient-to-r from-violet-200 via-sky-200 to-cyan-200 bg-clip-text text-2xl font-semibold text-transparent">Single Leg Income</h2>
          <p className="mt-1 text-sm text-cyan-100/65">Top to Bottom Global Single Leg System</p>
        </div>
        <motion.button whileHover={{ scale: 1.02, boxShadow: "0 0 28px rgba(168,85,247,0.36)" }} whileTap={{ scale: 0.98 }} className="w-full rounded-2xl border border-violet-300/45 bg-[#0b1026]/80 px-4 py-3 text-sm font-semibold text-violet-100 shadow-[0_0_18px_rgba(124,58,237,0.16)] backdrop-blur-xl transition hover:border-cyan-300/60 sm:w-auto" type="button">
          How it works?
        </motion.button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MilestoneSummaryCard icon={<Users size={20} />} label="Your Single Leg Team" value={`${teamCount.toLocaleString()} Members`} tone="blue" />
        <MilestoneSummaryCard icon={<Target size={20} />} label="Next Target" value={`${nextMilestone.members.toLocaleString()} Members`} tone="cyan" />
        <MilestoneSummaryCard icon={<DollarSign size={20} />} label="Next Reward" value={money(nextMilestone.reward)} tone="purple" />
        <MilestoneSummaryCard icon={<CheckCircle2 size={20} />} label="Direct Referrals" value={`${directCount} / ${nextMilestone.referrals} Active`} tone="green" />
      </div>

      <div className="mt-5 rounded-[1.2rem] border border-cyan-300/15 bg-[#0b1026]/68 p-4 shadow-[0_0_30px_rgba(34,211,238,0.12)] backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-100">Overall Progress</h3>
          <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">{overallPercent.toFixed(2)}%</span>
        </div>
        <div className="h-5 overflow-hidden rounded-full border border-violet-200/15 bg-[#050817] shadow-[inset_0_1px_10px_rgba(0,0,0,0.45)]">
          <motion.div initial={{ width: 0 }} whileInView={{ width: `${overallPercent}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-400 to-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.55)]" />
        </div>
        <div className="mt-2 grid grid-cols-3 text-xs text-slate-500">
          <span>0</span>
          <span className="text-center text-cyan-100">{teamCount.toLocaleString()}</span>
          <span className="text-right">{maxTarget.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-5 rounded-[1.2rem] border border-violet-300/15 bg-[#090e22]/72 p-3 shadow-[0_0_34px_rgba(59,130,246,0.13)] backdrop-blur-xl sm:p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold tracking-[0.16em] text-cyan-100">SINGLE LEG INCOME MILESTONES</h3>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
            <LegendDot color="bg-violet-400" label="Total Members Required" />
            <LegendDot color="bg-cyan-300" label="Reward Amount" />
            <LegendDot color="bg-emerald-300" label="Direct $20 Referral Required" />
          </div>
        </div>
        <div className="hidden rounded-2xl border border-white/5 bg-[#050817]/60 p-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[0.7fr_1.2fr_1fr_1.35fr_1fr_1.8fr]">
          <div className="px-2 py-2">Level</div>
          <div className="px-2 py-2">Total Members</div>
          <div className="px-2 py-2">Reward</div>
          <div className="px-2 py-2">Direct $20 Referrals</div>
          <div className="px-2 py-2">Status</div>
          <div className="px-2 py-2">Progress</div>
        </div>
        <div className="mt-2 grid gap-2">
          {singleLegMilestones.map((item, index) => {
            const status = rowStatus(item);
            const currentMembers = Math.min(teamCount, item.members);
            const percent = Math.min(100, (currentMembers / item.members) * 100);
            return <MilestoneRow key={item.level} item={item} index={index} status={status} currentMembers={currentMembers} percent={percent} />;
          })}
        </div>
      </div>

      <SingleLegNetwork teamCount={teamCount} />

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <InfoGlowCard title="How it works?" text="Members are placed top to bottom based on join order in the global single leg line." />
        <InfoGlowCard title="Reward Unlock" text="Complete member target and maintain required direct referrals to unlock rewards." />
        <InfoGlowCard title="Instant Payout" text="Unlocked rewards are credited instantly to withdrawal wallet." />
      </div>

      <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-cyan-300/15 bg-cyan-300/8 p-4 text-center text-sm text-cyan-100/80 shadow-[0_0_28px_rgba(34,211,238,0.12)]">
        Only $20 or higher package users are eligible for Single Leg Income.
      </div>
    </motion.section>
  );
}

function MilestoneSummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "blue" | "cyan" | "purple" | "green" }) {
  const toneClass = tone === "blue" ? "from-blue-500/18 to-sky-400/8 text-blue-200" : tone === "cyan" ? "from-cyan-400/18 to-blue-400/8 text-cyan-100" : tone === "green" ? "from-emerald-400/18 to-cyan-400/8 text-emerald-100" : "from-violet-500/20 to-fuchsia-400/8 text-violet-100";
  return (
    <motion.div whileHover={{ y: -4, boxShadow: "0 0 34px rgba(34,211,238,0.18)" }} className={`min-w-0 rounded-[1.15rem] border border-white/10 bg-gradient-to-br ${toneClass} p-4 shadow-[0_0_22px_rgba(124,58,237,0.12)] backdrop-blur-xl transition`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#050817]/60 shadow-[0_0_18px_rgba(34,211,238,0.14)]">{icon}</div>
        <div className="min-w-0">
          <div className="text-xs text-slate-400">{label}</div>
          <div className="mt-1 truncate text-lg font-semibold text-slate-50">{value}</div>
        </div>
      </div>
    </motion.div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color} shadow-[0_0_12px_currentColor]`} />{label}</span>;
}

function MilestoneRow({ item, index, status, currentMembers, percent }: { item: typeof singleLegMilestones[number]; index: number; status: "completed" | "in_progress" | "pending"; currentMembers: number; percent: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35, delay: index * 0.035 }} className="grid gap-3 rounded-2xl border border-white/8 bg-[#0b1026]/74 p-3 shadow-[0_0_22px_rgba(59,130,246,0.08)] backdrop-blur-xl md:grid-cols-[0.7fr_1.2fr_1fr_1.35fr_1fr_1.8fr] md:items-center">
      <MilestoneCell label="Level" value={`Level ${item.level}`} />
      <MilestoneCell label="Total Members" value={item.members.toLocaleString()} accent="text-violet-100" />
      <MilestoneCell label="Reward" value={money(item.reward)} accent="text-cyan-100" />
      <MilestoneCell label="Direct $20 Referrals" value={String(item.referrals)} accent="text-emerald-100" />
      <div><StatusMilestoneBadge status={status} /></div>
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-400"><span>{currentMembers.toLocaleString()} / {item.members.toLocaleString()}</span><span>{percent.toFixed(0)}%</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#050817]">
          <motion.div initial={{ width: 0 }} whileInView={{ width: `${percent}%` }} viewport={{ once: true }} transition={{ duration: 0.75, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-400 to-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.5)]" />
        </div>
      </div>
    </motion.div>
  );
}

function MilestoneCell({ label, value, accent = "text-slate-100" }: { label: string; value: string; accent?: string }) {
  return <div className="min-w-0"><div className="text-[11px] uppercase tracking-wide text-slate-500 md:hidden">{label}</div><div className={`truncate text-sm font-semibold ${accent}`}>{value}</div></div>;
}

function StatusMilestoneBadge({ status }: { status: "completed" | "in_progress" | "pending" }) {
  if (status === "completed") return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-300/15 px-3 py-1 text-xs font-semibold text-emerald-100"><CheckCircle2 size={13} /> Completed</span>;
  if (status === "in_progress") return <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-400/15 px-3 py-1 text-xs font-semibold text-violet-100"><span className="h-2 w-2 animate-pulse rounded-full bg-violet-300" /> In Progress</span>;
  return <span className="inline-flex rounded-full border border-slate-400/15 bg-slate-400/10 px-3 py-1 text-xs font-semibold text-slate-300">Pending</span>;
}

function SingleLegNetwork({ teamCount }: { teamCount: number }) {
  return (
    <div className="mt-5 rounded-[1.2rem] border border-cyan-300/15 bg-[#080d20]/78 p-5 text-center shadow-[0_0_34px_rgba(124,58,237,0.15)] backdrop-blur-xl">
      <h3 className="text-sm font-semibold tracking-[0.14em] text-cyan-100">SINGLE LEG POSITION (TOP TO BOTTOM)</h3>
      <div className="relative mx-auto mt-5 flex max-w-sm flex-col items-center">
        <div className="absolute top-12 h-36 w-px bg-gradient-to-b from-violet-400 via-cyan-300 to-transparent shadow-[0_0_18px_rgba(34,211,238,0.8)]" />
        <motion.div animate={{ boxShadow: ["0 0 18px rgba(168,85,247,0.4)", "0 0 34px rgba(34,211,238,0.55)", "0 0 18px rgba(168,85,247,0.4)"] }} transition={{ duration: 2.6, repeat: Infinity }} className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border border-violet-200/40 bg-gradient-to-br from-violet-500/40 to-cyan-400/20 text-sm font-bold text-white backdrop-blur-xl">YOU</motion.div>
        <div className="relative z-10 mt-10 grid w-full grid-cols-3 gap-3">
          {[0, 1, 2].map((item) => <div key={item} className="mx-auto h-12 w-12 rounded-full border border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_18px_rgba(34,211,238,0.18)]" />)}
        </div>
        <div className="relative z-10 mt-4 grid w-4/5 grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((item) => <div key={item} className="mx-auto h-8 w-8 rounded-full border border-violet-300/20 bg-violet-300/10 shadow-[0_0_14px_rgba(168,85,247,0.16)]" />)}
        </div>
      </div>
      <div className="mt-5 text-lg font-semibold text-cyan-100">{teamCount.toLocaleString()} Members In Your Single Leg Team</div>
    </div>
  );
}

function InfoGlowCard({ title, text }: { title: string; text: string }) {
  return <motion.div whileHover={{ y: -3 }} className="rounded-[1.1rem] border border-violet-300/15 bg-[#0b1026]/74 p-4 shadow-[0_0_24px_rgba(124,58,237,0.12)] backdrop-blur-xl"><div className="font-semibold text-slate-100">{title}</div><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></motion.div>;
}

function ReferralView({ user, referrals, summary, singleLegProgress, levelUnlockProgress }: { user: HbUser; referrals: HbReferral[]; summary: HbReferralSummary | null; singleLegProgress: HbSingleLegProgress | null; levelUnlockProgress: HbLevelUnlockProgress | null }) {
  const referralUrl = useMemo(() => (typeof window === "undefined" ? user.referral_code : `${window.location.origin}/halal-business?ref=${user.referral_code}`), [user.referral_code]);
  const walletReferralUrl = useMemo(() => {
    const wallet = user.usdt_bep20_address || user.hb9_wallet_address || user.wallet_address || "";
    return typeof window === "undefined" || !wallet ? "" : `${window.location.origin}/halal-business?sponsor=${wallet}`;
  }, [user.hb9_wallet_address, user.usdt_bep20_address, user.wallet_address]);
  const directTeamCount = Number(summary?.directTeamCount ?? summary?.directReferrals.length ?? referrals.length ?? 0);
  const totalTeamCount = Number(summary?.totalTeamCount || 0);
  const activeTeamCount = Number(summary?.activeTeamCount ?? summary?.activeCount ?? 0);
  const singleLegTeamCount = Number(summary?.singleLegCount ?? singleLegProgress?.singleLegTeamCount ?? 0);
  const levelRows = summary?.levelCounts?.length
    ? summary.levelCounts.map((level) => ({ level_no: level.level, total_count: level.total, active_count: level.active }))
    : summary?.levelSummary || [];
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Referral Team</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Share your decentralized invite link and track direct plus level growth.</p>
        </div>
        <div className="rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">{directTeamCount} direct</div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Sponsor</div>
          <div className="mt-2 font-semibold">{summary?.sponsor?.display_name || "No sponsor"}</div>
          {summary?.sponsor ? <div className="mt-1 text-xs text-slate-400">{summary.sponsor.email} - {summary.sponsor.status}</div> : <div className="mt-1 text-xs text-slate-400">Root or wallet-created account</div>}
        </div>
        <div className="rounded-2xl border border-accent/25 bg-accent/10 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-accent">Your Referral ID</div>
          <div className="mt-2 font-mono text-xl font-semibold">{user.referral_code}</div>
          <button className="mt-3 flex items-center gap-2 text-sm font-semibold text-accent" onClick={() => navigator.clipboard.writeText(user.referral_code)} type="button"><Copy size={15} /> Copy ID</button>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-accent">Invite Link</div>
        <div className="mt-2 break-all font-mono text-sm">{referralUrl}</div>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className="flex items-center gap-2 text-sm font-semibold text-accent" onClick={() => navigator.clipboard.writeText(referralUrl)} type="button"><Copy size={15} /> Copy invite link</button>
          {walletReferralUrl ? <button className="flex items-center gap-2 text-sm font-semibold text-accent" onClick={() => navigator.clipboard.writeText(walletReferralUrl)} type="button"><Copy size={15} /> Copy wallet link</button> : null}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatusTile label="Direct" value={String(directTeamCount)} />
        <StatusTile label="Total" value={String(totalTeamCount)} />
        <StatusTile label="Active" value={String(activeTeamCount)} />
      </div>
      <div className="mt-4">
        <LevelUnlockProgress progress={levelUnlockProgress} />
      </div>
      <div className="mt-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
        <h3 className="mb-3 font-semibold">Single Leg Progress</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusTile label="Single Leg Team" value={String(singleLegTeamCount)} />
          <StatusTile label="Next target" value={singleLegProgress?.nextReward ? String(singleLegProgress.nextReward.target_members || 0) : "-"} />
          <StatusTile label="Next reward" value={singleLegProgress?.nextReward ? money(singleLegProgress.nextReward.reward_amount) : "-"} />
          <StatusTile label="Direct $20+" value={`${singleLegProgress?.eligibleDirectReferralCount || 0} / ${singleLegProgress?.nextReward ? String(singleLegProgress.nextReward.required_direct_referrals || 0) : 0}`} />
        </div>
        {singleLegProgress?.nextReward ? (
          <div className="mt-3 rounded-xl border border-sky-200/10 bg-[#08111f]/70 p-3 text-sm text-slate-300">
            <div>Single Leg Team: <span className="text-slate-100">{singleLegTeamCount} / {String(singleLegProgress.nextReward.target_members)}</span></div>
            <div>Required direct $20 referrals: <span className="text-slate-100">{singleLegProgress.eligibleDirectReferralCount} / {String(singleLegProgress.nextReward.required_direct_referrals)}</span></div>
            <div>Status: <span className="capitalize text-slate-100">{String(singleLegProgress.nextReward.status || "locked")}</span></div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">$20 or higher package activation enters single-leg eligibility.</p>
        )}
        {singleLegProgress?.rewards?.length ? (
          <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
            {singleLegProgress.rewards.map((reward) => (
              <div key={String(reward.slab_number)} className="rounded-xl border border-sky-200/10 bg-[#08111f]/70 p-3">
                <div className="font-semibold text-slate-100">Slab {String(reward.slab_number)} - {money(reward.reward_amount)}</div>
                <div>{String(reward.actual_single_leg_members || 0)} / {String(reward.target_members || 0)} members</div>
                <div>{String(reward.actual_direct_referrals || 0)} / {String(reward.required_direct_referrals || 0)} direct</div>
                <div className="capitalize">{String(reward.status || "locked")}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {levelRows.length ? (
        <div className="mt-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
          <h3 className="mb-3 font-semibold">Level Progress Preview</h3>
          <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
            {levelRows.map((level) => (
              <div key={level.level_no} className="rounded-xl border border-sky-200/10 bg-[#0b1728]/70 p-3">
                <div className="font-semibold text-slate-100">L{level.level_no}: {level.total_count}</div>
                <div>{level.active_count} active</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        {referrals.length === 0 ? <EmptyState title="No direct referrals yet." /> : referrals.map((item) => (
          <div key={item.id} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)]">
            <div className="font-semibold">{item.display_name}</div>
            <div className="mt-1 text-xs text-slate-400">{short(item.email)} - {item.status}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TreasuryTransparencyView({ data, purchases, proofs }: { data: HbTreasuryTransparency | null; purchases: HbPurchase[]; proofs: HbLedgerProof[] }) {
  const accounting = data?.reserveAccounting || {};
  const treasuryLabels: Record<string, string> = {
    treasury_usdt_bep20_address: "Company treasury wallet",
    payout_wallet_address: "Direct income treasury",
    company_reserve_wallet: "Treasury hold wallet"
  };
  const activeTreasuryWallets = (data?.wallets || []).filter((wallet) => Boolean(treasuryLabels[wallet.key]));
  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Treasury / Transparency</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Public treasury addresses, reserve accounting, proof badges, and on-chain mirrors for package purchases.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {activeTreasuryWallets.map((wallet) => (
            <div key={wallet.key} className="rounded-[1.25rem] border border-cyan-300/15 bg-[#0b1728]/70 p-4 shadow-[0_0_22px_rgba(56,189,248,0.1)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-cyan-100/70">{treasuryLabels[wallet.key] || wallet.label}</div>
                  <div className="mt-2 font-semibold">{wallet.label}</div>
                </div>
                <span className="rounded-full border border-mint/30 bg-mint/10 px-2 py-1 text-xs font-semibold text-mint">{wallet.network.toUpperCase()}</span>
              </div>
              <div className="mt-3 break-all font-mono text-xs text-slate-300">{wallet.wallet_address || "Not configured"}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Benefit label="Chain" value={String(wallet.chain_id)} />
                <Benefit label="Reserve balance" value={wallet.reserve_balance} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>Updated {wallet.updated_at ? new Date(wallet.updated_at).toLocaleString() : "pending"}</span>
                <ExplorerButton baseUrl={data?.explorerBaseUrl || "https://bscscan.com"} type="wallet" value={wallet.wallet_address} compact />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <h3 className="mb-4 text-xl font-semibold">Reserve Accounting</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatusTile label="Total deposits" value={money(accounting.total_deposits)} />
          <StatusTile label="Total withdrawals" value={money(accounting.total_withdrawals)} />
          <StatusTile label="Active liabilities" value={money(accounting.active_liabilities)} />
          <StatusTile label="Treasury hold" value={money(accounting.company_reserve_treasury)} />
          <StatusTile label="Pending payouts" value={money(accounting.pending_payouts)} />
        </div>
      </Panel>
      <Panel>
        <h3 className="mb-4 text-xl font-semibold">Package On-Chain Status</h3>
        <div className="space-y-3">
          {purchases.length === 0 ? <EmptyState title="No package purchases yet." /> : purchases.map((purchase) => (
            <div key={purchase.id} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{purchase.package_name}</div>
                  <div className="mt-1 text-xs text-slate-400">{money(purchase.amount_usd)} - {new Date(purchase.created_at).toLocaleString()}</div>
                </div>
                <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">{purchase.onchain_status || purchase.status}</span>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                <div className="break-all">Tx hash: <span className="font-mono text-slate-200">{purchase.contract_purchase_tx_hash || purchase.onchain_tx_hash || "internal"}</span></div>
                <div>Block: <span className="text-slate-200">{purchase.block_number || "pending"}</span></div>
                <div>Indexed: <span className="text-slate-200">{purchase.onchain_status === "confirmed" ? "indexed" : purchase.onchain_status || "pending"}</span></div>
                <div>Confirmations: <span className="text-slate-200">{purchase.block_number ? "confirmed" : "pending"}</span></div>
                <div className="break-all">Proof hash: <span className="font-mono text-slate-200">{purchase.proof_hash ? short(purchase.proof_hash) : "pending"}</span></div>
                <div>{purchase.public_reference_id ? <ProofBadge referenceId={purchase.public_reference_id} /> : null}</div>
              </div>
              <div className="mt-3"><ExplorerButton baseUrl={data?.explorerBaseUrl || "https://bscscan.com"} type="tx" value={purchase.contract_purchase_tx_hash || purchase.onchain_tx_hash} compact /></div>
            </div>
          ))}
        </div>
      </Panel>
      <TransparencyView proofs={proofs} />
    </div>
  );
}

function TransparencyView({ proofs }: { proofs: HbLedgerProof[] }) {
  return (
    <Panel>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">Transparency Proofs</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Ledger Proof records are internal audit-chain references. On-chain references appear only when a payout or deposit reference is recorded.</p>
      </div>
      {proofs.length === 0 ? <EmptyState title="No ledger proofs yet." /> : (
        <div className="space-y-3">
          {proofs.map((proof) => (
            <div key={proof.public_reference_id} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold capitalize">{proof.proof_type.replace(/_/g, " ")}</div>
                  <div className="mt-1 font-mono text-xs text-accent">{proof.public_reference_id}</div>
                </div>
                <div className="text-right font-semibold text-accent">{money(proof.amount_usd)}</div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                <div className="break-all">Proof hash: <span className="font-mono text-slate-200">{short(proof.proof_hash)}</span></div>
                <div className="capitalize">Status: {proof.status || "recorded"}</div>
                <div>Created: {new Date(proof.created_at).toLocaleString()}</div>
                <div>On-chain reference: {proof.chain_tx_hash ? short(proof.chain_tx_hash) : proof.onchain_status || "not applicable"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ProfileView({ user }: { user: HbUser }) {
  return (
    <Panel>
      <h2 className="text-2xl font-semibold">Profile</h2>
      <div className="mt-4 space-y-3">
        <ProfileRow label="Name" value={user.display_name} />
        <ProfileRow label="Email" value={user.email || "Not provided"} />
        <ProfileRow label="Mobile" value={user.mobile_number || "Not provided"} />
        <ProfileRow label="User ID" value={user.id} mono />
        <ProfileRow label="Status" value={user.status} />
        <ProfileRow label="Referral Code" value={user.referral_code} />
        <ProfileRow label="Activated At" value={user.activated_at ? new Date(user.activated_at).toLocaleString() : "Not active"} />
      </div>
      <div className="mt-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 text-sm leading-6 text-slate-300 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
        Without an active package, HB9 services remain locked.
      </div>
    </Panel>
  );
}

function ProfileRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 break-all text-sm text-slate-100 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
