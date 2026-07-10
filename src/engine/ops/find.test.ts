/**
 * S2.1 unit tests — the short-circuit terminal over the fixture. Pins the `found`
 * event shape (AC1: encounter-order-first survivor), the no-pull-past-the-decisive-
 * element invariant (AC2), the un-pulled remainder count (AC3), and the mapped
 * result value. Uses the real Slice B sequential pipeline so the log is a genuine
 * run, not a hand-built stub.
 */
import { describe, it, expect } from "vitest";
import { ORDERS, FIND_FIRST_TARGET_ID } from "../domain/fixture";
import { runSequential } from "../kernel/runner";
import { sliceBSequentialPipeline } from "../pipelines";
import { countKind, pullsAfterFound } from "../testing/logInvariants";

describe("S2.1 findFirst — latches the first survivor (AC1)", () => {
  it("records exactly one `found`, naming the encounter-order-first survivor (#2)", () => {
    const { log } = runSequential(sliceBSequentialPipeline(ORDERS));
    const founds = log.filter((e) => e.kind === "found");
    expect(founds).toHaveLength(1);
    expect(founds[0]?.kind === "found" && founds[0].elementId).toBe(FIND_FIRST_TARGET_ID);
  });

  it("the found element survived and mapped just before the latch (survive → transform → found)", () => {
    const { log } = runSequential(sliceBSequentialPipeline(ORDERS));
    const foundIdx = log.findIndex((e) => e.kind === "found");
    expect(log[foundIdx - 1]?.kind).toBe("transform"); // mapped immediately before
    expect(log[foundIdx - 2]?.kind).toBe("survive"); // and survived the filter before that
  });
});

describe("S2.1 findFirst — never pulls past the decisive element (AC2)", () => {
  it("no `demand` or `emit` follows `found`", () => {
    const { log } = runSequential(sliceBSequentialPipeline(ORDERS));
    expect(pullsAfterFound(log)).toEqual([]);
  });

  it("only the elements up to and including the target were pulled (#1 died, #2 found)", () => {
    const { log } = runSequential(sliceBSequentialPipeline(ORDERS));
    // Two emits: #1 (dies) and #2 (found). Nothing after.
    expect(log.filter((e) => e.kind === "emit").map((e) => e.kind === "emit" && e.elementId)).toEqual(
      [1, 2],
    );
  });
});

describe("S2.1 findFirst — un-pulled remainder (AC3)", () => {
  it("shortcircuit.remainingUnpulled equals source size minus pulled count (11 − 2 = 9)", () => {
    const { log } = runSequential(sliceBSequentialPipeline(ORDERS));
    const sc = log.find((e) => e.kind === "shortcircuit");
    expect(sc?.kind === "shortcircuit" && sc.remainingUnpulled).toBe(9);
    // Cross-check against the log's own pull count: emits + remainder == source size.
    const emits = countKind(log, "emit");
    expect(emits + (sc?.kind === "shortcircuit" ? sc.remainingUnpulled : 0)).toBe(ORDERS.length);
  });

  it("shortcircuit is the final event (recorded at end, after found)", () => {
    const { log } = runSequential(sliceBSequentialPipeline(ORDERS));
    expect(log[log.length - 1]?.kind).toBe("shortcircuit");
  });
});

describe("S2.1 findFirst — result", () => {
  it("returns the mapped (post-discount) first survivor", () => {
    const { result } = runSequential(sliceBSequentialPipeline(ORDERS));
    // Order #2 is $1200 → $1080 after applyDiscount; find runs after map.
    expect(result).toMatchObject({ id: 2, total: 1080, region: "West" });
  });
});
