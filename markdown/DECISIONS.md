# DECISIONS.md
> Rejected list + keputusan final. Sumber: AGENTS.md §4-5 (asli).
> Jangan disarankan/didiskusikan ulang tanpa alasan kuat.

## REJECTED (jangan disarankan ulang)

```
- "Tauri desktop" — diganti Electrobun (El 2026-07-22). Alasan: stack Bun/TS/Zig sudah dipakai; Tauri bawa Rust bridge + plugin SQL terpisah, double-stack. Jangan usulkan Tauri/Electron lagi kecuali El minta banding ulang.
```

## DECISIONS (keputusan final)

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
- "Wallet = kas toko (per-toko, bukan per-user): wallets.toko_id UNIQUE NOT NULL, FK ke toko(id)"
- "Wallet cash flow: penjualan → creditWallet(toko_id, total), restock → deductWallet(toko_id, cost)"
- "Chart expense real: wallet_transactions.type='purchase' dari restock, bukan mock seededRatio"
- "RevenueChart: expenseFor() returns d.expense ?? 0, red line real data"
- "OverviewTab: 4 cards pendapatan (hari ini, 7 hari, 30 hari, semua waktu)"
- "TOTP 2FA: admin-only untuk top-up saldo, otplib + qrcode, AES-256-GCM encrypt secret at-rest"
- "Top-up: POST /api/wallet/topup requires admin role + valid TOTP code (6 digit, 30s step)"
- "Secret encryption: AES-256-GCM, key derived from TOTP_ENCRYPTION_KEY env or scrypt fallback"
- "Repo hosting: Codeberg primary (dev, branch main) + GitHub secondary (mirror + GH Pages production)"
- "CLI: tea (Gitea CLI) ganti gh — hanya untuk Codeberg entity management (issues/pr/release)"
- "Sync model: periodik (tag/release) → push main + gh-pages ke GitHub; dev harian hanya ke Codeberg"
- "PR Workflow: semua perubahan via branch+PR (Codeberg), JANGAN push langsung ke main — lihat CONTRIBUTING.md"
- "Electrobun = full mode desktop (offline-first, Bun main process + system webview, bun:sqlite lokal, typed RPC, no server dependency)"
- "Desktop runtime: Electrobun (https://blackboard.sh/electrobun/ / docs: https://framework.blackboard.sh/electrobun/) — Bun+Zig native, tiny bundle, cross-platform"
- "Desktop data path: reuse shared/db-schema.sql + bun:sqlite di main process (bukan tauri-plugin-sql / rusqlite)"
- "Browser = limited mode (tetap butuh Bun server, hardening security jalan terus)"
- "Framework UI = SolidJS (signals, tiny bundle, POS-friendly) — dipakai browser + webview Electrobun"
- "Keamanan: SECURITY.md → threat model split browser vs desktop; disclosure via Codeberg confidential issue"
- "Email verification: Resend API (HTTP fetch, no dep) — dev mode log code+link ke console, production butuh RESEND_API_KEY + MAIL_FROM + APP_URL"
- "Password reset: 8-digit code + magic link (keduanya di email sama) — verify by token ATAU email+code, anti-replay via record used flag"
- "hCaptcha anti-bot di signup — butuh HCAPTCHA_SECRET + HCAPTCHA_SITE_KEY (kosong = skip mode testing), widget render kalau backend report enabled"
- "Password history anti-reuse — tolak new password sama dengan current + 3 hash terakhir, tabel password_history keep max 5 per user"
- "Type-safe error code — AuthErrorCode union (18 code) di backend, errorResponse(code, message, status, extra) helper, frontend bisa switch case"
- "Session timeout — idle 25 menit → warning modal 2 menit countdown → auto-logout, poll /api/auth/me 60s untuk deteksi server-side expired"
- "Performance low-end PC — GPU accel (translateZ + will-change) untuk animasi, content-visibility untuk off-screen, prefers-reduced-motion/data + pointer:coarse media queries"
- "Preload chunk — VerifyEmail/ResetPassword di-import idle di Login onMount via requestIdleCallback (instant nav setelah signup/forgot)"
- "AuthShell shared component — wrapper background+logo+card+footer, eliminate duplikasi 200+ lines di Login/VerifyEmail/ResetPassword"
- "Chart library: uPlot (native bars, ~35KB, no ECharts/Recharts bloat) — bar chart daily revenue"
- "Dashboard layout: bento box grid — stat cards 4-col, chart 2/3 + wallet 1/3"
- "Dark/light mode: data-theme='light'|'dark' on <html>, localStorage 'kasir-theme', CSS variables per theme"
- "Wallet: wallets + wallet_transactions tables, balance in IDR (integer), topup via POST /api/wallet/topup"
- "WASM input_buffer: separate 64KB input_buffer terpisah dari memory_buffer — mencegah overlap antara data input JS dan output allocation Zig. get_input_ptr() + get_input_size() export."
- "WASM readFromMemoryBuffer: Zig return offset relatif ke memory_buffer, JS harus tambah get_memory_ptr() untuk absolute address di linear memory."
- "WASM alloc_bytes: return ?usize (null=OOM), semua call site pakai orelse. Offset 0 valid setelah init_memory()."
- "POS search: pure backend SQL (NOT WASM) — index idx_produk_nama_toko (toko_id, nama), avg 0.081ms/query, in-memory cache TTL 10s per toko_id+query, cache-hit header (x-cache-hit)"
- "URL-synced search: useSearchParams ?q= synced live, auto-search on page load if ?q= present"
- "DiceBear shapes style: geometric avatar, palette emerald/indigo/amber, deterministic per nama kasir"
- "Diskon/PPN input: type=text inputmode=numeric (bukan type=number) — hilangkan spinner native"
- "PPN default 0% disabled, checkbox toggle enable/disable"
```
