/**
 * S0.7 selector tests: purity + referential stability (AC2), and that the
 * projection reads straight off the log (R2 — no invented outcomes).
 */
import { describe, it, expect } from "vitest";
import { selectViewState } from "./select";
import { runEngine, DEFAULT_CONFIG } from "@/engine/run";

const LOG = runEngine(DEFAULT_CONFIG);

describe("selectViewState referential stability (AC2)", () => {
  it("returns the identically-referenced view for the same (log, playhead)", () => {
    expect(selectViewState(LOG, 2)).toBe(selectViewState(LOG, 2));
  });

  it("returns a different view when the playhead changes", () => {
    expect(selectViewState(LOG, 2)).not.toBe(selectViewState(LOG, 3));
  });

  it("is stable again after an intervening different call (recomputes, still equal by value)", () => {
    const a1 = selectViewState(LOG, 1);
    selectViewState(LOG, 5); // evict the 1-entry memo
    const a2 = selectViewState(LOG, 1);
    expect(a2).toEqual(a1); // structurally identical — pure
  });
});

describe("selectViewState projection (R2)", () => {
  it("rests on the floor(playhead) event and exposes the fractional remainder", () => {
    const view = selectViewState(LOG, 2.25);
    expect(view.eventIndex).toBe(2);
    expect(view.event).toBe(LOG[2]);
    expect(view.frac).toBeCloseTo(0.25);
  });

  it("clamps a playhead past the end to the last event and latches atEnd", () => {
    const view = selectViewState(LOG, 1_000);
    expect(view.eventIndex).toBe(LOG.length - 1);
    expect(view.event).toBe(LOG[LOG.length - 1]);
    expect(view.atEnd).toBe(true);
  });

  it("clamps a negative playhead to the first event", () => {
    const view = selectViewState(LOG, -5);
    expect(view.eventIndex).toBe(0);
    expect(view.event).toBe(LOG[0]);
  });

  it("returns the empty view for an empty log", () => {
    const view = selectViewState([], 0);
    expect(view.event).toBeNull();
    expect(view.eventIndex).toBe(-1);
    expect(view.atEnd).toBe(true);
  });

  it("never invents an outcome — event is always a member of the log or null", () => {
    for (const p of [0, 0.5, 1, 2.9, LOG.length - 1, LOG.length + 3]) {
      const view = selectViewState(LOG, p);
      expect(view.event === null || LOG.includes(view.event)).toBe(true);
    }
  });
});
