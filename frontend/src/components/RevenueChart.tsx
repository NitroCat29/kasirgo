// ============================================================
// RevenueChart — uPlot bar chart for daily revenue
// ============================================================
import { onMount, onCleanup, createEffect, createSignal, Show } from "solid-js";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

interface DailyData {
  day: string;
  revenue: number;
  count: number;
}

function formatRupiah(val: number): string {
  if (val >= 1_000_000) return `Rp${(val / 1_000_000).toFixed(1)}jt`;
  if (val >= 1_000) return `Rp${(val / 1_000).toFixed(0)}rb`;
  return `Rp${val}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export default function RevenueChart(props: { data: DailyData[]; loading?: boolean }) {
  let containerRef: HTMLDivElement | undefined;
  let chart: uPlot | null = null;

  const isLight = () => document.documentElement.getAttribute("data-theme") === "light";

  function getChartOpts(width: number): uPlot.Options {
    const light = isLight();
    const fgColor = light ? "#1a1612" : "#8b95a8";
    const gridColor = light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
    const barColor = light ? "#d97706" : "#00d9a3";
    return {
      width: width - 16,
      height: 220,
      padding: [10, 8, 0, 4],
      axes: [
        {
          stroke: fgColor,
          grid: { stroke: gridColor },
          values: (_u, vals) => vals.map((v: number) => formatDate(new Date(v * 1000).toISOString().slice(0, 10))),
        },
        {
          stroke: fgColor,
          grid: { stroke: gridColor },
          values: (_u, vals) => vals.map(formatRupiah),
          size: 60,
        },
      ],
      series: [
        {},
        {
          label: "Pendapatan",
          fill: barColor,
          stroke: barColor,
        },
      ],
      plugins: [
        {
          hooks: {
            drawAxes: [
              (u: uPlot) => {
                const ctx = u.ctx;
                const s = u.series[1];
                const xdata = u.data[0];
                const ydata = u.data[1];
                const i0 = u.valToIdx(xdata[0]);
                const i1 = u.valToIdx(xdata[xdata.length - 1]);
                const barWidth = Math.max(4, Math.min(24, (u.bbox.width / (i1 - i0 + 1)) * 0.6));
                ctx.save();
                ctx.fillStyle = isLight() ? "#d97706" : "#00d9a3";
                for (let i = i0; i <= i1; i++) {
                  const cx = u.valToPos(xdata[i], "x", true);
                  const cy = u.valToPos(ydata[i], "y", true);
                  const bottom = u.valToPos(0, "y", true);
                  const h = bottom - cy;
                  if (h > 0) {
                    ctx.beginPath();
                    ctx.roundRect(cx - barWidth / 2, cy, barWidth, h, [3, 3, 0, 0]);
                    ctx.fill();
                  }
                }
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
    const data: uPlot.AlignedData = [new Float64Array(timestamps), new Float64Array(revenues)];
    const w = containerRef.parentElement?.clientWidth || 600;
    chart = new uPlot(getChartOpts(w), data, containerRef);
  }

  onMount(() => {
    buildChart();
    // Rebuild on theme change
    const observer = new MutationObserver(() => {
      setTimeout(buildChart, 50);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    // React to data changes
    props.data;
    setTimeout(buildChart, 50);
  });

  return (
    <div class="relative w-full">
      <Show when={!props.loading && props.data.length > 0} fallback={
        <div class="h-[220px] flex items-center justify-center text-kasir-muted">
          {props.loading ? "Memuat grafik..." : "Belum ada data transaksi"}
        </div>
      }>
        <div ref={containerRef} class="w-full" />
      </Show>
    </div>
  );
}
