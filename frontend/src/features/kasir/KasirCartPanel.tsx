import { Show, For } from "solid-js";
import { EmptyState } from "../../components/ui";
import { formatRupiah } from "../../lib/format";
import { toast } from "../../lib/toast";
import type { CartItem } from "./useKasirCart";

/* ============================================
   TYPES
   ============================================ */

export interface KasirCartPanelProps {
  // Visibility
  show: boolean;
  // Cart state
  cart: () => CartItem[];
  setCart: (v: CartItem[]) => void;
  globalDiskon: () => number;
  setGlobalDiskon: (v: number | ((prev: number) => number)) => void;
  pajakRate: () => number;
  setPajakRate: (v: number | ((prev: number) => number)) => void;
  ppnEnabled: () => boolean;
  setPpnEnabled: (v: boolean | ((prev: boolean) => boolean)) => void;
  // Calculations
  itemSubtotal: (item: CartItem) => number;
  subtotal: () => number;
  total: () => number;
  // Actions
  updateQty: (idx: number, delta: number) => void;
  updateDiskon: (idx: number, val: string) => void;
  removeFromCart: (idx: number) => void;
  openPaymentModal: () => void;
}

/* ============================================
   COMPONENT
   ============================================ */

export default function KasirCartPanel(props: KasirCartPanelProps) {
  function clearCart() {
    if (confirm("Yakin kosongkan keranjang?")) {
      props.setCart([]);
      toast.info("Keranjang dikosongkan");
    }
  }

  return (
    <div
      class={`fixed lg:static bottom-0 left-0 right-0 lg:inset-auto z-50 lg:z-0 w-full lg:w-[400px] shrink-0 border-t lg:border-t-0 lg:border-l border-kasir-border bg-kasir-card grid transition-transform duration-300 ease-in-out h-[85vh] lg:h-full ${
        props.show ? "translate-y-0" : "translate-y-full"
      } lg:translate-y-0`}
      style={{ "grid-template-rows": "auto 1fr auto" }}
    >
      {/* Cart header */}
      <div class="px-4 py-3 border-b border-kasir-border font-semibold shrink-0">
        🛒 Keranjang ({props.cart().length} item)
      </div>

      {/* Cart items — scrollable */}
      <div class="flex-1 overflow-y-auto min-h-0 overscroll-contain kasir-cart-scroll">
        <Show when={props.cart().length === 0}>
          <EmptyState
            type="cart"
            title="Keranjang Kosong"
            description="Pilih produk dari katalog untuk mulai transaksi."
          />
        </Show>
        <Show when={props.cart().length > 0}>
          <table class="w-full">
            <thead class="bg-kasir-bg sticky top-0">
              <tr class="text-left text-sm text-kasir-muted">
                <th class="px-3 py-2">Produk</th>
                <th class="px-3 py-2 text-center">Qty</th>
                <th class="px-3 py-2 text-right">Subtotal</th>
                <th class="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <For each={props.cart()}>
                {(item, idx) => (
                  <tr class="border-t border-kasir-border hover:bg-kasir-card-hover">
                    <td class="px-3 py-2">
                      <div class="flex flex-col">
                        <span class="text-sm font-medium">{item.nama}</span>
                        <span class="text-xs text-kasir-muted">
                          {formatRupiah(item.harga)}
                        </span>
                        <Show when={item.diskon > 0}>
                          <span class="text-xs text-kasir-accent">
                            Disc {item.diskon}%
                          </span>
                        </Show>
                      </div>
                    </td>
                    <td class="px-3 py-2 text-center">
                      <div class="flex items-center justify-center gap-1">
                        <button
                          class="qty-btn"
                          onClick={() => props.updateQty(idx(), -1)}
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputmode="numeric"
                          pattern="[0-9]*"
                          class="input-xs w-10 text-center kasir-input"
                          value={item.qty}
                          onInput={(e) => {
                            const raw = e.currentTarget.value.replace(
                              /[^0-9]/g,
                              "",
                            );
                            const val = Math.max(1, Number(raw) || 1);
                            e.currentTarget.value = String(val);
                            const current = props.cart()[idx()];
                            if (current) {
                              // Calculate delta from current qty
                              const delta = val - current.qty;
                              if (delta !== 0) props.updateQty(idx(), delta);
                            }
                          }}
                        />
                        <button
                          class="qty-btn"
                          onClick={() => props.updateQty(idx(), 1)}
                        >
                          +
                        </button>
                      </div>
                      <Show when={item.diskon > 0 || true}>
                        <div class="mt-1 flex items-center justify-center gap-1">
                          <input
                            type="text"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            class="input-xs w-10 text-center kasir-input"
                            placeholder="Disc %"
                            value={item.diskon || ""}
                            onInput={(e) =>
                              props.updateDiskon(idx(), e.currentTarget.value)
                            }
                          />
                          <span class="text-xs text-kasir-muted">%</span>
                        </div>
                      </Show>
                    </td>
                    <td class="px-3 py-2 text-right font-mono text-sm">
                      {formatRupiah(props.itemSubtotal(item))}
                    </td>
                    <td class="px-3 py-2 text-center">
                      <button
                        class="text-kasir-muted hover:text-red-400 text-lg"
                        onClick={() => props.removeFromCart(idx())}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>

      {/* Summary — pinned */}
      <div class="border-t border-kasir-border p-4 space-y-2 shrink-0 bg-kasir-card">
        <h3 class="font-semibold text-lg">Ringkasan</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-kasir-muted">Subtotal</span>
            <span>{formatRupiah(props.subtotal())}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-kasir-muted">Diskon</span>
            <div class="flex items-center gap-2">
              <input
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                class="input-xs w-16 text-right kasir-input"
                value={props.globalDiskon()}
                onInput={(e) => {
                  const raw = e.currentTarget.value.replace(/[^0-9]/g, "");
                  const clamped = Math.max(0, Math.min(100, Number(raw) || 0));
                  e.currentTarget.value = String(clamped);
                  props.setGlobalDiskon(clamped);
                }}
              />
              <span>%</span>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-kasir-muted">PPN</span>
            <div class="flex items-center gap-2">
              <input
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                class="input-xs w-16 text-right kasir-input"
                value={props.pajakRate()}
                disabled={!props.ppnEnabled()}
                onInput={(e) => {
                  const raw = e.currentTarget.value.replace(/[^0-9]/g, "");
                  const clamped = Math.max(0, Math.min(100, Number(raw) || 0));
                  e.currentTarget.value = String(clamped);
                  props.setPajakRate(clamped);
                }}
              />
              <span>%</span>
              <label class="flex items-center gap-1 cursor-pointer select-none ml-1">
                <input
                  type="checkbox"
                  class="ppn-checkbox"
                  checked={props.ppnEnabled()}
                  onChange={(e) => {
                    const en = e.currentTarget.checked;
                    props.setPpnEnabled(en);
                    if (!en) props.setPajakRate(0);
                  }}
                />
                <span class="text-xs text-kasir-muted">Aktifkan</span>
              </label>
            </div>
          </div>
          <div class="border-t border-kasir-border pt-2 mt-2">
            <div class="flex justify-between text-lg font-bold">
              <span>TOTAL</span>
              <span class="text-kasir-accent">
                {formatRupiah(props.total())}
              </span>
            </div>
          </div>
        </div>

        <button
          class="btn-bayar w-full"
          disabled={props.cart().length === 0}
          onClick={props.openPaymentModal}
        >
          💳 Bayar
        </button>
        <button
          class="w-full py-2 text-sm text-kasir-muted hover:text-red-400 transition-colors"
          onClick={clearCart}
          disabled={props.cart().length === 0}
        >
          🗑️ Kosongkan
        </button>
      </div>
    </div>
  );
}
