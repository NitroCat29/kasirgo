// ============================================================
// KasirGo — Auth State (SolidJS signals)
// ============================================================
import { createSignal } from "solid-js";
import { api, setCsrfToken } from "./api";

export interface User {
  id: string;
  username: string;
  email: string | null;
  nama: string;
  role: string;
  verified: number;
}

const [user, setUser] = createSignal<User | null>(null);
export { user };

// SHA-256 hash (sama dengan login.html lama)
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================
// LOGIN — by email ATAU username
// ============================================================
export async function login(identifier: string, password: string): Promise<User> {
  const hashed = await sha256(password);
  const res = await api<{ id: string; username: string; email: string | null; nama: string; role: string; verified: number; csrf_token: string }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ identifier, password: hashed }),
    }
  );
  setCsrfToken(res.csrf_token);
  const u: User = { id: res.id, username: res.username, email: res.email, nama: res.nama, role: res.role, verified: res.verified };
  setUser(u);
  return u;
}

// ============================================================
// SIGNUP — buat akun pending, kirim verification email
// ============================================================
export async function signup(username: string, email: string, password: string, nama: string, hcaptchaToken?: string): Promise<{ pending_verification: true; email: string }> {
  const hashed = await sha256(password);
  const body: Record<string, string> = { username, email, password: hashed, nama };
  if (hcaptchaToken) body.hcaptcha_token = hcaptchaToken;
  const res = await api<{ id: string; pending_verification: true; email: string }>(
    "/api/auth/signup",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  // Tidak auto-login (akun pending sampai verifikasi)
  return { pending_verification: true, email: res.email };
}

// ============================================================
// HCAPTCHA — fetch site key dari backend (gak hardcode)
// ============================================================
export async function getHcaptchaConfig(): Promise<{ enabled: boolean; site_key: string | null }> {
  return api("/api/auth/hcaptcha-sitekey");
}

// ============================================================
// VERIFY EMAIL — by token (magic link) ATAU by email+code (manual)
// ============================================================
export async function verifyEmailByToken(token: string): Promise<User> {
  const res = await api<{ id: string; username: string; email: string | null; nama: string; role: string; verified: number; csrf_token: string }>(
    "/api/auth/verify-email",
    {
      method: "POST",
      body: JSON.stringify({ token }),
    }
  );
  setCsrfToken(res.csrf_token);
  const u: User = { id: res.id, username: res.username, email: res.email, nama: res.nama, role: res.role, verified: res.verified };
  setUser(u);
  return u;
}

export async function verifyEmailByCode(email: string, code: string): Promise<User> {
  const res = await api<{ id: string; username: string; email: string | null; nama: string; role: string; verified: number; csrf_token: string }>(
    "/api/auth/verify-email",
    {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }
  );
  setCsrfToken(res.csrf_token);
  const u: User = { id: res.id, username: res.username, email: res.email, nama: res.nama, role: res.role, verified: res.verified };
  setUser(u);
  return u;
}

// ============================================================
// RESEND VERIFICATION
// ============================================================
export async function resendVerification(email: string): Promise<{ ok: true }> {
  return api("/api/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// ============================================================
// FORGOT PASSWORD
// ============================================================
export async function forgotPassword(email: string): Promise<{ ok: true }> {
  return api("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// ============================================================
// VERIFY RESET CODE — by token (magic link) ATAU by email+code
// ============================================================
export async function verifyResetCodeByToken(token: string): Promise<{ valid: true; reset_token: string }> {
  return api("/api/auth/verify-reset-code", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function verifyResetCodeByCode(email: string, code: string): Promise<{ valid: true; reset_token: string }> {
  return api("/api/auth/verify-reset-code", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

// ============================================================
// RESET PASSWORD — pakai reset_token dari verify-reset-code / magic link
// ============================================================
export async function resetPassword(resetToken: string, newPassword: string): Promise<{ ok: true }> {
  const hashed = await sha256(newPassword);
  return api("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ reset_token: resetToken, new_password: hashed }),
  });
}

// ============================================================
// LOGOUT
// ============================================================
export async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore
  }
  setCsrfToken("");
  setUser(null);
}

export async function fetchMe(): Promise<User | null> {
  try {
    const u = await api<User>("/api/auth/me");
    setUser(u);
    return u;
  } catch {
    setUser(null);
    return null;
  }
}
