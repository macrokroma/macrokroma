import { useState, useRef, useEffect, useCallback } from "react";

/* ── Physics ──────────────────────────────────────── */

/**
 * Lorentz transformation of E and B fields.
 * Given E and B in frame S, compute E' and B' in frame S' moving
 * with velocity v = β·c along the x-axis.
 *
 * In Gaussian units:
 *   E'_parallel = E_parallel
 *   E'_perp = γ(E_perp + β × B)
 *   B'_parallel = B_parallel
 *   B'_perp = γ(B_perp - β × E)
 *
 * For boost along x:
 *   E'_x = E_x
 *   E'_y = γ(E_y - β·B_z)
 *   E'_z = γ(E_z + β·B_y)
 *   B'_x = B_x
 *   B'_y = γ(B_y + β·E_z)
 *   B'_z = γ(B_z - β·E_y)
 */
function lorentzTransformEB(
  Ex: number, Ey: number, Ez: number,
  Bx: number, By: number, Bz: number,
  beta: number,
): { Ex: number; Ey: number; Ez: number; Bx: number; By: number; Bz: number } {
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  return {
    Ex: Ex,
    Ey: gamma * (Ey - beta * Bz),
    Ez: gamma * (Ez + beta * By),
    Bx: Bx,
    By: gamma * (By + beta * Ez),
    Bz: gamma * (Bz - beta * Ey),
  };
}

/**
 * Compute E and B fields from a point charge at (sx, sy) in 2D.
 * We work in the z=0 plane. The charge is at (sx, sy, 0).
 * E is radial (Coulomb). B = 0 for a stationary charge.
 */
function pointChargeField(
  x: number,
  y: number,
  sx: number,
  sy: number,
  q: number,
): { Ex: number; Ey: number; Ez: number; Bx: number; By: number; Bz: number } {
  const dx = x - sx;
  const dy = y - sy;
  const r2 = dx * dx + dy * dy + 0.04;
  const r3 = Math.pow(r2, 1.5);
  return {
    Ex: q * dx / r3,
    Ey: q * dy / r3,
    Ez: 0,
    Bx: 0,
    By: 0,
    Bz: 0,
  };
}

/* ── Presets ──────────────────────────────────────── */

type FieldPreset = {
  label: string;
  description: string;
  field: (x: number, y: number) => { Ex: number; Ey: number; Ez: number; Bx: number; By: number; Bz: number };
};

const PRESETS: FieldPreset[] = [
  {
    label: "Point charge",
    description: "A stationary positive charge has a pure E field and no B field. Boost to see a B field appear.",
    field: (x, y) => pointChargeField(x, y, 0, 0, 1),
  },
  {
    label: "Dipole",
    description: "Two opposite charges. In the rest frame, pure E field. The boost creates B around both charges.",
    field: (x, y) => {
      const f1 = pointChargeField(x, y, -0.6, 0, 1);
      const f2 = pointChargeField(x, y, 0.6, 0, -1);
      return {
        Ex: f1.Ex + f2.Ex, Ey: f1.Ey + f2.Ey, Ez: f1.Ez + f2.Ez,
        Bx: f1.Bx + f2.Bx, By: f1.By + f2.By, Bz: f1.Bz + f2.Bz,
      };
    },
  },
  {
    label: "Uniform E",
    description: "A uniform electric field in the y-direction. Boosting along x creates a uniform B_z component.",
    field: () => ({ Ex: 0, Ey: 1, Ez: 0, Bx: 0, By: 0, Bz: 0 }),
  },
  {
    label: "Uniform B",
    description: "A uniform magnetic field in the z-direction (out of page). Boosting along x creates an E_y component.",
    field: () => ({ Ex: 0, Ey: 0, Ez: 0, Bx: 0, By: 0, Bz: 1 }),
  },
  {
    label: "Crossed E and B",
    description: "Perpendicular E (y-direction) and B (z-direction). At a specific β, the fields can cancel in one frame.",
    field: () => ({ Ex: 0, Ey: 0.8, Ez: 0, Bx: 0, By: 0, Bz: 1 }),
  },
];

