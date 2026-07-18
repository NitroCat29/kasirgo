import { For } from "solid-js";
import { EmptyState } from "../../../components/ui";
import { formatRupiah, formatWIB } from "../../../lib/format";
import type { Transaksi } from "../../../components/dashboard/types";

export interface TransaksiTabProps {
  daftarTransaksi: () => Transaksi[];
  getTokoNama: (id: string | undefined) => string;
  onAdd: () => void;
  onViewItems: (trxId: string) => void;
  onDelete: (id: string) => void;
}

export default function TransaksiTab(props: TransaksiTabProps) {
  return (
    <div class="fade-in">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold text-white">Riwayat Transaksi</h2>
        <button class="btn-sm btn-indigo" onClick={props.onAdd}>
          + Tambah Transaksi
        </button>
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
                  <td colspan="5">
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
                  <td>
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
