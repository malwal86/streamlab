/**
 * S2.4 — the slice / terminal toggles rebuild the pipeline from the *real engine*,
 * not a viz hack. Toggling the slice swaps in a genuine Slice A (grouping) or Slice
 * B (short-circuit) log (AC1), the playhead resets per the S0.7 policy (AC2), and
 * sequential `findFirst` / `findAny` produce identical playback (AC3). Driven
 * through the store's vanilla API, so the config → re-run → swap flow is exercised
 * exactly as the chrome triggers it.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { PLAYHEAD_START, useAppStore } from "./appStore";
import { DEFAULT_CONFIG } from "@/engine/run";
import { serializeLog } from "@/engine/testing/serialize";

beforeEach(() => {
  useAppStore.setState({
    config: DEFAULT_CONFIG,
    eventLog: useAppStore.getState().eventLog,
    playhead: PLAYHEAD_START,
  });
});

describe("S2.4 slice toggle — swaps a real engine log (AC1)", () => {
  it("Slice B yields a genuine short-circuit trace (found + shortcircuit)", () => {
    const before = useAppStore.getState().eventLog;
    useAppStore.getState().setSlice("B");
    const log = useAppStore.getState().eventLog;

    expect(log).not.toBe(before); // a new log reference swapped in
    expect(log.some((e) => e.kind === "found")).toBe(true);
    expect(log.some((e) => e.kind === "shortcircuit")).toBe(true);
    // ...and it is NOT a grouping run — no bins were accumulated.
    expect(log.some((e) => e.kind === "accumulate")).toBe(false);
  });

  it("Slice A yields a genuine grouping trace (route + accumulate, no short-circuit)", () => {
    useAppStore.getState().setSlice("B"); // move away first
    useAppStore.getState().setSlice("A");
    const log = useAppStore.getState().eventLog;

    expect(log.some((e) => e.kind === "accumulate")).toBe(true);
    expect(log.some((e) => e.kind === "found")).toBe(false);
    expect(log.some((e) => e.kind === "shortcircuit")).toBe(false);
  });
});

describe("S2.4 toggle — playhead resets per policy (AC2)", () => {
  it("rewinds to the start on a slice toggle, regardless of prior position", () => {
    useAppStore.getState().setPlayhead(6.5);
    useAppStore.getState().setSlice("B");
    expect(useAppStore.getState().playhead).toBe(PLAYHEAD_START);
  });

  it("rewinds to the start on a terminal toggle too", () => {
    useAppStore.getState().setSlice("B");
    useAppStore.getState().setPlayhead(4);
    useAppStore.getState().setTerminal("findAny");
    expect(useAppStore.getState().playhead).toBe(PLAYHEAD_START);
  });
});

describe("S2.4 terminal toggle — findFirst ⇄ findAny identical sequentially (AC3)", () => {
  it("both terminals produce byte-identical Slice B playback", () => {
    useAppStore.getState().setSlice("B");

    useAppStore.getState().setTerminal("findFirst");
    const findFirst = serializeLog(useAppStore.getState().eventLog);

    useAppStore.getState().setTerminal("findAny");
    const findAny = serializeLog(useAppStore.getState().eventLog);

    expect(findAny).toBe(findFirst);
  });
});
