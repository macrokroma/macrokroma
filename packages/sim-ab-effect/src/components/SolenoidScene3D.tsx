import { useRef, useMemo } from "react";
import { WebGPUCanvas } from "@macrokroma/shared";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface SolenoidScene3DProps {
  flux: number;
  showA: boolean;
  showB: boolean;
  showCoils: boolean;
}

const SOLENOID_RADIUS = 0.6;
const SOLENOID_HEIGHT = 3;

function generateAFieldArrows(flux: number, R: number) {
  const arrows: { pos: [number, number, number]; dir: [number, number, number]; mag: number }[] = [];
  const rings = 6;
  const perRing = [12, 16, 20, 24, 28, 32];

  for (let ring = 0; ring < rings; ring++) {
    const r = R * 1.2 + ring * 0.35;
    const count = perRing[ring]!;
    const aMag = flux / (2 * Math.PI * r);

    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const dx = -Math.sin(theta);
      const dz = Math.cos(theta);

      arrows.push({
        pos: [x, 0, z],
        dir: [dx, 0, dz],
        mag: aMag,
      });
    }
  }
  return arrows;
}

function AFieldArrows({ flux, R }: { flux: number; R: number }) {
  const arrows = useMemo(() => generateAFieldArrows(flux, R), [flux, R]);

  return (
    <group>
      {arrows.map((arrow, i) => {
        const len = Math.min(arrow.mag * 0.8, 0.3);
        if (len < 0.01) return null;

        const dir = new THREE.Vector3(...arrow.dir);
        const pos = new THREE.Vector3(...arrow.pos);
        const midpoint = pos.clone().add(dir.clone().multiplyScalar(len * 0.5));
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.clone().normalize(),
        );

        return (
          <group key={i}>
            <mesh position={midpoint} quaternion={quat}>
              <cylinderGeometry args={[0.008, 0.008, len, 4]} />
              <meshBasicMaterial color="#818cf8" transparent opacity={0.6} />
            </mesh>
            <mesh
              position={pos.clone().add(dir.clone().multiplyScalar(len))}
              quaternion={quat}
            >
              <coneGeometry args={[0.025, 0.06, 6]} />
              <meshBasicMaterial color="#818cf8" transparent opacity={0.7} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function BFieldArrows({ flux, R }: { flux: number; R: number }) {
  const dots: [number, number, number][] = useMemo(() => {
    const result: [number, number, number][] = [];
    const grid = 5;
    const yLevels = 7;
    for (let yi = 0; yi < yLevels; yi++) {
      const y = -SOLENOID_HEIGHT * 0.4 + (yi / (yLevels - 1)) * SOLENOID_HEIGHT * 0.8;
      for (let xi = -grid; xi <= grid; xi++) {
        for (let zi = -grid; zi <= grid; zi++) {
          const x = (xi / grid) * R * 0.75;
          const z = (zi / grid) * R * 0.75;
          const r = Math.sqrt(x * x + z * z);
          if (r < R * 0.8) {
            result.push([x, y, z]);
          }
        }
      }
    }
    return result;
  }, [R]);

  if (flux < 0.1) return null;

  const arrowLen = Math.min(flux * 0.03, 0.15);

  return (
    <group>
      {dots.map((pos, i) => (
        <group key={i}>
          <mesh position={[pos[0], pos[1], pos[2]]}>
            <cylinderGeometry args={[0.008, 0.008, arrowLen, 4]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.5} />
          </mesh>
          <mesh position={[pos[0], pos[1] + arrowLen * 0.5 + 0.02, pos[2]]}>
            <coneGeometry args={[0.02, 0.04, 6]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CoilWindings({ R }: { R: number }) {
  const coilCount = 20;
  const arrowsPerCoil = 8;

  return (
    <group>
      {Array.from({ length: coilCount }).map((_, i) => {
        const y = -SOLENOID_HEIGHT / 2 + (i / (coilCount - 1)) * SOLENOID_HEIGHT;
        return (
          <group key={i}>
            {/* Coil ring */}
            <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[R, 0.012, 8, 48]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.35} />
            </mesh>

            {/* Current direction arrows on each ring */}
            {Array.from({ length: arrowsPerCoil }).map((_, j) => {
              const theta = (j / arrowsPerCoil) * Math.PI * 2;
              const x = R * Math.cos(theta);
              const z = R * Math.sin(theta);

              // Current direction: counterclockwise when viewed from above (+y)
              // At angle theta, CCW tangent is (sin(theta), 0, -cos(theta))
              const dx = Math.sin(theta);
              const dz = -Math.cos(theta);
              const dir = new THREE.Vector3(dx, 0, dz).normalize();
              const quat = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                dir,
              );

              return (
                <mesh
                  key={j}
                  position={[x, y, z]}
                  quaternion={quat}
                >
                  <coneGeometry args={[0.025, 0.06, 6]} />
                  <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function RotatingGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.1;
    }
  });
  return <group ref={ref}>{children}</group>;
}

export default function SolenoidScene3D({
  flux,
  showA,
  showB,
  showCoils,
}: SolenoidScene3DProps) {
  return (
    <WebGPUCanvas
      camera={{ position: [3, 2, 3], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />

      <RotatingGroup>
        {/* Solenoid cylinder (wireframe) */}
        <mesh>
          <cylinderGeometry args={[SOLENOID_RADIUS, SOLENOID_RADIUS, SOLENOID_HEIGHT, 32, 1, true]} />
          <meshBasicMaterial
            color="#e8e8ef"
            wireframe
            transparent
            opacity={0.15}
          />
        </mesh>

        {/* Coil windings with current arrows */}
        {showCoils && <CoilWindings R={SOLENOID_RADIUS} />}

        {/* A field arrows */}
        {showA && <AFieldArrows flux={flux} R={SOLENOID_RADIUS} />}

        {/* B field arrows inside */}
        {showB && <BFieldArrows flux={flux} R={SOLENOID_RADIUS} />}
      </RotatingGroup>

      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        minDistance={2}
        maxDistance={8}
      />

      <gridHelper args={[6, 12, "#2a2a3a", "#1a1a26"]} position={[0, -2, 0]} />
    </WebGPUCanvas>
  );
}