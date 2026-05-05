import { useState, useRef, useEffect, useCallback } from "react";

/* ── Constants ────────────────────────────────────── */

const CANVAS_SIZE = 400;
const CENTER_X = CANVAS_SIZE / 2;
const CENTER_Y = CANVAS_SIZE / 2;
const DIAL_R = 140;
const INNER_R = 60;

/* ── Miniature interference pattern ──────────────── */

function sinc(x: number): number {
  if (Math.abs(x) < 1e-10) return 1;
  return Math.sin(x) / x;
}

function computeMiniPattern(flux: number, numPoints: number = 200): number[] {
  const wavelength = 2.0;
  const slitSep = 12;
  const slitWidth = 4;
  const screenDist = 1.5;
  const L = screenDist * 1000;
  const screenHalf = 5000;
  const intensities: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * 2 - 1;
    const x = t * screenHalf;
    const sinTheta = x / Math.sqrt(L * L + x * x);

    const intArg = Math.PI * slitSep * sinTheta / wavelength + Math.PI * flux;
    const diffArg = Math.PI * slitWidth * sinTheta / wavelength;

    intensities.push(Math.cos(intArg) ** 2 * sinc(diffArg) ** 2);
  }

  let max = 0;
  for (const v of intensities) if (v > max) max = v;
  if (max > 0) for (let i = 0; i < numPoints; i++) intensities[i] = intensities[i]! / max;

  return intensities;
}

/* ── Component ────────────────────────────────────── */

