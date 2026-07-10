/**
 * S3.5 — the private partial bins stay per-lane until the `combine` beat (AC1), the
 * merge is anchored to `combine` and the merged towers equal the engine result ==
 * oracle (AC2), and reduced motion still represents the merge (AC3). All asserted
 * from the pure `parallelBins` projection.
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { ORDERS } from "@/engine/domain/fixture";
import { runParallel } from "@/engine/parallel";
import { arbOrderList, DEFAULT_SEED } from "@/engine/testing/arbitraries";
import { oracleFilter, oracleGroupingBy, oracleMap } from "@/engine/testing/oracle";
import { type Region } from "@/engine/domain/order";
import { type ThreadCount } from "@/engine/kernel/split";
import { parallelBins, forkLayout } from "./parallel";

const LOG_2 = runParallel(ORDERS, { threadCount: 2, seed: 1 }).log;
const COMBINE_2 = LOG_2.findIndex((e) => e.kind === "combine");

function oracleCounts(orders: readonly typeof ORDERS[number][]): Map<Region, number> {
  const bins = oracleGroupingBy(oracleMap(oracleFilter(orders)));
  return new Map([...bins].map(([region, members]) => [region, members.length]));
}

describe("S3.5 partial bins are private per lane until combine (AC1)", () => {
  it("merged is null before the combine beat; per-lane partials are non-empty", () => {
    const before = parallelBins(LOG_2, COMBINE_2 - 0.001);
    expect(before.merged).toBeNull(); // nothing merged yet — still private
    const laned = before.perLane.filter((b) => b.count > 0);
    expect(laned.length).toBeGreaterThan(0);
  });

  it("each lane's partials sum only its own survivors — no cross-lane leak", () => {
    // Just before combine, every accumulate has landed; per-lane totals must partition
    // the survivors (their sum equals the oracle total per region).
    const bins = parallelBins(LOG_2, COMBINE_2 - 0.001).perLane;
    const perRegion = new Map<Region, number>();
    for (const b of bins) perRegion.set(b.region, (perRegion.get(b.region) ?? 0) + Math.round(b.count));
    for (const [region, total] of oracleCounts(ORDERS)) {
      expect(perRegion.get(region)).toBe(total);
    }
  });
});

describe("S3.5 merge anchored to combine; merged == oracle (AC2)", () => {
  it("merged appears exactly at the combine beat and tweens 0→1", () => {
    expect(parallelBins(LOG_2, COMBINE_2 - 0.001).merged).toBeNull();
    const atCombine = parallelBins(LOG_2, COMBINE_2);
    expect(atCombine.merged).not.toBeNull();
    expect(atCombine.mergeProgress).toBeGreaterThanOrEqual(0);
  });

  it.each([
    [2 as ThreadCount],
    [4 as ThreadCount],
  ])("final merged towers equal the oracle (%i lanes)", (threadCount) => {
    const log = runParallel(ORDERS, { threadCount, seed: 1 }).log;
    const merged = parallelBins(log, log.length - 1).merged!;
    const counts = new Map(merged.map((b) => [b.region, Math.round(b.count)]));
    for (const [region, total] of oracleCounts(ORDERS)) {
      expect(counts.get(region)).toBe(total);
    }
  });

  it("holds for every generated Slice A parallel run (property)", () => {
    fc.assert(
      fc.property(arbOrderList(), fc.integer(), (orders, seed) => {
        fc.pre(orders.length > 0);
        const { log } = runParallel(orders, { threadCount: 4, seed });
        const merged = parallelBins(log, log.length - 1).merged!;
        const counts = new Map(merged.map((b) => [b.region, Math.round(b.count)]));
        for (const [region, total] of oracleCounts(orders)) {
          expect(counts.get(region) ?? 0).toBe(total);
        }
      }),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S3.5 reduced motion still represents the merge (AC3)", () => {
  it("snaps mergeProgress to 1 at the combine beat", () => {
    const snapped = parallelBins(LOG_2, COMBINE_2, { reducedMotion: true });
    expect(snapped.merged).not.toBeNull();
    expect(snapped.mergeProgress).toBe(1);
  });

  it("empty for a sequential log (no fork)", () => {
    expect(forkLayout([]).length).toBe(0);
    expect(parallelBins([], 0).merged).toBeNull();
  });
});
