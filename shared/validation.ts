// ============================================================
// KasirGo — Shared Validation
// ============================================================
// Validasi input yang dipakai backend routes + frontend + desktop.
// Return { ok: true, data } atau { ok: false, error: string }

// ---- Validation result types ----

export type ValidationOk<T> = { ok: true; data: T };
export type ValidationFail = { ok: false; error: string };
export type ValidationResult<T> = ValidationOk<T> | ValidationFail;

// ---- Helpers ----

function fail(error: string): ValidationFail {
  return { ok: false, error };
}

function ok<T>(data: T): ValidationOk<T> {
  return { ok: true, data };
}

// ---- Email validation ----
// Provider whitelist: Gmail, Outlook/Live/Hotmail, Proton.
// Block alias: local part tidak boleh mengandung '+' atau '.'.
const EMAIL_PROVIDERS = [
  "gmail.com",
  "outlook.com",
  "live.com",
  "hotmail.com",
  "proton.me",
  "protonmail.com",
];

export function validateEmail(email: unknown): ValidationResult<string> {
  if (typeof email !== "string" || email.trim().length === 0) return fail("Email wajib diisi");
  const e = email.trim().toLowerCase();
  // Format check sederhana: local@domain
  const at = e.lastIndexOf("@");
  if (at < 1 || at === e.length - 1) return fail("Format email tidak valid");
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  // Validasi local part: no '+' atau '.' (anti-alias)
  if (local.includes("+")) return fail("Email tidak boleh mengandung karakter '+' pada local part (anti-alias)");
  if (local.includes(".")) return fail("Email tidak boleh mengandung karakter '.' pada local part (anti-alias)");
  // Validasi local part: hanya alphanumeric + underscore + hyphen, length 3-64
  if (!/^[a-z0-9_-]{3,64}$/.test(local)) return fail("Local part email hanya boleh huruf, angka, underscore, atau hyphen (3-64 karakter)");
  // Provider whitelist
  if (!EMAIL_PROVIDERS.includes(domain)) return fail(`Email harus dari provider yang didukung: Gmail, Outlook, atau Proton`);
  return ok(e);
}

export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

// ---- Auth validation ----

export function validateSignup(body: Record<string, unknown>): ValidationResult<{ username: string; email: string; password: string; nama: string; role?: string }> {
  if (!body.username || !body.password || !body.nama || !body.email) return fail("username, email, password, nama wajib diisi");
  if (typeof body.username !== "string" || (body.username as string).trim().length < 3) return fail("Username minimal 3 karakter");
  if (typeof body.username !== "string" || (body.username as string).trim().length > 20) return fail("Username maksimal 20 karakter");
  const ev = validateEmail(body.email);
  if (!ev.ok) return fail(ev.error);
  if (typeof body.password !== "string" || (body.password as string).length < 6) return fail("Password minimal 6 karakter");
  if (typeof body.nama !== "string" || (body.nama as string).trim().length === 0) return fail("Nama wajib diisi");
  return ok({ username: (body.username as string).trim(), email: ev.data, password: body.password as string, nama: (body.nama as string).trim(), role: body.role as string | undefined });
}

export function validateLogin(body: Record<string, unknown>): ValidationResult<{ identifier: string; password: string }> {
  if (!body.identifier || !body.password) return fail("identifier dan password wajib diisi");
  if (typeof body.identifier !== "string" || (body.identifier as string).trim().length === 0) return fail("Identifier wajib diisi");
  if (typeof body.password !== "string" || (body.password as string).length === 0) return fail("Password wajib diisi");
  return ok({ identifier: (body.identifier as string).trim(), password: body.password as string });
}

// ---- Toko validation ----

export function validateTokoCreate(body: Record<string, unknown>): ValidationResult<{ nama: string; alamat?: string; telepon?: string }> {
  if (!body.nama || typeof body.nama !== "string" || (body.nama as string).trim().length === 0) return fail("Nama toko wajib diisi");
  return ok({ nama: (body.nama as string).trim(), alamat: body.alamat as string | undefined, telepon: body.telepon as string | undefined });
}

export function validateTokoUpdate(body: Record<string, unknown>): ValidationResult<{ nama?: string; alamat?: string; telepon?: string }> {
  if (body.nama !== undefined && (typeof body.nama !== "string" || (body.nama as string).trim().length === 0)) return fail("Nama toko tidak boleh kosong");
  return ok({ nama: body.nama !== undefined ? (body.nama as string).trim() : undefined, alamat: body.alamat as string | undefined, telepon: body.telepon as string | undefined });
}

// ---- Produk validation ----

