import { toast } from "../../../lib/toast";

/** Debounced soft load error — avoids polling toast spam. */
export function createToastLoadError(cooldownMs = 8000) {
  let lastAt = 0;
  return function toastLoadError(label: string, err?: unknown) {
    const now = Date.now();
    if (now - lastAt < cooldownMs) return;
    lastAt = now;
    const msg =
      err instanceof Error && err.message ? err.message : `Gagal muat ${label}`;
    toast.error(msg);
  };
}

export type ToastLoadError = ReturnType<typeof createToastLoadError>;
