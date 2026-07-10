import { create } from "zustand";
import { type EngineEvent } from "@/engine/domain/event";
import { DEFAULT_CONFIG, runEngine, type Config } from "@/engine/run";

/**
 * The application store (S0.7, R3): the single source of truth the render tree
 * subscribes to. It holds exactly three things — `config`, the frozen `eventLog`,
 * and the `playhead` — and the actions that mutate them. Everything the viz
 * shows is derived from `(eventLog, playhead)` through the pure selector in
 * `./select`; the store itself computes no outcomes.
 *
 * The load-bearing rule (R3): **any config change re-runs the engine**, swaps in
 * a new frozen `eventLog`, and resets the `playhead` per policy. That flow is the
 * only way `eventLog` ever changes, so the log and the config can never drift
 * out of sync.
 *
 * The store lives on the React side of the boundary and may import Zustand; the
 * engine it calls (`@/engine/run`) may not import React/Next/Zustand — enforced
 * by the ESLint `no-restricted-imports` override and `engine.boundary.test.ts`.
 */

/**
 * The playhead's reset target on every engine re-run. A config change produces a
 * *different* log whose events the old playhead position is meaningless against,
 * so the only safe, glitch-free policy is to rewind to the start (`0`, the first
 * event) — the run always begins from the top. Named so the reset policy is one
 * auditable constant, not a magic literal scattered across five actions.
 */
export const PLAYHEAD_START = 0;

interface StoreState {
  /** The run configuration (R3). Changing any field re-runs the engine. */
  config: Config;
  /** The current run's immutable event log — swapped wholesale on every config change. */
  eventLog: readonly EngineEvent[];
  /** Fractional playhead; interpolated between events by the selector (interpolation: S1.5). */
  playhead: number;

  // Config actions — each patches one field, then re-runs the engine (R3).
  setSlice: (slice: Config["slice"]) => void;
  setMode: (mode: Config["mode"]) => void;
  setThreads: (threadCount: Config["threadCount"]) => void;
  setSeed: (seed: Config["seed"]) => void;
  setTerminal: (terminal: Config["terminal"]) => void;

  /** Move the playhead (transport scrubbing — the UI arrives in S1.10). Does not re-run the engine. */
  setPlayhead: (playhead: number) => void;
}

export const useAppStore = create<StoreState>((set) => {
  /**
   * Apply a config patch: fold it into the current config, re-run the engine for
   * the new config, swap in the fresh frozen log, and reset the playhead. The one
   * choke point every config action routes through, so the "config change ⇒
   * re-run ⇒ new frozen log ⇒ playhead reset" invariant holds by construction.
   */
  const applyConfig = (patch: Partial<Config>) =>
    set((state) => {
      const config = { ...state.config, ...patch };
      return { config, eventLog: runEngine(config), playhead: PLAYHEAD_START };
    });

  return {
    config: DEFAULT_CONFIG,
    eventLog: runEngine(DEFAULT_CONFIG),
    playhead: PLAYHEAD_START,

    setSlice: (slice) => applyConfig({ slice }),
    setMode: (mode) => applyConfig({ mode }),
    setThreads: (threadCount) => applyConfig({ threadCount }),
    setSeed: (seed) => applyConfig({ seed }),
    setTerminal: (terminal) => applyConfig({ terminal }),

    setPlayhead: (playhead) => set({ playhead }),
  };
});
