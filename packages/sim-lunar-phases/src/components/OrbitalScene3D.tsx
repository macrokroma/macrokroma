/**
 * OrbitalScene3D — 3D viewport for the Sun-Earth-Moon system.
 *
 * Supports three reference frames (earth/sun/moon centered)
 * and two scale modes (exaggerated for clarity, realistic for truth).
 */

import { useRef, useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";
import { useLunarStore, type CenterBody, type ScaleMode } from "../store/lunarStore";
import { DEG2RAD, AU_KM } from "../compute/constants";

// ─── Scale configs ──────────────────────────────────────────────
//
// Exaggerated: bodies inflated, distances compressed, everything visible.
// Realistic:   true proportional sizes and distances (bodies become dots).
//
// In realistic Earth-centered:
//   Earth radius = 1 unit = 6371 km
//   Moon radius  = 0.273 units
//   Moon distance = 60.3 units   (384400 / 6371)
//   Sun distance  = too far to show (23481 units), use indicator
//
// In realistic Sun-centered:
//   Sun radius   = 109 units
//   Earth radius = 1 unit
//   Earth dist   = 23481 units   — camera needs to be far out
//   Moon orbit   = 60 units around Earth (still tiny vs Earth-Sun gap)

interface ScaleConfig {
  earthRadius: number;
  moonRadius: number;
  sunRadius: number;
  primaryScale: number;      // km → scene units for the main orbital distance
  moonOffsetScale: number;   // km → scene units for Moon's offset from Earth
  sunIndicatorDist: number;  // fixed distance for Sun indicator (0 = Sun at center)
}

function getScale(center: CenterBody, mode: ScaleMode): ScaleConfig {
  if (mode === "realistic") {
    const KM_TO_UNIT = 1 / 6371; // 1 unit = 1 Earth radius
    switch (center) {
      case "earth":
        return {
          earthRadius: 1,
          moonRadius: 1737 * KM_TO_UNIT,      // 0.273
          sunRadius: 4,                         // indicator only (real = 109 units)
          primaryScale: KM_TO_UNIT,             // Moon at ~60 units
          moonOffsetScale: KM_TO_UNIT,
          sunIndicatorDist: 150,                // Sun indicator at edge of view
        };
      case "sun":
        return {
          earthRadius: 1,
          moonRadius: 1737 * KM_TO_UNIT,
          sunRadius: 695700 * KM_TO_UNIT * 0.1, // shrunk 10x so it doesn't swallow Earth visually
          primaryScale: KM_TO_UNIT * 0.003,      // Earth at ~70 units (compressed from 23K)
          moonOffsetScale: KM_TO_UNIT * 0.5,     // Moon orbit inflated so it's visible
          sunIndicatorDist: 0,
        };
      case "moon":
        return {
          earthRadius: 1,
          moonRadius: 1737 * KM_TO_UNIT,
          sunRadius: 4,
          primaryScale: KM_TO_UNIT,
          moonOffsetScale: KM_TO_UNIT,
          sunIndicatorDist: 150,
        };
    }
  }

  // Exaggerated mode
  switch (center) {
    case "earth":
      return {
        earthRadius: 1,
        moonRadius: 0.273,
        sunRadius: 3,
        primaryScale: 20 / 384400,
        moonOffsetScale: 20 / 384400,
        sunIndicatorDist: 80,
      };
    case "sun":
      return {
        earthRadius: 0.6,
        moonRadius: 0.18,
        sunRadius: 4,
        primaryScale: 40 / AU_KM,
        moonOffsetScale: 3 / 384400,
        sunIndicatorDist: 0,
      };
    case "moon":
      return {
        earthRadius: 1,
        moonRadius: 0.273,
        sunRadius: 3,
        primaryScale: 20 / 384400,
        moonOffsetScale: 20 / 384400,
        sunIndicatorDist: 80,
      };
  }
}

/** Map ecliptic cartesian (km) to Three.js: ecliptic x→x, z→y(up), y→z */
function eclipticToThree(
  ec: { x: number; y: number; z: number },
  scale: number,
): [number, number, number] {
  return [ec.x * scale, ec.z * scale, ec.y * scale];
}

// ─── Texture loader ─────────────────────────────────────────────

interface LoadedTextures { earthDay: THREE.Texture; earthBump: THREE.Texture; moon: THREE.Texture; }

function useTextures(): LoadedTextures | null {
  const [textures, setTextures] = useState<LoadedTextures | null>(null);
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let disposed = false;
    Promise.all([
      loader.loadAsync("/textures/earth_day.jpg"),
      loader.loadAsync("/textures/earth_bump.jpg"),
      loader.loadAsync("/textures/moon.jpg"),
    ]).then(([earthDay, earthBump, moon]) => {
      if (disposed) return;
      earthDay.colorSpace = THREE.SRGBColorSpace;
      moon.colorSpace = THREE.SRGBColorSpace;
      setTextures({ earthDay, earthBump, moon });
    });
    return () => { disposed = true; };
  }, []);
  return textures;
}

