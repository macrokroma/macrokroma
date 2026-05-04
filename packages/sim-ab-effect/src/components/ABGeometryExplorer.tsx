import { useState, useRef, useEffect, useCallback } from "react";

/* ── Constants ────────────────────────────────────── */

const CANVAS_W = 700;
const CANVAS_H = 400;
const SOLENOID_X = 300;
const SOLENOID_Y = 200;
const SOLENOID_R = 35;
const SOURCE_X = 60;
const SOURCE_Y = 200;
const SCREEN_X = 580;
const SCREEN_Y_MAX = 340;

/* ── Path geometry ────────────────────────────────── */

function generatePath(
  side: "above" | "below",
  screenY: number,
  steps: number = 80,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const midX = SOLENOID_X;
  const midY = SOLENOID_Y;
  const clearance = SOLENOID_R + 20;
  const deflection = side === "above" ? -clearance : clearance;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const p0x = SOURCE_X;
    const p0y = SOURCE_Y;
    const p1x = midX - 60;
    const p1y = midY + deflection * 1.2;
    const p2x = midX + 60;
    const p2y = midY + deflection * 1.0;
    const p3x = SCREEN_X;
    const p3y = screenY;

    const x = mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x;
    const y = mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y;

    points.push({ x, y });
  }

  return points;
}

function phaseAlongPath(
  path: { x: number; y: number }[],
  flux: number,
): number {
  let integral = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const x1 = path[i]!.x - SOLENOID_X;
    const y1 = path[i]!.y - SOLENOID_Y;
    const x2 = path[i + 1]!.x - SOLENOID_X;
    const y2 = path[i + 1]!.y - SOLENOID_Y;

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const r = Math.sqrt(mx * mx + my * my);
    if (r < 1) continue;

    const aMag = flux / (2 * Math.PI * r);
    const ax = aMag * (-my / r);
    const ay = aMag * (mx / r);

    const dx = x2 - x1;
    const dy = y2 - y1;

    integral += ax * dx + ay * dy;
  }
  return integral;
}

/** Pre-compute cumulative phase at each point along a path. */
function cumulativePhase(
  path: { x: number; y: number }[],
  flux: number,
): number[] {
  const cum: number[] = [0];
  for (let i = 0; i < path.length - 1; i++) {
    const x1 = path[i]!.x - SOLENOID_X;
    const y1 = path[i]!.y - SOLENOID_Y;
    const x2 = path[i + 1]!.x - SOLENOID_X;
    const y2 = path[i + 1]!.y - SOLENOID_Y;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const r = Math.sqrt(mx * mx + my * my);
    if (r < 1) {
      cum.push(cum[cum.length - 1]!);
      continue;
    }
    const aMag = flux / (2 * Math.PI * r);
    const ax = aMag * (-my / r);
    const ay = aMag * (mx / r);
    const dx = x2 - x1;
    const dy = y2 - y1;
    cum.push(cum[cum.length - 1]! + ax * dx + ay * dy);
  }
  return cum;
}

/* ── HSL color from phase ─────────────────────────── */

function phaseToColor(phase: number, alpha: number = 1): string {
  const hue = ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const hueDeg = (hue / (2 * Math.PI)) * 360;
  return `hsla(${hueDeg}, 80%, 60%, ${alpha})`;
}

/* ── Arrow drawing ────────────────────────────────── */

function drawSmallArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  len: number,
  color: string,
  alpha: number,
) {
  const tipX = x + dx * len;
  const tipY = y + dy * len;
  const baseX = x - dx * len * 0.2;
  const baseY = y - dy * len * 0.2;

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  const headLen = len * 0.35;
  const perpX = -dy;
  const perpY = dx;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - dx * headLen + perpX * 2.5, tipY - dy * headLen + perpY * 2.5);
  ctx.lineTo(tipX - dx * headLen - perpX * 2.5, tipY - dy * headLen - perpY * 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ── Component ────────────────────────────────────── */

export function ABGeometryExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flux, setFlux] = useState(1.0);
  const [speed, setSpeed] = useState(0.5);
  const [showPhaseColor, setShowPhaseColor] = useState(true);
  const [showAField, setShowAField] = useState(false);
  const timeRef = useRef(0);
  const animRef = useRef<number>(0);

  const screenY = SOLENOID_Y;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const t = timeRef.current;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle grid
    ctx.strokeStyle = "rgba(42, 42, 58, 0.15)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < CANVAS_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }

    // A field arrows outside solenoid
    if (showAField && Math.abs(flux) > 0.01) {
      const gridStep = 35;
      for (let gx = gridStep / 2; gx < CANVAS_W; gx += gridStep) {
        for (let gy = gridStep / 2; gy < CANVAS_H; gy += gridStep) {
          const relX = gx - SOLENOID_X;
          const relY = gy - SOLENOID_Y;
          const r = Math.sqrt(relX * relX + relY * relY);
          if (r < SOLENOID_R + 8 || r < 1) continue;

          const aMag = flux / (2 * Math.PI * r);
          const dirX = -relY / r;
          const dirY = relX / r;

          const arrowLen = Math.min(aMag * 8000, 14);
          if (arrowLen < 2) continue;

          drawSmallArrow(ctx, gx, gy, dirX, dirY, arrowLen, "#818cf8", 0.3);
        }
      }

      // A field arrows inside solenoid
      const innerGrid = 25;
      for (let gx = SOLENOID_X - SOLENOID_R; gx <= SOLENOID_X + SOLENOID_R; gx += innerGrid) {
        for (let gy = SOLENOID_Y - SOLENOID_R; gy <= SOLENOID_Y + SOLENOID_R; gy += innerGrid) {
          const relX = gx - SOLENOID_X;
          const relY = gy - SOLENOID_Y;
          const r = Math.sqrt(relX * relX + relY * relY);
          if (r < 3 || r > SOLENOID_R - 3) continue;

          const aMag = (flux * r) / (2 * Math.PI * SOLENOID_R * SOLENOID_R);
          const dirX = -relY / r;
          const dirY = relX / r;

          const arrowLen = Math.min(aMag * 8000, 10);
          if (arrowLen < 1.5) continue;

          drawSmallArrow(ctx, gx, gy, dirX, dirY, arrowLen, "#818cf8", 0.2);
        }
      }
    }

    // Solenoid (cross-section)
    ctx.fillStyle = "rgba(42, 42, 58, 0.4)";
    ctx.beginPath();
    ctx.arc(SOLENOID_X, SOLENOID_Y, SOLENOID_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(232, 232, 239, 0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(SOLENOID_X, SOLENOID_Y, SOLENOID_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // B field symbol inside solenoid
    if (Math.abs(flux) > 0.01) {
      ctx.fillStyle = "#22c55e";
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(SOLENOID_X, SOLENOID_Y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(SOLENOID_X, SOLENOID_Y, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "rgba(34, 197, 94, 0.5)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("B ⊙", SOLENOID_X, SOLENOID_Y + 20);
    }

    ctx.fillStyle = "rgba(232, 232, 239, 0.4)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("solenoid", SOLENOID_X, SOLENOID_Y - SOLENOID_R - 8);

    // Generate paths
    const pathA = generatePath("above", screenY);
    const pathB = generatePath("below", screenY);

    // Compute phases
    const phaseA = phaseAlongPath(pathA, flux);
    const phaseB = phaseAlongPath(pathB, flux);
    const phaseDiff = phaseA - phaseB;
    const cumA = cumulativePhase(pathA, flux);
    const cumB = cumulativePhase(pathB, flux);

    // Draw paths with phase coloring
    const drawPathWithPhase = (
      path: { x: number; y: number }[],
      cumPhase: number[],
      color: string,
      label: string,
    ) => {
      const k = 0.15;

      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i]!;
        const p2 = path[i + 1]!;
        const totalPhase = k * (i - t * 2) + cumPhase[i]!;

        if (showPhaseColor) {
          ctx.strokeStyle = phaseToColor(totalPhase, 0.8);
          ctx.lineWidth = 2.5;
        } else {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.7;
        }

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Wavefront dots
      const numDots = 8;
      for (let d = 0; d < numDots; d++) {
        const phase = ((d / numDots + t * 0.015) % 1 + 1) % 1;
        const idx = Math.floor(phase * (path.length - 1));
        const pt = path[idx]!;

        if (showPhaseColor) {
          const totalPhase = k * (idx - t * 2) + cumPhase[idx]!;
          ctx.fillStyle = phaseToColor(totalPhase, 0.9);
        } else {
          ctx.fillStyle = color;
        }

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Path label
      const labelIdx = Math.floor(path.length * 0.3);
      const labelPt = path[labelIdx]!;
      ctx.fillStyle = color;
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, labelPt.x, labelPt.y - 12);
    };

    drawPathWithPhase(pathA, cumA, "#f59e0b", "path a");
    drawPathWithPhase(pathB, cumB, "#60a5fa", "path b");

    // Source
    ctx.fillStyle = "#e8e8ef";
    ctx.beginPath();
    ctx.arc(SOURCE_X, SOURCE_Y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(232, 232, 239, 0.5)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("source", SOURCE_X, SOURCE_Y + 18);

    // Detection screen
    ctx.strokeStyle = "rgba(232, 232, 239, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(SCREEN_X, 60);
    ctx.lineTo(SCREEN_X, SCREEN_Y_MAX);
    ctx.stroke();
    ctx.fillStyle = "rgba(232, 232, 239, 0.4)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("screen", SCREEN_X, SCREEN_Y_MAX + 16);

    // Phase readout on canvas
    ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
    ctx.fillRect(CANVAS_W - 220, 8, 212, 62);
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`∫a A·dl = ${phaseA.toFixed(3)}`, CANVAS_W - 212, 24);
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`∫b A·dl = ${phaseB.toFixed(3)}`, CANVAS_W - 212, 38);
    ctx.fillStyle = "#e8e8ef";
    ctx.fillText(`Δφ = ${phaseDiff.toFixed(3)} rad`, CANVAS_W - 212, 52);
    ctx.fillStyle = "rgba(136, 136, 160, 0.5)";
    ctx.fillText(`   = ${(phaseDiff / (2 * Math.PI)).toFixed(3)} × 2π`, CANVAS_W - 212, 64);
  }, [flux, showPhaseColor, showAField, screenY]);

  // Animation loop — draws directly via ref, no React state updates
  useEffect(() => {
    let running = true;
    const animate = () => {
      if (!running) return;
      timeRef.current += speed;
      draw();
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [draw, speed]);

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      {/* Toggles */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setShowPhaseColor(!showPhaseColor)}
          className={[
            "px-2.5 py-1 rounded text-xs transition-colors",
            showPhaseColor
              ? "bg-[var(--color-accent)] text-white"
              : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
          ].join(" ")}
        >
          Phase coloring
        </button>
        <button
          onClick={() => setShowAField(!showAField)}
          className={[
            "px-2.5 py-1 rounded text-xs transition-colors",
            showAField
              ? "bg-[#6366f1] text-white"
              : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
          ].join(" ")}
        >
          Show A field
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

      {/* Speed slider */}
      <div>
        <label className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>Propagation speed</span>
          <span className="font-mono text-[var(--color-accent)]">
            {speed === 0 ? "paused" : `${speed.toFixed(2)}×`}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
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
          className="w-full max-w-[700px] rounded"
        />
      </div>

      {/* Description */}
      <div className="h-6 text-xs text-[var(--color-text-secondary)]">
        <span className="italic">
          Electrons travel from the source along two paths around the solenoid to the screen.
          The phase difference Δφ = (e/ℏc)Φ depends only on the enclosed flux.
        </span>
      </div>
    </div>
  );
}