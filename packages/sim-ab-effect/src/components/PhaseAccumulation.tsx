import { useState, useRef, useEffect, useCallback } from "react";

/* ── Constants ────────────────────────────────────── */

const CANVAS_W = 700;
const CANVAS_H = 280;
const MARGIN_L = 80;
const MARGIN_R = 30;
const MARGIN_T = 40;
const MARGIN_B = 40;
const PLOT_W = CANVAS_W - MARGIN_L - MARGIN_R;
const PLOT_H = CANVAS_H - MARGIN_T - MARGIN_B;

const SOLENOID_R_FIELD = 0.6;
const PATH_STEPS = 100;

/* ── Path geometry (same as ABGeometryExplorer) ──── */

function generatePath(
  side: "above" | "below",
  steps: number = PATH_STEPS,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  // Normalized field coordinates: source at (-3,0), screen at (3,0), solenoid at (0,0)
  const clearance = SOLENOID_R_FIELD + 0.3;
  const deflection = side === "above" ? -clearance : clearance;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const p0x = -3, p0y = 0;
    const p1x = -0.8, p1y = deflection * 1.2;
    const p2x = 0.8, p2y = deflection * 1.0;
    const p3x = 3, p3y = 0;

    const x = mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x;
    const y = mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y;

    points.push({ x, y });
  }
  return points;
}

/** Cumulative ∫A·dl along a path in field coordinates. */
function cumulativeIntegral(
  path: { x: number; y: number }[],
  flux: number,
): number[] {
  const cum: number[] = [0];
  for (let i = 0; i < path.length - 1; i++) {
    const x1 = path[i]!.x;
    const y1 = path[i]!.y;
    const x2 = path[i + 1]!.x;
    const y2 = path[i + 1]!.y;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const r = Math.sqrt(mx * mx + my * my);
    if (r < 0.01) {
      cum.push(cum[cum.length - 1]!);
      continue;
    }

    let aMag: number;
    if (r < SOLENOID_R_FIELD) {
      aMag = (flux * r) / (2 * Math.PI * SOLENOID_R_FIELD * SOLENOID_R_FIELD);
    } else {
      aMag = flux / (2 * Math.PI * r);
    }

    const ax = aMag * (-my / r);
    const ay = aMag * (mx / r);
    const dx = x2 - x1;
    const dy = y2 - y1;
    cum.push(cum[cum.length - 1]! + ax * dx + ay * dy);
  }
  return cum;
}

/* ── Component ────────────────────────────────────── */

