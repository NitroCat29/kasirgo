/**
 * Landing.tsx — KasirGO v3.0
 * ------------------------------------------------------------------
 * Award-style rewrite:
 * • Lenis smooth scroll
 * • GSAP ScrollTrigger cinematic reveals
 * • Heavy interactive Three.js hero
 * • Parallax typography + layout
 * • Magnetic interactions + custom cursor glow
 * • Scroll-driven counters + marquee
 * • Premium micro-motion without layout jank
 * ------------------------------------------------------------------
 */

import { createSignal, onMount, onCleanup, For, Show, type JSX } from "solid-js";
import { A } from "@solidjs/router";
import {
  ArrowRight,
  ShieldCheck,
  Wallet,
  BarChart3,
  ScanLine,
  Store,
  UtensilsCrossed,
  Package,
  TrendingUp,
  Users,
  Zap,
  Star,
  ChevronRight,
  Sparkles,
  Home,
} from "lucide-solid";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import * as THREE from "three";
import landingData from "../data/landing.json";

gsap.registerPlugin(ScrollTrigger);

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface TiltCardProps {
  children: JSX.Element;
  class?: string;
  intensity?: number;
}

interface MagneticProps {
  children: JSX.Element;
  class?: string;
  strength?: number;
}

// ------------------------------------------------------------------
// Data
// ------------------------------------------------------------------
const BUSINESS_TYPE_ICONS: Record<string, typeof Store> = {
  retail: Store,
  resto: UtensilsCrossed,
  grosir: Package,
};

const BUSINESS_TYPE_GRADIENTS: Record<string, string> = {
  retail: "from-[#123832] to-[#081F1C]",
  resto: "from-[#0F4A44] to-[#0A2E2A]",
  grosir: "from-[#175B51] to-[#0C312C]",
};

const BUSINESS_TYPES = landingData.businessTypes.map((t) => ({
  ...t,
  icon: BUSINESS_TYPE_ICONS[t.id] ?? Store,
  gradient: BUSINESS_TYPE_GRADIENTS[t.id] ?? "from-[#123832] to-[#081F1C]",
}));

const STATS = [
  { icon: Store, value: 12500, suffix: "+", label: "Toko Aktif" },
  { icon: TrendingUp, value: 98, suffix: "%", label: "Uptime" },
  { icon: Users, value: 50000, suffix: "+", label: "Pengguna" },
  { icon: Zap, value: 2.5, suffix: "s", label: "Avg Response", decimals: 1 },
];

const MARQUEE_ITEMS = [
  "Point of Sale Modern",
  "Wallet Per-Toko",
  "Analitik Real-Time",
  "Scan Struk Otomatis",
  "Multi-Cabang",
  "Laporan Keuangan",
  "Integrasi Payment",
  "Cloud Backup",
];

// ------------------------------------------------------------------
// Three.js — Cinematic Hero Scene
// ------------------------------------------------------------------
// Floating "warung" product cloud: barang ATK + elektronik.
// Tiap produk drift pelan; saat scroll, semuanya ikut jatuh ke bawah
// dengan lag + spin per-item (scroll-driven parallax).
// ------------------------------------------------------------------

type ProductItem = {
  mesh: THREE.Object3D;
  baseX: number;
  baseY: number;
  baseRotX: number;
  baseRotY: number;
  baseRotZ: number;
  bobAmp: number;
  bobSpeed: number;
  bobPhase: number;
  spinX: number;
  spinY: number;
  fallFactor: number; // seberapa kuat scroll narik barang ke bawah (depth)
};

function makePencil(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.5, metalness: 0.1 })
  );
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.22, 6),
    new THREE.MeshStandardMaterial({ color: 0xE7C08A, roughness: 0.6 })
  );
  tip.position.y = 0.56;
  const lead = new THREE.Mesh(
    new THREE.ConeGeometry(0.025, 0.08, 6),
    new THREE.MeshStandardMaterial({ color: 0x1F2937, roughness: 0.4 })
  );
  lead.position.y = 0.71;
  const eraser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.08, 6),
    new THREE.MeshStandardMaterial({ color: 0xFDA4AF, roughness: 0.7 })
  );
  eraser.position.y = -0.49;
  g.add(body, tip, lead, eraser);
  g.rotation.z = Math.PI / 5;
  return g;
}

function makePen(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.85, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.35 })
  );
  const capMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.5 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 16), capMat);
  cap.position.y = -0.55;
  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 16), capMat);
  nib.position.y = 0.5;
  g.add(body, cap, nib);
  g.rotation.z = -Math.PI / 6;
  return g;
}

function makeNotebook(): THREE.Group {
  const g = new THREE.Group();
  const cover = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.82, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x0F766E, roughness: 0.55, metalness: 0.05 })
  );
  const pages = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.78, 0.07),
    new THREE.MeshStandardMaterial({ color: 0xF3F1E7, roughness: 0.9 })
  );
  pages.position.z = 0.012;
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.82, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x052E2B, roughness: 0.5 })
  );
  spine.position.x = -0.31;
  g.add(cover, pages, spine);
  return g;
}

