/**
 * S0.7 store tests: the config → re-run → frozen-log-swap → playhead-reset flow
 * (AC1, AC4) for every action. Zustand's vanilla API (`getState`/`setState`) lets
 * the store be driven without React.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { PLAYHEAD_START, useAppStore } from "./appStore";
import { DEFAULT_CONFIG } from "@/engine/run";

/** Restore the store to its boot state before each test (Zustand persists across a file). */
beforeEach(() => {
  useAppStore.setState({
    config: DEFAULT_CONFIG,
    eventLog: useAppStore.getState().eventLog,
    playhead: PLAYHEAD_START,
  });
});

describe("engine re-run on config change (AC1)", () => {
  const cases = [
    ["setSlice", () => useAppStore.getState().setSlice("B"), { slice: "B" }],
    ["setMode", () => useAppStore.getState().setMode("parallel"), { mode: "parallel" }],
    ["setThreads", () => useAppStore.getState().setThreads(4), { threadCount: 4 }],
    ["setSeed", () => useAppStore.getState().setSeed(42), { seed: 42 }],
    ["setTerminal", () => useAppStore.getState().setTerminal("findAny"), { terminal: "findAny" }],
  ] as const;

  it.each(cases)(
    "%s updates config, swaps a fresh frozen log, and resets the playhead",
    (_name, act, patch) => {
      // Advance the playhead so a reset is observable.
      useAppStore.getState().setPlayhead(3.5);
      const before = useAppStore.getState().eventLog;

      act();

      const after = useAppStore.getState();
      expect(after.config).toMatchObject(patch); // config field applied
      expect(after.eventLog).not.toBe(before); // a *new* log reference was swapped in (AC1)
      expect(Object.isFrozen(after.eventLog)).toBe(true); // and it is frozen (AC1)
      expect(after.playhead).toBe(PLAYHEAD_START); // reset policy (AC4)
    },
  );
});

describe("playhead reset policy (AC4)", () => {
  it("rewinds to the start (0) on every re-run, regardless of prior position", () => {
    useAppStore.getState().setPlayhead(7);
    useAppStore.getState().setSeed(99);
    expect(useAppStore.getState().playhead).toBe(0);
  });

  it("setPlayhead moves the playhead without re-running the engine", () => {
    const log = useAppStore.getState().eventLog;
    useAppStore.getState().setPlayhead(2);
    expect(useAppStore.getState().playhead).toBe(2);
    expect(useAppStore.getState().eventLog).toBe(log); // same reference — no re-run
  });
});

describe("boot state", () => {
  it("starts from DEFAULT_CONFIG with a frozen log and the playhead at the start", () => {
    const s = useAppStore.getState();
    expect(s.config).toEqual(DEFAULT_CONFIG);
    expect(Object.isFrozen(s.eventLog)).toBe(true);
    expect(s.eventLog.length).toBeGreaterThan(0);
    expect(s.playhead).toBe(PLAYHEAD_START);
  });
});
