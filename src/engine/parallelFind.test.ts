/**
 * S4.1 — parallel `findFirst` unit behaviors over the fixture and its edge cases: the
 * ordered wait ("a later lane home does not win"), the cancellation of the outrun
 * lanes, and the no-survivor exhaustion. The load-bearing "always encounter-order-
 * earliest" claim is the property test's job; here we pin the concrete shapes.
 */
import { describe, it, expect } from "vitest";
import { ORDERS, FIND_FIRST_TARGET_ID, DECOY_ID } from "./domain/fixture";
import { type Order } from "./domain/order";
import { runParallelFind } from "./parallelFind";
import { countKind } from "./testing/logInvariants";
import { type ThreadCount } from "./kernel/split";

const THREAD_COUNTS: readonly ThreadCount[] = [2, 4];

describe("S4.1 parallel findFirst — ordered wait beats first-home", () => {
  it.each(THREAD_COUNTS)("latches the earliest survivor (id 2), never the decoy (%i lanes)", (threadCount) => {
    for (const seed of [1, 2, 7, 42, 100]) {
      const { log, result } = runParallelFind(ORDERS, { threadCount, seed, terminal: "findFirst" });
      const found = log.find((e) => e.kind === "found");
      expect(found?.kind === "found" && found.elementId).toBe(FIND_FIRST_TARGET_ID);
      expect(found?.kind === "found" && found.elementId).not.toBe(DECOY_ID);
      expect(result?.id).toBe(FIND_FIRST_TARGET_ID);
      // Exactly one match latches, no matter how many lanes raced.
      expect(countKind(log, "found")).toBe(1);
    }
  });

  it("opens with a single fork and the earliest match sits in the leftmost lane (L0)", () => {
    const { log } = runParallelFind(ORDERS, { threadCount: 4, seed: 3, terminal: "findFirst" });
    expect(countKind(log, "fork")).toBe(1);
    const found = log.find((e) => e.kind === "found");
    expect(found?.kind === "found" && found.lane).toBe("L0");
  });

  it("cancels every lane the ordered wait outran (all lanes but the winner, here)", () => {
    // Every fixture lane holds a survivor, so each non-winner lane is cancelled.
    const { log } = runParallelFind(ORDERS, { threadCount: 4, seed: 5, terminal: "findFirst" });
    const cancelledLanes = log.filter((e) => e.kind === "cancel").map((e) => e.lane).sort();
    expect(cancelledLanes).toEqual(["L1", "L2", "L3"]);
    // The winner's lane is never among them.
    expect(cancelledLanes).not.toContain("L0");
  });
});

describe("S4.1 parallel findFirst — no survivor exhausts without latching", () => {
  const NONE_SURVIVE: readonly Order[] = Object.freeze(
    [
      { id: 1, total: 10, region: "West" },
      { id: 2, total: 50, region: "East" },
      { id: 3, total: 100, region: "North" }, // exactly 100 dies under strict `>`
      { id: 4, total: 99, region: "West" },
    ].map((o) => Object.freeze(o as Order)),
  );

  it.each(THREAD_COUNTS)("no found, no cancel, result undefined — every element pulled (%i lanes)", (threadCount) => {
    const { log, result } = runParallelFind(NONE_SURVIVE, { threadCount, seed: 9, terminal: "findFirst" });
    expect(result).toBeUndefined();
    expect(countKind(log, "found")).toBe(0);
    expect(countKind(log, "cancel")).toBe(0);
    // Nothing short-circuited: the whole source was emitted across the lanes.
    const emitted = log.filter((e) => e.kind === "emit").map((e) => e.elementId).sort((a, b) => a! - b!);
    expect(emitted).toEqual(NONE_SURVIVE.map((o) => o.id));
  });
});
