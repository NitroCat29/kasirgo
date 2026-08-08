import { db } from "./db";
import { json, getUser } from "./helpers";
import { authRoutes } from "./routes/auth";
import { totpRoutes } from "./routes/totp";
import { tokoRoutes } from "./routes/toko";
import { produkRoutes } from "./routes/produk";
import { transaksiRoutes } from "./routes/transaksi";
import { auditRoutes } from "./routes/audit";
import { alertsRoutes } from "./routes/alerts";
import { usersRoutes } from "./routes/users";
import { walletRoutes } from "./routes/wallet";
import { kertasRoutes } from "./routes/kertas";
import { backupRoutes } from "./routes/backup";

// ============================================================
// Router — merge semua routes
// ============================================================
export type Handler = (req: Request, path: string[]) => Response | Promise<Response>;
export const routes: Record<string, Handler> = {};

// Merge semua route modules
Object.assign(routes, authRoutes, totpRoutes, tokoRoutes, produkRoutes, transaksiRoutes, auditRoutes, alertsRoutes, usersRoutes, walletRoutes, kertasRoutes, backupRoutes);

// ---- STATS (dashboard) ----
routes["GET /api/stats"] = (req) => {
  const user = getUser(req);
  if (!user) return json({ error: "Belum login" }, 401);
  const tokoCount = (db.query("SELECT COUNT(*) as c FROM toko").get() as any).c;
  const produkCount = (db.query("SELECT COUNT(*) as c FROM produk").get() as any).c;
  const transaksiCount = (db.query("SELECT COUNT(*) as c FROM transaksi").get() as any).c;
  const trxHariIni = (db.query("SELECT COUNT(*) as c FROM transaksi WHERE date(created_at) = date('now')").get() as any).c;

  // Pendapatan per periode (UTC, match SQLite date())
  const sumPendapatan = (clause: string) =>
    (db.query(`SELECT COALESCE(SUM(total),0) as s FROM transaksi ${clause}`).get() as any).s as number;

  const pendapatan_hari_ini = sumPendapatan("WHERE date(created_at) = date('now')");
  const pendapatan_7_hari = sumPendapatan("WHERE date(created_at) >= date('now', '-6 days')");
  const pendapatan_30_hari = sumPendapatan("WHERE date(created_at) >= date('now', '-29 days')");
  const total_pendapatan = sumPendapatan("");

  return json({
    toko: tokoCount,
    produk: produkCount,
    transaksi: transaksiCount,
    transaksi_hari_ini: trxHariIni,
    pendapatan_hari_ini,
    pendapatan_7_hari,
    pendapatan_30_hari,
    total_pendapatan,
  });
};

// ---- DAILY REVENUE (chart data — last N days; days=1 → hourly 24h) ----
routes["GET /api/stats/daily-revenue"] = (req) => {
  const user = getUser(req);
  if (!user) return json({ error: "Belum login" }, 401);
  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 90);

  // 1-day view: micro range — 24 hourly buckets (rolling last 24h, UTC)
  if (days === 1) {
    const revRows = db.query(`
      SELECT strftime('%Y-%m-%dT%H:00:00Z', created_at) as day,
             COALESCE(SUM(total),0) as revenue, COUNT(*) as count
      FROM transaksi
      WHERE created_at >= datetime('now', '-23 hours')
      GROUP BY strftime('%Y-%m-%d %H', created_at)
      ORDER BY day ASC
    `).all() as { day: string; revenue: number; count: number }[];

    const expRows = db.query(`
      SELECT strftime('%Y-%m-%dT%H:00:00Z', created_at) as day,
             COALESCE(SUM(amount),0) as expense
      FROM wallet_transactions
      WHERE type = 'purchase'
        AND created_at >= datetime('now', '-23 hours')
      GROUP BY strftime('%Y-%m-%d %H', created_at)
      ORDER BY day ASC
    `).all() as { day: string; expense: number }[];

    const revMap = new Map<string, { revenue: number; count: number }>();
    for (const r of revRows) revMap.set(r.day, { revenue: r.revenue, count: r.count });
    const expMap = new Map<string, number>();
    for (const r of expRows) expMap.set(r.day, r.expense);

    const data: { day: string; revenue: number; count: number; expense: number }[] = [];
    const now = new Date();
    // Align to current UTC hour floor
    const hourMs = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
    );
    for (let i = 23; i >= 0; i--) {
      const d = new Date(hourMs - i * 3600000);
      // slice YYYY-MM-DDTHH + :00:00Z — jangan regex replace :ss.mmm (bikin T16:00:00:00Z invalid)
      const key = d.toISOString().slice(0, 13) + ":00:00Z";
      const hit = revMap.get(key);
      data.push({
        day: key,
        revenue: hit?.revenue ?? 0,
        count: hit?.count ?? 0,
        expense: expMap.get(key) ?? 0,
      });
    }

    return json({ days: 1, granularity: "hour", data });
  }

  // Revenue: sales (transaksi)
  const revRows = db.query(`
    SELECT date(created_at) as day, COALESCE(SUM(total),0) as revenue, COUNT(*) as count
    FROM transaksi
    WHERE date(created_at) >= date('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(days - 1) as { day: string; revenue: number; count: number }[];

  // Expense: restock/stok purchases from wallet
  const expRows = db.query(`
    SELECT date(created_at) as day, COALESCE(SUM(amount),0) as expense
    FROM wallet_transactions
    WHERE type = 'purchase'
      AND date(created_at) >= date('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(days - 1) as { day: string; expense: number }[];

  const revMap = new Map<string, { revenue: number; count: number }>();
  for (const r of revRows) revMap.set(r.day, { revenue: r.revenue, count: r.count });
  const expMap = new Map<string, number>();
  for (const r of expRows) expMap.set(r.day, r.expense);

  // Pad with zero days so chart x-axis is continuous (UTC = SQLite date())
  const data: { day: string; revenue: number; count: number; expense: number }[] = [];
  const now = new Date();
  const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1);
  for (let i = 0; i < days; i++) {
    const d = new Date(startMs + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const hit = revMap.get(key);
    data.push({
      day: key,
      revenue: hit?.revenue ?? 0,
      count: hit?.count ?? 0,
      expense: expMap.get(key) ?? 0,
    });
  }

  return json({ days, granularity: "day", data });
};

// ============================================================
// Resolve handler dari request
// ============================================================
export function resolveHandler(req: Request): Handler | null {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const method = req.method;

  // Exact match: "GET /api/stats"
  const exactKey = `${method} /${pathSegments.join("/")}`;
  if (routes[exactKey]) return routes[exactKey];

  // Simple key (no params)
  const simpleKey = `${method} /${pathSegments[0]}/${pathSegments[1] || ""}`;

  // Parametric match: /api/toko/abc-123 → match route key ".../:id"
  // Prefer longest match (most specific): /api/transaksi/:id/items beats /api/transaksi/:id
  if (pathSegments.length >= 3) {
    const prefix = `${method} /${pathSegments[0]}/${pathSegments[1]}/`;
    let bestKey: string | null = null;
    let bestDepth = 0;
    for (const key of Object.keys(routes)) {
      if (key.startsWith(prefix) && key.indexOf(":", prefix.length) === prefix.length) {
        const depth = key.split("/").length;
        if (depth > bestDepth) {
          bestDepth = depth;
          bestKey = key;
        }
      }
    }
    if (bestKey) return routes[bestKey];
  }

  return routes[simpleKey] || null;
}
