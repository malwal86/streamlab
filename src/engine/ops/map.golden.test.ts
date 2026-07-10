/**
 * S1.2 AC3 — the committed golden of `source → filter → map → identity` over the
 * fixture: the filtered-and-mapped sub-log, now carrying `transform` events. A diff
 * means the map's emission or the pull under it changed (R4). Regenerate
 * intentionally with `UPDATE_GOLDEN=1 npm run test:golden`.
 */
import { describe, it, expect } from "vitest";
import { ORDERS } from "../domain/fixture";
import { arraySpliterator } from "../kernel/spliterator";
import { identityTerminal, runSequential } from "../kernel/runner";
import { assertMatchesGolden } from "../testing/golden";
import { isSingleFilePull } from "../testing/logInvariants";
import { sliceFilterOp } from "./filter";
import { sliceMapOp } from "./map";

describe("golden — filter+map sequential run over the fixture", () => {
  it("matches the committed golden snapshot", () => {
    const { log } = runSequential({
      source: arraySpliterator(ORDERS),
      ops: [sliceFilterOp(), sliceMapOp()],
      terminal: identityTerminal(),
    });
    assertMatchesGolden("map-sequential", log);
  });

  it("the mapped log still satisfies the single-file invariant", () => {
    const { log } = runSequential({
      source: arraySpliterator(ORDERS),
      ops: [sliceFilterOp(), sliceMapOp()],
      terminal: identityTerminal(),
    });
    expect(isSingleFilePull(log)).toBe(true);
  });
});
