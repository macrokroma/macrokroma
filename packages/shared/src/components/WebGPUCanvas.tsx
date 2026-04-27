/**
 * WebGPUCanvas — R3F Canvas pre-configured with WebGPURenderer.
 *
 * Uses the official R3F pattern from the docs: the `gl` prop callback
 * receives a props object (not a raw canvas), and we pass it straight
 * through to WebGPURenderer. Three.js handles WebGL 2 fallback
 * automatically if the browser doesn't support WebGPU.
 *
 * Usage:
 *   <WebGPUCanvas>
 *     <mesh>
 *       <boxGeometry />
 *       <meshStandardMaterial />
 *     </mesh>
 *   </WebGPUCanvas>
 */

import { Canvas, extend, type CanvasProps } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { type ReactNode } from "react";

// Register all Three.js WebGPU exports with R3F's JSX element system.
// This lets R3F create WebGPU-compatible objects (node materials, etc.)
extend(THREE as any);

export interface WebGPUCanvasProps extends Omit<CanvasProps, "gl"> {
  children: ReactNode;
}

export function WebGPUCanvas({
  children,
  ...canvasProps
}: WebGPUCanvasProps) {
  return (
    <Canvas
      gl={async (props) => {
        const renderer = new THREE.WebGPURenderer(props as any);
        await renderer.init();
        return renderer;
      }}
      {...canvasProps}
    >
      {children}
    </Canvas>
  );
}