import { createSignal, onMount, Show } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { verifyEmailByToken, verifyEmailByCode, resendVerification } from "../lib/auth";
import { AuthShell, ResendCooldown } from "../components/AuthShell";
import { FieldError } from "../components/ui";
import { toast } from "../lib/toast";

export default function VerifyEmail() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal("");
  const [needsManual, setNeedsManual] = createSignal(false);
  const [email, setEmail] = createSignal("");
  const [code, setCode] = createSignal("");
  const [emailErr, setEmailErr] = createSignal("");
  const [codeErr, setCodeErr] = createSignal("");

  onMount(async () => {
    const token = params.token;
    if (!token) {
      setNeedsManual(true);
      return;
    }
    setLoading(true);
    try {
      const u = await verifyEmailByToken(token);
      toast.success(`Email ${u.email} berhasil diverifikasi!`);
      setTimeout(() => nav("/dashboard"), 1200);
    } catch (err: any) {
      setError(err.message + " — masukkan kode verifikasi manual di bawah.");
      setNeedsManual(true);
    } finally {
      setLoading(false);
    }
  });

  async function handleManualVerify(e: Event) {
    e.preventDefault();
    setError(""); setSuccess("");
    let ok = true;
    if (!email()) { setEmailErr("Email wajib diisi"); ok = false; }
    else setEmailErr("");
    if (!code() || code().length !== 8) { setCodeErr("Kode verifikasi harus 8 digit"); ok = false; }
    else setCodeErr("");
    if (!ok) return;
    setLoading(true);
    try {
      const u = await verifyEmailByCode(email(), code());
      toast.success(`Email ${u.email} berhasil diverifikasi!`);
      setTimeout(() => nav("/dashboard"), 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(""); setSuccess("");
    if (!email()) { setEmailErr("Masukkan email dulu untuk kirim ulang kode"); return; }
    setEmailErr("");
    try {
      await resendVerification(email());
      setSuccess("Kode verifikasi baru telah dikirim ke email kamu.");
      toast.info("Kode verifikasi baru terkirim");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <AuthShell showTagline={false}>
      <h2 class="text-xl font-bold text-white mb-2 text-center">Verifikasi Email</h2>
      <p class="text-sm text-kasir-muted text-center mb-6">
        {needsManual()
          ? "Masukkan email dan 8-digit kode verifikasi yang dikirim ke email kamu."
          : "Memverifikasi email kamu..."}
      </p>

      <Show when={error()}><div class="error-msg mb-4 fade-in">{error()}</div></Show>
      <Show when={success()}><div class="success-msg mb-4 fade-in">{success()}</div></Show>

      <Show when={needsManual()}>
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
            <label class="text-xs font-medium mb-1.5 block text-kasir-muted">Kode Verifikasi (8 digit)</label>
            <div class="liquid-input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input type="text" inputmode="numeric" maxlength="8" class={`liquid-input font-mono tracking-[0.3em] ${codeErr() ? "field-error-state" : ""}`} placeholder="00000000" value={code()} onInput={(e) => { setCode(e.currentTarget.value.replace(/\D/g, "")); if (codeErr()) setCodeErr(""); }} autocomplete="one-time-code" onKeyDown={(e) => { if (e.key === "Enter" && code().length === 8) { (e.currentTarget.form as HTMLFormElement)?.requestSubmit(); } }} />
            </div>
            <FieldError message={codeErr()} />
          </div>
          <button type="submit" class="liquid-button" disabled={loading()}>
            <Show when={!loading()} fallback={<span class="spinner" />}>Verifikasi</Show>
          </button>
          <ResendCooldown onClick={handleResend} cooldownSeconds={60} label="Kirim ulang kode" disabled={loading() || !email()} />
        </form>
      </Show>

      <Show when={loading() && !needsManual()}>
        <div class="flex flex-col items-center gap-3 py-8">
          <span class="spinner" />
          <p class="text-sm text-kasir-muted">Memverifikasi...</p>
        </div>
      </Show>
    </AuthShell>
  );
}
