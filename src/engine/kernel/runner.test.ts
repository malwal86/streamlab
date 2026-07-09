import { describe, it, expect } from "vitest";
import { ORDERS } from "../domain/fixture";
import { type Order } from "../domain/order";
import { countKind, isSingleFilePull, pullOrderViolations } from "../testing/logInvariants";
import { combineFlags, NO_FLAGS, OpFlag, type FlagSet } from "./flags";
import { type EventRecorder } from "./recorder";
import { ChainedSink, type Sink } from "./sink";
import { arraySpliterator, type Spliterator } from "./spliterator";
import {
  identityPipeline,
  identityTerminal,
  runSequential,
  type Pipeline,
  type StreamOp,
  type Terminal,
  type TerminalSink,
} from "./runner";

/**
 * S0.5 acceptance — the sequential runner over the identity pipeline, plus the
 * dormant short-circuit cancel path (AC5). The oracle for identity is trivial: the
 * result is the input list, and the log is a well-formed single-file `demand→emit`
 * trace. Real ops (E1) reuse this exact runner.
 */
describe("runSequential — identity pipeline (AC1–AC3)", () => {
  it("collects every order unchanged, in encounter order (result == input oracle)", () => {
    const { result } = runSequential(identityPipeline(ORDERS));
    // Native-array identity is the oracle: the output *is* the input.
    expect(result).toEqual([...ORDERS]);
  });

  it("emits a well-formed demand→emit→…→demand log (AC1)", () => {
    const { log } = runSequential(identityPipeline(ORDERS));
    // Only demand + emit for identity (no op events yet).
    expect(new Set(log.map((e) => e.kind))).toEqual(new Set(["demand", "emit"]));
    // The run opens with a demand (the terminal pulls first) …
    expect(log[0]?.kind).toBe("demand");
    // … and closes with the final demand that hit an exhausted source.
    expect(log[log.length - 1]?.kind).toBe("demand");
  });

  it("records one demand per element plus the trailing exhausting demand", () => {
    const { log } = runSequential(identityPipeline(ORDERS));
    expect(countKind(log, "emit")).toBe(ORDERS.length);
    expect(countKind(log, "demand")).toBe(ORDERS.length + 1);
  });

  it("assigns strictly increasing ticks equal to the log index", () => {
    const { log } = runSequential(identityPipeline(ORDERS));
    log.forEach((event, index) => expect(event.tick).toBe(index));
  });

  it("every emit carries its order id and {total, region} snapshot, in order (AC1)", () => {
    const { log } = runSequential(identityPipeline(ORDERS));
    const emits = log.filter((e) => e.kind === "emit");
    expect(emits.map((e) => e.elementId)).toEqual(ORDERS.map((o) => o.id));
    emits.forEach((emit, i) => {
      const order = ORDERS[i]!;
      expect(emit).toMatchObject({
        op: "source",
        elementId: order.id,
        input: { total: order.total, region: order.region },
      });
    });
  });

  it("holds the single-file / demand-precedes-emit invariant (AC2, AC3)", () => {
    const { log } = runSequential(identityPipeline(ORDERS));
    expect(pullOrderViolations(log)).toEqual([]);
    expect(isSingleFilePull(log)).toBe(true);
  });

  it("returns a frozen, immutable log (AC — runtime immutability)", () => {
    const { log } = runSequential(identityPipeline(ORDERS));
    expect(Object.isFrozen(log)).toBe(true);
    expect(Object.isFrozen(log[0])).toBe(true);
    expect(() => {
      (log as unknown as { push: (e: unknown) => void }).push({ kind: "demand", tick: 999 });
    }).toThrow();
  });

  it("runs cleanly over an empty source: one demand, no emit", () => {
    const { log, result } = runSequential(identityPipeline([]));
    expect(result).toEqual([]);
    expect(countKind(log, "emit")).toBe(0);
    expect(countKind(log, "demand")).toBe(1); // the single pull that finds nothing
  });

  it("is deterministic: two runs over the same fixture produce identical logs", () => {
    const a = runSequential(identityPipeline(ORDERS)).log;
    const b = runSequential(identityPipeline(ORDERS)).log;
    expect(a).toEqual(b);
  });
});

/**
 * AC4 / AC5 — a short-circuit terminal proves the runner reads op flags and honors
 * the cancel path *now*, before E2's `findFirst`. The terminal latches after two
 * elements; the runner must stop pulling, leaving the rest of the source dark.
 */
class TakeTwoSink implements TerminalSink<readonly Order[]> {
  private readonly taken: Order[] = [];
  begin(): void {}
  accept(element: Order): void {
    if (this.taken.length < 2) this.taken.push(element);
  }
  end(): void {}
  cancellationRequested(): boolean {
    return this.taken.length >= 2; // latch once two are in hand
  }
  result(): readonly Order[] {
    return this.taken;
  }
}

