import { randomUUID, randomBytes } from "node:crypto";
import { db } from "./db";

// ============================================================
// Config (env-based)
// ============================================================
export const config = {
  port: Number(process.env.PORT) || 3456,
  dbPath: process.env.DB_PATH || "backend/db/kasirgo.sqlite",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  sessionDays: Number(process.env.SESSION_DAYS) || 7,
  cookieSecure: process.env.COOKIE_SECURE === "true",
  cookieDomain: process.env.COOKIE_DOMAIN || "localhost",
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 5,
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  // Mail (Resend API)
  resendApiKey: process.env.RESEND_API_KEY || "",
  mailFrom: process.env.MAIL_FROM || "KasirGo <noreply@kasirgo.app>",
  // Email verification / password reset expiry (minutes)
  verifyCodeExpiryMin: Number(process.env.VERIFY_CODE_EXPIRY_MIN) || 30,
  resetCodeExpiryMin: Number(process.env.RESET_CODE_EXPIRY_MIN) || 15,
  // Public app URL (untuk magic link di email)
  appUrl: process.env.APP_URL || "http://localhost:5173",
  // Rate limit: signup (per IP)
  rateLimitSignupMax: Number(process.env.RATE_LIMIT_SIGNUP_MAX) || 3,
  rateLimitSignupWindowMs: Number(process.env.RATE_LIMIT_SIGNUP_WINDOW_MS) || 3_600_000,
  // Rate limit: forgot-password (per IP+email)
  rateLimitForgotMax: Number(process.env.RATE_LIMIT_FORGOT_MAX) || 3,
  rateLimitForgotWindowMs: Number(process.env.RATE_LIMIT_FORGOT_WINDOW_MS) || 3_600_000,
  // Rate limit: verify-code attempts (per IP)
  rateLimitVerifyMax: Number(process.env.RATE_LIMIT_VERIFY_MAX) || 5,
  rateLimitVerifyWindowMs: Number(process.env.RATE_LIMIT_VERIFY_WINDOW_MS) || 60_000,
  // Rate limit: write endpoints (POST/PATCH/DELETE toko/produk/transaksi/wallet)
  rateLimitWriteMax: Number(process.env.RATE_LIMIT_WRITE_MAX) || 30,
  rateLimitWriteWindowMs: Number(process.env.RATE_LIMIT_WRITE_WINDOW_MS) || 10_000,
  // hCaptcha (anti-bot di signup setelah attempt ke-2 dari IP yang sama)
  // Daftar di https://dashboard.hcaptcha.com — dapat site key + secret.
  // Kalau kosong, hCaptcha check di-skip (mode testing).
  hcaptchaSecret: process.env.HCAPTCHA_SECRET || "",
  hcaptchaSiteKey: process.env.HCAPTCHA_SITE_KEY || "",
  // Dev mode: skip static file serving (frontend di-serve oleh Vite, port 5173)
  devEnv: process.env.DEV_ENV === "true",
};

// ============================================================
// CORS — origin whitelist (support multiple origins via comma)
// ============================================================
const CORS_ALLOWED = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = CORS_ALLOWED.includes(origin) ? origin : CORS_ALLOWED[0];
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,x-csrf-token",
    "vary": "Origin",
  };
}

// ============================================================
// Helpers
// ============================================================
export function json(body: unknown, status = 200, req?: Request): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (req) Object.assign(headers, corsHeaders(req));
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
}

// ============================================================
// Type-safe error response — return { error, code, ...extra }
// ============================================================
// Code adalah stable identifier untuk frontend switch case (gak tergantung
// text message yang bisa berubah). Frontend import AUTH_ERROR_CODES union.
export type AuthErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_NOT_VERIFIED"
  | "AUTH_RATE_LIMITED"
  | "AUTH_EMAIL_TAKEN"
  | "AUTH_USERNAME_TAKEN"
  | "AUTH_EMAIL_NOT_FOUND"
  | "AUTH_TOKEN_INVALID"
  | "AUTH_TOKEN_EXPIRED"
  | "AUTH_CODE_INVALID"
  | "AUTH_CODE_EXPIRED"
  | "AUTH_NO_ACTIVE_CODE"
  | "AUTH_ALREADY_VERIFIED"
  | "AUTH_PASSWORD_REUSE"
  | "AUTH_HCAPTCHA_FAILED"
  | "AUTH_HCAPTCHA_MISSING"
  | "AUTH_INVALID_INPUT"
  | "AUTH_FORBIDDEN"
  | "AUTH_UNAUTHORIZED"
  | "AUTH_INTERNAL";

