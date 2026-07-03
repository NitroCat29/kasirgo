#!/usr/bin/env bun
/**
 * Build script for KasirGo — produces dist/ for GitHub Pages
 * Usage: bun run build
 */

import { mkdirSync, copyFileSync, existsSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const ROOT = import.meta.dir;
const DIST = join(ROOT, "dist");

// Clean dist
if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

console.log("🔨 Building KasirGo for production...\n");

// 1. Minify JS with bun build
console.log("📦 Minifying script.js...");
execSync(`bun build script.js --minify --outdir=${join(DIST)}`, { cwd: ROOT, stdio: "inherit" });

// 2. Copy HTML files
const htmlFiles = ["index.html", "login.html", "dashboard.html", "404.html", "benchmark.html"];
console.log("📄 Copying HTML files...");
for (const f of htmlFiles) {
  const src = join(ROOT, f);
  if (existsSync(src)) {
    copyFileSync(src, join(DIST, f));
    console.log(`   ✓ ${f}`);
  }
}

// 3. Copy CSS
console.log("🎨 Copying styles...");
mkdirSync(join(DIST, "styles"), { recursive: true });
copyFileSync(join(ROOT, "styles", "style.css"), join(DIST, "styles", "style.css"));
console.log("   ✓ styles/style.css");

// 4. Copy WASM
console.log("⚡ Copying kasir.wasm...");
copyFileSync(join(ROOT, "kasir.wasm"), join(DIST, "kasir.wasm"));

// 5. Copy assets
console.log("🖼️  Copying assets...");
mkdirSync(join(DIST, "assets"), { recursive: true });
const assetsDir = join(ROOT, "assets");
for (const f of readdirSync(assetsDir)) {
  copyFileSync(join(assetsDir, f), join(DIST, "assets", f));
  console.log(`   ✓ assets/${f}`);
}

// 6. Fix absolute paths for GitHub Pages (subpath deployment)
console.log("🔧 Fixing paths for GitHub Pages...");
for (const f of htmlFiles) {
  const filePath = join(DIST, f);
  if (existsSync(filePath)) {
    let content = await Bun.file(filePath).text();
    // /assets/ → ./assets/
    content = content.replace(/href="\/assets\//g, 'href="./assets/');
    content = content.replace(/src="\/assets\//g, 'src="./assets/');
    // /login → ./login.html
    content = content.replace(/href="\/login"/g, 'href="./login.html"');
    // / → ./index.html (but not // or /# or /api)
    content = content.replace(/href="\/"/g, 'href="./index.html"');
    await Bun.write(filePath, content);
    console.log(`   ✓ ${f}`);
  }
}

// Done
console.log("\n✅ Build complete! Output in dist/");
console.log("   Deploy dist/ to GitHub Pages (gh-pages branch)");
