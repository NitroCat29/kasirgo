import { createSignal, untrack, batch } from "solid-js";
import type { CartItem } from "./useKasirCart";

/* ============================================
   HOOK — jasa fotocopy (imperative, no reactive loop)
   ============================================ */

export interface UseKasirFotocopyOpts {
  unitPrice: number;
  cart: () => CartItem[];
  setCart: (v: CartItem[] | ((prev: CartItem[]) => CartItem[])) => void;
}

const JASA_ID = "jasa-fotocopy";
const JASA_SKU = "JASA-FC";
const JASA_NAMA = "Fotocopy";

export function useKasirFotocopy(opts: UseKasirFotocopyOpts) {
  const [qty, setQtySig] = createSignal<number>(0);
  const [doubleSided, setDoubleSidedSig] = createSignal<boolean>(false);

  // lembar efektif (2 sisi = qty×2)
  function effLembar(): number {
    return doubleSided() ? qty() * 2 : qty();
  }

  // Update cart item jasa (imperative, dipanggil eksplisit)
  function syncCartVal(total: number) {
    opts.setCart((prev) => {
      const idx = prev.findIndex((c) => c.produk_id === JASA_ID);
      if (total === 0) {
        return idx === -1 ? prev : prev.filter((_, i) => i !== idx);
      }
      const item: CartItem = {
        produk_id: JASA_ID,
        sku: JASA_SKU,
        nama: JASA_NAMA,
        harga: opts.unitPrice,
        qty: total,
        diskon: 0,
        stok_tersedia: Number.MAX_SAFE_INTEGER,
      };
      if (idx === -1) return [...prev, item];
      return prev.map((c, i) => (i === idx ? item : c));
    });
  }

  function syncCart() {
    syncCartVal(untrack(effLembar));
  }

  function setQty(n: number) {
    const clamped = Math.max(0, n);
    const total = doubleSided() ? clamped * 2 : clamped;
    batch(() => {
      setQtySig(clamped);
      syncCartVal(total);
    });
  }

  function addQty(n: number) {
    setQty(qty() + n);
  }

  function toggleDoubleSided() {
    const nextDS = !doubleSided();
    const total = untrack(qty) * (nextDS ? 2 : 1);
    batch(() => {
      setDoubleSidedSig(nextDS);
      syncCartVal(total);
    });
  }

  function setDoubleSided(v: boolean) {
    const total = untrack(qty) * (v ? 2 : 1);
    batch(() => {
      setDoubleSidedSig(v);
      syncCartVal(total);
    });
  }

  function reset() {
    batch(() => {
      setQtySig(0);
      setDoubleSidedSig(false);
      syncCartVal(0);
    });
  }

  return {
    qty,
    doubleSided,
    effLembar,
    setQty,
    addQty,
    toggleDoubleSided,
    setDoubleSided,
    reset,
    unitPrice: opts.unitPrice,
    jasaId: JASA_ID,
    jasaSku: JASA_SKU,
    jasaNama: JASA_NAMA,
  };
}
