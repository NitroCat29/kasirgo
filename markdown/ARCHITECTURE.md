# ARCHITECTURE.md
> Sumber: AGENTS.md §6 (asli).

```
## Browser (limited mode)
Browser (SolidJS SPA)
  → fetch(/api/*) → Backend Bun (:3456)
    → bun:sqlite (kasirgo.sqlite) + password_history + email_verifications
    → Resend API (verification + reset email, dev fallback log console)
    → hCaptcha siteverify (anti-bot signup, skip kalau env kosong)
  → WASM (kasir.wasm via Zig) — perhitungan transaksi
  → SolidJS signals + AuthShell + Toast + SessionTimeout
  → Tailwind v4 JIT + Liquid Glass CSS + GPU accel (low-end PC)

## Desktop (full mode — Electrobun, Phase 3)
Electrobun app
  Bun main process
    → bun:sqlite lokal (reuse shared/db-schema.sql)
    → typed RPC ke webview
    → optional Sync Layer → Backend Bun (opt-in, later)
  System webview
    → SolidJS SPA (same frontend build)
    → WASM (kasir.wasm via Zig)
    → lib/desktop.ts bridge (isElectrobun + RPC, bukan Tauri)
```
