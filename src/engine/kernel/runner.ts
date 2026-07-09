/**
 * The **sequential runner** (S0.5) — the terminal that drives the pull loop and
 * turns a pipeline into an ordered, immutable event log. This is the credibility
 * spine (spec §4): one `Spliterator.tryAdvance` per beat, exactly one element fully
 * resolved before the next demand, the whole run bracketed by `Sink.begin`/`end`.
 *
 * The loop is JDK-faithful (`AbstractPipeline.copyIntoWithCancel`): pull, and stop
 * when the source is exhausted *or* a short-circuit sink has requested
 * cancellation. Unlike the JDK — which uses a plain `forEachRemaining` for
 * non-short-circuit ops — the runner always drives the loop one element at a time,
 * recording a `demand` per beat, because the *demand heartbeat* is the thing the
 * viz renders (spec §3.2). The final demand that hits an exhausted source is
 * recorded too: it is the terminal's last pull, the beat where the circuit powers
 * down. So an N-element identity run yields N+1 demands and N emits.
 *
 * S0.5 ships only the identity pipeline (a pass-through terminal that collects what
 * it receives), enough to prove the loop and log are well-formed. The real ops
 * (`filter`/`map`/`collect`/`find`) plug into the *same* runner as `StreamOp`s and
 * `Terminal`s in E1/E2 — the runner never changes; the cancel path it already
 * honors is what E2's short-circuit terminal flips.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */
import { type EngineEvent } from "../domain/event";
import { type Order } from "../domain/order";
import { combineFlags, hasFlag, NO_FLAGS, OpFlag, type FlagSet } from "./flags";
import { EventRecorder } from "./recorder";
import { type Sink } from "./sink";
import { arraySpliterator, type Spliterator } from "./spliterator";

/**
 * An intermediate operation. Wraps the `downstream` sink and returns a sink over
 * its input, threading `rec` so the op can emit its own events (E1: `filter` emits
 * `test`/`survive`/`die`, `map` emits `transform`). Every Slice op is `Order →
 * Order`, so the whole chain is homogeneous `Sink<Order>` — no type erasure at the
 * boundary. `flags` fold into the pipeline flags the runner reasons over.
 */
export interface StreamOp {
  readonly name: string;
  readonly flags: FlagSet;
  wrap(downstream: Sink<Order>, rec: EventRecorder): Sink<Order>;
}

/**
 * A terminal operation's sink: a `Sink<Order>` that also yields the run's `result`
 * once traversal ends. `result()` is meaningful only after `end()` (a collecting
 * terminal finalizes in `end`).
 */
export interface TerminalSink<R> extends Sink<Order> {
  result(): R;
}

/**
 * A terminal operation — the sink at the end of the chain and the thing the runner
 * pulls *for*. `flags` carry e.g. `SHORT_CIRCUIT` for `findFirst` (E2), which is
 * what makes the runner check `cancellationRequested()` between demands.
 */
export interface Terminal<R> {
  readonly name: string;
  readonly flags: FlagSet;
  makeSink(rec: EventRecorder): TerminalSink<R>;
}

/**
 * A fully-assembled pipeline: a source, zero or more ordered intermediate ops, and
 * a terminal. Generic over the terminal's result type `R`. The runner owns turning
 * this into `(log, result)`.
 */
export interface Pipeline<R> {
  readonly source: Spliterator<Order>;
  readonly ops: readonly StreamOp[];
  readonly terminal: Terminal<R>;
}

/** The output of one run: the immutable event log and the terminal's result. */
export interface RunResult<R> {
  readonly log: readonly EngineEvent[];
  readonly result: R;
}

/**
 * Fold the source's characteristics and every op/terminal flag into one set — what
 * the runner tests for `SHORT_CIRCUIT` (and what the parallel scheduler will read
 * for `STATEFUL`/`SIZED` in S3.1).
 */
function pipelineFlags<R>(pipeline: Pipeline<R>): FlagSet {
  return combineFlags(
    pipeline.source.characteristics(),
    pipeline.terminal.flags,
    ...pipeline.ops.map((op) => op.flags),
  );
}

