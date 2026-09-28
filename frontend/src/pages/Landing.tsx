/**
 * Landing.tsx — KasirGO v4.0 "Momentum"
 * ------------------------------------------------------------------
 * Rombakan total:
 * • Lenis smooth scroll + GSAP ScrollTrigger (dalam gsap.context)
 * • Three.js: mesin kasir 3D custom (dibangun dari primitive) yang
 *   FIXED/sticky di layar — berputar & pindah posisi mengikuti
 *   section saat scroll (scrollytelling presets per-section)
 * • Struk 3D yang "tercetak" mengikuti progres scroll (clipping plane)
 * • HUD progres scroll 1–100% (bar tipis + readout) di atas layar
 * • Counter, marquee, magnetic button, cursor glow, parallax chip
 * • Avatar role via DiceBear (offline, tanpa API key)
 * ------------------------------------------------------------------
 */

import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { A } from "@solidjs/router";
import {
  ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight, Menu, Package,
  ScanLine, ShieldCheck, Sparkles, Store, TrendingUp, UtensilsCrossed,
  Wallet, X, Zap,
} from "lucide-solid";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createAvatar } from "@dicebear/core";
import { notionists } from "@dicebear/collection";
import landingData from "../data/landing.json";

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

/* ---------------- Types & Data ---------------- */
interface NavItem { label: string; id: string }
interface Feature { id: string; icon: string; tag: string; title: string; desc: string }
interface Stat { value: number; suffix?: string; decimals?: number; label: string }
interface Solution { id: string; icon: string; title: string; desc: string; points: string[]; stat: string }
interface Step { title: string; desc: string }
interface LandingData {
  nav: NavItem[];
  hero: { badge: string; titleLines: string[]; subtitle: string; primaryCta: string; secondaryCta: string; trust: string };
  marquee: string[];
  features: Feature[];
  stats: Stat[];
  solutions: Solution[];
  steps: Step[];
  cta: { title: string; subtitle: string; button: string; note: string };
  footer: { description: string; columns: { title: string; links: { label: string; href: string }[] }[]; copyright: string };
}

const D = landingData as unknown as LandingData;

const ICON_MAP: Record<string, any> = {
  ScanLine, Package, BarChart3, Store, Wallet, ShieldCheck, UtensilsCrossed, Zap,
};

/* ---------------- Helpers ---------------- */
const qa = <T extends Element = Element>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

const avatarCache = new Map<string, string>();
const avatarUri = (seed: string) => {
  if (!avatarCache.has(seed)) {
    try {
      avatarCache.set(seed, createAvatar(notionists, { seed, backgroundColor: ["111827"] }).toDataUri());
    } catch {
      avatarCache.set(seed, "");
    }
  }
  return avatarCache.get(seed)!;
};

/* Preset posisi/skala model 3D per-section (desktop).
   Model selalu fixed di layar — hanya "pindah panggung" saat scroll. */
interface Preset { x: number; y: number; scale: number; rx: number }
const PRESETS: Record<string, Preset> = {
  hero: { x: 1.8, y: 0.05, scale: 0.95, rx: 0 },
  fitur: { x: -1.8, y: 0.1, scale: 0.82, rx: 0.08 },
  statistik: { x: 0, y: 1.5, scale: 0.55, rx: 0.35 },
  solusi: { x: 1.8, y: 0, scale: 0.88, rx: -0.06 },
  langkah: { x: -1.8, y: 0.1, scale: 0.78, rx: 0.12 },
  testimoni: { x: 0, y: 1.3, scale: 0.5, rx: 0.3 },
  cta: { x: 0, y: -0.35, scale: 0.9, rx: 0.15 },
};

