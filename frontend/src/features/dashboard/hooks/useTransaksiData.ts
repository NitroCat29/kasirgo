import { createSignal } from "solid-js";
import { api } from "../../../lib/api";
import { formatRupiah } from "../../../lib/format";
import {
  swalConfirm,
  swalApiError,
  swalToast,
  swalWarning,
} from "../../../lib/swal";
import type { Transaksi, TrxItem } from "../../../components/dashboard/types";
import type { ToastLoadError } from "./loadError";

export interface TransaksiDataDeps {
  toastLoadError: ToastLoadError;
  setSubmitting: (v: boolean | ((p: boolean) => boolean)) => void;
  loadStats: () => Promise<void>;
  loadDailyRevenue?: () => Promise<void>;
}

export function useTransaksiData(deps: TransaksiDataDeps) {
  const [daftarTransaksi, setDaftarTransaksi] = createSignal<Transaksi[]>([]);
  const [showTrxModal, setShowTrxModal] = createSignal(false);
  const [modalTrx, setModalTrx] = createSignal<Partial<Transaksi>>({});
  const [trxItems, setTrxItems] = createSignal<TrxItem[]>([]);
  const [trxSearchQuery, setTrxSearchQuery] = createSignal("");
  const [trxTotalCount, setTrxTotalCount] = createSignal(0);

  async function loadTransaksi(search?: string) {
    try {
      const q = search ?? trxSearchQuery();
      const url = q ? `/api/transaksi?q=${encodeURIComponent(q)}` : "/api/transaksi";
      const data = await api<{ rows: Transaksi[]; total: number }>(url);
      setDaftarTransaksi(data.rows);
      setTrxTotalCount(data.total);
    } catch (err) {
      deps.toastLoadError("transaksi", err);
    }
  }

  async function loadTrxItems(trxId: string) {
    try {
      const data = await api<TrxItem[]>(`/api/transaksi/${trxId}/items`);
      setTrxItems(data);
      setShowTrxModal(true);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  async function hapusTransaksi(id: string) {
    const ok = await swalConfirm(
      "Hapus transaksi?",
      "Transaksi akan dihapus permanen.",
    );
    if (!ok) return;
    try {
      await api<unknown>(`/api/transaksi/${id}`, { method: "DELETE" });
      swalToast("success", "Transaksi dihapus");
      await Promise.all([loadTransaksi(), deps.loadStats()]);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  // --- Create form ---
  const [trxForm, setTrxForm] = createSignal<{
    toko_id: string;
    items: TrxItem[];
  }>({ toko_id: "", items: [] });
  const [trxItemForm, setTrxItemForm] = createSignal<{
    nama: string;
    harga: string;
    qty: string;
  }>({ nama: "", harga: "", qty: "1" });

  function openTrxModal() {
    setTrxForm({ toko_id: "", items: [] });
    setTrxItemForm({ nama: "", harga: "", qty: "1" });
    setShowTrxModal(true);
  }

  function addTrxItem(e: Event) {
    e.preventDefault();
    const f = trxItemForm();
    const harga = Number(f.harga) || 0;
    const qty = Number(f.qty) || 1;
    if (!f.nama.trim() || harga <= 0) {
      swalWarning("Nama & harga wajib diisi");
      return;
    }
    setTrxForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { id: crypto.randomUUID(), nama: f.nama.trim(), harga, qty },
      ],
    }));
    setTrxItemForm({ nama: "", harga: "", qty: "1" });
  }

  function removeTrxItem(idx: number) {
    setTrxForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  }

  function trxFormSubtotal(): number {
    return trxForm().items.reduce((s, i) => s + i.harga * i.qty, 0);
  }

  function trxFormTotal(): number {
    return Math.round(trxFormSubtotal() * 1.11);
  }

  async function saveTrx(e: Event) {
    e.preventDefault();
    const f = trxForm();
    if (!f.toko_id) {
      swalWarning("Pilih toko");
      return;
    }
    if (f.items.length === 0) {
      swalWarning("Tambahkan minimal 1 item");
      return;
    }
    deps.setSubmitting(true);
    try {
      await api<unknown>("/api/transaksi", {
        method: "POST",
        body: JSON.stringify({
          toko_id: f.toko_id,
          total: trxFormTotal(),
          tax_rate: 11,
          discount_rate: 0,
          items: f.items,
        }),
      });
      setShowTrxModal(false);
      swalToast("success", `Transaksi ${formatRupiah(trxFormTotal())} dicatat`);
      await Promise.all([
        loadTransaksi(),
        deps.loadStats(),
        deps.loadDailyRevenue?.() ?? Promise.resolve(),
      ]);
    } catch (err: any) {
      swalApiError(err);
    } finally {
      deps.setSubmitting(false);
    }
  }

  function trxSubtotal(): number {
    return trxItems().reduce((sum, item) => sum + item.harga * item.qty, 0);
  }

  function trxTotal(): number {
    return Math.round(trxSubtotal() * 1.11);
  }

  return {
    daftarTransaksi,
    showTrxModal,
    setShowTrxModal,
    modalTrx,
    setModalTrx,
    trxItems,
    trxForm,
    setTrxForm,
    trxItemForm,
    setTrxItemForm,
    trxSearchQuery,
    setTrxSearchQuery,
    trxTotalCount,
    loadTransaksi,
    loadTrxItems,
    hapusTransaksi,
    openTrxModal,
    addTrxItem,
    removeTrxItem,
    saveTrx,
    trxFormSubtotal,
    trxFormTotal,
    trxSubtotal,
    trxTotal,
  };
}
