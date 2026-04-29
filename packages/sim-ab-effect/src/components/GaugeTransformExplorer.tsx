import { useState, useRef, useEffect, useCallback } from "react";

/* ── Physics ──────────────────────────────────────── */

const CANVAS_SIZE = 560;
const FIELD_RANGE = 3;
const ARROW_GRID = 18;
const SOLENOID_RADIUS = 0.6;
const FLUX = 5.0;

/**
 * Vector potential A for a solenoid in the Coulomb gauge.
 * This is the "natural" gauge for this geometry.
 */
function aCoulomb(x: number, y: number, R: number): [number, number] {
  const r = Math.sqrt(x * x + y * y);
  if (r < 0.001) return [0, 0];
  const thetaX = -y / r;
  const thetaY = x / r;
  let aMag: number;
  if (r < R) {
    aMag = (FLUX / (2 * Math.PI * R * R)) * r;
  } else {
    aMag = FLUX / (2 * Math.PI * r);
  }
  return [aMag * thetaX, aMag * thetaY];
}

/**
 * Gauge functions χ(x, y).
 * A' = A + ∇χ gives a different vector potential with the same B.
 */
type GaugePreset = {
  label: string;
  description: string;
  chi: (x: number, y: number) => number;
  gradChi: (x: number, y: number) => [number, number];
};

const GAUGE_PRESETS: GaugePreset[] = [
  {
    label: "Coulomb (χ = 0)",
    description: "The standard Coulomb gauge. A circulates azimuthally around the solenoid, falling off as 1/r outside.",
    chi: () => 0,
    gradChi: () => [0, 0],
  },
  {
    label: "Linear (χ = αx)",
    description: "A uniform shift in the x-direction is added to A. The field tilts but B is unchanged.",
    chi: (x) => 1.5 * x,
    gradChi: () => [1.5, 0],
  },
  {
    label: "Linear (χ = αy)",
    description: "A uniform shift in the y-direction. A tilts vertically but B is still the same.",
    chi: (_x, y) => 1.5 * y,
    gradChi: () => [0, 1.5],
  },
  {
    label: "Radial (χ = αr²)",
    description: "A radial gauge function that pushes A outward everywhere. B remains confined to the solenoid.",
    chi: (x, y) => 0.3 * (x * x + y * y),
    gradChi: (x, y) => [0.6 * x, 0.6 * y],
  },
  {
    label: "Quadratic (χ = αxy)",
    description: "A saddle-shaped gauge function. A deforms dramatically but B is completely unchanged.",
    chi: (x, y) => 0.8 * x * y,
    gradChi: (x, y) => [0.8 * y, 0.8 * x],
  },
  {
    label: "Sinusoidal (χ = α sin(kx))",
    description: "A periodic gauge function. A develops a wavy pattern but the physical field B is unaffected.",
    chi: (x) => 0.8 * Math.sin(x * 2),
    gradChi: (x) => [0.8 * 2 * Math.cos(x * 2), 0],
  },
];

/**
 * Compute A' = A_coulomb + ∇χ in the transformed gauge.
 */
function aTransformed(
  x: number,
  y: number,
  R: number,
  gauge: GaugePreset,
  blend: number,
): [number, number] {
  const [ax, ay] = aCoulomb(x, y, R);
  const [gx, gy] = gauge.gradChi(x, y);
  return [ax + blend * gx, ay + blend * gy];
}

/**
 * Compute B_z = (∇ × A)_z numerically.
 * This should be the same regardless of gauge.
 */
function computeBz(
  x: number,
  y: number,
  R: number,
  gauge: GaugePreset,
  blend: number,
): number {
  const h = 0.005;
  const [, ayR] = aTransformed(x + h, y, R, gauge, blend);
  const [, ayL] = aTransformed(x - h, y, R, gauge, blend);
  const [axU] = aTransformed(x, y + h, R, gauge, blend);
  const [axD] = aTransformed(x, y - h, R, gauge, blend);
  // B_z = dAy/dx - dAx/dy
  return (ayR - ayL) / (2 * h) - (axU - axD) / (2 * h);
}

/* ── Drawing ──────────────────────────────────────── */

