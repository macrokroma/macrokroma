import { complex, type Complex } from "@macrokroma/shared";
import type { ABParams } from "../store/abStore";

export interface InterferenceResult {
  /** Screen positions (normalized, -1 to 1). */
  positions: Float64Array;
  /** Intensity values at each screen position. */
  intensities: Float64Array;
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

  // AB phase shift: Δφ = 2π × (Φ/Φ₀)
  const abPhase = 2 * Math.PI * flux;

  // Wave number k = 2π / λ
  const k = (2 * Math.PI) / wavelength;

  // Half the slit separation
  const d2 = slitSeparation / 2;

  // Screen coordinates span
  const screenHalf = screenDistance * 0.5;

  for (let i = 0; i < numPoints; i++) {
    // Map index to screen position (-1 to 1, normalized)
    const t = (i / (numPoints - 1)) * 2 - 1;
    positions[i] = t;

    // Physical screen position
    const x = t * screenHalf * 1000; // convert μm to nm

    // Path lengths from each slit to screen position
    const r1 = Math.sqrt(
      (screenDistance * 1000) ** 2 + (x - d2) ** 2,
    );
    const r2 = Math.sqrt(
      (screenDistance * 1000) ** 2 + (x + d2) ** 2,
    );

    // Wavefunctions from each slit (path 2 picks up the AB phase)
    const psi1: Complex = complex.cis(k * r1);
    const psi2: Complex = complex.cis(k * r2 + abPhase);

    // Total wavefunction = superposition
    const psiTotal = complex.add(psi1, psi2);

    // Probability density (intensity) = |ψ|²
    intensities[i] = complex.magnitudeSquared(psiTotal);
  }

  // Normalize intensities to [0, 1]
  let max = 0;
  for (let i = 0; i < numPoints; i++) {
    if (intensities[i]! > max) max = intensities[i]!;
  }
  if (max > 0) {
    for (let i = 0; i < numPoints; i++) {
      intensities[i] = intensities[i]! / max;
    }
  }

  return { positions, intensities, count: numPoints };
}
