/**
 * S2.1 properties — the load-bearing correctness claims for the short-circuit
 * terminal, over every generated order list:
 *
 *   - **AC1 (result == oracle).** The engine's `findFirst`/`findAny` result equals
 *     the mapped encounter-order-first survivor (or `undefined` when none survive).
 *   - **AC2 (no pull past the decisive element).** No `demand`/`emit` follows the
 *     `found` event — asserted purely on the log via `pullsAfterFound`.
 *   - **AC3 (un-pulled remainder).** When the run short-circuits,
 *     `shortcircuit.remainingUnpulled == sourceSize − emitCount`; and the run is
 *     always single-file (the terminal drives one pull per beat).
 *
 * The engine reaches its answer through the whole chain — a real pull loop, a
 * filtering sink, a mapping sink, and the cancellable short-circuit terminal —
 * while the oracle is three bare array reductions. Their agreeing is Slice B's
 * headless correctness proof.
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { type Order } from "../domain/order";
import { runSequential } from "../kernel/runner";
import { sliceBSequentialPipeline } from "../pipelines";
import { arbOrderList, DEFAULT_SEED } from "../testing/arbitraries";
import { isSingleFilePull, pullsAfterFound } from "../testing/logInvariants";
import { assertEqualsOracle, oracleFilter, oracleMap } from "../testing/oracle";

/** The mapped first survivor — the outcome `findFirst`/`findAny` must return. */
function oracleMappedFirst(orders: readonly Order[]): Order | undefined {
  const first = oracleFilter(orders)[0];
  return first ? oracleMap([first])[0] : undefined;
}

describe("S2.1 find — result equals the oracle (AC1)", () => {
  it("returns the mapped encounter-order-first survivor for every generated list", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const { result } = runSequential(sliceBSequentialPipeline(orders));
        assertEqualsOracle(result, oracleMappedFirst(orders), "findFirst");
      }),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S2.1 find — never pulls past the decisive element (AC2)", () => {
  it("no demand/emit follows `found`, and the run is single-file (AC3)", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const { log } = runSequential(sliceBSequentialPipeline(orders));
        expect(pullsAfterFound(log)).toEqual([]);
        expect(isSingleFilePull(log)).toBe(true);
      }),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S2.1 find — un-pulled remainder (AC3)", () => {
  it("remainingUnpulled == sourceSize − pulled when short-circuited; absent otherwise", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const { log } = runSequential(sliceBSequentialPipeline(orders));
        const emits = log.filter((e) => e.kind === "emit").length;
        const sc = log.find((e) => e.kind === "shortcircuit");
        const survives = oracleFilter(orders).length > 0;

        if (survives) {
          // Short-circuited: exactly one found + one shortcircuit, and the
          // remainder is the pulls the source was never asked for.
          expect(log.filter((e) => e.kind === "found")).toHaveLength(1);
          expect(sc?.kind === "shortcircuit" && sc.remainingUnpulled).toBe(orders.length - emits);
          expect(sc?.kind === "shortcircuit" && sc.remainingUnpulled).toBeGreaterThanOrEqual(0);
        } else {
          // No survivor ⇒ no short-circuit; the stream exhausted, pulling everything.
          expect(sc).toBeUndefined();
          expect(log.find((e) => e.kind === "found")).toBeUndefined();
          expect(emits).toBe(orders.length);
        }
      }),
      { seed: DEFAULT_SEED },
    );
  });
});
