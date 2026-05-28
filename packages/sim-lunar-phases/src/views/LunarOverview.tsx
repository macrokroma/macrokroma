import { useLunarStore } from "../store/lunarStore";
import { jdToDate } from "../compute/ephemeris/julianDate";
import { useEffect, useRef } from "react";

/**
 * LunarOverview — landing page for the Sun/Earth/Moon suite.
 *
 * Shows the current state of the ephemeris engine as a live dashboard:
 * the Moon's phase, position, illumination, and eclipse proximity.
 * This serves as both a proof-of-life for the computation engine
 * and a useful at-a-glance summary.
 */
export function LunarOverview() {
  const {
    jd, playing, playSpeed, snapshot, observerView,
    togglePlay, setPlaySpeed, goToNow, stepDays, tick,
  } = useLunarStore();

  // Animation loop
  const lastTimeRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) {
      lastTimeRef.current = null;
      return;
    }
    let rafId: number;
    const loop = (time: number) => {
      if (lastTimeRef.current !== null) {
        const delta = (time - lastTimeRef.current) / 1000;
        tick(delta);
      }
      lastTimeRef.current = time;
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [playing, tick]);

  const date = jdToDate(jd);
  const { phase, eclipseProximity, moon, sun } = snapshot;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">Sun / Earth / Moon Phenomena</h2>
        <p className="text-[var(--color-text-secondary)] text-sm">
          Astronomically accurate simulation of the Sun-Earth-Moon system, powered by
          Meeus ephemeris algorithms. Explore lunar phases, solar and lunar eclipses,
          and how they appear from any point on Earth.
        </p>
      </div>

      {/* Time controls */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Simulation Time</span>
          <span className="text-xs text-[var(--color-text-secondary)] font-mono">
            JD {jd.toFixed(4)}
          </span>
        </div>

        <div className="text-lg font-mono">
          {date.toUTCString()}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => stepDays(-29.53)}
            className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
          >
            −1 Month
          </button>
          <button
            onClick={() => stepDays(-1)}
            className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
          >
            −1 Day
          </button>
          <button
            onClick={() => stepDays(-1 / 24)}
            className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
          >
            −1 Hour
          </button>

          <button
            onClick={togglePlay}
            className="px-3 py-1 text-xs rounded font-medium bg-[var(--color-accent)] text-white hover:opacity-90"
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>

          <button
            onClick={() => stepDays(1 / 24)}
            className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
          >
            +1 Hour
          </button>
          <button
            onClick={() => stepDays(1)}
            className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
          >
            +1 Day
          </button>
          <button
            onClick={() => stepDays(29.53)}
            className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
          >
            +1 Month
          </button>

          <button
            onClick={goToNow}
            className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
          >
            Now
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-[var(--color-text-secondary)]">Speed:</label>
          {[0.1, 0.5, 1, 5, 15, 30].map((s) => (
            <button
              key={s}
              onClick={() => setPlaySpeed(s)}
              className={`px-2 py-0.5 text-xs rounded ${
                Math.abs(playSpeed - s) < 0.01
                  ? "bg-[var(--color-accent)] text-white"
                  : "border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {s < 1 ? `${s}` : s}d/s
            </button>
          ))}
        </div>
      </div>

      {/* Ephemeris dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Moon phase card */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="text-sm font-medium mb-3">Moon Phase</h3>
          <div className="text-3xl font-semibold mb-1">{phase.name}</div>
          <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
            <div>Illumination: {(phase.illuminatedFraction * 100).toFixed(1)}%</div>
            <div>Elongation: {phase.elongation.toFixed(1)}°</div>
            <div>Phase angle: {phase.phaseAngle.toFixed(1)}°</div>
            <div>Age: {phase.age.toFixed(1)} days</div>
            <div>{phase.isWaxing ? "Waxing" : "Waning"}</div>
          </div>
        </div>

        {/* Moon position card */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="text-sm font-medium mb-3">Moon Position</h3>
          <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
            <div>Ecliptic λ: {moon.position.longitude.toFixed(3)}°</div>
            <div>Ecliptic β: {moon.position.latitude.toFixed(3)}°</div>
            <div>Distance: {moon.position.distanceKm.toFixed(0)} km</div>
            <div>Angular diameter: {(moon.position.angularDiameter * 60).toFixed(1)}′</div>
            <div>RA: {moon.equatorial.rightAscension.toFixed(3)}°</div>
            <div>Dec: {moon.equatorial.declination.toFixed(3)}°</div>
          </div>
        </div>

        {/* Sun position card */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="text-sm font-medium mb-3">Sun Position</h3>
          <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
            <div>Ecliptic λ: {sun.position.apparentLongitude.toFixed(3)}°</div>
            <div>Distance: {sun.position.distanceAU.toFixed(6)} AU</div>
            <div>Angular diameter: {(sun.position.angularDiameter * 60).toFixed(1)}′</div>
            <div>RA: {sun.equatorial.rightAscension.toFixed(3)}°</div>
            <div>Dec: {sun.equatorial.declination.toFixed(3)}°</div>
          </div>
        </div>

        {/* Eclipse proximity card */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="text-sm font-medium mb-3">Eclipse Proximity</h3>
          <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
            <div>Moon ecliptic latitude: {eclipseProximity.lunarLatitude.toFixed(3)}°</div>
            <div>Solar separation: {eclipseProximity.solarSeparation.toFixed(2)}°</div>
            <div className={eclipseProximity.nearSolarEclipse ? "text-[var(--color-accent)] font-medium" : ""}>
              Solar eclipse: {eclipseProximity.nearSolarEclipse ? "⚠ NEAR" : "No"}
            </div>
            <div className={eclipseProximity.nearLunarEclipse ? "text-[var(--color-accent)] font-medium" : ""}>
              Lunar eclipse: {eclipseProximity.nearLunarEclipse ? "⚠ NEAR" : "No"}
            </div>
          </div>
        </div>

        {/* Observer view card */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:col-span-2">
          <h3 className="text-sm font-medium mb-3">
            Observer View ({useLunarStore.getState().observerLat.toFixed(2)}°N, {Math.abs(useLunarStore.getState().observerLon).toFixed(2)}°W)
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm text-[var(--color-text-secondary)]">
            <div>
              <div className="font-medium text-[var(--color-text-primary)] mb-1">Moon</div>
              <div>Altitude: {observerView.moonHorizontal.altitude.toFixed(1)}°</div>
              <div>Azimuth: {observerView.moonHorizontal.azimuth.toFixed(1)}°</div>
              <div>{observerView.moonVisible ? "Above horizon ✓" : "Below horizon"}</div>
            </div>
            <div>
              <div className="font-medium text-[var(--color-text-primary)] mb-1">Sun</div>
              <div>Altitude: {observerView.sunHorizontal.altitude.toFixed(1)}°</div>
              <div>Azimuth: {observerView.sunHorizontal.azimuth.toFixed(1)}°</div>
              <div>{observerView.isDaytime ? "Daytime ☀" : "Nighttime ☾"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
