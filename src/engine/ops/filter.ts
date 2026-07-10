/**
 * The `filter` op (S1.1, spec §3.6 / R2) — the first real {@link StreamOp}, and the
 * stage where an element *dies*. A stateless predicate sink: for every element it
 * emits a `test` (the threshold readout the viz shows, `1200 > 100`), then either a
 * `survive` (forward downstream) or a `die` (drop it — and, per spec §3.6, drop it
 * *here at the filter*, never later). The three events are the whole engine→viz
 * story of a predicate; the pulse's fate is a pure function of `test.output`.
 *
 * Two JDK-faithful details the sink encodes:
 *
 *   - **Death is terminal for that element.** A rejected element produces no
 *     downstream callback at all — `accept` simply returns without forwarding — so
 *     there is provably no `transform`/`route`/`accumulate` for it (S1.1 AC2). The
 *     runner's single-file loop still comes back for the next `demand`; the filter
 *     just contributed nothing between them.
 *   - **`filter` clears SIZED.** The predicate can reject any number of elements, so
 *     the count the source knew up front is no longer exact downstream. The sink
 *     overrides `begin` to pass {@link SIZE_UNKNOWN}, exactly as `java.util.stream`
 *     clears `SIZED` across a filter — a `map` downstream preserves size, a
 *     collecting terminal must not pre-size its bins from a stale count.
 *
 * `filter` is neither `STATEFUL` (it holds nothing between elements) nor
 * `SHORT_CIRCUIT` (it never ends traversal early), so it contributes
 * {@link NO_FLAGS} to the pipeline and the runner keeps its plain run-to-exhaustion
 * loop. Kept a general predicate factory (`filterOp`) with the Slice's threshold
 * bound in `sliceFilterOp` — the op is reusable, the scenario is one place.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */
import { orderSnapshot } from "../domain/event";
import { FILTER_THRESHOLD } from "../domain/fixture";
import { type Order } from "../domain/order";
import { NO_FLAGS } from "../kernel/flags";
import { type EventSink } from "../kernel/recorder";
import { ChainedSink, type Sink } from "../kernel/sink";
import { SIZE_UNKNOWN } from "../kernel/spliterator";
import { type StreamOp } from "../kernel/runner";

/** The op name carried on every `filter` event's `op` field and in the pipeline. */
const OP_NAME = "filter";

/**
 * The filtering sink: evaluate `test` on each element, record the predicate
 * readout, then survive-and-forward or die-and-drop. Extends {@link ChainedSink}
 * so lifecycle (`end`) and cancellation propagation are inherited; it overrides
 * `begin` (to clear SIZED) and `accept` (its actual behavior).
 */
class FilterSink extends ChainedSink<Order, Order> {
  constructor(
    downstream: Sink<Order>,
    private readonly rec: EventSink,
    private readonly predicate: string,
    private readonly test: (order: Order) => boolean,
  ) {
    super(downstream);
  }

  /** Clear SIZED: a filter cannot promise the downstream count the source knew. */
  override begin(_size: number): void {
    this.downstream.begin(SIZE_UNKNOWN);
  }

  override accept(element: Order): void {
    const output = this.test(element);
    // The threshold readout the viz renders at the neuron (`1200 > 100 → true`).
    this.rec.record({
      kind: "test",
      op: OP_NAME,
      elementId: element.id,
      predicate: this.predicate,
      input: orderSnapshot(element),
      output,
    });
    if (output) {
      // Survivor: mark it and push it on down the chain (map/collect/find follow).
      this.rec.record({ kind: "survive", op: OP_NAME, elementId: element.id, nextStage: "map" });
      this.downstream.accept(element);
    } else {
      // Reject: emit `die` and forward *nothing* — death is at the filter (AC2).
      this.rec.record({ kind: "die", op: OP_NAME, elementId: element.id });
    }
  }
}

/**
 * Build a `filter` op from a human-readable `predicate` source (what the `test`
 * event carries, e.g. `"o.total > 100"`) and the boolean `test` that enforces it.
 * The two must agree — `predicate` is the label the viz shows, `test` is the truth
 * — but keeping them as separate arguments lets the op stay a general predicate
 * filter rather than hard-coding the Slice's threshold.
 */
export function filterOp(predicate: string, test: (order: Order) => boolean): StreamOp {
  return {
    name: OP_NAME,
    flags: NO_FLAGS,
    wrap: (downstream, rec) => new FilterSink(downstream, rec, predicate, test),
  };
}

/**
 * The Slice pipeline's concrete filter: `o.total > 100` ({@link FILTER_THRESHOLD}).
 * The predicate string is written to read like the Java source the spec's example
 * shows, so goldens read like the spec. Every Slice A/B run uses this op.
 */
export function sliceFilterOp(): StreamOp {
  return filterOp(`o.total > ${FILTER_THRESHOLD}`, (order) => order.total > FILTER_THRESHOLD);
}
