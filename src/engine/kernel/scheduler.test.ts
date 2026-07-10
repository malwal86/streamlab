/**
 * S3.1 — the seeded scheduler is deterministic given `(counts, seed)` (AC1), varies
 * with the seed (AC6), and preserves each lane's encounter order (AC4): it only
 * reorders *which lane* advances, never the multiset of pulls per lane.
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { DEFAULT_SEED } from "../testing/arbitraries";
import { buildSchedule } from "./scheduler";

describe("S3.1 scheduler determinism (AC1)", () => {
  it("same (counts, seed) yields byte-identical schedules", () => {
    const a = buildSchedule([5, 6], 1);
    const b = buildSchedule([5, 6], 1);
    expect(a).toEqual(b);
  });

  it("lane i appears exactly counts[i] times, regardless of seed (a permutation)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 8 }), { minLength: 1, maxLength: 4 }),
        fc.integer(),
        (counts, seed) => {
          const schedule = buildSchedule(counts, seed);
          const seen = counts.map(() => 0);
          for (const lane of schedule) seen[lane]! += 1;
          expect(seen).toEqual(counts); // exactly the multiset — nothing added or dropped
        },
      ),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S3.1 scheduler varies with the seed (AC6)", () => {
  it("different seeds produce different interleavings for the fixture split", () => {
    // 2-lane fixture partition sizes are [5, 6]; two seeds must interleave differently.
    expect(buildSchedule([5, 6], 1)).not.toEqual(buildSchedule([5, 6], 2));
  });
});
