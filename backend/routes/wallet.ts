// ============================================================
// Wallet routes — per-toko wallet (top-up requires admin + TOTP 2FA)
// ============================================================

import { randomUUID } from "node:crypto";
import { db } from "../db";
import { requireRole, json, logAudit } from "../helpers";
import { verifyTotp, decryptSecret } from "../lib/totp";

const MAX_TOPUP = 100_000_000; // safety cap per request

async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function ok(data: unknown, status = 200) {
  return json(data, status);
}

// GET /api/wallet?toko_id=X — toko wallet balance
// Security: kasir/manajer hanya bisa akses wallet toko yang punya transaksi mereka (soft ownership)
export async function getMyWallet(req: Request): Promise<Response> {
  const auth = await requireRole(req, ["admin", "manajer", "kasir"]);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const tokoId = url.searchParams.get("toko_id");
  if (!tokoId) return ok({ error: "toko_id wajib" }, 400);

  // Validasi toko exists
  const toko = db.query("SELECT id FROM toko WHERE id = ?").get(tokoId);
  if (!toko) return ok({ error: "Toko tidak ditemukan" }, 404);

  // Ownership check: non-admin harus punya transaksi di toko ini
  if (auth.role !== "admin") {
    const hasAccess = db.query(
      "SELECT 1 FROM transaksi WHERE toko_id = ? LIMIT 1"
    ).get(tokoId);
    // Juga cek apakah user punya produk di toko ini
    const hasProduk = db.query(
      "SELECT 1 FROM produk WHERE toko_id = ? LIMIT 1"
    ).get(tokoId);
    if (!hasAccess && !hasProduk) {
      return ok({ error: "Tidak ada akses ke toko ini" }, 403);
    }
  }

  const row = db
    .query("SELECT id, balance, updated_at FROM wallets WHERE toko_id = ?")
    .get(tokoId) as { id: string; balance: number; updated_at: string } | undefined;

  if (!row) {
    // Hanya admin yang boleh auto-create wallet baru
    if (auth.role !== "admin") {
      return ok({ id: null, balance: 0, updated_at: null });
    }
    const id = randomUUID();
    db.query("INSERT INTO wallets (id, toko_id, balance) VALUES (?, ?, 0)").run(id, tokoId);
    return ok({ id, balance: 0, updated_at: new Date().toISOString() });
  }
  return ok(row);
}

