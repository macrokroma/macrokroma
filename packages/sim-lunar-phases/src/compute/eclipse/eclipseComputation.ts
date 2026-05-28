/**
 * Eclipse geometry computation.
 *
 * Computes shadow cone geometry for solar eclipses and Earth's shadow
 * geometry for lunar eclipses. Uses the positions from the ephemeris
 * to determine eclipse type, magnitude, and ground track.
 *
 * For solar eclipses, the key computation is projecting the Moon's
 * shadow cone onto Earth's surface. The umbral shadow (total eclipse)
 * traces a narrow path; the penumbral shadow (partial eclipse) covers
 * a much larger area.
 *
 * For lunar eclipses, we compute how deeply the Moon penetrates
 * Earth's shadow cone.
 */

import { DEG2RAD, RAD2DEG, EARTH_RADIUS_KM, MOON_RADIUS_KM, SUN_RADIUS_KM, AU_KM } from "../constants";
import type { CelestialSnapshot } from "../ephemeris/meeus";

export type SolarEclipseType = "none" | "partial" | "annular" | "total" | "hybrid";
export type LunarEclipseType = "none" | "penumbral" | "partial" | "total";

export interface SolarEclipseInfo {
  type: SolarEclipseType;
  /** Maximum magnitude (fraction of Sun's diameter covered) */
  magnitude: number;
  /** Angular separation between Sun and Moon centers (degrees) */
  separation: number;
  /** Sun's angular semi-diameter (degrees) */
  sunAngularRadius: number;
  /** Moon's angular semi-diameter (degrees) */
  moonAngularRadius: number;
  /** Ratio of Moon/Sun angular diameters (>1 means Moon appears larger = possible total) */
  diameterRatio: number;
}

export interface LunarEclipseInfo {
  type: LunarEclipseType;
  /** Maximum magnitude (fraction of Moon's diameter in umbra) */
  umbralMagnitude: number;
  /** Penumbral magnitude */
  penumbralMagnitude: number;
  /** Angular radius of Earth's umbral shadow at Moon's distance (degrees) */
  umbralRadius: number;
  /** Angular radius of Earth's penumbral shadow at Moon's distance (degrees) */
  penumbralRadius: number;
  /** Angular distance of Moon's center from shadow center (degrees) */
  moonShadowDistance: number;
}

/**
 * Compute solar eclipse circumstances for a given snapshot.
 *
 * This is a simplified computation that determines eclipse type and
 * magnitude based on the angular separation and apparent sizes of
 * the Sun and Moon. For precise ground tracks, the full Besselian
 * elements method would be needed (future enhancement).
 */
export function computeSolarEclipse(snapshot: CelestialSnapshot): SolarEclipseInfo {
  const sunR = snapshot.sun.position.angularDiameter / 2;
  const moonR = snapshot.moon.position.angularDiameter / 2;
  const sep = snapshot.eclipseProximity.solarSeparation;

  const diameterRatio = moonR / sunR;

  // No eclipse if separation is too large
  if (sep > sunR + moonR) {
    return {
      type: "none",
      magnitude: 0,
      separation: sep,
      sunAngularRadius: sunR,
      moonAngularRadius: moonR,
      diameterRatio,
    };
  }

  // Compute magnitude
  let magnitude: number;
  let type: SolarEclipseType;

  if (sep <= Math.abs(sunR - moonR)) {
    // Moon is entirely within Sun's disc or vice versa
    if (moonR >= sunR) {
      type = "total";
      magnitude = 1;
    } else {
      type = "annular";
      magnitude = (moonR / sunR) ** 2; // Area ratio for annular
    }
  } else {
    // Partial eclipse
    type = "partial";
    magnitude = (sunR + moonR - sep) / (2 * sunR);
  }

  return {
    type,
    magnitude,
    separation: sep,
    sunAngularRadius: sunR,
    moonAngularRadius: moonR,
    diameterRatio,
  };
}

/**
 * Compute lunar eclipse circumstances for a given snapshot.
 *
 * Earth's shadow at the Moon's distance consists of two cones:
 * - Umbra: the dark inner cone where Earth completely blocks the Sun
 * - Penumbra: the lighter outer cone where Earth partially blocks the Sun
 *
 * The angular radii of these shadows depend on the Sun's and Moon's distances.
 */
export function computeLunarEclipse(snapshot: CelestialSnapshot): LunarEclipseInfo {
  const moonDist = snapshot.moon.position.distanceKm;
  const sunDist = snapshot.sun.position.distanceAU * AU_KM;

  // Angular radius of the Sun as seen from Earth (radians)
  const sunAngRad = Math.asin(SUN_RADIUS_KM / sunDist);

  // Angular radius of Earth as seen from the Moon's distance (radians)
  const earthAngRad = Math.asin(EARTH_RADIUS_KM / moonDist);

  // Umbral shadow cone half-angle at Moon's distance
  // (Earth's angular radius minus Sun's parallax at Moon's distance)
  const umbralRadius = (earthAngRad - sunAngRad) * RAD2DEG;

  // Penumbral shadow half-angle at Moon's distance
  const penumbralRadius = (earthAngRad + sunAngRad) * RAD2DEG;

  // Moon's angular radius at its current distance
  const moonAngRadius = Math.asin(MOON_RADIUS_KM / moonDist) * RAD2DEG;

  // Distance of Moon's center from the anti-solar point (shadow center)
  // This is approximately the Moon's ecliptic latitude when elongation ≈ 180°
  const lunarSep = Math.abs(snapshot.eclipseProximity.lunarLatitude);

  // Also need to account for elongation not being exactly 180°
  const elongFromOpposition = Math.abs(snapshot.phase.elongation - 180);
  const moonShadowDistance = Math.sqrt(
    lunarSep * lunarSep + elongFromOpposition * elongFromOpposition,
  );

  // Umbral magnitude: how far the Moon penetrates the umbra
  // Positive = Moon is in the umbra
  const umbralMagnitude = (umbralRadius + moonAngRadius - moonShadowDistance) / (2 * moonAngRadius);

  // Penumbral magnitude
  const penumbralMagnitude = (penumbralRadius + moonAngRadius - moonShadowDistance) / (2 * moonAngRadius);

  let type: LunarEclipseType = "none";
  if (umbralMagnitude >= 1) {
    type = "total";
  } else if (umbralMagnitude > 0) {
    type = "partial";
  } else if (penumbralMagnitude > 0) {
    type = "penumbral";
  }

  return {
    type,
    umbralMagnitude: Math.max(0, umbralMagnitude),
    penumbralMagnitude: Math.max(0, penumbralMagnitude),
    umbralRadius: Math.max(0, umbralRadius),
    penumbralRadius,
    moonShadowDistance,
  };
}
