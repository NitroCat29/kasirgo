import { Router, Route, A, useNavigate } from "@solidjs/router";
import { lazy, Suspense, createEffect, ErrorBoundary } from "solid-js";
import LoadingScreen from "./components/LoadingScreen";
import { fetchMe } from "./lib/auth";
import { ToastContainer } from "./components/ui";
import { isElectrobun } from "./lib/desktop";
import { onMount } from "solid-js";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Kasir = lazy(() => import("./pages/Kasir"));
const Fitur = lazy(() => import("./pages/Fitur"));
const Tentang = lazy(() => import("./pages/Tentang"));
const Demo = lazy(() => import("./pages/Demo"));
const AiIntegration = lazy(() => import("./pages/AiIntegration"));

// ============================================================
// HOME — desktop langsung ke aplikasi, web ke landing
// ============================================================
// Produk jadi: aplikasi desktop (Electrobun) langsung masuk Kasir/Dashboard,
// tanpa lewat landing. Landing tetap untuk website.
function HomeRedirect() {
  const nav = useNavigate();
  onMount(() => {
    let desktop = false;
    try {
      desktop = isElectrobun();
    } catch {
      desktop = false;
    }
    try {
      nav(desktop ? "/kasir" : "/landing", { replace: true });
    } catch {
      // Gagal redirect (mis. hook router belum siap) → tampilkan landing.
      nav("/landing", { replace: true });
    }
  });
  return <LoadingScreen />;
}

function NotFound() {
  return (
    <div class="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 class="text-6xl font-bold text-kasir-accent">404</h1>
      <p class="text-kasir-muted">Halaman tidak ditemukan</p>
      <A href="/landing" class="text-kasir-accent hover:underline">
        Kembali ke beranda
      </A>
    </div>
  );
}

// Error boundary fallback — tampilkan error message biar gak blank screen
function ErrorFallback(err: any, reset: () => void) {
  return (
    <div class="flex flex-col items-center justify-center min-h-screen gap-4 p-6 text-center">
      <h1 class="text-2xl font-bold text-kasir-accent2">Terjadi error</h1>
      <p class="text-sm text-kasir-muted max-w-md">
        {err?.message || String(err)}
      </p>
      <div class="flex gap-2">
        <button class="btn-sm btn-indigo" onClick={reset}>
          Coba lagi
        </button>
        <A href="/login" class="btn-sm btn-ghost">
          Ke login
        </A>
      </div>
    </div>
  );
}


function Layout(props: { children?: any }) {
  const nav = useNavigate();

  // Desktop (Electrobun): buka langsung ke POS, lewati landing/login
  onMount(() => {
    if (isElectrobun()) {
      const p = window.location.pathname;
      if (p === "/" || p === "/login") nav("/kasir", { replace: true });
    }
  });

  return (
    <>
      <ToastContainer />
      <ErrorBoundary fallback={ErrorFallback}>
        <Suspense fallback={<LoadingScreen />}>
          {props.children}
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export default function App() {
  createEffect(() => {
    fetchMe();
  });

  return (
    <Router root={Layout}>
      <Route path="/" component={HomeRedirect} />
      <Route path="/landing" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/kasir" component={Kasir} />
      <Route path="/fitur" component={Fitur} />
      <Route path="/tentang" component={Tentang} />
      <Route path="/ai-integration" component={AiIntegration} />
      <Route path="/demo" component={Demo} />
      <Route path="*" component={NotFound} />
    </Router>
  );
}
