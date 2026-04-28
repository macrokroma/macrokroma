/**
 * ABOverview — landing page for the Aharonov-Bohm effect suite.
 *
 * Provides a high-level introduction and links into each section.
 */
export function ABOverview() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold mb-3">
          The Aharonov–Bohm Effect
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          In classical electromagnetism, charged particles respond only to
          electric and magnetic fields — the vector potential is considered a
          mathematical convenience with no physical meaning. The Aharonov–Bohm
          effect proves this wrong. Electrons passing through a region where
          the magnetic field is zero — but the vector potential is not — still
          acquire a measurable phase shift that alters their interference
          pattern.
        </p>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] mt-3">
          This suite builds the effect from first principles across five
          sections, each pairing theory with an interactive simulation.
        </p>
      </div>

      <div className="grid gap-3">
        {[
          {
            num: 1,
            title: "Double-Slit Interference",
            desc: "Wave superposition, path difference, and the baseline interference pattern.",
          },
          {
            num: 2,
            title: "The Vector Potential",
            desc: "How quantum mechanics couples to A, not just B. Gauge invariance and phase.",
          },
          {
            num: 3,
            title: "Solenoid Geometry",
            desc: "Confined B, circulating A, and the topology that makes the effect possible.",
          },
          {
            num: 4,
            title: "The AB Phase Shift",
            desc: "Putting it all together — flux shifts fringes, and the pattern quantizes.",
          },
          {
            num: 5,
            title: "Wavefunction Evolution",
            desc: "Time-dependent Schrödinger equation solved on the GPU in 3D.",
          },
        ].map(({ num, title, desc }) => (
          <div
            key={num}
            className="flex gap-4 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            <span className="text-2xl font-light text-[var(--color-accent)] tabular-nums">
              {num}
            </span>
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}