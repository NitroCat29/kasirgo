import { createSignal, createEffect, onMount, Show, For } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { user, logout, fetchMe } from "../lib/auth";
import { api, csrfHeaders } from "../lib/api";
import { swalConfirm, swalSuccess, swalApiError, swalToast, swalWarning } from "../lib/swal";
import { calculateTotal } from "../lib/wasm";
import { useSessionTimeout } from "../lib/session-timeout";
import { SessionTimeoutModal, EmptyState } from "../components/ui";

/* ============================================
   TYPES
   ============================================ */
interface Produk {
  id: string;
  sku: string;
  nama: string;
  harga: number;
  stok: number;
  toko_id: string;
}

interface CartItem {
  produk_id: string;
  sku: string;
  nama: string;
  harga: number;
  qty: number;
  diskon: number; // 0-100
  stok_tersedia: number;
}

interface Toko {
  id: string;
  nama: string;
}

interface TransaksiResult {
  id: string;
  total: number;
  created_at: string;
  items: CartItem[];
  kembalian?: number;
  method?: "tunai" | "non-tunai";
}

/* ============================================
   HELPERS
   ============================================ */
function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

/* ============================================
   MAIN COMPONENT
   ============================================ */
export default function Kasir() {
  const nav = useNavigate();

  // Session timeout
  const { showTimeout, secondsLeft, extendSession, logoutNow } = useSessionTimeout({
    idleMs: 25 * 60 * 1000,
    warningMs: 2 * 60 * 1000,
    onTimeout: () => nav("/login"),
  });

  // Toko selection
  const [daftarToko, setDaftarToko] = createSignal<Toko[]>([]);
  const [selectedTokoId, setSelectedTokoId] = createSignal<string>("");

  // Product search
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<Produk[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = createSignal(false);
  const [searching, setSearching] = createSignal(false);

  // Cart
  const [cart, setCart] = createSignal<CartItem[]>([]);

  // Summary
  const [globalDiskon, setGlobalDiskon] = createSignal(0); // 0-100
  const [pajakRate, setPajakRate] = createSignal(11); // default 11%

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = createSignal(false);
  const [paymentMethod, setPaymentMethod] = createSignal<"tunai" | "non-tunai">("tunai");
  const [cashReceived, setCashReceived] = createSignal("");
  const [transaksiResult, setTransaksiResult] = createSignal<TransaksiResult | null>(null);
  const [showReceipt, setShowReceipt] = createSignal(false);

  // Theme
  const [theme, setTheme] = createSignal<"dark" | "light">(
    (localStorage.getItem("kasir-theme") as "dark" | "light") || "dark"
  );
  function toggleTheme() {
    const next = theme() === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("kasir-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  /* ============================================
     INIT
     ============================================ */
  createEffect(async () => {
    if (!user()) {
      const me = await fetchMe();
      if (!me) {
        nav("/login");
        return;
      }
    }
    await loadToko();
  });

  async function loadToko() {
    try {
      const data = await api<Toko[]>("/api/toko");
      setDaftarToko(data);
      if (data.length > 0 && !selectedTokoId()) {
        setSelectedTokoId(data[0].id);
      }
    } catch {}
  }

  /* ============================================
     PRODUCT SEARCH
     ============================================ */
  let searchTimeout: ReturnType<typeof setTimeout>;
  function onSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    setSearchQuery(val);
    clearTimeout(searchTimeout);
    if (val.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    searchTimeout = setTimeout(() => doSearch(val), 300);
  }

  async function doSearch(q: string) {
    setSearching(true);
    try {
      const data = await api<Produk[]>(`/api/produk?search=${encodeURIComponent(q)}&toko_id=${selectedTokoId()}`);
      setSearchResults(data);
      setShowSearchDropdown(data.length > 0);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function addToCart(p: Produk) {
    const existing = cart().find((c) => c.produk_id === p.id);
    if (existing) {
      if (existing.qty >= p.stok) {
        swalWarning(`Stok ${p.nama} tidak cukup`);
        return;
      }
      setCart(cart().map((c) => (c.produk_id === p.id ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      setCart([...cart(), { produk_id: p.id, sku: p.sku, nama: p.nama, harga: p.harga, qty: 1, diskon: 0, stok_tersedia: p.stok }]);
    }
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchDropdown(false);
    // Focus back to search
    setTimeout(() => document.getElementById("product-search")?.focus(), 50);
  }

  function updateQty(idx: number, delta: number) {
    const item = cart()[idx];
    const newQty = item.qty + delta;
    if (newQty < 1) return;
    if (newQty > item.stok_tersedia) {
      swalWarning(`Stok maksimal: ${item.stok_tersedia}`);
      return;
    }
    setCart(cart().map((c, i) => (i === idx ? { ...c, qty: newQty } : c)));
  }

  function updateDiskon(idx: number, val: string) {
    const diskon = Math.max(0, Math.min(100, Number(val) || 0));
    setCart(cart().map((c, i) => (i === idx ? { ...c, diskon } : c)));
  }

  function removeFromCart(idx: number) {
    setCart(cart().filter((_, i) => i !== idx));
  }

  /* ============================================
     CALCULATIONS
     ============================================ */
  function itemSubtotal(item: CartItem): number {
    const afterDiskon = item.harga * (1 - item.diskon / 100);
    return afterDiskon * item.qty;
  }

  function subtotal(): number {
    return cart().reduce((sum, item) => sum + itemSubtotal(item), 0);
  }

  function afterGlobalDiskon(): number {
    return subtotal() * (1 - globalDiskon() / 100);
  }

  function pajak(): number {
    return afterGlobalDiskon() * (pajakRate() / 100);
  }

  function total(): number {
    return afterGlobalDiskon() + pajak();
  }

  function kembalian(): number {
    const received = Number(cashReceived()) || 0;
    return received - total();
  }

  /* ============================================
     PAYMENT
     ============================================ */
  function openPaymentModal() {
    if (cart().length === 0) {
      swalWarning("Keranjang kosong");
      return;
    }
    setShowPaymentModal(true);
    setCashReceived("");
    setPaymentMethod("tunai");
  }

  async function processPayment() {
    if (paymentMethod() === "tunai") {
      const received = Number(cashReceived()) || 0;
      if (received < total()) {
        swalWarning("Uang tunai kurang");
        return;
      }
    }

    const items = cart().map((c) => ({
      produk_id: c.produk_id,
      nama: c.nama,
      harga: c.harga,
      qty: c.qty,
      diskon: c.diskon,
    }));

    try {
      const res = await fetch("/api/transaksi", {
        method: "POST",
        headers: csrfHeaders(),
        credentials: "include",
        body: JSON.stringify({
          toko_id: selectedTokoId(),
          total: Math.round(total()),
          tax_rate: pajakRate(),
          discount_rate: globalDiskon(),
          items,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setTransaksiResult({
        id: result.id,
        total: result.total,
        created_at: result.created_at,
        items: cart(),
        kembalian: paymentMethod() === "tunai" ? kembalian() : undefined,
        method: paymentMethod(),
      });
      setShowPaymentModal(false);
      setShowReceipt(true);
      swalSuccess("Transaksi berhasil!");
      // Clear cart
      setCart([]);
      setGlobalDiskon(0);
      setCashReceived("");
    } catch (err: any) {
      swalApiError(err);
    }
  }

  function closeReceipt() {
    setShowReceipt(false);
    setTransaksiResult(null);
  }

  /* ============================================
     RENDER
     ============================================ */
  return (
    <div class="min-h-screen bg-kasir-bg flex flex-col">
      {/* Header */}
      <header class="bg-kasir-surface border-b border-kasir-border px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <A href="/" class="flex items-center gap-2">
            <img src="/assets/kasirku_logo.svg" alt="KasirGo" class="w-8 h-8" />
            <span class="text-xl font-bold text-kasir-accent">KasirGo</span>
          </A>
          <span class="text-sm text-kasir-muted">| POS</span>
        </div>
        <div class="flex items-center gap-3">
          {/* Toko selector */}
          <select
            class="input-sm w-48"
            value={selectedTokoId()}
            onChange={(e) => setSelectedTokoId(e.currentTarget.value)}
          >
            <For each={daftarToko()}>
              {(t) => <option value={t.id}>{t.nama}</option>}
            </For>
          </select>
          {/* Theme toggle */}
          <button class="btn-sm btn-ghost" onClick={toggleTheme}>
            {theme() === "dark" ? "☀️" : "🌙"}
          </button>
          {/* User info */}
          <span class="text-sm text-kasir-muted">{user()?.nama}</span>
          {/* Nav to dashboard if admin/manajer */}
          <Show when={user()?.role === "admin" || user()?.role === "manajer"}>
            <A href="/dashboard" class="btn-sm btn-ghost">
              Dashboard
            </A>
          </Show>
          <button class="btn-sm btn-red" onClick={() => logout()}>
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <div class="flex-1 flex">
        {/* Left: Product search + cart */}
        <div class="flex-1 flex flex-col p-4 gap-4">
          {/* Product search */}
          <div class="relative">
            <input
              id="product-search"
              type="text"
              class="input w-full"
              placeholder="Cari produk (nama atau SKU)..."
              value={searchQuery()}
              onInput={onSearchInput}
              onFocus={() => searchResults().length > 0 && setShowSearchDropdown(true)}
              onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
              autofocus
            />
            <Show when={searching()}>
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-kasir-muted">Mencari...</span>
            </Show>
            {/* Search dropdown */}
            <Show when={showSearchDropdown()}>
              <div class="absolute top-full left-0 right-0 mt-1 bg-kasir-surface border border-kasir-border rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
                <For each={searchResults()}>
                  {(p) => (
                    <button
                      class="w-full px-4 py-3 text-left hover:bg-kasir-hover flex justify-between items-center border-b border-kasir-border last:border-0"
                      onClick={() => addToCart(p)}
                    >
                      <div>
                        <div class="font-medium">{p.nama}</div>
                        <div class="text-xs text-kasir-muted">SKU: {p.sku}</div>
                      </div>
                      <div class="text-right">
                        <div class="text-kasir-accent font-semibold">{formatRupiah(p.harga)}</div>
                        <div class="text-xs text-kasir-muted">Stok: {p.stok}</div>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Cart */}
          <div class="flex-1 bg-kasir-surface rounded-xl border border-kasir-border overflow-hidden flex flex-col">
            <div class="px-4 py-3 border-b border-kasir-border font-semibold">
              🛒 Keranjang ({cart().length} item)
            </div>
            <div class="flex-1 overflow-y-auto">
              <Show when={cart().length === 0}>
                <EmptyState type="cart" description="Keranjang kosong. Cari produk untuk mulai transaksi." />
              </Show>
              <Show when={cart().length > 0}>
                <table class="w-full">
                  <thead class="bg-kasir-bg sticky top-0">
                    <tr class="text-left text-sm text-kasir-muted">
                      <th class="px-4 py-2">Produk</th>
                      <th class="px-4 py-2 text-right">Harga</th>
                      <th class="px-4 py-2 text-center">Qty</th>
                      <th class="px-4 py-2 text-center">Diskon %</th>
                      <th class="px-4 py-2 text-right">Subtotal</th>
                      <th class="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={cart()}>
                      {(item, idx) => (
                        <tr class="border-t border-kasir-border hover:bg-kasir-hover">
                          <td class="px-4 py-3">
                            <div class="font-medium">{item.nama}</div>
                            <div class="text-xs text-kasir-muted">{item.sku}</div>
                          </td>
                          <td class="px-4 py-3 text-right">{formatRupiah(item.harga)}</td>
                          <td class="px-4 py-3">
                            <div class="flex items-center justify-center gap-1">
                              <button class="btn-xs btn-ghost" onClick={() => updateQty(idx(), -1)}>−</button>
                              <input
                                type="number"
                                class="input-xs w-14 text-center"
                                value={item.qty}
                                onChange={(e) => {
                                  const val = Number(e.currentTarget.value);
                                  if (val >= 1 && val <= item.stok_tersedia) {
                                    setCart(cart().map((c, i) => (i === idx() ? { ...c, qty: val } : c)));
                                  }
                                }}
                              />
                              <button class="btn-xs btn-ghost" onClick={() => updateQty(idx(), 1)}>+</button>
                            </div>
                          </td>
                          <td class="px-4 py-3">
                            <input
                              type="number"
                              class="input-xs w-16 text-center"
                              min="0"
                              max="100"
                              value={item.diskon}
                              onChange={(e) => updateDiskon(idx(), e.currentTarget.value)}
                            />
                          </td>
                          <td class="px-4 py-3 text-right font-semibold">{formatRupiah(itemSubtotal(item))}</td>
                          <td class="px-4 py-3">
                            <button class="btn-xs btn-red" onClick={() => removeFromCart(idx())}>✕</button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Show>
            </div>
          </div>
        </div>

        {/* Right: Summary + Pay button */}
        <div class="w-80 bg-kasir-surface border-l border-kasir-border p-4 flex flex-col gap-4">
          <h3 class="font-semibold text-lg">Ringkasan</h3>

          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-kasir-muted">Subtotal</span>
              <span>{formatRupiah(subtotal())}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-kasir-muted">Diskon</span>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  class="input-xs w-16 text-right"
                  min="0"
                  max="100"
                  value={globalDiskon()}
                  onChange={(e) => setGlobalDiskon(Math.max(0, Math.min(100, Number(e.currentTarget.value) || 0)))}
                />
                <span>%</span>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-kasir-muted">PPN</span>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  class="input-xs w-16 text-right"
                  min="0"
                  max="100"
                  value={pajakRate()}
                  onChange={(e) => setPajakRate(Math.max(0, Math.min(100, Number(e.currentTarget.value) || 0)))}
                />
                <span>%</span>
              </div>
            </div>
            <div class="border-t border-kasir-border pt-2 mt-2">
              <div class="flex justify-between text-lg font-bold">
                <span>TOTAL</span>
                <span class="text-kasir-accent">{formatRupiah(total())}</span>
              </div>
            </div>
          </div>

          <div class="flex-1"></div>

          <button class="btn btn-indigo w-full text-lg py-4" onClick={openPaymentModal} disabled={cart().length === 0}>
            💰 Bayar
          </button>

          <button class="btn btn-ghost w-full" onClick={() => setCart([])} disabled={cart().length === 0}>
            🗑️ Kosongkan Keranjang
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      <Show when={showPaymentModal()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
          <div class="bg-kasir-surface rounded-xl p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 class="text-xl font-bold mb-4">Pembayaran</h3>

            <div class="mb-4">
              <div class="flex gap-2 mb-4">
                <button
                  class={`flex-1 py-2 rounded-lg font-medium ${paymentMethod() === "tunai" ? "bg-kasir-accent text-white" : "bg-kasir-bg text-kasir-muted"}`}
                  onClick={() => setPaymentMethod("tunai")}
                >
                  💵 Tunai
                </button>
                <button
                  class={`flex-1 py-2 rounded-lg font-medium ${paymentMethod() === "non-tunai" ? "bg-kasir-accent text-white" : "bg-kasir-bg text-kasir-muted"}`}
                  onClick={() => setPaymentMethod("non-tunai")}
                >
                  💳 Non-Tunai
                </button>
              </div>

              <Show when={paymentMethod() === "tunai"}>
                <div class="space-y-2">
                  <label class="text-sm text-kasir-muted">Total</label>
                  <div class="text-2xl font-bold text-kasir-accent">{formatRupiah(total())}</div>

                  <label class="text-sm text-kasir-muted mt-4">Uang Diterima</label>
                  <input
                    type="number"
                    class="input w-full text-xl"
                    placeholder="0"
                    value={cashReceived()}
                    onInput={(e) => setCashReceived(e.currentTarget.value)}
                    autofocus
                  />

                  {/* Quick cash buttons */}
                  <div class="grid grid-cols-3 gap-2 mt-2">
                    {[50000, 100000, 200000].map((amt) => (
                      <button class="btn-sm btn-ghost" onClick={() => setCashReceived(String(amt))}>
                        {formatRupiah(amt)}
                      </button>
                    ))}
                  </div>

                  <Show when={Number(cashReceived()) >= total()}>
                    <div class="mt-4 p-3 bg-green-500/20 rounded-lg">
                      <div class="text-sm text-kasir-muted">Kembalian</div>
                      <div class="text-xl font-bold text-green-400">{formatRupiah(kembalian())}</div>
                    </div>
                  </Show>
                </div>
              </Show>

              <Show when={paymentMethod() === "non-tunai"}>
                <div class="text-center py-8">
                  <div class="text-4xl mb-2">💳</div>
                  <div class="text-kasir-muted">Pembayaran non-tunai</div>
                  <div class="text-sm text-kasir-muted mt-2">(QRIS / Debit / Credit Card)</div>
                </div>
              </Show>
            </div>

            <div class="flex gap-2">
              <button class="btn btn-ghost flex-1" onClick={() => setShowPaymentModal(false)}>
                Batal
              </button>
              <button class="btn btn-indigo flex-1" onClick={processPayment}>
                Proses
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Receipt Modal */}
      <Show when={showReceipt() && transaksiResult()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeReceipt}>
          <div class="bg-white text-black rounded-xl p-6 w-80 max-w-[90vw] font-mono text-sm" onClick={(e) => e.stopPropagation()}>
            <div class="text-center mb-4">
              <div class="text-lg font-bold">KasirGo</div>
              <div class="text-xs">
                {daftarToko().find((t) => t.id === selectedTokoId())?.nama}
              </div>
              <div class="text-xs mt-1">{new Date(transaksiResult()!.created_at).toLocaleString("id-ID")}</div>
              <div class="text-xs">No: {transaksiResult()!.id.slice(0, 8).toUpperCase()}</div>
            </div>

            <div class="border-t border-b border-gray-300 py-2 space-y-1">
              <For each={transaksiResult()!.items}>
                {(item) => (
                  <div>
                    <div class="flex justify-between">
                      <span class="truncate">{item.nama}</span>
                    </div>
                    <div class="flex justify-between text-xs text-gray-600">
                      <span>
                        {item.qty} x {formatRupiah(item.harga)}
                        {item.diskon > 0 && ` (-${item.diskon}%)`}
                      </span>
                      <span>{formatRupiah(itemSubtotal(item))}</span>
                    </div>
                  </div>
                )}
              </For>
            </div>

            <div class="py-2 space-y-1">
              <div class="flex justify-between font-bold text-base">
                <span>TOTAL</span>
                <span>{formatRupiah(transaksiResult()!.total)}</span>
              </div>
              <Show when={transaksiResult()!.method === "tunai"}>
                <div class="flex justify-between">
                  <span>Tunai</span>
                  <span>{formatRupiah(Number(cashReceived()) || transaksiResult()!.total + (transaksiResult()!.kembalian || 0))}</span>
                </div>
                <div class="flex justify-between">
                  <span>Kembali</span>
                  <span>{formatRupiah(transaksiResult()!.kembalian || 0)}</span>
                </div>
              </Show>
              <Show when={transaksiResult()!.method === "non-tunai"}>
                <div class="text-center text-xs text-gray-600">Pembayaran Non-Tunai</div>
              </Show>
            </div>

            <div class="text-center text-xs text-gray-500 mt-4">
              Terima kasih atas kunjungan Anda!
            </div>

            <div class="flex gap-2 mt-4">
              <button class="btn btn-ghost flex-1 text-black border-gray-300" onClick={closeReceipt}>
                Tutup
              </button>
              <button class="btn btn-indigo flex-1" onClick={() => window.print()}>
                🖨️ Cetak
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Session Timeout Modal */}
      <SessionTimeoutModal
        show={showTimeout()}
        secondsLeft={secondsLeft()}
        onExtend={extendSession}
        onLogout={logoutNow}
      />
    </div>
  );
}
