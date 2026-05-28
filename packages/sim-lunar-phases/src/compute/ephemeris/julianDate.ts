/**
 * Julian Date conversions.
 *
 * Julian Date (JD) is the continuous count of days since the beginning of the
 * Julian Period (January 1, 4713 BC, noon UT). It's the standard time system
 * for astronomical calculations because it avoids all the headaches of
 * calendar reforms, leap years, and time zones.
 *
 * Julian Century (T) is the number of Julian centuries of 36525 days elapsed
 * since J2000.0 (January 1, 2000, 12:00 TT). This is the primary time
 * argument for Meeus's algorithms.
 *
 * Reference: Meeus, "Astronomical Algorithms" (2nd ed.), Chapter 7.
 */

/** J2000.0 epoch as Julian Date */
export const J2000 = 2_451_545.0;

/** Julian days per century */
export const DAYS_PER_CENTURY = 36_525.0;

/** Unix epoch (Jan 1 1970 00:00 UTC) as Julian Date */
export const JD_UNIX_EPOCH = 2_440_587.5;

/**
 * Convert a calendar date to Julian Date.
 *
 * Handles both Julian and Gregorian calendars. The Gregorian calendar
 * is assumed for dates on or after October 15, 1582.
 *
 * @param year  - Full year (e.g. 2026, negative for BC)
 * @param month - Month 1-12
 * @param day   - Day of month (can be fractional for time of day)
 * @returns Julian Date
 */
export function calendarToJD(year: number, month: number, day: number): number {
  // Meeus algorithm: January and February are counted as months 13 and 14
  // of the preceding year
  let Y = year;
  let M = month;
  if (M <= 2) {
    Y -= 1;
    M += 12;
  }

  // Gregorian calendar correction
  let B = 0;
  if (year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)))) {
    const A = Math.floor(Y / 100);
    B = 2 - A + Math.floor(A / 4);
  }

  return (
    Math.floor(365.25 * (Y + 4716)) +
    Math.floor(30.6001 * (M + 1)) +
    day +
    B -
    1524.5
  );
}

/**
 * Convert Julian Date to calendar date.
 *
 * @returns [year, month, day] where day is fractional
 */
export function jdToCalendar(jd: number): [number, number, number] {
  const Z = Math.floor(jd + 0.5);
  const F = jd + 0.5 - Z;

  let A: number;
  if (Z < 2299161) {
    A = Z;
  } else {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }

  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const day = B - D - Math.floor(30.6001 * E) + F;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  return [year, month, day];
}

/**
 * Convert a JavaScript Date to Julian Date.
 */
export function dateToJD(date: Date): number {
  return JD_UNIX_EPOCH + date.getTime() / 86_400_000;
}

/**
 * Convert Julian Date to a JavaScript Date.
 */
export function jdToDate(jd: number): Date {
  return new Date((jd - JD_UNIX_EPOCH) * 86_400_000);
}

/**
 * Compute Julian Century T from Julian Date.
 * T is the number of Julian centuries since J2000.0.
 * This is the primary time argument for most Meeus formulas.
 */
export function jdToT(jd: number): number {
  return (jd - J2000) / DAYS_PER_CENTURY;
}

/**
 * Convert Julian Century T back to Julian Date.
 */
export function tToJD(T: number): number {
  return T * DAYS_PER_CENTURY + J2000;
}

/**
 * Get the current Julian Date.
 */
export function nowJD(): number {
  return dateToJD(new Date());
}

/**
 * Get the current Julian Century T.
 */
export function nowT(): number {
  return jdToT(nowJD());
}

/**
 * Compute Greenwich Mean Sidereal Time in degrees.
 * Meeus, Chapter 12.
 *
 * @param jd - Julian Date
 * @returns GMST in degrees [0, 360)
 */
export function greenwichMeanSiderealTime(jd: number): number {
  const T = jdToT(jd);
  // Meeus eq. 12.4 — gives GMST in degrees
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - J2000) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;

  // Normalize to [0, 360)
  gmst = gmst % 360;
  if (gmst < 0) gmst += 360;
  return gmst;
}

/**
 * Compute Greenwich Apparent Sidereal Time in degrees.
 * This is GMST corrected for nutation.
 *
 * @param jd - Julian Date
 * @param nutationLongitude - Δψ in degrees (from nutation computation)
 * @param trueObliquity - ε in degrees (obliquity corrected for nutation)
 * @returns GAST in degrees [0, 360)
 */
export function greenwichApparentSiderealTime(
  jd: number,
  nutationLongitude: number,
  trueObliquity: number,
): number {
  const gmst = greenwichMeanSiderealTime(jd);
  // Equation of the equinoxes
  const eqEq = nutationLongitude * Math.cos((trueObliquity * Math.PI) / 180);
  let gast = gmst + eqEq;
  gast = gast % 360;
  if (gast < 0) gast += 360;
  return gast;
}
