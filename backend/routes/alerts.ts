import { db } from "../db";
import { json, requireRole, logAudit } from "../helpers";

// ============================================================
// Alerts Routes
// ============================================================
export const alertsRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  "GET /api/alerts/low-stock": (req) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;

    const rows = db.query(`
      SELECT p.*, t.nama as toko_nama 
      FROM produk p 
      JOIN toko t ON p.toko_id = t.id 
      WHERE p.stok <= p.stock_threshold 
      ORDER BY p.stok ASC
    `).all();

    return json(rows);
  },

  "GET /api/alerts/summary": (req) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;

    const lowStockCount = (db.query(`
      SELECT COUNT(*) as c FROM produk WHERE stok <= stock_threshold
    `).get() as any).c;

    const expiredSessions = (db.query(`
      SELECT COUNT(*) as c FROM sessions WHERE expires_at < datetime('now')
    `).get() as any).c;

    const todayTransactions = (db.query(`
      SELECT COUNT(*) as c FROM transaksi WHERE date(created_at) = date('now')
    `).get() as any).c;

    return json({
      low_stock: lowStockCount,
      expired_sessions: expiredSessions,
      today_transactions: todayTransactions,
    });
  },
};
