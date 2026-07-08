import { randomUUID } from "node:crypto";
import { db } from "../db";
import { json, parseBody, requireRole, assertCanWrite, logAudit } from "../helpers";
import { validateProdukCreate, validateProdukUpdate } from "../../shared/validation";

// ============================================================
// Produk Routes
// ============================================================
export const produkRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  "GET /api/produk": (req) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const url = new URL(req.url);
    const tokoId = url.searchParams.get("toko_id");
    const rows = tokoId
      ? db.query("SELECT * FROM produk WHERE toko_id = ? ORDER BY created_at DESC").all(tokoId)
      : db.query("SELECT * FROM produk ORDER BY created_at DESC").all();
    return json(rows);
  },

  "GET /api/produk/:id": (req, path) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const row = db.query("SELECT * FROM produk WHERE id = ?").get(path[2]);
    if (!row) return json({ error: "Produk tidak ditemukan" }, 404);
    return json(row);
  },

  "POST /api/produk": async (req) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateProdukCreate(body);
    if (!v.ok) return json({ error: v.error }, 400);
    // Validasi toko exists
    const toko = db.query("SELECT id FROM toko WHERE id = ?").get(v.data.toko_id);
    if (!toko) return json({ error: "Toko tidak ditemukan" }, 400);
    const id = randomUUID();
    db.run(
      "INSERT INTO produk (id, toko_id, nama, harga, stok, stock_threshold) VALUES (?, ?, ?, ?, ?, ?)",
      [id, v.data.toko_id, v.data.nama, v.data.harga || 0, v.data.stok || 0, v.data.stock_threshold ?? 10]
    );
    logAudit({ user_id: user.id, username: user.username, action: "CREATE", entity_type: "produk", entity_id: id, details: { nama: v.data.nama, toko_id: v.data.toko_id } });
    const row = db.query("SELECT * FROM produk WHERE id = ?").get(id);
    return json(row, 201);
  },

  "PATCH /api/produk/:id": async (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const id = path[2];
    const e = db.query("SELECT * FROM produk WHERE id = ?").get(id) as any;
    if (!e) return json({ error: "Produk tidak ditemukan" }, 404);
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateProdukUpdate(body);
    if (!v.ok) return json({ error: v.error }, 400);
    db.run("UPDATE produk SET nama=?, harga=?, stok=?, stock_threshold=? WHERE id=?", [
      v.data.nama ?? e.nama, v.data.harga ?? e.harga, v.data.stok ?? e.stok, v.data.stock_threshold ?? e.stock_threshold, id,
    ]);
    logAudit({ user_id: user.id, username: user.username, action: "UPDATE", entity_type: "produk", entity_id: id, details: { nama: v.data.nama || e.nama, stok: v.data.stok ?? e.stok } });
    const row = db.query("SELECT * FROM produk WHERE id = ?").get(id);
    return json(row);
  },

  "DELETE /api/produk/:id": (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const id = path[2];
    const existing = db.query("SELECT nama FROM produk WHERE id = ?").get(id) as any;
    if (!existing) return json({ error: "Produk tidak ditemukan" }, 404);
    const r = db.run("DELETE FROM produk WHERE id = ?", [id]);
    if (r.changes === 0) return json({ error: "Produk tidak ditemukan" }, 404);
    logAudit({ user_id: user.id, username: user.username, action: "DELETE", entity_type: "produk", entity_id: id, details: { nama: existing.nama } });
    return json({ ok: true });
  },
};
