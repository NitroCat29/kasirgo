// ============================================================
// WalletCard — saldo, top-up, riwayat transaksi wallet
// Top-up requires admin role + valid TOTP code
// ============================================================
import { createSignal, createEffect, onMount, Show, For } from "solid-js";
import { api } from "../lib/api";
import { user } from "../lib/auth";
import { swalConfirm, swalSuccess, swalApiError } from "../lib/swal";
import { toast } from "../lib/toast";

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

interface TotpStatus {
  enabled: boolean;
  hasSecret: boolean;
}

const TOPUP_PRESETS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000];
const MIN_TOPUP = 10_000;

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

export default function WalletCard(props?: { walletRefresh?: () => number; tokoId?: string }) {
  const [wallet, setWallet] = createSignal<WalletInfo | null>(null);
  const [history, setHistory] = createSignal<WalletTx[]>([]);
  const [showTopup, setShowTopup] = createSignal(false);
  const [customAmount, setCustomAmount] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  // TOTP state
  const [totpStatus, setTotpStatus] = createSignal<TotpStatus | null>(null);
  const [topupCode, setTopupCode] = createSignal("");
  const [topupAmount, setTopupAmount] = createSignal(0);
  const [submitting, setSubmitting] = createSignal(false);

  const isAdmin = () => user()?.role === "admin";
  const totpEnabled = () => totpStatus()?.enabled ?? false;
  const tokoId = () => props?.tokoId || "";

  async function fetchWallet() {
    try {
      if (!tokoId()) return;
      const data = await api<WalletInfo>(`/api/wallet?toko_id=${tokoId()}`);
      setWallet(data);
    } catch { /* user not logged in or no toko */ }
  }

  async function fetchHistory() {
    try {
      if (!tokoId()) return;
      const data = await api<{ transactions: WalletTx[] }>(`/api/wallet/history?toko_id=${tokoId()}&limit=5`);
      setHistory(data.transactions ?? []);
    } catch { /* ignore */ }
  }

  async function fetchTotpStatus() {
    if (!isAdmin()) return;
    try {
      const s = await api<TotpStatus>("/api/v1/auth/totp/status");
      setTotpStatus(s);
    } catch {
      setTotpStatus({ enabled: false, hasSecret: false });
    }
  }

  async function handleTopup(amount: number) {
    if (!isAdmin()) return;

    if (!totpEnabled()) {
      return;
    }

    setTopupAmount(amount);
    setTopupCode("");
    setShowTopup(true);
  }

  async function submitTopup() {
    const code = topupCode().trim();
    const amount = topupAmount();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) return;
    if (amount <= 0) return;

    setSubmitting(true);
    try {
      const res = await api<{ balance: number }>("/api/wallet/topup", {
        method: "POST",
        body: JSON.stringify({ amount, code, toko_id: tokoId() }),
      });
      setWallet({ ...wallet()!, balance: res.balance });
      setShowTopup(false);
      setTopupCode("");
      setTopupAmount(0);
      swalSuccess(`Top-up ${formatRp(amount)} berhasil!`);
      fetchHistory();
    } catch (e: any) {
      swalApiError(e);
    } finally {
      setSubmitting(false);
    }
  }

  function closeTopup() {
    setShowTopup(false);
    setTopupCode("");
    setTopupAmount(0);
    setCustomAmount("");
  }

  function applyCustomAmount() {
    const amt = parseInt(customAmount(), 10);
    if (!Number.isFinite(amt) || amt < MIN_TOPUP) {
      toast.error("Top-up wajib diatas Rp. 10.000");
      return;
    }
    setTopupAmount(amt);
    setCustomAmount("");
  }

  onMount(() => {
    fetchWallet();
    fetchHistory();
    fetchTotpStatus();
  });

  createEffect(() => {
    const _refresh = props?.walletRefresh?.();
    fetchWallet();
    fetchHistory();
    fetchTotpStatus();
  });

  return (
    <div class="bg-kasir-card border border-kasir-border rounded-xl overflow-hidden">
      {/* Header: Balance */}
      <div class="p-4 border-b border-kasir-border">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-xs font-semibold text-kasir-muted uppercase tracking-wider">Saldo Kas</h3>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium">WALLET</span>
        </div>
        <p class="text-2xl font-bold text-white">
          {wallet() ? formatRp(wallet()!.balance) : "—"}
        </p>
        <Show when={wallet()}>
          <p class="text-[11px] text-kasir-muted mt-0.5">
            Update: {timeAgo(wallet()!.updated_at)}
          </p>
        </Show>
      </div>

      {/* Top-up button (admin only + TOTP enabled) */}
      <Show when={isAdmin() && totpEnabled()}>
        <div class="p-3 border-b border-kasir-border">
          <button
            class="w-full btn-sm btn-indigo text-xs"
            onClick={() => {
              // Show amount picker first
              setTopupAmount(0);
              setShowTopup(true);
            }}
          >
            ➕ Top-up Saldo
          </button>
        </div>
      </Show>

      {/* Warning for admin without TOTP */}
      <Show when={isAdmin() && !totpEnabled() && totpStatus() !== null}>
        <div class="p-3 border-b border-kasir-border">
          <div class="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span class="text-sm">⚠️</span>
            <p class="text-[11px] text-amber-400">
              Aktifkan 2FA di tab <strong>Keamanan</strong> untuk bisa top-up.
            </p>
          </div>
        </div>
      </Show>

      {/* History */}
      <div class="p-3">
        <p class="text-[11px] font-semibold text-kasir-muted uppercase tracking-wider mb-2">Riwayat</p>
        <Show
          when={history().length > 0}
          fallback={<p class="text-xs text-kasir-muted italic">Belum ada transaksi</p>}
        >
          <div class="space-y-1.5">
            <For each={history()}>
              {(tx) => (
                <div class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class={`shrink-0 ${tx.type === "topup" || tx.type === "refund" ? "text-emerald-400" : "text-red-400"}`}>
                      {tx.type === "topup" || tx.type === "refund" ? "+" : "−"}
                    </span>
                    <span class="truncate text-kasir-text">{tx.description || tx.type}</span>
                  </div>
                  <span class={`shrink-0 font-medium ${tx.type === "topup" || tx.type === "refund" ? "text-emerald-400" : "text-red-400"}`}>
                    {tx.type === "topup" || tx.type === "refund" ? "+" : "−"}{formatRp(Math.abs(tx.amount))}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* ============================================
          TOPUP MODAL — amount picker + TOTP code
          ============================================ */}
      <Show when={showTopup()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeTopup();
          }}
        >
          <div class="bg-kasir-card border border-kasir-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div class="flex items-start justify-between gap-3 mb-1">
              <h3 class="text-lg font-bold text-white">Top-up Saldo</h3>
              <button
                type="button"
                class="btn-sm btn-ghost px-2 py-1 text-kasir-muted hover:text-white"
                aria-label="Tutup modal top-up"
                onClick={closeTopup}
              >
                ✕
              </button>
            </div>

            {/* Amount picker (if not yet selected) */}
            <Show when={topupAmount() === 0}>
              <p class="text-sm text-kasir-muted mb-3">Pilih nominal:</p>
              <div class="grid grid-cols-3 gap-2 mb-3">
                <For each={TOPUP_PRESETS}>
                  {(amt) => (
                    <button
                      class="btn-sm btn-ghost text-xs py-2"
                      onClick={() => setTopupAmount(amt)}
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
                  min={MIN_TOPUP}
                  step={1000}
                  placeholder="Custom (minimal Rp10.000)"
                  class="input-field flex-1 text-xs"
                  value={customAmount()}
                  onInput={(e) => setCustomAmount(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyCustomAmount();
                  }}
                />
                <button
                  class="btn-sm btn-indigo text-xs"
                  disabled={!customAmount()}
                  onClick={applyCustomAmount}
                >
                  Pilih
                </button>
              </div>
              <p class="text-[10px] text-kasir-muted mt-2">Minimal top-up custom: {formatRp(MIN_TOPUP)}</p>
            </Show>

            {/* TOTP code entry */}
            <Show when={topupAmount() > 0}>
              <div class="space-y-3">
                <div class="flex items-center justify-between p-3 rounded-lg bg-black/20">
                  <span class="text-sm text-kasir-muted">Nominal</span>
                  <span class="text-sm font-bold text-white">{formatRp(topupAmount())}</span>
                </div>

                <div>
                  <label class="block text-xs text-kasir-muted mb-1">Kode TOTP 6 digit</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxlength={6}
                    placeholder="000000"
                    class="input-field w-full text-center text-xl tracking-[0.5em] font-mono"
                    value={topupCode()}
                    onInput={(e) => setTopupCode(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(e) => { if (e.key === "Enter" && topupCode().length === 6) submitTopup(); }}
                    autofocus
                  />
                  <p class="text-[10px] text-kasir-muted mt-1">
                    Masukkan kode dari Google Authenticator / Authy.
                  </p>
                </div>

                <div class="flex gap-2">
                  <button
                    class="btn-sm btn-indigo flex-1"
                    disabled={submitting() || topupCode().length !== 6}
                    onClick={submitTopup}
                  >
                    {submitting() ? "Memproses..." : "Top-up Sekarang"}
                  </button>
                  <button class="btn-sm btn-ghost" onClick={closeTopup}>
                    Batal
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
