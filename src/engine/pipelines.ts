/**
 * Pipeline assembly (S1.3) — where the ops and a terminal are composed into a
 * runnable {@link Pipeline}. This is the one module that spans `filter` + `map` +
 * the grouping terminal, so it belongs neither to any single op nor to the runner
 * (which stays op-agnostic). `run.ts` (the store's re-run seam) and the golden /
 * property tests both build their pipelines from here, so the *shape* of Slice A is
 * defined once.
 *
 * Only Slice A sequential exists today (S1.3 = M1 engine). Slice B's `find*`
 * terminal (E2) and the parallel scheduler (E3) add sibling builders here; nothing
 * above this line changes when they do.
 *
 * Zero React/Next imports (kernel boundary — see `./README.md`).
 */
import { type Order, type Region } from "./domain/order";
import { arraySpliterator } from "./kernel/spliterator";
import { type Pipeline } from "./kernel/runner";
import { sliceFilterOp } from "./ops/filter";
import { sliceMapOp } from "./ops/map";
import { groupingByRegionTerminal } from "./ops/collect";

/**
 * The canonical **Slice A sequential** pipeline:
 * `orders.stream().filter(o -> o.total > 100).map(Order::applyDiscount).collect(groupingBy(Order::region))`.
 * An array source, the Slice `filter` then `map` ops, and the grouping terminal —
 * driven to a `route`/`accumulate` log whose bins equal the oracle grouping (S1.3).
 */
export function sliceASequentialPipeline(orders: readonly Order[]): Pipeline<Map<Region, Order[]>> {
  return {
    source: arraySpliterator(orders),
    ops: [sliceFilterOp(), sliceMapOp()],
    terminal: groupingByRegionTerminal(),
  };
}
