/**
 * Main ephemeris API.
 *
 * This is the top-level interface that the rendering layer calls.
 * One function call returns the complete geometric state of the
 * Sun-Earth-Moon system for a given instant in time, including:
 *
 * - Positions of Sun and Moon in ecliptic, equatorial, and 3D Cartesian coords
 * - Moon's illuminated fraction, phase angle, and phase name
 * - Eclipse proximity detection
 * - Observer-specific sky coordinates (if observer position provided)
 *
 * All the Meeus algorithms live in the sub-modules; this module
 * just orchestrates them into a single coherent snapshot.
 */

import { dateToJD, jdToT, greenwichMeanSiderealTime, greenwichApparentSiderealTime } from "./julianDate";
import { computeNutation, type NutationResult } from "./nutationObliquity";
import { computeSolarPosition, solarEquatorialCoords, type SolarPosition } from "./solarPosition";
import { computeLunarPosition, type LunarPosition } from "./lunarPosition";
import {
  eclipticToEquatorial,
  equatorialToHorizontal,
  localSiderealTime,
  lunarIllumination,
  brightLimbAngle,
  refractedAltitude,
  type EquatorialCoords,
  type HorizontalCoords,
} from "./coordinateTransforms";
import { DEG2RAD, cosDeg, sinDeg, AU_KM, MOON_RADIUS_KM, EARTH_RADIUS_KM, SUN_RADIUS_KM } from "../constants";

/** Complete snapshot of the Sun-Earth-Moon system at an instant */
export interface CelestialSnapshot {
  /** Julian Date of this snapshot */
  jd: number;
  /** Julian Century T (time argument for Meeus formulas) */
  T: number;

  /** Nutation and obliquity values */
  nutation: NutationResult;

  /** Sun's position and derived quantities */
  sun: {
    position: SolarPosition;
    equatorial: EquatorialCoords;
    /** Cartesian position in ecliptic frame (km), Earth at origin */
    cartesian: { x: number; y: number; z: number };
  };

  /** Moon's position and derived quantities */
  moon: {
    position: LunarPosition;
    equatorial: EquatorialCoords;
    /** Cartesian position in ecliptic frame (km), Earth at origin */
    cartesian: { x: number; y: number; z: number };
  };

  /** Phase and illumination data */
  phase: {
    /** Elongation of Moon from Sun (degrees) */
    elongation: number;
    /** Phase angle i: 0° = full Moon, 180° = new Moon */
    phaseAngle: number;
    /** Illuminated fraction k: 0 = new Moon, 1 = full Moon */
    illuminatedFraction: number;
    /** Human-readable phase name */
    name: string;
    /** Position angle of the bright limb (degrees from N through E) */
    brightLimbAngle: number;
    /** True if Moon is waxing (elongation between 0° and 180°) */
    isWaxing: boolean;
    /** Synodic age in days (0 = new moon, ~14.77 = full moon, ~29.53 = next new) */
    age: number;
  };

  /** Eclipse proximity (how close we are to an eclipse configuration) */
  eclipseProximity: {
    /** Absolute ecliptic latitude of Moon (degrees) — must be < ~1.5° for eclipse */
    lunarLatitude: number;
    /** Angular separation between Moon and Sun/anti-Sun (degrees) */
    solarSeparation: number;
    /** True if geometry is close enough for a possible solar eclipse */
    nearSolarEclipse: boolean;
    /** True if geometry is close enough for a possible lunar eclipse */
    nearLunarEclipse: boolean;
  };

  /** Greenwich sidereal time (degrees) */
  gmst: number;
  gast: number;
}

/** Observer-specific view of the sky */
export interface ObserverView {
  /** Moon's position in observer's sky */
  moonHorizontal: HorizontalCoords;
  /** Sun's position in observer's sky */
  sunHorizontal: HorizontalCoords;
  /** Moon's altitude corrected for atmospheric refraction */
  moonApparentAltitude: number;
  /** Is the Moon above the horizon? */
  moonVisible: boolean;
  /** Is the Sun above the horizon? (i.e., is it daytime?) */
  isDaytime: boolean;
  /** Local sidereal time (degrees) */
  lst: number;
}

/**
 * Compute the complete celestial snapshot for a given Julian Date.
 */