function makeStickyNotes(): THREE.Group {
  const g = new THREE.Group();
  const colors = [0xFDE68A, 0x86EFAC, 0xFCA5A5, 0x93C5FD];
  colors.forEach((c, i) => {
    const sheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.015),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
    );
    sheet.position.set(i * 0.012, i * 0.012, i * 0.02);
    sheet.rotation.z = (i - 1.5) * 0.06;
    g.add(sheet);
  });
  return g;
}

function makeRuler(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.18, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x7DD3FC, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85 })
  );
  g.add(body);
  const tickMat = new THREE.MeshBasicMaterial({ color: 0x0A2E2A });
  for (let i = -5; i <= 5; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.008, i % 5 === 0 ? 0.09 : 0.05, 0.001), tickMat);
    tick.position.set(i * 0.1, 0.045, 0.011);
    g.add(tick);
  }
  g.rotation.z = Math.PI / 9;
  return g;
}

function makeScissors(): THREE.Group {
  const g = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xD1D5DB, roughness: 0.2, metalness: 0.9 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 });
  [1, -1].forEach((dir) => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.015), bladeMat);
    blade.position.set(dir * 0.05, 0.28, 0);
    blade.rotation.z = dir * 0.12;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 10, 24), handleMat);
    handle.position.set(dir * 0.12, -0.16, 0);
    g.add(blade, handle);
  });
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), bladeMat);
  pivot.rotation.x = Math.PI / 2;
  g.add(pivot);
  return g;
}

function makeCalculator(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.78, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x1F2937, roughness: 0.45, metalness: 0.2 })
  );
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.16, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xA7F3D0, roughness: 0.2, emissive: 0x065F46, emissiveIntensity: 0.35 })
  );
  screen.position.set(0, 0.26, 0.035);
  g.add(body, screen);
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x4B5563, roughness: 0.6 });
  const btnAccent = new THREE.MeshStandardMaterial({ color: 0x5EEAD4, roughness: 0.5 });
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.02), c === 2 && r === 3 ? btnAccent : btnMat);
      btn.position.set((c - 1) * 0.15, 0.02 - r * 0.13, 0.035);
      g.add(btn);
    }
  }
  return g;
}

function makePhone(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.84, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35, metalness: 0.6 })
  );
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.37, 0.76, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x0A2E2A, roughness: 0.15, emissive: 0x5EEAD4, emissiveIntensity: 0.22 })
  );
  screen.position.z = 0.03;
  const cam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16),
    new THREE.MeshStandardMaterial({ color: 0x052220, roughness: 0.2, metalness: 0.8 })
  );
  cam.rotation.x = Math.PI / 2;
  cam.position.set(-0.12, 0.32, -0.031);
  g.add(body, screen, cam);
  return g;
}

function makeMonitor(): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.66, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1F2937, roughness: 0.4, metalness: 0.5 })
  );
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.57, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x082824, roughness: 0.15, emissive: 0x5EEAD4, emissiveIntensity: 0.3 })
  );
  screen.position.z = 0.03;
  const standMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.5, metalness: 0.6 });
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.06), standMat);
  neck.position.y = -0.44;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.03, 24), standMat);
  base.position.y = -0.56;
  g.add(frame, screen, neck, base);
  return g;
}

function makeKeyboard(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.38, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xE5E7EB, roughness: 0.6 })
  );
  g.add(body);
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x9CA3AF, roughness: 0.7 });
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 10; c++) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.02), keyMat);
      key.position.set((c - 4.5) * 0.105, (1 - r) * 0.105, 0.035);
      g.add(key);
    }
  }
  g.rotation.x = -Math.PI / 14;
  return g;
}

function makeHeadphones(): THREE.Group {
  const g = new THREE.Group();
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.035, 12, 32, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x0F766E, roughness: 0.4, metalness: 0.3 })
  );
  band.position.y = 0.05;
  g.add(band);
  const cupMat = new THREE.MeshStandardMaterial({ color: 0x052E2B, roughness: 0.5 });
  [-1, 1].forEach((dir) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.09, 20), cupMat);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(dir * 0.3, -0.02, 0);
    g.add(cup);
  });
  return g;
}

function makeBarcodeScanner(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.4 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.16), bodyMat);
  head.position.y = 0.22;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 16), bodyMat);
  handle.position.y = -0.05;
  handle.rotation.x = 0.25;
  const lens = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.02, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xEF4444, roughness: 0.1, emissive: 0xEF4444, emissiveIntensity: 0.9 })
  );
  lens.position.set(0, 0.22, 0.09);
  g.add(head, handle, lens);
  g.rotation.z = Math.PI / 7;
  return g;
}

function makeCoin(): THREE.Group {
  const g = new THREE.Group();
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.03, 28),
    new THREE.MeshStandardMaterial({ color: 0xFCD34D, roughness: 0.25, metalness: 0.9, emissive: 0x3B2A04, emissiveIntensity: 0.25 })
  );
  coin.rotation.x = Math.PI / 2.4;
  g.add(coin);
  return g;
}

