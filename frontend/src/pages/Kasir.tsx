import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { user, logout, fetchMe } from "../lib/auth";
import { api } from "../lib/api";
import { useSessionTimeout } from "../lib/session-timeout";
import { SessionTimeoutModal } from "../components/ui";
import TokoDropdown from "../features/kasir/TokoDropdown";
import { createAvatar } from "@dicebear/core";
import { shapes } from "@dicebear/collection";

import { useKasirCart } from "../features/kasir/useKasirCart";
import { useKasirCatalog } from "../features/kasir/useKasirCatalog";
import { useKasirPayment } from "../features/kasir/useKasirPayment";
import KasirProductGrid from "../features/kasir/KasirProductGrid";
import KasirFotocopy from "../features/kasir/KasirFotocopy";
import { useKasirFotocopy } from "../features/kasir/useKasirFotocopy";
import KasirCartPanel from "../features/kasir/KasirCartPanel";
import {
  KasirPaymentModal,
  KasirReceiptModal,
} from "../features/kasir/KasirPaymentModal";

/* ============================================
   TYPES
   ============================================ */

interface Toko {
  id: string;
  nama: string;
}

/* ============================================
   AVATAR HELPER
   ============================================ */

function avatarDataUri(nama: string): string {
  const seed = nama || "Kasir";
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
   COMPONENT
   ============================================ */

export default function Kasir() {
  const nav = useNavigate();

  // Session timeout
  const { showWarning, secondsLeft, extend, logoutNow } = useSessionTimeout({
    onTimeout: () => nav("/login"),
    warningSeconds: 120,
  });

  // Hooks
  const cart = useKasirCart();
  const catalog = useKasirCatalog();
  const payment = useKasirPayment({
    cart: cart.cart,
    setCart: cart.setCart,
    total: cart.total,
    globalDiskon: cart.globalDiskon,
    setGlobalDiskon: cart.setGlobalDiskon,
    pajakRate: cart.ppn,
  });

  // Local state
  const [daftarToko, setDaftarToko] = createSignal<Toko[]>([]);
  const [selectedTokoId, setSelectedTokoId] = createSignal("");
  const [theme, setTheme] = createSignal<"dark" | "light">(
    (localStorage.getItem("kasir-theme") as "dark" | "light") || "dark",
  );
  const [showCart, setShowCart] = createSignal(true);

  // Jasa fotocopy: 1 jenis, 4 box preset qty, toggle 1/2 sisi
  const fotocopy = useKasirFotocopy({
    unitPrice: 500, // Rp/lembar — edit sesuai harga
    cart: cart.cart,
    setCart: cart.setCart,
  });

  function toggleTheme() {
    const next = theme() === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("kasir-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  // Toko selection handler
  function selectToko(id: string) {
    setSelectedTokoId(id);
    catalog.setSearchQuery("");
    catalog.clearSearchUrl();
    catalog.loadCatalog(id);
  }

  function decrementFromCart(produkId: string) {
    const idx = cart.cart().findIndex((c) => c.produk_id === produkId);
    if (idx === -1) return;
    const item = cart.cart()[idx];
    if (item.qty <= 1) {
      cart.removeFromCart(idx);
    } else {
      cart.updateQty(idx, -1);
    }
  }

  function removeAllFromCart(produkId: string) {
    const idx = cart.cart().findIndex((c) => c.produk_id === produkId);
    if (idx !== -1) cart.removeFromCart(idx);
  }

  // Bundle modal props agar JSX rapi
  const paymentModalProps = {
    showPaymentModal: payment.showPaymentModal,
    setShowPaymentModal: payment.setShowPaymentModal,
    paymentMethod: payment.paymentMethod,
    setPaymentMethod: payment.setPaymentMethod,
    cashReceived: payment.cashReceived,
    setCashReceived: payment.setCashReceived,
    kembalian: payment.kembalian,
    total: cart.total,
    processPayment: payment.processPayment,
    selectedTokoId: selectedTokoId,
  };
  const receiptModalProps = {
    showReceipt: payment.showReceipt,
    closeReceipt: payment.closeReceipt,
    transaksiResult: payment.transaksiResult,
    daftarToko: daftarToko,
    selectedTokoId: selectedTokoId,
    itemSubtotal: cart.itemSubtotal,
    cashReceived: payment.cashReceived,
  };

  // Load toko list
  async function loadToko() {
    try {
      const data = await api<Toko[]>("/api/toko");
      setDaftarToko(data);
      if (data.length > 0 && !selectedTokoId()) {
        setSelectedTokoId(data[0].id);
      }
    } catch {}
  }

  // Keyboard shortcuts
  onMount(() => {
    function handleKeydown(e: KeyboardEvent) {
      const search = document.getElementById("product-search");
      if (e.key === "/" && document.activeElement !== search) {
        e.preventDefault();
        search?.focus();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        search?.focus();
        return;
      }
      if (e.key === "Escape" && document.activeElement === search) {
        catalog.setSearchQuery("");
        catalog.clearSearchUrl();
        (search as HTMLInputElement).blur();
        return;
      }
      if (e.key === "Enter" && document.activeElement === search) {
        e.preventDefault();
        const first = catalog.filteredCatalog()[0];
        if (first && first.stok > 0) cart.addToCart(first);
        return;
      }
    }
    document.addEventListener("keydown", handleKeydown);
    onCleanup(() => document.removeEventListener("keydown", handleKeydown));
  });

  // Init
  onMount(async () => {
    if (!user()) {
      const me = await fetchMe();
      if (!me) {
        nav("/login");
        return;
      }
    }
    await loadToko();
    await catalog.loadCatalog(selectedTokoId());
  });

  return (
    <div class="h-screen bg-kasir-bg flex flex-col overflow-hidden">
      {/* Header */}
      <header class="bg-kasir-card border-b border-kasir-border px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <A href="/" class="flex items-center gap-2">
            <img src="/assets/kasirku_logo.svg" alt="KasirGo" class="w-8 h-8" />
            <span class="text-xl font-bold text-kasir-accent">KasirGo</span>
          </A>
          <span class="text-sm text-kasir-muted">| POS</span>
        </div>
        <div class="flex items-center gap-3">
          <TokoDropdown
            daftarToko={daftarToko}
            selectedTokoId={selectedTokoId}
            onSelect={selectToko}
          />
          <button class="btn-sm btn-ghost" onClick={toggleTheme}>
            {theme() === "dark" ? "☀️" : "🌙"}
          </button>
          <div class="flex items-center gap-2">
            <img
              class="kasir-avatar"
              src={avatarDataUri(user()?.nama || "")}
              alt={user()?.nama || "Kasir"}
            />
            <Show when={user()}>
              <span class="text-sm text-kasir-muted hidden sm:inline">
                {user()!.nama}
              </span>
            </Show>
            <button
              class="btn-sm btn-ghost text-kasir-muted hover:text-red-400"
              onClick={logout}
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Main content — catalog + cart sidebar */}
      <div class="flex-1 flex overflow-hidden min-h-0">
        <div class="flex-1 flex flex-col p-4 overflow-y-auto min-h-0 pb-20 lg:pb-4">
          <KasirFotocopy
            unitPrice={fotocopy.unitPrice}
            qty={fotocopy.qty}
            doubleSided={fotocopy.doubleSided}
            effLembar={fotocopy.effLembar}
            setQty={fotocopy.setQty}
            addQty={fotocopy.addQty}
            toggleDoubleSided={fotocopy.toggleDoubleSided}
            setDoubleSided={fotocopy.setDoubleSided}
            reset={fotocopy.reset}
          />
          <KasirProductGrid
            searchQuery={catalog.searchQuery}
            onSearchInput={catalog.onSearchInput}
            catalogLoading={catalog.catalogLoading}
            filteredCatalog={catalog.filteredCatalog}
            kategoriList={catalog.kategoriList}
            kategoriFilter={catalog.kategoriFilter}
            setKategoriFilter={catalog.setKategoriFilter}
            highlightMatch={catalog.highlightMatch}
            addToCart={cart.addToCart}
            decrementFromCart={decrementFromCart}
            removeAllFromCart={removeAllFromCart}
            cart={cart.cart}
          />
        </div>

        {/* Cart panel — sidebar on desktop, slide-up sheet on mobile */}
        <KasirCartPanel
          show={showCart()}
          cart={cart.cart}
          setCart={cart.setCart}
          globalDiskon={cart.globalDiskon}
          setGlobalDiskon={cart.setGlobalDiskon}
          pajakRate={cart.ppn}
          setPajakRate={cart.setPpn}
          ppnEnabled={cart.ppnEnabled}
          setPpnEnabled={cart.setPpnEnabled}
          itemSubtotal={cart.itemSubtotal}
          subtotal={cart.subtotal}
          total={cart.total}
          updateQty={cart.updateQty}
          updateDiskon={cart.updateDiskon}
          removeFromCart={cart.removeFromCart}
          openPaymentModal={payment.openPaymentModal}
        />
      </div>

      {/* Cart toggle button — mobile only, fixed bottom-right */}
      <button
        class="lg:hidden fixed bottom-4 right-4 z-60 btn-sm bg-kasir-accent text-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2"
        onClick={() => setShowCart((v) => !v)}
      >
        🛒 {cart.cart().length}
        {showCart() ? " ▼" : " ▲"}
      </button>

      {/* Payment Modal */}
      <KasirPaymentModal {...paymentModalProps} />

      {/* Receipt Modal */}
      <KasirReceiptModal {...receiptModalProps} />

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
