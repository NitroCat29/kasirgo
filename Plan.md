# Plan — KasirGo Architecture & Roadmap

> **Updated:** 2026-07-08 · **Status:** Phase 1+2 done, Phase 2.x + 2.x.1 done, Phase 3 next (progress ~60%)

---

## 1. Architecture Overview

### Mode Split

```
┌─────────────────────────────────────────────────────────────┐
│                    KasirGo v2 Architecture                    │
├────────────────────────────┬────────────────────────────────┤
│   BROWSER MODE (limited)   │   DESKTOP MODE (full)           │
│   existing, maintained     │   Tauri, Q4 2026 target         │
├────────────────────────────┼────────────────────────────────┤
│                            │                                 │
│  Browser                   │  Tauri Webview                  │
│    ↓                       │    ↓                            │
│  Bun Server :3456          │  SolidJS SPA                    │
│    ├─ static files (.html) │    ├─ offline CRUD              │
│    ├─ API (/api/*)         │    ├─ WASM (kasir.wasm)         │
│    └─ SQLite (server)      │    └─ Tauri invoke ↔ Rust       │
│                            │         ↓                       │
│  Network = required        │  SQLite (local, WAL mode)       │
│  Attack surface = server   │         ↓                       │
│  Auth = session cookie     │  Sync Layer (opt-in)            │
│  CSRF = required           │    → Bun Server (sync endpoint) │
│                            │                                 │
│  Use case:                 │  Use case:                      │
│  - Akses dari mana saja    │  - Toko fisik / POS counter     │
│  - Multi-device            │  - Offline-first, no internet   │
│  - Butuh koneksi internet  │  - Satu device per toko         │
└────────────────────────────┴────────────────────────────────┘
```

### Shared Layer
```
shared/
├── types.ts            # TypeScript types (Produk, Toko, Transaksi, User)
├── validation.ts       # Input validation (shared browser + desktop)
├── wasm-bridge.ts      # WASM load + invoke wrapper
└── db-schema.sql       # SQLite schema (identik di server & desktop)
```

### Data Flow
```
Desktop (offline):
  User action → SolidJS store → SQLite (local) → UI update
  (optional) → Sync queue → Bun Server (when online)

Browser (online):
  User action → SolidJS → fetch(/api/*) → Bun Server → SQLite → JSON → UI
```

---

## 2. Framework Evaluation (Codebase Rewrite)

**Current:** 5 HTML files + 1 JS + Alpine.js + Tailwind CDN
- Pros: zero build step, cepat prototype, low complexity
- Cons: no type safety, code duplication (HTML×5), SPA terbatas di Alpine.js, Tailwind CDN berat di production

**Goal rewrite:** tetap ringan, dev speed tinggi, bundle kecil, type-safe, satu codebase untuk browser + desktop.

| Kandidat     | Bundle    | TypeScript | Offline-first | Learning curve | Kecocokan POS |
| ------------ | --------- | ---------- | ------------- | -------------- | ------------- |
| **SolidJS**  | ~7KB      | first-class| signals alami | Rendah (JSX)   | ⭐⭐⭐⭐⭐    |
| Preact       | ~3KB      | via TS     | manual        | Sangat rendah  | ⭐⭐⭐⭐      |
| Astro        | zero JS*  | first-class| MPA, not SPA  | Rendah         | ⭐⭐ (MPA)    |
| Vue + Vite   | ~16KB     | first-class| Pinia + Vue   | Sedang         | ⭐⭐⭐⭐      |
| Svelte       | ~1.5KB    | via TS     | stores built-in| Rendah        | ⭐⭐⭐⭐      |

**Rekomendasi: SolidJS**
- Signals = reactive state untuk POS (keranjang, stok real-time)
- Zero VDOM, compiled to raw DOM — sangat cepat
- Bundle kecil (~7KB), crucial untuk desktop bundle size
- `solid-start` untuk browser mode (kalau perlu SSR)
- Kompatibel dengan WASM via `onMount` + lazy load
- Kekurangan: ekosistem lebih kecil dari React, tapi untuk POS tidak perlu ribuan library

**Next step:** Keputusan final El besok. Kalau setuju → init project SolidJS + Tauri.

---

## 3. Roadmap A–Z

### Fase 0: Dokumentasi & Aturan Main ✅
- [x] SECURITY.md — measures, threat model, disclosure
- [x] CONTRIBUTING.md — PR workflow, branch naming, agent rule
- [x] Plan.md — file ini
- [x] AGENTS.md update — progress recalibrate ke ~25%

