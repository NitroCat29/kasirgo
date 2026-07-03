      /* ============================================
    LENIS SMOOTH SCROLL
============================================ */
      const lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);

      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener("click", (e) => {
          const target = document.querySelector(a.getAttribute("href"));
          if (target) {
            e.preventDefault();
            lenis.scrollTo(target, { offset: -80, duration: 1.4 });
          }
        });
      });

      /* ============================================
   SCROLL PROGRESS BAR
============================================ */
      const progressBar = document.getElementById("scroll-progress");
      function updateProgress() {
        const h = document.documentElement;
        const scrolled =
          (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
        progressBar.style.width = scrolled + "%";
      }
      window.addEventListener("scroll", updateProgress);

      /* ============================================
   WASM LOADER & JS FALLBACK
============================================ */
      window.jsBackend = {
        calculate_total: (subtotal, taxRate, discountRate) => {
          const afterDiscount = subtotal - (subtotal * discountRate) / 100;
          return afterDiscount + (afterDiscount * taxRate) / 100;
        },
        compute_benchmark: (iterations) => {
          let acc = 0;
          for (let i = 0; i < iterations; i++) {
            // Phase 1: nested float ops (mirror WASM phase 1 — 100x inner loop)
            for (let j = 0; j < 100; j++) acc += (i * j * 1.0001) % 1000;
            // Phase 2: struct-like object ops (32 items)
            const items = [];
            for (let k = 0; k < 32; k++) items.push({ id: k, price: k * 15000.5, qty: (k % 5) + 1 });
            // Phase 3: bubble sort
            for (let a = 0; a < items.length; a++)
              for (let b = 0; b < items.length - a - 1; b++)
                if (items[b].price > items[b+1].price) { const t = items[b]; items[b] = items[b+1]; items[b+1] = t; }
            // Phase 4: price accumulation
            acc += items.reduce((s, x) => s + x.price * x.qty, 0) % 999999;
            // Phase 5: hash-like lookup (1000 modulo ops)
            for (let h = 0; h < 1000; h++) acc += (i * h * 31) % 512;
            acc = acc - acc * 0.11 + acc * 0.05;
          }
          return acc;
        },
      };

      async function loadWasm() {
  try {
    const response = await fetch("kasir.wasm");
    if (!response.ok) throw new Error("WASM file tidak ditemukan");

    const bytes = await response.arrayBuffer();

    const wasm = await WebAssembly.instantiate(bytes, {
      env: {
        log: (ptr) => console.log("WASM log:", ptr),
      },
    });

    const exports = wasm.instance.exports;

    // Inisialisasi memory arena WASM (wajib dipanggil sebelum fungsi lain)
    if (typeof exports.init_memory === "function") {
      exports.init_memory();
    }

    window.wasmExports = exports;
    window.wasmMemory = exports.memory; // shared memory buffer untuk baca/tulis data
    window.wasmReady = true;
    console.log("%c✓ WASM module loaded (Zig compiled)", "color:#00d9a3;font-weight:bold");
    console.log("✅ WASM Exports:", Object.keys(exports));
  } catch (err) {
    window.wasmReady = false;
    console.warn("WASM tidak tersedia, menggunakan JS fallback:", err.message);
  }
}      /* ============================================
   ALPINE: POS DEMO COMPONENT
============================================ */
      document.addEventListener("alpine:init", () => {
        Alpine.data("posDemo", () => ({
          form: { name: "", price: 0, qty: 1 },
          cart: [
            { id: 1, name: "Kopi Susu Gula Aren", price: 18000, qty: 2 },
            { id: 2, name: "Roti Bakar Coklat", price: 15000, qty: 1 },
          ],
          taxRate: 11,
          discountRate: 0,
          benchmark: null,
          nextId: 3,

          // Getter untuk status WASM (reactive terhadap perubahan window.wasmReady)
          get wasmReady() {
            return window.wasmReady || false;
          },

          get subtotal() {
            return this.cart.reduce(
              (sum, item) => sum + item.price * item.qty,
              0,
            );
          },
          get discountAmount() {
            return (this.subtotal * this.discountRate) / 100;
          },
          get taxableBase() {
            return this.subtotal - this.discountAmount;
          },
          get taxAmount() {
            return (this.taxableBase * this.taxRate) / 100;
          },
          get total() {
            if (
              window.wasmReady &&
              window.wasmExports &&
              window.wasmExports.calculate_total
            ) {
              return window.wasmExports.calculate_total(
                this.subtotal,
                this.taxRate,
                this.discountRate,
              );
            }
            return window.jsBackend.calculate_total(
              this.subtotal,
              this.taxRate,
              this.discountRate,
            );
          },

          addItem() {
            if (!this.form.name || this.form.price <= 0) return;
            this.cart.push({
              id: this.nextId++,
              name: this.form.name,
              price: this.form.price,
              qty: this.form.qty || 1,
            });
            this.form = { name: "", price: 0, qty: 1 };
            showToast("Item ditambahkan ke keranjang");
          },
          removeItem(idx) {
            this.cart.splice(idx, 1);
          },
          clearCart() {
            this.cart = [];
            showToast("Keranjang dikosongkan");
          },
          checkout() {
            if (this.cart.length === 0) return;
            showToast(
              `Transaksi Rp ${this.formatRupiah(this.total)} diproses!`,
            );
            setTimeout(() => this.clearCart(), 1500);
          },
          formatRupiah(n) {
            return "Rp " + Math.round(n).toLocaleString("id-ID");
          },
          runBenchmark() {
            const ITER = 1000; // 1K iterasi — cukup untuk demo live tanpa freeze
            let wasmTime = 0;

            if (
              window.wasmReady &&
              window.wasmExports &&
              window.wasmExports.compute_benchmark
            ) {
              const t0 = performance.now();
              window.wasmExports.compute_benchmark(ITER);
              wasmTime = performance.now() - t0;
            }

            const t1 = performance.now();
            window.jsBackend.compute_benchmark(ITER);
            const jsTime = performance.now() - t1;

            this.benchmark = {
              wasm: window.wasmReady ? wasmTime.toFixed(2) : "N/A",
              js: jsTime.toFixed(2),
              speedup: window.wasmReady ? (jsTime / wasmTime).toFixed(2) : "—",
            };
            showToast(
              `Benchmark selesai · ${this.benchmark.speedup}x lebih cepat`,
            );
          },
        }));
      });

      /* ============================================
   TOAST NOTIFICATION
============================================ */
      function showToast(msg) {
        const t = document.getElementById("toast");
        document.getElementById("toast-msg").textContent = msg;
        t.classList.remove("hidden");
        anime({
          targets: t,
          translateX: [50, 0],
          opacity: [0, 1],
          duration: 400,
          easing: "easeOutCubic",
        });
        clearTimeout(window._toastT);
        window._toastT = setTimeout(() => {
          anime({
            targets: t,
            translateX: [0, 50],
            opacity: [1, 0],
            duration: 400,
            easing: "easeInCubic",
            complete: () => t.classList.add("hidden"),
          });
        }, 2500);
      }

      /* ============================================
   HERO POS MOCKUP — Animated items
============================================ */
      const heroItems = [
        { name: "Kopi Susu Gula Aren", price: 18000, qty: 2 },
        { name: "Roti Bakar Coklat", price: 15000, qty: 1 },
        { name: "Air Mineral 600ml", price: 5000, qty: 3 },
        { name: "Snack Kentang", price: 12500, qty: 1 },
      ];
      const posItemsEl = document.getElementById("pos-items");
      const posSubtotalEl = document.getElementById("pos-subtotal");
      const posTaxEl = document.getElementById("pos-tax");
      const posTotalEl = document.getElementById("pos-total");

      function renderPosItem(item) {
        const div = document.createElement("div");
        div.className =
          "flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5";
        div.innerHTML = `
    <div class="flex-1 min-w-0">
      <div class="text-xs font-medium truncate">${item.name}</div>
      <div class="text-[10px] text-slate-500 font-mono">Rp ${item.price.toLocaleString("id-ID")} × ${item.qty}</div>
    </div>
    <div class="text-xs font-mono font-semibold text-emerald-400">Rp ${(item.price * item.qty).toLocaleString("id-ID")}</div>
  `;
        return div;
      }

      function animateHeroPOS() {
        let idx = 0;
        let currentSubtotal = 0;

        function addNext() {
          if (idx >= heroItems.length) {
            setTimeout(() => {
              posItemsEl.innerHTML = "";
              currentSubtotal = 0;
              updateTotals(0);
              idx = 0;
              setTimeout(addNext, 600);
            }, 2800);
            return;
          }
          const item = heroItems[idx];
          const el = renderPosItem(item);
          el.style.opacity = "0";
          el.style.transform = "translateX(-12px)";
          posItemsEl.appendChild(el);
          anime({
            targets: el,
            opacity: [0, 1],
            translateX: [-12, 0],
            duration: 500,
            easing: "easeOutCubic",
          });
          currentSubtotal += item.price * item.qty;
          updateTotals(currentSubtotal);
          idx++;
          setTimeout(addNext, 800);
        }

        function updateTotals(sub) {
          const tax = sub * 0.11;
          const total = sub + tax;
          animateNumber(posSubtotalEl, sub);
          animateNumber(posTaxEl, tax);
          animateNumber(posTotalEl, total);
        }

        function animateNumber(el, target) {
          const start = parseFloat(el.dataset.val || "0");
          const obj = { v: start };
          anime({
            targets: obj,
            v: target,
            duration: 500,
            easing: "easeOutCubic",
            update: () => {
              el.textContent =
                "Rp " + Math.round(obj.v).toLocaleString("id-ID");
              el.dataset.val = target;
            },
          });
        }

        addNext();
      }

      /* ============================================
   ANIME.JS — Reveal animations & counters
============================================ */
      function initReveals() {
        const reveals = document.querySelectorAll(".reveal");
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const delay = entry.target.dataset.delay || 0;
                anime({
                  targets: entry.target,
                  opacity: [0, 1],
                  translateY: [28, 0],
                  duration: 800,
                  delay: parseInt(delay),
                  easing: "easeOutCubic",
                });
                io.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
        );
        reveals.forEach((el, i) => {
          el.dataset.delay = (i % 4) * 80;
          io.observe(el);
        });
      }

      function initCounters() {
        const counters = document.querySelectorAll(".ticker-num[data-target]");
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseFloat(el.dataset.target);
                const suffix = el.dataset.suffix || "";
                const isDecimal = suffix.startsWith(".");
                const obj = { v: 0 };
                anime({
                  targets: obj,
                  v: target,
                  duration: 2000,
                  easing: "easeOutExpo",
                  update: () => {
                    let val;
                    if (isDecimal) {
                      const dec = suffix.substring(1);
                      const parts = dec.match(/(\d+)(\D*)/);
                      const decimals = parts[1].length;
                      val = obj.v.toFixed(decimals);
                    } else {
                      val = Math.round(obj.v).toLocaleString("id-ID");
                    }
                    el.textContent = val + suffix;
                  },
                });
                io.unobserve(el);
              }
            });
          },
          { threshold: 0.5 },
        );
        counters.forEach((c) => io.observe(c));
      }

      /* ============================================
   FLOAT CARDS parallax
============================================ */
      function initFloatParallax() {
        const cards = [
          { el: document.getElementById("float-card-1"), factor: -0.04 },
          { el: document.getElementById("float-card-2"), factor: 0.04 },
        ];
        const mockup = document.getElementById("hero-mockup");
        if (!mockup) return;
        mockup.addEventListener("mousemove", (e) => {
          const rect = mockup.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          cards.forEach((c) => {
            if (c.el) {
              c.el.style.transform = `translate(${x * c.factor}px, ${y * c.factor}px)`;
            }
          });
        });
        mockup.addEventListener("mouseleave", () => {
          cards.forEach((c) => {
            if (c.el) c.el.style.transform = "";
          });
        });
      }

      /* ============================================
  INIT
============================================ */
      document.addEventListener("DOMContentLoaded", async () => {
        await loadWasm();
        initReveals();
        initCounters();
        initFloatParallax();
        setTimeout(animateHeroPOS, 800);
      });

      window.addEventListener("load", () => {
        anime({
          targets: ".reveal",
          opacity: [0, 1],
          translateY: [28, 0],
          duration: 900,
          delay: anime.stagger(80, { start: 100 }),
          easing: "easeOutCubic",
        });
      });
