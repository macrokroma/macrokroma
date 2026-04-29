import { useState, useRef, useEffect, useCallback } from "react";

/* ── Field presets ────────────────────────────────── */

type ScalarPreset = {
  label: string;
  description: string;
  fn: (x: number, y: number) => number;
};

const PRESETS: ScalarPreset[] = [
  {
    label: "Point source (1/r)",
    description: "A scalar field that falls off with distance from the origin, like the electric potential of a point charge.",
    fn: (x, y) => 1 / Math.sqrt(x * x + y * y + 0.1),
  },
  {
    label: "Dipole",
    description: "Two sources of opposite sign. The potential is positive near one and negative near the other.",
    fn: (x, y) => {
      const r1 = Math.sqrt((x - 0.8) ** 2 + y * y + 0.08);
      const r2 = Math.sqrt((x + 0.8) ** 2 + y * y + 0.08);
      return 1 / r1 - 1 / r2;
    },
  },
  {
    label: "Gaussian bump",
    description: "A smooth hill centered at the origin. The gradient points radially outward, steepest on the slopes.",
    fn: (x, y) => Math.exp(-(x * x + y * y) / 1.5),
  },
  {
    label: "Saddle point",
    description: "f = x² − y². Curves upward along x, downward along y. The gradient vanishes at the origin.",
    fn: (x, y) => (x * x - y * y) / 4,
  },
  {
    label: "Plane wave",
    description: "f = cos(kx). A periodic scalar field. The gradient is a sine wave pointing in the x-direction.",
    fn: (x, _y) => Math.cos(x * 2.5),
  },
  {
    label: "Two Gaussians",
    description: "Two bumps side by side. The gradient field shows how each peak sources its own radial flow.",
    fn: (x, y) =>
      Math.exp(-((x - 1.2) ** 2 + y * y) / 0.8) +
      0.7 * Math.exp(-((x + 1.0) ** 2 + (y - 0.5) ** 2) / 0.6),
  },
];

/* ── Drawing constants ────────────────────────────── */

const CANVAS_SIZE = 560;
const FIELD_RANGE = 3;
const GRID_COUNT = 20;
const CONTOUR_RESOLUTION = 140;

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

function gradient(fn: (x: number, y: number) => number, x: number, y: number): [number, number] {
  const h = 0.005;
  const dfdx = (fn(x + h, y) - fn(x - h, y)) / (2 * h);
  const dfdy = (fn(x, y + h) - fn(x, y - h)) / (2 * h);
  return [dfdx, dfdy];
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number, color: string, alpha: number = 1) {
  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag < 0.001) return;
  const cellSize = CANVAS_SIZE / GRID_COUNT;
  const maxLen = cellSize * 0.42;
  const len = Math.min(mag * cellSize * 0.18, maxLen);
  const nx = vx / mag;
  const ny = vy / mag;
  const tipX = x + nx * len;
  const tipY = y - ny * len;
  const baseX = x - nx * len * 0.15;
  const baseY = y + ny * len * 0.15;
  const headLen = len * 0.35;
  const cosA = Math.cos(0.4);
  const sinA = Math.sin(0.4);
  const dnx = nx;
  const dny = -ny;
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
  ctx.lineTo(tipX - headLen * (dnx * cosA - dny * sinA), tipY - headLen * (dny * cosA + dnx * sinA));
  ctx.lineTo(tipX - headLen * (dnx * cosA + dny * sinA), tipY - headLen * (dny * cosA - dnx * sinA));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function valueToColor(t: number): string {
  const r = Math.round(Math.min(1, Math.max(0, 1.5 * t - 0.25)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, t < 0.5 ? 2 * t : 2 - 2 * t)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, 1.25 - 1.5 * t)) * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

/* ── Component ────────────────────────────────────── */

