import { createSignal, onMount, Show } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { verifyResetCodeByToken, verifyResetCodeByCode, resetPassword } from "../lib/auth";
import { AuthShell, PasswordField } from "../components/AuthShell";
import { PasswordStrengthMeter, FieldError } from "../components/ui";
import { toast } from "../lib/toast";

type Stage = "verifying" | "manual" | "reset";

export default function ResetPassword() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal("");
  const [stage, setStage] = createSignal<Stage>("verifying");
  const [email, setEmail] = createSignal("");
  const [code, setCode] = createSignal("");
  const [resetToken, setResetToken] = createSignal("");
  const [newPass, setNewPass] = createSignal("");
  const [confirmPass, setConfirmPass] = createSignal("");
  const [emailErr, setEmailErr] = createSignal("");
  const [codeErr, setCodeErr] = createSignal("");
  const [newPassErr, setNewPassErr] = createSignal("");
  const [confirmPassErr, setConfirmPassErr] = createSignal("");

  onMount(async () => {
    const token = params.token;
    if (!token) { setStage("manual"); return; }
    setLoading(true);
    try {
      const res = await verifyResetCodeByToken(token);
      setResetToken(res.reset_token);
      setStage("reset");
    } catch (err: any) {
      setError(err.message + " — masukkan email dan kode reset manual di bawah.");
      setStage("manual");
    } finally {
      setLoading(false);
    }
  });

  async function handleManualVerify(e: Event) {
    e.preventDefault();
    setError(""); setSuccess("");
    let ok = true;
    if (!email()) { setEmailErr("Email wajib diisi"); ok = false; } else setEmailErr("");
    if (!code() || code().length !== 8) { setCodeErr("Kode reset harus 8 digit"); ok = false; } else setCodeErr("");
    if (!ok) return;
    setLoading(true);
    try {
      const res = await verifyResetCodeByCode(email(), code());
      setResetToken(res.reset_token);
      setStage("reset");
      toast.success("Kode valid — silakan masukkan password baru");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: Event) {
    e.preventDefault();
    setError(""); setSuccess("");
    let ok = true;
    if (!newPass() || newPass().length < 6) { setNewPassErr("Password baru minimal 6 karakter"); ok = false; } else setNewPassErr("");
    if (newPass() !== confirmPass()) { setConfirmPassErr("Konfirmasi password tidak cocok"); ok = false; } else setConfirmPassErr("");
    if (!ok) return;
    setLoading(true);
    try {
      await resetPassword(resetToken(), newPass());
      toast.success("Password berhasil direset!");
      setTimeout(() => nav("/login"), 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell showTagline={false} backLink="/login" backLabel="← Kembali ke login">
      <h2 class="text-xl font-bold text-white mb-2 text-center">Reset Password</h2>

      <Show when={stage() === "verifying"}>
        <p class="text-sm text-kasir-muted text-center mb-6">Memvalidasi token reset...</p>
      </Show>
      <Show when={stage() === "manual"}>
        <p class="text-sm text-kasir-muted text-center mb-6">Masukkan email dan 8-digit kode reset yang dikirim ke email kamu.</p>
      </Show>
      <Show when={stage() === "reset"}>
        <p class="text-sm text-kasir-muted text-center mb-6">Masukkan password baru untuk akun kamu.</p>
      </Show>

      <Show when={error()}><div class="error-msg mb-4 fade-in">{error()}</div></Show>
      <Show when={success()}><div class="success-msg mb-4 fade-in">{success()}</div></Show>

      {/* Stage: manual */}
      <Show when={stage() === "manual"}>
        <form onSubmit={handleManualVerify} class="space-y-4 fade-in">
          <div>
            <label class="text-xs font-medium mb-1.5 block text-kasir-muted">Email</label>
            <div class="liquid-input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
              <input type="email" class={`liquid-input ${emailErr() ? "field-error-state" : ""}`} placeholder="email@gmail.com" value={email()} onInput={(e) => { setEmail(e.currentTarget.value); if (emailErr()) setEmailErr(""); }} autocomplete="email" />
            </div>
            <FieldError message={emailErr()} />
          </div>
          <div>
            <label class="text-xs font-medium mb-1.5 block text-kasir-muted">Kode Reset (8 digit)</label>
            <div class="liquid-input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input type="text" inputmode="numeric" maxlength="8" class={`liquid-input font-mono tracking-[0.3em] ${codeErr() ? "field-error-state" : ""}`} placeholder="00000000" value={code()} onInput={(e) => { setCode(e.currentTarget.value.replace(/\D/g, "")); if (codeErr()) setCodeErr(""); }} autocomplete="one-time-code" onKeyDown={(e) => { if (e.key === "Enter" && code().length === 8) { (e.currentTarget.form as HTMLFormElement)?.requestSubmit(); } }} />
            </div>
            <FieldError message={codeErr()} />
          </div>
          <button type="submit" class="liquid-button" disabled={loading()}>
            <Show when={!loading()} fallback={<span class="spinner" />}>Validasi Kode</Show>
          </button>
        </form>
      </Show>

      {/* Stage: reset */}
      <Show when={stage() === "reset"}>
        <form onSubmit={handleResetPassword} class="space-y-4 fade-in">
          <PasswordField label="Password Baru" value={newPass()} onInput={(e) => { setNewPass((e.target as HTMLInputElement).value); if (newPassErr()) setNewPassErr(""); }} placeholder="Minimal 6 karakter" autocomplete="new-password" minLength={6} />
          <FieldError message={newPassErr()} />
          <PasswordStrengthMeter password={newPass()} />
          <PasswordField label="Konfirmasi Password Baru" value={confirmPass()} onInput={(e) => { setConfirmPass((e.target as HTMLInputElement).value); if (confirmPassErr()) setConfirmPassErr(""); }} placeholder="Ulangi password baru" autocomplete="new-password" />
          <FieldError message={confirmPassErr()} />
          <button type="submit" class="liquid-button" disabled={loading()}>
            <Show when={!loading()} fallback={<span class="spinner" />}>Reset Password</Show>
          </button>
        </form>
      </Show>

      <Show when={stage() === "verifying"}>
        <div class="flex flex-col items-center gap-3 py-8">
          <span class="spinner" />
          <p class="text-sm text-kasir-muted">Memvalidasi...</p>
        </div>
      </Show>
    </AuthShell>
  );
}
