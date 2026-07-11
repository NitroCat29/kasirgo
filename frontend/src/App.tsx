import { Router, Route, A } from "@solidjs/router";
import { lazy, Suspense, createEffect, ErrorBoundary } from "solid-js";
import { fetchMe } from "./lib/auth";
import { ToastContainer } from "./components/ui";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

function NotFound() {
  return (
    <div class="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 class="text-6xl font-bold text-kasir-accent">404</h1>
      <p class="text-kasir-muted">Halaman tidak ditemukan</p>
      <A href="/" class="text-kasir-accent hover:underline">
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
  return (
    <>
      <ToastContainer />
      <ErrorBoundary fallback={ErrorFallback}>
        <Suspense fallback={<div class="...">Loading...</div>}>
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
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="*" component={NotFound} />
    </Router>
  );
}
