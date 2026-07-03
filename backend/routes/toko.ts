import { randomUUID } from "node:crypto";
import { db } from "../db";
import { json, parseBody, getUser } from "../helpers";

// ============================================================
// Toko Routes
// ============================================================
export const tokoRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  "GET /api/toko": (req) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    const rows = db.query("SELECT * FROM toko ORDER BY created_at DESC").all();
    return json(rows);
  },

  "GET /api/toko/:id": (req, path) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    const row = db.query("SELECT * FROM toko WHERE id = ?").get(path[2]);
    if (!row) return json({ error: "Toko tidak ditemukan" }, 404);
    return json(row);
  },

  "POST /api/toko": async (req) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    if (!body.nama || typeof body.nama !== "string" || body.nama.trim().length === 0) {
      return json({ error: "Nama toko wajib diisi" }, 400);
    }
    const id = randomUUID();
    db.run(
      "INSERT INTO toko (id, nama, alamat, telepon) VALUES (?, ?, ?, ?)",
      [id, body.nama.trim(), body.alamat || null, body.telepon || null]
    );
    const row = db.query("SELECT * FROM toko WHERE id = ?").get(id);
    return json(row, 201);
  },

  "PATCH /api/toko/:id": async (req, path) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    const id = path[2];
    const existing = db.query("SELECT * FROM toko WHERE id = ?").get(id) as any;
    if (!existing) return json({ error: "Toko tidak ditemukan" }, 404);
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    if (body.nama !== undefined && (typeof body.nama !== "string" || body.nama.trim().length === 0)) {
      return json({ error: "Nama toko tidak boleh kosong" }, 400);
    }
    const nama = body.nama ? body.nama.trim() : existing.nama;
    const alamat = body.alamat !== undefined ? body.alamat : existing.alamat;
    const telepon = body.telepon !== undefined ? body.telepon : existing.telepon;
    db.run("UPDATE toko SET nama=?, alamat=?, telepon=? WHERE id=?", [nama, alamat, telepon, id]);
    const row = db.query("SELECT * FROM toko WHERE id = ?").get(id);
    return json(row);
  },

  "DELETE /api/toko/:id": (req, path) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    const r = db.run("DELETE FROM toko WHERE id = ?", [path[2]]);
    if (r.changes === 0) return json({ error: "Toko tidak ditemukan" }, 404);
    return json({ ok: true });
  },
};
