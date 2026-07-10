/**
 * S1.5 — the beat caption is a pure read of `(log, playhead)`: `tryAdvance()` while
 * the demand spike travels, the active stage while the pulse flies.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { captionFor } from "./projection";

const LOG = runEngine(DEFAULT_CONFIG);

describe("S1.5 caption", () => {
  it("reads spliterator.tryAdvance() during a demand beat", () => {
    const demandIdx = LOG.findIndex((e) => e.kind === "demand");
    expect(captionFor(LOG, demandIdx + 0.4)).toBe("spliterator.tryAdvance()");
  });

  it("names the map stage when the pulse is at a transform", () => {
    const transformIdx = LOG.findIndex((e) => e.kind === "transform");
    expect(captionFor(LOG, transformIdx + 0.1)).toMatch(/applyDiscount/);
  });

  it("is empty for an empty log", () => {
    expect(captionFor([], 0)).toBe("");
  });
});
