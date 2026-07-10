/**
 * The engine's **run entry point** (S0.7): `runEngine(config) → frozen event log`.
 * This is the seam the store re-runs on every config change (R3) — the one place
 * a `Config` is turned into a pipeline and driven to a log. Keeping it here, in
 * the pure kernel, is what lets the store stay a thin Zustand wrapper while the
 * engine stays free of React/Next/Zustand (the S0.7 import boundary).
 *
 * Today only the **identity pipeline** exists (S0.5), so every config currently
 * produces the same well-formed log. That is deliberate and honest: the real
 * op/terminal/parallel selection — `filter`/`map`/`collect` (E1), `find*` (E2),
 * the parallel scheduler keyed by `mode`/`threadCount`/`seed` (E3) — plugs into
 * *this* function without the store or the runner changing. The store already
 * re-runs on every field change (AC1), so the swap machinery is proven now and
 * the pipeline grows underneath it later.
 *
 * Zero React/Next imports (kernel boundary — see `./README.md`).
 */
import { type EngineEvent } from "./domain/event";
import { ORDERS } from "./domain/fixture";
import { identityPipeline, runSequential } from "./kernel/runner";

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
 * `config` does not yet steer the pipeline (only identity exists — see the module
 * note); it is threaded now so E1–E3 fill in the pipeline selection here and
 * nothing above this line changes.
 */
export function runEngine(config: Config): readonly EngineEvent[] {
  void config; // becomes load-bearing in E1–E3; see module note.
  const { log } = runSequential(identityPipeline(ORDERS));
  return log;
}
