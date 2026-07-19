import { db } from "./db";
import { json, getUser } from "./helpers";
import { authRoutes } from "./routes/auth";
import { tokoRoutes } from "./routes/toko";
import { produkRoutes } from "./routes/produk";
import { transaksiRoutes } from "./routes/transaksi";
import { auditRoutes } from "./routes/audit";
import { alertsRoutes } from "./routes/alerts";
import { usersRoutes } from "./routes/users";
import { walletRoutes } from "./routes/wallet";

// ============================================================
// Router — merge semua routes
// ============================================================
export type Handler = (req: Request, path: string[]) => Response | Promise<Response>;
export const routes: Record<string, Handler> = {};

// Merge semua route modules
Object.assign(routes, authRoutes, tokoRoutes, produkRoutes, transaksiRoutes, auditRoutes, alertsRoutes, usersRoutes, walletRoutes);

// ---- STATS (dashboard) ----
routes["GET /api/stats"] = (req) => {
  const user = getUser(req);
  if (!user) return json({ error: "Belum login" }, 401);
  const tokoCount = (db.query("SELECT COUNT(*) as c FROM toko").get() as any).c;
  const produkCount = (db.query("SELECT COUNT(*) as c FROM produk").get() as any).c;
  const transaksiCount = (db.query("SELECT COUNT(*) as c FROM transaksi").get() as any).c;
  const totalPendapatan = (db.query("SELECT COALESCE(SUM(total),0) as s FROM transaksi").get() as any).s;
  const trxHariIni = (db.query("SELECT COUNT(*) as c FROM transaksi WHERE date(created_at) = date('now')").get() as any).c;
  const pendHariIni = (db.query("SELECT COALESCE(SUM(total),0) as s FROM transaksi WHERE date(created_at) = date('now')").get() as any).s;
  return json({
    toko: tokoCount,
    produk: produkCount,
    transaksi: transaksiCount,
    total_pendapatan: totalPendapatan,
    transaksi_hari_ini: trxHariIni,
    pendapatan_hari_ini: pendHariIni,
  });
};

// ---- DAILY REVENUE (chart data — last N days) ----
routes["GET /api/stats/daily-revenue"] = (req) => {
  const user = getUser(req);
  if (!user) return json({ error: "Belum login" }, 401);
  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 90);

  // Raw rows from DB — only days with at least one transaction
  const rows = db.query(`
    SELECT date(created_at) as day, COALESCE(SUM(total),0) as revenue, COUNT(*) as count
    FROM transaksi
    WHERE created_at >= date('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(days) as { day: string; revenue: number; count: number }[];

  // Build lookup
  const map = new Map<string, { revenue: number; count: number }>();
  for (const r of rows) map.set(r.day, { revenue: r.revenue, count: r.count });

  // Pad with zero-revenue days so chart x-axis is not misleading
  const data: { day: string; revenue: number; count: number }[] = [];
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const hit = map.get(key);
    data.push(hit || { day: key, revenue: 0, count: 0 });
  }

  return json({ days, data });
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
  if (pathSegments.length >= 3) {
    const prefix = `${method} /${pathSegments[0]}/${pathSegments[1]}/`;
    for (const key of Object.keys(routes)) {
      if (key.startsWith(prefix) && key.indexOf(":", prefix.length) === prefix.length) {
        return routes[key];
      }
    }
  }

  return routes[simpleKey] || null;
}
