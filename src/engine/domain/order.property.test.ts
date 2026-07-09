import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { applyDiscount, REGIONS, type Order } from "./order";
import { INT_MAX } from "./value";
import { DEFAULT_SEED } from "../testing/arbitraries";

/**
 * S0.3 AC1, generalized — `applyDiscount` stays pure and (on the pipeline's
 * post-filter domain) strictly decreasing for every order, not just the examples.
 */
const SEED = DEFAULT_SEED;
const FILTER_THRESHOLD = 100;

const arbRegion = () => fc.constantFrom(...REGIONS);

/** Any order (id/region arbitrary, total anywhere in int range). */
const arbOrder = (): fc.Arbitrary<Order> =>
  fc.record({
    id: fc.integer({ min: 0, max: INT_MAX }),
    total: fc.integer(),
    region: arbRegion(),
  });

/** An order that survives `filter` — the only orders `map` actually sees. */
const arbSurvivingOrder = (): fc.Arbitrary<Order> =>
  fc.record({
    id: fc.integer({ min: 0, max: INT_MAX }),
    total: fc.integer({ min: FILTER_THRESHOLD + 1, max: INT_MAX }),
    region: arbRegion(),
  });

describe("applyDiscount — properties", () => {
  it("never mutates its input, for any order", () => {
    fc.assert(
      fc.property(arbOrder(), (order) => {
        const snapshot = { ...order };
        applyDiscount(order);
        expect(order).toEqual(snapshot);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("preserves id and region, for any order", () => {
    fc.assert(
      fc.property(arbOrder(), (order) => {
        const out = applyDiscount(order);
        expect(out.id).toBe(order.id);
        expect(out.region).toBe(order.region);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("strictly lowers the total for every surviving order", () => {
    fc.assert(
      fc.property(arbSurvivingOrder(), (order) => {
        expect(applyDiscount(order).total).toBeLessThan(order.total);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });
});
