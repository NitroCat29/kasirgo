import { Show, For } from "solid-js";
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
  return (
    <div class="fade-in">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold text-white">Daftar Toko</h2>
        <Show when={canEdit(props.userRole())}>
          <button class="btn-sm btn-indigo" onClick={props.onAdd}>
            + Tambah Toko
          </button>
        </Show>
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
              each={props.daftarToko()}
              fallback={
                <tr>
                  <td colspan="4">
                    <EmptyState
                      type="toko"
                      title="Belum ada toko"
                      description="Tambahkan toko pertama kamu untuk mulai mencatat transaksi."
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