// GET /api/wallet/history?toko_id=X&limit=5 — toko's recent wallet transactions
export async function getMyHistory(req: Request): Promise<Response> {
  const auth = await requireRole(req, ["admin", "manajer", "kasir"]);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const tokoId = url.searchParams.get("toko_id");
  if (!tokoId) return ok({ error: "toko_id wajib" }, 400);

  // Validasi toko exists
  const toko = db.query("SELECT id FROM toko WHERE id = ?").get(tokoId);
  if (!toko) return ok({ error: "Toko tidak ditemukan" }, 404);

  // Ownership check untuk non-admin
  if (auth.role !== "admin") {
    const hasAccess = db.query("SELECT 1 FROM transaksi WHERE toko_id = ? LIMIT 1").get(tokoId);
    const hasProduk = db.query("SELECT 1 FROM produk WHERE toko_id = ? LIMIT 1").get(tokoId);
    if (!hasAccess && !hasProduk) {
      return ok({ error: "Tidak ada akses ke toko ini" }, 403);
    }
  }

  const limitRaw = Number(url.searchParams.get("limit") || "20");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 20;

  const wallet = db
    .query("SELECT id FROM wallets WHERE toko_id = ?")
    .get(tokoId) as { id: string } | undefined;

  if (!wallet) return ok({ transactions: [] });

  const txs = db
    .query(
      `SELECT id, type, amount, description, created_at
       FROM wallet_transactions
       WHERE wallet_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(wallet.id, limit);

  return ok({ transactions: txs });
}

// GET /api/wallet/users — list all toko wallets (admin/manager view)
export async function listWallets(req: Request): Promise<Response> {
  const auth = await requireRole(req, ["admin", "manajer"]);
  if (auth instanceof Response) return auth;

  const rows = db
    .query(
      `SELECT w.id, w.toko_id, w.balance, t.nama as toko_nama
       FROM wallets w JOIN toko t ON w.toko_id = t.id
       ORDER BY t.nama`
    )
    .all();
  return ok({ wallets: rows });
}

// POST /api/v1/wallet/topup — Admin top-up toko wallet via TOTP 2FA
// Admin only. Body: { amount, code, toko_id }
// amount in IDR (integer, > 0, <= MAX_TOPUP)
export async function topupWallet(req: Request): Promise<Response> {
  const auth = await requireRole(req, ["admin"]);
  if (auth instanceof Response) return auth;

  const body = await readJson(req);
  const amount = Number(body?.amount);
  const tokoId = String(body?.toko_id || "").trim();
  const code = String(body?.code || "").trim();

  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TOPUP) {
    return ok({ error: `Nominal top-up tidak valid (1 - ${MAX_TOPUP.toLocaleString("id-ID")})` }, 400);
  }
  if (!tokoId) {
    return ok({ error: "toko_id wajib dipilih" }, 400);
  }
  if (!/^\d{6}$/.test(code)) {
    return ok({ error: "Kode 2FA 6 digit wajib diisi" }, 400);
  }

  // Verify TOTP
  const user = db.query("SELECT id, totp_secret, totp_enabled FROM users WHERE id = ?").get(auth.id) as any;
  if (!user || !user.totp_enabled || !user.totp_secret) {
    return ok({ error: "TOTP 2FA belum diaktifkan. Aktifkan di tab Keamanan." }, 403);
  }

  const secret = decryptSecret(user.totp_secret);
  if (!secret) {
    return ok({ error: "Secret 2FA corrupt. Reset di tab Keamanan." }, 500);
  }
  // verifyTotp(token, secret) — urutan sama seperti routes/totp.ts
  const valid = verifyTotp(code, secret);
  if (!valid) {
    return ok({ error: "Kode 2FA salah atau expired" }, 403);
  }

  // Find or create wallet for this toko
  let wallet = db.query("SELECT id, balance FROM wallets WHERE toko_id = ?").get(tokoId) as any;
  if (!wallet) {
    const wid = randomUUID();
    db.run("INSERT INTO wallets (id, toko_id, balance) VALUES (?, ?, 0)", wid, tokoId);
    wallet = { id: wid, balance: 0 };
  }

  const newBalance = wallet.balance + amount;
  db.run("UPDATE wallets SET balance = ?, updated_at = datetime('now') WHERE id = ?", newBalance, wallet.id);
  db.run(
    "INSERT INTO wallet_transactions (id, wallet_id, type, amount, description) VALUES (?, ?, 'topup', ?, ?)",
    randomUUID(),
    wallet.id,
    amount,
    `Top-up oleh admin ${auth.username}`,
  );

  logAudit({
    user_id: auth.id,
    username: auth.username,
    action: "UPDATE",
    entity_type: "wallet",
    entity_id: wallet.id,
    details: { toko_id: tokoId, amount, new_balance: newBalance },
    old_values: { balance: wallet.balance },
    new_values: { balance: newBalance },
  });

  return ok({ balance: newBalance, amount });
}

// POST /api/wallet/disable — admin only, disable TOTP (requires current code)
export async function disableTotp(req: Request): Promise<Response> {
  const auth = await requireRole(req, ["admin"]);
  if (auth instanceof Response) return auth;

  const body = await readJson(req);
  const code = String(body?.code || "").trim();
  if (!/^\d{6}$/.test(code)) {
    return ok({ error: "Kode 6 digit wajib diisi" }, 400);
  }

  const user = db.query("SELECT id, totp_secret, totp_enabled FROM users WHERE id = ?").get(auth.id) as any;
  if (!user?.totp_enabled || !user?.totp_secret) {
    return ok({ error: "TOTP belum diaktifkan" }, 400);
  }

  const secret = decryptSecret(user.totp_secret);
  if (!secret) {
    return ok({ error: "Secret 2FA corrupt. Reset di tab Keamanan." }, 500);
  }
  const valid = verifyTotp(code, secret);
  if (!valid) {
    return ok({ error: "Kode salah atau expired" }, 403);
  }

  db.run("UPDATE users SET totp_enabled = 0 WHERE id = ?", auth.id);
  logAudit({ user_id: auth.id, username: auth.username, action: "UPDATE", entity_type: "user", entity_id: auth.id, details: { action: "disable_totp" } });
  return ok({ disabled: true });
}

// ============================================================
// Route Map
// ============================================================
export const walletRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  "GET /api/wallet": getMyWallet,
  "GET /api/wallet/me": getMyWallet,
  "GET /api/wallet/history": getMyHistory,
  "GET /api/wallet/users": listWallets,
  "POST /api/wallet/topup": topupWallet,
  "POST /api/wallet/disable": disableTotp,
};