export function validateProdukCreate(body: Record<string, unknown>): ValidationResult<{ nama: string; toko_id?: string; sku?: string; harga?: number; harga_modal?: number; stok?: number; stock_threshold?: number; merk?: string; kategori?: string; satuan?: string }> {
  if (!body.nama || typeof body.nama !== "string" || (body.nama as string).trim().length === 0) return fail("Nama produk wajib diisi");
  if (body.toko_id !== undefined && typeof body.toko_id !== "string") return fail("toko_id harus teks");
  if (body.sku !== undefined && (typeof body.sku !== "string" || (body.sku as string).trim().length === 0)) return fail("SKU tidak boleh kosong");
  if (body.harga !== undefined && (typeof body.harga !== "number" || body.harga < 0)) return fail("Harga harus angka >= 0");
  if (body.harga_modal !== undefined && (typeof body.harga_modal !== "number" || body.harga_modal < 0)) return fail("Harga modal harus angka >= 0");
  if (body.stok !== undefined && (typeof body.stok !== "number" || body.stok < 0)) return fail("Stok harus angka >= 0");
  if (body.stock_threshold !== undefined && (typeof body.stock_threshold !== "number" || body.stock_threshold < 0)) return fail("stock_threshold harus angka >= 0");
  if (body.merk !== undefined && typeof body.merk !== "string") return fail("Merk harus teks");
  if (body.kategori !== undefined && typeof body.kategori !== "string") return fail("Kategori harus teks");
  if (body.satuan !== undefined && typeof body.satuan !== "string") return fail("Satuan harus teks");
  return ok({ nama: (body.nama as string).trim(), toko_id: body.toko_id !== undefined ? (body.toko_id as string).trim() || "" : "", sku: body.sku !== undefined ? (body.sku as string).trim().toUpperCase() : undefined, harga: body.harga as number | undefined, harga_modal: body.harga_modal as number | undefined, stok: body.stok as number | undefined, stock_threshold: body.stock_threshold as number | undefined, merk: body.merk !== undefined ? (body.merk as string).trim() : undefined, kategori: body.kategori !== undefined ? (body.kategori as string).trim() : undefined, satuan: body.satuan !== undefined ? (body.satuan as string).trim() : undefined });
}

export function validateProdukUpdate(body: Record<string, unknown>): ValidationResult<{ nama?: string; sku?: string; harga?: number; harga_modal?: number; stok?: number; stock_threshold?: number; merk?: string; kategori?: string; satuan?: string }> {
  if (body.nama !== undefined && (typeof body.nama !== "string" || (body.nama as string).trim().length === 0)) return fail("Nama produk tidak boleh kosong");
  if (body.sku !== undefined && (typeof body.sku !== "string" || (body.sku as string).trim().length === 0)) return fail("SKU tidak boleh kosong");
  if (body.harga !== undefined && (typeof body.harga !== "number" || body.harga < 0)) return fail("Harga harus angka >= 0");
  if (body.harga_modal !== undefined && (typeof body.harga_modal !== "number" || body.harga_modal < 0)) return fail("Harga modal harus angka >= 0");
  if (body.stok !== undefined && (typeof body.stok !== "number" || body.stok < 0)) return fail("Stok harus angka >= 0");
  if (body.stock_threshold !== undefined && (typeof body.stock_threshold !== "number" || body.stock_threshold < 0)) return fail("stock_threshold harus angka >= 0");
  if (body.merk !== undefined && typeof body.merk !== "string") return fail("Merk harus teks");
  if (body.kategori !== undefined && typeof body.kategori !== "string") return fail("Kategori harus teks");
  if (body.satuan !== undefined && typeof body.satuan !== "string") return fail("Satuan harus teks");
  return ok({ nama: body.nama !== undefined ? (body.nama as string).trim() : undefined, sku: body.sku !== undefined ? (body.sku as string).trim().toUpperCase() : undefined, harga: body.harga as number | undefined, harga_modal: body.harga_modal as number | undefined, stok: body.stok as number | undefined, stock_threshold: body.stock_threshold as number | undefined, merk: body.merk !== undefined ? (body.merk as string).trim() : undefined, kategori: body.kategori !== undefined ? (body.kategori as string).trim() : undefined, satuan: body.satuan !== undefined ? (body.satuan as string).trim() : undefined });
}

// ---- Transaksi validation ----

export function validateTransaksiCreate(body: Record<string, unknown>): ValidationResult<{ toko_id: string; total: number; tax_rate?: number; discount_rate?: number; items: Array<{ nama: string; harga: number; qty: number; diskon?: number }> }> {
  if (!body.toko_id || typeof body.toko_id !== "string") return fail("toko_id wajib diisi");
  if (body.total === undefined || typeof body.total !== "number" || body.total < 0) return fail("total wajib diisi (angka >= 0)");
  if (!body.items || !Array.isArray(body.items)) return fail("items wajib berupa array");
  // Validasi struktur per-item
  const items: Array<{ nama: string; harga: number; qty: number; diskon?: number }> = [];
  for (const item of body.items as unknown[]) {
    if (!item || typeof item !== "object") return fail("Setiap item harus berupa object");
    const i = item as Record<string, unknown>;
    if (!i.nama || typeof i.nama !== "string") return fail("Item nama wajib diisi");
    if (i.harga === undefined || typeof i.harga !== "number" || i.harga < 0) return fail("Item harga harus angka >= 0");
    if (i.qty === undefined || typeof i.qty !== "number" || i.qty < 1) return fail("Item qty harus angka >= 1");
    if (i.diskon !== undefined && (typeof i.diskon !== "number" || i.diskon < 0 || i.diskon > 100)) return fail("Item diskon harus 0-100");
    items.push({ nama: i.nama as string, harga: i.harga as number, qty: i.qty as number, diskon: i.diskon as number | undefined });
  }
  return ok({ toko_id: body.toko_id as string, total: body.total as number, tax_rate: body.tax_rate as number | undefined, discount_rate: body.discount_rate as number | undefined, items });
}

export function validateTransaksiUpdate(body: Record<string, unknown>): ValidationResult<{ total?: number; tax_rate?: number; discount_rate?: number; items?: unknown[] }> {
  if (body.total !== undefined && (typeof body.total !== "number" || body.total < 0)) return fail("total harus angka >= 0");
  if (body.items !== undefined && !Array.isArray(body.items)) return fail("items harus berupa array");
  return ok({ total: body.total as number | undefined, tax_rate: body.tax_rate as number | undefined, discount_rate: body.discount_rate as number | undefined, items: body.items as unknown[] | undefined });
}
