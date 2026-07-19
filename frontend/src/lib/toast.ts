// ============================================================
// KasirGo — Toast Notification Store
// ============================================================
// Global toast via SolidJS signals. Auto-dismiss dengan progress bar.
// Usage:
//   import { toast } from "../lib/toast";
//   toast.success("Transaksi berhasil dibuat");
//   toast.error("Gagal menghapus toko");
//   toast.info("Sesi akan habis dalam 2 menit");
//   toast.warning("Stok produk rendah");

import { createSignal, createRoot } from "solid-js";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // ms
  dismissing?: boolean;
}

const [toasts, setToasts] = createRoot(() => createSignal<ToastItem[]>([]));
export { toasts };

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function push(type: ToastType, message: string, duration = 4000) {
  const id = genId();
  setToasts((prev) => [...prev, { id, type, message, duration }]);
  // Auto-dismiss
  setTimeout(() => dismiss(id), duration);
  return id;
}

function dismiss(id: string) {
  // Mark dismissing dulu biar animate out
  setToasts((prev) => prev.map((t) => t.id === id ? { ...t, dismissing: true } : t));
  // Remove setelah animation selesai
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, 280);
}

export const toast = {
  success: (msg: string, duration?: number) => push("success", msg, duration),
  error: (msg: string, duration?: number) => push("error", msg, duration),
  info: (msg: string, duration?: number) => push("info", msg, duration),
  warning: (msg: string, duration?: number) => push("warning", msg, duration),
  dismiss,
};

// ============================================================
// Password Strength Calculator
// ============================================================
// Heuristic sederhana, gak butuh zxcvbn (hemat bundle).
// Criteria: length, lowercase, uppercase, digit, symbol, no common pattern.

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4; // 0=empty, 1=weak, 2=fair, 3=good, 4=strong
  label: string;
  className: "weak" | "fair" | "good" | "strong";
  width: string; // percentage for bar fill
}

const COMMON_PATTERNS = [
  "password", "123456", "qwerty", "admin", "kasir",
  "111111", "000000", "abc123", "letmein", "welcome",
];

export function calcPasswordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "", className: "weak", width: "0%" };

  let pts = 0;
  if (pw.length >= 6) pts++;
  if (pw.length >= 10) pts++;
  if (pw.length >= 14) pts++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) pts++;
  if (/\d/.test(pw)) pts++;
  if (/[^a-zA-Z0-9]/.test(pw)) pts++; // symbol

  // Penalty common pattern
  const lower = pw.toLowerCase();
  if (COMMON_PATTERNS.some((p) => lower.includes(p))) pts -= 2;

  // Clamp 0-4
  pts = Math.max(0, Math.min(4, pts));

  const map = [
    { score: 0, label: "", className: "weak", width: "0%" },
    { score: 1, label: "Lemah", className: "weak", width: "25%" },
    { score: 2, label: "Cukup", className: "fair", width: "50%" },
    { score: 3, label: "Baik", className: "good", width: "75%" },
    { score: 4, label: "Kuat", className: "strong", width: "100%" },
  ] as const;

  return map[pts];
}
