/**
 * Zustand store for the Sun/Earth/Moon simulation.
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
export type CenterBody = "earth" | "sun" | "moon";
export type CameraPreset = "orbital-top" | "orbital-side" | "earth-surface" | "free";

export interface LunarStore {
  // ── Time ──────────────────────────────────────────────
  jd: number;
  playing: boolean;
  playSpeed: number;

  // ── Display ───────────────────────────────────────────
  scaleMode: ScaleMode;
  centerBody: CenterBody;
  showOrbits: boolean;
  showLabels: boolean;
  showAxialTilt: boolean;
  showEclipticPlane: boolean;
  showLunarNodes: boolean;
  cameraPreset: CameraPreset;

  // ── Observer ──────────────────────────────────────────
  observerLat: number;
  observerLon: number;

  // ── Computed state ────────────────────────────────────
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
  setCenterBody: (body: CenterBody) => void;
  toggleOrbits: () => void;
  toggleLabels: () => void;
  toggleAxialTilt: () => void;
  toggleEclipticPlane: () => void;
  toggleLunarNodes: () => void;
  setCameraPreset: (preset: CameraPreset) => void;

  setObserverLat: (lat: number) => void;
  setObserverLon: (lon: number) => void;
  setObserverLocation: (lat: number, lon: number) => void;

  tick: (deltaSeconds: number) => void;
  recompute: () => void;
}

function deriveState(jd: number, lat: number, lon: number) {
  const snapshot = computeSnapshot(jd);
  const observerView = computeObserverView(snapshot, lat, lon);
  return { snapshot, observerView };
}

const initialJD = dateToJD(new Date());
const initialLat = 44.4759;
const initialLon = -73.2121;
const initialDerived = deriveState(initialJD, initialLat, initialLon);

export const useLunarStore = create<LunarStore>((set, get) => ({
  jd: initialJD,
  playing: false,
  playSpeed: 1,

  scaleMode: "exaggerated",
  centerBody: "earth",
  showOrbits: true,
  showLabels: true,
  showAxialTilt: true,
  showEclipticPlane: false,
  showLunarNodes: false,
  cameraPreset: "orbital-top",

  observerLat: initialLat,
  observerLon: initialLon,

  snapshot: initialDerived.snapshot,
  observerView: initialDerived.observerView,

  setJD: (jd) => {
    const { observerLat, observerLon } = get();
    const derived = deriveState(jd, observerLat, observerLon);
    set({ jd, ...derived });
  },

  setDate: (date) => { get().setJD(dateToJD(date)); },
  goToNow: () => { get().setJD(dateToJD(new Date())); },
  stepDays: (days) => { get().setJD(get().jd + days); },

  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setPlaySpeed: (playSpeed) => set({ playSpeed }),

  setScaleMode: (scaleMode) => set({ scaleMode }),
  setCenterBody: (centerBody) => set({ centerBody }),
  toggleOrbits: () => set((s) => ({ showOrbits: !s.showOrbits })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleAxialTilt: () => set((s) => ({ showAxialTilt: !s.showAxialTilt })),
  toggleEclipticPlane: () => set((s) => ({ showEclipticPlane: !s.showEclipticPlane })),
  toggleLunarNodes: () => set((s) => ({ showLunarNodes: !s.showLunarNodes })),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),

  setObserverLat: (observerLat) => {
    const { jd, observerLon } = get();
    set({ observerLat, ...deriveState(jd, observerLat, observerLon) });
  },
  setObserverLon: (observerLon) => {
    const { jd, observerLat } = get();
    set({ observerLon, ...deriveState(jd, observerLat, observerLon) });
  },
  setObserverLocation: (lat, lon) => {
    const { jd } = get();
    set({ observerLat: lat, observerLon: lon, ...deriveState(jd, lat, lon) });
  },

  tick: (deltaSeconds) => {
    const { jd, playSpeed, playing, observerLat, observerLon } = get();
    if (!playing) return;
    const newJD = jd + playSpeed * deltaSeconds;
    set({ jd: newJD, ...deriveState(newJD, observerLat, observerLon) });
  },

  recompute: () => {
    const { jd, observerLat, observerLon } = get();
    set(deriveState(jd, observerLat, observerLon));
  },
}));
