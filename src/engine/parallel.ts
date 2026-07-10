/**
 * The **parallel runner** (S3.1 → S3.3) — the sibling of `runSequential` that turns
 * a forked, seed-interleaved traversal into one totally-ordered event log. Spec §10
 * flags this as the half of the engine the multithread button adds; it is built up
 * across three stories:
 *
 *   - **S3.1 (here):** recursive-halving `fork`, then each lane's `lane-demand →
 *     emit` beats woven together by the seeded scheduler. Proves the fork geometry,
 *     the interleaving, and the per-lane single-file heartbeat.
 *   - **S3.2:** each lane runs its own `filter → map` into **private** partial bins
 *     (lane-tagged `test/survive/die/transform/route/accumulate`).
 *   - **S3.3:** a `combine` beat merges the partial bins into the final grouping —
 *     provably equal to the sequential result (== oracle) for all seeds/threads.
 *
 * Parallelism is *simulated*, never threaded (Decision 6/9/13): a lane's beats are
 * recorded independently, then interleaved into a single recorder whose append order
 * is the logical `tick`. So the log stays deterministic and golden-stable, and the
 * "one spike per lane at a time" guarantee is a property of the beat structure, not
 * of timing.
 *
 * Zero React/Next imports (kernel boundary — see `./README.md`).
 */
import { orderSnapshot, type EngineEvent } from "./domain/event";
import { type Order } from "./domain/order";
import { EventRecorder, type TicklessEvent } from "./kernel/recorder";
import { splitRecursive, type LanePartition, type ThreadCount } from "./kernel/split";
import { buildSchedule } from "./kernel/scheduler";

/** The parallel run's configuration — how many lanes and which interleaving seed. */
export interface ParallelConfig {
  readonly threadCount: ThreadCount;
  readonly seed: number;
}

/**
 * A lane's traversal expressed as **beats**: `elementBeats[i]` is the contiguous run
 * of (tickless, lane-tagged) events for the lane's `i`-th pulled element — a
 * `lane-demand` opening the beat, then the element's `emit` and (S3.2+) its `filter →
 * map → accumulate` journey. `trailingBeat` is the final `lane-demand` that pulls the
 * now-exhausted lane and finds nothing (the lane powering down — the parallel mirror
 * of the sequential runner's N+1-th demand). Interleaving happens at beat
 * granularity, so a beat is never split across lanes: within a lane, one element is
 * fully resolved before the lane is serviced again (AC4).
 */
interface LaneBeats {
  readonly elementBeats: readonly (readonly TicklessEvent[])[];
  readonly trailingBeat: readonly TicklessEvent[];
}

/** The lane-demand that opens (or, trailing, closes) a lane's beat. */
function laneDemand(lane: string): TicklessEvent {
  return { kind: "lane-demand", op: "collect", lane, nextStage: "source" };
}

/**
 * Traverse one lane's partition into beats (S3.1 shape: `lane-demand → emit`). Each
 * element gets its own beat; a final trailing beat marks exhaustion. S3.2 grows the
 * per-element beat with the `filter → map → accumulate` events, but the beat
 * segmentation — one element fully resolved per beat — is fixed here.
 */
function runLane(partition: LanePartition): LaneBeats {
  const { lane, orders } = partition;
  const elementBeats = orders.map((order): readonly TicklessEvent[] => [
    laneDemand(lane),
    { kind: "emit", elementId: order.id, op: "source", lane, input: orderSnapshot(order) },
  ]);
  return { elementBeats, trailingBeat: [laneDemand(lane)] };
}

/**
 * Run `orders` in parallel over `threadCount` lanes with interleaving `seed`,
 * returning the frozen event log.
 *
 * The shape: one `fork` (carrying the recursive-halving split tree), then the lanes'
 * element beats woven together in the scheduler's seeded order — each lane's beats
 * consumed in encounter order, so per-lane single-file holds — with each lane's
 * trailing `lane-demand` emitted the moment its last element is serviced. A lane with
 * an *empty* partition (possible when a short list is over-split, e.g. 1 element into
 * 4 lanes) still powers up and finds nothing: its trailing beat fires right after the
 * fork.
 */
export function runParallel(
  orders: readonly Order[],
  { threadCount, seed }: ParallelConfig,
): { readonly log: readonly EngineEvent[] } {
  const { tree, lanes } = splitRecursive(orders, threadCount);
  const laneBeats = lanes.map(runLane);

  const rec = new EventRecorder();
  rec.record({ kind: "fork", op: "fork", lanes: threadCount, splitTree: tree });

  // Empty lanes have no element beat to trigger their trailing demand, so power them
  // down immediately after the fork — they were demanded once and found nothing.
  lanes.forEach((lane, i) => {
    if (lane.orders.length === 0) {
      for (const event of laneBeats[i]!.trailingBeat) rec.record(event);
    }
  });

  const schedule = buildSchedule(
    lanes.map((lane) => lane.orders.length),
    seed,
  );
  const cursor = lanes.map(() => 0);
  for (const laneIdx of schedule) {
    const beats = laneBeats[laneIdx]!;
    const beat = beats.elementBeats[cursor[laneIdx]!]!;
    cursor[laneIdx]! += 1;
    for (const event of beat) rec.record(event);
    // The lane's last element just resolved — power it down with its trailing pull.
    if (cursor[laneIdx] === beats.elementBeats.length) {
      for (const event of beats.trailingBeat) rec.record(event);
    }
  }

  return { log: rec.freeze() };
}
