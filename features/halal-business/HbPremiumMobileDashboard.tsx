"use client";

import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { ArrowDownToLine, Banknote, Bell, Box, ChevronDown, ChevronRight, ChevronUp, CircleDollarSign, Copy, Download, Eye, Home, Layers3, PackageCheck, Plus, ReceiptText, RefreshCw, Send, Settings, ShieldCheck, Sparkles, TrendingUp, Users, Wallet } from "lucide-react";
import { BrowserProvider, Contract, encodeBytes32String, parseUnits, ZeroAddress } from "ethers";
import { HbLandingPage } from "@/components/halal-business/HbLandingPage";
import { HB9Logo } from "@/components/brand/HB9Logo";
import { CoinLogo as CryptoCoinLogo } from "@/components/crypto/CoinLogo";
import { HB9VoiceAssistant, type HB9VoiceEvent, type HB9VoiceScript } from "@/components/voice/HB9VoiceAssistant";
import {
  buyHbProduct,
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
  fetchHbProducts,
  fetchHbPurchases,
  fetchHbReferrals,
  fetchHbWallet,
  fetchHbWalletActivity,
  createHbDevDashboardUser,
  getHbDevWallet,
  getHbToken,
  hbDevDashboardProducts,
  isHbDevDashboardBypassEnabled,
  saveHbToken,
  trackHbOnchainPurchase,
  type HbCoinBalance,
  type HbIncome,
  type HbMyProductsDelivery,
  type HbOnchainPackageConfig,
  type HbOrder,
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

type TabId = "home" | "products" | "team" | "income" | "wallet" | "packages";
type EthereumProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
type OnchainPackageItem = HbOnchainPackageConfig["packages"][number];
type PurchaseStage = "review" | "approving" | "submitting" | "pending" | "activated";
type PurchaseReview = {
  product: HbProduct;
  config: HbOnchainPackageConfig;
  packageConfig: OnchainPackageItem;
  buyerAddress: string;
  sponsorRef: string;
  stage: PurchaseStage;
  txHash?: string;
};

const PACKAGE_MANAGER_ABI = ["function buyPackage(uint256 packageId,address sponsorAddress,bytes32 referralCode)"];
const ERC20_ABI = ["function approve(address spender,uint256 amount) returns (bool)", "function transfer(address to,uint256 amount) returns (bool)"];
const HB_DEV_DASHBOARD_BYPASS = isHbDevDashboardBypassEnabled();
const HB_WITHDRAWAL_MIN_USD = 2;
const HB_WITHDRAWAL_MIN_ERROR = "Minimum withdrawal is $2.";
const HB9_COIN_PRICE_USD = 0.13;
const HB9_TO_USDT_MIN_USD = 500;

const navItems: Array<{ id: TabId; label: string; icon: ElementType }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "products", label: "My Product", icon: PackageCheck },
  { id: "team", label: "Team", icon: Users },
  { id: "income", label: "Income", icon: TrendingUp },
  { id: "wallet", label: "Wallet", icon: Wallet }
];

const packageBenefits: Record<number, string> = {
  4: "4 Business Idea Books",
  20: "20 Business Idea & Money Management Books + 700 Social Media Followers",
  100: "100 Story, Business Idea, Money Management Books + 4000 Social Media Followers",
  500: "All $100 features + WhatsApp Automatic Message Software",
  2500: "All $500 features + AI Calling Agent + Meta Auto Ads Run AI Software",
  12500: "All $2500 features + 3 Custom Software, Centralized or Decentralized"
};

const packageNames: Record<number, string> = {
  4: "Starter Package",
  20: "Growth Package",
  100: "Popular Package",
  500: "Automation Package",
  2500: "AI Business Package",
  12500: "Enterprise Package"
};

const packageShortText: Record<number, string> = {
  4: "4 Books",
  20: "20 Books + 700 Followers",
  100: "100 Books + 4000 Followers",
  500: "WhatsApp Automation Software",
  2500: "AI Calling + Meta Ads AI",
  12500: "3 Custom Software"
};

const packageVisuals: Record<number, { from: string; mid: string; to: string; accent: string; label: string; scene: "starter" | "growth" | "popular" | "automation" | "ai" | "enterprise" }> = {
  4: { from: "#38bdf8", mid: "#2563eb", to: "#0f172a", accent: "#7dd3fc", label: "4X", scene: "starter" },
  20: { from: "#c084fc", mid: "#7c3aed", to: "#1e1b4b", accent: "#d8b4fe", label: "20X", scene: "growth" },
  100: { from: "#facc15", mid: "#f59e0b", to: "#1e293b", accent: "#fde68a", label: "100", scene: "popular" },
  500: { from: "#34d399", mid: "#10b981", to: "#063b2b", accent: "#86efac", label: "WA", scene: "automation" },
  2500: { from: "#8b5cf6", mid: "#06b6d4", to: "#172554", accent: "#c4b5fd", label: "AI", scene: "ai" },
  12500: { from: "#f59e0b", mid: "#38bdf8", to: "#111827", accent: "#fde68a", label: "ENT", scene: "enterprise" }
};

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00";
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

