/**
 * Coordinate transformations for astronomical calculations.
 *
 * Three coordinate systems are used:
 *
 * 1. Ecliptic (λ, β): Referenced to the ecliptic plane (Earth's orbital plane).
 *    The Sun, Moon, and planets move near this plane.
 *
 * 2. Equatorial (α, δ): Referenced to Earth's equatorial plane.
 *    Right ascension α (0–360°) and declination δ (-90° to +90°).
 *    This is the standard system for star catalogs and telescopes.
 *
 * 3. Horizontal (A, h): Referenced to the observer's local horizon.
 *    Azimuth A (0° = North, 90° = East) and altitude h (-90° to +90°).
 *    This is what you actually see in the sky.
 *
 * Reference: Meeus, "Astronomical Algorithms" (2nd ed.), Chapters 13, 40.
 */

import { sinDeg, cosDeg, tanDeg, atan2Deg, asinDeg, normalizeDeg, DEG2RAD, RAD2DEG } from "../constants";

export interface EquatorialCoords {
  /** Right ascension α in degrees (0–360) */
  rightAscension: number;
  /** Declination δ in degrees (-90 to +90) */
  declination: number;
}

export interface HorizontalCoords {
  /** Azimuth A in degrees (0 = North, 90 = East, 180 = South, 270 = West) */
  azimuth: number;
  /** Altitude h in degrees (-90 to +90, 0 = horizon, 90 = zenith) */
  altitude: number;
}

export interface EclipticCoords {
  /** Ecliptic longitude λ in degrees (0–360) */
  longitude: number;
  /** Ecliptic latitude β in degrees (-90 to +90) */
  latitude: number;
}

/**
 * Convert ecliptic coordinates to equatorial coordinates.
 * Meeus, Chapter 13, equations 13.3 and 13.4.
 *
 * @param longitude - Ecliptic longitude λ (degrees)
 * @param latitude  - Ecliptic latitude β (degrees)
 * @param obliquity - Obliquity of the ecliptic ε (degrees)
 */
export function eclipticToEquatorial(
  longitude: number,
  latitude: number,
  obliquity: number,
): EquatorialCoords {
  const sinLambda = sinDeg(longitude);
  const cosLambda = cosDeg(longitude);
  const sinBeta = sinDeg(latitude);
  const cosBeta = cosDeg(latitude);
  const tanBeta = tanDeg(latitude);
  const sinEps = sinDeg(obliquity);
  const cosEps = cosDeg(obliquity);

  const ra = normalizeDeg(
    atan2Deg(sinLambda * cosEps - tanBeta * sinEps, cosLambda),
  );

  const dec = asinDeg(sinBeta * cosEps + cosBeta * sinEps * sinLambda);

  return { rightAscension: ra, declination: dec };
}

/**
 * Convert equatorial coordinates to ecliptic coordinates.
 *
 * @param rightAscension - Right ascension α (degrees)
 * @param declination    - Declination δ (degrees)
 * @param obliquity      - Obliquity of the ecliptic ε (degrees)
 */
export function equatorialToEcliptic(
  rightAscension: number,
  declination: number,
  obliquity: number,
): EclipticCoords {
  const sinAlpha = sinDeg(rightAscension);
  const cosAlpha = cosDeg(rightAscension);
  const sinDelta = sinDeg(declination);
  const cosDelta = cosDeg(declination);
  const tanDelta = tanDeg(declination);
  const sinEps = sinDeg(obliquity);
  const cosEps = cosDeg(obliquity);

  const longitude = normalizeDeg(
    atan2Deg(sinAlpha * cosEps + tanDelta * sinEps, cosAlpha),
  );

  const latitude = asinDeg(sinDelta * cosEps - cosDelta * sinEps * sinAlpha);

  return { longitude, latitude };
}

/**
 * Convert equatorial coordinates to horizontal coordinates.
 * Meeus, Chapter 13.
 *
 * @param rightAscension - Right ascension α (degrees)
 * @param declination    - Declination δ (degrees)
 * @param latitude       - Observer's geographic latitude (degrees, N positive)
 * @param localSiderealTime - Local sidereal time (degrees)
 */
export function equatorialToHorizontal(
  rightAscension: number,
  declination: number,
  latitude: number,
  localSiderealTime: number,
): HorizontalCoords {
  // Hour angle H = LST - α
  const H = normalizeDeg(localSiderealTime - rightAscension);

  const sinH = sinDeg(H);
  const cosH = cosDeg(H);
  const sinDec = sinDeg(declination);
  const cosDec = cosDeg(declination);
  const sinLat = sinDeg(latitude);
  const cosLat = cosDeg(latitude);

  // Altitude
  const altitude = asinDeg(sinLat * sinDec + cosLat * cosDec * cosH);

  // Azimuth (measured from North, through East)
  const azimuth = normalizeDeg(
    atan2Deg(sinH, cosH * sinLat - (sinDec / cosDec) * cosLat) + 180,
  );

  return { azimuth, altitude };
}

