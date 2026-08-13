// ============================================================
// KasirGo — Local RPC Handlers (Electrobun main process)
// ============================================================
// Each handler calls localDb (bun:sqlite) and returns typed values.
// Side-effect: wallet credit/deduct di-wrap dalam transaction biar atomic.

import { randomUUID } from "node:crypto";
import { localDb } from "./local-db";
import { rpcSchema, type Produk, type Toko, type TransaksiItem, type TransaksiRecord } from "../../../shared/desktop-rpc";

// ============================================================
// Row mappers (snake_case → camelCase + shape yang dipakai frontend)
// ============================================================
function mapToko(r: Record<string, unknown>): Toko {
  return {
    id: r.id as string,
    nama: r.nama as string,
    alamat: (r.alamat as string | null) ?? null,
    telepon: (r.telepon as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

function mapProduk(r: Record<string, unknown>): Produk {
  return {
    id: r.id as string,
    toko_id: r.toko_id as string,
    sku: (r.sku as string | null) ?? "",
    nama: r.nama as string,
    merk: (r.merk as string | null) ?? "",
    kategori: (r.kategori as string | null) ?? "",
    satuan: (r.satuan as string | null) ?? "",
    harga: Number(r.harga),
    harga_modal: Number(r.harga_modal ?? 0),
    stok: Number(r.stok),
    stock_threshold: Number(r.stock_threshold ?? 10),
    created_at: r.created_at as string,
  };
}

function mapTransaksi(r: Record<string, unknown>): TransaksiRecord {
  let items: TransaksiItem[] = [];
  try {
    items = JSON.parse(r.items_json as string) as TransaksiItem[];
  } catch {
    items = [];
  }
  return {
    id: r.id as string,
    toko_id: r.toko_id as string,
    total: Number(r.total),
    tax_rate: Number(r.tax_rate ?? 11),
    discount_rate: Number(r.discount_rate ?? 0),
    items,
    created_at: r.created_at as string,
  };
}

// ============================================================
// Wallet helpers
// ============================================================
function getOrCreateWallet(toko_id: string): string {
  const row = localDb
    .query("SELECT id FROM wallets WHERE toko_id = ?")
    .get(toko_id) as { id: string } | undefined;
  if (row) return row.id;
  const id = randomUUID();
  localDb.run(
    "INSERT INTO wallets (id, toko_id, balance, created_at, updated_at) VALUES (?, ?, 0, datetime('now'), datetime('now'))",
    [id, toko_id],
  );
  return id;
}

// ============================================================
// Handlers
// ============================================================
// ---------- Toko ----------
const tokoHandlers = {
  async list(): Promise<Toko[]> {
    const rows = localDb.query("SELECT * FROM toko ORDER BY created_at DESC").all() as Record<string, unknown>[];
    return rows.map(mapToko);
  },
  async get({ id }: { id: string }): Promise<Toko | undefined> {
    const r = localDb.query("SELECT * FROM toko WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return r ? mapToko(r) : undefined;
  },
  async insert(input: { nama: string; alamat?: string | null; telepon?: string | null }): Promise<Toko> {
    const id = randomUUID();
    localDb.run(
      "INSERT INTO toko (id, nama, alamat, telepon, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
      [id, input.nama, input.alamat ?? null, input.telepon ?? null],
    );
    const r = localDb.query("SELECT * FROM toko WHERE id = ?").get(id) as Record<string, unknown>;
    return mapToko(r);
  },
  async update(input: { id: string; nama?: string; alamat?: string | null; telepon?: string | null }): Promise<Toko | undefined> {
    const cur = localDb.query("SELECT * FROM toko WHERE id = ?").get(input.id) as Record<string, unknown> | undefined;
    if (!cur) return undefined;
    const next = {
      nama: (input.nama ?? cur.nama) as string,
      alamat: (input.alamat ?? cur.alamat) as string | null,
      telepon: (input.telepon ?? cur.telepon) as string | null,
    };
    localDb.run(
      "UPDATE toko SET nama = ?, alamat = ?, telepon = ? WHERE id = ?",
      [next.nama, next.alamat, next.telepon, input.id],
    );
    const r = localDb.query("SELECT * FROM toko WHERE id = ?").get(input.id) as Record<string, unknown>;
    return mapToko(r);
  },
  async delete({ id }: { id: string }): Promise<{ ok: true }> {
    localDb.run("DELETE FROM toko WHERE id = ?", [id]);
    return { ok: true };
  },
};

// ---------- Produk ----------
const produkHandlers = {
  async list({ toko_id }: { toko_id?: string } = {}): Promise<Produk[]> {
    const rows = toko_id
      ? (localDb.query("SELECT * FROM produk WHERE toko_id = ? ORDER BY nama").all(toko_id) as Record<string, unknown>[])
      : (localDb.query("SELECT * FROM produk ORDER BY nama").all() as Record<string, unknown>[]);
    return rows.map(mapProduk);
  },
  async get({ id }: { id: string }): Promise<Produk | undefined> {
    const r = localDb.query("SELECT * FROM produk WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return r ? mapProduk(r) : undefined;
  },
  async insert(input: {
    toko_id: string;
    sku?: string;
    nama: string;
    merk?: string;
    kategori?: string;
    satuan?: string;
    harga: number;
    harga_modal?: number;
    stok?: number;
    stock_threshold?: number;
    id?: string;
  }): Promise<Produk> {
    const id = input.id ?? randomUUID();
    const sku = input.sku && input.sku.length > 0 ? input.sku : `PRD-${randomUUID().slice(0, 8).toUpperCase()}`;
    localDb.run(
      `INSERT INTO produk
        (id, toko_id, sku, nama, merk, kategori, satuan, harga, harga_modal, stok, stock_threshold, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        input.toko_id,
        sku,
        input.nama,
        input.merk ?? "",
        input.kategori ?? "",
        input.satuan ?? "",
        input.harga,
        input.harga_modal ?? 0,
        input.stok ?? 0,
        input.stock_threshold ?? 10,
      ],
    );
    const r = localDb.query("SELECT * FROM produk WHERE id = ?").get(id) as Record<string, unknown>;
    return mapProduk(r);
  },
  async update(input: {
    id: string;
    nama?: string;
    sku?: string;
    merk?: string;
    kategori?: string;
    satuan?: string;
    harga?: number;
    harga_modal?: number;
    stok?: number;
    stock_threshold?: number;
  }): Promise<Produk | undefined> {
    const cur = localDb.query("SELECT * FROM produk WHERE id = ?").get(input.id) as Record<string, unknown> | undefined;
    if (!cur) return undefined;
    const next = {
      nama: (input.nama ?? cur.nama) as string,
      sku: (input.sku ?? cur.sku) as string | null,
      merk: (input.merk ?? cur.merk) as string,
      kategori: (input.kategori ?? cur.kategori) as string,
      satuan: (input.satuan ?? cur.satuan) as string,
      harga: (input.harga ?? Number(cur.harga)) as number,
      harga_modal: (input.harga_modal ?? Number(cur.harga_modal)) as number,
      stok: (input.stok ?? Number(cur.stok)) as number,
      stock_threshold: (input.stock_threshold ?? Number(cur.stock_threshold)) as number,
    };
    localDb.run(
      `UPDATE produk
        SET nama = ?, sku = ?, merk = ?, kategori = ?, satuan = ?,
            harga = ?, harga_modal = ?, stok = ?, stock_threshold = ?
        WHERE id = ?`,
      [
        next.nama,
        next.sku,
        next.merk,
        next.kategori,
        next.satuan,
        next.harga,
        next.harga_modal,
        next.stok,
        next.stock_threshold,
        input.id,
      ],
    );
    const r = localDb.query("SELECT * FROM produk WHERE id = ?").get(input.id) as Record<string, unknown>;
    return mapProduk(r);
  },
  async delete({ id }: { id: string }): Promise<{ ok: true }> {
    localDb.run("DELETE FROM produk WHERE id = ?", [id]);
    return { ok: true };
  },
  async restock({ id, delta }: { id: string; delta: number }): Promise<Produk | undefined> {
    localDb.run("UPDATE produk SET stok = stok + ? WHERE id = ?", [delta, id]);
    const r = localDb.query("SELECT * FROM produk WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return r ? mapProduk(r) : undefined;
  },
};

// ---------- Transaksi ----------
const transaksiHandlers = {
  async list({ toko_id, limit }: { toko_id?: string; limit?: number } = {}): Promise<TransaksiRecord[]> {
    const cap = Math.min(Math.max(limit ?? 100, 1), 1000);
    const rows = toko_id
      ? (localDb
          .query("SELECT * FROM transaksi WHERE toko_id = ? ORDER BY created_at DESC LIMIT ?")
          .all(toko_id, cap) as Record<string, unknown>[])
      : (localDb
          .query("SELECT * FROM transaksi ORDER BY created_at DESC LIMIT ?")
          .all(cap) as Record<string, unknown>[]);
    return rows.map(mapTransaksi);
  },
  async get({ id }: { id: string }): Promise<TransaksiRecord | undefined> {
    const r = localDb.query("SELECT * FROM transaksi WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return r ? mapTransaksi(r) : undefined;
  },
  async insert(input: {
    toko_id: string;
    total: number;
    tax_rate?: number;
    discount_rate?: number;
    items: TransaksiItem[];
  }): Promise<TransaksiRecord> {
    const id = randomUUID();
    const tax_rate = input.tax_rate ?? 11;
    const discount_rate = input.discount_rate ?? 0;
    localDb.run(
      `INSERT INTO transaksi
        (id, toko_id, total, tax_rate, discount_rate, items_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, input.toko_id, input.total, tax_rate, discount_rate, JSON.stringify(input.items)],
    );
    // Side effect: credit wallet
    const walletId = getOrCreateWallet(input.toko_id);
    localDb.run(
      "INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, created_at) VALUES (?, ?, 'purchase', ?, ?, datetime('now'))",
      [randomUUID(), walletId, input.total, `Transaksi ${id}`],
    );
    localDb.run(
      "UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?",
      [input.total, walletId],
    );

    const r = localDb.query("SELECT * FROM transaksi WHERE id = ?").get(id) as Record<string, unknown>;
    return mapTransaksi(r);
  },
  async delete({ id }: { id: string }): Promise<{ ok: true }> {
    localDb.run("DELETE FROM transaksi WHERE id = ?", [id]);
    return { ok: true };
  },
};

// ---------- Wallet ----------
const walletHandlers = {
  async get({ toko_id }: { toko_id: string }): Promise<{ balance: number }> {
    const walletId = getOrCreateWallet(toko_id);
    const row = localDb.query("SELECT balance FROM wallets WHERE id = ?").get(walletId) as { balance: number } | undefined;
    return { balance: row?.balance ?? 0 };
  },
  async credit({ toko_id, amount, description }: { toko_id: string; amount: number; description?: string }): Promise<{ balance: number }> {
    const walletId = getOrCreateWallet(toko_id);
    const txn = localDb.transaction(() => {
      localDb.run(
        "INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, created_at) VALUES (?, ?, 'topup', ?, ?, datetime('now'))",
        [randomUUID(), walletId, amount, description ?? null],
      );
      localDb.run(
        "UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?",
        [amount, walletId],
      );
    });
    txn();
    const row = localDb.query("SELECT balance FROM wallets WHERE id = ?").get(walletId) as { balance: number };
    return { balance: row.balance };
  },
  async deduct({ toko_id, amount, description }: { toko_id: string; amount: number; description?: string }): Promise<{ balance: number }> {
    const walletId = getOrCreateWallet(toko_id);
    const txn = localDb.transaction(() => {
      const cur = localDb.query("SELECT balance FROM wallets WHERE id = ?").get(walletId) as { balance: number };
      if (cur.balance < amount) throw new Error("Saldo wallet tidak cukup");
      localDb.run(
        "INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, created_at) VALUES (?, ?, 'purchase', ?, ?, datetime('now'))",
        [randomUUID(), walletId, amount, description ?? null],
      );
      localDb.run(
        "UPDATE wallets SET balance = balance - ?, updated_at = datetime('now') WHERE id = ?",
        [amount, walletId],
      );
    });
    txn();
    const row = localDb.query("SELECT balance FROM wallets WHERE id = ?").get(walletId) as { balance: number };
    return { balance: row.balance };
  },
};

// ---------- Generic (mirror signature lama) ----------
const dbGenericHandlers = {
  async execute({ sql, bind = [] }: { sql: string; bind?: unknown[] }): Promise<{ rowsAffected: number }> {
    const stmt = localDb.prepare(sql);
    const r = stmt.run(...(bind as Parameters<typeof stmt.run>));
    return { rowsAffected: r.changes };
  },
  async select({ sql, bind = [] }: { sql: string; bind?: unknown[] }): Promise<Record<string, unknown>[]> {
    const stmt = localDb.prepare(sql);
    return stmt.all(...(bind as Parameters<typeof stmt.all>)) as Record<string, unknown>[];
  },
};

// ============================================================
// Combined handler map
// ============================================================
export const handlers = {
  "toko.list": tokoHandlers.list,
  "toko.get": tokoHandlers.get,
  "toko.insert": tokoHandlers.insert,
  "toko.update": tokoHandlers.update,
  "toko.delete": tokoHandlers.delete,
  "produk.list": produkHandlers.list,
  "produk.get": produkHandlers.get,
  "produk.insert": produkHandlers.insert,
  "produk.update": produkHandlers.update,
  "produk.delete": produkHandlers.delete,
  "produk.restock": produkHandlers.restock,
  "transaksi.list": transaksiHandlers.list,
  "transaksi.get": transaksiHandlers.get,
  "transaksi.insert": transaksiHandlers.insert,
  "transaksi.delete": transaksiHandlers.delete,
  "wallet.get": walletHandlers.get,
  "wallet.credit": walletHandlers.credit,
  "wallet.deduct": walletHandlers.deduct,
  "db.execute": dbGenericHandlers.execute,
  "db.select": dbGenericHandlers.select,
} satisfies { [K in keyof typeof rpcSchema.bun.requests]: (...args: any[]) => Promise<any> };
