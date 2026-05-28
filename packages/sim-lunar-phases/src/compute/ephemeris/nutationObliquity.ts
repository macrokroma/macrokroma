/**
 * Nutation and obliquity of the ecliptic.
 *
 * Nutation is a periodic oscillation of Earth's rotational axis caused by
 * the gravitational pull of the Moon and Sun on Earth's equatorial bulge.
 * It has two components:
 *   - Δψ (nutation in longitude): affects the ecliptic longitude of all objects
 *   - Δε (nutation in obliquity): affects the tilt of the ecliptic
 *
 * The obliquity of the ecliptic (ε) is the tilt of Earth's equatorial plane
 * relative to the ecliptic plane. It changes slowly over millennia (the
 * secular variation) and wobbles periodically (nutation).
 *
 * Reference: Meeus, "Astronomical Algorithms" (2nd ed.), Chapter 22.
 * Uses the IAU 1980 nutation series (the largest 63 terms from the full
 * 106-term series). Accuracy: ~0.5" in Δψ, ~0.1" in Δε.
 */

import { sinDeg, cosDeg, normalizeDeg } from "../constants";

export interface NutationResult {
  /** Nutation in longitude Δψ, in degrees */
  nutationLongitude: number;
  /** Nutation in obliquity Δε, in degrees */
  nutationObliquity: number;
  /** Mean obliquity of the ecliptic ε₀, in degrees */
  meanObliquity: number;
  /** True obliquity ε = ε₀ + Δε, in degrees */
  trueObliquity: number;
}

/**
 * Nutation table coefficients.
 * Each row: [D, M, M', F, Ω, ψ_sin, ψ_sinT, ε_cos, ε_cosT]
 *
 * D  = mean elongation of the Moon from the Sun
 * M  = mean anomaly of the Sun
 * M' = mean anomaly of the Moon
 * F  = Moon's argument of latitude
 * Ω  = longitude of the ascending node of the Moon's orbit
 *
 * ψ coefficients in 0.0001" (arcseconds × 10⁴)
 * ε coefficients in 0.0001" (arcseconds × 10⁴)
 */
const NUTATION_TABLE: number[][] = [
  //  D   M   M'  F   Ω    ψ_sin    ψ_sinT   ε_cos    ε_cosT
  [   0,  0,  0,  0,  1,  -171996,  -1742,    92025,    89  ],
  [  -2,  0,  0,  2,  2,   -13187,    -16,     5736,   -31  ],
  [   0,  0,  0,  2,  2,    -2274,     -2,      977,    -5  ],
  [   0,  0,  0,  0,  2,     2062,      2,     -895,     5  ],
  [   0,  1,  0,  0,  0,     1426,    -34,       54,    -1  ],
  [   0,  0,  1,  0,  0,      712,      1,       -7,     0  ],
  [  -2,  1,  0,  2,  2,     -517,     12,      224,    -6  ],
  [   0,  0,  0,  2,  1,     -386,     -4,      200,     0  ],
  [   0,  0,  1,  2,  2,     -301,      0,      129,    -1  ],
  [  -2, -1,  0,  2,  2,      217,     -5,      -95,     3  ],
  [  -2,  0,  1,  0,  0,     -158,      0,        0,     0  ],
  [  -2,  0,  0,  2,  1,      129,      1,      -70,     0  ],
  [   0,  0, -1,  2,  2,      123,      0,      -53,     0  ],
  [   2,  0,  0,  0,  0,       63,      0,        0,     0  ],
  [   0,  0,  1,  0,  1,       63,      1,      -33,     0  ],
  [   2,  0, -1,  2,  2,      -59,      0,       26,     0  ],
  [   0,  0, -1,  0,  1,      -58,     -1,       32,     0  ],
  [   0,  0,  1,  2,  1,      -51,      0,       27,     0  ],
  [  -2,  0,  2,  0,  0,       48,      0,        0,     0  ],
  [   0,  0, -2,  2,  1,       46,      0,      -24,     0  ],
  [   2,  0,  0,  2,  2,      -38,      0,       16,     0  ],
  [   0,  0,  2,  2,  2,      -31,      0,       13,     0  ],
  [   0,  0,  2,  0,  0,       29,      0,        0,     0  ],
  [  -2,  0,  1,  2,  2,       29,      0,      -12,     0  ],
  [   0,  0,  0,  2,  0,       26,      0,        0,     0  ],
  [  -2,  0,  0,  2,  0,      -22,      0,        0,     0  ],
  [   0,  0, -1,  2,  1,       21,      0,      -10,     0  ],
  [   0,  2,  0,  0,  0,       17,     -1,        0,     0  ],
  [   2,  0, -1,  0,  1,       16,      0,       -8,     0  ],
  [  -2,  2,  0,  2,  2,      -16,      1,        7,     0  ],
  [   0,  1,  0,  0,  1,      -15,      0,        9,     0  ],
  [  -2,  0,  1,  0,  1,      -13,      0,        7,     0  ],
  [   0, -1,  0,  0,  1,      -12,      0,        6,     0  ],
  [   0,  0,  2, -2,  0,       11,      0,        0,     0  ],
  [   2,  0, -1,  2,  1,      -10,      0,        5,     0  ],
  [   2,  0,  1,  2,  2,       -8,      0,        3,     0  ],
  [   0,  1,  0,  2,  2,        7,      0,       -3,     0  ],
  [  -2,  1,  1,  0,  0,       -7,      0,        0,     0  ],
  [   0, -1,  0,  2,  2,       -7,      0,        3,     0  ],
  [   2,  0,  0,  2,  1,       -7,      0,        3,     0  ],
  [   2,  0,  1,  0,  0,       -8,      0,        0,     0  ],
  [  -2,  0,  2,  2,  2,        6,      0,       -3,     0  ],
  [  -2,  0,  1,  2,  1,        6,      0,       -3,     0  ],
  [   2,  0, -2,  0,  1,       -6,      0,        3,     0  ],
  [   2,  0,  0,  0,  1,       -6,      0,        3,     0  ],
  [   0, -1,  1,  0,  0,        5,      0,        0,     0  ],
  [  -2, -1,  0,  2,  1,       -5,      0,        3,     0  ],
  [  -2,  0,  0,  0,  1,       -5,      0,        3,     0  ],
  [   0,  0,  2,  2,  1,       -5,      0,        3,     0  ],
  [  -2,  0,  2,  0,  1,        4,      0,        0,     0  ],
  [  -2,  1,  0,  2,  1,        4,      0,        0,     0  ],
  [   0,  0,  1, -2,  0,        4,      0,        0,     0  ],
  [  -1,  0,  1,  0,  0,       -4,      0,        0,     0  ],
  [  -2,  1,  0,  0,  0,       -4,      0,        0,     0  ],
  [   1,  0,  0,  0,  0,       -4,      0,        0,     0  ],
  [   0,  0,  1,  2,  0,        3,      0,        0,     0  ],
  [   0,  0, -2,  2,  2,       -3,      0,        0,     0  ],
  [  -1, -1,  1,  0,  0,       -3,      0,        0,     0  ],
  [   0,  1,  1,  0,  0,       -3,      0,        0,     0  ],
  [   0, -1,  1,  2,  2,       -3,      0,        0,     0  ],
  [   2, -1, -1,  2,  2,       -3,      0,        0,     0  ],
  [   0,  0,  3,  2,  2,       -3,      0,        0,     0  ],
  [   2, -1,  0,  2,  2,       -3,      0,        0,     0  ],
];

