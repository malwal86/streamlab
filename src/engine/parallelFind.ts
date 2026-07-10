/**
 * The **parallel short-circuit runner** (S4.1 → S4.2, spec §3.4 / §10, Decision 31) —
 * the Slice-B sibling of `runParallel`. Spec §10 flags this as *the single most
 * error-prone item* in the whole lab: parallel `findFirst` must return the
 * **encounter-order-earliest** survivor (never merely the first lane home), while
 * `findAny` returns the first lane home. Teaching the two as the same thing is the
 * bug this module exists to make impossible.
 *
 * How the simulation stays faithful without threads (Decision 6/9/13, as in
 * `parallel.ts`): each lane races through its own `filter → map` and **short-circuits
 * at its first survivor** (its decisive element — no lane pulls past it, S4.1 AC2).
 * The lanes' element beats are then interleaved in the seeded schedule, exactly like
 * the grouping runner — but here the interleave is *truncated* at the moment the
 * result is decided, and the losing lanes are **cancelled**:
 *
 *   - **findFirst (S4.1):** the winner is the **leftmost lane with a survivor**. Because
 *     the split is a contiguous ascending partition, that lane's first survivor is the
 *     globally encounter-order-earliest survivor (proof in {@link runParallelFind}) —
 *     so the result is **seed-independent**, the load-bearing property. The winner is
 *     not declared until the ordered wait completes: every *earlier* lane must finish
 *     (verified to hold no earlier match) and the winner must have produced its
 *     candidate. Only then does `found` fire and the now-irrelevant later lanes cancel.
 *   - **findAny (S4.2):** the winner is the **first lane to reach its candidate in the
 *     interleaved tick order** — first home wins immediately, and every other lane
 *     still in flight cancels at once. This *does* vary with the seed, which is exactly
 *     the contrast the demo shows: on a divergent seed `findAny ≠ findFirst`.
 *
 * The log is one totally-ordered `EngineEvent[]`: a `fork`, the interleaved lane beats
 * up to the decision, a single `found`, then one `cancel` per irrelevant lane. Nothing
 * is pulled after `found` (short-circuit), so the never-demanded remainder simply has
 * no `emit` — the "goes dark, never pulled" story, per lane.
 *
 * Zero React/Next imports (kernel boundary — see `./README.md`).
 */
import { orderSnapshot, type EngineEvent } from "./domain/event";
import { type Order } from "./domain/order";
import { EventRecorder, type EventSink, type TicklessEvent } from "./kernel/recorder";
import { type Sink } from "./kernel/sink";
import { type TerminalSink } from "./kernel/runner";
import { arraySpliterator } from "./kernel/spliterator";
import { splitRecursive, type LanePartition, type ThreadCount } from "./kernel/split";
import { buildSchedule } from "./kernel/scheduler";
import { sliceFilterOp } from "./ops/filter";
import { sliceMapOp } from "./ops/map";

/** Which short-circuit terminal the parallel run models (Decision 31, the A/B lesson). */
export type ParallelTerminal = "findFirst" | "findAny";

/** A parallel short-circuit run's configuration — lanes, interleaving seed, and terminal. */
export interface ParallelFindConfig {
  readonly threadCount: ThreadCount;
  readonly seed: number;
  readonly terminal: ParallelTerminal;
}

/**
 * A lane recorder for the find runner — the {@link EventSink} the op sinks emit into,
 * tagging every event with the lane and segmenting the stream into beats (one per
 * pull). Identical in shape to the grouping runner's lane recorder, except the
 * opening `lane-demand` carries `op: "find"` (this lane is pulling *for* a find
 * terminal, not a collector). Because the op sinks call only `record`, `filter` and
 * `map` run byte-for-byte as they do sequentially — this recorder just stamps the
 * lane and the beat boundary around their output.
 */
class LaneRecorder implements EventSink {
  private readonly beats: TicklessEvent[][] = [];
  private current: TicklessEvent[] | null = null;

  constructor(private readonly lane: string) {}

  /** Open a new beat with the lane's retrograde `lane-demand` (the pull spike). */
  startBeat(): void {
    this.current = [{ kind: "lane-demand", op: "find", lane: this.lane, nextStage: "source" }];
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

  /** Every recorded beat, in order — the last is either the survivor beat or the trailing pull. */
  allBeats(): readonly (readonly TicklessEvent[])[] {
    return this.beats;
  }
}

/**
 * A lane's short-circuit terminal sink: latch the **first survivor** it is handed and
 * ask the lane's pull loop to stop thereafter. It records **nothing** — the single
 * global `found`/`cancel` events are the runner's business, not a per-lane one — it
 * only latches the candidate (the mapped survivor) and flips its cancellation latch so
 * the lane never pulls past its decisive element (S4.1 AC2).
 */
class LaneFindSink implements TerminalSink<Order | undefined> {
  private latched: Order | undefined = undefined;

