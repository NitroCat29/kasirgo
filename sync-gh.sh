#!/usr/bin/env bash
# sync-gh.sh - Sync Codeberg (primary) -> GitHub (secondary/mirror + GH Pages)
# Jalankan SETELAH tag release di Codeberg. Dev harian TIDAK pakai ini.
set -euo pipefail

GH_REPO="https://github.com/NitroCat29/kasirgo.git"
ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/frontend/dist"

echo "==> Build produksi (frontend/dist/)"
cd "$ROOT/frontend" && bun run build

echo "==> Copy kasir.wasm ke dist"
cp -f "$ROOT/frontend/public/kasir.wasm" "$DIST/kasir.wasm"

echo "==> Push main -> github (mirror)"
cd "$ROOT" && git push github main

echo "==> Deploy frontend/dist/ -> github gh-pages"
cd "$DIST"
git init -q
git config user.email "deploy@kasirgo.local"
git config user.name "KasirGO Deploy"
git add -A
git commit -qm "deploy: gh-pages $(date +%Y-%m-%d)" || echo "  (no changes)"
git push -f "$GH_REPO" HEAD:gh-pages
rm -rf "$DIST/.git"
cd "$ROOT"

echo "Sync selesai. Production: https://nitrocat29.github.io/kasirgo/"
