// ============================================================
// KasirGo — Session Timeout Hook
// ============================================================
// Track session validity, show warning 2 menit sebelum expired,
// auto-logout kalau expired. Pakai polling /api/auth/me setiap 60s.
//
// Usage (di Dashboard):
//   const session = useSessionTimeout({
//     onTimeout: () => { logout(); nav("/login"); },
//     warningSeconds: 120,  // warning 2 menit sebelum expired
//   });
//   <SessionTimeoutModal show={session.showWarning()} secondsLeft={session.secondsLeft()} onExtend={session.extend} onLogout={session.logoutNow} />

import { createSignal, onMount, onCleanup } from "solid-js";
import { api } from "./api";
import { logout } from "./auth";

interface UseSessionTimeoutOpts {
  onTimeout: () => void;        // dipanggil saat session expired / user dipaksa logout
  warningSeconds?: number;      // default 120 (2 menit)
  pollIntervalMs?: number;      // default 60_000 (cek setiap 1 menit)
}

interface SessionInfo {
  valid: boolean;
  expiresAt: number | null;     // epoch ms
}

export function useSessionTimeout(opts: UseSessionTimeoutOpts) {
  const warningSeconds = opts.warningSeconds ?? 120;
  const pollIntervalMs = opts.pollIntervalMs ?? 60_000;

  const [showWarning, setShowWarning] = createSignal(false);
  const [secondsLeft, setSecondsLeft] = createSignal(0);
  const [sessionInfo, setSessionInfo] = createSignal<SessionInfo>({ valid: false, expiresAt: null });

  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let countdownTimer: ReturnType<typeof setInterval> | undefined;

  // Cek session validity via /api/auth/me.
  // Backend tidak return expiry timestamp di /me, jadi kita pakai heuristic:
  // - kalau /me 200 → session valid, assume akan expired dalam SESSION_DAYS (default 7 hari)
  // - kalau /me 401 → session expired → trigger timeout
  // Warning modal muncul kalau deteksi 401 atau kalau user idle > (sessionDays*86400 - warningSeconds).
  // Untuk simplicity + reliability, kita pakai idle-timeout lokal:
  // - track last activity (mouse/keyboard/scroll)
  // - kalau idle > 25 menit → show warning countdown 2 menit
  // - kalau countdown habis → logout
  // Ini lebih predictable daripada guess server-side expiry.

  let lastActivity = Date.now();
  const IDLE_THRESHOLD_MS = 25 * 60 * 1000; // 25 menit idle → warning

  function recordActivity() {
    lastActivity = Date.now();
    if (showWarning()) {
      // User kembali aktif saat warning → dismiss warning
      setShowWarning(false);
      setSecondsLeft(0);
    }
  }

  async function checkSession() {
    try {
      await api("/api/auth/me");
      setSessionInfo({ valid: true, expiresAt: null });
    } catch {
      // 401 — session expired di server
      setSessionInfo({ valid: false, expiresAt: null });
      triggerTimeout();
    }
  }

  function checkIdle() {
    if (showWarning()) return; // warning sudah active, countdown jalan
    const idleMs = Date.now() - lastActivity;
    if (idleMs >= IDLE_THRESHOLD_MS) {
      startWarningCountdown();
    }
  }

  function startWarningCountdown() {
    setSecondsLeft(warningSeconds);
    setShowWarning(true);
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(countdownTimer);
          triggerTimeout();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function triggerTimeout() {
    setShowWarning(false);
    setSecondsLeft(0);
    if (countdownTimer) clearInterval(countdownTimer);
    logout().then(() => opts.onTimeout());
  }

  function extend() {
    // Refresh session: panggil /me (backend akan extend session cookie expiration via set-cookie)
    // Actually backend /me gak extend session. Tapi user activity reset idle timer.
    recordActivity();
    setShowWarning(false);
    setSecondsLeft(0);
    if (countdownTimer) clearInterval(countdownTimer);
    // Optional: re-fetch /me untuk konfirmasi session masih valid
    checkSession();
  }

  function logoutNow() {
    triggerTimeout();
  }

  onMount(() => {
    // Listen user activity
    window.addEventListener("mousemove", recordActivity, { passive: true });
    window.addEventListener("keydown", recordActivity);
    window.addEventListener("scroll", recordActivity, { passive: true });
    window.addEventListener("touchstart", recordActivity, { passive: true });

    // Poll session validity + idle check
    pollTimer = setInterval(() => {
      checkIdle();
    }, 10_000); // cek idle setiap 10s (lebih responsif)

    // Cek session validity setiap 1 menit (deteksi server-side expired dari device lain)
    setInterval(checkSession, pollIntervalMs);
  });

  onCleanup(() => {
    if (pollTimer) clearInterval(pollTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    window.removeEventListener("mousemove", recordActivity);
    window.removeEventListener("keydown", recordActivity);
    window.removeEventListener("scroll", recordActivity);
    window.removeEventListener("touchstart", recordActivity);
  });

  return {
    showWarning,
    secondsLeft,
    sessionInfo,
    extend,
    logoutNow,
  };
}