  begin(_size: number): void {
    // Nothing to pre-size — a lane find holds at most one element.
  }

  accept(element: Order): void {
    if (this.latched === undefined) this.latched = element;
  }

  end(): void {
    // No finalization — the latched candidate is already the lane's result.
  }

  cancellationRequested(): boolean {
    return this.latched !== undefined;
  }

  result(): Order | undefined {
    return this.latched;
  }
}

/**
 * One lane's short-circuit traversal: its beats plus the survivor it found (if any).
 * `elementBeats` is one contiguous run of events per pulled element; when the lane
 * short-circuited, the last of them is the **survivor beat** and there is no
 * `trailingBeat`. When the lane exhausted with no survivor, `trailingBeat` is the
 * final `lane-demand` powering the empty lane down, and `candidate` is `undefined`.
 */
interface LaneFindRun {
  readonly lane: string;
  readonly elementBeats: readonly (readonly TicklessEvent[])[];
  readonly trailingBeat: readonly TicklessEvent[] | null;
  readonly candidate: Order | undefined;
}

/**
 * Run one lane's partition through `filter → map → find`, short-circuiting at its first
 * survivor. Mirrors the sequential runner's cancellable pull loop — one `lane-demand`
 * per beat, exactly one element resolved before the next, and the loop halts the beat
 * after the {@link LaneFindSink} latches — so the per-lane log is single-file and never
 * pulls past the decisive element (S4.1 AC2), identically to a sequential Slice-B run
 * over just this partition.
 */
function runLaneFind(partition: LanePartition): LaneFindRun {
  const rec = new LaneRecorder(partition.lane);
  const findSink = new LaneFindSink();
  const ops = [sliceFilterOp(), sliceMapOp()];

  // Build the sink chain terminal-first, exactly as runSequential does.
  let head: Sink<Order> = findSink;
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
  } while (more && !head.cancellationRequested());
  head.end();

  const candidate = findSink.result();
  const beats = rec.allBeats();
  if (candidate !== undefined) {
    // Short-circuited: every beat is an element beat (the last one is the survivor);
    // the lane stopped without a trailing power-down pull.
    return { lane: partition.lane, elementBeats: beats, trailingBeat: null, candidate };
  }
  // Exhausted with no survivor: the final beat is the trailing power-down `lane-demand`.
  return {
    lane: partition.lane,
    elementBeats: beats.slice(0, -1),
    trailingBeat: beats[beats.length - 1]!,
    candidate: undefined,
  };
}

/** The winner of the race and the schedule step at which its result is declared. */
interface Decision {
  /** Lane index of the winner, or -1 when no lane found a survivor. */
  readonly winner: number;
  /** Schedule step (inclusive) the interleave plays up to before `found` fires. */
  readonly foundStep: number;
}

/**
 * Decide the winner and the step the result is declared at, from the per-lane
 * candidate/finish steps in the interleaved schedule (a pure simulation of the
 * schedule, recording no events).
 *
 *   - **findFirst:** winner = the leftmost lane holding a survivor. The declaration
 *     waits for the ordered verification: `max(winner's candidate step, the finish
 *     step of every earlier lane)` — every earlier lane must be confirmed empty before
 *     the leftmost match can be trusted as earliest (spec §3.4, Decision 31).
 *   - **findAny:** winner = the lane whose candidate is reached **first** in tick order;
 *     the result is declared the instant it homes.
 */
function decide(
  laneRuns: readonly LaneFindRun[],
  schedule: readonly number[],
  terminal: ParallelTerminal,
): Decision {
  // Simulate the interleave: the step each lane plays its last element beat
  // (`finishStep`) and, for a survivor lane, the step it plays its survivor beat
  // (`candidateStep`). Empty lanes finish before any scheduled step (-1).
  const cursor = laneRuns.map(() => 0);
  const finishStep = laneRuns.map((run) => (run.elementBeats.length === 0 ? -1 : Infinity));
  const candidateStep = laneRuns.map(() => Infinity);
  schedule.forEach((laneIdx, step) => {
    const run = laneRuns[laneIdx]!;
    const isLast = cursor[laneIdx] === run.elementBeats.length - 1;
    cursor[laneIdx]! += 1;
    if (isLast) {
      finishStep[laneIdx] = step;
      if (run.candidate !== undefined) candidateStep[laneIdx] = step;
    }
  });

  const survivorLanes = laneRuns
    .map((run, i) => (run.candidate !== undefined ? i : -1))
    .filter((i) => i >= 0);
  if (survivorLanes.length === 0) {
    // No survivor anywhere: play the whole schedule, declare nothing (result undefined).
    return { winner: -1, foundStep: schedule.length - 1 };
  }

  if (terminal === "findAny") {
    // First lane home in tick order wins immediately.
    const winner = survivorLanes.reduce((best, i) =>
      candidateStep[i]! < candidateStep[best]! ? i : best,
    );
    return { winner, foundStep: candidateStep[winner]! };
  }

  // findFirst: the leftmost survivor lane (survivorLanes is ascending), declared only
  // once it has its candidate AND every earlier lane has finished (verified empty).
  const winner = survivorLanes[0]!;
  let foundStep = candidateStep[winner]!;
  for (let i = 0; i < winner; i += 1) foundStep = Math.max(foundStep, finishStep[i]!);
  return { winner, foundStep };
}

