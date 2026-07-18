import { Show, For, createSignal } from "solid-js";
import { formatRupiah } from "../../../lib/format";
import type { Toko, Produk } from "../../../components/dashboard/types";

export interface ProdukModalProps {
  show: boolean;
  onClose: () => void;
  // Form state — harga/stok are strings during editing
  modalProduk: () => Partial<Produk & { qty: string; harga: string | number; stok: string | number; _skuEdited?: boolean }>;
  setModalProduk: (v: Partial<Produk & { qty: string; harga: string | number; stok: string | number; _skuEdited?: boolean }> | ((prev: Partial<Produk & { qty: string; harga: string | number; stok: string | number; _skuEdited?: boolean }>) => Partial<Produk & { qty: string; harga: string | number; stok: string | number; _skuEdited?: boolean }>)) => void;
  // Mode
  bulkMode: () => boolean;
  setBulkMode: (v: boolean) => void;
  bulkToml: () => string;
  setBulkToml: (v: string) => void;
  bulkSubmitting: () => boolean;
  produkMode: () => "new" | "restock";
  // Combobox
  produkSearchQuery: () => string;
  handleProdukNameInput: (e: Event) => void;
  produkSearchResults: () => (Produk & { toko_nama?: string })[];
  produkSearchLoading: () => boolean;
  produkComboboxOpen: () => boolean;
  selectProdukFromDropdown: (p: Produk & { toko_nama?: string }) => void;
  selectedExistingProduk: () => (Produk & { toko_nama?: string }) | null;
  // Data
  daftarToko: () => Toko[];
  // Suggestions
  merkList: () => string[];
  kategoriListAll: () => string[];
  satuanWhitelist: () => string[];
  // Actions
  saveProduk: (e: Event) => void;
  handleBulkImport: (e: SubmitEvent) => void;
  resetProdukCombobox: () => void;
  submitting: () => boolean;
}

