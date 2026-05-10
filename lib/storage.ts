import type { EncryptedVault } from "@/lib/types";

const VAULT_KEY = "bitzenx.encryptedVault.v1";

export function getStoredVault(): EncryptedVault | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(VAULT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as EncryptedVault;
  } catch {
    return null;
  }
}

export function saveVault(vault: EncryptedVault) {
  window.localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

export function clearVault() {
  window.localStorage.removeItem(VAULT_KEY);
}