function initThreeScene(canvas: HTMLCanvasElement, mouseRef: { x: number; y: number }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0A2E2A, 0.02);

  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const accent = 0x5EEAD4;
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(4, 6, 8);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(accent, 60, 20, 1.4);
  rimLight.position.set(-6, 3, 4);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(0xF3F1E7, 25, 18, 1.5);
  fillLight.position.set(5, -4, 6);
  scene.add(fillLight);

  // Product cloud — barang ATK + elektronik
  const cloud = new THREE.Group();
  cloud.name = "product-cloud";
  scene.add(cloud);

  const factories: Array<() => THREE.Object3D> = [
    makePencil,
    () => makePen(0x2563EB),
    () => makePen(0xDC2626),
    makeNotebook,
    makeStickyNotes,
    makeRuler,
    makeScissors,
    makeCalculator,
    makePhone,
    makeMonitor,
    makeKeyboard,
    makeHeadphones,
    makeBarcodeScanner,
    makeCoin,
  ];

  const items: ProductItem[] = [];
  const isMobile = window.innerWidth < 768;
  const count = isMobile ? 10 : 18;

  for (let i = 0; i < count; i++) {
    const mesh = factories[i % factories.length]();
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const radiusX = 2.6 + Math.random() * 3.4;
    const x = Math.cos(angle) * radiusX;
    const y = (Math.random() - 0.5) * 7.5;
    const z = -1.5 + Math.random() * 4 - Math.abs(x) * 0.15;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(0.75 + Math.random() * 0.7);
    const rx = Math.random() * Math.PI;
    const ry = Math.random() * Math.PI;
    const rz = Math.random() * Math.PI;
    mesh.rotation.set(rx, ry, rz);
    cloud.add(mesh);
    items.push({
      mesh,
      baseX: x,
      baseY: y,
      baseRotX: rx,
      baseRotY: ry,
      baseRotZ: rz,
      bobAmp: 0.12 + Math.random() * 0.22,
      bobSpeed: 0.4 + Math.random() * 0.7,
      bobPhase: Math.random() * Math.PI * 2,
      spinX: (Math.random() - 0.5) * 0.5,
      spinY: (Math.random() - 0.5) * 0.6,
      fallFactor: 0.9 + Math.random() * 1.6,
    });
  }

  // Particles — debu halus
  const particlesCount = isMobile ? 120 : 240;
  const positions = new Float32Array(particlesCount * 3);
  for (let i = 0; i < particlesCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }
  const particlesGeo = new THREE.BufferGeometry();
  particlesGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particlesMat = new THREE.PointsMaterial({
    size: 0.035,
    color: accent,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particlesGeo, particlesMat);
  scene.add(particles);

  // Scroll tracking — barang ikut jatuh ngikutin scroll
  let scrollY = window.scrollY;
  let smoothScroll = scrollY;
  const onScroll = () => {
    scrollY = window.scrollY;
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  // Animation loop
  let animationId: number;
  const clock = new THREE.Clock();
  const mouseTarget = { x: mouseRef.x, y: mouseRef.y };

  const animate = () => {
    animationId = requestAnimationFrame(animate);

    // Hemat GPU: skip render kalau hero sudah lewat viewport
    const rect = canvas.getBoundingClientRect();
    if (rect.bottom < -50) return;

    const elapsed = clock.getElapsedTime();
    mouseTarget.x += (mouseRef.x - mouseTarget.x) * 0.06;
    mouseTarget.y += (mouseRef.y - mouseTarget.y) * 0.06;
    smoothScroll += (scrollY - smoothScroll) * 0.08;

    const scrollUnits = smoothScroll / Math.max(window.innerHeight, 1);

    items.forEach((it) => {
      const bob = Math.sin(elapsed * it.bobSpeed + it.bobPhase) * it.bobAmp;
      it.mesh.position.y = it.baseY + bob - scrollUnits * it.fallFactor * 2.4;
      it.mesh.position.x = it.baseX + mouseTarget.x * 0.2 * it.fallFactor;
      it.mesh.rotation.x = it.baseRotX + elapsed * it.spinX * 0.3 + scrollUnits * it.fallFactor * 0.9;
      it.mesh.rotation.y = it.baseRotY + elapsed * it.spinY * 0.3;
      it.mesh.rotation.z = it.baseRotZ + scrollUnits * it.fallFactor * 0.35;
    });

    particles.rotation.y = elapsed * 0.02 + mouseTarget.x * 0.1;
    particles.position.y = -scrollUnits * 0.8;

    cloud.rotation.y = mouseTarget.x * 0.12;
    cloud.rotation.x = -mouseTarget.y * 0.08;

    camera.position.y = -scrollUnits * 0.6;
    camera.lookAt(0, camera.position.y * 0.5, 0);

    renderer.render(scene, camera);
  };
  animate();

  const handleResize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", handleResize);

  const dispose = (obj: THREE.Object3D | undefined) => {
    if (!obj) return;
    obj.traverse((child) => {
      const c = child as any;
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m: any) => m.dispose());
      }
    });
  };

  return {
    destroy: () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", onScroll);
      dispose(cloud);
      dispose(particles);
      renderer.dispose();
    },
  };
}

