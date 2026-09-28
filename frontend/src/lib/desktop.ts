// ============================================================
// KasirGo — Desktop (Electrobun) bridge
// ============================================================
// Mendeteksi webview Electrobun + RPC client minimal ke Bun main process.
// Tidak butuh dependency tambahan: ngomong wire protocol yang sama dengan
// electrobun/view (WebSocket + AES-GCM encrypt/decrypt dari preload,
// postMessage fallback kalau socket belum siap).
// Dipakai frontend saat jalan di Electrobun webview (offline mode).
// Browser mode tetap pakai lib/api.ts (fetch ke Bun backend).

import type { RpcRequests } from "../../../shared/desktop-rpc";

type Method = keyof RpcRequests;

/** True kalau jalan di webview Electrobun (bukan browser biasa). */
export function isElectrobun(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as any).__electrobunWebviewId !== undefined
  );
}

// ============================================================
// Wire protocol (mirror electrobun/dist/api/browser + shared/rpc.ts)
// ============================================================
type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let socketPromise: Promise<WebSocket | null> | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function w(): any {
  return window as any;
}

function getSocket(): Promise<WebSocket | null> {
  if (!socketPromise) {
    socketPromise = new Promise((resolve) => {
      const port = w().__electrobunRpcSocketPort;
      const webviewId = w().__electrobunWebviewId;
      if (!port || !webviewId) {
        resolve(null); // no native socket — postMessage bridge only
        return;
      }
      const ws = new WebSocket(
        `ws://localhost:${port}/socket?webviewId=${webviewId}`,
      );
      ws.addEventListener("open", () => resolve(ws));
      ws.addEventListener("error", () => resolve(null));
      ws.addEventListener("message", async (event) => {
        const data = event.data;
        if (typeof data !== "string") return;
        try {
          const enc = JSON.parse(data);
          const decrypted = await w().__electrobun_decrypt(
            enc.encryptedData,
            enc.iv,
            enc.tag,
          );
          handlePacket(JSON.parse(decrypted));
        } catch (err) {
          console.error("KasirGo RPC: gagal parse bun message:", err);
        }
      });
    });
  }
  return socketPromise;
}

async function sendToBun(msg: string): Promise<void> {
  // Prefer native socket; fallback ke postMessage bridge (sama seperti
  // electrobun/view — fallback mengirim RAW msg, preload yang encrypt).
  const ws = await getSocket();
  if (ws && ws.readyState === WebSocket.OPEN) {
    const { encryptedData, iv, tag } = await w().__electrobun_encrypt(msg);
    ws.send(JSON.stringify({ encryptedData, iv, tag }));
    return;
  }
  w().__electrobunBunBridge?.postMessage(msg);
}

function handlePacket(packet: any): void {
  if (!packet || packet.type !== "response") return;
  const p = pending.get(packet.id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(packet.id);
  if (packet.success) p.resolve(packet.payload);
  else p.reject(new Error(packet.error || "RPC error"));
}

// Hook pesan dari Bun lewat postMessage bridge (preload panggil ini dgn objek).
if (isElectrobun()) {
  w().__electrobun.receiveMessageFromBun = handlePacket;
}

// ============================================================
// Typed RPC call
// ============================================================
export async function desktopCall<M extends Method>(
  method: M,
  params: RpcRequests[M]["params"],
  timeoutMs = 15_000,
): Promise<RpcRequests[M]["response"]> {
  if (!isElectrobun()) throw new Error("Bukan lingkungan Electrobun");
  const id = ++nextId;
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`RPC '${String(method)}' timed out`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
  });
  await sendToBun(JSON.stringify({ type: "request", id, method, params }));
  return (await result) as RpcRequests[M]["response"];
}
