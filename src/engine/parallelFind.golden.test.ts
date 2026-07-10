/**
 * S4.1 AC4 — the committed goldens of parallel `findFirst` over the fixture, for 2 and
 * 4 lanes across two seeds each. These are *the* Slice-B parallel logs the viz (S4.3)
 * replays: a `fork`, the lanes racing their `filter → map → find`, the ordered `found`
 * on the encounter-order-earliest survivor (id 2, always — the load-bearing result),
 * and the `cancel` sweep over the lanes it outran. A diff means the ordered
 * short-circuit or the interleaving changed (R4). Regenerate intentionally with
 * `UPDATE_GOLDEN=1 npm run test:golden`.
 *
 * Two seeds per lane count pin that the *result* is seed-independent (id 2 in every
 * golden) while the *interleaving* — and thus which cancels fire and when — is not.
 */
import { describe, it, expect } from "vitest";
import { ORDERS, FIND_FIRST_TARGET_ID } from "./domain/fixture";
import { runParallelFind } from "./parallelFind";
import { assertMatchesGolden } from "./testing/golden";
import { isPerLaneSingleFile } from "./testing/logInvariants";
import { type ThreadCount } from "./kernel/split";

const CASES: readonly { threadCount: ThreadCount; seed: number; name: string }[] = [
  { threadCount: 2, seed: 1, name: "slice-b-findfirst-parallel-2lane-seed1" },
  { threadCount: 2, seed: 2, name: "slice-b-findfirst-parallel-2lane-seed2" },
  { threadCount: 4, seed: 1, name: "slice-b-findfirst-parallel-4lane-seed1" },
  { threadCount: 4, seed: 2, name: "slice-b-findfirst-parallel-4lane-seed2" },
];

describe("golden — Slice B parallel findFirst over the fixture", () => {
  it.each(CASES)("matches the committed golden ($name)", ({ threadCount, seed, name }) => {
    const { log } = runParallelFind(ORDERS, { threadCount, seed, terminal: "findFirst" });
    assertMatchesGolden(name, log);
  });

  it.each(CASES)("the golden log is single-file per lane ($name)", ({ threadCount, seed }) => {
    const { log } = runParallelFind(ORDERS, { threadCount, seed, terminal: "findFirst" });
    expect(isPerLaneSingleFile(log)).toBe(true);
  });

  it.each(CASES)("latches the encounter-order-earliest survivor ($name)", ({ threadCount, seed }) => {
    const { log, result } = runParallelFind(ORDERS, { threadCount, seed, terminal: "findFirst" });
    const found = log.find((e) => e.kind === "found");
    expect(found?.kind === "found" && found.elementId).toBe(FIND_FIRST_TARGET_ID);
    expect(result?.id).toBe(FIND_FIRST_TARGET_ID);
  });
});
