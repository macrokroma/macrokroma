import { BrowserRouter, Routes, Route, Link } from "react-router";
import {
  ABEffectEntry,
  ABOverview,
  ABInterference,
  ABDoubleSlit,
} from "@macrokroma/sim-ab-effect";
import { Landing } from "./pages/Landing";

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-[var(--color-text-secondary)]">
      <p className="text-sm">{title} — coming soon</p>
    </div>
  );
}

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

        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/ab-effect" element={<ABEffectEntry />}>
              <Route index element={<ABOverview />} />
              <Route path="double-slit" element={<ABDoubleSlit />} />
              <Route path="vector-potential" element={<ComingSoon title="Vector Potential" />} />
              <Route path="solenoid" element={<ComingSoon title="Solenoid Geometry" />} />
              <Route path="phase-shift" element={<ComingSoon title="Phase Shift" />} />
              <Route path="wavefunction" element={<ComingSoon title="Wavefunction Evolution" />} />
              <Route path="sandbox" element={<ABInterference />} />
            </Route>
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}