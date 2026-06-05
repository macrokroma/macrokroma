/**
 * OrbitalScene3D — 3D viewport for the Sun-Earth-Moon system.
 *
 * GROUND-UP REWRITE — All orbit dots now use the exact same position
 * computation as the body meshes, parameterized by center body and
 * scale mode. This guarantees bodies always sit on their orbit paths.
 *
 * Architecture:
 *   positionBody()    — one function positions any body for any center/scale
 *   computeOrbitDots  — calls positionBody() at many time steps
 *   useFrame          — calls positionBody() at current time
 *   Both paths go through the same code, so they can never disagree.
 */

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";
import { useLunarStore, type CenterBody, type ScaleMode } from "../store/lunarStore";
import { DEG2RAD, AU_KM } from "../compute/constants";
import { computeSnapshot, type CelestialSnapshot } from "../compute/ephemeris/meeus";

// ─── Scale configs ──────────────────────────────────────────────

interface ScaleConfig {
  earthRadius: number;
  moonRadius: number;
  sunRadius: number;
  primaryScale: number;       // km → units for Earth-Sun distances
  moonOffsetScale: number;    // km → units for Moon-Earth offset
  sunIndicatorDist: number;   // fixed distance for Sun when too far (0 = at center)
}

const SUN_ANGULAR_RADIUS = 0.00463;

function getScale(center: CenterBody, mode: ScaleMode): ScaleConfig {
  if (mode === "realistic") {
    const K = 1 / 6371;
    const SD = 500;
    switch (center) {
      case "earth": return { earthRadius: 1, moonRadius: 1737*K, sunRadius: SD*SUN_ANGULAR_RADIUS, primaryScale: K, moonOffsetScale: K, sunIndicatorDist: SD };
      case "sun":   return { earthRadius: 1, moonRadius: 1737*K, sunRadius: 109, primaryScale: K*0.003, moonOffsetScale: K*0.5, sunIndicatorDist: 0 };
      case "moon":  return { earthRadius: 1, moonRadius: 1737*K, sunRadius: SD*SUN_ANGULAR_RADIUS, primaryScale: K, moonOffsetScale: K, sunIndicatorDist: SD };
    }
  }
  switch (center) {
    case "earth": return { earthRadius: 1, moonRadius: 0.273, sunRadius: 3, primaryScale: 20/384400, moonOffsetScale: 20/384400, sunIndicatorDist: 80 };
    case "sun":   return { earthRadius: 0.6, moonRadius: 0.18, sunRadius: 4, primaryScale: 40/AU_KM, moonOffsetScale: 3/384400, sunIndicatorDist: 0 };
    case "moon":  return { earthRadius: 1, moonRadius: 0.273, sunRadius: 3, primaryScale: 20/384400, moonOffsetScale: 20/384400, sunIndicatorDist: 80 };
  }
}

// ─── Unified position computation ───────────────────────────────
// One function that computes [earthPos, moonPos, sunPos] in Three.js
// scene units for ANY snapshot, center body, and scale config.
// Both the per-frame body positioning AND the orbit dot computation
// call this, so they can never disagree.

function eclToThree(ex: number, ey: number, ez: number, s: number): [number, number, number] {
  return [ex * s, ez * s, ey * s]; // ecliptic x→x, z→y(up), y→z
}

interface ScenePositions {
  earth: [number, number, number];
  moon: [number, number, number];
  sun: [number, number, number];
  /** Unit direction from scene center toward the Sun (ecliptic coords) */
  sunDir: { x: number; y: number; z: number };
}

