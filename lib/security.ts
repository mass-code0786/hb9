export type PinRecord = {
  salt: string;
  hash: string;
  createdAt: string;
  algorithm?: "PBKDF2-SHA-256" | "SHA-256";
  iterations?: number;
};

export type BackupStatus = "not-backed-up" | "backed-up";

const PIN_KEY = "bitzenx.security.pin.v1";
const BACKUP_KEY = "bitzenx.security.backup.v1";

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return bytesToHex(new Uint8Array(digest));
}

async function pbkdf2Hex(pin: string, salt: string, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export function isValidPin(pin: string) {
  return /^\d{4,6}$/.test(pin);
}

export async function createPinRecord(pin: string): Promise<PinRecord> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = bytesToHex(saltBytes);
  const iterations = 210000;
  return {
    salt,
    hash: await pbkdf2Hex(pin, salt, iterations),
    createdAt: new Date().toISOString(),
    algorithm: "PBKDF2-SHA-256",
    iterations
  };
}

export async function verifyPin(pin: string, record: PinRecord | null) {
  if (!record) return false;
  const expected = record.algorithm === "PBKDF2-SHA-256"
    ? await pbkdf2Hex(pin, record.salt, record.iterations || 210000)
    : await sha256Hex(`${record.salt}:${pin}`);
  return constantTimeEqual(expected, record.hash);
}

export function getStoredPin(): PinRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PinRecord;
  } catch {
    return null;
  }
}

export function savePin(record: PinRecord) {
  window.localStorage.setItem(PIN_KEY, JSON.stringify(record));
}

export function clearPin() {
  window.localStorage.removeItem(PIN_KEY);
}

export function getBackupStatus(): BackupStatus {
  if (typeof window === "undefined") return "not-backed-up";
  return window.localStorage.getItem(BACKUP_KEY) === "backed-up" ? "backed-up" : "not-backed-up";
}

export function saveBackupStatus(status: BackupStatus) {
  window.localStorage.setItem(BACKUP_KEY, status);
}

export function clearSecurityMetadata() {
  clearPin();
  window.localStorage.removeItem(BACKUP_KEY);
}
