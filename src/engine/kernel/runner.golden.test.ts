import { describe, it, expect } from "vitest";
import { ORDERS } from "../domain/fixture";
import { assertMatchesGolden } from "../testing/golden";
import { isSingleFilePull } from "../testing/logInvariants";
import { identityPipeline, runSequential } from "./runner";

/**
 * S0.5 test plan — the committed golden of the identity run over the real fixture.
 * This is the first log produced by the *actual engine* (not hand-built like the
 * S0.2/S0.4 samples): a real `Spliterator` pull driving a real `Sink` chain. A diff
 * here means the kernel's traversal or emission changed (R4). Regenerate
 * intentionally with `UPDATE_GOLDEN=1 npm run test:golden`.
 */
describe("golden — identity sequential run over the fixture", () => {
  it("matches the committed golden snapshot", () => {
    const { log } = runSequential(identityPipeline(ORDERS));
    assertMatchesGolden("identity-sequential", log);
  });

  it("the golden log itself satisfies the single-file invariant", () => {
    // Belt-and-braces: the very bytes we commit are a well-formed pull trace.
    const { log } = runSequential(identityPipeline(ORDERS));
    expect(isSingleFilePull(log)).toBe(true);
  });
});
