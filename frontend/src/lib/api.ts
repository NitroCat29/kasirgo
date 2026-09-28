// ============================================================
// KasirGo — API Client
// ============================================================
import { isElectrobun, desktopCall } from "./desktop";
import type { TokoInsert, ProdukInsert, TransaksiInsert } from "../../../shared/desktop-rpc";

let csrfToken = "";

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export function getCsrfToken(): string {
  // Fallback: baca dari cookie kalau memory kosong (e.g. setelah page reload)
  if (!csrfToken) {
    const m = document.cookie.match(/csrf_token=([^;]+)/);
    if (m) csrfToken = m[1];
  }
  return csrfToken;
}

// Helper: header untuk POST/PUT/PATCH/DELETE — sertakan CSRF token dari
// memory (getCsrfToken) atau cookie. Dipakai bareng Kasir.tsx + Dashboard.tsx.
export function csrfHeaders(): Record<string, string> {
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  const cookieToken = m ? m[1] : "";
  const token = csrfToken || cookieToken;
  return { "content-type": "application/json", "x-csrf-token": token };
}

// Direct CORS mode: frontend fetch langsung ke backend.
// Dev: VITE_API_BASE=http://localhost:3456 (atau default).
// Production: VITE_API_BASE kosong → same-origin (frontend served from backend).
const BASE = import.meta.env.VITE_API_BASE ?? "";

/* ============================================
   DEV MODE — Mock /api/auth/* (no backend needed)
   ============================================
   Kalau VITE_DEV_MODE=true, semua /api/auth/* di-mock supaya
   landing/login/dashboard bisa jalan tanpa Bun backend.
   Path non-auth (e.g. /api/toko) tetap ke backend kalau di-start manual.
   Set VITE_DEV_MODE=false di .env untuk produksi / kalau backend up.
   ============================================ */
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

if (DEV_MODE) {
  console.warn("[KasirGO] DEV_MODE active — auth API requests are mocked. Do NOT use in production.");
}

const MOCK_USER = {
  id: "dev",
  username: "dev",
  email: "dev@local",
  nama: "Dev User",
  role: "admin",
  verified: 1,
};

function mockAuthResponse<T = any>(path: string, opts: RequestInit): T {
  let body: any = {};
  try { body = opts.body ? JSON.parse(opts.body as string) : {}; } catch {}

  // Parse body sebagai fallback kalau JSON.parse gagal
  const method = (opts.method || "GET").toUpperCase();

  switch (path) {
    case "/api/auth/me":
      return { ...MOCK_USER } as T;

    case "/api/auth/login":
      return { ...MOCK_USER, csrf_token: "dev-csrf-token" } as T;

    case "/api/auth/signup":
      return { id: "dev-pending", pending_verification: true, email: body.email || "" } as T;

    case "/api/auth/hcaptcha-sitekey":
      // Captcha selalu off di dev mode
      return { enabled: false, site_key: null } as T;

    case "/api/auth/verify-email":
      return { ...MOCK_USER, csrf_token: "dev-csrf-token" } as T;

    case "/api/auth/resend-verification":
    case "/api/auth/forgot-password":
    case "/api/auth/reset-password":
      return { ok: true } as T;

    case "/api/auth/verify-reset-code":
      return { valid: true, reset_token: "dev-reset-token" } as T;

    case "/api/auth/logout":
      return { ok: true } as T;

    default:
      // Fallback: kalau path gak di-mock eksplisit, return empty success
      return { ok: true } as T;
  }
}

const AUTH_PATHS = [
  "/api/auth/me",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/auth/hcaptcha-sitekey",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/forgot-password",
  "/api/auth/verify-reset-code",
  "/api/auth/reset-password",
];

