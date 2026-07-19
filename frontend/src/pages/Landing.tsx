import { createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import { gsap } from "gsap";
import uPlot from "uplot";
import { createAvatar } from "@dicebear/core";
import { lorelei } from "@dicebear/collection";

import { user, fetchMe, logout } from "../lib/auth";
import { theme, toggleTheme, initTheme } from "../lib/theme";

// Icons
import {
  ScanLine,
  Boxes,
  BarChart3,
  Wallet,
  CloudOff,
  Store,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  Sun,
  Moon,
  Zap,
  TrendingUp,
  AlertTriangle,
  Package,
} from "lucide-solid";

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const [scrolled, setScrolled] = createSignal(false);
  const [faqOpen, setFaqOpen] = createSignal(-1);
  const [avatars, setAvatars] = createSignal<string[]>([]);
  let heroChartRef: HTMLDivElement | undefined;
  let uplotInstance: uPlot | undefined;

  // Data
  const features = [
    {
      icon: ScanLine,
      title: "Kasir Kilat",
      desc: "Antarmuka minimalis dengan shortcut keyboard. Transaksi 3 detik.",
      color: "text-emerald-400",
    },
    {
      icon: Boxes,
      title: "Audit Stok Real-time",
      desc: "Sinkronisasi stok instan. Notifikasi otomatis saat item menipis.",
      color: "text-orange-400",
    },
    {
      icon: Wallet,
      title: "Multi Pembayaran",
      desc: "QRIS, E-wallet, Kartu Debit/Kredit, dan Tunai dalam satu struk.",
      color: "text-sky-400",
    },
    {
      icon: CloudOff,
      title: "Mode Offline",
      desc: "Jualan tanpa internet. Data tersimpan lokal & sync otomatis saat online.",
      color: "text-purple-400",
    },
    {
      icon: BarChart3,
      title: "Analytics Mendalam",
      desc: "Prediksi tren penjualan, best-seller, dan profit margin harian.",
      color: "text-pink-400",
    },
    {
      icon: Store,
      title: "Multi Cabang",
      desc: "Kelola unlimited cabang. Konsolidasi laporan tanpa ribet Excel.",
      color: "text-yellow-400",
    },
  ];

  const stockData = [
    { name: "Kopi Robusta 1kg", stock: 45, status: "Aman", color: "emerald" },
    { name: "Gula Aren Cair 500ml", stock: 8, status: "Menipis", color: "orange" },
    { name: "Plastik Cup 16oz", stock: 2, status: "Kritis", color: "red" },
    { name: "Susu UHT Coklat 1L", stock: 120, status: "Aman", color: "emerald" },
  ];

  const faqs = [
    {
      q: "Apakah KasirGo bisa dipakai offline?",
      a: "Ya. Aplikasi desktop kami menggunakan SQLite lokal sehingga tetap berfungsi tanpa internet. Data transaksi tersimpan lokal dan tersinkron otomatis saat koneksi kembali.",
    },
    {
      q: "Bagaimana sistem audit stok bekerja?",
      a: "Setiap transaksi langsung memotong stok. Sistem akan memberi alert merah saat stok di bawah ambang batas. Anda bisa lakukan stock opname via tablet/hp.",
    },
    {
      q: "Apakah mendukung QRIS dan e-wallet?",
      a: "Ya. Kami mendukung QRIS (semua bank & e-wallet), kartu debit/kredit, tunai, dan cicilan 0%.",
    },
    {
      q: "Berapa lama proses setup?",
      a: "Rata-rata 2-5 menit. Cukup daftar, masukkan nama toko, tambah produk, dan langsung mulai transaksi.",
    },
  ];

  // --- uPlot chart ---
  function createChart(el: HTMLDivElement) {
    const data: uPlot.AlignedData = [
      Array.from({ length: 30 }, (_, i) => i),
      Array.from({ length: 30 }, () => Math.random() * 50 + 20),
    ];
    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: 150,
      series: [
        {},
        { stroke: "#10b981", fill: "rgba(16,185,129,0.1)", width: 2 },
      ],
      axes: [{ show: false }, { show: false }],
      scales: { x: { time: false }, y: { range: [0, 100] } },
      cursor: { show: false },
    };
    uplotInstance = new uPlot(opts, data, el);
  }

  onMount(() => {
    initTheme();
    fetchMe();

    // Navbar scroll
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });

    // IntersectionObserver for .reveal elements (replaces GSAP ScrollTrigger — Lenis was blocking it)
    const revealEls = document.querySelectorAll<HTMLElement>(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            gsap.to(entry.target, {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.8,
              ease: "power3.out",
            });
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    revealEls.forEach((el) => {
      gsap.set(el, { opacity: 0, y: 40, filter: "blur(6px)" });
      observer.observe(el);
    });

    // Hero entrance animation
    gsap.from(".hero-anim", {
      opacity: 0,
      y: 40,
      filter: "blur(10px)",
      duration: 1,
      stagger: 0.12,
      ease: "power3.out",
    });

    // Floating dashboard mockup
    gsap.to(".floating-ui", {
      y: -20,
      duration: 3,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });

    // uPlot — deferred to after first paint
    requestAnimationFrame(() => {
      if (heroChartRef) createChart(heroChartRef);
    });

    // ResizeObserver for uPlot responsiveness
    let resizeObs: ResizeObserver | undefined;
    if (heroChartRef) {
      resizeObs = new ResizeObserver((entries) => {
        const { width } = entries[0].contentRect;
        if (uplotInstance && width > 0) {
          uplotInstance.setSize({ width: Math.floor(width), height: 150 });
        }
      });
      resizeObs.observe(heroChartRef);
    }

    // DiceBear avatars — async, non-blocking
    const seeds = ["Toko1", "Toko2", "Toko3"];
    Promise.all(
      seeds.map((seed) =>
        createAvatar(lorelei, {
          seed,
          radius: 50,
          backgroundColor: ["10b981", "f97316", "8b5cf6"],
        }).toDataUri(),
      ),
    ).then(setAvatars);

    onCleanup(() => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
      resizeObs?.disconnect();
      uplotInstance?.destroy();
    });
  });

  return (
    <div class="lp-root relative min-h-screen font-sans overflow-x-hidden selection:bg-emerald-500/30">
      {/* Ambient Background */}
      <div class="fixed inset-0 z-0 pointer-events-none lp-ambient">
        <div class="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div class="absolute top-1/2 right-0 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[120px] animate-pulse" style={{ "animation-delay": "1s" }}></div>
        <div class="absolute bottom-0 left-1/3 w-[700px] h-[700px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ "animation-delay": "2s" }}></div>
        <div class="absolute inset-0 lp-grid"></div>
      </div>

      {/* ==================== NAVBAR ==================== */}
      <nav class={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${scrolled() ? "scale-95" : "scale-100"}`}>
        <div class="liquid-glass rounded-full px-3 py-2 flex items-center gap-4 shadow-2xl">
          <A href="/" class="flex items-center gap-2 pl-2 pr-3 border-r border-white/10">
            <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center font-bold text-slate-900">K</div>
            <span class="font-bold text-sm lp-text-primary">KasirGo</span>
          </A>
          <div class="hidden md:flex items-center gap-1 text-sm lp-text-dim">
            <a href="#fitur" class="px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors">Fitur</a>
            <a href="#stok" class="px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors">Stok</a>
            <a href="#harga" class="px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors">Harga</a>
          </div>
          <div class="flex items-center gap-2">
            <button onClick={toggleTheme} class="p-2 rounded-full hover:bg-white/10 transition-colors">
              <Show when={theme() === "dark"} fallback={<Sun size={16} />}>
                <Moon size={16} />
              </Show>
            </button>
            <div class="hidden md:block">
              <Show
                when={user()}
                fallback={
                  <A href="/login" class="px-4 py-1.5 rounded-full bg-emerald-500 text-slate-900 font-semibold text-sm hover:bg-emerald-400 transition-colors flex items-center gap-1">
                    Mulai <ArrowRight size={14} />
                  </A>
                }
              >
                <div class="flex items-center gap-2">
                  <A href="/kasir" class="px-4 py-1.5 rounded-full bg-emerald-500 text-slate-900 font-semibold text-sm hover:bg-emerald-400 transition-colors flex items-center gap-1.5">
                    Kasir <ArrowRight size={14} />
                  </A>
                  <A href="/dashboard" class="px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors lp-text-dim text-sm">Dashboard</A>
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-xs font-bold text-slate-900 lp-border-avatar border-2">
                    {user()?.nama?.charAt(0).toUpperCase()}
                  </div>
                  <button onClick={logout} class="p-1.5 rounded-full hover:bg-white/10 transition-colors lp-text-dim" title="Logout">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                  </button>
                </div>
              </Show>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen())} class="md:hidden p-2 rounded-full hover:bg-white/10">
              <Show when={mobileMenuOpen()} fallback={<Menu size={18} />}><X size={18} /></Show>
            </button>
          </div>
        </div>
        <Show when={mobileMenuOpen()}>
          <div class="md:hidden liquid-glass rounded-2xl mt-2 p-4 flex flex-col gap-2 shadow-2xl">
            <a href="#fitur" class="px-4 py-2 rounded-lg hover:bg-white/10">Fitur</a>
            <a href="#stok" class="px-4 py-2 rounded-lg hover:bg-white/10">Stok</a>
            <a href="#harga" class="px-4 py-2 rounded-lg hover:bg-white/10">Harga</a>
            <Show
              when={user()}
              fallback={<A href="/login" class="px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 font-semibold text-center">Mulai</A>}
            >
              <A href="/kasir" class="px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 font-semibold text-center flex items-center justify-center gap-1.5">Kasir <ArrowRight size={14} /></A>
              <A href="/dashboard" class="px-4 py-2 rounded-lg hover:bg-white/10 lp-text-dim">Dashboard</A>
              <button onClick={logout} class="px-4 py-2 rounded-lg hover:bg-white/10 text-red-400 text-left">Logout</button>
            </Show>
          </div>
        </Show>
      </nav>

      {/* ==================== HERO ==================== */}
      <section class="relative min-h-screen flex items-center pt-32 pb-20 z-10">
        <div class="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center w-full">
          {/* Left: Copy */}
          <div>
            <div class="hero-anim inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass w-fit text-sm text-emerald-400 font-medium">
              <Zap size={14} /> Powered by WebAssembly Engine
            </div>
            <h1 class="hero-anim text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight lp-text-primary mt-6">
              Kasir & Audit Stok
              <br />
              <span class="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Tanpa Lag.</span>
            </h1>
            <p class="hero-anim text-lg lp-text-dim max-w-xl leading-relaxed mt-6">
              KasirGo adalah sistem POS modern yang memadukan kecepatan transaksi millisecond dan real-time stock audit. Kelola toko, pantau stok, dan analisa penjualan dalam satu platform.
            </p>
            <div class="hero-anim flex flex-wrap gap-4 mt-8">
              <A href="/login" class="px-6 py-3.5 rounded-xl bg-emerald-500 text-slate-900 font-bold hover:bg-emerald-400 transition-all hover:scale-105 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)] flex items-center gap-2">
                Coba Gratis 14 Hari <ArrowRight size={18} />
              </A>
              <a href="#fitur" class="px-6 py-3.5 rounded-xl liquid-glass hover:bg-white/10 transition-all font-semibold">
                Lihat Demo
              </a>
            </div>
            <div class="hero-anim flex items-center gap-4 mt-8">
              <div class="flex -space-x-3">
                <Show when={avatars()[0]}><img src={avatars()[0]} class="w-10 h-10 rounded-full border-2 lp-border-avatar" alt="User" /></Show>
                <Show when={avatars()[1]}><img src={avatars()[1]} class="w-10 h-10 rounded-full border-2 lp-border-avatar" alt="User" /></Show>
                <Show when={avatars()[2]}><img src={avatars()[2]} class="w-10 h-10 rounded-full border-2 lp-border-avatar" alt="User" /></Show>
                <div class="w-10 h-10 rounded-full border-2 lp-border-avatar lp-surface flex items-center justify-center text-xs font-bold">12k+</div>
              </div>
              <div class="text-sm lp-text-dim">
                Dipercaya <span class="lp-text-primary font-bold">12.000+</span> toko di Indonesia
              </div>
            </div>
          </div>

          {/* Right: Dashboard Mockup */}
          <div class="hero-anim relative hidden lg:block">
            <div class="floating-ui liquid-glass rounded-3xl p-6 shadow-2xl relative z-10">
              <div class="flex justify-between items-center mb-6">
                <div>
                  <p class="lp-text-dim text-sm">Penjualan Hari Ini</p>
                  <h3 class="text-3xl font-bold lp-text-primary">Rp 4.250.000</h3>
                </div>
                <div class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1">
                  <TrendingUp size={12} /> +15.2%
                </div>
              </div>
              <div ref={heroChartRef} class="w-full mb-6"></div>
              <div class="space-y-3">
                <div class="flex items-center justify-between p-3 rounded-xl lp-surface">
                  <div class="flex items-center gap-3">
                    <div class="p-2 rounded-lg bg-emerald-500/20"><ScanLine size={16} class="text-emerald-400" /></div>
                    <span class="text-sm font-medium lp-text-primary">Transaksi Berhasil</span>
                  </div>
                  <span class="text-sm font-bold lp-text-primary">142</span>
                </div>
                <div class="flex items-center justify-between p-3 rounded-xl lp-surface">
                  <div class="flex items-center gap-3">
                    <div class="p-2 rounded-lg bg-orange-500/20"><AlertTriangle size={16} class="text-orange-400" /></div>
                    <span class="text-sm font-medium lp-text-primary">Stok Menipis</span>
                  </div>
                  <span class="text-sm font-bold text-orange-400">3</span>
                </div>
              </div>
            </div>
            <div class="absolute -top-6 -right-6 w-20 h-20 rounded-full liquid-glass flex items-center justify-center animate-bounce z-20" style={{ "animation-duration": "3s" }}>
              <Wallet size={32} class="text-emerald-400" />
            </div>
            <div class="absolute -bottom-6 -left-6 w-20 h-20 rounded-full liquid-glass flex items-center justify-center animate-bounce z-20" style={{ "animation-duration": "4s", "animation-delay": "1s" }}>
              <CheckCircle2 size={32} class="text-emerald-400" />
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FEATURES BENTO GRID ==================== */}
      <section id="fitur" class="relative py-32 z-10">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center mb-16 reveal">
            <h2 class="text-4xl md:text-5xl font-bold mb-4 lp-text-primary">Semua yang dibutuhkan toko mu.</h2>
            <p class="lp-text-dim max-w-2xl mx-auto">Dirancang untuk merchant modern. Cepat, reliable, dan mudah digunakan.</p>
          </div>

          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[250px]">
            {/* Large Feature - POS */}
            <div class="reveal liquid-glass rounded-3xl p-8 row-span-2 flex flex-col justify-between relative overflow-hidden group">
              <div class="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
              <div class="relative z-10">
                <div class="p-3 rounded-xl bg-emerald-500/20 w-fit mb-6"><ScanLine class="text-emerald-400" size={28} /></div>
                <h3 class="text-2xl font-bold mb-3 lp-text-primary">Sistem Kasir Cerdas</h3>
                <p class="lp-text-dim leading-relaxed">Antarmuka minimalis dengan shortcut keyboard. Mendukung barcode scanner, custom diskon, dan split bill. Transaksi selesai dalam 3 detik.</p>
              </div>
              <div class="relative z-10 mt-6 p-4 rounded-xl lp-surface font-mono text-xs lp-text-dim">
                <div class="text-emerald-400">$ kasir scan --barcode 8991234567890</div>
                <div class="lp-text-muted mt-1">→ Kopi Arabica 250g × 2 = Rp 86.000</div>
                <div class="text-emerald-400 mt-1">✓ Transaksi #1247 berhasil</div>
              </div>
            </div>

            {/* Stock Audit */}
            <div class="reveal liquid-glass rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden group">
              <div class="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
              <div class="relative z-10">
                <div class="p-3 rounded-xl bg-orange-500/20 w-fit mb-4"><Boxes class="text-orange-400" size={24} /></div>
                <h3 class="text-xl font-bold mb-2 lp-text-primary">{features[1].title}</h3>
                <p class="lp-text-dim text-sm leading-relaxed">{features[1].desc}</p>
              </div>
              <div class="relative z-10 flex items-center gap-2 text-emerald-400 text-sm font-medium mt-4">
                <CheckCircle2 size={14} /> Auto-sync setiap transaksi
              </div>
            </div>

            {/* Payment */}
            <div class="reveal liquid-glass rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden group">
              <div class="absolute bottom-0 left-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
              <div class="relative z-10">
                <div class="p-3 rounded-xl bg-sky-500/20 w-fit mb-4"><Wallet class="text-sky-400" size={24} /></div>
                <h3 class="text-xl font-bold mb-2 lp-text-primary">{features[2].title}</h3>
                <p class="lp-text-dim text-sm leading-relaxed">{features[2].desc}</p>
              </div>
              <div class="relative z-10 flex items-center gap-3 mt-4">
                <span class="px-2 py-1 rounded-md bg-sky-500/20 text-sky-400 text-xs font-bold">QRIS</span>
                <span class="px-2 py-1 rounded-md bg-purple-500/20 text-purple-400 text-xs font-bold">OVO</span>
                <span class="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-bold">Tunai</span>
              </div>
            </div>

            {/* Offline */}
            <div class="reveal liquid-glass rounded-3xl p-8 col-span-1 lg:col-span-2 flex flex-col justify-between relative overflow-hidden group">
              <div class="absolute top-0 left-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
              <div class="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div>
                  <div class="p-3 rounded-xl bg-purple-500/20 w-fit mb-4"><CloudOff class="text-purple-400" size={24} /></div>
                  <h3 class="text-xl font-bold mb-2 lp-text-primary">{features[3].title}</h3>
                  <p class="lp-text-dim text-sm leading-relaxed max-w-md">{features[3].desc}</p>
                </div>
                <div class="flex items-center gap-6">
                  <div class="text-center">
                    <div class="text-emerald-400 font-bold text-2xl">99.9%</div>
                    <div class="lp-text-muted text-xs">Uptime</div>
                  </div>
                  <div class="w-px h-10 lp-divider"></div>
                  <div class="text-center">
                    <div class="text-purple-400 font-bold text-2xl">0ms</div>
                    <div class="lp-text-muted text-xs">Latency Offline</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics */}
            <div class="reveal liquid-glass rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden group">
              <div class="absolute bottom-0 right-0 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
              <div class="relative z-10">
                <div class="p-3 rounded-xl bg-pink-500/20 w-fit mb-4"><BarChart3 class="text-pink-400" size={24} /></div>
                <h3 class="text-xl font-bold mb-2 lp-text-primary">{features[4].title}</h3>
                <p class="lp-text-dim text-sm leading-relaxed">{features[4].desc}</p>
              </div>
              <div class="relative z-10 flex items-center gap-2 mt-4">
                <div class="flex-1 h-2 rounded-full lp-surface overflow-hidden"><div class="h-full w-3/4 bg-gradient-to-r from-pink-500 to-rose-400 rounded-full"></div></div>
                <span class="text-pink-400 font-bold text-sm">+24%</span>
              </div>
            </div>

            {/* Multi Branch */}
            <div class="reveal liquid-glass rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden group">
              <div class="absolute bottom-0 right-0 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
              <div class="relative z-10">
                <div class="p-3 rounded-xl bg-yellow-500/20 w-fit mb-4"><Store class="text-yellow-400" size={24} /></div>
                <h3 class="text-xl font-bold mb-2 lp-text-primary">{features[5].title}</h3>
                <p class="lp-text-dim text-sm leading-relaxed">{features[5].desc}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== STOCK AUDIT SHOWCASE ==================== */}
      <section id="stok" class="relative py-32 z-10">
        <div class="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div class="reveal">
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass text-sm text-orange-400 font-medium mb-6">
              <Boxes size={14} /> Manajemen Inventaris
            </div>
            <h2 class="text-4xl md:text-5xl font-bold mb-6 lp-text-primary">Audit Stok Tanpa Ribet.</h2>
            <p class="lp-text-dim leading-relaxed mb-8">
              Lupa update stok? KasirGo melakukannya untuk Anda. Setiap transaksi langsung memotong persediaan secara real-time. Sistem akan otomatis memberi peringatan saat stok menipis.
            </p>
            <div class="space-y-4">
              {[
                { title: "Sinkronisasi Real-time", desc: "Stok berubah saat kasir selesai checkout." },
                { title: "Smart Alert", desc: "Notifikasi WhatsApp saat stok kritis." },
                { title: "Stock Opname Digital", desc: "Hitung stok pakai HP, tanpa kertas lagi." },
              ].map((item) => (
                <div class="flex items-center gap-4">
                  <div class="p-2 rounded-lg bg-emerald-500/20"><CheckCircle2 class="text-emerald-400" size={20} /></div>
                  <div>
                    <h4 class="font-semibold lp-text-primary">{item.title}</h4>
                    <p class="text-sm lp-text-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit UI Mockup */}
          <div class="reveal liquid-glass rounded-3xl p-6 shadow-2xl">
            <div class="flex justify-between items-center mb-6">
              <h3 class="font-bold lp-text-primary">Status Inventaris</h3>
              <span class="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">Live</span>
            </div>
            <div class="space-y-3">
              <For each={stockData}>
                {(item) => (
                  <div class="flex items-center justify-between p-4 rounded-xl lp-surface hover:bg-white/10 transition-colors">
                    <div class="flex items-center gap-4">
                      <div class={`p-2 rounded-lg bg-${item.color}-500/20`}>
                        <Package class={`text-${item.color}-400`} size={20} />
                      </div>
                      <div>
                        <div class="font-medium text-sm lp-text-primary">{item.name}</div>
                        <div class="text-xs lp-text-muted">Stok: {item.stock} unit</div>
                      </div>
                    </div>
                    <span class={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      item.color === "emerald" ? "bg-emerald-500/20 text-emerald-400" :
                      item.color === "orange" ? "bg-orange-500/20 text-orange-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>{item.status}</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== PRICING ==================== */}
      <section id="harga" class="relative py-32 z-10">
        <div class="max-w-5xl mx-auto px-6">
          <div class="text-center mb-16 reveal">
            <h2 class="text-4xl md:text-5xl font-bold mb-4 lp-text-primary">Harga Transparan.</h2>
            <p class="lp-text-dim">Tanpa biaya tersembunyi. Mulai gratis, upgrade kapan saja.</p>
          </div>
          <div class="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <div class="reveal liquid-glass rounded-3xl p-8 flex flex-col">
              <h3 class="text-xl font-bold mb-2 lp-text-primary">Starter</h3>
              <p class="lp-text-dim text-sm mb-6">Untuk coba-coba.</p>
              <div class="mb-6">
                <span class="text-4xl font-bold lp-text-primary">Gratis</span>
              </div>
              <ul class="space-y-3 mb-8 text-sm lp-text-secondary flex-1">
                {["1 User", "50 Produk", "1 Toko", "Laporan Harian"].map((t) => (
                  <li class="flex items-center gap-2"><CheckCircle2 size={16} class="text-emerald-400" /> {t}</li>
                ))}
              </ul>
              <A href="/login" class="py-3 rounded-xl liquid-glass text-center font-semibold hover:bg-white/10 transition-colors">Mulai Gratis</A>
            </div>

            {/* Business */}
            <div class="reveal liquid-glass rounded-3xl p-8 flex flex-col relative border-2 border-emerald-500/50 shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]">
              <div class="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-slate-900 text-xs font-bold">POPULER</div>
              <h3 class="text-xl font-bold mb-2 lp-text-primary">Bisnis</h3>
              <p class="lp-text-dim text-sm mb-6">Untuk toko berkembang.</p>
              <div class="mb-6">
                <span class="text-4xl font-bold text-emerald-400">Rp 149rb</span>
                <span class="lp-text-muted">/bulan</span>
              </div>
              <ul class="space-y-3 mb-8 text-sm lp-text-secondary flex-1">
                {["Unlimited User", "Unlimited Produk", "Audit Stok Advance", "Multi Cabang (3)"].map((t) => (
                  <li class="flex items-center gap-2"><CheckCircle2 size={16} class="text-emerald-400" /> {t}</li>
                ))}
              </ul>
              <A href="/login" class="py-3 rounded-xl bg-emerald-500 text-slate-900 text-center font-bold hover:bg-emerald-400 transition-colors">Mulai Sekarang</A>
            </div>

            {/* Enterprise */}
            <div class="reveal liquid-glass rounded-3xl p-8 flex flex-col">
              <h3 class="text-xl font-bold mb-2 lp-text-primary">Enterprise</h3>
              <p class="lp-text-dim text-sm mb-6">Untuk jaringan besar.</p>
              <div class="mb-6">
                <span class="text-4xl font-bold lp-text-primary">Custom</span>
              </div>
              <ul class="space-y-3 mb-8 text-sm lp-text-secondary flex-1">
                {["Semua fitur Bisnis", "Unlimited Cabang", "Dedicated Support", "API Integration", "SLA 99.9%"].map((t) => (
                  <li class="flex items-center gap-2"><CheckCircle2 size={16} class="text-emerald-400" /> {t}</li>
                ))}
              </ul>
              <A href="#" class="py-3 rounded-xl liquid-glass text-center font-semibold hover:bg-white/10 transition-colors">Hubungi Sales</A>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section class="relative py-32 z-10 max-w-3xl mx-auto px-6">
        <div class="text-center mb-16 reveal">
          <h2 class="text-4xl md:text-5xl font-bold mb-4 lp-text-primary">FAQ.</h2>
        </div>
        <div class="space-y-4">
          <For each={faqs}>
            {(faq, idx) => (
              <div class="reveal liquid-glass rounded-2xl overflow-hidden">
                <button
                  class="w-full px-6 py-5 flex justify-between items-center text-left font-semibold hover:bg-white/5 transition-colors lp-text-primary"
                  onClick={() => setFaqOpen(faqOpen() === idx() ? -1 : idx())}
                >
                  {faq.q}
                  <Show when={faqOpen() === idx()} fallback={<span class="text-2xl text-emerald-400">+</span>}>
                    <span class="text-2xl text-emerald-400">-</span>
                  </Show>
                </button>
                <Show when={faqOpen() === idx()}>
                  <div class="px-6 pb-5 lp-text-dim text-sm leading-relaxed">{faq.a}</div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer class="relative z-10 py-12 lp-footer">
        <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center font-bold text-slate-900">K</div>
            <span class="font-bold text-lg lp-text-primary">KasirGo</span>
          </div>
          <p class="lp-text-muted text-sm">© 2026 KasirGo. All rights reserved.</p>
          <div class="flex gap-4 lp-text-dim text-sm">
            <a href="#" class="hover:text-emerald-400">Privacy</a>
            <a href="#" class="hover:text-emerald-400">Terms</a>
          </div>
        </div>
      </footer>

      {/* ==================== STYLES ==================== */}
      <style>{`
        /* Theme-aware landing page variables */
        .lp-root {
          --lp-bg: #020617;
          --lp-text: #e2e8f0;
          --lp-text-dim: #94a3b8;
          --lp-text-muted: #64748b;
          --lp-text-secondary: #cbd5e1;
          --lp-surface: rgba(255,255,255,0.05);
          --lp-border: rgba(255,255,255,0.08);
          --lp-border-avatar: #020617;
          --lp-footer-border: rgba(255,255,255,0.05);
          --lp-grid-opacity: 0.02;
          background: var(--lp-bg);
          color: var(--lp-text);
        }
        [data-theme="light"] .lp-root {
          --lp-bg: #f8fafc;
          --lp-text: #0f172a;
          --lp-text-dim: #475569;
          --lp-text-muted: #94a3b8;
          --lp-text-secondary: #334155;
          --lp-surface: rgba(0,0,0,0.04);
          --lp-border: rgba(0,0,0,0.08);
          --lp-border-avatar: #f8fafc;
          --lp-footer-border: rgba(0,0,0,0.08);
          --lp-grid-opacity: 0.04;
        }
        .lp-text-primary { color: var(--lp-text); }
        .lp-text-dim { color: var(--lp-text-dim); }
        .lp-text-muted { color: var(--lp-text-muted); }
        .lp-text-secondary { color: var(--lp-text-secondary); }
        .lp-surface { background: var(--lp-surface); }
        .lp-border-avatar { border-color: var(--lp-border-avatar); }
        .lp-divider { background: var(--lp-border); }
        .lp-footer { border-top: 1px solid var(--lp-footer-border); }
        .lp-grid {
          opacity: var(--lp-grid-opacity);
          background-image:
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
          background-size: 50px 50px;
        }
        [data-theme="light"] .lp-ambient > div {
          opacity: 0.4;
        }
        [data-theme="light"] .lp-root .liquid-glass {
          background: rgba(255,255,255,0.6);
          border-color: rgba(0,0,0,0.08);
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
        }
        [data-theme="light"] .lp-root .hero-anim h1 {
          background-image: linear-gradient(to bottom right, #0f172a, #334155, #64748b);
          -webkit-background-clip: text;
          background-clip: text;
        }
        [data-theme="light"] .lp-root nav .border-white\\/10 {
          border-color: rgba(0,0,0,0.1);
        }
        .liquid-glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 8px 32px 0 rgba(0, 0, 0, 0.37),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 0 rgba(0, 0, 0, 0.1);
        }
        .uplot { font-family: inherit !important; }
        .uplot .u-pack { display: none; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: var(--lp-bg); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
}
