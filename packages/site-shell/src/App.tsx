import { BrowserRouter, Routes, Route, Link } from "react-router";
import { ABEffectEntry } from "@macrokroma/sim-ab-effect";
import { Landing } from "./pages/Landing";

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <nav className="flex items-center gap-6 px-6 py-4 border-b border-[var(--color-border)]">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
          >
            macrokroma
          </Link>
          <Link
            to="/ab-effect"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Aharonov–Bohm
          </Link>
        </nav>

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/ab-effect/*" element={<ABEffectEntry />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
