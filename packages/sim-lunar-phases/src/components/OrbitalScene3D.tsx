/**
 * OrbitalScene3D — 3D viewport for the Sun-Earth-Moon system.
 *
 * Renders Earth, Moon, and Sun at positions computed by the ephemeris engine,
 * with a DirectionalLight from the Sun so the Moon's illuminated hemisphere
 * is correct from the geometry itself.
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
  moonDistScale: 20 / 384400,
  sunDistance: 80,
  sunRadius: 3,
};

// ─── Axes indicator (screen-anchored, world-aligned) ────────────
// Stays in the bottom-right corner at constant apparent size.
// Doesn't rotate — so as the camera orbits, the axes show you
// which direction is which in world space.

function AxesIndicator() {
  const groupRef = useRef<THREE.Group>(null);

  const axesHelper = useMemo(() => {
    const helper = new THREE.AxesHelper(1);
    // Render on top of everything
    helper.renderOrder = 999;
    if (Array.isArray(helper.material)) {
      helper.material.forEach((m) => { m.depthTest = false; });
    } else {
      helper.material.depthTest = false;
    }
    return helper;
  }, []);

  // Reusable vectors to avoid per-frame allocation
  const _ndc = useMemo(() => new THREE.Vector3(), []);
  const _camPos = useMemo(() => new THREE.Vector3(), []);
  const _dir = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;

    // Unproject a bottom-right NDC point to find world position
    _ndc.set(0.82, -0.75, 0.98);
    _ndc.unproject(camera);

    _camPos.copy(camera.position);
    _dir.copy(_ndc).sub(_camPos).normalize();

    // Place at fixed distance from camera
    const screenDist = 25;
    groupRef.current.position.copy(_camPos).addScaledVector(_dir, screenDist);

    // Constant apparent size
    const dist = groupRef.current.position.distanceTo(_camPos);
    groupRef.current.scale.setScalar(dist * 0.045);

    // Stay world-aligned (no rotation)
    groupRef.current.quaternion.identity();
  });

  return (
    <group ref={groupRef}>
      <primitive object={axesHelper} />
    </group>
  );
}

// ─── Main scene ─────────────────────────────────────────────────

export function OrbitalSceneContent() {
  const earthRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const sunIndicatorRef = useRef<THREE.Mesh>(null);

  // Store subscription with cleanup
  const storeRef = useRef(useLunarStore.getState());
  useEffect(() => {
    const unsub = useLunarStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsub;
  }, []);

  // ── Orbit ring (thin torus mesh — guaranteed WebGPU compatible) ──
  const orbitRing = useMemo(() => {
    const r = 384400 * EXAGGERATED.moonDistScale; // ~20 units
    const tube = 0.04;
    const geo = new THREE.TorusGeometry(r, tube, 8, 128);
    const mat = new THREE.MeshBasicMaterial({
      color: "#6688aa",
      opacity: 0.35,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // TorusGeometry lies in XY plane; rotate to XZ, then tilt by orbital inclination
    mesh.rotation.x = Math.PI / 2 + 5.145 * DEG2RAD;
    return mesh;
  }, []);

  // ── Ecliptic grid ──
  const eclipticGrid = useMemo(() => {
    return new THREE.GridHelper(80, 20, "#334455", "#223344");
  }, []);

  // ── Earth axis tilt line ──
  const axisLine = useMemo(() => {
    const points = [
      new THREE.Vector3(0, -2.2, 0),
      new THREE.Vector3(0, 2.2, 0),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: "#88aaff",
      opacity: 0.5,
      transparent: true,
    });
    const line = new THREE.Line(geo, mat);
    line.rotation.z = 23.44 * DEG2RAD;
    return line;
  }, []);

  // ── Lunar node markers ──
  const ascendingNode = useMemo(() => {
    const geo = new THREE.RingGeometry(0.2, 0.4, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: "#44ff88",
      side: THREE.DoubleSide,
      opacity: 0.6,
      transparent: true,
    });
    return new THREE.Mesh(geo, mat);
  }, []);

  const descendingNode = useMemo(() => {
    const geo = new THREE.RingGeometry(0.2, 0.4, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: "#ff4488",
      side: THREE.DoubleSide,
      opacity: 0.6,
      transparent: true,
    });
    return new THREE.Mesh(geo, mat);
  }, []);

  // ── Per-frame updates ──
  useFrame(() => {
    const store = storeRef.current;
    const { snapshot } = store;
    const scale = EXAGGERATED;

    // Moon position
    const mc = snapshot.moon.cartesian;
    if (moonRef.current) {
      moonRef.current.position.set(
        mc.x * scale.moonDistScale,
        mc.z * scale.moonDistScale,
        mc.y * scale.moonDistScale,
      );
    }

    // Sun direction
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

    if (sunIndicatorRef.current) {
      sunIndicatorRef.current.position.set(
        sunDir.x * scale.sunDistance,
        sunDir.y * scale.sunDistance,
        sunDir.z * scale.sunDistance,
      );
    }

    // Lunar nodes
    const nodeAngle = snapshot.moon.position.ascendingNodeLongitude * DEG2RAD;
    const orbitR = 384400 * scale.moonDistScale;
    ascendingNode.position.set(
      Math.cos(nodeAngle) * orbitR, 0, Math.sin(nodeAngle) * orbitR,
    );
    ascendingNode.rotation.x = -Math.PI / 2;
    descendingNode.position.set(
      -Math.cos(nodeAngle) * orbitR, 0, -Math.sin(nodeAngle) * orbitR,
    );
    descendingNode.rotation.x = -Math.PI / 2;

    // Earth rotation
    if (earthRef.current) {
      earthRef.current.rotation.y = snapshot.gmst * DEG2RAD;
    }
  });

  // Toggles (reactive, don't need 60fps)
  const { showOrbits, showAxialTilt, showEclipticPlane, showLunarNodes } = useLunarStore();

  return (
    <>
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        minDistance={2}
        maxDistance={300}
      />

      {/* Lighting */}
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
        <meshStandardMaterial color="#4488cc" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Moon */}
      <mesh ref={moonRef} scale={EXAGGERATED.moonRadius}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color="#ccccbb" roughness={0.9} metalness={0.0} />
      </mesh>

      {/* Sun */}
      <mesh ref={sunIndicatorRef}>
        <sphereGeometry args={[EXAGGERATED.sunRadius, 16, 16]} />
        <meshBasicMaterial color="#ffdd44" />
      </mesh>

      {/* Toggleable overlays */}
      {showOrbits && <primitive object={orbitRing} />}
      {showAxialTilt && <primitive object={axisLine} />}
      {showEclipticPlane && <primitive object={eclipticGrid} />}
      {showLunarNodes && (
        <>
          <primitive object={ascendingNode} />
          <primitive object={descendingNode} />
        </>
      )}

      {/* Axes indicator — always visible, anchored to bottom-right */}
      <AxesIndicator />
    </>
  );
}
