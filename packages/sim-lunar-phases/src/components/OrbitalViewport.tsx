/**
 * OrbitalViewport — self-contained 3D viewport with display controls.
 *
 * Wraps OrbitalSceneContent in a WebGPUCanvas with a toolbar for
 * scale mode, orbit visibility, labels, etc.
 */

import { Suspense } from "react";
import { WebGPUCanvas } from "@macrokroma/shared";
import { OrbitalSceneContent } from "./OrbitalScene3D";

function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black text-white/40 text-sm">
      Loading 3D scene...
    </div>
  );
}

export function OrbitalViewport({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-lg overflow-hidden bg-black ${className}`}>
      <Suspense fallback={<LoadingFallback />}>
        <WebGPUCanvas
          camera={{
            position: [0, 35, 35],
            fov: 45,
            near: 0.1,
            far: 1000,
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <OrbitalSceneContent />
        </WebGPUCanvas>
      </Suspense>
    </div>
  );
}
