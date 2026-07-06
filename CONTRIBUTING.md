# Contributing — KasirGo

**Motto: "PR First, push if I ask you so."**

## Aturan Wajib

### 1. JANGAN push langsung ke `main`
- Semua perubahan, sekecil apapun, harus lewat **branch + Pull Request** di Codeberg
- Tidak ada pengecualian — termasuk AI agent
- Main branch = protected (merge hanya via PR)

### 2. Branch naming
```
feat/<deskripsi>       # fitur baru
fix/<deskripsi>        # bugfix
chore/<deskripsi>      # tooling, CI, config
refactor/<deskripsi>   # rewrite tanpa fitur baru
docs/<deskripsi>       # dokumentasi saja
security/<deskripsi>   # patch keamanan
```
Contoh: `feat/tauri-desktop`, `fix/csrf-token-expiry`, `chore/update-tailwind-cdn`

### 3. Commit convention
```
type: deskripsi imperatif (present tense)

Contoh:
feat: add Tauri scaffold with SQLite plugin
fix: reject expired CSRF tokens
chore: update bun to 1.2.x
docs: add CONTRIBUTING.md
refactor: extract shared types to shared/
security: add CSP header to all responses
```
- Subject line ≤ 72 karakter
- Body opsional, pisahkan dengan blank line
- Jangan akhiri subject dengan titik
- Gunakan bahasa Inggris untuk commit message

### 4. PR Workflow
```
1. git checkout main && git pull origin main
2. git checkout -b feat/nama-fitur
3. ... kerja ... git commit ...
4. git push -u origin feat/nama-fitur
5. Buka PR di Codeberg: https://codeberg.org/ElCastra/KasIRGO/pulls
6. Tunggu review / minta review via `tea pr create`
7. Setelah approved → merge ke main via UI (rebase atau squash)
8. Hapus branch remote setelah merge
```

### 5. PR Checklist
Sebelum buka PR, pastikan:
- [ ] Branch rebased ke `main` terbaru (`git pull --rebase origin main`)
- [ ] Tidak ada conflict dengan `main`
- [ ] Semua endpoint yang disentuh sudah di-test manual (curl / browser)
- [ ] Build tidak rusak (`bun run build` sukses)
- [ ] Tidak ada file sampah (log, tmp, node_modules, .env)
- [ ] Kalau mengubah API: update README atau dokumentasi terkait
- [ ] Kalau mengubah security: beri label `security` di PR
- [ ] Commit history clean (rebase squash kalau perlu)

### 6. AI Agent Rule (Reasonix)
- **Agent tidak diizinkan push langsung ke `main`, period.**
- Agent wajib membuat branch baru untuk setiap perubahan
- Agent menulis deskripsi PR yang menjelaskan: apa, kenapa, dan dampak
- Agent memberi label yang sesuai (`feat`, `fix`, `chore`, `docs`, `security`)
- User (El) yang merge — agent hanya push branch + buka PR

---

## Repo Structure
```
KasirGO/
├── backend/            # Bun + SQLite server (browser mode)
│   ├── server.ts       # Entry point
│   ├── db.ts           # Schema + seed
│   ├── helpers.ts      # Config, CSRF, rate limit, RBAC, audit
│   ├── router.ts       # Route registry
│   └── routes/         # auth, toko, produk, transaksi, audit, alerts
├── styles/             # CSS custom
├── assets/             # Gambar, favicon
├── zig/                # Source Zig → WASM
├── *.html              # Frontend HTML (HTMX + Alpine.js + Tailwind)
├── script.js           # WASM loader + shared utils
├── config.js           # Frontend API config
├── build.js            # Build script → dist/
├── sync-gh.sh          # Sync Codeberg → GitHub mirror
├── PLAN.md             # Arsitektur + roadmap
├── SECURITY.md         # Kebijakan keamanan
├── CONTRIBUTING.md     # File ini
└── AGENTS.md           # Memory proyek untuk AI agent
```

## Tooling
| Tool  | Fungsi                                       |
| ----- | -------------------------------------------- |
| `bun` | Runtime + package manager + build            |
| `tea` | Gitea CLI — pengganti `gh` untuk Codeberg    |
| `zig` | Compile WASM (kasir.wasm)                    |

## Kontak
- **Primary:** Codeberg → https://codeberg.org/ElCastra/KasIRGO
- **Mirror:** GitHub → https://github.com/NitroCat29/kasirgo
