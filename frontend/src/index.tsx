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
  root.innerHTML = `<div style="padding:24px;color:#ff6b6b;font-family:monospace;white-space:pre-wrap;max-width:800px;margin:40px auto">
    <h2 style="color:#ff8a3d">⚠ Render Error</h2>
    <pre style="color:#8b95a8;font-size:11px;margin-top:8px">${err instanceof Error ? err.stack || err.message : String(err)}</pre>
  </div>`;
}
