import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { WebGPUCanvas } from "@macrokroma/shared";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

/** A slowly rotating icosahedron — proof that R3F + WebGPU is working. */
function SpinningShape() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.3;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.2, 1]} />
      <meshStandardMaterial
        color="#6366f1"
        wireframe
        emissive="#6366f1"
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

export function Landing() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-8 px-6">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          macrokroma
        </h1>
        <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed">
          Interactive physics simulations. Explore quantum mechanics and
          electromagnetic phenomena through 3D visualization.
        </p>
      </div>

      {/* WebGPU proof-of-life */}
      <div className="r3f-canvas-container w-full max-w-xl aspect-square rounded-lg overflow-hidden border border-[var(--color-border)]">
        <Suspense
          fallback={
            <div className="flex items-center justify-center w-full h-full text-[var(--color-text-secondary)]">
              Initializing renderer…
            </div>
          }
        >
          <WebGPUCanvas camera={{ position: [0, 0, 4] }}>
            <ambientLight intensity={0.4} />
            <pointLight position={[5, 5, 5]} intensity={1} />
            <SpinningShape />
            <OrbitControls enablePan={false} />
          </WebGPUCanvas>
        </Suspense>
      </div>
    </div>
  );
}
