import { createSignal } from "solid-js";
import { theme, toggleTheme, initTheme } from "../../lib/theme";
import { usePolling } from "../../lib/usePolling";
import { loadWasm } from "../../lib/wasm";
import type { Toko } from "../../components/dashboard/types";
import { createToastLoadError } from "./hooks/loadError";
import { useOverviewData } from "./hooks/useOverviewData";
import { useTokoData } from "./hooks/useTokoData";
import { useProdukData } from "./hooks/useProdukData";
import { useTransaksiData } from "./hooks/useTransaksiData";
import { useUsersData } from "./hooks/useUsersData";

// Single source of truth — re-export for any legacy import
export type { DashboardTab } from "../../components/dashboard/types";

/* ============================================
   FACADE — composes domain hooks, same return shape
   ============================================ */

export function useDashboardData() {
  const toastLoadError = createToastLoadError();
  const [submitting, setSubmitting] = createSignal(false);

  const overview = useOverviewData({ toastLoadError });

  // Lazy bridge: produk needs daftarToko before toko hook exists
  let daftarTokoRef: () => Toko[] = () => [];

  const produk = useProdukData({
    toastLoadError,
    setSubmitting,
    loadStats: overview.loadStats,
    loadAlerts: overview.loadAlerts,
    daftarToko: () => daftarTokoRef(),
    setWalletRefresh: overview.setWalletRefresh,
  });

  const toko = useTokoData({
    toastLoadError,
    setSubmitting,
    loadStats: overview.loadStats,
    onTokoListLoaded: (data) => {
      if (data.length === 0) {
        produk.setSelectedProdukTokoId("");
      } else if (!data.some((t) => t.id === produk.selectedProdukTokoId())) {
        produk.setSelectedProdukTokoId(data[0].id);
      }
    },
  });
  daftarTokoRef = toko.daftarToko;

  const transaksi = useTransaksiData({
    toastLoadError,
    setSubmitting,
    loadStats: overview.loadStats,
    loadDailyRevenue: overview.loadDailyRevenue,
  });

  const users = useUsersData({ toastLoadError, setSubmitting });

  // --- Helpers ---
  function getTokoNama(id: string | undefined): string {
    if (!id) return "—";
    const t = toko.daftarToko().find((x) => x.id === id);
    return t ? t.nama : id.slice(0, 8) + "...";
  }

  // --- Realtime polling ---
  let activeTab = "overview";
  let realtimeStarted = false;
  let pollingDisposers: (() => void)[] = [];

  function startRealtime() {
    if (realtimeStarted) return;
    realtimeStarted = true;
    pollingDisposers.push(
      usePolling(() => transaksi.loadTransaksi(), 5000, () => activeTab === "tx"),
    );
    pollingDisposers.push(
      usePolling(
        () => overview.loadAudit(overview.auditFilter()),
        5000,
        () => activeTab === "audit",
      ),
    );
    pollingDisposers.push(
      usePolling(
        () => {
          produk.loadProduk();
          overview.loadAlerts();
        },
        10000,
        () => activeTab === "produk",
      ),
    );
    pollingDisposers.push(
      usePolling(
        () => {
          overview.loadStats();
          overview.loadAlerts();
          overview.loadDailyRevenue();
        },
        10000,
        () => activeTab === "overview",
      ),
    );
  }

  function stopRealtime() {
    pollingDisposers.forEach((d) => d());
    pollingDisposers = [];
    realtimeStarted = false;
  }

  function setActiveTabRealtime(id: string) {
    activeTab = id;
  }

  async function init() {
    await Promise.all([
      overview.loadStats(),
      overview.loadAlerts(),
      toko.loadToko(),
    ]);
  }

  function initOnMount() {
    initTheme();
    loadWasm();
    overview.loadDailyRevenue();
    startRealtime();
  }

  return {
    // Core
    stats: overview.stats,
    submitting,
    setSubmitting,
    theme,
    toggleTheme,
    // Toko
    daftarToko: toko.daftarToko,
    showTokoModal: toko.showTokoModal,
    setShowTokoModal: toko.setShowTokoModal,
    modalToko: toko.modalToko,
    setModalToko: toko.setModalToko,
    loadToko: toko.loadToko,
    editToko: toko.editToko,
    saveToko: toko.saveToko,
    hapusToko: toko.hapusToko,
    // Produk
    daftarProduk: produk.daftarProduk,
    showProdukModal: produk.showProdukModal,
    setShowProdukModal: produk.setShowProdukModal,
    modalProduk: produk.modalProduk,
    setModalProduk: produk.setModalProduk,
    bulkMode: produk.bulkMode,
    setBulkMode: produk.setBulkMode,
    bulkToml: produk.bulkToml,
    setBulkToml: produk.setBulkToml,
    produkSearchQuery: produk.produkSearchQuery,
    setProdukSearchQuery: produk.setProdukSearchQuery,
    produkSearchResults: produk.produkSearchResults,
    produkSearchLoading: produk.produkSearchLoading,
    produkComboboxOpen: produk.produkComboboxOpen,
    setProdukComboboxOpen: produk.setProdukComboboxOpen,
    selectedExistingProduk: produk.selectedExistingProduk,
    setSelectedExistingProduk: produk.setSelectedExistingProduk,
    loadProduk: produk.loadProduk,
    editProduk: produk.editProduk,
    saveProduk: produk.saveProduk,
    hapusProduk: produk.hapusProduk,
    searchProduk: produk.searchProduk,
    handleProdukNameInput: produk.handleProdukNameInput,
    selectProdukFromDropdown: produk.selectProdukFromDropdown,
    resetProdukCombobox: produk.resetProdukCombobox,
    handleBulkImport: produk.handleBulkImport,
    parseToml: produk.parseToml,
    bulkSubmitting: produk.bulkSubmitting,
    openQuickRestock: produk.openQuickRestock,
    produkMode: produk.produkMode,
    // Multi-select
    selectedProdukIds: produk.selectedProdukIds,
    selectedProdukCount: produk.selectedProdukCount,
    isAllProdukSelected: produk.isAllProdukSelected,
    toggleProdukSelection: produk.toggleProdukSelection,
    selectAllProduk: produk.selectAllProduk,
    clearProdukSelection: produk.clearProdukSelection,
    bulkDeleteProduk: produk.bulkDeleteProduk,
    bulkRestockProduk: produk.bulkRestockProduk,
    showBulkRestockModal: produk.showBulkRestockModal,
    setShowBulkRestockModal: produk.setShowBulkRestockModal,
    selectedProdukTokoId: produk.selectedProdukTokoId,
    setSelectedProdukTokoId: produk.setSelectedProdukTokoId,
    setProdukTokoFilter: produk.setProdukTokoFilter,
    filteredDaftarProduk: produk.filteredDaftarProduk,
    // Suggestions
    merkList: produk.merkList,
    kategoriListAll: produk.kategoriListAll,
    satuanListAll: produk.satuanListAll,
    SATUAN_WHITELIST: produk.SATUAN_WHITELIST,
    // Transaksi
    daftarTransaksi: transaksi.daftarTransaksi,
    showTrxModal: transaksi.showTrxModal,
    setShowTrxModal: transaksi.setShowTrxModal,
    modalTrx: transaksi.modalTrx,
    setModalTrx: transaksi.setModalTrx,
    trxItems: transaksi.trxItems,
    trxForm: transaksi.trxForm,
    setTrxForm: transaksi.setTrxForm,
    trxItemForm: transaksi.trxItemForm,
    setTrxItemForm: transaksi.setTrxItemForm,
    loadTransaksi: transaksi.loadTransaksi,
    loadTrxItems: transaksi.loadTrxItems,
    hapusTransaksi: transaksi.hapusTransaksi,
    openTrxModal: transaksi.openTrxModal,
    addTrxItem: transaksi.addTrxItem,
    removeTrxItem: transaksi.removeTrxItem,
    saveTrx: transaksi.saveTrx,
    trxFormSubtotal: transaksi.trxFormSubtotal,
    trxFormTotal: transaksi.trxFormTotal,
    trxSubtotal: transaksi.trxSubtotal,
    trxTotal: transaksi.trxTotal,
    trxSearchQuery: transaksi.trxSearchQuery,
    setTrxSearchQuery: transaksi.setTrxSearchQuery,
    trxTotalCount: transaksi.trxTotalCount,
    // Users
    daftarUsers: users.daftarUsers,
    showUserModal: users.showUserModal,
    setShowUserModal: users.setShowUserModal,
    modalUser: users.modalUser,
    setModalUser: users.setModalUser,
    loadUsers: users.loadUsers,
    editUser: users.editUser,
    saveUser: users.saveUser,
    hapusUser: users.hapusUser,
    // Audit
    daftarAudit: overview.daftarAudit,
    auditFilter: overview.auditFilter,
    setAuditFilter: overview.setAuditFilter,
    loadAudit: overview.loadAudit,
    // Overview
    dailyRevenue: overview.dailyRevenue,
    chartDays: overview.chartDays,
    setChartDays: overview.setChartDays,
    chartLoading: overview.chartLoading,
    lowStockCount: overview.lowStockCount,
    lowStockItems: overview.lowStockItems,
    showLowStockModal: overview.showLowStockModal,
    setShowLowStockModal: overview.setShowLowStockModal,
    loadDailyRevenue: overview.loadDailyRevenue,
    loadStats: overview.loadStats,
    loadAlerts: overview.loadAlerts,
    loadLowStockItems: overview.loadLowStockItems,
    walletRefresh: overview.walletRefresh,
    // Helpers
    getTokoNama,
    // Realtime
    setActiveTabRealtime,
    startRealtime,
    stopRealtime,
    // Init
    init,
    initOnMount,
  };
}
