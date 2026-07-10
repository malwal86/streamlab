/**
 * S1.4 — the scene's read of the log. `sourceStackCount` must equal the number of
 * elements the engine emits, so the inert source stack always shows exactly what
 * will be pulled. Uses the real Slice A log so the count is grounded in a genuine
 * run, not a hand-built stub.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { sourceStackCount } from "./projection";

describe("S1.4 source stack", () => {
  it("counts the emit events in the log (every element the source releases)", () => {
    const log = runEngine(DEFAULT_CONFIG);
    const emits = log.filter((e) => e.kind === "emit").length;
    expect(sourceStackCount(log)).toBe(emits);
  });

  it("equals the fixture size for the canonical Slice A run (11 orders)", () => {
    expect(sourceStackCount(runEngine(DEFAULT_CONFIG))).toBe(11);
  });

  it("is zero for an empty log", () => {
    expect(sourceStackCount([])).toBe(0);
  });
});
