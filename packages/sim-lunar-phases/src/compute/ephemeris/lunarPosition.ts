/**
 * Lunar position computation.
 *
 * Computes the Moon's geocentric ecliptic coordinates (longitude, latitude,
 * distance) using the major terms from ELP-2000/82 as presented in Meeus
 * Chapter 47. This includes the 60 most significant terms in longitude/distance
 * and 60 in latitude.
 *
 * Accuracy: ~10" in longitude, ~5" in latitude, ~0.5 km in distance.
 * This is more than sufficient for visual simulation — the Moon's apparent
 * diameter is about 1800", so 10" error is invisible.
 *
 * Reference: Meeus, "Astronomical Algorithms" (2nd ed.), Chapter 47.
 */

import { normalizeDeg, sinDeg, cosDeg, DEG2RAD, RAD2DEG } from "../constants";

export interface LunarPosition {
  /** Geocentric ecliptic longitude λ (degrees) */
  longitude: number;
  /** Geocentric ecliptic latitude β (degrees) */
  latitude: number;
  /** Distance from Earth's center in km */
  distanceKm: number;
  /** Equatorial horizontal parallax (degrees) */
  parallax: number;
  /** Angular diameter as seen from Earth (degrees) */
  angularDiameter: number;
  /** Mean elongation D (degrees) — useful for phase computation */
  meanElongation: number;
  /** Mean anomaly M' of the Moon (degrees) */
  meanAnomaly: number;
  /** Argument of latitude F (degrees) */
  argumentOfLatitude: number;
  /** Longitude of ascending node Ω (degrees) */
  ascendingNodeLongitude: number;
}

/**
 * Table of periodic terms for lunar longitude (Σl) and distance (Σr).
 * Each row: [D, M, M', F, l_coefficient, r_coefficient]
 * D = mean elongation, M = Sun's mean anomaly, M' = Moon's mean anomaly,
 * F = Moon's argument of latitude.
 * l coefficients in units of 0.000001° (millionths of a degree).
 * r coefficients in units of 0.001 km (thousandths of a km).
 */
const LR_TABLE: number[][] = [
  // D   M   M'  F     Σl           Σr
  [  0,  0,  1,  0,  6288774,   -20905355 ],
  [  2,  0, -1,  0,  1274027,    -3699111 ],
  [  2,  0,  0,  0,   658314,    -2955968 ],
  [  0,  0,  2,  0,   213618,     -569925 ],
  [  0,  1,  0,  0,  -185116,       48888 ],
  [  0,  0,  0,  2,  -114332,       -3149 ],
  [  2,  0, -2,  0,    58793,      246158 ],
  [  2, -1, -1,  0,    57066,     -152138 ],
  [  2,  0,  1,  0,    53322,     -170733 ],
  [  2, -1,  0,  0,    45758,     -204586 ],
  [  0,  1, -1,  0,   -40923,     -129620 ],
  [  1,  0,  0,  0,   -34720,      108743 ],
  [  0,  1,  1,  0,   -30383,      104755 ],
  [  2,  0,  0, -2,    15327,       10321 ],
  [  0,  0,  1,  2,   -12528,           0 ],
  [  0,  0,  1, -2,    10980,       79661 ],
  [  4,  0, -1,  0,    10675,      -34782 ],
  [  0,  0,  3,  0,    10034,      -23210 ],
  [  4,  0, -2,  0,     8548,      -21636 ],
  [  2,  1, -1,  0,    -7888,       24208 ],
  [  2,  1,  0,  0,    -6766,       30824 ],
  [  1,  0, -1,  0,    -5163,       -8379 ],
  [  1,  1,  0,  0,     4987,      -16675 ],
  [  2, -1,  1,  0,     4036,      -12831 ],
  [  2,  0,  2,  0,     3994,      -10445 ],
  [  4,  0,  0,  0,     3861,      -11650 ],
  [  2,  0, -3,  0,     3665,       14403 ],
  [  0,  1, -2,  0,    -2689,       -7003 ],
  [  2,  0, -1,  2,    -2602,           0 ],
  [  2, -1, -2,  0,     2390,       10056 ],
  [  1,  0,  1,  0,    -2348,        6322 ],
  [  2, -2,  0,  0,     2236,       -9884 ],
  [  0,  1,  2,  0,    -2120,        5751 ],
  [  0,  2,  0,  0,    -2069,           0 ],
  [  2, -2, -1,  0,     2048,       -4950 ],
  [  2,  0,  1, -2,    -1773,        4130 ],
  [  2,  0,  0,  2,    -1595,           0 ],
  [  4, -1, -1,  0,     1215,       -3958 ],
  [  0,  0,  2,  2,    -1110,           0 ],
  [  3,  0, -1,  0,     -892,        3258 ],
  [  2,  1,  1,  0,     -810,        2616 ],
  [  4, -1, -2,  0,      759,       -1897 ],
  [  0,  2, -1,  0,     -713,       -2117 ],
  [  2,  2, -1,  0,     -700,        2354 ],
  [  2,  1, -2,  0,      691,           0 ],
  [  2, -1,  0, -2,      596,           0 ],
  [  4,  0,  1,  0,      549,       -1423 ],
  [  0,  0,  4,  0,      537,       -1117 ],
  [  4, -1,  0,  0,      520,       -1571 ],
  [  1,  0, -2,  0,     -487,       -1739 ],
  [  2,  1,  0, -2,     -399,           0 ],
  [  0,  0,  2, -2,     -381,       -4421 ],
  [  1,  1,  1,  0,      351,           0 ],
  [  3,  0, -2,  0,     -340,           0 ],
  [  4,  0, -3,  0,      330,           0 ],
  [  2, -1,  2,  0,      327,           0 ],
  [  0,  2,  1,  0,     -323,        1165 ],
  [  1,  1, -1,  0,      299,           0 ],
  [  2,  0,  3,  0,      294,           0 ],
  [  2,  0, -1, -2,        0,        8752 ],
];

