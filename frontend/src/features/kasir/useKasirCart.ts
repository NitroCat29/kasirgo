import { createSignal, createEffect, onCleanup } from "solid-js";
import { swalWarning } from "../../lib/swal";
import { toast } from "../../lib/toast";

/* ============================================
   TYPES
   ============================================ */

export interface Produk {
  id: string;
  sku: string;
  nama: string;
  harga: number;
  stok: number;
  toko_id: string;
  kategori?: string;
}

export interface CartItem {
  produk_id: string;
  sku: string;
  nama: string;
  harga: number;
  qty: number;
  diskon: number; // 0-100
  stok_tersedia: number;
}

/* ============================================
   HELPERS
   ============================================ */

function loadNum(key: string): number {
  return Number(localStorage.getItem(key)) || 0;
}

function loadCartFromStorage(): CartItem[] {
  try {
    const stored = localStorage.getItem("kasir-cart");
    if (stored) return JSON.parse(stored) as CartItem[];
  } catch {}
  return [];
}

function usePersistedSignal<T>(
  key: string,
  initial: T,
  serialize: (v: T) => string,
  deserialize: (raw: string) => T,
  debounceMs = 300,
): [() => T, (v: T | ((prev: T) => T)) => void] {
  const stored =
    typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  const [signal, setSignal] = createSignal<T>(
    stored !== null ? deserialize(stored) : initial,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => {
    const val = signal();
    clearTimeout(timer);
    timer = setTimeout(() => localStorage.setItem(key, serialize(val)), debounceMs);
  });
  onCleanup(() => clearTimeout(timer));
  return [signal, setSignal];
}

/* ============================================
   HOOK
   ============================================ */

export function useKasirCart() {
  // --- Cart ---
  const [cart, setCart] = usePersistedSignal<CartItem[]>(
    "kasir-cart",
    [],
    JSON.stringify,
    (raw) => {
      try { return JSON.parse(raw) as CartItem[]; } catch { return []; }
    },
  );

  // --- Global diskon (0-100) ---
  const [globalDiskon, setGlobalDiskon] = usePersistedSignal<number>(
    "kasir-diskon",
    0,
    String,
    (raw) => Number(raw) || 0,
  );

  // --- PPN ---
  const [ppn, setPpn] = usePersistedSignal<number>(
    "kasir-ppn",
    11,
    String,
    (raw) => Number(raw) || 0,
  );

  const [ppnEnabled, setPpnEnabled] = usePersistedSignal<boolean>(
    "kasir-ppn-enabled",
    false,
    String,
    (raw) => raw === "true",
  );

  // --- Cart actions ---

  function addToCart(p: Produk) {
    const existing = cart().find((c) => c.produk_id === p.id);
    if (existing) {
      if (existing.qty >= p.stok) {
        swalWarning(`Stok ${p.nama} tidak cukup`);
        return;
      }
      setCart(
        cart().map((c) =>
          c.produk_id === p.id ? { ...c, qty: c.qty + 1 } : c,
        ),
      );
    } else {
      setCart([
        ...cart(),
        {
          produk_id: p.id,
          sku: p.sku,
          nama: p.nama,
          harga: p.harga,
          qty: 1,
          diskon: 0,
          stok_tersedia: p.stok,
        },
      ]);
    }
    toast.success(`${p.nama} ditambahkan ke keranjang`);
    // Scroll cart to bottom to show new item
    setTimeout(() => {
      const cartBody = document.querySelector(".kasir-cart-scroll");
      if (cartBody) cartBody.scrollTop = cartBody.scrollHeight;
    }, 50);
  }

  function updateQty(idx: number, delta: number) {
    const item = cart()[idx];
    const newQty = item.qty + delta;
    if (newQty < 1) return;
    if (newQty > item.stok_tersedia) {
      swalWarning(`Stok maksimal: ${item.stok_tersedia}`);
      return;
    }
    setCart(cart().map((c, i) => (i === idx ? { ...c, qty: newQty } : c)));
  }

  function updateDiskon(idx: number, val: string) {
    const diskon = Math.max(0, Math.min(100, Number(val) || 0));
    setCart(cart().map((c, i) => (i === idx ? { ...c, diskon } : c)));
  }

  function removeFromCart(idx: number) {
    setCart(cart().filter((_, i) => i !== idx));
  }

  function getQty(produkId: string): number {
    return cart().find((c) => c.produk_id === produkId)?.qty ?? 0;
  }

  // Set qty absolut untuk produk tertentu (buat fitur fotocopy preset)
  function setQtyAbs(produkId: string, qty: number) {
    const idx = cart().findIndex((c) => c.produk_id === produkId);
    const clamped = Math.max(0, Math.min(qty, Number.MAX_SAFE_INTEGER));
    if (clamped === 0) {
      if (idx !== -1) removeFromCart(idx);
      return;
    }
    if (idx === -1) {
      // cari produk dari catalog tidak tersedia di sini; caller wajib lewat addToCart dulu
      swalWarning("Produk belum ada di keranjang");
      return;
    }
    const item = cart()[idx];
    const finalQty = Math.min(clamped, item.stok_tersedia);
    if (clamped > item.stok_tersedia) {
      swalWarning(`Stok maksimal: ${item.stok_tersedia}`);
    }
    setCart(cart().map((c, i) => (i === idx ? { ...c, qty: finalQty } : c)));
  }

  function clearCart() {
    setCart([]);
  }

  // --- Calculations ---

  function itemSubtotal(item: CartItem): number {
    const afterDiskon = item.harga * (1 - item.diskon / 100);
    return afterDiskon * item.qty;
  }

  function subtotal(): number {
    return cart().reduce((sum, item) => sum + itemSubtotal(item), 0);
  }

  function total(): number {
    const sub = subtotal();
    const diskonGlobal = sub * (globalDiskon() / 100);
    const afterDiskon = sub - diskonGlobal;
    const pajak = ppnEnabled() ? afterDiskon * (ppn() / 100) : 0;
    return Math.round(afterDiskon + pajak);
  }

  return {
    cart,
    setCart,
    globalDiskon,
    setGlobalDiskon,
    ppn,
    setPpn,
    ppnEnabled,
    setPpnEnabled,
    addToCart,
    updateQty,
    updateDiskon,
    removeFromCart,
    getQty,
    setQtyAbs,
    clearCart,
    itemSubtotal,
    subtotal,
    total,
  };
}
