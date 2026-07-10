/**
 * S1.2 AC2 — the map property: running `filter → map` over any generated list
 * yields exactly `oracle.map(applyDiscount)` applied to the survivors, in encounter
 * order. The engine reaches the mapped values through a transform sink emitting
 * `transform` events; the oracle re-inlines the discount math independently. Their
 * agreeing pins that `map` transforms correctly and preserves order — the log's
 * shape aside.
 */
import fc from "fast-check";
import { describe, it } from "vitest";
import { type Order } from "../domain/order";
import { arraySpliterator } from "../kernel/spliterator";
import { identityTerminal, runSequential } from "../kernel/runner";
import { arbOrderList, DEFAULT_SEED } from "../testing/arbitraries";
import { assertEqualsOracle, oracleFilter, oracleMap } from "../testing/oracle";
import { sliceFilterOp } from "./filter";
import { sliceMapOp } from "./map";

/** Run `orders` through `source → filter → map → identity`; the result is the mapped survivors. */
function engineMapped(orders: readonly Order[]): readonly Order[] {
  const { result } = runSequential({
    source: arraySpliterator(orders),
    ops: [sliceFilterOp(), sliceMapOp()],
    terminal: identityTerminal(),
  });
  return result;
}

describe("S1.2 map — mapped survivors equal the oracle", () => {
  it("matches oracleMap(oracleFilter) for every generated order list", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        assertEqualsOracle([...engineMapped(orders)], oracleMap(oracleFilter(orders)), "map");
      }),
      { seed: DEFAULT_SEED },
    );
  });
});
