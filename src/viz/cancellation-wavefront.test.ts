/**
 * S4.3 — the lane race + cancellation wavefront projection, all pure reads of the
 * Slice-B parallel log the engine (S4.1/S4.2) produces:
 *
 *   - **AC1.** The dimmed (cancelled) lane set the scene renders == the engine's
 *     `cancel` events — and it *grows* as the wavefront sweeps (progressive by index).
 *   - **AC2.** The "FOUND" latch == the engine's `found`: the winning lane and the
 *     matched element, with the discounted total it carried in.
 *   - **AC3.** `findFirst` shows the **wait-then-cancel** ordering (the earliest match
 *     latches in the leftmost lane after the race); `findAny` shows **immediate
 *     first-home** (the winner is whichever lane got there first). Contrasted on the
 *     same seed.
 *   - **AC4.** Reduced motion still narrates cancellation via the step-list — every
 *     `cancel` has a legible, lane-named summary.
 *
 * Everything is asserted against `cancelledLanes` / `parallelFoundLatch` /
 * `parallelCaptionFor` — the same functions the R3F scene reads — so the guardrails
 * hold without a WebGL context.
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { ORDERS } from "@/engine/domain/fixture";
import { runParallelFind } from "@/engine/parallelFind";
import { summarizeEvent } from "@/engine/domain/event";
import { arbOrderList, DEFAULT_SEED } from "@/engine/testing/arbitraries";
import { type ThreadCount } from "@/engine/kernel/split";
import {
  cancelledLanes,
  parallelFoundLatch,
  parallelCaptionFor,
  parallelTerminalOf,
} from "./parallel";

const engineCancelLanes = (log: readonly { kind: string; lane?: string }[]): string[] =>
  log.filter((e) => e.kind === "cancel").map((e) => e.lane!).sort();

describe("S4.3 cancellation wavefront == engine cancel events (AC1)", () => {
  it.each([
    [2 as ThreadCount, 1],
    [4 as ThreadCount, 5],
  ])("the fully-swept cancelled set equals the engine's cancels (%i lanes, seed %i)", (threadCount, seed) => {
    const { log } = runParallelFind(ORDERS, { threadCount, seed, terminal: "findAny" });
    const swept = [...cancelledLanes(log, log.length - 1)].sort();
    expect(swept).toEqual(engineCancelLanes(log));
  });

  it("the wavefront grows monotonically — no lane dims before its cancel beat", () => {
    const { log } = runParallelFind(ORDERS, { threadCount: 4, seed: 5, terminal: "findAny" });
    const cancelIndices = log
      .map((e, i) => (e.kind === "cancel" ? i : -1))
      .filter((i) => i >= 0);
    // Just before the first cancel, nothing is dimmed.
    expect(cancelledLanes(log, cancelIndices[0]! - 1).size).toBe(0);
    // Each cancel beat reveals exactly one more lane.
    cancelIndices.forEach((idx, n) => {
      expect(cancelledLanes(log, idx).size).toBe(n + 1);
    });
  });

  it("matches the engine cancels for every generated Slice-B parallel run (property)", () => {
    fc.assert(
      fc.property(
        arbOrderList(),
        fc.constantFrom<ThreadCount>(2, 4),
        fc.integer(),
        fc.constantFrom<"findFirst" | "findAny">("findFirst", "findAny"),
        (orders, threadCount, seed, terminal) => {
          const { log } = runParallelFind(orders, { threadCount, seed, terminal });
          const swept = [...cancelledLanes(log, log.length - 1)].sort();
          expect(swept).toEqual(engineCancelLanes(log));
        },
      ),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S4.3 the FOUND latch == the engine found (AC2)", () => {
  it("latches the winning lane and element once the playhead passes `found`", () => {
    const { log } = runParallelFind(ORDERS, { threadCount: 2, seed: 1, terminal: "findAny" });
    const foundIndex = log.findIndex((e) => e.kind === "found");
    const found = log[foundIndex]!;
    if (found.kind !== "found") throw new Error("expected a found event");

    // Not latched before the beat…
    expect(parallelFoundLatch(log, foundIndex - 1)).toBeNull();
    // …latched on and after it, naming exactly the engine's winner.
    const latch = parallelFoundLatch(log, foundIndex)!;
    expect(latch.elementId).toBe(found.elementId);
    expect(latch.lane).toBe(found.lane);
    expect(parallelFoundLatch(log, log.length - 1)!.elementId).toBe(found.elementId);
  });

  it("carries the discounted (post-map) total the winner carried in", () => {
    // 2-lane seed 1 findAny latches id 6 (total 150 → 135 after applyDiscount).
    const { log } = runParallelFind(ORDERS, { threadCount: 2, seed: 1, terminal: "findAny" });
    const latch = parallelFoundLatch(log, log.length - 1)!;
    expect(latch.elementId).toBe(6);
    expect(latch.region).toBe("West");
    expect(latch.total).toBe(135);
  });

  it("holds for every generated run — the latched id/lane are the engine's found", () => {
    fc.assert(
      fc.property(
        arbOrderList(),
        fc.constantFrom<ThreadCount>(2, 4),
        fc.integer(),
        fc.constantFrom<"findFirst" | "findAny">("findFirst", "findAny"),
        (orders, threadCount, seed, terminal) => {
          const { log } = runParallelFind(orders, { threadCount, seed, terminal });
          const found = log.find((e) => e.kind === "found");
          const latch = parallelFoundLatch(log, log.length - 1);
          if (found?.kind === "found") {
            expect(latch?.elementId).toBe(found.elementId);
            expect(latch?.lane).toBe(found.lane);
          } else {
            expect(latch).toBeNull();
          }
        },
      ),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S4.3 findFirst wait-then-cancel vs findAny first-home (AC3)", () => {
  it("on the same seed the two terminals latch different lanes / captions", () => {
    // 4-lane seed 5: findFirst holds out for the leftmost match (L0, id 2); findAny
    // takes the first lane home (L3, the decoy id 9).
    const first = runParallelFind(ORDERS, { threadCount: 4, seed: 5, terminal: "findFirst" }).log;
    const any = runParallelFind(ORDERS, { threadCount: 4, seed: 5, terminal: "findAny" }).log;

    const firstLatch = parallelFoundLatch(first, first.length - 1)!;
    const anyLatch = parallelFoundLatch(any, any.length - 1)!;
    expect(firstLatch.lane).toBe("L0");
    expect(firstLatch.elementId).toBe(2);
    expect(anyLatch.lane).toBe("L3");
    expect(anyLatch.elementId).toBe(9);

    // The terminal is legible from the log, and drives the found caption's framing.
    expect(parallelTerminalOf(first)).toBe("findFirst");
    expect(parallelTerminalOf(any)).toBe("findAny");
    const firstFound = first.findIndex((e) => e.kind === "found");
    const anyFound = any.findIndex((e) => e.kind === "found");
    expect(parallelCaptionFor(first, firstFound)).toMatch(/ordered short-circuit/);
    expect(parallelCaptionFor(any, anyFound)).toMatch(/first lane home/);
  });

  it("findAny cancels immediately — every loser cancel trails the found with no beats between", () => {
    const { log } = runParallelFind(ORDERS, { threadCount: 4, seed: 5, terminal: "findAny" });
    const foundIndex = log.findIndex((e) => e.kind === "found");
    // First-home: nothing but cancels after the winner homes (the immediate wavefront).
    expect(log.slice(foundIndex + 1).every((e) => e.kind === "cancel")).toBe(true);
  });
});

describe("S4.3 reduced motion narrates cancellation in the step-list (AC4)", () => {
  it("every cancel event has a legible, lane-named summary", () => {
    const { log } = runParallelFind(ORDERS, { threadCount: 4, seed: 5, terminal: "findFirst" });
    const cancels = log.filter((e) => e.kind === "cancel");
    expect(cancels.length).toBeGreaterThan(0);
    for (const cancel of cancels) {
      const summary = summarizeEvent(cancel);
      expect(summary).toMatch(/^cancel L\d+ \(/); // "cancel L1 (earlier encounter-order match won)"
    }
  });

  it("empty projections for a sequential log (no fork/cancel/found)", () => {
    expect(cancelledLanes([], 0).size).toBe(0);
    expect(parallelFoundLatch([], 0)).toBeNull();
    expect(parallelTerminalOf([])).toBeNull();
  });
});
