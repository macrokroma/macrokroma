import { BrowserRouter, Routes, Route, Link } from "react-router";
import {
  ABEffectEntry,
  ABOverview,
  ABDoubleSlit,
  ABVectorPotential,
  ABSolenoid,
  ABPhaseShift,
  ABWavefunction,
  ABSandbox,
} from "@macrokroma/sim-ab-effect";
import {
  LunarEntry,
  LunarOverview,
  LunarPhases,
  SolarEclipses,
  LunarEclipses,
  ObserverViewSection,
  LunarSandbox,
} from "@macrokroma/sim-lunar-phases";
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
          <Link
            to="/sun-earth-moon"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Sun / Earth / Moon
          </Link>
        </nav>

        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<Landing />} />

            {/* Aharonov-Bohm effect suite */}
            <Route path="/ab-effect" element={<ABEffectEntry />}>
              <Route index element={<ABOverview />} />
              <Route path="double-slit" element={<ABDoubleSlit />} />
              <Route path="vector-potential" element={<ABVectorPotential />} />
              <Route path="solenoid" element={<ABSolenoid />} />
              <Route path="phase-shift" element={<ABPhaseShift />} />
              <Route path="wavefunction" element={<ABWavefunction />} />
              <Route path="sandbox" element={<ABSandbox />} />
            </Route>

            {/* Sun / Earth / Moon suite */}
            <Route path="/sun-earth-moon" element={<LunarEntry />}>
              <Route index element={<LunarOverview />} />
              <Route path="lunar-phases" element={<LunarPhases />} />
              <Route path="solar-eclipses" element={<SolarEclipses />} />
              <Route path="lunar-eclipses" element={<LunarEclipses />} />
              <Route path="observer" element={<ObserverViewSection />} />
              <Route path="sandbox" element={<LunarSandbox />} />
            </Route>
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}