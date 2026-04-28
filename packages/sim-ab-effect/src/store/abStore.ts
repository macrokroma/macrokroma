import { create } from "zustand";

export interface ABParams {
  /** Enclosed magnetic flux in units of flux quanta (Φ/Φ₀). Range: 0 to 2. */
  flux: number;
  /** Electron wavelength in nm. Range: 0.1 to 10. */
  wavelength: number;
  /** Slit separation in nm. Range: 10 to 1000. */
  slitSeparation: number;
  /** Slit width in nm. Range: 1 to 200. */
  slitWidth: number;
  /** Screen distance in μm. Range: 1 to 100. */
  screenDistance: number;
}

interface ABStore extends ABParams {
  setFlux: (v: number) => void;
  setWavelength: (v: number) => void;
  setSlitSeparation: (v: number) => void;
  setSlitWidth: (v: number) => void;
  setScreenDistance: (v: number) => void;
  reset: () => void;
}

/**
 * Default values chosen to match the standard textbook figure (OpenStax Fig 4.11).
 *
 * d = 6λ, a = 2λ → d/a = 3.
 * This produces a visible "missing order" at m = ±3 where an interference
 * maximum coincides with the first diffraction minimum — the most
 * pedagogically important feature of the double-slit diffraction pattern.
 *
 * With λ = 2 nm: d = 12 nm (slit separation), a = 4 nm (slit width).
 * Screen distance chosen to spread the pattern across the viewport.
 */
const defaults: ABParams = {
  flux: 0,
  wavelength: 2.0,
  slitSeparation: 12,
  slitWidth: 4,
  screenDistance: 1.5,
};

export const useABStore = create<ABStore>()((set) => ({
  ...defaults,
  setFlux: (v) => set({ flux: v }),
  setWavelength: (v) => set({ wavelength: v }),
  setSlitSeparation: (v) => set({ slitSeparation: v }),
  setSlitWidth: (v) => set({ slitWidth: v }),
  setScreenDistance: (v) => set({ screenDistance: v }),
  reset: () => set(defaults),
}));