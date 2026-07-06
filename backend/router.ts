import { db } from "./db";
import { json, getUser } from "./helpers";
import { authRoutes } from "./routes/auth";
import { tokoRoutes } from "./routes/toko";
import { produkRoutes } from "./routes/produk";
import { transaksiRoutes } from "./routes/transaksi";
import { auditRoutes } from "./routes/audit";
import { alertsRoutes } from "./routes/alerts";

// ============================================================
// Router — merge semua routes
// ============================================================
export type Handler = (req: Request, path: string[]) => Response | Promise<Response>;
export const routes: Record<string, Handler> = {};

// Merge semua route modules
Object.assign(routes, authRoutes, tokoRoutes, produkRoutes, transaksiRoutes, auditRoutes, alertsRoutes);

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

// ============================================================
// Resolve handler dari request
// ============================================================
export function resolveHandler(req: Request, pathSegments: string[]): Handler | null {
  const simpleKey = `${req.method} /${pathSegments.slice(0, 2).join("/")}`;
  const paramKey = pathSegments.length >= 3 && pathSegments[2]
    ? `${req.method} /${pathSegments[0]}/${pathSegments[1]}/:id`
    : null;

  return routes[`${req.method} /${pathSegments.join("/")}`]
    || routes[simpleKey]
    || (paramKey ? routes[paramKey] : null)
    || null;
}
