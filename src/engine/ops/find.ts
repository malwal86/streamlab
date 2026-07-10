/**
 * The `findFirst()` / `findAny()` short-circuit terminal (S2.1, spec §3.2 Slice B /
 * R2) — the end of Slice B's chain and the op that makes early termination *real*
 * rather than scripted. It consumes survivors and stops at the **first** one: it
 * records `found { elementId }`, flips its cancellation latch, and the runner's
 * cancellable loop (which already honors `cancellationRequested()`) halts before
 * pulling another element. On `end()` it records `shortcircuit { remainingUnpulled }`
 * — the count of source elements that were therefore *never demanded* (the "goes
 * dark, never pulled" wow the viz renders in S2.3).
 *
 * Two invariants the sink guarantees, both checkable on the log alone:
 *
 *   - **No pull past the decisive element (S2.1 AC2).** The latch is set inside the
 *     `accept` of the found element, whose `emit` the runner recorded *before*
 *     calling down-chain; the runner then sees `cancellationRequested()` true and
 *     stops, so no `demand`/`emit` follows `found`. This is a property of the runner
 *     loop the terminal merely triggers — the runner is unchanged from S0.5.
 *   - **`remainingUnpulled = sourceSize − pulledCount` (S2.1 AC3).** `pulledCount`
 *     is the recorder's `emitCount` at `end()` (every element the source released);
 *     `sourceSize` is handed to the factory by the pipeline builder (the terminal
 *     sits downstream of a `filter`, which cleared SIZED, so it cannot read the
 *     source count from `begin`). For the fixture: #1 dies, #2 is found ⇒ 2 pulled,
 *     9 never pulled.
 *
 * **Sequentially `findFirst == findAny`** (spec §3.2): the *first survivor in
 * encounter order* is both the first and an arbitrary one, so a single sink serves
 * both terminals; the toggle is a Config distinction that only diverges under
 * parallelism (E4). The result is the **mapped** first survivor (grouping/find run
 * after `map`), matching a real `filter().map().findFirst()`.
 *
 * `SHORT_CIRCUIT` (this is *the* op the flag was plumbed for), never `STATEFUL` —
 * it holds only the single latched element, not a cross-element accumulation.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */
import { type Order } from "../domain/order";
import { OpFlag } from "../kernel/flags";
import { type EventRecorder } from "../kernel/recorder";
import { type Terminal, type TerminalSink } from "../kernel/runner";

/** The op name carried on every `demand`/`found`/`shortcircuit` `op` field. */
const OP_NAME = "find";

/**
 * The short-circuit sink: latch the first survivor it is handed, record `found`,
 * and answer `cancellationRequested()` true thereafter so the runner stops. On
 * `end()` — reached the beat after the latch — it records the un-pulled remainder.
 * Holds the latched element as its only state; `result()` returns it (or
 * `undefined` when no element survived and the stream exhausted).
 */
class FindSink implements TerminalSink<Order | undefined> {
  private latched: Order | undefined = undefined;

  constructor(
    private readonly rec: EventRecorder,
    /** The source's element count — the base `remainingUnpulled` subtracts from. */
    private readonly sourceSize: number,
  ) {}

  begin(_size: number): void {
    // Nothing to pre-size — `find` holds at most one element. (`_size` is
    // SIZE_UNKNOWN here anyway: a `filter` upstream cleared SIZED.)
  }

  accept(element: Order): void {
    // The first survivor decides the result; a well-behaved runner stops after the
    // latch, but guard against a second push so `found` is emitted exactly once.
    if (this.latched !== undefined) return;
    this.latched = element;
    // "FOUND" — the terminal latches on this element (spec §3.2 step 5, Slice B).
    this.rec.record({ kind: "found", op: OP_NAME, elementId: element.id });
  }

  end(): void {
    // Only a run that actually short-circuited has an un-pulled remainder to report;
    // a stream that exhausted without a survivor pulled everything (nothing dark).
    if (this.latched === undefined) return;
    const remainingUnpulled = this.sourceSize - this.rec.emitCount;
    this.rec.record({ kind: "shortcircuit", op: OP_NAME, remainingUnpulled });
  }

  cancellationRequested(): boolean {
    // Once latched, ask the runner to stop — this is the signal that selects the
    // cancellable pull loop's exit (S0.5's dormant cancel path, now live).
    return this.latched !== undefined;
  }

  result(): Order | undefined {
    return this.latched;
  }
}

/**
 * The `findFirst()` / `findAny()` terminal factory (S2.1) — one fresh short-circuit
 * sink per run. `sourceSize` is the source list's length, so the sink can report
 * the un-pulled remainder (`shortcircuit.remainingUnpulled`) without reading a
 * SIZED count a `filter` has already cleared. `SHORT_CIRCUIT`, never `STATEFUL`.
 * The same terminal serves both `findFirst` and `findAny` — identical sequentially.
 */
export function findTerminal(sourceSize: number): Terminal<Order | undefined> {
  return {
    name: OP_NAME,
    flags: OpFlag.SHORT_CIRCUIT,
    makeSink: (rec) => new FindSink(rec, sourceSize),
  };
}
