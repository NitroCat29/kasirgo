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

  // --- Fuzzy scoring: subsequence match with position bonuses ---
  function fuzzyScore(text: string, q: string): number {
    if (!q) return 0;
    const t = text.toLowerCase();
    // Exact substring → best
    const idx = t.indexOf(q);
    if (idx !== -1) return 1000 - idx; // earlier match = higher score
    // Starts with any word
    const words = t.split(/\s+/);
    for (const w of words) {
      if (w.startsWith(q)) return 800;
    }
    // Subsequence match (each char of q must appear in order)
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) qi++;
    }
    if (qi === q.length) {
      // More consecutive chars = higher score
      let consecutive = 0;
      let maxConsecutive = 0;
      qi = 0;
      for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) {
          consecutive++;
          maxConsecutive = Math.max(maxConsecutive, consecutive);
          qi++;
        } else {
          consecutive = 0;
        }
      }
      return 400 + maxConsecutive * 50;
    }
    return -1; // no match
  }

  // --- Client-side filter + fuzzy sort ---
  const filteredCatalog = createMemo<Produk[]>(() => {
    const q = searchQuery().toLowerCase().trim();
    const kat = kategoriFilter();
    const matches = catalogProduk()
      .map((p) => {
        const namaScore = fuzzyScore(p.nama, q);
        const skuScore = fuzzyScore(p.sku, q);
        const bestScore = Math.max(namaScore, skuScore);
        const matchKat = !kat || (p.kategori || "") === kat;
        return { produk: p, score: bestScore, matchKat };
      })
      .filter((m) => m.matchKat && (q ? m.score >= 0 : true));
    // Sort: scored desc, then alphabetical
    if (q) {
      matches.sort((a, b) => b.score - a.score || a.produk.nama.localeCompare(b.produk.nama));
    }
    return matches.map((m) => m.produk);
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