export function FluxQuantizationDial() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flux, setFlux] = useState(0);
  const [dragging, setDragging] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Outer dial ring
    ctx.strokeStyle = "rgba(42, 42, 58, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, DIAL_R, 0, Math.PI * 2);
    ctx.stroke();

    // Inner ring
    ctx.strokeStyle = "rgba(42, 42, 58, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, INNER_R, 0, Math.PI * 2);
    ctx.stroke();

    // Tick marks for integer flux quanta
    const maxQuanta = 4;
    for (let n = 0; n <= maxQuanta; n++) {
      const angle = (n / maxQuanta) * Math.PI * 2 - Math.PI / 2;
      const isInteger = true;

      // Major tick
      const outerX = CENTER_X + (DIAL_R + 8) * Math.cos(angle);
      const outerY = CENTER_Y + (DIAL_R + 8) * Math.sin(angle);
      const innerX = CENTER_X + (DIAL_R - 8) * Math.cos(angle);
      const innerY = CENTER_Y + (DIAL_R - 8) * Math.sin(angle);

      ctx.strokeStyle = isInteger ? "#f59e0b" : "rgba(136, 136, 160, 0.3)";
      ctx.lineWidth = isInteger ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.stroke();

      // Label
      const labelR = DIAL_R + 22;
      const labelX = CENTER_X + labelR * Math.cos(angle);
      const labelY = CENTER_Y + labelR * Math.sin(angle);
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${n}Φ₀`, labelX, labelY);

      // Minor ticks (quarter values)
      for (let m = 1; m < 4; m++) {
        const subAngle = ((n + m / 4) / maxQuanta) * Math.PI * 2 - Math.PI / 2;
        const sOuterX = CENTER_X + (DIAL_R + 3) * Math.cos(subAngle);
        const sOuterY = CENTER_Y + (DIAL_R + 3) * Math.sin(subAngle);
        const sInnerX = CENTER_X + (DIAL_R - 3) * Math.cos(subAngle);
        const sInnerY = CENTER_Y + (DIAL_R - 3) * Math.sin(subAngle);

        ctx.strokeStyle = "rgba(136, 136, 160, 0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sInnerX, sInnerY);
        ctx.lineTo(sOuterX, sOuterY);
        ctx.stroke();
      }
    }

    // Arc showing current flux position
    const startAngle = -Math.PI / 2;
    const endAngle = (flux / maxQuanta) * Math.PI * 2 - Math.PI / 2;

    // Filled arc
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, DIAL_R - 15, startAngle, endAngle);
    ctx.arc(CENTER_X, CENTER_Y, DIAL_R + 3, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = "rgba(99, 102, 241, 0.2)";
    ctx.fill();

    // Arc outline
    ctx.strokeStyle = "var(--color-accent)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, DIAL_R - 6, startAngle, endAngle);
    ctx.stroke();

    // Needle
    const needleAngle = (flux / maxQuanta) * Math.PI * 2 - Math.PI / 2;
    const needleX = CENTER_X + (DIAL_R - 6) * Math.cos(needleAngle);
    const needleY = CENTER_Y + (DIAL_R - 6) * Math.sin(needleAngle);

    ctx.strokeStyle = "var(--color-accent)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(CENTER_X, CENTER_Y);
    ctx.lineTo(needleX, needleY);
    ctx.stroke();

    // Needle tip dot
    ctx.fillStyle = "var(--color-accent)";
    ctx.beginPath();
    ctx.arc(needleX, needleY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Center dot
    ctx.fillStyle = "#e8e8ef";
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Flux value in center
    ctx.fillStyle = "#e8e8ef";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${flux.toFixed(2)}`, CENTER_X, CENTER_Y - 18);

    ctx.fillStyle = "rgba(136, 136, 160, 0.7)";
    ctx.font = "10px monospace";
    ctx.fillText("Φ / Φ₀", CENTER_X, CENTER_Y + 2);

    // Integer indicator
    const nearestInt = Math.round(flux);
    const distToInt = Math.abs(flux - nearestInt);
    if (distToInt < 0.03 && flux > 0.01) {
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 11px monospace";
      ctx.fillText("PATTERN RESET", CENTER_X, CENTER_Y + 22);
    }

    // Mini interference pattern below dial
    const pattern = computeMiniPattern(flux);
    const patternY = CANVAS_SIZE - 50;
    const patternW = CANVAS_SIZE - 60;
    const patternH = 35;
    const patternX0 = 30;

    // Pattern background
    ctx.fillStyle = "rgba(18, 18, 26, 0.8)";
    ctx.fillRect(patternX0 - 4, patternY - patternH - 4, patternW + 8, patternH + 8);
    ctx.strokeStyle = "rgba(42, 42, 58, 0.5)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(patternX0 - 4, patternY - patternH - 4, patternW + 8, patternH + 8);

    // Zero-flux reference
    const refPattern = computeMiniPattern(0);
    ctx.strokeStyle = "rgba(232, 232, 239, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < pattern.length; i++) {
      const px = patternX0 + (i / (pattern.length - 1)) * patternW;
      const py = patternY - refPattern[i]! * patternH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Current pattern
    ctx.strokeStyle = "var(--color-accent)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < pattern.length; i++) {
      const px = patternX0 + (i / (pattern.length - 1)) * patternW;
      const py = patternY - pattern[i]! * patternH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }, [flux]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Drag interaction on the dial
  const getFluxFromMouse = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): number => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return flux;
      const scaleX = CANVAS_SIZE / rect.width;
      const scaleY = CANVAS_SIZE / rect.height;
      const cx = (e.clientX - rect.left) * scaleX - CENTER_X;
      const cy = (e.clientY - rect.top) * scaleY - CENTER_Y;

      let angle = Math.atan2(cy, cx) + Math.PI / 2;
      if (angle < 0) angle += Math.PI * 2;
      const maxQuanta = 4;
      const newFlux = (angle / (Math.PI * 2)) * maxQuanta;
      return Math.max(0, Math.min(maxQuanta, newFlux));
    },
    [flux],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = CANVAS_SIZE / rect.width;
      const scaleY = CANVAS_SIZE / rect.height;
      const cx = (e.clientX - rect.left) * scaleX - CENTER_X;
      const cy = (e.clientY - rect.top) * scaleY - CENTER_Y;
      const r = Math.sqrt(cx * cx + cy * cy);

      // Only start drag if clicking near the dial
      if (r > INNER_R - 10 && r < DIAL_R + 30) {
        setDragging(true);
        setFlux(getFluxFromMouse(e));
      }
    },
    [getFluxFromMouse],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragging) {
        setFlux(getFluxFromMouse(e));
      }
    },
    [dragging, getFluxFromMouse],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      {/* Flux slider (alternative to drag) */}
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
          max={4}
          step={0.01}
          value={flux}
          onChange={(e) => setFlux(parseFloat(e.target.value))}
          className="w-full mt-1"
          style={{ accentColor: "var(--color-accent)" }}
        />
      </div>

      {/* Dial canvas */}
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="w-full max-w-[400px] rounded"
          style={{ cursor: dragging ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Description */}
      <div className="text-xs text-[var(--color-text-secondary)]">
        <span className="italic">
          Drag the dial or use the slider. The mini interference pattern at the bottom
          shifts as flux increases. At every integer multiple of Φ₀ (marked in amber),
          the pattern returns to its zero-flux position. The AB effect is periodic
          with period Φ₀ = hc/e.
        </span>
      </div>
    </div>
  );
}