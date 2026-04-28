import { useState, useRef, useEffect, useCallback } from "react";

/* ── Field presets ────────────────────────────────── */

type FieldPreset = {
  label: string;
  description: string;
  fn: (x: number, y: number) => [number, number];
  divFn: (x: number, y: number) => number;
  curlFn: (x: number, y: number) => number;
};

/** Numerical divergence for any field function. */
function numericalDiv(
  fn: (x: number, y: number) => [number, number],
  x: number,
  y: number,
): number {
  const h = 0.005;
  const [fxp] = fn(x + h, y);
  const [fxm] = fn(x - h, y);
  const [, fyp] = fn(x, y + h);
  const [, fym] = fn(x, y - h);
  return (fxp - fxm) / (2 * h) + (fyp - fym) / (2 * h);
}

/** Numerical curl (z-component) for any field function. */
function numericalCurl(
  fn: (x: number, y: number) => [number, number],
  x: number,
  y: number,
): number {
  const h = 0.005;
  const [, fyxp] = fn(x + h, y);
  const [, fyxm] = fn(x - h, y);
  const [fxyp] = fn(x, y + h);
  const [fxym] = fn(x, y - h);
  return (fyxp - fyxm) / (2 * h) - (fxyp - fxym) / (2 * h);
}

const PRESETS: FieldPreset[] = [
  {
    label: "Radial source",
    description:
      "∇·F > 0 everywhere, ∇×F = 0. A pure source with no rotation. Field lines radiate outward from the origin.",
    fn: (x, y) => {
      const r = Math.sqrt(x * x + y * y + 0.01);
      return [x / r, y / r];
    },
    divFn(x, y) {
      return numericalDiv(this.fn, x, y);
    },
    curlFn: () => 0,
  },
  {
    label: "Vortex",
    description:
      "∇·F = 0 everywhere, ∇×F ≠ 0 near center. Pure rotation with no sources. Field lines circle the origin.",
    fn: (x, y) => {
      const r = Math.sqrt(x * x + y * y + 0.01);
      return [-y / r, x / r];
    },
    divFn: () => 0,
    curlFn(x, y) {
      return numericalCurl(this.fn, x, y);
    },
  },
  {
    label: "Uniform flow",
    description:
      "∇·F = 0, ∇×F = 0 everywhere. No sources, no rotation. The simplest possible vector field.",
    fn: () => [1, 0] as [number, number],
    divFn: () => 0,
    curlFn: () => 0,
  },
  {
    label: "Spiral outward",
    description:
      "Both ∇·F > 0 and ∇×F ≠ 0. The field spirals outward, combining source and rotation.",
    fn: (x, y) => {
      const r = Math.sqrt(x * x + y * y + 0.01);
      return [(x - y) / r, (y + x) / r];
    },
    divFn(x, y) {
      return numericalDiv(this.fn, x, y);
    },
    curlFn(x, y) {
      return numericalCurl(this.fn, x, y);
    },
  },
  {
    label: "Dipole",
    description:
      "A positive source and a negative sink side by side. ∇·F is positive near one, negative near the other.",
    fn: (x, y) => {
      const x1 = x - 0.7,
        x2 = x + 0.7;
      const r1 = Math.sqrt(x1 * x1 + y * y + 0.04);
      const r2 = Math.sqrt(x2 * x2 + y * y + 0.04);
      return [x1 / r1 - x2 / r2, y / r1 - y / r2];
    },
    divFn(x, y) {
      return numericalDiv(this.fn, x, y);
    },
    curlFn(x, y) {
      return numericalCurl(this.fn, x, y);
    },
  },
  {
    label: "Shear flow",
    description:
      "F = (y, 0). ∇·F = 0, ∇×F = −1 everywhere. Uniform curl with no divergence. Like cards sliding past each other.",
    fn: (_x, y) => [y * 0.5, 0] as [number, number],
    divFn: () => 0,
    curlFn: () => -0.5,
  },
];

/* ── Drawing helpers ──────────────────────────────── */

const CANVAS_SIZE = 420;
const GRID_COUNT = 16;
const FIELD_RANGE = 3; // -3 to 3 in field coordinates

function fieldToCanvas(fx: number, fy: number): [number, number] {
  const cx = ((fx + FIELD_RANGE) / (2 * FIELD_RANGE)) * CANVAS_SIZE;
  const cy = ((FIELD_RANGE - fy) / (2 * FIELD_RANGE)) * CANVAS_SIZE;
  return [cx, cy];
}

function canvasToField(cx: number, cy: number): [number, number] {
  const fx = (cx / CANVAS_SIZE) * 2 * FIELD_RANGE - FIELD_RANGE;
  const fy = FIELD_RANGE - (cy / CANVAS_SIZE) * 2 * FIELD_RANGE;
  return [fx, fy];
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vx: number,
  vy: number,
  color: string,
  alpha: number = 1,
) {
  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag < 0.001) return;

  const cellSize = CANVAS_SIZE / GRID_COUNT;
  const maxLen = cellSize * 0.42;
  const len = Math.min(mag * cellSize * 0.28, maxLen);
  const nx = vx / mag;
  const ny = vy / mag;

  const tipX = x + nx * len;
  const tipY = y - ny * len; // canvas y is flipped
  const baseX = x - nx * len * 0.15;
  const baseY = y + ny * len * 0.15;

  const headLen = len * 0.35;
  const headAngle = 0.4;
  const cosA = Math.cos(headAngle);
  const sinA = Math.sin(headAngle);
  const dnx = nx;
  const dny = -ny; // flipped for canvas

  const hx1 = tipX - headLen * (dnx * cosA - dny * sinA);
  const hy1 = tipY - headLen * (dny * cosA + dnx * sinA);
  const hx2 = tipX - headLen * (dnx * cosA + dny * sinA);
  const hy2 = tipY - headLen * (dny * cosA - dnx * sinA);

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(hx1, hy1);
  ctx.lineTo(hx2, hy2);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ── Overlay modes ────────────────────────────────── */

