/**
 * S1.2 unit tests — the `transform` event's payload and map's order/1-to-1
 * preservation (AC1). Pins the exact before/after totals the size-morph reads, and
 * that every survivor (and only survivors) is transformed once, in order.
 */
import { describe, it, expect } from "vitest";
import { type EngineEvent } from "../domain/event";
import { ORDERS } from "../domain/fixture";
import { applyDiscount, type Order } from "../domain/order";
import { arraySpliterator } from "../kernel/spliterator";
import { identityTerminal, runSequential } from "../kernel/runner";
import { sliceFilterOp } from "./filter";
import { sliceMapOp } from "./map";

function mapLog(orders: readonly Order[]): readonly EngineEvent[] {
  return runSequential({
    source: arraySpliterator(orders),
    ops: [sliceFilterOp(), sliceMapOp()],
    terminal: identityTerminal(),
  }).log;
}

describe("S1.2 map — transform event", () => {
  it("records before/after totals from applyDiscount (AC1)", () => {
    const log = mapLog(ORDERS);
    // Order #2 ($1200) survives → applyDiscount → $1080.
    const transform = log.find((e) => e.kind === "transform" && e.elementId === 2);
    expect(transform).toMatchObject({
      kind: "transform",
      op: "map",
      before: 1200,
      after: applyDiscount({ id: 2, total: 1200, region: "West" }).total,
    });
    expect(transform).toMatchObject({ before: 1200, after: 1080 });
  });

  it("transforms exactly the survivors, once each, in encounter order (AC2)", () => {
    const log = mapLog(ORDERS);
    const transformed = log.filter((e) => e.kind === "transform").map((e) => e.elementId);
    // Survivors in encounter order: #2, #4, #5, #6, #7, #9, #11.
    expect(transformed).toEqual([2, 4, 5, 6, 7, 9, 11]);
  });

  it("every transform's `after` is strictly less than its `before` (discount lowers the total)", () => {
    const log = mapLog(ORDERS);
    for (const e of log) {
      if (e.kind === "transform") expect(e.after).toBeLessThan(e.before);
    }
  });
});
