import { Show } from "solid-js";
import type { Toko } from "../../../components/dashboard/types";

export interface TokoModalProps {
  show: boolean;
  onClose: () => void;
  modalToko: () => Partial<Toko>;
  setModalToko: (v: Partial<Toko> | ((prev: Partial<Toko>) => Partial<Toko>)) => void;
  saveToko: (e: Event) => void;
  submitting: () => boolean;
}

export default function TokoModal(props: TokoModalProps) {
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
            {props.modalToko()?.id ? "Edit Toko" : "Tambah Toko"}
          </h3>
          <form onSubmit={props.saveToko} class="space-y-4">
            <div>
              <label class="text-xs font-medium text-zinc-400 mb-1 block">
                Nama Toko
              </label>
              <input
                class="glass-input"
                value={props.modalToko()?.nama || ""}
                onInput={(e) =>
                  props.setModalToko((prev) => ({
                    ...prev,
                    nama: e.currentTarget.value,
                  }))
                }
                placeholder="Nama toko"
                required
              />
            </div>
            <div>
              <label class="text-xs font-medium text-zinc-400 mb-1 block">
                Alamat
              </label>
              <input
                class="glass-input"
                value={props.modalToko()?.alamat || ""}
                onInput={(e) =>
                  props.setModalToko((prev) => ({
                    ...prev,
                    alamat: e.currentTarget.value,
                  }))
                }
                placeholder="Alamat toko"
              />
            </div>
            <div>
              <label class="text-xs font-medium text-zinc-400 mb-1 block">
                Telepon
              </label>
              <input
                class="glass-input"
                value={props.modalToko()?.telepon || ""}
                onInput={(e) =>
                  props.setModalToko((prev) => ({
                    ...prev,
                    telepon: e.currentTarget.value,
                  }))
                }
                placeholder="08xx-xxxx-xxxx"
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
