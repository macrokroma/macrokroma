import { useState, useRef, useEffect, useCallback } from "react";

/* ── Simulation constants ─────────────────────────── */

const N = 256; // Grid size (N x N)
const CANVAS_SIZE = 560;
const DX = 0.15; // Spatial step
const DT = 0.008; // Time step
const STEPS_PER_FRAME = 3; // Sub-steps per animation frame

// Physical layout in grid coordinates
const SLIT_X = Math.floor(N * 0.35); // Barrier position
const SLIT_WIDTH = 3; // Each slit width in grid cells
const SLIT_SEP = 20; // Center-to-center separation
const SLIT_Y1 = Math.floor(N / 2) - Math.floor(SLIT_SEP / 2);
const SLIT_Y2 = Math.floor(N / 2) + Math.floor(SLIT_SEP / 2);
const BARRIER_STRENGTH = 80; // Potential barrier height

const SOLENOID_X = Math.floor(N * 0.5);
const SOLENOID_Y = Math.floor(N / 2);
const SOLENOID_R = 8; // Radius in grid cells

/* ── Complex array helpers ────────────────────────── */

// Store as interleaved [re0, im0, re1, im1, ...]
function createComplexArray(n: number): Float64Array {
  return new Float64Array(n * 2);
}

function setComplex(arr: Float64Array, i: number, re: number, im: number) {
  arr[i * 2] = re;
  arr[i * 2 + 1] = im;
}

function getRe(arr: Float64Array, i: number): number {
  return arr[i * 2]!;
}

function getIm(arr: Float64Array, i: number): number {
  return arr[i * 2 + 1]!;
}

function magnitude2(arr: Float64Array, i: number): number {
  const re = arr[i * 2]!;
  const im = arr[i * 2 + 1]!;
  return re * re + im * im;
}

/* ── Simple 1D FFT (Cooley-Tukey) ─────────────────── */

function fft1d(reArr: Float64Array, imArr: Float64Array, n: number, inverse: boolean) {
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      let tmp = reArr[i]!; reArr[i] = reArr[j]!; reArr[j] = tmp;
      tmp = imArr[i]!; imArr[i] = imArr[j]!; imArr[j] = tmp;
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) { j -= m; m >>= 1; }
    j += m;
  }

  // Butterfly
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len *= 2) {
    const halfLen = len / 2;
    const angle = (sign * 2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < halfLen; k++) {
        const evenIdx = i + k;
        const oddIdx = i + k + halfLen;
        const tRe = curRe * reArr[oddIdx]! - curIm * imArr[oddIdx]!;
        const tIm = curRe * imArr[oddIdx]! + curIm * reArr[oddIdx]!;
        reArr[oddIdx] = reArr[evenIdx]! - tRe;
        imArr[oddIdx] = imArr[evenIdx]! - tIm;
        reArr[evenIdx] = reArr[evenIdx]! + tRe;
        imArr[evenIdx] = imArr[evenIdx]! + tIm;
        const newCurRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newCurRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      reArr[i] = reArr[i]! / n;
      imArr[i] = imArr[i]! / n;
    }
  }
}

/* ── 2D FFT ───────────────────────────────────────── */

function fft2d(psiRe: Float64Array, psiIm: Float64Array, n: number, inverse: boolean) {
  const rowRe = new Float64Array(n);
  const rowIm = new Float64Array(n);

  // Transform rows
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      rowRe[x] = psiRe[y * n + x]!;
      rowIm[x] = psiIm[y * n + x]!;
    }
    fft1d(rowRe, rowIm, n, inverse);
    for (let x = 0; x < n; x++) {
      psiRe[y * n + x] = rowRe[x]!;
      psiIm[y * n + x] = rowIm[x]!;
    }
  }

  // Transform columns
  const colRe = new Float64Array(n);
  const colIm = new Float64Array(n);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      colRe[y] = psiRe[y * n + x]!;
      colIm[y] = psiIm[y * n + x]!;
    }
    fft1d(colRe, colIm, n, inverse);
    for (let y = 0; y < n; y++) {
      psiRe[y * n + x] = colRe[y]!;
      psiIm[y * n + x] = colIm[y]!;
    }
  }
}

/* ── Potential and vector potential ────────────────── */

function buildBarrierPotential(n: number): Float64Array {
  const V = new Float64Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // Barrier with two slits
      if (x >= SLIT_X - 1 && x <= SLIT_X + 1) {
        const inSlit1 = Math.abs(y - SLIT_Y1) < SLIT_WIDTH;
        const inSlit2 = Math.abs(y - SLIT_Y2) < SLIT_WIDTH;
        if (!inSlit1 && !inSlit2) {
          V[y * n + x] = BARRIER_STRENGTH;
        }
      }

      // Solenoid core (hard wall)
      const dx = x - SOLENOID_X;
      const dy = y - SOLENOID_Y;
      if (dx * dx + dy * dy < SOLENOID_R * SOLENOID_R) {
        V[y * n + x] = BARRIER_STRENGTH;
      }

      // Absorbing boundary (smooth ramp at edges)
      const edgeDist = Math.min(x, y, n - 1 - x, n - 1 - y);
      if (edgeDist < 15) {
        const ramp = (15 - edgeDist) / 15;
        V[y * n + x] = (V[y * n + x] ?? 0) + 5 * ramp * ramp;
      }
    }
  }
  return V;
}