/**
 * Run `pipeline` sequentially, returning its event log and result.
 *
 * The pull loop:
 *   1. `terminal.begin(exactSize)` — bracket the run, hand the sink the SIZED count.
 *   2. Per beat: record a `demand`, then `tryAdvance`. On success the source records
 *      an `emit` and pushes the element down the chain; every element is fully
 *      resolved (all downstream `accept` work done) before the loop comes back for
 *      the next demand — the single-file invariant (AC2), enforced by the loop shape
 *      itself, not by convention.
 *   3. Stop when the source is exhausted, or — on a short-circuit pipeline — when the
 *      sink has requested cancellation (AC5's cancel path; dormant for identity).
 *   4. `terminal.end()` — finalize the result.
 */
export function runSequential<R>(pipeline: Pipeline<R>): RunResult<R> {
  const rec = new EventRecorder();

  // Build the sink chain terminal-first, wrapping each op right-to-left so the head
  // sink is the one the source pushes into (source → op₀ → … → terminal).
  const terminalSink = pipeline.terminal.makeSink(rec);
  let head: Sink<Order> = terminalSink;
  for (let i = pipeline.ops.length - 1; i >= 0; i -= 1) {
    head = pipeline.ops[i]!.wrap(head, rec);
  }

  const shortCircuit = hasFlag(pipelineFlags(pipeline), OpFlag.SHORT_CIRCUIT);
  const source = pipeline.source;

  head.begin(source.getExactSizeIfKnown());
  // `more` is assigned by `tryAdvance` on every iteration before the `while` reads
  // it (do-while runs the body first), so it needs no initializer — and giving one
  // would be dead code.
  let more: boolean;
  do {
    // Terminal → source: the retrograde demand spike that opens the beat.
    rec.demand({ op: pipeline.terminal.name, nextStage: "source" });
    more = source.tryAdvance((element) => {
      // Source encodes & releases exactly one element, then it pushes down-chain.
      rec.emit(element);
      head.accept(element);
    });
    // Re-check cancellation only when a short-circuit op is present; a non-short-
    // circuit chain always answers false, so this runs to source exhaustion.
  } while (more && !(shortCircuit && head.cancellationRequested()));
  head.end();

  return { log: rec.freeze(), result: terminalSink.result() };
}

/**
 * The identity (pass-through) terminal (S0.5): it collects every order it receives,
 * in encounter order, and returns them unchanged. Carries {@link NO_FLAGS} — not
 * stateful, not short-circuit — so the runner takes the plain run-to-exhaustion
 * path. Its collected result is what a test asserts equal to the source list (the
 * oracle for "the loop pushed every element, in order").
 */
class IdentitySink implements TerminalSink<readonly Order[]> {
  private readonly collected: Order[] = [];

  begin(_size: number): void {
    // Nothing to pre-size — identity holds no bins; `_size` is accepted to satisfy
    // the lifecycle and to prove `begin` is called (AC5).
  }

  accept(element: Order): void {
    this.collected.push(element);
  }

  end(): void {
    // No finalization — the collected list is already the result.
  }

  cancellationRequested(): boolean {
    return false; // Identity never short-circuits.
  }

  result(): readonly Order[] {
    return this.collected;
  }
}

/** The identity terminal factory — one fresh collecting sink per run. */
export function identityTerminal(): Terminal<readonly Order[]> {
  return {
    name: "identity",
    flags: NO_FLAGS,
    makeSink: () => new IdentitySink(),
  };
}

/**
 * Assemble the identity pipeline over `orders`: an array source, no intermediate
 * ops, the identity terminal. Running it proves the kernel end-to-end (pull loop,
 * sink lifecycle, event log) before any real op exists (S0.5 in-scope).
 */
export function identityPipeline(orders: readonly Order[]): Pipeline<readonly Order[]> {
  return {
    source: arraySpliterator(orders),
    ops: [],
    terminal: identityTerminal(),
  };
}
