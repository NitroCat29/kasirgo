import { Show, For } from "solid-js";
import { createMemo, createSignal } from "solid-js";
import { EmptyState } from "../../../components/ui";
import { formatRupiah } from "../../../lib/format";
import { canEdit } from "../../../components/dashboard/types";
import type { Produk } from "../../../components/dashboard/types";

export interface ProdukTabProps {
  daftarProduk: () => Produk[];
  lowStockCount: () => number;
  userRole: () => string | undefined;
  getTokoNama: (id: string | undefined) => string;
  loadLowStockItems: () => void;
  onAdd: () => void;
  onEdit: (p: Produk) => void;
  onDelete: (id: string, nama: string) => void;
  onQuickRestock: (p: Produk) => void;
  // Multi-select
  selectedProdukIds: () => Set<string>;
  selectedProdukCount: () => number;
  isAllProdukSelected: () => boolean;
  toggleProdukSelection: (id: string) => void;
  selectAllProduk: () => void;
  clearProdukSelection: () => void;
  bulkDeleteProduk: () => void;
  setShowBulkRestockModal: (v: boolean) => void;
}

const KATEGORI_COLORS: Record<string, string> = {
  makanan: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  minuman: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  snack: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  retail: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  elektronik: "bg-violet-500/15 text-violet-400 border-violet-500/25",
};

function kategoriColor(k: string | undefined): string {
  if (!k) return "bg-white/5 text-kasir-muted border-white/10";
  const key = k.toLowerCase();
  return KATEGORI_COLORS[key] || "bg-white/5 text-kasir-muted border-white/10";
}

function stockLevel(stok: number, threshold: number | undefined): { color: string; barColor: string; label: string } {
  const t = threshold || 5;
  if (stok <= 0) return { color: "text-red-400", barColor: "bg-red-500", label: "Habis" };
  if (stok <= t) return { color: "text-amber-400", barColor: "bg-amber-500", label: "Menipis" };
  return { color: "text-emerald-400", barColor: "bg-emerald-500", label: "Aman" };
}

