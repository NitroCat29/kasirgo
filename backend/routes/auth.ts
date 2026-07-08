import { randomUUID } from "node:crypto";
import { db } from "../db";
import {
  json, parseBody, getUser, requireRole, makeSessionCookie,
  cleanupExpiredSessions, checkRateLimit, logAudit,
  checkSignupRateLimit, checkForgotRateLimit, checkVerifyRateLimit,
  generate8DigitCode, generateVerifyToken, config, errorResponse,
  verifyHcaptcha,
} from "../helpers";
import { validateSignup, validateLogin, isEmailIdentifier } from "../../shared/validation";
import { sendVerificationEmail, sendPasswordResetEmail } from "../mail";

// ============================================================
// Auth Routes
// ============================================================

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
}

// Insert verification record (signup_verify | password_reset), return code + token
async function createVerification(userId: string, purpose: "signup_verify" | "password_reset"): Promise<{ code: string; token: string; expiresAt: string }> {
  // Mark all existing unused records of same purpose for this user as used (invalidasi)
  db.run("UPDATE email_verifications SET used = 1 WHERE user_id = ? AND purpose = ? AND used = 0", [userId, purpose]);

  const code = generate8DigitCode();
  const token = generateVerifyToken();
  const expiryMin = purpose === "signup_verify" ? config.verifyCodeExpiryMin : config.resetCodeExpiryMin;
  const expiresAt = new Date(Date.now() + expiryMin * 60_000).toISOString();
  const codeHash = await Bun.password.hash(code);

  db.run(
    "INSERT INTO email_verifications (id, user_id, purpose, code_hash, token, expires_at, used) VALUES (?, ?, ?, ?, ?, ?, 0)",
    [randomUUID(), userId, purpose, codeHash, token, expiresAt]
  );

  return { code, token, expiresAt };
}

