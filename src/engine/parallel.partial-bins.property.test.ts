/**
 * S3.2 AC2 (property) — for every generated list, both lane counts, and any seed, no
 * element accumulates into more than one lane's bins, and the lane it accumulates in
 * is exactly the lane that pulled it. Per-lane partial bins are therefore a true
 * partition of the survivors — the invariant the combiner (S3.3) merges without
 * double-counting.
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { runParallel } from "./parallel";
import { arbOrderList, DEFAULT_SEED } from "./testing/arbitraries";
import { oracleFilter } from "./testing/oracle";
import { type ThreadCount } from "./kernel/split";

const THREAD_COUNTS: readonly ThreadCount[] = [2, 4];

describe("S3.2 per-lane bins are disjoint until merge (AC2)", () => {
  it.each(THREAD_COUNTS)("no cross-lane contamination for any list/seed (%i lanes)", (threadCount) => {
    fc.assert(
      fc.property(arbOrderList(), fc.integer(), (orders, seed) => {
        // This property tracks elements by id, so only meaningful for distinct ids
        // (the real fixture guarantees them; the generator may repeat).
        fc.pre(new Set(orders.map((o) => o.id)).size === orders.length);
        const { log } = runParallel(orders, { threadCount, seed });

        const emitLane = new Map<number, string>();
        for (const e of log) if (e.kind === "emit") emitLane.set(e.elementId, e.lane!);

        const accLanes = new Map<number, Set<string>>();
        for (const e of log) {
          if (e.kind !== "accumulate") continue;
          const set = accLanes.get(e.elementId!) ?? new Set<string>();
          set.add(e.lane!);
          accLanes.set(e.elementId!, set);
        }

        for (const [elementId, lanes] of accLanes) {
          expect(lanes.size).toBe(1);
          expect([...lanes][0]).toBe(emitLane.get(elementId));
        }
        // Every survivor accumulated exactly once (total == oracle survivors count).
        const accumulateCount = log.filter((e) => e.kind === "accumulate").length;
        expect(accumulateCount).toBe(oracleFilter(orders).length);
      }),
      { seed: DEFAULT_SEED },
    );
  });
});
