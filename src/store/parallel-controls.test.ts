/**
 * S3.6 — the mode / thread / seed controls rebuild the pipeline from the *real
 * engine*, not a viz hack. Switching to multithread swaps in a genuine forked +
 * merged Slice A log (AC1); the sequential path stays intact (AC2); changing the seed
 * re-interleaves the lanes while the merged result is invariant (AC3). Driven through
 * the store's vanilla API, exactly as the chrome triggers it.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { PLAYHEAD_START, useAppStore } from "./appStore";
import { DEFAULT_CONFIG } from "@/engine/run";
import { serializeLog } from "@/engine/testing/serialize";
import { type EngineEvent } from "@/engine/domain/event";

beforeEach(() => {
  useAppStore.setState({
    config: DEFAULT_CONFIG,
    eventLog: useAppStore.getState().eventLog,
    playhead: PLAYHEAD_START,
  });
});

/** The merged bins from a log's `combine` beat — the invariant across seeds. */
function mergedBins(log: readonly EngineEvent[]): Record<string, number> {
  const combine = log.find((e) => e.kind === "combine");
  if (!combine || combine.kind !== "combine") return {};
  return Object.fromEntries(combine.merged.map((b) => [b.key, b.count]));
}

describe("S3.6 multithread button swaps a real forked log (AC1)", () => {
  it("switching to parallel yields a genuine fork + combine trace", () => {
    const before = useAppStore.getState().eventLog;
    useAppStore.getState().setMode("parallel");
    const log = useAppStore.getState().eventLog;

    expect(log).not.toBe(before); // a new log reference swapped in
    expect(log.some((e) => e.kind === "fork")).toBe(true);
    expect(log.some((e) => e.kind === "combine")).toBe(true);
    expect(log.some((e) => e.kind === "lane-demand")).toBe(true);
    expect(useAppStore.getState().playhead).toBe(PLAYHEAD_START); // reset per policy
  });

  it("the 2/4 thread selector rebuilds the log with that many lanes", () => {
    useAppStore.getState().setMode("parallel");
    useAppStore.getState().setThreads(4);
    const fork4 = useAppStore.getState().eventLog.find((e) => e.kind === "fork");
    expect(fork4?.kind === "fork" && fork4.lanes).toBe(4);

    useAppStore.getState().setThreads(2);
    const fork2 = useAppStore.getState().eventLog.find((e) => e.kind === "fork");
    expect(fork2?.kind === "fork" && fork2.lanes).toBe(2);
  });
});

describe("S3.6 sequential playback still works (AC2)", () => {
  it("returning to sequential swaps back to a genuine grouping trace (no fork)", () => {
    useAppStore.getState().setMode("parallel");
    useAppStore.getState().setMode("sequential");
    const log = useAppStore.getState().eventLog;
    expect(log.some((e) => e.kind === "fork")).toBe(false);
    expect(log.some((e) => e.kind === "accumulate")).toBe(true);
    expect(log.some((e) => e.kind === "demand")).toBe(true); // sequential demand, not lane-demand
  });
});

describe("S3.6 changing the seed re-interleaves the lanes (AC3)", () => {
  it("a new seed changes the log but not the merged result", () => {
    useAppStore.getState().setMode("parallel");
    const seed1 = useAppStore.getState().eventLog;

    useAppStore.getState().setSeed(DEFAULT_CONFIG.seed + 1);
    const seed2 = useAppStore.getState().eventLog;

    // Different interleaving …
    expect(serializeLog(seed2)).not.toBe(serializeLog(seed1));
    // … but the same grouping (interleaving is non-determinism, not a different answer).
    expect(mergedBins(seed2)).toEqual(mergedBins(seed1));
  });
});
