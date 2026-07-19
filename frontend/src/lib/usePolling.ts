/**
 * Polling interval generik — return disposer function.
 * fn dijalankan langsung 1x, lalu tiap `ms` (hanya jika enabled true).
 */
export function usePolling(
  fn: () => void,
  ms: number,
  enabled: () => boolean = () => true,
): () => void {
  const tick = () => {
    if (enabled()) fn();
  };
  tick();
  const timer = setInterval(tick, ms);
  return () => clearInterval(timer);
}
