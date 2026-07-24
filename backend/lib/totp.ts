import { generateSecret as otpGenerateSecret, verifySync as otpVerifySync, generateURI } from "otplib";
import QRCode from "qrcode";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// ============================================================
// TOTP lib — generate/verify 6-digit code (RFC 6238, 30s step)
// + AES-256-GCM encryption for secret at-rest in SQLite
// ============================================================

const ISSUER = "KasirGo";
const STEP_SECONDS = 30;
const DIGITS = 6;
const ALGO = "sha1" as const;
const WINDOW = 1;

// --- Encryption key derivation ---
// Prefer explicit TOTP_ENCRYPTION_KEY env (32-byte hex).
// Fallback (dev only): derive from TOTP_KEY_PASSPHRASE via scrypt.
function getEncryptionKey(): Buffer {
  const explicit = process.env.TOTP_ENCRYPTION_KEY;
  if (explicit && explicit.length === 64) {
    return Buffer.from(explicit, "hex");
  }
  const passphrase = process.env.TOTP_KEY_PASSPHRASE || "kasirgo-dev-totp-key";
  // Static salt — OK karena hanya untuk dev fallback. Prod harus pakai explicit key.
  const salt = "kasirgo-totp-static-salt-v1";
  return scryptSync(passphrase, salt, 32);
}

// --- Encryption helpers (AES-256-GCM) ---
// Format stored: "iv:tag:ciphertext" (all base64)
export function encryptSecret(plain: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(enc: string): string | null {
  try {
    const key = getEncryptionKey();
    const [ivB64, tagB64, ctB64] = enc.split(":");
    if (!ivB64 || !tagB64 || !ctB64) return null;
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// --- TOTP core (otplib v13 async API) ---
export function generateTotpSecret(): string {
  return otpGenerateSecret();
}

export function generateOtpAuthUrl(secret: string, accountName: string): string {
  return generateURI({ secret, issuer: ISSUER, label: accountName, algorithm: ALGO, digits: DIGITS, period: STEP_SECONDS });
}

export function verifyTotp(token: string, secret: string, window: number = WINDOW): boolean {
  if (!token || !/^\d{6}$/.test(token)) return false;
  try {
    const result = otpVerifySync({ token, secret, window, algorithm: ALGO, digits: DIGITS, step: STEP_SECONDS });
    // otplib v13 returns { valid, delta, ... } or boolean depending on call shape
    if (typeof result === "boolean") return result;
    return result?.valid === true;
  } catch {
    return false;
  }
}

export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 256 });
}

// Format secret jadi chunk 4-char untuk display manual
export function formatSecretChunks(secret: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < secret.length; i += 4) {
    out.push(secret.slice(i, i + 4));
  }
  return out;
}