/**
 * Compute local sidereal time for a given observer longitude.
 *
 * @param greenwichSiderealTime - GAST or GMST in degrees
 * @param longitude - Observer's geographic longitude (degrees, E positive)
 * @returns Local sidereal time in degrees
 */
export function localSiderealTime(
  greenwichSiderealTime: number,
  longitude: number,
): number {
  return normalizeDeg(greenwichSiderealTime + longitude);
}

/**
 * Apply atmospheric refraction correction to apparent altitude.
 * Meeus, eq. 16.4. Only valid for altitudes > -1°.
 *
 * @param altitude - True geometric altitude (degrees)
 * @returns Apparent altitude corrected for refraction (degrees)
 */
export function refractedAltitude(altitude: number): number {
  if (altitude < -1) return altitude;

  // Meeus formula (approximate)
  const h = altitude;
  const correction =
    1.02 / tanDeg(h + 10.3 / (h + 5.11)) / 60; // degrees

  return altitude + correction;
}

/**
 * Compute the position angle of the bright limb of the Moon.
 * This tells us which direction the illuminated side faces,
 * which is essential for rendering the correct phase appearance.
 *
 * Meeus, Chapter 48.
 *
 * @param sunRA  - Sun's right ascension (degrees)
 * @param sunDec - Sun's declination (degrees)
 * @param moonRA - Moon's right ascension (degrees)
 * @param moonDec - Moon's declination (degrees)
 * @returns Position angle of the bright limb (degrees, from North through East)
 */
export function brightLimbAngle(
  sunRA: number,
  sunDec: number,
  moonRA: number,
  moonDec: number,
): number {
  const dRA = sunRA - moonRA;
  const sinDRA = sinDeg(dRA);
  const cosDRA = cosDeg(dRA);
  const sinSunDec = sinDeg(sunDec);
  const cosSunDec = cosDeg(sunDec);
  const sinMoonDec = sinDeg(moonDec);
  const cosMoonDec = cosDeg(moonDec);

  return normalizeDeg(
    atan2Deg(
      cosSunDec * sinDRA,
      sinSunDec * cosMoonDec - cosSunDec * sinMoonDec * cosDRA,
    ),
  );
}

/**
 * Compute the Moon's illuminated fraction and phase angle.
 * Meeus, Chapter 48.
 *
 * @param moonLon - Moon's geocentric ecliptic longitude (degrees)
 * @param moonLat - Moon's geocentric ecliptic latitude (degrees)
 * @param sunLon  - Sun's geocentric ecliptic longitude (degrees)
 * @param moonDist - Moon's distance from Earth (km)
 * @param sunDist  - Sun's distance from Earth (AU)
 * @returns { phaseAngle, illuminatedFraction, elongation }
 */
export function lunarIllumination(
  moonLon: number,
  moonLat: number,
  sunLon: number,
  moonDist: number,
  sunDist: number,
): {
  /** Elongation of the Moon from the Sun (degrees) */
  elongation: number;
  /** Phase angle i (degrees): 0° = full, 180° = new */
  phaseAngle: number;
  /** Illuminated fraction k (0 = new, 1 = full) */
  illuminatedFraction: number;
} {
  // Geocentric elongation of the Moon
  const cosElongation =
    cosDeg(moonLat) * cosDeg(moonLon - sunLon);
  const elongation = Math.acos(
    Math.max(-1, Math.min(1, cosElongation)),
  ) * RAD2DEG;

  // Phase angle
  const sunDistKm = sunDist * 149597870.7;
  const phaseAngle =
    Math.atan2(
      sunDistKm * Math.sin(elongation * DEG2RAD),
      moonDist - sunDistKm * Math.cos(elongation * DEG2RAD),
    ) * RAD2DEG;

  // Illuminated fraction
  const illuminatedFraction = (1 + Math.cos(phaseAngle * DEG2RAD)) / 2;

  return { elongation, phaseAngle, illuminatedFraction };
}

/**
 * Determine the lunar phase name from the phase angle and
 * whether the Moon is waxing or waning.
 *
 * @param elongation - Moon's elongation from Sun (degrees, 0-360)
 * @param isWaxing - true if elongation is increasing (0-180)
 */
export function phaseName(elongation: number, isWaxing: boolean): string {
  // Normalize elongation to 0–360
  const e = ((elongation % 360) + 360) % 360;

  if (e < 11.25 || e > 348.75) return "New Moon";
  if (e < 78.75) return isWaxing ? "Waxing Crescent" : "Waning Crescent";
  if (e < 101.25) return isWaxing ? "First Quarter" : "Third Quarter";
  if (e < 168.75) return isWaxing ? "Waxing Gibbous" : "Waning Gibbous";
  if (e < 191.25) return "Full Moon";
  if (e < 258.75) return isWaxing ? "Waxing Gibbous" : "Waning Gibbous";
  if (e < 281.25) return isWaxing ? "First Quarter" : "Third Quarter";
  return isWaxing ? "Waxing Crescent" : "Waning Crescent";
}
