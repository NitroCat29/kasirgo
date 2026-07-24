import { createSignal, createMemo } from "solid-js";
import { api } from "../../../lib/api";
import {
  swalConfirm,
  swalApiError,
  swalToast,
  swalWarning,
} from "../../../lib/swal";
import type { Produk, Toko } from "../../../components/dashboard/types";
import type { ToastLoadError } from "./loadError";

export interface ProdukDataDeps {
  toastLoadError: ToastLoadError;
  setSubmitting: (v: boolean | ((p: boolean) => boolean)) => void;
  loadStats: () => Promise<void>;
  loadAlerts: () => Promise<void>;
  daftarToko: () => Toko[];
  setWalletRefresh: (v: number | ((n: number) => number)) => void;
}

export function useProdukData(deps: ProdukDataDeps) {
// --- Produk ---
const [daftarProduk, setDaftarProduk] = createSignal<Produk[]>([]);
const [showProdukModal, setShowProdukModal] = createSignal(false);
const [modalProduk, setModalProduk] = createSignal<Partial<Produk & { qty: string; harga: string | number; stok: string | number; _skuEdited?: boolean }>>({});
const [bulkMode, setBulkMode] = createSignal(false);
const [bulkToml, setBulkToml] = createSignal("");
const [produkSearchQuery, setProdukSearchQuery] = createSignal("");
const [produkSearchResults, setProdukSearchResults] = createSignal<(Produk & { toko_nama?: string })[]>([]);
const [produkSearchLoading, setProdukSearchLoading] = createSignal(false);
const [produkComboboxOpen, setProdukComboboxOpen] = createSignal(false);
const [selectedExistingProduk, setSelectedExistingProduk] = createSignal<(Produk & { toko_nama?: string }) | null>(null);
let produkSearchTimer: ReturnType<typeof setTimeout> | undefined;
let produkSearchRequest = 0;

// Unique suggestion lists (merk/kategori/satuan) from existing produk
function uniq(values: (string | undefined | null)[]): string[] {
  const s = new Set<string>();
  values.forEach((v) => {
    if (v && String(v).trim()) s.add(String(v).trim());
  });
  return Array.from(s).sort();
}
const merkList = createMemo<string[]>(() => uniq(daftarProduk().map((p) => p.merk)));
const kategoriListAll = createMemo<string[]>(() => uniq(daftarProduk().map((p) => p.kategori)));
const satuanListAll = createMemo<string[]>(() => uniq(daftarProduk().map((p) => p.satuan)));
// Fixed satuan whitelist for TOML + single (case-insensitive accept, canonical store)
const SATUAN_WHITELIST = ["Pcs", "Pack", "Rim", "Ikat"];
const SATUAN_LOWER = SATUAN_WHITELIST.map((s) => s.toLowerCase());
function normalizeSatuan(v?: string): string {
  if (!v) return "";
  const i = SATUAN_LOWER.indexOf(v.trim().toLowerCase());
  return i === -1 ? v.trim() : SATUAN_WHITELIST[i];
}
function isSatuanValid(v?: string): boolean {
  if (!v) return true; // kosong = opsional
  return SATUAN_LOWER.includes(v.trim().toLowerCase());
}

// Quick restock popover state
const [bulkSubmitting, setBulkSubmitting] = createSignal(false);

// --- Multi-select ---
const [selectedProdukIds, setSelectedProdukIds] = createSignal<Set<string>>(new Set());
const [showBulkRestockModal, setShowBulkRestockModal] = createSignal(false);
// Toko filter for Produk tab — also used to auto-fill new product toko_id
const [selectedProdukTokoId, setSelectedProdukTokoId] = createSignal("");
const selectedProdukCount = createMemo(() => selectedProdukIds().size);
const filteredDaftarProduk = createMemo(() => {
  const tokoId = selectedProdukTokoId();
  const list = daftarProduk();
  if (!tokoId) return list;
  return list.filter((p) => p.toko_id === tokoId);
});
const isAllProdukSelected = createMemo(() => {
  const list = filteredDaftarProduk();
  if (list.length === 0) return false;
  const sel = selectedProdukIds();
  return list.every((p) => sel.has(p.id));
});

function toggleProdukSelection(id: string) {
  setSelectedProdukIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function selectAllProduk() {
  const ids = filteredDaftarProduk().map((p) => p.id);
  setSelectedProdukIds(new Set(ids));
}

function clearProdukSelection() {
  setSelectedProdukIds(new Set<string>());
}

function setProdukTokoFilter(tokoId: string) {
  setSelectedProdukTokoId(tokoId);
  clearProdukSelection();
}

async function bulkDeleteProduk() {
  const ids = Array.from(selectedProdukIds());
  const confirmed = await swalConfirm(`Hapus ${ids.length} produk?`, `Aksi ini tidak bisa dibatalkan. ${ids.length} produk akan dihapus permanen.`, "Ya, hapus semua");
  if (!confirmed) return;
  let ok = 0;
  let fail = 0;
  for (const id of ids) {
    try {
      await api<unknown>(`/api/produk/${id}`, { method: "DELETE" });
      ok++;
    } catch { fail++; }
  }
  clearProdukSelection();
  await Promise.all([loadProduk(), deps.loadStats(), deps.loadAlerts()]);
  swalToast("success", `Berhasil hapus ${ok} produk${fail ? `, ${fail} gagal` : ""}`);
}

async function bulkRestockProduk(qtyMap: Record<string, number>) {
  const items = Object.entries(qtyMap)
    .filter(([, qty]) => qty > 0)
    .map(([produk_id, qty]) => ({
      produk_id,
      qty,
      harga_modal: 0, // default; backend will accept
    }));
  if (items.length === 0) {
    swalWarning("Tidak ada item dengan qty > 0");
    return;
  }
  const res = await api<{ restocked: number; errors: string[] }>("/api/produk/bulk-restock", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  clearProdukSelection();
  setShowBulkRestockModal(false);
  await Promise.all([loadProduk(), deps.loadStats(), deps.loadAlerts()]);
  swalToast("success", `Restock ${res.restocked} produk berhasil`);
  if (res.errors?.length) {
    console.warn("Bulk restock errors:", res.errors);
  }
}

function openQuickRestock(p: Produk) {
  setModalProduk({ ...p, qty: "0", _skuEdited: true });
  setBulkMode(false);
  setBulkToml("");
  setSelectedExistingProduk(p);
  setShowProdukModal(true);
}

// Derive mode
const produkMode = (): "new" | "restock" =>
  selectedExistingProduk() ? "restock" : "new";

async function loadProduk() {
  try {
    const data = await api<Produk[]>("/api/produk");
    setDaftarProduk(data);
  } catch (err) {
    deps.toastLoadError("produk", err);
  }
}

function editProduk(p: Produk) {
  setModalProduk({ ...p, qty: String(p.stok), _skuEdited: true });
  setBulkMode(false);
  setBulkToml("");
  setSelectedExistingProduk(null);
  setShowProdukModal(true);
}

function resetProdukCombobox() {
  setProdukSearchQuery("");
  setProdukSearchResults([]);
  setProdukComboboxOpen(false);
  setSelectedExistingProduk(null);
  if (produkSearchTimer) clearTimeout(produkSearchTimer);
}

async function searchProduk(query: string) {
  if (!query.trim()) {
    setProdukSearchResults([]);
    setProdukComboboxOpen(false);
    return;
  }
  const request = ++produkSearchRequest;
  setProdukSearchLoading(true);
  try {
    const requestedLimit = Number.parseInt(query);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 8;
    const results = await api<(Produk & { toko_nama?: string })[]>(
      `/api/produk/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
    if (request !== produkSearchRequest) return; // stale response
    setProdukSearchResults(results);
    setProdukComboboxOpen(results.length > 0);
  } catch (err) {
    console.error("Search produk failed:", err);
    if (request !== produkSearchRequest) return;
    setProdukSearchResults([]);
  } finally {
    if (request === produkSearchRequest) setProdukSearchLoading(false);
  }
}

function handleProdukNameInput(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  setProdukSearchQuery(value);
  setModalProduk((prev) => {
    // Auto-generate SKU prefix from nama (only if user hasn't manually edited SKU)
    const consonants = value.toUpperCase().replace(/[^A-Z]/g, "").replace(/[AEIOU]/g, "");
    const code = (consonants + "XXXXX").slice(0, 5);
    const autoSku = value.trim() ? `PRD-${code}-` : "";
    return { ...prev, nama: value, sku: prev._skuEdited ? prev.sku : autoSku };
  });
  if (selectedExistingProduk()) setSelectedExistingProduk(null);
  if (produkSearchTimer) clearTimeout(produkSearchTimer);
  produkSearchTimer = setTimeout(() => searchProduk(value), 250);
}

function selectProdukFromDropdown(p: Produk & { toko_nama?: string }) {
  setSelectedExistingProduk(p);
  setModalProduk((prev: any) => ({
    ...prev,
    id: p.id,
    nama: p.nama,
    harga: String(p.harga),
    stok: "0",
    toko_id: p.toko_id,
  }));
  setProdukSearchResults([]);
  setProdukComboboxOpen(false);
}

function parseToml(toml: string): Array<{
  nama: string;
  sku: string;
  harga: number;
  harga_modal: number;
  stok: number;
  stock_threshold: number;
  toko_id: string;
  merk: string;
  kategori: string;
  satuan: string;
}> {
  const items: Array<{
    nama: string;
    sku: string;
    harga: number;
    harga_modal: number;
    stok: number;
    stock_threshold: number;
    toko_id: string;
    merk: string;
    kategori: string;
    satuan: string;
  }> = [];
  let current: Record<string, string> = {};
  for (const line of toml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed === "[[produk]]") {
      if (Object.keys(current).length > 0 && current.nama) {
        items.push({
          nama: current.nama,
          sku: current.sku || "",
          harga: Number(current.harga) || 0,
          harga_modal: Number(current.harga_modal) || 0,
          stok: Number(current.stok) || 0,
          stock_threshold: Number(current.stock_threshold) || 10,
          toko_id: current.toko_id || "",
          merk: current.merk || "",
          kategori: current.kategori || "",
          satuan: current.satuan || "",
        });
      }
      current = {};
      continue;
    }
    // Key=value: quoted (tolerate unclosed) or unquoted
    const quoted = trimmed.match(/^(\w+)\s*=\s*"([^"]*)"\s*$/);
    if (quoted) { current[quoted[1]] = quoted[2]; continue; }
    const unquoted = trimmed.match(/^(\w+)\s*=\s*(\S+)\s*$/);
    if (unquoted) current[unquoted[1]] = unquoted[2];
  }
  if (Object.keys(current).length > 0 && current.nama) {
    // Validate satuan against whitelist (case-insensitive)
    if (current.satuan && !isSatuanValid(current.satuan)) {
      swalWarning(
        `Satuan "${current.satuan}" tidak valid untuk "${current.nama}". Gunakan: ${SATUAN_WHITELIST.join(", ")}. Baris di-skip.`,
      );
    } else {
      items.push({
        nama: current.nama,
        sku: current.sku || "",
        harga: Number(current.harga) || 0,
        harga_modal: Number(current.harga_modal) || 0,
        stok: Number(current.stok) || 0,
        stock_threshold: Number(current.stock_threshold) || 10,
        toko_id: current.toko_id || "",
        merk: current.merk || "",
        kategori: current.kategori || "",
        satuan: normalizeSatuan(current.satuan),
      });
    }
  }
  return items;
}

async function handleBulkImport(e: SubmitEvent) {
  e.preventDefault();
  const items = parseToml(bulkToml());
  if (items.length === 0) {
    swalWarning("Tidak ada data valid ditemukan");
    return;
  }
  deps.setSubmitting(true);
  try {
    let success = 0;
    let failed = 0;
    for (const item of items) {
      // Resolve toko nama → UUID jika perlu
      const tokoResolved = deps.daftarToko().find(
        (t) => t.id === item.toko_id || t.nama === item.toko_id,
      );
      if (!tokoResolved) {
        swalWarning(`Toko "${item.toko_id}" tidak ditemukan untuk produk "${item.nama}". Import dibatalkan.`);
        break;
      }
      const payload = Object.fromEntries(
        Object.entries({ ...item, toko_id: tokoResolved.id }).filter(
          ([k, v]) => v !== "" && v !== undefined,
        ),
      );
      try {
        await api<unknown>("/api/produk", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        success++;
      } catch (err: any) {
        failed++;
        swalWarning(`Gagal import "${item.nama}": ${err.message || "Unknown error"}`);
        break; // stop on first error
      }
    }
    setShowProdukModal(false);
    swalToast(
      "success",
      `Import selesai: ${success} berhasil, ${failed} gagal`,
    );
    await Promise.all([loadProduk(), deps.loadStats(), deps.loadAlerts()]);
  } catch (err: any) {
    swalApiError(err);
  } finally {
    deps.setSubmitting(false);
  }
}

async function saveProduk(e: Event) {
  e.preventDefault();
  const m = modalProduk();
  if (!m.nama || !m.nama.trim()) {
    swalWarning("Nama wajib diisi");
    return;
  }
  if (m.id && (!m.sku || !m.sku.trim())) {
    // Editing existing — SKU still required
    swalWarning("SKU wajib diisi");
    return;
  }
  if (!m.harga || Number(m.harga) <= 0) {
    swalWarning("Harga harus lebih dari 0");
    return;
  }
  if (m.satuan && !isSatuanValid(m.satuan)) {
    swalWarning(`Satuan tidak valid. Gunakan: ${SATUAN_WHITELIST.join(", ")}`);
    return;
  }
  // New product must always belong to a managed toko (never empty/null)
  if (!m.id && !selectedExistingProduk()) {
    const tokoId = String(m.toko_id || selectedProdukTokoId() || "").trim();
    if (!tokoId) {
      swalWarning("Pilih toko dulu. Buat toko di tab Toko jika belum ada.");
      return;
    }
    if (!deps.daftarToko().some((t) => t.id === tokoId)) {
      swalWarning("Toko tidak valid. Pilih toko dari filter Produk.");
      return;
    }
    if (m.toko_id !== tokoId) {
      setModalProduk((prev) => ({ ...prev, toko_id: tokoId }));
    }
    m.toko_id = tokoId;
  }
  if (!m.toko_id && produkMode() === "restock") {
    swalWarning("Pilih toko");
    return;
  }
  if (selectedExistingProduk()) {
    // Restock mode — update stok only
    const existing = selectedExistingProduk()!;
    const addQty = Number(m.stok) || 0;
    if (addQty <= 0) {
      swalWarning("Jumlah restock harus lebih dari 0");
      return;
    }
    deps.setSubmitting(true);
    try {
      await api<unknown>("/api/produk/restock", {
        method: "POST",
        body: JSON.stringify({
          produk_id: existing.id,
          qty: addQty,
          harga_modal: existing.harga_modal || 0,
        }),
      });
      setShowProdukModal(false);
      swalToast("success", `Stok ${existing.nama} +${addQty}`);
      await Promise.all([loadProduk(), deps.loadStats(), deps.loadAlerts()]);
      deps.setWalletRefresh((n) => n + 1);
    } catch (err: any) {
      swalApiError(err);
    } finally {
      deps.setSubmitting(false);
    }
    return;
  }
  deps.setSubmitting(true);
  const method = m.id ? "PATCH" : "POST";
  const url = m.id ? `/api/produk/${m.id}` : "/api/produk";
  // If SKU is just auto-prefix (ends with "-"), send empty so backend generates full one
  const sku = m.sku && m.sku.endsWith("-") ? "" : m.sku;
  try {
    await api<unknown>(url, {
      method,
      body: JSON.stringify({
        nama: m.nama,
        sku: sku || undefined,
        harga: Number(m.harga),
        harga_modal: Number(m.harga_modal) || 0,
        stok: Number(m.stok) || 0,
        toko_id: m.toko_id,
        stock_threshold: m.stock_threshold,
        merk: m.merk || "",
        kategori: m.kategori || "",
        satuan: normalizeSatuan(m.satuan),
      }),
    });
    setShowProdukModal(false);
    swalToast("success", m.id ? "Produk diperbarui" : "Produk ditambahkan");
    await Promise.all([loadProduk(), deps.loadStats(), deps.loadAlerts()]);
    if (!m.id) deps.setWalletRefresh((n) => n + 1); // new product created → refresh wallet
  } catch (err: any) {
    swalApiError(err);
  } finally {
    deps.setSubmitting(false);
  }
}

async function hapusProduk(id: string, nama: string) {
  const ok = await swalConfirm(
    "Hapus produk?",
    `Produk "${nama}" akan dihapus permanen.`,
  );
  if (!ok) return;
  try {
    await api<unknown>(`/api/produk/${id}`, { method: "DELETE" });
    swalToast("success", "Produk dihapus");
    await Promise.all([loadProduk(), deps.loadStats(), deps.loadAlerts()]);
  } catch (err: any) {
    swalApiError(err);
  }
}

  return {
    daftarProduk, showProdukModal, setShowProdukModal, modalProduk, setModalProduk,
    bulkMode, setBulkMode, bulkToml, setBulkToml,
    produkSearchQuery, setProdukSearchQuery,
    produkSearchResults, produkSearchLoading, produkComboboxOpen, setProdukComboboxOpen,
    selectedExistingProduk, setSelectedExistingProduk,
    loadProduk, editProduk, saveProduk, hapusProduk,
    searchProduk, handleProdukNameInput, selectProdukFromDropdown, resetProdukCombobox,
    handleBulkImport, parseToml,
    bulkSubmitting,
    openQuickRestock,
    produkMode,
    selectedProdukIds, selectedProdukCount, isAllProdukSelected,
    toggleProdukSelection, selectAllProduk, clearProdukSelection,
    bulkDeleteProduk, bulkRestockProduk,
    showBulkRestockModal, setShowBulkRestockModal,
    selectedProdukTokoId, setSelectedProdukTokoId, setProdukTokoFilter, filteredDaftarProduk,
    merkList, kategoriListAll, satuanListAll, SATUAN_WHITELIST,
  };
}