### Fase 1: Shared Core ✅
- [x] `shared/types.ts` — pindahkan semua interface dari backend, jadikan source of truth
- [x] `shared/validation.ts` — ekstrak validasi dari `helpers.ts`, reuse di desktop
- [x] `shared/db-schema.sql` — symlink/salin dari backend schema, pastikan identik
- [x] `shared/wasm-bridge.ts` — abstract `loadWasm()` dari `script.js` jadi module reusable
- [x] Backend adapt: import dari `shared/` (hapus duplikasi)

### Fase 2: Framework Decision + Scaffolding ✅
- [x] Framework decision final: SolidJS (El approved 2026-07-07)
- [x] Setup Vite + SolidJS scaffold (frontend/ folder)
- [x] Migrasi index.html → SolidJS landing (Landing.tsx)
- [x] Migrasi login.html → SolidJS route (Login.tsx + auth.ts + api.ts)
- [x] Migrasi dashboard.html → SolidJS SPA (Dashboard.tsx, full CRUD)
- [x] Tailwind v4 JIT build via @tailwindcss/vite (bukan CDN)
- [x] server.ts serve frontend/dist/ sebagai SPA (fallback legacy HTML)

### Fase 2.x: Auth Hardening + Email Verification + Liquid Glass UI ✅
> Sesi 2026-07-08 — security upgrade auth flow + polish UI auth pages.

**Auth & RBAC baseline:**
- [x] Ganti akun demo: `admin/admin123` → `Ebril` (admin real, password kuat) + `demo/demo123` (fake-admin, read-only)
- [x] Role `fake-admin` di `ROLE_HIERARCHY` (level 3 = admin) — akses view admin, write-guard `assertCanWrite()` block POST/PATCH/DELETE di 12 handler (toko/produk/transaksi/users)
- [x] Hapus admin lama dari seed (cascade sessions via FK)

**Email authentication:**
- [x] Schema: kolom `email TEXT UNIQUE` + `verified INTEGER DEFAULT 0` di `users`, tabel baru `email_verifications` (id, user_id FK CASCADE, purpose, code_hash, token UNIQUE, expires_at, used, created_at)
- [x] Validation: `validateEmail()` — provider whitelist (gmail.com, outlook.com, live.com, hotmail.com, proton.me, protonmail.com), reject `+` dan `.` di local part (anti-alias), lowercase, regex local part `[a-z0-9_-]{3,64}`
- [x] `validateSignup` update — email required, username 3-20 char
- [x] `validateLogin` update — ganti `username` → `identifier` (email-or-username auto-detect via `isEmailIdentifier()`)

**Mail infra (Resend API, no dependency):**
- [x] `backend/mail.ts` — Resend HTTP client via native `fetch()`. Dev fallback: `RESEND_API_KEY` kosong → log code+link ke console (testing mode). Templates `sendVerificationEmail` + `sendPasswordResetEmail` dengan inline HTML kasir-accent palette
- [x] Config: `resendApiKey`, `mailFrom`, `verifyCodeExpiryMin` (30), `resetCodeExpiryMin` (15), `appUrl`, 3 rate limiter (signup 3/jam/IP, forgot 3/jam/IP+email, verify 5/menit/IP)
- [x] Helpers: `generate8DigitCode()` (zero-padded), `generateVerifyToken()` (UUID), `checkSignupRateLimit`, `checkForgotRateLimit`, `checkVerifyRateLimit`

**Auth flow rework:**
- [x] `POST /api/auth/signup` — rate limit, validate (email required), cek username+email unik (409 spesifik), insert `verified=0`, generate code+magic link, kirim email, response `pending_verification=true` (tidak auto-login)
- [x] `POST /api/auth/verify-email` — by token (magic link) ATAU email+code (manual), cek expiry, mark verified=1, auto-login + csrf cookie
- [x] `POST /api/auth/resend-verification` — rate limit per IP+email, generate ulang code
- [x] `POST /api/auth/login` — auto-detect identifier (email @ atau username), anti-enumeration generic error, cek verified (skip kalau no email backwards-compat), 403 `needs_verification` kalau unverified

**Password reset flow:**
- [x] `POST /api/auth/forgot-password` — anti-enumeration generic 200, generate code+magic link, kirim reset email
- [x] `POST /api/auth/verify-reset-code` — by token atau email+code, return `reset_token` untuk step reset
- [x] `POST /api/auth/reset-password` — update password_hash, invalidate semua session user (paksa logout device lain), mark record used (anti-replay)

