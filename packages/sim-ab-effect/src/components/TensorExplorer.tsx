import { useState, useCallback } from "react";

/* ── Physics ──────────────────────────────────────── */

/**
 * Lorentz boost of F^μν along the x-axis.
 *
 * The field strength tensor transforms as:
 *   F'^μν = Λ^μ_α Λ^ν_β F^αβ
 *
 * For a boost along x with velocity β:
 *   E'_x = E_x           B'_x = B_x
 *   E'_y = γ(E_y - βB_z) B'_y = γ(B_y + βE_z)
 *   E'_z = γ(E_z + βB_y) B'_z = γ(B_z - βE_y)
 */
function boostFields(
  Ex: number, Ey: number, Ez: number,
  Bx: number, By: number, Bz: number,
  beta: number,
): { Ex: number; Ey: number; Ez: number; Bx: number; By: number; Bz: number } {
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  return {
    Ex,
    Ey: gamma * (Ey - beta * Bz),
    Ez: gamma * (Ez + beta * By),
    Bx,
    By: gamma * (By + beta * Ez),
    Bz: gamma * (Bz - beta * Ey),
  };
}

/**
 * Build the 4x4 F^μν matrix from E and B components.
 */
function buildTensor(
  Ex: number, Ey: number, Ez: number,
  Bx: number, By: number, Bz: number,
): number[][] {
  return [
    [0, Ex, Ey, Ez],
    [-Ex, 0, Bz, -By],
    [-Ey, -Bz, 0, Bx],
    [-Ez, By, -Bx, 0],
  ];
}

/**
 * Lorentz invariants.
 */
function invariants(
  Ex: number, Ey: number, Ez: number,
  Bx: number, By: number, Bz: number,
): { EdotB: number; E2minusB2: number } {
  return {
    EdotB: Ex * Bx + Ey * By + Ez * Bz,
    E2minusB2: (Ex * Ex + Ey * Ey + Ez * Ez) - (Bx * Bx + By * By + Bz * Bz),
  };
}

/* ── Presets ──────────────────────────────────────── */

type FieldPreset = {
  label: string;
  description: string;
  Ex: number; Ey: number; Ez: number;
  Bx: number; By: number; Bz: number;
};

const PRESETS: FieldPreset[] = [
  {
    label: "E ⊥ boost",
    description: "Electric field perpendicular to the boost direction (E in y, boost in x). Boosting creates a B_z component. The most instructive case.",
    Ex: 0, Ey: 1, Ez: 0, Bx: 0, By: 0, Bz: 0,
  },
  {
    label: "E ∥ boost",
    description: "Electric field parallel to the boost direction (E in x, boost in x). Parallel components are unchanged by boosts. Nothing happens.",
    Ex: 1, Ey: 0, Ez: 0, Bx: 0, By: 0, Bz: 0,
  },
  {
    label: "Uniform B",
    description: "Pure magnetic field in the z-direction. Boosting along x creates an E_y component. The reverse of the first preset.",
    Ex: 0, Ey: 0, Ez: 0, Bx: 0, By: 0, Bz: 1,
  },
  {
    label: "EM wave",
    description: "E in y, B in z, equal magnitudes. A plane wave propagating in x. Both invariants vanish: E·B = 0 and E² = B². This holds in every frame.",
    Ex: 0, Ey: 1, Ez: 0, Bx: 0, By: 0, Bz: 1,
  },
  {
    label: "Crossed fields",
    description: "E in y, B in z, unequal magnitudes. E·B = 0 but E² ≠ B². There exists a frame where one field vanishes entirely.",
    Ex: 0, Ey: 0.5, Ez: 0, Bx: 0, By: 0, Bz: 1,
  },
  {
    label: "Parallel E and B",
    description: "E and B both in the z-direction. E·B ≠ 0, so no boost can eliminate either field. Both invariants are nonzero.",
    Ex: 0, Ey: 0, Ez: 1, Bx: 0, By: 0, Bz: 0.5,
  },
  {
    label: "General",
    description: "All components nonzero. Use the sliders to set any configuration you like.",
    Ex: 0.5, Ey: 0.3, Ez: -0.2, Bx: 0.1, By: -0.4, Bz: 0.7,
  },
];

