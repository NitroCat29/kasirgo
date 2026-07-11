import { randomUUID } from "node:crypto";
import { db } from "../db";
import { json, parseBody, getUser, requireRole } from "../helpers";

// ============================================================
// Wallet Routes — saldo, top-up, transaksi wallet
// ============================================================
export const walletRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {

  // ---- GET /api/wallet — ambil saldo user saat ini ----
  "GET /api/wallet": (req) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    let wallet = db.query("SELECT * FROM wallets WHERE user_id = ?").get(user.id) as any;
    if (!wallet) {
      const id = randomUUID();
      db.run("INSERT INTO wallets (id, user_id, balance) VALUES (?, ?, 0)", id, user.id);
      wallet = { id, user_id: user.id, balance: 0 };
    }
    return json({ id: wallet.id, balance: wallet.balance, updated_at: wallet.updated_at });
  },

  // ---- POST /api/wallet/topup — mock top-up ----
  "POST /api/wallet/topup": async (req) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    const { data: body, error: parseErr } = await parseBody(req);
    if (parseErr) return parseErr;
    const amount = Number(body.amount);
    if (!amount || amount < 1000 || amount > 10_000_000) {
      return json({ error: "Jumlah top-up harus antara Rp 1.000 — Rp 10.000.000" }, 400);
    }

    let wallet = db.query("SELECT * FROM wallets WHERE user_id = ?").get(user.id) as any;
    if (!wallet) {
      const id = randomUUID();
      db.run("INSERT INTO wallets (id, user_id, balance) VALUES (?, ?, 0)", id, user.id);
      wallet = { id, user_id: user.id, balance: 0 };
    }

    // Update balance
    const newBalance = wallet.balance + amount;
    db.run("UPDATE wallets SET balance = ?, updated_at = datetime('now') WHERE id = ?", newBalance, wallet.id);

    // Log transaksi
    db.run(
      "INSERT INTO wallet_transactions (id, wallet_id, type, amount, description) VALUES (?, ?, 'topup', ?, ?)",
      randomUUID(), wallet.id, amount, body.description || "Top-up saldo"
    );

    return json({ balance: newBalance, topped_up: amount });
  },

  // ---- GET /api/wallet/history — riwayat transaksi wallet ----
  "GET /api/wallet/history": (req) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    const wallet = db.query("SELECT id FROM wallets WHERE user_id = ?").get(user.id) as any;
    if (!wallet) return json({ transactions: [] });
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
    const rows = db.query(
      "SELECT * FROM wallet_transactions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(wallet.id, limit);
    return json({ transactions: rows });
  },
};
