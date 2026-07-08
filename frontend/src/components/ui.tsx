// ============================================================
// KasirGo — UI Primitives
// ============================================================
// Reusable components: ToastContainer, Skeleton, EmptyState,
// SessionTimeoutModal, PasswordStrengthMeter, FieldError.

import { Show, For, createSignal, onCleanup } from "solid-js";
import { toasts, toast, calcPasswordStrength, type ToastType } from "../lib/toast";

// ============================================================
// Toast Container — render global toasts (mount once di App.tsx)
// ============================================================
const TOAST_ICONS: Record<ToastType, string> = {
  success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
};

export function ToastContainer() {
  return (
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      <For each={toasts()}>
        {(t) => (
          <div class={`toast-item toast-${t.type} ${t.dismissing ? "dismissing" : ""}`} role="alert">
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" innerHTML={TOAST_ICONS[t.type]} />
            <span class="toast-message">{t.message}</span>
            <button class="toast-close" onClick={() => toast.dismiss(t.id)} aria-label="Tutup">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <div class="toast-progress" style={{ animationDuration: `${t.duration}ms` }} />
          </div>
        )}
      </For>
    </div>
  );
}

// ============================================================
// Skeleton Loader
// ============================================================
export function Skeleton(props: { class?: string; width?: string; height?: string }) {
  return (
    <div
      class={`skeleton ${props.class ?? ""}`}
      style={{ width: props.width, height: props.height }}
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div class="skeleton skeleton-card" />
  );
}

export function SkeletonRow() {
  return (
    <div class="skeleton skeleton-row" />
  );
}

// ============================================================
// Empty State
// ============================================================
const EMPTY_ICONS: Record<string, string> = {
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  toko: '<path d="M3 9l1-5h16l1 5"/><path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><line x1="3" y1="9" x2="21" y2="9"/>',
  produk: '<path d="M20 7l-8-4-8 4 8 4 8-4z"/><path d="M4 7v10l8 4 8-4V7"/>',
  transaksi: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  audit: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
};

export function EmptyState(props: {
  type?: keyof typeof EMPTY_ICONS | "search";
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" innerHTML={EMPTY_ICONS[props.type ?? "search"] ?? EMPTY_ICONS.search} />
      </div>
      <div class="empty-state-title">{props.title}</div>
      <Show when={props.description}>
        <div class="empty-state-desc">{props.description}</div>
      </Show>
      <Show when={props.action}>
        <button class="btn-sm btn-indigo mt-3" onClick={props.action!.onClick}>{props.action!.label}</button>
      </Show>
    </div>
  );
}

// ============================================================
// SearchInput
// ============================================================
export function SearchInput(props: {
  value: string;
  onInput: (e: InputEvent) => void;
  placeholder?: string;
}) {
  return (
    <div class="search-wrap">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        class="search-input"
        placeholder={props.placeholder ?? "Cari..."}
        value={props.value}
        onInput={props.onInput}
      />
    </div>
  );
}

// ============================================================
// Password Strength Meter
// ============================================================
export function PasswordStrengthMeter(props: { password: string }) {
  const strength = () => calcPasswordStrength(props.password);
  return (
    <Show when={props.password.length > 0}>
      <div class="password-strength">
        <div class="password-strength-bar">
          <div
            class={`password-strength-fill ${strength().className}`}
            style={{ width: strength().width }}
          />
        </div>
        <span class={`password-strength-label ${strength().className}`}>{strength().label}</span>
      </div>
    </Show>
  );
}

// ============================================================
// Field Error
// ============================================================
export function FieldError(props: { message: string }) {
  return (
    <Show when={props.message}>
      <div class="field-error">{props.message}</div>
    </Show>
  );
}

// ============================================================
// Session Timeout Warning Modal
// ============================================================
// Show modal warning 2 menit sebelum session expired.
// User bisa "Perpanjang" (refresh session) atau "Logout".
export function SessionTimeoutModal(props: {
  show: boolean;
  secondsLeft: number;
  onExtend: () => void;
  onLogout: () => void;
}) {
  const mins = () => Math.floor(props.secondsLeft / 60);
  const secs = () => props.secondsLeft % 60;
  const display = () => `${mins()}:${secs().toString().padStart(2, "0")}`;

  return (
    <Show when={props.show}>
      <div class="session-timeout-modal">
        <div class="session-timeout-box">
          <div class="session-timeout-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-1">Sesi akan habis</h3>
          <p class="text-sm text-kasir-muted mb-2">Anda akan otomatis logout dalam:</p>
          <div class="session-timeout-countdown">{display()}</div>
          <div class="flex gap-2 mt-4">
            <button class="btn-sm btn-ghost flex-1" onClick={props.onLogout}>Logout sekarang</button>
            <button class="btn-sm btn-indigo flex-1" onClick={props.onExtend}>Perpanjang sesi</button>
          </div>
        </div>
      </div>
    </Show>
  );
}
