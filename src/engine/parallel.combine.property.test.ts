/**
 * S3.3 AC2 — the **load-bearing property**: the combiner-merged parallel bins equal
 * the sequential bins **and** the oracle, for every generated list, **both** thread
 * counts, and **any** seed. This is the whole reason parallel `groupingBy` is correct
 * — the interleaving varies the log, but never the result. If this holds, the
 * multithread demo is faithful; if it ever breaks, parallel grouping is a lie.
 */
import fc from "fast-check";
import { describe, it } from "vitest";
import { runParallel } from "./parallel";
import { runSequential } from "./kernel/runner";
import { sliceASequentialPipeline } from "./pipelines";
import { arbOrderList, DEFAULT_SEED } from "./testing/arbitraries";
import { assertEqualsOracle, oracleFilter, oracleGroupingBy, oracleMap } from "./testing/oracle";
import { type ThreadCount } from "./kernel/split";

const THREAD_COUNTS: readonly ThreadCount[] = [2, 4];

describe("S3.3 merged bins == sequential == oracle for all seeds & threads (AC2)", () => {
  it.each(THREAD_COUNTS)("holds for every generated list and seed (%i lanes)", (threadCount) => {
    fc.assert(
      fc.property(arbOrderList(), fc.integer(), (orders, seed) => {
        const parallel = runParallel(orders, { threadCount, seed }).result;
        const sequential = runSequential(sliceASequentialPipeline(orders)).result;
        const oracle = oracleGroupingBy(oracleMap(oracleFilter(orders)));

        assertEqualsOracle(parallel, sequential, "parallel == sequential");
        assertEqualsOracle(parallel, oracle, "parallel == oracle");
      }),
      { seed: DEFAULT_SEED },
    );
  });
});
