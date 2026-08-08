# FILES_STATUS.md
> Sumber: AGENTS.md §7 (asli). Jangan biarkan tabel ini nggak sinkron sama kondisi repo nyata.

```
| file                           | status | note |
|--------------------------------|--------|------|
| backend/server.ts              | done   | Thin entry point (95 baris), Bun.serve + static serving
| backend/db.ts                  | done   | Schema + seed logic
| backend/helpers.ts             | done   | json(), parseBody(), getUser(), makeSessionCookie(), config, rateLimit, CSRF, cleanup, requireRole(), logAudit(), deductWallet(), creditWallet()
| backend/router.ts              | done   | Route registry + handler resolver + auditRoutes + alertsRoutes
| backend/routes/auth.ts         | done   | Auth handlers: signup, login, logout, me
| backend/routes/toko.ts         | done   | CRUD handlers toko + RBAC + audit logging
| backend/routes/produk.ts       | done   | CRUD handlers produk + RBAC + audit logging + stock_threshold + search cache (TTL 10s) + cache-hit header + COLLATE NOCASE
| backend/routes/transaksi.ts    | done   | CRUD + RBAC + audit + creditWallet(toko_id) after COMMIT
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
| frontend/public/assets/        | done   | Logo favicon (kasirku_logo.svg), single source |
| build.js                       | done   | Build script: minify JS, copy static, fix paths for GH Pages |
| frontend/package.json           | done   | SolidJS + Vite + Tailwind v4 + @solidjs/router (single package.json) |
| dist/                          | done   | Production build output, deployed to gh-pages branch |
| railway.json                   | done   | Railway config: Bun builder, start command, healthcheck |
| config.js                      | done   | Frontend API config: window.API_BASE (empty = same origin) |
| AGENTS.md                      | done   | Updated sesi 2026-07-07 (rewrite plan, PR workflow, security) |
| Plan.md                        | done   | Arsitektur mode split, framework eval, roadmap 5 fase |
| CONTRIBUTING.md                 | done   | PR workflow, branch naming, commit convention, agent rule |
| SECURITY.md                     | done   | Measures, threat model (browser vs desktop), disclosure |
| frontend/vite.config.ts         | done   | SolidJS plugin, Tailwind plugin, proxy /api → :3456 |
| frontend/src/App.tsx            | done   | Router: /, /login, /dashboard, * (404) |
| frontend/src/pages/Landing.tsx  | done   | Hero section, CTA buttons, glassmorphism |
| frontend/src/pages/Login.tsx    | done   | Login/signup form, SHA-256 hash, error handling |
| frontend/src/pages/Dashboard.tsx | done   | Bento box layout, stat cards, chart+wallet, theme toggle, CRUD toko/produk/transaksi |
| frontend/src/lib/api.ts         | done   | Fetch wrapper, CSRF token, credentials include, csrfHeaders export |
| frontend/src/lib/auth.ts        | done   | SolidJS signals: user() (with email+verified), login (identifier), signup (with email + hcaptchaToken), verifyEmailByToken/Code, resendVerification, forgotPassword, verifyResetCodeByToken/Code, resetPassword, logout, fetchMe, getHcaptchaConfig
| frontend/src/lib/wasm.ts        | done   | loadWasm(), calculateTotal(), jsFallback, wasmReady signal
| frontend/src/lib/toast.ts       | done   | Toast store (success/error/info/warning, auto-dismiss + progress bar) + calcPasswordStrength (4-level weak/fair/good/strong)
| frontend/src/lib/session-timeout.ts | done | useSessionTimeout hook (idle 25 menit + warning 2 menit countdown + auto-logout + /api/auth/me polling 60s)
| frontend/src/components/AuthShell.tsx | done | Shared wrapper (background+logo+card+footer, eliminate duplikasi 200+ lines) + useAutoFocus hook + PasswordField (show/hide eye toggle) + ResendCooldown (60s countdown)
| frontend/src/components/ui.tsx   | done   | ToastContainer + Skeleton/SkeletonStatCard/SkeletonRow + EmptyState (7 type icon: users/toko/produk/transaksi/audit/search/cart) + SearchInput + PasswordStrengthMeter + FieldError + SessionTimeoutModal
| sync-gh.sh                     | done   | Script sync Codeberg → GitHub mirror + GH Pages |
| shared/types.ts                | done   | Toko, Produk, Transaksi, User, AuditLog, WasmExports interfaces |
| shared/validation.ts           | done   | 8 validation functions: signup (with email), login (identifier), toko, produk, transaksi + validateEmail (provider whitelist + anti-alias +/.) + isEmailIdentifier
| shared/db-schema.sql           | done   | 6 tables: toko, produk, transaksi, users, wallets (toko_id UNIQUE), wallet_transactions + 3 indexes
| shared/wasm-bridge.ts          | done   | loadWasm(), calculateTotal(), computeBenchmark(), jsFallback, loadProducts(), batchCheckLowStock() — input_buffer based
| frontend/index.html            | done   | Vite entry + hCaptcha API script (async defer) in head
| frontend/src/index.css          | done   | Tailwind v4 + theme tokens + light mode + glass + liquid glass + GPU accel + content-visibility + prefers-reduced-motion + pointer:coarse + password-strength + field-error + toast + skeleton + empty-state + search + session-timeout + print-friendly + kasir-input + ppn-checkbox + kasir-dropdown + btn-bayar + payment-overlay + kasir-avatar
| backend/routes/wallet.ts        | done   | Wallet per-toko: getMyWallet?toko_id, getMyHistory?toko_id, listWallets, topupWallet(admin+TOTP), disableTotp
| frontend/src/components/RevenueChart.tsx | done | uPlot bar chart, daily revenue, theme-aware colors |
| backend/cache.ts               | done   | In-memory search cache (Map, TTL 10s), searchCacheGet/Set/InvalidateToko/Clear |
| frontend/src/components/WalletCard.tsx | done | Wallet per-toko: tokoId prop, fetch balance+history by toko_id, topup modal+TOTP |
| frontend/src/pages/Kasir.tsx   | done   | POS page: live search (debounce 200ms, URL ?q= sync), cart, custom dropdown toko (GSAP), PPN toggle, DiceBear shapes avatar, btn-bayar gradient emerald→indigo, blur+grain overlay + product catalog grid (client-side filter), cart+summary+pay in fixed right panel, keyboard shortcuts (Ctrl+K/Esc/Enter), mobile responsive (stack layout), qty inline edit, toast feedback |
```
