import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";

/* ── Physics (reused from other components) ───────── */

function sinc(x: number): number {
  if (Math.abs(x) < 1e-10) return 1;
  return Math.sin(x) / x;
}

function computePattern(
  numPoints: number,
  flux: number,
): { intensities: Float64Array; envelope: Float64Array } {
  const wavelength = 2.0;
  const slitSep = 12;
  const slitWidth = 4;
  const screenDist = 1.5;
  const L = screenDist * 1000;
  const screenHalfWidth = 5000;

  const intensities = new Float64Array(numPoints);
  const envelope = new Float64Array(numPoints);
  const abPhase = 2 * Math.PI * flux;

  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * 2 - 1;
    const x = t * screenHalfWidth;
    const sinTheta = x / Math.sqrt(L * L + x * x);

    const intArg = Math.PI * slitSep * sinTheta / wavelength + abPhase / 2;
    const diffArg = Math.PI * slitWidth * sinTheta / wavelength;

    intensities[i] = Math.cos(intArg) ** 2 * sinc(diffArg) ** 2;
    envelope[i] = sinc(diffArg) ** 2;
  }

  let max = 0;
  for (let i = 0; i < numPoints; i++) if (intensities[i]! > max) max = intensities[i]!;
  if (max > 0) for (let i = 0; i < numPoints; i++) intensities[i] = intensities[i]! / max;

  return { intensities, envelope };
}

/* ── Geometry canvas (left panel) ─────────────────── */

const GEO_W = 340;
const GEO_H = 340;
const SOL_X = 170;
const SOL_Y = 170;
const SOL_R = 28;

