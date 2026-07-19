// ============================================================
// KasirGo — Shared Validation
// ============================================================
// Validasi input yang dipakai backend routes + frontend + desktop.
// Return { ok: true, data } atau { ok: false, error: string }
//
// Struktur: field-validator generik (str/num/optional) dijalankan
// lewat `validate(body, schema)`. Bulk (array of item) tinggal
// bungkus validator single-item dengan `bulk(...)`.

// ---- Result types ----

export type ValidationOk<T> = { ok: true; data: T };
export type ValidationFail = { ok: false; error: string };
export type ValidationResult<T> = ValidationOk<T> | ValidationFail;

const ok = <T>(data: T): ValidationOk<T> => ({ ok: true, data });
const fail = (error: string): ValidationFail => ({ ok: false, error });

// ---- Field-level validators ----

type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };
type FieldValidator<T> = (value: unknown, label: string) => FieldResult<T>;

function str(opts: {
  min?: number;
  max?: number;
  upper?: boolean;
  trim?: boolean;
  allowEmpty?: boolean;
  requiredMsg?: string;
  pattern?: RegExp;
  patternMsg?: string;
} = {}): FieldValidator<string> {
  const trim = opts.trim !== false;
  return (value, label) => {
    if (value === undefined) return { ok: false, error: opts.requiredMsg ?? `${label} wajib diisi` };
    if (typeof value !== "string") return { ok: false, error: `${label} harus teks` };
    let v = trim ? value.trim() : value;
    if (!opts.allowEmpty && v.length === 0) return { ok: false, error: opts.requiredMsg ?? `${label} wajib diisi` };
    if (opts.min !== undefined && v.length < opts.min) return { ok: false, error: `${label} minimal ${opts.min} karakter` };
    if (opts.max !== undefined && v.length > opts.max) return { ok: false, error: `${label} maksimal ${opts.max} karakter` };
    if (opts.pattern && !opts.pattern.test(v)) return { ok: false, error: opts.patternMsg ?? `${label} format tidak valid` };
    if (opts.upper) v = v.toUpperCase();
    return { ok: true, value: v };
  };
}

function num(opts: { min?: number; max?: number } = {}): FieldValidator<number> {
  const range =
    opts.min !== undefined && opts.max !== undefined ? `${opts.min}-${opts.max}`
    : opts.min !== undefined ? `>= ${opts.min}`
    : opts.max !== undefined ? `<= ${opts.max}`
    : "";
  return (value, label) => {
    const bad =
      typeof value !== "number" ||
      Number.isNaN(value) ||
      (opts.min !== undefined && value < opts.min) ||
      (opts.max !== undefined && value > opts.max);
    if (bad) return { ok: false, error: `${label} harus angka${range ? " " + range : ""}` };
    return { ok: true, value };
  };
}

function optional<T>(validator: FieldValidator<T>): FieldValidator<T | undefined> {
  return (value, label) => (value === undefined ? { ok: true, value: undefined } : validator(value, label));
}

// ---- Schema runner ----
// schema: { fieldKey: [label, validator] } -> ValidationResult<{ fieldKey: T }>

type Schema<T> = { [K in keyof T]: [string, FieldValidator<T[K]>] };

function validate<T>(body: Record<string, unknown>, schema: Schema<T>): ValidationResult<T> {
  const out = {} as T;
  for (const key in schema) {
    const [label, validator] = schema[key];
    const res = validator(body?.[key], label);
    if (!res.ok) return fail(res.error);
    (out as Record<string, unknown>)[key] = res.value;
  }
  return ok(out);
}

// ---- Bulk combinator ----
// Ubah validator single-item jadi validator array, dengan pesan error per index.
// Contoh: export const validateProdukBulkCreate = bulk(validateProdukCreate);

function bulk<T>(validateOne: (body: Record<string, unknown>) => ValidationResult<T>) {
  return (body: unknown): ValidationResult<T[]> => {
    if (!Array.isArray(body)) return fail("Body harus berupa array");
    if (body.length === 0) return fail("Array tidak boleh kosong");
    const out: T[] = [];
    for (let i = 0; i < body.length; i++) {
      const item = body[i];
      if (!item || typeof item !== "object") return fail(`Item ke-${i + 1} harus berupa object`);
      const res = validateOne(item as Record<string, unknown>);
      if (!res.ok) return fail(`Item ke-${i + 1}: ${res.error}`);
      out.push(res.data);
    }
    return ok(out);
  };
}

// ---- Email ----
// Provider whitelist: Gmail, Outlook/Live/Hotmail, Proton.
// Block alias: local part tidak boleh mengandung '+' atau '.'.

const EMAIL_PROVIDERS = ["gmail.com", "outlook.com", "live.com", "hotmail.com", "proton.me", "protonmail.com"];

const emailField: FieldValidator<string> = (value, label) => {
  if (typeof value !== "string" || value.trim().length === 0) return { ok: false, error: `${label} wajib diisi` };
  const e = value.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1 || at === e.length - 1) return { ok: false, error: "Format email tidak valid" };
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (local.includes("+")) return { ok: false, error: "Email tidak boleh mengandung karakter '+' pada local part (anti-alias)" };
  if (local.includes(".")) return { ok: false, error: "Email tidak boleh mengandung karakter '.' pada local part (anti-alias)" };
  if (!/^[a-z0-9_-]{3,64}$/.test(local)) return { ok: false, error: "Local part email hanya boleh huruf, angka, underscore, atau hyphen (3-64 karakter)" };
  if (!EMAIL_PROVIDERS.includes(domain)) return { ok: false, error: "Email harus dari provider yang didukung: Gmail, Outlook, atau Proton" };
  return { ok: true, value: e };
};

