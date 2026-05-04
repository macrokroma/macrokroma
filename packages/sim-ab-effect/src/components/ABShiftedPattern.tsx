import { useState, useRef, useEffect, useCallback } from "react";

/* ── Physics ──────────────────────────────────────── */

function sinc(x: number): number {
  if (Math.abs(x) < 1e-10) return 1;
  return Math.sin(x) / x;
}

/**
 * Compute intensity at screen position for given parameters.
 * Returns the full pattern (interference × diffraction) and the
 * diffraction envelope separately.
 */
function computePattern(
  numPoints: number,
  wavelength: number,
  slitSeparation: number,
  slitWidth: number,
  screenDistance: number,
  flux: number,
): { intensities: Float64Array; envelope: Float64Array } {
  const intensities = new Float64Array(numPoints);
  const envelope = new Float64Array(numPoints);

  const abPhase = 2 * Math.PI * flux;
  const k = (2 * Math.PI) / wavelength;
  const L = screenDistance * 1000;
  const screenHalfWidth = 5000;

  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * 2 - 1;
    const x = t * screenHalfWidth;
    const sinTheta = x / Math.sqrt(L * L + x * x);

    // Interference (cos²)
    const intArg = Math.PI * slitSeparation * sinTheta / wavelength + abPhase / 2;
    const intTerm = Math.cos(intArg) ** 2;

    // Diffraction (sinc²)
    const diffArg = Math.PI * slitWidth * sinTheta / wavelength;
    const diffTerm = sinc(diffArg) ** 2;

    intensities[i] = intTerm * diffTerm;
    envelope[i] = diffTerm;
  }

  // Normalize
  let max = 0;
  for (let i = 0; i < numPoints; i++) {
    if (intensities[i]! > max) max = intensities[i]!;
  }
  if (max > 0) {
    for (let i = 0; i < numPoints; i++) {
      intensities[i] = intensities[i]! / max;
    }
  }

  return { intensities, envelope };
}

/* ── Chart constants ──────────────────────────────── */

const MARGIN = { top: 10, right: 15, bottom: 32, left: 48 };
const FULL_W = 720;
const FULL_H = 300;
const PLOT_W = FULL_W - MARGIN.left - MARGIN.right;
const PLOT_H = FULL_H - MARGIN.top - MARGIN.bottom;
const NUM_POINTS = 512;

function ticks(min: number, max: number, count: number): number[] {
  const range = max - min;
  const rough = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / mag;
  const nice = residual > 5 ? 10 * mag : residual > 2 ? 5 * mag : residual > 1 ? 2 * mag : mag;
  const start = Math.ceil(min / nice) * nice;
  const result: number[] = [];
  for (let v = start; v <= max + nice * 0.01; v += nice) {
    result.push(parseFloat(v.toPrecision(6)));
  }
  return result;
}

/* ── Component ────────────────────────────────────── */

// Use the same default parameters as the double-slit section
const DEFAULT_WAVELENGTH = 2.0;
const DEFAULT_SLIT_SEP = 12;
const DEFAULT_SLIT_WIDTH = 4;
const DEFAULT_SCREEN_DIST = 1.5;

