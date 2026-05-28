/**
 * ObserverView — Section showing the sky from a specific location on Earth.
 *
 * Theory: The horizon coordinate system (altitude/azimuth), how latitude
 * affects what you see, rising/setting times, the Moon's daily motion
 * across the sky.
 *
 * Sim: A hemispherical sky view showing the Moon and Sun positioned
 * at their computed alt/az, with the horizon, cardinal directions,
 * and the ecliptic marked. Latitude/longitude controls let you
 * see the sky from anywhere on Earth.
 */

import { useLunarStore } from "../store/lunarStore";

export function ObserverViewSection() {
  const { observerLat, observerLon, setObserverLat, setObserverLon } = useLunarStore();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Observer View</h2>
      <p className="text-[var(--color-text-secondary)] mb-6">
        What does the Moon look like from where you are? The Moon's
        appearance — its phase, its orientation in the sky, and whether
        it's even above the horizon — all depend on your location on
        Earth's surface and the current time. A crescent Moon in the
        northern hemisphere appears tilted differently than in the southern
        hemisphere, and moonrise/moonset times shift with latitude.
      </p>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 mb-6 space-y-3">
        <div className="flex items-center gap-4">
          <label className="text-sm">
            Latitude:
            <input
              type="range"
              min={-90}
              max={90}
              step={0.5}
              value={observerLat}
              onChange={(e) => setObserverLat(Number(e.target.value))}
              className="ml-2 w-40"
            />
            <span className="ml-2 text-xs font-mono w-16 inline-block">
              {observerLat.toFixed(1)}°{observerLat >= 0 ? "N" : "S"}
            </span>
          </label>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-sm">
            Longitude:
            <input
              type="range"
              min={-180}
              max={180}
              step={0.5}
              value={observerLon}
              onChange={(e) => setObserverLon(Number(e.target.value))}
              className="ml-2 w-40"
            />
            <span className="ml-2 text-xs font-mono w-16 inline-block">
              {Math.abs(observerLon).toFixed(1)}°{observerLon >= 0 ? "E" : "W"}
            </span>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-secondary)]">
        Hemispherical sky view coming soon
      </div>
    </div>
  );
}
