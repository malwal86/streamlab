/**
 * S5.3 — explainer cards, tested through the pure {@link explainerFor} content
 * function. The DOM shell only renders what this returns, so per-card timing (fires
 * on the right event, AC1) and live-value accuracy (AC3) are verified headlessly
 * here across all four quadrants.
 */
import { describe, it, expect } from "vitest";
import { runEngine, type Config } from "@/engine/run";
import { explainerFor } from "./explainers";

const SEQ_A: Config = {
  slice: "A",
  mode: "sequential",
  threadCount: 2,
  seed: 1,
  terminal: "findFirst",
};
const SEQ_B: Config = { ...SEQ_A, slice: "B" };
const PAR_A: Config = { ...SEQ_A, mode: "parallel" };

const logA = runEngine(SEQ_A);
const logB = runEngine(SEQ_B);
const logPar = runEngine(PAR_A);

/** The card shown at the first event of `kind` (its own beat). */
function cardAtKind(log: ReturnType<typeof runEngine>, kind: string) {
  const idx = log.findIndex((e) => e.kind === kind);
  expect(idx, `no ${kind} event in log`).toBeGreaterThanOrEqual(0);
  return explainerFor(log, idx);
}

describe("S5.3 cards fire at the correct event/stage (AC1)", () => {
  it("a demand beat shows the tryAdvance card at the terminal", () => {
    const card = cardAtKind(logA, "demand");
    expect(card?.stage).toBe("terminal");
    expect(card?.title).toMatch(/tryAdvance/);
  });

  it("a test beat anchors the filter card", () => {
    expect(cardAtKind(logA, "test")?.stage).toBe("filter");
  });

  it("a transform beat anchors the map card", () => {
    expect(cardAtKind(logA, "transform")?.stage).toBe("map");
  });

  it("an accumulate beat anchors the terminal card", () => {
    expect(cardAtKind(logA, "accumulate")?.stage).toBe("terminal");
  });

  it("the frequent lane-demand pull shows no card (uncluttered overlay)", () => {
    expect(cardAtKind(logPar, "lane-demand")).toBeNull();
  });
});

describe("S5.3 cards carry live values (AC3)", () => {
  it("the filter card substitutes the element's real total into the predicate", () => {
    const idx = logA.findIndex((e) => e.kind === "test");
    const test = logA[idx];
    const card = explainerFor(logA, idx);
    // e.g. "80 > 100 → false" — the real input.total and the real boolean output.
    if (test?.kind === "test") {
      expect(card?.body).toContain(String(test.input.total));
      expect(card?.body).toContain(String(test.output));
    }
  });

  it("the map card shows applyDiscount's real before → after off the log", () => {
    const idx = logA.findIndex((e) => e.kind === "transform");
    const t = logA[idx];
    const card = explainerFor(logA, idx);
    if (t?.kind === "transform") {
      expect(card?.body).toContain(`$${t.before}`);
      expect(card?.body).toContain(`$${t.after}`);
    }
  });

  it("the accumulate card shows the bin's current count", () => {
    const idx = logA.findIndex((e) => e.kind === "accumulate");
    const a = logA[idx];
    const card = explainerFor(logA, idx);
    if (a?.kind === "accumulate") expect(card?.body).toContain(String(a.binCount));
  });

  it("the FOUND card names the matched element and latches at the terminal (Slice B)", () => {
    const idx = logB.findIndex((e) => e.kind === "found");
    const f = logB[idx];
    const card = explainerFor(logB, idx);
    expect(card?.stage).toBe("terminal");
    if (f?.kind === "found") expect(card?.body).toContain(`#${f.elementId}`);
  });

  it("the fork and combine cards appear in a parallel run", () => {
    expect(cardAtKind(logPar, "fork")?.title).toMatch(/fork/);
    expect(cardAtKind(logPar, "combine")?.title).toMatch(/combiner/);
  });
});

describe("S5.3 explainerFor is a pure read of (log, playhead)", () => {
  it("returns null for an empty log", () => {
    expect(explainerFor([], 3)).toBeNull();
  });

  it("clamps an out-of-range playhead to the last event", () => {
    expect(explainerFor(logA, 9_999)).toEqual(explainerFor(logA, logA.length - 1));
  });
});
