/**
 * S1.1 AC4 — the committed golden of `source → filter → identity` over the fixture:
 * the canonical filtered sub-log. It captures the exact interleaving of
 * `demand`/`emit`/`test`/`survive`/`die` the viz will replay, so any change to the
 * filter's emission (or the pull loop under it) is a loud, readable diff (R4).
 * Regenerate intentionally with `UPDATE_GOLDEN=1 npm run test:golden`.
 */
import { describe, it, expect } from "vitest";
import { ORDERS } from "../domain/fixture";
import { arraySpliterator } from "../kernel/spliterator";
import { identityTerminal, runSequential } from "../kernel/runner";
import { assertMatchesGolden } from "../testing/golden";
import { isSingleFilePull } from "../testing/logInvariants";
import { sliceFilterOp } from "./filter";

describe("golden — filter sequential run over the fixture", () => {
  it("matches the committed golden snapshot", () => {
    const { log } = runSequential({
      source: arraySpliterator(ORDERS),
      ops: [sliceFilterOp()],
      terminal: identityTerminal(),
    });
    assertMatchesGolden("filter-sequential", log);
  });

  it("the filtered log still satisfies the single-file invariant", () => {
    const { log } = runSequential({
      source: arraySpliterator(ORDERS),
      ops: [sliceFilterOp()],
      terminal: identityTerminal(),
    });
    expect(isSingleFilePull(log)).toBe(true);
  });
});
