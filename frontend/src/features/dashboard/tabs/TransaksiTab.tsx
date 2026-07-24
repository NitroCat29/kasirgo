import { For, Show } from "solid-js";
import { EmptyState } from "../../../components/ui";
import { formatRupiah, formatWIB } from "../../../lib/format";
import type { Transaksi } from "../../../components/dashboard/types";

export interface TransaksiTabProps {
  daftarTransaksi: () => Transaksi[];
  getTokoNama: (id: string | undefined) => string;
  onAdd: () => void;
  onViewItems: (trxId: string) => void;
  onDelete: (id: string) => void;
  onReprint: (trx: Transaksi) => void;
  searchQuery: () => string;
  setSearchQuery: (v: string) => void;
  onSearch: (q: string) => void;
  totalCount: () => number;
}

export default function TransaksiTab(props: TransaksiTabProps) {
  return (
    <div class="fade-in">
      <div class="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <h2 class="text-lg font-semibold text-white">Riwayat Transaksi</h2>
        <div class="flex gap-2 items-center">
          <input
            class="glass-input"
            style="width: 200px; padding: 6px 12px; font-size: 13px;"
            type="text"
            placeholder="Cari ID transaksi..."
            value={props.searchQuery()}
            onInput={(e) => {
              props.setSearchQuery(e.currentTarget.value);
              props.onSearch(e.currentTarget.value);
            }}
          />
          <Show when={props.totalCount() > 0}>
            <span class="text-xs text-zinc-500">{props.totalCount()} trx</span>
          </Show>
          <button class="btn-sm btn-indigo" onClick={props.onAdd}>
            + Tambah Transaksi
          </button>
        </div>
      </div>
      <div class="glass overflow-hidden">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Toko</th>
              <th>Total</th>
              <th>Items</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <For
              each={props.daftarTransaksi()}
              fallback={
                <tr>
                  <td colspan="6">
                    <EmptyState
                      type="transaksi"
                      title="Belum ada transaksi"
                      description="Transaksi yang kamu buat akan muncul di sini."
                    />
                  </td>
                </tr>
              }
            >
              {(trx) => (
                <tr>
                  <td class="font-mono text-xs">
                    {formatWIB(trx.created_at)}
                  </td>
                  <td class="text-xs">{props.getTokoNama(trx.toko_id)}</td>
                  <td class="rupiah">{formatRupiah(trx.total)}</td>
                  <td>
                    <button
                      class="text-xs text-kasir-accent hover:underline"
                      onClick={() => props.onViewItems(trx.id)}
                    >
                      Lihat
                    </button>
                  </td>
                  <td class="flex gap-1">
                    <button
                      class="btn-sm btn-ghost"
                      title="Cetak ulang nota"
                      onClick={() => props.onReprint(trx)}
                    >
                      🖨️
                    </button>
                    <button
                      class="btn-sm btn-red"
                      onClick={() => props.onDelete(trx.id)}
                    >
                      Hapus
                    </button>
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
