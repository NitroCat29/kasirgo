// ============================================================
// KasirGo — API Client
// ============================================================

let csrfToken = "";

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export function getCsrfToken(): string {
  // Fallback: baca dari cookie kalau memory kosong (e.g. setelah page reload)
  if (!csrfToken) {
    const m = document.cookie.match(/csrf_token=([^;]+)/);
    if (m) csrfToken = m[1];
  }
  return csrfToken;
}

// Direct CORS mode: frontend fetch langsung ke backend.
// Dev: VITE_API_BASE=http://localhost:3456 (atau default).
// Production: VITE_API_BASE kosong → same-origin (frontend served from backend).
const BASE = import.meta.env.VITE_API_BASE ?? "";

/* ============================================
   DEV MODE — Mock /api/auth/* (no backend needed)
   ============================================
   Kalau VITE_DEV_MODE=true, semua /api/auth/* di-mock supaya
   landing/login/dashboard bisa jalan tanpa Bun backend.
   Path non-auth (e.g. /api/toko) tetap ke backend kalau di-start manual.
   Set VITE_DEV_MODE=false di .env untuk produksi / kalau backend up.
   ============================================ */
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

const MOCK_USER = {
  id: "dev",
  username: "dev",
  email: "dev@local",
  nama: "Dev User",
  role: "admin",
  verified: 1,
};

function mockAuthResponse<T = any>(path: string, opts: RequestInit): T {
  let body: any = {};
  try { body = opts.body ? JSON.parse(opts.body as string) : {}; } catch {}

  // Parse body sebagai fallback kalau JSON.parse gagal
  const method = (opts.method || "GET").toUpperCase();

  switch (path) {
    case "/api/auth/me":
      return { ...MOCK_USER } as T;

    case "/api/auth/login":
      return { ...MOCK_USER, csrf_token: "dev-csrf" } as T;

    case "/api/auth/signup":
      return { id: "dev-pending", pending_verification: true, email: body.email || "" } as T;

    case "/api/auth/hcaptcha-sitekey":
      // Captcha selalu off di dev mode
      return { enabled: false, site_key: null } as T;

    case "/api/auth/verify-email":
      return { ...MOCK_USER, csrf_token: "dev-csrf" } as T;

    case "/api/auth/resend-verification":
    case "/api/auth/forgot-password":
    case "/api/auth/reset-password":
      return { ok: true } as T;

    case "/api/auth/verify-reset-code":
      return { valid: true, reset_token: "dev-reset" } as T;

    case "/api/auth/logout":
      return { ok: true } as T;

    default:
      // Fallback: kalau path gak di-mock eksplisit, return empty success
      return { ok: true } as T;
  }
}

const AUTH_PATHS = [
  "/api/auth/me",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/auth/hcaptcha-sitekey",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/forgot-password",
  "/api/auth/verify-reset-code",
  "/api/auth/reset-password",
];

function isAuthPath(path: string): boolean {
  return AUTH_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

export async function api<T = any>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  // DEV_MODE bypass — /api/auth/* di-mock, path lain tetap ke backend
  if (DEV_MODE && isAuthPath(path)) {
    return mockAuthResponse<T>(path, opts);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> || {}),
  };

  // Tambah CSRF token untuk non-GET requests (dari memory atau cookie fallback)
  if (opts.method && !["GET", "HEAD"].includes(opts.method.toUpperCase())) {
    const token = getCsrfToken();
    if (token) headers["x-csrf-token"] = token;
  }

  // Idempotency key untuk POST — mencegah duplikasi kalau user klik ganda
  if (opts.method && opts.method.toUpperCase() === "POST") {
    headers["x-idempotency-key"] = crypto.randomUUID();
  }

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data as T;
}
