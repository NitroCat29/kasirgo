// ============================================================
// KasirGo — Shared Types
// ============================================================
// Source of truth untuk semua interface. Dipakai backend, frontend, desktop.

// ---- Entity types (mirror SQLite schema) ----

export interface Toko {
  id: string;
  nama: string;
  alamat: string | null;
  telepon: string | null;
  created_at: string;
}

export interface Produk {
  id: string;
  toko_id: string;
  sku: string;
  nama: string;
  merk: string;
  kategori: string;
  satuan: string;
  harga: number;
  stok: number;
  stock_threshold: number;
  created_at: string;
}

export interface TransaksiItem {
  id?: number;
  name: string;
  price: number;
  qty: number;
  diskon: number; // 0-100 (persen)
}

export interface Transaksi {
  id: string;
  toko_id: string;
  total: number;
  tax_rate: number;
  discount_rate: number;
  items_json: string; // JSON.stringify(TransaksiItem[])
  created_at: string;
}

export type UserRole = "admin" | "manajer" | "kasir";

export interface User {
  id: string;
  username: string;
  nama: string;
  role: UserRole;
  created_at?: string;
}

export interface Session {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string; // "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT"
  entity_type: string; // "toko" | "produk" | "transaksi" | "user" | "auth"
  entity_id: string | null;
  details: string | null; // JSON string
  ip_address: string | null;
  created_at: string;
}

// ---- API response types ----

export interface StatsResponse {
  toko: number;
  produk: number;
  transaksi: number;
  total_pendapatan: number;
  transaksi_hari_ini: number;
  pendapatan_hari_ini: number;
}

export interface LoginResponse {
  id: string;
  username: string;
  nama: string;
  role: UserRole;
  csrf_token: string;
}

// ---- Wasm bridge types ----

export interface WasmExports {
  init_memory: () => void;
  calculate_total: (subtotal: number, taxRate: number, discountRate: number) => number;
  compute_benchmark: (iterations: number) => number;
  batch_check_low_stock: (...args: number[]) => number;
  memory: WebAssembly.Memory;
  get_input_ptr: () => number;
  get_input_size: () => number;
  load_products: (ptr: number, len: number) => number;
  [key: string]: unknown;
}
