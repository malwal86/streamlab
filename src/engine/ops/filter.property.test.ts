/**
 * S1.1 AC3 — the load-bearing filter property: for *any* generated order list, the
 * engine's surviving set equals the oracle's `filter(total > 100)`. The engine gets
 * to survival through a stateful, event-emitting sink and a real pull loop; the
 * oracle through a bare `array.filter`. Their agreeing on every generated case —
 * especially the boundary-hugging totals `arbOrderList` favors — is what pins "the
 * predicate is enforced correctly", independent of *how* the log was produced.
 */
import fc from "fast-check";
import { describe, it } from "vitest";
import { type Order } from "../domain/order";
import { arraySpliterator } from "../kernel/spliterator";
import { identityTerminal, runSequential } from "../kernel/runner";
import { arbOrderList, DEFAULT_SEED } from "../testing/arbitraries";
import { assertEqualsOracle, oracleFilter } from "../testing/oracle";
import { sliceFilterOp } from "./filter";

/** Run `orders` through `source → filter → identity`; the collected result is the survivors. */
function engineSurvivors(orders: readonly Order[]): readonly Order[] {
  const { result } = runSequential({
    source: arraySpliterator(orders),
    ops: [sliceFilterOp()],
    terminal: identityTerminal(),
  });
  return result;
}

describe("S1.1 filter — engine survivors equal the oracle", () => {
  it("matches oracleFilter for every generated order list", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        assertEqualsOracle([...engineSurvivors(orders)], oracleFilter(orders), "filter");
      }),
      { seed: DEFAULT_SEED },
    );
  });
});
