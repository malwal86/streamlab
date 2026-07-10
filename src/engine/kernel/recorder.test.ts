import { describe, it, expect } from "vitest";
import { ORDERS } from "../domain/fixture";
import { EventRecorder } from "./recorder";

/**
 * S0.5 — the recorder owns tick assignment and freezing, so the whole log's total
 * order (and thus the single-file invariant) rests on it. These pin that ticks are
 * the append index, the convenience emitters shape events per the contract, and the
 * frozen log is immutable.
 */
describe("EventRecorder", () => {
  it("stamps ticks as the strictly increasing append index", () => {
    const rec = new EventRecorder();
    expect(rec.demand()).toBe(0);
    expect(rec.emit(ORDERS[0]!)).toBe(1);
    expect(rec.demand()).toBe(2);
    expect(rec.size).toBe(3);
  });

  it("record returns the assigned tick and preserves kind-specific fields", () => {
    const rec = new EventRecorder();
    const tick = rec.record({
      kind: "test",
      elementId: 2,
      op: "filter",
      predicate: "o.total > 100",
      input: { total: 1200, region: "West" },
      output: true,
    });
    expect(tick).toBe(0);
    const [event] = rec.freeze();
    expect(event).toMatchObject({
      kind: "test",
      tick: 0,
      predicate: "o.total > 100",
      output: true,
    });
  });

  it("demand carries its retrograde context", () => {
    const rec = new EventRecorder();
    rec.demand({ op: "identity", nextStage: "source" });
    expect(rec.freeze()[0]).toMatchObject({
      kind: "demand",
      op: "identity",
      nextStage: "source",
      tick: 0,
    });
  });

  it("emit projects the order onto {elementId, op:source, input:{total,region}}", () => {
    const rec = new EventRecorder();
    rec.emit(ORDERS[1]!); // id 2, 1200, West
    expect(rec.freeze()[0]).toEqual({
      kind: "emit",
      tick: 0,
      elementId: 2,
      op: "source",
      input: { total: 1200, region: "West" },
    });
  });

  it("freeze returns a deep-frozen, immutable log", () => {
    const rec = new EventRecorder();
    rec.demand();
    const log = rec.freeze();
    expect(Object.isFrozen(log)).toBe(true);
    expect(Object.isFrozen(log[0])).toBe(true);
  });

  it("size tracks the count of recorded events", () => {
    const rec = new EventRecorder();
    expect(rec.size).toBe(0);
    rec.emit(ORDERS[0]!);
    rec.emit(ORDERS[1]!);
    expect(rec.size).toBe(2);
  });

  it("emitCount tracks only emits — the pulled count a short-circuit terminal reads (S2.1)", () => {
    const rec = new EventRecorder();
    expect(rec.emitCount).toBe(0);
    rec.demand(); // pulls do not count
    rec.emit(ORDERS[0]!);
    rec.record({ kind: "die", elementId: 1, op: "filter" }); // other events do not count
    expect(rec.emitCount).toBe(1);
    rec.emit(ORDERS[1]!);
    expect(rec.emitCount).toBe(2);
  });
});