function buildVectorPotentialPhase(n: number, flux: number, dt: number): Float64Array {
  // Phase from A·p coupling: we incorporate this as an additional
  // position-space phase in the split-operator scheme
  // For the solenoid: A_theta = Phi/(2*pi*r) outside, A_theta = Phi*r/(2*pi*R^2) inside
  const phase = new Float64Array(n * n);

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x - SOLENOID_X) * DX;
      const dy = (y - SOLENOID_Y) * DX;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < 0.001) continue;

      const R = SOLENOID_R * DX;
      let aMag: number;
      if (r < R) {
        aMag = (flux * r) / (2 * Math.PI * R * R);
      } else {
        aMag = flux / (2 * Math.PI * r);
      }

      // A² term contributes to the effective potential
      phase[y * n + x] = (aMag * aMag) * dt * 0.5;
    }
  }
  return phase;
}

/* ── Kinetic phase in momentum space ──────────────── */

function buildKineticPhase(n: number, dt: number): Float64Array {
  const phase = new Float64Array(n * n);
  const dk = (2 * Math.PI) / (n * DX);

  for (let ky = 0; ky < n; ky++) {
    for (let kx = 0; kx < n; kx++) {
      const kxVal = kx < n / 2 ? kx * dk : (kx - n) * dk;
      const kyVal = ky < n / 2 ? ky * dk : (ky - n) * dk;
      phase[ky * n + kx] = -(kxVal * kxVal + kyVal * kyVal) * dt * 0.5;
    }
  }
  return phase;
}

/* ── Initial wavepacket ───────────────────────────── */

function initWavepacket(
  psiRe: Float64Array,
  psiIm: Float64Array,
  n: number,
) {
  const cx = N * 0.15; // Start position
  const cy = N / 2;
  const sigma = 12; // Width
  const k0 = 4.0; // Initial momentum (rightward)

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const gauss = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      const phase = k0 * dx * DX;
      psiRe[y * n + x] = gauss * Math.cos(phase);
      psiIm[y * n + x] = gauss * Math.sin(phase);
    }
  }
}

/* ── Rendering ────────────────────────────────────── */

