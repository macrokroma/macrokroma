/**
 * SolarEclipses — Section covering solar eclipse phenomena.
 *
 * Theory: Why eclipses don't happen every month (orbital inclination, nodes),
 * types of solar eclipses (total, annular, partial, hybrid), the coincidence
 * of apparent Sun/Moon sizes, eclipse cycles (Saros).
 *
 * Sim: Eclipse ground track visualization on a 2D Earth map,
 * shadow cone geometry in the 3D view, observer-specific eclipse
 * appearance (partial magnitude from different locations).
 */
export function SolarEclipses() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Solar Eclipses</h2>
      <p className="text-[var(--color-text-secondary)] mb-6">
        A solar eclipse occurs when the Moon passes between the Earth and Sun,
        casting a shadow on Earth's surface. The Moon's shadow cone is narrow —
        the path of totality is typically only 100–250 km wide — so a total
        solar eclipse is visible from only a small fraction of Earth's surface.
        Whether the eclipse is total or annular depends on the Moon's distance:
        at perigee the Moon appears larger than the Sun, at apogee it appears smaller.
      </p>
      <div className="rounded-lg border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-secondary)]">
        Eclipse ground track map + shadow cone visualization coming soon
      </div>
    </div>
  );
}
