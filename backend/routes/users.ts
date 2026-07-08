import { randomUUID } from "node:crypto";
import { db } from "../db";
import { json, parseBody, requireRole, assertCanWrite, logAudit } from "../helpers";

// ============================================================
// User Management Routes (admin only)
// ============================================================
// Password dikirim sebagai SHA-256 dari client (konsisten dengan flow auth).
// Backend Bun.password.hash() sebelum simpan.

const VALID_ROLES = ["admin", "manajer", "kasir"];

function validateUserCreate(body: any): { ok: true; data: any } | { ok: false; error: string } {
  if (!body.username || typeof body.username !== "string" || body.username.trim().length < 3)
    return { ok: false, error: "Username minimal 3 karakter" };
  if (!body.password || typeof body.password !== "string" || body.password.length < 6)
    return { ok: false, error: "Password minimal 6 karakter (sudah di-SHA-256, jadi 64 hex chars)" };
  if (!body.nama || typeof body.nama !== "string" || body.nama.trim().length === 0)
    return { ok: false, error: "Nama wajib diisi" };
  const role = body.role || "kasir";
  if (!VALID_ROLES.includes(role))
    return { ok: false, error: "Role harus salah satu: admin, manajer, kasir" };
  return { ok: true, data: { username: body.username.trim(), password: body.password, nama: body.nama.trim(), role } };
}

function validateUserUpdate(body: any): { ok: true; data: any } | { ok: false; error: string } {
  if (body.nama !== undefined && (typeof body.nama !== "string" || body.nama.trim().length === 0))
    return { ok: false, error: "Nama tidak boleh kosong" };
  if (body.role !== undefined && !VALID_ROLES.includes(body.role))
    return { ok: false, error: "Role harus salah satu: admin, manajer, kasir" };
  if (body.password !== undefined && (typeof body.password !== "string" || body.password.length < 6))
    return { ok: false, error: "Password minimal 6 karakter" };
  return {
    ok: true,
    data: {
      nama: body.nama !== undefined ? body.nama.trim() : undefined,
      role: body.role,
      password: body.password,
    },
  };
}

export const usersRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  "GET /api/users": (req) => {
    const user = requireRole(req, ["admin"]);
    if (user instanceof Response) return user;
    const rows = db.query(
      "SELECT id, username, nama, role, created_at FROM users ORDER BY created_at DESC"
    ).all();
    return json(rows);
  },

  "POST /api/users": async (req) => {
    const admin = requireRole(req, ["admin"]);
    if (admin instanceof Response) return admin;
    const writeBlocked = assertCanWrite(admin);
    if (writeBlocked) return writeBlocked;
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateUserCreate(body);
    if (!v.ok) return json({ error: v.error }, 400);

    const exists = db.query("SELECT id FROM users WHERE username = ?").get(v.data.username);
    if (exists) return json({ error: "Username sudah dipakai" }, 409);

    const id = randomUUID();
    const hash = await Bun.password.hash(v.data.password);
    db.run(
      "INSERT INTO users (id, username, password_hash, nama, role) VALUES (?, ?, ?, ?, ?)",
      [id, v.data.username, hash, v.data.nama, v.data.role]
    );
    logAudit({
      user_id: admin.id,
      username: admin.username,
      action: "CREATE",
      entity_type: "user",
      entity_id: id,
      details: { username: v.data.username, nama: v.data.nama, role: v.data.role },
    });
    const row = db.query("SELECT id, username, nama, role, created_at FROM users WHERE id = ?").get(id);
    return json(row, 201);
  },

  "PATCH /api/users/:id": async (req, path) => {
    const admin = requireRole(req, ["admin"]);
    if (admin instanceof Response) return admin;
    const writeBlocked = assertCanWrite(admin);
    if (writeBlocked) return writeBlocked;
    const id = path[2];
    const existing = db.query("SELECT id, username, nama, role FROM users WHERE id = ?").get(id) as any;
    if (!existing) return json({ error: "User tidak ditemukan" }, 404);

    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateUserUpdate(body);
    if (!v.ok) return json({ error: v.error }, 400);

    const nama = v.data.nama ?? existing.nama;
    const role = v.data.role ?? existing.role;

    if (v.data.password) {
      const hash = await Bun.password.hash(v.data.password);
      db.run(
        "UPDATE users SET nama=?, role=?, password_hash=? WHERE id=?",
        [nama, role, hash, id]
      );
    } else {
      db.run("UPDATE users SET nama=?, role=? WHERE id=?", [nama, role, id]);
    }

    logAudit({
      user_id: admin.id,
      username: admin.username,
      action: "UPDATE",
      entity_type: "user",
      entity_id: id,
      details: {
        username: existing.username,
        nama_baru: nama,
        role_baru: role,
        password_reset: !!v.data.password,
      },
    });

    const row = db.query("SELECT id, username, nama, role, created_at FROM users WHERE id = ?").get(id);
    return json(row);
  },

  "DELETE /api/users/:id": (req, path) => {
    const admin = requireRole(req, ["admin"]);
    if (admin instanceof Response) return admin;
    const writeBlocked = assertCanWrite(admin);
    if (writeBlocked) return writeBlocked;
    const id = path[2];

    // Tidak boleh hapus diri sendiri
    if (admin.id === id) {
      return json({ error: "Tidak boleh menghapus akun sendiri" }, 400);
    }

    const existing = db.query("SELECT username, nama, role FROM users WHERE id = ?").get(id) as any;
    if (!existing) return json({ error: "User tidak ditemukan" }, 404);

    const r = db.run("DELETE FROM users WHERE id = ?", [id]);
    if (r.changes === 0) return json({ error: "User tidak ditemukan" }, 404);

    logAudit({
      user_id: admin.id,
      username: admin.username,
      action: "DELETE",
      entity_type: "user",
      entity_id: id,
      details: { deleted_username: existing.username, deleted_role: existing.role },
    });
    return json({ ok: true });
  },
};