export default function Landing() {
  /* ---- Refs ---- */
  let canvas!: HTMLCanvasElement;
  let progressBar!: HTMLDivElement;
  let progressPct!: HTMLSpanElement;
  let marqueeTrack!: HTMLDivElement;
  let menuRef!: HTMLDivElement;
  let solusiPanel!: HTMLDivElement;
  let cursorRef!: HTMLDivElement;

  /* ---- Signals ---- */
  const [scrolled, setScrolled] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [activeSol, setActiveSol] = createSignal(D.solutions[0].id);
  const activeSolution = () => D.solutions.find((s) => s.id === activeSol())!;

  /* ---- Runtime state (non-reactive, mutasi langsung di rAF) ---- */
  let lenis: Lenis | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let rig: THREE.Group;      // posisi + skala (dikendalikan preset)
  let spin: THREE.Group;     // rotasi (dikendalikan scroll)
  let receiptMesh: THREE.Mesh;
  let receiptPlane: THREE.Plane;
  let screenTex: THREE.CanvasTexture;
  let screenCanvas: HTMLCanvasElement;
  let screenBase: HTMLCanvasElement;
  let particles: THREE.Points;
  let pSpeeds: number[] = [];
  let orbiters: { mesh: THREE.Mesh; r: number; a: number; speed: number; y: number; bobS: number; bobA: number; rotS: number; ph: number }[] = [];
  let cardGroup: THREE.Group;

  const scrollState = { progress: 0 };
  const modelState: Preset & { scale: number } = { x: PRESETS.hero.x, y: -1.4, scale: 0.001, rx: 0 };
  const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
  let receiptPrinted = 0.14;
  let currentSection = "hero";
  let tickFn: ((t: number, dt: number) => void) | null = null;
  let ctx: gsap.Context | null = null;
  const listeners: Array<[EventTarget, string, any]> = [];
  const disposables: Array<{ dispose(): void }> = [];
  let fontLink: HTMLLinkElement | null = null;

  const isNarrow = () => window.innerWidth < 1024;

  const applyPreset = (id: string, immediate = false) => {
    currentSection = id;
    const base = PRESETS[id] ?? PRESETS.hero;
    const p: Preset = { ...base };
    if (isNarrow()) {
      p.x = 0;
      p.y = base.y * 0.5 + (id === "hero" ? 0.9 : 0.55);
      p.scale = base.scale * 0.62;
    }
    if (immediate) gsap.set(modelState, p);
    else gsap.to(modelState, { ...p, duration: 1.15, ease: "power2.inOut", overwrite: "auto" });
  };

  const goTo = (id: string) => (e: Event) => {
    e.preventDefault();
    setMenuOpen(false);
    lenis?.scrollTo(`#${id}`, { offset: -76, duration: 1.5 });
  };

  /* ================================================================
   * THREE.JS — MESIN KASIR 3D
   * =============================================================== */
  const roundedBoxGeo = (w: number, h: number, d: number, r: number) => {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1,
      bevelSize: r * 0.35, bevelThickness: r * 0.35,
    });
    g.center();
    return g;
  };

  const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };

  /* --- Layar POS: UI kasir digambar ke CanvasTexture --- */
  const SW = 512, SH = 320;
  const drawScreenBase = () => {
    const c = screenBase.getContext("2d")!;
    c.clearRect(0, 0, SW, SH);
    c.fillStyle = "#0A1120"; rr(c, 0, 0, SW, SH, 14); c.fill();
    c.strokeStyle = "#1C2A44"; c.lineWidth = 2; rr(c, 1, 1, SW - 2, SH - 2, 13); c.stroke();

    // header
    c.fillStyle = "#0E1930"; rr(c, 10, 10, SW - 20, 46, 10); c.fill();
    c.fillStyle = "#34D399"; c.beginPath(); c.arc(36, 33, 6, 0, 7); c.fill();
    c.textAlign = "left";
    c.fillStyle = "#E7EEF9"; c.font = "700 17px 'Plus Jakarta Sans', sans-serif";
    c.fillText("KasirGO — Kasir 01", 54, 39);
    c.textAlign = "right"; c.fillStyle = "#5B6B85"; c.font = "500 15px 'Plus Jakarta Sans', sans-serif";
    c.fillText("21:36", SW - 26, 38); c.textAlign = "left";

    // grid produk
    const tiles: [string, string, string][] = [
      ["Kopi Susu", "Rp 18rb", "#34D399"], ["Nasi Goreng", "Rp 25rb", "#F59E0B"],
      ["Teh Tarik", "Rp 12rb", "#38BDF8"], ["Ayam Geprek", "Rp 22rb", "#F472B6"],
    ];
    tiles.forEach((t, i) => {
      const col = i % 2, row = (i / 2) | 0;
      const x = 16 + col * 146, y = 70 + row * 118, w = 134, h = 106;
      c.fillStyle = "#101B31"; rr(c, x, y, w, h, 12); c.fill();
      c.strokeStyle = "#1D2B47"; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, 12); c.stroke();
      c.fillStyle = t[2]; c.beginPath(); c.arc(x + 26, y + 28, 9, 0, 7); c.fill();
      c.fillStyle = "#DCE6F5"; c.font = "600 14px 'Plus Jakarta Sans', sans-serif"; c.fillText(t[0], x + 14, y + 62);
      c.fillStyle = t[2]; c.font = "700 13px 'Plus Jakarta Sans', sans-serif"; c.fillText(t[1], x + 14, y + 84);
    });

    // panel pesanan
    const px = 322;
    c.fillStyle = "#5B6B85"; c.font = "600 11px 'Plus Jakarta Sans', sans-serif"; c.fillText("PESANAN", px, 84);
    const items: [string, string][] = [
      ["2× Kopi Susu", "36rb"], ["1× Nasi Goreng", "25rb"], ["1× Teh Tarik", "12rb"],
      ["1× Ayam Geprek", "22rb"], ["2× Kerupuk", "7rb"],
    ];
    items.forEach((it, i) => {
      c.fillStyle = "#C7D3E6"; c.font = "500 13px 'Plus Jakarta Sans', sans-serif";
      c.fillText(it[0], px, 110 + i * 26);
      c.textAlign = "right"; c.fillStyle = "#8FA0BA"; c.fillText(it[1], SW - 24, 110 + i * 26);
      c.textAlign = "left";
    });
    c.strokeStyle = "#2A3A58"; c.setLineDash([5, 5]);
    c.beginPath(); c.moveTo(px, 246); c.lineTo(SW - 24, 246); c.stroke(); c.setLineDash([]);
    c.fillStyle = "#8FA0BA"; c.font = "600 13px 'Plus Jakarta Sans', sans-serif"; c.fillText("Total", px, 270);
    c.textAlign = "right"; c.fillStyle = "#F8FAFC"; c.font = "800 21px 'Space Grotesk', sans-serif";
    c.fillText("Rp 102rb", SW - 24, 271); c.textAlign = "left";
    c.fillStyle = "#10B981"; rr(c, px, 284, SW - 24 - px, 26, 13); c.fill();
    c.fillStyle = "#04120B"; c.font = "800 13px 'Plus Jakarta Sans', sans-serif"; c.textAlign = "center";
    c.fillText("BAYAR — QRIS", (px + SW - 24) / 2, 302); c.textAlign = "left";
  };

  const updateScreen = (t: number) => {
    const c = screenCanvas.getContext("2d")!;
    c.drawImage(screenBase, 0, 0);
    const y = ((t * 46) % (SH + 60)) - 30;
    const g = c.createLinearGradient(0, y, 0, y + 36);
    g.addColorStop(0, "rgba(110,231,183,0)");
    g.addColorStop(0.5, "rgba(110,231,183,0.14)");
    g.addColorStop(1, "rgba(110,231,183,0)");
    c.fillStyle = g; c.fillRect(0, y, SW, 36);
    screenTex.needsUpdate = true;
  };

  /* --- Tekstur struk thermal --- */
  const RW = 256, RH = 800;
  const drawReceiptTexture = () => {
    const cv = document.createElement("canvas");
    cv.width = RW; cv.height = RH;
    const c = cv.getContext("2d")!;
    const cx = RW / 2;
    c.fillStyle = "#F7F5EF"; c.fillRect(0, 0, RW, RH);
    c.textAlign = "center";
    c.fillStyle = "#0F172A"; c.font = "800 30px 'Space Grotesk', sans-serif"; c.fillText("KASIRGO", cx, 64);
    c.fillStyle = "#475569"; c.font = "500 15px 'Plus Jakarta Sans', sans-serif";
    c.fillText("Jl. Merdeka No. 88, Bandung", cx, 96);
    c.fillText("21:36 • Kasir 01 • Struk #0042", cx, 120);

    c.strokeStyle = "#94A3B8"; c.setLineDash([4, 5]);
    c.beginPath(); c.moveTo(28, 148); c.lineTo(RW - 28, 148); c.stroke();
    c.beginPath(); c.moveTo(28, 350); c.lineTo(RW - 28, 350); c.stroke();
    c.setLineDash([]);

    const items: [string, string][] = [
      ["2× Kopi Susu", "36.000"], ["1× Nasi Goreng", "25.000"], ["1× Teh Tarik", "12.000"],
      ["1× Ayam Geprek", "22.000"], ["2× Kerupuk", "7.000"],
    ];
    c.textAlign = "left";
    items.forEach((it, i) => {
      c.fillStyle = "#334155"; c.font = "500 16px 'Plus Jakarta Sans', sans-serif";
      c.fillText(it[0], 28, 186 + i * 34);
      c.textAlign = "right"; c.fillText(it[1], RW - 28, 186 + i * 34); c.textAlign = "left";
    });
    c.fillStyle = "#0F172A"; c.font = "700 18px 'Plus Jakarta Sans', sans-serif";
    c.fillText("TOTAL", 28, 392);
    c.textAlign = "right"; c.font = "800 20px 'Space Grotesk', sans-serif";
    c.fillText("Rp 102.000", RW - 28, 392); c.textAlign = "left";
    c.fillStyle = "#475569"; c.font = "500 15px 'Plus Jakarta Sans', sans-serif";
    c.fillText("Tunai", 28, 420);
    c.textAlign = "right"; c.fillText("Rp 102.000", RW - 28, 420); c.textAlign = "center";
    c.fillStyle = "#0F172A"; c.fillText("Terima kasih sudah belanja!", cx, 462);
    c.fillStyle = "#64748B"; c.font = "500 13px 'Plus Jakarta Sans', sans-serif";
    c.fillText("kasirgo.go/s/0042", cx, 488);

    // barcode
    c.fillStyle = "#0F172A";
    let bx = 36, s = 7;
    while (bx < RW - 40) {
      const w = (s % 3) + 1.5;
      c.fillRect(bx, 524, w, 96);
      bx += w + ((s * 7) % 4) + 2;
      s = (s * 31 + 17) % 97;
    }

    // mini QR
    const qx = cx - 40, qy = 656;
    c.strokeStyle = "#0F172A"; c.lineWidth = 2; c.strokeRect(qx, qy, 80, 80);
    const finder = (fx: number, fy: number) => {
      c.fillStyle = "#0F172A"; c.fillRect(fx, fy, 18, 18);
      c.fillStyle = "#F7F5EF"; c.fillRect(fx + 4, fy + 4, 10, 10);
      c.fillStyle = "#0F172A"; c.fillRect(fx + 7, fy + 7, 4, 4);
    };
    finder(qx + 8, qy + 8); finder(qx + 54, qy + 8); finder(qx + 8, qy + 54);
    c.fillStyle = "#0F172A";
    [[40, 44], [52, 38], [36, 58], [58, 56], [44, 50], [64, 44], [38, 36]]
      .forEach(([dx, dy]) => c.fillRect(qx + dx, qy + dy, 5, 5));
    c.fillStyle = "#64748B"; c.font = "500 12px 'Plus Jakarta Sans', sans-serif";
    c.fillText("Scan untuk rating & struk digital", cx, qy + 104);

    return new THREE.CanvasTexture(cv);
  };

  const initThree = () => {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.localClippingEnabled = true; // untuk efek struk "tercetak"

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 60);
    camera.position.set(0, 0.25, 6.4);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
    disposables.push(pmrem);

    // Cahaya
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 7, 6); scene.add(key);
    const rim = new THREE.PointLight(0x34d399, 40, 24); rim.position.set(-4.5, 2.5, -3); scene.add(rim);
    const warm = new THREE.PointLight(0xf59e0b, 22, 18); warm.position.set(3.5, -2.5, 3.5); scene.add(warm);

    rig = new THREE.Group();
    spin = new THREE.Group();
    rig.add(spin);
    scene.add(rig);

    /* ---- Badan mesin kasir ---- */
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a3344, metalness: 0.55, roughness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0e1420, metalness: 0.4, roughness: 0.5 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x34d399 }); glowMat.toneMapped = false;
    const amberMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 }); amberMat.toneMapped = false;

    const plinth = new THREE.Mesh(roundedBoxGeo(2.4, 0.12, 1.6, 0.05), darkMat);
    plinth.position.y = -0.4;
    const body = new THREE.Mesh(roundedBoxGeo(2.15, 0.52, 1.35, 0.1), bodyMat);
    body.position.y = -0.08;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.045, 0.02), glowMat);
    strip.position.set(0, -0.08, 0.685);

    // Layar miring
    const slab = new THREE.Group();
    slab.position.set(0, 0.62, -0.38);
    slab.rotation.x = -0.18;
    const slabMesh = new THREE.Mesh(
      roundedBoxGeo(1.62, 1.02, 0.14, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x161d2b, metalness: 0.6, roughness: 0.3 })
    );
    screenCanvas = document.createElement("canvas");
    screenCanvas.width = SW; screenCanvas.height = SH;
    screenBase = document.createElement("canvas");
    screenBase.width = SW; screenBase.height = SH;
    drawScreenBase();
    screenTex = new THREE.CanvasTexture(screenCanvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    screenTex.anisotropy = 4;
    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.42, 0.82),
      new THREE.MeshBasicMaterial({ map: screenTex })
    );
    (screenMesh.material as THREE.MeshBasicMaterial).toneMapped = false;
    screenMesh.position.z = 0.085;
    slab.add(slabMesh, screenMesh);

    // Tombol keypad
    const keyGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 20);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const isGreen = r === 0 && c === 2;
        const k = new THREE.Mesh(keyGeo, isGreen ? glowMat : darkMat);
        k.position.set(-0.28 + c * 0.28, 0.2, 0.28 + r * 0.22);
        spin.add(k);
      }
    }

    // Slot struk + struk yang menggantung
    const slot = new THREE.Mesh(roundedBoxGeo(0.66, 0.07, 0.12, 0.03), darkMat);
    slot.position.set(0, 0.235, 0.6);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.014, 0.02), glowMat);
    slit.position.set(0, 0.235, 0.665);

    receiptPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.14);
    const rGeo = new THREE.PlaneGeometry(0.58, 1.82, 6, 30);
    const rPos = rGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const y = rPos.getY(i);
      rPos.setZ(i, Math.sin(y * 4) * 0.015 + y * y * 0.008);
    }
    rGeo.translate(0, -0.91, 0);
    rGeo.computeVertexNormals();
    const rMat = new THREE.MeshBasicMaterial({
      map: drawReceiptTexture(), side: THREE.DoubleSide,
    });
    rMat.toneMapped = false;
    rMat.clippingPlanes = [receiptPlane];
    receiptMesh = new THREE.Mesh(rGeo, rMat);
    receiptMesh.position.set(0, 0.24, 0.66);
    receiptMesh.rotation.x = -0.06;

    // Card reader samping
    const reader = new THREE.Mesh(roundedBoxGeo(0.14, 0.34, 0.55, 0.05), bodyMat);
    reader.position.set(-1.16, 0.02, 0.15);
    const rLight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.3), amberMat);
    rLight.position.set(-1.235, 0.1, 0.15);

    spin.add(plinth, body, strip, slab, slot, slit, receiptMesh, reader, rLight);

    /* ---- Koin emas & kotak produk mengorbit ---- */
    const coinGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.035, 40);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xf7c948, metalness: 1, roughness: 0.18 });
    const boxColors = [0x0d9488, 0xf59e0b, 0x334155];
    for (let i = 0; i < 8; i++) {
      const isBox = i >= 6;
      const mesh = isBox
        ? new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22),
          new THREE.MeshStandardMaterial({ color: boxColors[i - 6], metalness: 0.3, roughness: 0.45 }))
        : new THREE.Mesh(coinGeo, coinMat);
      spin.add(mesh);
      orbiters.push({
        mesh, r: 1.5 + Math.random() * 0.55, a: (i / 8) * Math.PI * 2 + Math.random() * 0.5,
        speed: 0.22 + Math.random() * 0.3, y: -0.7 + Math.random() * 1.7,
        bobS: 0.7 + Math.random(), bobA: 0.08 + Math.random() * 0.16,
        rotS: 0.8 + Math.random() * 1.4, ph: Math.random() * 6.28,
      });
    }

    // Kartu debit melayang
    cardGroup = new THREE.Group();
    const cardBody = new THREE.Mesh(
      roundedBoxGeo(0.55, 0.34, 0.025, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x0f766e, metalness: 0.35, roughness: 0.4 })
    );
    const cardStripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.012), amberMat);
    cardStripe.position.y = 0.1;
    const cardChip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.015), coinMat);
    cardChip.position.set(-0.15, -0.03, 0.015);
    cardGroup.add(cardBody, cardStripe, cardChip);
    cardGroup.position.set(1.35, 0.95, -0.5);
    spin.add(cardGroup);

    // Cincin orbit (pandu mata)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x34d399, transparent: true, opacity: 0.13,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    ringMat.toneMapped = false;
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.005, 8, 128), ringMat);
    ring1.rotation.x = Math.PI / 2; ring1.rotation.z = 0.1;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.004, 8, 128), ringMat.clone());
    (ring2.material as THREE.MeshBasicMaterial).opacity = 0.07;
    ring2.rotation.x = Math.PI / 2; ring2.rotation.z = -0.06;
    spin.add(ring1, ring2);

    /* ---- Partikel debu atmosferik ---- */
    const spriteCv = document.createElement("canvas");
    spriteCv.width = spriteCv.height = 64;
    const sc = spriteCv.getContext("2d")!;
    const grad = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    sc.fillStyle = grad; sc.fillRect(0, 0, 64, 64);
    const spriteTex = new THREE.CanvasTexture(spriteCv);

    const pCount = 170;
    const pos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 7;
      pos[i * 3 + 2] = -3 + Math.random() * 5;
      pSpeeds.push(0.08 + Math.random() * 0.22);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
      size: 0.055, map: spriteTex, transparent: true, opacity: 0.5,
      color: 0x6ee7b7, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(particles);

    // Redraw tekstur setelah webfont siap
    document.fonts?.ready.then(() => { drawScreenBase(); });
  };

  /* ================================================================
   * MOUNT — Lenis, GSAP, interaksi
   * =============================================================== */
  onMount(() => {
    /* Font display (Space Grotesk) + body (Plus Jakarta Sans — font karya desainer Indonesia) */
    fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href =
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap";
    document.head.appendChild(fontLink);

    /* Lenis smooth scroll + sinkronisasi GSAP */
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", (e: any) => {
      ScrollTrigger.update();
      setScrolled((e.scroll ?? 0) > 40);
    });
    gsap.ticker.lagSmoothing(0);

    initThree();

    /* Render loop utama: Lenis + Three.js dalam satu ticker */
    tickFn = (time: number, deltaMs: number) => {
      lenis?.raf(time * 1000);
      if (!renderer) return;
      const t = time;
      const dt = Math.min(deltaMs / 1000, 0.05);
      const vel = lenis?.velocity ?? 0;

      // Parallax kamera mengikuti mouse
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      camera.position.x = mouse.x * 0.45;
      camera.position.y = 0.25 - mouse.y * 0.3;
      camera.position.z = 6.4 + Math.sin(t * 0.2) * 0.07;
      camera.lookAt(0, 0.15, 0);

      // Rig: posisi & skala dari preset section (di-tween GSAP)
      rig.position.set(modelState.x, modelState.y + Math.sin(t * 1.1) * 0.07, 0);
      const s = modelState.scale;
      rig.scale.set(s, s, s);

      // Spin: rotasi kontinu + ekstra dari progres scroll ⭐
      spin.rotation.y = t * 0.1 + scrollState.progress * Math.PI * 4.5;
      spin.rotation.x = modelState.rx + Math.sin(t * 0.6) * 0.04;

      // Orbiter (koin & kotak) — makin cepat saat scroll ngebut
      const boost = 1 + Math.min(Math.abs(vel), 4) * 0.35;
      orbiters.forEach((o, i) => {
        o.a += o.speed * dt * boost;
        o.mesh.position.set(
          Math.cos(o.a) * o.r,
          o.y + Math.sin(t * o.bobS + o.ph) * o.bobA,
          Math.sin(o.a) * o.r
        );
        o.mesh.rotation.x = t * o.rotS + i;
        o.mesh.rotation.y = t * (o.rotS * 0.7) + i * 0.7;
      });

      // Kartu melayang
      cardGroup.position.y = 0.95 + Math.sin(t * 0.9) * 0.1;
      cardGroup.rotation.y = t * 0.45;
      cardGroup.rotation.z = Math.sin(t * 0.6) * 0.15;

      // Struk "tercetak" seiring progres scroll (clipping plane)
      const target = THREE.MathUtils.clamp(0.14 + scrollState.progress * 2.6, 0.14, 1.82);
      receiptPrinted += (target - receiptPrinted) * 0.06;
      const top = modelState.y + 0.24 * modelState.scale;
      receiptPlane.constant = receiptPrinted * modelState.scale - top;
      receiptMesh.rotation.z = Math.sin(t * 1.4) * 0.05;

      // Scanline layar POS
      updateScreen(t);

      // Partikel naik perlahan
      const pp = particles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pSpeeds.length; i++) {
        let y = pp.getY(i) + pSpeeds[i] * dt;
        if (y > 3.6) y = -3.6;
        pp.setY(i, y);
      }
      pp.needsUpdate = true;

      renderer.render(scene, camera);
    };
    gsap.ticker.add(tickFn);

    /* ---- GSAP: semua trigger dibungkus context agar aman saat unmount ---- */
    ctx = gsap.context(() => {
      // HUD progres scroll 1–100% (bar tipis di paling atas)
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          scrollState.progress = self.progress;
          progressBar.style.transform = `scaleX(${self.progress})`;
          progressPct.textContent = `${Math.round(self.progress * 100)}%`;
        },
      });

      // Preset posisi model per-section (model fixed, "pindah panggung")
      ["hero", "fitur", "statistik", "solusi", "langkah", "testimoni", "cta"].forEach((id) => {
        ScrollTrigger.create({
          trigger: `#${id}`,
          start: "top 60%",
          end: "bottom 40%",
          onEnter: () => applyPreset(id),
          onEnterBack: () => applyPreset(id),
        });
      });

      // Intro hero: model muncul dari bawah + tipografi masuk baris demi baris
      gsap.to(modelState, {
        y: PRESETS.hero.y, scale: PRESETS.hero.scale,
        duration: 1.9, ease: "expo.out", delay: 0.35,
      });
      gsap.timeline({ delay: 0.15 })
        .from(".hero-line", { yPercent: 115, duration: 1.15, stagger: 0.1, ease: "power4.out" })
        .from(".hero-fade", { y: 26, opacity: 0, duration: 0.9, stagger: 0.08, ease: "power3.out" }, "-=0.7")
        .from(".nav-anim", { y: -16, opacity: 0, duration: 0.7, stagger: 0.05, ease: "power3.out" }, 0.2);

      // Chip melayang di hero (yoyo loop)
      qa(".float-chip").forEach((el, i) => {
        gsap.to(el, { y: 10 + i * 5, duration: 2.4 + i * 0.5, yoyo: true, repeat: -1, ease: "sine.inOut" });
      });

      // Reveal generik
      qa("[data-reveal]").forEach((el) => {
        gsap.fromTo(el, { y: 44, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1, ease: "power3.out",
          delay: parseFloat((el as HTMLElement).dataset.delay || "0"),
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });

      // Counter statistik
      qa<HTMLElement>("[data-count]").forEach((el) => {
        const target = parseFloat(el.dataset.count!);
        const suffix = el.dataset.suffix ?? "";
        const decimals = parseInt(el.dataset.decimals ?? "0", 10);
        const obj = { v: 0 };
        ScrollTrigger.create({
          trigger: el, start: "top 85%", once: true,
          onEnter: () =>
            gsap.to(obj, {
              v: target, duration: 2.2, ease: "power2.out",
              onUpdate: () => {
                el.textContent =
                  obj.v.toLocaleString("id-ID", {
                    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
                  }) + suffix;
              },
            }),
        });
      });

      // Marquee fitur
      gsap.to(marqueeTrack, { xPercent: -50, ease: "none", duration: 26, repeat: -1 });
    });

    /* ---- Interaksi mouse: parallax chip + cursor glow ---- */
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (canHover) {
      const chipTos = qa<HTMLElement>("[data-parallax]").map((el) => ({
        x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3" }),
        y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3" }),
        f: parseFloat(el.dataset.parallax || "14"),
      }));
      const cxTo = gsap.quickTo(cursorRef, "x", { duration: 0.5, ease: "power3" });
      const cyTo = gsap.quickTo(cursorRef, "y", { duration: 0.5, ease: "power3" });

      const onMove = (e: MouseEvent) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
        chipTos.forEach((c) => { c.x(mouse.tx * c.f); c.y(mouse.ty * c.f * 0.6); });
        cxTo(e.clientX); cyTo(e.clientY);
      };
      const onOver = (e: MouseEvent) => {
        const hit = (e.target as Element).closest?.("a,button");
        gsap.to(cursorRef, { scale: hit ? 1.7 : 1, duration: 0.3, ease: "power2.out" });
      };
      window.addEventListener("mousemove", onMove);
      document.addEventListener("mouseover", onOver);
      listeners.push([window, "mousemove", onMove], [document, "mouseover", onOver]);

      // Magnetic buttons
      qa<HTMLElement>(".magnetic").forEach((btn) => {
        const xTo = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3" });
        const yTo = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3" });
        const mm = (e: MouseEvent) => {
          const r = btn.getBoundingClientRect();
          xTo(((e.clientX - r.left) / r.width - 0.5) * 22);
          yTo(((e.clientY - r.top) / r.height - 0.5) * 22);
        };
        const ml = () => { xTo(0); yTo(0); };
        btn.addEventListener("mousemove", mm);
        btn.addEventListener("mouseleave", ml);
        listeners.push([btn, "mousemove", mm], [btn, "mouseleave", ml]);
      });
    }

    /* ---- Resize & misc ---- */
    const onResize = () => {
      if (!renderer) return;
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      applyPreset(currentSection, true);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    listeners.push([window, "resize", onResize], [window, "keydown", onKey]);

    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);
    listeners.push([window, "load", onLoad]);
    ScrollTrigger.refresh();
  });

  /* ---- Animasi panel Solusi saat tab diganti ---- */
  createEffect(() => {
    activeSol();
    if (solusiPanel) {
      gsap.fromTo(solusiPanel, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", overwrite: true });
    }
  });

  /* ---- Overlay menu mobile ---- */
  createEffect(() => {
    if (menuOpen()) {
      lenis?.stop();
      document.documentElement.style.overflow = "hidden";
      if (menuRef) {
        gsap.fromTo(menuRef, { opacity: 0 }, { opacity: 1, duration: 0.35 });
        gsap.fromTo(qa(".menu-link", menuRef), { y: 40, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.6, stagger: 0.07, ease: "power3.out", delay: 0.08,
        });
      }
    } else {
      lenis?.start();
      document.documentElement.style.overflow = "";
    }
  });

  onCleanup(() => {
    listeners.forEach(([t, k, fn]) => t.removeEventListener(k, fn));
    listeners.length = 0;
    ctx?.revert();
    ScrollTrigger.getAll().forEach((st) => st.kill());
    if (tickFn) gsap.ticker.remove(tickFn);
    lenis?.destroy();
    // Dispose WebGL
    scene?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    });
    disposables.forEach((d) => d.dispose());
    renderer?.dispose();
    fontLink?.remove();
    document.documentElement.style.overflow = "";
  });

  const stars = () => null; /* belum ada rating nyata — disembunyikan */

  /* ================================================================
   * RENDER
   * =============================================================== */
  return (
    <div
      class="kg relative min-h-screen bg-[#06070A] text-white antialiased"
      style={{ "color-scheme": "dark" }}
      data-page-theme="dark"
    >
      <style>{`
        .kg { font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif; }
        .font-display { font-family: 'Space Grotesk', 'Plus Jakarta Sans', sans-serif; }
        html { background: #06070A; scroll-behavior: auto; }
        html.lenis, html.lenis body { height: auto; }
        .lenis.lenis-smooth { scroll-behavior: auto !important; }
        ::selection { background: rgba(52,211,153,0.35); color: #fff; }
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: #06070A; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: #10b981; }
        .outline-text { -webkit-text-stroke: 1.5px rgba(226,232,240,0.9); color: transparent; }
        @keyframes scrolldot { 0% { transform: translateY(-4px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(34px); opacity: 0; } }
        .scroll-dot { animation: scrolldot 1.8s ease-in-out infinite; }
      `}</style>

      {/* ====== Latar: dot grid + aurora halus ====== */}
      <div class="pointer-events-none fixed inset-0 z-0">
        <div
          class="absolute inset-0"
          style="background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 34px 34px;"
        />
        <div class="absolute -top-40 left-1/4 h-[480px] w-[480px] rounded-full opacity-[0.13] blur-[130px]" style="background:#10B981" />
        <div class="absolute bottom-0 right-0 h-[420px] w-[520px] rounded-full opacity-[0.08] blur-[130px]" style="background:#F59E0B" />
      </div>

      {/* ====== Canvas 3D — STICKY/fixed, berputar saat scroll ====== */}
      <div class="pointer-events-none fixed inset-0 z-[1] opacity-50 transition-opacity duration-700 lg:opacity-100">
        <canvas ref={canvas} class="h-full w-full" />
      </div>

      {/* ====== HUD progres scroll (bar tipis 1–100%) ====== */}
      <div class="pointer-events-none fixed inset-x-0 top-0 z-[80]">
        <div class="relative h-[3px] w-full bg-white/[0.07]">
          <div
            ref={progressBar}
            class="h-full w-full origin-left scale-x-0 bg-emerald-400"
            style="box-shadow: 0 0 16px rgba(52,211,153,0.85);"
          />
          <For each={[20, 40, 60, 80]}>
            {(p) => <span class="absolute bottom-0 h-[5px] w-px bg-white/15" style={`left: ${p}%`} />}
          </For>
        </div>
        <div class="absolute left-1/2 top-[9px] flex -translate-x-1/2 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">
          <span class="hidden sm:inline">Gulir</span>
          <span ref={progressPct} class="font-semibold text-emerald-300">0%</span>
        </div>
      </div>

      {/* ====== Navbar (fitur tetap tersedia) ====== */}
      <header
        class={`fixed inset-x-0 top-0 z-[70] transition-all duration-500 ${scrolled() ? "border-b border-white/[0.06] bg-[#06070A]/75 backdrop-blur-xl" : ""
          }`}
      >
        <nav class="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
          <A href="/" class="nav-anim flex items-center gap-2.5">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-[#04120B] shadow-[0_0_24px_rgba(52,211,153,0.35)]">
              <ScanLine size={19} strokeWidth={2.4} />
            </span>
            <span class="font-display text-lg font-bold tracking-tight text-white">
              Kasir<span class="text-emerald-300">GO</span>
            </span>
          </A>

          <div class="hidden items-center gap-8 lg:flex">
            <For each={D.nav}>
              {(n) => (
                <a
                  href={`#${n.id}`}
                  onClick={goTo(n.id)}
                  class="nav-anim text-sm text-white/60 transition-colors hover:text-white"
                >
                  {n.label}
                </a>
              )}
            </For>
          </div>

          <div class="hidden items-center gap-3 lg:flex">
            <A href="/login" class="nav-anim rounded-full px-4 py-2 text-sm text-white/70 transition-colors hover:text-white">
              Masuk
            </A>
            <A
              href="/login"
              class="nav-anim magnetic group flex items-center gap-1.5 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-[#04120B] transition-colors hover:bg-emerald-300"
            >
              Daftar Gratis
              <ArrowRight size={15} class="transition-transform group-hover:translate-x-0.5" />
            </A>
          </div>

          <button
            class="text-white lg:hidden"
            onClick={() => setMenuOpen(!menuOpen())}
            aria-label="Buka menu"
          >
            <Show when={menuOpen()} fallback={<Menu size={24} />}>
              <X size={24} />
            </Show>
          </button>
        </nav>
      </header>

      {/* ====== Overlay menu mobile ====== */}
      <Show when={menuOpen()}>
        <div ref={menuRef} class="fixed inset-0 z-[65] flex flex-col justify-center bg-[#06070A]/95 px-8 backdrop-blur-2xl">
          <For each={D.nav}>
            {(n, i) => (
              <a
                href={`#${n.id}`}
                onClick={goTo(n.id)}
                class="menu-link flex items-center justify-between border-b border-white/5 py-5 font-display text-3xl font-semibold text-white/85 transition-colors hover:text-emerald-300"
              >
                {n.label}
                <span class="font-mono text-xs text-white/25">0{i() + 1}</span>
              </a>
            )}
          </For>
          <div class="mt-10 flex gap-3">
            <A href="/login" class="flex-1 rounded-full border border-white/15 py-3 text-center text-sm font-semibold text-white/80">
              Masuk
            </A>
            <A href="/login" class="flex-1 rounded-full bg-emerald-400 py-3 text-center text-sm font-semibold text-[#04120B]">
              Daftar Gratis
            </A>
          </div>
        </div>
      </Show>

      {/* ====== KONTEN ====== */}
      <main class="relative z-10 overflow-x-clip">

        {/* ---------- HERO ---------- */}
        <section id="hero" class="relative flex min-h-screen items-center">
          <div class="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 pb-16 pt-[52vh] lg:grid-cols-12 lg:pt-24">
            <div class="lg:col-span-6">
              <div class="hero-fade inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-1.5 text-xs font-medium text-emerald-200">
                <Sparkles size={13} class="text-emerald-300" />
                {D.hero.badge}
              </div>

              <h1 class="mt-6 font-display text-[clamp(2.75rem,6.5vw,5.25rem)] font-bold leading-[1.02] tracking-tight">
                <For each={D.hero.titleLines}>
                  {(line, i) => (
                    <span class="block overflow-hidden pb-1">
                      <span
                        class="hero-line block"
                        classList={{ "text-emerald-300": i() === 1, "outline-text": i() === 2 }}
                      >
                        {line}
                      </span>
                    </span>
                  )}
                </For>
              </h1>

              <p class="hero-fade mt-6 max-w-lg text-base leading-relaxed text-white/55 lg:text-lg">
                {D.hero.subtitle}
              </p>

              <div class="hero-fade mt-9 flex flex-wrap items-center gap-4">
                <A
                  href="/login"
                  class="magnetic group flex items-center gap-2 rounded-full bg-emerald-400 px-7 py-3.5 text-sm font-bold text-[#04120B] transition-colors hover:bg-emerald-300"
                >
                  {D.hero.primaryCta}
                  <ArrowRight size={16} class="transition-transform group-hover:translate-x-1" />
                </A>
                <a
                  href="#fitur"
                  onClick={goTo("fitur")}
                  class="rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-white/80 transition-colors hover:border-emerald-400/50 hover:text-white"
                >
                  {D.hero.secondaryCta}
                </a>
              </div>

              <div class="hero-fade mt-10 flex flex-wrap items-center gap-4">
                <div class="flex -space-x-2.5">
                  <For each={["Admin", "Kasir", "Manajer"]}>
                    {(s) => (
                      <img src={avatarUri(s)} alt="" class="h-9 w-9 rounded-full border-2 border-[#06070A] bg-[#111827]" />
                    )}
                  </For>
                </div>
                <div>
                  <p class="text-xs text-white/45">{D.hero.trust}</p>
                </div>
              </div>
            </div>

            <div class="hidden lg:col-span-6 lg:block" />
          </div>

          {/* Chip UI melayang di area model */}
          <div class="pointer-events-none absolute right-[5%] top-[16%] hidden xl:block" data-parallax="20">
            <div class="float-chip rounded-2xl border border-white/10 bg-[#0B0E14]/85 px-5 py-4 shadow-2xl backdrop-blur-md">
              <div class="flex items-center gap-3">
                <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                  <TrendingUp size={18} />
                </span>
                <div>
                  <div class="text-[10px] uppercase tracking-wider text-white/40">Penjualan hari ini</div>
                  <div class="font-display text-lg font-semibold text-white">
                    Rp 4.280.000 <span class="text-xs text-emerald-300">+12,4%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="pointer-events-none absolute right-[13%] top-[56%] hidden xl:block" data-parallax="-14">
            <div class="float-chip rounded-2xl border border-white/10 bg-[#0B0E14]/85 px-5 py-4 shadow-2xl backdrop-blur-md">
              <div class="flex items-center gap-3">
                <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
                  <Package size={18} />
                </span>
                <div>
                  <div class="text-[10px] uppercase tracking-wider text-white/40">Stok menipis</div>
                  <div class="text-sm font-semibold text-white">Kopi Susu — sisa 8</div>
                </div>
              </div>
            </div>
          </div>

          {/* Petunjuk gulir */}
          <div class="hero-fade absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2.5">
            <span class="font-mono text-[10px] uppercase tracking-[0.35em] text-white/35">Gulir</span>
            <div class="relative h-10 w-px overflow-hidden bg-white/10">
              <span class="scroll-dot absolute left-0 top-0 h-3 w-px bg-emerald-300" />
            </div>
          </div>
        </section>

        {/* ---------- MARQUEE ---------- */}
        <section class="relative overflow-hidden border-y border-white/10 bg-white/[0.02] py-5">
          <div ref={marqueeTrack} class="flex w-max items-center gap-10 whitespace-nowrap">
            <For each={[...D.marquee, ...D.marquee]}>
              {(m) => (
                <span class="flex items-center gap-10 font-mono text-xs uppercase tracking-[0.3em] text-white/45">
                  {m}
                  <Sparkles size={12} class="text-emerald-400/70" />
                </span>
              )}
            </For>
          </div>
        </section>

        {/* ---------- FITUR (model 3D di kiri) ---------- */}
        <section id="fitur" class="relative py-28 lg:py-36">
          <div class="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-12">
            <div class="hidden lg:col-span-5 lg:block" />
            <div class="lg:col-span-7">
              <div data-reveal class="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/90">
                <span class="h-px w-8 bg-emerald-300/60" /> 02 — Fitur
              </div>
              <h2 data-reveal class="mt-5 font-display text-[clamp(1.9rem,4vw,3.2rem)] font-bold leading-[1.08] tracking-tight">
                Semua yang Kasir Anda Butuhkan.{" "}
                <span class="text-white/35">Tanpa Kompleksitas.</span>
              </h2>

              <div class="mt-10">
                <For each={D.features}>
                  {(f, i) => (
                    <div
                      data-reveal data-delay={i() * 0.06}
                      class="group border-t border-white/10 py-7 transition-colors last:border-b hover:border-emerald-400/40"
                    >
                      <div class="flex items-start gap-5">
                        <span class="pt-1 font-mono text-xs text-white/30">0{i() + 1}</span>
                        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-emerald-300 transition-all group-hover:border-emerald-400/50 group-hover:bg-emerald-400/10">
                          <Dynamic component={ICON_MAP[f.icon] ?? Sparkles} size={20} />
                        </span>
                        <div>
                          <div class="flex flex-wrap items-center gap-3">
                            <h3 class="font-display text-lg font-semibold">{f.title}</h3>
                            <span class="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/40">
                              {f.tag}
                            </span>
                          </div>
                          <p class="mt-1.5 max-w-md text-sm leading-relaxed text-white/55">{f.desc}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- STATISTIK (model mengecil di atas band) ---------- */}
        <section id="statistik" class="relative border-y border-white/10 bg-black/40 py-24 backdrop-blur-sm lg:py-28">
          <div class="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-12 px-6 lg:grid-cols-4">
            <For each={D.stats}>
              {(s) => (
                <div data-reveal class="text-center">
                  <div
                    class="font-display text-4xl font-bold lg:text-5xl"
                    data-count={String(s.value)}
                    data-suffix={s.suffix ?? ""}
                    data-decimals={String(s.decimals ?? 0)}
                  >
                    0
                  </div>
                  <div class="mt-2.5 font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">{s.label}</div>
                </div>
              )}
            </For>
          </div>
        </section>

        {/* ---------- SOLUSI (model 3D di kanan) ---------- */}
        <section id="solusi" class="relative py-28 lg:py-36">
          <div class="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-12">
            <div class="lg:col-span-6">
              <div data-reveal class="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/90">
                <span class="h-px w-8 bg-emerald-300/60" /> 03 — Solusi
              </div>
              <h2 data-reveal class="mt-5 font-display text-[clamp(1.9rem,4vw,3.2rem)] font-bold leading-[1.08] tracking-tight">
                Satu Aplikasi, <span class="text-emerald-300">Sesuai Bidang Usaha Anda.</span>
              </h2>

              <div class="mt-10 space-y-3">
                <For each={D.solutions}>
                  {(s) => (
                    <button
                      data-reveal
                      onClick={() => setActiveSol(s.id)}
                      class={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-300 ${activeSol() === s.id
                          ? "border-emerald-400/50 bg-emerald-400/[0.08] text-white"
                          : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/25 hover:text-white"
                        }`}
                    >
                      <span
                        class={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${activeSol() === s.id ? "bg-emerald-400/20 text-emerald-300" : "bg-white/5 text-white/40"
                          }`}
                      >
                        <Dynamic component={ICON_MAP[s.icon] ?? Store} size={16} />
                      </span>
                      <span class="text-sm font-semibold">{s.title}</span>
                      <ChevronRight
                        size={15}
                        class={`ml-auto transition-all duration-300 ${activeSol() === s.id ? "text-emerald-300 opacity-100" : "opacity-25"
                          }`}
                      />
                    </button>
                  )}
                </For>
              </div>

              <div ref={solusiPanel} class="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:p-7">
                <Show when={activeSolution()} keyed>
                  {(s) => (
                    <div>
                      <h3 class="font-display text-xl font-semibold lg:text-2xl">{s.title}</h3>
                      <p class="mt-2.5 text-sm leading-relaxed text-white/55">{s.desc}</p>
                      <ul class="mt-5 space-y-2.5">
                        <For each={s.points}>
                          {(p) => (
                            <li class="flex items-start gap-2.5 text-sm text-white/70">
                              <Check size={15} class="mt-0.5 shrink-0 text-emerald-300" /> {p}
                            </li>
                          )}
                        </For>
                      </ul>
                      <div class="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
                        <TrendingUp size={13} /> {s.stat}
                      </div>
                    </div>
                  )}
                </Show>
              </div>
            </div>
            <div class="hidden lg:col-span-6 lg:block" />
          </div>
        </section>

        {/* ---------- CARA KERJA (model 3D di kiri) ---------- */}
        <section id="langkah" class="relative py-28 lg:py-36">
          <div class="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-12">
            <div class="hidden lg:col-span-5 lg:block" />
            <div class="lg:col-span-7">
              <div data-reveal class="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/90">
                <span class="h-px w-8 bg-emerald-300/60" /> 04 — Cara Kerja
              </div>
              <h2 data-reveal class="mt-5 font-display text-[clamp(1.9rem,4vw,3.2rem)] font-bold leading-[1.08] tracking-tight">
                Mulai Jualan dalam <span class="text-emerald-300">3 Langkah.</span>
              </h2>

              <div class="mt-12 space-y-12">
                <For each={D.steps}>
                  {(s, i) => (
                    <div data-reveal data-delay={i() * 0.08} class="flex gap-6">
                      <span
                        class="font-display text-5xl font-bold leading-none text-transparent lg:text-6xl"
                        style="-webkit-text-stroke: 1px rgba(255,255,255,0.28);"
                      >
                        0{i() + 1}
                      </span>
                      <div class="border-l border-white/10 pl-6">
                        <h3 class="font-display text-lg font-semibold lg:text-xl">{s.title}</h3>
                        <p class="mt-2 max-w-md text-sm leading-relaxed text-white/55">{s.desc}</p>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- OPEN SOURCE (pengganti testimoni — belum ada testimoni nyata) ---------- */}
        <section id="testimoni" class="relative py-28 lg:py-36">
          <div class="mx-auto max-w-3xl px-6 text-center">
            <div data-reveal class="flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/90">
              <span class="h-px w-8 bg-emerald-300/60" /> 05 — Open Source <span class="h-px w-8 bg-emerald-300/60" />
            </div>
            <h2 data-reveal class="mt-5 font-display text-[clamp(1.9rem,4vw,3.2rem)] font-bold leading-[1.08] tracking-tight">
              Kode yang Bisa Kamu <span class="text-emerald-300">Baca Sendiri.</span>
            </h2>
            <p data-reveal class="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/55">
              KasirGO open source. Tidak ada biaya tersembunyi, tidak ada data yang dikirim ke server kami —
              database disimpan di perangkat atau server kamu sendiri.
            </p>
          </div>

          <div class="mx-auto mt-14 grid max-w-5xl gap-6 px-6 sm:grid-cols-3">
            {[
              { k: "Tanpa langganan", v: "Tidak ada paket berbayar. Semua fitur terbuka untuk semua orang." },
              { k: "Data milik kamu", v: "SQLite lokal / server sendiri. Tidak ada telemetri." },
              { k: "Kontribusi terbuka", v: "Bug report dan pull request diterima lewat repo Codeberg/GitHub." },
            ].map((f) => (
              <div data-reveal class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left backdrop-blur-sm">
                <h3 class="font-display text-lg font-semibold">{f.k}</h3>
                <p class="mt-2 text-sm leading-relaxed text-white/55">{f.v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- CTA (model kembali ke tengah, besar) ---------- */}
        <section id="cta" class="relative flex min-h-screen items-center py-32">
          <div class="mx-auto max-w-3xl px-6 text-center">
            <div data-reveal class="flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/90">
              <span class="h-px w-8 bg-emerald-300/60" /> 06 — Mulai
            </div>
            <h2 data-reveal class="mt-6 font-display text-[clamp(2.4rem,6vw,4.6rem)] font-bold leading-[1.03] tracking-tight">
              {D.cta.title}
              <br />
              <span class="text-emerald-300">Hari Ini Juga.</span>
            </h2>
            <p data-reveal class="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/55">
              {D.cta.subtitle}
            </p>
            <div data-reveal class="mt-10 flex justify-center">
              <A
                href="/login"
                class="magnetic group flex items-center gap-2 rounded-full bg-emerald-400 px-9 py-4 text-base font-bold text-[#04120B] transition-colors hover:bg-emerald-300"
              >
                {D.cta.button}
                <ArrowRight size={18} class="transition-transform group-hover:translate-x-1" />
              </A>
            </div>
            <div data-reveal class="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <For each={D.cta.note.split("•")}>
                {(n) => (
                  <span class="flex items-center gap-1.5 text-xs text-white/45">
                    <Check size={13} class="text-emerald-300" /> {n.trim()}
                  </span>
                )}
              </For>
            </div>
          </div>
        </section>

        {/* ---------- FOOTER ---------- */}
        <footer class="relative border-t border-white/10 bg-[#050609]">
          <div class="mx-auto max-w-7xl px-6 py-16">
            <div class="grid gap-12 lg:grid-cols-12">
              <div class="lg:col-span-6">
                <div class="flex items-center gap-2.5">
                  <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-[#04120B]">
                    <ScanLine size={19} strokeWidth={2.4} />
                  </span>
                  <span class="font-display text-lg font-bold tracking-tight">
                    Kasir<span class="text-emerald-300">GO</span>
                  </span>
                </div>
                <p class="mt-4 max-w-sm text-sm leading-relaxed text-white/45">{D.footer.description}</p>
                <div class="mt-6 flex flex-wrap gap-5">
                  <a href="https://codeberg.org/ElCastra/KasirGO" target="_blank" rel="noreferrer" class="group flex items-center gap-1 text-xs font-medium text-white/45 transition-colors hover:text-emerald-300">
                    Codeberg
                    <ArrowUpRight size={12} class="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                  <a href="https://github.com/NitroCat29/kasirgo" target="_blank" rel="noreferrer" class="group flex items-center gap-1 text-xs font-medium text-white/45 transition-colors hover:text-emerald-300">
                    GitHub
                    <ArrowUpRight size={12} class="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                </div>
              </div>
              <For each={D.footer.columns}>
                {(c) => (
                  <div class="lg:col-span-2">
                    <h4 class="font-mono text-[11px] uppercase tracking-[0.25em] text-white/35">{c.title}</h4>
                    <ul class="mt-5 space-y-3">
                      <For each={c.links}>
                        {(l) => (
                          <li>
                            <a
                              href={l.href}
                              target={l.href.startsWith("http") ? "_blank" : undefined}
                              rel={l.href.startsWith("http") ? "noreferrer" : undefined}
                              class="text-sm text-white/55 transition-colors hover:text-emerald-300"
                            >
                              {l.label}
                            </a>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                )}
              </For>
            </div>
            <div class="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
              <p class="text-xs text-white/35">{D.footer.copyright}</p>
              <button
                onClick={() => lenis?.scrollTo(0, { duration: 1.6 })}
                class="group flex items-center gap-2 text-xs text-white/45 transition-colors hover:text-emerald-300"
              >
                Kembali ke atas
                <ArrowUpRight size={13} class="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </footer>
      </main>

      {/* Grain overlay + cursor glow */}
      <div
        class="pointer-events-none fixed inset-0 z-[90] opacity-[0.04] mix-blend-overlay"
        style={`background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%25" height="100%25" filter="url(%23n)"/></svg>');`}
      />
      <div
        ref={cursorRef}
        class="pointer-events-none fixed left-0 top-0 z-[95] hidden h-72 w-72 rounded-full lg:block"
        style="background: radial-gradient(circle, rgba(52,211,153,0.09), transparent 60%);"
      />
    </div>
  );
}