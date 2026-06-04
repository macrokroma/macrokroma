/**
 * OrbitalScene3D — 3D viewport for the Sun-Earth-Moon system.
 *
 * Renders Earth, Moon, and Sun at positions computed by the ephemeris engine,
 * with a DirectionalLight from the Sun so the Moon's illuminated hemisphere
 * is correct from the geometry itself.
 *
 * Uses only basic Three.js primitives (no drei Line/Text) to ensure
 * WebGPU renderer compatibility.
 */

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useLunarStore } from "../store/lunarStore";
import { DEG2RAD } from "../compute/constants";

// ─── Scale constants ────────────────────────────────────────────

const EXAGGERATED = {
  earthRadius: 1,
  moonRadius: 0.273,
  moonDistScale: 20 / 384400,     // maps 384400 km → 20 units
  sunDistance: 80,
  sunRadius: 3,
};

/**
 * Inner scene content (must be inside an R3F Canvas).
 */
export function OrbitalSceneContent() {
  const earthRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const sunIndicatorRef = useRef<THREE.Mesh>(null);

  // Subscribe to store with proper cleanup
  const storeRef = useRef(useLunarStore.getState());
  useEffect(() => {
    const unsub = useLunarStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsub;
  }, []);

  // Generate orbit ring as a Three.js Line object (avoids JSX <line> vs SVG conflict)
  const orbitLine = useMemo(() => {
    const segments = 128;
    const r = 384400 * EXAGGERATED.moonDistScale;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * r,
        0,
        Math.sin(angle) * r,
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: "#ffffff", opacity: 0.15, transparent: true });
    const line = new THREE.LineLoop(geo, mat);
    line.rotation.x = 5.145 * DEG2RAD;
    return line;
  }, []);

  useFrame(() => {
    const store = storeRef.current;
    const { snapshot } = store;
    const scale = EXAGGERATED;

    // ── Moon position ──
    // Ecliptic frame: x,y in ecliptic plane, z perpendicular
    // Three.js frame: x right, y up, z toward camera
    // Map: ecliptic x → Three x, ecliptic z → Three y, ecliptic y → Three z
    const mc = snapshot.moon.cartesian;
    if (moonRef.current) {
      moonRef.current.position.set(
        mc.x * scale.moonDistScale,
        mc.z * scale.moonDistScale,
        mc.y * scale.moonDistScale,
      );
    }

    // ── Sun direction (for lighting) ──
    const sc = snapshot.sun.cartesian;
    const sd = Math.sqrt(sc.x ** 2 + sc.y ** 2 + sc.z ** 2);
    const sunDir = { x: sc.x / sd, y: sc.z / sd, z: sc.y / sd };

    if (sunLightRef.current) {
      sunLightRef.current.position.set(
        sunDir.x * 100,
        sunDir.y * 100,
        sunDir.z * 100,
      );
    }

    // ── Sun indicator ──
    if (sunIndicatorRef.current) {
      sunIndicatorRef.current.position.set(
        sunDir.x * scale.sunDistance,
        sunDir.y * scale.sunDistance,
        sunDir.z * scale.sunDistance,
      );
    }

    // ── Earth rotation ──
    if (earthRef.current) {
      earthRef.current.rotation.y = snapshot.gmst * DEG2RAD;
    }
  });

  return (
    <>
      {/* Camera controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        minDistance={3}
        maxDistance={200}
      />

      {/* Lighting — initial position pointing from +x so Earth is lit on first frame */}
      <ambientLight intensity={0.15} />
      <directionalLight
        ref={sunLightRef}
        intensity={2.5}
        color="#fff5e0"
        position={[100, 10, 0]}
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

      {/* Moon */}
      <mesh ref={moonRef} scale={EXAGGERATED.moonRadius}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color="#ccccbb"
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>

      {/* Sun indicator */}
      <mesh ref={sunIndicatorRef}>
        <sphereGeometry args={[EXAGGERATED.sunRadius, 16, 16]} />
        <meshBasicMaterial color="#ffdd44" />
      </mesh>

      {/* Moon orbit ring */}
      <primitive object={orbitLine} />
    </>
  );
}