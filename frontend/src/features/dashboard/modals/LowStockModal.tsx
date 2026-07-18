import { Show, For } from "solid-js";
import { formatRupiah } from "../../../lib/format";
import type { LowStockItem } from "../../../components/dashboard/types";

export interface LowStockModalProps {
  show: boolean;
  onClose: () => void;
  lowStockItems: () => LowStockItem[];
}

export default function LowStockModal(props: LowStockModalProps) {
  return (
    <Show when={props.show}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="modal-box" style="max-width: 600px;">
          <h3 class="text-lg font-bold text-white mb-1">
            Produk Stok Menipis
          </h3>
          <p class="text-xs text-zinc-500 mb-4">
            {props.lowStockItems().length} produk perlu restock
          </p>
          <div class="space-y-2 max-h-100 overflow-y-auto">
            <For
              each={props.lowStockItems()}
              fallback={
                <p class="text-sm text-zinc-600 text-center py-6">
                  Tidak ada produk stok menipis
                </p>
              }
            >
              {(item) => (
                <div class="flex items-center justify-between bg-white/3 rounded-lg px-3 py-2.5 border border-amber-500/15">
                  <div>
                    <p class="text-sm font-medium text-white">
                      {item.nama}
                    </p>
                    <p class="text-xs text-zinc-500">{item.toko_nama}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-semibold text-amber-400">
                      {item.stok}{" "}
                      <span class="text-xs text-zinc-500 font-normal">
                        / threshold {item.stock_threshold}
                      </span>
                    </p>
                    <p class="text-xs text-zinc-500 font-mono">
                      {formatRupiah(item.harga)}
                    </p>
                  </div>
                </div>
              )}
            </For>
          </div>
          <div class="flex justify-end pt-4">
            <button
              class="btn-sm btn-ghost"
              onClick={props.onClose}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
