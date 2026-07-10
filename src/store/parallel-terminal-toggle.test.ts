/**
 * S4.4 — the Slice-B **parallel** `findFirst` ⇄ `findAny` toggle rebuilds the pipeline
 * from the *real engine* and makes the canonical interview contrast visible on one seed
 * (Decision 31). Where sequentially the two terminals are byte-identical (S2.4 AC3),
 * in parallel they diverge — the whole point of the multithread demo. Driven through
 * the store's vanilla API, exactly as the chrome toggle triggers it.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { PLAYHEAD_START, useAppStore } from "./appStore";
import { DEFAULT_CONFIG } from "@/engine/run";
import { serializeLog } from "@/engine/testing/serialize";
import { type EngineEvent } from "@/engine/domain/event";

/** The id the log's `found` event latched, or undefined when nothing matched. */
function foundId(log: readonly EngineEvent[]): number | undefined {
  const found = log.find((e) => e.kind === "found");
  return found?.kind === "found" ? found.elementId : undefined;
}

beforeEach(() => {
  // Boot into Slice B, multithread, on a seed where the two terminals diverge.
  useAppStore.setState({
    config: { ...DEFAULT_CONFIG, slice: "B", mode: "parallel", threadCount: 4, seed: 5 },
    eventLog: useAppStore.getState().eventLog,
    playhead: PLAYHEAD_START,
  });
  // Re-run the engine for that config via the real action path.
  useAppStore.getState().setTerminal("findFirst");
});

describe("S4.4 parallel terminal toggle — rebuilds the real engine log (AC1)", () => {
  it("toggling swaps in a genuine forked short-circuit trace (fork + found + cancel)", () => {
    const before = useAppStore.getState().eventLog;
    useAppStore.getState().setTerminal("findAny");
    const log = useAppStore.getState().eventLog;

    expect(log).not.toBe(before); // a new log reference swapped in
    // A real parallel short-circuit run: forked lanes, a match, and cancellations —
    // and NOT a grouping run (no bins).
    expect(log.some((e) => e.kind === "fork")).toBe(true);
    expect(log.some((e) => e.kind === "lane-demand")).toBe(true);
    expect(log.some((e) => e.kind === "found")).toBe(true);
    expect(log.some((e) => e.kind === "cancel")).toBe(true);
    expect(log.some((e) => e.kind === "accumulate")).toBe(false);
  });

  it("rewinds the playhead to the start on the toggle (S0.7 policy)", () => {
    useAppStore.getState().setPlayhead(7);
    useAppStore.getState().setTerminal("findAny");
    expect(useAppStore.getState().playhead).toBe(PLAYHEAD_START);
  });
});

describe("S4.4 parallel terminal toggle — the contrast is real, on the same seed (AC2)", () => {
  it("findFirst and findAny latch different elements without changing the seed", () => {
    // seed stays 5 across the toggle — a genuine same-seed comparison.
    useAppStore.getState().setTerminal("findFirst");
    const first = useAppStore.getState().eventLog;
    const firstSeed = useAppStore.getState().config.seed;

    useAppStore.getState().setTerminal("findAny");
    const any = useAppStore.getState().eventLog;

    expect(useAppStore.getState().config.seed).toBe(firstSeed); // same seed
    expect(serializeLog(any)).not.toBe(serializeLog(first)); // different trace
    // findFirst holds out for the encounter-order-earliest (#2); findAny takes the
    // first lane home — here the decoy (#9). The lesson made visible.
    expect(foundId(first)).toBe(2);
    expect(foundId(any)).toBe(9);
  });

  it("findFirst is seed-invariant while findAny varies with the seed", () => {
    const anyResults = new Set<number | undefined>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      useAppStore.getState().setSeed(seed);
      useAppStore.getState().setTerminal("findFirst");
      expect(foundId(useAppStore.getState().eventLog)).toBe(2); // never wavers
      useAppStore.getState().setTerminal("findAny");
      anyResults.add(foundId(useAppStore.getState().eventLog));
    }
    expect(anyResults.size).toBeGreaterThan(1); // findAny is genuinely non-deterministic
  });
});
