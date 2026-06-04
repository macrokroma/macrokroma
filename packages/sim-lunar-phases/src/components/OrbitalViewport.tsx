/**
 * OrbitalViewport — 3D viewport with display controls toolbar.
 */

import { WebGPUCanvas } from "@macrokroma/shared";
import { OrbitalSceneContent } from "./OrbitalScene3D";
import { useLunarStore, type CenterBody } from "../store/lunarStore";

function ViewportToolbar() {
  const {
    scaleMode, setScaleMode,
    centerBody, setCenterBody,
    showOrbits, toggleOrbits,
    showAxialTilt, toggleAxialTilt,
    showEclipticPlane, toggleEclipticPlane,
    showLunarNodes, toggleLunarNodes,
  } = useLunarStore();

  const Toggle = ({
    label, active, onClick,
  }: {
    label: string; active: boolean; onClick: () => void;
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

  const CenterBtn = ({ body, label }: { body: CenterBody; label: string }) => (
    <button
      onClick={() => setCenterBody(body)}
      className={`px-2 py-0.5 rounded transition-colors ${
        centerBody === body
          ? "bg-blue-500/40 text-white"
          : "text-white/40 hover:text-white/70 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/80 backdrop-blur-sm text-xs font-medium flex-wrap">
      {/* Center body selector */}
      <span className="text-white/30 mr-0.5">Center:</span>
      <CenterBtn body="sun" label="Sun" />
      <CenterBtn body="earth" label="Earth" />
      <CenterBtn body="moon" label="Moon" />

      <span className="w-px h-3.5 bg-white/20 mx-0.5" />

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

      <div className="flex-1" />
      <span className="text-white/25 text-[10px] hidden sm:inline">
        drag to orbit · scroll to zoom
      </span>
    </div>
  );
}

export function OrbitalViewport({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col rounded-lg overflow-hidden bg-black ${className}`}>
      <ViewportToolbar />
      <div className="flex-1 min-h-0">
        <WebGPUCanvas
          camera={{ position: [0, 35, 35], fov: 45, near: 0.1, far: 1000 }}
          style={{ width: "100%", height: "100%" }}
        >
          <OrbitalSceneContent />
        </WebGPUCanvas>
      </div>
    </div>
  );
}
