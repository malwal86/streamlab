import { describe, it, expect } from "vitest";
import { ChainedSink, type Sink } from "./sink";

/**
 * S0.5 AC5 — the `Sink` lifecycle (`begin`/`accept`/`end`) and the cancellation
 * signal. A `ChainedSink` must forward every callback downstream by default, and
 * cancellation must propagate *up* from a downstream latch so the runner sees it.
 */

/** Records the order of lifecycle calls it receives — a lifecycle spy. */
class RecordingSink implements Sink<number> {
  readonly calls: string[] = [];
  private cancel = false;

  begin(size: number): void {
    this.calls.push(`begin(${size})`);
  }
  accept(element: number): void {
    this.calls.push(`accept(${element})`);
  }
  end(): void {
    this.calls.push("end");
  }
  cancellationRequested(): boolean {
    return this.cancel;
  }
  requestCancel(): void {
    this.cancel = true;
  }
}

/** A minimal pass-through op sink — forwards each accepted element unchanged. */
class PassThroughSink extends ChainedSink<number, number> {
  accept(element: number): void {
    this.downstream.accept(element);
  }
}

describe("Sink lifecycle", () => {
  it("brackets accepts with a single begin and end, in order", () => {
    const sink = new RecordingSink();
    sink.begin(3);
    sink.accept(1);
    sink.accept(2);
    sink.end();
    expect(sink.calls).toEqual(["begin(3)", "accept(1)", "accept(2)", "end"]);
  });

  it("reports no cancellation by default", () => {
    expect(new RecordingSink().cancellationRequested()).toBe(false);
  });
});

describe("ChainedSink — default delegation", () => {
  it("forwards begin, accept, and end to the downstream sink", () => {
    const terminal = new RecordingSink();
    const op = new PassThroughSink(terminal);
    op.begin(2);
    op.accept(7);
    op.end();
    expect(terminal.calls).toEqual(["begin(2)", "accept(7)", "end"]);
  });

  it("propagates a downstream cancellation request upward (the runner reads the head)", () => {
    const terminal = new RecordingSink();
    const op = new PassThroughSink(terminal);
    expect(op.cancellationRequested()).toBe(false);
    terminal.requestCancel();
    // A latch set at the terminal must be visible through the whole chain.
    expect(op.cancellationRequested()).toBe(true);
  });

  it("propagates cancellation through multiple chained stages", () => {
    const terminal = new RecordingSink();
    const chain = new PassThroughSink(new PassThroughSink(terminal));
    expect(chain.cancellationRequested()).toBe(false);
    terminal.requestCancel();
    expect(chain.cancellationRequested()).toBe(true);
  });
});
