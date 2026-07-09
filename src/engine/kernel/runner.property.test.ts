import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { ORDERS } from "../domain/fixture";
import { REGIONS, type Order } from "../domain/order";
import { INT_MAX } from "../domain/value";
import { DEFAULT_SEED, arbTotal } from "../testing/arbitraries";
import { countKind, pullOrderViolations } from "../testing/logInvariants";
import { identityPipeline, runSequential } from "./runner";

/**
 * S0.5 test plan — the single-file and demand-precedes-emit invariants must hold for
 * *any* input, not just the fixture, and identity must round-trip every list. If the
 * pull loop ever interleaved two elements or emitted before demanding, the shrinker
 * prints the smallest order list that breaks it.
 */
const SEED = DEFAULT_SEED;

const arbOrder = (): fc.Arbitrary<Order> =>
  fc.record({
    id: fc.integer({ min: 0, max: INT_MAX }),
    total: arbTotal(),
    region: fc.constantFrom(...REGIONS),
  });

/** Order lists spanning empty, singleton, and many — the sizes the loop must handle. */
const arbOrderList = (): fc.Arbitrary<Order[]> => fc.array(arbOrder(), { maxLength: 40 });

describe("runSequential identity — invariants for any order list", () => {
  it("never interleaves elements (single-file, demand precedes emit)", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const { log } = runSequential(identityPipeline(orders));
        expect(pullOrderViolations(log)).toEqual([]);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("emits exactly one per element and one extra (trailing) demand", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const { log } = runSequential(identityPipeline(orders));
        expect(countKind(log, "emit")).toBe(orders.length);
        expect(countKind(log, "demand")).toBe(orders.length + 1);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("collects the input unchanged, in encounter order (identity round-trip)", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const { result } = runSequential(identityPipeline(orders));
        expect(result).toEqual(orders);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("preserves the invariants under any permutation of the real fixture", () => {
    // Encounter order is the only thing that changes; the loop shape must not.
    fc.assert(
      fc.property(fc.shuffledSubarray([...ORDERS], { minLength: ORDERS.length }), (perm) => {
        const { log, result } = runSequential(identityPipeline(perm));
        expect(pullOrderViolations(log)).toEqual([]);
        expect(result.map((o) => o.id)).toEqual(perm.map((o) => o.id));
      }),
      { seed: SEED, numRuns: 300 },
    );
  });
});
