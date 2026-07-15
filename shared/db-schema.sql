-- ============================================================
-- KasirGo — SQLite Schema
-- ============================================================
-- Source of truth untuk database schema. Dipakai backend (bun:sqlite)
-- dan desktop (Tauri + rusqlite / tauri-plugin-sql).

CREATE TABLE IF NOT EXISTS toko (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  alamat TEXT,
  telepon TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS produk (
  id TEXT PRIMARY KEY,
  toko_id TEXT NOT NULL,
  sku TEXT UNIQUE,
  nama TEXT NOT NULL,
  harga INTEGER NOT NULL,
  stok INTEGER NOT NULL DEFAULT 0,
  stock_threshold INTEGER NOT NULL DEFAULT 10,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (toko_id) REFERENCES toko(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transaksi (
  id TEXT PRIMARY KEY,
  toko_id TEXT NOT NULL,
  total INTEGER NOT NULL,
  tax_rate INTEGER NOT NULL DEFAULT 11,
  discount_rate INTEGER NOT NULL DEFAULT 0,
  items_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (toko_id) REFERENCES toko(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  nama TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'kasir',
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL,            -- 'signup_verify' | 'password_reset'
  code_hash TEXT NOT NULL,          -- Bun.password.hash(8-digit code)
  token TEXT NOT NULL UNIQUE,       -- untuk magic link
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
);

-- Migration: stock_threshold (idempotent — handled by app layer)
-- ALTER TABLE produk ADD COLUMN stock_threshold INTEGER NOT NULL DEFAULT 10;
-- Migration: sku (idempotent — handled by app layer)
-- ALTER TABLE produk ADD COLUMN sku TEXT UNIQUE;

-- ============================================================
-- Wallet / Billing / Balance
-- ============================================================
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  type TEXT NOT NULL,          -- 'topup' | 'purchase' | 'refund' | 'adjustment'
  amount INTEGER NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);