**Liquid Glass UI (iOS-style glassmorphism):**
- [x] CSS utilities di `frontend/src/index.css`: `.liquid-glass` + `.liquid-glass-strong` (layered translucent bg + refractive blur 28-36px + specular sheen `::before` + inner glow `::after`), `.liquid-input` + `.liquid-input-wrap` (kasir-accent focus ring, fix inconsistency indigo), `.liquid-tab-container` + `.liquid-tab` (gradient active state), `.liquid-chip` (small glass chip), `.liquid-button` (sheen overlay + neon glow), `@keyframes liquid-entrance` + `.entrance-1/2/3` (staggered fade+scale+translateY)
- [x] Rewrite `Login.tsx` dengan 4-view state machine (login/signup/forgot/pending), liquid glass card, icon prefix per input, demo chip dengan chip-dot accent2, staggered entrance animation
- [x] Buat `VerifyEmail.tsx` — auto-verify dari `?token=` URL, fallback form manual (email + 8-digit code numeric-only dengan tracking 0.3em), tombol resend
- [x] Buat `ResetPassword.tsx` — 3-stage flow (verifying → manual → reset), auto-verify token, form email+code, form password baru + konfirmasi dengan validasi match + min 6 char
- [x] App.tsx route `/verify-email` + `/reset-password`
- [x] Update `lib/auth.ts` — User interface + email + verified, function baru (login by identifier, signup pending, verify by token/code, resend, forgot, verify-reset by token/code, reset-password)
- [x] CSRF exempt 5 endpoint pre-auth baru di `server.ts`

**Backwards-compat & bug fix:**
- [x] Seed users lama (Ebril/demo) auto `verified=1` — login tanpa email tetap jalan
- [x] `getUser()` return email + verified juga
- [x] Schema parser fix — strip inline comment `--` per baris dengan regex (sebelumnya bug: inline comment setelah kolom tidak ter-strip → SQLite error "incomplete input")

**Files affected:**
- Backend: `db.ts`, `helpers.ts`, `mail.ts` (baru), `routes/auth.ts`, `server.ts`
- Shared: `db-schema.sql`, `validation.ts`
- Frontend: `App.tsx`, `pages/Login.tsx`, `pages/VerifyEmail.tsx` (baru), `pages/ResetPassword.tsx` (baru), `lib/auth.ts`, `index.css`
- Config: `.env`, `.env.example`

**Verifikasi:** full flow signup→verify→login, forgot→verify-reset→reset→login password baru, anti-alias (+/.) block, anti-enumeration forgot, magic link by token, backwards-compat user lama, frontend build sukses

### Fase 2.x.1: UX/Security/Performance Polish ✅
> Sesi 2026-07-08 lanjutan — polish auth UX, dashboard, security hardening, performance tuning untuk PC low-end (mayoritas user kasir).

**Foundation & UI primitives:**
- [x] `frontend/src/components/AuthShell.tsx` (baru) — shared wrapper (background+logo+card+footer), eliminate duplikasi 200+ lines di Login/VerifyEmail/ResetPassword. `useAutoFocus()` hook, `PasswordField` (show/hide eye toggle), `ResendCooldown` (60s countdown real-time)
- [x] `frontend/src/components/ui.tsx` (baru) — `ToastContainer`, `Skeleton`/`SkeletonStatCard`/`SkeletonRow`, `EmptyState` (icon per type: users/toko/produk/transaksi/audit/search), `SearchInput`, `PasswordStrengthMeter`, `FieldError`, `SessionTimeoutModal`
- [x] `frontend/src/lib/toast.ts` (baru) — toast store (success/error/info/warning, auto-dismiss + progress bar), `calcPasswordStrength()` heuristic (length+case+digit+symbol+common-pattern penalty, 4-level weak/fair/good/strong)

**Auth UX:**
- [x] Show/hide password eye toggle di PasswordField (login, signup, reset-password)
- [x] Auto-focus first field per view change (login→identifier, signup→nama, forgot→email) via `useAutoFocus` + `createEffect`
- [x] Password strength meter di signup + reset-password (bar 4-level warna: weak red / fair orange / good green / strong gradient)
- [x] Resend cooldown 60s di VerifyEmail (button disabled + countdown "Kirim ulang kode (58s)")
- [x] Inline validation per field (FieldError component + `.field-error-state` border merah) — ganti dari top error-msg cuma ke granular per field
- [x] Enter key submit (native HTML form behavior — 19 form pakai `<form onSubmit>` + `<button type="submit">`)

