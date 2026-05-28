/**
 * Zustand store for the Sun/Earth/Moon simulation.
 *
 * Manages:
 * - Simulation time (as Julian Date, with play/pause/speed controls)
 * - Display settings (scale mode, labels, orbit paths)
 * - Observer location on Earth (latitude/longitude)
 * - Derived celestial state (computed from time via the ephemeris)
 */

import { create } from "zustand";
import { dateToJD, jdToDate } from "../compute/ephemeris/julianDate";
import {
  computeSnapshot,
  computeObserverView,
  type CelestialSnapshot,
  type ObserverView,
} from "../compute/ephemeris/meeus";

export type ScaleMode = "exaggerated" | "realistic";
export type CameraPreset = "orbital-top" | "orbital-side" | "earth-surface" | "free";

export interface LunarStore {
  // ── Time ──────────────────────────────────────────────
  /** Current simulation time as Julian Date */
  jd: number;
  /** Whether the simulation is playing (advancing time) */
  playing: boolean;
  /** Playback speed in days per real-time second */
  playSpeed: number;

  // ── Display ───────────────────────────────────────────
  scaleMode: ScaleMode;
  showOrbits: boolean;
  showLabels: boolean;
  showAxialTilt: boolean;
  showEclipticPlane: boolean;
  showLunarNodes: boolean;
  cameraPreset: CameraPreset;

  // ── Observer ──────────────────────────────────────────
  /** Observer latitude (degrees, N positive) */
  observerLat: number;
  /** Observer longitude (degrees, E positive) */
  observerLon: number;

  // ── Computed state (updated when jd changes) ──────────
  snapshot: CelestialSnapshot;
  observerView: ObserverView;

  // ── Actions ───────────────────────────────────────────
  setJD: (jd: number) => void;
  setDate: (date: Date) => void;
  goToNow: () => void;
  stepDays: (days: number) => void;
  togglePlay: () => void;
  setPlaySpeed: (speed: number) => void;

  setScaleMode: (mode: ScaleMode) => void;
  toggleOrbits: () => void;
  toggleLabels: () => void;
  toggleAxialTilt: () => void;
  toggleEclipticPlane: () => void;
  toggleLunarNodes: () => void;
  setCameraPreset: (preset: CameraPreset) => void;

  setObserverLat: (lat: number) => void;
  setObserverLon: (lon: number) => void;
  setObserverLocation: (lat: number, lon: number) => void;

  /** Called every animation frame when playing */
  tick: (deltaSeconds: number) => void;

  /** Recompute derived state from current JD + observer */
  recompute: () => void;
}

/** Compute derived state from JD and observer position */
function deriveState(jd: number, lat: number, lon: number) {
  const snapshot = computeSnapshot(jd);
  const observerView = computeObserverView(snapshot, lat, lon);
  return { snapshot, observerView };
}

/** Initial JD = right now */
const initialJD = dateToJD(new Date());
const initialLat = 44.4759; // Burlington, VT (user's location)
const initialLon = -73.2121;
const initialDerived = deriveState(initialJD, initialLat, initialLon);

export const useLunarStore = create<LunarStore>((set, get) => ({
  // Time
  jd: initialJD,
  playing: false,
  playSpeed: 1, // 1 day per second

  // Display
  scaleMode: "exaggerated",
  showOrbits: true,
  showLabels: true,
  showAxialTilt: true,
  showEclipticPlane: false,
  showLunarNodes: false,
  cameraPreset: "orbital-top",

  // Observer
  observerLat: initialLat,
  observerLon: initialLon,

  // Computed
  snapshot: initialDerived.snapshot,
  observerView: initialDerived.observerView,

  // Actions
  setJD: (jd) => {
    const { observerLat, observerLon } = get();
    const derived = deriveState(jd, observerLat, observerLon);
    set({ jd, ...derived });
  },

  setDate: (date) => {
    const jd = dateToJD(date);
    get().setJD(jd);
  },

  goToNow: () => {
    get().setJD(dateToJD(new Date()));
  },

  stepDays: (days) => {
    const { jd } = get();
    get().setJD(jd + days);
  },

  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setPlaySpeed: (playSpeed) => set({ playSpeed }),

  setScaleMode: (scaleMode) => set({ scaleMode }),
  toggleOrbits: () => set((s) => ({ showOrbits: !s.showOrbits })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleAxialTilt: () => set((s) => ({ showAxialTilt: !s.showAxialTilt })),
  toggleEclipticPlane: () => set((s) => ({ showEclipticPlane: !s.showEclipticPlane })),
  toggleLunarNodes: () => set((s) => ({ showLunarNodes: !s.showLunarNodes })),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),

  setObserverLat: (observerLat) => {
    const { jd, observerLon } = get();
    const derived = deriveState(jd, observerLat, observerLon);
    set({ observerLat, ...derived });
  },

  setObserverLon: (observerLon) => {
    const { jd, observerLat } = get();
    const derived = deriveState(jd, observerLat, observerLon);
    set({ observerLon, ...derived });
  },

  setObserverLocation: (lat, lon) => {
    const { jd } = get();
    const derived = deriveState(jd, lat, lon);
    set({ observerLat: lat, observerLon: lon, ...derived });
  },

  tick: (deltaSeconds) => {
    const { jd, playSpeed, playing, observerLat, observerLon } = get();
    if (!playing) return;
    const newJD = jd + playSpeed * deltaSeconds;
    // Use deriveState inline to avoid recursion through setJD
    const derived = deriveState(newJD, observerLat, observerLon);
    set({ jd: newJD, ...derived });
  },

  recompute: () => {
    const { jd, observerLat, observerLon } = get();
    const derived = deriveState(jd, observerLat, observerLon);
    set(derived);
  },
}));