/**
 * Table of periodic terms for lunar latitude (Σb).
 * Each row: [D, M, M', F, b_coefficient]
 * b coefficients in units of 0.000001°.
 */
const B_TABLE: number[][] = [
  // D   M   M'  F     Σb
  [  0,  0,  0,  1,  5128122 ],
  [  0,  0,  1,  1,   280602 ],
  [  0,  0,  1, -1,   277693 ],
  [  2,  0,  0, -1,   173237 ],
  [  2,  0, -1,  1,    55413 ],
  [  2,  0, -1, -1,    46271 ],
  [  2,  0,  0,  1,    32573 ],
  [  0,  0,  2,  1,    17198 ],
  [  2,  0,  1, -1,     9266 ],
  [  0,  0,  2, -1,     8822 ],
  [  2, -1,  0, -1,     8216 ],
  [  2,  0, -2, -1,     4324 ],
  [  2,  0,  1,  1,     4200 ],
  [  2,  1,  0, -1,    -3359 ],
  [  2, -1, -1,  1,     2463 ],
  [  2, -1,  0,  1,     2211 ],
  [  2, -1, -1, -1,     2065 ],
  [  0,  1, -1, -1,    -1870 ],
  [  4,  0, -1, -1,     1828 ],
  [  0,  1,  0,  1,    -1794 ],
  [  0,  0,  0,  3,    -1749 ],
  [  0,  1, -1,  1,    -1565 ],
  [  1,  0,  0,  1,    -1491 ],
  [  0,  1,  1,  1,    -1475 ],
  [  0,  1,  1, -1,    -1410 ],
  [  0,  1,  0, -1,    -1344 ],
  [  1,  0,  0, -1,    -1335 ],
  [  0,  0,  3,  1,     1107 ],
  [  4,  0,  0, -1,     1021 ],
  [  4,  0, -1,  1,      833 ],
  [  0,  0,  1, -3,      777 ],
  [  4,  0, -2,  1,      671 ],
  [  2,  0,  0, -3,      607 ],
  [  2,  0,  2, -1,      596 ],
  [  2, -1,  1, -1,      491 ],
  [  2,  0, -2,  1,     -451 ],
  [  0,  0,  3, -1,      439 ],
  [  2,  0,  2,  1,      422 ],
  [  2,  0, -3, -1,      421 ],
  [  2,  1, -1,  1,     -366 ],
  [  2,  1,  0,  1,     -351 ],
  [  4,  0,  0,  1,      331 ],
  [  2, -1,  1,  1,      315 ],
  [  2, -2,  0, -1,      302 ],
  [  0,  0,  1,  3,     -283 ],
  [  2,  1,  1, -1,     -229 ],
  [  1,  1,  0, -1,      223 ],
  [  1,  1,  0,  1,      223 ],
  [  0,  1, -2, -1,     -220 ],
  [  2,  1, -1, -1,     -220 ],
  [  1,  0,  1,  1,     -185 ],
  [  2, -1, -2, -1,      181 ],
  [  0,  1,  2,  1,     -177 ],
  [  4,  0, -2, -1,      176 ],
  [  4, -1, -1, -1,      166 ],
  [  1,  0,  1, -1,     -164 ],
  [  4,  0,  1, -1,      132 ],
  [  1,  0, -1, -1,     -119 ],
  [  4, -1,  0, -1,      115 ],
  [  2, -2,  0,  1,      107 ],
];

