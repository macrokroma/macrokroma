import { useLunarStore } from "../store/lunarStore";
import { jdToDate } from "../compute/ephemeris/julianDate";
import { useEffect, useRef, useState } from "react";
import { OrbitalViewport } from "../components/OrbitalViewport";

/**
 * LunarOverview — landing page for the Sun/Earth/Moon suite.
 *
 * Animation loop is throttled to ~20fps to keep the UI responsive
 * for toolbar toggles and button clicks during playback. The 3D scene
 * reads positions from the store via refs, so it stays smooth.
 */
export function LunarOverview() {
  // Dashboard display values — updated at throttled rate
  const [displayJD, setDisplayJD] = useState(useLunarStore.getState().jd);

  const playing = useLunarStore((s) => s.playing);
  const playSpeed = useLunarStore((s) => s.playSpeed);
  const togglePlay = useLunarStore((s) => s.togglePlay);
  const setPlaySpeed = useLunarStore((s) => s.setPlaySpeed);
  const goToNow = useLunarStore((s) => s.goToNow);
  const stepDays = useLunarStore((s) => s.stepDays);
  const tick = useLunarStore((s) => s.tick);

  // Throttled animation loop (~20fps for store updates)
  useEffect(() => {
    if (!playing) return;

    const TICK_INTERVAL = 50; // ms (~20fps)
    const interval = setInterval(() => {
      tick(TICK_INTERVAL / 1000);
      setDisplayJD(useLunarStore.getState().jd);
    }, TICK_INTERVAL);

    return () => clearInterval(interval);
  }, [playing, tick]);

  // Sync display when not playing (manual steps, goToNow, etc.)
  useEffect(() => {
    if (playing) return;
    const unsub = useLunarStore.subscribe((s) => setDisplayJD(s.jd));
    return unsub;
  }, [playing]);

  // Read snapshot from the store for dashboard display
  const snapshot = useLunarStore((s) => s.snapshot);
  const observerView = useLunarStore((s) => s.observerView);
  const observerLat = useLunarStore((s) => s.observerLat);
  const observerLon = useLunarStore((s) => s.observerLon);

  const date = jdToDate(displayJD);
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

      {/* 3D Orbital Viewport */}
      <OrbitalViewport className="h-[500px]" />

      {/* Time controls */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Simulation Time</span>
          <span className="text-xs text-[var(--color-text-secondary)] font-mono">
            JD {displayJD.toFixed(4)}
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

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:col-span-2">
          <h3 className="text-sm font-medium mb-3">
            Observer View ({observerLat.toFixed(2)}°N, {Math.abs(observerLon).toFixed(2)}°W)
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