function isAuthPath(path: string): boolean {
  return AUTH_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

/* ============================================
   OFFLINE MODE — Electrobun webview → local SQLite via RPC
   ============================================
   Kalau jalan di desktop (Electrobun), semua request /api/* yang didukung
   diterjemahkan ke typed RPC (Bun main → bun:sqlite) supaya app jalan
   offline tanpa backend. Path yang tidak didukung (users write, audit)
   tetap realistis: baca lokal, tulis → error jelas.
   ============================================ */
const LOCAL_USER = {
  id: "local-admin",
  username: "admin",
  email: "local@kasirgo",
  nama: "Admin Lokal",
  role: "admin",
  verified: 1,
};

function localBody(opts: RequestInit): Record<string, any> {
  try {
    return opts.body ? JSON.parse(opts.body as string) : {};
  } catch {
    return {};
  }
}

/** Handle request via local SQLite RPC. Return null kalau path tidak didukung offline. */
async function localApi<T = any>(
  path: string,
  opts: RequestInit = {},
): Promise<T | null> {
  const method = (opts.method || "GET").toUpperCase();
  const [pathname, queryStr] = path.split("?");
  const seg = pathname.split("/").filter(Boolean); // ["api", "toko", ...]
  if (seg[0] !== "api") return null;
  const q = new URLSearchParams(queryStr || "");
  const body = localBody(opts);

  // ---- AUTH (offline: auto-login sebagai admin lokal) ----
  switch (pathname) {
    case "/api/auth/me":
      return LOCAL_USER as T;
    case "/api/auth/login":
      return { ...LOCAL_USER, csrf_token: "local-csrf" } as T;
    case "/api/auth/logout":
      return { ok: true } as T;
    case "/api/auth/hcaptcha-sitekey":
      return { enabled: false, site_key: null } as T;
    case "/api/auth/signup":
      return { id: "local", pending_verification: true, email: "" } as T;
    case "/api/auth/verify-email":
      return { ...LOCAL_USER, csrf_token: "local-csrf" } as T;
    case "/api/auth/resend-verification":
    case "/api/auth/forgot-password":
    case "/api/auth/reset-password":
      return { ok: true } as T;
    case "/api/auth/verify-reset-code":
      return { valid: true, reset_token: "local" } as T;
  }
  if (pathname.startsWith("/api/v1/auth/totp/")) {
    const action = pathname.split("/").pop();
    if (action === "status") return { enabled: false, hasSecret: false } as T;
    return { ok: true } as T; // setup / verify / disable — no-op offline
  }

  const dbSelect = async (sql: string, bind: unknown[] = []): Promise<Record<string, unknown>[]> =>
    (await desktopCall("db.select", { sql, bind })) ?? [];
  const dbExec = (sql: string, bind: unknown[] = []) =>
    desktopCall("db.execute", { sql, bind }) as Promise<{ rowsAffected: number }>;

  // ---- STATS ----
  if (seg[1] === "stats" && method === "GET") {
    if (seg[2] === "daily-revenue") {
      const days = Math.min(Math.max(Number(q.get("days")) || 30, 1), 90);
      // Revenue: penjualan (transaksi); Expense: pengeluaran wallet type 'purchase'
      if (days === 1) {
        const revRows = await dbSelect(
          `SELECT strftime('%Y-%m-%dT%H:00:00Z', created_at) as day,
                  COALESCE(SUM(total),0) as revenue, COUNT(*) as count
           FROM transaksi
           WHERE created_at >= datetime('now', '-23 hours')
           GROUP BY strftime('%Y-%m-%d %H', created_at)
           ORDER BY day ASC`,
        );
        const expRows = await dbSelect(
          `SELECT strftime('%Y-%m-%dT%H:00:00Z', created_at) as day,
                  COALESCE(SUM(amount),0) as expense
           FROM wallet_transactions
           WHERE type = 'purchase' AND created_at >= datetime('now', '-23 hours')
           GROUP BY strftime('%Y-%m-%d %H', created_at)
           ORDER BY day ASC`,
        );
        const revMap = new Map<string, { revenue: number; count: number }>();
        for (const r of revRows) revMap.set(r.day as string, { revenue: Number(r.revenue), count: Number(r.count) });
        const expMap = new Map<string, number>();
        for (const r of expRows) expMap.set(r.day as string, Number(r.expense));
        const data: { day: string; revenue: number; count: number; expense: number }[] = [];
        const now = new Date();
        const hourMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours());
        for (let i = 23; i >= 0; i--) {
          const d = new Date(hourMs - i * 3600000);
          const key = d.toISOString().slice(0, 13) + ":00:00Z";
          const hit = revMap.get(key);
          data.push({ day: key, revenue: hit?.revenue ?? 0, count: hit?.count ?? 0, expense: expMap.get(key) ?? 0 });
        }
        return { days: 1, granularity: "hour", data } as T;
      }
      const revRows = await dbSelect(
        `SELECT date(created_at) as day, COALESCE(SUM(total),0) as revenue, COUNT(*) as count
         FROM transaksi
         WHERE date(created_at) >= date('now', '-' || ? || ' days')
         GROUP BY date(created_at) ORDER BY day ASC`,
        [days - 1],
      );
      const expRows = await dbSelect(
        `SELECT date(created_at) as day, COALESCE(SUM(amount),0) as expense
         FROM wallet_transactions
         WHERE type = 'purchase' AND date(created_at) >= date('now', '-' || ? || ' days')
         GROUP BY date(created_at) ORDER BY day ASC`,
        [days - 1],
      );
      const revMap = new Map<string, { revenue: number; count: number }>();
      for (const r of revRows) revMap.set(r.day as string, { revenue: Number(r.revenue), count: Number(r.count) });
      const expMap = new Map<string, number>();
      for (const r of expRows) expMap.set(r.day as string, Number(r.expense));
      const data: { day: string; revenue: number; count: number; expense: number }[] = [];
      const now = new Date();
      const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1);
      for (let i = 0; i < days; i++) {
        const d = new Date(startMs + i * 86400000);
        const key = d.toISOString().slice(0, 10);
        const hit = revMap.get(key);
        data.push({ day: key, revenue: hit?.revenue ?? 0, count: hit?.count ?? 0, expense: expMap.get(key) ?? 0 });
      }
      return { days, granularity: "day", data } as T;
    }
    const toko = Number((await dbSelect("SELECT COUNT(*) as c FROM toko"))[0]?.c ?? 0);
    const produk = Number((await dbSelect("SELECT COUNT(*) as c FROM produk"))[0]?.c ?? 0);
    const transaksi = Number((await dbSelect("SELECT COUNT(*) as c FROM transaksi"))[0]?.c ?? 0);
    const trxHariIni = Number(
      (await dbSelect("SELECT COUNT(*) as c FROM transaksi WHERE date(created_at) = date('now')"))[0]?.c ?? 0,
    );
    const sumPendapatan = async (clause: string) =>
      Number((await dbSelect(`SELECT COALESCE(SUM(total),0) as s FROM transaksi ${clause}`))[0]?.s ?? 0);
    return {
      toko,
      produk,
      transaksi,
      transaksi_hari_ini: trxHariIni,
      pendapatan_hari_ini: await sumPendapatan("WHERE date(created_at) = date('now')"),
      pendapatan_7_hari: await sumPendapatan("WHERE date(created_at) >= date('now', '-6 days')"),
      pendapatan_30_hari: await sumPendapatan("WHERE date(created_at) >= date('now', '-29 days')"),
      total_pendapatan: await sumPendapatan(""),
    } as T;
  }

  // ---- TOKO ----
  if (seg[1] === "toko") {
    const id = seg[2];
    if (method === "GET" && !id) {
      return dbSelect("SELECT * FROM toko ORDER BY created_at DESC") as Promise<T>;
    }
    if (method === "GET" && id) {
      const rows = await dbSelect("SELECT * FROM toko WHERE id = ?", [id]);
      if (!rows.length) throw new Error("Toko tidak ditemukan");
      return rows[0] as T;
    }
    if (method === "POST") return desktopCall("toko.insert", body as TokoInsert) as Promise<T>;
    if (method === "PATCH" && id) return desktopCall("toko.update", { id, ...body }) as Promise<T>;
    if (method === "DELETE" && id) return desktopCall("toko.delete", { id }) as Promise<T>;
  }

  // ---- PRODUK ----
  if (seg[1] === "produk") {
    const sub = seg[2];
    if (!sub && method === "GET") {
      const tokoId = q.get("toko_id");
      return (tokoId
        ? dbSelect("SELECT * FROM produk WHERE toko_id = ? ORDER BY nama", [tokoId])
        : dbSelect("SELECT * FROM produk ORDER BY nama")) as Promise<T>;
    }
    if (!sub && method === "POST") return desktopCall("produk.insert", body as ProdukInsert) as Promise<T>;
    if (sub === "search" && method === "GET") {
      const s = q.get("q") || "";
      const limit = Math.min(Math.max(Number(q.get("limit")) || 8, 1), 20);
      if (!s.trim()) return [] as T;
      return dbSelect(
        `SELECT p.id, p.nama, p.merk, p.kategori, p.satuan, p.harga, p.harga_modal,
                p.stok, p.stock_threshold, p.toko_id, t.nama as toko_nama
         FROM produk p LEFT JOIN toko t ON p.toko_id = t.id
         WHERE (p.nama LIKE ? COLLATE NOCASE OR p.sku LIKE ? COLLATE NOCASE OR p.merk LIKE ? COLLATE NOCASE)
         ORDER BY p.nama LIMIT ?`,
        [`%${s}%`, `%${s}%`, `%${s}%`, limit],
      ) as Promise<T>;
    }
    if (sub === "restock" && method === "POST") {
      const produkId = body.produk_id;
      const qty = Number(body.qty);
      const modal = Number(body.harga_modal ?? 0);
      if (!produkId) throw new Error("produk_id wajib diisi");
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("qty harus angka > 0");
      if (!Number.isFinite(modal) || modal < 0) throw new Error("harga_modal harus angka >= 0");
      const rows = await dbSelect("SELECT toko_id, nama, harga_modal FROM produk WHERE id = ?", [produkId]);
      if (!rows.length) throw new Error("Produk tidak ditemukan");
      const cost = Math.round(qty * (modal || Number(rows[0].harga_modal) || 0));
      await desktopCall("produk.restock", { id: produkId, delta: qty });
      if (cost > 0) {
        try {
          await desktopCall("wallet.deduct", {
            toko_id: rows[0].toko_id as string,
            amount: cost,
            description: `Restock: ${rows[0].nama} (+${qty} @ ${cost})`,
          });
        } catch (err) {
          await desktopCall("produk.restock", { id: produkId, delta: -qty }); // rollback stok
          throw err;
        }
      }
      const updated = await dbSelect("SELECT * FROM produk WHERE id = ?", [produkId]);
      return updated[0] as T;
    }
    if (sub === "bulk-restock" && method === "POST") {
      const results = { restocked: 0, errors: [] as string[] };
      const items = Array.isArray(body.items) ? body.items : [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i] || {};
        try {
          const produkId = item.produk_id;
          const qt = Number(item.qty);
          const modal = Number(item.harga_modal ?? 0);
          if (!produkId) throw new Error("produk_id wajib diisi");
          if (!Number.isFinite(qt) || qt <= 0) throw new Error("qty harus angka > 0");
          if (!Number.isFinite(modal) || modal < 0) throw new Error("harga_modal harus angka >= 0");
          const rows = await dbSelect("SELECT toko_id, nama FROM produk WHERE id = ?", [produkId]);
          if (!rows.length) throw new Error("Produk tidak ditemukan");
          const cost = Math.round(qt * modal);
          await desktopCall("produk.restock", { id: produkId, delta: qt });
          if (cost > 0) {
            try {
              await desktopCall("wallet.deduct", {
                toko_id: rows[0].toko_id as string,
                amount: cost,
                description: `Bulk restock: ${rows[0].nama} (+${qt})`,
              });
            } catch (err) {
              await desktopCall("produk.restock", { id: produkId, delta: -qt });
              throw err;
            }
          }
          results.restocked++;
        } catch (err: any) {
          results.errors.push(`Item ${i + 1}: ${err.message}`);
        }
      }
      return results as T;
    }
    if (sub && method === "PATCH") return desktopCall("produk.update", { id: sub, ...body }) as Promise<T>;
    if (sub && method === "DELETE") return desktopCall("produk.delete", { id: sub }) as Promise<T>;
  }

  // ---- TRANSAKSI ----
  if (seg[1] === "transaksi") {
    const id = seg[2];
    const sub = seg[3];
    if (method === "GET" && !id) {
      const tokoId = q.get("toko_id");
      const search = q.get("q") || "";
      const from = q.get("from");
      const to = q.get("to");
      const limit = Math.min(Number(q.get("limit")) || 50, 500);
      const offset = Number(q.get("offset")) || 0;
      const where: string[] = [];
      const params: unknown[] = [];
      if (tokoId) { where.push("toko_id = ?"); params.push(tokoId); }
      if (search) { where.push("(id LIKE ? OR items_json LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
      if (from) { where.push("created_at >= ?"); params.push(from); }
      if (to) { where.push("created_at <= ?"); params.push(to); }
      const whereClause = where.length ? " WHERE " + where.join(" AND ") : "";
      const total = Number((await dbSelect(`SELECT COUNT(*) as c FROM transaksi${whereClause}`, [...params]))[0]?.c ?? 0);
      const rows = await dbSelect(
        `SELECT * FROM transaksi${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      return { rows, total, limit, offset } as T;
    }
    if (method === "GET" && id && sub === "items") {
      const rows = await dbSelect("SELECT items_json FROM transaksi WHERE id = ?", [id]);
      if (!rows.length) throw new Error("Transaksi tidak ditemukan");
      try { return JSON.parse(rows[0].items_json as string || "[]"); } catch { return [] as T; }
    }
    if (method === "GET" && id) {
      const rows = await dbSelect("SELECT * FROM transaksi WHERE id = ?", [id]);
      if (!rows.length) throw new Error("Transaksi tidak ditemukan");
      return rows[0] as T;
    }
    if (method === "POST") return desktopCall("transaksi.insert", body as TransaksiInsert) as Promise<T>;
    if (method === "DELETE" && id) return desktopCall("transaksi.delete", { id }) as Promise<T>;
  }

  // ---- WALLET ----
  if (seg[1] === "wallet") {
    const sub = seg[2];
    const tokoId = q.get("toko_id") || body.toko_id;
    if (method === "GET" && !sub) {
      if (!tokoId) throw new Error("toko_id wajib");
      await desktopCall("wallet.get", { toko_id: tokoId }); // pastikan wallet ada
      const rows = await dbSelect("SELECT id, balance, updated_at FROM wallets WHERE toko_id = ?", [tokoId]);
      return (rows[0] ?? { id: null, balance: 0, updated_at: null }) as T;
    }
    if (method === "GET" && sub === "history") {
      if (!tokoId) throw new Error("toko_id wajib");
      const wRows = await dbSelect("SELECT id FROM wallets WHERE toko_id = ?", [tokoId]);
      if (!wRows.length) return { transactions: [] } as T;
      const limit = Math.min(Number(q.get("limit")) || 5, 100);
      const txs = await dbSelect(
        "SELECT id, type, amount, description, created_at FROM wallet_transactions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT ?",
        [wRows[0].id, limit],
      );
      return { transactions: txs } as T;
    }
    if (method === "POST" && sub === "topup") {
      if (!tokoId) throw new Error("toko_id wajib");
      const amount = Math.round(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount wajib angka > 0");
      await desktopCall("wallet.credit", { toko_id: tokoId, amount, description: "Top-up saldo" });
      const rows = await dbSelect("SELECT id, balance, updated_at FROM wallets WHERE toko_id = ?", [tokoId]);
      return (rows[0] ?? { balance: amount }) as T;
    }
  }

  // ---- KERTAS STOCK (fotocopy) ----
  if (seg[1] === "kertas-stock") {
    if (method === "GET") {
      const rows = await dbSelect("SELECT stock, updated_at FROM kertas_stock WHERE id = 1");
      return (rows[0] ?? { stock: 0, updated_at: null }) as T;
    }
    if (method === "POST") {
      const amount = Math.round(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount harus bilangan bulat positif");
      if (amount > 100000) throw new Error("Maksimal refill 100.000 lembar");
      await dbExec("UPDATE kertas_stock SET stock = stock + ?, updated_at = datetime('now') WHERE id = 1", [amount]);
      const rows = await dbSelect("SELECT stock, updated_at FROM kertas_stock WHERE id = 1");
      const row = rows[0] ?? { stock: amount, updated_at: null };
      return { stock: row.stock, added: amount, updated_at: row.updated_at } as T;
    }
  }

  // ---- ALERTS ----
  if (seg[1] === "alerts" && method === "GET") {
    if (seg[2] === "low-stock") {
      return dbSelect(
        `SELECT p.*, t.nama as toko_nama FROM produk p
         JOIN toko t ON p.toko_id = t.id
         WHERE p.stok <= p.stock_threshold ORDER BY p.stok ASC`,
      ) as Promise<T>;
    }
    if (seg[2] === "summary") {
      const lowStock = Number((await dbSelect("SELECT COUNT(*) as c FROM produk WHERE stok <= stock_threshold"))[0]?.c ?? 0);
      const expiredSessions = Number((await dbSelect("SELECT COUNT(*) as c FROM sessions WHERE expires_at < datetime('now')"))[0]?.c ?? 0);
      const todayTransactions = Number((await dbSelect("SELECT COUNT(*) as c FROM transaksi WHERE date(created_at) = date('now')"))[0]?.c ?? 0);
      return { low_stock: lowStock, expired_sessions: expiredSessions, today_transactions: todayTransactions } as T;
    }
  }

  // ---- AUDIT ----
  if (seg[1] === "audit-logs" && method === "GET") {
    const entityType = q.get("entity_type");
    const rows = entityType
      ? await dbSelect("SELECT * FROM audit_logs WHERE entity_type = ? ORDER BY created_at DESC", [entityType])
      : await dbSelect("SELECT * FROM audit_logs ORDER BY created_at DESC");
    return { rows } as T;
  }

  // ---- USERS (online-only untuk tulis; baca lokal) ----
  if (seg[1] === "users") {
    const id = seg[2];
    if (method === "GET") {
      return dbSelect("SELECT id, username, nama, role, created_at FROM users ORDER BY created_at DESC") as Promise<T>;
    }
    throw new Error("User management hanya tersedia saat online");
  }

  return null; // path tidak didukung offline → lanjut HTTP (online)
}

export async function api<T = any>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  // Electrobun mode: jalankan offline via local SQLite RPC
  if (isElectrobun()) {
    const local = await localApi<T>(path, opts);
    if (local !== null) return local;
    // kalau null (mis. path server-only) → lanjut HTTP; backend mungkin spawn
  }

  // DEV_MODE bypass — /api/v1/auth/* juga di-mock, path lain tetap ke backend
  if (DEV_MODE && (isAuthPath(path) || path.startsWith("/api/v1/auth/"))) {
    return mockAuthResponse<T>(path, opts);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> || {}),
  };

  // Tambah CSRF token untuk non-GET requests (dari memory atau cookie fallback)
  if (opts.method && !["GET", "HEAD"].includes(opts.method.toUpperCase())) {
    const token = getCsrfToken();
    if (token) headers["x-csrf-token"] = token;
  }

  // Idempotency key untuk POST — mencegah duplikasi kalau user klik ganda
  if (opts.method && opts.method.toUpperCase() === "POST") {
    headers["x-idempotency-key"] = crypto.randomUUID();
  }

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data as T;
}
