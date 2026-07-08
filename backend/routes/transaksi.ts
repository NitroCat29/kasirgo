import { randomUUID } from "node:crypto";
import { db } from "../db";
import { json, parseBody, requireRole, assertCanWrite, logAudit } from "../helpers";
import { validateTransaksiCreate, validateTransaksiUpdate } from "../../shared/validation";

// ============================================================
// Transaksi Routes
// ============================================================
export const transaksiRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  "GET /api/transaksi": (req) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const url = new URL(req.url);
    const tokoId = url.searchParams.get("toko_id");
    const rows = tokoId
      ? db.query("SELECT * FROM transaksi WHERE toko_id = ? ORDER BY created_at DESC LIMIT 50").all(tokoId)
      : db.query("SELECT * FROM transaksi ORDER BY created_at DESC LIMIT 50").all();
    return json(rows);
  },

  "GET /api/transaksi/:id": (req, path) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const row = db.query("SELECT * FROM transaksi WHERE id = ?").get(path[2]);
    if (!row) return json({ error: "Transaksi tidak ditemukan" }, 404);
    return json(row);
  },

  "POST /api/transaksi": async (req) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateTransaksiCreate(body);
    if (!v.ok) return json({ error: v.error }, 400);
    const toko = db.query("SELECT id FROM toko WHERE id = ?").get(v.data.toko_id);
    if (!toko) return json({ error: "Toko tidak ditemukan" }, 400);
    const id = randomUUID();
    db.run(
      "INSERT INTO transaksi (id, toko_id, total, tax_rate, discount_rate, items_json) VALUES (?, ?, ?, ?, ?, ?)",
      [id, v.data.toko_id, v.data.total, v.data.tax_rate ?? 11, v.data.discount_rate ?? 0, JSON.stringify(v.data.items)]
    );
    logAudit({ user_id: user.id, username: user.username, action: "CREATE", entity_type: "transaksi", entity_id: id, details: { total: v.data.total, toko_id: v.data.toko_id } });
    const row = db.query("SELECT * FROM transaksi WHERE id = ?").get(id);
    return json(row, 201);
  },

  "PATCH /api/transaksi/:id": async (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const id = path[2];
    const e = db.query("SELECT * FROM transaksi WHERE id = ?").get(id) as any;
    if (!e) return json({ error: "Transaksi tidak ditemukan" }, 404);
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateTransaksiUpdate(body);
    if (!v.ok) return json({ error: v.error }, 400);
    db.run("UPDATE transaksi SET total=?, tax_rate=?, discount_rate=?, items_json=? WHERE id=?", [
      v.data.total ?? e.total,
      v.data.tax_rate ?? e.tax_rate,
      v.data.discount_rate ?? e.discount_rate,
      v.data.items ? JSON.stringify(v.data.items) : e.items_json,
      id,
    ]);
    logAudit({ user_id: user.id, username: user.username, action: "UPDATE", entity_type: "transaksi", entity_id: id, details: { total: v.data.total ?? e.total } });
    const row = db.query("SELECT * FROM transaksi WHERE id = ?").get(id);
    return json(row);
  },

  "DELETE /api/transaksi/:id": (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const id = path[2];
    const existing = db.query("SELECT total FROM transaksi WHERE id = ?").get(id) as any;
    if (!existing) return json({ error: "Transaksi tidak ditemukan" }, 404);
    const r = db.run("DELETE FROM transaksi WHERE id = ?", [id]);
    if (r.changes === 0) return json({ error: "Transaksi tidak ditemukan" }, 404);
    logAudit({ user_id: user.id, username: user.username, action: "DELETE", entity_type: "transaksi", entity_id: id, details: { total: existing.total } });
    return json({ ok: true });
  },
};
