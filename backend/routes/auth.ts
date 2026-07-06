import { randomUUID } from "node:crypto";
import { db } from "../db";
import { json, parseBody, getUser, requireRole, makeSessionCookie, cleanupExpiredSessions, checkRateLimit, logAudit } from "../helpers";

// ============================================================
// Auth Routes
// ============================================================
export const authRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {
  "POST /api/auth/signup": async (req) => {
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    if (!body.username || !body.password || !body.nama) {
      return json({ error: "username, password, nama wajib diisi" }, 400);
    }
    if (typeof body.username !== "string" || body.username.length < 3) {
      return json({ error: "Username minimal 3 karakter" }, 400);
    }
    if (typeof body.password !== "string" || body.password.length < 6) {
      return json({ error: "Password minimal 6 karakter" }, 400);
    }
    const exists = db.query("SELECT id FROM users WHERE username = ?").get(body.username);
    if (exists) return json({ error: "Username sudah dipakai" }, 409);

    const id = randomUUID();
    const hash = await Bun.password.hash(body.password);
    // Only admin can assign non-kasir roles during signup
    const assignedRole = body.role === "admin" || body.role === "manajer" ? body.role : "kasir";
    db.run(
      "INSERT INTO users (id, username, password_hash, nama, role) VALUES (?, ?, ?, ?, ?)",
      [id, body.username, hash, body.nama, assignedRole]
    );
    logAudit({ user_id: id, username: body.username, action: "CREATE", entity_type: "user", entity_id: id, details: { role: assignedRole, self_signup: true } });
    const { sessionCookie, csrfCookie, csrfToken } = makeSessionCookie(id);
    const res = json({ id, username: body.username, nama: body.nama, role: assignedRole, csrf_token: csrfToken }, 201);
    res.headers.set("set-cookie", sessionCookie);
    res.headers.append("set-cookie", csrfCookie);
    return res;
  },

  "POST /api/auth/login": async (req) => {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfter} detik.` }, 429);
    }

    const { data: body, error } = await parseBody(req);
    if (error) return error;
    if (!body.username || !body.password) {
      return json({ error: "username dan password wajib diisi" }, 400);
    }
    const user = db.query("SELECT * FROM users WHERE username = ?").get(body.username) as any;
    if (!user) return json({ error: "Username atau password salah" }, 401);

    const ok = await Bun.password.verify(body.password, user.password_hash);
    if (!ok) return json({ error: "Username atau password salah" }, 401);

    cleanupExpiredSessions();

    const { sessionCookie, csrfCookie, csrfToken } = makeSessionCookie(user.id);
    logAudit({ user_id: user.id, username: user.username, action: "LOGIN", entity_type: "auth", ip });
    const res = json({ id: user.id, username: user.username, nama: user.nama, role: user.role, csrf_token: csrfToken });
    res.headers.set("set-cookie", sessionCookie);
    res.headers.append("set-cookie", csrfCookie);
    return res;
  },

  "POST /api/auth/logout": (req) => {
    const cookie = req.headers.get("cookie") || "";
    const match = cookie.match(/session=([^;]+)/);
    if (match) {
      const session = db.query("SELECT user_id FROM sessions WHERE token = ?").get(match[1]) as any;
      if (session) {
        const u = db.query("SELECT username FROM users WHERE id = ?").get(session.user_id) as any;
        if (u) logAudit({ user_id: session.user_id, username: u.username, action: "LOGOUT", entity_type: "auth" });
      }
      db.run("DELETE FROM sessions WHERE token = ?", [match[1]]);
    }
    const res = json({ ok: true });
    res.headers.set("set-cookie", "session=; Path=/; HttpOnly; Max-Age=0");
    res.headers.append("set-cookie", "csrf_token=; Path=/; Max-Age=0");
    return res;
  },

  "GET /api/auth/me": (req) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    return json(user);
  },
};