export const authRoutes: Record<string, (req: Request, path: string[]) => Response | Promise<Response>> = {

  // ============================================================
  // HCAPTCHA SITE KEY — public, untuk render widget di frontend
  // ============================================================
  // Frontend fetch ini untuk dapat site key (gak hardcode).
  // Kalau HCAPTCHA_SITE_KEY kosong → return { enabled: false } (mode testing,
  // frontend skip render widget, backend skip verify).
  "GET /api/auth/hcaptcha-sitekey": (req) => {
    return json({
      enabled: !!config.hcaptchaSiteKey && !!config.hcaptchaSecret,
      site_key: config.hcaptchaSiteKey || null,
    });
  },

  // ============================================================
  // SIGNUP — buat user pending (verified=0) + kirim verification email
  // ============================================================
  "POST /api/auth/signup": async (req) => {
    const ip = clientIp(req);
    const rl = checkSignupRateLimit(ip);
    if (!rl.allowed) {
      return errorResponse("AUTH_RATE_LIMITED", `Terlalu banyak percobaan signup. Coba lagi dalam ${rl.retryAfter} detik.`, 429, { retry_after: rl.retryAfter });
    }

    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateSignup(body);
    if (!v.ok) return errorResponse("AUTH_INVALID_INPUT", v.error, 400);

    // hCaptcha verification — wajib kalau enabled (HCAPTCHA_SECRET + SITE_KEY set).
    // Kalau disabled (env kosong) → skip verify (mode testing).
    if (config.hcaptchaSecret && config.hcaptchaSiteKey) {
      const hcaptchaToken = typeof body.hcaptcha_token === "string" ? body.hcaptcha_token : null;
      if (!hcaptchaToken) {
        return errorResponse("AUTH_HCAPTCHA_MISSING", "Verifikasi hCaptcha wajib diisi.", 400);
      }
      const hcaptchaOk = await verifyHcaptcha(hcaptchaToken, ip);
      if (!hcaptchaOk) {
        return errorResponse("AUTH_HCAPTCHA_FAILED", "Verifikasi hCaptcha gagal. Coba lagi.", 400);
      }
    }

    // Cek username unik
    const usernameExists = db.query("SELECT id FROM users WHERE username = ?").get(v.data.username);
    if (usernameExists) return errorResponse("AUTH_USERNAME_TAKEN", "Username sudah dipakai", 409);

    // Cek email unik
    const emailExists = db.query("SELECT id FROM users WHERE email = ?").get(v.data.email);
    if (emailExists) return errorResponse("AUTH_EMAIL_TAKEN", "Email sudah terdaftar", 409);

    const id = randomUUID();
    const hash = await Bun.password.hash(v.data.password);
    // Self-signup selalu role 'kasir' (admin/manajer tidak boleh self-assign)
    db.run(
      "INSERT INTO users (id, username, email, password_hash, nama, role, verified) VALUES (?, ?, ?, ?, ?, 'kasir', 0)",
      [id, v.data.username, v.data.email, hash, v.data.nama]
    );
    logAudit({ user_id: id, username: v.data.username, action: "CREATE", entity_type: "user", entity_id: id, details: { email: v.data.email, role: "kasir", self_signup: true, pending_verification: true } });

    // Generate verification code + magic link
    const { code, token } = await createVerification(id, "signup_verify");
    const link = `${config.appUrl}/verify-email?token=${token}`;
    await sendVerificationEmail(v.data.email, code, link);

    // Tidak auto-login (akun pending sampai verifikasi)
    return json({
      id,
      username: v.data.username,
      email: v.data.email,
      nama: v.data.nama,
      role: "kasir",
      pending_verification: true,
      message: "Akun berhasil dibuat. Cek email untuk kode verifikasi (berlaku 30 menit).",
    }, 201);
  },

  // ============================================================
  // VERIFY EMAIL — by token (magic link) ATAU by email+code (manual)
  // ============================================================
  "POST /api/auth/verify-email": async (req) => {
    const ip = clientIp(req);
    const rl = checkVerifyRateLimit(ip);
    if (!rl.allowed) {
      return json({ error: `Terlalu banyak percobaan verifikasi. Coba lagi dalam ${rl.retryAfter} detik.` }, 429);
    }

    const { data: body, error } = await parseBody(req);
    if (error) return error;

    const token = typeof body.token === "string" ? body.token : null;
    const email = typeof body.email === "string" ? (body.email as string).trim().toLowerCase() : null;
    const code = typeof body.code === "string" ? body.code : null;

    if (!token && (!email || !code)) {
      return json({ error: "Verifikasi butuh token (magic link) atau email + code" }, 400);
    }

    let record: any = null;
    let user: any = null;

    if (token) {
      // Magic link flow
      record = db.query(
        "SELECT * FROM email_verifications WHERE token = ? AND purpose = 'signup_verify' AND used = 0"
      ).get(token) as any;
      if (!record) return json({ error: "Token verifikasi tidak valid atau sudah dipakai" }, 400);
      user = db.query("SELECT id, username, email, nama, role, verified FROM users WHERE id = ?").get(record.user_id) as any;
    } else {
      // Manual code flow: cari by email
      user = db.query("SELECT id, username, email, nama, role, verified FROM users WHERE email = ?").get(email) as any;
      if (!user) return json({ error: "Email tidak ditemukan" }, 400);
      // Ambil verification record terbaru yang unused untuk user ini
      record = db.query(
        "SELECT * FROM email_verifications WHERE user_id = ? AND purpose = 'signup_verify' AND used = 0 ORDER BY created_at DESC LIMIT 1"
      ).get(user.id) as any;
      if (!record) return json({ error: "Tidak ada kode verifikasi aktif. Minta kirim ulang." }, 400);
      // Verify code (hash compare)
      const codeOk = await Bun.password.verify(code, record.code_hash);
      if (!codeOk) return json({ error: "Kode verifikasi salah" }, 400);
    }

    // Cek expiry
    if (new Date(record.expires_at) < new Date()) {
      db.run("UPDATE email_verifications SET used = 1 WHERE id = ?", [record.id]);
      return json({ error: "Kode verifikasi sudah kadaluarsa. Minta kirim ulang." }, 400);
    }

    // Mark verified + record used
    db.run("UPDATE users SET verified = 1 WHERE id = ?", [user.id]);
    db.run("UPDATE email_verifications SET used = 1 WHERE id = ?", [record.id]);
    logAudit({ user_id: user.id, username: user.username, action: "VERIFY_EMAIL", entity_type: "auth", entity_id: user.id, ip });

    // Auto-login: buat session
    cleanupExpiredSessions();
    const { sessionCookie, csrfCookie, csrfToken } = makeSessionCookie(user.id);
    const res = json({
      id: user.id,
      username: user.username,
      email: user.email,
      nama: user.nama,
      role: user.role,
      verified: 1,
      csrf_token: csrfToken,
      message: "Email berhasil diverifikasi. Selamat datang!",
    });
    res.headers.set("set-cookie", sessionCookie);
    res.headers.append("set-cookie", csrfCookie);
    return res;
  },

  // ============================================================
  // RESEND VERIFICATION — kirim ulang code ke email
  // ============================================================
  "POST /api/auth/resend-verification": async (req) => {
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const email = typeof body.email === "string" ? (body.email as string).trim().toLowerCase() : null;
    if (!email) return json({ error: "Email wajib diisi" }, 400);

    // Rate limit per IP+email
    const ip = clientIp(req);
    const rl = checkForgotRateLimit(`${ip}:${email}`);
    if (!rl.allowed) {
      return json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.` }, 429);
    }

    const user = db.query("SELECT id, username, email, verified FROM users WHERE email = ?").get(email) as any;
    if (!user) return json({ error: "Email tidak ditemukan" }, 404);
    if (user.verified === 1) return json({ error: "Email sudah terverifikasi" }, 400);

    const { code, token } = await createVerification(user.id, "signup_verify");
    const link = `${config.appUrl}/verify-email?token=${token}`;
    await sendVerificationEmail(user.email, code, link);

    logAudit({ user_id: user.id, username: user.username, action: "RESEND_VERIFY", entity_type: "auth", entity_id: user.id, ip });
    return json({ ok: true, message: "Kode verifikasi baru telah dikirim ke email kamu." });
  },

  // ============================================================
  // LOGIN — by email ATAU username
  // ============================================================
  "POST /api/auth/login": async (req) => {
    const ip = clientIp(req);
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return errorResponse("AUTH_RATE_LIMITED", `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfter} detik.`, 429, { retry_after: rl.retryAfter });
    }

    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const v = validateLogin(body);
    if (!v.ok) return errorResponse("AUTH_INVALID_INPUT", v.error, 400);

    // Auto-detect identifier: email atau username
    const identifier = v.data.identifier;
    const user = isEmailIdentifier(identifier)
      ? db.query("SELECT * FROM users WHERE email = ?").get(identifier.toLowerCase()) as any
      : db.query("SELECT * FROM users WHERE username = ?").get(identifier) as any;

    // Anti-enumeration: tetap return generic "Username/email atau password salah"
    if (!user) return errorResponse("AUTH_INVALID_CREDENTIALS", "Username/email atau password salah", 401);

    const ok = await Bun.password.verify(v.data.password, user.password_hash);
    if (!ok) return errorResponse("AUTH_INVALID_CREDENTIALS", "Username/email atau password salah", 401);

    // Cek verified (skip kalau user lama tanpa email — backwards-compat)
    if (user.email && user.verified !== 1) {
      return errorResponse("AUTH_NOT_VERIFIED", "Email belum diverifikasi. Cek email untuk kode verifikasi.", 403, { needs_verification: true, email: user.email });
    }

    cleanupExpiredSessions();

    const { sessionCookie, csrfCookie, csrfToken } = makeSessionCookie(user.id);
    logAudit({ user_id: user.id, username: user.username, action: "LOGIN", entity_type: "auth", ip });
    const res = json({
      id: user.id,
      username: user.username,
      email: user.email,
      nama: user.nama,
      role: user.role,
      verified: user.verified,
      csrf_token: csrfToken,
    });
    res.headers.set("set-cookie", sessionCookie);
    res.headers.append("set-cookie", csrfCookie);
    return res;
  },

  // ============================================================
  // LOGOUT
  // ============================================================
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

  // ============================================================
  // ME — return email + verified juga
  // ============================================================
  "GET /api/auth/me": (req) => {
    const user = getUser(req);
    if (!user) return json({ error: "Belum login" }, 401);
    return json(user);
  },

  // ============================================================
  // FORGOT PASSWORD — kirim reset code + magic link ke email
  // ============================================================
  // Anti-enumeration: response generic "kalau email terdaftar, kode terkirim"
  // walau email tidak ditemukan — biar gak bisa di-brute email ada/tidak.
  "POST /api/auth/forgot-password": async (req) => {
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const email = typeof body.email === "string" ? (body.email as string).trim().toLowerCase() : null;
    if (!email) return json({ error: "Email wajib diisi" }, 400);

    // Rate limit per IP+email
    const ip = clientIp(req);
    const rl = checkForgotRateLimit(`${ip}:${email}`);
    if (!rl.allowed) {
      return json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.` }, 429);
    }

    const user = db.query("SELECT id, username, email FROM users WHERE email = ?").get(email) as any;
    // Generic response — tidak bocor email ada/tidak
    const genericOk = { ok: true, message: "Kalau email terdaftar, kode reset telah dikirim ke email kamu." };
    if (!user) return json(genericOk);

    const { code, token } = await createVerification(user.id, "password_reset");
    const link = `${config.appUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, code, link);

    logAudit({ user_id: user.id, username: user.username, action: "FORGOT_PASSWORD_REQUESTED", entity_type: "auth", entity_id: user.id, ip });
    return json(genericOk);
  },

  // ============================================================
  // VERIFY RESET CODE — validasi code (manual) ATAU token (magic link)
  // Return reset_token untuk dipakai di step reset-password
  // ============================================================
  "POST /api/auth/verify-reset-code": async (req) => {
    const ip = clientIp(req);
    const rl = checkVerifyRateLimit(ip);
    if (!rl.allowed) {
      return json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfter} detik.` }, 429);
    }

    const { data: body, error } = await parseBody(req);
    if (error) return error;

    const token = typeof body.token === "string" ? body.token : null;
    const email = typeof body.email === "string" ? (body.email as string).trim().toLowerCase() : null;
    const code = typeof body.code === "string" ? body.code : null;

    if (!token && (!email || !code)) {
      return json({ error: "Verifikasi butuh token (magic link) atau email + code" }, 400);
    }

    let record: any = null;

    if (token) {
      record = db.query(
        "SELECT * FROM email_verifications WHERE token = ? AND purpose = 'password_reset' AND used = 0"
      ).get(token) as any;
      if (!record) return json({ error: "Token reset tidak valid atau sudah dipakai" }, 400);
    } else {
      const user = db.query("SELECT id FROM users WHERE email = ?").get(email) as any;
      if (!user) return json({ error: "Email tidak ditemukan" }, 400);
      record = db.query(
        "SELECT * FROM email_verifications WHERE user_id = ? AND purpose = 'password_reset' AND used = 0 ORDER BY created_at DESC LIMIT 1"
      ).get(user.id) as any;
      if (!record) return json({ error: "Tidak ada kode reset aktif. Minta kirim ulang." }, 400);
      const codeOk = await Bun.password.verify(code, record.code_hash);
      if (!codeOk) return json({ error: "Kode reset salah" }, 400);
    }

    // Cek expiry
    if (new Date(record.expires_at) < new Date()) {
      db.run("UPDATE email_verifications SET used = 1 WHERE id = ?", [record.id]);
      return json({ error: "Kode reset sudah kadaluarsa. Minta kirim ulang." }, 400);
    }

    // Return reset_token (= token record) — dipakai di step reset-password
    // Token record tetap unused sampai reset-password benar-benar di-submit.
    return json({ valid: true, reset_token: record.token });
  },

  // ============================================================
  // RESET PASSWORD — pakai reset_token dari verify-reset-code / magic link
  // ============================================================
  "POST /api/auth/reset-password": async (req) => {
    const { data: body, error } = await parseBody(req);
    if (error) return error;
    const resetToken = typeof body.reset_token === "string" ? body.reset_token : null;
    const newPassword = typeof body.new_password === "string" ? body.new_password : null;
    if (!resetToken || !newPassword) {
      return errorResponse("AUTH_INVALID_INPUT", "reset_token dan new_password wajib diisi", 400);
    }
    if (newPassword.length < 6) {
      return errorResponse("AUTH_INVALID_INPUT", "Password baru minimal 6 karakter", 400);
    }

    // Cari record by token (purpose=password_reset, unused)
    const record = db.query(
      "SELECT * FROM email_verifications WHERE token = ? AND purpose = 'password_reset' AND used = 0"
    ).get(resetToken) as any;
    if (!record) return errorResponse("AUTH_TOKEN_INVALID", "Token reset tidak valid atau sudah dipakai", 400);

    // Cek expiry
    if (new Date(record.expires_at) < new Date()) {
      db.run("UPDATE email_verifications SET used = 1 WHERE id = ?", [record.id]);
      return errorResponse("AUTH_TOKEN_EXPIRED", "Token reset sudah kadaluarsa. Minta kirim ulang.", 400);
    }

    const user = db.query("SELECT id, username, password_hash FROM users WHERE id = ?").get(record.user_id) as any;
    if (!user) return errorResponse("AUTH_EMAIL_NOT_FOUND", "User tidak ditemukan", 400);

    // Password history check — tolak kalau new password sama dengan 3 hash terakhir (anti reuse)
    const history = db.query(
      "SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 3"
    ).all(user.id) as any[];
    const candidates = [user.password_hash, ...history.map((h) => h.password_hash)];
    for (const oldHash of candidates) {
      if (await Bun.password.verify(newPassword, oldHash)) {
        return errorResponse("AUTH_PASSWORD_REUSE", "Password baru tidak boleh sama dengan password lama (3 password terakhir).", 400);
      }
    }

    // Simpan password lama ke history sebelum update
    db.run(
      "INSERT INTO password_history (id, user_id, password_hash) VALUES (?, ?, ?)",
      [randomUUID(), user.id, user.password_hash]
    );
    // Cleanup history lama (keep max 5 per user)
    db.run(
      "DELETE FROM password_history WHERE user_id = ? AND id NOT IN (SELECT id FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5)",
      [user.id, user.id]
    );

    // Update password
    const hash = await Bun.password.hash(newPassword);
    db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, user.id]);

    // Invalidate semua session user yang ada (paksa logout di device lain)
    db.run("DELETE FROM sessions WHERE user_id = ?", [user.id]);

    // Mark verification record used
    db.run("UPDATE email_verifications SET used = 1 WHERE id = ?", [record.id]);

    logAudit({ user_id: user.id, username: user.username, action: "PASSWORD_RESET", entity_type: "auth", entity_id: user.id });
    return json({ ok: true, message: "Password berhasil direset. Silakan login dengan password baru." });
  },
};
