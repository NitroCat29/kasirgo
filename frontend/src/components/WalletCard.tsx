// ============================================================
// WalletCard — saldo, top-up, riwayat transaksi wallet
// ============================================================
import { createSignal, onMount, Show, For } from "solid-js";
import { api } from "../lib/api";
import { swalConfirm, swalSuccess, swalApiError } from "../lib/swal";

interface WalletInfo {
  id: string;
  balance: number;
  updated_at: string;
}

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

const TOPUP_PRESETS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000];

function formatRp(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  return `${days} hari lalu`;
}

export default function WalletCard() {
  const [wallet, setWallet] = createSignal<WalletInfo | null>(null);
  const [history, setHistory] = createSignal<WalletTx[]>([]);
  const [showTopup, setShowTopup] = createSignal(false);
  const [customAmount, setCustomAmount] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  async function fetchWallet() {
    try {
      const data = await api<WalletInfo>("/api/wallet");
      setWallet(data);
    } catch { /* user not logged in */ }
  }

  async function fetchHistory() {
    try {
      const data = await api<{ transactions: WalletTx[] }>("/api/wallet/history?limit=5");
      setHistory(data.transactions);
    } catch { /* ignore */ }
  }

  async function doTopup(amount: number) {
    if (amount < 1000) return swalApiError({ error: "Minimal top-up Rp 1.000" });
    const ok = await swalConfirm("Konfirmasi Top-Up", `Top-up sebesar ${formatRp(amount)}?`);
    if (!ok) return;
    setLoading(true);
    try {
      const res = await api<{ balance: number }>("/api/wallet/topup", {
        method: "POST",
        body: JSON.stringify({ amount, description: `Top-up ${formatRp(amount)}` }),
      });
      setWallet((w) => w ? { ...w, balance: res.balance } : w);
      setShowTopup(false);
      setCustomAmount("");
      await fetchHistory();
      swalSuccess("Top-Up Berhasil!", `Saldo sekarang: ${formatRp(res.balance)}`);
    } catch (e: any) {
      swalApiError(e);
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    fetchWallet();
    fetchHistory();
  });

  const typeIcon: Record<string, string> = {
    topup: "💰",
    purchase: "🛒",
    refund: "↩️",
    adjustment: "⚙️",
  };

  return (
    <div class="flex flex-col h-full">
      {/* Balance display */}
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-kasir-muted text-xs uppercase tracking-wider font-medium">Saldo</p>
          <p class="text-2xl font-bold text-kasir-accent mt-1">
            {wallet() ? formatRp(wallet()!.balance) : "—"}
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-kasir-accent/10 flex items-center justify-center text-2xl">
          💳
        </div>
      </div>

      {/* Top-up button */}
      <button
        onClick={() => setShowTopup(true)}
        class="w-full py-2.5 rounded-xl bg-kasir-accent text-kasir-bg font-semibold text-sm hover:opacity-90 transition mb-4"
      >
        + Top-Up Saldo
      </button>

      {/* Recent transactions */}
      <Show when={history().length > 0}>
        <p class="text-kasir-muted text-xs uppercase tracking-wider font-medium mb-2">Riwayat</p>
        <div class="space-y-2 flex-1 overflow-y-auto max-h-[180px]">
          <For each={history()}>
            {(tx) => (
              <div class="flex items-center justify-between text-sm">
                <div class="flex items-center gap-2 min-w-0">
                  <span>{typeIcon[tx.type] || "📝"}</span>
                  <span class="truncate text-kasir-fg">{tx.description || tx.type}</span>
                </div>
                <span class={`font-mono whitespace-nowrap ${tx.type === "topup" || tx.type === "refund" ? "text-green-400" : "text-red-400"}`}>
                  {tx.type === "topup" || tx.type === "refund" ? "+" : "-"}{formatRp(tx.amount)}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Top-up modal */}
      <Show when={showTopup()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTopup(false)}>
          <div class="bg-kasir-card border border-kasir-border rounded-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 class="text-lg font-bold text-kasir-fg mb-4">Top-Up Saldo</h3>

            {/* Presets */}
            <div class="grid grid-cols-3 gap-2 mb-4">
              <For each={TOPUP_PRESETS}>
                {(amt) => (
                  <button
                    onClick={() => doTopup(amt)}
                    disabled={loading()}
                    class="py-2 px-3 rounded-xl bg-kasir-bg2 border border-kasir-border text-sm font-medium text-kasir-fg hover:border-kasir-accent hover:text-kasir-accent transition disabled:opacity-50"
                  >
                    {formatRp(amt)}
                  </button>
                )}
              </For>
            </div>

            {/* Custom amount */}
            <div class="flex gap-2">
              <input
                type="number"
                placeholder="Nominal custom..."
                value={customAmount()}
                onInput={(e) => setCustomAmount(e.currentTarget.value)}
                min="1000"
                step="1000"
                class="flex-1 bg-kasir-bg2 border border-kasir-border rounded-xl px-3 py-2 text-sm text-kasir-fg placeholder-kasir-muted focus:outline-none focus:border-kasir-accent"
              />
              <button
                onClick={() => doTopup(Number(customAmount()))}
                disabled={loading() || !customAmount()}
                class="px-4 py-2 rounded-xl bg-kasir-accent text-kasir-bg font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {loading() ? "..." : "Top-Up"}
              </button>
            </div>

            <button onClick={() => setShowTopup(false)} class="w-full mt-4 py-2 text-sm text-kasir-muted hover:text-kasir-fg transition">
              Batal
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
