import { Show } from "solid-js";
import type { UserRow } from "../../../components/dashboard/types";

export interface UserModalProps {
  show: boolean;
  onClose: () => void;
  modalUser: () => Partial<UserRow & { password?: string }>;
  setModalUser: (v: Partial<UserRow & { password?: string }> | ((prev: Partial<UserRow & { password?: string }>) => Partial<UserRow & { password?: string }>)) => void;
  saveUser: (e: Event) => void;
  submitting: () => boolean;
}

export default function UserModal(props: UserModalProps) {
  return (
    <Show when={props.show}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="modal-box">
          <h3 class="text-lg font-bold text-white mb-5">
            {props.modalUser()?.id ? "Edit User" : "Tambah User"}
          </h3>
          <form onSubmit={props.saveUser} class="space-y-4">
            <div>
              <label class="text-xs font-medium text-zinc-400 mb-1 block">
                Username
              </label>
              <input
                class="glass-input"
                value={props.modalUser()?.username || ""}
                onInput={(e) =>
                  props.setModalUser((prev) => ({
                    ...prev,
                    username: e.currentTarget.value,
                  }))
                }
                placeholder="username"
                required
                disabled={!!props.modalUser()?.id}
              />
              <Show when={props.modalUser()?.id}>
                <p class="text-xs text-zinc-600 mt-1">
                  Username tidak bisa diubah
                </p>
              </Show>
            </div>
            <div>
              <label class="text-xs font-medium text-zinc-400 mb-1 block">
                Nama Lengkap
              </label>
              <input
                class="glass-input"
                value={props.modalUser()?.nama || ""}
                onInput={(e) =>
                  props.setModalUser((prev) => ({
                    ...prev,
                    nama: e.currentTarget.value,
                  }))
                }
                placeholder="Nama lengkap"
                required
              />
            </div>
            <div>
              <label class="text-xs font-medium text-zinc-400 mb-1 block">
                Role
              </label>
              <select
                class="glass-input"
                value={props.modalUser()?.role || "kasir"}
                onChange={(e) =>
                  props.setModalUser((prev) => ({
                    ...prev,
                    role: e.currentTarget.value,
                  }))
                }
                required
              >
                <option value="kasir">kasir</option>
                <option value="manajer">manajer</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-medium text-zinc-400 mb-1 block">
                Password{" "}
                {props.modalUser()?.id ? "(kosongkan jika tidak ganti)" : ""}
              </label>
              <input
                class="glass-input"
                type="password"
                value={props.modalUser()?.password || ""}
                onInput={(e) =>
                  props.setModalUser((prev) => ({
                    ...prev,
                    password: e.currentTarget.value,
                  }))
                }
                placeholder={
                  props.modalUser()?.id
                    ? "•••••• (opsional)"
                    : "Minimal 6 karakter"
                }
              />
            </div>
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
