import { createSignal, createMemo, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "../../lib/api";
import type { Produk } from "./useKasirCart";

/* ============================================
   HOOK
   ============================================ */

export function useKasirCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Signals ---
  const [catalogProduk, setCatalogProduk] = createSignal<Produk[]>([]);
  const [kategoriFilter, setKategoriFilter] = createSignal<string>("");
  const [catalogLoading, setCatalogLoading] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal<string>(
    (searchParams as any).q || "",
  );

  // --- Highlight ---
  function highlightMatch(text: string, query: string): string | JSX.Element {
    if (!query.trim()) return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    return text
      .split(regex)
      .map((part, index) =>
        index % 2 === 1 ? <mark class="kasir-highlight">{part}</mark> : part,
      );
  }

  // --- Kategori from DB field ---
  const kategoriList = createMemo<string[]>(() => {
    const set = new Set<string>();
    catalogProduk().forEach((p) => {
      const k = (p.kategori || "").trim();
      if (k) set.add(k);
    });
    return Array.from(set).sort();
  });

  // --- Client-side filter ---
  const filteredCatalog = createMemo<Produk[]>(() => {
    const q = searchQuery().toLowerCase().trim();
    const kat = kategoriFilter();
    return catalogProduk().filter((p) => {
      const matchSearch =
        !q ||
        p.nama.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      const matchKat = !kat || (p.kategori || "") === kat;
      return matchSearch && matchKat;
    });
  });

  // --- Fetch ---
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

  // --- URL search sync ---
  let searchUrlTimer: ReturnType<typeof setTimeout> | undefined;

  function clearSearchUrl() {
    clearTimeout(searchUrlTimer);
    searchUrlTimer = undefined;
    setSearchParams({});
  }

  function onSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    setSearchQuery(val);
    // Debounce URL update 300ms
    clearTimeout(searchUrlTimer);
    searchUrlTimer = setTimeout(() => {
      if (val.trim()) {
        setSearchParams({ q: val });
      } else {
        setSearchParams({});
      }
    }, 300);
  }

  onCleanup(() => clearTimeout(searchUrlTimer));

  return {
    catalogProduk,
    setCatalogProduk,
    searchQuery,
    setSearchQuery,
    kategoriFilter,
    setKategoriFilter,
    catalogLoading,
    highlightMatch,
    kategoriList,
    filteredCatalog,
    allCatalog: catalogProduk,
    loadCatalog,
    clearSearchUrl,
    onSearchInput,
  };
}
