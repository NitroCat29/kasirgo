import { createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import { user, fetchMe, logout } from "../lib/auth";
import {
  loadWasm,
  wasmReady,
  calculateTotal,
  computeBenchmark,
} from "../lib/wasm";
import { initAllAnimations } from "../lib/animations";

/* ============================================
   LANDING v2 — "Terminal/CLI × Bento"
   Reinvent 2026-07-08
   Backup: Landing.tsx.bak
   ============================================ */

/* ---------- Reveal on scroll (IntersectionObserver) ---------- */
function setupReveal() {
  const revealEls = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("revealed"));
    return { disconnect() {} };
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("revealed");
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
  );
  revealEls.forEach((el) => observer.observe(el));
  return observer;
}

/* ---------- Scroll progress bar ---------- */
function useScrollProgress() {
  const [progress, setProgress] = createSignal(0);
  const handler = () => {
    const h = document.documentElement;
    setProgress((h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100);
  };
  onMount(() => window.addEventListener("scroll", handler));
  onCleanup(() => window.removeEventListener("scroll", handler));
  return progress;
}

/* ---------- Ticker counter (IntersectionObserver) ---------- */
function animateTicker(
  el: HTMLElement,
  target: number,
  suffix: string,
  fixed?: boolean,
) {
  if (!("IntersectionObserver" in window)) {
    el.textContent =
      (fixed ? target.toFixed(1) : target.toLocaleString("id-ID")) + suffix;
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          const duration = 1800;
          const start = performance.now();
          const step = (now: number) => {
            const elapsed = now - start;
            const p = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            const current = Math.round(eased * target);
            el.textContent =
              (fixed
                ? (eased * target).toFixed(1)
                : current.toLocaleString("id-ID")) + suffix;
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      });
    },
    { threshold: 0.3 },
  );
  observer.observe(el);
}

/* ---------- Helpers ---------- */
function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

interface TerminalItem {
  name: string;
  price: number;
  qty: number;
}

