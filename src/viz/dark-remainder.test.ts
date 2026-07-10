/**
 * S2.3 — the never-pulled dark remainder is a pure projection of the log. The
 * source stack's total is the whole source; its dark, never-pulled tail (and the
 * counter) equal `shortcircuit.remainingUnpulled` (AC2); and no forward pulse is
 * ever rendered for an un-pulled element, because they have no `emit` (AC1). Slice
 * A pulls everything, so nothing ever goes dark.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { ORDERS } from "@/engine/domain/fixture";
import { projectScene } from "./projection";

const SLICE_B = runEngine({ ...DEFAULT_CONFIG, slice: "B", mode: "sequential" });
const SLICE_A = runEngine({ ...DEFAULT_CONFIG, slice: "A", mode: "sequential" });
const SC_IDX = SLICE_B.findIndex((e) => e.kind === "shortcircuit");
const REMAINING = (() => {
  const sc = SLICE_B[SC_IDX];
  return sc?.kind === "shortcircuit" ? sc.remainingUnpulled : -1;
})();

describe("S2.3 dark remainder — the counter equals shortcircuit.remainingUnpulled (AC2)", () => {
  it("reveals exactly `remainingUnpulled` dark slots once the playhead reaches shortcircuit", () => {
    expect(REMAINING).toBe(9);
    expect(projectScene(SLICE_B, SC_IDX).source.neverPulledCount).toBe(REMAINING);
  });

  it("stays 0 before the shortcircuit beat (the remainder is not yet revealed)", () => {
    expect(projectScene(SLICE_B, SC_IDX - 1).source.neverPulledCount).toBe(0);
  });
});

describe("S2.3 dark remainder — the stack shows the whole source", () => {
  it("total == source size (pulled emits + never-pulled remainder) == fixture size", () => {
    expect(projectScene(SLICE_B, SLICE_B.length - 1).source.total).toBe(ORDERS.length);
    // Cross-check: emits in the log + the revealed remainder.
    const emits = SLICE_B.filter((e) => e.kind === "emit").length;
    expect(emits + REMAINING).toBe(ORDERS.length);
  });
});

describe("S2.3 dark remainder — no forward emit is rendered for dark elements (AC1)", () => {
  it("every rendered pulse belongs to an element that actually emitted", () => {
    // The un-pulled set is exactly the elements with no `emit`. If a pulse were ever
    // drawn for one of them, its id would not appear among the emits — assert it never does.
    const emittedIds = new Set(
      SLICE_B.filter((e) => e.kind === "emit").map((e) => (e.kind === "emit" ? e.elementId : -1)),
    );
    for (let i = 0; i < SLICE_B.length; i += 1) {
      const { pulse } = projectScene(SLICE_B, i);
      if (pulse) expect(emittedIds.has(pulse.elementId)).toBe(true);
    }
    // And the dark set is genuinely non-empty (this run really did short-circuit).
    expect(emittedIds.size).toBeLessThan(ORDERS.length);
  });
});

describe("S2.3 dark remainder — Slice A pulls everything", () => {
  it("never goes dark; the stack total equals the emit count", () => {
    const emits = SLICE_A.filter((e) => e.kind === "emit").length;
    for (let i = 0; i < SLICE_A.length; i += 1) {
      const { source } = projectScene(SLICE_A, i);
      expect(source.neverPulledCount).toBe(0);
      expect(source.total).toBe(emits);
    }
  });
});