function computePositions(snap: CelestialSnapshot, center: CenterBody, sc: ScaleConfig): ScenePositions {
  const sg = snap.sun.cartesian;
  const mg = snap.moon.cartesian;

  // Sun direction (ecliptic, for lighting)
  const sd = Math.sqrt(sg.x**2 + sg.y**2 + sg.z**2);
  const sunDirEcl = { x: sg.x/sd, y: sg.y/sd, z: sg.z/sd };

  if (center === "earth") {
    return {
      earth: [0, 0, 0],
      moon: eclToThree(mg.x, mg.y, mg.z, sc.moonOffsetScale),
      sun: eclToThree(sunDirEcl.x, sunDirEcl.y, sunDirEcl.z, sc.sunIndicatorDist),
      sunDir: sunDirEcl,
    };
  }

  if (center === "sun") {
    const ep = eclToThree(-sg.x, -sg.y, -sg.z, sc.primaryScale);
    const mo = eclToThree(mg.x, mg.y, mg.z, sc.moonOffsetScale);
    return {
      earth: ep,
      moon: [ep[0]+mo[0], ep[1]+mo[1], ep[2]+mo[2]],
      sun: [0, 0, 0],
      sunDir: sunDirEcl,
    };
  }

  // moon-centered
  const ep = eclToThree(-mg.x, -mg.y, -mg.z, sc.primaryScale);
  const sunRel = { x: sg.x - mg.x, y: sg.y - mg.y, z: sg.z - mg.z };
  const srd = Math.sqrt(sunRel.x**2 + sunRel.y**2 + sunRel.z**2);
  const sunDirFromMoon = { x: sunRel.x/srd, y: sunRel.y/srd, z: sunRel.z/srd };
  return {
    earth: ep,
    moon: [0, 0, 0],
    sun: eclToThree(sunDirFromMoon.x, sunDirFromMoon.y, sunDirFromMoon.z, sc.sunIndicatorDist),
    sunDir: sunDirFromMoon,
  };
}

// ─── Orbit dot computation ──────────────────────────────────────

const MOON_DOTS = 80;
const SUN_DOTS = 120;
const SIDEREAL_MONTH = 27.321661;
const SIDEREAL_YEAR = 365.256363;

interface OrbitData {
  moonDots: [number, number, number][];
  sunDots: [number, number, number][];
  nodes: { ascending: THREE.Vector3; descending: THREE.Vector3 };
}

function computeOrbitData(jd: number, center: CenterBody, sc: ScaleConfig): OrbitData {
  const moonDots: [number, number, number][] = [];
  const sunDots: [number, number, number][] = [];

  // Moon orbit: one sidereal month centered on jd
  for (let i = 0; i < MOON_DOTS; i++) {
    const t = jd - SIDEREAL_MONTH/2 + (i / MOON_DOTS) * SIDEREAL_MONTH;
    const snap = computeSnapshot(t);
    const pos = computePositions(snap, center, sc);
    // For earth-centered: show Moon orbit. For moon-centered: show Earth orbit.
    // For sun-centered: show Moon orbit (heliocentric).
    moonDots.push(center === "moon" ? pos.earth : pos.moon);
  }

  // Sun/Earth orbit: one sidereal year centered on jd
  for (let i = 0; i < SUN_DOTS; i++) {
    const t = jd - SIDEREAL_YEAR/2 + (i / SUN_DOTS) * SIDEREAL_YEAR;
    const snap = computeSnapshot(t);
    const pos = computePositions(snap, center, sc);
    // For sun-centered: show Earth orbit. For earth/moon-centered: show Sun path.
    sunDots.push(center === "sun" ? pos.earth : pos.sun);
  }

  // Find nodes from the "inner orbit" dots (moon or earth orbit)
  const orbitVecs = moonDots.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const nodes = findNodes(orbitVecs);

  return { moonDots, sunDots, nodes };
}

function findNodes(pts: THREE.Vector3[]): { ascending: THREE.Vector3; descending: THREE.Vector3 } {
  let asc = new THREE.Vector3();
  let desc = new THREE.Vector3();
  let minA = Infinity, minD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const c = pts[i]!, n = pts[(i+1) % pts.length]!;
    if (c.y <= 0 && n.y > 0) {
      const f = Math.abs(c.y) / (Math.abs(c.y) + Math.abs(n.y));
      if (Math.abs(c.y) < minA) { minA = Math.abs(c.y); asc = new THREE.Vector3().lerpVectors(c, n, f); }
    }
    if (c.y >= 0 && n.y < 0) {
      const f = Math.abs(c.y) / (Math.abs(c.y) + Math.abs(n.y));
      if (Math.abs(c.y) < minD) { minD = Math.abs(c.y); desc = new THREE.Vector3().lerpVectors(c, n, f); }
    }
  }
  return { ascending: asc, descending: desc };
}

// ─── Texture loader ─────────────────────────────────────────────

function useTextures() {
  const [tex, setTex] = useState<{ earthDay: THREE.Texture; earthBump: THREE.Texture; moon: THREE.Texture } | null>(null);
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let dead = false;
    Promise.all([
      loader.loadAsync("/textures/earth_day.jpg"),
      loader.loadAsync("/textures/earth_bump.jpg"),
      loader.loadAsync("/textures/moon.jpg"),
    ]).then(([a, b, c]) => {
      if (dead) return;
      a.colorSpace = THREE.SRGBColorSpace;
      c.colorSpace = THREE.SRGBColorSpace;
      setTex({ earthDay: a, earthBump: b, moon: c });
    });
    return () => { dead = true; };
  }, []);
  return tex;
}

