/**
 * The `collect(groupingBy(Order::region))` terminal (S1.3, spec §3.2 / R2) — the
 * end of Slice A's chain and the thing the runner pulls *for*. It completes Slice A
 * headless: the collector *is* the demand driver (its `accept` is what every
 * upstream `demand → emit → test → survive → transform` beat resolves into), so the
 * terminal pull precedes every emit by construction (S1.3 AC3, a property of the
 * runner's loop the collector inherits).
 *
 * Per element it does two things the viz renders as one motion — a pulse flying to
 * its bin and the bin growing:
 *
 *   - `route { key }` — the classifier (`Order::region`) picks the destination bin.
 *   - `accumulate { key, binCount }` — the element lands and the bin's new height
 *     is recorded. `binCount` is the size *after* this element, so the viz can grow
 *     the bin to exactly the engine's count (S1.9 reads it; S1.3 AC1 emits it).
 *
 * The result is a `Map<Region, Order[]>` in first-seen key order — what a sequential
 * `groupingBy` produces, and what `oracleGroupingBy` is checked against (AC2). The
 * bins hold the *mapped* (post-discount) orders, because grouping runs after `map`.
 *
 * `groupingBy` is `STATEFUL` — it accumulates across elements — so it flags itself
 * as such. That is inert for the sequential runner (which is one-pass regardless)
 * but load-bearing for the parallel scheduler (S3.1), which must not naively split a
 * stateful barrier; the private-partial-bins + combiner design (S3.2/S3.3) is how
 * parallel grouping is made correct. Not `SHORT_CIRCUIT`: grouping consumes the
 * whole stream.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */
import { type Order, type Region } from "../domain/order";
import { OpFlag } from "../kernel/flags";
import { type EventRecorder } from "../kernel/recorder";
import { type Terminal, type TerminalSink } from "../kernel/runner";

/** The terminal name carried on every `demand`/`route`/`accumulate` `op` field. */
const OP_NAME = "collect";

/**
 * The grouping sink: classify each element by region, route it, accumulate it into
 * that region's private bin, and record the bin's new count. Holds the bins as
 * mutable state (it is the `STATEFUL` op); `result()` hands back the finished map
 * after `end()`.
 */
class GroupingByRegionSink implements TerminalSink<Map<Region, Order[]>> {
  private readonly bins = new Map<Region, Order[]>();

  constructor(private readonly rec: EventRecorder) {}

  begin(_size: number): void {
    // A `Map` grows as keys appear; nothing to pre-size. (A `filter` upstream has
    // cleared SIZED anyway, so `_size` is SIZE_UNKNOWN here — see filter.ts.)
  }

  accept(element: Order): void {
    const key = element.region;
    // Classifier picks the bin — the pulse's flight destination (spec §3.2 step 5).
    this.rec.record({ kind: "route", op: OP_NAME, elementId: element.id, key });
    // Accumulate into the region's bin, then report the new height.
    let bin = this.bins.get(key);
    if (!bin) {
      bin = [];
      this.bins.set(key, bin);
    }
    bin.push(element);
    this.rec.record({ kind: "accumulate", op: OP_NAME, elementId: element.id, key, binCount: bin.length });
  }

  end(): void {
    // Bins are complete as accumulated; sequential grouping needs no finalize step
    // (the parallel combiner that merges partial bins is S3.3, a different sink).
  }

  cancellationRequested(): boolean {
    return false; // grouping consumes the whole stream — never short-circuits.
  }

  result(): Map<Region, Order[]> {
    return this.bins;
  }
}

/**
 * The `collect(groupingBy(Order::region))` terminal factory — one fresh grouping
 * sink per run. `STATEFUL` (accumulates), never `SHORT_CIRCUIT`. This is Slice A's
 * terminal; Slice B swaps it for the short-circuit `find*` terminal (S2.1).
 */
export function groupingByRegionTerminal(): Terminal<Map<Region, Order[]>> {
  return {
    name: OP_NAME,
    flags: OpFlag.STATEFUL,
    makeSink: (rec) => new GroupingByRegionSink(rec),
  };
}
