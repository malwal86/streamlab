import { describe, it, expect } from "vitest";
import { hasFlag, OpFlag } from "./flags";
import { arraySpliterator, SIZE_UNKNOWN } from "./spliterator";

/**
 * S0.5 — the source pulled one element at a time. These pin `tryAdvance`'s exactly-
 * one-per-call contract and the SIZED/ORDERED characteristics the runner folds in;
 * they are the base the single-file log invariant ultimately rests on.
 */
describe("arraySpliterator — tryAdvance pull", () => {
  it("delivers exactly one element per successful tryAdvance, in encounter order", () => {
    const spliterator = arraySpliterator(["a", "b", "c"]);
    const seen: string[] = [];
    expect(spliterator.tryAdvance((x) => seen.push(x))).toBe(true);
    expect(seen).toEqual(["a"]);
    expect(spliterator.tryAdvance((x) => seen.push(x))).toBe(true);
    expect(seen).toEqual(["a", "b"]);
  });

  it("returns false at exhaustion and invokes the action zero times", () => {
    const spliterator = arraySpliterator([42]);
    expect(spliterator.tryAdvance(() => {})).toBe(true);

    let calls = 0;
    expect(
      spliterator.tryAdvance(() => {
        calls += 1;
      }),
    ).toBe(false);
    expect(calls).toBe(0);
  });

  it("an empty source returns false immediately", () => {
    const spliterator = arraySpliterator<number>([]);
    let called = false;
    expect(
      spliterator.tryAdvance(() => {
        called = true;
      }),
    ).toBe(false);
    expect(called).toBe(false);
    expect(spliterator.getExactSizeIfKnown()).toBe(0);
  });

  it("estimateSize shrinks by one per advance; exact size equals it (SIZED)", () => {
    const spliterator = arraySpliterator(["x", "y", "z"]);
    expect(spliterator.estimateSize()).toBe(3);
    expect(spliterator.getExactSizeIfKnown()).toBe(3);
    spliterator.tryAdvance(() => {});
    expect(spliterator.estimateSize()).toBe(2);
    expect(spliterator.getExactSizeIfKnown()).toBe(2);
  });

  it("SIZE_UNKNOWN is the sentinel -1 (the not-SIZED contract value)", () => {
    expect(SIZE_UNKNOWN).toBe(-1);
  });

  it("is SIZED and ORDERED, and never reports size-unknown", () => {
    const spliterator = arraySpliterator([1, 2]);
    expect(hasFlag(spliterator.characteristics(), OpFlag.SIZED)).toBe(true);
    expect(hasFlag(spliterator.characteristics(), OpFlag.ORDERED)).toBe(true);
    expect(spliterator.getExactSizeIfKnown()).not.toBe(SIZE_UNKNOWN);
  });

  it("snapshots its source: mutating the caller's array mid-traversal is not observed", () => {
    const source = [1, 2, 3];
    const spliterator = arraySpliterator(source);
    const seen: number[] = [];
    spliterator.tryAdvance((x) => seen.push(x));
    source[1] = 999; // mutate after traversal started
    spliterator.tryAdvance((x) => seen.push(x));
    spliterator.tryAdvance((x) => seen.push(x));
    expect(seen).toEqual([1, 2, 3]);
  });

  it("two spliterators over the same array traverse independently", () => {
    const source = ["p", "q"];
    const a = arraySpliterator(source);
    const b = arraySpliterator(source);
    a.tryAdvance(() => {});
    expect(a.estimateSize()).toBe(1);
    expect(b.estimateSize()).toBe(2); // b is untouched
  });
});
