import { createSignal, onCleanup, onMount, Show, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { user, logout, fetchMe } from "../lib/auth";
import { useSessionTimeout } from "../lib/session-timeout";
import { SessionTimeoutModal } from "../components/ui";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import { canManageUsers, canViewAudit } from "../components/dashboard/types";
import type { DashboardTab } from "../components/dashboard/types";

import { useDashboardData } from "../features/dashboard/useDashboardData";
import OverviewTab from "../features/dashboard/tabs/OverviewTab";
import TokoTab from "../features/dashboard/tabs/TokoTab";
import ProdukTab from "../features/dashboard/tabs/ProdukTab";
import TransaksiTab from "../features/dashboard/tabs/TransaksiTab";
import UsersTab from "../features/dashboard/tabs/UsersTab";
import AuditTab from "../features/dashboard/tabs/AuditTab";
import TokoModal from "../features/dashboard/modals/TokoModal";
import ProdukModal from "../features/dashboard/modals/ProdukModal";
import UserModal from "../features/dashboard/modals/UserModal";
import TrxModal from "../features/dashboard/modals/TrxModal";
import LowStockModal from "../features/dashboard/modals/LowStockModal";
import BulkRestockModal from "../features/dashboard/modals/BulkRestockModal";

/* ============================================
   COMPONENT
   ============================================ */

export default function Dashboard() {
  const nav = useNavigate();
  const d = useDashboardData();
  const [tab, setTab] = createSignal<DashboardTab>("overview");
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  // Sidebar items
  const sidebarItems = (): { id: DashboardTab; label: string; icon: JSX.Element }[] => {
    const items = [
      { id: "overview", label: "Overview", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /> },
      { id: "toko", label: "Toko", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" /> },
      { id: "produk", label: "Produk", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /> },
      { id: "transaksi", label: "Transaksi", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /> },
    ];
    if (canManageUsers(user()?.role)) {
      items.push(
        { id: "users", label: "Users", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.885-2.001-1.938-2.001-.18 0-.358.025-.532.073m-3.593.65a9.337 9.337 0 00-4.121.952 4.125 4.125 0 007.533 2.493M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M9.038 17.595a9.337 9.337 0 00-4.121.952 4.125 4.125 0 007.533 2.493M9.038 17.595a9.337 9.337 0 00-4.121-.952 4.125 4.125 0 017.533 2.493M15 19.128v-.003c0-1.113-.885-2.001-1.938-2.001-.18 0-.358.025-.532.073m-3.593.65a9.337 9.337 0 00-4.121.952 4.125 4.125 0 007.533 2.493M9.038 17.595a4.125 4.125 0 00-7.533-2.493M9.038 17.595a9.337 9.337 0 00-4.121.952 4.125 4.125 0 007.533 2.493" /> },
        { id: "audit", label: "Audit Logs", icon: <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-2.25-2.126H4.5c0 3.106.003 5.935.007 7.037.004.885-.674 1.65-1.567 1.724a18.07 18.07 0 01-2.162.076 17.97 17.97 0 01-1.658-.112 17.97 17.97 0 01-1.658-.112 17.97 17.97 0 01-1.658-.112H3.75" /> },
      );
    }
    return items as { id: DashboardTab; label: string; icon: JSX.Element }[];
  };

  // Tab change handler — load data for tab
  function handleTabClick(id: string) {
    setTab(id as DashboardTab);
    setSidebarOpen(false);
    d.setActiveTabRealtime(id);
    if (id === "toko") d.loadToko();
    if (id === "produk") d.loadProduk();
    if (id === "transaksi") d.loadTransaksi();
    if (id === "users") d.loadUsers();
    if (id === "audit") d.loadAudit(d.auditFilter());
    if (id === "overview") d.loadDailyRevenue();
  }

  function handleLogout() {
    logout();
    nav("/login");
  }

  // Session timeout
  const sessionTimeout = useSessionTimeout({
    onTimeout: () => nav("/login"),
    warningSeconds: 120,
  });

  // Init
  onMount(async () => {
    if (!user()) {
      const me = await fetchMe();
      if (!me) { nav("/login"); return; }
    }
    await d.init();
    d.initOnMount();
  });

  onCleanup(() => d.stopRealtime());

  // --- Local handlers (bundling agar JSX rapi) ---
  const closeProdukModal = () => {
    d.setShowProdukModal(false);
    d.resetProdukCombobox();
    d.setBulkMode(false);
    d.setBulkToml("");
  };
  const openProdukModal = () => {
    d.setModalProduk({});
    d.resetProdukCombobox();
    d.setBulkMode(false);
    d.setBulkToml("");
    d.setShowProdukModal(true);
  };
  const produkModalProps = {
    modalProduk: d.modalProduk,
    setModalProduk: d.setModalProduk,
    bulkMode: d.bulkMode,
    setBulkMode: d.setBulkMode,
    bulkToml: d.bulkToml,
    setBulkToml: d.setBulkToml,
    bulkSubmitting: d.bulkSubmitting,
    produkMode: d.produkMode,
    produkSearchQuery: d.produkSearchQuery,
    handleProdukNameInput: d.handleProdukNameInput,
    produkSearchResults: d.produkSearchResults,
    produkSearchLoading: d.produkSearchLoading,
    produkComboboxOpen: d.produkComboboxOpen,
    selectProdukFromDropdown: d.selectProdukFromDropdown,
    selectedExistingProduk: d.selectedExistingProduk,
    daftarToko: d.daftarToko,
    merkList: d.merkList,
    kategoriListAll: d.kategoriListAll,
    satuanWhitelist: () => d.SATUAN_WHITELIST,
    saveProduk: d.saveProduk,
    handleBulkImport: d.handleBulkImport,
    resetProdukCombobox: d.resetProdukCombobox,
    submitting: () => d.submitting(),
  };

  return (
    <>
      <div class="flex min-h-screen bg-kasir-bg">
        {/* Sidebar */}
        <DashboardSidebar
          isOpen={sidebarOpen}
          activeTab={tab}
          items={sidebarItems}
          lowStockCount={d.lowStockCount}
          user={user}
          onSelect={handleTabClick}
          onLogout={handleLogout}
        />

        {/* Main content */}
        <main class="main-content lg:ml-64 p-6 lg:p-8 flex-1">
          {/* Top bar */}
          <div class="flex items-center justify-between mb-8">
            <div>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen())}
                class="lg:hidden mr-3 text-zinc-400"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <h1 class="text-2xl font-bold text-white">Dashboard</h1>
            </div>
            <div class="flex items-center gap-3">
              <button class="btn-sm btn-ghost" onClick={d.toggleTheme}>
                {d.theme() === "dark" ? "☀️" : "🌙"}
              </button>
              <button class="btn-sm btn-red" onClick={handleLogout}>
                Keluar
              </button>
            </div>
          </div>

          {/* Tabs */}
          <Show when={tab() === "overview"}>
            <OverviewTab
              stats={d.stats}
              dailyRevenue={d.dailyRevenue}
              chartDays={d.chartDays}
              chartLoading={d.chartLoading}
              lowStockCount={d.lowStockCount}
              lowStockItems={d.lowStockItems}
              loadLowStockItems={d.loadLowStockItems}
              userRole={() => user()?.role}
              userName={() => user()?.nama}
              walletRefresh={d.walletRefresh}
              setChartDays={d.setChartDays}
            />
          </Show>
          <Show when={tab() === "toko"}>
            <TokoTab
              daftarToko={d.daftarToko}
              userRole={() => user()?.role}
              onAdd={() => { d.setModalToko({}); d.setShowTokoModal(true); }}
              onEdit={d.editToko}
              onDelete={d.hapusToko}
            />
          </Show>
          <Show when={tab() === "produk"}>
            <ProdukTab
              daftarProduk={d.daftarProduk}
              lowStockCount={d.lowStockCount}
              userRole={() => user()?.role}
              getTokoNama={d.getTokoNama}
              loadLowStockItems={d.loadLowStockItems}
              onAdd={openProdukModal}
              onEdit={d.editProduk}
              onDelete={d.hapusProduk}
              onQuickRestock={d.openQuickRestock}
              selectedProdukIds={d.selectedProdukIds}
              selectedProdukCount={d.selectedProdukCount}
              isAllProdukSelected={d.isAllProdukSelected}
              toggleProdukSelection={d.toggleProdukSelection}
              selectAllProduk={d.selectAllProduk}
              clearProdukSelection={d.clearProdukSelection}
              bulkDeleteProduk={d.bulkDeleteProduk}
              setShowBulkRestockModal={d.setShowBulkRestockModal}
            />
          </Show>
          <Show when={tab() === "transaksi"}>
            <TransaksiTab
              daftarTransaksi={d.daftarTransaksi}
              getTokoNama={d.getTokoNama}
              onAdd={d.openTrxModal}
              onViewItems={d.loadTrxItems}
              onDelete={d.hapusTransaksi}
            />
          </Show>
          <Show when={tab() === "users" && canManageUsers(user()?.role)}>
            <UsersTab
              daftarUsers={d.daftarUsers}
              userRole={() => user()?.role}
              onAdd={() => { d.setModalUser({ role: "kasir" }); d.setShowUserModal(true); }}
              onEdit={d.editUser}
              onDelete={d.hapusUser}
            />
          </Show>
          <Show when={tab() === "audit" && canViewAudit(user()?.role)}>
            <AuditTab
              daftarAudit={d.daftarAudit}
              auditFilter={d.auditFilter}
              setAuditFilter={d.setAuditFilter}
              loadAudit={d.loadAudit}
            />
          </Show>
        </main>
      </div>

      {/* Modals */}
      <TokoModal
        show={d.showTokoModal()}
        onClose={() => d.setShowTokoModal(false)}
        modalToko={d.modalToko}
        setModalToko={d.setModalToko}
        saveToko={d.saveToko}
        submitting={() => d.submitting()}
      />
      <ProdukModal {...produkModalProps} show={d.showProdukModal()} onClose={closeProdukModal} />
      <UserModal
        show={d.showUserModal()}
        onClose={() => d.setShowUserModal(false)}
        modalUser={d.modalUser}
        setModalUser={d.setModalUser}
        saveUser={d.saveUser}
        submitting={() => d.submitting()}
      />
      <TrxModal
        show={d.showTrxModal()}
        onClose={() => d.setShowTrxModal(false)}
        trxForm={d.trxForm}
        setTrxForm={d.setTrxForm}
        trxItemForm={d.trxItemForm}
        setTrxItemForm={d.setTrxItemForm}
        daftarToko={d.daftarToko}
        addTrxItem={d.addTrxItem}
        removeTrxItem={d.removeTrxItem}
        saveTrx={d.saveTrx}
        trxFormSubtotal={d.trxFormSubtotal}
        trxFormTotal={d.trxFormTotal}
        submitting={() => d.submitting()}
      />
      <LowStockModal
        show={d.showLowStockModal()}
        onClose={() => d.setShowLowStockModal(false)}
        lowStockItems={d.lowStockItems}
      />

      {/* Bulk Restock */}
      <BulkRestockModal
        show={d.showBulkRestockModal}
        onClose={() => d.setShowBulkRestockModal(false)}
        items={() => {
          const sel = d.selectedProdukIds();
          return d.daftarProduk().filter((p) => sel.has(p.id));
        }}
        onSubmit={d.bulkRestockProduk}
      />

      {/* Session Timeout */}
      <SessionTimeoutModal
        show={sessionTimeout.showWarning()}
        secondsLeft={sessionTimeout.secondsLeft()}
        onExtend={sessionTimeout.extend}
        onLogout={sessionTimeout.logoutNow}
      />
    </>
  );
}
