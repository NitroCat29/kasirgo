import { Show, For, createSignal, onMount, onCleanup } from "solid-js";
import { SkeletonStatCard } from "../../../components/ui";
import RevenueChart from "../../../components/RevenueChart";
import WalletCard from "../../../components/WalletCard";
import { formatRupiah, relativeTime } from "../../../lib/format";
import type { Stats, DailyRevenue, LowStockItem } from "../../../components/dashboard/types";

/* ============================================
   TYPES
   ============================================ */

export interface OverviewTabProps {
  stats: () => Stats | null;
  dailyRevenue: () => DailyRevenue[];
  chartLoading: () => boolean;
  lowStockCount: () => number;
  lowStockItems: () => LowStockItem[];
  loadLowStockItems: () => void;
  userRole: () => string | undefined;
  walletRefresh?: () => number;
}

/* ============================================
   COMPONENT
   ============================================ */

export default function OverviewTab(props: OverviewTabProps) {
  // Live badge: update tiap detik, tunjukkan kapan data terakhir refresh
  const [lastUpdate, setLastUpdate] = createSignal(new Date());
  let tick: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    tick = setInterval(() => setLastUpdate(new Date(lastUpdate())), 1000);
  });
  onCleanup(() => {
    if (tick) clearInterval(tick);
  });

  return (
    <div class="fade-in">
      {/* Live indicator */}
      <div class="flex items-center gap-2 mb-3 text-xs text-zinc-400">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span>Live · update {relativeTime(lastUpdate())}</span>
      </div>
      {/* Row 1: Stat cards — 4 small bento boxes */}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <For
          each={[
            { label: "Toko", value: props.stats()?.toko, icon: "🏪" },
            { label: "Produk", value: props.stats()?.produk, icon: "📦" },
            {
              label: "Trx Hari Ini",
              value: props.stats()?.transaksi_hari_ini,
              icon: "🧾",
            },
            {
              label: "Pendapatan Hari Ini",
              value: props.stats()?.pendapatan_hari_ini,
              icon: "💰",
              isRupiah: true,
            },
          ]}
        >
          {(card) => (
            <Show when={props.stats()} fallback={<SkeletonStatCard />}>
              <div class="glass rounded-2xl p-4 border border-kasir-border hover:border-kasir-border-strong transition-colors">
                <span class="text-2xl">{card.icon}</span>
                <p class="text-2xl font-bold text-kasir-fg mt-2">
                  {card.isRupiah
                    ? formatRupiah(card.value)
                    : (card.value ?? 0).toLocaleString("id-ID")}
                </p>
                <p class="text-xs text-kasir-muted mt-1">
                  {card.label}
                </p>
              </div>
            </Show>
          )}
        </For>
      </div>

      {/* Row 2: Revenue Chart (2/3) + Wallet (1/3) */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div class="lg:col-span-2 glass rounded-2xl p-5 border border-kasir-border">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-kasir-fg">
              Pendapatan Harian
            </h3>
            <span class="text-xs text-kasir-muted">
              30 hari terakhir
            </span>
          </div>
          <RevenueChart
            data={props.dailyRevenue()}
            loading={props.chartLoading()}
          />
        </div>
        <div class="glass rounded-2xl p-5 border border-kasir-border">
          <WalletCard walletRefresh={props.walletRefresh} />
        </div>
      </div>

      {/* Row 3: Total stats (2 boxes) */}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div class="glass rounded-2xl p-5 border border-kasir-border">
          <p class="text-kasir-muted text-xs uppercase tracking-wider font-medium mb-1">
            Total Transaksi
          </p>
          <p class="text-xl font-bold text-kasir-fg">
            {(props.stats()?.transaksi ?? 0).toLocaleString("id-ID")}
          </p>
          <p class="text-xs text-kasir-muted mt-1">semua waktu</p>
        </div>
        <div class="glass rounded-2xl p-5 border border-kasir-border">
          <p class="text-kasir-muted text-xs uppercase tracking-wider font-medium mb-1">
            Total Pendapatan
          </p>
          <p class="text-xl font-bold text-kasir-accent">
            {formatRupiah(props.stats()?.total_pendapatan)}
          </p>
          <p class="text-xs text-kasir-muted mt-1">semua waktu</p>
        </div>
      </div>

      {/* Row 4: Low stock alerts (admin/manajer only) */}
      <Show when={props.userRole() === "admin" || props.userRole() === "manajer"}>
        <div class="glass rounded-2xl p-5 border border-kasir-border">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-kasir-fg">
              ⚠️ Stok Menipis
            </h3>
            <Show when={props.lowStockCount() > 0}>
              <span class="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                {props.lowStockCount()} produk
              </span>
            </Show>
          </div>
          <Show
            when={props.lowStockCount() > 0}
            fallback={
              <p class="text-sm text-kasir-muted">
                Semua produk stok aman ✅
              </p>
            }
          >
            <button
              class="text-sm text-kasir-accent hover:underline"
              onClick={props.loadLowStockItems}
            >
              Lihat detail →
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
