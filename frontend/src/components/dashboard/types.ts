export interface Stats {
  toko: number;
  produk: number;
  transaksi: number;
  total_pendapatan: number;
  transaksi_hari_ini: number;
  pendapatan_hari_ini: number;
}

export interface Toko {
  id: string;
  nama: string;
  alamat?: string;
  telepon?: string;
}

export interface Produk {
  id: string;
  sku: string;
  nama: string;
  merk?: string;
  kategori?: string;
  satuan?: string;
  harga: number;
  harga_modal?: number;
  stok: number;
  toko_id: string;
  stock_threshold?: number;
  toko_nama?: string;
}

export interface Transaksi {
  id: string;
  toko_id: string;
  total: number;
  items_json: string;
  created_at: string;
}

export interface UserRow {
  id: string;
  username: string;
  nama: string;
  role: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface LowStockItem {
  id: string;
  nama: string;
  harga: number;
  stok: number;
  stock_threshold: number;
  toko_id: string;
  toko_nama: string;
}

export interface TrxItem {
  nama: string;
  harga: number;
  qty: number;
}

export interface DailyRevenue {
  day: string;
  revenue: number;
  count: number;
}

export type DashboardTab = "overview" | "toko" | "produk" | "transaksi" | "users" | "audit";

export const ROLE_LEVEL: Record<string, number> = {
  kasir: 1,
  manajer: 2,
  admin: 3,
};

export function hasMinRole(
  role: string | null | undefined,
  min: "manajer" | "admin",
): boolean {
  return (ROLE_LEVEL[role ?? ""] || 0) >= ROLE_LEVEL[min];
}

export function canEdit(role: string | null | undefined): boolean {
  return hasMinRole(role, "manajer");
}

export function canManageUsers(role: string | null | undefined): boolean {
  return hasMinRole(role, "admin");
}

export function canViewAudit(role: string | null | undefined): boolean {
  return hasMinRole(role, "admin");
}

export { formatRupiah } from "../../lib/format";
