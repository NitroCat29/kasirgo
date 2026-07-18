import { Show, For } from "solid-js";
import { formatRupiah } from "../../../lib/format";
import type { Toko, TrxItem } from "../../../components/dashboard/types";

export interface TrxModalProps {
  show: boolean;
  onClose: () => void;
  trxForm: () => { toko_id: string; items: TrxItem[] };
  setTrxForm: (v: { toko_id: string; items: TrxItem[] } | ((prev: { toko_id: string; items: TrxItem[] }) => { toko_id: string; items: TrxItem[] })) => void;
  trxItemForm: () => { nama: string; harga: string; qty: string };
  setTrxItemForm: (v: { nama: string; harga: string; qty: string }) => void;
  daftarToko: () => Toko[];
  addTrxItem: (e: Event) => void;
  removeTrxItem: (idx: number) => void;
  saveTrx: (e: Event) => void;
  trxFormSubtotal: () => number;
  trxFormTotal: () => number;
  submitting: () => boolean;
}

export default function TrxModal(props: TrxModalProps) {
  return (
    <Show when={props.show}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="modal-box" style="max-width: 560px;">
          <h3 class="text-lg font-bold text-white mb-5">
            Tambah Transaksi
          </h3>
          <form onSubmit={props.saveTrx} class="space-y-4">
            <div>
              <label class="text-xs font-medium text-zinc-400 mb-1 block">
                Toko
              </label>
              <select
                class="glass-input"
                value={props.trxForm().toko_id}
                onChange={(e) =>
                  props.setTrxForm((prev) => ({
                    ...prev,
                    toko_id: e.currentTarget.value,
                  }))
                }
                required
              >
                <option value="" disabled>
                  Pilih toko
                </option>
                <For each={props.daftarToko()}>
                  {(t) => <option value={t.id}>{t.nama}</option>}
                </For>
              </select>
            </div>

            {/* Items list */}
            <div>
              <label class="text-xs font-medium text-zinc-400 mb-2 block">
                Items ({props.trxForm().items.length})
              </label>
              <div class="space-y-2 mb-3">
                <For
                  each={props.trxForm().items}
                  fallback={
                    <p class="text-xs text-zinc-600 italic">
                      Belum ada item
                    </p>
                  }
                >
                  {(item, idx) => (
                    <div class="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                      <span class="text-sm text-white flex-1 truncate">
                        {item.nama}
                      </span>
                      <span class="text-xs text-zinc-400 font-mono">
                        {item.qty}x {formatRupiah(item.harga)}
                      </span>
                      <span class="text-sm text-kasir-accent font-mono">
                        {formatRupiah(item.harga * item.qty)}
                      </span>
                      <button
                        type="button"
                        class="text-zinc-500 hover:text-red-400 text-lg"
                        onClick={() => props.removeTrxItem(idx())}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </For>
              </div>

              {/* Add item form */}
              <div class="flex gap-2">
                <input
                  class="glass-input flex-1"
                  value={props.trxItemForm().nama}
                  onInput={(e) =>
                    props.setTrxItemForm({
                      ...props.trxItemForm(),
                      nama: e.currentTarget.value,
                    })
                  }
                  placeholder="Nama item"
                />
                <input
                  type="text"
                  inputmode="numeric"
                  class="glass-input w-24"
                  value={props.trxItemForm().harga}
                  onInput={(e) => {
                    const raw = e.currentTarget.value.replace(/[^0-9]/g, "");
                    props.setTrxItemForm({
                      ...props.trxItemForm(),
                      harga: raw,
                    });
                  }}
                  placeholder="Harga"
                />
                <input
                  type="text"
                  inputmode="numeric"
                  class="glass-input w-16"
                  value={props.trxItemForm().qty}
                  onInput={(e) => {
                    const raw = e.currentTarget.value.replace(/[^0-9]/g, "");
                    props.setTrxItemForm({
                      ...props.trxItemForm(),
                      qty: raw,
                    });
                  }}
                  placeholder="Qty"
                />
                <button
                  type="button"
                  class="btn-sm btn-indigo"
                  onClick={props.addTrxItem}
                >
                  +
                </button>
              </div>
            </div>

            {/* Total */}
            <Show when={props.trxForm().items.length > 0}>
              <div class="border-t border-zinc-700 pt-3 space-y-1">
                <div class="flex justify-between text-sm text-zinc-400">
                  <span>Subtotal</span>
                  <span class="font-mono">
                    {formatRupiah(props.trxFormSubtotal())}
                  </span>
                </div>
                <div class="flex justify-between text-sm text-zinc-400">
                  <span>PPN (11%)</span>
                  <span class="font-mono">
                    {formatRupiah(props.trxFormSubtotal() * 0.11)}
                  </span>
                </div>
                <div class="flex justify-between text-lg font-bold text-white">
                  <span>Total</span>
                  <span class="font-mono text-kasir-accent">
                    {formatRupiah(props.trxFormTotal())}
                  </span>
                </div>
              </div>
            </Show>

            <div class="flex gap-3 pt-2">
              <button
                type="button"
                class="btn-sm btn-ghost flex-1"
                onClick={props.onClose}
              >
                Batal
              </button>
              <button
                type="submit"
                class="btn-sm btn-indigo flex-1"
                disabled={props.submitting()}
              >
                {props.submitting() ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}
