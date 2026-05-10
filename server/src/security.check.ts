import { containsSensitiveWalletMaterial } from "./security.js";

const blockedPayloads = [
  { mnemonic: "test test test" },
  { privateKey: "0xabc" },
  { nested: { seedPhrase: "word word word" } }
];

for (const payload of blockedPayloads) {
  if (!containsSensitiveWalletMaterial(payload)) {
    throw new Error("Sensitive wallet payload was not rejected by the backend safety check.");
  }
}

if (containsSensitiveWalletMaterial({ amount: "1", recipient: "0x0000000000000000000000000000000000000000" })) {
  throw new Error("Non-sensitive transaction payload was incorrectly rejected.");
}
