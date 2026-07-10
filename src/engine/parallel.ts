/**
 * The **parallel runner** (S3.1 → S3.3) — the sibling of `runSequential` that turns
 * a forked, seed-interleaved traversal into one totally-ordered event log. Spec §10
 * flags this as the half of the engine the multithread button adds; it is built up
 * across three stories:
 *
 *   - **S3.1:** recursive-halving `fork`, then each lane's `lane-demand → emit` beats
 *     woven together by the seeded scheduler — the fork geometry, the interleaving,
 *     and the per-lane single-file heartbeat.
 *   - **S3.2 (here):** each lane runs its own `filter → map` into **private** partial
 *     bins, driving the *real* op sinks through a lane-tagging recorder so a lane's
 *     `test/survive/die/transform/route/accumulate` events carry its `lane` and its
 *     counts never touch another lane's (spec §3.6, no cross-lane contamination).
 *   - **S3.3 (here):** a `combine` beat merges the partial bins into the final
 *     grouping — provably equal to the sequential result (== oracle) for all
 *     seeds/threads. Because lanes are contiguous ascending partitions and each
 *     lane's bins are in encounter order, merging in **lane order** reproduces the
 *     sequential first-seen key order and per-bin encounter order exactly.
 *
 * Parallelism is *simulated*, never threaded (Decision 6/9/13): a lane's beats are
 * recorded independently, then interleaved into a single recorder whose append order
 * is the logical `tick`. So the log stays deterministic and golden-stable, and the
 * "one spike per lane at a time" guarantee is a property of the beat structure, not
 * of timing. Each lane reuses the same `filter`/`map`/`collect` sinks the sequential
 * pipeline uses (via {@link EventSink}), so per-lane semantics cannot drift from
 * sequential — the foundation S3.3's equivalence rests on.
 *
 * Zero React/Next imports (kernel boundary — see `./README.md`).
 */
import { orderSnapshot, type EngineEvent } from "./domain/event";
import { type Order, type Region } from "./domain/order";
import { EventRecorder, type EventSink, type TicklessEvent } from "./kernel/recorder";
import { type Sink } from "./kernel/sink";
import { arraySpliterator } from "./kernel/spliterator";
import { splitRecursive, type LanePartition, type ThreadCount } from "./kernel/split";
import { buildSchedule } from "./kernel/scheduler";
import { sliceFilterOp } from "./ops/filter";
import { sliceMapOp } from "./ops/map";
import { groupingByRegionSink } from "./ops/collect";

/** The parallel run's configuration — how many lanes and which interleaving seed. */
export interface ParallelConfig {
  readonly threadCount: ThreadCount;
  readonly seed: number;
}

/**
 * A lane recorder: an {@link EventSink} the op sinks emit into, which **tags every
 * event with the lane** and **segments the stream into beats**. A beat opens on each
 * `startBeat()` (a `lane-demand`) and collects the events for that one pull. Because
 * the op sinks call only `record`, they run byte-for-byte as they do sequentially —
 * this recorder just stamps the lane and the beat boundary around their output.
 */
class LaneRecorder implements EventSink {
  private readonly beats: TicklessEvent[][] = [];
  private current: TicklessEvent[] | null = null;

  constructor(private readonly lane: string) {}

  /** Open a new beat with the lane's retrograde `lane-demand` (the pull spike). */
  startBeat(): void {
    this.current = [{ kind: "lane-demand", op: "collect", lane: this.lane, nextStage: "source" }];
    this.beats.push(this.current);
  }

  /** Record the source releasing `order` into this lane — the lane-tagged `emit`. */
  emit(order: Order): void {
    this.current!.push({
      kind: "emit",
      elementId: order.id,
      op: "source",
      lane: this.lane,
      input: orderSnapshot(order),
    });
  }

  /** The {@link EventSink} the ops use: append the event to the current beat, lane-tagged. */
  record(event: TicklessEvent): number {
    const tagged = { ...event, lane: this.lane } as TicklessEvent;
    this.current!.push(tagged);
    return this.current!.length;
  }

  /** Every recorded beat, in order — the last is the trailing (exhaustion) pull. */
  allBeats(): readonly (readonly TicklessEvent[])[] {
    return this.beats;
  }
}

/**
 * A lane's traversal expressed as beats plus its private partial bins. `elementBeats`
 * is one contiguous run of events per pulled element (its `lane-demand → emit → test
 * → survive/die → transform → route → accumulate` journey); `trailingBeat` is the
 * final `lane-demand` that pulls the exhausted lane and finds nothing (the lane
 * powering down). `bins` are the lane's **private** grouping — untouched by other
 * lanes, merged only at `combine` (S3.3).
 */
