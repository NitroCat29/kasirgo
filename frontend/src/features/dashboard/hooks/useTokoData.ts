import { createSignal } from "solid-js";
import { api } from "../../../lib/api";
import {
  swalConfirm,
  swalApiError,
  swalToast,
  swalWarning,
} from "../../../lib/swal";
import type { Toko } from "../../../components/dashboard/types";
import type { ToastLoadError } from "./loadError";

export interface TokoDataDeps {
  toastLoadError: ToastLoadError;
  setSubmitting: (v: boolean | ((p: boolean) => boolean)) => void;
  loadStats: () => Promise<void>;
  /** Sync produk toko filter when toko list changes */
  onTokoListLoaded?: (data: Toko[]) => void;
}

export function useTokoData(deps: TokoDataDeps) {
  const [daftarToko, setDaftarToko] = createSignal<Toko[]>([]);
  const [showTokoModal, setShowTokoModal] = createSignal(false);
  const [modalToko, setModalToko] = createSignal<Partial<Toko>>({});

  async function loadToko() {
    try {
      const data = await api<Toko[]>("/api/toko");
      setDaftarToko(data);
      deps.onTokoListLoaded?.(data);
    } catch (err) {
      deps.toastLoadError("toko", err);
    }
  }

  function editToko(t: Toko) {
    setModalToko({ ...t });
    setShowTokoModal(true);
  }

  async function saveToko(e: Event) {
    e.preventDefault();
    const m = modalToko();
    if (!m.nama || !m.nama.trim()) {
      swalWarning("Nama wajib diisi");
      return;
    }
    deps.setSubmitting(true);
    const method = m.id ? "PATCH" : "POST";
    const url = m.id ? `/api/toko/${m.id}` : "/api/toko";
    try {
      await api<unknown>(url, {
        method,
        body: JSON.stringify({
          nama: m.nama,
          alamat: m.alamat,
          telepon: m.telepon,
        }),
      });
      setShowTokoModal(false);
      swalToast("success", m.id ? "Toko diperbarui" : "Toko ditambahkan");
      await Promise.all([loadToko(), deps.loadStats()]);
    } catch (err: any) {
      swalApiError(err);
    } finally {
      deps.setSubmitting(false);
    }
  }

  async function hapusToko(id: string, nama: string) {
    const ok = await swalConfirm(
      "Hapus toko?",
      `Toko "${nama}" akan dihapus beserta produk & transaksi terkait.`,
    );
    if (!ok) return;
    try {
      await api<unknown>(`/api/toko/${id}`, { method: "DELETE" });
      swalToast("success", "Toko dihapus");
      await Promise.all([loadToko(), deps.loadStats()]);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  return {
    daftarToko,
    showTokoModal,
    setShowTokoModal,
    modalToko,
    setModalToko,
    loadToko,
    editToko,
    saveToko,
    hapusToko,
  };
}
