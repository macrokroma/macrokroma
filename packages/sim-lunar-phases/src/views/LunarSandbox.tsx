/**
 * LunarSandbox — all parameters, no theory, just play.
 *
 * The sandbox gives full access to every control: time, display settings,
 * observer location, camera presets, and all overlays. It's the place
 * for free exploration after the guided sections.
 *
 * This will eventually contain the full 3D viewport with all overlays
 * togglable, plus the observer view as a split panel.
 */
export function LunarSandbox() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Sandbox</h2>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Full interactive simulation with all controls. Explore the
        Sun-Earth-Moon system freely — adjust time, change your
        viewpoint, toggle orbital elements, and search for eclipses.
      </p>
      <div className="rounded-lg border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-secondary)]">
        Full 3D simulation sandbox coming soon
      </div>
    </div>
  );
}