export function errorResponse(
  code: AuthErrorCode,
  message: string,
  status: number,
  extra?: Record<string, unknown>
): Response {
  const body: Record<string, unknown> = { error: message, code };
  if (extra) Object.assign(body, extra);
  return json(body, status);
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
  return db.query("SELECT id, username, email, nama, role, verified FROM users WHERE id = ?").get(session.user_id);
}

// ============================================================
// RBAC — Role-Based Access Control
// ============================================================
// Roles: admin > manajer > kasir
// admin: full access (users, toko, produk, transaksi, audit, alerts)
// manajer: manage toko, produk, transaksi (no user management, no audit)
// kasir: view toko/produk, create transaksi only

const ROLE_HIERARCHY: Record<string, number> = {
  kasir: 1,
  manajer: 2,
  admin: 3,
  "fake-admin": 3, // demo: akses view layaknya admin, tapi tidak bisa write (lihat assertCanWrite)
};

/**
 * Check if user has the required minimum role level.
 * Returns the user if authorized, or a Response with 403 if not.
 * Usage: const auth = requireRole(req, ["admin"]); if (auth instanceof Response) return auth;
 */
export function requireRole(req: Request, allowedRoles: string[]): any | Response {
  const user = getUser(req);
  if (!user) return json({ error: "Belum login" }, 401);

  const userLevel = ROLE_HIERARCHY[user.role] || 0;
  const minLevel = Math.min(...allowedRoles.map(r => ROLE_HIERARCHY[r] || 0));

  if (userLevel < minLevel) {
    return json({ error: "Akses ditolak: role tidak memadai" }, 403);
  }
  return user;
}

// ============================================================
// Write Guard — block fake-admin (read-only demo account)
// ============================================================
// fake-admin punya level sama dengan admin (lulus requireRole["admin"]),
// tapi tidak boleh melakukan perubahan (POST/PATCH/DELETE).
// Pasang di awal setiap write handler setelah requireRole().
export function assertCanWrite(user: any): Response | null {
  if (user?.role === "fake-admin") {
    return json({ error: "Akun demo bersifat read-only: tidak dapat melakukan perubahan." }, 403);
  }
  return null;
}

