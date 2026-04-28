import { useState } from "react";
import { useABStore } from "../store/abStore";
import { useSimulation } from "@macrokroma/shared";
import { computeInterference } from "../compute/interference";
import DoubleSitTheory from "../content/double-slit.mdx";

type OverlayMode = "none" | "amplitudes" | "probabilities";

/**
 * ABDoubleSlit — Section 1: Double-slit interference from first principles.
 *
 * Theory (MDX + KaTeX) on top, interactive simulation below.
 */
export function ABDoubleSlit() {
  const {
    flux,
    wavelength,
    slitSeparation,
    screenDistance,
    setFlux,
    setWavelength,
    setSlitSeparation,
    setScreenDistance,
  } = useABStore();

  const [overlay, setOverlay] = useState<OverlayMode>("amplitudes");

  const { result } = useSimulation({
    compute: computeInterference,
    params: { flux, wavelength, slitSeparation, screenDistance },
  });

  return (
    <div className="flex flex-col gap-8 p-6 max-w-3xl mx-auto">
      {/* Theory section */}
      <div className="mdx-content">
        <DoubleSitTheory />
      </div>

      {/* Parameter controls */}
      <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
        <h3 className="text-sm font-medium mb-1">Parameters</h3>

        <label className="flex items-center justify-between text-sm">
          <span>Enclosed flux (Φ/Φ₀)</span>
          <span className="font-mono text-[var(--color-accent)]">
            {flux.toFixed(2)}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={flux}
          onChange={(e) => setFlux(parseFloat(e.target.value))}
          className="w-full"
          style={{ accentColor: "var(--color-accent)" }}
        />

        <label className="flex items-center justify-between text-sm">
          <span>Wavelength (nm)</span>
          <span className="font-mono text-[var(--color-accent)]">
            {wavelength.toFixed(2)}
          </span>
        </label>
        <input
          type="range"
          min={0.01}
          max={10}
          step={0.01}
          value={wavelength}
          onChange={(e) => setWavelength(parseFloat(e.target.value))}
          className="w-full"
          style={{ accentColor: "var(--color-accent)" }}
        />

        <label className="flex items-center justify-between text-sm">
          <span>Slit separation (nm)</span>
          <span className="font-mono text-[var(--color-accent)]">
            {slitSeparation.toFixed(0)}
          </span>
        </label>
        <input
          type="range"
          min={10}
          max={1000}
          step={1}
          value={slitSeparation}
          onChange={(e) => setSlitSeparation(parseFloat(e.target.value))}
          className="w-full"
          style={{ accentColor: "var(--color-accent)" }}
        />

        <label className="flex items-center justify-between text-sm">
          <span>Screen distance (μm)</span>
          <span className="font-mono text-[var(--color-accent)]">
            {screenDistance.toFixed(1)}
          </span>
        </label>
        <input
          type="range"
          min={1}
          max={100}
          step={0.5}
          value={screenDistance}
          onChange={(e) => setScreenDistance(parseFloat(e.target.value))}
          className="w-full"
          style={{ accentColor: "var(--color-accent)" }}
        />
      </div>

      {/* Overlay toggle */}
      <div className="flex gap-2">
        {(["none", "amplitudes", "probabilities"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setOverlay(mode)}
            className={[
              "px-3 py-1.5 rounded-md text-xs transition-colors",
              overlay === mode
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            {mode === "none" && "Combined only"}
            {mode === "amplitudes" && "Show Re(ψ₁), Re(ψ₂)"}
            {mode === "probabilities" && "Show |ψ₁|², |ψ₂|²"}
          </button>
        ))}
      </div>

      {/* Visualization */}
      {result && (
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <p className="text-xs mb-3 font-mono text-[var(--color-text-secondary)]">
            Interference pattern — {result.count} points
          </p>

          <svg
            viewBox="0 0 512 200"
            className="w-full"
            preserveAspectRatio="none"
          >
            {/* Individual wavefunction overlays */}
            {overlay === "amplitudes" && (
              <>
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1"
                  opacity="0.5"
                  points={Array.from({ length: result.count }, (_, i) => {
                    const x = i;
                    const y = 100 - result.re1[i]! * 80;
                    return `${x},${y}`;
                  }).join(" ")}
                />
                <polyline
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1"
                  opacity="0.5"
                  points={Array.from({ length: result.count }, (_, i) => {
                    const x = i;
                    const y = 100 - result.re2[i]! * 80;
                    return `${x},${y}`;
                  }).join(" ")}
                />
              </>
            )}

            {overlay === "probabilities" && (
              <>
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1"
                  opacity="0.4"
                  points={Array.from({ length: result.count }, (_, i) => {
                    const x = i;
                    const y = 200 - result.intensities1[i]! * 180;
                    return `${x},${y}`;
                  }).join(" ")}
                />
                <polyline
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1"
                  opacity="0.4"
                  points={Array.from({ length: result.count }, (_, i) => {
                    const x = i;
                    const y = 200 - result.intensities2[i]! * 180;
                    return `${x},${y}`;
                  }).join(" ")}
                />
              </>
            )}

            {/* Combined interference pattern — always shown */}
            <polyline
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.5"
              points={Array.from({ length: result.count }, (_, i) => {
                const x = i;
                const y = overlay === "amplitudes"
                  ? 100 - result.intensities[i]! * 80
                  : 200 - result.intensities[i]! * 180;
                return `${x},${y}`;
              }).join(" ")}
            />
          </svg>

          {/* Legend */}
          {overlay !== "none" && (
            <div className="flex gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 bg-[#f59e0b] rounded" />
                {overlay === "amplitudes" ? "Re(ψ₁)" : "|ψ₁|²"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 bg-[#22c55e] rounded" />
                {overlay === "amplitudes" ? "Re(ψ₂)" : "|ψ₂|²"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 bg-[var(--color-accent)] rounded" />
                |ψ₁ + ψ₂|²
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}