import { randomUUID } from "node:crypto";
import { db } from "../db";
import { json, parseBody, requireRole, assertCanWrite, logAudit, clientIp, checkWriteRateLimit, checkIdempotency } from "../helpers";
import { validateTokoCreate, validateTokoUpdate } from "../../shared/validation";

// ============================================================
// Toko Routes
// ============================================================
export const tokoRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  "GET /api/toko": (req) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const rows = db.query("SELECT * FROM toko ORDER BY created_at DESC").all();
    return json(rows);
  },

  "GET /api/toko/:id": (req, path) => {
    const user = requireRole(req, ["admin", "manajer", "kasir"]);
    if (user instanceof Response) return user;
    const row = db.query("SELECT * FROM toko WHERE id = ?").get(path[2]);
    if (!row) return json({ error: "Toko tidak ditemukan" }, 404);
    return json(row);
  },

  "POST /api/toko": async (req) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const rl = checkWriteRateLimit(clientIp(req));
    if (!rl.allowed) return json({ error: "Terlalu banyak request, coba lagi nanti" }, 429);
    const idemKey = req.headers.get("x-idempotency-key");
    if (idemKey) {
      const idem = checkIdempotency(idemKey);
      if (!idem.allowed) return json({ error: "Request duplikat terdeteksi" }, 409);
    }
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateTokoCreate(body);
    if (!v.ok) return json({ error: v.error }, 400);
    const id = randomUUID();
    db.run(
      "INSERT INTO toko (id, nama, alamat, telepon) VALUES (?, ?, ?, ?)",
      [id, v.data.nama, v.data.alamat || null, v.data.telepon || null]
    );
    logAudit({ user_id: user.id, username: user.username, action: "CREATE", entity_type: "toko", entity_id: id, details: { nama: v.data.nama } });
    const row = db.query("SELECT * FROM toko WHERE id = ?").get(id);
    return json(row, 201);
  },

  "PATCH /api/toko/:id": async (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const rl = checkWriteRateLimit(clientIp(req));
    if (!rl.allowed) return json({ error: "Terlalu banyak request, coba lagi nanti" }, 429);
    const id = path[2];
    const existing = db.query("SELECT * FROM toko WHERE id = ?").get(id) as any;
    if (!existing) return json({ error: "Toko tidak ditemukan" }, 404);
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateTokoUpdate(body);
    if (!v.ok) return json({ error: v.error }, 400);
    const nama = v.data.nama ?? existing.nama;
    const alamat = v.data.alamat ?? existing.alamat;
    const telepon = v.data.telepon ?? existing.telepon;
    db.run("UPDATE toko SET nama=?, alamat=?, telepon=? WHERE id=?", [nama, alamat, telepon, id]);
    logAudit({ user_id: user.id, username: user.username, action: "UPDATE", entity_type: "toko", entity_id: id, details: { nama, alamat, telepon } });
    const row = db.query("SELECT * FROM toko WHERE id = ?").get(id);
    return json(row);
  },

  "DELETE /api/toko/:id": (req, path) => {
    const user = requireRole(req, ["admin", "manajer"]);
    if (user instanceof Response) return user;
    const writeBlocked = assertCanWrite(user);
    if (writeBlocked) return writeBlocked;
    const rl = checkWriteRateLimit(clientIp(req));
    if (!rl.allowed) return json({ error: "Terlalu banyak request, coba lagi nanti" }, 429);
    const id = path[2];
    const existing = db.query("SELECT nama FROM toko WHERE id = ?").get(id) as any;
    if (!existing) return json({ error: "Toko tidak ditemukan" }, 404);
    const r = db.run("DELETE FROM toko WHERE id = ?", [id]);
    if (r.changes === 0) return json({ error: "Toko tidak ditemukan" }, 404);
    logAudit({ user_id: user.id, username: user.username, action: "DELETE", entity_type: "toko", entity_id: id, details: { nama: existing.nama } });
    return json({ ok: true });
  },
};