function fieldToCanvas(fx: number, fy: number): [number, number] {
  return [
    ((fx + FIELD_RANGE) / (2 * FIELD_RANGE)) * CANVAS_SIZE,
    ((FIELD_RANGE - fy) / (2 * FIELD_RANGE)) * CANVAS_SIZE,
  ];
}

function canvasToField(cx: number, cy: number): [number, number] {
  return [
    (cx / CANVAS_SIZE) * 2 * FIELD_RANGE - FIELD_RANGE,
    FIELD_RANGE - (cy / CANVAS_SIZE) * 2 * FIELD_RANGE,
  ];
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vx: number,
  vy: number,
  color: string,
  alpha: number = 1,
  scale: number = 1,
) {
  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag < 0.001) return;

  const cellSize = CANVAS_SIZE / ARROW_GRID;
  const maxLen = cellSize * 0.44;
  const len = Math.min(mag * scale * cellSize, maxLen);
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
  ctx.lineTo(
    tipX - headLen * (dnx * cosA - dny * sinA),
    tipY - headLen * (dny * cosA + dnx * sinA),
  );
  ctx.lineTo(
    tipX - headLen * (dnx * cosA + dny * sinA),
    tipY - headLen * (dny * cosA - dnx * sinA),
  );
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ── Component ────────────────────────────────────── */

