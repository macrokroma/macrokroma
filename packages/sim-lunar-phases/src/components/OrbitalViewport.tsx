/**
 * OrbitalViewport — self-contained 3D viewport with display controls.
 *
 * Wraps OrbitalSceneContent in a WebGPUCanvas with a toolbar for
 * toggling overlays and display options.
 */

import { Suspense } from "react";
import { WebGPUCanvas } from "@macrokroma/shared";
import { OrbitalSceneContent } from "./OrbitalScene3D";
import { useLunarStore } from "../store/lunarStore";

function ViewportToolbar() {
  const {
    scaleMode, setScaleMode,
    showOrbits, toggleOrbits,
    showAxialTilt, toggleAxialTilt,
    showEclipticPlane, toggleEclipticPlane,
    showLunarNodes, toggleLunarNodes,
  } = useLunarStore();

  const Toggle = ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded transition-colors ${
        active
          ? "bg-white/20 text-white"
          : "text-white/40 hover:text-white/70 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/80 backdrop-blur-sm text-xs font-medium z-10">
      {/* Scale mode */}
      <button
        onClick={() =>
          setScaleMode(scaleMode === "exaggerated" ? "realistic" : "exaggerated")
        }
        className="px-2 py-0.5 rounded bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        {scaleMode === "exaggerated" ? "Not to Scale" : "To Scale"}
      </button>

      <span className="w-px h-3.5 bg-white/20 mx-0.5" />

      {/* Overlay toggles */}
      <Toggle label="Orbits" active={showOrbits} onClick={toggleOrbits} />
      <Toggle label="Axis" active={showAxialTilt} onClick={toggleAxialTilt} />
      <Toggle label="Ecliptic" active={showEclipticPlane} onClick={toggleEclipticPlane} />
      <Toggle label="Nodes" active={showLunarNodes} onClick={toggleLunarNodes} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Hint */}
      <span className="text-white/25 text-[10px] hidden sm:inline">
        drag to orbit · scroll to zoom
      </span>
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
    <div className={`flex flex-col rounded-lg overflow-hidden bg-black ${className}`}>
      <ViewportToolbar />
      <div className="relative flex-1 min-h-0">
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
