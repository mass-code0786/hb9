export function trimAmount(value: string, max = 6) {
  const [whole, fraction = ""] = value.split(".");
  if (!fraction) return whole || "0";
  return `${whole}.${fraction.slice(0, max)}`.replace(/\.?0+$/, "");
}

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value > 1000 ? 0 : 2
  }).format(Number.isFinite(value) ? value : 0);
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
