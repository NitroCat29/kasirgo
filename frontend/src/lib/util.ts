/**
 * Util shared: parse JSON aman, debounce, class merge (cn).
 */

/** JSON.parse dengan try/catch. Return fallback kalau invalid. */
export function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Debounce: tunda fn sampai `ms` sepi pemanggilan. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * class merge ringan (clsx-style).
 * cn("a", cond && "b", false && "c", { d: true }) → "a b d"
 */
export function cn(...parts: Array<string | false | null | undefined | Record<string, boolean>>): string {
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (typeof p === "string") {
      out.push(p);
    } else {
      for (const [k, v] of Object.entries(p)) {
        if (v) out.push(k);
      }
    }
  }
  return out.join(" ");
}
