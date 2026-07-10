/**
 * S4.2 — parallel `findAny` properties and the **real** A/B contrast (Decision 31):
 *
 *   - **AC1 (validity).** `findAny`'s result is always *a valid match* — a member of
 *     the (mapped) survivor set — for every list, lane count, and seed. It just need
 *     not be the *earliest*; first lane home wins.
 *   - **AC2 (the contrast is not faked).** There exist seeds where `findAny ≠
 *     findFirst` on the very same source — the divergence the demo is built to show.
 *     Pinned concretely (2-lane and 4-lane) *and* asserted to exist by a seed scan.
 *   - **Short-circuit shape.** Like `findFirst`: nothing is pulled past `found` (only
 *     `cancel` trails it), the run is single-file per lane, and the winner is never
 *     itself cancelled.
 *
 * The winner's *validity* is the property a single-value oracle can pin; the freedom
 * to return any survivor is what makes it a set-membership claim rather than an
 * equality one (see {@link oracleSurvivors}).
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { ORDERS } from "./domain/fixture";
import { type Order } from "./domain/order";
import { runParallelFind, type ParallelTerminal } from "./parallelFind";
import { type ThreadCount } from "./kernel/split";
import { arbOrderList, DEFAULT_SEED } from "./testing/arbitraries";
import { isPerLaneSingleFile } from "./testing/logInvariants";
import { oracleMap, oracleSurvivors } from "./testing/oracle";

const THREAD_COUNTS: readonly ThreadCount[] = [2, 4];

/** The found element id of a run's log, or undefined when nothing latched. */
function foundId(orders: readonly Order[], tc: ThreadCount, seed: number, terminal: ParallelTerminal) {
  const { log } = runParallelFind(orders, { threadCount: tc, seed, terminal });
  const found = log.find((e) => e.kind === "found");
  return found?.kind === "found" ? found.elementId : undefined;
}

describe("S4.2 parallel findAny — result is always a valid match (AC1)", () => {
  it("returns a (mapped) survivor for every list, lane count, and seed; undefined iff none survive", () => {
    fc.assert(
      fc.property(arbOrderList(), fc.constantFrom(...THREAD_COUNTS), fc.integer(), (orders, threadCount, seed) => {
        const { result } = runParallelFind(orders, { threadCount, seed, terminal: "findAny" });
        const mappedSurvivors = oracleMap(oracleSurvivors(orders));
        if (mappedSurvivors.length === 0) {
          expect(result).toBeUndefined();
        } else {
          expect(mappedSurvivors).toContainEqual(result);
        }
      }),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S4.2 parallel findAny — short-circuit shape", () => {
  it("only `cancel` follows `found`, the run is single-file, and the winner is never cancelled", () => {
    fc.assert(
      fc.property(arbOrderList(), fc.constantFrom(...THREAD_COUNTS), fc.integer(), (orders, threadCount, seed) => {
        const { log } = runParallelFind(orders, { threadCount, seed, terminal: "findAny" });
        expect(isPerLaneSingleFile(log)).toBe(true);

        const foundIndex = log.findIndex((e) => e.kind === "found");
        if (foundIndex < 0) {
          expect(log.some((e) => e.kind === "cancel")).toBe(false);
          return;
        }
        expect(log.slice(foundIndex + 1).every((e) => e.kind === "cancel")).toBe(true);
        const winnerLane = (log[foundIndex] as { lane?: string }).lane;
        const cancelLanes = log.filter((e) => e.kind === "cancel").map((e) => e.lane);
        expect(cancelLanes).not.toContain(winnerLane);
        expect(new Set(cancelLanes).size).toBe(cancelLanes.length); // distinct
      }),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S4.2 findFirst vs findAny — the contrast is real (AC2)", () => {
  it("diverges on the fixture: findAny can return a later survivor — even the decoy", () => {
    // 2-lane seed 1: L1 homes first ⇒ findAny #6, but findFirst holds out for #2.
    expect(foundId(ORDERS, 2, 1, "findAny")).toBe(6);
    expect(foundId(ORDERS, 2, 1, "findFirst")).toBe(2);
    // 4-lane seed 5: findAny returns the *decoy* (#9) — the element findFirst forbids.
    expect(foundId(ORDERS, 4, 5, "findAny")).toBe(9);
    expect(foundId(ORDERS, 4, 5, "findFirst")).toBe(2);
  });

  it("findFirst is seed-invariant (always #2) while findAny varies with the seed", () => {
    const anyResults = new Set<number | undefined>();
    for (let seed = 1; seed <= 12; seed += 1) {
      expect(foundId(ORDERS, 4, seed, "findFirst")).toBe(2); // never wavers
      anyResults.add(foundId(ORDERS, 4, seed, "findAny"));
    }
    // findAny landed on more than one distinct survivor across the seeds — the
    // non-determinism the multithread demo makes visible.
    expect(anyResults.size).toBeGreaterThan(1);
  });
});
