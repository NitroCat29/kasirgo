/**
 * Shared theme toggle — single source of truth.
 * data-theme="dark"|"light" on <html>, persisted in localStorage.
 */
import { createSignal, createRoot, onMount } from "solid-js";

type Theme = "dark" | "light";

const [theme, setTheme] = createRoot(() => createSignal<Theme>("dark"));

/** Read persisted theme + apply to DOM. Call once in App or root. */
export function initTheme(): void {
  const stored = (localStorage.getItem("kasir-theme") as Theme) || "dark";
  setTheme(stored);
  document.documentElement.setAttribute("data-theme", stored);
}

/** Toggle dark ↔ light. Returns new value. */
export function toggleTheme(): Theme {
  const next: Theme = theme() === "dark" ? "light" : "dark";
  setTheme(next);
  localStorage.setItem("kasir-theme", next);
  document.documentElement.setAttribute("data-theme", next);
  return next;
}

export { theme };
export type { Theme };
