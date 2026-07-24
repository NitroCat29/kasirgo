// ============================================================
// Kertas Stock routes — global paper stock for fotocopy
// GET  /api/kertas-stock  → read stock (any logged-in user)
// POST /api/kertas-stock  → refill stock (admin/manajer only)
// ============================================================

import { db } from "../db";
import { json, parseBody, requireRole } from "../helpers";

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const kertasRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {

  // GET /api/kertas-stock
  "GET /api/kertas-stock": (req) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;

    const row = db.query("SELECT stock, updated_at FROM kertas_stock WHERE id = 1").get() as {
      stock: number;
      updated_at: string;
    } | undefined;

    return jsonResp({ stock: row?.stock ?? 0, updated_at: row?.updated_at ?? null });
  },

  // POST /api/kertas-stock  { "action": "refill", "amount": 500 }
  "POST /api/kertas-stock": async (req) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;

    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const amount = Number(body?.amount);

    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      return jsonResp({ error: "Amount harus bilangan bulat positif" }, 400);
    }

    if (amount > 100000) {
      return jsonResp({ error: "Maksimal refill 100.000 lembar" }, 400);
    }

    db.run(
      "UPDATE kertas_stock SET stock = stock + ?, updated_at = datetime('now') WHERE id = 1",
      [amount],
    );

    const updated = db.query("SELECT stock, updated_at FROM kertas_stock WHERE id = 1").get() as {
      stock: number;
      updated_at: string;
    };

    return jsonResp({ stock: updated.stock, added: amount, updated_at: updated.updated_at });
  },
};
