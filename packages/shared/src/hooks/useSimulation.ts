/**
 * useSimulation — bridges physics computation and React rendering.
 *
 * This hook wraps a pure computation function and provides its output
 * as React state. The simulation author writes a pure function
 * (parameters in, state out) and the hook handles execution.
 *
 * Current tier: main-thread only (Tier 0).
 * Future tiers:
 *   Tier 1 — WebGPU compute shaders (GPU-parallel)
 *   Tier 2 — Web Workers (CPU off-thread)
 *   Tier 3 — WebAssembly (near-native speed)
 *
 * The API is designed so that upgrading the execution tier doesn't
 * change the call site. The simulation author's pure function stays
 * the same; only the hook's internal routing changes.
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseSimulationOptions<TParams, TResult> {
  /** Pure function: params in, result out. No side effects. */
  compute: (params: TParams) => TResult;
  /** Current parameter values. When these change, computation re-runs. */
  params: TParams;
  /** Debounce interval in ms. 0 = run on every change. Default: 0 */
  debounceMs?: number;
}

export interface UseSimulationResult<TResult> {
  /** Latest computation result. null before first computation completes. */
  result: TResult | null;
  /** True while computation is running (meaningful when async tiers are added). */
  isComputing: boolean;
  /** Manually trigger a recomputation. */
  recompute: () => void;
}

export function useSimulation<TParams, TResult>({
  compute,
  params,
  debounceMs = 0,
}: UseSimulationOptions<TParams, TResult>): UseSimulationResult<TResult> {
  const [result, setResult] = useState<TResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref to the compute function so the effect doesn't depend on it.
  // This avoids re-triggering when the caller passes an inline function.
  const computeRef = useRef(compute);
  computeRef.current = compute;

  // Serialize params to detect actual value changes, not just reference changes.
  // Objects created in render (e.g. { flux, wavelength, ... }) get a new
  // reference every render, but JSON.stringify only changes when a value does.
  const paramsKey = JSON.stringify(params);

  const runCompute = useCallback(() => {
    setIsComputing(true);
    try {
      const output = computeRef.current(params);
      setResult(output);
    } finally {
      setIsComputing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    if (debounceMs > 0) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(runCompute, debounceMs);
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
    runCompute();
  }, [runCompute, debounceMs]);

  return { result, isComputing, recompute: runCompute };
}