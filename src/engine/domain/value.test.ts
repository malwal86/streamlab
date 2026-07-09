import { describe, it, expect } from "vitest";
import {
  INT_MIN,
  INT_MAX,
  intValue,
  refValue,
  isInt,
  isRef,
  valueEquals,
  boxInt,
  unboxInt,
} from "./value";

/**
 * S0.3 AC4 — the `Value` model distinguishes a primitive `int` from a boxed
 * reference and round-trips. These example tests pin the JDK semantics (value
 * vs identity equality, boxing) and the crash-early construction contract;
 * `value.property.test.ts` generalizes the round-trips over the whole int range.
 */
describe("intValue — primitive int construction", () => {
  it("tags the value as an int and preserves the number (round-trip)", () => {
    const v = intValue(42);
    expect(isInt(v)).toBe(true);
    expect(v.int).toBe(42);
  });

  it("accepts the JDK int boundaries", () => {
    expect(intValue(INT_MIN).int).toBe(INT_MIN);
    expect(intValue(INT_MAX).int).toBe(INT_MAX);
  });

  it("crashes early on a non-integer, naming the reason", () => {
    expect(() => intValue(4.5)).toThrow("not a whole number");
  });

  it("crashes early just past each boundary (kills off-by-one range mutants)", () => {
    expect(() => intValue(INT_MAX + 1)).toThrow("outside the JDK int range");
    expect(() => intValue(INT_MIN - 1)).toThrow("outside the JDK int range");
  });
});

describe("refValue — boxed reference construction", () => {
  it("tags the value as a ref and preserves object identity (round-trip)", () => {
    const obj = { region: "West" };
    const v = refValue(obj);
    expect(isRef(v)).toBe(true);
    expect(v.ref).toBe(obj);
  });

  it("carries null (references are nullable; primitive ints are not)", () => {
    expect(refValue(null).ref).toBeNull();
  });
});

describe("isInt / isRef — the arms are mutually exclusive", () => {
  it("classifies an int as int and not ref", () => {
    const v = intValue(1);
    expect(isInt(v)).toBe(true);
    expect(isRef(v)).toBe(false);
  });

  it("classifies a ref as ref and not int", () => {
    const v = refValue({});
    expect(isRef(v)).toBe(true);
    expect(isInt(v)).toBe(false);
  });
});

describe("valueEquals — JDK-faithful equality", () => {
  it("compares primitive ints by value", () => {
    expect(valueEquals(intValue(1000), intValue(1000))).toBe(true);
    expect(valueEquals(intValue(1000), intValue(1001))).toBe(false);
  });

  it("compares references by identity, not structure", () => {
    const shared = { region: "West" };
    expect(valueEquals(refValue(shared), refValue(shared))).toBe(true);
    // Structurally identical but distinct objects — like two boxed Integers.
    expect(valueEquals(refValue({ region: "West" }), refValue({ region: "West" }))).toBe(false);
  });

  it("treats interned string keys as identity-equal (enum group keys work)", () => {
    expect(valueEquals(refValue("West"), refValue("West"))).toBe(true);
  });

  it("never equates a primitive with a reference (no implicit unboxing)", () => {
    expect(valueEquals(intValue(1000), boxInt(intValue(1000)))).toBe(false);
    // Reversed arms, with a ref holding `undefined`: without the kind guard the
    // ref branch would `Object.is(undefined, undefined)` its way to a false positive.
    expect(valueEquals(refValue(undefined), intValue(5))).toBe(false);
  });
});

describe("boxInt / unboxInt — autoboxing", () => {
  it("round-trips a primitive int through a box", () => {
    expect(unboxInt(boxInt(intValue(7)))).toEqual(intValue(7));
  });

  it("boxing trades value equality for identity (Integer.valueOf semantics)", () => {
    expect(valueEquals(boxInt(intValue(1000)), boxInt(intValue(1000)))).toBe(false);
  });

  it("rejects unboxing a reference that is not a boxed int", () => {
    // Assert the specific message: each arm of the guard (null, non-object,
    // missing `boxedInt`) must reach *this* throw, not a native `in`-on-primitive
    // TypeError or a downstream `intValue(undefined)` RangeError.
    const reason = "reference does not hold a boxed int";
    expect(() => unboxInt(refValue("West"))).toThrow(reason); // non-object primitive
    expect(() => unboxInt(refValue(null))).toThrow(reason); // null reference
    expect(() => unboxInt(refValue({}))).toThrow(reason); // object without boxedInt
  });
});
