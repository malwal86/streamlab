/**
 * The engine's **run entry point** (S0.7): `runEngine(config) → frozen event log`.
 * This is the seam the store re-runs on every config change (R3) — the one place
 * a `Config` is turned into a pipeline and driven to a log. Keeping it here, in
 * the pure kernel, is what lets the store stay a thin Zustand wrapper while the
 * engine stays free of React/Next/Zustand (the S0.7 import boundary).
 *
 * **Slice A sequential** is real as of S1.3 — `filter → map → collect(groupingBy)`
 * (see `./pipelines`). The other three quadrants (Slice B `find*` in E2, and both
 * slices' parallel scheduler in E3) still fall back to the identity pipeline: an
 * honest, well-formed placeholder log so the store's swap machinery, the transport,
 * and the viz chassis are all exercised now and the real pipelines drop in under
 * this function later without the store or runner changing.
 *
 * Zero React/Next imports (kernel boundary — see `./README.md`).
 */
import { type EngineEvent } from "./domain/event";
import { ORDERS } from "./domain/fixture";
import { identityPipeline, runSequential, type Pipeline } from "./kernel/runner";
import { sliceASequentialPipeline } from "./pipelines";

/**
 * The engine-run configuration (R3). Selects *which* pipeline `runEngine` builds:
 * the `slice` (grouping vs find), sequential vs `parallel` `mode`, the lane count
 * and interleaving `seed` for parallel, and the short-circuit `terminal` for
 * Slice B. Owned by the engine because it is a property of the *run*, not the UI;
 * the store holds a value of this type and hands it back on every change.
 */
export interface Config {
  readonly slice: "A" | "B";
  readonly mode: "sequential" | "parallel";
  /** Parallel only — the number of lanes the source splits into. */
  readonly threadCount: 2 | 4;
  /** Varies the parallel interleaving; inert under sequential mode. */
  readonly seed: number;
  /** Slice B only — which short-circuit terminal runs. */
  readonly terminal: "findFirst" | "findAny";
}

/**
 * The default run: Slice A, sequential, the smaller lane count, a fixed seed,
 * `findFirst`. What the store boots with before the user touches a control.
 */
export const DEFAULT_CONFIG: Config = {
  slice: "A",
  mode: "sequential",
  threadCount: 2,
  seed: 1,
  terminal: "findFirst",
};

/**
 * Run the engine for `config` and return its **frozen** event log. The log is
 * deep-frozen by the recorder (`freezeLog`), so the store can share the same
 * reference across the playhead projection and goldens without any risk of a
 * consumer mutating history.
 *
 * Slice A sequential runs the real grouping pipeline; every other quadrant is the
 * identity placeholder until its ops land (see the module note). Selection lives
 * here so the store stays a thin wrapper — it hands a `Config` in and gets a log
 * back, never knowing which pipeline produced it.
 */
export function runEngine(config: Config): readonly EngineEvent[] {
  const isSliceASequential = config.slice === "A" && config.mode === "sequential";
  // Typed as `Pipeline<unknown>`: the two branches produce different result types
  // (grouped bins vs the identity list), but `runEngine` returns only the log and
  // discards the result, so the result type is immaterial here.
  const pipeline: Pipeline<unknown> = isSliceASequential
    ? sliceASequentialPipeline(ORDERS)
    : identityPipeline(ORDERS);
  const { log } = runSequential(pipeline);
  return log;
}
