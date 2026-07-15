// ============================================================
// RevenueChart — Soft overlapping blob waves for income/expense
// Green (Pendapatan) in front, red (Pengeluaran) behind, both
// translucent gradient fills with smooth Catmull-Rom curves.
// ============================================================
import { onMount, onCleanup, createEffect, Show } from "solid-js";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

interface DailyData {
  day: string;
  revenue: number;
  count: number;
  // Optional — plug in a real expense figure from the API when available.
  expense?: number;
}

function formatRupiah(val: number): string {
  if (val >= 1_000_000) return `Rp${(val / 1_000_000).toFixed(1)}jt`;
  if (val >= 1_000) return `Rp${(val / 1_000).toFixed(0)}rb`;
  return `Rp${val}`;
}

function formatRupiahFull(val: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// Deterministic pseudo-random ratio (0..1) derived from a string, so the
// placeholder expense curve stays stable across re-renders instead of
// jumping around every time the component redraws.
function seededRatio(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

// Catmull-Rom spline → cubic bezier conversion. Higher tension = softer,
// blobbier curves (less pointy peaks), closer to the reference "wave" look.
function catmullRomSpline(
  pts: { x: number; y: number }[],
  tension = 0.9
): { x: number; y: number }[][] {
  if (pts.length < 2) return [];
  const curves: { x: number; y: number }[][] = [];

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / (6 * tension);
    const cp1y = p1.y + (p2.y - p0.y) / (6 * tension);
    const cp2x = p2.x - (p3.x - p1.x) / (6 * tension);
    const cp2y = p2.y - (p3.y - p1.y) / (6 * tension);

    curves.push([
      { x: p1.x, y: p1.y },
      { x: cp1x, y: cp1y },
      { x: cp2x, y: cp2y },
      { x: p2.x, y: p2.y },
    ]);
  }
  return curves;
}

function pathFromCurves(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], curves: { x: number; y: number }[][], bottom: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, bottom);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (const c of curves) ctx.bezierCurveTo(c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y);
  ctx.lineTo(pts[pts.length - 1].x, bottom);
  ctx.closePath();
}

const GREEN = { line: "#10e0a0", lineSoft: "#5df5c4", fillTop: "rgba(16, 224, 160, 0.38)", fillMid: "rgba(16, 224, 160, 0.14)" };
const RED = { line: "#f4685c", lineSoft: "#ff9b90", fillTop: "rgba(244, 104, 92, 0.28)", fillMid: "rgba(244, 104, 92, 0.08)" };

