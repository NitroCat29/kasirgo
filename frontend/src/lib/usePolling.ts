import { onCleanup, onMount } from "solid-js";

/**
 * Polling interval generik dengan auto-cleanup.
 * fn dijalankan tiap `ms` (langsung 1x saat mount), lalu tiap interval.
 * enabled=false → tidak jalan.
 */
export function usePolling(fn: () => void, ms: number, enabled: () => boolean = () => true): void {
  let timer: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    const tick = () => {
      if (enabled()) fn();
    };
    tick();
    timer = setInterval(tick, ms);
  });
  onCleanup(() => {
    if (timer) clearInterval(timer);
  });
}
