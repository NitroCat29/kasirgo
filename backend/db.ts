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

// ============================================================
// Seed Admin (hanya akun Ebril — DB mulai kosong, tanpa mockup toko/produk)
// ============================================================
// Login flow: client sends sha256(password) -> backend Bun.password.hash() it.
// Jadi seed memakai sha256 hex string sebagai input ke Bun.password.hash().
// Password plaintext "apaajaaada" -> sha256 di client, hash lagi di sini.
const ebrilExists = db
  .query("SELECT id FROM users WHERE username = ?")
  .get("Ebril");
if (!ebrilExists) {
  // sha256("apaajaaada")
  const shaHex = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("apaajaaada"),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const ebrilHash = await Bun.password.hash(shaHex);
  db.run(
    "INSERT INTO users (id, username, password_hash, nama, role, verified) VALUES (?, ?, ?, ?, ?, 1)",
    [randomUUID(), "Ebril", ebrilHash, "Ebril", "admin"],
  );
  console.log("✅ Seed admin: Ebril (admin)");
}

// ============================================================
// Seed Wallet for existing users (idempotent)
// ============================================================
const allUsers = db.query("SELECT id FROM users").all() as { id: string }[];
for (const u of allUsers) {
  const existing = db.query("SELECT id FROM wallets WHERE user_id = ?").get(u.id);
  if (!existing) {
    const wid = randomUUID();
    db.run("INSERT INTO wallets (id, user_id, balance) VALUES (?, ?, ?)", wid, u.id, 500_000);
    db.run(
      "INSERT INTO wallet_transactions (id, wallet_id, type, amount, description) VALUES (?, ?, 'topup', ?, ?)",
      randomUUID(), wid, 500_000, "Saldo awal (seed)"
    );
  }
}

export { db };
