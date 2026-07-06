# Security Policy — KasirGo

## Versi yang didukung

| Mode           | Status              | Support aktif? |
| -------------- | -------------------- | -------------- |
| Browser (Web)  | Production (limited) | Ya             |
| Desktop (Tauri)| Planning (Q4 2026)   | Belum           |

## Langkah Keamanan Saat Ini (`main` branch)

### Browser mode
| Layer              | Mekanisme                                                                      |
| ------------------ | ------------------------------------------------------------------------------ |
| **Auth**           | Session cookie (`HttpOnly`, `Secure` on HTTPS), `Bun.password.hash` / `verify` |
| **CSRF**           | Token-based (`X-CSRF-Token` header), dipasang di semua state-changing endpoints|
| **RBAC**           | Hierarchy `admin > manajer > kasir`, `requireRole()` enforce per-endpoint       |
| **Rate Limiting**  | Brute-force protection: 5 attempt/menit/IP di `/api/auth/login`                |
| **Input Validation** | Field required, tipe & range divalidasi; reject JSON invalid (400, bukan silent `{}`) |
| **CORS**           | Restricted origin via `CORS_ORIGIN` env, credentials diset `true`              |
| **SRI**            | `integrity` attribute di semua CDN scripts (kecuali Tailwind CDN dinamis)       |
| **Session Cleanup**| Expired sessions dihapus saat login baru + periodic                            |
| **Database**       | `bun:sqlite` dengan parameterized query (tanpa string interpolation SQL)        |
| **Env**            | Semua config via `.env` process.env (PORT, DB_PATH, cookie settings)           |

### Belum diterapkan
- CSP header (Content-Security-Policy)
- Helmet-style security headers (X-Content-Type-Options, X-Frame-Options, dll)
- Audit logging sudah ada (CREATE/UPDATE/DELETE dicatat)

---

## Threat Model

### Browser mode (server-side attack surface)
| Ancaman                 | Mitigasi                                            | Residual risk             |
| ----------------------- | --------------------------------------------------- | ------------------------- |
| Brute force login       | Rate limit 5/menit/IP                               | Bypass via IP rotasi      |
| Session hijack          | HttpOnly + Secure cookie, session expiry 7 hari     | XSS bisa baca CSRF token  |
| CSRF                    | Token header `X-CSRF-Token`                         | Origin header spoofing?   |
| SQL injection           | Parameterized query (`bun:sqlite`)                  | Low (ORM-free, prepared)  |
| CORS bypass             | Origin restrict via env                             | Konfigurasi salah setting |
| Path traversal          | Static serve dari root project (no `..`)            | File expose kalau path injectable |
| DoS                     | Belum ada                                           | Bun.serve timeout default |

### Desktop mode (offline-first, no server)
| Ancaman               | Mitigasi                                             | Residual risk              |
| --------------------- | ---------------------------------------------------- | --------------------------- |
| SQLite corruption     | WAL mode, backup otomatis                            | File lock di Windows        |
| IPC spoofing          | Tauri `invoke` boundary + CSP                        | Plugin Tauri yang compromise |
| File system access    | Tauri sandbox (default: no fs access via JS)         | Rust-side fs module expose   |
| Malware inject WASM   | WASM integrity hash (pre-compile Zig)                | Belum ada SRI di desktop     |
| Network (sync opt-in) | Opt-in sync ke server, tidak default                 | Man-in-the-middle saat sync  |

---

## Melaporkan Kerentanan

Kami menyambut laporan kerentanan. **Tidak ada bounty program** saat ini — ini proyek solo open source.

**Cara report:**
- **Preferred:** Buka issue di Codeberg → https://codeberg.org/ElCastra/KasirGO/issues
  - Centang "This issue is confidential" (hanya terlihat oleh maintainer)
- **Alternatif:** Email ke maintainer (lihat commit author)
- **Format:** deskripsikan langkah reproduksi, versi/commit, dampak, dan kalau ada proof-of-concept

**Response timeline:**
- Acknowledgement: maksimal 7 hari
- Triase + fix: tergantung severity (target: critical < 48 jam)
- Disclosure: setelah patch merged ke `main` + release

**Scope:** semua kode di repo `ElCastra/KasirGO` (branch `main`), termasuk backend, frontend, WASM, dan file konfigurasi.

**Kami hargai:** researcher yang memberi waktu untuk triase sebelum publik, dan yang memberikan solusi (bukan hanya laporan).

---

## Offline-First sebagai Mitigasi Risiko

Desktop mode (Tauri, Q4 2026) mengeliminasi seluruh server-side attack surface:
- Tidak ada server = tidak ada CORS, session hijack, brute force, rate limit
- Attack surface menyusut ke: local filesystem + Tauri IPC + WASM sandbox
- Database ada di lokal (SQLite), tidak terekspos ke jaringan
- Sync ke server (kalau diaktifkan) = **opt-in**, bukan default — user memilih ekspos dirinya
