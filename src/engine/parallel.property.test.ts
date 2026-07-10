/**
 * S3.1 — the load-bearing partition + single-file properties over generated lists:
 * for every order list, both lane counts, and any seed, the parallel log emits each
 * source element exactly once (union == source, disjoint — AC2) and stays single-file
 * per lane (AC4). This is the headless correctness floor the parallel viz replays.
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { runParallel } from "./parallel";
import { arbOrderList, DEFAULT_SEED } from "./testing/arbitraries";
import { isPerLaneSingleFile } from "./testing/logInvariants";
import { type ThreadCount } from "./kernel/split";

const THREAD_COUNTS: readonly ThreadCount[] = [2, 4];

describe("S3.1 parallel partition + single-file properties", () => {
  it.each(THREAD_COUNTS)("emits each element exactly once (union == source, %i lanes)", (threadCount) => {
    fc.assert(
      fc.property(arbOrderList(), fc.integer(), (orders, seed) => {
        const { log } = runParallel(orders, { threadCount, seed });
        const emitted = log.filter((e) => e.kind === "emit").map((e) => e.elementId!);
        expect(emitted.slice().sort((a, b) => a - b)).toEqual(
          orders.map((o) => o.id).slice().sort((a, b) => a - b),
        );
        expect(emitted).toHaveLength(orders.length); // no element dropped or duplicated
      }),
      { seed: DEFAULT_SEED },
    );
  });

  it.each(THREAD_COUNTS)("stays single-file per lane for any seed (%i lanes)", (threadCount) => {
    fc.assert(
      fc.property(arbOrderList(), fc.integer(), (orders, seed) => {
        const { log } = runParallel(orders, { threadCount, seed });
        expect(isPerLaneSingleFile(log)).toBe(true);
      }),
      { seed: DEFAULT_SEED },
    );
  });
});
