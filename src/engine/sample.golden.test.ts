import { describe, it, expect } from "vitest";
import { assertMatchesGolden } from "./testing/golden";
import { serializeLog } from "./testing/serialize";
import { SAMPLE_LOG } from "./testing/sampleLog";

/**
 * Worked golden-snapshot example (S0.2 AC3). The hand-built `SAMPLE_LOG`
 * serializes to `src/engine/__golden__/sample-log.json`; this test both proves
 * the harness works and gives CI a committed golden to compare against on every
 * push. Regenerate intentionally with `UPDATE_GOLDEN=1 npm run test:golden`.
 */
describe("golden harness — hand-built sample log", () => {
  it("matches the committed golden snapshot", () => {
    assertMatchesGolden("sample-log", SAMPLE_LOG);
  });

  it("serializes to the same bytes when the log is rebuilt key-shuffled", () => {
    // Same logical events, different key order + a volatile field: canonical
    // serialization must be identical, so the golden is a meaningful diff.
    const shuffled = SAMPLE_LOG.map((e) => {
      const reversed: Record<string, unknown> = { timestamp: 123 };
      for (const key of Object.keys(e).reverse()) reversed[key] = e[key];
      return reversed;
    });
    expect(serializeLog(shuffled)).toBe(serializeLog(SAMPLE_LOG));
  });
});
