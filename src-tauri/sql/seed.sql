-- Seed default toko + admin lokal (password_hash placeholder — di-set via UI setup).
-- Gunakan INSERT OR IGNORE agar idempotent (re-run aman).
INSERT OR IGNORE INTO toko (id, nama, alamat, telepon) VALUES ('toko-default', 'Toko Saya', '', '');

-- Admin default lokal (password di-hash saat first-run setup via frontend).
-- password_hash kosong → frontend paksa set password saat first run.
INSERT OR IGNORE INTO users (id, username, email, password_hash, nama, role, verified)
  VALUES ('admin-local', 'admin', NULL, '', 'Admin Lokal', 'admin', 1);

INSERT OR IGNORE INTO wallets (id, user_id, balance) VALUES ('wallet-admin', 'admin-local', 0);
