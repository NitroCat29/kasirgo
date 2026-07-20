/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element");

try {
  render(() => <App />, root);
} catch (err) {
  console.error("[KasirGo] render() failed:", err);
  root.textContent = "";
  const errDiv = document.createElement("div");
  errDiv.style.cssText = "padding:24px;color:#ff6b6b;font-family:monospace;white-space:pre-wrap;max-width:800px;margin:40px auto";
  const h2 = document.createElement("h2");
  h2.style.color = "#ff8a3d";
  h2.textContent = "\u26a0 Render Error";
  errDiv.appendChild(h2);
  const pre = document.createElement("pre");
  pre.style.cssText = "color:#8b95a8;font-size:11px;margin-top:8px";
  pre.textContent = err instanceof Error ? err.stack || err.message : String(err);
  errDiv.appendChild(pre);
  root.appendChild(errDiv);
}
