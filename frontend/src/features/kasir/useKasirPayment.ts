import { createSignal } from "solid-js";
import { api, csrfHeaders } from "../../lib/api";
import {
  swalWarning,
  swalSuccess,
  swalApiError,
} from "../../lib/swal";
import type { CartItem } from "./useKasirCart";

/* ============================================
   TYPES
   ============================================ */

export interface TransaksiResult {
  id: string;
  total: number;
  created_at: string;
  items: CartItem[];
  kembalian?: number;
  method?: "tunai" | "non-tunai";
}

/* ============================================
   HOOK
   ============================================ */

interface CartDeps {
  cart: () => CartItem[];
  setCart: (v: CartItem[]) => void;
  total: () => number;
  globalDiskon: () => number;
  setGlobalDiskon: (v: number) => void;
  pajakRate: () => number;
}

export function useKasirPayment(deps: CartDeps) {
  const [showPaymentModal, setShowPaymentModal] = createSignal(false);
  const [paymentMethod, setPaymentMethod] = createSignal<"tunai" | "non-tunai">(
    "tunai",
  );
  const [cashReceived, setCashReceived] = createSignal("");
  const [transaksiResult, setTransaksiResult] =
    createSignal<TransaksiResult | null>(null);
  const [showReceipt, setShowReceipt] = createSignal(false);

  // --- Derived ---

  function kembalian(): number {
    const received = Number(cashReceived()) || 0;
    return received - deps.total();
  }

  // --- Actions ---

  function openPaymentModal() {
    if (deps.cart().length === 0) {
      swalWarning("Keranjang kosong");
      return;
    }
    setShowPaymentModal(true);
    setCashReceived("");
    setPaymentMethod("tunai");
  }

  function closePaymentModal() {
    setShowPaymentModal(false);
  }

  function closeReceipt() {
    setShowReceipt(false);
  }

  async function processPayment(selectedTokoId: string) {
    if (paymentMethod() === "tunai") {
      const received = Number(cashReceived()) || 0;
      if (received < deps.total()) {
        swalWarning("Uang tunai kurang");
        return;
      }
    }

    const items = deps.cart().map((c) => ({
      produk_id: c.produk_id.startsWith("jasa-") ? undefined : c.produk_id,
      nama: c.nama,
      harga: c.harga,
      qty: c.qty,
      diskon: c.diskon,
    }));

    try {
      const res = await fetch("/api/transaksi", {
        method: "POST",
        headers: csrfHeaders(),
        credentials: "include",
        body: JSON.stringify({
          toko_id: selectedTokoId,
          total: Math.round(deps.total()),
          tax_rate: deps.pajakRate(),
          discount_rate: deps.globalDiskon(),
          items,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setTransaksiResult({
        id: result.id,
        total: result.total,
        created_at: result.created_at,
        items: deps.cart(),
        kembalian: paymentMethod() === "tunai" ? kembalian() : undefined,
        method: paymentMethod(),
      });
      setShowPaymentModal(false);
      setShowReceipt(true);
      swalSuccess("Transaksi berhasil!");
      deps.setCart([]);
      deps.setGlobalDiskon(0);
      setCashReceived("");
    } catch (err: any) {
      swalApiError(err);
    }
  }

  return {
    showPaymentModal,
    setShowPaymentModal,
    paymentMethod,
    setPaymentMethod,
    cashReceived,
    setCashReceived,
    transaksiResult,
    setTransaksiResult,
    showReceipt,
    setShowReceipt,
    kembalian,
    openPaymentModal,
    closePaymentModal,
    closeReceipt,
    processPayment,
  };
}