export function GaugeTransformExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gaugeIdx, setGaugeIdx] = useState(0);
  const [blend, setBlend] = useState(0);
  const [showB, setShowB] = useState(true);
  const [probe, setProbe] = useState<[number, number] | null>(null);

  const gauge = GAUGE_PRESETS[gaugeIdx]!;
  const R = SOLENOID_RADIUS;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid
    ctx.strokeStyle = "rgba(42, 42, 58, 0.2)";
    ctx.lineWidth = 0.5;
    const step = CANVAS_SIZE / ARROW_GRID;
    for (let i = 0; i <= ARROW_GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(CANVAS_SIZE, i * step);
      ctx.stroke();
    }

    // B field background (should be identical regardless of gauge)
    if (showB) {
      const res = 80;
      const cellW = CANVAS_SIZE / res;
      for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
          const [fx, fy] = canvasToField((i + 0.5) * cellW, (j + 0.5) * cellW);
          const bz = computeBz(fx, fy, R, gauge, blend);
          if (Math.abs(bz) > 0.01) {
            const norm = Math.min(Math.abs(bz) * 0.15, 1);
            ctx.fillStyle = bz > 0
              ? `rgba(34, 197, 94, ${norm * 0.35})`
              : `rgba(239, 68, 68, ${norm * 0.35})`;
            ctx.fillRect(i * cellW, j * cellW, cellW + 0.5, cellW + 0.5);
          }
        }
      }
    }

    // Solenoid boundary
    const [cx, cy] = fieldToCanvas(0, 0);
    const radiusPx = (R / (2 * FIELD_RANGE)) * CANVAS_SIZE;
    ctx.strokeStyle = "rgba(232, 232, 239, 0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw A' arrows
    for (let i = 0; i < ARROW_GRID; i++) {
      for (let j = 0; j < ARROW_GRID; j++) {
        const px = (i + 0.5) * step;
        const py = (j + 0.5) * step;
        const [fx, fy] = canvasToField(px, py);
        const [ax, ay] = aTransformed(fx, fy, R, gauge, blend);
        drawArrow(ctx, px, py, ax, ay, "#818cf8", 0.6, 2.5);
      }
    }

    // Axes
    const [ox, oy] = fieldToCanvas(0, 0);
    ctx.strokeStyle = "rgba(136, 136, 160, 0.2)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, CANVAS_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(CANVAS_SIZE, oy);
    ctx.stroke();
    ctx.fillStyle = "rgba(136, 136, 160, 0.4)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("x", CANVAS_SIZE - 12, oy - 8);
    ctx.fillText("y", ox + 12, 16);

    // Legend
    ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
    ctx.fillRect(8, CANVAS_SIZE - 52, 210, 44);
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#818cf8";
    ctx.fillText("→ A' = A + ∇χ (gauge-transformed)", 16, CANVAS_SIZE - 34);
    if (showB) {
      ctx.fillStyle = "#22c55e";
      ctx.fillText("■ B = ∇×A' (unchanged!)", 16, CANVAS_SIZE - 18);
    }

    // Gauge blend indicator
    ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
    ctx.fillRect(CANVAS_SIZE - 130, 8, 122, 20);
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = blend === 0 ? "rgba(136, 136, 160, 0.6)" : "#f59e0b";
    ctx.fillText(
      blend === 0 ? "Coulomb gauge" : `χ blend: ${(blend * 100).toFixed(0)}%`,
      CANVAS_SIZE - 14,
      22,
    );

    // Probe
    if (probe) {
      const [px, py] = probe;
      const [pcx, pcy] = fieldToCanvas(px, py);

      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(pcx, pcy, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const [ax, ay] = aTransformed(px, py, R, gauge, blend);
      drawArrow(ctx, pcx, pcy, ax, ay, "#f59e0b", 1, 2.5);
    }
  }, [gauge, blend, showB, probe, R]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = CANVAS_SIZE / rect.width;
      const scaleY = CANVAS_SIZE / rect.height;
      setProbe(
        canvasToField(
          (e.clientX - rect.left) * scaleX,
          (e.clientY - rect.top) * scaleY,
        ),
      );
    },
    [],
  );

  // Probe readouts
  const probeACoulomb = probe ? aCoulomb(probe[0], probe[1], R) : [0, 0] as [number, number];
  const probeATransformed = probe ? aTransformed(probe[0], probe[1], R, gauge, blend) : [0, 0] as [number, number];
  const probeBz = probe ? computeBz(probe[0], probe[1], R, gauge, blend) : 0;
  const probeBzCoulomb = probe ? computeBz(probe[0], probe[1], R, GAUGE_PRESETS[0]!, 0) : 0;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      {/* Gauge selector */}
      <div className="flex flex-wrap gap-1.5">
        {GAUGE_PRESETS.map((g, i) => (
          <button
            key={g.label}
            onClick={() => { setGaugeIdx(i); if (i === 0) setBlend(0); else setBlend(1); }}
            className={[
              "px-2.5 py-1 rounded text-xs transition-colors",
              gaugeIdx === i
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            {g.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
        {gauge.description}
      </p>

      {/* B toggle */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setShowB(!showB)}
          className={[
            "px-2.5 py-1 rounded text-xs transition-colors",
            showB
              ? "bg-[#22c55e] text-white"
              : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
          ].join(" ")}
        >
          {showB ? "B field: ON" : "B field: OFF"}
        </button>
      </div>

      {/* Blend slider */}
      {gaugeIdx !== 0 && (
        <div>
          <label className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
            <span>Gauge transform blend (0 = Coulomb, 1 = full χ)</span>
            <span className="font-mono text-[var(--color-accent)]">
              {blend.toFixed(2)}
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={blend}
            onChange={(e) => setBlend(parseFloat(e.target.value))}
            className="w-full mt-1"
            style={{ accentColor: "var(--color-accent)" }}
          />
        </div>
      )}

      {/* Canvas */}
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

      {/* Probe readout */}
      <div className="min-h-[3rem] text-xs font-mono text-[var(--color-text-secondary)]">
        {probe ? (
          <div className="flex flex-col gap-1">
            <span>
              <span className="text-[#818cf8]">A'</span> = ({probeATransformed[0].toFixed(3)}, {probeATransformed[1].toFixed(3)})
              {blend > 0 && (
                <>
                  {" · "}
                  <span className="text-[var(--color-text-secondary)]">A_coulomb</span> = ({probeACoulomb[0].toFixed(3)}, {probeACoulomb[1].toFixed(3)})
                </>
              )}
            </span>
            <span>
              <span className="text-[#22c55e]">B_z</span> = {probeBz.toFixed(4)}
              {blend > 0 && (
                <>
                  {" · "}
                  <span className="text-[var(--color-text-secondary)]">B_z (Coulomb)</span> = {probeBzCoulomb.toFixed(4)}
                  {" · "}
                  <span className="text-[var(--color-warning)]">
                    ΔB = {Math.abs(probeBz - probeBzCoulomb).toExponential(1)}
                  </span>
                </>
              )}
            </span>
          </div>
        ) : (
          <span className="italic">
            Select a gauge and drag the blend slider. Watch A change dramatically
            while B (green region) stays exactly the same. This is gauge invariance.
          </span>
        )}
      </div>
    </div>
  );
}