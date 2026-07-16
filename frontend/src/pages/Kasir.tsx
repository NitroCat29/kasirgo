import { createSignal, createEffect, onMount, onCleanup, Show, For } from "solid-js";
import { toast } from "../lib/toast";
import { useNavigate, A, useSearchParams } from "@solidjs/router";
import { user, logout, fetchMe } from "../lib/auth";
import { api, csrfHeaders } from "../lib/api";
import { swalConfirm, swalSuccess, swalApiError, swalToast, swalWarning } from "../lib/swal";
import { calculateTotal } from "../lib/wasm";
import { useSessionTimeout } from "../lib/session-timeout";
import { SessionTimeoutModal, EmptyState } from "../components/ui";
import gsap from "gsap";
import { createAvatar } from "@dicebear/core";
import { shapes } from "@dicebear/collection";

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
  const { showWarning, secondsLeft, extend, logoutNow } = useSessionTimeout({
    onTimeout: () => nav("/login"),
  });

  // Toko selection
  const [daftarToko, setDaftarToko] = createSignal<Toko[]>([]);
  const [selectedTokoId, setSelectedTokoId] = createSignal<string>("");

  // URL-synced search query
  const [searchParams, setSearchParams] = useSearchParams();

  // Product catalog + search filter
  const [catalogProduk, setCatalogProduk] = createSignal<Produk[]>([]);
  const [searchQuery, setSearchQuery] = createSignal((searchParams as any).q || "");
  const [kategoriFilter, setKategoriFilter] = createSignal<string>("");