/* ── Drawing ──────────────────────────────────────── */

const PANEL_W = 272;
const PANEL_H = 272;
const CANVAS_W = PANEL_W * 2 + 16; // two panels + gap
const CANVAS_H = PANEL_H + 40; // panels + header
const FIELD_RANGE = 2.5;
const ARROW_GRID = 12;

function fieldToPanel(fx: number, fy: number, offsetX: number): [number, number] {
  const px = offsetX + ((fx + FIELD_RANGE) / (2 * FIELD_RANGE)) * PANEL_W;
  const py = 32 + ((FIELD_RANGE - fy) / (2 * FIELD_RANGE)) * PANEL_H;
  return [px, py];
}

function canvasToField(cx: number, panelOffsetX: number): [number, number] {
  const localX = cx - panelOffsetX;
  const fx = (localX / PANEL_W) * 2 * FIELD_RANGE - FIELD_RANGE;
  return [fx, 0]; // y computed separately
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vx: number,
  vy: number,
  color: string,
  alpha: number = 1,
  maxLen: number = 11,
) {
  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag < 0.001) return;

  const len = Math.min(Math.log(1 + mag * 2) * 8, maxLen);
  const nx = vx / mag;
  const ny = vy / mag;

  const tipX = x + nx * len;
  const tipY = y - ny * len;
  const baseX = x - nx * len * 0.15;
  const baseY = y + ny * len * 0.15;

  const headLen = len * 0.4;
  const cosA = Math.cos(0.45);
  const sinA = Math.sin(0.45);
  const dnx = nx;
  const dny = -ny;

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
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

