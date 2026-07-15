// ============================================================
// KasirGo — WASM Bridge
// ============================================================
// Abstract loadWasm() + JS fallback. Dipakai browser + desktop.
// Module-based: import { loadWasm, getWasm, jsFallback } from './wasm-bridge'

import type { WasmExports } from "./types";

// ---- State ----

let wasmExports: WasmExports | null = null;
let wasmReady = false;

// ---- JS Fallback (selalu tersedia) ----

export const jsFallback = {
  calculate_total(subtotal: number, taxRate: number, discountRate: number): number {
    const afterDiscount = subtotal - (subtotal * discountRate) / 100;
    return afterDiscount + (afterDiscount * taxRate) / 100;
  },

  compute_benchmark(iterations: number): number {
    let acc = 0;
    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < 100; j++) acc += (i * j * 1.0001) % 1000;
      const items: { id: number; price: number; qty: number }[] = [];
      for (let k = 0; k < 32; k++) items.push({ id: k, price: k * 15000.5, qty: (k % 5) + 1 });
      for (let a = 0; a < items.length; a++)
        for (let b = 0; b < items.length - a - 1; b++)
          if (items[b].price > items[b + 1].price) { const t = items[b]; items[b] = items[b + 1]; items[b + 1] = t; }
      acc += items.reduce((s, x) => s + x.price * x.qty, 0) % 999999;
      for (let h = 0; h < 1000; h++) acc += (i * h * 31) % 512;
      acc = acc - acc * 0.11 + acc * 0.05;
    }
    return acc;
  },
};

// ---- WASM Loader ----

export async function loadWasm(wasmUrl = "kasir.wasm"): Promise<boolean> {
  try {
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error("WASM file tidak ditemukan");

    const bytes = await response.arrayBuffer();
    const wasm = await WebAssembly.instantiate(bytes, {
      env: { log: (ptr: number) => console.log("WASM log:", ptr) },
    });

    const exports = wasm.instance.exports as unknown as WasmExports;

    if (typeof exports.init_memory === "function") {
      exports.init_memory();
    }

    wasmExports = exports;
    wasmReady = true;
    console.log("%c✓ WASM module loaded (Zig compiled)", "color:#00d9a3;font-weight:bold");
    return true;
  } catch (err: any) {
    wasmReady = false;
    console.warn("WASM tidak tersedia, menggunakan JS fallback:", err.message);
    return false;
  }
}

// ---- Accessors ----

/** Cek apakah WASM sudah ready */
export function isWasmReady(): boolean {
  return wasmReady;
}

/** Ambil raw WASM exports (null kalau belum load) */
export function getWasmExports(): WasmExports | null {
  return wasmExports;
}

/** Hitung total: pakai WASM kalau ready, fallback ke JS */
export function calculateTotal(subtotal: number, taxRate: number, discountRate: number): number {
  if (wasmReady && wasmExports?.calculate_total) {
    return wasmExports.calculate_total(subtotal, taxRate, discountRate);
  }
  return jsFallback.calculate_total(subtotal, taxRate, discountRate);
}

/** Benchmark: pakai WASM kalau ready, fallback ke JS */
export function computeBenchmark(iterations: number): { wasm: number | null; js: number; speedup: number | null } {
  let wasmTime: number | null = null;

  if (wasmReady && wasmExports?.compute_benchmark) {
    const t0 = performance.now();
    wasmExports.compute_benchmark(iterations);
    wasmTime = performance.now() - t0;
  }

  const t1 = performance.now();
  jsFallback.compute_benchmark(iterations);
  const jsTime = performance.now() - t1;

  return {
    wasm: wasmTime,
    js: jsTime,
    speedup: wasmTime ? jsTime / wasmTime : null,
  };
}

// ---- Binary helpers (input_buffer) ----

/** Tulis data ke input_buffer, return pointer + length */
function writeToInputBuffer(bytes: Uint8Array): { ptr: number; len: number } {
  if (!wasmExports) throw new Error("WASM not loaded");
  const ptr = wasmExports.get_input_ptr();
  const maxSize = wasmExports.get_input_size();
  if (bytes.length > maxSize) throw new Error(`Input too large: ${bytes.length} > ${maxSize}`);
  new Uint8Array(wasmExports.memory.buffer).set(bytes, ptr);
  return { ptr, len: bytes.length };
}

/** Baca data dari memory buffer (untuk output) — Zig return offset relatif ke memory_buffer, tambah get_memory_ptr() */
function readFromMemoryBuffer(offset: number, length: number): Uint8Array {
  if (!wasmExports) throw new Error("WASM not loaded");
  const absOffset = wasmExports.get_memory_ptr() + offset;
  return new Uint8Array(wasmExports.memory.buffer, absOffset, length);
}

// ---- High-level WASM functions ----

/**
 * Load products ke catalog WASM via binary serialization.
 * Format: count(u32) + [id(u32) price(f64) stock(u32) category(u8) name_len(u32) name_bytes...]
 * Returns: number of products loaded
 */
export function loadProducts(products: { id: number; price: number; stock: number; category: number; name: string }[]): number {
  if (!wasmReady || !wasmExports?.load_products) return 0;

  const encoder = new TextEncoder();
  const names = products.map(p => encoder.encode(p.name));
  const totalSize = 4 + products.reduce((sum, p, i) => sum + 21 + names[i].length, 0);
  const buf = new Uint8Array(totalSize);
  const dv = new DataView(buf.buffer);

  dv.setUint32(0, products.length, true);
  let offset = 4;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    dv.setUint32(offset, p.id, true);
    dv.setFloat64(offset + 4, p.price, true);
    dv.setUint32(offset + 12, p.stock, true);
    dv.setUint8(offset + 16, p.category);
    dv.setUint32(offset + 17, names[i].length, true);
    buf.set(names[i], offset + 21);
    offset += 21 + names[i].length;
  }

  const { ptr, len } = writeToInputBuffer(buf);
  return wasmExports.load_products(ptr, len);
}

/**
 * Batch check low stock via WASM.
 * Input: { productId, stock, threshold }[]
 * Returns: product IDs yang stock <= threshold
 */
export function batchCheckLowStock(items: { productId: number; stock: number; threshold: number }[]): number[] {
  if (!wasmReady || !wasmExports?.batch_check_low_stock) return [];

  const buf = new Uint8Array(4 + items.length * 12);
  const dv = new DataView(buf.buffer);

  dv.setUint32(0, items.length, true);
  for (let i = 0; i < items.length; i++) {
    const offset = 4 + i * 12;
    dv.setUint32(offset, items[i].productId, true);
    dv.setUint32(offset + 4, items[i].stock, true);
    dv.setUint32(offset + 8, items[i].threshold, true);
  }

  const { ptr, len } = writeToInputBuffer(buf);
  const resultOffset = wasmExports.batch_check_low_stock(ptr, len);
  if (resultOffset === 0) return [];

  // Read result: count(u32) + [product_id(u32)]*
  const resultBuf = readFromMemoryBuffer(resultOffset, 4);
  const count = new DataView(resultBuf.buffer, resultBuf.byteOffset).getUint32(0, true);
  if (count === 0) return [];

  const ids: number[] = [];
  const idsBuf = readFromMemoryBuffer(resultOffset + 4, count * 4);
  const idsDv = new DataView(idsBuf.buffer, idsBuf.byteOffset);
  for (let i = 0; i < count; i++) {
    ids.push(idsDv.getUint32(i * 4, true));
  }
  return ids;
}