export default function RevenueChart(props: { data: DailyData[]; loading?: boolean }) {
  let containerRef: HTMLDivElement | undefined;
  let tooltipRef: HTMLDivElement | undefined;
  let chart: uPlot | null = null;
  let drawProgress = 0; // 0→1 for draw-on-load animation
  let animFrame = 0;

  const isLight = () => document.documentElement.getAttribute("data-theme") === "light";

  // Placeholder expense series until a real /pengeluaran figure exists in
  // the API — derived from revenue with stable per-day variance so the
  // red wave reads as organic rather than a flat mirrored copy.
  function expenseFor(d: DailyData): number {
    if (typeof d.expense === "number") return d.expense;
    const ratio = 0.32 + seededRatio(d.day) * 0.26; // ~32%–58% of revenue
    return d.revenue * ratio;
  }

  function startDrawAnimation() {
    drawProgress = 0;
    cancelAnimationFrame(animFrame);
    const start = performance.now();
    const duration = 850;
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      drawProgress = 1 - Math.pow(1 - t, 3); // ease out cubic
      if (chart) chart.redraw();
      if (t < 1) animFrame = requestAnimationFrame(tick);
    }
    animFrame = requestAnimationFrame(tick);
  }

  function handleResize() {
    if (!chart || !containerRef) return;
    const w = containerRef.parentElement?.clientWidth || 600;
    chart.setSize({ width: w - 16, height: 260 });
  }

  function getChartOpts(width: number, dataLen: number, maxVal: number): uPlot.Options {
    const light = isLight();
    const fgColor = light ? "#1a1612" : "#8b95a8";
    const gridColor = light ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.035)";
    const textColor = light ? "#7a7066" : "#52525b";

    return {
      width: width - 16,
      height: 260,
      padding: [18, 12, 4, 8],
      scales: { y: { range: [0, maxVal * 1.15] } },
      axes: [
        {
          stroke: fgColor,
          grid: { stroke: gridColor },
          ticks: { show: false },
          values: (_u, vals) =>
            vals.map((v: number) => {
              const d = new Date(v * 1000);
              if (dataLen > 15) {
                const day = d.getDate();
                if (day !== 1 && day !== 15) return "";
              }
              return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
            }),
          font: "11px 'Space Grotesk', sans-serif",
          color: textColor,
        },
        {
          stroke: fgColor,
          grid: { stroke: gridColor },
          ticks: { show: false },
          values: (_u, vals) => vals.map(formatRupiah),
          size: 58,
          font: "11px 'JetBrains Mono', monospace",
          color: textColor,
        },
      ],
      series: [
        {},
        { label: "Pendapatan", stroke: GREEN.line, width: 0 },
      ],
      cursor: { y: false, points: { show: false } },
      plugins: [
        {
          hooks: {
            drawAxes: [
              (u: uPlot) => {
                const ctx = u.ctx;
                const xdata = u.data[0];
                const revData = u.data[1];
                if (!xdata || xdata.length < 2) return;

                ctx.save();

                const revPts: { x: number; y: number }[] = [];
                const expPts: { x: number; y: number }[] = [];
                for (let i = 0; i < xdata.length; i++) {
                  const dayStr = new Date(xdata[i] * 1000).toISOString().slice(0, 10);
                  const dayData = props.data.find((d) => d.day === dayStr);
                  const exp = dayData ? expenseFor(dayData) : 0;
                  revPts.push({ x: u.valToPos(xdata[i], "x", true), y: u.valToPos(revData[i], "y", true) });
                  expPts.push({ x: u.valToPos(xdata[i], "x", true), y: u.valToPos(exp, "y", true) });
                }

                // Draw-on-load clip
                const totalWidth = revPts[revPts.length - 1].x - revPts[0].x;
                const clipWidth = totalWidth * drawProgress;
                ctx.beginPath();
                ctx.rect(revPts[0].x - 4, -100, clipWidth + 8, 500);
                ctx.clip();

                const bottom = u.valToPos(0, "y", true);

                // ---- Layer 1: Pengeluaran (red, behind) ----
                const expCurves = catmullRomSpline(expPts, 1.05);
                pathFromCurves(ctx, expPts, expCurves, bottom);
                const gradExp = ctx.createLinearGradient(0, 0, 0, bottom);
                gradExp.addColorStop(0, RED.fillTop);
                gradExp.addColorStop(0.6, RED.fillMid);
                gradExp.addColorStop(1, "rgba(244, 104, 92, 0)");
                ctx.fillStyle = gradExp;
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(expPts[0].x, expPts[0].y);
                for (const c of expCurves) ctx.bezierCurveTo(c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y);
                ctx.strokeStyle = RED.line;
                ctx.globalAlpha = 0.75;
                ctx.lineWidth = 2;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                ctx.stroke();
                ctx.globalAlpha = 1;

                // ---- Layer 2: Pendapatan (green, front) ----
                const revCurves = catmullRomSpline(revPts, 0.85);
                pathFromCurves(ctx, revPts, revCurves, bottom);
                const gradRev = ctx.createLinearGradient(0, 0, 0, bottom);
                gradRev.addColorStop(0, GREEN.fillTop);
                gradRev.addColorStop(0.55, GREEN.fillMid);
                gradRev.addColorStop(1, "rgba(16, 224, 160, 0)");
                ctx.fillStyle = gradRev;
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(revPts[0].x, revPts[0].y);
                for (const c of revCurves) ctx.bezierCurveTo(c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y);
                const lineGrad = ctx.createLinearGradient(revPts[0].x, 0, revPts[revPts.length - 1].x, 0);
                lineGrad.addColorStop(0, GREEN.line);
                lineGrad.addColorStop(1, GREEN.lineSoft);
                ctx.strokeStyle = lineGrad;
                ctx.lineWidth = 2.5;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                ctx.stroke();

                ctx.restore();
              },
            ],
            setCursor: [
              (u: uPlot) => {
                if (!tooltipRef) return;
                const idx = u.cursor.idx;
                if (idx == null || idx < 0 || idx >= u.data[0].length || drawProgress < 1) {
                  if (tooltipRef) tooltipRef.style.opacity = "0";
                  return;
                }
                const xdata = u.data[0];
                const ydata = u.data[1];
                const ts = xdata[idx];
                const rev = ydata[idx];
                const dayStr = new Date(ts * 1000).toISOString().slice(0, 10);
                const dayData = props.data.find((d) => d.day === dayStr);
                const txCount = dayData?.count ?? 0;
                const exp = dayData ? expenseFor(dayData) : 0;

                const cx = u.valToPos(ts, "x", true);
                const cy = u.valToPos(rev, "y", true);
                const chartRect = containerRef?.getBoundingClientRect();
                if (!chartRect) return;

                tooltipRef.innerHTML = `
                  <div style="font-size:11px;opacity:0.65;margin-bottom:4px;">${formatDateFull(dayStr)}</div>
                  <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;color:${GREEN.line};">
                    <span style="width:7px;height:7px;border-radius:50%;background:${GREEN.line};display:inline-block;"></span>
                    ${formatRupiahFull(rev)}
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:12px;color:${RED.line};margin-top:2px;">
                    <span style="width:7px;height:7px;border-radius:50%;background:${RED.line};display:inline-block;"></span>
                    ${formatRupiahFull(exp)}
                  </div>
                  ${txCount > 0 ? `<div style="font-size:11px;opacity:0.55;margin-top:4px;">${txCount} transaksi</div>` : ""}
                `;
                tooltipRef.style.opacity = "1";
                const tw = tooltipRef.offsetWidth || 160;
                const th = tooltipRef.offsetHeight || 70;
                const left = Math.max(4, Math.min(chartRect.width - tw - 8, cx - tw / 2));
                const top = Math.max(4, cy - th - 14);
                tooltipRef.style.left = `${left}px`;
                tooltipRef.style.top = `${top}px`;
              },
            ],
            drawSeries: [
              (u: uPlot) => {
                const ctx = u.ctx;
                const idx = u.cursor.idx;
                if (idx == null || idx < 0 || drawProgress < 1) return;
                const xdata = u.data[0];
                if (idx >= xdata.length) return;

                const cx = u.valToPos(xdata[idx], "x", true);
                const top = u.bbox.top;
                const h = u.bbox.height;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(cx, top);
                ctx.lineTo(cx, top + h);
                ctx.strokeStyle = isLight() ? "rgba(26,22,18,0.12)" : "rgba(255,255,255,0.08)";
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 3]);
                ctx.stroke();
                ctx.setLineDash([]);

                const ydata = u.data[1];
                const cy = u.valToPos(ydata[idx], "y", true);
                ctx.beginPath();
                ctx.arc(cx, cy, 9, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(16, 224, 160, 0.18)";
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
                ctx.fillStyle = GREEN.line;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
                ctx.strokeStyle = isLight() ? "#faf6f0" : "#0a0e1a";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
              },
            ],
          },
        },
      ],
    };
  }

  function buildChart() {
    if (!containerRef || !props.data || props.data.length === 0) return;
    if (chart) {
      chart.destroy();
      chart = null;
    }
    const timestamps = props.data.map((d) => new Date(d.day + "T00:00:00").getTime() / 1000);
    const revenues = props.data.map((d) => d.revenue);
    const maxVal = Math.max(...revenues, 1);
    const data: uPlot.AlignedData = [new Float64Array(timestamps), new Float64Array(revenues)];
    const w = containerRef.parentElement?.clientWidth || 600;
    chart = new uPlot(getChartOpts(w, timestamps.length, maxVal), data, containerRef);
    startDrawAnimation();
  }

  onMount(() => {
    buildChart();
    const observer = new MutationObserver(() => {
      setTimeout(buildChart, 50);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // Keep chart width synced to its container — so it follows the
    // viewport correctly when the page/browser is zoomed or resized.
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef?.parentElement) {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(containerRef.parentElement);
    }
    window.addEventListener("resize", handleResize);

    onCleanup(() => {
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animFrame);
    });
  });

  createEffect(() => {
    props.data;
    setTimeout(buildChart, 50);
  });

  onCleanup(() => {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    cancelAnimationFrame(animFrame);
  });

  return (
    <div class="relative w-full">
      <Show
        when={!props.loading && props.data.length > 0}
        fallback={
          <div class="h-[260px] flex items-center justify-center text-kasir-muted text-sm">
            {props.loading ? "Memuat grafik..." : "Belum ada data transaksi"}
          </div>
        }
      >
        {/* Legend */}
        <div class="flex items-center gap-4 mb-1 px-1">
          <div class="flex items-center gap-1.5 text-xs text-kasir-muted">
            <span class="w-2 h-2 rounded-full" style={{ background: GREEN.line }} />
            Pendapatan
          </div>
          <div class="flex items-center gap-1.5 text-xs text-kasir-muted">
            <span class="w-2 h-2 rounded-full" style={{ background: RED.line }} />
            Pengeluaran
          </div>
        </div>
        <div ref={containerRef} class="w-full" />
        <div
          ref={tooltipRef}
          class="chart-tooltip pointer-events-none"
          style="position:absolute;opacity:0;transition:opacity 0.15s ease;border-radius:10px;padding:8px 12px;font-size:12px;z-index:10;white-space:nowrap;"
        />
      </Show>
    </div>
  );
}