// ------------------------------------------------------------------
// UI Primitives
// ------------------------------------------------------------------
function TiltCard(props: TiltCardProps) {
  let ref: HTMLDivElement | undefined;
  const intensity = props.intensity ?? 10;

  onMount(() => {
    const el = ref;
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(el, {
        rotateY: x * intensity,
        rotateX: -y * intensity,
        duration: 0.4,
        ease: "power2.out",
        transformPerspective: 1000,
      });
    };

    const handleLeave = () => {
      gsap.to(el, {
        rotateY: 0,
        rotateX: 0,
        duration: 0.6,
        ease: "elastic.out(1, 0.5)",
      });
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    onCleanup(() => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    });
  });

  return (
    <div
      ref={ref}
      class={`transform-gpu ${props.class ?? ""}`}
      style={{ "transform-style": "preserve-3d" }}
    >
      {props.children}
    </div>
  );
}

function MagneticButton(props: MagneticProps) {
  let ref: HTMLDivElement | undefined;
  const strength = props.strength ?? 0.4;

  onMount(() => {
    const el = ref;
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(el, { x: x * strength, y: y * strength, duration: 0.3, ease: "power2.out" });
    };

    const handleLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    onCleanup(() => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    });
  });

  return (
    <div ref={ref} class={`inline-block ${props.class ?? ""}`} data-magnetic>
      {props.children}
    </div>
  );
}

function StarRating(props: { rating: number }) {
  return (
    <div class="flex items-center gap-1">
      <For each={Array.from({ length: 5 })}>{(_, i) => (
        <Star
          size={16}
          class={i() < props.rating ? "fill-[#F3F1E7] text-[#F3F1E7]" : "text-[#B9CFC9]"}
        />
      )}</For>
    </div>
  );
}