function highlightMatch(text: string, query: string): string {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.replace(regex, '<mark class="kasir-highlight">$1</mark>');
  }

  // Extract unique categories from SKU prefix (e.g., "BRG-001" → "BRG")
  function kategoriList(): string[] {
    const prefixes = new Set<string>();
    catalogProduk().forEach((p) => {
      const prefix = p.sku.split("-")[0] || p.sku.substring(0, 3);
      prefixes.add(prefix);
    });
    return Array.from(prefixes).sort();
  }

  // Enhanced filter: search query + kategori
  function filteredCatalog(): Produk[] {
    const q = searchQuery().toLowerCase().trim();
    const kat = kategoriFilter();
    return catalogProduk().filter((p) => {
      const matchSearch = !q || p.nama.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchKat = !kat || p.sku.startsWith(kat);
      return matchSearch && matchKat;
    });
  }
  const [catalogLoading, setCatalogLoading] = createSignal(false);



  // Helpers for initial values (IIFE so signal gets plain value, not () => T)
  function loadCartInitial(): CartItem[] {
    try {
      const stored = localStorage.getItem("kasir-cart");
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  function loadNum(key: string): number {
    try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
  }

  // Cart
  const [cart, setCart] = createSignal<CartItem[]>(loadCartInitial());
  createEffect(() => {
    const items = cart();
    localStorage.setItem("kasir-cart", JSON.stringify(items));
    const totalQty = items.reduce((sum, c) => sum + c.qty, 0);
    document.title = totalQty > 0 ? `(${totalQty}) KasirGo` : "KasirGo";
  });

  // Summary
  const [globalDiskon, setGlobalDiskon] = createSignal<number>(loadNum("kasir-diskon"));
  createEffect(() => localStorage.setItem("kasir-diskon", String(globalDiskon())));
  const [pajakRate, setPajakRate] = createSignal<number>(loadNum("kasir-ppn"));
  createEffect(() => localStorage.setItem("kasir-ppn", String(pajakRate())));
  const [ppnEnabled, setPpnEnabled] = createSignal<boolean>(
    (() => {
      try {
        return localStorage.getItem("kasir-ppn-enabled") === "true";
      } catch {
        return false;
      }
    })()
  );
  createEffect(() => localStorage.setItem("kasir-ppn-enabled", String(ppnEnabled())));

  // Custom dropdown toko state
  const [showTokoDropdown, setShowTokoDropdown] = createSignal(false);
  let tokoDropdownPanel: HTMLDivElement | undefined;
  let tokoDropdownTrigger: HTMLButtonElement | undefined;

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
     CUSTOM DROPDOWN TOKO (GSAP animasi)
     ============================================ */
  function toggleTokoDropdown() {
    const open = !showTokoDropdown();
    setShowTokoDropdown(open);
    if (tokoDropdownTrigger) tokoDropdownTrigger.classList.toggle("open", open);
    if (tokoDropdownPanel) {
      if (open) {
        gsap.fromTo(tokoDropdownPanel, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" });
      } else {
        gsap.to(tokoDropdownPanel, { opacity: 0, y: -8, duration: 0.15, ease: "power2.in", onComplete: () => setShowTokoDropdown(false) });
      }
    }
  }
  function selectToko(id: string) {
    setSelectedTokoId(id);
    setSearchQuery("");
    setSearchParams({}); // clear URL param
    toggleTokoDropdown(); // tutup
    loadCatalog(id); // reload catalog untuk toko baru
  }

  /* ============================================
     AVATAR KASIR (DiceBear shapes, deterministic)
     ============================================ */
  function avatarDataUri(nama: string): string {
    const seed = nama || "Kasir";
    // Palette theme: emerald accent + indigo + amber + accent2 (orange)
    const avatar = createAvatar(shapes, {
      seed,
      backgroundColor: ["0a0e1a", "131826", "1a2033"],
      shape1Color: ["00d9a3", "10b981"],
      shape2Color: ["6366f1", "8b5cf6"],
      shape3Color: ["ff8a3d", "f59e0b"],
      backgroundType: ["solid"],
    });
    return avatar.toDataUri();
  }

  /* ============================================
     INIT
     ============================================ */
  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    const search = document.getElementById("product-search");
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      search?.focus();
      return;
    }
    if (e.key === "Escape" && document.activeElement === search) {
      setSearchQuery("");
      setSearchParams({});
      (search as HTMLInputElement).blur();
      return;
    }
    if (e.key === "Enter" && document.activeElement === search) {
      e.preventDefault();
      const first = filteredCatalog()[0];
      if (first && first.stok > 0) addToCart(first);
      return;
    }
  }
  document.addEventListener("keydown", handleKeydown);
  onCleanup(() => document.removeEventListener("keydown", handleKeydown));

  createEffect(async () => {
    if (!user()) {
      const me = await fetchMe();
      if (!me) {
        nav("/login");
        return;
      }
    }
    await loadToko();
    // Load full catalog untuk toko terpilih
    await loadCatalog(selectedTokoId());
    // Jika ada ?q= di URL, set search query (client-side filter otomatis jalan)
    const initQ = (searchParams as any).q;
    if (initQ) setSearchQuery(initQ);
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
     PRODUCT CATALOG (load all, client-side filter)
     ============================================ */
  async function loadCatalog(tokoId: string) {
    if (!tokoId) return;
    setCatalogLoading(true);
    try {
      const data = await api<Produk[]>(`/api/produk?toko_id=${tokoId}`);
      setCatalogProduk(data);
    } catch {
      setCatalogProduk([]);
    } finally {
      setCatalogLoading(false);
    }
  }

  function onSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    setSearchQuery(val);
    if (val.trim()) setSearchParams({ q: val.trim() });
    else setSearchParams({});
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
    toast.success(`${p.nama} ditambahkan ke keranjang`);
    // Scroll cart to bottom to show new item
    setTimeout(() => {
      const cartBody = document.querySelector(".kasir-cart-scroll");
      if (cartBody) cartBody.scrollTop = cartBody.scrollHeight;
    }, 50);
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
    <div class="h-screen bg-kasir-bg flex flex-col overflow-hidden">
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
          {/* Toko selector — custom dropdown */}
          <div class="kasir-dropdown-wrap">
            <button
              ref={tokoDropdownTrigger}
              class="kasir-dropdown-trigger"
              onClick={toggleTokoDropdown}
              onBlur={() => setTimeout(() => { if (showTokoDropdown()) toggleTokoDropdown(); }, 180)}
            >
              <span class="truncate">{daftarToko().find((t) => t.id === selectedTokoId())?.nama || "Pilih toko"}</span>
              <svg class="caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <Show when={showTokoDropdown()}>
              <div ref={tokoDropdownPanel} class="kasir-dropdown-panel">
                <For each={daftarToko()}>
                  {(t) => (
                    <div
                      class={`kasir-dropdown-option ${t.id === selectedTokoId() ? "selected" : ""}`}
                      onMouseDown={(e) => { e.preventDefault(); selectToko(t.id); }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
                      <span class="truncate">{t.nama}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
          {/* Theme toggle */}
          <button class="btn-sm btn-ghost" onClick={toggleTheme}>
            {theme() === "dark" ? "☀️" : "🌙"}
          </button>
          {/* User info — avatar DiceBear initials */}
          <div class="flex items-center gap-2">
            <img class="kasir-avatar" src={avatarDataUri(user()?.nama || "")} alt={user()?.nama || "Kasir"} />
            <span class="text-sm text-kasir-muted hidden sm:inline">{user()?.nama}</span>
          </div>
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
      <div class="flex-1 flex flex-col md:flex-row">
        {/* Left: Product search + catalog grid */}
        <div class="flex-1 flex flex-col p-4 gap-4 overflow-y-auto min-h-0">
          {/* Search bar */}
          <input
            id="product-search"
            type="text"
            class="kasir-input w-full"
            placeholder="Filter produk (nama atau SKU)..."
            value={searchQuery()}
            onInput={onSearchInput}
            autofocus
          />

          {/* Product catalog grid */}
          <div class="kasir-catalog">
            <Show when={catalogLoading()}>
              <div class="text-center py-8 text-kasir-muted">Memuat produk...</div>
            </Show>
            <Show when={!catalogLoading() && filteredCatalog().length === 0}>
              <EmptyState type="search" title="Tidak Ada Produk" description={searchQuery() ? `Tidak ada produk cocok dengan "${searchQuery()}"` : "Belum ada produk di toko ini."} />
            </Show>
            <Show when={kategoriList().length > 1}>
              <div class="kasir-kategori-bar">
                <button classList={{ active: kategoriFilter() === "" }} onClick={() => setKategoriFilter("")}>Semua</button>
                <For each={kategoriList()}>
                  {(kat) => (
                    <button classList={{ active: kategoriFilter() === kat }} onClick={() => setKategoriFilter(kat)}>{kat}</button>
                  )}
                </For>
              </div>
            </Show>
            <Show when={!catalogLoading() && filteredCatalog().length > 0}>
              <div class="kasir-catalog-grid">
                <For each={filteredCatalog()}>
                  {(p) => {
                    const inCart = () => cart().find((c) => c.produk_id === p.id);
                    return (
                      <button
                        class="kasir-catalog-card"
                        classList={{ "kasir-catalog-in-cart": !!inCart() }}
                        onClick={(e) => {
                          addToCart(p);
                          const btn = e.currentTarget;
                          btn.classList.add("kasir-catalog-bounce");
                          setTimeout(() => btn.classList.remove("kasir-catalog-bounce"), 300);
                        }}
                        disabled={p.stok === 0}
                      >
                        <div class="kasir-catalog-card-header">
                          <span class="kasir-catalog-sku" innerHTML={highlightMatch(p.sku, searchQuery())}></span>
                          <span class="kasir-catalog-stok" classList={{ "kasir-catalog-stok-low": p.stok <= 5 }}>
                            Stok: {p.stok}
                          </span>
                        </div>
                        <div class="kasir-catalog-nama" innerHTML={highlightMatch(p.nama, searchQuery())}></div>
                        <div class="kasir-catalog-harga">{formatRupiah(p.harga)}</div>
                        <Show when={p.stok > 0}>
                          <div class="kasir-catalog-quickqty" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => addToCart(p)}>+1</button>
                            <Show when={p.stok >= 5}>
                              <button onClick={() => { for (let i = 0; i < 5; i++) addToCart(p); }}>+5</button>
                            </Show>
                            <Show when={p.stok >= 10}>
                              <button onClick={() => { for (let i = 0; i < 10; i++) addToCart(p); }}>+10</button>
                            </Show>
                          </div>
                        </Show>
                        <Show when={p.stok > 0 && p.stok <= 5}>
                          <div class="kasir-catalog-stok-warn">Stok hampir habis!</div>
                        </Show>
                        <Show when={!!inCart()}>
                          <div class="kasir-catalog-badge">{inCart()!.qty}x di keranjang</div>
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>

        </div>
        {/* Right: Cart + Summary + Pay — fixed panel */}
        <div class="w-full md:w-80 border-t md:border-t-0 md:border-l border-kasir-border flex flex-col bg-kasir-surface shrink-0 md:h-full md:max-h-full h-[55vh]">
          {/* Cart header */}
          <div class="px-4 py-3 border-b border-kasir-border font-semibold shrink-0">
            🛒 Keranjang ({cart().length} item)
          </div>

          {/* Cart items — scrollable */}
          <div class="flex-1 overflow-y-auto min-h-0 overscroll-contain kasir-cart-scroll">
            <Show when={cart().length === 0}>
              <EmptyState type="cart" title="Keranjang Kosong" description="Pilih produk dari katalog untuk mulai transaksi." />
            </Show>
            <Show when={cart().length > 0}>
              <table class="w-full">
                <thead class="bg-kasir-bg sticky top-0">
                  <tr class="text-left text-sm text-kasir-muted">
                    <th class="px-3 py-2">Produk</th>
                    <th class="px-3 py-2 text-center">Qty</th>
                    <th class="px-3 py-2 text-right">Subtotal</th>
                    <th class="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  <For each={cart()}>
                    {(item, idx) => (
                      <tr class="border-t border-kasir-border hover:bg-kasir-hover">
                        <td class="px-3 py-2">
                          <div class="font-medium text-sm">{item.nama}</div>
                          <div class="text-xs text-kasir-muted">{formatRupiah(item.harga)}{item.diskon > 0 && ` (-${item.diskon}%)`}</div>
                        </td>
                        <td class="px-3 py-2">
                          <div class="flex items-center justify-center gap-1">
                            <button class="btn-xs btn-ghost" onClick={() => updateQty(idx(), -1)}>−</button>
                            <input
                              type="text"
                              inputmode="numeric"
                              class="w-8 text-center text-sm font-medium bg-transparent border-b border-kasir-border focus:border-kasir-accent outline-none"
                              value={item.qty}
                              onFocus={(e) => e.currentTarget.select()}
                              onBlur={(e) => {
                                const val = parseInt(e.currentTarget.value) || 1;
                                const clamped = Math.max(1, Math.min(item.stok_tersedia, val));
                                setCart(cart().map((c, i) => i === idx() ? { ...c, qty: clamped } : c));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              }}
                            />
                            <button
                              class="btn-xs btn-ghost"
                              onClick={() => updateQty(idx(), 1)}
                              onMouseDown={(e) => {
                                const interval = setInterval(() => updateQty(idx(), 1), 200);
                                const up = () => { clearInterval(interval); window.removeEventListener("mouseup", up); };
                                window.addEventListener("mouseup", up);
                              }}
                              onTouchStart={(e) => {
                                const interval = setInterval(() => updateQty(idx(), 1), 200);
                                const end = () => { clearInterval(interval); window.removeEventListener("touchend", end); };
                                window.addEventListener("touchend", end);
                              }}
                            >+</button>
                          </div>
                        </td>
                        <td class="px-3 py-2 text-right text-sm font-semibold">{formatRupiah(itemSubtotal(item))}</td>
                        <td class="px-3 py-2">
                          <button class="btn-xs btn-red" onClick={() => removeFromCart(idx())}>✕</button>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </div>

          {/* Summary — fixed bottom */}
          <div class="border-t border-kasir-border p-4 space-y-2 shrink-0 bg-kasir-surface">
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
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    class="input-xs w-16 text-right kasir-input"
                    value={globalDiskon()}
                    onInput={(e) => {
                      const raw = e.currentTarget.value.replace(/[^0-9]/g, "");
                      const clamped = Math.max(0, Math.min(100, Number(raw) || 0));
                      e.currentTarget.value = String(clamped);
                      setGlobalDiskon(clamped);
                    }}
                  />
                  <span>%</span>
                </div>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-kasir-muted">PPN</span>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    class="input-xs w-16 text-right kasir-input"
                    value={pajakRate()}
                    disabled={!ppnEnabled()}
                    onInput={(e) => {
                      const raw = e.currentTarget.value.replace(/[^0-9]/g, "");
                      const clamped = Math.max(0, Math.min(100, Number(raw) || 0));
                      e.currentTarget.value = String(clamped);
                      setPajakRate(clamped);
                    }}
                  />
                  <span>%</span>
                  <label class="flex items-center gap-1 cursor-pointer select-none ml-1">
                    <input
                      type="checkbox"
                      class="ppn-checkbox"
                      checked={ppnEnabled()}
                      onChange={(e) => {
                        const en = e.currentTarget.checked;
                        setPpnEnabled(en);
                        if (!en) setPajakRate(0);
                      }}
                    />
                    <span class="text-xs text-kasir-muted">Aktifkan</span>
                  </label>
                </div>
              </div>
              <div class="border-t border-kasir-border pt-2 mt-2">
                <div class="flex justify-between text-lg font-bold">
                  <span>TOTAL</span>
                  <span class="text-kasir-accent">{formatRupiah(total())}</span>
                </div>
              </div>
            </div>

            <button class="btn-bayar w-full" onClick={openPaymentModal} disabled={cart().length === 0}>
              💰 Bayar
            </button>
            <button class="btn btn-ghost w-full" onClick={() => { if (cart().length === 0) return; if (confirm("Yakin kosongkan keranjang?")) { setCart([]); toast.info("Keranjang dikosongkan"); } }} disabled={cart().length === 0}>
              🗑️ Kosongkan
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Show when={showPaymentModal()}>
        <div class="fixed inset-0 payment-overlay flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
          <div class="payment-modal-box p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
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
              <button class="btn-bayar flex-1" onClick={processPayment} style={{ "font-size": "15px", padding: "12px" }}>
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
        show={showWarning()}
        secondsLeft={secondsLeft()}
        onExtend={extend}
        onLogout={logoutNow}
      />
    </div>
  );
}
