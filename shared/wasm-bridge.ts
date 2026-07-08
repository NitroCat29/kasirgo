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