**Dashboard polish:**
- [x] `frontend/src/lib/session-timeout.ts` (baru) — `useSessionTimeout` hook: track user activity (mouse/keyboard/scroll/touch), idle 25 menit → warning countdown 2 menit → auto-logout. Poll `/api/auth/me` setiap 60s untuk deteksi server-side expired (e.g. logout dari device lain)
- [x] `SkeletonStatCard` di overview saat `stats()` masih null (loading) — ganti dari text "Loading..." ke shimmer animation
- [x] `EmptyState` di 5 tabel (toko/produk/transaksi/users/audit) dengan icon per type + description + CTA button (tambah toko/produk/user)
- [x] `SessionTimeoutModal` mount di Dashboard dengan countdown real-time (mm:ss), tombol "Perpanjang sesi" + "Logout sekarang"

**Security & types:**
- [x] Type-safe error code — `AuthErrorCode` union (18 code: AUTH_INVALID_CREDENTIALS, AUTH_NOT_VERIFIED, AUTH_RATE_LIMITED, AUTH_EMAIL_TAKEN, AUTH_USERNAME_TAKEN, AUTH_EMAIL_NOT_FOUND, AUTH_TOKEN_INVALID, AUTH_TOKEN_EXPIRED, AUTH_CODE_INVALID, AUTH_CODE_EXPIRED, AUTH_NO_ACTIVE_CODE, AUTH_ALREADY_VERIFIED, AUTH_PASSWORD_REUSE, AUTH_HCAPTCHA_FAILED, AUTH_HCAPTCHA_MISSING, AUTH_INVALID_INPUT, AUTH_FORBIDDEN, AUTH_UNAUTHORIZED, AUTH_INTERNAL) + `errorResponse(code, message, status, extra?)` helper di `backend/helpers.ts`. Applied di login + reset-password endpoint
- [x] Password history anti-reuse — tabel `password_history` di schema (id, user_id FK CASCADE, password_hash, created_at). Check current + 3 hash terakhir di reset-password (anti reuse). Simpan password lama ke history sebelum update, cleanup keep max 5 per user. Code: `AUTH_PASSWORD_REUSE`
- [x] hCaptcha infra — `verifyHcaptcha(token, ip)` function (POST ke `api.hcaptcha.com/siteverify`, skip `remoteip` kalau "unknown"/kosong — fix bug `invalid-remoteip`). Config env `HCAPTCHA_SECRET` + `HCAPTCHA_SITE_KEY` (kosong = skip mode testing)

**Performance (low-end PC focus):**
- [x] GPU accel micro-opts — `translateZ(0)` + `will-change` untuk 9 animasi penting (`.blob-optimized`, `.aurora`, `.liquid-glass` pseudo-elements, `.pulse-dot`, `.scroll-bounce`, `.marquee-track`, `.toast-item`, `.liquid-button`, `.skeleton`, `.password-strength-fill`, `.spinner`, `.stat-card::before`)
- [x] `content-visibility: auto` + `contain-intrinsic-size` untuk `.feature-card` (skip render off-screen, hemat paint di low-end)
- [x] Media queries: `prefers-reduced-motion` (disable blob/aurora/pulse/entrance/marquee animation), `prefers-reduced-data` (reduce blur radius 140→80px, liquid-glass 28→16-20px), `pointer: coarse` (slow down blob 14s)
- [x] Print-friendly media query (bonus — hide decorative elements saat print)
- [x] Preload `VerifyEmail` + `ResetPassword` chunk di Login onMount via `requestIdleCallback` (idle-time import, gak block render — instant nav setelah signup/forgot)

**hCaptcha UI integration:**
- [x] Endpoint `GET /api/auth/hcaptcha-sitekey` — return `{ enabled, site_key }` dari config (frontend fetch ini, gak hardcode)
- [x] Script hCaptcha API di `frontend/index.html` head (async defer)
- [x] Widget `<div class="h-captcha">` di Login signup form (render kalau `hcaptchaEnabled() && hcaptchaSiteKey()`)
- [x] Global callbacks `onHcaptchaSuccess/Expired/Error` set signal di Login component
- [x] Verify di `POST /api/auth/signup` via `verifyHcaptcha()` — wajib kalau enabled, return `AUTH_HCAPTCHA_MISSING` (400) kalau token kosong, `AUTH_HCAPTCHA_FAILED` (400) kalau verify gagal
- [x] Reset hCaptcha widget via `hcaptcha.reset()` kalau signup gagal (token sudah consumed di backend)