// ------------------------------------------------------------------
// Liquid Glass Navbar — gaya iOS, minimized saat scroll, reveal on hover
// ------------------------------------------------------------------
function LiquidGlassNav() {
  const [minimized, setMinimized] = createSignal(false);
  const [hovered, setHovered] = createSignal(false);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const links = (landingData.navbar?.links ?? []) as Array<{ label: string; href: string; active?: boolean }>;
  const loginLabel = landingData.navbar?.loginLabel ?? "Masuk Toko";

  onMount(() => {
    const onScroll = () => {
      const past = window.scrollY > 90;
      if (past && !hovered()) setMinimized(true);
      else if (!past) setMinimized(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onCleanup(() => window.removeEventListener("scroll", onScroll));
  });

  const handleEnter = () => {
    if (hideTimer) clearTimeout(hideTimer);
    setHovered(true);
    setMinimized(false);
  };

  const handleLeave = () => {
    setHovered(false);
    if (window.scrollY > 90) hideTimer = setTimeout(() => setMinimized(true), 250);
  };

  return (
    <div
      class="fixed left-1/2 top-4 z-[90] -translate-x-1/2"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Padding transparan = hit area lebar walau lagi minimized */}
      <div class="p-3">
        <nav
          class={`flex items-center overflow-hidden border backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            minimized()
              ? "h-10 rounded-full border-white/10 bg-white/5 px-2 opacity-70 shadow-lg shadow-black/20"
              : "h-12 gap-1 rounded-full border-white/15 bg-white/10 px-3 opacity-100 shadow-2xl shadow-black/30"
          }`}
          style={{ "backdrop-filter": "blur(24px) saturate(1.6)", "-webkit-backdrop-filter": "blur(24px) saturate(1.6)" }}
        >
          {/* Logo dot — selalu kelihatan, bahkan saat minimized */}
          <A href="/" class="flex shrink-0 items-center gap-2 px-1.5">
            <span class="grid h-6 w-6 place-items-center rounded-full bg-[#5EEAD4] text-[11px] font-black text-[#0A2E2A] shadow-[0_0_12px_#5EEAD4aa]">
              K
            </span>
            <Show when={!minimized()}>
              <span class="font-['Space_Grotesk'] text-sm font-bold tracking-wide text-[#F3F1E7]">KasirGO</span>
            </Show>
          </A>

          <Show when={!minimized()}>
            <span class="mx-1 h-5 w-px bg-white/10" />
            <For each={links}>
              {(link) => (
                <A
                  href={link.href}
                  class={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    link.active
                      ? "bg-white/10 text-[#5EEAD4]"
                      : "text-[#B9CFC9] hover:bg-white/10 hover:text-[#F3F1E7]"
                  }`}
                >
                  {link.label}
                </A>
              )}
            </For>

            <A
              href="/login"
              class="ml-1 shrink-0 rounded-full bg-[#5EEAD4] px-4 py-1.5 text-xs font-bold text-[#0A2E2A] transition hover:brightness-95 hover:shadow-[0_0_16px_#5EEAD4aa]"
            >
              {loginLabel}
            </A>
          </Show>

          {/* Hint kecil saat minimized */}
          <Show when={minimized()}>
            <ChevronRight size={14} class="ml-0.5 text-[#5EEAD4]/70" />
          </Show>
        </nav>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Scroll Progress
// ------------------------------------------------------------------
function ScrollProgress() {
  let progressRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!progressRef) return;
    gsap.to(progressRef, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3,
      },
    });
  });

  return (
    <div class="fixed top-0 left-0 z-[100] h-[2px] w-full bg-transparent">
      <div
        ref={progressRef}
        class="h-full origin-left bg-[#5EEAD4] shadow-[0_0_10px_#5EEAD4]"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}

// ------------------------------------------------------------------
// Custom Cursor
// ------------------------------------------------------------------
function CustomCursor() {
  let cursorRef: HTMLDivElement | undefined;
  let glowRef: HTMLDivElement | undefined;

  onMount(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || window.innerWidth < 768) return;

    const moveCursor = (e: MouseEvent) => {
      if (cursorRef && glowRef) {
        gsap.to(cursorRef, { x: e.clientX, y: e.clientY, duration: 0.08, ease: "power2.out" });
        gsap.to(glowRef, { x: e.clientX, y: e.clientY, duration: 0.15, ease: "power2.out" });
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, [data-magnetic]")) {
        gsap.to(cursorRef, { scale: 2.5, duration: 0.3 });
        gsap.to(glowRef, { scale: 1.5, opacity: 0.6, duration: 0.3 });
      }
    };

    const handleMouseOut = () => {
      gsap.to(cursorRef, { scale: 1, duration: 0.3 });
      gsap.to(glowRef, { scale: 1, opacity: 0.3, duration: 0.3 });
    };

    window.addEventListener("mousemove", moveCursor);
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);

    onCleanup(() => {
      window.removeEventListener("mousemove", moveCursor);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
    });
  });

  return (
    <>
      <div
        ref={cursorRef}
        class="pointer-events-none fixed top-0 left-0 z-[9999] hidden h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#5EEAD4] mix-blend-difference md:block"
        style={{ "will-change": "transform" }}
      />
      <div
        ref={glowRef}
        class="pointer-events-none fixed top-0 left-0 z-[9998] hidden h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5EEAD4] opacity-30 blur-3xl md:block"
        style={{ "will-change": "transform" }}
      />
    </>
  );
}

// ------------------------------------------------------------------
// Animations registry for sections
// ------------------------------------------------------------------
function useScrollReveal() {
  onMount(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    gsap.utils.toArray("[data-reveal]").forEach((el) => {
      gsap.fromTo(
        el,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el as any,
            start: "top 88%",
            toggleActions: "play none none reverse",
          },
        }
      );
    });

    gsap.utils.toArray("[data-parallax]").forEach((el) => {
      gsap.to(el, {
        y: -40,
        ease: "none",
        scrollTrigger: {
          trigger: el as any,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    });
  });
}

// ------------------------------------------------------------------
// Landing Page
// ------------------------------------------------------------------
export default function Landing() {
  let canvasRef: HTMLCanvasElement | undefined;
  const mouseRef = { x: 0, y: 0 };
  const [activeType, setActiveType] = createSignal("retail");

  onMount(() => {
    if (!canvasRef) return;
    const scene = initThreeScene(canvasRef, mouseRef);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const lenis = new Lenis({ wrapper: window, content: document.documentElement, duration: 1.4, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });

    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    window.addEventListener("mousemove", handleMouseMove);

    useScrollReveal();

    onCleanup(() => {
      scene.destroy();
      window.removeEventListener("mousemove", handleMouseMove);
      lenis.destroy();
    });
  });

  return (
    <div class="relative min-h-screen bg-[#081f1c] text-[#F3F1E7]">
      <ScrollProgress />
      <CustomCursor />
      <LiquidGlassNav />

      {/* Hero */}
      <section class="relative overflow-hidden">
        <div class="absolute inset-0">
          <canvas
            ref={canvasRef}
            class="h-[70vh] w-full md:h-[82vh]"
            aria-hidden="true"
          />
          <div class="absolute inset-0 bg-gradient-to-b from-[#081f1c]/0 via-[#081f1c]/40 to-[#081f1c]" />
        </div>

        <div class="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-16 pt-28 md:pt-36">
          <div data-reveal class="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[11px] font-semibold tracking-wider text-[#5EEAD4]">
            <Sparkles size={14} />
            {landingData.hero?.badge ?? "MENGENAL KASIRGO / KASIR DIGITAL UNTUK TOKO"}
          </div>

          <h1 data-reveal class="font-['Space_Grotesk'] text-5xl font-bold tracking-tight sm:text-7xl lg:text-8xl">
            {landingData.hero?.title ?? "KASIRGO"}
            <span class="block text-[#5EEAD4]">{landingData.hero?.subtitle ?? "UNTUK TOKO KAMU"}</span>
          </h1>

          <p data-reveal class="max-w-xl text-sm leading-relaxed text-[#B9CFC9] sm:text-base">
            {landingData.hero?.glassCard?.description ?? "Aplikasi kasir yang tetap jalan walau internet mati, catat tiap transaksi otomatis, dan aman lewat verifikasi dua langkah."}
          </p>

          <div class="flex flex-wrap items-center gap-3">
            <MagneticButton strength={0.3}>
              <A
                href={landingData.hero?.ctaCard?.buttonHref ?? "/login"}
                class="inline-flex items-center gap-2 rounded-full bg-[#5EEAD4] px-6 py-3 text-sm font-semibold text-[#0A2E2A] transition hover:brightness-95 hover:shadow-lg hover:shadow-[#5EEAD4]/30"
              >
                {landingData.hero?.ctaCard?.button ?? "Mulai Gratis"}
                <ArrowRight size={16} />
              </A>
            </MagneticButton>

            <MagneticButton strength={0.3}>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-[#F3F1E7] transition hover:bg-white/20"
              >
                {landingData.hero?.bottomButtons?.demo ?? "LIVE DEMO"}
              </button>
            </MagneticButton>

            <MagneticButton strength={0.3}>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-[#F3F1E7] transition hover:bg-white/20"
              >
                {landingData.hero?.bottomButtons?.dashboard ?? "DASHBOARD"}
              </button>
            </MagneticButton>
          </div>

          {/* Glass card */}
          <div data-reveal class="mt-2 w-full max-w-md rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <p class="text-xs font-semibold tracking-wider text-[#5EEAD4]">{landingData.hero?.glassCard?.title ?? "Apa itu KasirGO?"}</p>
            <p class="mt-2 text-xs leading-relaxed text-[#D9E7E3]">
              {landingData.hero?.glassCard?.description ?? "Dibuat untuk pemilik toko yang mau fokus jualan, bukan pusing input data."}
            </p>
            <button
              type="button"
              aria-label={landingData.hero?.glassCard?.buttonAriaLabel ?? "Pelajari lebih lanjut"}
              class="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#F3F1E7] transition hover:text-[#5EEAD4]"
            >
              {landingData.hero?.glassCard?.buttonAriaLabel ?? "Pelajari lebih lanjut"}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <section class="border-y border-white/5 bg-[#0A2E2A]/60 py-4">
        <div class="overflow-hidden">
          <div class="flex w-[200%] animate-marquee items-center gap-6 text-xs font-semibold tracking-wider text-[#B9CFC9]">
            <For each={[...MARQUEE_ITEMS, ...MARQUEE_ITEMS]}>{(item) => (
              <span class="whitespace-nowrap">{item}</span>
            )}</For>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section class="mx-auto max-w-6xl px-6 py-16">
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
          <For each={STATS}>{(stat) => (
            <div data-reveal class="rounded-[24px] border border-white/5 bg-white/5 p-5 shadow-sm shadow-black/10">
              <stat.icon size={18} class="text-[#5EEAD4]" />
              <p class="mt-3 font-['Space_Grotesk'] text-2xl font-bold text-[#F3F1E7]">
                {stat.value.toLocaleString()}{stat.suffix}
              </p>
              <p class="text-xs text-[#B9CFC9]">{stat.label}</p>
            </div>
          )}</For>
        </div>
      </section>

      {/* Compare */}
      <section class="mx-auto max-w-6xl px-6 py-12">
        <div data-reveal class="mb-6 text-center">
          <span class="inline-block rounded-full bg-[#0A2E2A] px-4 py-1.5 text-[11px] font-semibold tracking-wider text-[#5EEAD4]">
            {landingData.compareSection?.badge ?? "PERBEDAAN"}
          </span>
          <h2 class="mt-3 font-['Space_Grotesk'] text-2xl font-bold sm:text-3xl">Manual vs KasirGO</h2>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TiltCard intensity={7}>
            <div data-reveal class="rounded-[28px] border border-white/5 bg-white/5 p-6 shadow-lg shadow-black/15">
              <p class="text-sm font-semibold text-[#B9CFC9]">Manual</p>
              <p class="mt-2 text-xs leading-relaxed text-[#9FB5AF]">
                Buku catatan, kalkulator, danPotongan waktu yang habis untuk rekap akhir bulan.
              </p>
            </div>
          </TiltCard>

          <TiltCard intensity={7}>
            <div data-reveal class="rounded-[28px] bg-gradient-to-br from-[#123832] to-[#06201D] p-6 shadow-xl shadow-black/20">
              <p class="text-sm font-semibold text-[#5EEAD4]">KasirGO</p>
              <p class="mt-2 text-xs leading-relaxed text-[#D9E7E3]">
                {landingData.compareSection?.description ?? "KasirGO mencatat tiap transaksi otomatis, stok berkurang sendiri, dan laporan langsung jadi tanpa direkap ulang."}
              </p>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* Features preview */}
      <section class="mx-auto max-w-6xl px-6 py-12">
        <div data-reveal class="mb-6 text-center">
          <span class="inline-block rounded-full bg-[#0A2E2A] px-4 py-1.5 text-[11px] font-semibold tracking-wider text-[#5EEAD4]">
            FITUR
          </span>
          <h2 class="mt-3 font-['Space_Grotesk'] text-2xl font-bold sm:text-3xl">Yang Kamu Butuhkan, Bukan yang Flavorless</h2>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TiltCard intensity={7}>
            <div data-reveal class="group relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#123832] to-[#06201D] p-5 shadow-lg shadow-black/15 transition hover:shadow-xl hover:shadow-[#5EEAD4]/10">
              <BarChart3 size={20} class="text-[#5EEAD4]" />
              <p class="mt-8 font-['Space_Grotesk'] text-base font-semibold text-[#F3F1E7]">
                {landingData.previewSection?.analytics?.title ?? "Analitik"}
              </p>
              <p class="mt-1 text-xs text-[#B9CFC9]">
                {landingData.previewSection?.analytics?.description ?? "Pantau performa bisnis real-time."}
              </p>
              <MagneticButton strength={0.5}>
                <button
                  type="button"
                  aria-label={landingData.previewSection?.analytics?.buttonAriaLabel ?? "Lihat analitik"}
                  class="absolute bottom-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white text-[#0A2E2A] transition group-hover:scale-110 group-hover:bg-[#5EEAD4]"
                >
                  <ArrowRight size={16} />
                </button>
              </MagneticButton>
            </div>
          </TiltCard>

          <TiltCard intensity={7}>
            <div data-reveal class="group relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#175B51] to-[#0A2E2A] p-5 shadow-lg shadow-black/15 transition hover:shadow-xl hover:shadow-[#5EEAD4]/10">
              <ScanLine size={20} class="text-[#5EEAD4]" />
              <p class="mt-8 font-['Space_Grotesk'] text-base font-semibold text-[#F3F1E7]">
                {landingData.previewSection?.scan?.title ?? "Scan Struk"}
              </p>
              <p class="mt-1 text-xs text-[#B9CFC9]">
                {landingData.previewSection?.scan?.description ?? "Scan dan simpan struk otomatis."}
              </p>
              <MagneticButton strength={0.5}>
                <button
                  type="button"
                  aria-label={landingData.previewSection?.scan?.buttonAriaLabel ?? "Lihat scan"}
                  class="absolute bottom-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white text-[#0A2E2A] transition group-hover:scale-110 group-hover:bg-[#5EEAD4]"
                >
                  <ArrowRight size={16} />
                </button>
              </MagneticButton>
            </div>
          </TiltCard>

          <div class="flex flex-row gap-2 sm:flex-col">
            <span data-reveal class="rounded-full bg-white px-4 py-2.5 text-center text-[11px] font-bold tracking-[0.15em] text-[#0C1615] shadow-sm shadow-black/10 transition hover:shadow-md">
              {landingData.previewSection?.badges?.fitur ?? "FITUR"}
            </span>
            <span data-reveal class="rounded-full bg-white px-4 py-2.5 text-center text-[11px] font-bold tracking-[0.15em] text-[#0C1615] shadow-sm shadow-black/10 transition hover:shadow-md">
              {landingData.previewSection?.badges?.galeri ?? "GALERI"}
            </span>
          </div>
        </div>
      </section>

      {/* Wallet per toko */}
      <section class="mx-auto max-w-6xl px-6 py-12">
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div class="md:col-span-2">
            <div data-reveal class="mb-4">
              <span class="inline-block rounded-full bg-[#0A2E2A] px-4 py-1.5 text-[11px] font-semibold tracking-wider text-[#5EEAD4]">
                {landingData.walletSection?.badge ?? "WALLET PER-TOKO"}
              </span>
              <h2 class="mt-3 font-['Space_Grotesk'] text-2xl font-bold sm:text-3xl">
                {landingData.walletSection?.title ?? "Punya banyak cabang? Kas tetap kepisah rapi."}
              </h2>
              <p class="mt-2 max-w-xl text-sm leading-relaxed text-[#B9CFC9]">
                {landingData.walletSection?.description ?? "Tiap toko punya wallet sendiri — uang cabang A nggak kecampur sama cabang B."}
              </p>
            </div>

            <TiltCard intensity={6}>
              <div data-reveal class="rounded-[28px] bg-gradient-to-br from-[#0E3F3A] to-[#06201D] p-6 shadow-xl shadow-black/20">
                <div class="flex items-center gap-3">
                  <Wallet size={22} class="text-[#5EEAD4]" />
                  <div>
                    <p class="text-sm font-semibold text-[#F3F1E7]">Multi-Wallet</p>
                    <p class="text-xs text-[#B9CFC9]">Pantau saldo & arus kas per toko dari satu akun.</p>
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>

          <div class="flex flex-col gap-4">
            <TiltCard intensity={7}>
              <div data-reveal class="rounded-[24px] bg-white/5 p-5 shadow-lg shadow-black/15">
                <ShieldCheck size={20} class="text-[#5EEAD4]" />
                <p class="mt-3 text-sm font-semibold text-[#F3F1E7]">TOTP 2FA</p>
                <p class="mt-1 text-xs text-[#B9CFC9]">Login lebih aman dengan verifikasi dua langkah.</p>
              </div>
            </TiltCard>
            <TiltCard intensity={7}>
              <div data-reveal class="rounded-[24px] bg-white/5 p-5 shadow-lg shadow-black/15">
                <Zap size={20} class="text-[#5EEAD4]" />
                <p class="mt-3 text-sm font-semibold text-[#F3F1E7]">Offline Ready</p>
                <p class="mt-1 text-xs text-[#B9CFC9]">Tetap jalan walau koneksi sedang nggak menentu.</p>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section class="mx-auto max-w-6xl px-6 py-12">
        <div data-reveal class="mb-6 text-center">
          <span class="inline-block rounded-full bg-[#0A2E2A] px-4 py-1.5 text-[11px] font-semibold tracking-wider text-[#5EEAD4]">
            TESTIMONI
          </span>
          <h2 class="mt-3 font-['Space_Grotesk'] text-2xl font-bold sm:text-3xl">Apa Kata Mereka?</h2>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <For each={[
            { name: "Budi Santoso", role: "Pemilik Toko Kelontong", text: "KasirGO bener-bener ngebantu usaha saya. Laporan keuangan jadi lebih rapi dan gampang dipahami.", rating: 5 },
            { name: "Ani Wijaya", role: "Manager Restoran", text: "Fitur wallet per-toko itu game changer. Bisa pantau cabang satu per satu tanpa ribet.", rating: 5 },
            { name: "Rudi Hartono", role: "Distributor Grosir", text: "Scan struk otomatis hemat waktu banget. Stok barang juga selalu update real-time.", rating: 4 },
          ]}>
            {(item) => (
              <TiltCard intensity={5}>
                <div data-reveal class="rounded-[24px] bg-white p-6 shadow-sm shadow-black/5 transition hover:shadow-lg">
                  <StarRating rating={item.rating} />
                  <p class="mt-3 text-sm leading-relaxed text-[#3E4C48]">"{item.text}"</p>
                  <div class="mt-4 flex items-center gap-3">
                    <div class="grid h-10 w-10 place-items-center rounded-full bg-[#0A2E2A] font-['Space_Grotesk'] text-xs font-bold text-[#5EEAD4]">
                      {item.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-[#0C1615]">{item.name}</p>
                      <p class="text-xs text-[#6C7B77]">{item.role}</p>
                    </div>
                  </div>
                </div>
              </TiltCard>
            )}
          </For>
        </div>
      </section>

      {/* Business types */}
      <section class="mx-auto max-w-6xl px-6 py-12">
        <div data-reveal class="mb-6 text-center">
          <span class="inline-block rounded-full bg-[#0A2E2A] px-4 py-1.5 text-[11px] font-semibold tracking-wider text-[#5EEAD4]">USAHA</span>
          <h2 class="mt-3 font-['Space_Grotesk'] text-2xl font-bold sm:text-3xl">Cocok Untuk Semua Jenis Usaha</h2>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <For each={BUSINESS_TYPES}>
            {(type) => (
              <TiltCard intensity={8}>
                <div
                  class={`rounded-[24px] bg-gradient-to-br ${type.gradient} p-5 shadow-lg shadow-black/20 ring-1 ring-white/5 transition ${
                    activeType() === type.id ? "ring-[#5EEAD4]/60" : ""
                  }`}
                >
                  <type.icon size={20} class="text-[#5EEAD4]" />
                  <p class="mt-4 font-['Space_Grotesk'] text-sm font-semibold text-[#F3F1E7]">{type.label}</p>
                  <p class="mt-1 text-xs leading-relaxed text-[#B9CFC9]">{type.desc}</p>
                </div>
              </TiltCard>
            )}
          </For>
        </div>
      </section>

      {/* CTA */}
      <section class="mx-auto max-w-6xl px-6 py-12">
        <div data-reveal class="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#0A2E2A] via-[#0E3F3A] to-[#0A2E2A] p-8 text-center shadow-xl shadow-black/25 sm:p-12">
          <div data-parallax class="absolute inset-0 opacity-10">
            <div class="absolute top-0 left-1/4 h-64 w-64 rounded-full bg-[#5EEAD4] blur-3xl" />
            <div class="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-[#5EEAD4] blur-3xl" />
          </div>
          <h2 class="relative font-['Space_Grotesk'] text-2xl font-bold sm:text-3xl lg:text-4xl">Siap Transformasi Bisnismu?</h2>
          <p class="relative mx-auto mt-3 max-w-md text-sm text-[#B9CFC9]">Gratis coba 14 hari, tanpa kartu kredit.</p>
          <div class="relative mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <MagneticButton strength={0.3}>
              <A
                href="/login"
                class="flex items-center gap-2 rounded-full bg-[#5EEAD4] px-6 py-3 text-sm font-semibold text-[#0A2E2A] transition hover:brightness-95 hover:shadow-lg hover:shadow-[#5EEAD4]/30"
              >
                Mulai Gratis
                <ChevronRight size={16} />
              </A>
            </MagneticButton>
            <MagneticButton strength={0.3}>
              <A
                href="/demo"
                class="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-[#F3F1E7] transition hover:bg-white/20"
              >
                Lihat Demo
              </A>
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer class="mx-auto max-w-6xl mb-8 flex items-center justify-between gap-3 rounded-full bg-[#0A2E2A] px-4 py-3 text-[#F3F1E7] sm:px-6">
        <span class="hidden items-center gap-2 text-[11px] font-bold tracking-[0.15em] sm:flex">
          <ShieldCheck size={14} class="text-[#5EEAD4]" />
          {landingData.footer?.tagline ?? "AMAN & CEPAT"}
        </span>
        <MagneticButton strength={0.4}>
          <A
            href="/"
            aria-label={landingData.footer?.homeAriaLabel ?? "Beranda"}
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#5EEAD4] text-[#0A2E2A] transition hover:brightness-95 hover:scale-110"
          >
            <Home size={18} />
          </A>
        </MagneticButton>
        <MagneticButton strength={0.3}>
          <A
            href="/tentang"
            class="rounded-full bg-white/10 px-4 py-2 text-[11px] font-bold tracking-[0.15em] transition hover:bg-white/20"
          >
            {landingData.footer?.aboutButton ?? "TENTANG"}
          </A>
        </MagneticButton>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 22s linear infinite;
        }
      `}</style>
    </div>
  );
}
