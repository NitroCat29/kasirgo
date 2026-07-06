import { randomUUID } from "node:crypto";
import { db } from "../db";
import { json, parseBody, requireRole, logAudit } from "../helpers";

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
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    if (!body.nama || typeof body.nama !== "string" || body.nama.trim().length === 0) {
      return json({ error: "Nama produk wajib diisi" }, 400);
    }
    if (!body.toko_id || typeof body.toko_id !== "string") {
      return json({ error: "toko_id wajib diisi" }, 400);
    }
    // Validasi toko exists
    const toko = db.query("SELECT id FROM toko WHERE id = ?").get(body.toko_id);
    if (!toko) return json({ error: "Toko tidak ditemukan" }, 400);
    if (body.harga !== undefined && (typeof body.harga !== "number" || body.harga < 0)) {
      return json({ error: "Harga harus angka >= 0" }, 400);
    }
    if (body.stok !== undefined && (typeof body.stok !== "number" || body.stok < 0)) {
      return json({ error: "Stok harus angka >= 0" }, 400);
    }
    if (body.stock_threshold !== undefined && (typeof body.stock_threshold !== "number" || body.stock_threshold < 0)) {
      return json({ error: "stock_threshold harus angka >= 0" }, 400);
    }
    const id = randomUUID();
    db.run(
      "INSERT INTO produk (id, toko_id, nama, harga, stok, stock_threshold) VALUES (?, ?, ?, ?, ?, ?)",
      [id, body.toko_id, body.nama.trim(), body.harga || 0, body.stok || 0, body.stock_threshold ?? 10]
    );
    logAudit({ user_id: user.id, username: user.username, action: "CREATE", entity_type: "produk", entity_id: id, details: { nama: body.nama, toko_id: body.toko_id } });
    const row = db.query("SELECT * FROM produk WHERE id = ?").get(id);
    return json(row, 201);
  },

  "PATCH /api/produk/:id": async (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const id = path[2];
    const e = db.query("SELECT * FROM produk WHERE id = ?").get(id) as any;
    if (!e) return json({ error: "Produk tidak ditemukan" }, 404);
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    if (body.nama !== undefined && (typeof body.nama !== "string" || body.nama.trim().length === 0)) {
      return json({ error: "Nama produk tidak boleh kosong" }, 400);
    }
    if (body.harga !== undefined && (typeof body.harga !== "number" || body.harga < 0)) {
      return json({ error: "Harga harus angka >= 0" }, 400);
    }
    if (body.stok !== undefined && (typeof body.stok !== "number" || body.stok < 0)) {
      return json({ error: "Stok harus angka >= 0" }, 400);
    }
    if (body.stock_threshold !== undefined && (typeof body.stock_threshold !== "number" || body.stock_threshold < 0)) {
      return json({ error: "stock_threshold harus angka >= 0" }, 400);
    }
    db.run("UPDATE produk SET nama=?, harga=?, stok=?, stock_threshold=? WHERE id=?", [
      body.nama ? body.nama.trim() : e.nama, body.harga ?? e.harga, body.stok ?? e.stok, body.stock_threshold ?? e.stock_threshold, id,
    ]);
    logAudit({ user_id: user.id, username: user.username, action: "UPDATE", entity_type: "produk", entity_id: id, details: { nama: body.nama || e.nama, stok: body.stok ?? e.stok } });
    const row = db.query("SELECT * FROM produk WHERE id = ?").get(id);
    return json(row);
  },

  "DELETE /api/produk/:id": (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const id = path[2];
    const existing = db.query("SELECT nama FROM produk WHERE id = ?").get(id) as any;
    if (!existing) return json({ error: "Produk tidak ditemukan" }, 404);
    const r = db.run("DELETE FROM produk WHERE id = ?", [id]);
    if (r.changes === 0) return json({ error: "Produk tidak ditemukan" }, 404);
    logAudit({ user_id: user.id, username: user.username, action: "DELETE", entity_type: "produk", entity_id: id, details: { nama: existing.nama } });
    return json({ ok: true });
  },
};
