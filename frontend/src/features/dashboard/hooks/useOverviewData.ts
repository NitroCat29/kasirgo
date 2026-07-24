import { createSignal } from "solid-js";
import { api } from "../../../lib/api";
import { swalApiError } from "../../../lib/swal";
import type {
  AuditLog,
  DailyRevenue,
  LowStockItem,
  Stats,
} from "../../../components/dashboard/types";
import type { ToastLoadError } from "./loadError";

export interface OverviewDataDeps {
  toastLoadError: ToastLoadError;
}

export function useOverviewData(deps: OverviewDataDeps) {
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [walletRefresh, setWalletRefresh] = createSignal(0);

  // --- Audit ---
  const [daftarAudit, setDaftarAudit] = createSignal<AuditLog[]>([]);
  const [auditFilter, setAuditFilter] = createSignal<string>("");

  async function loadAudit(filter = "") {
    try {
      const url = filter
        ? `/api/audit-logs?entity_type=${encodeURIComponent(filter)}`
        : "/api/audit-logs";
      const data = await api<{ rows: AuditLog[] }>(url);
      setDaftarAudit(data.rows);
    } catch (err) {
      deps.toastLoadError("audit", err);
    }
  }

  // --- Chart / alerts ---
  const [dailyRevenue, setDailyRevenue] = createSignal<DailyRevenue[]>([]);
  const [chartLoading, setChartLoading] = createSignal(true);
  const [lowStockCount, setLowStockCount] = createSignal(0);
  const [lowStockItems, setLowStockItems] = createSignal<LowStockItem[]>([]);
  const [showLowStockModal, setShowLowStockModal] = createSignal(false);

  const [chartDays, _setChartDays] = createSignal(30);
  function setChartDays(n: number) {
    _setChartDays(n);
    setTimeout(loadDailyRevenue, 0);
  }

  async function loadDailyRevenue() {
    setChartLoading(true);
    try {
      const d = await api<{ days: number; data: DailyRevenue[] }>(
        `/api/stats/daily-revenue?days=${chartDays()}`,
      );
      setDailyRevenue(d.data);
    } catch (err) {
      deps.toastLoadError("chart pendapatan", err);
    } finally {
      setChartLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await api<Stats>("/api/stats");
      setStats(data);
    } catch (err) {
      deps.toastLoadError("stats", err);
    }
  }

  async function loadAlerts() {
    try {
      const data = await api<{ low_stock: number }>("/api/alerts/summary");
      setLowStockCount(data.low_stock ?? 0);
    } catch (err) {
      deps.toastLoadError("alerts", err);
    }
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

  return {
    stats,
    setStats,
    walletRefresh,
    setWalletRefresh,
    daftarAudit,
    auditFilter,
    setAuditFilter,
    loadAudit,
    dailyRevenue,
    chartDays,
    setChartDays,
    chartLoading,
    lowStockCount,
    lowStockItems,
    showLowStockModal,
    setShowLowStockModal,
    loadDailyRevenue,
    loadStats,
    loadAlerts,
    loadLowStockItems,
  };
}
