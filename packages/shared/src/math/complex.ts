/**
 * Complex number arithmetic for physics simulations.
 *
 * Uses a simple [real, imaginary] tuple representation for performance.
 * All functions are pure and operate on Float64 precision.
 */

export type Complex = [real: number, imag: number];

/** Create a complex number from magnitude and phase (radians). */
export function fromPolar(magnitude: number, phase: number): Complex {
  return [magnitude * Math.cos(phase), magnitude * Math.sin(phase)];
}

/** Add two complex numbers. */
export function add(a: Complex, b: Complex): Complex {
  return [a[0] + b[0], a[1] + b[1]];
}

/** Multiply two complex numbers. */
export function multiply(a: Complex, b: Complex): Complex {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

/** Complex conjugate. */
export function conjugate(z: Complex): Complex {
  return [z[0], -z[1]];
}

/** Magnitude (absolute value). */
export function magnitude(z: Complex): number {
  return Math.sqrt(z[0] * z[0] + z[1] * z[1]);
}

/** Phase angle in radians. */
export function phase(z: Complex): number {
  return Math.atan2(z[1], z[0]);
}

/** Magnitude squared (avoids the sqrt — useful for probability density). */
export function magnitudeSquared(z: Complex): number {
  return z[0] * z[0] + z[1] * z[1];
}

/** Scale a complex number by a real scalar. */
export function scale(z: Complex, s: number): Complex {
  return [z[0] * s, z[1] * s];
}

/** Complex exponential: e^(i * theta). */
export function cis(theta: number): Complex {
  return [Math.cos(theta), Math.sin(theta)];
}