interface LaneRun {
  readonly elementBeats: readonly (readonly TicklessEvent[])[];
  readonly trailingBeat: readonly TicklessEvent[];
  readonly bins: Map<Region, Order[]>;
}

/**
 * Run one lane's partition through its own `filter → map → collect(groupingBy)` sink
 * chain, into a {@link LaneRecorder}. Mirrors the sequential runner's pull loop —
 * one `lane-demand` per beat, exactly one element resolved before the next — so the
 * per-lane log is single-file and the per-lane bins accumulate in encounter order,
 * identically to a sequential run over just this partition. Slice A grouping never
 * short-circuits, so the loop always runs to the lane's exhaustion.
 */
function runLane(partition: LanePartition): LaneRun {
  const rec = new LaneRecorder(partition.lane);
  const terminalSink = groupingByRegionSink(rec);
  const ops = [sliceFilterOp(), sliceMapOp()];

  // Build the sink chain terminal-first, exactly as runSequential does.
  let head: Sink<Order> = terminalSink;
  for (let i = ops.length - 1; i >= 0; i -= 1) {
    head = ops[i]!.wrap(head, rec);
  }

  const source = arraySpliterator(partition.orders);
  head.begin(source.getExactSizeIfKnown());
  let more: boolean;
  do {
    rec.startBeat();
    more = source.tryAdvance((element) => {
      rec.emit(element);
      head.accept(element);
    });
  } while (more);
  head.end();

  const beats = rec.allBeats();
  return {
    elementBeats: beats.slice(0, -1),
    trailingBeat: beats[beats.length - 1]!,
    bins: terminalSink.result(),
  };
}

/**
 * Merge the lanes' **private partial bins** into the final grouping — the
 * `Collector` combiner (S3.3). Fold in **lane order** (L0, L1, …): concatenating a
 * key's members across lanes in that order restores the original encounter order
 * (lanes are contiguous ascending index ranges, and each lane's bin is already in
 * encounter order), and first-seen key order across lanes is the sequential
 * first-seen order. So the merged map equals the sequential `groupingBy` result —
 * and hence the oracle — key-for-key and member-for-member (AC2).
 */
function mergeBins(laneBins: readonly Map<Region, Order[]>[]): Map<Region, Order[]> {
  const merged = new Map<Region, Order[]>();
  for (const bins of laneBins) {
    for (const [key, members] of bins) {
      const existing = merged.get(key);
      if (existing) existing.push(...members);
      else merged.set(key, [...members]);
    }
  }
  return merged;
}

/**
 * Run `orders` in parallel over `threadCount` lanes with interleaving `seed`,
 * returning the frozen event log **and the merged grouping result**.
 *
 * The shape: one `fork` (carrying the recursive-halving split tree), then the lanes'
 * element beats woven together in the scheduler's seeded order — each lane's beats
 * consumed in encounter order, so per-lane single-file holds — with each lane's
 * trailing `lane-demand` emitted the moment its last element is serviced. A lane with
 * an *empty* partition (a short list over-split, e.g. 1 element into 4 lanes) still
 * powers up and finds nothing: its trailing beat fires right after the fork.
 */
export function runParallel(
  orders: readonly Order[],
  { threadCount, seed }: ParallelConfig,
): { readonly log: readonly EngineEvent[]; readonly result: Map<Region, Order[]> } {
  const { tree, lanes } = splitRecursive(orders, threadCount);
  const laneRuns = lanes.map(runLane);

  const rec = new EventRecorder();
  rec.record({ kind: "fork", op: "fork", lanes: threadCount, splitTree: tree });

  // Empty lanes have no element beat to trigger their trailing demand, so power them
  // down immediately after the fork — they were demanded once and found nothing.
  lanes.forEach((lane, i) => {
    if (lane.orders.length === 0) {
      for (const event of laneRuns[i]!.trailingBeat) rec.record(event);
    }
  });

  const schedule = buildSchedule(
    lanes.map((lane) => lane.orders.length),
    seed,
  );
  const cursor = lanes.map(() => 0);
  for (const laneIdx of schedule) {
    const run = laneRuns[laneIdx]!;
    const beat = run.elementBeats[cursor[laneIdx]!]!;
    cursor[laneIdx]! += 1;
    for (const event of beat) rec.record(event);
    // The lane's last element just resolved — power it down with its trailing pull.
    if (cursor[laneIdx] === run.elementBeats.length) {
      for (const event of run.trailingBeat) rec.record(event);
    }
  }

  // All lanes done — the combiner flows the private partial bins together (S3.3).
  const result = mergeBins(laneRuns.map((run) => run.bins));
  rec.record({
    kind: "combine",
    op: "combine",
    merged: [...result].map(([key, members]) => ({ key, count: members.length })),
  });

  return { log: rec.freeze(), result };
}