/**
 * Compute nutation and obliquity for a given Julian Century T.
 *
 * @param T - Julian centuries since J2000.0
 */
export function computeNutation(T: number): NutationResult {
  // Fundamental arguments (degrees)
  // D = mean elongation of the Moon from the Sun
  const D = normalizeDeg(
    297.85036 + 445267.11148 * T - 0.0019142 * T * T + (T * T * T) / 189474,
  );

  // M = mean anomaly of the Sun (Earth)
  const M = normalizeDeg(
    357.52772 + 35999.05034 * T - 0.0001603 * T * T - (T * T * T) / 300000,
  );

  // M' = mean anomaly of the Moon
  const Mp = normalizeDeg(
    134.96298 + 477198.867398 * T + 0.0086972 * T * T + (T * T * T) / 56250,
  );

  // F = Moon's argument of latitude
  const F = normalizeDeg(
    93.27191 + 483202.017538 * T - 0.0036825 * T * T + (T * T * T) / 327270,
  );

  // Ω = longitude of the ascending node of the Moon's mean orbit
  const omega = normalizeDeg(
    125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000,
  );

  // Sum the nutation series
  let deltaPsi = 0; // in units of 0.0001"
  let deltaEps = 0;

  for (const row of NUTATION_TABLE) {
    const [cD, cM, cMp, cF, cOm, psiSin, psiSinT, epsCos, epsCosT] = row as [number, number, number, number, number, number, number, number, number];
    const arg = cD * D + cM * M + cMp * Mp + cF * F + cOm * omega;
    const sinArg = sinDeg(arg);
    const cosArg = cosDeg(arg);

    deltaPsi += (psiSin + psiSinT * T) * sinArg;
    deltaEps += (epsCos + epsCosT * T) * cosArg;
  }

  // Convert from 0.0001" to degrees
  const nutationLongitude = deltaPsi / (3600 * 10000);
  const nutationObliquity = deltaEps / (3600 * 10000);

  // Mean obliquity of the ecliptic (Laskar's formula, Meeus eq. 22.3)
  const U = T / 100;
  const meanObliquity =
    23 +
    26 / 60 +
    21.448 / 3600 -
    (4680.93 / 3600) * U -
    (1.55 / 3600) * U * U +
    (1999.25 / 3600) * U * U * U -
    (51.38 / 3600) * U ** 4 -
    (249.67 / 3600) * U ** 5 -
    (39.05 / 3600) * U ** 6 +
    (7.12 / 3600) * U ** 7 +
    (27.87 / 3600) * U ** 8 +
    (5.79 / 3600) * U ** 9 +
    (2.45 / 3600) * U ** 10;

  const trueObliquity = meanObliquity + nutationObliquity;

  return {
    nutationLongitude,
    nutationObliquity,
    meanObliquity,
    trueObliquity,
  };
}
