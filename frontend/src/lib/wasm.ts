// ============================================================
// KasirGo — WASM Bridge (SolidJS)
// ============================================================
import { createSignal } from "solid-js";

type WasmExports = {
  init_memory: () => void;
  calculate_total: (subtotal: number, taxRate: number, discountRate: number) => number;
  compute_benchmark: (iterations: number) => number;
  batch_check_low_stock: (...args: number[]) => number;
  memory: WebAssembly.Memory;
  [key: string]: unknown;
};

const [wasmReady, setWasmReady] = createSignal(false);
export { wasmReady };

let wasmExports: WasmExports | null = null;

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

export async function loadWasm(wasmUrl = "/kasir.wasm"): Promise<boolean> {
  try {
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error("WASM file tidak ditemukan");
    const bytes = await response.arrayBuffer();
    const wasm = await WebAssembly.instantiate(bytes, {
      env: { log: (ptr: number) => console.log("WASM log:", ptr) },
    });
    const exports = wasm.instance.exports as unknown as WasmExports;
    if (typeof exports.init_memory === "function") exports.init_memory();
    wasmExports = exports;
    setWasmReady(true);
    console.log("%c✓ WASM loaded (Zig compiled)", "color:#00d9a3;font-weight:bold");
    return true;
  } catch (err: any) {
    setWasmReady(false);
    console.warn("WASM tidak tersedia, JS fallback:", err.message);
    return false;
  }
}

export function calculateTotal(subtotal: number, taxRate: number, discountRate: number): number {
  if (wasmReady() && wasmExports?.calculate_total) return wasmExports.calculate_total(subtotal, taxRate, discountRate);
  return jsFallback.calculate_total(subtotal, taxRate, discountRate);
}

export function computeBenchmark(iterations: number): { wasm: string; js: string; speedup: string } {
  let wasmTime = 0;
  if (wasmReady() && wasmExports?.compute_benchmark) {
    const t0 = performance.now();
    wasmExports.compute_benchmark(iterations);
    wasmTime = performance.now() - t0;
  }
  const t1 = performance.now();
  jsFallback.compute_benchmark(iterations);
  const jsTime = performance.now() - t1;
  return {
    wasm: wasmReady() ? wasmTime.toFixed(2) : "N/A",
    js: jsTime.toFixed(2),
    speedup: wasmReady() ? (jsTime / wasmTime).toFixed(2) : "—",
  };
}
