// ============================================================
// KasirGo — GSAP Hero Animations + Lenis Smooth Scroll
// ============================================================
import gsap from "gsap";

/* ============================================
   LENIS SMOOTH SCROLL
   ============================================ */
export async function initLenis() {
  try {
    const Lenis = (await import("lenis")).default;
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Smooth anchor links
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = (a as HTMLAnchorElement).getAttribute("href");
        if (!href || href === "#") return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          lenis.scrollTo(target, { offset: -80, duration: 1.4 });
        }
      });
    });

    return lenis;
  } catch (err) {
    console.warn("Lenis init failed:", err);
    return null;
  }
}

/* ============================================
   GSAP HERO ENTRANCE ANIMATIONS
   ============================================ */
export function initHeroAnimations() {
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  // Hero text staggered entrance
  // NOTE: jangan set opacity:0 di gsap.from — CSS .reveal/.revealed owns opacity reveal.
  // gsap immediateRender=true akan set inline opacity:0 sesaat setelah IntersectionObserver
  // add .revealed (opacity:1) → blink out → animate naik (visible "blinked lalu hilang" bug).
  // Keep y/scale/stagger untuk entrance motion, opacity biar CSS handle.
  tl.from(".hero-title-line", {
    y: 60,
    duration: 0.9,
    stagger: 0.15,
  })
    .from(
      ".hero-subtitle",
      {
        y: 30,
        duration: 0.7,
      },
      "-=0.4"
    )
    .from(
      ".hero-cta",
      {
        y: 20,
        duration: 0.6,
        stagger: 0.1,
      },
      "-=0.3"
    )
    .from(
      ".hero-badge",
      {
        scale: 0.8,
        duration: 0.5,
      },
      "-=0.6"
    )
    .from(
      ".hero-social-proof",
      {
        y: 15,
        duration: 0.5,
      },
      "-=0.3"
    )
    .from(
      ".hero-mockup",
      {
        x: 80,
        duration: 1,
        ease: "power2.out",
      },
      "-=0.8"
    )
    .from(
      ".hero-float-card",
      {
        scale: 0.6,
        duration: 0.6,
        stagger: 0.2,
        ease: "back.out(1.7)",
      },
      "-=0.5"
    );

  return tl;
}

/* ============================================
   GSAP FLOATING POS MOCKUP
   ============================================ */
export function initMockupFloat() {
  const mockup = document.querySelector(".hero-mockup");
  if (!mockup) return;

  // Subtle floating animation
  gsap.to(mockup, {
    y: -12,
    duration: 3,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  // Mouse parallax on hero section
  const heroSection = mockup.closest("section");
  if (!heroSection) return;

  heroSection.addEventListener("mousemove", (e: Event) => {
    const me = e as MouseEvent;
    const rect = heroSection.getBoundingClientRect();
    const x = (me.clientX - rect.left) / rect.width - 0.5;
    const y = (me.clientY - rect.top) / rect.height - 0.5;

    gsap.to(mockup, {
      rotateY: x * 8,
      rotateX: -y * 5,
      duration: 0.8,
      ease: "power2.out",
    });

    // Parallax on float cards
    document.querySelectorAll(".hero-float-card").forEach((card, i) => {
      const factor = i === 0 ? 1.2 : 0.8;
      gsap.to(card, {
        x: x * 15 * factor,
        y: y * 10 * factor,
        duration: 0.6,
        ease: "power2.out",
      });
    });
  });
}

/* ============================================
   GSAP BLOB PARALLAX ON SCROLL
   ============================================ */
export function initBlobParallax() {
  const blobs = document.querySelectorAll(".blob");
  if (blobs.length === 0) return;

  // Import ScrollTrigger dynamically
  import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
    gsap.registerPlugin(ScrollTrigger);

    blobs.forEach((blob, i) => {
      const speed = (i + 1) * 0.3;
      gsap.to(blob, {
        y: () => ScrollTrigger.maxScroll(window) * speed * -0.1,
        ease: "none",
        scrollTrigger: {
          trigger: document.body,
          start: "top top",
          end: "bottom bottom",
          scrub: 1.5,
        },
      });
    });
  });
}

/* ============================================
   GSAP PULSE RING ANIMATION (hero glow)
   ============================================ */
