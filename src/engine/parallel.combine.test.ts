/**
 * S3.3 — the combiner merges the private partial bins and emits a closing `combine`
 * carrying the merged bin state (AC1). Asserted on the fixture; the property test
 * pins the load-bearing equivalence (merged == sequential == oracle) across seeds and
 * thread counts.
 */
import { describe, it, expect } from "vitest";
import { ORDERS } from "./domain/fixture";
import { runParallel } from "./parallel";
import { runSequential } from "./kernel/runner";
import { sliceASequentialPipeline } from "./pipelines";
import { assertEqualsOracle } from "./testing/oracle";
import { type ThreadCount } from "./kernel/split";

const THREAD_COUNTS: readonly ThreadCount[] = [2, 4];

describe("S3.3 combine event carries the merged bins (AC1)", () => {
  it.each(THREAD_COUNTS)("closes the log with one combine of the final bins (%i lanes)", (threadCount) => {
    const { log } = runParallel(ORDERS, { threadCount, seed: 1 });
    const combines = log.filter((e) => e.kind === "combine");
    expect(combines).toHaveLength(1);

    const combine = log[log.length - 1]!; // the combine is the run's last beat
    expect(combine.kind).toBe("combine");
    if (combine.kind !== "combine") return;
    const counts = new Map(combine.merged.map((b) => [b.key, b.count]));
    expect(counts.get("West")).toBe(3);
    expect(counts.get("East")).toBe(2);
    expect(counts.get("North")).toBe(2);
  });
});

describe("S3.3 merged bins == sequential (AC2, fixture)", () => {
  it.each(THREAD_COUNTS)("the combiner result equals the sequential grouping (%i lanes)", (threadCount) => {
    const parallel = runParallel(ORDERS, { threadCount, seed: 1 }).result;
    const sequential = runSequential(sliceASequentialPipeline(ORDERS)).result;
    assertEqualsOracle(parallel, sequential, "combiner merge");
  });
});
