# AGENTS.md
> File memory project untuk AI coding agent (Reasonix / Codex CLI / Claude Code / dst).
> Diisi dan diupdate oleh agent sendiri tiap akhir sesi — bukan untuk di-paste manual.
> Ganti semua `<...>` saat setup pertama kali.

---

## 0. ATURAN AGENT (baca dulu, selalu patuhi)

```
MODE: caveman-style
- Reasoning singkat. Jangan jelaskan proses berpikir panjang kecuali diminta.
- Jangan narasi ulang apa yang akan dilakukan — langsung kerjakan, lapor hasil.
- Output non-kode: padat, poin-poin, tanpa basa-basi pembuka/penutup.
- Output kode: tetap lengkap & benar, JANGAN dipersingkat/disensor demi gaya ini.
- Default jawab: bullet / checklist, bukan paragraf, kecuali penjelasan teknis butuh prosa.
- 1 task per giliran kecuali diminta sebaligus.
- Jangan tulis ulang file penuh kalau cuma berubah sebagian — kasih diff/patch saja.
- Jangan tambah dependency/package baru tanpa konfirmasi.
- Kalau tidak yakin / tidak ada di konteks: bilang "tidak tahu", jangan menebak.
```

### Preferensi tooling (wajib diikuti, jangan disarankan ganti)

```
package_manager : "bun"   # selalu pakai bun, BUKAN npm/yarn/pnpm
- install      : bun install         (bukan npm install)
- run script   : bun run <script>    (bukan npm run)
- add package  : bun add <pkg>       (bukan npm install <pkg>)
- exec/runner  : bun <file>          (bukan node <file>)
- Kalau ada package.json lama dengan lockfile npm/yarn (package-lock.json / yarn.lock),
  jangan dipakai sebagai acuan — pakai/buat bun.lockb.
```

### Bahasa + nickname user
```
- Bahasa Indonesia santai
- panggil user "El"
```

---

## 1. PROJECT INFO

```
project  : "KasirGo"
stack    : ["HTMX", "Alpine.js", "Tailwind CSS", "Bun", "SQLite", "Zig/WASM"]
runtime  : "bun"
os       : "Windows"
repo     : "E:\\Coding\\KasirGO"
updated  : "2026-07-03"
git_primary  : "Codeberg → https://codeberg.org/ElCastra/KasirGO (branch: main)"
git_secondary: "GitHub  → https://github.com/NitroCat29/kasirgo (mirror + GH Pages production)"
cli      : "tea (Gitea CLI) sebagai pengganti gh — hanya untuk Codeberg entity mgmt"
sync     : "Periodik (tag/release) → push ke GitHub mirror + GH Pages"
```

---

## 2. STATUS SEKARANG

```
wip      : "Backend features completed: RBAC, audit logging, low stock alerts"
progress : 100%
blocker  : "null"
next     : "Deploy backend ke Railway + update config.js dengan Railway URL"
```

---

## 3. TO-DO (checklist hidup — update tiap sesi)

> Format: `- [x]` selesai, `- [ ]` belum, `- [~]` sedang dikerjakan.
> Urutkan dari yang paling dekat dieksekusi.

