// ============================================================
// KasirGo — one-shot dev launcher
// ============================================================
// Jalankan dari repo root:  bun run dev
// Nyalain backend (:3456) + frontend Vite (:5173) bareng, log di-join,
// Ctrl+C matiin dua-duanya. Gak perlu buka 2 terminal lagi.
//
// Kenapa bukan `concurrently`/`npm-run-all`: gak mau nambah dependency.
// Bun punya subprocess + AbortSignal bawaan — cukup segitu.
import { spawn, type Subprocess } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = import.meta.dir + "/..";

// --- Guard: dependency harus sudah ke-install ---
if (!existsSync(join(ROOT, "frontend", "node_modules"))) {
  console.error("frontend/node_modules belum ada. Jalankan dulu:\n  bun install --cwd frontend");
  process.exit(1);
}

const procs: { label: string; proc: Subprocess }[] = [];

function run(label: string, cmd: string[], cwd: string, color: string) {
  const proc = spawn({
    cmd,
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  procs.push({ label, proc });

  const tag = `\x1b[${color}m[${label}]\x1b[0m`;
  const pipe = (stream: ReadableStream<Uint8Array> | null, out: NodeJS.WriteStream) => {
    if (!stream) return;
    stream
      .pipeThrough(new TextDecoderStream())
      .pipeTo(
        new WritableStream({
          write(chunk) {
            for (const line of chunk.split("\n")) {
              if (line.trim()) out.write(`${tag} ${line}\n`);
            }
          },
        }),
      )
      .catch(() => {});
  };
  pipe(proc.stdout, process.stdout);
  pipe(proc.stderr, process.stderr);
  return proc;
}

console.log("KasirGo dev — backend :3456 + frontend :5173 (Ctrl+C untuk berhenti)\n");

run("backend", ["bun", "run", "--hot", "backend/server.ts"], ROOT, "36"); // cyan
run("frontend", ["bun", "run", "dev"], join(ROOT, "frontend"), "35"); // magenta

// --- Graceful shutdown: Ctrl+C / SIGTERM → matiin anak-anak ---
let shuttingDown = false;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nBerhentiin backend + frontend...");
  await Promise.all(procs.map(({ proc }) => proc.kill().catch(() => {})));
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// Kalau salah satu proses exit duluan → yang lain ikut mati.
for (const { label, proc } of procs) {
  const code = await proc.exited;
  if (!shuttingDown) {
    console.error(`\n${label} exit (${code}) — mematikan proses lain...`);
    await shutdown(code);
  }
}
