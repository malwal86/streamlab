/**
 * S0.6 property self-tests. These pin the *oracle's own* invariants over
 * generated streams (AC2: the arbitrary is varied and shrinkable) so that when
 * later stories assert `engine == oracle`, the right-hand side is itself trusted.
 * No engine code is exercised here — that equality is the ops' stories (E1/E2).
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { arbOrderList, DEFAULT_SEED } from "./arbitraries";
import {
  oracleFilter,
  oracleFindFirst,
  oracleGroupingBy,
  oracleMap,
  ORACLE_FILTER_THRESHOLD,
} from "./oracle";

const opts = { seed: DEFAULT_SEED, numRuns: 500 } as const;

describe("oracle invariants over generated order lists (AC2)", () => {
  it("filter keeps only totals strictly over the threshold, as a subsequence", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const kept = oracleFilter(orders);
        expect(kept.every((o) => o.total > ORACLE_FILTER_THRESHOLD)).toBe(true);
        // Order-preserving subsequence: filtering the kept ids out of the input
        // consumes them left to right.
        let i = 0;
        for (const o of orders) if (i < kept.length && o === kept[i]) i += 1;
        expect(i).toBe(kept.length);
      }),
      opts,
    );
  });

  it("map preserves length, order, id and region, and truncates 10% off", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const mapped = oracleMap(orders);
        expect(mapped).toHaveLength(orders.length);
        mapped.forEach((m, idx) => {
          const src = orders[idx]!;
          expect(m.id).toBe(src.id);
          expect(m.region).toBe(src.region);
          expect(m.total).toBe(src.total - Math.trunc(src.total / 10));
        });
      }),
      opts,
    );
  });

  it("groupingBy partitions the input: bins are a disjoint cover, keyed by region", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const bins = oracleGroupingBy(orders);
        const total = [...bins.values()].reduce((n, bin) => n + bin.length, 0);
        expect(total).toBe(orders.length); // cover, no duplication or loss
        for (const [region, bin] of bins) {
          expect(bin.every((o) => o.region === region)).toBe(true); // correct key
        }
      }),
      opts,
    );
  });

  it("findFirst equals the first element of the filtered stream (or undefined)", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const kept = oracleFilter(orders);
        expect(oracleFindFirst(orders)).toBe(kept.length ? kept[0] : undefined);
      }),
      opts,
    );
  });
});
