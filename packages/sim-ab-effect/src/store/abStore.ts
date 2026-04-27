import { create } from "zustand";

export interface ABParams {
  /** Enclosed magnetic flux in units of flux quanta (Φ/Φ₀). Range: 0 to 2. */
  flux: number;
  /** Electron wavelength in nm. Range: 0.01 to 10. */
  wavelength: number;
  /** Slit separation in nm. Range: 10 to 1000. */
  slitSeparation: number;
  /** Screen distance in μm. Range: 1 to 100. */
  screenDistance: number;
}

interface ABStore extends ABParams {
  setFlux: (v: number) => void;
  setWavelength: (v: number) => void;
  setSlitSeparation: (v: number) => void;
  setScreenDistance: (v: number) => void;
  reset: () => void;
}

const defaults: ABParams = {
  flux: 0,
  wavelength: 1.0,
  slitSeparation: 200,
  screenDistance: 10,
};

export const useABStore = create<ABStore>()((set) => ({
  ...defaults,
  setFlux: (v) => set({ flux: v }),
  setWavelength: (v) => set({ wavelength: v }),
  setSlitSeparation: (v) => set({ slitSeparation: v }),
  setScreenDistance: (v) => set({ screenDistance: v }),
  reset: () => set(defaults),
}));
