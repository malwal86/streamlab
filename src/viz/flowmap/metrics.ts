/**
 * Flow-map live metrics (the 2D interface's read-out rail) — a **pure function of
 * the event log and the playhead**, exactly like the scene projection (R2). It
 * derives everything the rail shows — how many elements were pulled, survived,
 * died, mapped, routed, found, cancelled, and left un-pulled — straight off the
 * log, inventing nothing the engine did not record.
 *
 * It also derives a **modeled wall-clock** from the log's real structure: work is
 * proportional to elements actually pulled (`emit` count), sequential wall-clock is
 * that whole cost, and parallel wall-clock is the *slowest lane's* cost plus a merge
 * overhead — while total CPU work is the sum across lanes. Because it counts real
 * `emit`s per `lane`, short-circuit (Slice B) and lane-cancellation naturally show
 * up as less work, so the numbers can never claim a speed-up the run did not earn.
 *
 * Zero React/Next imports — a pure kernel-adjacent module, unit-testable without a
 * DOM (mirrors the viz projection boundary).
 */
import { type EngineEvent } from "@/engine/domain/event";

/** Modeled cost, in arbitrary "ms", of pulling and processing one source element. */
export const WORK_PER_PULL = 6;

/**
 * The coordination cost a parallel run pays on top of its slowest lane: a fixed
 * fork/merge cost plus a small per-extra-lane term. This is why doubling the lanes
 * never doubles the speed — the honest Amdahl's-law-flavored tax that makes the
 * "parallel isn't free" lesson land. Zero for a sequential run (no lanes to merge).
 */
export function mergeOverhead(lanes: number): number {
  return lanes <= 1 ? 0 : 8 + 3 * (lanes - 1);
}

/** The flow-map's live read-out, all derived from `(log, playhead)`. */
export interface FlowMetrics {
  /** The event index the playhead rests on (`-1` for an empty log). */
  readonly index: number;
  /** Elements pulled from the source so far (`emit`s up to the playhead). */
  readonly pulled: number;
  /** Elements that passed the filter so far (`survive`s). */
  readonly survived: number;
  /** Elements rejected at the filter so far (`die`s). */
  readonly died: number;
  /** Elements the map transformed so far (`transform`s). */
  readonly mapped: number;
  /** Elements routed into a region bin so far (`route`s — Slice A). */
  readonly routed: number;
  /** Whether a short-circuit terminal has latched a result (`found` — Slice B). */
  readonly found: boolean;
  /** Lanes cancelled so far on short-circuit (`cancel`s — Slice B parallel). */
  readonly cancelled: number;
  /** Source elements never pulled (short-circuit remainder); 0 until `shortcircuit`. */
  readonly neverPulled: number;
  /** Fork lane count for the run (0 when sequential). */
  readonly lanes: number;
  /** Total elements the whole run pulls (`emit`s across the entire log). */
  readonly totalPulled: number;
  /** Modeled wall-clock for the whole run: slowest lane + merge (ms). */
  readonly wallClock: number;
  /** Modeled total CPU work for the whole run: sum across lanes (ms). */
  readonly cpuWork: number;
  /** Modeled wall-clock elapsed up to the playhead — the ticking read-out (ms). */
  readonly wallElapsed: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Project `(log, playhead)` to the flow-map's {@link FlowMetrics}. Live counts scan
 * the prefix up to the playhead; the modeled timing is a property of the whole run
 * (the final wall-clock), with `wallElapsed` interpolating it by playhead progress
 * so the read-out ticks up smoothly. Pure — the same inputs always give the same
 * numbers, and none of them is an outcome absent from the log.
 */
export function flowMetrics(log: readonly EngineEvent[], playhead: number): FlowMetrics {
  const len = log.length;
  if (len === 0) {
    return {
      index: -1, pulled: 0, survived: 0, died: 0, mapped: 0, routed: 0, found: false,
      cancelled: 0, neverPulled: 0, lanes: 0, totalPulled: 0, wallClock: 0, cpuWork: 0, wallElapsed: 0,
    };
  }
  const index = clamp(Math.floor(playhead), 0, len - 1);

  // Live prefix counts up to the playhead.
  let pulled = 0, survived = 0, died = 0, mapped = 0, routed = 0, cancelled = 0;
  let found = false, neverPulled = 0;
  for (let i = 0; i <= index; i += 1) {
    const e = log[i]!;
    switch (e.kind) {
      case "emit": pulled += 1; break;
      case "survive": survived += 1; break;
      case "die": died += 1; break;
      case "transform": mapped += 1; break;
      case "route": routed += 1; break;
      case "found": found = true; break;
      case "cancel": cancelled += 1; break;
      case "shortcircuit": neverPulled = e.remainingUnpulled; break;
      default: break;
    }
  }

  // Whole-run structure for the modeled timing: total pulls, per-lane pulls, lanes.
  let totalPulled = 0;
  let lanes = 0;
  const laneEmits = new Map<string, number>();
  for (const e of log) {
    if (e.kind === "fork") lanes = e.lanes;
    if (e.kind === "emit") {
      totalPulled += 1;
      const lane = e.lane ?? "·";
      laneEmits.set(lane, (laneEmits.get(lane) ?? 0) + 1);
    }
  }

  const slowestLane = laneEmits.size > 0 ? Math.max(...laneEmits.values()) : totalPulled;
  const overhead = mergeOverhead(lanes);
  const wallClock =
    lanes <= 1 ? totalPulled * WORK_PER_PULL : slowestLane * WORK_PER_PULL + overhead;
  const cpuWork = lanes <= 1 ? wallClock : totalPulled * WORK_PER_PULL + overhead;
  const wallElapsed = len <= 1 ? wallClock : wallClock * clamp(index / (len - 1), 0, 1);

  return {
    index, pulled, survived, died, mapped, routed, found, cancelled, neverPulled,
    lanes, totalPulled, wallClock, cpuWork, wallElapsed,
  };
}