function takeTwoPipeline(source: Spliterator<Order>): Pipeline<readonly Order[]> {
  const terminal: Terminal<readonly Order[]> = {
    name: "take-two",
    flags: combineFlags(OpFlag.SHORT_CIRCUIT, OpFlag.ORDERED),
    makeSink: (_rec: EventRecorder) => new TakeTwoSink(),
  };
  return { source, ops: [], terminal };
}

describe("runSequential — short-circuit cancel path (AC4, AC5)", () => {
  it("stops pulling once the sink cancels; remaining source stays dark", () => {
    const source = arraySpliterator(ORDERS);
    const { log, result } = runSequential(takeTwoPipeline(source));

    // Exactly two elements taken and pushed — no over-pull past the decisive one.
    expect(result).toEqual([ORDERS[0], ORDERS[1]]);
    expect(countKind(log, "emit")).toBe(2);
    // Two demands (one per taken element); the loop broke on cancellation, so there
    // is NO trailing exhausting demand — the source was never asked again.
    expect(countKind(log, "demand")).toBe(2);
    // The remaining 9 orders were never pulled from the source.
    expect(source.estimateSize()).toBe(ORDERS.length - 2);
  });

  it("a non-short-circuit terminal instead drains the whole source", () => {
    // Contrast: identity (no SHORT_CIRCUIT flag) never checks cancellation, so the
    // same fixture is fully traversed — proving the flag is what gates the loop.
    const { log } = runSequential(identityPipeline(ORDERS));
    expect(countKind(log, "emit")).toBe(ORDERS.length);
  });
});

/**
 * A pass-through intermediate op that counts and (optionally) transforms each
 * element it forwards — a seam-tester for the op-chain wiring E1 fills in. `flags`
 * lets a test contribute a characteristic (e.g. SHORT_CIRCUIT) from an *op* rather
 * than the terminal, so the runner's flag-folding is observable.
 */
class CountingPassThroughSink extends ChainedSink<Order, Order> {
  constructor(
    downstream: Sink<Order>,
    private readonly onAccept: (order: Order) => void,
  ) {
    super(downstream);
  }
  accept(element: Order): void {
    this.onAccept(element);
    this.downstream.accept(element);
  }
}

function countingOp(
  name: string,
  onAccept: (order: Order) => void,
  flags: FlagSet = NO_FLAGS,
): StreamOp {
  return { name, flags, wrap: (downstream) => new CountingPassThroughSink(downstream, onAccept) };
}

describe("runSequential — intermediate op chain wiring", () => {
  it("threads every element through all ops in chain order (AC — sink-chain wiring)", () => {
    const seenByFirst: number[] = [];
    const seenBySecond: number[] = [];
    const pipeline: Pipeline<readonly Order[]> = {
      source: arraySpliterator(ORDERS),
      ops: [
        countingOp("first", (o) => seenByFirst.push(o.id)),
        countingOp("second", (o) => seenBySecond.push(o.id)),
      ],
      terminal: identityTerminal(),
    };

    const { result } = runSequential(pipeline);

    // Both ops saw every element, in encounter order — the wrapping loop ran and
    // the source pushed through the whole chain (not straight to the terminal).
    expect(seenByFirst).toEqual(ORDERS.map((o) => o.id));
    expect(seenBySecond).toEqual(ORDERS.map((o) => o.id));
    expect(result).toEqual([...ORDERS]);
  });

  it("folds an op's flags into the pipeline: an op-supplied SHORT_CIRCUIT gates the loop (AC4)", () => {
    // The terminal carries NO flags but its sink cancels after two elements; only
    // the *op* supplies SHORT_CIRCUIT. If the runner ignored op flags it would drain
    // the whole source — so stopping at two proves op flags are reached.
    const collected: Order[] = [];
    const cancellingTerminal: Terminal<readonly Order[]> = {
      name: "unflagged-cancel",
      flags: NO_FLAGS,
      makeSink: (_rec: EventRecorder): TerminalSink<readonly Order[]> => ({
        begin() {},
        accept(o: Order) {
          if (collected.length < 2) collected.push(o);
        },
        end() {},
        cancellationRequested: () => collected.length >= 2,
        result: () => collected,
      }),
    };
    const source = arraySpliterator(ORDERS);
    const pipeline: Pipeline<readonly Order[]> = {
      source,
      ops: [countingOp("short-circuit-op", () => {}, OpFlag.SHORT_CIRCUIT)],
      terminal: cancellingTerminal,
    };

    const { log } = runSequential(pipeline);

    expect(countKind(log, "emit")).toBe(2);
    expect(source.estimateSize()).toBe(ORDERS.length - 2); // rest never pulled
  });
});

describe("identityTerminal — sink contract", () => {
  it("never requests cancellation", () => {
    const sink = identityTerminal().makeSink(undefined as unknown as EventRecorder);
    expect(sink.cancellationRequested()).toBe(false);
  });
});
