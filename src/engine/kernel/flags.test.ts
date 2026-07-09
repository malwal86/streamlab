import { describe, it, expect } from "vitest";
import { combineFlags, flagNames, hasFlag, NO_FLAGS, OpFlag, type FlagSet } from "./flags";

/**
 * S0.5 AC4 — op flags are attached per op and *reachable* by whoever folds a
 * pipeline's characteristics. These pin the bitmask semantics the runner relies on
 * to pick the short-circuit loop, so a flipped bit or a broken `hasFlag` fails here
 * rather than silently changing traversal.
 */
describe("op flags — bitmask", () => {
  it("assigns four distinct single-bit values", () => {
    const bits = [OpFlag.STATEFUL, OpFlag.SHORT_CIRCUIT, OpFlag.ORDERED, OpFlag.SIZED];
    expect(new Set(bits).size).toBe(4);
    // Every value is a single set bit (a power of two).
    for (const bit of bits) {
      expect(bit).toBeGreaterThan(0);
      expect(bit & (bit - 1)).toBe(0);
    }
  });

  it("the empty set contains no flag", () => {
    expect(hasFlag(NO_FLAGS, OpFlag.STATEFUL)).toBe(false);
    expect(hasFlag(NO_FLAGS, OpFlag.SHORT_CIRCUIT)).toBe(false);
    expect(hasFlag(NO_FLAGS, OpFlag.ORDERED)).toBe(false);
    expect(hasFlag(NO_FLAGS, OpFlag.SIZED)).toBe(false);
  });

  it("combineFlags ORs bits so both are present and unrelated ones are not", () => {
    const set = combineFlags(OpFlag.ORDERED, OpFlag.SIZED);
    expect(hasFlag(set, OpFlag.ORDERED)).toBe(true);
    expect(hasFlag(set, OpFlag.SIZED)).toBe(true);
    expect(hasFlag(set, OpFlag.SHORT_CIRCUIT)).toBe(false);
    expect(hasFlag(set, OpFlag.STATEFUL)).toBe(false);
  });

  it("combineFlags is idempotent and order-independent", () => {
    const a = combineFlags(OpFlag.ORDERED, OpFlag.SIZED, OpFlag.ORDERED);
    const b = combineFlags(OpFlag.SIZED, OpFlag.ORDERED);
    expect(a).toBe(b);
  });

  it("combineFlags of nothing is the empty set", () => {
    expect(combineFlags()).toBe(NO_FLAGS);
  });

  it("SHORT_CIRCUIT is detectable inside a combined set — the runner's key check", () => {
    const findFirstFlags: FlagSet = combineFlags(OpFlag.SHORT_CIRCUIT, OpFlag.ORDERED);
    expect(hasFlag(findFirstFlags, OpFlag.SHORT_CIRCUIT)).toBe(true);
  });

  it("hasFlag matches the whole bit, not a partial overlap", () => {
    // A set with only ORDERED must not report SHORT_CIRCUIT even though the
    // masks are distinct bits — guards against a `& flag !== 0` style slip.
    expect(hasFlag(OpFlag.ORDERED, OpFlag.SHORT_CIRCUIT)).toBe(false);
  });

  it("flagNames lists present flags in stable bit order", () => {
    expect(flagNames(combineFlags(OpFlag.SIZED, OpFlag.ORDERED))).toEqual(["ORDERED", "SIZED"]);
    expect(flagNames(NO_FLAGS)).toEqual([]);
    expect(flagNames(combineFlags(OpFlag.STATEFUL, OpFlag.SHORT_CIRCUIT))).toEqual([
      "STATEFUL",
      "SHORT_CIRCUIT",
    ]);
  });
});
