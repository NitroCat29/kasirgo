import { Show, For, createSignal } from "solid-js";
import { formatRupiah } from "../../../lib/format";
import type { Produk } from "../../../components/dashboard/types";

export interface BulkRestockModalProps {
  show: boolean;
  onClose: () => void;
  items: () => Produk[];
  onSubmit: (qtyMap: Record<string, number>) => Promise<void>;
}

export default function BulkRestockModal(props: BulkRestockModalProps) {
  const [qtyMap, setQtyMap] = createSignal<Record<string, number>>({});
  const [submitting, setSubmitting] = createSignal(false);
  let editMode = false;

  function initMap() {
    const map: Record<string, number> = {};
    for (const p of props.items()) {
      map[p.id] = 1;
    }
    setQtyMap(map);
  }

  function setQty(id: string, v: string) {
    const n = parseInt(v) || 0;
    setQtyMap((prev) => ({ ...prev, [id]: Math.max(0, n) }));
  }

  function totalItems(): number {
    return Object.values(qtyMap()).reduce((a, b) => a + b, 0);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (totalItems() === 0) return;
    setSubmitting(true);
    try {
      await props.onSubmit(qtyMap());
    } finally {
      setSubmitting(false);
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) props.onClose();
  }

  return (
    <Show when={props.show()}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"
        onClick={handleOverlayClick}
      >
        <div class="glass rounded-2xl border border-kasir-border w-full max-w-lg max-h-[80vh] flex flex-col">
          {/* Header */}
          <div class="flex items-center justify-between p-5 border-b border-white/5">
            <div>
              <h2 class="text-lg font-bold text-white">Restock Massal</h2>
              <p class="text-xs text-kasir-muted mt-1">
                {props.items().length} produk dipilih
              </p>
            </div>
            <button
              class="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-kasir-muted hover:text-white transition-colors"
              onClick={props.onClose}
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* List */}
          <form onSubmit={handleSubmit} class="flex flex-col flex-1 overflow-hidden">
            <div class="flex-1 overflow-y-auto p-5 space-y-3">
              <Show when={props.items().length === 0}>
                <p class="text-kasir-muted text-sm text-center py-8">Tidak ada produk dipilih</p>
              </Show>
              <For each={props.items()}>
                {(p) => {
                  const qty = () => qtyMap()[p.id] ?? 1;
                  return (
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-kasir-border">
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-white truncate">{p.nama}</p>
                        <p class="text-xs text-kasir-muted">
                          Stok saat ini: {p.stok ?? 0} · {formatRupiah(p.harga)}
                        </p>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-kasir-muted hover:text-white transition-colors text-lg font-bold"
                          onClick={() => setQty(p.id, String(qty() - 1))}
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputmode="numeric"
                          value={qty()}
                          onInput={(e) => setQty(p.id, e.currentTarget.value)}
                          class="w-16 text-center bg-white/5 border border-white/10 rounded-lg text-white text-sm font-semibold kasir-input"
                        />
                        <button
                          type="button"
                          class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-kasir-muted hover:text-white transition-colors text-lg font-bold"
                          onClick={() => setQty(p.id, String(qty() + 1))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>

            {/* Footer */}
            <div class="border-t border-white/5 p-5 flex items-center justify-between">
              <span class="text-sm text-kasir-muted">
                Total tambahan: <strong class="text-white font-bold">{totalItems().toLocaleString("id-ID")}</strong> item
              </span>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="btn-sm btn-ghost"
                  onClick={props.onClose}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting() || totalItems() === 0}
                  class="btn-sm bg-kasir-accent text-white font-semibold rounded-lg px-5 hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {submitting() ? "Memproses..." : `Restock ${totalItems()} item`}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}
