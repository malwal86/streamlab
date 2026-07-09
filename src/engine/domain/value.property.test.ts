import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { INT_MIN, INT_MAX, intValue, refValue, boxInt, unboxInt, valueEquals } from "./value";
import { DEFAULT_SEED } from "../testing/arbitraries";

/**
 * S0.3 AC4, generalized — the round-trip and equality laws hold across the whole
 * JDK int range, not just the hand-picked examples in `value.test.ts`.
 */
const SEED = DEFAULT_SEED;
const arbInt = () => fc.integer({ min: INT_MIN, max: INT_MAX });

describe("Value — round-trip laws", () => {
  it("intValue round-trips any JDK int", () => {
    fc.assert(
      fc.property(arbInt(), (n) => {
        expect(intValue(n).int).toBe(n);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("boxInt/unboxInt round-trips any JDK int", () => {
    fc.assert(
      fc.property(arbInt(), (n) => {
        expect(unboxInt(boxInt(intValue(n)))).toEqual(intValue(n));
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("refValue preserves identity for any reference", () => {
    fc.assert(
      fc.property(fc.object(), (obj) => {
        expect(refValue(obj).ref).toBe(obj);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });
});

describe("Value — equality laws", () => {
  it("equal ints compare equal, unequal ints compare unequal", () => {
    fc.assert(
      fc.property(arbInt(), arbInt(), (a, b) => {
        expect(valueEquals(intValue(a), intValue(b))).toBe(a === b);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("independently boxed ints are never value-equal (boxing loses value equality)", () => {
    fc.assert(
      fc.property(arbInt(), (n) => {
        expect(valueEquals(boxInt(intValue(n)), boxInt(intValue(n)))).toBe(false);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });

  it("rejects any number with a fractional part", () => {
    fc.assert(
      fc.property(
        fc.double({ min: INT_MIN, max: INT_MAX, noNaN: true }).filter((d) => !Number.isInteger(d)),
        (d) => {
          expect(() => intValue(d)).toThrow(RangeError);
        },
      ),
      { seed: SEED, numRuns: 500 },
    );
  });
});
