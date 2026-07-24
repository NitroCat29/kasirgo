// ============================================================
// TOTP 2FA routes — admin only
// Setup: generate secret + QR (NOT enabled yet), confirm w/ code → enable
// Reset: disable + clear (requires current valid code)
// Status: GET enabled flag for UI
// ============================================================

import type { BunRequest } from "bun";
import { db } from "../db";
import { requireRole } from "../helpers";
import {
  generateTotpSecret,
  generateOtpAuthUrl,
  generateQrDataUrl,
  encryptSecret,
  decryptSecret,
  verifyTotp,
} from "../lib/totp";

interface SessionUser {
  id: number;
  username: string;
  role: string;
}

async function readJson<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// GET /api/auth/totp/status → { enabled, hasSecret }
async function totpStatus(req: Request): Promise<Response> {
  const auth = await requireRole(req, ["admin"]);
  if (auth instanceof Response) return auth;
  const user = auth as SessionUser;


  const row = db
    .query("SELECT totp_enabled, totp_secret FROM users WHERE id = ?")
    .get(user.id) as { totp_enabled: number; totp_secret: string | null } | undefined;

  return json({
    enabled: !!(row?.totp_enabled && row?.totp_secret),
    hasSecret: !!row?.totp_secret,
  });
}

// POST /api/auth/totp/setup
// Step 1: generate secret, save encrypted (enabled=0), return QR + plain secret
async function totpSetupBegin(req: Request): Promise<Response> {
  const auth = await requireRole(req, ["admin"]);
  if (auth instanceof Response) return auth;
  const user = auth as SessionUser;


  const secret = generateTotpSecret();
  const accountName = `${user.username}@kasirgo`;
  const otpAuthUrl = generateOtpAuthUrl(secret, accountName);
  const qrDataUrl = await generateQrDataUrl(otpAuthUrl);

  const enc = encryptSecret(secret);
  db.query("UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?")
    .run(enc, user.id);

  return json({ qrDataUrl, secret, otpAuthUrl, accountName });
}

// POST /api/auth/totp/confirm  Body: { code }
// Step 2: verify code → enable
async function totpSetupConfirm(req: Request): Promise<Response> {
  const auth = await requireRole(req, ["admin"]);
  if (auth instanceof Response) return auth;
  const user = auth as SessionUser;
  const { code } = await readJson<{ code?: string }>(req);
  if (!code) return json({ error: "Kode 2FA wajib diisi" }, 400);


  const row = db
    .query("SELECT totp_secret FROM users WHERE id = ?")
    .get(user.id) as { totp_secret: string | null } | undefined;

  if (!row?.totp_secret) {
    return json({ error: "Setup 2FA belum dimulai. Pindai QR dulu." }, 400);
  }

  const secret = decryptSecret(row.totp_secret);
  if (!secret) return json({ error: "Secret corrupt. Mulai ulang setup." }, 500);

  if (!verifyTotp(code, secret)) {
    return json({ error: "Kode salah atau kadaluarsa. Coba lagi." }, 400);
  }

  db.query("UPDATE users SET totp_enabled = 1 WHERE id = ?").run(user.id);
  return json({ ok: true, enabled: true });
}

// POST /api/auth/totp/reset  Body: { code }
// Disable + clear. Requires current valid code.
async function totpReset(req: Request): Promise<Response> {
  const auth = await requireRole(req, ["admin"]);
  if (auth instanceof Response) return auth;
  const user = auth as SessionUser;
  const { code } = await readJson<{ code?: string }>(req);
  if (!code) return json({ error: "Kode 2FA wajib diisi untuk reset" }, 400);


  const row = db
    .query("SELECT totp_secret, totp_enabled FROM users WHERE id = ?")
    .get(user.id) as { totp_secret: string | null; totp_enabled: number } | undefined;

  if (!row?.totp_enabled || !row?.totp_secret) {
    return json({ error: "2FA belum aktif, tidak ada yang perlu di-reset" }, 400);
  }

  const secret = decryptSecret(row.totp_secret);
  if (!secret) return json({ error: "Secret corrupt, hubungi developer" }, 500);

  if (!verifyTotp(code, secret)) {
    return json({ error: "Kode salah. Reset dibatalkan." }, 403);
  }

  db.query("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?")
    .run(user.id);
  return json({ ok: true, enabled: false });
}

// Mounted into authRoutes via Object.assign below.
// Aliases: FE uses verify/disable, internal names confirm/reset.
export const totpRoutes: Record<string, (req: Request) => Response | Promise<Response>> = {
  "GET /api/v1/auth/totp/status": totpStatus,
  "POST /api/v1/auth/totp/setup": totpSetupBegin,
  "POST /api/v1/auth/totp/confirm": totpSetupConfirm,
  "POST /api/v1/auth/totp/verify": totpSetupConfirm,
  "POST /api/v1/auth/totp/reset": totpReset,
  "POST /api/v1/auth/totp/disable": totpReset,
  // Legacy aliases
  "GET /api/auth/totp/status": totpStatus,
  "POST /api/auth/totp/setup": totpSetupBegin,
  "POST /api/auth/totp/confirm": totpSetupConfirm,
  "POST /api/auth/totp/verify": totpSetupConfirm,
  "POST /api/auth/totp/reset": totpReset,
  "POST /api/auth/totp/disable": totpReset,
};
