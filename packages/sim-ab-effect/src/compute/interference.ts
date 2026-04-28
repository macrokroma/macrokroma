import { complex, type Complex } from "@macrokroma/shared";
import type { ABParams } from "../store/abStore";

export interface InterferenceResult {
  /** Screen positions (normalized, -1 to 1). */
  positions: Float64Array;
  /** Combined intensity |ψ₁ + ψ₂|² at each screen position (normalized). */
  intensities: Float64Array;
  /** Pure two-slit interference (cos²) — as if slits were point sources. */
  interferenceOnly: Float64Array;
  /** Single-slit diffraction envelope (sinc²) — pattern from one slit alone. */
  diffractionOnly: Float64Array;
  /** Number of data points. */
  count: number;
}

/**
 * sinc(x) = sin(x) / x, with sinc(0) = 1.
 */
function sinc(x: number): number {
  if (Math.abs(x) < 1e-10) return 1;
  return Math.sin(x) / x;
}

/**
 * Compute the double-slit interference pattern with Aharonov-Bohm phase shift
 * and single-slit diffraction envelope.
 *
 * Also computes the two textbook decomposition curves:
 * - interferenceOnly: cos²(πd sinθ/λ + Δφ/2) — pure two-slit, point-source fringes
 * - diffractionOnly: sinc²(πa sinθ/λ) — single-slit diffraction envelope
 *
 * The actual observed pattern ≈ interferenceOnly × diffractionOnly
 * (exact in the Fraunhofer limit, which we're in).
 *
 * This is a pure function — no side effects, no DOM access, no state.
 */
export function computeInterference(
  params: ABParams,
  numPoints: number = 512,
): InterferenceResult {
  const { flux, wavelength, slitSeparation, slitWidth, screenDistance } = params;

  const positions = new Float64Array(numPoints);
  const intensities = new Float64Array(numPoints);
  const interferenceOnly = new Float64Array(numPoints);
  const diffractionOnly = new Float64Array(numPoints);

  // AB phase shift: Δφ = 2π × (Φ/Φ₀)
  const abPhase = 2 * Math.PI * flux;

  // Wave number k = 2π / λ
  const k = (2 * Math.PI) / wavelength;

  // Half the slit separation
  const d2 = slitSeparation / 2;

  // Screen distance in nm (convert from μm)
  const L = screenDistance * 1000;

  // Fixed physical screen half-width (in nm).
  const screenHalfWidth = 5000;

  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * 2 - 1;
    positions[i] = t;

    const x = t * screenHalfWidth;

    // Path lengths from each slit to screen position
    const r1 = Math.sqrt(L * L + (x - d2) * (x - d2));
    const r2 = Math.sqrt(L * L + (x + d2) * (x + d2));

    // Angle from center (small angle: sinθ ≈ x/L)
    const sinTheta = x / Math.sqrt(L * L + x * x);

    // ── Pure interference (cos²) ──────────────────────
    // Two point sources separated by d, with AB phase shift
    // I_int = cos²(πd sinθ/λ + Δφ/2)
    const intArg = Math.PI * slitSeparation * sinTheta / wavelength + abPhase / 2;
    interferenceOnly[i] = Math.cos(intArg) ** 2;

    // ── Single-slit diffraction (sinc²) ───────────────
    // I_diff = sinc²(πa sinθ/λ)
    const diffArg = Math.PI * slitWidth * sinTheta / wavelength;
    const env = sinc(diffArg);
    diffractionOnly[i] = env * env;

    // ── Full computation (exact, not just the product) ─
    // Wavefunctions with diffraction envelope per slit
    const sinTheta1 = (x - d2) / r1;
    const sinTheta2 = (x + d2) / r2;
    const env1 = sinc(Math.PI * slitWidth * sinTheta1 / wavelength);
    const env2 = sinc(Math.PI * slitWidth * sinTheta2 / wavelength);

    const psi1: Complex = complex.scale(complex.cis(k * r1), env1);
    const psi2: Complex = complex.scale(complex.cis(k * r2 + abPhase), env2);
    const psiTotal = complex.add(psi1, psi2);

    intensities[i] = complex.magnitudeSquared(psiTotal);
  }

  // Normalize all to [0, 1] using the combined pattern's max
  let max = 0;
  for (let i = 0; i < numPoints; i++) {
    if (intensities[i]! > max) max = intensities[i]!;
  }
  if (max > 0) {
    for (let i = 0; i < numPoints; i++) {
      intensities[i] = intensities[i]! / max;
    }
  }
  // interferenceOnly and diffractionOnly are already in [0,1] by construction

  return { positions, intensities, interferenceOnly, diffractionOnly, count: numPoints };
}