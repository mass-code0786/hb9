export function getBitcoinWatchOnlyLabel() {
  return "BTC watch-only coming soon";
}

export async function sendBitcoinTransaction() {
  throw new Error("Bitcoin sending is disabled until safe watch-only or signing support is implemented.");
}