```
- [~] Repo migration: Codeberg primary (dev) + GitHub secondary (mirror/production)
  - [x] Remote setup: origin=Codeberg (main), github=GitHub (mirror)
  - [x] Rebase lokal main di atas origin/main (resolve README conflict → pakai versi lokal)
  - [x] AGENTS.md + README update: repo URL, decisions, tea sebagai pengganti gh
  - [ ] tea login add (Codeberg) — butuh token dari El (manual)
  - [ ] Script/alias sync-gh (push main + gh-pages ke GitHub saat release)
  - [ ] First push main → Codeberg + verify
- [x] Backend features (RBAC, audit, alerts)
  - [x] RBAC: requireRole() middleware dengan hierarchy (admin > manajer > kasir)
  - [x] Audit logging: logAudit() helper + audit_logs table
  - [x] Audit routes: GET /api/audit-logs (admin only)
  - [x] Low stock alerts: GET /api/alerts/low-stock, GET /api/alerts/summary
  - [x] WASM batch_check_low_stock() untuk bulk check produk
  - [x] Schema migration: stock_threshold column di produk
- [x] Fix loadWasm(): memory + table import untuk WASM Zig
- [x] Security + Architecture rework (sebelum deploy)
  - [x] Split server.ts → backend/db.ts, routes/auth.ts, routes/toko.ts, routes/produk.ts, routes/transaksi.ts, helpers.ts
  - [x] Input validation: wajibkan field required, validasi tipe & range, reject invalid
  - [x] Rate limiting: brute-force protection di /api/auth/login (max 5 attempt/menit/IP)
  - [x] CSRF protection: token-based untuk state-changing endpoints
  - [x] CORS hardening: restrict origin ke domain sendiri (env-based)
  - [x] Cookie flags: tambah Secure + perbaiki SameSite untuk production
  - [x] Session cleanup: hapus expired sessions (on-login atau periodic)
  - [x] parseBody fix: return 400 kalau JSON invalid, bukan silent {}
  - [x] Env config: .env support untuk port, DB path, cookie settings, CORS origin
  - [x] SRI hashes: tambah integrity attribute ke semua CDN scripts
- [x] Deploy / production setup
  - [x] Git init + .gitignore (exclude .env, sqlite*, .reasonix/, dist/, zig artifacts)
  - [x] GitHub repo: https://github.com/NitroCat29/kasirgo
  - [x] Build script (bun run build → dist/)
  - [x] GitHub Pages: https://nitrocat29.github.io/kasirgo/ (gh-pages branch)
- [~] Backend hosting (Railway.app)
  - [x] railway.json config (Bun builder, start command, healthcheck)
  - [x] Frontend configurable API URL (window.API_BASE di config.js)
  - [x] Frontend fetch() updated: API_BASE prefix + credentials: 'include'
  - [ ] Deploy backend ke Railway (manual: sign up → connect repo → set env vars)
  - [ ] Update config.js dengan Railway URL setelah deploy
- [x] Integrasi frontend (HTMX) ke backend API
- [x] Static file serving dari Bun :3456 + clean URLs (/login → /login.html)
- [x] Custom 404.html dengan glassmorphism design
- [x] Client-side SHA-256 hash password sebelum POST (login/signup)
- [x] WASM conditional badge (hijau "ZIG WASM" / oranye "JS FALLBACK")
- [x] Favicon kasirku_logo.svg di folder assets/ (semua HTML)
- [x] Setup backend folder + Bun + SQLite schema
- [x] Seed mockup data: 2 toko, 10 produk
- [x] Route fix: paramKey p.length >= 3 untuk PATCH/DELETE
- [x] CRUD backend API: endpoint toko, produk, transaksi (GET/POST/PATCH/DELETE) + fix routing
- [x] Auth backend: tabel users + sessions, endpoint signup/login/logout/me/stats
- [x] login.html: halaman login/signup dengan glassmorphism, Alpine.js
- [x] dashboard.html: dashboard dengan stat cards, CRUD toko/produk/transaksi, sidebar
- [x] README.md: dokumentasi lengkap stack, cara jalankan, API endpoint
```

---

## 4. REJECTED (jangan disarankan ulang)

```
```

---

## 5. DECISIONS (keputusan final, tidak perlu didiskusikan ulang)