export function PhaseAccumulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flux, setFlux] = useState(1.0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const pathA = generatePath("above");
  const pathB = generatePath("below");
  const cumA = cumulativeIntegral(pathA, flux);
  const cumB = cumulativeIntegral(pathB, flux);

  const totalA = cumA[cumA.length - 1]!;
  const totalB = cumB[cumB.length - 1]!;
  const diff = totalA - totalB;

  // Find y-axis range
  const allVals = [...cumA, ...cumB];
  let yMin = Math.min(...allVals, 0);
  let yMax = Math.max(...allVals, 0);
  const yPad = (yMax - yMin) * 0.1 || 0.5;
  yMin -= yPad;
  yMax += yPad;

  const toCanvasX = (i: number) => MARGIN_L + (i / PATH_STEPS) * PLOT_W;
  const toCanvasY = (v: number) => MARGIN_T + (1 - (v - yMin) / (yMax - yMin)) * PLOT_H;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid
    ctx.strokeStyle = "rgba(42, 42, 58, 0.25)";
    ctx.lineWidth = 0.5;

    // Horizontal grid lines
    const yTickCount = 6;
    const yRange = yMax - yMin;
    const yStep = yRange / yTickCount;
    for (let i = 0; i <= yTickCount; i++) {
      const v = yMin + i * yStep;
      const cy = toCanvasY(v);
      ctx.beginPath();
      ctx.moveTo(MARGIN_L, cy);
      ctx.lineTo(MARGIN_L + PLOT_W, cy);
      ctx.stroke();

      ctx.fillStyle = "rgba(136, 136, 160, 0.6)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(v.toFixed(2), MARGIN_L - 6, cy + 3);
    }

    // Vertical grid lines
    const xSteps = 5;
    for (let i = 0; i <= xSteps; i++) {
      const cx = MARGIN_L + (i / xSteps) * PLOT_W;
      ctx.beginPath();
      ctx.moveTo(cx, MARGIN_T);
      ctx.lineTo(cx, MARGIN_T + PLOT_H);
      ctx.stroke();

      ctx.fillStyle = "rgba(136, 136, 160, 0.6)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      const pct = Math.round((i / xSteps) * 100);
      ctx.fillText(`${pct}%`, cx, MARGIN_T + PLOT_H + 14);
    }

    // Zero line
    const zeroY = toCanvasY(0);
    ctx.strokeStyle = "rgba(136, 136, 160, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(MARGIN_L, zeroY);
    ctx.lineTo(MARGIN_L + PLOT_W, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Plot border
    ctx.strokeStyle = "rgba(42, 42, 58, 0.5)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(MARGIN_L, MARGIN_T, PLOT_W, PLOT_H);

    // Axis labels
    ctx.fillStyle = "rgba(136, 136, 160, 0.7)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Progress along path (source → screen)", MARGIN_L + PLOT_W / 2, CANVAS_H - 6);

    ctx.save();
    ctx.translate(14, MARGIN_T + PLOT_H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("∫ A · dl", 0, 0);
    ctx.restore();

    // Difference shading between curves
    ctx.beginPath();
    for (let i = 0; i <= PATH_STEPS; i++) {
      const cx = toCanvasX(i);
      const cy = toCanvasY(cumA[i]!);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    for (let i = PATH_STEPS; i >= 0; i--) {
      const cx = toCanvasX(i);
      const cy = toCanvasY(cumB[i]!);
      ctx.lineTo(cx, cy);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(99, 102, 241, 0.08)";
    ctx.fill();

    // Path A cumulative curve
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= PATH_STEPS; i++) {
      const cx = toCanvasX(i);
      const cy = toCanvasY(cumA[i]!);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Path B cumulative curve
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= PATH_STEPS; i++) {
      const cx = toCanvasX(i);
      const cy = toCanvasY(cumB[i]!);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Endpoint markers and values
    const endX = toCanvasX(PATH_STEPS);
    const endYA = toCanvasY(totalA);
    const endYB = toCanvasY(totalB);

    // Bracket showing difference
    ctx.strokeStyle = "var(--color-accent)";
    ctx.strokeStyle = "#818cf8";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(endX + 8, endYA);
    ctx.lineTo(endX + 18, endYA);
    ctx.lineTo(endX + 18, endYB);
    ctx.lineTo(endX + 8, endYB);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#818cf8";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Δ = ${diff.toFixed(3)}`, endX + 22, (endYA + endYB) / 2 + 4);

    // Endpoint dots
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(endX, endYA, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#60a5fa";
    ctx.beginPath();
    ctx.arc(endX, endYB, 4, 0, Math.PI * 2);
    ctx.fill();

    // Hover line
    if (hoverIdx !== null) {
      const hx = toCanvasX(hoverIdx);
      const hyA = toCanvasY(cumA[hoverIdx]!);
      const hyB = toCanvasY(cumB[hoverIdx]!);

      ctx.strokeStyle = "rgba(232, 232, 239, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, MARGIN_T);
      ctx.lineTo(hx, MARGIN_T + PLOT_H);
      ctx.stroke();

      // Dots on curves
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(hx, hyA, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#60a5fa";
      ctx.beginPath();
      ctx.arc(hx, hyB, 4, 0, Math.PI * 2);
      ctx.fill();

      // Difference bracket at hover
      const localDiff = cumA[hoverIdx]! - cumB[hoverIdx]!;
      ctx.strokeStyle = "rgba(129, 140, 248, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hx - 6, hyA);
      ctx.lineTo(hx - 6, hyB);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(129, 140, 248, 0.7)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`Δ=${localDiff.toFixed(3)}`, hx - 10, (hyA + hyB) / 2 + 3);
    }

    // Title labels
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`∫a A·dl = ${totalA.toFixed(3)}`, MARGIN_L, MARGIN_T - 10);
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`∫b A·dl = ${totalB.toFixed(3)}`, MARGIN_L + 180, MARGIN_T - 10);
    ctx.fillStyle = "#818cf8";
    ctx.fillText(`Δφ = ${diff.toFixed(3)} rad = ${(diff / (2 * Math.PI)).toFixed(3)} × 2π`, MARGIN_L + 380, MARGIN_T - 10);
  }, [flux, hoverIdx, cumA, cumB, totalA, totalB, diff, yMin, yMax]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = CANVAS_W / rect.width;
      const cx = (e.clientX - rect.left) * scaleX;
      const localX = cx - MARGIN_L;
      if (localX < 0 || localX > PLOT_W) {
        setHoverIdx(null);
        return;
      }
      const idx = Math.round((localX / PLOT_W) * PATH_STEPS);
      setHoverIdx(Math.max(0, Math.min(PATH_STEPS, idx)));
    },
    [],
  );

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
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

      {/* Canvas */}
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full max-w-[700px] rounded cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        />
      </div>

      {/* Description */}
      <div className="text-xs text-[var(--color-text-secondary)]">
        <span className="italic">
          The accumulated line integral ∫A·dl along each path, plotted as a function of
          progress from source to screen. The shaded region between the curves is the
          phase difference. Hover to inspect at any point along the journey.
        </span>
      </div>
    </div>
  );
}