// ─── Camera controls ────────────────────────────────────────────

function CameraControls() {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 0.5;
    controls.maxDistance = 500;
    controlsRef.current = controls;
    return () => controls.dispose();
  }, [camera, gl]);
  useFrame(() => { controlsRef.current?.update(); });
  return null;
}

// ─── Axes indicator ─────────────────────────────────────────────

function AxesIndicator() {
  const groupRef = useRef<THREE.Group>(null);
  const axesHelper = useMemo(() => {
    const helper = new THREE.AxesHelper(1);
    helper.renderOrder = 999;
    if (Array.isArray(helper.material)) {
      helper.material.forEach((m) => { m.depthTest = false; });
    } else { helper.material.depthTest = false; }
    return helper;
  }, []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);
  const _camPos = useMemo(() => new THREE.Vector3(), []);
  const _dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    _ndc.set(0.82, -0.75, 0.98);
    _ndc.unproject(camera);
    _camPos.copy(camera.position);
    _dir.copy(_ndc).sub(_camPos).normalize();
    groupRef.current.position.copy(_camPos).addScaledVector(_dir, 25);
    const dist = groupRef.current.position.distanceTo(_camPos);
    groupRef.current.scale.setScalar(dist * 0.045);
    groupRef.current.quaternion.identity();
  });
  return <group ref={groupRef}><primitive object={axesHelper} /></group>;
}

// ─── Main scene ─────────────────────────────────────────────────

