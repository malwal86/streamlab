/**
 * The `map` op (S1.2, spec §3.3 / R2) — a stateless value-transform sink. For each
 * survivor it applies `Order::applyDiscount`, emits a `transform { before, after }`
 * recording the totals either side of the discount, and forwards the *new* order
 * downstream. The viz renders `transform` as the pulse's size morph — the shrink
 * that makes `map` read as a value change distinct from the filter threshold and
 * the groupBy routing (spec §3.3).
 *
 * Three properties the sink preserves, all JDK-faithful:
 *
 *   - **Order.** One `transform` per element, in encounter order; `map` reorders
 *     nothing. The mapped sequence equals `oracle.map(applyDiscount)` over the
 *     survivors (S1.2 AC2).
 *   - **SIZED is preserved.** Unlike `filter`, `map` is 1-to-1 — every element in
 *     produces exactly one out — so the downstream count is still whatever `begin`
 *     was handed. It therefore inherits {@link ChainedSink}'s default `begin`
 *     (forward `size` unchanged), rather than clearing it.
 *   - **Purity.** `applyDiscount` returns a new frozen order; the input is never
 *     mutated, so an upstream `emit`/`survive` that already named the pre-discount
 *     value stays true.
 *
 * `map` is neither `STATEFUL` nor `SHORT_CIRCUIT`, so it contributes
 * {@link NO_FLAGS}. Kept a general `mapOp(transform)` factory with the Slice's
 * `applyDiscount` bound in `sliceMapOp`.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */
import { applyDiscount, type Order } from "../domain/order";
import { NO_FLAGS } from "../kernel/flags";
import { type EventSink } from "../kernel/recorder";
import { ChainedSink, type Sink } from "../kernel/sink";
import { type StreamOp } from "../kernel/runner";

/** The op name carried on every `transform` event's `op` field and in the pipeline. */
const OP_NAME = "map";

/**
 * The mapping sink: transform each element, record the before/after totals, forward
 * the result. Extends {@link ChainedSink} so lifecycle and cancellation propagation
 * (and the size-preserving default `begin`) are inherited; only `accept` is
 * overridden.
 */
class MapSink extends ChainedSink<Order, Order> {
  constructor(
    downstream: Sink<Order>,
    private readonly rec: EventSink,
    private readonly transform: (order: Order) => Order,
  ) {
    super(downstream);
  }

  override accept(element: Order): void {
    const mapped = this.transform(element);
    // `before`/`after` are the totals the size-morph keyframes off (spec §3.3).
    this.rec.record({
      kind: "transform",
      op: OP_NAME,
      elementId: element.id,
      before: element.total,
      after: mapped.total,
      nextStage: "collect",
    });
    this.downstream.accept(mapped);
  }
}

/**
 * Build a `map` op from an `Order → Order` `transform`. Recorded as a `transform`
 * event carrying the total either side of the change — so the transform must be one
 * the `before`/`after` totals meaningfully describe (the Slice's `applyDiscount` is).
 */
export function mapOp(transform: (order: Order) => Order): StreamOp {
  return {
    name: OP_NAME,
    flags: NO_FLAGS,
    wrap: (downstream, rec) => new MapSink(downstream, rec, transform),
  };
}

/**
 * The Slice pipeline's concrete map: `Order::applyDiscount` (10% off, JDK `int`
 * truncation). Every Slice A/B run maps survivors through this before the terminal.
 */
export function sliceMapOp(): StreamOp {
  return mapOp(applyDiscount);
}