export function validateEmail(email: unknown): ValidationResult<string> {
  const res = emailField(email, "Email");
  return res.ok ? ok(res.value) : fail(res.error);
}

export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

// ---- Auth ----

export function validateSignup(body: Record<string, unknown>) {
  return validate(body, {
    username: ["Username", str({ min: 3, max: 20 })],
    email: ["Email", emailField],
    password: ["Password", str({ min: 6, trim: false })],
    nama: ["Nama", str()],
    role: ["role", optional(str({ allowEmpty: true }))],
  });
}

export function validateLogin(body: Record<string, unknown>) {
  return validate(body, {
    identifier: ["Identifier", str({ trim: true })],
    password: ["Password", str({ trim: false, allowEmpty: false })],
  });
}

// ---- Toko ----

export function validateTokoCreate(body: Record<string, unknown>) {
  return validate(body, {
    nama: ["Nama toko", str()],
    alamat: ["Alamat", optional(str({ allowEmpty: true }))],
    telepon: ["Telepon", optional(str({ allowEmpty: true }))],
  });
}

export function validateTokoUpdate(body: Record<string, unknown>) {
  return validate(body, {
    nama: ["Nama toko", optional(str({ requiredMsg: "Nama toko tidak boleh kosong" }))],
    alamat: ["Alamat", optional(str({ allowEmpty: true }))],
    telepon: ["Telepon", optional(str({ allowEmpty: true }))],
  });
}

// ---- Produk ----

export function validateProdukCreate(body: Record<string, unknown>) {
  const res = validate(body, {
    nama: ["Nama produk", str()],
    toko_id: ["toko_id", optional(str({ allowEmpty: true }))],
    sku: ["SKU", optional(str({ upper: true }))],
    harga: ["Harga", optional(num({ min: 0 }))],
    harga_modal: ["Harga modal", optional(num({ min: 0 }))],
    stok: ["Stok", optional(num({ min: 0 }))],
    stock_threshold: ["stock_threshold", optional(num({ min: 0 }))],
    merk: ["Merk", optional(str({ allowEmpty: true }))],
    kategori: ["Kategori", optional(str({ allowEmpty: true }))],
    satuan: ["Satuan", optional(str({ allowEmpty: true }))],
  });
  if (!res.ok) return res;
  // toko_id selalu string (default "") sesuai kontrak lama, walau tidak dikirim
  return ok({ ...res.data, toko_id: res.data.toko_id ?? "" });
}

export function validateProdukUpdate(body: Record<string, unknown>) {
  return validate(body, {
    nama: ["Nama produk", optional(str({ requiredMsg: "Nama produk tidak boleh kosong" }))],
    sku: ["SKU", optional(str({ upper: true, requiredMsg: "SKU tidak boleh kosong" }))],
    harga: ["Harga", optional(num({ min: 0 }))],
    harga_modal: ["Harga modal", optional(num({ min: 0 }))],
    stok: ["Stok", optional(num({ min: 0 }))],
    stock_threshold: ["stock_threshold", optional(num({ min: 0 }))],
    merk: ["Merk", optional(str({ allowEmpty: true }))],
    kategori: ["Kategori", optional(str({ allowEmpty: true }))],
    satuan: ["Satuan", optional(str({ allowEmpty: true }))],
  });
}

// Bulk — reuse validator single-item yang sama persis.
export const validateProdukBulkCreate = bulk(validateProdukCreate);
export const validateProdukBulkUpdate = bulk(validateProdukUpdate);

// ---- Transaksi ----

const validateTransaksiItem = (body: Record<string, unknown>) =>
  validate(body, {
    nama: ["Item nama", str()],
    harga: ["Item harga", num({ min: 0 })],
    qty: ["Item qty", num({ min: 1 })],
    diskon: ["Item diskon", optional(num({ min: 0, max: 100 }))],
  });

const itemsField: FieldValidator<Array<{ nama: string; harga: number; qty: number; diskon?: number }>> = (value, label) => {
  if (!Array.isArray(value)) return { ok: false, error: `${label} wajib berupa array` };
  const items: Array<{ nama: string; harga: number; qty: number; diskon?: number }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return { ok: false, error: "Setiap item harus berupa object" };
    const res = validateTransaksiItem(item as Record<string, unknown>);
    if (!res.ok) return { ok: false, error: res.error };
    items.push(res.data);
  }
  return { ok: true, value: items };
};

const rawArrayField: FieldValidator<unknown[]> = (value, label) =>
  Array.isArray(value) ? { ok: true, value } : { ok: false, error: `${label} harus berupa array` };

export function validateTransaksiCreate(body: Record<string, unknown>) {
  return validate(body, {
    toko_id: ["toko_id", str()],
    total: ["total", num({ min: 0 })],
    tax_rate: ["tax_rate", optional(num())],
    discount_rate: ["discount_rate", optional(num())],
    items: ["items", itemsField],
  });
}

export function validateTransaksiUpdate(body: Record<string, unknown>) {
  return validate(body, {
    total: ["total", optional(num({ min: 0 }))],
    tax_rate: ["tax_rate", optional(num())],
    discount_rate: ["discount_rate", optional(num())],
    items: ["items", optional(rawArrayField)],
  });
}

// Bulk transaksi disediakan juga karena polanya sama — tinggal dipakai kalau perlu.
export const validateTransaksiBulkCreate = bulk(validateTransaksiCreate);
