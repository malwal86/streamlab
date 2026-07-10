/**
 * S3.2 — each lane runs its own `filter → map` into **private** partial bins. The
 * per-element journey (`test/survive/die/transform/route/accumulate`) is lane-tagged
 * (AC1), and no element accumulates into more than one lane's bins — per-lane bins are
 * disjoint until the merge (AC2). Asserted on the fixture here; the property test
 * generalizes AC2 across generated lists, both lane counts, and seeds.
 */
import { describe, it, expect } from "vitest";
import { ORDERS } from "./domain/fixture";
import { runParallel } from "./parallel";
import { oracleFilter } from "./testing/oracle";
import { countKind } from "./testing/logInvariants";
import { type ThreadCount } from "./kernel/split";

const THREAD_COUNTS: readonly ThreadCount[] = [2, 4];

describe("S3.2 per-lane filter → map is lane-tagged (AC1)", () => {
  it.each(THREAD_COUNTS)("every op event carries its lane (%i lanes)", (threadCount) => {
    const { log } = runParallel(ORDERS, { threadCount, seed: 1 });
    const LANE_KINDS = new Set(["test", "survive", "die", "transform", "route", "accumulate"]);
    for (const event of log) {
      if (LANE_KINDS.has(event.kind)) expect(event.lane).toMatch(/^L\d+$/);
    }
  });

  it.each(THREAD_COUNTS)("total accumulate count == survivors, split across lanes (%i)", (threadCount) => {
    const { log } = runParallel(ORDERS, { threadCount, seed: 1 });
    expect(countKind(log, "accumulate")).toBe(oracleFilter(ORDERS).length);
  });
});

describe("S3.2 private partial bins — no cross-lane contamination (AC2)", () => {
  it.each(THREAD_COUNTS)("each element accumulates only in the lane it was pulled by (%i)", (threadCount) => {
    const { log } = runParallel(ORDERS, { threadCount, seed: 1 });

    // Where each element was emitted (its partition lane) …
    const emitLane = new Map<number, string>();
    for (const e of log) if (e.kind === "emit") emitLane.set(e.elementId, e.lane!);

    // … must be the only lane it ever accumulates into.
    const accLanes = new Map<number, Set<string>>();
    for (const e of log) {
      if (e.kind !== "accumulate") continue;
      const set = accLanes.get(e.elementId!) ?? new Set<string>();
      set.add(e.lane!);
      accLanes.set(e.elementId!, set);
    }

    for (const [elementId, lanes] of accLanes) {
      expect(lanes.size).toBe(1); // never in two lanes' bins
      expect([...lanes][0]).toBe(emitLane.get(elementId)); // and it's the pulling lane
    }
  });
});
