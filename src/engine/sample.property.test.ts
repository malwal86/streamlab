import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { survivesThreshold, encounterMin } from "./sample";
import { arbIndexList, arbTotal, DEFAULT_SEED } from "./testing/arbitraries";

/**
 * Worked fast-check property example (S0.2 AC2).
 *
 * Every `fc.assert` runs with an explicit `seed` so a failure is reproducible:
 * fast-check prints `seed` and `path` on failure, and re-running with the same
 * seed replays the exact shrunk counterexample. To reproduce a reported failure
 * locally, drop its seed into the options object below.
 */
const SEED = DEFAULT_SEED;

describe("encounterMin — property: equals the array minimum", () => {
  it("agrees with an independent Math.min oracle for any non-empty list", () => {
    fc.assert(
      fc.property(arbIndexList(), (indices) => {
        expect(encounterMin(indices)).toBe(Math.min(...indices));
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("is invariant under permutation (metamorphic: order must not change the min)", () => {
    fc.assert(
      fc.property(arbIndexList(), (indices) => {
        const shuffled = [...indices].reverse();
        expect(encounterMin(shuffled)).toBe(encounterMin(indices));
      }),
      { seed: SEED, numRuns: 500 },
    );
  });
});

describe("survivesThreshold — property: monotone in total at a fixed threshold", () => {
  it("holds the strict-inequality contract against a boundary oracle", () => {
    fc.assert(
      fc.property(arbTotal(), fc.integer(), (total, threshold) => {
        expect(survivesThreshold(total, threshold)).toBe(total > threshold);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });
});
