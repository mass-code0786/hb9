import type { RechargeCountry, RechargeOperator, RechargeProduct } from "./types.js";

export const countries: RechargeCountry[] = [
  { code: "IN", name: "India", currency: "INR", dialCode: "+91", flag: "IN" },
  { code: "PK", name: "Pakistan", currency: "PKR", dialCode: "+92", flag: "PK" },
  { code: "AE", name: "UAE", currency: "AED", dialCode: "+971", flag: "AE" },
  { code: "BD", name: "Bangladesh", currency: "BDT", dialCode: "+880", flag: "BD" },
  { code: "NP", name: "Nepal", currency: "NPR", dialCode: "+977", flag: "NP" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", dialCode: "+966", flag: "SA" },
  { code: "GB", name: "UK", currency: "GBP", dialCode: "+44", flag: "GB" },
  { code: "US", name: "USA", currency: "USD", dialCode: "+1", flag: "US" }
];

export const operators: RechargeOperator[] = [
  { id: "in-airtel", countryCode: "IN", name: "Airtel" },
  { id: "in-jio", countryCode: "IN", name: "Jio" },
  { id: "in-vi", countryCode: "IN", name: "Vi" },
  { id: "pk-jazz", countryCode: "PK", name: "Jazz" },
  { id: "pk-zong", countryCode: "PK", name: "Zong" },
  { id: "ae-etisalat", countryCode: "AE", name: "Etisalat" },
  { id: "ae-du", countryCode: "AE", name: "du" },
  { id: "bd-grameenphone", countryCode: "BD", name: "Grameenphone" },
  { id: "np-ncell", countryCode: "NP", name: "Ncell" },
  { id: "sa-stc", countryCode: "SA", name: "STC" },
  { id: "gb-ee", countryCode: "GB", name: "EE" },
  { id: "us-tmobile", countryCode: "US", name: "T-Mobile" }
];

export const products: RechargeProduct[] = [
  { id: "in-airtel-199", operatorId: "in-airtel", name: "Airtel INR 199", localAmount: 199, localCurrency: "INR", validity: "28 days" },
  { id: "in-airtel-299", operatorId: "in-airtel", name: "Airtel INR 299", localAmount: 299, localCurrency: "INR", validity: "28 days" },
  { id: "in-jio-239", operatorId: "in-jio", name: "Jio INR 239", localAmount: 239, localCurrency: "INR", validity: "28 days" },
  { id: "pk-jazz-500", operatorId: "pk-jazz", name: "Jazz PKR 500", localAmount: 500, localCurrency: "PKR", validity: "30 days" },
  { id: "ae-etisalat-20", operatorId: "ae-etisalat", name: "Etisalat AED 20", localAmount: 20, localCurrency: "AED" },
  { id: "ae-du-25", operatorId: "ae-du", name: "du AED 25", localAmount: 25, localCurrency: "AED" },
  { id: "bd-grameenphone-200", operatorId: "bd-grameenphone", name: "Grameenphone BDT 200", localAmount: 200, localCurrency: "BDT" },
  { id: "np-ncell-300", operatorId: "np-ncell", name: "Ncell NPR 300", localAmount: 300, localCurrency: "NPR" },
  { id: "sa-stc-25", operatorId: "sa-stc", name: "STC SAR 25", localAmount: 25, localCurrency: "SAR" },
  { id: "gb-ee-10", operatorId: "gb-ee", name: "EE GBP 10", localAmount: 10, localCurrency: "GBP" },
  { id: "us-tmobile-15", operatorId: "us-tmobile", name: "T-Mobile USD 15", localAmount: 15, localCurrency: "USD" }
];

export const fxRatesToUsd: Record<string, number> = {
  INR: 0.012,
  PKR: 0.0036,
  AED: 0.2723,
  BDT: 0.0082,
  NPR: 0.0075,
  SAR: 0.2666,
  GBP: 1.25,
  USD: 1
};

