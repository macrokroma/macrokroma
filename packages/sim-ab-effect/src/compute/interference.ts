import { complex, type Complex } from "@macrokroma/shared";
import type { ABParams } from "../store/abStore";

export interface InterferenceResult {
  /** Screen positions (normalized, -1 to 1). */
  positions: Float64Array;
  /** Combined intensity |ψ₁ + ψ₂|² at each screen position. */
  intensities: Float64Array;
  /** Individual intensity |ψ₁|² from slit 1. */
  intensities1: Float64Array;
  /** Individual intensity |ψ₂|² from slit 2. */
  intensities2: Float64Array;
  /** Real part of ψ₁ (for waveform overlay). */
  re1: Float64Array;
  /** Real part of ψ₂ (for waveform overlay). */
  re2: Float64Array;
  /** Number of data points. */
  count: number;
}

/**
 * Compute the double-slit interference pattern with Aharonov-Bohm phase shift.
 *
 * The AB effect introduces a relative phase Δφ = 2π · (Φ/Φ₀) between
 * the two paths. This shifts the interference fringes without changing
 * the envelope.
 *
 * This is a pure function — no side effects, no DOM access, no state.
 * It can run on the main thread, in a Web Worker, or (eventually) be
 * replaced by a GPU compute shader with the same signature.
 */
export function computeInterference(
  params: ABParams,
  numPoints: number = 512,
): InterferenceResult {
  const { flux, wavelength, slitSeparation, screenDistance } = params;

  const positions = new Float64Array(numPoints);
  const intensities = new Float64Array(numPoints);
  const intensities1 = new Float64Array(numPoints);
  const intensities2 = new Float64Array(numPoints);
  const re1 = new Float64Array(numPoints);
  const re2 = new Float64Array(numPoints);

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

    const r1 = Math.sqrt(L * L + (x - d2) * (x - d2));
    const r2 = Math.sqrt(L * L + (x + d2) * (x + d2));

    const psi1: Complex = complex.cis(k * r1);
    const psi2: Complex = complex.cis(k * r2 + abPhase);

    const psiTotal = complex.add(psi1, psi2);

    intensities[i] = complex.magnitudeSquared(psiTotal);
    intensities1[i] = complex.magnitudeSquared(psi1);
    intensities2[i] = complex.magnitudeSquared(psi2);
    re1[i] = psi1[0];
    re2[i] = psi2[0];
  }

  // Normalize combined intensities to [0, 1]
  let max = 0;
  for (let i = 0; i < numPoints; i++) {
    if (intensities[i]! > max) max = intensities[i]!;
  }
  if (max > 0) {
    for (let i = 0; i < numPoints; i++) {
      intensities[i] = intensities[i]! / max;
    }
  }

  return { positions, intensities, intensities1, intensities2, re1, re2, count: numPoints };
}