export function OrbitalSceneContent() {
  const earthRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const sunRef = useRef<THREE.Mesh>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const sunTargetRef = useRef<THREE.Object3D>(null);
  const earthMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const moonMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const moonOrbitGroupRef = useRef<THREE.Group>(null);

  // Textures
  const textures = useTextures();
  useEffect(() => {
    if (!textures) return;
    if (earthMatRef.current) {
      earthMatRef.current.map = textures.earthDay;
      earthMatRef.current.bumpMap = textures.earthBump;
      earthMatRef.current.bumpScale = 0.05;
      earthMatRef.current.needsUpdate = true;
    }
    if (moonMatRef.current) {
      moonMatRef.current.map = textures.moon;
      moonMatRef.current.needsUpdate = true;
    }
  }, [textures]);

  // Store
  const storeRef = useRef(useLunarStore.getState());
  useEffect(() => {
    const unsub = useLunarStore.subscribe((s) => { storeRef.current = s; });
    return unsub;
  }, []);

  // ── Orbit rings (unit radius, scaled dynamically) ──
  const moonOrbitRing = useMemo(() => {
    const geo = new THREE.TorusGeometry(1, 0.003, 8, 128);
    const mat = new THREE.MeshBasicMaterial({ color: "#6688aa", opacity: 0.35, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }, []);

  const earthOrbitRing = useMemo(() => {
    const geo = new THREE.TorusGeometry(1, 0.004, 8, 128);
    const mat = new THREE.MeshBasicMaterial({ color: "#aaaa44", opacity: 0.2, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }, []);

  const eclipticGrid = useMemo(() => new THREE.GridHelper(1, 20, "#334455", "#223344"), []);

  const axisLine = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -2.2, 0), new THREE.Vector3(0, 2.2, 0),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: "#88aaff", opacity: 0.5, transparent: true });
    const line = new THREE.Line(geo, mat);
    line.rotation.z = 23.44 * DEG2RAD;
    return line;
  }, []);

  const ascendingNode = useMemo(() => {
    const geo = new THREE.RingGeometry(0.2, 0.4, 16);
    const mat = new THREE.MeshBasicMaterial({ color: "#44ff88", side: THREE.DoubleSide, opacity: 0.6, transparent: true });
    return new THREE.Mesh(geo, mat);
  }, []);

  const descendingNode = useMemo(() => {
    const geo = new THREE.RingGeometry(0.2, 0.4, 16);
    const mat = new THREE.MeshBasicMaterial({ color: "#ff4488", side: THREE.DoubleSide, opacity: 0.6, transparent: true });
    return new THREE.Mesh(geo, mat);
  }, []);

  // ── Per-frame ──
  useFrame(({ camera }) => {
    const { snapshot, centerBody, scaleMode } = storeRef.current;
    const sc = getScale(centerBody, scaleMode);

    // Positions relative to center (km)
    const sunGeo = snapshot.sun.cartesian;
    const moonGeo = snapshot.moon.cartesian;

    let earthKm = { x: 0, y: 0, z: 0 };
    let moonKm = { x: 0, y: 0, z: 0 };
    let sunKm = { x: 0, y: 0, z: 0 };

    if (centerBody === "earth") {
      moonKm = moonGeo;
      sunKm = sunGeo;
    } else if (centerBody === "sun") {
      earthKm = { x: -sunGeo.x, y: -sunGeo.y, z: -sunGeo.z };
      moonKm = { x: -sunGeo.x + moonGeo.x, y: -sunGeo.y + moonGeo.y, z: -sunGeo.z + moonGeo.z };
    } else {
      earthKm = { x: -moonGeo.x, y: -moonGeo.y, z: -moonGeo.z };
      sunKm = { x: sunGeo.x - moonGeo.x, y: sunGeo.y - moonGeo.y, z: sunGeo.z - moonGeo.z };
    }

    // ── Position + scale bodies ──
    if (earthRef.current) {
      if (centerBody === "earth") {
        earthRef.current.position.set(0, 0, 0);
      } else if (centerBody === "sun") {
        earthRef.current.position.set(...eclipticToThree(earthKm, sc.primaryScale));
      } else {
        earthRef.current.position.set(...eclipticToThree(earthKm, sc.primaryScale));
      }
      earthRef.current.scale.setScalar(sc.earthRadius);
      earthRef.current.rotation.y = snapshot.gmst * DEG2RAD;
    }

    if (moonRef.current) {
      if (centerBody === "earth") {
        moonRef.current.position.set(...eclipticToThree(moonKm, sc.moonOffsetScale));
      } else if (centerBody === "sun") {
        const ep = eclipticToThree(earthKm, sc.primaryScale);
        const mo = eclipticToThree(moonGeo, sc.moonOffsetScale);
        moonRef.current.position.set(ep[0] + mo[0], ep[1] + mo[1], ep[2] + mo[2]);
      } else {
        moonRef.current.position.set(0, 0, 0);
      }
      moonRef.current.scale.setScalar(sc.moonRadius);
    }

    if (sunRef.current) {
      if (centerBody === "sun") {
        sunRef.current.position.set(0, 0, 0);
      } else {
        const sd = Math.sqrt(sunKm.x ** 2 + sunKm.y ** 2 + sunKm.z ** 2);
        const dir = { x: sunKm.x / sd, y: sunKm.y / sd, z: sunKm.z / sd };
        sunRef.current.position.set(...eclipticToThree(dir, sc.sunIndicatorDist));
      }
      sunRef.current.scale.setScalar(sc.sunRadius);
    }

    // ── Directional light ──
    if (sunLightRef.current && sunTargetRef.current) {
      let lightDir: { x: number; y: number; z: number };
      if (centerBody === "sun") {
        const ed = Math.sqrt(earthKm.x ** 2 + earthKm.y ** 2 + earthKm.z ** 2);
        lightDir = { x: -earthKm.x / ed, y: -earthKm.y / ed, z: -earthKm.z / ed };
        sunTargetRef.current.position.set(...eclipticToThree(earthKm, sc.primaryScale));
      } else {
        const sd = Math.sqrt(sunKm.x ** 2 + sunKm.y ** 2 + sunKm.z ** 2);
        lightDir = { x: sunKm.x / sd, y: sunKm.y / sd, z: sunKm.z / sd };
        sunTargetRef.current.position.set(0, 0, 0);
      }
      sunLightRef.current.position.set(...eclipticToThree(lightDir, 200));
      sunLightRef.current.target = sunTargetRef.current;
    }

    // ── Orbit rings ──
    const moonOrbitR = centerBody === "sun"
      ? 384400 * sc.moonOffsetScale
      : 384400 * sc.primaryScale;
    moonOrbitRing.scale.setScalar(moonOrbitR);

    if (moonOrbitGroupRef.current) {
      // Compute the Moon's orbital plane normal in Three.js coordinates.
      // The orbital plane is defined by inclination i and ascending node Ω.
      // In ecliptic coords, the orbital pole is:
      //   (sin(i)*sin(Ω), -sin(i)*cos(Ω), cos(i))
      // Mapped to Three.js (ecl x→x, ecl z→y, ecl y→z):
      const i = 5.145 * DEG2RAD;
      const Omega = snapshot.moon.position.ascendingNodeLongitude * DEG2RAD;
      const normalX = Math.sin(i) * Math.sin(Omega);
      const normalY = Math.cos(i);
      const normalZ = -Math.sin(i) * Math.cos(Omega);

      // The torus (after rotation.x = PI/2) has its face normal along +Y.
      // Rotate the group so +Y aligns with the orbital plane normal.
      const up = new THREE.Vector3(0, 1, 0);
      const target = new THREE.Vector3(normalX, normalY, normalZ).normalize();
      moonOrbitGroupRef.current.quaternion.setFromUnitVectors(up, target);

      if (centerBody === "sun" && earthRef.current) {
        moonOrbitGroupRef.current.position.copy(earthRef.current.position);
      } else if (centerBody === "moon" && earthRef.current) {
        moonOrbitGroupRef.current.position.copy(earthRef.current.position);
      } else {
        moonOrbitGroupRef.current.position.set(0, 0, 0);
      }
    }

    const earthOrbitR = centerBody === "sun"
      ? AU_KM * sc.primaryScale
      : AU_KM * sc.primaryScale;
    earthOrbitRing.scale.setScalar(earthOrbitR);

    // ── Node markers ──
    const nodeAngle = snapshot.moon.position.ascendingNodeLongitude * DEG2RAD;
    ascendingNode.position.set(Math.cos(nodeAngle) * moonOrbitR, 0, Math.sin(nodeAngle) * moonOrbitR);
    ascendingNode.rotation.x = -Math.PI / 2;
    descendingNode.position.set(-Math.cos(nodeAngle) * moonOrbitR, 0, -Math.sin(nodeAngle) * moonOrbitR);
    descendingNode.rotation.x = -Math.PI / 2;

    // ── Ecliptic grid: scale to always fill the view ──
    eclipticGrid.scale.setScalar(camera.position.length() * 3);
  });

  const { showOrbits, showAxialTilt, showEclipticPlane, showLunarNodes } = useLunarStore();

  return (
    <>
      <CameraControls />

      <ambientLight intensity={0.02} />
      <directionalLight ref={sunLightRef} intensity={4.0} color="#fff5e0" position={[100, 10, 0]} />
      <object3D ref={sunTargetRef} />

      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial ref={earthMatRef} color="#4488cc" roughness={0.8} metalness={0.1} />
      </mesh>

      <mesh ref={moonRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial ref={moonMatRef} color="#ccccbb" roughness={0.95} metalness={0.0} />
      </mesh>

      <mesh ref={sunRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#ffee88" />
      </mesh>

      {showOrbits && (
        <group ref={moonOrbitGroupRef}>
          <primitive object={moonOrbitRing} />
        </group>
      )}
      {showOrbits && <primitive object={earthOrbitRing} />}

      {showAxialTilt && <primitive object={axisLine} />}
      {showEclipticPlane && <primitive object={eclipticGrid} />}
      {showLunarNodes && (
        <>
          <primitive object={ascendingNode} />
          <primitive object={descendingNode} />
        </>
      )}

      <AxesIndicator />
    </>
  );
}
