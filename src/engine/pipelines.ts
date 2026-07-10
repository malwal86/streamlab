/**
 * Pipeline assembly (S1.3) — where the ops and a terminal are composed into a
 * runnable {@link Pipeline}. This is the one module that spans `filter` + `map` +
 * the grouping terminal, so it belongs neither to any single op nor to the runner
 * (which stays op-agnostic). `run.ts` (the store's re-run seam) and the golden /
 * property tests both build their pipelines from here, so the *shape* of Slice A is
 * defined once.
 *
 * Slice A sequential (S1.3 = M1 engine) and Slice B sequential (S2.1 = M2 engine)
 * both live here now; the parallel scheduler (E3) adds sibling builders, and
 * nothing above this line changes when it does.
 *
 * Zero React/Next imports (kernel boundary — see `./README.md`).
 */
import { type Order, type Region } from "./domain/order";
import { arraySpliterator } from "./kernel/spliterator";
import { type Pipeline } from "./kernel/runner";
import { sliceFilterOp } from "./ops/filter";
import { sliceMapOp } from "./ops/map";
import { groupingByRegionTerminal } from "./ops/collect";
import { findTerminal } from "./ops/find";

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

/**
 * The canonical **Slice B sequential** pipeline:
 * `orders.stream().filter(o -> o.total > 100).map(Order::applyDiscount).findFirst()`
 * (identical to `.findAny()` sequentially — spec §3.2). Same `filter → map` chain
 * as Slice A, but the terminal short-circuits: it latches the first survivor,
 * stops the pull, and reports the un-pulled remainder. The terminal is handed
 * `orders.length` so it can compute `shortcircuit.remainingUnpulled` (S2.1 AC3).
 *
 * `findFirst` and `findAny` build the *same* sequential pipeline — the distinction
 * is a Config one that only bites under parallelism (E4) — so this builder takes
 * no terminal argument. That the two produce byte-identical logs is exactly the
 * "identical when sequential" property the goldens pin.
 */
export function sliceBSequentialPipeline(orders: readonly Order[]): Pipeline<Order | undefined> {
  return {
    source: arraySpliterator(orders),
    ops: [sliceFilterOp(), sliceMapOp()],
    terminal: findTerminal(orders.length),
  };
}
