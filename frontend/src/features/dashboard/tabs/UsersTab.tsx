import { Show, For } from "solid-js";
import { EmptyState } from "../../../components/ui";
import { canEdit } from "../../../components/dashboard/types";
import type { UserRow } from "../../../components/dashboard/types";

export interface UsersTabProps {
  daftarUsers: () => UserRow[];
  userRole: () => string | undefined;
  onAdd: () => void;
  onEdit: (u: UserRow) => void;
  onDelete: (id: string, nama: string) => void;
}

export default function UsersTab(props: UsersTabProps) {
  return (
    <div class="fade-in">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold text-white">Daftar User</h2>
        <button class="btn-sm btn-indigo" onClick={props.onAdd}>
          + Tambah User
        </button>
      </div>
      <div class="glass overflow-hidden">
        <table class="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Nama</th>
              <th>Role</th>
              <th>Dibuat</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <For
              each={props.daftarUsers()}
              fallback={
                <tr>
                  <td colspan="5">
                    <EmptyState
                      type="users"
                      title="Belum ada user"
                      description="Tambahkan user (kasir/manajer) untuk mengelola akses dashboard."
                      action={
                        canEdit(props.userRole())
                          ? { label: "+ Tambah User", onClick: props.onAdd }
                          : undefined
                      }
                    />
                  </td>
                </tr>
              }
            >
              {(u) => (
                <tr>
                  <td class="font-mono text-xs">{u.username}</td>
                  <td class="text-white font-medium">{u.nama}</td>
                  <td>
                    <span class="px-2 py-0.5 rounded-full text-xs bg-kasir-accent/20 text-kasir-accent">
                      {u.role}
                    </span>
                  </td>
                  <td class="text-xs text-zinc-500">
                    {new Date(u.created_at).toLocaleDateString("id-ID")}
                  </td>
                  <td>
                    <div class="flex gap-2">
                      <button
                        class="btn-sm btn-ghost"
                        onClick={() => props.onEdit(u)}
                      >
                        Edit
                      </button>
                      <button
                        class="btn-sm btn-red"
                        onClick={() => props.onDelete(u.id, u.nama)}
                      >
                        Hapus
                      </button>
                    </div>
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
