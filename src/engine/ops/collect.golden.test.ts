/**
 * S1.3 AC4 — the committed golden of the **canonical Slice A sequential** run over
 * the fixture: the full `demand → emit → test → survive → transform → route →
 * accumulate → …` log the entire E1 visualization replays. This is *the* Slice A
 * log; a diff means the pipeline's semantics changed (R4). Regenerate intentionally
 * with `UPDATE_GOLDEN=1 npm run test:golden`.
 */
import { describe, it, expect } from "vitest";
import { ORDERS } from "../domain/fixture";
import { runSequential } from "../kernel/runner";
import { assertMatchesGolden } from "../testing/golden";
import { isSingleFilePull } from "../testing/logInvariants";
import { sliceASequentialPipeline } from "../pipelines";

describe("golden — Slice A sequential (filter → map → groupingBy) over the fixture", () => {
  it("matches the committed golden snapshot", () => {
    const { log } = runSequential(sliceASequentialPipeline(ORDERS));
    assertMatchesGolden("slice-a-sequential", log);
  });

  it("the canonical Slice A log satisfies the single-file invariant", () => {
    const { log } = runSequential(sliceASequentialPipeline(ORDERS));
    expect(isSingleFilePull(log)).toBe(true);
  });
});