function drawGeometry(
  ctx: CanvasRenderingContext2D,
  flux: number,
  timeVal: number,
) {
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, GEO_W, GEO_H);

  // Grid
  ctx.strokeStyle = "rgba(42, 42, 58, 0.15)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x < GEO_W; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GEO_H); ctx.stroke();
  }
  for (let y = 0; y < GEO_H; y += 30) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GEO_W, y); ctx.stroke();
  }

  // A field arrows
  if (Math.abs(flux) > 0.01) {
    const gridStep = 30;
    for (let gx = gridStep / 2; gx < GEO_W; gx += gridStep) {
      for (let gy = gridStep / 2; gy < GEO_H; gy += gridStep) {
        const rx = gx - SOL_X;
        const ry = gy - SOL_Y;
        const r = Math.sqrt(rx * rx + ry * ry);
        if (r < SOL_R + 6 || r < 1) continue;

        const aMag = flux / (2 * Math.PI * r);
        const dx = -ry / r;
        const dy = rx / r;
        const len = Math.min(aMag * 6000, 10);
        if (len < 1.5) continue;

        const tipX = gx + dx * len;
        const tipY = gy + dy * len;
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = "#818cf8";
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(tipX, tipY); ctx.stroke();
        ctx.fillStyle = "#818cf8";
        const perpX = -dy;
        const perpY = dx;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - dx * 3 + perpX * 1.5, tipY - dy * 3 + perpY * 1.5);
        ctx.lineTo(tipX - dx * 3 - perpX * 1.5, tipY - dy * 3 - perpY * 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Solenoid
  ctx.fillStyle = "rgba(42, 42, 58, 0.5)";
  ctx.beginPath();
  ctx.arc(SOL_X, SOL_Y, SOL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(232, 232, 239, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(SOL_X, SOL_Y, SOL_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (Math.abs(flux) > 0.01) {
    ctx.fillStyle = "#22c55e";
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(SOL_X, SOL_Y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(SOL_X, SOL_Y, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Paths
  const srcX = 30, srcY = SOL_Y;
  const scrX = 310, scrY = SOL_Y;
  const clearance = SOL_R + 16;

  const drawPath = (side: number, color: string) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const mt = 1 - t;
      const x = mt * mt * mt * srcX + 3 * mt * mt * t * (SOL_X - 40) + 3 * mt * t * t * (SOL_X + 40) + t * t * t * scrX;
      const y = mt * mt * mt * srcY + 3 * mt * mt * t * (SOL_Y + side * clearance * 1.2) + 3 * mt * t * t * (SOL_Y + side * clearance) + t * t * t * scrY;
      pts.push([x, y]);
    }

    // Phase coloring
    let cumPhase = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i]!;
      const [x2, y2] = pts[i + 1]!;
      const mx = ((x1 + x2) / 2) - SOL_X;
      const my = ((y1 + y2) / 2) - SOL_Y;
      const r = Math.sqrt(mx * mx + my * my);
      if (r > 1) {
        const aMag = flux / (2 * Math.PI * r);
        cumPhase += aMag * ((-my / r) * (x2 - x1) + (mx / r) * (y2 - y1));
      }

      const phase = 0.15 * (i - timeVal * 2) + cumPhase;
      const hue = ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      ctx.strokeStyle = `hsla(${(hue / (2 * Math.PI)) * 360}, 80%, 60%, 0.8)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Wavefront dots
    for (let d = 0; d < 6; d++) {
      const phase = ((d / 6 + timeVal * 0.015) % 1 + 1) % 1;
      const idx = Math.floor(phase * (pts.length - 1));
      const [px, py] = pts[idx]!;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  };

  drawPath(-1, "#f59e0b"); // above
  drawPath(1, "#60a5fa");  // below

  // Source and screen
  ctx.fillStyle = "#e8e8ef";
  ctx.beginPath();
  ctx.arc(srcX, srcY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(232, 232, 239, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(scrX, SOL_Y - 80);
  ctx.lineTo(scrX, SOL_Y + 80);
  ctx.stroke();

  // Labels
  ctx.fillStyle = "rgba(232, 232, 239, 0.4)";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("source", srcX, srcY + 14);
  ctx.fillText("screen", scrX, SOL_Y + 92);
  ctx.fillText("solenoid", SOL_X, SOL_Y - SOL_R - 6);
}

/* ── Chart (right panel) ──────────────────────────── */

const CHART_W = 340;
const CHART_H = 340;
const CM = { top: 30, right: 10, bottom: 30, left: 40 };
const CP_W = CHART_W - CM.left - CM.right;
const CP_H = CHART_H - CM.top - CM.bottom;
const NUM_PTS = 400;

function drawChart(
  ctx: CanvasRenderingContext2D,
  flux: number,
) {
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, CHART_W, CHART_H);

  const current = computePattern(NUM_PTS, flux);
  const zeroFlux = computePattern(NUM_PTS, 0);
  const screenHalf = 5000;

  const toX = (i: number) => CM.left + (i / (NUM_PTS - 1)) * CP_W;
  const toY = (v: number) => CM.top + (1 - v) * CP_H;

  // Grid
  ctx.strokeStyle = "rgba(42, 42, 58, 0.3)";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = CM.top + (i / 4) * CP_H;
    ctx.beginPath(); ctx.moveTo(CM.left, y); ctx.lineTo(CM.left + CP_W, y); ctx.stroke();
  }
  for (let i = 0; i <= 6; i++) {
    const x = CM.left + (i / 6) * CP_W;
    ctx.beginPath(); ctx.moveTo(x, CM.top); ctx.lineTo(x, CM.top + CP_H); ctx.stroke();
  }

  // Plot border
  ctx.strokeStyle = "rgba(42, 42, 58, 0.5)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(CM.left, CM.top, CP_W, CP_H);

  // Zero-flux ghost
  ctx.strokeStyle = "rgba(232, 232, 239, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < NUM_PTS; i++) {
    const x = toX(i);
    const y = toY(zeroFlux.intensities[i]!);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Current pattern
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < NUM_PTS; i++) {
    const x = toX(i);
    const y = toY(current.intensities[i]!);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = "rgba(136, 136, 160, 0.6)";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Screen position", CM.left + CP_W / 2, CHART_H - 6);

  ctx.save();
  ctx.translate(10, CM.top + CP_H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Intensity", 0, 0);
  ctx.restore();

  // Y-axis ticks
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const v = i / 4;
    ctx.fillText(v.toFixed(1), CM.left - 4, toY(v) + 3);
  }

  // Title
  ctx.fillStyle = "#e8e8ef";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Interference Pattern", CM.left + CP_W / 2, 16);

  // Flux label
  ctx.fillStyle = "#6366f1";
  ctx.textAlign = "right";
  ctx.fillText(`Φ/Φ₀ = ${flux.toFixed(2)}`, CM.left + CP_W - 4, 16);
}

/* ── Component ────────────────────────────────────── */

export function ABLinkedView() {
  const geoCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const [flux, setFlux] = useState(0);
  const timeRef = useRef(0);
  const animRef = useRef<number>(0);

  const drawAll = useCallback(() => {
    const geoCtx = geoCanvasRef.current?.getContext("2d");
    const chartCtx = chartCanvasRef.current?.getContext("2d");
    if (geoCtx) drawGeometry(geoCtx, flux, timeRef.current);
    if (chartCtx) drawChart(chartCtx, flux);
  }, [flux]);

  // Animation loop
  useEffect(() => {
    let running = true;
    const animate = () => {
      if (!running) return;
      timeRef.current += 0.5;
      drawAll();
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [drawAll]);

  // Phase info
  const abPhase = 2 * Math.PI * flux;
  const nearestInt = Math.round(flux);
  const isQuantized = Math.abs(flux - nearestInt) < 0.03 && flux > 0.01;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      {/* Flux slider */}
      <div>
        <label className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>Enclosed flux (Φ/Φ₀)</span>
          <span className="font-mono text-[var(--color-accent)]">
            {flux.toFixed(2)}
            {isQuantized && (
              <span className="text-[var(--color-warning)] ml-2">
                integer — pattern resets
              </span>
            )}
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

      {/* Phase readout */}
      <div className="flex gap-4 text-xs font-mono text-[var(--color-text-secondary)]">
        <span>Δφ = <span className="text-[var(--color-accent)]">{abPhase.toFixed(3)}</span> rad</span>
        <span>= <span className="text-[var(--color-accent)]">{flux.toFixed(2)}</span> × 2π</span>
      </div>

      {/* Side-by-side canvases */}
      <div className="flex justify-center gap-2 flex-wrap">
        <canvas
          ref={geoCanvasRef}
          width={GEO_W}
          height={GEO_H}
          className="rounded border border-[var(--color-border)]"
          style={{ width: "340px", height: "340px" }}
        />
        <canvas
          ref={chartCanvasRef}
          width={CHART_W}
          height={CHART_H}
          className="rounded border border-[var(--color-border)]"
          style={{ width: "340px", height: "340px" }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-0.5 bg-[var(--color-accent)] rounded" />
          Current pattern (Φ/Φ₀ = {flux.toFixed(2)})
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-0.5 bg-[#e8e8ef] rounded opacity-20" />
          Zero-flux reference
        </span>
      </div>

      {/* Description */}
      <div className="text-xs text-[var(--color-text-secondary)] italic">
        Left: the AB geometry with phase-colored electron paths and the vector
        potential (purple arrows) circulating around the solenoid. Right: the
        resulting interference pattern. Both respond to the same flux slider.
      </div>
    </div>
  );
}