export default function ProdukTab(props: ProdukTabProps) {
  const [search, setSearch] = createSignal("");
  const filtered = createMemo<Produk[]>(() => {
    const q = search().toLowerCase().trim();
    if (!q) return props.daftarProduk();
    return props.daftarProduk().filter(
      (p) =>
        p.nama.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.kategori || "").toLowerCase().includes(q),
    );
  });

  return (
    <div class="fade-in">
      {/* Low stock alert banner */}
      <Show when={props.lowStockCount() > 0}>
        <div class="glass p-4 mb-4 border border-amber-500/30 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-amber-300">
                {props.lowStockCount()} produk stok menipis
              </p>
              <p class="text-xs text-zinc-500">
                Stok ≤ threshold, perlu restock segera
              </p>
            </div>
          </div>
          <button class="btn-sm btn-ghost" onClick={props.loadLowStockItems}>
            Lihat Detail
          </button>
        </div>
      </Show>

      {/* Header: title, search, add button */}
      <div class="flex flex-wrap gap-3 justify-between items-center mb-4">
        <h2 class="text-lg font-semibold text-white">Daftar Produk</h2>
        <div class="flex items-center gap-2">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kasir-muted pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="search"
              placeholder="Cari nama / SKU / kategori..."
              value={search()}
              onInput={(e) => { props.clearProdukSelection(); setSearch(e.currentTarget.value); }}
              class="kasir-input w-56 text-sm pl-9"
            />
          </div>
          <Show when={canEdit(props.userRole())}>
            <button class="btn-sm btn-indigo" onClick={props.onAdd}>
              + Tambah Produk
            </button>
          </Show>
        </div>
      </div>

      {/* Selection action bar */}
      <Show when={props.selectedProdukCount() > 0}>
        <div class="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-xl bg-kasir-accent/10 border border-kasir-accent/20">
          <div class="flex items-center gap-3">
            <button
              class="w-5 h-5 rounded border-2 border-kasir-accent bg-kasir-accent/30 flex items-center justify-center"
              onClick={props.clearProdukSelection}
              title="Hapus pilihan"
            >
              <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 4.5l15 15m0-15l-15 15" />
              </svg>
            </button>
            <span class="text-sm font-semibold text-white">
              {props.selectedProdukCount()} produk dipilih
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="btn-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
              onClick={() => props.setShowBulkRestockModal(true)}
            >
              <svg class="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Restock
            </button>
            <button
              class="btn-sm bg-red-500/15 text-red-400 border border-red-500/25 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 transition-colors"
              onClick={props.bulkDeleteProduk}
            >
              <svg class="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Hapus
            </button>
          </div>
        </div>
      </Show>

      {/* Product grid */}
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <For each={filtered()} fallback={
          <div class="col-span-full">
            <EmptyState
              type="produk"
              title="Belum ada produk"
              description={search() ? `Tidak ada produk cocok dengan "${search()}"` : "Tambahkan produk pertama kamu untuk mulai."}
              action={canEdit(props.userRole()) ? { label: "+ Tambah Produk", onClick: props.onAdd } : undefined}
            />
          </div>
        }>
          {(p) => {
            const stk = stockLevel(p.stok ?? 0, p.stock_threshold);
            const isSelected = () => props.selectedProdukIds().has(p.id);
            return (
              <div
                class={`group relative glass rounded-xl p-4 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer ${
                  isSelected()
                    ? "border-kasir-accent/50 ring-1 ring-kasir-accent/30 bg-kasir-accent/5"
                    : "border-kasir-border hover:border-kasir-border-strong"
                }`}
                onClick={() => props.toggleProdukSelection(p.id)}
              >
                {/* Checkbox */}
                <div
                  class={`absolute top-3 left-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${
                    isSelected()
                      ? "bg-kasir-accent border-kasir-accent"
                      : "border-white/20 group-hover:border-white/40"
                  }`}
                >
                  <Show when={isSelected()}>
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </Show>
                </div>

                {/* Kategori badge */}
                <div class="ml-8 mb-2 min-h-[1.25em]">
                  <Show when={p.kategori}>
                    <span class={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${kategoriColor(p.kategori)}`}>
                      {p.kategori}
                    </span>
                  </Show>
                </div>

                {/* Nama & SKU */}
                <h3 class="text-sm font-semibold text-white leading-snug line-clamp-2 min-h-[2.5em] ml-8">
                  {p.nama}
                </h3>
                <p class="text-[11px] text-kasir-muted truncate mt-0.5 font-mono">
                  {p.sku || "—"}
                </p>

                {/* Harga */}
                <p class="text-base font-bold text-kasir-accent mt-2">
                  {formatRupiah(p.harga)}
                </p>

                {/* Stock bar */}
                <div class="mt-2.5">
                  <div class="flex justify-between text-[11px] mb-1">
                    <span class={`font-medium ${stk.color}`}>{stk.label}</span>
                    <span class="text-kasir-muted">Stok: {p.stok ?? 0}</span>
                  </div>
                  <div class="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      class={`h-full rounded-full ${stk.barColor} transition-all duration-300`}
                      style={{ width: `${Math.min(100, ((p.stok ?? 0) / Math.max((p.stock_threshold || 5) * 3, 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Actions — muncul saat hover */}
                <Show when={canEdit(props.userRole())}>
                  <div class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button
                      class="w-7 h-7 rounded-lg bg-white/10 hover:bg-kasir-accent/20 flex items-center justify-center text-kasir-muted hover:text-kasir-accent transition-colors"
                      title="Restock cepat"
                      onClick={(e) => { e.stopPropagation(); props.onQuickRestock(p); }}
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <button
                      class="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-kasir-muted hover:text-white transition-colors"
                      title="Edit"
                      onClick={(e) => { e.stopPropagation(); props.onEdit(p); }}
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      class="w-7 h-7 rounded-lg bg-white/10 hover:bg-red-500/20 flex items-center justify-center text-kasir-muted hover:text-red-400 transition-colors"
                      title="Hapus"
                      onClick={(e) => { e.stopPropagation(); props.onDelete(p.id, p.nama); }}
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
