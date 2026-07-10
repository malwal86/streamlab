/**
 * S1.10 — the DOM chrome renders and stays in sync with the store (AC3, AC4, AC5).
 * These run in jsdom (no GL needed — the chrome is pure DOM): the step-list mirrors
 * the log, the current row is `aria-current`, the code panel highlights the active
 * op, and the transport controls are keyboard-reachable native elements.
 */
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { PLAYHEAD_START, useAppStore } from "@/store/appStore";
import { DEFAULT_CONFIG } from "@/engine/run";
import { Transport } from "./Transport";
import { CodePanel } from "./CodePanel";
import { StepList } from "./StepList";

beforeEach(() => {
  useAppStore.setState({
    config: DEFAULT_CONFIG,
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
