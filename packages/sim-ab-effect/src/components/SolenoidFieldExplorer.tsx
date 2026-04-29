import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";

/* ── Physics ──────────────────────────────────────── */

const CANVAS_SIZE = 560;
const FIELD_RANGE = 3;
const ARROW_GRID = 20;
const SOLENOID_RADIUS = 0.6;

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

function vectorPotential(
  x: number,
  y: number,
  flux: number,
  R: number,
): [number, number] {
  const r = Math.sqrt(x * x + y * y);
  if (r < 0.001) return [0, 0];

  const thetaX = -y / r;
  const thetaY = x / r;

  let aMag: number;
  if (r < R) {
    aMag = (flux / (2 * Math.PI * R * R)) * r;
  } else {
    aMag = flux / (2 * Math.PI * r);
  }

  return [aMag * thetaX, aMag * thetaY];
}

function magneticFieldZ(
  x: number,
  y: number,
  flux: number,
  R: number,
): number {
  const r = Math.sqrt(x * x + y * y);
  if (r < R) {
    return flux / (Math.PI * R * R);
  }
  return 0;
}

/* ── Arrow drawing ────────────────────────────────── */

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

function drawBSymbol(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  bz: number,
  alpha: number = 1,
) {
  if (Math.abs(bz) < 0.001) return;

  const size = 4;
  ctx.globalAlpha = alpha;

  if (bz > 0) {
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - size, cy - size);
    ctx.lineTo(cx + size, cy + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + size, cy - size);
    ctx.lineTo(cx - size, cy + size);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

/**
 * Draw current direction indicators on the solenoid boundary.
 * In the 2D cross-section (looking down the solenoid axis from above),
 * counterclockwise current means:
 *   - At the top of the circle: current goes to the left (into the page on the right, out on the left)
 *   - We show this with small arrow arcs along the solenoid boundary
 */
function drawCurrentFlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusPx: number,
  alpha: number = 1,
) {
  const arrowCount = 12;
  const arcSpan = 0.15; // radians per arc segment

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#f59e0b";
  ctx.fillStyle = "#f59e0b";
  ctx.lineWidth = 1.8;

  for (let i = 0; i < arrowCount; i++) {
    const theta = (i / arrowCount) * Math.PI * 2;
    // Current flows counterclockwise (positive angular direction)
    // In canvas coords (y-flipped), counterclockwise in field space is clockwise on canvas
    const arcStart = theta - arcSpan;
    const arcEnd = theta + arcSpan;

    // Draw arc segment
    ctx.beginPath();
    // Canvas arc goes clockwise for increasing angle, but our field-space CCW
    // maps to canvas CW, so we draw the arc in the "wrong" direction
    // and it comes out right
    ctx.arc(cx, cy, radiusPx, -arcEnd, -arcStart);
    ctx.stroke();

    // Arrowhead at the leading edge of the arc
    // The tip is at angle arcEnd, pointing in the tangent direction
    const tipAngle = -arcStart; // canvas angle at the tip
    const tipX = cx + radiusPx * Math.cos(tipAngle);
    const tipY = cy + radiusPx * Math.sin(tipAngle);

    // Tangent direction at the tip (perpendicular to radius, in the direction of flow)
    // For canvas-clockwise flow: tangent = (sin(angle), -cos(angle))
    const tx = Math.sin(tipAngle);
    const ty = -Math.cos(tipAngle);

    const headLen = 6;
    const headAngle = 0.5;
    const cosH = Math.cos(headAngle);
    const sinH = Math.sin(headAngle);

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - headLen * (tx * cosH - ty * sinH),
      tipY - headLen * (ty * cosH + tx * sinH),
    );
    ctx.lineTo(
      tipX - headLen * (tx * cosH + ty * sinH),
      tipY - headLen * (ty * cosH - tx * sinH),
    );
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/* ── 3D Scene (lazy loaded) ──────────────────────── */

const SolenoidScene3D = lazy(() => import("./SolenoidScene3D"));

/* ── Component ────────────────────────────────────── */

type ViewMode = "2d" | "3d";

export function SolenoidFieldExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flux, setFlux] = useState(5.0);
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);
  const [showCoils, setShowCoils] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [probe, setProbe] = useState<[number, number] | null>(null);

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

    // A field magnitude background
    if (showA) {
      const res = 80;
      const cellW = CANVAS_SIZE / res;
      for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
          const [fx, fy] = canvasToField((i + 0.5) * cellW, (j + 0.5) * cellW);
          const [ax, ay] = vectorPotential(fx, fy, flux, R);
          const aMag = Math.sqrt(ax * ax + ay * ay);
          const norm = Math.min(aMag * 1.5, 1);
          if (norm > 0.01) {
            ctx.fillStyle = `rgba(99, 102, 241, ${norm * 0.2})`;
            ctx.fillRect(i * cellW, j * cellW, cellW + 0.5, cellW + 0.5);
          }
        }
      }
    }

    // B field background inside solenoid
    if (showB) {
      const res = 80;
      const cellW = CANVAS_SIZE / res;
      for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
          const [fx, fy] = canvasToField((i + 0.5) * cellW, (j + 0.5) * cellW);
          const bz = magneticFieldZ(fx, fy, flux, R);
          if (Math.abs(bz) > 0.001) {
            const norm = Math.min(Math.abs(bz) * 0.3, 1);
            ctx.fillStyle = `rgba(34, 197, 94, ${norm * 0.25})`;
            ctx.fillRect(i * cellW, j * cellW, cellW + 0.5, cellW + 0.5);
          }
        }
      }
    }

    // Solenoid boundary circle
    const [cx, cy] = fieldToCanvas(0, 0);
    const radiusPx = (R / (2 * FIELD_RANGE)) * CANVAS_SIZE;
    ctx.strokeStyle = "rgba(232, 232, 239, 0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = "rgba(232, 232, 239, 0.5)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("solenoid", cx, cy - radiusPx - 8);
    ctx.fillText("(cross-section)", cx, cy - radiusPx + 6);

    // Draw current flow indicators on solenoid boundary
    if (showCoils) {
      drawCurrentFlow(ctx, cx, cy, radiusPx, 0.7);
    }

    // Draw A arrows
    if (showA) {
      for (let i = 0; i < ARROW_GRID; i++) {
        for (let j = 0; j < ARROW_GRID; j++) {
          const px = (i + 0.5) * step;
          const py = (j + 0.5) * step;
          const [fx, fy] = canvasToField(px, py);
          const [ax, ay] = vectorPotential(fx, fy, flux, R);
          drawArrow(ctx, px, py, ax, ay, "#818cf8", 0.6, 2.5);
        }
      }
    }

    // Draw B symbols
    if (showB) {
      const bGrid = 8;
      const bStep = (radiusPx * 2) / (bGrid + 1);
      for (let i = 1; i <= bGrid; i++) {
        for (let j = 1; j <= bGrid; j++) {
          const bx = cx - radiusPx + i * bStep;
          const by = cy - radiusPx + j * bStep;
          const [fx, fy] = canvasToField(bx, by);
          const r = Math.sqrt(fx * fx + fy * fy);
          if (r < R * 0.9) {
            const bz = magneticFieldZ(fx, fy, flux, R);
            drawBSymbol(ctx, bx, by, bz, 0.7);
          }
        }
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

    // Legend on canvas
    ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
    const legendH = showCoils ? 66 : 48;
    ctx.fillRect(8, CANVAS_SIZE - legendH - 8, 210, legendH);
    ctx.font = "10px monospace";
    ctx.textAlign = "left";

    let legendY = CANVAS_SIZE - legendH;
    if (showCoils) {
      ctx.fillStyle = "#f59e0b";
      ctx.fillText("↻ I (current, CCW from above)", 16, legendY);
      legendY += 16;
    }
    if (showA) {
      ctx.fillStyle = "#818cf8";
      ctx.fillText("→ A (vector potential)", 16, legendY);
      legendY += 16;
    }
    if (showB) {
      ctx.fillStyle = "#22c55e";
      ctx.fillText("⊙ B (out of page, inside)", 16, legendY);
    }
    if (!showA && !showB && !showCoils) {
      ctx.fillStyle = "rgba(136, 136, 160, 0.6)";
      ctx.fillText("Toggle fields to see them", 16, CANVAS_SIZE - 30);
    }

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

      if (showA) {
        const [ax, ay] = vectorPotential(px, py, flux, R);
        drawArrow(ctx, pcx, pcy, ax, ay, "#f59e0b", 1, 2.5);
      }
    }
  }, [flux, showA, showB, showCoils, probe, R]);

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
  const probeA = probe
    ? vectorPotential(probe[0], probe[1], flux, R)
    : ([0, 0] as [number, number]);
  const probeBz = probe ? magneticFieldZ(probe[0], probe[1], flux, R) : 0;
  const probeR = probe ? Math.sqrt(probe[0] ** 2 + probe[1] ** 2) : 0;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      {/* View mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <button
            onClick={() => setViewMode("2d")}
            className={[
              "px-2.5 py-1 rounded text-xs transition-colors",
              viewMode === "2d"
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            2D cross-section
          </button>
          <button
            onClick={() => setViewMode("3d")}
            className={[
              "px-2.5 py-1 rounded text-xs transition-colors",
              viewMode === "3d"
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            3D view
          </button>
        </div>

        {/* Field toggles */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowA(!showA)}
            className={[
              "px-2.5 py-1 rounded text-xs transition-colors",
              showA
                ? "bg-[#6366f1] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            A field
          </button>
          <button
            onClick={() => setShowB(!showB)}
            className={[
              "px-2.5 py-1 rounded text-xs transition-colors",
              showB
                ? "bg-[#22c55e] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            B field
          </button>
          <button
            onClick={() => setShowCoils(!showCoils)}
            className={[
              "px-2.5 py-1 rounded text-xs transition-colors",
              showCoils
                ? "bg-[#f59e0b] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            Coils
          </button>
        </div>
      </div>

      {/* Flux slider */}
      <div>
        <label className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>Magnetic flux (Φ)</span>
          <span className="font-mono text-[var(--color-accent)]">
            {flux.toFixed(1)}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={15}
          step={0.1}
          value={flux}
          onChange={(e) => setFlux(parseFloat(e.target.value))}
          className="w-full mt-1"
          style={{ accentColor: "var(--color-accent)" }}
        />
      </div>

      {/* Canvas / 3D scene */}
      <div className="flex justify-center">
        {viewMode === "2d" ? (
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="w-full max-w-[560px] rounded cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setProbe(null)}
          />
        ) : (
          <div className="w-full max-w-[560px] aspect-square rounded overflow-hidden">
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-secondary)]">
                  Loading 3D scene...
                </div>
              }
            >
              <SolenoidScene3D flux={flux} showA={showA} showB={showB} showCoils={showCoils} />
            </Suspense>
          </div>
        )}
      </div>

      {/* Probe readout */}
      <div className="h-6 text-xs font-mono text-[var(--color-text-secondary)]">
        {probe && viewMode === "2d" ? (
          <span>
            r = {probeR.toFixed(2)}
            {probeR < R ? " (inside)" : " (outside)"}
            {showA && (
              <>
                {" · "}
                <span className="text-[#818cf8]">|A|</span> ={" "}
                {Math.sqrt(probeA[0] ** 2 + probeA[1] ** 2).toFixed(3)}
              </>
            )}
            {showB && (
              <>
                {" · "}
                <span className="text-[#22c55e]">B_z</span> ={" "}
                {probeBz.toFixed(3)}
              </>
            )}
          </span>
        ) : viewMode === "2d" ? (
          <span className="italic">
            Hover to probe A and B at any point. B exists only inside the
            solenoid; A circulates everywhere.
          </span>
        ) : (
          <span className="italic">
            Orbit with mouse. A (purple) circulates around the solenoid. B
            (green) is confined inside.
          </span>
        )}
      </div>
    </div>
  );
}