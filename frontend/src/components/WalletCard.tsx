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

  const typeIcon: Record<string, { path: string; color: string }> = {
    topup: { path: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "#10b981" },
    purchase: { path: "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z", color: "#f59e0b" },
    refund: { path: "M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3", color: "#06b6d4" },
    adjustment: { path: "M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93s.844.083 1.186-.12l.726-.447c.51-.31 1.19-.14 1.445.384.254.526.19 1.14-.132 1.52l-.696.813c-.263.304-.304.713-.093 1.036l.546.802c.456.664.342 1.567-.26 2.026-.6.46-1.542.504-2.194.094l-.732-.463a1.25 1.25 0 00-1.426.08l-.732.463c-.652.41-1.592.367-2.194-.094-.602-.459-.716-1.362-.26-2.026l.546-.802c.211-.323.17-.732-.093-1.036l-.696-.813c-.322-.38-.386-.994-.132-1.52.254-.52.834-.69 1.445-.384l.726.447c.342.205.742.168 1.186.12s.71-.276.78-.93l.149-.894z M15 12a3 3 0 11-6 0 3 3 0 016 0z", color: "#8b5cf6" },
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
        <div class="w-12 h-12 rounded-xl bg-kasir-accent/10 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="var(--color-kasir-accent)" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" /></svg>
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
                  {(() => {
                    const icon = typeIcon[tx.type];
                    return icon ? (
                      <span class="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center" style={{ "background": `${icon.color}15` }}>
                        <svg class="w-3.5 h-3.5" fill="none" stroke={icon.color} stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d={icon.path} /></svg>
                      </span>
                    ) : (
                      <span class="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center bg-white/5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="#71717a" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      </span>
                    );
                  })()}
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