/* ── Tensor cell coloring ─────────────────────────── */

function cellColor(value: number, type: "E" | "B" | "zero"): string {
  if (type === "zero") return "transparent";
  const intensity = Math.min(Math.abs(value) * 0.6, 1);
  if (type === "E") {
    return `rgba(239, 68, 68, ${intensity * 0.25})`;
  }
  return `rgba(34, 197, 94, ${intensity * 0.25})`;
}

function cellType(row: number, col: number): "E" | "B" | "zero" {
  if (row === col) return "zero";
  // Top row / left column = E components
  if (row === 0 || col === 0) return "E";
  // Spatial block = B components
  return "B";
}

/* ── Component ────────────────────────────────────── */

export function TensorExplorer() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [Ex, setEx] = useState(PRESETS[0]!.Ex);
  const [Ey, setEy] = useState(PRESETS[0]!.Ey);
  const [Ez, setEz] = useState(PRESETS[0]!.Ez);
  const [Bx, setBx] = useState(PRESETS[0]!.Bx);
  const [By, setBy] = useState(PRESETS[0]!.By);
  const [Bz, setBz] = useState(PRESETS[0]!.Bz);
  const [beta, setBeta] = useState(0);

  const applyPreset = useCallback((idx: number) => {
    const p = PRESETS[idx]!;
    setPresetIdx(idx);
    setEx(p.Ex); setEy(p.Ey); setEz(p.Ez);
    setBx(p.Bx); setBy(p.By); setBz(p.Bz);
    setBeta(0);
  }, []);

  // Compute boosted fields
  const boosted = boostFields(Ex, Ey, Ez, Bx, By, Bz, beta);

  // Build tensors
  const tensorRest = buildTensor(Ex, Ey, Ez, Bx, By, Bz);
  const tensorBoosted = buildTensor(
    boosted.Ex, boosted.Ey, boosted.Ez,
    boosted.Bx, boosted.By, boosted.Bz,
  );

  // Invariants (should be identical)
  const invRest = invariants(Ex, Ey, Ez, Bx, By, Bz);
  const invBoosted = invariants(
    boosted.Ex, boosted.Ey, boosted.Ez,
    boosted.Bx, boosted.By, boosted.Bz,
  );

  const gamma = 1 / Math.sqrt(1 - beta * beta);

  const indexLabels = ["0 (t)", "1 (x)", "2 (y)", "3 (z)"];

  const renderTensor = (tensor: number[][], label: string) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-mono text-[var(--color-text-secondary)]">{label}</span>
      <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-0">
        {/* Column headers */}
        <div className="w-12" />
        {indexLabels.map((l, i) => (
          <div
            key={`ch-${i}`}
            className="text-center text-[10px] font-mono py-1"
            style={{ color: "var(--color-text-secondary)" }}
          >
            ν={i}
          </div>
        ))}

        {/* Rows */}
        {tensor.map((row, i) => (
          <>
            {/* Row header */}
            <div
              key={`rh-${i}`}
              className="flex items-center justify-end pr-2 text-[10px] font-mono"
              style={{ color: "var(--color-text-secondary)" }}
            >
              μ={i}
            </div>

            {/* Cells */}
            {row.map((val, j) => {
              const type = cellType(i, j);
              const isZero = i === j;
              return (
                <div
                  key={`${i}-${j}`}
                  className="flex items-center justify-center text-xs font-mono py-1.5 border border-[var(--color-border)]"
                  style={{
                    backgroundColor: cellColor(val, type),
                    color: isZero
                      ? "var(--color-text-secondary)"
                      : type === "E"
                        ? "#ef4444"
                        : "#22c55e",
                    minWidth: "56px",
                  }}
                >
                  {isZero ? "0" : val >= 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => applyPreset(i)}
            className={[
              "px-2.5 py-1 rounded text-xs transition-colors",
              presetIdx === i
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
        {PRESETS[presetIdx]!.description}
      </p>

      {/* Field component sliders */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {[
          { label: "E_x", value: Ex, set: setEx, color: "#ef4444" },
          { label: "B_x", value: Bx, set: setBx, color: "#22c55e" },
          { label: "E_y", value: Ey, set: setEy, color: "#ef4444" },
          { label: "B_y", value: By, set: setBy, color: "#22c55e" },
          { label: "E_z", value: Ez, set: setEz, color: "#ef4444" },
          { label: "B_z", value: Bz, set: setBz, color: "#22c55e" },
        ].map(({ label, value, set, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs font-mono w-6" style={{ color }}>{label}</span>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.01}
              value={value}
              onChange={(e) => set(parseFloat(e.target.value))}
              className="flex-1"
              style={{ accentColor: color }}
            />
            <span className="text-xs font-mono w-12 text-right" style={{ color }}>
              {value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Boost slider */}
      <div>
        <label className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>Lorentz boost along x (β = v/c)</span>
          <span className="font-mono text-[var(--color-accent)]">
            β = {beta.toFixed(2)}
            <span className="text-[var(--color-text-secondary)] ml-2">
              (γ = {gamma.toFixed(2)})
            </span>
          </span>
        </label>
        <input
          type="range"
          min={-0.95}
          max={0.95}
          step={0.01}
          value={beta}
          onChange={(e) => setBeta(parseFloat(e.target.value))}
          className="w-full mt-1"
          style={{ accentColor: "var(--color-accent)" }}
        />
      </div>

      {/* Tensor matrices side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderTensor(tensorRest, "F^μν (rest frame S)")}
        {renderTensor(tensorBoosted, "F'^μν (boosted frame S')")}
      </div>

      {/* Component comparison */}
      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
        <div className="flex flex-col gap-0.5">
          <span className="text-[var(--color-text-secondary)] mb-1">Rest frame S</span>
          <span><span className="text-[#ef4444]">E</span> = ({Ex.toFixed(2)}, {Ey.toFixed(2)}, {Ez.toFixed(2)})</span>
          <span><span className="text-[#22c55e]">B</span> = ({Bx.toFixed(2)}, {By.toFixed(2)}, {Bz.toFixed(2)})</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[var(--color-text-secondary)] mb-1">Boosted frame S'</span>
          <span><span className="text-[#ef4444]">E'</span> = ({boosted.Ex.toFixed(2)}, {boosted.Ey.toFixed(2)}, {boosted.Ez.toFixed(2)})</span>
          <span><span className="text-[#22c55e]">B'</span> = ({boosted.Bx.toFixed(2)}, {boosted.By.toFixed(2)}, {boosted.Bz.toFixed(2)})</span>
        </div>
      </div>

      {/* Lorentz invariants */}
      <div className="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
        <span className="text-xs font-medium text-[var(--color-text-primary)]">Lorentz Invariants</span>
        <div className="grid grid-cols-2 gap-4 mt-2 text-xs font-mono">
          <div className="flex flex-col gap-1">
            <span className="text-[var(--color-text-secondary)]">
              E·B = {invRest.EdotB.toFixed(4)}
            </span>
            <span className="text-[var(--color-text-secondary)]">
              E²−B² = {invRest.E2minusB2.toFixed(4)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[var(--color-text-secondary)]">
              E'·B' = {invBoosted.EdotB.toFixed(4)}
            </span>
            <span className="text-[var(--color-text-secondary)]">
              E'²−B'² = {invBoosted.E2minusB2.toFixed(4)}
            </span>
          </div>
        </div>
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-2 italic">
          These quantities are the same in every inertial frame. E and B change, but E·B and E²−B² do not.
        </p>
      </div>
    </div>
  );
}