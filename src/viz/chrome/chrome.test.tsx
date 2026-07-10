/**
 * S1.10 — the DOM chrome renders and stays in sync with the store (AC3, AC4, AC5).
 * These run in jsdom (no GL needed — the chrome is pure DOM): the step-list mirrors
 * the log, the current row is `aria-current`, the code panel highlights the active
 * op, and the transport controls are keyboard-reachable native elements.
 */
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { PLAYHEAD_START, useAppStore } from "@/store/appStore";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { Transport } from "./Transport";
import { Controls } from "./Controls";
import { CodePanel } from "./CodePanel";
import { StepList } from "./StepList";

beforeEach(() => {
  useAppStore.setState({
    config: DEFAULT_CONFIG,
    eventLog: runEngine(DEFAULT_CONFIG),
    playhead: PLAYHEAD_START,
    playing: false,
  });
});

describe("S1.10 step-list (AC4)", () => {
  it("renders one row per event and marks the current one", () => {
    render(<StepList />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.length).toBe(useAppStore.getState().eventLog.length);
    // Playhead at 0 ⇒ the first row is current.
    expect(rows[0]).toHaveAttribute("aria-current", "true");
  });

  it("moves the current row as the playhead advances", () => {
    render(<StepList />);
    act(() => useAppStore.getState().setPlayhead(4));
    const current = screen.getAllByRole("listitem").filter((li) => li.getAttribute("aria-current"));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(String(useAppStore.getState().eventLog[4]!.tick));
  });
});

