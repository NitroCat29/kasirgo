// ============================================================
// KasirGo — Desktop RPC Contract (Typed)
// ============================================================
// Scope: CRUD toko, produk, transaksi (offline mode via Electrobun).
// Signature harus mirror shared/types.ts + behavior dbExecute/dbSelect
// biar caller lama tetap kompatibel (perluan stage 6 migration).

import type {
  Toko,
  Produk as ProdukBase,
  TransaksiItem,
} from "./types";

export type { Toko };

// Extend ProdukBase dengan harga_modal (hasil migration).
export interface Produk extends ProdukBase {
  harga_modal: number;
}

// Insert payload (id auto-generated di handler).
export type TokoInsert = Omit<Toko, "id" | "created_at">;
export type ProdukInsert = Omit<Produk, "id" | "created_at"> & { id?: string };

export interface TransaksiInsert {
  toko_id: string;
  total: number;
  tax_rate?: number;
  discount_rate?: number;
  items: TransaksiItem[];
}

export { TransaksiItem };

export interface TransaksiRecord {
  id: string;
  toko_id: string;
  total: number;
  tax_rate: number;
  discount_rate: number;
  items: TransaksiItem[];
  created_at: string;
}

// ============================================================
// RPC Schema (consumed by electrobun/bun defineElectrobunRPC)
// ============================================================
export const rpcSchema = {
  bun: {
    requests: {
      // ---- Toko ----
      "toko.list": {
        params: undefined as undefined,
        response: undefined as Toko[] | undefined,
      },
      "toko.get": {
        params: undefined as { id: string } | undefined,
        response: undefined as Toko | undefined,
      },
      "toko.insert": {
        params: undefined as TokoInsert | undefined,
        response: undefined as Toko | undefined,
      },
      "toko.update": {
        params: undefined as Partial<TokoInsert> & { id: string } | undefined,
        response: undefined as Toko | undefined,
      },
      "toko.delete": {
        params: undefined as { id: string } | undefined,
        response: undefined as { ok: true } | undefined,
      },

      // ---- Produk ----
      "produk.list": {
        params: undefined as { toko_id?: string } | undefined,
        response: undefined as Produk[] | undefined,
      },
      "produk.get": {
        params: undefined as { id: string } | undefined,
        response: undefined as Produk | undefined,
      },
      "produk.insert": {
        params: undefined as ProdukInsert | undefined,
        response: undefined as Produk | undefined,
      },
      "produk.update": {
        params: undefined as Partial<ProdukInsert> & { id: string } | undefined,
        response: undefined as Produk | undefined,
      },
      "produk.delete": {
        params: undefined as { id: string } | undefined,
        response: undefined as { ok: true } | undefined,
      },
      "produk.restock": {
        params: undefined as { id: string; delta: number } | undefined,
        response: undefined as Produk | undefined,
      },

      // ---- Transaksi ----
      "transaksi.list": {
        params: undefined as { toko_id?: string; limit?: number } | undefined,
        response: undefined as TransaksiRecord[] | undefined,
      },
      "transaksi.get": {
        params: undefined as { id: string } | undefined,
        response: undefined as TransaksiRecord | undefined,
      },
      "transaksi.insert": {
        params: undefined as TransaksiInsert | undefined,
        response: undefined as TransaksiRecord | undefined,
      },
      "transaksi.delete": {
        params: undefined as { id: string } | undefined,
        response: undefined as { ok: true } | undefined,
      },

      // ---- Generic (mirror signature lama di desktop.ts) ----
      "db.execute": {
        params: undefined as { sql: string; bind?: unknown[] } | undefined,
        response: undefined as { rowsAffected: number } | undefined,
      },
      "db.select": {
        params: undefined as { sql: string; bind?: unknown[] } | undefined,
        response: undefined as Record<string, unknown>[] | undefined,
      },

      // ---- Wallet (perlu untuk full flow kasir) ----
      "wallet.get": {
        params: undefined as { toko_id: string } | undefined,
        response: undefined as { balance: number } | undefined,
      },
      "wallet.credit": {
        params: undefined as { toko_id: string; amount: number; description?: string } | undefined,
        response: undefined as { balance: number } | undefined,
      },
      "wallet.deduct": {
        params: undefined as { toko_id: string; amount: number; description?: string } | undefined,
        response: undefined as { balance: number } | undefined,
      },
    },
    messages: {},
  },
  webview: {
    requests: {},
    messages: {},
  },
} as const;
