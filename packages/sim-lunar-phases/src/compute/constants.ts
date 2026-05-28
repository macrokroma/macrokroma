/**
 * Astronomical constants.
 *
 * Sources: IAU 2012 nominal values, Meeus "Astronomical Algorithms" (2nd ed.)
 * All angular values in degrees unless otherwise noted.
 */

/** Speed of light in km/s */
export const C_LIGHT = 299_792.458;

/** Astronomical Unit in km (IAU 2012) */
export const AU_KM = 149_597_870.7;

/** Mean Earth radius in km (IAU nominal) */
export const EARTH_RADIUS_KM = 6371.0;

/** Earth equatorial radius in km (WGS84) */
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.137;

/** Earth polar radius in km (WGS84) */
export const EARTH_POLAR_RADIUS_KM = 6356.752;

/** Earth flattening (WGS84) */
export const EARTH_FLATTENING = 1 / 298.257223563;

/** Mean Moon radius in km */
export const MOON_RADIUS_KM = 1737.4;

/** Sun radius in km */
export const SUN_RADIUS_KM = 695_700;

/** Mean Earth–Moon distance in km */
export const MEAN_LUNAR_DISTANCE_KM = 384_400;

/** Mean Earth–Sun distance in km (1 AU) */
export const MEAN_SOLAR_DISTANCE_KM = AU_KM;

/** Earth's mean obliquity at J2000.0 in degrees */
export const OBLIQUITY_J2000 = 23.4392911;

/** Sidereal year in days */
export const SIDEREAL_YEAR_DAYS = 365.256363004;

/** Synodic month (new moon to new moon) in days */
export const SYNODIC_MONTH_DAYS = 29.530588861;

/** Sidereal month in days */
export const SIDEREAL_MONTH_DAYS = 27.321661;

/** Anomalistic month in days (perigee to perigee) */
export const ANOMALISTIC_MONTH_DAYS = 27.554550;

/** Nodical (draconic) month in days (node to node) */
export const NODICAL_MONTH_DAYS = 27.212221;

/** Moon's mean orbital inclination to ecliptic in degrees */
export const MOON_ORBITAL_INCLINATION = 5.145;

/** Earth axial tilt in degrees (J2000) */
export const EARTH_AXIAL_TILT = 23.4393;

/** Degrees to radians */
export const DEG2RAD = Math.PI / 180;

/** Radians to degrees */
export const RAD2DEG = 180 / Math.PI;

/** Arcseconds to radians */
export const ARCSEC2RAD = DEG2RAD / 3600;

/** Two pi */
export const TWO_PI = 2 * Math.PI;

/** Normalize an angle to [0, 360) degrees */
export function normalizeDeg(deg: number): number {
  const result = deg % 360;
  return result < 0 ? result + 360 : result;
}

/** Normalize an angle to [0, 2π) radians */
export function normalizeRad(rad: number): number {
  const result = rad % TWO_PI;
  return result < 0 ? result + TWO_PI : result;
}

/** Sine of angle in degrees */
export function sinDeg(deg: number): number {
  return Math.sin(deg * DEG2RAD);
}

/** Cosine of angle in degrees */
export function cosDeg(deg: number): number {
  return Math.cos(deg * DEG2RAD);
}

/** Tangent of angle in degrees */
export function tanDeg(deg: number): number {
  return Math.tan(deg * DEG2RAD);
}

/** Arcsine returning degrees */
export function asinDeg(x: number): number {
  return Math.asin(x) * RAD2DEG;
}

/** Arccosine returning degrees */
export function acosDeg(x: number): number {
  return Math.acos(x) * RAD2DEG;
}

/** Arctangent2 returning degrees */
export function atan2Deg(y: number, x: number): number {
  return Math.atan2(y, x) * RAD2DEG;
}
