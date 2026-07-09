import { describe, it, expect } from "vitest";
import { survivesThreshold, encounterMin } from "./sample";

/**
 * Worked red→green example (S0.2 AC1).
 *
 * These tests were authored *before* `sample.ts` existed: with the module
 * missing (or the functions stubbed to `return false` / `return null`) the suite
 * is red; the minimal implementation in `sample.ts` turns it green. They also
 * pin every boundary needed to kill the mutants Stryker generates (`> → >=`,
 * `< → <=`, off-by-one loop bounds, flipped returns) — see AC4.
 */
describe("survivesThreshold (Slice-A filter predicate, in miniature)", () => {
  it("passes a total strictly above the threshold", () => {
    expect(survivesThreshold(101, 100)).toBe(true);
  });

  it("rejects a total exactly at the threshold (strictly greater, not >=)", () => {
    expect(survivesThreshold(100, 100)).toBe(false);
  });

  it("rejects a total below the threshold", () => {
    expect(survivesThreshold(99, 100)).toBe(false);
  });
});

describe("encounterMin (findFirst reduces to earliest index)", () => {
  it("returns null for an empty sequence (nothing was pulled)", () => {
    expect(encounterMin([])).toBeNull();
  });

  it("returns the sole element of a singleton", () => {
    expect(encounterMin([7])).toBe(7);
  });

  it("finds the minimum when it is first", () => {
    expect(encounterMin([1, 5, 9])).toBe(1);
  });

  it("finds the minimum when it is last (guards the loop upper bound)", () => {
    expect(encounterMin([9, 5, 1])).toBe(1);
  });

  it("finds the minimum in the interior", () => {
    expect(encounterMin([9, 1, 5])).toBe(1);
  });
});