describe("S1.10 code panel (AC3)", () => {
  it("highlights the pipeline line matching the current event", () => {
    render(<CodePanel />);
    // Advance to the first `test` (filter) event.
    const log = useAppStore.getState().eventLog;
    act(() => useAppStore.getState().setPlayhead(log.findIndex((e) => e.kind === "test")));
    const active = screen.getByText(/\.filter\(/);
    expect(active).toHaveAttribute("aria-current", "true");
  });
});

describe("S2.4 controls — slice & terminal toggles (AC1, AC2)", () => {
  it("selecting Slice B re-runs the engine and reveals the terminal toggle", () => {
    render(<Controls />);
    // Terminal toggle is Slice-B-only, so it is absent under the default Slice A.
    expect(screen.queryByRole("group", { name: /terminal/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /short-circuit/i }));

    expect(useAppStore.getState().config.slice).toBe("B");
    // A real Slice B run swapped in — its log short-circuits.
    expect(useAppStore.getState().eventLog.some((e) => e.kind === "found")).toBe(true);
    // ...and the findFirst/findAny toggle is now shown, reflecting the current terminal.
    const terminal = screen.getByRole("group", { name: /terminal/i });
    expect(within(terminal).getByRole("button", { name: /findFirst/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("the findAny toggle updates config and resets the playhead (AC2)", () => {
    act(() => useAppStore.getState().setSlice("B"));
    act(() => useAppStore.getState().setPlayhead(3));
    render(<Controls />);

    fireEvent.click(screen.getByRole("button", { name: /findAny/i }));

    expect(useAppStore.getState().config.terminal).toBe("findAny");
    expect(useAppStore.getState().playhead).toBe(PLAYHEAD_START);
  });
});

describe("S3.6 multithread controls — mode / threads / seed (AC1–AC3)", () => {
  it("multithread reveals the thread + seed controls and swaps a forked log", () => {
    render(<Controls />);
    // Sequential by default: no thread/seed controls yet.
    expect(screen.queryByRole("group", { name: /threads/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /multithread/i }));

    expect(useAppStore.getState().config.mode).toBe("parallel");
    expect(useAppStore.getState().eventLog.some((e) => e.kind === "fork")).toBe(true);
    // The thread selector appears, reflecting the current 2-lane default.
    const threads = screen.getByRole("group", { name: /threads/i });
    expect(within(threads).getByRole("button", { name: "2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: /seed/i })).toBeInTheDocument();
  });

  it("the 4-thread button rebuilds the log with four lanes", () => {
    act(() => useAppStore.getState().setMode("parallel"));
    render(<Controls />);

    fireEvent.click(screen.getByRole("button", { name: "4" }));

    expect(useAppStore.getState().config.threadCount).toBe(4);
    const fork = useAppStore.getState().eventLog.find((e) => e.kind === "fork");
    expect(fork?.kind === "fork" && fork.lanes).toBe(4);
  });

  it("reseed re-runs the engine and resets the playhead", () => {
    act(() => useAppStore.getState().setMode("parallel"));
    act(() => useAppStore.getState().setPlayhead(5));
    render(<Controls />);

    fireEvent.click(screen.getByRole("button", { name: /new seed/i }));

    expect(useAppStore.getState().config.seed).toBe(DEFAULT_CONFIG.seed + 1);
    expect(useAppStore.getState().playhead).toBe(PLAYHEAD_START);
  });
});

describe("S4.4 parallel terminal toggle — the findFirst⇄findAny contrast (chrome)", () => {
  it("Slice B parallel shows the ordered-vs-first-home hint by the terminal toggle", () => {
    act(() => useAppStore.getState().setSlice("B"));
    render(<Controls />);
    // Sequential Slice B: the toggle exists but no hint (the two are identical).
    expect(screen.queryByText(/ordered vs first-home/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /multithread/i }));
    // In parallel the hint appears — this is where the A/B contrast lives.
    expect(screen.getByText(/ordered vs first-home/i)).toBeInTheDocument();
  });

  it("toggling findAny in Slice B parallel rebuilds a real forked short-circuit log", () => {
    act(() => useAppStore.getState().setSlice("B"));
    act(() => useAppStore.getState().setMode("parallel"));
    render(<Controls />);

    fireEvent.click(screen.getByRole("button", { name: /findAny/i }));

    const log = useAppStore.getState().eventLog;
    expect(useAppStore.getState().config.terminal).toBe("findAny");
    expect(log.some((e) => e.kind === "fork")).toBe(true);
    expect(log.some((e) => e.kind === "found")).toBe(true);
    expect(log.some((e) => e.kind === "cancel")).toBe(true);
  });

  it("the code panel reads parallelStream() under multithread, stream() sequentially", () => {
    act(() => useAppStore.getState().setSlice("B"));
    render(<CodePanel />);
    expect(screen.getByText(/orders\.stream\(\)/)).toBeInTheDocument();

    act(() => useAppStore.getState().setMode("parallel"));
    expect(screen.getByText(/orders\.parallelStream\(\)/)).toBeInTheDocument();
    expect(screen.getByText(/\.findFirst\(\)/)).toBeInTheDocument();
  });
});

describe("S2.4 code panel — tracks the selected slice/terminal", () => {
  it("shows the grouping collector for Slice A", () => {
    render(<CodePanel />);
    expect(screen.getByText(/\.collect\(groupingBy/)).toBeInTheDocument();
  });

  it("shows the selected short-circuit terminal for Slice B", () => {
    act(() => useAppStore.getState().setSlice("B"));
    act(() => useAppStore.getState().setTerminal("findAny"));
    render(<CodePanel />);
    expect(screen.getByText(/\.findAny\(\)/)).toBeInTheDocument();
    expect(screen.queryByText(/groupingBy/)).toBeNull();
  });

  it("highlights the terminal line on the Slice B found event", () => {
    act(() => useAppStore.getState().setSlice("B"));
    const log = useAppStore.getState().eventLog;
    act(() => useAppStore.getState().setPlayhead(log.findIndex((e) => e.kind === "found")));
    render(<CodePanel />);
    expect(screen.getByText(/\.findFirst\(\)/)).toHaveAttribute("aria-current", "true");
  });
});

describe("S1.10 transport (AC1, AC5)", () => {
  it("step forward advances exactly one event and pauses", () => {
    render(<Transport />);
    act(() => useAppStore.setState({ playhead: 2, playing: true }));
    fireEvent.click(screen.getByRole("button", { name: /step forward/i }));
    expect(useAppStore.getState().playhead).toBe(3);
    expect(useAppStore.getState().playing).toBe(false);
  });

  it("play/pause toggles play-state; controls are labelled native buttons", () => {
    render(<Transport />);
    const group = screen.getByRole("group", { name: /transport/i });
    const play = within(group).getByRole("button", { name: /play/i });
    fireEvent.click(play);
    expect(useAppStore.getState().playing).toBe(true);
  });

  it("scrub sets the playhead and pauses", () => {
    render(<Transport />);
    const scrub = screen.getByRole("slider", { name: /scrub/i });
    fireEvent.change(scrub, { target: { value: "6" } });
    expect(useAppStore.getState().playhead).toBe(6);
    expect(useAppStore.getState().playing).toBe(false);
  });
});
