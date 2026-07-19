// ============================================================
// KasirGo — Shared Auth Shell + UX utilities
// ============================================================
// Wrapper untuk Login/VerifyEmail/ResetPassword — eliminate ~200 lines
// duplicated background+logo+card structure. Plus reusable hooks
// untuk auto-focus, show/hide password, dsb.

import { createSignal, onMount, JSX, Show } from "solid-js";
import { A } from "@solidjs/router";

// ============================================================
// AuthShell — wrapper background + logo + card + footer
// ============================================================
// Props:
//   children       — content card
//   showTagline    — tampilkan chip "v2.0 · Zig + WASM" di bawah logo (default true)
//   backLink       — link kembali di footer (default "/login")
//   backLabel      — text link (default "← Kembali ke login")
//   accentDotColor — warna blob accent (default kasir-accent #00d9a3)
// ============================================================

interface AuthShellProps {
  children: JSX.Element;
  showTagline?: boolean;
  backLink?: string;
  backLabel?: string;
}

export function AuthShell(props: AuthShellProps) {
  return (
    <div class="noise relative min-h-screen overflow-hidden">
      {/* Background layers — kurangi opacity + count jadi 3 untuk performa low-end */}
      <div class="fixed inset-0 grid-bg pointer-events-none" style={{ "z-index": "-2" }} />
      <div class="fixed inset-0 aurora pointer-events-none" style={{ "z-index": "-1" }} />
      <div class="blob blob-optimized" style={{ background: "#00d9a3", top: "-180px", left: "-140px", width: "520px", height: "520px", opacity: "0.32" }} />
      <div class="blob blob-optimized" style={{ background: "#ff8a3d", top: "30%", right: "-240px", width: "560px", height: "560px", opacity: "0.22", "animation-delay": "-4s" }} />
      <div class="blob blob-optimized" style={{ background: "#6366f1", bottom: "-160px", left: "20%", width: "400px", height: "400px", opacity: "0.13", "animation-delay": "-2s" }} />

      <div class="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div class="w-full max-w-md mx-auto">
          {/* Logo + tagline */}
          <div class="text-center mb-7 entrance entrance-1">
            <A href="/" class="inline-flex items-center gap-3 no-underline group">
              <div class="relative">
                <div class="absolute inset-0 rounded-xl bg-kasir-accent/40 blur-lg group-hover:bg-kasir-accent/60 transition-colors" />
                <img src="/assets/kasirku_logo.svg" alt="KasirGo" class="relative w-11 h-11 rounded-xl transition-transform group-hover:scale-105" />
              </div>
              <span class="text-[28px] font-bold tracking-tight text-white auth-text-heading">
                Kasir<span class="text-kasir-accent neon-text">Go</span>
              </span>
            </A>
            <Show when={props.showTagline !== false}>
              <div class="mt-3 inline-flex items-center gap-2 liquid-chip">
                <span class="w-1.5 h-1.5 rounded-full bg-kasir-accent pulse-dot neon-glow" />
                <span class="text-[11px] text-kasir-muted">v2.0 · Zig + WebAssembly</span>
              </div>
            </Show>
          </div>

          {/* Card — children render di sini */}
          <div class="liquid-glass-strong p-8 entrance entrance-2">
            {props.children}
          </div>

          {/* Footer */}
          <p class="text-center text-xs mt-6 entrance entrance-3">
            <A href={props.backLink ?? "/login"} class="hover:opacity-60 transition-opacity text-kasir-muted">
              {props.backLabel ?? "← Kembali ke login"}
            </A>
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// useAutoFocus — focus element saat mounted
// ============================================================
// Pakai ref callback: <input ref={useAutoFocus()} ... />
// atau pakai signal: const [ref, setRef] = useAutoFocus(); <input ref={setRef} />

export function useAutoFocus(): [(el: HTMLElement) => void, () => HTMLElement | undefined] {
  let el: HTMLElement | undefined;
  const setter = (e: HTMLElement) => {
    el = e;
    // Delay sedikit biar SolidJS selesai render + Show transition selesai
    setTimeout(() => el?.focus(), 50);
  };
  const getter = () => el;
  return [setter, getter];
}

// ============================================================
// PasswordField — input password dengan show/hide toggle
// ============================================================
// Reusable untuk login, signup, reset-password, verify (gak dipakai di sini).
// Props sama dengan input biasa + auto toggle eye icon.

interface PasswordFieldProps {
  value: string;
  onInput: (e: InputEvent) => void;
  placeholder?: string;
  autocomplete?: string;
  label?: string;
  required?: boolean;
  minLength?: number;
  ref?: (el: HTMLInputElement) => void;
}

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = createSignal(false);

  return (
    <div>
      <Show when={props.label}>
        <label class="text-xs font-medium mb-1.5 block text-kasir-muted">{props.label}</label>
      </Show>
      <div class="liquid-input-wrap">
        <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <input
          type={visible() ? "text" : "password"}
          class="liquid-input pr-12"
          placeholder={props.placeholder ?? "Masukkan password"}
          value={props.value}
          onInput={props.onInput}
          autocomplete={props.autocomplete ?? "current-password"}
          required={props.required}
          minLength={props.minLength}
          ref={props.ref}
        />
        <button
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-kasir-muted hover:text-kasir-accent transition-colors z-10"
          onClick={() => setVisible(!visible())}
          tabIndex={-1}
          aria-label={visible() ? "Sembunyikan password" : "Tampilkan password"}
        >
          <Show when={visible()} fallback={
            // Eye icon (show)
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }>
            {/* Eye-off icon (hide) */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </Show>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ResendCooldown — countdown button untuk resend code
// ============================================================
// Self-contained: mulai cooldown saat `trigger()` dipanggil.
// Button disabled selama cooldown, text countdown real-time.

import { onCleanup } from "solid-js";

interface ResendCooldownProps {
  onClick: () => void | Promise<void>;
  cooldownSeconds?: number; // default 60
  label?: string;           // default "Kirim ulang kode"
  disabled?: boolean;       // external disable (e.g. loading)
}

export function ResendCooldown(props: ResendCooldownProps) {
  const cooldown = props.cooldownSeconds ?? 60;
  const [remaining, setRemaining] = createSignal(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  function startCooldown() {
    setRemaining(cooldown);
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  onCleanup(() => {
    if (timer) clearInterval(timer);
  });

  async function handleClick() {
    if (remaining() > 0 || props.disabled) return;
    await props.onClick();
    startCooldown();
  }

  return (
    <button
      type="button"
      class="w-full text-sm transition-opacity"
      classList={{
        "text-kasir-accent hover:opacity-80": remaining() === 0 && !props.disabled,
        "text-kasir-muted/50 cursor-not-allowed": remaining() > 0 || props.disabled,
      }}
      onClick={handleClick}
      disabled={remaining() > 0 || props.disabled}
    >
      <Show when={remaining() === 0} fallback={`Kirim ulang kode (${remaining()}s)`}>
        {props.label ?? "Kirim ulang kode"}
      </Show>
    </button>
  );
}