function phaseToHue(re: number, im: number): number {
  return ((Math.atan2(im, re) / (2 * Math.PI)) + 1) % 1;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 1 / 6) { r = c; g = x; }
  else if (h < 2 / 6) { r = x; g = c; }
  else if (h < 3 / 6) { g = c; b = x; }
  else if (h < 4 / 6) { g = x; b = c; }
  else if (h < 5 / 6) { r = x; b = c; }
  else { r = c; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function renderToImageData(
  psiRe: Float64Array,
  psiIm: Float64Array,
  n: number,
  V: Float64Array,
  imageData: ImageData,
  showPhase: boolean,
) {
  // Find max density for normalization
  let maxDensity = 0;
  for (let i = 0; i < n * n; i++) {
    const d = psiRe[i]! * psiRe[i]! + psiIm[i]! * psiIm[i]!;
    if (d > maxDensity) maxDensity = d;
  }
  if (maxDensity < 1e-10) maxDensity = 1;

  const scale = CANVAS_SIZE / n;
  const data = imageData.data;

  for (let y = 0; y < CANVAS_SIZE; y++) {
    for (let x = 0; x < CANVAS_SIZE; x++) {
      const gx = Math.floor(x / scale);
      const gy = Math.floor(y / scale);
      const idx = gy * n + gx;

      const re = psiRe[idx]!;
      const im = psiIm[idx]!;
      const density = (re * re + im * im) / maxDensity;

      const px = (y * CANVAS_SIZE + x) * 4;

      // Barrier visualization
      if (V[idx]! > 10) {
        data[px] = 40;
        data[px + 1] = 40;
        data[px + 2] = 55;
        data[px + 3] = 255;
        continue;
      }

      if (showPhase && density > 0.001) {
        const hue = phaseToHue(re, im);
        const brightness = Math.pow(density, 0.4); // Gamma for visibility
        const [r, g, b] = hslToRgb(hue, 0.85, brightness * 0.5);
        data[px] = r;
        data[px + 1] = g;
        data[px + 2] = b;
        data[px + 3] = 255;
      } else {
        // Grayscale probability density
        const brightness = Math.pow(density, 0.4) * 255;
        data[px] = brightness * 0.7;
        data[px + 1] = brightness * 0.75;
        data[px + 2] = brightness;
        data[px + 3] = 255;
      }
    }
  }
}

/* ── Component ────────────────────────────────────── */

export function WavefunctionEvolution() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flux, setFlux] = useState(0);
  const [showPhase, setShowPhase] = useState(true);
  const [running, setRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const psiReRef = useRef(new Float64Array(N * N));
  const psiImRef = useRef(new Float64Array(N * N));
  const barrierRef = useRef(buildBarrierPotential(N));
  const kineticPhaseRef = useRef(buildKineticPhase(N, DT));
  const animRef = useRef<number>(0);
  const imageDataRef = useRef<ImageData | null>(null);
  const fluxRef = useRef(flux);

  // Keep flux ref in sync
  useEffect(() => {
    fluxRef.current = flux;
  }, [flux]);

  const reset = useCallback(() => {
    psiReRef.current.fill(0);
    psiImRef.current.fill(0);
    initWavepacket(psiReRef.current, psiImRef.current, N);
    setHasStarted(false);
    setRunning(false);

    // Render initial state
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!imageDataRef.current) {
      imageDataRef.current = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
    }
    renderToImageData(
      psiReRef.current, psiImRef.current, N,
      barrierRef.current, imageDataRef.current, showPhase,
    );
    ctx.putImageData(imageDataRef.current, 0, 0);
  }, [showPhase]);

  // Initialize on mount
  useEffect(() => {
    reset();
  }, [reset]);

  // Time evolution step
  const evolveStep = useCallback(() => {
    const psiRe = psiReRef.current;
    const psiIm = psiImRef.current;
    const V = barrierRef.current;
    const kPhase = kineticPhaseRef.current;
    const currentFlux = fluxRef.current;

    // Half-step potential phase
    const aPhase = buildVectorPotentialPhase(N, currentFlux, DT);
    for (let i = 0; i < N * N; i++) {
      const vPhase = -(V[i]! + aPhase[i]!) * DT * 0.5;
      const cos = Math.cos(vPhase);
      const sin = Math.sin(vPhase);
      const re = psiRe[i]!;
      const im = psiIm[i]!;
      psiRe[i] = re * cos - im * sin;
      psiIm[i] = re * sin + im * cos;
    }

    // FFT to momentum space
    fft2d(psiRe, psiIm, N, false);

    // Kinetic phase
    for (let i = 0; i < N * N; i++) {
      const cos = Math.cos(kPhase[i]!);
      const sin = Math.sin(kPhase[i]!);
      const re = psiRe[i]!;
      const im = psiIm[i]!;
      psiRe[i] = re * cos - im * sin;
      psiIm[i] = re * sin + im * cos;
    }

    // Inverse FFT back to position space
    fft2d(psiRe, psiIm, N, true);

    // Half-step potential phase
    for (let i = 0; i < N * N; i++) {
      const vPhase = -(V[i]! + aPhase[i]!) * DT * 0.5;
      const cos = Math.cos(vPhase);
      const sin = Math.sin(vPhase);
      const re = psiRe[i]!;
      const im = psiIm[i]!;
      psiRe[i] = re * cos - im * sin;
      psiIm[i] = re * sin + im * cos;
    }
  }, []);

  // Animation loop
  useEffect(() => {
    if (!running) return;

    let active = true;
    const animate = () => {
      if (!active) return;

      for (let s = 0; s < STEPS_PER_FRAME; s++) {
        evolveStep();
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          if (!imageDataRef.current) {
            imageDataRef.current = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
          }
          renderToImageData(
            psiReRef.current, psiImRef.current, N,
            barrierRef.current, imageDataRef.current, showPhase,
          );
          ctx.putImageData(imageDataRef.current, 0, 0);
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      active = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [running, evolveStep, showPhase]);

  const handleStart = () => {
    if (!hasStarted) {
      reset();
      setHasStarted(true);
    }
    setRunning(true);
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] not-prose">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <button
            onClick={handleStart}
            className={[
              "px-3 py-1.5 rounded text-xs transition-colors",
              running
                ? "bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
                : "bg-[var(--color-accent)] text-white",
            ].join(" ")}
            disabled={running}
          >
            {hasStarted ? "Resume" : "Start"}
          </button>
          {running && (
            <button
              onClick={() => setRunning(false)}
              className="px-3 py-1.5 rounded text-xs bg-[var(--color-warning)] text-white transition-colors"
            >
              Pause
            </button>
          )}
          <button
            onClick={reset}
            className="px-3 py-1.5 rounded text-xs bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Reset
          </button>
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={() => setShowPhase(!showPhase)}
            className={[
              "px-2.5 py-1 rounded text-xs transition-colors",
              showPhase
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            {showPhase ? "Phase + density" : "Density only"}
          </button>
        </div>
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
          max={2}
          step={0.01}
          value={flux}
          onChange={(e) => setFlux(parseFloat(e.target.value))}
          className="w-full mt-1"
          style={{ accentColor: "var(--color-accent)" }}
        />
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
          Set the flux before starting, or adjust during propagation to see the effect in real time.
        </p>
      </div>

      {/* Canvas */}
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="w-full max-w-[560px] rounded"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
        {showPhase ? (
          <>
            <span>Color = phase of ψ (red → yellow → green → cyan → blue → magenta → red)</span>
            <span>Brightness = probability density |ψ|²</span>
          </>
        ) : (
          <span>Brightness = probability density |ψ|²</span>
        )}
        <span>Dark gray regions = barrier (slits) and solenoid core</span>
      </div>
    </div>
  );
}