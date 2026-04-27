import { Routes, Route } from "react-router";
import { ABInterference } from "./views/ABInterference";

/**
 * ABEffectEntry — top-level component for the Aharonov-Bohm effect suite.
 *
 * The site shell renders this at /ab-effect/*. This component owns the
 * suite's internal routing:
 *
 *   /ab-effect/            → Interference pattern (default view)
 *   /ab-effect/waves       → Wave propagation (future)
 *   /ab-effect/fields      → Field topology (future)
 *   /ab-effect/paths       → Path integrals (future)
 *   /ab-effect/theory      → Theory / explanation (future)
 */
export function ABEffectEntry() {
  return (
    <Routes>
      <Route index element={<ABInterference />} />
      {/* Future routes:
        <Route path="waves" element={<ABWavePropagation />} />
        <Route path="fields" element={<ABFieldTopology />} />
        <Route path="paths" element={<ABPathIntegrals />} />
        <Route path="theory" element={<ABTheory />} />
      */}
    </Routes>
  );
}