export default function Landing() {
  const progress = useScrollProgress();
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const [scrolled, setScrolled] = createSignal(false);
  const [toast, setToast] = createSignal<string | null>(null);
  const [faqOpen, setFaqOpen] = createSignal(-1);

  // Hero terminal live stream (driven by interval, no user input)
  const heroStream: TerminalItem[] = [
    { name: "Kopi Susu Gula Aren", price: 18000, qty: 2 },
    { name: "Roti Bakar Coklat", price: 15000, qty: 1 },
    { name: "Air Mineral 600ml", price: 5000, qty: 3 },
    { name: "Nasi Goreng Spesial", price: 22000, qty: 1 },
    { name: "Es Teh Manis", price: 7000, qty: 2 },
    { name: "Donat Coklat", price: 12000, qty: 4 },
  ];
  const [terminalItems, setTerminalItems] = createSignal<TerminalItem[]>([]);
  const terminalSubtotal = () =>
    terminalItems().reduce((s, i) => s + i.price * i.qty, 0);
  const terminalTax = () => terminalSubtotal() * 0.11;
  const terminalTotal = () => calculateTotal(terminalSubtotal(), 11, 0);

  // Benchmark (lazy, triggered when WASM Lab section enters viewport)
  const [benchmark, setBenchmark] = createSignal<{
    wasm: string;
    js: string;
    speedup: string;
  } | null>(null);
  const [benchTriggered, setBenchTriggered] = createSignal(false);
  const [benchAnimated, setBenchAnimated] = createSignal(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function runBenchmarkOnce() {
    if (benchTriggered()) return;
    setBenchTriggered(true);
    const result = computeBenchmark(1000);
    setBenchmark(result);
    // Stagger the bar fill animation
    setTimeout(() => setBenchAnimated(true), 80);
    showToast("Benchmark WASM vs JS selesai!");
  }

  // FAQ data (kept identical to v1)
  const faqs = [
    {
      q: "Apa itu WebAssembly dan kenapa dipakai?",
      a: "WebAssembly (WASM) adalah format biner yang memungkinkan kode dari bahasa seperti Zig/Rust/C++ dijalankan di browser dengan kecepatan mendekati native. Kami menggunakannya untuk perhitungan transaksi agar lebih cepat dari JavaScript biasa.",
    },
    {
      q: "Apakah KasirGo bisa dipakai offline?",
      a: "Ya. Aplikasi desktop kami menggunakan SQLite lokal sehingga tetap berfungsi tanpa internet. Data transaksi tersimpan lokal dan tersinkron otomatis saat koneksi kembali.",
    },
    {
      q: "Berapa lama proses setup?",
      a: "Rata-rata 2-5 menit. Cukup daftar, masukkan nama toko, tambah produk, dan langsung mulai transaksi.",
    },
    {
      q: "Apakah mendukung QRIS dan e-wallet?",
      a: "Ya. Kami mendukung QRIS (semua bank & e-wallet), kartu debit/kredit, tunai, dan cicilan 0%.",
    },
    {
      q: "Bisa pindah dari kasir lama saya?",
      a: "Tentu. Tim onboarding kami akan bantu migrasi data dari sistem lama (Moka, iSeller, Excel, dll) gratis untuk paket Bisnis ke atas.",
    },
    {
      q: "Apakah data saya aman?",
      a: "Data terenkripsi end-to-end, server di Indonesia, backup harian. Untuk mode desktop, data tetap di perangkat Anda.",
    },
  ];

  const marqueeItems = [
    "Zig",
    "WebAssembly",
    "SolidJS",
    "Bun",
    "SQLite",
    "Tailwind",
    "TypeScript",
    "PWA",
  ];

  // WASM Lab ticker — simulasi transaksi (visual-only, no form)
  const labTicker = [
    { store: "Toko Berkah Jaya", amount: 87000, time: "14:32:08" },
    { store: "Minimarket Hidayat", amount: 145500, time: "14:32:05" },
    { store: "Jaya Mart Cabang 2", amount: 320000, time: "14:32:01" },
    { store: "Warung Sembako Berkah", amount: 52000, time: "14:31:58" },
    { store: "Kopi Senja", amount: 98000, time: "14:31:55" },
    { store: "Toko Elektronik Maju", amount: 1250000, time: "14:31:51" },
    { store: "Bakso Pak Joko", amount: 75000, time: "14:31:48" },
    { store: "Apotek Sehat Sentosa", amount: 245000, time: "14:31:44" },
  ];

  onMount(() => {
    loadWasm();
    // Sync auth state — navbar menampilkan status login
    void fetchMe().catch(() => {});
    const observer = setupReveal();
    void initAllAnimations(wasmReady).catch((err) => {
      console.error("[Landing v2] initAllAnimations error:", err);
    });

    // Navbar scroll state
    const scrollHandler = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", scrollHandler);

    // Hero terminal stream — item append tiap 1.4s, reset setelah cycle
    let heroIdx = 0;
    const heroInterval = setInterval(() => {
      const item = heroStream[heroIdx];
      if (item) {
        setTerminalItems((prev) => [...prev, item]);
        heroIdx++;
      } else {
        setTerminalItems([]);
        heroIdx = 0;
      }
    }, 1400);

    // Benchmark trigger saat WASM Lab section masuk viewport
    const labSection = document.getElementById("wasm-lab");
    let labObserver: IntersectionObserver | null = null;
    if (labSection && "IntersectionObserver" in window) {
      labObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              runBenchmarkOnce();
              labObserver?.disconnect();
            }
          });
        },
        { threshold: 0.35 },
      );
      labObserver.observe(labSection);
    }

    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("scroll", scrollHandler);
      clearInterval(heroInterval);
      labObserver?.disconnect();
    });
  });

  // Derived: bench bar widths (max-scale to longest time)
  const benchMaxTime = () => {
    const b = benchmark();
    if (!b) return 1;
    const wasm = parseFloat(b.wasm) || 0;
    const js = parseFloat(b.js) || 0;
    return Math.max(wasm, js, 0.01);
  };
  const benchWasmPct = () => {
    const b = benchmark();
    if (!b || b.wasm === "N/A") return 0;
    return (parseFloat(b.wasm) / benchMaxTime()) * 100;
  };
  const benchJsPct = () => {
    const b = benchmark();
    if (!b) return 0;
    return (parseFloat(b.js) / benchMaxTime()) * 100;
  };

  return (
    <div class="noise relative min-h-screen overflow-hidden">
      {/* Scroll progress */}
      <div class="scroll-progress" style={{ width: `${progress()}%` }} />

      {/* Background layers */}
      <div
        class="fixed inset-0 grid-bg pointer-events-none"
        style={{ "z-index": "-2" }}
      />
      <div
        class="fixed inset-0 aurora pointer-events-none"
        style={{ "z-index": "-1" }}
      />
      <div
        class="blob"
        style={{
          background: "#00d9a3",
          top: "-150px",
          left: "-120px",
          width: "520px",
          height: "520px",
        }}
      />
      <div
        class="blob"
        style={{
          background: "#ff8a3d",
          top: "25%",
          right: "-220px",
          width: "620px",
          height: "620px",
          opacity: "0.3",
          "animation-delay": "-4s",
        }}
      />
      <div
        class="blob"
        style={{
          background: "#00d9a3",
          top: "80%",
          left: "30%",
          width: "400px",
          height: "400px",
          opacity: "0.15",
          "animation-delay": "-2s",
        }}
      />

      {/* ==================== NAVBAR ==================== */}
      <nav
        class={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled() ? "glass border-b border-kasir-accent/10" : "bg-transparent"}`}
      >
        <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <A href="/" class="flex items-center gap-2.5 group">
            <div class="relative">
              <img
                src="/assets/kasirku_logo.svg"
                alt="KasirGo"
                class="w-9 h-9 rounded-lg transition-transform group-hover:scale-105"
              />
              <div class="absolute inset-0 rounded-lg bg-kasir-accent/30 blur-md -z-10 group-hover:bg-kasir-accent/50 transition-colors" />
            </div>
            <span class="text-xl font-bold tracking-tight">
              Kasir<span class="text-kasir-accent neon-text">Go</span>
            </span>
          </A>

          <div class="hidden md:flex items-center gap-1">
            <a
              href="#fitur"
              class="px-4 py-2 text-sm text-slate-300 hover:text-kasir-accent transition-colors"
            >
              Fitur
            </a>
            <a
              href="#wasm-lab"
              class="px-4 py-2 text-sm text-slate-300 hover:text-kasir-accent transition-colors"
            >
              WASM Lab
            </a>
            <a
              href="#cara-kerja"
              class="px-4 py-2 text-sm text-slate-300 hover:text-kasir-accent transition-colors"
            >
              Cara Kerja
            </a>
            <a
              href="#harga"
              class="px-4 py-2 text-sm text-slate-300 hover:text-kasir-accent transition-colors"
            >
              Harga
            </a>
            <a
              href="#faq"
              class="px-4 py-2 text-sm text-slate-300 hover:text-kasir-accent transition-colors"
            >
              FAQ
            </a>
          </div>

          <div class="hidden md:flex items-center gap-3">
            <Show
              when={user()}
              fallback={
                <>
                  <A
                    href="/login"
                    class="text-sm text-slate-300 hover:text-white transition-colors"
                  >
                    Masuk
                  </A>
                  <A
                    href="/login"
                    class="text-sm px-4 py-2 rounded-lg bg-kasir-accent text-slate-900 font-semibold hover:bg-emerald-300 transition-all btn-glow"
                  >
                    Coba Gratis
                  </A>
                </>
              }
            >
              <span class="text-sm text-kasir-muted">{user()?.nama}</span>
              <Show
                when={user()?.role === "admin" || user()?.role === "manajer"}
              >
                <A
                  href="/dashboard"
                  class="text-sm text-slate-300 hover:text-white transition-colors"
                >
                  Dashboard
                </A>
              </Show>
              <A
                href="/kasir"
                class="text-sm text-slate-300 hover:text-white transition-colors"
              >
                Kasir
              </A>
              <button
                class="text-sm text-slate-300 hover:text-white transition-colors"
                onClick={() => logout()}
              >
                Logout
              </button>
            </Show>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen())}
            class="md:hidden p-2 text-slate-200"
            aria-label="Menu"
          >
            <Show
              when={!mobileMenuOpen()}
              fallback={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              }
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </Show>
          </button>
        </div>

        <Show when={mobileMenuOpen()}>
          <div class="md:hidden glass border-t border-white/5">
            <div class="px-6 py-4 flex flex-col gap-1">
              <a
                href="#fitur"
                onClick={() => setMobileMenuOpen(false)}
                class="py-2 text-slate-300"
              >
                Fitur
              </a>
              <a
                href="#wasm-lab"
                onClick={() => setMobileMenuOpen(false)}
                class="py-2 text-slate-300"
              >
                WASM Lab
              </a>
              <a
                href="#cara-kerja"
                onClick={() => setMobileMenuOpen(false)}
                class="py-2 text-slate-300"
              >
                Cara Kerja
              </a>
              <a
                href="#harga"
                onClick={() => setMobileMenuOpen(false)}
                class="py-2 text-slate-300"
              >
                Harga
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                class="py-2 text-slate-300"
              >
                FAQ
              </a>
              <Show
                when={user()}
                fallback={
                  <A
                    href="/login"
                    class="mt-2 py-2 text-center rounded-lg bg-kasir-accent text-slate-900 font-semibold"
                  >
                    Coba Gratis
                  </A>
                }
              >
                <div class="mt-2 flex flex-col gap-1 pt-2 border-t border-white/5">
                  <span class="py-2 text-slate-300">{user()?.nama}</span>
                  <Show
                    when={
                      user()?.role === "admin" || user()?.role === "manajer"
                    }
                  >
                    <A href="/dashboard" class="py-2 text-slate-300">
                      Dashboard
                    </A>
                  </Show>
                  <A href="/kasir" class="py-2 text-slate-300">
                    Kasir
                  </A>
                  <button
                    class="py-2 text-left text-slate-300"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </nav>

      {/* ==================== HERO — BENTO GRID ==================== */}
      <section class="relative min-h-screen flex items-center pt-28 pb-16 overflow-hidden">
        <div class="hero-pattern" />
        {/* Decorative blobs (preserve .blob class for animations.ts) */}
        <div
          class="blob w-125 h-125 bg-emerald-500"
          style={{
            position: "absolute",
            top: "-8%",
            left: "-5%",
            opacity: "0.2",
            "z-index": "0",
            animation: "blob-float 12s ease-in-out infinite",
          }}
        />
        <div
          class="blob w-100 h-100 bg-cyan-500"
          style={{
            position: "absolute",
            bottom: "5%",
            right: "-8%",
            opacity: "0.15",
            "z-index": "0",
            animation: "blob-float 15s ease-in-out infinite reverse",
          }}
        />
        {/* Grid lines */}
        <div
          class="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            "background-image":
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            "background-size": "80px 80px",
          }}
        />

        <div class="max-w-7xl mx-auto px-6 w-full relative z-10">
          {/* Bento grid: 4 columns on lg, asymmetric */}
          <div class="grid lg:grid-cols-4 gap-4 md:gap-5 items-stretch">
            {/* Hero title card (spans 3 cols on top) */}
            <div class="lg:col-span-3 bento-card p-8 md:p-10 reveal">
              <div
                class="hero-badge inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-neon mb-6"
                style="border-radius: 999px;"
              >
                <span
                  class={`wasm-orb ${wasmReady() ? "wasm-orb-active" : "wasm-orb-idle"}`}
                />
                <span class="text-xs text-slate-300 font-mono">
                  v2.0 · Powered by Zig + WebAssembly
                </span>
              </div>

              <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.04] tracking-tight mb-6">
                <span class="block hero-title-line">Kasir yang</span>
                <span class="block text-gradient neon-text hero-title-line">
                  secepat kilat
                </span>
                <span class="block hero-title-line">untuk tokomu.</span>
              </h1>

              <p class="hero-subtitle text-lg text-slate-400 mb-8 max-w-xl leading-relaxed">
                Sistem POS modern dengan perhitungan transaksi berbasis
                WebAssembly. Proses ribuan item dalam milidetik, bekerja
                offline, sinkron otomatis.
              </p>

              <div class="hero-cta flex flex-wrap gap-3">
                <A
                  href="/login"
                  class="group px-6 py-3.5 rounded-xl bg-kasir-accent text-slate-900 font-semibold hover:bg-emerald-300 transition-all btn-glow inline-flex items-center gap-2"
                >
                  Mulai Gratis
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    class="group-hover:translate-x-1 transition-transform"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </A>
                <a
                  href="#wasm-lab"
                  class="px-6 py-3.5 rounded-xl glass text-slate-200 font-semibold hover:bg-white/5 transition-all"
                >
                  Lihat WASM Lab
                </a>
              </div>

              {/* Social proof */}
              <div class="hero-social-proof mt-10 flex items-center gap-6">
                <div class="flex -space-x-2.5">
                  <div class="w-9 h-9 rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 border-2 border-slate-950 flex items-center justify-center text-xs font-bold text-slate-900">
                    AS
                  </div>
                  <div class="w-9 h-9 rounded-full bg-linear-to-br from-orange-400 to-orange-600 border-2 border-slate-950 flex items-center justify-center text-xs font-bold text-slate-900">
                    RH
                  </div>
                  <div class="w-9 h-9 rounded-full bg-linear-to-br from-purple-400 to-purple-600 border-2 border-slate-950 flex items-center justify-center text-xs font-bold text-slate-900">
                    DW
                  </div>
                  <div class="w-9 h-9 rounded-full bg-linear-to-br from-pink-400 to-pink-600 border-2 border-slate-950 flex items-center justify-center text-xs font-bold text-slate-900">
                    +9k
                  </div>
                </div>
                <div>
                  <div class="flex items-center gap-0.5 text-amber-400">
                    <For each={Array(5)}>
                      {() => (
                        <svg
                          width="14"
                          height="14"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      )}
                    </For>
                  </div>
                  <div class="text-xs text-slate-400 mt-1">
                    Dipercaya 12.000+ toko di Indonesia
                  </div>
                </div>
              </div>
            </div>

            {/* Hero mockup — Terminal live (spans 3 cols on top-right, but stacks below title on lg) */}
            {/* Actually we want title on left full height + terminal on right. Let's restructure:
                - Top row: title (col-span-3) + speed stat (col-span-1)
                - Bottom row: terminal mockup (col-span-3) + 2 small bento stats (col-span-1 each, stacked)
            */}

            {/* Speed stat card (col-span-1, top-right) */}
            <div
              class="lg:col-span-1 bento-stat reveal"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,138,61,0.08), rgba(19,24,38,0.7))",
              }}
            >
              <div class="text-xs text-slate-400 font-mono uppercase tracking-wider">
                WASM Latency
              </div>
              <div
                class="text-4xl md:text-5xl font-bold grid-counter ticker-num"
                ref={(el) => animateTicker(el, 0, ".3ms", true)}
              >
                0
              </div>
              <div class="text-xs text-slate-500">per item · vs 3ms JS</div>
            </div>

            {/* Terminal mockup — preserves .hero-mockup class for animations.ts */}
            <div class="hero-mockup lg:col-span-3 hero-mockup-terminal reveal">
              <div class="scanline" />
              {/* Float cards — preserves .hero-float-card for animations.ts */}
              <div class="hero-float-card absolute -top-5 -left-5 z-20 glass-neon rounded-xl p-3 flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-emerald-400/15 flex items-center justify-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#00d9a3"
                    stroke-width="2.2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400 uppercase tracking-wider">
                    Live Total
                  </div>
                  <div class="text-sm font-mono font-semibold text-kasir-accent neon-text">
                    {formatRupiah(terminalTotal())}
                  </div>
                </div>
              </div>

              <div class="hero-float-card absolute -bottom-5 -right-5 z-20 glass-neon-accent2 rounded-xl p-3 flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-orange-400/15 flex items-center justify-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ff8a3d"
                    stroke-width="2.2"
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400 uppercase tracking-wider">
                    Engine
                  </div>
                  <div class="text-sm font-mono font-semibold text-kasir-accent2 neon-text-orange">
                    {wasmReady() ? "ZIG WASM" : "JS FALLBACK"}
                  </div>
                </div>
              </div>

              <div class="terminal-screen">
                <div class="terminal-header">
                  <div class="terminal-dot" style={{ background: "#ff5f56" }} />
                  <div class="terminal-dot" style={{ background: "#ffbd2e" }} />
                  <div class="terminal-dot" style={{ background: "#27c93f" }} />
                  <div class="ml-3 text-xs text-slate-500 font-mono">
                    kasirgo@toko-berkah — transaksi stream
                  </div>
                </div>
                <div class="terminal-body" style={{ "min-height": "320px" }}>
                  <div
                    class="terminal-line"
                    style={{ "animation-delay": "0ms" }}
                  >
                    <span class="terminal-prompt">$</span>
                    <span style={{ color: "#8b95a8" }}>
                      kasirgo init --engine=wasm
                    </span>
                  </div>
                  <div
                    class="terminal-line"
                    style={{ "animation-delay": "120ms" }}
                  >
                    <span class="terminal-prompt">›</span>
                    <span
                      style={{ color: wasmReady() ? "#00d9a3" : "#ff8a3d" }}
                    >
                      {wasmReady()
                        ? "✓ wasm module loaded (kasir.wasm)"
                        : "⚠ wasm unavailable — js fallback active"}
                    </span>
                  </div>
                  <div
                    class="terminal-line"
                    style={{ "animation-delay": "240ms" }}
                  >
                    <span class="terminal-prompt">›</span>
                    <span style={{ color: "#8b95a8" }}>
                      streaming transaksi real-time...
                    </span>
                  </div>
                  <For each={terminalItems()}>
                    {(item, idx) => (
                      <div
                        class="terminal-line"
                        style={{
                          "animation-delay": `${Math.min(idx() * 60, 600)}ms`,
                        }}
                      >
                        <span class="terminal-prompt">›</span>
                        <span style={{ color: "#c8d4e8" }}>
                          add({item.name}) ×{item.qty} →{" "}
                          <span style={{ color: "#00d9a3" }}>
                            {formatRupiah(item.price * item.qty)}
                          </span>
                        </span>
                      </div>
                    )}
                  </For>
                  <Show when={terminalItems().length === 0}>
                    <div
                      class="terminal-line"
                      style={{ "animation-delay": "360ms" }}
                    >
                      <span class="terminal-prompt">›</span>
                      <span style={{ color: "#4a5269" }}>
                        waiting for items...
                      </span>
                      <span class="terminal-cursor" />
                    </div>
                  </Show>
                  <Show when={terminalItems().length > 0}>
                    <div
                      class="terminal-line"
                      style={{ "animation-delay": "500ms" }}
                    >
                      <span class="terminal-prompt">›</span>
                      <span style={{ color: "#8b95a8" }}>
                        subtotal:{" "}
                        <span style={{ color: "#c8d4e8" }}>
                          {formatRupiah(terminalSubtotal())}
                        </span>{" "}
                        · tax(11%):{" "}
                        <span style={{ color: "#c8d4e8" }}>
                          {formatRupiah(terminalTax())}
                        </span>
                      </span>
                    </div>
                    <div
                      class="terminal-line"
                      style={{ "animation-delay": "600ms" }}
                    >
                      <span class="terminal-prompt">$</span>
                      <span style={{ color: "#00d9a3", "font-weight": "bold" }}>
                        TOTAL: {formatRupiah(terminalTotal())}
                      </span>
                      <span class="terminal-cursor" />
                    </div>
                  </Show>
                </div>
              </div>
            </div>

            {/* Two small stat bento (col-span-1, stacked) */}
            <div class="lg:col-span-1 flex flex-col gap-4 md:gap-5">
              <div class="bento-stat reveal flex-1">
                <div class="text-xs text-slate-400 font-mono uppercase tracking-wider">
                  Toko Aktif
                </div>
                <div
                  class="text-3xl font-bold grid-counter ticker-num"
                  ref={(el) => animateTicker(el, 12000, "+")}
                >
                  0
                </div>
                <div class="text-xs text-slate-500">se-Indonesia</div>
              </div>
              <div class="bento-stat reveal flex-1">
                <div class="text-xs text-slate-400 font-mono uppercase tracking-wider">
                  Transaksi/bln
                </div>
                <div
                  class="text-3xl font-bold grid-counter ticker-num"
                  ref={(el) => animateTicker(el, 8, "M+")}
                >
                  0
                </div>
                <div class="text-xs text-slate-500">via WASM engine</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div class="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2 scroll-bounce">
          <span class="text-[10px] text-slate-500 font-mono tracking-widest">
            SCROLL
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-slate-500"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </section>

      {/* ==================== TECH MARQUEE ==================== */}
      <section class="py-8 border-y border-kasir-accent/15 overflow-hidden relative">
        <div
          class="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(0,217,163,0.05), transparent)",
          }}
        />
        <div class="text-center text-xs text-kasir-accent font-mono mb-6 tracking-widest neon-text">
          DIBANGUN DENGAN TEKNOLOGI TERKINI
        </div>
        <div class="relative flex overflow-hidden mask-marquee">
          <div class="marquee-track flex gap-12 items-center whitespace-nowrap pr-12">
            <For each={marqueeItems}>
              {(item) => (
                <span class="text-2xl font-bold text-slate-700 hover:text-kasir-accent hover:neon-text transition-all duration-300 cursor-default">
                  {item}
                </span>
              )}
            </For>
          </div>
          <div
            class="marquee-track flex gap-12 items-center whitespace-nowrap pr-12"
            aria-hidden="true"
          >
            <For each={marqueeItems}>
              {(item) => (
                <span class="text-2xl font-bold text-slate-700 hover:text-kasir-accent hover:neon-text transition-all duration-300 cursor-default">
                  {item}
                </span>
              )}
            </For>
          </div>
        </div>
      </section>

      {/* ==================== FEATURES — BENTO ASYMMETRIC ==================== */}
      <section id="fitur" class="py-16 relative">
        <div class="max-w-7xl mx-auto px-6">
          <div class="max-w-2xl mb-10">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-neon mb-4 reveal"
              style="border-radius: 999px;"
            >
              <span class="text-xs text-kasir-accent font-mono neon-text">
                FITUR
              </span>
            </div>
            <h2 class="text-4xl md:text-5xl font-bold leading-tight mb-4 reveal">
              Semua yang toko kamu butuhkan,
              <br />
              <span class="text-gradient">dalam satu sistem.</span>
            </h2>
            <p class="text-slate-400 reveal">
              Dari transaksi cepat hingga laporan harian, semua otomatis.
            </p>
          </div>

          {/* Bento grid: 6 cards, asymmetric via col-span + row-span */}
          <div class="grid md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 auto-rows-[minmax(180px,auto)]">
            {/* Feature 1 — large */}
            <div class="feature-card bento-card md:col-span-2 lg:col-span-2 row-span-2 p-7 reveal">
              <div
                class="w-14 h-14 rounded-xl bg-emerald-400/10 flex items-center justify-center mb-5"
                style="box-shadow: 0 0 20px #00d9a333;"
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#00d9a3"
                  stroke-width="2"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <h3 class="text-2xl font-semibold mb-3">Transaksi Kilat</h3>
              <p class="text-sm text-slate-400 leading-relaxed mb-6">
                Perhitungan subtotal, pajak, dan diskon diproses via
                WebAssembly. 10x lebih cepat dari JavaScript biasa — ribuan item
                dalam milidetik.
              </p>
              <div class="flex flex-wrap gap-2 mt-auto">
                <span
                  class="px-2.5 py-1 rounded-md text-[10px] font-mono bg-emerald-400/10 text-kasir-accent"
                  style="border-radius: 6px;"
                >
                  0.3ms / item
                </span>
                <span
                  class="px-2.5 py-1 rounded-md text-[10px] font-mono bg-white/5 text-slate-400"
                  style="border-radius: 6px;"
                >
                  Zig-compiled
                </span>
                <span
                  class="px-2.5 py-1 rounded-md text-[10px] font-mono bg-white/5 text-slate-400"
                  style="border-radius: 6px;"
                >
                  JS fallback
                </span>
              </div>
            </div>

            {/* Feature 2 */}
            <div class="feature-card bento-card p-6 reveal">
              <div
                class="w-12 h-12 rounded-xl bg-orange-400/10 flex items-center justify-center mb-4"
                style="box-shadow: 0 0 20px #ff8a3d33;"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ff8a3d"
                  stroke-width="2"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold mb-2">Manajemen Stok</h3>
              <p class="text-sm text-slate-400 leading-relaxed">
                Pantau real-time, notif otomatis saat menipis, forecast berbasis
                historis.
              </p>
            </div>

            {/* Feature 3 */}
            <div class="feature-card bento-card p-6 reveal">
              <div
                class="w-12 h-12 rounded-xl bg-purple-400/10 flex items-center justify-center mb-4"
                style="box-shadow: 0 0 20px #c084fc33;"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c084fc"
                  stroke-width="2"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold mb-2">Multi Pembayaran</h3>
              <p class="text-sm text-slate-400 leading-relaxed">
                Tunai, QRIS, kartu, e-wallet, cicilan — semua tercatat satu
                struk.
              </p>
            </div>

            {/* Feature 4 */}
            <div class="feature-card bento-card p-6 reveal">
              <div
                class="w-12 h-12 rounded-xl bg-pink-400/10 flex items-center justify-center mb-4"
                style="box-shadow: 0 0 20px #f472b633;"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f472b6"
                  stroke-width="2"
                >
                  <path d="M3 3v18h18" />
                  <path d="M18 17V9M13 17V5M8 17v-3" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold mb-2">Laporan Real-time</h3>
              <p class="text-sm text-slate-400 leading-relaxed">
                Dashboard harian/mingguan/bulanan. Export Excel & PDF satu klik.
              </p>
            </div>

            {/* Feature 5 */}
            <div class="feature-card bento-card p-6 reveal">
              <div
                class="w-12 h-12 rounded-xl bg-sky-400/10 flex items-center justify-center mb-4"
                style="box-shadow: 0 0 20px #38bdf833;"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#38bdf8"
                  stroke-width="2"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold mb-2">Multi Cabang</h3>
              <p class="text-sm text-slate-400 leading-relaxed">
                Kelola semua cabang dari satu akun. Konsolidasi laporan
                otomatis.
              </p>
            </div>

            {/* Feature 6 — wide */}
            <div class="feature-card bento-card md:col-span-2 lg:col-span-2 p-6 reveal">
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 rounded-xl bg-yellow-400/10 flex items-center justify-center shrink-0"
                  style="box-shadow: 0 0 20px #facc1533;"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#facc15"
                    stroke-width="2"
                  >
                    <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-semibold mb-2">Mode Offline</h3>
                  <p class="text-sm text-slate-400 leading-relaxed">
                    Internet putus? Tetap jualan. Data sinkron otomatis saat
                    koneksi kembali.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== WASM LAB (pengganti Live Demo form) ==================== */}
      <section id="wasm-lab" class="py-16 relative">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center max-w-2xl mx-auto mb-10">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-neon mb-4 reveal"
              style="border-radius: 999px;"
            >
              <span class="text-xs text-kasir-accent2 font-mono neon-text-orange">
                WASM LAB
              </span>
            </div>
            <h2 class="text-4xl md:text-5xl font-bold leading-tight mb-4 reveal">
              Mesin WebAssembly
              <br />
              <span class="text-gradient neon-text">tampak ke mata.</span>
            </h2>
            <p class="text-slate-400 reveal">
              Visualizer real-time: orb status, benchmark WASM vs JavaScript,
              dan stream transaksi yang dihitung langsung oleh module Zig.
            </p>
          </div>

          <div class="grid lg:grid-cols-3 gap-5">
            {/* Orb visualizer (col-span-1) */}
            <div
              class="bento-card p-8 reveal flex flex-col items-center justify-center text-center"
              style={{ "min-height": "420px" }}
            >
              <div class="relative" style={{ width: "120px", height: "120px" }}>
                <Show when={wasmReady()}>
                  <div class="wasm-orb-ring" />
                  <div class="wasm-orb-ring wasm-orb-ring-2" />
                  <div class="wasm-orb-ring wasm-orb-ring-3" />
                </Show>
                <div
                  class={`wasm-orb-big ${wasmReady() ? "wasm-orb-big-active" : "wasm-orb-big-idle"}`}
                />
              </div>
              <div class="mt-8">
                <div
                  class={`text-sm font-mono font-bold ${wasmReady() ? "text-kasir-accent neon-text" : "text-kasir-accent2 neon-text-orange"}`}
                >
                  {wasmReady() ? "WASM ENGINE ONLINE" : "JS FALLBACK ACTIVE"}
                </div>
                <div class="text-xs text-slate-500 mt-2 font-mono">
                  {wasmReady()
                    ? "kasir.wasm · Zig-compiled"
                    : "fallback · native js"}
                </div>
              </div>
              <div
                class="mt-6 px-3 py-1.5 rounded-md text-[10px] font-mono bg-white/5 text-slate-400"
                style="border-radius: 6px;"
              >
                memory: WebAssembly.Memory · 1 page
              </div>
            </div>

            {/* Benchmark bar (col-span-2) */}
            <div class="bento-card p-7 reveal lg:col-span-2">
              <div class="flex items-center justify-between mb-6">
                <div>
                  <h3 class="text-lg font-semibold">
                    Benchmark · WASM vs JavaScript
                  </h3>
                  <p class="text-xs text-slate-500 mt-1 font-mono">
                    1000 iterations · compute_benchmark()
                  </p>
                </div>
                <div
                  class={`px-2.5 py-1 rounded-md text-[10px] font-mono flex items-center gap-1.5 ${wasmReady() ? "badge-wasm-active" : "badge-wasm-fallback"}`}
                  style="border-radius: 6px;"
                >
                  <span
                    class={`w-1.5 h-1.5 rounded-full ${wasmReady() ? "bg-emerald-400" : "bg-orange-400"} pulse-dot`}
                  />
                  <span>{wasmReady() ? "ZIG WASM" : "JS FALLBACK"}</span>
                </div>
              </div>

              <Show
                when={benchmark()}
                fallback={
                  <div class="flex items-center justify-center h-40 text-sm text-slate-500 font-mono">
                    Memuat benchmark...
                  </div>
                }
              >
                <div class="space-y-6">
                  {/* WASM bar */}
                  <div>
                    <div class="flex justify-between text-xs mb-2">
                      <span class="text-slate-300 font-mono">WASM (Zig)</span>
                      <span class="font-mono text-kasir-accent neon-text">
                        {benchmark()!.wasm}ms
                      </span>
                    </div>
                    <div style={{ height: "10px" }} class="bench-bar-track">
                      <div
                        class="bench-bar-fill bench-bar-fill-wasm"
                        style={{
                          width: benchAnimated() ? `${benchWasmPct()}%` : "0%",
                        }}
                      />
                    </div>
                  </div>

                  {/* JS bar */}
                  <div>
                    <div class="flex justify-between text-xs mb-2">
                      <span class="text-slate-300 font-mono">JavaScript</span>
                      <span class="font-mono text-kasir-accent2 neon-text-orange">
                        {benchmark()!.js}ms
                      </span>
                    </div>
                    <div style={{ height: "10px" }} class="bench-bar-track">
                      <div
                        class="bench-bar-fill bench-bar-fill-js"
                        style={{
                          width: benchAnimated() ? `${benchJsPct()}%` : "0%",
                        }}
                      />
                    </div>
                  </div>

                  {/* Speedup callout */}
                  <div
                    class="mt-6 p-4 rounded-lg"
                    style={{
                      background: "rgba(0,217,163,0.06)",
                      border: "1px solid rgba(0,217,163,0.2)",
                    }}
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="text-xs text-slate-400 font-mono uppercase tracking-wider">
                          Speedup
                        </div>
                        <div class="text-3xl font-bold text-kasir-accent neon-text font-mono">
                          {benchmark()!.speedup}×
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="text-xs text-slate-400 font-mono">
                          WASM faster than JS
                        </div>
                        <div class="text-xs text-slate-500 font-mono mt-1">
                          {wasmReady()
                            ? "real measurement"
                            : "estimated (wasm n/a)"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            {/* Live transaction ticker tape (col-span-3, full width) */}
            <div class="bento-card p-7 reveal lg:col-span-3">
              <div class="flex items-center justify-between mb-5">
                <div>
                  <h3 class="text-lg font-semibold">Live Transaction Stream</h3>
                  <p class="text-xs text-slate-500 mt-1 font-mono">
                    simulasi · dihitung via{" "}
                    {wasmReady() ? "WASM" : "JS fallback"}
                  </p>
                </div>
                <div
                  class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-400/10 neon-glow"
                  style="border-radius: 6px;"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-kasir-accent pulse-dot" />
                  <span class="text-[10px] text-kasir-accent font-mono">
                    LIVE
                  </span>
                </div>
              </div>

              <div
                class="ticker-tape"
                style={{ height: "240px", overflow: "hidden" }}
              >
                {/* Duplicate list biar scroll seamless (-50% transform) */}
                <div class="ticker-tape-track">
                  <For each={[...labTicker, ...labTicker]}>
                    {(t) => (
                      <div
                        class="flex items-center justify-between p-3 rounded-lg"
                        style={{
                          background: "rgba(0,0,0,0.25)",
                          border: "1px solid rgba(0,217,163,0.08)",
                        }}
                      >
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-md bg-emerald-400/10 flex items-center justify-center shrink-0">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#00d9a3"
                              stroke-width="2.2"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <div>
                            <div class="text-sm font-medium">{t.store}</div>
                            <div class="text-xs text-slate-500 font-mono">
                              {t.time}
                            </div>
                          </div>
                        </div>
                        <div class="text-sm font-mono font-semibold text-kasir-accent neon-text">
                          {formatRupiah(calculateTotal(t.amount, 11, 0))}
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section divider with neon pulse */}
      <div class="max-w-7xl mx-auto px-6 my-4">
        <div class="neon-border-pulse" />
      </div>

      {/* ==================== HOW IT WORKS ==================== */}
      <section id="cara-kerja" class="py-16 relative">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center max-w-2xl mx-auto mb-12">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-neon mb-4 reveal"
              style="border-radius: 999px;"
            >
              <span class="text-xs text-kasir-accent font-mono neon-text">
                CARA KERJA
              </span>
            </div>
            <h2 class="text-4xl md:text-5xl font-bold leading-tight reveal">
              Mulai dalam <span class="text-gradient neon-text">3 langkah</span>
            </h2>
          </div>

          <div class="grid md:grid-cols-3 gap-5 relative">
            <div class="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-linear-to-r from-emerald-400/0 via-emerald-400/30 to-orange-400/0" />
            <For
              each={[
                {
                  num: "01",
                  color: "bg-emerald-400/10 text-kasir-accent",
                  title: "Daftar Akun",
                  desc: "Buat akun, masukkan nama toko, dan atur kategori produk. Selesai dalam 2 menit.",
                },
                {
                  num: "02",
                  color: "bg-orange-400/10 text-kasir-accent2",
                  title: "Tambah Produk",
                  desc: "Input produk via barcode scanner atau manual. Bulk import dari Excel juga didukung.",
                },
                {
                  num: "03",
                  color: "bg-purple-400/10 text-purple-400",
                  title: "Mulai Transaksi",
                  desc: "Klik produk, sistem menghitung total via WASM, cetak struk. Selesai!",
                },
              ]}
            >
              {(step) => (
                <div class="bento-card p-6 reveal relative">
                  <div
                    class={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center font-mono font-bold mb-4 relative z-10 neon-glow`}
                    style="box-shadow: 0 0 20px rgba(0,217,163,0.2);"
                  >
                    {step.num}
                  </div>
                  <h3 class="text-lg font-semibold mb-2">{step.title}</h3>
                  <p class="text-sm text-slate-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>

      {/* ==================== TESTIMONIALS ==================== */}
      <section class="py-16 relative">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center max-w-2xl mx-auto mb-12">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-neon-accent2 mb-4 reveal"
              style="border-radius: 999px;"
            >
              <span class="text-xs text-kasir-accent2 font-mono neon-text-orange">
                TESTIMONI
              </span>
            </div>
            <h2 class="text-4xl md:text-5xl font-bold leading-tight reveal">
              Apa kata <span class="text-gradient">pengguna kami</span>
            </h2>
          </div>

          <div class="grid md:grid-cols-3 gap-5">
            <For
              each={[
                {
                  name: "Siti Rohimah",
                  role: "Owner · Warung Sembako Berkah",
                  initials: "SR",
                  gradient: "from-emerald-400 to-emerald-600",
                  quote:
                    "Sejak pakai KasirGo, antrian di kasir jauh berkurang. Transaksi yang tadinya 30 detik sekarang 5 detik. Pembeli senang, saya juga senang.",
                },
                {
                  name: "Ahmad Hidayat",
                  role: "Owner · Minimarket Hidayat",
                  initials: "AH",
                  gradient: "from-orange-400 to-orange-600",
                  quote:
                    "Mode offline-nya juara. Toko saya di daerah yang internetnya sering putus, tapi kasir tetap jalan. Laporan harian juga sangat membantu.",
                },
                {
                  name: "Dewi Wijaya",
                  role: "Owner · Jaya Mart (4 cabang)",
                  initials: "DW",
                  gradient: "from-purple-400 to-purple-600",
                  quote:
                    "Kelola 4 cabang jadi mudah. Laporan konsolidasi otomatis, tidak perlu lagi kirim Excel tiap malam. Worth every rupiah.",
                },
              ]}
            >
              {(t) => (
                <div class="bento-card p-6 reveal">
                  <div class="flex items-center gap-0.5 text-amber-400 mb-4">
                    <For each={Array(5)}>
                      {() => (
                        <svg
                          width="16"
                          height="16"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      )}
                    </For>
                  </div>
                  <p class="text-sm text-slate-300 leading-relaxed mb-5">
                    "{t.quote}"
                  </p>
                  <div class="flex items-center gap-3">
                    <div
                      class={`w-10 h-10 rounded-full bg-linear-to-br ${t.gradient} flex items-center justify-center text-sm font-bold text-slate-900`}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <div class="text-sm font-semibold">{t.name}</div>
                      <div class="text-xs text-slate-500">{t.role}</div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>

      {/* ==================== PRICING ==================== */}
      <section id="harga" class="py-16 relative">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center max-w-2xl mx-auto mb-12">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-neon mb-4 reveal"
              style="border-radius: 999px;"
            >
              <span class="text-xs text-kasir-accent font-mono neon-text">
                HARGA
              </span>
            </div>
            <h2 class="text-4xl md:text-5xl font-bold leading-tight reveal">
              Pilih paket yang{" "}
              <span class="text-gradient neon-text">sesuai</span>
            </h2>
            <p class="text-slate-400 mt-4 reveal">
              Tanpa biaya tersembunyi. Batalkan kapan saja.
            </p>
          </div>

          <div class="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {/* Starter */}
            <div class="bento-card p-7 reveal">
              <h3 class="text-lg font-semibold mb-1">Starter</h3>
              <p class="text-xs text-slate-400 mb-5">
                Untuk warung & toko kecil
              </p>
              <div class="mb-5">
                <span class="text-4xl font-bold">Rp 0</span>
                <span class="text-sm text-slate-400">/bulan</span>
              </div>
              <ul class="space-y-2.5 mb-6 text-sm">
                <For each={["1 user", "50 produk", "Laporan harian"]}>
                  {(item) => (
                    <li class="flex items-center gap-2 text-slate-300">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#00d9a3"
                        stroke-width="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {item}
                    </li>
                  )}
                </For>
                <li class="flex items-center gap-2 text-slate-500">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Multi cabang
                </li>
              </ul>
              <A
                href="/login"
                class="block text-center py-2.5 rounded-lg glass text-slate-200 font-semibold text-sm hover:bg-white/5 transition-all"
              >
                Mulai Gratis
              </A>
            </div>

            {/* Bisnis — popular */}
            <div
              class="neon-border-anim bento-card p-7 reveal relative"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0, 217, 163, 0.06) 0%, rgba(19, 24, 38, 0.65) 100%)",
                "border-radius": "20px",
              }}
            >
              <div
                class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-kasir-accent text-slate-900 text-[10px] font-bold tracking-wider neon-glow"
                style="border-radius: 999px;"
              >
                POPULER
              </div>
              <h3 class="text-lg font-semibold mb-1">Bisnis</h3>
              <p class="text-xs text-slate-400 mb-5">Untuk toko berkembang</p>
              <div class="mb-5">
                <span class="text-4xl font-bold text-kasir-accent neon-text">
                  Rp 149rb
                </span>
                <span class="text-sm text-slate-400">/bulan</span>
              </div>
              <ul class="space-y-2.5 mb-6 text-sm">
                <For
                  each={[
                    "5 user",
                    "Produk unlimited",
                    "Laporan lengkap",
                    "3 cabang",
                    "Support prioritas",
                  ]}
                >
                  {(item) => (
                    <li class="flex items-center gap-2 text-slate-300">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#00d9a3"
                        stroke-width="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {item}
                    </li>
                  )}
                </For>
              </ul>
              <A
                href="/login"
                class="block text-center py-2.5 rounded-lg bg-kasir-accent text-slate-900 font-semibold text-sm hover:bg-emerald-300 transition-all btn-glow"
              >
                Pilih Bisnis
              </A>
            </div>

            {/* Enterprise */}
            <div class="bento-card p-7 reveal">
              <h3 class="text-lg font-semibold mb-1">Enterprise</h3>
              <p class="text-xs text-slate-400 mb-5">
                Untuk jaringan toko besar
              </p>
              <div class="mb-5">
                <span class="text-4xl font-bold">Custom</span>
              </div>
              <ul class="space-y-2.5 mb-6 text-sm">
                <For
                  each={[
                    "User unlimited",
                    "Cabang unlimited",
                    "API & integrasi",
                    "On-premise option",
                    "SLA 99.9%",
                  ]}
                >
                  {(item) => (
                    <li class="flex items-center gap-2 text-slate-300">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#00d9a3"
                        stroke-width="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {item}
                    </li>
                  )}
                </For>
              </ul>
              <A
                href="#"
                class="block text-center py-2.5 rounded-lg glass text-slate-200 font-semibold text-sm hover:bg-white/5 transition-all"
              >
                Hubungi Sales
              </A>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section id="faq" class="py-16 relative">
        <div class="max-w-3xl mx-auto px-6">
          <div class="text-center mb-10">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-neon-accent2 mb-4 reveal"
              style="border-radius: 999px;"
            >
              <span class="text-xs text-kasir-accent2 font-mono neon-text-orange">
                FAQ
              </span>
            </div>
            <h2 class="text-4xl md:text-5xl font-bold leading-tight reveal">
              Pertanyaan <span class="text-gradient">umum</span>
            </h2>
          </div>

          <div class="space-y-3">
            <For each={faqs}>
              {(faq, idx) => (
                <div
                  class="bento-card reveal"
                  style={{ "border-radius": "12px", overflow: "hidden" }}
                >
                  <button
                    onClick={() => setFaqOpen(faqOpen() === idx() ? -1 : idx())}
                    class="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-kasir-accent/5 transition-colors"
                  >
                    <span class="text-sm font-medium pr-4">{faq.q}</span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      class={`shrink-0 text-kasir-accent transition-transform duration-300 ${faqOpen() === idx() ? "rotate-45" : ""}`}
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <Show when={faqOpen() === idx()}>
                    <div class="px-5 pb-4 text-sm text-slate-400 leading-relaxed fade-in">
                      {faq.a}
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer class="py-12 border-t border-kasir-accent/10 relative">
        <div class="absolute inset-0 aurora opacity-30 pointer-events-none" />
        <div class="max-w-7xl mx-auto px-6 relative z-10">
          <div class="grid md:grid-cols-4 gap-8 mb-10">
            <div>
              <div class="flex items-center gap-2.5 mb-4">
                <div class="relative">
                  <img
                    src="/assets/kasirku_logo.svg"
                    alt="KasirGo"
                    class="w-9 h-9 rounded-lg"
                  />
                  <div class="absolute inset-0 rounded-lg bg-kasir-accent/30 blur-md -z-10" />
                </div>
                <span class="text-xl font-bold">
                  Kasir<span class="text-kasir-accent neon-text">Go</span>
                </span>
              </div>
              <p class="text-sm text-slate-400 leading-relaxed">
                Sistem POS modern bertenaga WebAssembly untuk toko Indonesia.
              </p>
            </div>
            <div>
              <h4 class="text-sm font-semibold mb-3">Produk</h4>
              <ul class="space-y-2 text-sm text-slate-400">
                <li>
                  <a
                    href="#fitur"
                    class="hover:text-kasir-accent transition-colors"
                  >
                    Fitur
                  </a>
                </li>
                <li>
                  <a
                    href="#harga"
                    class="hover:text-kasir-accent transition-colors"
                  >
                    Harga
                  </a>
                </li>
                <li>
                  <a
                    href="#wasm-lab"
                    class="hover:text-kasir-accent transition-colors"
                  >
                    WASM Lab
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 class="text-sm font-semibold mb-3">Perusahaan</h4>
              <ul class="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" class="hover:text-kasir-accent transition-colors">
                    Tentang
                  </a>
                </li>
                <li>
                  <a href="#" class="hover:text-kasir-accent transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" class="hover:text-kasir-accent transition-colors">
                    Karir
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 class="text-sm font-semibold mb-3">Dukungan</h4>
              <ul class="space-y-2 text-sm text-slate-400">
                <li>
                  <a
                    href="#faq"
                    class="hover:text-kasir-accent transition-colors"
                  >
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#" class="hover:text-kasir-accent transition-colors">
                    Kontak
                  </a>
                </li>
                <li>
                  <a href="#" class="hover:text-kasir-accent transition-colors">
                    Status
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div class="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p class="text-xs text-slate-500">
              © 2026 KasirGo. All rights reserved.
            </p>
            <div class="flex items-center gap-4 text-xs text-slate-500">
              <a href="#" class="hover:text-kasir-accent transition-colors">
                Kebijakan Privasi
              </a>
              <a href="#" class="hover:text-kasir-accent transition-colors">
                Syarat & Ketentuan
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast */}
      <Show when={toast()}>
        <div class="toast toast-success">{toast()}</div>
      </Show>
    </div>
  );
}
