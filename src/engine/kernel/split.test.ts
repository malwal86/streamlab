/**
 * S3.1 — the recursive-halving split is a true partition (AC2) reflected in the
 * fork split tree (AC3), and it places the `findFirst` decoy in a *different* lane
 * than the target (the technical note that makes E4's ordered-wait meaningful).
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { ORDERS, DECOY_ID, FIND_FIRST_TARGET_ID } from "../domain/fixture";
import { arbOrderList, DEFAULT_SEED } from "../testing/arbitraries";
import { type SplitNode } from "../domain/event";
import { splitRecursive, type ThreadCount } from "./split";

const THREAD_COUNTS: readonly ThreadCount[] = [2, 4];

/** Every leaf lane id of a split tree, left-to-right — the lanes the fork names. */
function leafLanes(node: SplitNode): string[] {
  if (!node.children) return [node.lane];
  return [leafLanes(node.children[0]), leafLanes(node.children[1])].flat();
}

describe("S3.1 recursive-halving split — a true partition (AC2)", () => {
  it.each(THREAD_COUNTS)("union of %i lanes == source, disjoint (fixture)", (threadCount) => {
    const { lanes } = splitRecursive(ORDERS, threadCount);
    expect(lanes).toHaveLength(threadCount);

    const union = lanes.flatMap((lane) => lane.orders.map((o) => o.id));
    expect(union).toEqual(ORDERS.map((o) => o.id)); // union == source, in encounter order
    expect(new Set(union).size).toBe(union.length); // disjoint — no id twice
  });

  it.each(THREAD_COUNTS)("partition property holds for every generated list (%i lanes)", (threadCount) => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const { lanes } = splitRecursive(orders, threadCount);
        // Ranges tile [0, n) with no gap or overlap.
        const sorted = [...lanes].sort((a, b) => a.range[0] - b.range[0]);
        let cursor = 0;
        for (const lane of sorted) {
          expect(lane.range[0]).toBe(cursor);
          expect(lane.orders).toEqual(orders.slice(lane.range[0], lane.range[1]));
          cursor = lane.range[1];
        }
        expect(cursor).toBe(orders.length);
      }),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S3.1 fork split tree reflects the halving (AC3)", () => {
  it.each(THREAD_COUNTS)("has %i leaves whose sizes sum to the source", (threadCount) => {
    const { tree, lanes } = splitRecursive(ORDERS, threadCount);
    const leaves = leafLanes(tree);
    expect(leaves).toEqual(lanes.map((l) => l.lane)); // leaf order == lane order (L0…)
    expect(tree.estimatedSize).toBe(ORDERS.length); // root covers the whole source
    // Every internal node's size is the sum of its two halves (a real halving).
    const checkNode = (node: SplitNode): void => {
      if (!node.children) return;
      const [l, r] = node.children;
      expect(l.estimatedSize + r.estimatedSize).toBe(node.estimatedSize);
      checkNode(l);
      checkNode(r);
    };
    checkNode(tree);
  });
});

describe("S3.1 decoy lands in a different lane than the target (technical note)", () => {
  it.each(THREAD_COUNTS)("target and decoy split apart under %i-lane halving", (threadCount) => {
    const { lanes } = splitRecursive(ORDERS, threadCount);
    const laneOf = (id: number) => lanes.find((l) => l.orders.some((o) => o.id === id))!.lane;
    expect(laneOf(FIND_FIRST_TARGET_ID)).not.toBe(laneOf(DECOY_ID));
  });
});