```
- "Backend subfolder backend/" — Bun + SQLite, port 3456, CORS restricted (env-based)
- "package_manager: bun" — tidak boleh npm/yarn/pnpm
- "Bahasa Indonesia santai, panggil user El"
- "Auth: session cookie (HttpOnly), Bun.password.hash/verify, users + sessions table"
- "Login/Signup flow: Alpine.js fetch ke /api/auth/*, client-side SHA-256 hash password"
- "Dashboard: Alpine.js SPA-style (bukan HTMX partials), full CRUD dengan modal"
- "Static serving: Bun single port :3456, serve .html/.css/.js/.wasm, clean URLs"
- "404 handling: custom 404.html (browser), JSON untuk API requests"
- "Favicon: kasirku_logo.svg di /assets/, linked di semua HTML"
- "WASM badge: conditional hijau 'ZIG WASM' (ready) / oranye 'JS FALLBACK' (not ready)"
- "Env config: .env example template, semua config via process.env dengan defaults"
- "Security: CSRF token-based (header X-CSRF-Token), rate limit login (5/menit/IP)"
- "Cookie: session HttpOnly + csrf_token non-HttpOnly, Secure flag conditional (HTTPS)"
- "SRI hashes: integrity attribute di semua CDN scripts (kecuali Tailwind CDN dinamis)"
- "Codebase: split modular — db.ts, helpers.ts, router.ts, routes/auth|toko|produk|transaksi.ts"
- "Backend hosting: Railway.app (free tier: 512MB RAM, 1GB storage, 1 vCPU)"
- "Frontend API config: window.API_BASE di config.js (empty = same origin, isi URL Railway untuk production)"
- "RBAC: role hierarchy admin > manajer > kasir, requireRole() returns user or Response"
- "Audit logging: logAudit() helper, audit_logs table tracks CREATE/UPDATE/DELETE actions"
- "Low stock alerts: stock_threshold column, GET /api/alerts/* endpoints, WASM batch check"
- "Repo hosting: Codeberg primary (dev, branch main) + GitHub secondary (mirror + GH Pages production)"
- "CLI: tea (Gitea CLI) ganti gh — hanya untuk Codeberg entity management (issues/pr/release)"
- "Sync model: periodik (tag/release) → push main + gh-pages ke GitHub; dev harian hanya ke Codeberg"

---

## 6. ARCHITECTURE (ASCII, 3-5 baris cukup)

```
Browser (index.html)
  → HTMX (ajax) → Backend Bun (:3456)
    → bun:sqlite (backend/db/kasirgo.sqlite)
  → WASM (kasir.wasm via Zig) — perhitungan transaksi
  → Alpine.js — state management frontend
  → Tailwind CDN — styling
