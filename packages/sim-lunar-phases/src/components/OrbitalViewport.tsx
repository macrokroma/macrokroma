/**
 * OrbitalViewport — self-contained 3D viewport with display controls.
 *
 * Wraps OrbitalSceneContent in a WebGPUCanvas with a toolbar for
 * scale mode, orbit visibility, labels, etc. This component can be
 * embedded in any section that needs the 3D view.
 */

import { Suspense } from "react";
import { WebGPUCanvas } from "@macrokroma/shared";
import { OrbitalSceneContent } from "./OrbitalScene3D";
import { useLunarStore } from "../store/lunarStore";

function ViewportToolbar() {
  const {
    scaleMode, setScaleMode,
    showOrbits, toggleOrbits,
    showLabels, toggleLabels,
    showAxialTilt, toggleAxialTilt,
    showEclipticPlane, toggleEclipticPlane,
    showLunarNodes, toggleLunarNodes,
  } = useLunarStore();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-t-lg text-xs text-white/80">
      {/* Scale toggle */}
      <button
        onClick={() => setScaleMode(scaleMode === "exaggerated" ? "realistic" : "exaggerated")}
        className={`px-2 py-0.5 rounded ${
          scaleMode === "exaggerated"
            ? "bg-white/20 text-white"
            : "hover:bg-white/10"
        }`}
      >
        {scaleMode === "exaggerated" ? "Not to Scale" : "To Scale"}
      </button>

      <span className="w-px h-3 bg-white/20" />

      {/* Toggles */}
      <button
        onClick={toggleOrbits}
        className={`px-2 py-0.5 rounded ${showOrbits ? "bg-white/20 text-white" : "hover:bg-white/10 text-white/50"}`}
      >
        Orbits
      </button>
      <button
        onClick={toggleAxialTilt}
        className={`px-2 py-0.5 rounded ${showAxialTilt ? "bg-white/20 text-white" : "hover:bg-white/10 text-white/50"}`}
      >
        Axis
      </button>
      <button
        onClick={toggleEclipticPlane}
        className={`px-2 py-0.5 rounded ${showEclipticPlane ? "bg-white/20 text-white" : "hover:bg-white/10 text-white/50"}`}
      >
        Ecliptic
      </button>
      <button
        onClick={toggleLunarNodes}
        className={`px-2 py-0.5 rounded ${showLunarNodes ? "bg-white/20 text-white" : "hover:bg-white/10 text-white/50"}`}
      >
        Nodes
      </button>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black text-white/40 text-sm">
      Loading 3D scene...
    </div>
  );
}

export function OrbitalViewport({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <ViewportToolbar />
      <div className="relative flex-1 min-h-[400px] bg-black rounded-b-lg overflow-hidden">
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
    </div>
  );
}