export function HbPremiumMobileDashboard({ devMode = false }: { devMode?: boolean }) {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [token, setToken] = useState("");
  const [sourceReferralCode, setSourceReferralCode] = useState("");
  const [user, setUser] = useState<HbUser | null>(null);
  const [products, setProducts] = useState<HbProduct[]>([]);
  const [purchases, setPurchases] = useState<HbPurchase[]>([]);
  const [orders, setOrders] = useState<HbOrder[]>([]);
  const [withdrawals, setWithdrawals] = useState<HbWithdrawal[]>([]);
  const [income, setIncome] = useState<HbIncome[]>([]);
  const [singleLegReserve, setSingleLegReserve] = useState<HbSingleLegReserve[]>([]);
  const [singleLegProgress, setSingleLegProgress] = useState<HbSingleLegProgress | null>(null);
  const [incomeSummary, setIncomeSummary] = useState({ direct_income: "0", level_income: "0", single_leg_income: "0", single_leg_reserve: "0", salaryIncome: "0" });
  const [referralSummary, setReferralSummary] = useState<HbReferralSummary | null>(null);
  const [walletActivity, setWalletActivity] = useState<HbWalletActivity[]>([]);
  const [myProducts, setMyProducts] = useState<HbMyProductsDelivery | null>(null);
  const [coins, setCoins] = useState<HbCoinBalance[]>([]);
  const [onchainConfig, setOnchainConfig] = useState<HbOnchainPackageConfig | null>(null);
  const [walletData, setWalletData] = useState({
    depositAddress: "",
    balances: { deposit: "0", income: "0" },
    pendingWithdrawals: { total: "0", count: 0 },
    verifiedDeposits: { total: "0", count: 0 },
    pendingDeposits: { total: "0", count: 0 }
  });
  const [currentPackage, setCurrentPackage] = useState("None");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [purchaseReview, setPurchaseReview] = useState<PurchaseReview | null>(null);
  const [voiceEvent, setVoiceEvent] = useState<HB9VoiceEvent>(null);
  const [convertingCoin, setConvertingCoin] = useState("");
  const [walletActionBusy, setWalletActionBusy] = useState("");

  const devDashboardActive = devMode && HB_DEV_DASHBOARD_BYPASS;
  const authenticated = devDashboardActive || Boolean(token && user);
  const currentTitle = useMemo(() => activeTab === "packages" ? "All Packages" : navItems.find((item) => item.id === activeTab)?.label || "Home", [activeTab]);
  const dashboardUser = user || createHbDevDashboardUser(getHbDevWallet());
  const dashboardProducts = products;
  const boundWallet = dashboardUser.usdt_bep20_address || dashboardUser.bitzenx_wallet_address || dashboardUser.wallet_address || walletData.depositAddress || "";
  const totalBalance = Number(walletData.balances.deposit || 0) + Number(walletData.balances.income || 0);
  const orderedProducts = useMemo(() => [...products].sort((a, b) => Number(a.package_price) - Number(b.package_price)), [products]);
  const completePackageProducts = useMemo(() => {
    const byAmount = new Map<number, HbProduct>();
    if (devDashboardActive) hbDevDashboardProducts.forEach((product) => byAmount.set(Number(product.package_price), product));
    dashboardProducts.forEach((product) => byAmount.set(Number(product.package_price), product));
    return Array.from(byAmount.values()).sort((a, b) => Number(a.package_price) - Number(b.package_price));
  }, [dashboardProducts]);
  const hasActiveProduct = Boolean(myProducts?.activeProducts?.length || purchases.length || orders.length);

  function playAssistant(script: HB9VoiceScript) {
    setVoiceEvent({ script, id: Date.now() });
  }

  function openPackagesScreen() {
    playAssistant("buy");
    setActiveTab("packages");
  }

  useEffect(() => {
    setSourceReferralCode(captureHbReferralFromUrl());
    if (devDashboardActive) {
      setError("");
      setUser(createHbDevDashboardUser(getHbDevWallet()));
      setProducts(hbDevDashboardProducts);
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
        balances: { deposit: "0", income: "0" },
        pendingWithdrawals: { total: "0", count: 0 },
        verifiedDeposits: { total: "0", count: 0 },
        pendingDeposits: { total: "0", count: 0 }
      });
      setCurrentPackage("None");
      setLoading(false);
      return;
    }
    fetchHbProducts()
      .then((data) => setProducts(data.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Products could not be loaded."));
    const stored = getHbToken();
    if (stored) {
      setToken(stored);
      refresh(stored, true);
    } else {
      setLoading(false);
    }
  }, []);

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
    if (initial) setLoading(true);
    setRefreshing(true);
    setError("");
    try {
      const [me, productData, wallet, purchaseData, orderData, incomeData, referralData, activityData, coinData, config] = await Promise.all([
        fetchHbMe(activeToken),
        fetchHbProducts(),
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
      setProducts(productData.items);
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
      setReferralSummary(referralData);
      setWalletActivity(activityData.items);
      setMyProducts(deliveryData);
      setCoins(coinData.items);
      setOnchainConfig(config);
      setWalletData({
        depositAddress: wallet.depositAddress,
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
    if (devDashboardActive) {
      setUser(createHbDevDashboardUser(getHbDevWallet() || nextUser.wallet_address || nextUser.usdt_bep20_address || ""));
      setNotice("");
      setLoading(false);
      return;
    }
    saveHbToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setNotice("Login successful.");
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
    if (devDashboardActive) return;
    if (!token) {
      setError("Login required to deposit.");
      return;
    }
    if (amountUsd + Number.EPSILON < 4) {
      setError("");
      setNotice("Minimum deposit is $4");
      return;
    }
    const config = onchainConfig || await fetchHbOnchainPackageConfig(token);
    setOnchainConfig(config);
    const receiveAddress = walletData.depositAddress;
    const usdtAddress = config.usdtBep20Address;
    if (!/^0x[a-fA-F0-9]{40}$/.test(receiveAddress || "")) {
      setError("Company receiving wallet is not configured for this network.");
      return;
    }
    if (!usdtAddress || !/^0x[a-fA-F0-9]{40}$/.test(usdtAddress)) {
      setError("USDT BEP20 contract is not configured.");
      return;
    }
    const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setError("External wallet not found. Open HB9 in a BSC wallet browser.");
      return;
    }
    setWalletActionBusy("deposit");
    setError("");
    setNotice("");
    try {
      const provider = new BrowserProvider(ethereum);
      await ethereum.request({ method: "eth_requestAccounts" });
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== Number(config.chainId)) {
        await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${Number(config.chainId).toString(16)}` }] });
      }
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      if (boundWallet && boundWallet.toLowerCase() !== signerAddress.toLowerCase()) {
        setError("Connected wallet does not match this HB9 ID.");
        return;
      }
      const tx = await new Contract(usdtAddress, ERC20_ABI, signer).transfer(receiveAddress, parseUnits(amountUsd.toFixed(8), 18));
      setNotice("Deposit transaction submitted. Waiting for confirmation...");
      await tx.wait();
      await createHbDeposit(token, {
        amountUsd,
        txHash: tx.hash,
        walletAddress: receiveAddress,
        chainId: 56,
        tokenAddress: usdtAddress,
        idempotencyKey: `hb-ui-deposit-${Date.now()}-${crypto.randomUUID()}`
      });
      setNotice("Deposit submitted for blockchain verification.");
      await refresh(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed.");
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

  async function handleFollowersRequest(input: { packagePurchaseId: string; platform: "Instagram" | "Facebook" | "Telegram"; submittedLink: string }) {
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
    playAssistant("buy");
    if (devDashboardActive) {
      setNotice("");
      return;
    }
    if (!token || !user) {
      setError("Login is required before buying a package.");
      return;
    }
    setError("");
    setNotice("");
    const config = onchainConfig || await fetchHbOnchainPackageConfig(token);
    setOnchainConfig(config);
    if (config.mode !== "onchain" && config.mode !== "hybrid") {
      setPurchaseReview({
        product,
        config,
        packageConfig: config.packages.find((item) => item.id === product.package_id || Number(item.amount_usd) === Number(product.package_price)) || config.packages[0],
        buyerAddress: boundWallet,
        sponsorRef: user.sponsor_referral_code || user.source_referral_code || "",
        stage: "review"
      });
      return;
    }
    const packageConfig = config.packages.find((item) => item.id === product.package_id || Number(item.amount_usd) === Number(product.package_price));
    if (!packageConfig?.onchainPackageId || !config.packageManagerAddress || !config.usdtBep20Address) {
      setError("This package is not mapped to an on-chain package contract yet.");
      return;
    }
    const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setError("External wallet not found. Open HB9 in MetaMask, Trust Wallet, TokenPocket, or another BSC wallet browser.");
      return;
    }
    const browserProvider = new BrowserProvider(ethereum);
    await ethereum.request({ method: "eth_requestAccounts" });
    const network = await browserProvider.getNetwork();
    if (Number(network.chainId) !== Number(config.chainId)) {
      await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${Number(config.chainId).toString(16)}` }] });
    }
    const signer = await browserProvider.getSigner();
    const buyerAddress = await signer.getAddress();
    const expectedWallet = user.usdt_bep20_address || user.bitzenx_wallet_address || user.wallet_address || "";
    if (expectedWallet && expectedWallet.toLowerCase() !== buyerAddress.toLowerCase()) {
      setError("Connected wallet does not match this HB9 ID.");
      return;
    }
    setPurchaseReview({
      product,
      config,
      packageConfig,
      buyerAddress,
      sponsorRef: user.sponsor_referral_code || user.source_referral_code || "",
      stage: "review"
    });
  }

  async function confirmBuy() {
    if (!token || !purchaseReview) return;
    const { product, config, packageConfig, buyerAddress, sponsorRef } = purchaseReview;
    const onchainPackageId = packageConfig.onchainPackageId;
    if (config.mode !== "onchain" && config.mode !== "hybrid") {
      setPurchaseReview((current) => current ? { ...current, stage: "pending" } : current);
      await buyHbProduct(token, product.id);
      await refresh(token);
      setPurchaseReview((current) => current ? { ...current, stage: "activated" } : current);
      setNotice("Product purchased. Activation updated from HB9 system.");
      playAssistant("activationSuccess");
      return;
    }
    if (!config.packageManagerAddress || !config.usdtBep20Address || onchainPackageId === null || onchainPackageId === undefined) {
      setError("Contract not configured yet.");
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
      setError("External wallet not found.");
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
      <main className="min-h-screen bg-[#020817] text-white">
        <div className="mx-auto w-full max-w-[430px] px-3 py-3">
          <HbLandingPage referralCode={sourceReferralCode || getStoredHbReferral()} onAuthenticated={handleAuthenticated} />
          {error ? <ErrorState message={error} /> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <div className="fixed inset-0 -z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,200,255,0.18),transparent_18rem),radial-gradient(circle_at_90%_22%,rgba(0,123,255,0.14),transparent_18rem),linear-gradient(180deg,#020817_0%,#03111f_46%,#020817_100%)]" />
      <div className="fixed inset-0 -z-0 opacity-35 [background-image:linear-gradient(rgba(125,211,252,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.035)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <span className="absolute left-[12%] top-[13%] h-1 w-1 rounded-full bg-cyan-300/45 shadow-[0_0_14px_rgba(0,200,255,0.75)]" />
        <span className="absolute right-[18%] top-[31%] h-1.5 w-1.5 rounded-full bg-blue-300/35 shadow-[0_0_18px_rgba(0,123,255,0.65)]" />
        <span className="absolute bottom-[22%] left-[24%] h-1 w-1 rounded-full bg-cyan-200/35 shadow-[0_0_14px_rgba(0,200,255,0.6)]" />
        <span className="hb-dashboard-particle left-[28%] top-[42%]" />
        <span className="hb-dashboard-particle right-[12%] top-[58%] [animation-delay:1.2s]" />
        <span className="hb-dashboard-particle bottom-[15%] right-[34%] [animation-delay:2.1s]" />
        <span className="hb-dashboard-streak left-[-20%] top-[18%]" />
        <span className="hb-dashboard-streak right-[-30%] top-[64%] [animation-delay:1.8s]" />
      </div>

      <div className="relative z-10 mx-auto min-h-screen w-full max-w-[430px] px-3.5 pb-[140px] pt-3">
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
        {error && !devDashboardActive ? <ErrorState message={error} /> : null}
        {loading ? <DashboardSkeleton /> : null}

        {!loading && activeTab === "home" ? <HomeScreen walletBalance={totalBalance} balances={walletData.balances} user={dashboardUser} boundWallet={boundWallet} currentPackage={currentPackage} products={devDashboardActive ? completePackageProducts : orderedProducts.length > 0 ? orderedProducts : completePackageProducts} coins={coins} convertingCoin={convertingCoin} onConvert={convertCoin} onTab={setActiveTab} onBuy={openBuyFlow} /> : null}
        {!loading && activeTab === "products" ? <MyProductsScreen purchases={purchases} orders={orders} delivery={myProducts} packages={completePackageProducts} onBuy={openPackagesScreen} onPackageBuy={openBuyFlow} onBookDownload={handleBookDownload} onFollowersRequest={handleFollowersRequest} onCustomSoftwareRequest={handleCustomSoftwareRequest} /> : null}
        {!loading && activeTab === "packages" ? <AllPackagesScreen products={completePackageProducts} onBuy={openBuyFlow} onBack={() => setActiveTab("home")} /> : null}
        {!loading && activeTab === "team" ? <TeamScreen user={dashboardUser} summary={referralSummary} /> : null}
        {!loading && activeTab === "income" ? <IncomeScreen income={income} singleLegReserve={singleLegReserve} singleLegProgress={singleLegProgress} summary={incomeSummary} availableBalance={walletData.balances.income} totalWithdrawn={withdrawals.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amount_usd || 0), 0)} /> : null}
        {!loading && activeTab === "wallet" ? <WalletScreen walletBalance={totalBalance} balances={walletData.balances} withdrawals={withdrawals} activity={walletActivity} boundWallet={boundWallet} depositAddress={walletData.depositAddress} coins={coins} convertingCoin={convertingCoin} walletActionBusy={walletActionBusy} onConvert={convertCoin} onDeposit={submitDeposit} onWithdraw={submitWithdrawal} /> : null}
      </div>

      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
      <HB9VoiceAssistant activeTab={activeTab} hasActiveProduct={hasActiveProduct} loading={loading} event={voiceEvent} />
      {purchaseReview ? <BuyDialog purchase={purchaseReview} onCancel={() => setPurchaseReview(null)} onConfirm={() => confirmBuy().catch((err) => {
        setError(err instanceof Error ? err.message : "Package purchase failed.");
        setPurchaseReview((current) => current ? { ...current, stage: "review" } : current);
      })} /> : null}
    </main>
  );
}

