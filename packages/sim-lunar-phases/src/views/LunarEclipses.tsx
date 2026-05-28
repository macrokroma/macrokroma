/**
 * LunarEclipses — Section covering lunar eclipse phenomena.
 *
 * Theory: Earth's shadow (umbra + penumbra), why lunar eclipses are
 * visible from an entire hemisphere, the red color of totality
 * (Rayleigh scattering through Earth's atmosphere), Danjon scale.
 *
 * Sim: 3D visualization of Earth's shadow cone with the Moon passing
 * through it, showing umbral/penumbral boundaries and the characteristic
 * coppery-red coloring during totality.
 */
export function LunarEclipses() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Lunar Eclipses</h2>
      <p className="text-[var(--color-text-secondary)] mb-6">
        A lunar eclipse occurs when the Moon passes through Earth's shadow.
        Unlike solar eclipses, a lunar eclipse is visible from anywhere on
        Earth's night side — roughly half the planet. During totality, the
        Moon doesn't disappear entirely but turns a deep copper-red as
        Earth's atmosphere refracts sunlight into the shadow cone.
      </p>
      <div className="rounded-lg border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-secondary)]">
        Shadow cone visualization + Danjon coloring coming soon
      </div>
    </div>
  );
}
