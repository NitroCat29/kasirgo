import { Show, For, createSignal, createMemo, onMount, onCleanup } from "solid-js";
import { SkeletonStatCard } from "../../../components/ui";
import RevenueChart from "../../../components/RevenueChart";
import WalletCard from "../../../components/WalletCard";
import { formatRupiah, relativeTime } from "../../../lib/format";
import type { Stats, DailyRevenue, LowStockItem } from "../../../components/dashboard/types";

export interface OverviewTabProps {
  stats: () => Stats | null;
  dailyRevenue: () => DailyRevenue[];
  chartDays: () => number;
  chartLoading: () => boolean;
  lowStockCount: () => number;
  lowStockItems: () => LowStockItem[];
  loadLowStockItems: () => void;
  userRole: () => string | undefined;
  userName: () => string | undefined;
  walletRefresh?: () => number;
  setChartDays?: (n: number) => void;
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Selamat Pagi";
  if (h < 15) return "Selamat Siang";
  if (h < 18) return "Selamat Sore";
  return "Selamat Malam";
}

function trendPct(data: DailyRevenue[]): number | null {
  if (data.length < 2) return null;
  const today = data[data.length - 1]?.revenue || 0;
  const yesterday = data[data.length - 2]?.revenue || 0;
  if (yesterday === 0) return today > 0 ? 100 : null;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

export default function OverviewTab(props: OverviewTabProps) {
  const [lastUpdate, setLastUpdate] = createSignal(new Date());
  let tick: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    tick = setInterval(() => setLastUpdate(new Date(lastUpdate())), 1000);
  });
  onCleanup(() => { if (tick) clearInterval(tick); });

  const trend = createMemo(() => trendPct(props.dailyRevenue()));

  const greetingName = () => props.userName() || "User";

  const cards = createMemo(() => [
    {
      label: "Toko", value: props.stats()?.toko,
      icon: <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />,
      gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      accent: "text-emerald-400",
    },
    {
      label: "Produk", value: props.stats()?.produk,
      icon: <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />,
      gradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
      accent: "text-indigo-400",
    },
    {
      label: "Trx Hari Ini", value: props.stats()?.transaksi_hari_ini,
      icon: <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3.75-6h.008v.008H18V12zm0 3h.008v.008H18V15zm0 3h.008v.008H18V18m-7.5 3h.008v.008H10.5V21z" />,
      gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
      accent: "text-amber-400",
    },
    {
      label: "Pendapatan Hari Ini", value: props.stats()?.pendapatan_hari_ini,
      isRupiah: true as const,
      icon: <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
      accent: "text-rose-400",
      trend: trend(),
    },
  ]);

  return (
    <div class="fade-in space-y-4">
      {/* Greeting banner */}
      <div class="glass rounded-2xl p-5 border border-kasir-border bg-gradient-to-r from-kasir-accent/5 via-transparent to-transparent">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 class="text-xl font-bold text-kasir-fg">
              {timeGreeting()}, {greetingName()} 👋
            </h2>
            <p class="text-sm text-kasir-muted mt-1">
              {props.stats()?.transaksi_hari_ini
                ? `Sudah ada ${props.stats()?.transaksi_hari_ini} transaksi hari ini`
                : "Belum ada transaksi hari ini"}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <a href="/kasir" class="btn-sm bg-kasir-accent text-white rounded-lg px-4 py-2 font-semibold hover:brightness-110 transition-all">
              ⚡ Buka POS
            </a>
            <span class="flex items-center gap-1.5 text-xs text-kasir-muted">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {relativeTime(lastUpdate())}
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <For each={cards()}>{(card) => (
          <Show when={props.stats()} fallback={<SkeletonStatCard />}>
            <div class={`relative overflow-hidden rounded-2xl p-4 border border-kasir-border hover:border-kasir-border-strong transition-all duration-200 bg-gradient-to-br ${card.gradient}`}>
              <div class={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${card.accent} mb-3`}>
                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">{card.icon}</svg>
              </div>
              <p class="text-2xl font-extrabold text-kasir-fg tracking-tight">
                {card.isRupiah ? formatRupiah(card.value) : (card.value ?? 0).toLocaleString("id-ID")}
              </p>
              <p class="text-xs text-kasir-muted mt-1 flex items-center gap-2">
                {card.label}
                <Show when={card.trend != null && card.label === "Pendapatan Hari Ini"}>
                  <span class={`inline-flex items-center gap-0.5 text-xs font-semibold ${card.trend! >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d={card.trend! >= 0 ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} />
                    </svg>
                    {card.trend! >= 0 ? "+" : ""}{card.trend}%
                  </span>
                </Show>
              </p>
            </div>
          </Show>
        )}</For>
      </div>

      {/* Revenue chart (2/3) + Wallet (1/3) */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 glass rounded-2xl p-5 border border-kasir-border">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-sm font-semibold text-kasir-fg">
                Pendapatan Harian
                <span class="text-kasir-muted font-normal"> · {props.chartDays()} hari</span>
              </h3>
            </div>
            <div class="flex gap-1 bg-white/5 rounded-lg p-0.5">
              {[7, 30, 90].map((n) => (
                <button
                  class={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    props.chartDays() === n
                      ? "bg-kasir-accent text-white shadow-sm"
                      : "text-kasir-muted hover:text-kasir-fg hover:bg-white/5"
                  }`}
                  onClick={() => props.setChartDays?.(n)}
                >
                  {n}d
                </button>
              ))}
            </div>
          </div>
          <RevenueChart data={props.dailyRevenue()} days={props.chartDays()} loading={props.chartLoading()} />
        </div>
        <div>
          <WalletCard walletRefresh={props.walletRefresh} />
        </div>
      </div>

      {/* Low stock alert */}
      <Show when={props.userRole() === "admin" || props.userRole() === "manajer"}>
        <div class="glass rounded-2xl p-5 border border-kasir-border">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-kasir-fg">Stok Menipis</h3>
                <p class="text-xs text-kasir-muted">{props.lowStockCount()} produk perlu restock</p>
              </div>
            </div>
            <Show when={props.lowStockCount() > 0}>
              <button class="text-sm text-kasir-accent hover:underline font-medium" onClick={props.loadLowStockItems}>
                Lihat Detail →
              </button>
            </Show>
          </div>
          {/* Progress bar */}
          <Show when={props.stats() && props.stats()!.produk > 0}>
            <div class="mt-2">
              <div class="flex justify-between text-xs text-kasir-muted mb-1">
                <span>Stok aman</span>
                <span>{props.lowStockCount()} / {props.stats()?.produk ?? 0} menipis</span>
              </div>
              <div class="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, ((props.lowStockCount() / (props.stats()?.produk || 1)) * 100))}%` }}
                />
              </div>
            </div>
          </Show>
          <Show when={props.lowStockCount() === 0}>
            <p class="text-sm text-emerald-400 mt-1">Semua produk stok aman ✅</p>
          </Show>
        </div>
      </Show>

      {/* Total Pendapatan (ringkasan di bawah) */}
      <Show when={props.stats()}>
        <div class="glass rounded-2xl p-4 border border-kasir-border flex items-center justify-between">
          <span class="text-sm text-kasir-muted">Total Pendapatan (semua waktu)</span>
          <span class="text-lg font-bold text-kasir-accent">{formatRupiah(props.stats()!.total_pendapatan)}</span>
        </div>
      </Show>
    </div>
  );
}
