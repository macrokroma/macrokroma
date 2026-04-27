import { useABStore } from "../store/abStore";
import { useSimulation } from "@macrokroma/shared";
import { computeInterference } from "../compute/interference";

/**
 * ABInterference — the default view for the Aharonov-Bohm suite.
 *
 * Shows the double-slit interference pattern and lets the user sweep
 * the enclosed flux to watch the fringe pattern shift.
 *
 * This is a minimal scaffold. The 3D viewport, the Recharts plot,
 * and the parameter panels will be built out in subsequent sessions.
 */
export function ABInterference() {
  const { flux, wavelength, slitSeparation, screenDistance, setFlux } =
    useABStore();

  const { result } = useSimulation({
    compute: computeInterference,
    params: { flux, wavelength, slitSeparation, screenDistance },
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold mb-2">
          Aharonov–Bohm Interference
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Drag the flux slider to shift the interference fringes. The
          electrons never enter the solenoid, yet the enclosed magnetic flux
          changes the pattern — a purely quantum mechanical effect.
        </p>
      </div>

      {/* Parameter control — flux slider */}
      <div className="flex flex-col gap-2 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
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
      </div>

      {/* Intensity bar chart */}
      {result && (
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <p className="text-xs mb-2 font-mono text-[var(--color-text-secondary)]">
            Interference pattern — {result.count} points computed
          </p>
          <div className="flex items-end gap-px h-32">
            {Array.from({ length: 64 }).map((_, i) => {
              const idx = Math.floor((i / 64) * result.count);
              const intensity = Number(result.intensities[idx]) || 0;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${Math.max(intensity * 100, 1)}%`,
                    backgroundColor: "#6366f1",
                    opacity: 0.3 + intensity * 0.7,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}