export function ScalarFieldExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [presetIdx, setPresetIdx] = useState(0);
  const [showGradient, setShowGradient] = useState(true);
  const [probe, setProbe] = useState<[number, number] | null>(null);

  const preset = PRESETS[presetIdx]!;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const cellW = CANVAS_SIZE / CONTOUR_RESOLUTION;
    let fMin = Infinity;
    let fMax = -Infinity;
    const values: number[][] = [];

    for (let i = 0; i < CONTOUR_RESOLUTION; i++) {
      values[i] = [];
      for (let j = 0; j < CONTOUR_RESOLUTION; j++) {
        const cx = (i + 0.5) * cellW;
        const cy = (j + 0.5) * cellW;
        const [fx, fy] = canvasToField(cx, cy);
        const v = preset.fn(fx, fy);
        values[i]![j] = v;
        if (v < fMin) fMin = v;
        if (v > fMax) fMax = v;
      }
    }

    const range = fMax - fMin || 1;

    for (let i = 0; i < CONTOUR_RESOLUTION; i++) {
      for (let j = 0; j < CONTOUR_RESOLUTION; j++) {
        const norm = (values[i]![j]! - fMin) / range;
        ctx.fillStyle = valueToColor(norm);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(i * cellW, j * cellW, cellW + 0.5, cellW + 0.5);
      }
    }
    ctx.globalAlpha = 1;

    // Contour lines
    const numContours = 14;
    ctx.strokeStyle = "rgba(232, 232, 239, 0.2)";
    ctx.lineWidth = 0.7;
    for (let c = 1; c < numContours; c++) {
      const threshold = fMin + (c / numContours) * range;
      for (let i = 0; i < CONTOUR_RESOLUTION - 1; i++) {
        for (let j = 0; j < CONTOUR_RESOLUTION - 1; j++) {
          const v00 = values[i]![j]!;
          const v10 = values[i + 1]![j]!;
          const v01 = values[i]![j + 1]!;
          if ((v00 - threshold) * (v10 - threshold) < 0) {
            const t = (threshold - v00) / (v10 - v00);
            ctx.beginPath();
            ctx.arc((i + t) * cellW, j * cellW, 0.5, 0, Math.PI * 2);
            ctx.stroke();
          }
          if ((v00 - threshold) * (v01 - threshold) < 0) {
            const t = (threshold - v00) / (v01 - v00);
            ctx.beginPath();
            ctx.arc(i * cellW, (j + t) * cellW, 0.5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }

    // Gradient arrows
    if (showGradient) {
      const step = CANVAS_SIZE / GRID_COUNT;
      for (let i = 0; i < GRID_COUNT; i++) {
        for (let j = 0; j < GRID_COUNT; j++) {
          const cx = (i + 0.5) * step;
          const cy = (j + 0.5) * step;
          const [fx, fy] = canvasToField(cx, cy);
          const [gx, gy] = gradient(preset.fn, fx, fy);
          drawArrow(ctx, cx, cy, -gx, -gy, "#e8e8ef", 0.5);
        }
      }
    }

    // Axes
    const [ox, oy] = fieldToCanvas(0, 0);
    ctx.strokeStyle = "rgba(136, 136, 160, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, CANVAS_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(CANVAS_SIZE, oy); ctx.stroke();
    ctx.fillStyle = "rgba(136, 136, 160, 0.5)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("x", CANVAS_SIZE - 12, oy - 8);
    ctx.fillText("y", ox + 12, 16);

    // Colorbar (drawn on canvas)
    const barX = CANVAS_SIZE - 24;
    const barY = 12;
    const barW = 10;
    const barH = 80;
    for (let i = 0; i < barH; i++) {
      const t = 1 - i / barH;
      ctx.fillStyle = valueToColor(t);
      ctx.globalAlpha = 0.8;
      ctx.fillRect(barX, barY + i, barW, 1);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(42, 42, 58, 0.6)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = "rgba(136, 136, 160, 0.6)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("high", barX + barW / 2, barY - 3);
    ctx.fillText("low", barX + barW / 2, barY + barH + 10);

    // Probe
    if (probe) {
      const [px, py] = probe;
      const [cx, cy] = fieldToCanvas(px, py);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (showGradient) {
        const [gx, gy] = gradient(preset.fn, px, py);
        drawArrow(ctx, cx, cy, -gx, -gy, "#f59e0b", 1);
      }
    }
  }, [preset, showGradient, probe]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    setProbe(canvasToField((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY));
  }, []);

  const probeVal = probe ? preset.fn(probe[0], probe[1]) : 0;
  const probeGrad = probe ? gradient(preset.fn, probe[0], probe[1]) : [0, 0] as [number, number];

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p, i) => (
          <button key={p.label} onClick={() => setPresetIdx(i)} className={["px-2.5 py-1 rounded text-xs transition-colors", presetIdx === i ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]"].join(" ")}>{p.label}</button>
        ))}
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{preset.description}</p>
      <div className="flex gap-1.5">
        <button onClick={() => setShowGradient(!showGradient)} className={["px-2.5 py-1 rounded text-xs transition-colors", showGradient ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]"].join(" ")}>
          {showGradient ? "Gradient: ON (−∇f)" : "Gradient: OFF"}
        </button>
      </div>
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="w-full max-w-[560px] rounded cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setProbe(null)}
        />
      </div>
      <div className="h-6 text-xs font-mono text-[var(--color-text-secondary)]">
        {probe ? (
          <span>
            <span className="text-[var(--color-text-primary)]">f</span>({probe[0].toFixed(1)}, {probe[1].toFixed(1)}) = {probeVal.toFixed(3)}
            {" · "}
            <span className="text-[var(--color-accent)]">−∇f</span> = ({(-probeGrad[0]).toFixed(3)}, {(-probeGrad[1]).toFixed(3)})
            {" · "}
            |∇f| = {Math.sqrt(probeGrad[0] ** 2 + probeGrad[1] ** 2).toFixed(3)}
          </span>
        ) : (
          <span className="italic">Hover to see the field value and gradient at any point.</span>
        )}
      </div>
    </div>
  );
}