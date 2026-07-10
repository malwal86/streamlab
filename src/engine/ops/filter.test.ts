/**
 * S1.1 unit tests — the filter op's event shape and its "death is at the filter"
 * guarantee (AC1, AC2), plus the SIZED-clearing detail. These pin behavior the
 * property (survivor-set equality) cannot see: the exact `test` payload the viz
 * reads, and the structural promise that a rejected element produces *no*
 * downstream event.
 */
import { describe, it, expect } from "vitest";
import { type EngineEvent } from "../domain/event";
import { ORDERS } from "../domain/fixture";
import { type Order } from "../domain/order";
import {
  identityTerminal,
  runSequential,
  type Terminal,
  type TerminalSink,
} from "../kernel/runner";
import { NO_FLAGS } from "../kernel/flags";
import { arraySpliterator, SIZE_UNKNOWN } from "../kernel/spliterator";
import { sliceFilterOp } from "./filter";

function filterLog(orders: readonly Order[]): readonly EngineEvent[] {
  return runSequential({
    source: arraySpliterator(orders),
    ops: [sliceFilterOp()],
    terminal: identityTerminal(),
  }).log;
}

describe("S1.1 filter — event shape", () => {
  it("emits a `test` with the live comparison and boolean output (AC1)", () => {
    // Order #2 ($1200, West) survives; order #1 ($80, West) dies.
    const log = filterLog(ORDERS);
    const survivorTest = log.find((e) => e.kind === "test" && e.elementId === 2);
    const rejectTest = log.find((e) => e.kind === "test" && e.elementId === 1);

    expect(survivorTest).toMatchObject({
      kind: "test",
      op: "filter",
      predicate: "o.total > 100",
      input: { total: 1200, region: "West" },
      output: true,
    });
    expect(rejectTest).toMatchObject({
      kind: "test",
      input: { total: 80, region: "West" },
      output: false,
    });
  });

  it("every element is tested exactly once", () => {
    const log = filterLog(ORDERS);
    const tested = log.filter((e) => e.kind === "test").map((e) => e.elementId);
    expect(tested).toEqual(ORDERS.map((o) => o.id));
  });
});

describe("S1.1 filter — death is at the filter (AC2)", () => {
  it("a rejected element emits `die` and no `survive`", () => {
    const log = filterLog(ORDERS);
    const died = new Set(log.filter((e) => e.kind === "die").map((e) => e.elementId));
    const survived = new Set(log.filter((e) => e.kind === "survive").map((e) => e.elementId));

    // The fixture's sub-100 orders (#1, #3, #8) and the exactly-100 order (#10) die.
    expect([...died].sort((a, b) => a - b)).toEqual([1, 3, 8, 10]);
    // No element both survives and dies — the fate is exclusive.
    for (const id of died) expect(survived.has(id)).toBe(false);
  });

  it("no element that dies produces a later event naming it", () => {
    const log = filterLog(ORDERS);
    for (const die of log.filter((e) => e.kind === "die")) {
      const laterNaming = log.filter(
        (e) => e.tick > die.tick && "elementId" in e && e.elementId === die.elementId,
      );
      expect(laterNaming, `element #${die.elementId} died but reappears downstream`).toEqual([]);
    }
  });
});

describe("S1.1 filter — clears SIZED downstream", () => {
  it("passes SIZE_UNKNOWN to the downstream sink's begin", () => {
    // A probe terminal that records the size `begin` handed it. A SIZED source
    // would pass its exact count; filter must clear it to SIZE_UNKNOWN so a
    // collecting terminal never pre-sizes from a stale, pre-filter count.
    class BeginSizeProbe implements TerminalSink<number> {
      seen = 0;
      begin(size: number): void {
        this.seen = size;
      }
      accept(): void {}
      end(): void {}
      cancellationRequested(): boolean {
        return false;
      }
      result(): number {
        return this.seen;
      }
    }
    const probe: Terminal<number> = {
      name: "probe",
      flags: NO_FLAGS,
      makeSink: () => new BeginSizeProbe(),
    };

    const { result } = runSequential({
      source: arraySpliterator(ORDERS),
      ops: [sliceFilterOp()],
      terminal: probe,
    });
    expect(result).toBe(SIZE_UNKNOWN);
  });
});
