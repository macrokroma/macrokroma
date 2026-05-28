/**
 * LunarPhases — Section covering Moon phases.
 *
 * Theory: Why phases happen (illumination geometry), the synodic month,
 * waxing vs waning, the eight named phases.
 *
 * Sim: 3D orbital view showing the Sun-Earth-Moon geometry with the
 * illuminated hemisphere visible. Observer view showing what the
 * phase looks like from Earth at different latitudes.
 *
 * This is a placeholder — the 3D viewport and interactive content
 * will be built in subsequent sessions.
 */
export function LunarPhases() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Lunar Phases</h2>
      <p className="text-[var(--color-text-secondary)] mb-6">
        The Moon doesn't produce its own light — it reflects sunlight.
        As the Moon orbits Earth, the fraction of the illuminated hemisphere
        that faces us changes, producing the familiar cycle of phases from
        new moon through full moon and back again every 29.5 days.
      </p>
      <div className="rounded-lg border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-secondary)]">
        3D orbital view + observer phase view coming soon
      </div>
    </div>
  );
}