```

---

## 7. FILES STATUS

```
| file                           | status | note |
|--------------------------------|--------|------|
| backend/server.ts              | done   | Thin entry point (95 baris), Bun.serve + static serving
| backend/db.ts                  | done   | Schema + seed logic
| backend/helpers.ts             | done   | json(), parseBody(), getUser(), makeSessionCookie(), config, rateLimit, CSRF, cleanup, requireRole(), logAudit()
| backend/router.ts              | done   | Route registry + handler resolver + auditRoutes + alertsRoutes
| backend/routes/auth.ts         | done   | Auth handlers: signup, login, logout, me
| backend/routes/toko.ts         | done   | CRUD handlers toko + RBAC + audit logging
| backend/routes/produk.ts       | done   | CRUD handlers produk + RBAC + audit logging + stock_threshold
| backend/routes/transaksi.ts    | done   | CRUD handlers transaksi + RBAC + audit logging
| backend/routes/audit.ts        | done   | GET /api/audit-logs (admin only)
| backend/routes/alerts.ts       | done   | GET /api/alerts/low-stock, GET /api/alerts/summary
| backend/db/kasirgo.sqlite      | done   | SQLite DB, seed: admin (sha256 hashed), 2 toko, 10 produk, audit_logs table, stock_threshold column
| .env.example                   | done   | Template env vars: PORT, DB_PATH, CORS_ORIGIN, SESSION_DAYS, COOKIE_SECURE, RATE_LIMIT
| index.html                     | done   | Landing page, WASM conditional badge working, SRI hashes added
| login.html                     | done   | Login/signup, client SHA-256 hash, Alpine.js, SRI hashes added
| dashboard.html                 | done   | Admin dashboard, stat cards, CRUD modals, SRI hashes added
| 404.html                       | done   | Custom 404 with glassmorphism design |
| script.js                      | done   | loadWasm() fixed: pakai exports.memory + init_memory() |
| styles/style.css               | done   | Custom CSS (glass, reveal, blob, badge-wasm-*) |
| kasir.wasm                     | done   | Zig-compiled WASM (647KB) + batch_check_low_stock |
| zig/                           | done   | Source Zig untuk WASM (main.zig dengan batch_check_low_stock) |
| assets/kasirku_logo.svg        | done   | Logo favicon 4.5KB, linked di semua HTML |
| build.js                       | done   | Build script: minify JS, copy static, fix paths for GH Pages |
| package.json                   | done   | Scripts: build (→ dist/), dev (backend) |
| dist/                          | done   | Production build output, deployed to gh-pages branch |
| railway.json                   | done   | Railway config: Bun builder, start command, healthcheck |
| config.js                      | done   | Frontend API config: window.API_BASE (empty = same origin) |
| AGENTS.md                      | done   | Updated sesi 2026-07-03 (RBAC, audit, alerts added) |
```

`active_file: "AGENTS.md"`

---

## 8. TOOLING ALTERNATIF (dipertimbangkan, BELUM final — jangan pakai tanpa konfirmasi)

> Daftar opsi non-mainstream yang bisa dicoba kalau ada alasan spesifik.
> Agent boleh SARANKAN dari sini, tidak boleh GANTI stack diam-diam.

```
- package_manager_alt : "pnpm" (symlink, hemat disk) | "vlt" (baru, eksperimental)
- runtime_alt          : "Deno" (TS native, permission sandbox --allow-net dst)
- test_runner_alt      : "bun test" (built-in, skip Jest/Vitest setup)
- lint_format_alt      : "Biome" (pengganti ESLint+Prettier, 1 binary Rust, cepat)
- db_lokal_alt         : "bun:sqlite" (built-in di Bun, untuk prototype/project kecil)
- monorepo_alt         : "Moon" (build system, caching agresif, config eksplisit)
```

---

## 9. CARA UPDATE FILE INI

**Akhir sesi**, minta agent:
```
Sesi selesai. Update AGENTS.md: pindahkan task selesai ke checklist [x],
update status/blocker/next, isi rejected & decisions kalau ada yang baru.
```

**Awal sesi baru** — agent baca file ini otomatis (tidak perlu paste manual).
Cukup ketik: `lanjut` atau `mulai dari next`.

---

## 10. EXPORT KE .txt (untuk AI chat web tanpa file access)

> Dipakai kalau mau bawa memory ini ke Claude.ai/ChatGPT/dst yang nggak baca file dari disk.
> Agent merangkum AGENTS.md jadi SATU blok teks paste-able — bukan dump mentah seluruh file.

**Trigger ke agent:**
```
Generate HANDOFF.txt dari AGENTS.md ini — rangkum jadi satu blok teks
yang bisa langsung di-paste ke AI chat web lain. Prioritaskan:
status, next, rejected, decisions, files_status singkat.
Jangan sertakan §0 (aturan agent) dan §8 (tooling alternatif) — itu
khusus untuk agent ini, tidak relevan untuk chat manual.
```

**Hasil yang diharapkan** (format mirip `SESSION_HANDOFF.txt` lama):
```
HANDOFF {
  project, stack, runtime, os, date
  status { wip, progress, blocker, next }
  done [...]
  rejected [...]
  decisions [...]
  arch """ ... """
  files_status [...]
  active_file
}
```

**Kapan dipakai:** kuota agent/API hampir habis, atau mau second-opinion
dari model lain tanpa setup ulang context dari nol.

---

## Catatan

- File ini hidup di root repo, dibaca otomatis oleh agent tiap run.
- Jangan biarkan checklist §3 dan files_status §7 nggak sinkron — keduanya harus cerminan kondisi nyata repo.
- Kalau file ini sudah terlalu panjang (>150 baris isi nyata), pertimbangkan split per-modul.

## Notes

- all
