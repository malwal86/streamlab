/**
 * S1.3 AC2 — the grouping property: the engine's Slice A bins equal
 * `oracleGroupingBy(oracleMap(oracleFilter(orders)))` for every generated list. The
 * engine reaches its bins through the whole chain — a real pull loop, a filtering
 * sink, a mapping sink, and a stateful accumulating terminal — while the oracle
 * composes three bare array reductions. Their agreeing is Slice A's headless
 * correctness proof (AC2), and AC3 (the terminal drives the pull) rides along via
 * the single-file invariant the runner guarantees.
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { type Order, type Region } from "../domain/order";
import { runSequential } from "../kernel/runner";
import { isSingleFilePull } from "../testing/logInvariants";
import { arbOrderList, DEFAULT_SEED } from "../testing/arbitraries";
import { assertEqualsOracle, oracleFilter, oracleGroupingBy, oracleMap } from "../testing/oracle";
import { sliceASequentialPipeline } from "../pipelines";

function engineGrouping(orders: readonly Order[]): {
  bins: Map<Region, Order[]>;
  singleFile: boolean;
} {
  const { log, result } = runSequential(sliceASequentialPipeline(orders));
  return { bins: result, singleFile: isSingleFilePull(log) };
}

describe("S1.3 groupingBy — engine bins equal the oracle", () => {
  it("matches oracleGroupingBy(oracleMap(oracleFilter)) for every generated list (AC2)", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const expected = oracleGroupingBy(oracleMap(oracleFilter(orders)));
        assertEqualsOracle(engineGrouping(orders).bins, expected, "groupingBy");
      }),
      { seed: DEFAULT_SEED },
    );
  });

  it("the terminal drives the pull — every run is single-file (AC3)", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        expect(engineGrouping(orders).singleFile).toBe(true);
      }),
      { seed: DEFAULT_SEED },
    );
  });
});