export function ABShiftedPattern() {
  const [flux, setFlux] = useState(0);
  const [showGhost, setShowGhost] = useState(true);
  const [showEnvelope, setShowEnvelope] = useState(false);

  // Compute both patterns
  const current = computePattern(
    NUM_POINTS,
    DEFAULT_WAVELENGTH,
    DEFAULT_SLIT_SEP,
    DEFAULT_SLIT_WIDTH,
    DEFAULT_SCREEN_DIST,
    flux,
  );
  const zeroFlux = computePattern(
    NUM_POINTS,
    DEFAULT_WAVELENGTH,
    DEFAULT_SLIT_SEP,
    DEFAULT_SLIT_WIDTH,
    DEFAULT_SCREEN_DIST,
    0,
  );

  const screenHalfWidth = 5000;
  const xMin = -screenHalfWidth;
  const xMax = screenHalfWidth;
  const xTicks = ticks(xMin, xMax, 6);
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const toSvgX = (v: number) => MARGIN.left + ((v - xMin) / (xMax - xMin)) * PLOT_W;
  const toSvgY = (v: number) => MARGIN.top + (1 - v) * PLOT_H;

  const toPolyline = (yData: Float64Array) => {
    return Array.from({ length: NUM_POINTS }, (_, i) => {
      const t = (i / (NUM_POINTS - 1)) * 2 - 1;
      const xVal = t * screenHalfWidth;
      return `${toSvgX(xVal)},${toSvgY(yData[i]!)}`;
    }).join(" ");
  };

  // Phase shift info
  const abPhase = 2 * Math.PI * flux;
  const fringeShift = flux; // in units of fringe spacings

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      {/* Toggles */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setShowGhost(!showGhost)}
          className={[
            "px-2.5 py-1 rounded text-xs transition-colors",
            showGhost
              ? "bg-[var(--color-accent)] text-white"
              : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
          ].join(" ")}
        >
          Zero-flux reference
        </button>
        <button
          onClick={() => setShowEnvelope(!showEnvelope)}
          className={[
            "px-2.5 py-1 rounded text-xs transition-colors",
            showEnvelope
              ? "bg-[#22c55e] text-white"
              : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
          ].join(" ")}
        >
          Diffraction envelope
        </button>
      </div>

      {/* Flux slider */}
      <div>
        <label className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>Enclosed flux (Φ/Φ₀)</span>
          <span className="font-mono text-[var(--color-accent)]">
            {flux.toFixed(2)}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={3}
          step={0.01}
          value={flux}
          onChange={(e) => setFlux(parseFloat(e.target.value))}
          className="w-full mt-1"
          style={{ accentColor: "var(--color-accent)" }}
        />
      </div>

      {/* Phase info */}
      <div className="flex gap-4 text-xs font-mono text-[var(--color-text-secondary)]">
        <span>
          Δφ = <span className="text-[var(--color-accent)]">{abPhase.toFixed(3)}</span> rad
        </span>
        <span>
          = <span className="text-[var(--color-accent)]">{fringeShift.toFixed(2)}</span> fringe spacings
        </span>
        {Math.abs(flux - Math.round(flux)) < 0.02 && flux > 0.01 && (
          <span className="text-[var(--color-warning)]">
            ← integer Φ/Φ₀: pattern resets!
          </span>
        )}
      </div>

      {/* Chart */}
      <div>
        <svg
          viewBox={`0 0 ${FULL_W} ${FULL_H}`}
          className="w-full"
          style={{ fontFamily: "var(--font-mono)", fontSize: "9px" }}
        >
          {/* Grid */}
          {xTicks.map((v) => (
            <line
              key={`xg-${v}`}
              x1={toSvgX(v)} y1={MARGIN.top}
              x2={toSvgX(v)} y2={MARGIN.top + PLOT_H}
              stroke="var(--color-border)" strokeWidth="0.5" opacity="0.4"
            />
          ))}
          {yTicks.map((v) => (
            <line
              key={`yg-${v}`}
              x1={MARGIN.left} y1={toSvgY(v)}
              x2={MARGIN.left + PLOT_W} y2={toSvgY(v)}
              stroke="var(--color-border)" strokeWidth="0.5" opacity="0.4"
            />
          ))}

          {/* Axis labels */}
          {xTicks.map((v) => (
            <text
              key={`xt-${v}`}
              x={toSvgX(v)} y={MARGIN.top + PLOT_H + 14}
              textAnchor="middle" fill="var(--color-text-secondary)"
            >
              {v}
            </text>
          ))}
          <text
            x={MARGIN.left + PLOT_W / 2} y={FULL_H - 2}
            textAnchor="middle" fill="var(--color-text-secondary)"
            style={{ fontSize: "10px" }}
          >
            Screen position (nm)
          </text>
          {yTicks.map((v) => (
            <text
              key={`yt-${v}`}
              x={MARGIN.left - 6} y={toSvgY(v) + 3}
              textAnchor="end" fill="var(--color-text-secondary)"
            >
              {v}
            </text>
          ))}
          <text
            x={0} y={0}
            textAnchor="middle" fill="var(--color-text-secondary)"
            style={{ fontSize: "10px" }}
            transform={`translate(12, ${MARGIN.top + PLOT_H / 2}) rotate(-90)`}
          >
            Intensity
          </text>

          {/* Plot border */}
          <rect
            x={MARGIN.left} y={MARGIN.top}
            width={PLOT_W} height={PLOT_H}
            fill="none" stroke="var(--color-border)" strokeWidth="0.5"
          />

          <defs>
            <clipPath id="ab-shift-clip">
              <rect x={MARGIN.left} y={MARGIN.top} width={PLOT_W} height={PLOT_H} />
            </clipPath>
          </defs>

          <g clipPath="url(#ab-shift-clip)">
            {/* Diffraction envelope */}
            {showEnvelope && (
              <polyline
                fill="none"
                stroke="#22c55e"
                strokeWidth="1.5"
                opacity="0.5"
                strokeDasharray="6 3"
                points={toPolyline(current.envelope)}
              />
            )}

            {/* Ghost: zero-flux pattern */}
            {showGhost && (
              <polyline
                fill="none"
                stroke="#e8e8ef"
                strokeWidth="1"
                opacity="0.2"
                points={toPolyline(zeroFlux.intensities)}
              />
            )}

            {/* Current pattern */}
            <polyline
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.5"
              points={toPolyline(current.intensities)}
            />
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-2">
          <span className="inline-block w-4 h-0.5 bg-[var(--color-accent)] rounded" />
          <span>Current pattern (Φ/Φ₀ = {flux.toFixed(2)})</span>
        </span>
        {showGhost && (
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 bg-[#e8e8ef] rounded opacity-20" />
            <span>Zero-flux reference (Φ = 0)</span>
          </span>
        )}
        {showEnvelope && (
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 bg-[#22c55e] rounded opacity-50" />
            <span>Diffraction envelope (does not shift)</span>
          </span>
        )}
      </div>
    </div>
  );
}