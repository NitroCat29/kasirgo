import { Show, For, createEffect } from "solid-js";
import type { JSX } from "solid-js";
import { EmptyState } from "../../components/ui";
import { formatRupiah } from "../../lib/format";
import type { Produk, CartItem } from "./useKasirCart";
import gsap from "gsap";

/* ============================================
   TYPES
   ============================================ */

export interface KasirProductGridProps {
  searchQuery: () => string;
  onSearchInput: (e: Event) => void;
  catalogLoading: () => boolean;
  filteredCatalog: () => Produk[];
  kategoriList: () => string[];
  kategoriFilter: () => string;
  setKategoriFilter: (v: string) => void;
  highlightMatch: (text: string, query: string) => string | JSX.Element;
  addToCart: (p: Produk) => void;
  decrementFromCart: (produkId: string) => void;
  removeAllFromCart: (produkId: string) => void;
  cart: () => CartItem[];
}

/* ============================================
   COMPONENT
   ============================================ */

export default function KasirProductGrid(props: KasirProductGridProps) {
  function getCartQty(id: string): number {
    return props.cart().find((c) => c.produk_id === id)?.qty || 0;
  }

  return (
    <>
      {/* Search bar */}
      <input
        id="product-search"
        type="text"
        class="kasir-input w-full"
        placeholder="Filter produk (nama atau SKU)..."
        value={props.searchQuery()}
        onInput={props.onSearchInput}
        ref={(el) => setTimeout(() => el.focus(), 0)}
      />

      {/* Kategori filter chips */}
      <Show when={props.kategoriList().length > 0}>
        <div class="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            class={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              props.kategoriFilter() === ""
                ? "bg-kasir-accent text-white border-kasir-accent"
                : "border-kasir-border text-kasir-muted hover:text-white"
            }`}
            onClick={() => props.setKategoriFilter("")}
          >
            Semua
          </button>
          <For each={props.kategoriList()}>
            {(k) => (
              <button
                type="button"
                class={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  props.kategoriFilter() === k
                    ? "bg-kasir-accent text-white border-kasir-accent"
                    : "border-kasir-border text-kasir-muted hover:text-white"
                }`}
                onClick={() => props.setKategoriFilter(k)}
              >
                {k}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Product catalog grid */}
      <div class="mt-3">
        <Show when={props.catalogLoading()}>
          <div class="text-center py-8 text-kasir-muted">Memuat produk...</div>
        </Show>
        <Show
          when={!props.catalogLoading() && props.filteredCatalog().length === 0}
        >
          <EmptyState
            type="search"
            title="Tidak Ada Produk"
            description={
              props.searchQuery()
                ? `Tidak ada produk cocok dengan "${props.searchQuery()}"`
                : "Tidak ada produk di kategori ini"
            }
          />
        </Show>
        <div
          class="grid gap-3"
          style={{
            "grid-template-columns": "repeat(auto-fill, minmax(150px, 1fr))",
          }}
        >
          <For each={props.filteredCatalog()}>
            {(p) => {
              const qty = () => getCartQty(p.id);
              const habis = () => p.stok <= 0;
              let cardRef: HTMLButtonElement | undefined;
              let progressRef: HTMLDivElement | undefined;
              let holdTimer: ReturnType<typeof setTimeout> | undefined;
              let longPress = false;

              // Glow hijau + grow saat item terpilih (qty > 0)
              createEffect(() => {
                if (!cardRef) return;
                if (qty() > 0) {
                  gsap.to(cardRef, {
                    scale: 1.045,
                    boxShadow:
                      "0 0 0 2px rgba(16,185,129,0.9), 0 0 18px 3px rgba(16,185,129,0.35)",
                    duration: 0.28,
                    ease: "back.out(2)",
                  });
                } else {
                  gsap.to(cardRef, {
                    scale: 1,
                    boxShadow: "0 0 0 0px rgba(16,185,129,0)",
                    duration: 0.2,
                    ease: "power2.out",
                  });
                }
              });

              function clearHold() {
                clearTimeout(holdTimer);
                holdTimer = undefined;
                if (progressRef)
                  gsap.to(progressRef, { scaleX: 0, duration: 0.15 });
              }

              function onMouseDown(e: MouseEvent) {
                if (e.button !== 2 || habis()) return;
                longPress = false;
                if (progressRef) {
                  gsap.fromTo(
                    progressRef,
                    { scaleX: 0 },
                    { scaleX: 1, duration: 3, ease: "none" },
                  );
                }
                holdTimer = setTimeout(() => {
                  longPress = true;
                  props.removeAllFromCart(p.id);
                  if (cardRef) {
                    gsap.fromTo(
                      cardRef,
                      { x: -6 },
                      { x: 0, duration: 0.4, ease: "elastic.out(1, 0.3)" },
                    );
                  }
                }, 3000);
              }

              function onMouseUp(e: MouseEvent) {
                if (e.button !== 2) return;
                clearHold();
                if (!longPress && !habis()) props.decrementFromCart(p.id);
              }

              return (
                <button
                  ref={cardRef}
                  type="button"
                  disabled={habis()}
                  class={`relative flex flex-col text-left rounded-xl border-2 border-transparent p-3 overflow-hidden ${
                    habis()
                      ? "bg-kasir-card/40 opacity-50 cursor-not-allowed"
                      : "bg-kasir-card hover:border-kasir-border"
                  }`}
                  onClick={() => !habis() && props.addToCart(p)}
                  onMouseDown={onMouseDown}
                  onMouseUp={onMouseUp}
                  onMouseLeave={clearHold}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <Show when={qty() > 0}>
                    <span class="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                      {qty()}
                    </span>
                  </Show>
                  <div class="text-sm font-semibold text-white leading-snug line-clamp-2 pr-6 min-h-[2.5em]">
                    {props.highlightMatch(p.nama, props.searchQuery())}
                  </div>
                  <div class="text-xs text-kasir-muted truncate mt-0.5">
                    {props.highlightMatch(p.sku || "-", props.searchQuery())}
                  </div>
                  <div class="text-base font-bold text-kasir-accent mt-1.5">
                    {formatRupiah(p.harga)}
                  </div>
                  <div class="text-xs text-kasir-muted mt-0.5">
                    Stok: {p.stok}
                  </div>
                  <div
                    class={`mt-2 rounded-md text-xs font-semibold text-center py-1 ${
                      qty() > 0
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-kasir-accent/15 text-kasir-accent"
                    }`}
                  >
                    {habis()
                      ? "Stok Habis"
                      : qty() > 0
                        ? "Klik kanan: −1"
                        : "+1"}
                  </div>
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </>
  );
}
