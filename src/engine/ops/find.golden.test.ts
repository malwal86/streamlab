/**
 * S2.1 AC4 — committed goldens of the **canonical Slice B sequential** run over the
 * fixture, for both terminals. `findFirst` and `findAny` are identical sequentially
 * (spec §3.2), so the two goldens are byte-identical by construction — the third
 * test pins that equivalence directly, so a future divergence (e.g. a terminal that
 * accidentally reordered) fails the build. A diff in either golden means the Slice B
 * pipeline's semantics changed (R4). Regenerate with `UPDATE_GOLDEN=1 npm run test:golden`.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "../run";
import { assertMatchesGolden } from "../testing/golden";
import { isSingleFilePull } from "../testing/logInvariants";
import { serializeLog } from "../testing/serialize";

const SLICE_B = { ...DEFAULT_CONFIG, slice: "B", mode: "sequential" } as const;
const FIND_FIRST = runEngine({ ...SLICE_B, terminal: "findFirst" });
const FIND_ANY = runEngine({ ...SLICE_B, terminal: "findAny" });

describe("golden — Slice B sequential (filter → map → find*) over the fixture", () => {
  it("matches the committed golden for findFirst", () => {
    assertMatchesGolden("slice-b-findfirst-sequential", FIND_FIRST);
  });

  it("matches the committed golden for findAny", () => {
    assertMatchesGolden("slice-b-findany-sequential", FIND_ANY);
  });

  it("findFirst and findAny produce byte-identical sequential logs (AC4)", () => {
    expect(serializeLog(FIND_ANY)).toBe(serializeLog(FIND_FIRST));
  });

  it("the canonical Slice B log satisfies the single-file invariant", () => {
    expect(isSingleFilePull(FIND_FIRST)).toBe(true);
  });
});