function HomeScreen({ walletBalance, balances, user, boundWallet, currentPackage, products, coins, convertingCoin, onConvert, onTab, onBuy }: { walletBalance: number; balances: { deposit: string; income: string }; user: HbUser; boundWallet: string; currentPackage: string; products: HbProduct[]; coins: HbCoinBalance[]; convertingCoin: string; onConvert: (coinSymbol: string, usdValue?: number) => void; onTab: (tab: TabId) => void; onBuy: (product: HbProduct) => void }) {
  const quickButtons = [
    { label: "Deposit", icon: Plus, action: () => onTab("wallet") },
    { label: "Withdraw", icon: ArrowDownToLine, action: () => onTab("wallet") },
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
        {featuredProducts.length === 0 ? <div className="col-span-3"><EmptyState title="No active packages available." /></div> : featuredProducts.map((product) => <ProductCard key={product.id} product={product} cta="Buy Now" onBuy={() => onBuy(product)} compact />)}
      </div>
    </div>
  );
}

function MyProductsScreen({ purchases, orders, delivery, packages, onBuy, onPackageBuy, onBookDownload, onFollowersRequest, onCustomSoftwareRequest }: { purchases: HbPurchase[]; orders: HbOrder[]; delivery: HbMyProductsDelivery | null; packages: HbProduct[]; onBuy: () => void; onPackageBuy: (product: HbProduct) => void; onBookDownload: (bookId: string) => void; onFollowersRequest: (input: { packagePurchaseId: string; platform: "Instagram" | "Facebook" | "Telegram"; submittedLink: string }) => void; onCustomSoftwareRequest: (input: { packagePurchaseId?: string; softwareType: string; architecture: "centralized" | "decentralized"; requirementsNote: string }) => void }) {
  const [tab, setTab] = useState<"active" | "books" | "requests">("active");
  const [requestProductId, setRequestProductId] = useState("");
  const [platform, setPlatform] = useState<"Instagram" | "Facebook" | "Telegram">("Instagram");
  const [submittedLink, setSubmittedLink] = useState("");
  const [softwareType, setSoftwareType] = useState("");
  const [architecture, setArchitecture] = useState<"centralized" | "decentralized">("centralized");
  const [requirementsNote, setRequirementsNote] = useState("");
  const productRows = delivery?.activeProducts?.length ? delivery.activeProducts.map((item) => ({
    id: item.package_purchase_id,
    packageId: item.package_id,
    title: item.package_name,
    price: item.package_price,
    status: item.status,
    date: item.activation_date,
    imageAmount: item.package_price,
    followersCount: Number(item.followers_count || 0),
    bookLimit: Number(item.book_limit || 0)
  })) : purchases.map((purchase) => ({
    id: purchase.id,
    packageId: "",
    title: purchase.package_name,
    price: purchase.amount_usd,
    status: purchase.status,
    date: purchase.created_at,
    imageAmount: purchase.amount_usd,
    followersCount: 0,
    bookLimit: 0
  })).concat(orders.map((order) => ({
    id: order.id,
    packageId: "",
    title: order.product_title,
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
  const followersProduct = productRows.find((item) => item.followersCount > 0);
  const selectedFollowerProduct = productRows.find((item) => item.id === requestProductId) || followersProduct;
  return (
    <div className="space-y-3">
      <HeroPanel title="My Product" subtitle={`${productRows.length} active products`} icon={PackageCheck} art="package" />
      <SegmentedTabs tabs={[["active", "Active"], ["books", "Books"], ["requests", "Requests"]]} active={tab} onChange={(next) => setTab(next as typeof tab)} />
      {!hasPurchases ? <EmptyState title="No purchased product yet." action={<PrimaryAction onClick={onBuy}>Buy Package</PrimaryAction>} /> : null}
      {tab === "active" ? productRows.map((item) => (
        <GlassCard key={item.id} className="p-3">
          <div className="flex gap-3">
            <PackageVisual amount={item.imageAmount} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 font-semibold">{item.title}</h3>
                <span className="rounded-full border border-cyan-200/18 bg-cyan-300/10 px-2 py-1 text-[10px] font-bold capitalize text-cyan-100">{item.status}</span>
              </div>
              <p className="mt-1 text-xs text-sky-100/55">Activated {new Date(item.date).toLocaleDateString()}</p>
              <p className="mt-2 text-xl font-black text-cyan-100">{money(item.price)}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-1.5 text-xs text-sky-100/68">
            {featuresForAmount(item.imageAmount).slice(0, 3).map((feature) => <FeatureBullet key={feature}>{feature}</FeatureBullet>)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="hb-interactive hb-glow-cyan flex items-center justify-center gap-2 rounded-[1rem] bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-500 px-3 py-3 text-sm font-black text-[#03111f] shadow-[0_0_20px_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-200" onClick={() => setTab("books")} type="button"><Download size={16} /> Download Books</button>
            <button className="hb-interactive hb-glow-purple flex items-center justify-center gap-2 rounded-[1rem] border border-cyan-200/18 bg-cyan-300/10 px-3 py-3 text-sm font-bold text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-200 disabled:opacity-45" disabled={item.followersCount <= 0} onClick={() => { setRequestProductId(item.id); setTab("requests"); }} type="button"><Eye size={16} /> Followers Request</button>
          </div>
        </GlassCard>
      )) : null}
      {tab === "books" ? (
        <GlassCard className="p-3">
          <SectionTitle title="Books" action={`${delivery?.booksUnlocked || unlockedBooks.length} / 100 unlocked`} />
          <div className="mt-3 grid gap-2">
            {books.map((book) => (
              <div key={book.id} className="hb-interactive hb-glow-cyan flex items-center gap-3 rounded-2xl border border-cyan-200/10 bg-[#071b34]/72 p-2.5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-100"><Download size={17} /></div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{book.title}</div><div className="truncate text-xs text-sky-100/52">{book.category}{book.downloaded_at ? " - downloaded" : ""}</div></div>
                <button className="rounded-xl bg-cyan-300 px-3 py-2 text-[10px] font-black text-[#031326] disabled:bg-slate-500 disabled:text-slate-200" disabled={!book.unlocked} onClick={() => onBookDownload(book.id)} type="button">{book.unlocked ? "Download" : "Locked"}</button>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : null}
      {tab === "requests" ? (
        <div className="space-y-3">
          <GlassCard className="p-3">
            <SectionTitle title="Followers Request" action={selectedFollowerProduct?.followersCount ? `${selectedFollowerProduct.followersCount} followers` : "Locked"} />
            <div className="mt-3 grid gap-2">
              <select className="field" value={requestProductId || selectedFollowerProduct?.id || ""} onChange={(event) => setRequestProductId(event.target.value)}>
                {productRows.filter((item) => item.followersCount > 0).map((item) => <option key={item.id} value={item.id}>{item.title} - {item.followersCount} followers</option>)}
              </select>
              <select className="field" value={platform} onChange={(event) => setPlatform(event.target.value as typeof platform)}><option>Instagram</option><option>Facebook</option><option>Telegram</option></select>
              <input className="field" placeholder="Profile/page/channel/group link" value={submittedLink} onChange={(event) => setSubmittedLink(event.target.value)} />
              <button className="hb-interactive hb-glow-cyan rounded-2xl bg-cyan-300 px-4 py-3 font-black text-[#031326] disabled:opacity-45" disabled={!selectedFollowerProduct || !submittedLink.trim()} onClick={() => selectedFollowerProduct ? onFollowersRequest({ packagePurchaseId: selectedFollowerProduct.id, platform, submittedLink }) : undefined} type="button">Send Request</button>
            </div>
          </GlassCard>
          <GlassCard className="p-3"><SectionTitle title="Request Status" /><div className="mt-2 space-y-2">{delivery?.followersRequests?.length ? delivery.followersRequests.map((item) => <HistoryRow key={item.id} title={`${item.platform} - ${item.status}`} meta={`${item.followers_count} followers - ${new Date(item.created_at).toLocaleString()}${item.admin_note ? ` - ${item.admin_note}` : ""}`} value={item.package_name || "Package"} />) : <EmptyState title="No followers requests yet." />}</div></GlassCard>
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
      <AllPackagesList products={packages} onBuy={onPackageBuy} />
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

function TeamScreen({ user, summary }: { user: HbUser; summary: HbReferralSummary | null }) {
  const referralUrl = typeof window === "undefined" ? user.referral_code : `${window.location.origin}/halal-business?ref=${user.referral_code}`;
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
      <GlassCard className="hb-glow-purple p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/60">Referral Link</p><div className="mt-2 break-all rounded-xl border border-cyan-200/10 bg-[#061a31]/75 p-2.5 font-mono text-[11px] text-sky-100/80">{referralUrl}</div><button className="hb-interactive hb-glow-cyan mt-2 flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-bold text-cyan-100" onClick={() => navigator.clipboard?.writeText(referralUrl)} type="button"><Copy size={14} /> Copy Referral Link</button></GlassCard>
      <GlassCard className="hb-glow-teal p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/60">Sponsor Wallet</p><div className="mt-2 flex items-center gap-2.5"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300/12 text-cyan-100"><Users size={17} /></div><div className="min-w-0 flex-1"><div className="truncate font-mono text-xs font-semibold">{sponsorWallet}</div><div className="text-[11px] text-sky-100/55">{summary?.sponsor?.display_name || "Root account"}</div></div><button className="hb-interactive hb-glow-teal grid h-8 w-8 place-items-center rounded-xl text-cyan-100" onClick={() => navigator.clipboard?.writeText(sponsorWallet)} type="button" aria-label="Copy sponsor wallet"><Copy size={15} /></button></div></GlassCard>
    </div>
  );
}

function IncomeScreen({ income, singleLegReserve, singleLegProgress, summary, availableBalance, totalWithdrawn }: { income: HbIncome[]; singleLegReserve: HbSingleLegReserve[]; singleLegProgress: HbSingleLegProgress | null; summary: { direct_income: string; level_income: string; single_leg_income: string; single_leg_reserve: string; salaryIncome: string }; availableBalance: string; totalWithdrawn: number }) {
  const totalIncome = Number(summary.direct_income || 0) + Number(summary.level_income || 0) + Number(summary.single_leg_income || 0) + Number(summary.single_leg_reserve || 0) + Number(summary.salaryIncome || 0);
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

function WalletScreen({ walletBalance, balances, withdrawals, activity, boundWallet, depositAddress, coins, convertingCoin, walletActionBusy, onConvert, onDeposit, onWithdraw }: { walletBalance: number; balances: { deposit: string; income: string }; withdrawals: HbWithdrawal[]; activity: HbWalletActivity[]; boundWallet: string; depositAddress: string; coins: HbCoinBalance[]; convertingCoin: string; walletActionBusy: string; onConvert: (coinSymbol: string, usdValue?: number) => void; onDeposit: (amountUsd: number) => Promise<void>; onWithdraw: (amountUsd: number, walletAddress: string) => Promise<void> }) {
  const [walletModal, setWalletModal] = useState<"deposit" | "withdraw" | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawWallet, setWithdrawWallet] = useState(boundWallet || "");
  const depositValue = Number(depositAmount || 0);
  const withdrawValue = Number(withdrawAmount || 0);
  const withdrawFee = Number((withdrawValue * 0.1).toFixed(8));
  const withdrawNet = Math.max(0, Number((withdrawValue - withdrawFee).toFixed(8)));
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
        <ActionChip label="Deposit" icon={Plus} onClick={() => setWalletModal("deposit")} />
        <ActionChip label="Withdraw" icon={ArrowDownToLine} onClick={() => setWalletModal("withdraw")} />
        <ActionChip label="Ledger" icon={ReceiptText} />
        <ActionChip label="Settings" icon={Settings} />
      </div>
      <div className="grid grid-cols-2 gap-2"><MiniStat label="Main Wallet" value={money(balances.deposit)} /><MiniStat label="Income Wallet" value={money(balances.income)} /></div>
      <MultiCoinWallet coins={coins} withdrawableBalance={balances.deposit} convertingCoin={convertingCoin} onConvert={onConvert} />
      <GlassCard className="p-3"><SectionTitle title="Withdrawal History" /><div className="mt-2 space-y-2">{withdrawals.length ? withdrawals.map((item) => <WithdrawalHistoryRow key={item.id} item={item} />) : <EmptyState title="No withdrawal history yet." />}</div></GlassCard>
      <GlassCard className="p-3"><SectionTitle title="Ledger" /><div className="mt-2 space-y-2">{activity.length ? activity.map((item) => <HistoryRow key={item.id} title={item.type.replace(/_/g, " ")} meta={`${item.direction} - ${new Date(item.created_at).toLocaleString()}`} value={money(item.amount_usd)} />) : <EmptyState title="No ledger activity yet." />}</div></GlassCard>
      {walletModal === "deposit" ? (
        <WalletActionModal title="Deposit USDT BEP20 on BSC Mainnet" onClose={() => setWalletModal(null)}>
          <InfoLine label="Minimum deposit" value="$4" />
          <InfoLine label="Network" value="BSC Mainnet" />
          <InfoLine label="Token" value="USDT BEP20" />
          <InfoLine label="Connected wallet" value={shortAddress(boundWallet)} />
          <InfoLine label="Deposit address" value={shortAddress(depositAddress)} />
          <label className="mt-3 block text-xs font-bold text-sky-100/62">Amount</label>
          <input className="mt-1 w-full rounded-2xl border border-cyan-200/12 bg-[#020817] px-3 py-3 text-sm font-bold outline-none focus:border-cyan-300/45" inputMode="decimal" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="4.00" />
          {depositValue > 0 && depositValue < 4 ? <p className="mt-2 text-xs font-semibold text-red-200">Minimum deposit is $4</p> : null}
          <button className="hb-interactive hb-glow-cyan mt-4 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-[#031326] disabled:cursor-not-allowed disabled:opacity-50" disabled={walletActionBusy === "deposit" || depositValue < 4} onClick={async () => { await onDeposit(depositValue); setWalletModal(null); }} type="button">{walletActionBusy === "deposit" ? "Submitting..." : "Submit Deposit"}</button>
        </WalletActionModal>
      ) : null}
      {walletModal === "withdraw" ? (
        <WalletActionModal title="Withdraw USDT BEP20" onClose={() => setWalletModal(null)}>
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

function WalletActionModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-3 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-[24px] border border-cyan-200/14 bg-[#061426] p-4 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black">{title}</h3>
          <button className="rounded-xl border border-cyan-200/12 px-3 py-2 text-xs font-black text-cyan-100" onClick={onClose} type="button">Close</button>
        </div>
        <div className="mt-3">{children}</div>
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

function ProductCard({ product, cta, onBuy, compact = false }: { product: HbProduct; cta: string; onBuy: () => void; compact?: boolean }) {
  const amount = Number(product.package_price);
  const tierName = packageNames[amount] || product.package_name || product.title;
  return (
    <div className={`hb-interactive hb-glow-gold group relative overflow-hidden rounded-[22px] border border-cyan-200/12 bg-[linear-gradient(155deg,rgba(8,37,68,0.78),rgba(3,14,29,0.92))] shadow-[0_0_16px_rgba(0,200,255,0.09),0_10px_26px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl transition duration-250 hover:-translate-y-0.5 hover:border-cyan-200/18 hover:shadow-[0_0_20px_rgba(0,200,255,0.13),0_14px_32px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.07)] active:scale-[0.99] ${compact ? "p-2.5" : "p-3"}`}>
      <div className="absolute right-[-2.5rem] top-[-2.5rem] h-24 w-24 rounded-full bg-cyan-300/12 blur-2xl" />
      <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/40 to-transparent" />
      <div className={compact ? "space-y-3" : "flex gap-3"}>
        <PackageVisual amount={amount} size={compact ? "wide" : "md"} />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-1.5">
              <h3 className={`${compact ? "min-h-8 text-[11.5px] leading-4" : "text-sm leading-4"} line-clamp-2 font-black tracking-normal text-white`}>{money(amount)} {tierName.replace(/ Package$/, "")}</h3>
              <ShieldCheck className="mt-0.5 shrink-0 text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.55)]" size={14} />
            </div>
            <p className={`${compact ? "min-h-[28px]" : ""} mt-1 line-clamp-2 text-[10px] font-medium leading-[14px] text-sky-100/62`}>{packageShortText[amount] || packageBenefits[amount] || product.short_description || product.package_name}</p>
          </div>
          <div className="mt-2 flex items-center justify-center">
            <button className="hb-interactive hb-glow-gold w-full rounded-[0.85rem] bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-500 px-2.5 py-1.5 text-[10px] font-black text-[#03111f] shadow-[0_0_16px_rgba(34,211,238,0.24),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-200 hover:shadow-[0_0_22px_rgba(34,211,238,0.34)] active:scale-95" onClick={onBuy} disabled={product.stock <= 0} type="button">{product.stock <= 0 ? "Out" : cta}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function featuresForAmount(amount: unknown) {
  return (packageBenefits[Number(amount)] || "Digital product package + Premium HB9 access + Dashboard tools").split("+").map((item) => item.trim()).filter(Boolean);
}

const walletCoinList = [
  { key: "USDT", label: "USDT BEP20", network: "" },
  { key: "BTC", label: "BTC", network: "BITCOIN" },
  { key: "BNB", label: "BNB", network: "BINANCE COIN" },
  { key: "HB9", label: "HB9", network: "HB9 COIN" },
  { key: "PEPE", label: "PEPE", network: "Pepe coin" },
  { key: "DOGE", label: "DOGE", network: "Dogecoin" },
  { key: "SHIB", label: "SHIBA", network: "Shiba Inu" },
  { key: "BTTC", label: "BTTC", network: "BitTorrent Chain" },
  { key: "ADA", label: "ADA", network: "Cardano" }
] as const;

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
    if (symbol === "USDT") return Number(withdrawableBalance || 0);
    if (symbol === "HB9") return Number((Number(item?.balance || 0) * HB9_COIN_PRICE_USD).toFixed(8));
    return Number(item?.usd_value || 0);
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-3 pb-3 backdrop-blur-sm">
          <div className="w-full max-w-[430px] rounded-[1.6rem] border border-cyan-200/15 bg-[#071827]/95 p-4 shadow-[0_0_40px_rgba(34,211,238,0.18)] backdrop-blur-2xl">
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

function PackageListItem({ product, onBuy }: { product: HbProduct; onBuy: () => void }) {
  const amount = Number(product.package_price);
  const title = `${money(amount)} ${packageNames[amount] || product.package_name || product.title}`;
  return (
    <div className="hb-interactive hb-glow-gold flex w-full items-center gap-2.5 rounded-[22px] border border-cyan-200/14 bg-[linear-gradient(145deg,rgba(8,34,64,0.8),rgba(3,14,29,0.93))] p-2.5 text-left shadow-[0_0_18px_rgba(0,200,255,0.09),0_12px_26px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/22 hover:shadow-[0_0_22px_rgba(0,200,255,0.14)]">
      <PackageVisual amount={amount} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate font-semibold">{title}</h3>
          <span className="shrink-0 text-lg font-black text-cyan-100"><Sparkles size={16} /></span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-sky-100/58">{packageShortText[amount] || featuresForAmount(amount).join(" + ")}</p>
        <button className="hb-interactive hb-glow-gold mt-2 rounded-[0.9rem] bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-500 px-3 py-1.5 text-[11px] font-black text-[#03111f] shadow-[0_0_16px_rgba(34,211,238,0.22),inset_0_1px_0_rgba(255,255,255,0.34)] transition duration-200 active:scale-95" onClick={onBuy} disabled={product.stock <= 0} type="button">{product.stock <= 0 ? "Out" : "Buy with USDT"}</button>
      </div>
      <button className="hb-interactive hb-glow-cyan grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-200/10 bg-cyan-300/8 text-cyan-100/70" onClick={onBuy} type="button" aria-label={`Open ${title}`}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function AllPackagesList({ products, onBuy }: { products: HbProduct[]; onBuy: (product: HbProduct) => void }) {
  return (
    <div className="space-y-2.5">
      {products.map((product) => <PackageListItem key={product.id} product={product} onBuy={() => onBuy(product)} />)}
    </div>
  );
}

function AllPackagesScreen({ products, onBuy, onBack }: { products: HbProduct[]; onBuy: (product: HbProduct) => void; onBack: () => void }) {
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
      <AllPackagesList products={products} onBuy={onBuy} />
    </div>
  );
}

function PackageVisual({ amount: rawAmount, size }: { amount: unknown; size: "sm" | "md" | "wide" }) {
  const amount = Number(rawAmount);
  const visual = packageVisuals[amount] || packageVisuals[4];
  const isWide = size === "wide";
  const frameClass = size === "sm" ? "h-12 w-12 rounded-xl" : isWide ? "h-20 w-full rounded-[1rem]" : "h-20 w-20 rounded-[1rem]";
  return (
    <div className={`relative grid shrink-0 place-items-center overflow-hidden border border-cyan-200/12 bg-[#061a31]/88 shadow-[0_0_16px_rgba(0,200,255,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] ${frameClass}`}>
      <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div className="absolute inset-0 opacity-95" style={{ background: `radial-gradient(circle at 52% 34%, ${visual.accent}4d, transparent 42%), radial-gradient(circle at 50% 12%, ${visual.accent}36, transparent 54%), radial-gradient(circle at 90% 80%, ${visual.mid}24, transparent 40%), linear-gradient(145deg, ${visual.to}, #020817)` }} />
      <svg className="relative z-10 h-[108%] w-[108%] drop-shadow-[0_12px_20px_rgba(0,0,0,0.38)]" viewBox="0 0 140 110" fill="none" aria-hidden="true" shapeRendering="geometricPrecision">
        <defs>
          <linearGradient id={`pkg-cover-${amount}`} x1="20" y1="18" x2="84" y2="92" gradientUnits="userSpaceOnUse"><stop stopColor={visual.from} /><stop offset=".5" stopColor={visual.mid} /><stop offset="1" stopColor={visual.to} /></linearGradient>
          <linearGradient id={`pkg-glass-${amount}`} x1="66" y1="10" x2="122" y2="78" gradientUnits="userSpaceOnUse"><stop stopColor="#ffffff" stopOpacity=".48" /><stop offset=".35" stopColor={visual.accent} stopOpacity=".16" /><stop offset="1" stopColor="#020817" stopOpacity=".18" /></linearGradient>
          <radialGradient id={`pkg-glow-${amount}`} cx="0" cy="0" r="1" gradientTransform="matrix(48 42 -42 48 78 30)" gradientUnits="userSpaceOnUse"><stop stopColor={visual.accent} stopOpacity=".72" /><stop offset=".46" stopColor={visual.mid} stopOpacity=".22" /><stop offset="1" stopColor={visual.to} stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse cx="70" cy="95" rx="54" ry="8" fill={visual.mid} opacity=".2" />
        <circle cx="104" cy="22" r="22" fill={`url(#pkg-glow-${amount})`} opacity=".78" />
        <path d="M12 20h18M110 18h16M11 86h18M113 88h15" stroke={visual.accent} strokeOpacity=".36" strokeWidth="1.35" strokeLinecap="round" />
        <circle cx="16" cy="36" r="1.6" fill={visual.accent} opacity=".85" />
        <circle cx="123" cy="68" r="1.5" fill={visual.accent} opacity=".62" />
        <PackageBundleScene scene={visual.scene} amount={amount} visual={visual} />
      </svg>
    </div>
  );
}

function PackageBundleScene({ scene, amount, visual }: { scene: "starter" | "growth" | "popular" | "automation" | "ai" | "enterprise"; amount: number; visual: { from: string; mid: string; to: string; accent: string; label: string } }) {
  const bookCount = scene === "starter" ? 4 : scene === "growth" ? 5 : scene === "popular" ? 7 : scene === "enterprise" ? 4 : 3;
  const isSoftware = amount >= 500;
  const tag = scene === "automation" ? "CHAT" : scene === "ai" ? "AI" : scene === "enterprise" ? "VAULT" : "EBOOK";
  return (
    <g>
      <g opacity=".38">
        <path d="M25 78c18-16 49-16 68 0M35 68c11-8 31-8 42 0" stroke={visual.accent} strokeWidth="1.1" strokeLinecap="round" />
        <path d="M94 37h18l8 7v25H94V37Z" fill="#020817" stroke={visual.accent} strokeOpacity=".22" />
      </g>
      <ellipse cx="54" cy="91" rx="34" ry="6" fill="#020817" opacity=".42" />
      {Array.from({ length: bookCount }).map((_, index) => (
        <g key={index} transform={`translate(${22 + index * 6.4} ${48 - index * 2.7}) rotate(-7)`}>
          <path d="M3 46h21l-6 6H8L3 46Z" fill="#020817" fillOpacity=".36" />
          <path d="M0 0h18l6 5v43H6L0 43V0Z" fill={`url(#pkg-cover-${amount})`} stroke="#fff" strokeOpacity=".32" strokeWidth=".85" />
          <path d="M18 0v43l6 5V5L18 0Z" fill="#020817" fillOpacity=".48" />
          <path d="M0 0 6 5h18L18 0H0Z" fill="#fff" fillOpacity=".26" />
          <path d="M2 2h4v41H2V2Z" fill="#fff" fillOpacity=".12" />
          <rect x="4" y="8" width="11" height="2.2" rx="1.1" fill="#fff" opacity=".72" />
          <rect x="4" y="14" width="8" height="1.8" rx=".9" fill="#fff" opacity=".38" />
          <rect x="4" y="31" width="10" height="7" rx="1.5" fill="#020817" fillOpacity=".28" stroke="#fff" strokeOpacity=".18" />
          <path d="M4 24h11" stroke={visual.accent} strokeOpacity=".42" strokeWidth=".9" strokeLinecap="round" />
        </g>
      ))}

      <g transform="translate(78 24)">
        <path d="M7 51h38l-11 8H18L7 51Z" fill="#020817" fillOpacity=".34" />
        <path d="M0 0h33l12 9v45H12L0 45V0Z" fill={isSoftware ? "#031326" : `url(#pkg-cover-${amount})`} stroke={visual.accent} strokeOpacity=".55" strokeWidth="1.2" />
        <path d="M33 0v45l12 9V9L33 0Z" fill={visual.mid} fillOpacity={isSoftware ? ".34" : ".55"} />
        <path d="M0 0 12 9h33L33 0H0Z" fill={`url(#pkg-glass-${amount})`} />
        <path d="M4 4h5v41H4V4Z" fill="#fff" fillOpacity=".1" />
        <rect x="7" y="10" width="22" height="3" rx="1.5" fill="#fff" opacity=".78" />
        <rect x="7" y="17" width="16" height="2.4" rx="1.2" fill="#fff" opacity=".36" />
        <rect x="7" y="27" width="25" height="12" rx="2.5" fill="#020817" fillOpacity=".48" stroke={visual.accent} strokeOpacity=".35" />
        <path d="M10 35h6l4-5 5 4h5" stroke={visual.accent} strokeOpacity=".72" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
        <text x="9" y="50" fill="#fff" fontSize="7" fontWeight="900" letterSpacing=".6">{tag}</text>
      </g>

      <g transform="translate(83 14)" opacity=".96">
        <rect width="42" height="25" rx="4" fill="#020817" fillOpacity=".68" stroke={visual.accent} strokeOpacity=".55" />
        {scene === "starter" ? <g><circle cx="12" cy="12" r="5" fill={visual.accent} opacity=".55" /><path d="M6 22c3-6 9-6 12 0M22 8h12M22 14h8M22 20h13" stroke="#BAF2FF" strokeWidth="1.5" strokeLinecap="round" /></g> : null}
        {scene === "growth" ? <g><path d="M7 19 16 10l8 5 11-10" stroke="#D8B4FE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 22h28" stroke="#fff" strokeOpacity=".28" strokeWidth="1" /></g> : null}
        {scene === "popular" ? <g><path d="M21 5 25 13l9 1-7 5 2 9-8-5-8 5 2-9-7-5 9-1 4-8Z" fill="#FDE68A" /><path d="M5 21h8M30 21h7" stroke="#fff" strokeOpacity=".45" strokeWidth="1.4" strokeLinecap="round" /></g> : null}
        {scene === "automation" ? <g><path d="M8 17c4-9 13-10 17-3 3 5 6 6 10 1" stroke="#86EFAC" strokeWidth="2" strokeLinecap="round" /><circle cx="11" cy="9" r="3" fill="#86EFAC" opacity=".75" /><path d="M17 8h17" stroke="#fff" strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round" /></g> : null}
        {scene === "ai" ? <g><path d="M12 19v-8h18v8M16 11V8h10v3M16 16h.1M26 16h.1M20 21h4" stroke="#E0F2FE" strokeWidth="1.7" strokeLinecap="round" /><circle cx="34" cy="7" r="3" fill="#C4B5FD" opacity=".7" /></g> : null}
        {scene === "enterprise" ? <g><path d="M9 20h24M12 16h18M15 12h12M18 8h6" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" /><rect x="6" y="6" width="30" height="17" rx="3" stroke="#FDE68A" strokeOpacity=".38" /></g> : null}
      </g>
      <g opacity=".58">
        <path d="M104 49h16l7 6v24h-23V49Z" fill="#020817" stroke={visual.accent} strokeOpacity=".34" />
        <path d="M120 49v24l7 6V55l-7-6Z" fill={visual.mid} fillOpacity=".22" />
        <path d="M108 58h9M108 64h13M108 70h8" stroke={visual.accent} strokeOpacity=".58" strokeWidth="1.05" strokeLinecap="round" />
      </g>

      <g transform="translate(20 82)">
        <rect width="58" height="12" rx="6" fill="#020817" fillOpacity=".58" stroke={visual.accent} strokeOpacity=".32" />
        <text x="8" y="8.8" fill="#fff" fontSize="7.5" fontWeight="900" letterSpacing=".4">{visual.label}</text>
        <text x="28" y="8.8" fill={visual.accent} fontSize="6.5" fontWeight="800" opacity=".95">{isSoftware ? "SOFTWARE KIT" : "DIGITAL BUNDLE"}</text>
      </g>
    </g>
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
        <PackageVisual amount={100} size="md" />
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
    <div className="grid grid-cols-2 gap-1 rounded-[1.1rem] border border-cyan-200/10 bg-[#061a31]/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {tabs.map(([id, label]) => <button key={id} className={`hb-interactive hb-glow-cyan min-h-9 rounded-xl px-2 text-[11px] font-black transition ${active === id ? "hb-interactive-active bg-cyan-300 text-[#031326] shadow-[0_0_12px_rgba(34,211,238,0.2)]" : "text-sky-100/62"}`} onClick={() => onChange(id)} type="button">{label}</button>)}
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

function BuyDialog({ purchase, onCancel, onConfirm }: { purchase: PurchaseReview; onCancel: () => void; onConfirm: () => void }) {
  const busy = purchase.stage === "approving" || purchase.stage === "submitting";
  const stageText = purchase.stage === "approving" ? "Confirm USDT approval in your wallet." : purchase.stage === "submitting" ? "Confirm package purchase transaction." : purchase.stage === "pending" ? "Tx pending. Activation updates after indexed event." : purchase.stage === "activated" ? "Activation completed." : "Review package before confirming.";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-3 pb-3 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-[1.6rem] border border-cyan-200/15 bg-[#071827]/95 p-4 shadow-[0_0_40px_rgba(34,211,238,0.18)] backdrop-blur-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Buy with USDT</p><h2 className="mt-2 text-2xl font-semibold">Confirm Purchase</h2><p className="mt-2 text-sm leading-6 text-sky-100/62">{stageText}</p>
        {busy ? <div className="my-4 h-2 overflow-hidden rounded-full bg-cyan-950"><div className="h-full w-2/3 animate-pulse rounded-full bg-cyan-300" /></div> : null}
        <div className="mt-4 space-y-2 text-sm">
          <ReviewRow label="Package" value={purchase.product.package_name || purchase.product.title} />
          <ReviewRow label="Price" value={`${money(purchase.product.package_price)} USDT`} />
          <ReviewRow label="Network" value={chainLabel(purchase.config.chainId)} />
          <ReviewRow label="Wallet" value={purchase.buyerAddress || "External wallet required"} mono />
          {purchase.txHash ? <a className="block break-all rounded-2xl border border-cyan-200/12 bg-cyan-300/10 p-3 font-mono text-xs text-cyan-100" href={txUrl(purchase.config, purchase.txHash)} target="_blank" rel="noreferrer">{purchase.txHash}</a> : null}
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

function HistoryRow({ title, meta, value, positive = false }: { title: string; meta: string; value: string; positive?: boolean }) {
  return <div className="hb-interactive hb-glow-teal flex items-center justify-between gap-3 rounded-2xl border border-cyan-200/10 bg-[#071b34]/72 p-3"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-100"><ReceiptText size={17} /></div><div className="min-w-0"><div className="truncate text-sm font-semibold capitalize">{title}</div><div className="truncate text-xs text-sky-100/52">{meta}</div></div></div><div className={`shrink-0 text-sm font-black ${positive ? "text-emerald-300" : "text-cyan-100"}`}>{value}</div></div>;
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

function ErrorState({ message }: { message: string }) {
  return <div className="mb-4 rounded-2xl border border-red-300/30 bg-red-400/10 p-3 text-sm text-red-100">{message}</div>;
}

function InfoState({ message }: { message: string }) {
  return <div className="mb-4 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm text-cyan-100">{message}</div>;
}

function DashboardSkeleton() {
  return <div className="space-y-3"><div className="h-44 animate-pulse rounded-[1.5rem] bg-cyan-300/10" /><div className="grid grid-cols-5 gap-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[64px] animate-pulse rounded-[1rem] bg-cyan-300/10" />)}</div>{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-[1.25rem] bg-cyan-300/10" />)}</div>;
}

function BottomNavigation({ activeTab, onChange }: { activeTab: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-2 z-40 px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid h-[62px] max-w-[410px] grid-cols-5 rounded-[24px] border border-cyan-100/10 bg-[#020b18]/72 p-1.5 shadow-[0_0_24px_rgba(0,180,255,0.16),0_16px_38px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.065),inset_0_-12px_28px_rgba(0,123,255,0.07)] backdrop-blur-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return <button key={item.id} className={`hb-interactive hb-glow-cyan flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] transition duration-200 active:scale-95 ${active ? "hb-interactive-active hb-nav-active bg-cyan-300/[0.085] text-cyan-100 shadow-[0_0_16px_rgba(0,200,255,0.3),inset_0_0_0_1px_rgba(125,211,252,0.13)]" : "text-sky-100/48 hover:text-cyan-100 hover:bg-white/[0.035]"}`} onClick={() => onChange(item.id)} type="button"><Icon size={15} className={active ? "drop-shadow-[0_0_8px_rgba(34,211,238,0.75)]" : ""} /><span className="max-w-full truncate px-0.5 text-[8.5px] font-bold leading-3">{item.label}</span></button>;
        })}
      </div>
    </nav>
  );
}
