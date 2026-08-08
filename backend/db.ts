import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ============================================================
// SQLite Database Setup
// ============================================================
const dbPath = "backend/db/kasirgo.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

// ============================================================
// Schema — import from shared/db-schema.sql (source of truth)
// ============================================================
const schemaPath = join(import.meta.dir, "..", "shared", "db-schema.sql");
const schema = readFileSync(schemaPath, "utf-8").replace(/--.*$/gm, "");

const statements = schema
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .map((l) => l.replace(/--.*$/, "")) // strip inline comment (di akhir baris)
      .filter((l) => l.trim().length > 0) // buang baris kosong setelah strip
      .join(" ")
      .trim(),
  )
  .filter((s) => s.length > 0);
for (const stmt of statements) {
  db.run(stmt);
}

// Migration: add stock_threshold if missing
const cols = db.query("PRAGMA table_info(produk)").all() as any[];
if (!cols.find((c) => c.name === "stock_threshold")) {
  db.run(
    "ALTER TABLE produk ADD COLUMN stock_threshold INTEGER NOT NULL DEFAULT 10",
  );
}

// Migration: add harga_modal column if missing
if (!cols.find((c) => c.name === "harga_modal")) {
  db.run("ALTER TABLE produk ADD COLUMN harga_modal INTEGER NOT NULL DEFAULT 0");
}

// Migration: add merk, kategori, satuan columns if missing
if (!cols.find((c) => c.name === "merk")) {
  db.run("ALTER TABLE produk ADD COLUMN merk TEXT DEFAULT ''");
}
if (!cols.find((c) => c.name === "kategori")) {
  db.run("ALTER TABLE produk ADD COLUMN kategori TEXT DEFAULT ''");
}
if (!cols.find((c) => c.name === "satuan")) {
  db.run("ALTER TABLE produk ADD COLUMN satuan TEXT DEFAULT ''");
}

// Migration: add sku column if missing
if (!cols.find((c) => c.name === "sku")) {
  db.run("ALTER TABLE produk ADD COLUMN sku TEXT");
}

// Backfill sku for products that don't have one
const skulessProduk = db.query("SELECT id FROM produk WHERE sku IS NULL").all() as { id: string }[];
for (const p of skulessProduk) {
  const sku = `PRD-${randomUUID().slice(0, 8).toUpperCase()}`;
  db.run("UPDATE produk SET sku = ? WHERE id = ?", [sku, p.id]);
}
if (skulessProduk.length > 0) {
  console.log(`✅ Backfill SKU untuk ${skulessProduk.length} produk`);
}

// Add unique index on sku if not exists
db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_produk_sku ON produk(sku) WHERE sku IS NOT NULL");

// Index composite untuk search cepat per toko (live search produk)
db.run("CREATE INDEX IF NOT EXISTS idx_produk_nama_toko ON produk(toko_id, nama)");
db.run("CREATE INDEX IF NOT EXISTS idx_produk_sku_toko ON produk(toko_id, sku)");

// Migration: add email + verified columns to users (idempotent)
const userCols = db.query("PRAGMA table_info(users)").all() as any[];
if (!userCols.find((c) => c.name === "email")) {
  db.run("ALTER TABLE users ADD COLUMN email TEXT");
}
if (!userCols.find((c) => c.name === "verified")) {
  db.run("ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0");
}

// Migration: add TOTP columns to users (idempotent)
if (!userCols.find((c) => c.name === "totp_secret")) {
  db.run("ALTER TABLE users ADD COLUMN totp_secret TEXT");
}
if (!userCols.find((c) => c.name === "totp_enabled")) {
  db.run("ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0");
}

// ============================================================
// Migration: wallets per-user → per-toko (idempotent)
// ============================================================
const walletCols = db.query("PRAGMA table_info(wallets)").all() as any[];
const hasUserId = walletCols.find((c: any) => c.name === "user_id");
const hasTokoId = walletCols.find((c: any) => c.name === "toko_id");

if (hasUserId && !hasTokoId) {
  // Old schema: recreate wallets table with toko_id
  console.log("🔄 Migrating wallets: user_id → toko_id");
  db.run("DELETE FROM wallet_transactions");
  db.run("DELETE FROM wallets");
  db.run("ALTER TABLE wallets RENAME TO wallets_old");
  db.run(`CREATE TABLE wallets (
    id TEXT PRIMARY KEY,
    toko_id TEXT UNIQUE NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (toko_id) REFERENCES toko(id) ON DELETE CASCADE
  )`);
  db.run("DROP TABLE wallets_old");
}

// Ensure toko_id column exists (idempotent for edge cases)
if (!db.query("PRAGMA table_info(wallets)").all().find((c: any) => c.name === "toko_id")) {
  try { db.run("ALTER TABLE wallets ADD COLUMN toko_id TEXT"); } catch {}
}

// Seed wallet per toko (idempotent)
const allToko = db.query("SELECT id, nama FROM toko").all() as { id: string; nama: string }[];
for (const t of allToko) {
  const existing = db.query("SELECT id FROM wallets WHERE toko_id = ?").get(t.id);
  if (!existing) {
    const wid = randomUUID();
    db.run("INSERT INTO wallets (id, toko_id, balance) VALUES (?, ?, ?)", wid, t.id, 0);
    console.log(`✅ Wallet created for toko: ${t.nama} (${t.id})`);
  }
}

// ============================================================
// Migration: kertas_stock (global paper stock for fotocopy)
// ============================================================
db.run(`CREATE TABLE IF NOT EXISTS kertas_stock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  stock INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
)`);
// Seed single row if empty
const ksRow = db.query("SELECT stock FROM kertas_stock WHERE id = 1").get();
if (!ksRow) {
  db.run("INSERT INTO kertas_stock (id, stock) VALUES (1, 0)");
}

// ============================================================
// Migration: audit_logs — old_values, new_values, prev_hash, hash
// ============================================================
const auditCols = db.query("PRAGMA table_info(audit_logs)").all() as any[];
if (!auditCols.find((c: any) => c.name === "old_values")) {
  db.run("ALTER TABLE audit_logs ADD COLUMN old_values TEXT");
}
if (!auditCols.find((c: any) => c.name === "new_values")) {
  db.run("ALTER TABLE audit_logs ADD COLUMN new_values TEXT");
}
if (!auditCols.find((c: any) => c.name === "prev_hash")) {
  db.run("ALTER TABLE audit_logs ADD COLUMN prev_hash TEXT");
}
if (!auditCols.find((c: any) => c.name === "hash")) {
  db.run("ALTER TABLE audit_logs ADD COLUMN hash TEXT NOT NULL DEFAULT ''");
}
// Create audit indexes if not exist
db.run("CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at)");
db.run("CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)");
db.run("CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_logs(entity_type)");
db.run("CREATE INDEX IF NOT EXISTS idx_audit_hash ON audit_logs(hash)");

export { db };
