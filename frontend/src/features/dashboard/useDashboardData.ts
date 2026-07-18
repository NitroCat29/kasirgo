import { createSignal, createMemo, onMount, onCleanup } from "solid-js";
import { api } from "../../lib/api";
import { formatRupiah } from "../../lib/format";
import { usePolling } from "../../lib/usePolling";
import {
  swalConfirm,
  swalSuccess,
  swalApiError,
  swalToast,
  swalWarning,
} from "../../lib/swal";
import { calculateTotal, loadWasm } from "../../lib/wasm";
import type {
  AuditLog,
  DailyRevenue,
  LowStockItem,
  Produk,
  Stats,
  Toko,
  Transaksi,
  TrxItem,
  UserRow,
} from "../../components/dashboard/types";
import { canEdit } from "../../components/dashboard/types";

/* ============================================
   TYPES
   ============================================ */

export type DashboardTab =
  | "overview"
  | "toko"
  | "produk"
  | "transaksi"
  | "users"
  | "audit";

/* ============================================
   HOOK
   ============================================ */

export function useDashboardData() {
  // --- Core ---
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [walletRefresh, setWalletRefresh] = createSignal(0);

  // --- Theme ---
  const [theme, setTheme] = createSignal<"dark" | "light">(
    (localStorage.getItem("kasir-theme") as "dark" | "light") || "dark",
  );
  function toggleTheme() {
    const next = theme() === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("kasir-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  // --- Toko ---
  const [daftarToko, setDaftarToko] = createSignal<Toko[]>([]);
  const [showTokoModal, setShowTokoModal] = createSignal(false);
  const [modalToko, setModalToko] = createSignal<Partial<Toko>>({});

  async function loadToko() {
    try {
      const data = await api<Toko[]>("/api/toko");
      setDaftarToko(data);
    } catch {}
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
    setSubmitting(true);
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
      await Promise.all([loadToko(), loadStats()]);
    } catch (err: any) {
      swalApiError(err);
    } finally {
      setSubmitting(false);
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
      await Promise.all([loadToko(), loadStats()]);
    } catch (err: any) {
      swalApiError(err);
    }
  }

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
    } catch {}
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
      const match = trimmed.match(/^(\w+)\s*=\s*"?(.+?)"?\s*$/);
      if (match) current[match[1]] = match[2];
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
    setSubmitting(true);
    try {
      let success = 0;
      let failed = 0;
      for (const item of items) {
        try {
          await api<unknown>("/api/produk", {
            method: "POST",
            body: JSON.stringify(item),
          });
          success++;
        } catch {
          failed++;
        }
      }
      setShowProdukModal(false);
      swalToast(
        "success",
        `Import selesai: ${success} berhasil, ${failed} gagal`,
      );
      await Promise.all([loadProduk(), loadStats(), loadAlerts()]);
    } catch (err: any) {
      swalApiError(err);
    } finally {
      setSubmitting(false);
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
      setSubmitting(true);
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
        await Promise.all([loadProduk(), loadStats(), loadAlerts()]);
        setWalletRefresh((n) => n + 1);
      } catch (err: any) {
        swalApiError(err);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setSubmitting(true);
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
      await Promise.all([loadProduk(), loadStats(), loadAlerts()]);
      if (!m.id) setWalletRefresh((n) => n + 1); // new product created → refresh wallet
    } catch (err: any) {
      swalApiError(err);
    } finally {
      setSubmitting(false);
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
      await Promise.all([loadProduk(), loadStats(), loadAlerts()]);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  // --- Transaksi ---
  const [daftarTransaksi, setDaftarTransaksi] = createSignal<Transaksi[]>([]);
  const [showTrxModal, setShowTrxModal] = createSignal(false);
  const [modalTrx, setModalTrx] = createSignal<Partial<Transaksi>>({});
  const [trxItems, setTrxItems] = createSignal<TrxItem[]>([]);

  async function loadTransaksi() {
    try {
      const data = await api<Transaksi[]>("/api/transaksi");
      setDaftarTransaksi(data);
    } catch {}
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
    const ok = await swalConfirm("Hapus transaksi?", "Transaksi akan dihapus permanen.");
    if (!ok) return;
    try {
      await api<unknown>(`/api/transaksi/${id}`, { method: "DELETE" });
      swalToast("success", "Transaksi dihapus");
      await Promise.all([loadTransaksi(), loadStats()]);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  // --- Transaksi create form ---
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
    if (!f.nama || !f.harga) {
      swalWarning("Item tidak lengkap");
      return;
    }
    setTrxForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { nama: f.nama, harga: Number(f.harga), qty: Number(f.qty) || 1 },
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
    setSubmitting(true);
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
      await Promise.all([loadTransaksi(), loadStats(), loadDailyRevenue()]);
    } catch (err: any) {
      swalApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  // --- Users ---
  const [daftarUsers, setDaftarUsers] = createSignal<UserRow[]>([]);
  const [showUserModal, setShowUserModal] = createSignal(false);
  const [modalUser, setModalUser] = createSignal<Partial<UserRow & { password?: string }>>({});

  async function loadUsers() {
    try {
      const data = await api<UserRow[]>("/api/auth/users");
      setDaftarUsers(data);
    } catch {}
  }

  function editUser(u: UserRow) {
    setModalUser({ ...u, password: "" });
    setShowUserModal(true);
  }

  async function saveUser(e: Event) {
    e.preventDefault();
    const m = modalUser();
    if (!m.username || !m.nama) {
      swalWarning("Username & nama wajib diisi");
      return;
    }
    if (!m.id && !m.password) {
      swalWarning("Password wajib diisi untuk user baru");
      return;
    }
    setSubmitting(true);
    const method = m.id ? "PATCH" : "POST";
    const url = m.id ? `/api/users/${m.id}` : "/api/users";

    // SHA-256 hash password di client (konsisten dengan auth flow)
    let hashedPassword: string | undefined;
    if (m.password) {
      const buf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(m.password),
      );
      hashedPassword = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    try {
      await api<unknown>(url, {
        method,
        body: JSON.stringify({
          username: m.username,
          nama: m.nama,
          role: m.role || "kasir",
          ...(hashedPassword ? { password: hashedPassword } : {}),
        }),
      });
      setShowUserModal(false);
      swalToast("success", m.id ? "User diperbarui" : "User ditambahkan");
      await loadUsers();
    } catch (err: any) {
      swalApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function hapusUser(id: string, nama: string) {
    const ok = await swalConfirm("Hapus user?", `User "${nama}" akan dihapus permanen.`);
    if (!ok) return;
    try {
      await api<unknown>(`/api/auth/users/${id}`, { method: "DELETE" });
      swalToast("success", "User dihapus");
      await loadUsers();
    } catch (err: any) {
      swalApiError(err);
    }
  }

  // --- Audit ---
  const [daftarAudit, setDaftarAudit] = createSignal<AuditLog[]>([]);
  const [auditFilter, setAuditFilter] = createSignal<string>("");

  async function loadAudit(filter = "") {
    try {
      const url = filter ? `/api/audit-logs?action=${filter}` : "/api/audit-logs";
      const data = await api<AuditLog[]>(url);
      setDaftarAudit(data);
    } catch {}
  }

  // --- Overview / Alerts ---
  const [dailyRevenue, setDailyRevenue] = createSignal<DailyRevenue[]>([]);
  const [chartLoading, setChartLoading] = createSignal(true);
  const [lowStockCount, setLowStockCount] = createSignal(0);
  const [lowStockItems, setLowStockItems] = createSignal<LowStockItem[]>([]);
  const [showLowStockModal, setShowLowStockModal] = createSignal(false);

  async function loadDailyRevenue() {
    setChartLoading(true);
    try {
      const d = await api<{ days: number; data: DailyRevenue[] }>(
        "/api/stats/daily-revenue?days=30",
      );
      setDailyRevenue(d.data);
    } catch {
    } finally {
      setChartLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await api<Stats>("/api/stats");
      setStats(data);
    } catch {}
  }

  async function loadAlerts() {
    try {
      const data = await api<{ count: number }>("/api/alerts/summary");
      setLowStockCount(data.count);
    } catch {}
  }

  async function loadLowStockItems() {
    try {
      const data = await api<LowStockItem[]>("/api/alerts/low-stock");
      setLowStockItems(data);
      setShowLowStockModal(true);
    } catch (err: any) {
      swalApiError(err);
    }
  }

  // --- Realtime polling (via usePolling, auto-cleanup) ---
  let activeTab = "overview";
  let realtimeStarted = false;

  function startRealtime() {
    if (realtimeStarted) return;
    realtimeStarted = true;
    // Transaksi: 5s
    usePolling(() => loadTransaksi(), 5000, () => activeTab === "tx");
    // Audit: 5s
    usePolling(() => loadAudit(auditFilter()), 5000, () => activeTab === "audit");
    // Stok / low-stock + stats: 10s
    usePolling(
      () => {
        loadProduk();
        loadAlerts();
      },
      10000,
      () => activeTab === "produk",
    );
    // Overview: stats + low stock count 10s
    usePolling(
      () => {
        loadStats();
        loadAlerts();
      },
      10000,
      () => activeTab === "overview",
    );
  }

  function stopRealtime() {
    realtimeStarted = false; // interval di-clear otomatis oleh onCleanup usePolling
  }

  function setActiveTabRealtime(id: string) {
    activeTab = id;
  }

  // --- Helpers ---
  function getTokoNama(id: string | undefined): string {
    if (!id) return "—";
    const t = daftarToko().find((x) => x.id === id);
    return t ? t.nama : id.slice(0, 8) + "...";
  }

  function trxSubtotal(): number {
    return trxItems().reduce((sum, item) => sum + item.harga * item.qty, 0);
  }

  function trxTotal(): number {
    return Math.round(trxSubtotal() * 1.11);
  }

  // --- Init ---
  async function init() {
    await Promise.all([loadStats(), loadAlerts(), loadToko()]);
  }

  function initOnMount() {
    loadWasm();
    document.documentElement.setAttribute("data-theme", theme());
    loadDailyRevenue();
    startRealtime();
    onCleanup(() => stopRealtime());
  }

  return {
    // Core
    stats, submitting, setSubmitting,
    theme, toggleTheme,
    // Toko
    daftarToko, showTokoModal, setShowTokoModal, modalToko, setModalToko,
    loadToko, editToko, saveToko, hapusToko,
    // Produk
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
    // Suggestions
    merkList, kategoriListAll, satuanListAll, SATUAN_WHITELIST,
    // Transaksi
    daftarTransaksi, showTrxModal, setShowTrxModal, modalTrx, setModalTrx, trxItems,
    trxForm, setTrxForm, trxItemForm, setTrxItemForm,
    loadTransaksi, loadTrxItems, hapusTransaksi,
    openTrxModal, addTrxItem, removeTrxItem, saveTrx,
    trxFormSubtotal, trxFormTotal,
    trxSubtotal, trxTotal,
    // Users
    daftarUsers, showUserModal, setShowUserModal, modalUser, setModalUser,
    loadUsers, editUser, saveUser, hapusUser,
    // Audit
    daftarAudit, auditFilter, setAuditFilter, loadAudit,
    // Overview
    dailyRevenue, chartLoading,
    lowStockCount, lowStockItems, showLowStockModal, setShowLowStockModal,
    loadDailyRevenue, loadStats, loadAlerts, loadLowStockItems,
    walletRefresh,
    // Helpers
    getTokoNama,
    // Realtime
    setActiveTabRealtime, startRealtime, stopRealtime,
    // Init
    init, initOnMount,
  };
}
