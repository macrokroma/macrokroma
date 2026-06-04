/**
 * OrbitalScene3D — 3D viewport for the Sun-Earth-Moon system.
 *
 * Renders Earth, Moon, and Sun at positions computed by the ephemeris engine,
 * with a DirectionalLight from the Sun so the Moon's illuminated hemisphere
 * is correct from the geometry itself.
 *
 * Scale modes:
 *   "exaggerated" — bodies inflated, distances compressed, everything visible
 *   "realistic"   — true proportions (Moon is a speck 60 Earth-radii away)
 *
 * The scene reads positions from the Zustand store each frame via useFrame,
 * which runs outside React reconciliation for smooth 60fps updates.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { useLunarStore } from "../store/lunarStore";
import { DEG2RAD } from "../compute/constants";

// ─── Scale constants ────────────────────────────────────────────
// In "exaggerated" mode we map real km to scene units with these factors.
// The goal: Moon orbits at ~20 units from Earth, Earth radius = 1 unit.

const EARTH_RADIUS_UNIT = 1;
const MOON_RADIUS_RATIO = 0.273; // real ratio Moon/Earth radius

const EXAGGERATED = {
  earthRadius: EARTH_RADIUS_UNIT,
  moonRadius: EARTH_RADIUS_UNIT * MOON_RADIUS_RATIO,
  moonDistScale: 20 / 384400,  // maps 384400 km → 20 units
  sunDistance: 80,              // Sun indicator placed at fixed distance
  sunRadius: 3,                // visual indicator size (not to scale)
};

const REALISTIC = {
  earthRadius: EARTH_RADIUS_UNIT,
  moonRadius: EARTH_RADIUS_UNIT * MOON_RADIUS_RATIO,
  moonDistScale: 1 / 6371,    // 1 unit = 1 Earth radius = 6371 km
  sunDistance: 149597870.7 / 6371, // ~23,481 units (very far)
  sunRadius: 695700 / 6371,   // ~109 units
};

/**
 * Inner scene content (must be inside an R3F Canvas).
 */
export function OrbitalSceneContent() {
  const earthRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const sunIndicatorRef = useRef<THREE.Mesh>(null);

  // Subscribe to store — useFrame reads directly for performance
  const storeRef = useRef(useLunarStore.getState());
  useLunarStore.subscribe((state) => { storeRef.current = state; });

  // Generate orbit path points (circle approximation for visual reference)
  const orbitPoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      // Orbit radius in exaggerated units (mean distance)
      const r = 384400 * EXAGGERATED.moonDistScale;
      points.push([
        Math.cos(angle) * r,
        0,
        Math.sin(angle) * r,
      ]);
    }
    return points;
  }, []);

  useFrame(() => {
    const store = storeRef.current;

    const { snapshot, scaleMode } = store;
    const scale = scaleMode === "exaggerated" ? EXAGGERATED : REALISTIC;

    // Moon position: convert ecliptic Cartesian (km) to scene units
    // The ephemeris gives x,y,z in ecliptic frame with Earth at origin.
    // In Three.js: x = right, y = up, z = toward camera.
    // Ecliptic frame: x,y are in the ecliptic plane, z is perpendicular.
    // Map: ecliptic x → scene x, ecliptic y → scene z, ecliptic z → scene y
    const moonCart = snapshot.moon.cartesian;
    const moonX = moonCart.x * scale.moonDistScale;
    const moonY = moonCart.z * scale.moonDistScale; // ecliptic z → up
    const moonZ = moonCart.y * scale.moonDistScale; // ecliptic y → into screen

    if (moonRef.current) {
      moonRef.current.position.set(moonX, moonY, moonZ);
      moonRef.current.scale.setScalar(scale.moonRadius);
    }

    // Sun direction: normalize the Sun's Cartesian position for the light
    const sunCart = snapshot.sun.cartesian;
    const sunDist = Math.sqrt(sunCart.x ** 2 + sunCart.y ** 2 + sunCart.z ** 2);
    const sunDirX = sunCart.x / sunDist;
    const sunDirY = sunCart.z / sunDist; // ecliptic z → up
    const sunDirZ = sunCart.y / sunDist;

    if (sunLightRef.current) {
      // Place the directional light far away in the Sun's direction
      sunLightRef.current.position.set(
        sunDirX * 100,
        sunDirY * 100,
        sunDirZ * 100,
      );
      sunLightRef.current.target.position.set(0, 0, 0);
      sunLightRef.current.target.updateMatrixWorld();
    }

    // Sun indicator sphere (visual marker, not to scale)
    if (sunIndicatorRef.current) {
      if (scaleMode === "exaggerated") {
        sunIndicatorRef.current.position.set(
          sunDirX * scale.sunDistance,
          sunDirY * scale.sunDistance,
          sunDirZ * scale.sunDistance,
        );
        sunIndicatorRef.current.visible = true;
      } else {
        sunIndicatorRef.current.visible = false; // too far in realistic mode
      }
    }

    // Earth rotation (sidereal day)
    if (earthRef.current) {
      // Rotate around y-axis by GMST (Greenwich sidereal time)
      earthRef.current.rotation.y = snapshot.gmst * DEG2RAD;
    }
  });

  const store = useLunarStore();

  return (
    <>
      {/* Camera controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        minDistance={3}
        maxDistance={200}
      />

      {/* Lighting */}
      <ambientLight intensity={0.08} />
      <directionalLight
        ref={sunLightRef}
        intensity={2.5}
        color="#fff5e0"
        castShadow={false}
      />

      {/* Earth */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[EXAGGERATED.earthRadius, 32, 32]} />
        <meshStandardMaterial
          color="#4488cc"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Earth's axis indicator (thin line) */}
      {store.showAxialTilt && (
        <group rotation={[0, 0, 23.44 * DEG2RAD]}>
          <Line
            points={[[0, -1.8, 0], [0, 1.8, 0]]}
            color="#ffffff"
            lineWidth={1}
            opacity={0.3}
            transparent
          />
        </group>
      )}

      {/* Moon */}
      <mesh ref={moonRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color="#ccccbb"
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>

      {/* Sun indicator (in exaggerated mode only) */}
      <mesh ref={sunIndicatorRef}>
        <sphereGeometry args={[EXAGGERATED.sunRadius, 16, 16]} />
        <meshBasicMaterial color="#ffdd44" />
      </mesh>

      {/* Moon orbit path */}
      {store.showOrbits && (
        <group rotation={[5.145 * DEG2RAD, 0, 0]}>
          <Line
            points={orbitPoints}
            color="#ffffff"
            lineWidth={0.5}
            opacity={0.15}
            transparent
          />
        </group>
      )}

      {/* Ecliptic plane reference (subtle grid) */}
      {store.showEclipticPlane && (
        <gridHelper
          args={[60, 20, "#334455", "#223344"]}
          position={[0, 0, 0]}
        />
      )}

      {/* Labels */}
      {store.showLabels && (
        <>
          {/* We'll add drei Text labels in a follow-up */}
        </>
      )}
    </>
  );
}