export function computeSnapshot(jd: number): CelestialSnapshot {
  const T = jdToT(jd);

  // Nutation and obliquity
  const nutation = computeNutation(T);

  // Solar position
  const sunPos = computeSolarPosition(T, nutation.nutationLongitude);
  const sunEq = eclipticToEquatorial(
    sunPos.apparentLongitude,
    sunPos.latitude,
    nutation.trueObliquity,
  );

  // Moon position
  const moonPos = computeLunarPosition(T, nutation.nutationLongitude);
  const moonEq = eclipticToEquatorial(
    moonPos.longitude,
    moonPos.latitude,
    nutation.trueObliquity,
  );

  // Cartesian positions in the ecliptic frame (Earth at origin)
  // Sun: opposite direction from Earth's position (Sun is at -Earth)
  const sunDistKm = sunPos.distanceAU * AU_KM;
  const sunCart = {
    x: sunDistKm * cosDeg(sunPos.apparentLongitude) * cosDeg(sunPos.latitude),
    y: sunDistKm * sinDeg(sunPos.apparentLongitude) * cosDeg(sunPos.latitude),
    z: sunDistKm * sinDeg(sunPos.latitude),
  };

  const moonCart = {
    x: moonPos.distanceKm * cosDeg(moonPos.longitude) * cosDeg(moonPos.latitude),
    y: moonPos.distanceKm * sinDeg(moonPos.longitude) * cosDeg(moonPos.latitude),
    z: moonPos.distanceKm * sinDeg(moonPos.latitude),
  };

  // Phase computation
  const illum = lunarIllumination(
    moonPos.longitude,
    moonPos.latitude,
    sunPos.apparentLongitude,
    moonPos.distanceKm,
    sunPos.distanceAU,
  );

  // Determine waxing/waning from Moon-Sun elongation
  // The Moon's elongation increases from 0° (new) to 180° (full) = waxing
  // then decreases from 180° to 360° (next new) = waning
  const rawElongation = moonPos.longitude - sunPos.apparentLongitude;
  const normalizedElong = ((rawElongation % 360) + 360) % 360;
  const isWaxing = normalizedElong > 0 && normalizedElong < 180;

  // Synodic age (approximate)
  const age = normalizedElong / 360 * 29.530588861;

  // Bright limb angle
  const blAngle = brightLimbAngle(
    sunEq.rightAscension,
    sunEq.declination,
    moonEq.rightAscension,
    moonEq.declination,
  );

  // Phase name (using the 0-360 elongation)
  let pName: string;
  if (normalizedElong < 11.25) pName = "New Moon";
  else if (normalizedElong < 78.75) pName = "Waxing Crescent";
  else if (normalizedElong < 101.25) pName = "First Quarter";
  else if (normalizedElong < 168.75) pName = "Waxing Gibbous";
  else if (normalizedElong < 191.25) pName = "Full Moon";
  else if (normalizedElong < 258.75) pName = "Waning Gibbous";
  else if (normalizedElong < 281.25) pName = "Third Quarter";
  else if (normalizedElong < 348.75) pName = "Waning Crescent";
  else pName = "New Moon";

  // Eclipse proximity detection
  const absLunarLat = Math.abs(moonPos.latitude);
  // Solar eclipse: Moon near Sun (elongation near 0°), Moon near ecliptic
  const solarSep = Math.min(normalizedElong, 360 - normalizedElong);
  const nearSolarEclipse = solarSep < 18.5 && absLunarLat < 1.6;
  // Lunar eclipse: Moon near anti-Sun (elongation near 180°)
  const lunarSep = Math.abs(normalizedElong - 180);
  const nearLunarEclipse = lunarSep < 12 && absLunarLat < 1.1;

  // Sidereal time
  const gmst = greenwichMeanSiderealTime(jd);
  const gast = greenwichApparentSiderealTime(
    jd,
    nutation.nutationLongitude,
    nutation.trueObliquity,
  );

  return {
    jd,
    T,
    nutation,
    sun: { position: sunPos, equatorial: sunEq, cartesian: sunCart },
    moon: { position: moonPos, equatorial: moonEq, cartesian: moonCart },
    phase: {
      elongation: normalizedElong,
      phaseAngle: illum.phaseAngle,
      illuminatedFraction: illum.illuminatedFraction,
      name: pName,
      brightLimbAngle: blAngle,
      isWaxing,
      age,
    },
    eclipseProximity: {
      lunarLatitude: absLunarLat,
      solarSeparation: solarSep,
      nearSolarEclipse,
      nearLunarEclipse,
    },
    gmst,
    gast,
  };
}

/**
 * Compute what an observer at a given location sees.
 *
 * @param snapshot - The celestial snapshot (from computeSnapshot)
 * @param latitude - Observer's geographic latitude (degrees, N positive)
 * @param longitude - Observer's geographic longitude (degrees, E positive)
 */
export function computeObserverView(
  snapshot: CelestialSnapshot,
  latitude: number,
  longitude: number,
): ObserverView {
  const lst = localSiderealTime(snapshot.gast, longitude);

  const moonHoriz = equatorialToHorizontal(
    snapshot.moon.equatorial.rightAscension,
    snapshot.moon.equatorial.declination,
    latitude,
    lst,
  );

  const sunHoriz = equatorialToHorizontal(
    snapshot.sun.equatorial.rightAscension,
    snapshot.sun.equatorial.declination,
    latitude,
    lst,
  );

  const moonApparentAlt = refractedAltitude(moonHoriz.altitude);

  return {
    moonHorizontal: moonHoriz,
    sunHorizontal: sunHoriz,
    moonApparentAltitude: moonApparentAlt,
    moonVisible: moonApparentAlt > 0,
    isDaytime: sunHoriz.altitude > -0.833, // Sun center below horizon by 50'
    lst,
  };
}

/**
 * Convenience: compute snapshot from a JavaScript Date.
 */
export function snapshotFromDate(date: Date): CelestialSnapshot {
  return computeSnapshot(dateToJD(date));
}

/**
 * Convenience: compute snapshot for right now.
 */
export function snapshotNow(): CelestialSnapshot {
  return snapshotFromDate(new Date());
}
