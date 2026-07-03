import { randomUUID, randomBytes } from "node:crypto";
import { db } from "./db";

// ============================================================
// Config (env-based)
// ============================================================
export const config = {
  port: Number(process.env.PORT) || 3456,
  dbPath: process.env.DB_PATH || "backend/db/kasirgo.sqlite",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3456",
  sessionDays: Number(process.env.SESSION_DAYS) || 7,
  cookieSecure: process.env.COOKIE_SECURE === "true",
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 5,
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
};

// ============================================================
// Helpers
// ============================================================
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function parseBody(req: Request): Promise<{ data: any; error?: Response }> {
  const text = await req.text();
  if (!text) return { data: {} };
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { data: null, error: json({ error: "JSON tidak valid" }, 400) };
  }
}

export function getUser(req: Request): any {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const session = db.query(
    "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
  ).get(match[1]) as any;
  if (!session) return null;
  return db.query("SELECT id, username, nama, role FROM users WHERE id = ?").get(session.user_id);
}

export function makeSessionCookie(userId: string): { sessionCookie: string; csrfCookie: string; csrfToken: string } {
  const token = randomUUID();
  const expires = new Date(Date.now() + config.sessionDays * 24 * 3600_000).toISOString();
  db.run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", [token, userId, expires]);

  const secure = config.cookieSecure ? "; Secure" : "";
  const sessionCookie = `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.sessionDays * 86400}${secure}`;

  const csrfToken = randomBytes(32).toString("hex");
  const csrfCookie = `csrf_token=${csrfToken}; Path=/; SameSite=Lax; Max-Age=${config.sessionDays * 86400}${secure}`;

  return { sessionCookie, csrfCookie, csrfToken };
}

// ============================================================
// Rate Limiter (in-memory, per-IP)
// ============================================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + config.rateLimitWindowMs });
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > config.rateLimitMax) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

// Cleanup expired rate limit entries (panggil periodik)
export function cleanupRateLimit() {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}

// ============================================================
// CSRF Validation
// ============================================================
export function validateCsrf(req: Request): boolean {
  // Skip untuk GET, HEAD, OPTIONS (safe methods)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;

  const cookie = req.headers.get("cookie") || "";
  const csrfCookie = cookie.match(/csrf_token=([^;]+)/)?.[1];
  const csrfHeader = req.headers.get("x-csrf-token");

  if (!csrfCookie || !csrfHeader) return false;
  return csrfCookie === csrfHeader;
}

// ============================================================
// Session Cleanup
// ============================================================
export function cleanupExpiredSessions() {
  db.run("DELETE FROM sessions WHERE expires_at < datetime('now')");
}