export default function ProdukModal(props: ProdukModalProps) {
  function handleClose() {
    props.onClose();
    props.resetProdukCombobox();
    props.setBulkMode(false);
    props.setBulkToml("");
  }

  // Suggestion dropdown state per field
  const [showMerkSug, setShowMerkSug] = createSignal(false);
  const [showKatSug, setShowKatSug] = createSignal(false);
  const [showSatSug, setShowSatSug] = createSignal(false);

  function Suggester(props2: {
    open: () => boolean;
    items: () => string[];
    onPick: (v: string) => void;
    onClose: () => void;
  }) {
    return (
      <Show when={props2.open() && props2.items().length > 0}>
        <div class="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
          <For each={props2.items()}>
            {(v) => (
              <button
                type="button"
                class="w-full text-left px-3 py-2 text-sm text-white hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0"
                onClick={() => {
                  props2.onPick(v);
                  props2.onClose();
                }}
              >
                {v}
              </button>
            )}
          </For>
        </div>
      </Show>
    );
  }

  return (
    <Show when={props.show}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div class="modal-box">
          <h3 class="text-lg font-bold text-white mb-5">
            {props.bulkMode()
              ? "Bulk Import (TOML)"
              : props.produkMode() === "restock"
                ? "Restock Produk"
                : props.modalProduk()?.id
                  ? "Edit Produk"
                  : "Tambah Produk"}
          </h3>

          {/* Mode Switch */}
          <Show when={!props.modalProduk()?.id}>
            <div class="flex gap-2 mb-4">
              <button
                type="button"
                class={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                  !props.bulkMode()
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/50"
                    : "bg-white/5 text-zinc-400 border border-white/10"
                }`}
                onClick={() => props.setBulkMode(false)}
              >
                Single
              </button>
              <button
                type="button"
                class={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                  props.bulkMode()
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/50"
                    : "bg-white/5 text-zinc-400 border border-white/10"
                }`}
                onClick={() => props.setBulkMode(true)}
              >
                Bulk TOML
              </button>
            </div>
          </Show>

          {/* Bulk TOML mode */}
          <Show when={props.bulkMode()}>
            <form onSubmit={props.handleBulkImport} class="space-y-4">
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">
                  Data TOML
                </label>
                <textarea
                  class="glass-input font-mono text-xs"
                  rows={10}
                  value={props.bulkToml()}
                  onInput={(e) => props.setBulkToml(e.currentTarget.value)}
                  placeholder={`[[produk]]\nnama = "Bolpoin Pilot"\nmerk = "Pilot"\nkategori = "ATK"\nsatuan = "pcs"\nharga = "3000"\nharga_modal = "2000"\nstok = "50"\ntoko_id = "Toko Sinar"\n\n[[produk]]\nnama = "Kertas A4"\nkategori = "ATK"\nsatuan = "rim"\nharga = "45000"\nharga_modal = "38000"\nstok = "20"\ntoko_id = "Toko Sinar"`}
                  required
                />
                <p class="text-xs text-zinc-500 mt-1">
                  Format: [[produk]] — field wajib: <code>nama</code>. Opsional: toko_id (nama/UUID), sku (auto-generated), merk, kategori, satuan, harga, harga_modal, stok, stock_threshold.
                </p>
              </div>
              <div class="flex gap-3 pt-2">
                <button
                  type="button"
                  class="btn-sm btn-ghost flex-1"
                  onClick={handleClose}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  class="btn-sm btn-indigo flex-1"
                  disabled={props.bulkSubmitting()}
                >
                  {props.bulkSubmitting() ? "Mengimpor..." : "Import"}
                </button>
              </div>
            </form>
          </Show>

          {/* Single / Restock mode */}
          <Show when={!props.bulkMode()}>
            <form onSubmit={props.saveProduk} class="space-y-4">
              {/* Combobox: search existing produk for restock */}
              <Show when={props.produkMode() === "restock" && props.selectedExistingProduk()}>
                <div class="glass p-3 rounded-lg border border-emerald-500/30 mb-2">
                  <p class="text-sm text-emerald-300 font-medium">
                    Restock: {props.selectedExistingProduk()!.nama}
                  </p>
                  <p class="text-xs text-zinc-500">
                    Stok saat ini: {props.selectedExistingProduk()!.stok} | Harga:{" "}
                    {formatRupiah(props.selectedExistingProduk()!.harga)}
                    {props.selectedExistingProduk()!.harga_modal
                      ? ` | Modal: ${formatRupiah(props.selectedExistingProduk()!.harga_modal!)}/pcs`
                      : ""}
                  </p>
                </div>
              </Show>

              {/* Nama produk with combobox */}
              <div class="relative">
                <label class="text-xs font-medium text-zinc-400 mb-1 block">
                  Nama Produk
                </label>
                <input
                  class="glass-input w-full"
                  value={props.modalProduk()?.nama || ""}
                  onInput={props.handleProdukNameInput}
                  placeholder="Ketik nama produk untuk cari atau tambah baru..."
                  required
                />
                <Show when={props.produkComboboxOpen() && props.produkSearchResults().length > 0}>
                  <div class="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    <For each={props.produkSearchResults()}>
                      {(p) => (
                        <button
                          type="button"
                          class="w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0"
                          onClick={() => props.selectProdukFromDropdown(p)}
                        >
                          <div class="text-sm text-white font-medium">
                            {p.nama}
                          </div>
                          <div class="text-xs text-zinc-500">
                            SKU: {p.sku} | Stok: {p.stok} | Harga:{" "}
                            {formatRupiah(p.harga)}
                            {p.toko_nama && ` | ${p.toko_nama}`}
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={props.produkSearchLoading()}>
                  <p class="text-xs text-zinc-500 mt-1">Mencari...</p>
                </Show>
              </div>

              {/* SKU — hidden in restock mode */}
              <Show when={props.produkMode() === "new"}>
                <div>
                  <label class="text-xs font-medium text-zinc-400 mb-1 block">
                    SKU <span class="text-zinc-600">(otomatis dari nama)</span>
                  </label>
                  <input
                    class="glass-input"
                    value={props.modalProduk()?.sku || ""}
                    onInput={(e) =>
                      props.setModalProduk((prev) => ({
                        ...prev,
                        sku: e.currentTarget.value,
                        _skuEdited: true,
                      }))
                    }
                    placeholder="PRD-XXXXX-00001"
                  />
                  <Show when={props.modalProduk()?.sku && !props.modalProduk()?._skuEdited}>
                    <p class="text-[11px] text-zinc-500 mt-1">
                      Auto — 5 digit nomor ditambahkan otomatis saat simpan.
                    </p>
                  </Show>
                </div>
              </Show>

              {/* Harga — hidden in restock mode */}
              <Show when={props.produkMode() === "new"}>
                <div>
                  <label class="text-xs font-medium text-zinc-400 mb-1 block">
                    Harga (Rp)
                  </label>
                  <input
                    type="text"
                    inputmode="numeric"
                    class="glass-input"
                    value={props.modalProduk()?.harga || ""}
                    onInput={(e) => {
                      const raw = e.currentTarget.value.replace(/[^0-9]/g, "");
                      props.setModalProduk((prev: any) => ({
                        ...prev,
                        harga: raw,
                      }));
                    }}
                    placeholder="10000"
                    required
                  />
                </div>
              </Show>

              {/* Harga Modal — visible in new mode for wallet deduction */}
              <Show when={props.produkMode() === "new"}>
                <div>
                  <label class="text-xs font-medium text-zinc-400 mb-1 block">
                    Harga Modal / Beli (Rp)
                  </label>
                  <input
                    type="text"
                    inputmode="numeric"
                    class="glass-input"
                    value={props.modalProduk()?.harga_modal ?? ""}
                    onInput={(e) => {
                      const raw = e.currentTarget.value.replace(/[^0-9]/g, "");
                      props.setModalProduk((prev: any) => ({
                        ...prev,
                        harga_modal: raw ? Number(raw) : 0,
                      }));
                    }}
                    placeholder="0 (opsional — untuk potong saldo)"
                  />
                  <p class="text-[11px] text-zinc-500 mt-1">
                    Jika diisi &amp; stok &gt; 0, saldo wallet akan dipotong otomatis.
                  </p>
                </div>
              </Show>

              {/* Merk, Kategori, Satuan — hidden in restock mode */}
              <Show when={props.produkMode() === "new"}>
                <div class="grid grid-cols-3 gap-3">
                  <div class="relative">
                    <label class="text-xs font-medium text-zinc-400 mb-1 block">
                      Merk
                    </label>
                    <input
                      class="glass-input"
                      value={props.modalProduk()?.merk || ""}
                      onFocus={() => setShowMerkSug(true)}
                      onBlur={() => setTimeout(() => setShowMerkSug(false), 150)}
                      onInput={(e) =>
                        props.setModalProduk((prev: any) => ({
                          ...prev,
                          merk: e.currentTarget.value,
                        }))
                      }
                      placeholder="Pilot, BIC, dll"
                    />
                    <Suggester
                      open={showMerkSug}
                      items={props.merkList}
                      onPick={(v) => props.setModalProduk((prev: any) => ({ ...prev, merk: v }))}
                      onClose={() => setShowMerkSug(false)}
                    />
                  </div>
                  <div class="relative">
                    <label class="text-xs font-medium text-zinc-400 mb-1 block">
                      Kategori
                    </label>
                    <input
                      class="glass-input"
                      value={props.modalProduk()?.kategori || ""}
                      onFocus={() => setShowKatSug(true)}
                      onBlur={() => setTimeout(() => setShowKatSug(false), 150)}
                      onInput={(e) =>
                        props.setModalProduk((prev: any) => ({
                          ...prev,
                          kategori: e.currentTarget.value,
                        }))
                      }
                      placeholder="ATK, Minuman..."
                    />
                    <Suggester
                      open={showKatSug}
                      items={props.kategoriListAll}
                      onPick={(v) => props.setModalProduk((prev: any) => ({ ...prev, kategori: v }))}
                      onClose={() => setShowKatSug(false)}
                    />
                  </div>
                  <div class="relative">
                    <label class="text-xs font-medium text-zinc-400 mb-1 block">
                      Satuan
                    </label>
                    <input
                      class="glass-input"
                      value={props.modalProduk()?.satuan || ""}
                      onFocus={() => setShowSatSug(true)}
                      onBlur={() => setTimeout(() => setShowSatSug(false), 150)}
                      onInput={(e) =>
                        props.setModalProduk((prev: any) => ({
                          ...prev,
                          satuan: e.currentTarget.value,
                        }))
                      }
                      placeholder="Pcs, Pack, Rim, Ikat"
                    />
                    <Suggester
                      open={showSatSug}
                      items={() => props.satuanWhitelist()}
                      onPick={(v) => props.setModalProduk((prev: any) => ({ ...prev, satuan: v }))}
                      onClose={() => setShowSatSug(false)}
                    />
                  </div>
                </div>
              </Show>

              {/* Stok / Qty */}
              <div>
                <label class="text-xs font-medium text-zinc-400 mb-1 block">
                  {props.produkMode() === "restock"
                    ? "Jumlah Tambah"
                    : "Stok Awal"}
                </label>
                <input
                  type="text"
                  inputmode="numeric"
                  class="glass-input"
                  value={props.modalProduk()?.stok || ""}
                  onInput={(e) => {
                    const raw = e.currentTarget.value.replace(/[^0-9]/g, "");
                    props.setModalProduk((prev: any) => ({
                      ...prev,
                      stok: raw,
                    }));
                  }}
                  placeholder={props.produkMode() === "restock" ? "Jumlah tambah" : "0"}
                  required
                />
              </div>

              {/* Toko — hidden in restock mode */}
              <Show when={props.produkMode() === "new"}>
                <div>
                  <label class="text-xs font-medium text-zinc-400 mb-1 block">
                    Toko <span class="text-zinc-600">(opsional)</span>
                  </label>
                  <select
                    class="glass-input"
                    value={props.modalProduk()?.toko_id || ""}
                    onChange={(e) =>
                      props.setModalProduk((prev) => ({
                        ...prev,
                        toko_id: e.currentTarget.value,
                      }))
                    }
                  >
                    <option value="">Pilih toko</option>
                    <For each={props.daftarToko()}>
                      {(t) => <option value={t.id}>{t.nama}</option>}
                    </For>
                  </select>
                </div>
              </Show>

              {/* Stock threshold — hidden in restock mode */}
              <Show when={props.produkMode() === "new"}>
                <div>
                  <label class="text-xs font-medium text-zinc-400 mb-1 block">
                    Batas Stok Minimum
                  </label>
                  <input
                    type="text"
                    inputmode="numeric"
                    class="glass-input"
                    value={props.modalProduk()?.stock_threshold ?? ""}
                    onInput={(e) => {
                      const raw = e.currentTarget.value.replace(/[^0-9]/g, "");
                      props.setModalProduk((prev) => ({
                        ...prev,
                        stock_threshold: raw ? Number(raw) : undefined,
                      }));
                    }}
                    placeholder="5"
                  />
                </div>
              </Show>

              <div class="flex gap-3 pt-2">
                <button
                  type="button"
                  class="btn-sm btn-ghost flex-1"
                  onClick={handleClose}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  class="btn-sm btn-indigo flex-1"
                  disabled={props.submitting()}
                >
                  {props.submitting()
                    ? "Menyimpan..."
                    : props.produkMode() === "restock"
                      ? "Restock"
                      : "Simpan"}
                </button>
              </div>
            </form>
          </Show>
        </div>
      </div>
    </Show>
  );
}
