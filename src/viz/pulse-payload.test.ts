/**
 * S1.6 AC4 — the pulse carries the element's real payload (region + total) read
 * straight from its `emit`, so the encoding is a pure function of the data. Uses
 * the canonical Slice A log: element #2 is West / $1200.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { projectScene } from "./projection";

const LOG = runEngine(DEFAULT_CONFIG);

describe("S1.6 pulse payload", () => {
  it("the in-flight pulse carries its element's region and total from the emit", () => {
    // Find the `test` beat for element #2 ($1200, West) — the pulse is mid-conduit.
    const testIdx = LOG.findIndex((e) => e.kind === "test" && e.elementId === 2);
    const { pulse } = projectScene(LOG, testIdx + 0.2);
    expect(pulse).toMatchObject({ elementId: 2, region: "West", total: 1200 });
  });

  it("carries East / $450 for element #4", () => {
    const emitIdx = LOG.findIndex((e) => e.kind === "emit" && e.elementId === 4);
    const { pulse } = projectScene(LOG, emitIdx + 0.1);
    expect(pulse).toMatchObject({ elementId: 4, region: "East", total: 450 });
  });
});
