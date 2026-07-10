/**
 * Structural invariants over an event log (S0.5) — pure predicates the tests assert
 * and later stories reuse. The kernel's whole correctness claim (spec §4, the
 * "single-file" heartbeat) is a *property of the log shape*, so it must be
 * checkable as a pure function of the log — no engine internals, no timing.
 *
 * These live in `testing/` (not `kernel/`) because they are a *verification tool*,
 * not production behavior: unit tests, property tests, and the golden all lean on
 * them, and E1's op logs are held to the same invariants unchanged.
 */
import { type EngineEvent } from "../domain/event";

/** A point where an `emit` was not backed by a preceding, unconsumed `demand`. */
export interface PullViolation {
  /** `tick` of the offending `emit`. */
  readonly tick: number;
  /** Demands seen in the log up to (not incl.) this emit. */
  readonly demandsSoFar: number;
  /** Emits seen up to (not incl.) this emit. */
  readonly emitsSoFar: number;
}

/**
 * The one load-bearing invariant, combining AC2 (single-file) and AC3 (demand
 * precedes emit): **at every `emit`, strictly more `demand`s than `emit`s have been
 * seen so far.** One demand is consumed per emit, so:
 *
 *   - the *first* emit needs a demand before it (AC3), and
 *   - no *second* emit can appear on the same demand (AC2, single-file) — a demand
 *     must intervene between any two emits.
 *
 * A trailing demand that pulls an exhausted source (the run's final beat) only
 * *raises* the demand count, so it never violates this; that is the intended shape
 * (N emits ⇒ N+1 demands for the array source). Returns every violation, in log
 * order, so a failing property test prints exactly where the loop interleaved.
 */
export function pullOrderViolations(log: readonly EngineEvent[]): readonly PullViolation[] {
  const violations: PullViolation[] = [];
  let demands = 0;
  let emits = 0;
  for (const event of log) {
    if (event.kind === "demand") {
      demands += 1;
    } else if (event.kind === "emit") {
      // The demand that pulled this element must already be counted.
      if (demands <= emits) {
        violations.push({ tick: event.tick, demandsSoFar: demands, emitsSoFar: emits });
      }
      emits += 1;
    }
  }
  return violations;
}

/** True iff `log` has no {@link pullOrderViolations} — a well-formed single-file pull. */
export function isSingleFilePull(log: readonly EngineEvent[]): boolean {
  return pullOrderViolations(log).length === 0;
}

/** Count events of a given kind — a small helper for shape assertions. */
export function countKind(log: readonly EngineEvent[], kind: EngineEvent["kind"]): number {
  return log.reduce((n, event) => (event.kind === kind ? n + 1 : n), 0);
}

/**
 * The parallel per-lane single-file invariant (S3.1 AC4): **within each lane**, at
 * every `emit` strictly more of that lane's `lane-demand`s than its `emit`s have been
 * seen so far. This is `pullOrderViolations` restricted to one lane, with
 * `lane-demand` playing the role of `demand`: across lanes beats interleave freely
 * (that *is* the parallelism), but no single lane may have two elements in flight at
 * once — one spike per lane (spec §3.6). Events with no `lane` (a sequential log, or
 * the parallel `fork`/`combine` framing) are ignored. Returns every violation in log
 * order, tagged nowhere by lane in the shape — the `tick` locates it.
 */
export function laneSingleFileViolations(log: readonly EngineEvent[]): readonly PullViolation[] {
  const violations: PullViolation[] = [];
  const perLane = new Map<string, { demands: number; emits: number }>();
  for (const event of log) {
    if (event.lane === undefined) continue;
    let counts = perLane.get(event.lane);
    if (!counts) {
      counts = { demands: 0, emits: 0 };
      perLane.set(event.lane, counts);
    }
    if (event.kind === "lane-demand") {
      counts.demands += 1;
    } else if (event.kind === "emit") {
      if (counts.demands <= counts.emits) {
        violations.push({ tick: event.tick, demandsSoFar: counts.demands, emitsSoFar: counts.emits });
      }
      counts.emits += 1;
    }
  }
  return violations;
}

/** True iff every lane in `log` is single-file — no lane has two spikes in flight (S3.1 AC4). */
export function isPerLaneSingleFile(log: readonly EngineEvent[]): boolean {
  return laneSingleFileViolations(log).length === 0;
}

/**
 * The short-circuit invariant (S2.1 AC2): once a `findFirst`/`findAny` terminal
 * records `found`, **no `demand` or `emit` may follow** — traversal must never pull
 * past the decisive element. Returns the ticks of any offending pull events after
 * the first `found` (empty when the log never short-circuits, or short-circuits
 * cleanly). A pure function of the log, so it holds the terminal to its promise
 * without reaching into the engine.
 */
export function pullsAfterFound(log: readonly EngineEvent[]): readonly number[] {
  const foundIndex = log.findIndex((event) => event.kind === "found");
  if (foundIndex < 0) return [];
  return log
    .slice(foundIndex + 1)
    .filter((event) => event.kind === "demand" || event.kind === "emit")
    .map((event) => event.tick);
}
