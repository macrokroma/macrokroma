/**
 * Solar position computation.
 *
 * Computes the Sun's geocentric ecliptic coordinates (longitude, latitude,
 * distance) for a given Julian Century T. Uses the "low accuracy" method
 * from Meeus Chapter 25, which is accurate to about 0.01° in longitude
 * — more than sufficient for visual simulation.
 *
 * The Sun's ecliptic latitude is always very close to zero (< 1.2")
 * so we return it but it's often ignored.
 *
 * Reference: Meeus, "Astronomical Algorithms" (2nd ed.), Chapter 25.
 */

import { normalizeDeg, sinDeg, cosDeg, DEG2RAD } from "../constants";

export interface SolarPosition {
  /** Geometric ecliptic longitude λ (degrees), FK5 system */
  longitude: number;
  /** Apparent ecliptic longitude (corrected for aberration & nutation) */
  apparentLongitude: number;
  /** Ecliptic latitude β (degrees) — nearly zero for the Sun */
  latitude: number;
  /** Distance from Earth in AU */
  distanceAU: number;
  /** Distance from Earth in km */
  distanceKm: number;
  /** Angular diameter of the Sun as seen from Earth (degrees) */
  angularDiameter: number;
  /** Sun's mean anomaly M (degrees) — useful for other calculations */
  meanAnomaly: number;
  /** Equation of center C (degrees) */
  equationOfCenter: number;
}

/**
 * Compute the Sun's geocentric position for a given Julian Century T.
 *
 * @param T - Julian centuries since J2000.0
 * @param nutationLongitude - Δψ in degrees (from nutation computation, for apparent position)
 */
export function computeSolarPosition(
  T: number,
  nutationLongitude: number = 0,
): SolarPosition {
  // Geometric mean longitude of the Sun (referred to mean equinox of date)
  const L0 = normalizeDeg(280.46646 + 36000.76983 * T + 0.0003032 * T * T);

  // Mean anomaly of the Sun
  const M = normalizeDeg(357.52911 + 35999.05029 * T - 0.0001537 * T * T);

  // Eccentricity of Earth's orbit
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;

  // Equation of center
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * sinDeg(M) +
    (0.019993 - 0.000101 * T) * sinDeg(2 * M) +
    0.000289 * sinDeg(3 * M);

  // Sun's true longitude
  const trueLongitude = normalizeDeg(L0 + C);

  // Sun's true anomaly
  // const trueAnomaly = M + C;

  // Sun's radius vector (distance in AU)
  const R =
    (1.000001018 * (1 - e * e)) /
    (1 + e * cosDeg(M + C));

  // Longitude of the ascending node of the Moon's orbit (for aberration)
  const omega = 125.04 - 1934.136 * T;

  // Apparent longitude (corrected for nutation and aberration)
  // Aberration is approximately -20.4898"/R arcseconds, simplified:
  const apparentLongitude = normalizeDeg(
    trueLongitude - 0.00569 - 0.00478 * sinDeg(omega) + nutationLongitude,
  );

  // Sun's ecliptic latitude (very small, usually ignored)
  const latitude = 0; // < 1.2", negligible for our purposes

  // Angular semi-diameter of the Sun
  const angularSemiDiameter = 0.2666 / R; // degrees
  const angularDiameter = 2 * angularSemiDiameter;

  return {
    longitude: trueLongitude,
    apparentLongitude,
    latitude,
    distanceAU: R,
    distanceKm: R * 149597870.7,
    angularDiameter,
    meanAnomaly: M,
    equationOfCenter: C,
  };
}

/**
 * Compute the Sun's right ascension and declination from its ecliptic coordinates.
 *
 * @param apparentLongitude - Sun's apparent ecliptic longitude (degrees)
 * @param latitude - Sun's ecliptic latitude (degrees, nearly zero)
 * @param trueObliquity - True obliquity ε (degrees)
 * @returns [rightAscension, declination] in degrees
 */
export function solarEquatorialCoords(
  apparentLongitude: number,
  latitude: number,
  trueObliquity: number,
): [number, number] {
  const sinLambda = sinDeg(apparentLongitude);
  const cosLambda = cosDeg(apparentLongitude);
  const sinBeta = sinDeg(latitude);
  const cosBeta = cosDeg(latitude);
  const sinEps = sinDeg(trueObliquity);
  const cosEps = cosDeg(trueObliquity);

  // Right ascension (Meeus eq. 13.3)
  const ra = normalizeDeg(
    Math.atan2(sinLambda * cosEps - (sinBeta / cosBeta) * sinEps, cosLambda) *
      (180 / Math.PI),
  );

  // Declination (Meeus eq. 13.4)
  const dec =
    Math.asin(sinBeta * cosEps + cosBeta * sinEps * sinLambda) *
    (180 / Math.PI);

  return [ra, dec];
}