type OverlayMode = "none" | "divergence" | "curl";

/* ── Component ────────────────────────────────────── */

export function VectorFieldExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [presetIdx, setPresetIdx] = useState(0);
  const [overlay, setOverlay] = useState<OverlayMode>("none");
  const [probe, setProbe] = useState<[number, number] | null>(null);

  const preset = PRESETS[presetIdx]!;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw overlay (divergence or curl as background color)
    if (overlay !== "none") {
      const resolution = 60;
      const cellW = CANVAS_SIZE / resolution;
      for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
          const cx = (i + 0.5) * cellW;
          const cy = (j + 0.5) * cellW;
          const [fx, fy] = canvasToField(cx, cy);
          const val =
            overlay === "divergence"
              ? preset.divFn(fx, fy)
              : preset.curlFn(fx, fy);

          const clamped = Math.max(-2, Math.min(2, val));
          const norm = clamped / 2; // -1 to 1

          let r: number, g: number, b: number;
          if (norm > 0) {
            // Positive: accent indigo
            r = Math.round(99 * norm);
            g = Math.round(102 * norm);
            b = Math.round(241 * norm);
          } else {
            // Negative: warm orange/red
            r = Math.round(239 * -norm);
            g = Math.round(120 * -norm);
            b = Math.round(68 * -norm);
          }

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
          ctx.fillRect(i * cellW, j * cellW, cellW + 0.5, cellW + 0.5);
        }
      }
    }

    // Draw grid lines
    ctx.strokeStyle = "rgba(42, 42, 58, 0.3)";
    ctx.lineWidth = 0.5;
    const step = CANVAS_SIZE / GRID_COUNT;
    for (let i = 0; i <= GRID_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(CANVAS_SIZE, i * step);
      ctx.stroke();
    }

    // Draw axes
    const [ox, oy] = fieldToCanvas(0, 0);
    ctx.strokeStyle = "rgba(136, 136, 160, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, CANVAS_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(CANVAS_SIZE, oy);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(136, 136, 160, 0.5)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("x", CANVAS_SIZE - 10, oy - 6);
    ctx.fillText("y", ox + 10, 14);

    // Draw vector field arrows
    for (let i = 0; i < GRID_COUNT; i++) {
      for (let j = 0; j < GRID_COUNT; j++) {
        const cx = (i + 0.5) * step;
        const cy = (j + 0.5) * step;
        const [fx, fy] = canvasToField(cx, cy);
        const [vx, vy] = preset.fn(fx, fy);
        drawArrow(ctx, cx, cy, vx, vy, "#e8e8ef", 0.55);
      }
    }

    // Draw probe
    if (probe) {
      const [px, py] = probe;
      const [cx, cy] = fieldToCanvas(px, py);

      // Probe circle
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Field vector at probe (highlighted)
      const [vx, vy] = preset.fn(px, py);
      drawArrow(ctx, cx, cy, vx, vy, "#f59e0b", 1);
    }
  }, [preset, overlay, probe]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse interaction
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = CANVAS_SIZE / rect.width;
      const scaleY = CANVAS_SIZE / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;
      const [fx, fy] = canvasToField(cx, cy);
      setProbe([fx, fy]);
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setProbe(null);
  }, []);

  // Compute probe values
  const probeDiv = probe ? preset.divFn(probe[0], probe[1]) : 0;
  const probeCurl = probe ? preset.curlFn(probe[0], probe[1]) : 0;
  const probeField = probe
    ? preset.fn(probe[0], probe[1])
    : ([0, 0] as [number, number]);

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      {/* Preset selector */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => setPresetIdx(i)}
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

      {/* Description */}
      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
        {preset.description}
      </p>

      {/* Overlay toggle */}
      <div className="flex gap-1.5">
        {(["none", "divergence", "curl"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setOverlay(mode)}
            className={[
              "px-2.5 py-1 rounded text-xs transition-colors",
              overlay === mode
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            {mode === "none" && "Arrows only"}
            {mode === "divergence" && "Show ∇·F"}
            {mode === "curl" && "Show ∇×F"}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="w-full max-w-[420px] rounded cursor-crosshair"
          style={{ imageRendering: "auto" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Overlay legend */}
        {overlay !== "none" && (
          <div className="absolute bottom-2 right-2 flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-bg)] rounded px-2 py-1 border border-[var(--color-border)]">
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: "rgba(239, 120, 68, 0.6)" }}
              />
              Negative
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: "rgba(99, 102, 241, 0.6)" }}
              />
              Positive
            </span>
          </div>
        )}
      </div>

      {/* Probe readout */}
      {probe && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-[var(--color-text-secondary)]">
          <span>
            <span className="text-[var(--color-text-primary)]">F</span>(
            {probe[0].toFixed(1)}, {probe[1].toFixed(1)}) = (
            {probeField[0].toFixed(2)}, {probeField[1].toFixed(2)})
          </span>
          <span>
            <span className="text-[var(--color-accent)]">∇·F</span> ={" "}
            {probeDiv.toFixed(3)}
          </span>
          <span>
            <span className="text-[var(--color-warning)]">∇×F</span> ={" "}
            {probeCurl.toFixed(3)}
          </span>
        </div>
      )}

      {!probe && (
        <p className="text-[11px] text-[var(--color-text-secondary)] italic">
          Hover over the field to probe divergence and curl at any point.
        </p>
      )}
    </div>
  );
}