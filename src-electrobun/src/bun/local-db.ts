// ============================================================
// KasirGo — Local SQLite (Electrobun main process)
// ============================================================
// Single-file persistent DB. Schema source of truth: shared/db-schema.sql.
// Reuse helpers dari backend (db.ts sudah pakai schema yang sama),
// tapi DB ini terpisah (lokal desktop) — bukan DB server.

import { Database } from "bun:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform } from "node:os";

const APP_DIR_NAME = "KasirGo";

function getAppDataDir(): string {
  // Override via env (untuk testing / portable mode)
  if (process.env.KASIRGO_DATA_DIR) {
    return process.env.KASIRGO_DATA_DIR;
  }
  const os = platform();
  if (os === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), APP_DIR_NAME);
  }
  if (os === "darwin") {
    return join(homedir(), "Library", "Application Support", APP_DIR_NAME);
  }
  // linux / others — XDG
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), APP_DIR_NAME);
}

export const APP_DATA_DIR = getAppDataDir();
export const DB_PATH = join(APP_DATA_DIR, "kasirgo-local.sqlite");

mkdirSync(dirname(DB_PATH), { recursive: true });

export const localDb = new Database(DB_PATH);
localDb.run("PRAGMA journal_mode = WAL");
localDb.run("PRAGMA foreign_keys = ON");

// ---- Schema bootstrap (idempotent: CREATE TABLE IF NOT EXISTS) ----
// Cari shared/db-schema.sql di beberapa lokasi agar jalan baik di
// dev (mono-repo) maupun di build packaged (Electrobun copy).
const CANDIDATE_SCHEMA_PATHS = [
  // Saat dev: path relatif ke CWD (= REPO_ROOT)
  join(process.cwd(), "shared", "db-schema.sql"),
  // Saat packaged: relatif ke executable
  join(import.meta.dir, "..", "..", "shared", "db-schema.sql"),
  join(import.meta.dir, "..", "..", "..", "shared", "db-schema.sql"),
];

function loadSchema(): string {
  let lastErr: unknown = null;
  for (const p of CANDIDATE_SCHEMA_PATHS) {
    try {
      return readFileSync(p, "utf-8");
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `db-schema.sql tidak ditemukan di: ${CANDIDATE_SCHEMA_PATHS.join(", ")}. Last error: ${String(lastErr)}`,
  );
}

function initSchema(): void {
  const raw = loadSchema();
  // Strip SQL comments (-- ...), pisah per statement
  const cleaned = raw
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
  const statements = cleaned
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Wrap in transaction — schema bootstrap harus atomic
  const init = localDb.transaction(() => {
    for (const stmt of statements) {
      localDb.run(stmt);
    }
  });
  init();
  console.log(`[local-db] schema applied (${statements.length} statements) → ${DB_PATH}`);
}

// ---- Migrations (idempotent, mirror backend/db.ts) ----
function runMigrations(): void {
  const cols = localDb.query("PRAGMA table_info(produk)").all() as { name: string }[];
  const have = new Set(cols.map((c) => c.name));

  if (!have.has("stock_threshold")) {
    localDb.run("ALTER TABLE produk ADD COLUMN stock_threshold INTEGER NOT NULL DEFAULT 10");
  }
  if (!have.has("harga_modal")) {
    localDb.run("ALTER TABLE produk ADD COLUMN harga_modal INTEGER NOT NULL DEFAULT 0");
  }
  if (!have.has("merk")) localDb.run("ALTER TABLE produk ADD COLUMN merk TEXT DEFAULT ''");
  if (!have.has("kategori")) localDb.run("ALTER TABLE produk ADD COLUMN kategori TEXT DEFAULT ''");
  if (!have.has("satuan")) localDb.run("ALTER TABLE produk ADD COLUMN satuan TEXT DEFAULT ''");
  if (!have.has("sku")) localDb.run("ALTER TABLE produk ADD COLUMN sku TEXT");

  // Indexes (IF NOT EXISTS — idempotent)
  localDb.run(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_produk_sku ON produk(sku) WHERE sku IS NOT NULL",
  );
  localDb.run("CREATE INDEX IF NOT EXISTS idx_produk_nama_toko ON produk(toko_id, nama)");
  localDb.run("CREATE INDEX IF NOT EXISTS idx_produk_sku_toko ON produk(toko_id, sku)");
  localDb.run("CREATE INDEX IF NOT EXISTS idx_transaksi_toko ON transaksi(toko_id, created_at)");
  localDb.run("CREATE INDEX IF NOT EXISTS idx_wallet_toko ON wallets(toko_id)");
}

// ---- Bootstrap ----
initSchema();
runMigrations();

console.log(`[local-db] ready at ${DB_PATH}`);
