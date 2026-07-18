import { Show, For } from "solid-js";
import { createMemo, createSignal } from "solid-js";
import { EmptyState } from "../../../components/ui";
import { formatRupiah } from "../../../lib/format";
import { cn } from "../../../lib/util";
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
              <svg
                class="w-5 h-5 text-amber-400"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z"
                />
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

      <div class="flex flex-wrap gap-3 justify-between items-center mb-4">
        <h2 class="text-lg font-semibold text-white">Daftar Produk</h2>
        <div class="flex items-center gap-2">
          <input
            type="search"
            placeholder="Cari nama / SKU / kategori..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            class="kasir-input w-56 text-sm"
          />
          <Show when={canEdit(props.userRole())}>
            <button class="btn-sm btn-indigo" onClick={props.onAdd}>
              + Tambah Produk
            </button>
          </Show>
        </div>
      </div>
      <div class="glass overflow-hidden">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Harga</th>
              <th>Stok</th>
              <th>Toko</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <For
              each={filtered()}
              fallback={
                <tr>
                  <td colspan="5">
                    <EmptyState
                      type="produk"
                      title="Belum ada produk"
                      description="Tambahkan produk ke toko kamu untuk mulai transaksi."
                      action={
                        canEdit(props.userRole())
                          ? { label: "+ Tambah Produk", onClick: props.onAdd }
                          : undefined
                      }
                    />
                  </td>
                </tr>
              }
            >
              {(p) => (
                <tr>
                  <td class="text-white font-medium">{p.nama}</td>
                  <td class="rupiah">{formatRupiah(p.harga)}</td>
                  <td>
                    <span
                      class={cn(
                        "font-semibold",
                        p.stok <= (p.stock_threshold ?? 5)
                          ? "text-amber-400"
                          : "text-zinc-300",
                      )}
                    >
                      {p.stok}
                    </span>
                    <Show when={p.stok <= (p.stock_threshold ?? 5)}>
                      <span class="ml-1 text-xs text-amber-500">⚠</span>
                    </Show>
                  </td>
                  <td class="text-xs text-zinc-500">
                    {props.getTokoNama(p.toko_id)}
                  </td>
                  <td>
                    <Show
                      when={canEdit(props.userRole())}
                      fallback={<span class="text-xs text-zinc-600">—</span>}
                    >
                      <div class="flex gap-2">
                        <button
                          class="btn-sm btn-indigo"
                          onClick={() => props.onQuickRestock(p)}
                        >
                          Restock
                        </button>
                        <button
                          class="btn-sm btn-ghost"
                          onClick={() => props.onEdit(p)}
                        >
                          Edit
                        </button>
                        <button
                          class="btn-sm btn-red"
                          onClick={() => props.onDelete(p.id, p.nama)}
                        >
                          Hapus
                        </button>
                      </div>
                    </Show>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
}
