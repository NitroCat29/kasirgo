// ============================================================
// KasirGo — LoadingScreen (block-stacking animation)
// Digunakan sebagai Suspense fallback di App.tsx
// ============================================================
import { createSignal, onMount } from "solid-js";

const BLOCK_COUNT = 4;
const BLOCK_DELAY = 150; // ms between each block
const BLOCK_HOLD = 600; // ms after all blocks settle
const FADE_DURATION = 500; // ms for text transitions

export default function LoadingScreen() {
  const [phase, setPhase] = createSignal<"blocks" | "please-wait" | "welcome">("blocks");
  const [blockDone, setBlockDone] = createSignal<number>(0);

  onMount(() => {
    // Step 1: animate blocks one by one
    for (let i = 0; i < BLOCK_COUNT; i++) {
      setTimeout(() => setBlockDone(i + 1), (i + 1) * BLOCK_DELAY);
    }

    // Step 2: after blocks settle, show "Please Wait"
    setTimeout(() => setPhase("please-wait"), BLOCK_COUNT * BLOCK_DELAY + BLOCK_HOLD);

    // Step 3: after "Please Wait" shown briefly, fade to "Selamat Datang!"
    setTimeout(() => setPhase("welcome"), BLOCK_COUNT * BLOCK_DELAY + BLOCK_HOLD + 1800);
  });

  return (
    <div class="loading-screen">
      <div class="loading-card">
        {/* Logo minimalis */}
        <svg class="loading-logo" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="12" width="8" height="20" rx="2" fill="currentColor" opacity="0.5" />
          <rect x="16" y="6" width="8" height="26" rx="2" fill="currentColor" opacity="0.7" />
          <rect x="28" y="16" width="8" height="16" rx="2" fill="currentColor" />
        </svg>

        {/* Block stacking */}
        <div class="block-stack" aria-hidden="true">
          {Array.from({ length: BLOCK_COUNT }, (_, i) => (
            <div
              class="stack-block"
              classList={{ visible: blockDone() > i }}
              style={`transition-delay:${i*60}ms`}
            />
          ))}
        </div>

        {/* Teks: Please Wait → Selamat Datang! */}
        <div class="loading-text-wrap">
          <div
            class="loading-text loading-text--first"
            classList={{
              "text-exit-up": phase() === "welcome",
            }}
          >
            Please Wait
          </div>
          <div
            class="loading-text loading-text--second"
            classList={{
              "text-enter-up": phase() === "welcome",
            }}
          >
            Selamat Datang!
          </div>
        </div>
      </div>
    </div>
  );
}
