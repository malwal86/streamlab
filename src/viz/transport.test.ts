/**
 * S1.10 — transport logic (pure): stepping lands exactly one event per activation
 * and is reversible (AC1, AC2), and the active stage tracks the current event for
 * the code-panel highlight (AC3).
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { activeStageFor, currentEventIndex, stepIndex } from "./transport";

const LOG = runEngine(DEFAULT_CONFIG);

describe("S1.10 step — one event per activation (AC1)", () => {
  it("forward advances to the next integer event", () => {
    expect(stepIndex(2, LOG.length, 1)).toBe(3);
    expect(stepIndex(2.4, LOG.length, 1)).toBe(3); // mid-beat snaps forward
  });

  it("backward advances to the previous integer event", () => {
    expect(stepIndex(3, LOG.length, -1)).toBe(2);
    expect(stepIndex(2.4, LOG.length, -1)).toBe(2); // mid-beat snaps back
  });

  it("is reversible — forward then back returns to the same event (AC2)", () => {
    const start = 5;
    const forward = stepIndex(start, LOG.length, 1);
    expect(stepIndex(forward, LOG.length, -1)).toBe(start);
  });

  it("clamps at both ends", () => {
    expect(stepIndex(0, LOG.length, -1)).toBe(0);
    expect(stepIndex(LOG.length - 1, LOG.length, 1)).toBe(LOG.length - 1);
    expect(stepIndex(0, 0, 1)).toBe(0); // empty log
  });
});

describe("S1.10 current event index", () => {
  it("floors the playhead into the log domain", () => {
    expect(currentEventIndex(0, LOG.length)).toBe(0);
    expect(currentEventIndex(3.9, LOG.length)).toBe(3);
    expect(currentEventIndex(999, LOG.length)).toBe(LOG.length - 1);
    expect(currentEventIndex(0, 0)).toBe(-1);
  });
});

describe("S1.10 active stage — code panel highlight (AC3)", () => {
  it("highlights the stage matching the current event", () => {
    const filterIdx = LOG.findIndex((e) => e.kind === "test");
    const mapIdx = LOG.findIndex((e) => e.kind === "transform");
    const emitIdx = LOG.findIndex((e) => e.kind === "emit");
    const accIdx = LOG.findIndex((e) => e.kind === "accumulate");
    expect(activeStageFor(LOG, filterIdx)).toBe("filter");
    expect(activeStageFor(LOG, mapIdx)).toBe("map");
    expect(activeStageFor(LOG, emitIdx)).toBe("source");
    expect(activeStageFor(LOG, accIdx)).toBe("collect");
  });

  it("is null for an empty log", () => {
    expect(activeStageFor([], 0)).toBeNull();
  });
});