/**
 * Run `orders` in parallel over `threadCount` lanes with interleaving `seed` and the
 * given short-circuit `terminal`, returning the frozen event log and the found result.
 *
 * **Why findFirst is encounter-order-earliest (the load-bearing property, S4.1 AC1):**
 * the split is a contiguous ascending partition, so lane `k` owns source indices
 * `[o_k, o_{k+1})` with `o_0 < o_1 < …`. Let `i*` be the smallest index of any
 * survivor. Every lane left of `i*`'s lane owns only indices `< i*`, none of which
 * survive — so `i*`'s lane is the **leftmost** survivor lane, and `i*` is its first
 * survivor. Hence "leftmost survivor lane's first survivor" == "globally earliest
 * survivor", for every thread count and every seed. The seed only re-orders the
 * interleave (and thus what `findAny` returns), never this result.
 *
 * The shape: a `fork`, empty lanes powered down immediately after it, the interleaved
 * element beats up to the decision step (each exhausted lane powering down as its last
 * element resolves), then one `found` for the winner and one `cancel` per lane made
 * irrelevant — a lane still in flight (interrupted mid-race) or holding a now-discarded
 * candidate. Lanes that exhausted empty are not cancelled: they completed and found
 * nothing.
 */
export function runParallelFind(
  orders: readonly Order[],
  { threadCount, seed, terminal }: ParallelFindConfig,
): { readonly log: readonly EngineEvent[]; readonly result: Order | undefined } {
  const { tree, lanes } = splitRecursive(orders, threadCount);
  const laneRuns = lanes.map(runLaneFind);

  const schedule = buildSchedule(
    laneRuns.map((run) => run.elementBeats.length),
    seed,
  );
  const { winner, foundStep } = decide(laneRuns, schedule, terminal);

  const rec = new EventRecorder();
  rec.record({ kind: "fork", op: "fork", lanes: threadCount, splitTree: tree });

  // Empty lanes have no element beat to ride, so power them down right after the fork.
  lanes.forEach((lane, i) => {
    const trailing = laneRuns[i]!.trailingBeat;
    if (lane.orders.length === 0 && trailing) {
      for (const event of trailing) rec.record(event);
    }
  });

  // Play the interleaved element beats up to (and including) the decision step.
  const cursor = lanes.map(() => 0);
  const played = laneRuns.map(() => 0);
  for (let step = 0; step <= foundStep; step += 1) {
    const laneIdx = schedule[step]!;
    const run = laneRuns[laneIdx]!;
    for (const event of run.elementBeats[cursor[laneIdx]!]!) rec.record(event);
    cursor[laneIdx]! += 1;
    played[laneIdx]! += 1;
    // A non-empty exhausted lane powers down the moment its last element resolves.
    if (cursor[laneIdx] === run.elementBeats.length && run.trailingBeat) {
      for (const event of run.trailingBeat) rec.record(event);
    }
  }

  if (winner < 0) {
    // Nothing survived anywhere — the exhausted stream latches nothing (like sequential).
    return { log: rec.freeze(), result: undefined };
  }

  const winnerRun = laneRuns[winner]!;
  rec.record({ kind: "found", op: "find", elementId: winnerRun.candidate!.id, lane: winnerRun.lane });

  // Cancel every lane made irrelevant: not the winner, and either interrupted with
  // element beats still unplayed or holding a candidate now discarded by the ordered
  // combine. Lanes that exhausted empty are done, not cancelled.
  const reason =
    terminal === "findFirst"
      ? "earlier encounter-order match won"
      : "another lane found a match first";
  laneRuns.forEach((run, i) => {
    if (i === winner) return;
    const interrupted = played[i]! < run.elementBeats.length;
    const discardedCandidate = run.candidate !== undefined;
    if (interrupted || discardedCandidate) {
      rec.record({ kind: "cancel", op: "find", lane: run.lane, reason });
    }
  });

  return { log: rec.freeze(), result: winnerRun.candidate };
}
