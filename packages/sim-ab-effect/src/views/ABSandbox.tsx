import { useState } from "react";
import { useABStore } from "../store/abStore";
import { ABShiftedPattern } from "../components/ABShiftedPattern";
import { ABGeometryExplorer } from "../components/ABGeometryExplorer";
import { SolenoidFieldExplorer } from "../components/SolenoidFieldExplorer";
import { WavefunctionEvolution } from "../components/WavefunctionEvolution";
import { ABLinkedView } from "../components/ABLinkedView";
import { GaugeTransformExplorer } from "../components/GaugeTransformExplorer";

type SandboxTab =
  | "linked"
  | "interference"
  | "geometry"
  | "solenoid"
  | "wavefunction"
  | "gauge";

const TABS: { key: SandboxTab; label: string; description: string }[] = [
  {
    key: "linked",
    label: "Full AB Effect",
    description: "Geometry and interference pattern linked by the same flux slider.",
  },
  {
    key: "interference",
    label: "Interference",
    description: "Shifted interference pattern with ghost overlay and diffraction envelope.",
  },
  {
    key: "geometry",
    label: "AB Geometry",
    description: "Electron paths around the solenoid with phase coloring and A field.",
  },
  {
    key: "solenoid",
    label: "Solenoid Fields",
    description: "2D cross-section and 3D view of B and A fields around a solenoid.",
  },
  {
    key: "wavefunction",
    label: "Wavefunction",
    description: "Time-dependent Schrödinger equation solved on a 2D grid.",
  },
  {
    key: "gauge",
    label: "Gauge Transform",
    description: "Watch A change under gauge transformations while B stays fixed.",
  },
];

export function ABSandbox() {
  const [activeTab, setActiveTab] = useState<SandboxTab>("linked");

  const activeInfo = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="flex flex-col gap-4 p-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold mb-1">Sandbox</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          All simulations, no theory. Pick a tab and experiment.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "px-3 py-1.5 rounded-md text-xs transition-colors",
              activeTab === tab.key
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p className="text-xs text-[var(--color-text-secondary)] italic">
        {activeInfo.description}
      </p>

      {/* Active sim */}
      <div>
        {activeTab === "linked" && <ABLinkedView />}
        {activeTab === "interference" && <ABShiftedPattern />}
        {activeTab === "geometry" && <ABGeometryExplorer />}
        {activeTab === "solenoid" && <SolenoidFieldExplorer />}
        {activeTab === "wavefunction" && <WavefunctionEvolution />}
        {activeTab === "gauge" && <GaugeTransformExplorer />}
      </div>
    </div>
  );
}