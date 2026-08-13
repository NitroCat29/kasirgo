import { BrowserWindow, Updater, defineElectrobunRPC } from "electrobun/bun";
import { spawn, type Subprocess } from "bun";
import { APP_DATA_DIR, DB_PATH } from "./local-db";
import { handlers } from "./rpc-handlers";
import { rpcSchema } from "../../../shared/desktop-rpc";

// Wire RPC: schema declared by both sides (bun side has handlers, webview side empty for now)
const electrobunAppRPC = defineElectrobunRPC<typeof rpcSchema>("bun", {
  handlers: { requests: handlers },
});
// Eagerly register — touch the proxy so internal wiring runs.
void electrobunAppRPC;

const DEV_VITE_PORT = 5173;
const DEV_BACKEND_PORT = 3456;
const DEV_VITE_URL = `http://localhost:${DEV_VITE_PORT}`;
const DEV_BACKEND_URL = `http://localhost:${DEV_BACKEND_PORT}`;
const REPO_ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// ============================================================
// Managed child processes (auto-spawn backend + frontend dev)
// ============================================================
const children: Subprocess[] = [];

function spawnManaged(label: string, cmd: string[], cwd: string): Subprocess {
  const proc = spawn({
    cmd,
    cwd,
    env: { ...process.env, ELECTROBUN_HOST: "1" },
    stdout: "inherit",
    stderr: "inherit",
  });
  children.push(proc);
  console.log(`[${label}] spawned pid=${proc.pid} cwd=${cwd}`);
  return proc;
}

function killAll(): void {
  for (const c of children) {
    try {
      c.kill();
    } catch {
      // best-effort
    }
  }
  children.length = 0;
}

process.on("exit", killAll);
process.on("SIGINT", () => {
  killAll();
  process.exit(0);
});
process.on("SIGTERM", () => {
  killAll();
  process.exit(0);
});

// ============================================================
// URL resolution
// ============================================================
// dev channel: serve from Vite dev server (HMR)
// prod channel: serve from backend (single port, backend hosts SPA)
// ============================================================
async function waitForUrl(url: string, label: string, timeoutMs = 15_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok || res.status < 500) return true;
    } catch {
      // not up yet
    }
    await Bun.sleep(250);
  }
  console.error(`[${label}] timed out waiting for ${url}`);
  return false;
}

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    // Dev: spawn backend + Vite, point BrowserWindow at Vite
    if (!process.env.ELECTROBUN_SKIP_SPAWN) {
      spawnManaged("backend", ["bun", "run", "backend/server.ts"], REPO_ROOT);
      spawnManaged(
        "vite",
        ["bun", "run", "--cwd", "frontend", "dev", "--host"],
        REPO_ROOT,
      );
    }
    const ok = await waitForUrl(DEV_VITE_URL, "vite");
    if (!ok) {
      console.warn("Falling back to backend SPA at " + DEV_BACKEND_URL);
      return DEV_BACKEND_URL;
    }
    console.log(`HMR enabled: ${DEV_VITE_URL}`);
    return DEV_VITE_URL;
  }
  // Prod: spawn backend only, point BrowserWindow at backend SPA
  if (!process.env.ELECTROBUN_SKIP_SPAWN) {
    spawnManaged("backend", ["bun", "run", "backend/server.ts"], REPO_ROOT);
  }
  const ok = await waitForUrl(DEV_BACKEND_URL, "backend");
  if (!ok) {
    console.warn("Backend not reachable; falling back to views://mainview/index.html");
    return "views://mainview/index.html";
  }
  return DEV_BACKEND_URL;
}

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
  title: "KasirGo",
  url,
  frame: {
    width: 1280,
    height: 820,
    x: 120,
    y: 120,
  },
});

// Keep reference alive (Electrobun's BrowserWindow needs to stay rooted)
(globalThis as { __kasirgoWindow?: typeof mainWindow }).__kasirgoWindow = mainWindow;

console.log(`KasirGo started — channel=${await Updater.localInfo.channel()} url=${url}`);
console.log(`Local DB: ${DB_PATH}`);
console.log(`App data: ${APP_DATA_DIR}`);