export function makeSessionCookie(userId: string): { sessionCookie: string; csrfCookie: string; csrfToken: string } {
  const token = randomUUID();
  const expires = new Date(Date.now() + config.sessionDays * 24 * 3600_000).toISOString();
  db.run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", [token, userId, expires]);

  const secure = config.cookieSecure ? "; Secure" : "";
  // Domain attribute: kalau set (e.g. "localhost" untuk dev), cookie dikirim cross-port.
  // Production biasanya kosong (cookie scoped ke origin domain sendiri).
  const domainAttr = config.cookieDomain ? `; Domain=${config.cookieDomain}` : "";
  const sessionCookie = `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.sessionDays * 86400}${secure}${domainAttr}`;

  const csrfToken = randomBytes(32).toString("hex");
  const csrfCookie = `csrf_token=${csrfToken}; Path=/; SameSite=Lax; Max-Age=${config.sessionDays * 86400}${secure}${domainAttr}`;

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
// Rate Limiters — auth flow (signup / forgot / verify)
// ============================================================
// Map terpisah per-purpose biar gak conflict dengan login limiter.

const signupLimitMap = new Map<string, { count: number; resetAt: number }>();
const forgotLimitMap = new Map<string, { count: number; resetAt: number }>();
const verifyLimitMap = new Map<string, { count: number; resetAt: number }>();

function genericRateLimit(
  map: Map<string, { count: number; resetAt: number }>,
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now > entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

export function checkSignupRateLimit(ip: string) {
  return genericRateLimit(signupLimitMap, ip, config.rateLimitSignupMax, config.rateLimitSignupWindowMs);
}

export function checkForgotRateLimit(key: string) {
  // key = `${ip}:${email}` — limit per IP+email biar brute-force email susah
  return genericRateLimit(forgotLimitMap, key, config.rateLimitForgotMax, config.rateLimitForgotWindowMs);
}

export function checkVerifyRateLimit(ip: string) {
  return genericRateLimit(verifyLimitMap, ip, config.rateLimitVerifyMax, config.rateLimitVerifyWindowMs);
}

export function cleanupAuthRateLimits() {
  const now = Date.now();
  for (const m of [signupLimitMap, forgotLimitMap, verifyLimitMap]) {
    for (const [k, e] of m) if (now > e.resetAt) m.delete(k);
  }
}

// ============================================================
// Rate Limiter — write endpoints (POST/PATCH/DELETE)
// ============================================================
const writeLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkWriteRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  return genericRateLimit(writeLimitMap, ip, config.rateLimitWriteMax, config.rateLimitWriteWindowMs);
}

export function cleanupWriteRateLimit() {
  const now = Date.now();
  for (const [k, e] of writeLimitMap) if (now > e.resetAt) writeLimitMap.delete(k);
}

// ============================================================
// Idempotency Key — mencegah duplikasi request (5 detik window)
// ============================================================
const idempotencyCache = new Map<string, number>(); // key → timestamp
const IDEMPOTENCY_WINDOW_MS = 5_000;

export function checkIdempotency(key: string): { allowed: boolean } {
  const now = Date.now();
  const existing = idempotencyCache.get(key);
  if (existing && (now - existing) < IDEMPOTENCY_WINDOW_MS) {
    return { allowed: false };
  }
  idempotencyCache.set(key, now);
  return { allowed: true };
}

export function cleanupIdempotencyCache() {
  const now = Date.now();
  for (const [k, ts] of idempotencyCache) {
    if ((now - ts) >= IDEMPOTENCY_WINDOW_MS) idempotencyCache.delete(k);
  }
}

// ============================================================
// Verification Code Generator (8-digit) + Token
// ============================================================
export function generate8DigitCode(): string {
  // 8 digit, range 00000000–99999999, zero-padded
  const buf = randomBytes(4); // 32-bit
  const n = buf.readUInt32BE(0) % 100_000_000;
  return n.toString().padStart(8, "0");
}

export function generateVerifyToken(): string {
  return randomUUID();
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

// ============================================================
// Audit Logging
// ============================================================
export function logAudit(opts: {
  user_id?: string;
  username?: string;
  action: string;       // "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"
  entity_type: string;  // "toko", "produk", "transaksi", "user", "auth"
  entity_id?: string;
  details?: Record<string, unknown>;
  ip?: string;
}) {
  const id = randomUUID();
  db.run(
    "INSERT INTO audit_logs (id, user_id, username, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, opts.user_id || null, opts.username || null, opts.action, opts.entity_type, opts.entity_id || null, opts.details ? JSON.stringify(opts.details) : null, opts.ip || null]
  );
}

// ============================================================
// hCaptcha — server-side verification
// ============================================================
// Verifikasi token hCaptcha dari frontend via siteverify API.
// Kalau HCAPTCHA_SECRET kosong → return true (mode testing, skip verify).
// Return false kalau verify gagal (bot suspicion).
export async function verifyHcaptcha(token: string, ip: string): Promise<boolean> {
  if (!config.hcaptchaSecret) return true; // skip di dev/testing

  try {
    const params: Record<string, string> = {
      secret: config.hcaptchaSecret,
      response: token,
    };
    // remoteip opsional — skip kalau "unknown" atau kosong (hCaptcha reject invalid IP)
    if (ip && ip !== "unknown") params.remoteip = ip;
    const res = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
    const data = await res.json() as any;
    return data.success === true;
  } catch (err) {
    console.error("hCaptcha verify error:", err);
    return false;
  }
}
