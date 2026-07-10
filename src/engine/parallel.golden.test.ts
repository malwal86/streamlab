/**
 * S3.1 AC5 — the committed goldens of the canonical parallel fork over the fixture,
 * at the default seed, for 2 and 4 lanes. These are *the* parallel Slice A logs the
 * viz (E3) replays; a diff means the fork or interleaving semantics changed (R4).
 * Regenerate intentionally with `UPDATE_GOLDEN=1 npm run test:golden`.
 *
 * The 4-lane golden also pins the over-split edge (11 elements, 4 lanes: the fixture
 * splits cleanly, no empty lane) and the per-lane single-file invariant.
 */
import { describe, it, expect } from "vitest";
import { ORDERS } from "./domain/fixture";
import { runParallel } from "./parallel";
import { assertMatchesGolden } from "./testing/golden";
import { isPerLaneSingleFile } from "./testing/logInvariants";
import { type ThreadCount } from "./kernel/split";

const GOLDEN_SEED = 1;
const CASES: readonly { threadCount: ThreadCount; name: string }[] = [
  { threadCount: 2, name: "slice-a-parallel-2lane" },
  { threadCount: 4, name: "slice-a-parallel-4lane" },
];

describe("golden — Slice A parallel fork over the fixture (seed 1)", () => {
  it.each(CASES)("matches the committed golden ($name)", ({ threadCount, name }) => {
    const { log } = runParallel(ORDERS, { threadCount, seed: GOLDEN_SEED });
    assertMatchesGolden(name, log);
  });

  it.each(CASES)("the golden log is single-file per lane ($name)", ({ threadCount }) => {
    const { log } = runParallel(ORDERS, { threadCount, seed: GOLDEN_SEED });
    expect(isPerLaneSingleFile(log)).toBe(true);
  });
});
