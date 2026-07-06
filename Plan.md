# Plan — KasirGo Architecture & Roadmap

> **Updated:** 2026-07-07 · **Status:** Planning phase (progress ~25%)

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
  User action → HTMX/Alpine.js → fetch(/api/*) → Bun Server → SQLite → JSON → UI
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

### Fase 0: Dokumentasi & Aturan Main (current)
- [x] SECURITY.md — measures, threat model, disclosure
- [x] CONTRIBUTING.md — PR workflow, branch naming, agent rule
- [x] Plan.md — file ini
- [x] AGENTS.md update — progress recalibrate ke ~25%

### Fase 1: Shared Core
- [ ] `shared/types.ts` — pindahkan semua interface dari backend, jadikan source of truth
- [ ] `shared/validation.ts` — ekstrak validasi dari `helpers.ts`, reuse di desktop
- [ ] `shared/db-schema.sql` — symlink/salin dari backend schema, pastikan identik
- [ ] `shared/wasm-bridge.ts` — abstract `loadWasm()` dari `script.js` jadi module reusable
- [ ] Backend adapt: import dari `shared/` (hapus duplikasi)

### Fase 2: Framework Decision + Scaffolding
- [ ] El putuskan framework (SolidJS recommended)
- [ ] `bun create solid` atau manual setup Vite + SolidJS
- [ ] Migrasi dashboard.html → SolidJS SPA (component-based)
- [ ] Migrasi login.html → SolidJS route
- [ ] Migrasi index.html → SolidJS landing
- [ ] Tailwind di-build (JIT, bukan CDN) → bundle kecil
- [ ] Build gh-pages dari SolidJS output

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
