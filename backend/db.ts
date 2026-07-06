import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

// ============================================================
// SQLite Database Setup
// ============================================================
const db = new Database("backend/db/kasirgo.sqlite");
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

// ============================================================
// Schema
// ============================================================
db.run(`
  CREATE TABLE IF NOT EXISTS toko (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    alamat TEXT,
    telepon TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS produk (
    id TEXT PRIMARY KEY,
    toko_id TEXT NOT NULL,
    nama TEXT NOT NULL,
    harga INTEGER NOT NULL,
    stok INTEGER NOT NULL DEFAULT 0,
    stock_threshold INTEGER NOT NULL DEFAULT 10,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (toko_id) REFERENCES toko(id) ON DELETE CASCADE
  )
`);

// Migration: add stock_threshold if missing
const cols = db.query("PRAGMA table_info(produk)").all() as any[];
if (!cols.find(c => c.name === "stock_threshold")) {
  db.run("ALTER TABLE produk ADD COLUMN stock_threshold INTEGER NOT NULL DEFAULT 10");
}

db.run(`
  CREATE TABLE IF NOT EXISTS transaksi (
    id TEXT PRIMARY KEY,
    toko_id TEXT NOT NULL,
    total INTEGER NOT NULL,
    tax_rate INTEGER NOT NULL DEFAULT 11,
    discount_rate INTEGER NOT NULL DEFAULT 0,
    items_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (toko_id) REFERENCES toko(id) ON DELETE CASCADE
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nama TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'kasir',
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    username TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);



// ============================================================
// Seed Mockup Data (jalankan sekali saat DB kosong)
// ============================================================
const tokoCount = db.query("SELECT COUNT(*) as c FROM toko").get() as { c: number };
if (tokoCount.c === 0) {
  const insToko = db.prepare("INSERT INTO toko (id, nama, alamat, telepon) VALUES (?, ?, ?, ?)");
  const insProduk = db.prepare("INSERT INTO produk (id, toko_id, nama, harga, stok) VALUES (?, ?, ?, ?, ?)");

  const t1 = randomUUID();
  const t2 = randomUUID();

  insToko.run(t1, "Toko Berkah Jaya", "Jl. Melati No. 12, Jakarta Pusat", "0812-3456-7890");
  insToko.run(t2, "Warung Selera Nusantara", "Jl. Kenanga No. 45, Bandung", "0877-1122-3344");

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

  for (const p of produkData) {
    insProduk.run(p[0], p[1], p[2], p[3], p[4]);
  }
  console.log("✅ Seed data berhasil diinsert (2 toko, 10 produk)");
}

// Seed admin user
const userCount = db.query("SELECT COUNT(*) as c FROM users").get() as { c: number };
if (userCount.c === 0) {
  const adminHash = await Bun.password.hash("240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9");
  db.run(
    "INSERT INTO users (id, username, password_hash, nama, role) VALUES (?, ?, ?, ?, ?)",
    [randomUUID(), "admin", adminHash, "Admin KasirGo", "admin"]
  );
  console.log('✅ Seed user: admin / admin123');
}

export { db };
