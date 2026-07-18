import { Show, For } from "solid-js";
import { formatRupiah, formatWIB } from "../../lib/format";
import type { CartItem } from "./useKasirCart";
import type { TransaksiResult } from "./useKasirPayment";

/* ============================================
   TYPES
   ============================================ */

export interface KasirPaymentModalProps {
  showPaymentModal: () => boolean;
  setShowPaymentModal: (v: boolean) => void;
  paymentMethod: () => "tunai" | "non-tunai";
  setPaymentMethod: (v: "tunai" | "non-tunai") => void;
  cashReceived: () => string;
  setCashReceived: (v: string) => void;
  kembalian: () => number;
  total: () => number;
  processPayment: (selectedTokoId: string) => Promise<void>;
  selectedTokoId: () => string;
}

export interface KasirReceiptModalProps {
  showReceipt: () => boolean;
  closeReceipt: () => void;
  transaksiResult: () => TransaksiResult | null;
  daftarToko: () => { id: string; nama: string }[];
  selectedTokoId: () => string;
  itemSubtotal: (item: CartItem) => number;
  cashReceived: () => string;
}

/* ============================================
   COMPONENTS
   ============================================ */

export function KasirPaymentModal(props: KasirPaymentModalProps) {
  return (
    <Show when={props.showPaymentModal()}>
      <div
        class="fixed inset-0 payment-overlay flex items-center justify-center z-50"
        onClick={() => props.setShowPaymentModal(false)}
      >
        <div
          class="payment-modal-box p-6 w-96 max-w-[90vw]"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 class="text-xl font-bold mb-4">Pembayaran</h3>

          <div class="mb-4">
            <div class="flex gap-2 mb-4">
              <button
                class={`flex-1 py-2 rounded-lg font-medium ${props.paymentMethod() === "tunai" ? "bg-kasir-accent text-white" : "bg-kasir-bg text-kasir-muted"}`}
                onClick={() => props.setPaymentMethod("tunai")}
              >
                💵 Tunai
              </button>
              <button
                class={`flex-1 py-2 rounded-lg font-medium ${props.paymentMethod() === "non-tunai" ? "bg-kasir-accent text-white" : "bg-kasir-bg text-kasir-muted"}`}
                onClick={() => props.setPaymentMethod("non-tunai")}
              >
                💳 Non-Tunai
              </button>
            </div>

            <Show when={props.paymentMethod() === "tunai"}>
              <div class="space-y-2">
                <label class="text-sm text-kasir-muted">Total</label>
                <div class="text-2xl font-bold text-kasir-accent">
                  {formatRupiah(props.total())}
                </div>

                <label class="text-sm text-kasir-muted mt-4">
                  Uang Diterima
                </label>
                <input
                  type="number"
                  class="input w-full text-xl"
                  placeholder="0"
                  value={props.cashReceived()}
                  onInput={(e) => props.setCashReceived(e.currentTarget.value)}
                  autofocus
                />

                {/* Quick cash buttons */}
                <div class="grid grid-cols-3 gap-2 mt-2">
                  {[50000, 100000, 200000].map((amt) => (
                    <button
                      class="btn-sm btn-ghost"
                      onClick={() => props.setCashReceived(String(amt))}
                    >
                      {formatRupiah(amt)}
                    </button>
                  ))}
                </div>

                <Show when={Number(props.cashReceived()) >= props.total()}>
                  <div class="mt-4 p-3 bg-green-500/20 rounded-lg">
                    <div class="text-sm text-kasir-muted">Kembalian</div>
                    <div class="text-xl font-bold text-green-400">
                      {formatRupiah(props.kembalian())}
                    </div>
                  </div>
                </Show>
              </div>
            </Show>

            <Show when={props.paymentMethod() === "non-tunai"}>
              <div class="text-center py-8">
                <div class="text-4xl mb-2">💳</div>
                <div class="text-kasir-muted">Pembayaran non-tunai</div>
                <div class="text-sm text-kasir-muted mt-2">
                  (QRIS / Debit / Credit Card)
                </div>
              </div>
            </Show>
          </div>

          <div class="flex gap-2">
            <button
              class="btn btn-ghost flex-1"
              onClick={() => props.setShowPaymentModal(false)}
            >
              Batal
            </button>
            <button
              class="btn btn-primary flex-1"
              onClick={() => props.processPayment(props.selectedTokoId())}
            >
              ✅ Bayar
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export function KasirReceiptModal(props: KasirReceiptModalProps) {
  return (
    <Show when={props.showReceipt() && props.transaksiResult()}>
      <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={props.closeReceipt}
      >
        <div
          class="bg-white text-black rounded-xl p-6 w-80 max-w-[90vw] font-mono text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="text-center mb-4">
            <div class="text-lg font-bold">KasirGo</div>
            <div class="text-xs">
              {props.daftarToko().find((t) => t.id === props.selectedTokoId())?.nama}
            </div>
            <div class="text-xs mt-1">
              {formatWIB(props.transaksiResult()!.created_at)}
            </div>
            <div class="text-xs">
              No: {props.transaksiResult()!.id.slice(0, 8).toUpperCase()}
            </div>
          </div>

          <div class="border-t border-b border-gray-300 py-2 space-y-1">
            <For each={props.transaksiResult()!.items}>
              {(item) => (
                <div>
                  <div class="flex justify-between">
                    <span class="truncate">{item.nama}</span>
                  </div>
                  <div class="flex justify-between text-xs text-gray-600">
                    <span>
                      {item.qty} x {formatRupiah(item.harga)}
                      {item.diskon > 0 && ` (-${item.diskon}%)`}
                    </span>
                    <span>{formatRupiah(props.itemSubtotal(item))}</span>
                  </div>
                </div>
              )}
            </For>
          </div>

          <div class="py-2 space-y-1">
            <div class="flex justify-between font-bold text-base">
              <span>TOTAL</span>
              <span>{formatRupiah(props.transaksiResult()!.total)}</span>
            </div>
            <Show when={props.transaksiResult()!.method === "tunai"}>
              <div class="flex justify-between">
                <span>Tunai</span>
                <span>
                  {formatRupiah(
                    Number(props.cashReceived()) ||
                      props.transaksiResult()!.total +
                        (props.transaksiResult()!.kembalian || 0),
                  )}
                </span>
              </div>
              <div class="flex justify-between">
                <span>Kembali</span>
                <span>
                  {formatRupiah(props.transaksiResult()!.kembalian || 0)}
                </span>
              </div>
            </Show>
            <Show when={props.transaksiResult()!.method === "non-tunai"}>
              <div class="text-center text-xs text-gray-600">
                Pembayaran Non-Tunai
              </div>
            </Show>
          </div>

          <div class="text-center text-xs text-gray-500 mt-4">
            Terima kasih atas kunjungan Anda!
          </div>

          <button
            class="btn btn-primary w-full mt-4"
            onClick={props.closeReceipt}
          >
            Tutup
          </button>
        </div>
      </div>
    </Show>
  );
}
