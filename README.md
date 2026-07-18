# KasirGO

Sistem kasir modern untuk toko kecil-menengah. Frontend ringan (HTMX + Alpine.js + Tailwind), backend Bun + SQLite, perhitungan transaksi dipercepat via WebAssembly (Zig).

## Repo

- **Primary (dev):** Codeberg → https://codeberg.org/ElCastra/KasirGO (`main`)
- **Secondary (mirror + production):** GitHub → https://github.com/NitroCat29/kasirgo
- **Production landing page:** GitHub Pages → https://nitrocat29.github.io/kasirgo/

```bash
# Clone dari Codeberg (primary)
git clone https://codeberg.org/ElCastra/KasirGO.git
cd KasirGO

# Jalankan backend (dev)
bun run dev
```

> GitHub adalah mirror sekunder yang di-sync **periodik** (saat rilis/tag).
> Push harian hanya ke Codeberg. Sync ke GitHub dilakukan manual via script `sync-gh`.

## Stack

| Layer       | Teknologi                              |
| ----------- | -------------------------------------- |
| Frontend    | HTMX + Alpine.js + Tailwind CSS        |
| Backend     | Bun + SQLite (`bun:sqlite`)            |
| Perhitungan | Zig → WASM (`kasir.wasm`)              |
| CLI dev     | `tea` (Gitea CLI) untuk manajemen Codeberg |

## Cara jalanin

```bash
cd frontend && bun install    # install frontend dependencies

# Terminal 1: backend
bun --hot backend/server.ts   # backend Bun di :3456

# Terminal 2: frontend
cd frontend && bun run dev    # Vite dev server di :5173

# Build produksi
cd frontend && bun run build  # → frontend/dist/
```

## Sync ke GitHub (mirror)

```bash
# setelah tag release di Codeberg
./sync-gh.sh       # push main + gh-pages ke remote github
```

Lihat `AGENTS.md` untuk detail arsitektur, keputusan final, dan status pengembangan.