**Files affected:**
- Backend: `helpers.ts` (+ errorResponse/AuthErrorCode, verifyHcaptcha, password history logic), `routes/auth.ts` (+ hcaptcha-sitekey endpoint, hCaptcha verify di signup, errorResponse di login+reset), `server.ts` (CSRF exempt update — sudah dari Fase 2.x)
- Shared: `db-schema.sql` (+ password_history table)
- Frontend baru: `components/AuthShell.tsx`, `components/ui.tsx`, `lib/toast.ts`, `lib/session-timeout.ts`
- Frontend update: `pages/Login.tsx` (hCaptcha widget + auto-focus + inline validation + password strength), `pages/VerifyEmail.tsx` (ResendCooldown), `pages/ResetPassword.tsx` (PasswordField + strength meter), `pages/Dashboard.tsx` (skeleton + empty state + session timeout modal), `lib/auth.ts` (+ getHcaptchaConfig, signup dengan hcaptchaToken), `index.css` (+ GPU accel + content-visibility + toast + skeleton + empty-state + session-timeout + print), `index.html` (+ hCaptcha script), `App.tsx` (+ ToastContainer mount)
- Config: `.env` + `.env.example` (+ HCAPTCHA_SECRET, HCAPTCHA_SITE_KEY)

**Verifikasi:** signup dengan hcaptcha_token (test key resmi hCaptcha) → 201, signup tanpa token → 400 AUTH_HCAPTCHA_MISSING, signup dengan fake token → 400 AUTH_HCAPTCHA_FAILED, password history anti-reuse (reset dengan password lama → 400 AUTH_PASSWORD_REUSE), login invalid → 401 AUTH_INVALID_CREDENTIALS, frontend build sukses 598ms no error

### Fase 3: Tauri Desktop
- [ ] Init Tauri v2 (`bun create tauri-app`)
- [ ] Konfigurasi Tauri: window size, title, icon, permissions
- [ ] Integrasi SQLite via `tauri-plugin-sql` atau Rust `rusqlite`
- [ ] Rust side: database init, migration, seed
- [ ] Bridge JS ↔ Rust: `invoke('db_query', { sql, params })`
- [ ] Shared validation + types import dari `shared/`
- [ ] WASM load di Tauri webview (pastikan memory/table import kompatibel)
- [ ] Offline CRUD: read/write SQLite lokal, UI update via signals
- [ ] Build target: `.AppImage` (Linux) + portable `.exe` (Windows)

### Fase 4: Sync Layer (opt-in)
- [ ] Sync queue model (local changes → pending → sync ke server)
- [ ] Conflict resolution: last-write-wins atau manual conflict UI
- [ ] Backend: `/api/sync/push` + `/api/sync/pull` endpoint
- [ ] Auth di desktop: device token, bukan session cookie
- [ ] UI toggle: "Sync ke server" on/off

### Fase 5: Polish & Production
- [ ] CSP headers + security headers (browser mode)
- [ ] Error boundary + offline fallback UI (desktop mode)
- [ ] Auto-update via Tauri updater
- [ ] CI/CD: build AppImage + .exe via GitHub Actions
- [ ] Publish ke Codeberg releases

---

## 4. Risk Register

| Risk                        | Impact | Likelihood | Mitigation                                     |
| --------------------------- | ------ | ---------- | ---------------------------------------------- |
| WASM tidak kompatibel di Tauri webview | High | Low | Pre-compile wasm32-unknown-unknown, test dulu  |
| SolidJS learning curve El   | Medium | Medium | Mulai dari komponen kecil, bandingin dengan Alpine.js |
| SQLite conflict dual write | High | Medium | WAL mode + sync via timestamp, test concurrent |
| Tauri build bug Windows     | Medium | Medium | CI/CD early, test di Windows VM dari awal      |
| Bundle size membengkak | Low | Low | Tailwind JIT + code splitting, target < 500KB |

---

## 5. Non-Goals (not planned)

- Mobile app (iOS/Android) — fokus desktop + web
- Multi-tenant / SaaS — single toko per instance
- Real-time sync via WebSocket — out of scope, queue-based sync cukup
- Internationalization (i18n) — Bahasa Indonesia only
- Dark mode toggle — default dark (kasir night mode)

---

## 6. Reference
- [SolidJS docs](https://docs.solidjs.com)
- [Tauri v2 docs](https://v2.tauri.app)
- [tauri-plugin-sql](https://github.com/tauri-apps/tauri-plugin-sql)
- [Zig → WASM](https://ziglang.org/documentation/master/#WebAssembly)
