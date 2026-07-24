import { Show, For, createSignal, createMemo } from "solid-js";
import { formatRupiah } from "../../../lib/format";
import type { LowStockItem } from "../../../components/dashboard/types";

export interface LowStockModalProps {
  show: boolean;
  onClose: () => void;
  lowStockItems: () => LowStockItem[];
}

export default function LowStockModal(props: LowStockModalProps) {
  const [search, setSearch] = createSignal("");
  const [tokoFilter, setTokoFilter] = createSignal("");

  const tokoOptions = createMemo(() => {
    const map = new Map<string, string>();
    for (const item of props.lowStockItems()) {
      if (item.toko_id) map.set(item.toko_id, item.toko_nama || item.toko_id);
    }
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }));
  });

  const filtered = createMemo(() => {
    const q = search().trim().toLowerCase();
    const toko = tokoFilter();
    return props.lowStockItems().filter((item) => {
      if (toko && item.toko_id !== toko) return false;
      if (!q) return true;
      return (
        item.nama.toLowerCase().includes(q) ||
        (item.toko_nama || "").toLowerCase().includes(q)
      );
    });
  });

  function handleClose() {
    setSearch("");
    setTokoFilter("");
    props.onClose();
  }

  return (
    <Show when={props.show}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div class="modal-box" style="max-width: 600px;">
          <h3 class="text-lg font-bold text-white mb-1">
            Produk Stok Menipis
          </h3>
          <p class="text-xs text-zinc-500 mb-3">
            {props.lowStockItems().length} produk perlu restock
            <Show when={filtered().length !== props.lowStockItems().length}>
              <span> · tampil {filtered().length}</span>
            </Show>
          </p>

          <div class="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="search"
              class="input flex-1 text-sm"
              placeholder="Cari nama produk…"
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
            />
            <select
              class="input text-sm sm:w-48"
              value={tokoFilter()}
              onChange={(e) => setTokoFilter(e.currentTarget.value)}
            >
              <option value="">Semua toko</option>
              <For each={tokoOptions()}>
                {(t) => <option value={t.id}>{t.nama}</option>}
              </For>
            </select>
          </div>

          <div class="space-y-2 max-h-100 overflow-y-auto">
            <For
              each={filtered()}
              fallback={
                <p class="text-sm text-zinc-600 text-center py-6">
                  {props.lowStockItems().length === 0
                    ? "Tidak ada produk stok menipis"
                    : "Tidak ada hasil filter"}
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
                    <p class="text-xs text-zinc-500">
                      {formatRupiah(item.harga)}
                    </p>
                  </div>
                </div>
              )}
            </For>
          </div>

          <div class="mt-4 flex justify-end">
            <button class="btn-ghost text-sm" onClick={handleClose}>
              Tutup
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