// ─── Camera controls ────────────────────────────────────────────

function CameraControls() {
  const { camera, gl } = useThree();
  const ref = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true; c.dampingFactor = 0.1;
    c.minDistance = 0.5; c.maxDistance = 50000;
    ref.current = c;
    return () => c.dispose();
  }, [camera, gl]);
  useFrame(() => { ref.current?.update(); });
  return null;
}

// ─── Axes indicator ─────────────────────────────────────────────

function AxesIndicator() {
  const g = useRef<THREE.Group>(null);
  const helper = useMemo(() => {
    const h = new THREE.AxesHelper(1);
    h.renderOrder = 999;
    (Array.isArray(h.material) ? h.material : [h.material]).forEach(m => { m.depthTest = false; });
    return h;
  }, []);
  const v1 = useMemo(() => new THREE.Vector3(), []);
  const v2 = useMemo(() => new THREE.Vector3(), []);
  const v3 = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (!g.current) return;
    v1.set(0.82, -0.75, 0.98).unproject(camera);
    v2.copy(camera.position);
    v3.copy(v1).sub(v2).normalize();
    g.current.position.copy(v2).addScaledVector(v3, 25);
    g.current.scale.setScalar(g.current.position.distanceTo(v2) * 0.045);
    g.current.quaternion.identity();
  });
  return <group ref={g}><primitive object={helper} /></group>;
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
  const moonDotsRef = useRef<THREE.InstancedMesh>(null);
  const sunDotsRef = useRef<THREE.InstancedMesh>(null);

  // Orbit recompute tracking
  const lastJD = useRef(0);
  const lastCenter = useRef<CenterBody>("earth");
  const lastScale = useRef<ScaleMode>("exaggerated");
  const pending = useRef(false);
  const nodePos = useRef({ ascending: new THREE.Vector3(), descending: new THREE.Vector3() });

  const dotGeo = useMemo(() => new THREE.SphereGeometry(1, 6, 6), []);
  const moonDotMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#6688cc", opacity: 0.5, transparent: true }), []);
  const sunDotMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#aaaa44", opacity: 0.3, transparent: true }), []);

  const _mat = useMemo(() => new THREE.Matrix4(), []);
  const _sv = useMemo(() => new THREE.Vector3(), []);

  // Textures
  const tex = useTextures();
  useEffect(() => {
    if (!tex) return;
    if (earthMatRef.current) {
      earthMatRef.current.map = tex.earthDay;
      earthMatRef.current.bumpMap = tex.earthBump;
      earthMatRef.current.bumpScale = 0.05;
      earthMatRef.current.needsUpdate = true;
    }
    if (moonMatRef.current) {
      moonMatRef.current.map = tex.moon;
      moonMatRef.current.needsUpdate = true;
    }
  }, [tex]);

  // Store (ref for useFrame)
  const store = useRef(useLunarStore.getState());
  useEffect(() => useLunarStore.subscribe(s => { store.current = s; }), []);

  // Overlays (always mounted, visibility in useFrame)
  const eclipticGrid = useMemo(() => new THREE.GridHelper(1, 20, "#334455", "#223344"), []);
  const axisLine = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-2.2,0), new THREE.Vector3(0,2.2,0)]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#88aaff", opacity: 0.5, transparent: true }));
    l.rotation.z = 23.44 * DEG2RAD;
    return l;
  }, []);
  const ascNode = useMemo(() => {
    return new THREE.Mesh(new THREE.RingGeometry(0.2,0.4,16), new THREE.MeshBasicMaterial({ color: "#44ff88", side: THREE.DoubleSide, opacity: 0.6, transparent: true }));
  }, []);
  const descNode = useMemo(() => {
    return new THREE.Mesh(new THREE.RingGeometry(0.2,0.4,16), new THREE.MeshBasicMaterial({ color: "#ff4488", side: THREE.DoubleSide, opacity: 0.6, transparent: true }));
  }, []);

  // ── Deferred orbit recomputation ──
  const recompute = useCallback((jd: number, center: CenterBody, scale: ScaleMode) => {
    if (pending.current) return;
    pending.current = true;
    const sc = getScale(center, scale);

    setTimeout(() => {
      const data = computeOrbitData(jd, center, sc);

      if (moonDotsRef.current) {
        for (let i = 0; i < MOON_DOTS; i++) {
          const [x, y, z] = data.moonDots[i]!;
          const ds = center === "sun" ? 0.04 : 0.06;
          _mat.makeTranslation(x, y, z);
          _sv.setScalar(ds); _mat.scale(_sv);
          moonDotsRef.current.setMatrixAt(i, _mat);
        }
        moonDotsRef.current.instanceMatrix.needsUpdate = true;
      }

      if (sunDotsRef.current) {
        for (let i = 0; i < SUN_DOTS; i++) {
          const [x, y, z] = data.sunDots[i]!;
          const ds = center === "sun" ? 0.08 : 0.1;
          _mat.makeTranslation(x, y, z);
          _sv.setScalar(ds); _mat.scale(_sv);
          sunDotsRef.current.setMatrixAt(i, _mat);
        }
        sunDotsRef.current.instanceMatrix.needsUpdate = true;
      }

      nodePos.current = data.nodes;
      pending.current = false;
      lastJD.current = jd;
      lastCenter.current = center;
      lastScale.current = scale;
    }, 0);
  }, [_mat, _sv]);

  // ── Per-frame ──
  useFrame(({ camera }) => {
    const { snapshot, centerBody, scaleMode, showOrbits, showAxialTilt, showEclipticPlane, showLunarNodes } = store.current;
    const sc = getScale(centerBody, scaleMode);
    const jd = snapshot.jd;

    // Recompute orbits on time drift or settings change
    if (Math.abs(jd - lastJD.current) > 5 || lastJD.current === 0 ||
        centerBody !== lastCenter.current || scaleMode !== lastScale.current) {
      recompute(jd, centerBody, scaleMode);
    }

    // Visibility
    if (moonDotsRef.current) moonDotsRef.current.visible = showOrbits;
    if (sunDotsRef.current) sunDotsRef.current.visible = showOrbits;
    axisLine.visible = showAxialTilt;
    eclipticGrid.visible = showEclipticPlane;
    ascNode.visible = showLunarNodes;
    descNode.visible = showLunarNodes;

    // ── Body positions (same function as orbit dots!) ──
    const pos = computePositions(snapshot, centerBody, sc);

    if (earthRef.current) {
      earthRef.current.position.set(...pos.earth);
      earthRef.current.scale.setScalar(sc.earthRadius);
      earthRef.current.rotation.y = snapshot.gmst * DEG2RAD;
    }
    if (moonRef.current) {
      moonRef.current.position.set(...pos.moon);
      moonRef.current.scale.setScalar(sc.moonRadius);
    }
    if (sunRef.current) {
      sunRef.current.position.set(...pos.sun);
      sunRef.current.scale.setScalar(sc.sunRadius);
    }

    // ── Directional light ──
    if (sunLightRef.current && sunTargetRef.current) {
      const ld = eclToThree(pos.sunDir.x, pos.sunDir.y, pos.sunDir.z, 200);
      sunLightRef.current.position.set(...ld);
      if (centerBody === "sun") {
        sunTargetRef.current.position.set(...pos.earth);
      } else {
        sunTargetRef.current.position.set(
          centerBody === "earth" ? 0 : pos.moon[0],
          centerBody === "earth" ? 0 : pos.moon[1],
          centerBody === "earth" ? 0 : pos.moon[2],
        );
      }
      sunLightRef.current.target = sunTargetRef.current;
    }

    // Nodes
    ascNode.position.copy(nodePos.current.ascending);
    ascNode.rotation.x = -Math.PI / 2;
    descNode.position.copy(nodePos.current.descending);
    descNode.rotation.x = -Math.PI / 2;

    // Ecliptic grid
    eclipticGrid.scale.setScalar(camera.position.length() * 3);
  });

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

      <instancedMesh ref={moonDotsRef} args={[dotGeo, moonDotMat, MOON_DOTS]} />
      <instancedMesh ref={sunDotsRef} args={[dotGeo, sunDotMat, SUN_DOTS]} />
      <primitive object={axisLine} />
      <primitive object={eclipticGrid} />
      <primitive object={ascNode} />
      <primitive object={descNode} />
      <AxesIndicator />
    </>
  );
}
