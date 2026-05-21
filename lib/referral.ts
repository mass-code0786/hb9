const HB_SOURCE_REFERRAL_KEY = "bitzenx.hb.sourceReferral";

export function normalizeHbReferral(value: string | null | undefined) {
  const normalized = (value || "").trim().toUpperCase();
  if (/^0X[A-F0-9]{40}$/.test(normalized)) return `0x${normalized.slice(2).toLowerCase()}`;
  return /^[A-Z0-9_-]{3,40}$/.test(normalized) ? normalized : "";
}

export function getStoredHbReferral() {
  if (typeof window === "undefined") return "";
  return normalizeHbReferral(window.localStorage.getItem(HB_SOURCE_REFERRAL_KEY));
}

export function storeHbReferral(referralCode: string) {
  if (typeof window === "undefined") return "";
  const normalized = normalizeHbReferral(referralCode);
  if (!normalized) return "";
  const existing = getStoredHbReferral();
  if (existing) return existing;
  window.localStorage.setItem(HB_SOURCE_REFERRAL_KEY, normalized);
  return normalized;
}

export function captureHbReferralFromUrl(search = typeof window === "undefined" ? "" : window.location.search) {
  if (!search) return getStoredHbReferral();
  const params = new URLSearchParams(search);
  return storeHbReferral(params.get("ref") || params.get("sponsor") || params.get("wallet") || params.get("walletRef") || "");
}
