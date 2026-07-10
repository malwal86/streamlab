/**
 * S4.2 AC3 — the committed goldens of parallel `findAny` over the fixture. Where
 * `findFirst` always latches id 2 (the earliest), `findAny` latches **whichever lane
 * homes first** on the given seed — so these goldens deliberately span both the
 * divergent and the coincidental cases:
 *
 *   - 2-lane seed 1: L1 homes first ⇒ **id 6** (≠ findFirst's id 2 — the contrast).
 *   - 2-lane seed 2: the interleave lets L0 home first ⇒ id 2 (same as findFirst).
 *   - 4-lane seed 5: L3 homes first ⇒ **id 9, the decoy** — the exact element the
 *     ordered `findFirst` must never return, which `findAny` legitimately can.
 *   - 4-lane seed 1: L2 homes first ⇒ id 6.
 *
 * A diff means the first-home selection or the interleaving changed (R4). Regenerate
 * with `UPDATE_GOLDEN=1 npm run test:golden`.
 */
import { describe, it, expect } from "vitest";
import { ORDERS } from "./domain/fixture";
import { runParallelFind } from "./parallelFind";
import { assertMatchesGolden } from "./testing/golden";
import { isPerLaneSingleFile } from "./testing/logInvariants";
import { type ThreadCount } from "./kernel/split";

const CASES: readonly { threadCount: ThreadCount; seed: number; name: string; foundId: number }[] = [
  { threadCount: 2, seed: 1, name: "slice-b-findany-parallel-2lane-seed1", foundId: 6 },
  { threadCount: 2, seed: 2, name: "slice-b-findany-parallel-2lane-seed2", foundId: 2 },
  { threadCount: 4, seed: 5, name: "slice-b-findany-parallel-4lane-seed5", foundId: 9 },
  { threadCount: 4, seed: 1, name: "slice-b-findany-parallel-4lane-seed1", foundId: 6 },
];

describe("golden — Slice B parallel findAny over the fixture", () => {
  it.each(CASES)("matches the committed golden ($name)", ({ threadCount, seed, name }) => {
    const { log } = runParallelFind(ORDERS, { threadCount, seed, terminal: "findAny" });
    assertMatchesGolden(name, log);
  });

  it.each(CASES)("latches the first lane home ($name → #$foundId)", ({ threadCount, seed, foundId }) => {
    const { log, result } = runParallelFind(ORDERS, { threadCount, seed, terminal: "findAny" });
    const found = log.find((e) => e.kind === "found");
    expect(found?.kind === "found" && found.elementId).toBe(foundId);
    expect(result?.id).toBe(foundId);
  });

  it.each(CASES)("stays single-file per lane ($name)", ({ threadCount, seed }) => {
    const { log } = runParallelFind(ORDERS, { threadCount, seed, terminal: "findAny" });
    expect(isPerLaneSingleFile(log)).toBe(true);
  });
});