export function initPulseRings() {
  // Create pulse rings behind hero
  const heroSection = document.querySelector("section.relative.min-h-screen");
  if (!heroSection) return;

  for (let i = 0; i < 3; i++) {
    const ring = document.createElement("div");
    ring.classList.add("hero-pulse-ring");
    ring.style.cssText = `
      position: absolute;
      border-radius: 50%;
      border: 1px solid rgba(0, 217, 163, 0.15);
      pointer-events: none;
      z-index: -1;
    `;
    heroSection.appendChild(ring);

    const size = 300 + i * 200;
    gsap.set(ring, { width: size, height: size, left: "50%", top: "50%", xPercent: -50, yPercent: -50 });

    gsap.to(ring, {
      scale: 2.5,
      opacity: 0,
      duration: 4 + i * 1.5,
      repeat: -1,
      delay: i * 1.2,
      ease: "power1.out",
    });
  }
}

/* ============================================
   BENTO STAGGER REVEAL (Landing v2)
   ============================================ */
export function initBentoStagger() {
  const cards = document.querySelectorAll<HTMLElement>(".bento-card, .bento-stat");
  if (cards.length === 0) return;

  import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
    gsap.registerPlugin(ScrollTrigger);

    cards.forEach((card, i) => {
      // Mouse-follow radial glow → update --mx / --my CSS vars
      card.addEventListener("mousemove", (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        card.style.setProperty("--my", `${e.clientY - rect.top}px`);
      });
      // NOTE: entrance reveal di-handle oleh CSS `.reveal` + IntersectionObserver
      // native di Landing.setupReveal() — jangan pakai gsap.from(opacity:0) di sini,
      // GSAP immediateRender akan set inline opacity:0 yang override class .revealed
      // dan ScrollTrigger tanpa Lenis proxy gak pernah fire → kartu stuck invisible.
    });

    // Refresh ScrollTrigger biar position measurement akurat (kalau dipakai di tempat lain)
    ScrollTrigger.refresh();
  });
}

/* ============================================
   TERMINAL TYPEWRITER (Landing v2)
   ============================================ */
/* Lines dengan class .terminal-typewriter akan di-reveal per-char
   saat masuk viewport. Non-typewriter .terminal-line pakai CSS anim. */
export function initTerminalTypewriter() {
  const lines = document.querySelectorAll<HTMLElement>(".terminal-typewriter");
  if (lines.length === 0 || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const el = entry.target as HTMLElement;
        const full = el.dataset.text || el.textContent || "";
        el.textContent = "";
        let i = 0;
        const speed = Number(el.dataset.speed) || 18;
        const tick = () => {
          if (i < full.length) {
            el.textContent = full.slice(0, i + 1);
            i++;
            setTimeout(tick, speed);
          }
        };
        tick();
      });
    },
    { threshold: 0.5 }
  );
  lines.forEach((el) => {
    if (!el.dataset.text) el.dataset.text = el.textContent || "";
    observer.observe(el);
  });
}

/* ============================================
   WASM ORB PULSE INTENSITY (Landing v2)
   ============================================ */
/* Saat wasmReady() flip true, orb intensify glow.
   Dipanggil dari Landing onMount dengan signal getter. */
export function initWasmOrbPulse(isReady: () => boolean) {
  const orbs = document.querySelectorAll<HTMLElement>(".wasm-orb-big, .wasm-orb");
  if (orbs.length === 0) return;

  // Initial state already set via class in JSX (active/idle based on wasmReady()).
  // Watch for class changes — if user has JIT flipped post-load, scale pulse briefly.
  const mo = new MutationObserver(() => {
    orbs.forEach((o) => {
      gsap.fromTo(
        o,
        { scale: 1.15 },
        { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" }
      );
    });
  });
  orbs.forEach((o) => mo.observe(o, { attributes: true, attributeFilter: ["class"] }));

  // Also poll isReady() briefly — covers SolidJS signal-driven class swap
  let last = isReady();
  const interval = setInterval(() => {
    const now = isReady();
    if (now !== last) {
      last = now;
      orbs.forEach((o) => {
        gsap.fromTo(
          o,
          { scale: 1.18 },
          { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.4)" }
        );
      });
    }
  }, 200);
  // Stop polling after 10s — by then WASM sudah pasti loaded atau fallback
  setTimeout(() => clearInterval(interval), 10000);
}

/* ============================================
   INIT ALL
   ============================================ */
export async function initAllAnimations(isWasmReady?: () => boolean) {
  await initLenis();

  // Small delay to ensure DOM is painted
  requestAnimationFrame(() => {
    initHeroAnimations();
    initMockupFloat();
    initBlobParallax();
    initPulseRings();
    // Landing v2 additions
    initBentoStagger();
    initTerminalTypewriter();
    if (isWasmReady) initWasmOrbPulse(isWasmReady);
  });
}
