#!/usr/bin/env bash
# KasirGo — Tauri wrapper (set Rust PATH lalu panggil tauri-cli)
# Pakai: bun run tauri:dev / bun run tauri:build
set -e
export PATH="$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")"
case "$1" in
  dev)  bun run tauri dev  "${@:2}" ;;
  build) bun run tauri build "${@:2}" ;;
  icon) bun run tauri icon "${@:2}" ;;
  *)    bun run tauri "$@" ;;
esac
