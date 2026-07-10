/**
 * S2.2 — the terminal's FOUND latch is a pure projection of the log. The latched
 * element is exactly the engine's `found.elementId` (AC1), the latch appears only
 * once the playhead reaches `found` and then persists (the "latch" semantics), and
 * Slice A — which never short-circuits — never latches. Asserted from
 * `projectScene`, so the visual can never invent or drift from the engine's result.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { FIND_FIRST_TARGET_ID } from "@/engine/domain/fixture";
import { stageX } from "./geometry";
import { projectScene } from "./projection";

const SLICE_B = runEngine({ ...DEFAULT_CONFIG, slice: "B", mode: "sequential" });
const SLICE_A = runEngine({ ...DEFAULT_CONFIG, slice: "A", mode: "sequential" });
const FOUND_IDX = SLICE_B.findIndex((e) => e.kind === "found");

describe("S2.2 FOUND latch — matches the engine's found element (AC1)", () => {
  it("latches on exactly `found.elementId` (the target #2)", () => {
    const { found } = projectScene(SLICE_B, FOUND_IDX);
    expect(found).not.toBeNull();
    expect(found?.elementId).toBe(FIND_FIRST_TARGET_ID);
    // Carries the matched element's payload for the color-independent badge.
    expect(found?.region).toBe("West");
    expect(found?.total).toBe(1080); // post-map (discounted) total it carried in
  });

  it("the latched id always equals the log's found event id", () => {
    const foundEvent = SLICE_B[FOUND_IDX]!;
    const { found } = projectScene(SLICE_B, SLICE_B.length - 1);
    expect(foundEvent.kind === "found" && found?.elementId === foundEvent.elementId).toBe(true);
  });
});

describe("S2.2 FOUND latch — latch semantics", () => {
  it("is null before the found beat and non-null from it onward", () => {
    expect(projectScene(SLICE_B, FOUND_IDX - 1).found).toBeNull();
    expect(projectScene(SLICE_B, FOUND_IDX).found).not.toBeNull();
  });

  it("persists to the end of the run (past the shortcircuit event)", () => {
    // The last event is `shortcircuit` (a non-heartbeat beat) — the latch still shows.
    expect(projectScene(SLICE_B, SLICE_B.length - 1).found).not.toBeNull();
  });

  it("holds under reduced motion (meaning preserved, not just animation)", () => {
    expect(projectScene(SLICE_B, FOUND_IDX, { reducedMotion: true }).found?.elementId).toBe(
      FIND_FIRST_TARGET_ID,
    );
  });
});

describe("S2.2 FOUND latch — the found pulse rests at the terminal", () => {
  it("on the found beat the pulse latches at the terminal, fully lit", () => {
    const { pulse } = projectScene(SLICE_B, FOUND_IDX);
    expect(pulse?.elementId).toBe(FIND_FIRST_TARGET_ID);
    expect(pulse?.x).toBeCloseTo(stageX("terminal"));
    expect(pulse?.opacity).toBe(1);
    expect(pulse?.z).toBeCloseTo(0); // latches on-axis, not routed off to a bin
  });
});

describe("S2.2 FOUND latch — Slice A never latches", () => {
  it("no found latch anywhere in a grouping run", () => {
    for (let i = 0; i < SLICE_A.length; i += 1) {
      expect(projectScene(SLICE_A, i).found).toBeNull();
    }
  });
});
