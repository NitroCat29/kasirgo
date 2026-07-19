import { Show, For } from "solid-js";
import { createMemo, createSignal } from "solid-js";
import { EmptyState } from "../../../components/ui";
import { canEdit } from "../../../components/dashboard/types";
import type { Toko } from "../../../components/dashboard/types";

export interface TokoTabProps {
  daftarToko: () => Toko[];
  userRole: () => string | undefined;
  onAdd: () => void;
  onEdit: (t: Toko) => void;
  onDelete: (id: string, nama: string) => void;
}

export default function TokoTab(props: TokoTabProps) {
  const [search, setSearch] = createSignal("");
  const filtered = createMemo<Toko[]>(() => {
    const q = search().toLowerCase().trim();
    if (!q) return props.daftarToko();
    return props.daftarToko().filter(
      (t) => t.nama.toLowerCase().includes(q) || (t.alamat || "").toLowerCase().includes(q),
    );
  });

  return (
    <div class="fade-in">
      <div class="flex flex-wrap gap-3 justify-between items-center mb-4">
        <h2 class="text-lg font-semibold text-white">Daftar Toko</h2>
        <div class="flex items-center gap-2">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kasir-muted pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="search"
              placeholder="Cari toko..."
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              class="kasir-input w-48 text-sm pl-9"
            />
          </div>
          <Show when={canEdit(props.userRole())}>
            <button class="btn-sm btn-indigo" onClick={props.onAdd}>
              + Tambah Toko
            </button>
          </Show>
        </div>
      </div>
      <div class="glass overflow-hidden">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Alamat</th>
              <th>Telepon</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <For
              each={filtered()}
              fallback={
                <tr>
                  <td colspan="4">
                    <EmptyState
                      type="toko"
                      title="Belum ada toko"
                      description={search() ? `Tidak ada toko cocok dengan "${search()}"` : "Tambahkan toko pertama kamu untuk mulai mencatat transaksi."}
                      action={
                        canEdit(props.userRole())
                          ? { label: "+ Tambah Toko", onClick: props.onAdd }
                          : undefined
                      }
                    />
                  </td>
                </tr>
              }
            >
              {(t) => (
                <tr>
                  <td class="text-white font-medium">{t.nama}</td>
                  <td>{t.alamat || "—"}</td>
                  <td class="font-mono text-xs">{t.telepon || "—"}</td>
                  <td>
                    <Show
                      when={canEdit(props.userRole())}
                      fallback={<span class="text-xs text-zinc-600">—</span>}
                    >
                      <div class="flex gap-2">
                        <button
                          class="btn-sm btn-ghost"
                          onClick={() => props.onEdit(t)}
                        >
                          Edit
                        </button>
                        <button
                          class="btn-sm btn-red"
                          onClick={() => props.onDelete(t.id, t.nama)}
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
