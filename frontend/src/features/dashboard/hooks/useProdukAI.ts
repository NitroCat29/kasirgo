// ============================================================
// useProdukAI — foto produk → vision auto-input + baca barcode
// ============================================================
// Dipakai Dashboard (dan Kasir kalau perlu). Konfigurasi endpoint diambil
// dari backend (/api/ai/settings). Kalau AI belum aktif, tombol dinonaktifkan.
//
// Kamera & upload file: semua atas inisiatif user (klik tombol) — tidak ada
// akses media otomatis saat mount (izin selalu diminta browser saat klik).

import { createSignal } from "solid-js";
import { api } from "../../../lib/api";
import type { Produk } from "../../../components/dashboard/types";

type ModalProduk = Partial<Produk & { qty: string; harga: string | number; stok: string | number; barcode?: string }>;

export function useProdukAI(deps: {
  modalProduk: () => ModalProduk;
  setModalProduk: (v: any) => void;
  satuanWhitelist: () => string[];
}) {
  const [aiEnabled, setAiEnabled] = createSignal(false);
  const [aiBusy, setAiBusy] = createSignal(false);
  const [aiMsg, setAiMsg] = createSignal<{ type: "ok" | "err"; text: string } | null>(null);
  const [cameraMode, setCameraMode] = createSignal<"foto" | "barcode" | null>(null);

  // Cek sekali saat hook dibuat (bukan di onMount → tidak butuh efek mount)
  (async () => {
    try {
      const s = await api<{ enabled: boolean }>("/api/ai/settings");
      setAiEnabled(!!s.enabled);
    } catch {
      setAiEnabled(false);
    }
  })();

  function pickImage(cb: (dataUrl: string) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => cb(String(r.result));
      r.readAsDataURL(f);
    };
    input.click();
  }

  /** Kirim gambar → backend → AI vision → isi field produk. */
  async function recognize(dataUrl: string) {
    if (!aiEnabled()) return;
    setAiBusy(true);
    setAiMsg(null);
    try {
      const res = await api<Partial<Produk>>("/api/ai/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      deps.setModalProduk((prev: ModalProduk) => {
        const next: ModalProduk = { ...prev };
        if (res.nama) next.nama = String(res.nama);
        if (res.kategori) next.kategori = String(res.kategori);
        if (res.merk) next.merk = String(res.merk);
        if (res.satuan) next.satuan = String(res.satuan);
        return next;
      });
      setAiMsg({ type: "ok", text: `Terisi: ${res.nama || "?"} (${res.kategori || "-"})` });
    } catch (e: any) {
      setAiMsg({ type: "err", text: e?.message || "Gagal menganalisis foto" });
    } finally {
      setAiBusy(false);
    }
  }

  /** Kirim gambar barcode → backend → AI → isi field barcode. */
  async function readBarcode(dataUrl: string) {
    if (!aiEnabled()) return;
    setAiBusy(true);
    setAiMsg(null);
    try {
      const res = await api<{ barcode: string }>("/api/ai/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (res.barcode) {
        deps.setModalProduk((prev: ModalProduk) => ({ ...prev, barcode: res.barcode }));
        setAiMsg({ type: "ok", text: `Barcode: ${res.barcode}` });
      } else {
        setAiMsg({ type: "err", text: "Barcode tidak terbaca. Coba foto lebih dekat / lebih terang." });
      }
    } catch (e: any) {
      setAiMsg({ type: "err", text: e?.message || "Gagal membaca barcode" });
    } finally {
      setAiBusy(false);
    }
  }

  function onBarcodeInput(v: string) {
    deps.setModalProduk((prev: ModalProduk) => ({ ...prev, barcode: v }));
  }

  return {
    aiEnabled,
    aiBusy,
    aiMsg,
    cameraMode,
    // Aksi (dipasang sebagai props ProdukModal)
    onPickFotoAI: () => pickImage(recognize),
    onPickBarcodeFoto: () => pickImage(readBarcode),
    onOpenCamera: (mode: "foto" | "barcode") => setCameraMode(mode),
    onCloseCamera: () => setCameraMode(null),
    onBarcodeInput,
    onFotoProduk: (d: string) => { setCameraMode(null); recognize(d); },
    onScanBarcodeFromCamera: (d: string) => { setCameraMode(null); readBarcode(d); },
  };
}
