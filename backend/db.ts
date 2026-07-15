import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================
// SQLite Database Setup
// ============================================================
const db = new Database("backend/db/kasirgo.sqlite");
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

// Migration: add email + verified columns to users (idempotent)
const userCols = db.query("PRAGMA table_info(users)").all() as any[];
if (!userCols.find((c) => c.name === "email")) {
  db.run("ALTER TABLE users ADD COLUMN email TEXT");
}
if (!userCols.find((c) => c.name === "verified")) {
  db.run("ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0");
}

// ============================================================
// Seed Mockup Data (jalankan sekali saat DB kosong)
// ============================================================
const tokoCount = db.query("SELECT COUNT(*) as c FROM toko").get() as {
  c: number;
};
if (tokoCount.c === 0) {
  const insToko = db.prepare(
    "INSERT INTO toko (id, nama, alamat, telepon) VALUES (?, ?, ?, ?)",
  );
  const insProduk = db.prepare(
    "INSERT INTO produk (id, toko_id, sku, nama, harga, stok) VALUES (?, ?, ?, ?, ?, ?)",
  );

  const t1 = randomUUID();
  const t2 = randomUUID();

  insToko.run(
    t1,
    "Toko Berkah Jaya",
    "Jl. Melati No. 12, Jakarta Pusat",
    "0812-3456-7890",
  );
  insToko.run(
    t2,
    "Warung Selera Nusantara",
    "Jl. Kenanga No. 45, Bandung",
    "0877-1122-3344",
  );

  const produkData: [string, string, string, number, number][] = [
    [randomUUID(), t1, "Kopi Susu Gula Aren", 18000, 50],
    [randomUUID(), t1, "Roti Bakar Coklat", 15000, 30],
    [randomUUID(), t1, "Air Mineral 600ml", 5000, 100],
    [randomUUID(), t1, "Snack Kentang", 12500, 40],
    [randomUUID(), t1, "Nasi Goreng Spesial", 25000, 20],
    [randomUUID(), t2, "Es Teh Manis", 5000, 200],
    [randomUUID(), t2, "Mie Goreng Telur", 14000, 35],
    [randomUUID(), t2, "Pisang Goreng (5pcs)", 10000, 25],
    [randomUUID(), t2, "Soto Ayam", 22000, 15],
    [randomUUID(), t2, "Jus Alpukat", 12000, 60],
  ];

  for (let i = 0; i < produkData.length; i++) {
    const p = produkData[i];
    const sku = `PRD-${randomUUID().slice(0, 8).toUpperCase()}`;
    insProduk.run(p[0], p[1], sku, p[2], p[3], p[4]);
  }
  console.log("✅ Seed data berhasil diinsert (2 toko, 10 produk)");
}

// ============================================================
// Seed Users (idempotent — check by username)
// ============================================================
// Login flow: client sends sha256(password) -> backend Bun.password.hash() it.
// Jadi seed memakai sha256 hex string sebagai input ke Bun.password.hash().

// Hapus admin demo lama (cascade hapus sessions via FK ON DELETE CASCADE)
db.run("DELETE FROM users WHERE username = 'admin'");

// Mark seed users verified=1 (backwards-compat: login tanpa email verification)
db.run("UPDATE users SET verified = 1 WHERE username IN ('Ebril', 'demo')");

// Admin real (privileged) — Ebril
// sha256("zmJW#j.6x507l}ST") = 6c32e5981dd32a7bb76586a5063db7cd69b15e8e1ea50b6c22a64244d07b52e9
const ebrilExists = db
  .query("SELECT id FROM users WHERE username = ?")
  .get("Ebril");
if (!ebrilExists) {
  const ebrilHash = await Bun.password.hash(
    "6c32e5981dd32a7bb76586a5063db7cd69b15e8e1ea50b6c22a64244d07b52e9",
  );
  db.run(
    "INSERT INTO users (id, username, password_hash, nama, role, verified) VALUES (?, ?, ?, ?, ?, 1)",
    [randomUUID(), "Ebril", ebrilHash, "Ebril", "admin"],
  );
  // console.log('✅ seed user: Ebril (admin)');
}

// Akun demo — fake-admin (read-only, akses view layaknya admin tapi tidak bisa write)
// sha256("demo123") = d3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791
const demoExists = db
  .query("SELECT id FROM users WHERE username = ?")
  .get("demo");
if (!demoExists) {
  const demoHash = await Bun.password.hash(
    "d3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791",
  );
  db.run(
    "INSERT INTO users (id, username, password_hash, nama, role, verified) VALUES (?, ?, ?, ?, ?, 1)",
    [randomUUID(), "demo", demoHash, "Demo Akun (Read-Only)", "fake-admin"],
  );
  console.log("✅ Seed user: demo / demo123 (fake-admin, read-only)");
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

// ============================================================
// Seed Transaksi harian (30 hari) — only if transaksi table empty
// ============================================================
const trxCountSeed = (db.query("SELECT COUNT(*) as c FROM transaksi").get() as any).c;
if (trxCountSeed === 0) {
  const allToko = db.query("SELECT id FROM toko").all() as { id: string }[];
  if (allToko.length > 0) {
    const baseToko = allToko[0].id;
    // Generate 2-6 transaksi per day over past 30 days
    for (let d = 29; d >= 0; d--) {
      const trxCount = 2 + Math.floor(Math.random() * 5);
      for (let t = 0; t < trxCount; t++) {
        const total = 15000 + Math.floor(Math.random() * 185000); // Rp 15rb — 200rb
        const hour = 8 + Math.floor(Math.random() * 12);
        const min = Math.floor(Math.random() * 60);
        const items = JSON.stringify([{ nama: "Produk Acak", harga: total, qty: 1 }]);
        db.run(
          `INSERT INTO transaksi (id, toko_id, total, tax_rate, discount_rate, items_json, created_at) VALUES (?, ?, ?, 11, 0, ?, datetime('now', '-' || ? || ' days', '+' || ? || ' hours', '+' || ? || ' minutes'))`,
          randomUUID(), baseToko, total, items, d, hour, min
        );
      }
    }
    console.log("✅ Seed transaksi 30 hari berhasil");
  }
}

export { db };
