/**
 * S4.1 — the **load-bearing** parallel `findFirst` properties, over every generated
 * order list, both lane counts, and any seed (spec §10 — the single most error-prone
 * item):
 *
 *   - **AC1 (the pin).** `findFirst` returns the **encounter-order-earliest** survivor
 *     (== the mapped first survivor of the oracle), *regardless of thread count and
 *     seed*. This is the property that provably distinguishes `findFirst` from
 *     `findAny`: a later lane finishing first must never win.
 *   - **AC2 (no pull past the decisive element, per lane).** Within each lane the
 *     emitted ids are a prefix of that lane's partition and never extend past the
 *     lane's first survivor — asserted purely on the log's per-lane `emit`s.
 *   - **Short-circuit shape.** After `found`, only `cancel` events follow (nothing is
 *     pulled past the decision); every lane stays single-file; and the cancelled lanes
 *     all sit to the **right** of the winner (the ones the ordered wait outran).
 *
 * The engine reaches its answer through the whole forked chain — a recursive-halving
 * split, per-lane `filter → map → find`, a seeded interleave, and the ordered combine
 * — while the oracle is a bare "first survivor in encounter order". Their agreeing,
 * for all seeds, is Slice B parallel's headless correctness proof.
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { type Order } from "./domain/order";
import { runParallelFind } from "./parallelFind";
import { splitRecursive, type ThreadCount } from "./kernel/split";
import { arbOrderList, DEFAULT_SEED } from "./testing/arbitraries";
import { isPerLaneSingleFile } from "./testing/logInvariants";
import { assertEqualsOracle, oracleFilter, oracleMap } from "./testing/oracle";

const THREAD_COUNTS: readonly ThreadCount[] = [2, 4];

/** The mapped first survivor — the outcome parallel `findFirst` must return. */
function oracleMappedFirst(orders: readonly Order[]): Order | undefined {
  const first = oracleFilter(orders)[0];
  return first ? oracleMap([first])[0] : undefined;
}

/** Numeric lane index from a lane id (`"L3"` → 3). */
function laneIndex(lane: string): number {
  return Number(lane.slice(1));
}

describe("S4.1 parallel findFirst — encounter-order-earliest, all threads/seeds (AC1)", () => {
  it("returns the mapped first survivor for every list, lane count, and seed", () => {
    fc.assert(
      fc.property(arbOrderList(), fc.constantFrom(...THREAD_COUNTS), fc.integer(), (orders, threadCount, seed) => {
        const { log, result } = runParallelFind(orders, { threadCount, seed, terminal: "findFirst" });
        const expected = oracleMappedFirst(orders);
        assertEqualsOracle(result, expected, "parallel findFirst");
        const found = log.find((e) => e.kind === "found");
        if (expected) {
          expect(found?.kind === "found" && found.elementId).toBe(expected.id);
        } else {
          expect(found).toBeUndefined();
        }
      }),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S4.1 parallel findFirst — no lane pulls past its decisive element (AC2)", () => {
  it("each lane's emits are a prefix of its partition, stopping at its first survivor", () => {
    fc.assert(
      fc.property(arbOrderList(), fc.constantFrom(...THREAD_COUNTS), fc.integer(), (orders, threadCount, seed) => {
        const { log } = runParallelFind(orders, { threadCount, seed, terminal: "findFirst" });
        const { lanes } = splitRecursive(orders, threadCount);

        const emitsByLane = new Map<string, number[]>();
        for (const event of log) {
          if (event.kind === "emit" && event.lane !== undefined) {
            const ids = emitsByLane.get(event.lane) ?? [];
            ids.push(event.elementId);
            emitsByLane.set(event.lane, ids);
          }
        }

        for (const partition of lanes) {
          const partIds = partition.orders.map((o) => o.id);
          const emitted = emitsByLane.get(partition.lane) ?? [];
          // The lane pulled a *prefix* of its partition — no reordering, no skipping.
          expect(emitted).toEqual(partIds.slice(0, emitted.length));
          // …and never past its decisive element (first survivor, or exhaustion).
          const firstSurvivorIdx = partition.orders.findIndex((o) => o.total > 100);
          const decisiveLen = firstSurvivorIdx >= 0 ? firstSurvivorIdx + 1 : partition.orders.length;
          expect(emitted.length).toBeLessThanOrEqual(decisiveLen);
        }
      }),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S4.1 parallel findFirst — short-circuit shape (AC3 / single-file)", () => {
  it("after `found` only `cancel` follows; lanes stay single-file; cancels sit right of the winner", () => {
    fc.assert(
      fc.property(arbOrderList(), fc.constantFrom(...THREAD_COUNTS), fc.integer(), (orders, threadCount, seed) => {
        const { log } = runParallelFind(orders, { threadCount, seed, terminal: "findFirst" });
        expect(isPerLaneSingleFile(log)).toBe(true);

        const foundIndex = log.findIndex((e) => e.kind === "found");
        if (foundIndex < 0) {
          // No survivor ⇒ no found, no cancel — the stream exhausted, pulling everything.
          expect(log.some((e) => e.kind === "cancel")).toBe(false);
          return;
        }
        // Nothing is pulled past the decision: only cancels trail the `found`.
        expect(log.slice(foundIndex + 1).every((e) => e.kind === "cancel")).toBe(true);

        const found = log[foundIndex]!;
        const winnerIdx = found.kind === "found" && found.lane ? laneIndex(found.lane) : -1;
        const cancelLanes = log.filter((e) => e.kind === "cancel").map((e) => e.lane!);
        // The winner is never cancelled, and every cancelled lane is a *later* lane the
        // ordered wait outran (findFirst cancels only to the right of the earliest match).
        expect(new Set(cancelLanes).size).toBe(cancelLanes.length); // distinct
        for (const lane of cancelLanes) expect(laneIndex(lane)).toBeGreaterThan(winnerIdx);
      }),
      { seed: DEFAULT_SEED },
    );
  });
});
