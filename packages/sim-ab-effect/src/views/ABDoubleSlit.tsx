import { useState, useRef, useEffect } from "react";
import { useABStore } from "../store/abStore";
import { useSimulation } from "@macrokroma/shared";
import { computeInterference } from "../compute/interference";
import DoubleSitTheory from "../content/double-slit.mdx";

/**
 * EditableValue — click the number to type a custom value.
 */
function EditableValue({
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-20 text-right font-mono text-sm bg-[var(--color-bg)] text-[var(--color-accent)] border border-[var(--color-accent)] rounded px-1 py-0.5 outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(format(value));
        setEditing(true);
      }}
      className="font-mono text-[var(--color-accent)] hover:underline cursor-text"
      title="Click to edit"
    >
      {format(value)}
    </button>
  );
}

/* ── Chart layout constants ─────────────────────────── */
const MARGIN = { top: 10, right: 15, bottom: 32, left: 48 };
const FULL_W = 720;
const FULL_H = 280;
const PLOT_W = FULL_W - MARGIN.left - MARGIN.right;
const PLOT_H = FULL_H - MARGIN.top - MARGIN.bottom;

/** Generate nice round tick values between min and max. */
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

export function ABDoubleSlit() {
  const {
    flux,
    wavelength,
    slitSeparation,
    slitWidth,
    screenDistance,
    setFlux,
    setWavelength,
    setSlitSeparation,
    setSlitWidth,
    setScreenDistance,
  } = useABStore();

  const [showComponents, setShowComponents] = useState(false);

  const { result } = useSimulation({
    compute: computeInterference,
    params: { flux, wavelength, slitSeparation, slitWidth, screenDistance },
  });

  const screenHalfWidth = 5000;
  const xMin = -screenHalfWidth;
  const xMax = screenHalfWidth;
  const xTicks = ticks(xMin, xMax, 6);
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const toSvgX = (v: number) => MARGIN.left + ((v - xMin) / (xMax - xMin)) * PLOT_W;
  const toSvgY = (v: number) => MARGIN.top + (1 - v) * PLOT_H;

  const toPolyline = (yData: Float64Array) => {
    if (!result) return "";
    const n = result.count;
    return Array.from({ length: n }, (_, i) => {
      const t = (i / (n - 1)) * 2 - 1;
      const xVal = t * screenHalfWidth;
      return `${toSvgX(xVal)},${toSvgY(yData[i]!)}`;
    }).join(" ");
  };

  return (
    <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto">
      <div className="mdx-content">
        <DoubleSitTheory />
      </div>

      {/* Parameter controls */}
      <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
        <h3 className="text-sm font-medium mb-1">Parameters</h3>

        {[
          { label: "Enclosed flux (Φ/Φ₀)", value: flux, onChange: setFlux, min: 0, max: 2, step: 0.01, format: (v: number) => v.toFixed(2) },
          { label: "Wavelength (nm)", value: wavelength, onChange: setWavelength, min: 0.1, max: 10, step: 0.01, format: (v: number) => v.toFixed(2) },
          { label: "Slit separation (nm)", value: slitSeparation, onChange: setSlitSeparation, min: 1, max: 1000, step: 0.1, format: (v: number) => v.toFixed(1) },
          { label: "Slit width (nm)", value: slitWidth, onChange: setSlitWidth, min: 0.1, max: 200, step: 0.1, format: (v: number) => v.toFixed(1) },
          { label: "Screen distance (μm)", value: screenDistance, onChange: setScreenDistance, min: 0.1, max: 100, step: 0.1, format: (v: number) => v.toFixed(1) },
        ].map(({ label, value, onChange, min, max, step, format }) => (
          <div key={label}>
            <label className="flex items-center justify-between text-sm">
              <span>{label}</span>
              <EditableValue value={value} onChange={onChange} min={min} max={max} step={step} format={format} />
            </label>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              className="w-full mt-1"
              style={{ accentColor: "var(--color-accent)" }}
            />
          </div>
        ))}
      </div>

      {/* Overlay toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowComponents(false)}
          className={[
            "px-3 py-1.5 rounded-md text-xs transition-colors",
            !showComponents
              ? "bg-[var(--color-accent)] text-white"
              : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
          ].join(" ")}
        >
          Observed pattern
        </button>
        <button
          onClick={() => setShowComponents(true)}
          className={[
            "px-3 py-1.5 rounded-md text-xs transition-colors",
            showComponents
              ? "bg-[var(--color-accent)] text-white"
              : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
          ].join(" ")}
        >
          Show components
        </button>
      </div>

      {/* Chart */}
      {result && (
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <svg
            viewBox={`0 0 ${FULL_W} ${FULL_H}`}
            className="w-full"
            style={{ fontFamily: "var(--font-mono)", fontSize: "9px" }}
          >
            {xTicks.map((v) => (
              <line key={`xg-${v}`} x1={toSvgX(v)} y1={MARGIN.top} x2={toSvgX(v)} y2={MARGIN.top + PLOT_H} stroke="var(--color-border)" strokeWidth="0.5" opacity="0.4" />
            ))}
            {yTicks.map((v) => (
              <line key={`yg-${v}`} x1={MARGIN.left} y1={toSvgY(v)} x2={MARGIN.left + PLOT_W} y2={toSvgY(v)} stroke="var(--color-border)" strokeWidth="0.5" opacity="0.4" />
            ))}
            {xTicks.map((v) => (
              <text key={`xt-${v}`} x={toSvgX(v)} y={MARGIN.top + PLOT_H + 14} textAnchor="middle" fill="var(--color-text-secondary)">{v}</text>
            ))}
            <text x={MARGIN.left + PLOT_W / 2} y={FULL_H - 2} textAnchor="middle" fill="var(--color-text-secondary)" style={{ fontSize: "10px" }}>Screen position (nm)</text>
            {yTicks.map((v) => (
              <text key={`yt-${v}`} x={MARGIN.left - 6} y={toSvgY(v) + 3} textAnchor="end" fill="var(--color-text-secondary)">{v}</text>
            ))}
            <text x={0} y={0} textAnchor="middle" fill="var(--color-text-secondary)" style={{ fontSize: "10px" }} transform={`translate(12, ${MARGIN.top + PLOT_H / 2}) rotate(-90)`}>Intensity</text>
            <rect x={MARGIN.left} y={MARGIN.top} width={PLOT_W} height={PLOT_H} fill="none" stroke="var(--color-border)" strokeWidth="0.5" />
            <defs>
              <clipPath id="plot-clip">
                <rect x={MARGIN.left} y={MARGIN.top} width={PLOT_W} height={PLOT_H} />
              </clipPath>
            </defs>
            <g clipPath="url(#plot-clip)">
              {showComponents && (
                <>
                  <polyline fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.5" points={toPolyline(result.interferenceOnly)} />
                  <polyline fill="none" stroke="#22c55e" strokeWidth="1.5" opacity="0.6" strokeDasharray="6 3" points={toPolyline(result.diffractionOnly)} />
                </>
              )}
              <polyline fill="none" stroke="var(--color-accent)" strokeWidth="1.5" points={toPolyline(result.intensities)} />
            </g>
          </svg>

          {showComponents && (
            <div className="flex flex-col gap-1.5 mt-3 text-xs text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-0.5 rounded bg-[#f59e0b] opacity-50" />
                <span>Interference (cos²): fringes from two point sources, no slit width</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-0.5 rounded bg-[#22c55e] opacity-60" />
                <span>Diffraction (sinc²): envelope from one slit's finite width</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-0.5 bg-[var(--color-accent)] rounded" />
                <span>Observed pattern: the product of interference × diffraction</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}