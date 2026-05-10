import type { RechargeCountry, RechargeOrder } from "@/types/wallet";

export const rechargeCountries: RechargeCountry[] = [
  { code: "IN", name: "India", currency: "INR", dialCode: "+91", operators: ["Jio", "Airtel", "Vi", "BSNL"] },
  { code: "PK", name: "Pakistan", currency: "PKR", dialCode: "+92", operators: ["Jazz", "Zong", "Telenor", "Ufone"] },
  { code: "AE", name: "UAE", currency: "AED", dialCode: "+971", operators: ["Etisalat", "du", "Virgin"] },
  { code: "BD", name: "Bangladesh", currency: "BDT", dialCode: "+880", operators: ["Grameenphone", "Robi", "Banglalink"] },
  { code: "NP", name: "Nepal", currency: "NPR", dialCode: "+977", operators: ["Ncell", "Nepal Telecom"] },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", dialCode: "+966", operators: ["STC", "Mobily", "Zain"] },
  { code: "QA", name: "Qatar", currency: "QAR", dialCode: "+974", operators: ["Ooredoo", "Vodafone"] },
  { code: "OM", name: "Oman", currency: "OMR", dialCode: "+968", operators: ["Omantel", "Ooredoo"] },
  { code: "GB", name: "UK", currency: "GBP", dialCode: "+44", operators: ["EE", "O2", "Vodafone", "Three"] },
  { code: "US", name: "USA", currency: "USD", dialCode: "+1", operators: ["AT&T", "T-Mobile", "Verizon"] },
  { code: "CA", name: "Canada", currency: "CAD", dialCode: "+1", operators: ["Rogers", "Bell", "Telus"] },
  ...[
    "Afghanistan", "Albania", "Algeria", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahrain",
    "Belgium", "Bhutan", "Bolivia", "Brazil", "Brunei", "Bulgaria", "Cambodia", "Chile", "China", "Colombia",
    "Costa Rica", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Egypt", "Estonia", "Finland", "France",
    "Georgia", "Germany", "Ghana", "Greece", "Hong Kong", "Hungary", "Indonesia", "Ireland", "Israel", "Italy",
    "Japan", "Jordan", "Kazakhstan", "Kenya", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lithuania",
    "Luxembourg", "Malaysia", "Maldives", "Mexico", "Morocco", "Myanmar", "Netherlands", "New Zealand", "Nigeria",
    "Norway", "Philippines", "Poland", "Portugal", "Romania", "Singapore", "South Africa", "South Korea", "Spain",
    "Sri Lanka", "Sweden", "Switzerland", "Thailand", "Turkey", "Ukraine", "Vietnam", "Ecuador", "El Salvador",
    "Ethiopia", "Fiji", "Guatemala", "Honduras", "Iceland", "Iraq", "Jamaica", "Malta", "Mauritius", "Moldova",
    "Mongolia", "Panama", "Paraguay", "Peru", "Rwanda", "Serbia", "Slovakia", "Slovenia", "Taiwan", "Tanzania",
    "Tunisia", "Uganda", "Uruguay", "Uzbekistan", "Zambia", "Zimbabwe"
  ].map((name, index) => ({
    code: `G${index + 1}`,
    name,
    currency: "USD",
    dialCode: "+",
    operators: ["Provider A", "Provider B", "Provider C"]
  }))
];

export const supportedCountryCount = `${rechargeCountries.length}+`;

export interface RechargeProvider {
  quote(amount: string): Promise<RechargeQuote>;
  create(payload: Omit<RechargeOrder, "id" | "status" | "createdAt">): Promise<RechargeOrder>;
  history(): Promise<RechargeOrder[]>;
}

export type RechargeQuote = {
  fee: string;
  payable: string;
  eta: string;
};

export async function quoteRecharge(amount: string): Promise<RechargeQuote> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const numericAmount = Number(amount || 0);
  return {
    fee: (numericAmount * 0.012).toFixed(2),
    payable: (numericAmount * 1.012).toFixed(2),
    eta: "Usually under 60 seconds"
  };
}

export async function submitRecharge(payload: Omit<RechargeOrder, "id" | "status" | "createdAt">): Promise<RechargeOrder> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return {
    ...payload,
    id: `recharge-${Date.now()}`,
    status: "success",
    createdAt: new Date().toISOString()
  };
}

export const mockRechargeProvider: RechargeProvider = {
  quote: quoteRecharge,
  create: submitRecharge,
  async history() {
    return [];
  }
};