function drawBzSymbol(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  bz: number,
  alpha: number = 1,
) {
  if (Math.abs(bz) < 0.01) return;

  const size = Math.min(Math.abs(bz) * 3, 4);
  ctx.globalAlpha = alpha;

  if (bz > 0) {
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 0.8;
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

type ShowMode = "E" | "B" | "both";

/* ── Component ────────────────────────────────────── */

export function LorentzTransformExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [presetIdx, setPresetIdx] = useState(0);
  const [beta, setBeta] = useState(0);
  const [showMode, setShowMode] = useState<ShowMode>("both");
  const [probe, setProbe] = useState<{ x: number; y: number; panel: "left" | "right" } | null>(null);

  const preset = PRESETS[presetIdx]!;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const leftX = 0;
    const rightX = PANEL_W + 16;

    // Panel backgrounds
    ctx.fillStyle = "#12121a";
    ctx.fillRect(leftX, 32, PANEL_W, PANEL_H);
    ctx.fillRect(rightX, 32, PANEL_W, PANEL_H);

    // Panel borders
    ctx.strokeStyle = "var(--color-border)";
    ctx.strokeStyle = "#2a2a3a";
    ctx.lineWidth = 1;
    ctx.strokeRect(leftX, 32, PANEL_W, PANEL_H);
    ctx.strokeRect(rightX, 32, PANEL_W, PANEL_H);

    // Headers
    ctx.fillStyle = "#e8e8ef";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Rest frame S", leftX + PANEL_W / 2, 20);
    ctx.fillText(`Boosted frame S'  (β = ${beta.toFixed(2)})`, rightX + PANEL_W / 2, 20);

    // Grid lines on both panels
    ctx.strokeStyle = "rgba(42, 42, 58, 0.25)";
    ctx.lineWidth = 0.5;
    const step = PANEL_W / ARROW_GRID;
    for (let panel = 0; panel < 2; panel++) {
      const ox = panel === 0 ? leftX : rightX;
      for (let i = 0; i <= ARROW_GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + i * step, 32);
        ctx.lineTo(ox + i * step, 32 + PANEL_H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox, 32 + i * step);
        ctx.lineTo(ox + PANEL_W, 32 + i * step);
        ctx.stroke();
      }
    }

    // Velocity arrow between panels
    if (Math.abs(beta) > 0.01) {
      const arrowY = 20;
      const arrowLen = 30 * Math.abs(beta);
      const midX = PANEL_W + 8;
      const dir = beta > 0 ? 1 : -1;
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(midX - dir * arrowLen * 0.5, arrowY);
      ctx.lineTo(midX + dir * arrowLen * 0.5, arrowY);
      ctx.stroke();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(midX + dir * arrowLen * 0.5, arrowY);
      ctx.lineTo(midX + dir * (arrowLen * 0.5 - 5), arrowY - 3);
      ctx.lineTo(midX + dir * (arrowLen * 0.5 - 5), arrowY + 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f59e0b";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("v", midX, arrowY + 12);
    }

    // Draw fields on both panels
    for (let panel = 0; panel < 2; panel++) {
      const ox = panel === 0 ? leftX : rightX;

      for (let i = 0; i < ARROW_GRID; i++) {
        for (let j = 0; j < ARROW_GRID; j++) {
          const px = ox + (i + 0.5) * step;
          const py = 32 + (j + 0.5) * step;

          const fx = (i + 0.5) / ARROW_GRID * 2 * FIELD_RANGE - FIELD_RANGE;
          const fy = FIELD_RANGE - (j + 0.5) / ARROW_GRID * 2 * FIELD_RANGE;

          const rest = preset.field(fx, fy);

          let Ex: number, Ey: number, Bz: number;
          if (panel === 0) {
            Ex = rest.Ex;
            Ey = rest.Ey;
            Bz = rest.Bz;
          } else {
            const boosted = lorentzTransformEB(
              rest.Ex, rest.Ey, rest.Ez,
              rest.Bx, rest.By, rest.Bz,
              beta,
            );
            Ex = boosted.Ex;
            Ey = boosted.Ey;
            Bz = boosted.Bz;
          }

          // Draw E arrows (in the x-y plane)
          if (showMode === "E" || showMode === "both") {
            drawArrow(ctx, px, py, Ex, Ey, "#ef4444", 0.55);
          }

          // Draw B_z symbols (out of / into page)
          if (showMode === "B" || showMode === "both") {
            drawBzSymbol(ctx, px, py, Bz, 0.5);
          }
        }
      }
    }

    // Probe
    if (probe) {
      const ox = probe.panel === "left" ? leftX : rightX;
      const [px, py] = fieldToPanel(probe.x, probe.y, ox);

      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Panel labels
    ctx.fillStyle = "rgba(136, 136, 160, 0.4)";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText("x", leftX + PANEL_W - 10, 32 + PANEL_H / 2 - 4);
    ctx.fillText("y", leftX + PANEL_W / 2 + 4, 40);
    ctx.fillText("x'", rightX + PANEL_W - 14, 32 + PANEL_H / 2 - 4);
    ctx.fillText("y'", rightX + PANEL_W / 2 + 4, 40);

    // Legend on canvas
    ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
    ctx.fillRect(rightX + PANEL_W - 120, 32 + PANEL_H - 34, 116, 30);
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    if (showMode === "E" || showMode === "both") {
      ctx.fillStyle = "#ef4444";
      ctx.fillText("→ E (electric)", rightX + PANEL_W - 114, 32 + PANEL_H - 20);
    }
    if (showMode === "B" || showMode === "both") {
      ctx.fillStyle = "#22c55e";
      ctx.fillText("⊙/⊗ B_z (magnetic)", rightX + PANEL_W - 114, 32 + PANEL_H - 8);
    }
  }, [preset, beta, showMode, probe]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      const rightX = PANEL_W + 16;

      let panel: "left" | "right" | null = null;
      let panelOx = 0;
      if (cx >= 0 && cx <= PANEL_W && cy >= 32 && cy <= 32 + PANEL_H) {
        panel = "left";
        panelOx = 0;
      } else if (cx >= rightX && cx <= rightX + PANEL_W && cy >= 32 && cy <= 32 + PANEL_H) {
        panel = "right";
        panelOx = rightX;
      }

      if (panel) {
        const fx = ((cx - panelOx) / PANEL_W) * 2 * FIELD_RANGE - FIELD_RANGE;
        const fy = FIELD_RANGE - ((cy - 32) / PANEL_H) * 2 * FIELD_RANGE;
        setProbe({ x: fx, y: fy, panel });
      } else {
        setProbe(null);
      }
    },
    [],
  );

  // Probe readouts
  let probeRest = { Ex: 0, Ey: 0, Ez: 0, Bx: 0, By: 0, Bz: 0 };
  let probeBoosted = { Ex: 0, Ey: 0, Ez: 0, Bx: 0, By: 0, Bz: 0 };
  if (probe) {
    probeRest = preset.field(probe.x, probe.y);
    probeBoosted = lorentzTransformEB(
      probeRest.Ex, probeRest.Ey, probeRest.Ez,
      probeRest.Bx, probeRest.By, probeRest.Bz,
      beta,
    );
  }

  // Lorentz invariants
  const invEB = probe
    ? (probeRest.Ex * probeRest.Bx + probeRest.Ey * probeRest.By + probeRest.Ez * probeRest.Bz)
    : 0;
  const invE2B2 = probe
    ? (probeRest.Ex ** 2 + probeRest.Ey ** 2 + probeRest.Ez ** 2
      - probeRest.Bx ** 2 - probeRest.By ** 2 - probeRest.Bz ** 2)
    : 0;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => { setPresetIdx(i); setBeta(0); }}
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

      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
        {preset.description}
      </p>

      {/* Show mode */}
      <div className="flex gap-1.5">
        {(["E", "B", "both"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setShowMode(mode)}
            className={[
              "px-2.5 py-1 rounded text-xs transition-colors",
              showMode === mode
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            {mode === "E" && "E only"}
            {mode === "B" && "B only"}
            {mode === "both" && "E + B"}
          </button>
        ))}
      </div>

      {/* Beta slider */}
      <div>
        <label className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>Boost velocity (β = v/c)</span>
          <span className="font-mono text-[var(--color-accent)]">
            {beta.toFixed(2)} c
            <span className="text-[var(--color-text-secondary)] ml-2">
              (γ = {(1 / Math.sqrt(1 - beta * beta)).toFixed(2)})
            </span>
          </span>
        </label>
        <input
          type="range"
          min={-0.95}
          max={0.95}
          step={0.01}
          value={beta}
          onChange={(e) => setBeta(parseFloat(e.target.value))}
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
              <span className="text-[var(--color-text-primary)]">S:</span>{" "}
              <span className="text-[#ef4444]">E</span> = ({probeRest.Ex.toFixed(2)}, {probeRest.Ey.toFixed(2)}, {probeRest.Ez.toFixed(2)}){" · "}
              <span className="text-[#22c55e]">B</span> = ({probeRest.Bx.toFixed(2)}, {probeRest.By.toFixed(2)}, {probeRest.Bz.toFixed(2)})
            </span>
            <span>
              <span className="text-[var(--color-text-primary)]">S':</span>{" "}
              <span className="text-[#ef4444]">E'</span> = ({probeBoosted.Ex.toFixed(2)}, {probeBoosted.Ey.toFixed(2)}, {probeBoosted.Ez.toFixed(2)}){" · "}
              <span className="text-[#22c55e]">B'</span> = ({probeBoosted.Bx.toFixed(2)}, {probeBoosted.By.toFixed(2)}, {probeBoosted.Bz.toFixed(2)})
            </span>
            <span className="text-[var(--color-text-secondary)]">
              Invariants: E·B = {invEB.toFixed(3)} · E²−B² = {invE2B2.toFixed(3)}
            </span>
          </div>
        ) : (
          <span className="italic">
            Drag the β slider to boost. Hover either panel to see field values in both frames. The invariants E·B and E²−B² are the same in every frame.
          </span>
        )}
      </div>
    </div>
  );
}