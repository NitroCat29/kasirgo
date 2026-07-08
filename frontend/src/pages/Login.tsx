import { createSignal, onMount, Show, createEffect } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { login, signup, forgotPassword, getHcaptchaConfig } from "../lib/auth";
import { AuthShell, PasswordField, useAutoFocus } from "../components/AuthShell";
import { PasswordStrengthMeter, FieldError } from "../components/ui";
import { toast } from "../lib/toast";
import { validateEmail } from "../../../shared/validation";

type View = "login" | "signup" | "forgot" | "pending";

export default function Login() {
  const nav = useNavigate();
  const [view, setView] = createSignal<View>("login");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal("");
  const [identifier, setIdentifier] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [nama, setNama] = createSignal("");
  const [pendingEmail, setPendingEmail] = createSignal("");

  // hCaptcha state
  const [hcaptchaEnabled, setHcaptchaEnabled] = createSignal(false);
  const [hcaptchaSiteKey, setHcaptchaSiteKey] = createSignal<string | null>(null);
  const [hcaptchaToken, setHcaptchaToken] = createSignal<string | null>(null);
  let hcaptchaWidgetId: string | null = null;
  let hcaptchaContainer: HTMLDivElement | undefined;

  // Inline validation per field
  const [identifierErr, setIdentifierErr] = createSignal("");
  const [passwordErr, setPasswordErr] = createSignal("");
  const [usernameErr, setUsernameErr] = createSignal("");
  const [emailErr, setEmailErr] = createSignal("");
  const [namaErr, setNamaErr] = createSignal("");

  // Auto-focus pertama field tiap view change
  const [identifierRef, getIdentifierRef] = useAutoFocus();
  const [namaRef, getNamaRef] = useAutoFocus();
  const [emailForgotRef, getEmailForgotRef] = useAutoFocus();

  onMount(async () => {
    const { fetchMe } = await import("../lib/auth");
    const u = await fetchMe();
    if (u) nav("/dashboard");

    // Fetch hCaptcha config dari backend — kalau enabled, render widget saat signup
    try {
      const cfg = await getHcaptchaConfig();
      if (cfg.enabled && cfg.site_key) {
        setHcaptchaEnabled(true);
        setHcaptchaSiteKey(cfg.site_key);
      }
    } catch {}

    // Preload VerifyEmail + ResetPassword chunks (predict user akan
    // navigasi ke sana setelah signup/forgot). Idle-time import, gak
    // block render — chunk di-cache untuk navigasi nanti.
    (window as any).requestIdleCallback?.(() => {
      import("../pages/VerifyEmail").catch(() => {});
      import("../pages/ResetPassword").catch(() => {});
    });
  });

  // Global callbacks untuk hCaptcha (dipanggil dari widget)
  if (typeof window !== "undefined") {
    (window as any).onHcaptchaSuccess = (token: string) => setHcaptchaToken(token);
    (window as any).onHcaptchaExpired = () => setHcaptchaToken(null);
    (window as any).onHcaptchaError = () => setHcaptchaToken(null);
  }

  // Render widget hCaptcha saat user masuk signup view (kalau enabled)
  createEffect(() => {
    if (view() !== "signup" || !hcaptchaEnabled() || !hcaptchaSiteKey()) return;
    const tryRender = () => {
      const hc = (window as any).hcaptcha;
      if (!hc || !hcaptchaContainer) { setTimeout(tryRender, 100); return; }
      if (hcaptchaWidgetId !== null) return; // sudah render
      hcaptchaWidgetId = hc.render(hcaptchaContainer, {
        sitekey: hcaptchaSiteKey(),
        callback: "onHcaptchaSuccess",
        "expired-callback": "onHcaptchaExpired",
        "error-callback": "onHcaptchaError",
      });
    };
    tryRender();
  });

  createEffect(() => {
    const v = view();
    setTimeout(() => {
      if (v === "login") getIdentifierRef()?.focus();
      else if (v === "signup") getNamaRef()?.focus();
      else if (v === "forgot") getEmailForgotRef()?.focus();
    }, 80);
  });

  function validateLoginFields(): boolean {
    let ok = true;
    setIdentifierErr(identifier() ? "" : "Username/Email wajib diisi");
    if (!identifier()) ok = false;
    setPasswordErr(password() ? "" : "Password wajib diisi");
    if (!password()) ok = false;
    return ok;
  }

  function validateSignupFields(): boolean {
    let ok = true;
    setNamaErr(nama() ? "" : "Nama wajib diisi");
    if (!nama()) ok = false;
    if (!username() || username().trim().length < 3) { setUsernameErr("Username minimal 3 karakter"); ok = false; }
    else if (username().length > 20) { setUsernameErr("Username maksimal 20 karakter"); ok = false; }
    else setUsernameErr("");
    if (!email()) { setEmailErr("Email wajib diisi"); ok = false; }
    else {
      const ev = validateEmail(email());
      setEmailErr(ev.ok ? "" : ev.error);
      if (!ev.ok) ok = false;
    }
    if (!password() || password().length < 6) { setPasswordErr("Password minimal 6 karakter"); ok = false; }
    else setPasswordErr("");
    return ok;
  }

  async function handleLogin(e: Event) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!validateLoginFields()) return;
    setLoading(true);
    try {
      const u = await login(identifier(), password());
      toast.success(`Selamat datang, ${u.nama}!`);
      nav("/dashboard");
    } catch (err: any) {
      if (err.message.includes("belum diverifikasi")) {
        setError(err.message);
        setView("pending");
        setPendingEmail(identifier().includes("@") ? identifier() : "");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: Event) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!validateSignupFields()) return;
    // hCaptcha wajib kalau enabled
    if (hcaptchaEnabled() && !hcaptchaToken()) {
      setError("Selesaikan verifikasi hCaptcha terlebih dahulu.");
      return;
    }
    setLoading(true);
    try {
      await signup(username(), email(), password(), nama(), hcaptchaToken() || undefined);
      setPendingEmail(email());
      setView("pending");
      toast.success("Akun berhasil dibuat! Cek email untuk verifikasi.");
    } catch (err: any) {
      setError(err.message);
      // Reset widget biar user bisa retry
      if (hcaptchaWidgetId !== null && (window as any).hcaptcha) {
        (window as any).hcaptcha.reset(hcaptchaWidgetId);
        setHcaptchaToken(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: Event) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!email()) { setEmailErr("Email wajib diisi"); return; }
    setEmailErr("");
    setLoading(true);
    try {
      await forgotPassword(email());
      setSuccess("Kalau email terdaftar, kode reset telah dikirim ke email kamu.");
      toast.info("Permintaan reset terkirim (cek email)");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Show when={view() === "login" || view() === "signup"}>
        <div class="liquid-tab-container">
          <button class={`liquid-tab ${view() === "login" ? "active" : ""}`} onClick={() => { setView("login"); setError(""); setSuccess(""); }}>Masuk</button>
          <button class={`liquid-tab ${view() === "signup" ? "active" : ""}`} onClick={() => { setView("signup"); setError(""); setSuccess(""); }}>Daftar</button>
        </div>
      </Show>

      <Show when={error()}><div class="error-msg mb-4 fade-in">{error()}</div></Show>
      <Show when={success()}><div class="success-msg mb-4 fade-in">{success()}</div></Show>

      {/* LOGIN FORM */}
      <Show when={view() === "login"}>
        <form onSubmit={handleLogin} class="space-y-4 fade-in">
          <div>
            <label class="text-xs font-medium mb-1.5 block text-kasir-muted">Username atau Email</label>
            <div class="liquid-input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <input ref={identifierRef as any} type="text" class={`liquid-input ${identifierErr() ? "field-error-state" : ""}`} placeholder="username atau email@gmail.com" value={identifier()} onInput={(e) => { setIdentifier(e.currentTarget.value); if (identifierErr()) setIdentifierErr(""); }} autocomplete="username" />
            </div>
            <FieldError message={identifierErr()} />
          </div>
          <PasswordField label="Password" value={password()} onInput={(e) => { setPassword((e.target as HTMLInputElement).value); if (passwordErr()) setPasswordErr(""); }} placeholder="Masukkan password" autocomplete="current-password" />
          <FieldError message={passwordErr()} />
          <button type="submit" class="liquid-button" disabled={loading()}>
            <Show when={!loading()} fallback={<span class="spinner" />}>Masuk</Show>
          </button>
          <div class="flex items-center justify-between text-sm mt-2">
            <a href="#" onClick={(e) => { e.preventDefault(); setView("signup"); setError(""); setSuccess(""); }} class="text-kasir-accent hover:opacity-80 transition-opacity">Belum punya akun?</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setView("forgot"); setError(""); setSuccess(""); }} class="text-kasir-muted hover:text-kasir-accent transition-colors">Lupa password?</a>
          </div>
        </form>
      </Show>

      {/* SIGNUP FORM */}
      <Show when={view() === "signup"}>
        <form onSubmit={handleSignup} class="space-y-4 fade-in">
          <div>
            <label class="text-xs font-medium mb-1.5 block text-kasir-muted">Nama Lengkap</label>
            <div class="liquid-input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" transform="translate(4 0)" /><circle cx="12" cy="7" r="4" />
              </svg>
              <input ref={namaRef as any} type="text" class={`liquid-input ${namaErr() ? "field-error-state" : ""}`} placeholder="Nama Anda" value={nama()} onInput={(e) => { setNama(e.currentTarget.value); if (namaErr()) setNamaErr(""); }} autocomplete="name" />
            </div>
            <FieldError message={namaErr()} />
          </div>
          <div>
            <label class="text-xs font-medium mb-1.5 block text-kasir-muted">Username</label>
            <div class="liquid-input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <input type="text" class={`liquid-input ${usernameErr() ? "field-error-state" : ""}`} placeholder="Pilih username (3-20 karakter)" value={username()} onInput={(e) => { setUsername(e.currentTarget.value); if (usernameErr()) setUsernameErr(""); }} autocomplete="username" />
            </div>
            <FieldError message={usernameErr()} />
          </div>
          <div>
            <label class="text-xs font-medium mb-1.5 block text-kasir-muted">Email</label>
            <div class="liquid-input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
              <input type="email" class={`liquid-input ${emailErr() ? "field-error-state" : ""}`} placeholder="email@gmail.com / outlook.com / proton.me" value={email()} onInput={(e) => { setEmail(e.currentTarget.value); if (emailErr()) setEmailErr(""); }} autocomplete="email" />
            </div>
            <FieldError message={emailErr()} />
            <p class="text-[10px] text-kasir-muted/70 mt-1.5 ml-1">Hanya Gmail, Outlook, atau Proton. Tidak boleh pakai + atau . di local part.</p>
          </div>
          <PasswordField label="Password" value={password()} onInput={(e) => { setPassword((e.target as HTMLInputElement).value); if (passwordErr()) setPasswordErr(""); }} placeholder="Minimal 6 karakter" autocomplete="new-password" minLength={6} />
          <FieldError message={passwordErr()} />
          <PasswordStrengthMeter password={password()} />
          <Show when={hcaptchaEnabled()}>
            <div ref={hcaptchaContainer} class="flex justify-center min-h-[78px]" />
          </Show>
          <button type="submit" class="liquid-button" disabled={loading()}>
            <Show when={!loading()} fallback={<span class="spinner" />}>Daftar</Show>
          </button>
          <p class="text-center text-sm mt-2 text-kasir-muted">
            Sudah punya akun?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setView("login"); setError(""); setSuccess(""); }} class="text-kasir-accent hover:opacity-80 transition-opacity">Masuk</a>
          </p>
        </form>
      </Show>

      {/* FORGOT PASSWORD FORM */}
      <Show when={view() === "forgot"}>
        <form onSubmit={handleForgot} class="space-y-4 fade-in">
          <p class="text-sm text-kasir-muted text-center mb-2">Masukkan email akun kamu. Kami akan kirim kode reset + magic link ke email.</p>
          <div>
            <label class="text-xs font-medium mb-1.5 block text-kasir-muted">Email</label>
            <div class="liquid-input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
              <input ref={emailForgotRef as any} type="email" class={`liquid-input ${emailErr() ? "field-error-state" : ""}`} placeholder="email@gmail.com" value={email()} onInput={(e) => { setEmail(e.currentTarget.value); if (emailErr()) setEmailErr(""); }} autocomplete="email" />
            </div>
            <FieldError message={emailErr()} />
          </div>
          <button type="submit" class="liquid-button" disabled={loading()}>
            <Show when={!loading()} fallback={<span class="spinner" />}>Kirim Kode Reset</Show>
          </button>
          <p class="text-center text-sm mt-2 text-kasir-muted">
            <a href="#" onClick={(e) => { e.preventDefault(); setView("login"); setError(""); setSuccess(""); }} class="text-kasir-accent hover:opacity-80 transition-opacity">← Kembali ke login</a>
          </p>
        </form>
      </Show>

      {/* PENDING VERIFICATION */}
      <Show when={view() === "pending"}>
        <div class="space-y-4 fade-in text-center">
          <div class="flex justify-center mb-3">
            <div class="w-16 h-16 rounded-full bg-kasir-accent/15 border border-kasir-accent/30 flex items-center justify-center neon-glow">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00d9a3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
          </div>
          <h3 class="text-lg font-bold text-white">Cek Email Kamu</h3>
          <p class="text-sm text-kasir-muted leading-relaxed">
            Kode verifikasi 8-digit + magic link telah dikirim ke:<br />
            <span class="text-kasir-accent font-mono">{pendingEmail() || "email kamu"}</span>
          </p>
          <p class="text-xs text-kasir-muted/70">Kode berlaku 30 menit. Cek folder spam kalau tidak ada di inbox.</p>
          <a href="/verify-email" class="block text-center py-2.5 rounded-lg glass text-slate-200 font-semibold text-sm hover:bg-white/5 transition-all mt-4 no-underline">Saya punya kode — verifikasi sekarang</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setView("login"); }} class="block text-center text-sm text-kasir-muted hover:text-kasir-accent transition-colors mt-2 no-underline">← Kembali ke login</a>
        </div>
      </Show>

      {/* Demo credentials chip (only on login view) */}
      <Show when={view() === "login"}>
        <div class="mt-6 pt-5 border-t border-white/[0.06] flex justify-center">
          <div class="liquid-chip">
            <span class="chip-dot" />
            <span>Demo (read-only):</span>
            <span class="text-kasir-muted/90">demo</span>
            <span class="text-kasir-muted/60">/</span>
            <span class="text-kasir-muted/90">demo123</span>
          </div>
        </div>
      </Show>
    </AuthShell>
  );
}
