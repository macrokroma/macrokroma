/**
 * OrbitalViewport — 3D viewport with overlay toolbar.
 * Toolbar is absolutely positioned OVER the canvas with z-index
 * to guarantee click events are never blocked by the WebGPU canvas.
 */

import { WebGPUCanvas } from "@macrokroma/shared";
import { OrbitalSceneContent } from "./OrbitalScene3D";
import { useLunarStore, type CenterBody } from "../store/lunarStore";

function ViewportToolbar() {
  const scaleMode = useLunarStore((s) => s.scaleMode);
  const setScaleMode = useLunarStore((s) => s.setScaleMode);
  const centerBody = useLunarStore((s) => s.centerBody);
  const setCenterBody = useLunarStore((s) => s.setCenterBody);
  const showOrbits = useLunarStore((s) => s.showOrbits);
  const toggleOrbits = useLunarStore((s) => s.toggleOrbits);
  const showAxialTilt = useLunarStore((s) => s.showAxialTilt);
  const toggleAxialTilt = useLunarStore((s) => s.toggleAxialTilt);
  const showEclipticPlane = useLunarStore((s) => s.showEclipticPlane);
  const toggleEclipticPlane = useLunarStore((s) => s.toggleEclipticPlane);
  const showLunarNodes = useLunarStore((s) => s.showLunarNodes);
  const toggleLunarNodes = useLunarStore((s) => s.toggleLunarNodes);

  const Toggle = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
      className={`px-2 py-0.5 rounded transition-colors select-none ${
        active ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  const CenterBtn = ({ body, label }: { body: CenterBody; label: string }) => (
    <button
      onPointerDown={(e) => { e.stopPropagation(); setCenterBody(body); }}
      className={`px-2 py-0.5 rounded transition-colors select-none ${
        centerBody === body ? "bg-blue-500/40 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="absolute top-0 left-0 right-0 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-black/80 text-xs font-medium flex-wrap"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="text-white/30 mr-0.5">Center:</span>
      <CenterBtn body="sun" label="Sun" />
      <CenterBtn body="earth" label="Earth" />
      <CenterBtn body="moon" label="Moon" />

      <span className="w-px h-3.5 bg-white/20 mx-0.5" />

      <button
        onPointerDown={(e) => {
          e.stopPropagation();
          setScaleMode(scaleMode === "exaggerated" ? "realistic" : "exaggerated");
        }}
        className="px-2 py-0.5 rounded bg-white/10 text-white hover:bg-white/20 transition-colors select-none"
      >
        {scaleMode === "exaggerated" ? "Not to Scale" : "To Scale"}
      </button>

      <span className="w-px h-3.5 bg-white/20 mx-0.5" />

      <Toggle label="Orbits" active={showOrbits} onClick={toggleOrbits} />
      <Toggle label="Axis" active={showAxialTilt} onClick={toggleAxialTilt} />
      <Toggle label="Ecliptic" active={showEclipticPlane} onClick={toggleEclipticPlane} />
      <Toggle label="Nodes" active={showLunarNodes} onClick={toggleLunarNodes} />

      <div className="flex-1" />
      <span className="text-white/25 text-[10px] hidden sm:inline select-none">
        drag to orbit · scroll to zoom
      </span>
    </div>
  );
}

export function OrbitalViewport({ className = "" }: { className?: string }) {
  return (
    <div className={`relative rounded-lg overflow-hidden bg-black ${className}`}>
      <ViewportToolbar />
      <WebGPUCanvas
        camera={{ position: [0, 35, 35], fov: 45, near: 0.01, far: 100000 }}
        style={{ width: "100%", height: "100%" }}
      >
        <OrbitalSceneContent />
      </WebGPUCanvas>
    </div>
  );
}