/**
 * Compute the Moon's geocentric position for a given Julian Century T.
 *
 * @param T - Julian centuries since J2000.0
 * @param nutationLongitude - Δψ in degrees (for apparent coordinates)
 */
export function computeLunarPosition(
  T: number,
  nutationLongitude: number = 0,
): LunarPosition {
  // Fundamental arguments (degrees) — Meeus Table 47.A

  // Moon's mean longitude (referred to mean equinox of date)
  const Lp = normalizeDeg(
    218.3164477 + 481267.88123421 * T - 0.0015786 * T * T +
    (T * T * T) / 538841 - (T ** 4) / 65194000,
  );

  // Mean elongation of the Moon
  const D = normalizeDeg(
    297.8501921 + 445267.1114034 * T - 0.0018819 * T * T +
    (T * T * T) / 545868 - (T ** 4) / 113065000,
  );

  // Sun's mean anomaly
  const M = normalizeDeg(
    357.5291092 + 35999.0502909 * T - 0.0001536 * T * T +
    (T * T * T) / 24490000,
  );

  // Moon's mean anomaly
  const Mp = normalizeDeg(
    134.9633964 + 477198.8675055 * T + 0.0087414 * T * T +
    (T * T * T) / 69699 - (T ** 4) / 14712000,
  );

  // Moon's argument of latitude
  const F = normalizeDeg(
    93.272095 + 483202.0175233 * T - 0.0036539 * T * T -
    (T * T * T) / 3526000 + (T ** 4) / 863310000,
  );

  // Longitude of ascending node
  const omega = normalizeDeg(
    125.0445479 - 1934.1362891 * T + 0.0020754 * T * T +
    (T * T * T) / 467441 - (T ** 4) / 60616000,
  );

  // Three further correction terms (Meeus p. 338)
  const A1 = normalizeDeg(119.75 + 131.849 * T);   // Venus
  const A2 = normalizeDeg(53.09 + 479264.29 * T);   // Jupiter
  const A3 = normalizeDeg(313.45 + 481266.484 * T);

  // Correction factor for eccentricity of Earth's orbit
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const E2 = E * E;

  // Sum the periodic terms for longitude and distance
  let sigmaL = 0; // in 0.000001°
  let sigmaR = 0; // in 0.001 km

  for (const row of LR_TABLE) {
    const [d, m, mp, f, lCoeff, rCoeff] = row as [number, number, number, number, number, number];
    const arg = d * D + m * M + mp * Mp + f * F;
    const sinArg = sinDeg(arg);
    const cosArg = cosDeg(arg);

    // Apply eccentricity correction for terms involving Sun's anomaly
    let eFactor = 1;
    const absM = Math.abs(m);
    if (absM === 1) eFactor = E;
    else if (absM === 2) eFactor = E2;

    sigmaL += lCoeff * eFactor * sinArg;
    sigmaR += rCoeff * eFactor * cosArg;
  }

  // Sum the periodic terms for latitude
  let sigmaB = 0; // in 0.000001°

  for (const row of B_TABLE) {
    const [d, m, mp, f, bCoeff] = row as [number, number, number, number, number];
    const arg = d * D + m * M + mp * Mp + f * F;
    const sinArg = sinDeg(arg);

    let eFactor = 1;
    const absM = Math.abs(m);
    if (absM === 1) eFactor = E;
    else if (absM === 2) eFactor = E2;

    sigmaB += bCoeff * eFactor * sinArg;
  }

  // Additional corrections (Meeus p. 338)
  sigmaL +=
    3958 * sinDeg(A1) +
    1962 * sinDeg(Lp - F) +
    318 * sinDeg(A2);

  sigmaB +=
    -2235 * sinDeg(Lp) +
    382 * sinDeg(A3) +
    175 * sinDeg(A1 - F) +
    175 * sinDeg(A1 + F) +
    127 * sinDeg(Lp - Mp) -
    115 * sinDeg(Lp + Mp);

  // Final coordinates
  const longitude = normalizeDeg(Lp + sigmaL / 1000000 + nutationLongitude);
  const latitude = sigmaB / 1000000;
  const distanceKm = 385000.56 + sigmaR / 1000;

  // Equatorial horizontal parallax
  const parallax = Math.asin(6378.14 / distanceKm) * RAD2DEG;

  // Angular diameter (Moon's mean radius = 1737.4 km)
  const angularDiameter = 2 * Math.asin(1737.4 / distanceKm) * RAD2DEG;

  return {
    longitude,
    latitude,
    distanceKm,
    parallax,
    angularDiameter,
    meanElongation: D,
    meanAnomaly: Mp,
    argumentOfLatitude: F,
    ascendingNodeLongitude: omega,
  };
}
