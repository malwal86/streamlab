/**
 * `Sink<T>` (S0.5, spec §4) — the **push** half of the duality. Elements pulled
 * from the `Spliterator` are pushed *down* a chain of sinks: the source feeds the
 * head, each op's sink transforms/filters and forwards to the next, and the
 * terminal's sink absorbs the result. Faithful to `java.util.stream.Sink`:
 *
 *   - `begin(size)` — called once before any element, bracketing the run and giving
 *     a stateful/collecting sink the chance to pre-size from the source's SIZED
 *     count (`SIZE_UNKNOWN` when not known).
 *   - `accept(element)` — one pushed element. An op sink decides whether/what to
 *     forward downstream (a `filter` may drop it; the identity sink forwards as-is).
 *   - `end()` — called once after the last element, the mirror of `begin`; where a
 *     collecting terminal finalizes its result.
 *   - `cancellationRequested()` — the short-circuit signal read *by the runner*
 *     between demands. Default `false` (a non-short-circuit sink never asks to
 *     stop); a `findFirst` sink (E2) flips it to `true` once latched, and the
 *     signal propagates up the chain so the terminal stops pulling.
 *
 * `begin`/`accept`/`end`/`cancel` are exactly the four callbacks spec §4 lists. The
 * `cancel` path is *present but dormant* in S0.5 (AC5): the identity pipeline never
 * cancels, but the interface and the chained-sink propagation exist so E2 wires a
 * real short-circuit into an unchanged runner.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */

/**
 * A stage in the push chain. Generic over the element type it *accepts*; an op that
 * changes the element type (none in S0.5) accepts `In` and forwards `Out`
 * downstream via a chained sink over `Out`.
 */
export interface Sink<T> {
  /**
   * Signal the start of traversal. `size` is the source's exact element count when
   * SIZED, else {@link SIZE_UNKNOWN}. Called exactly once, before any `accept`.
   */
  begin(size: number): void;

  /** Push one element into this stage. Called once per element, between `begin` and `end`. */
  accept(element: T): void;

  /** Signal the end of traversal. Called exactly once, after the last `accept`. */
  end(): void;

  /**
   * Has this stage (or anything downstream) requested that traversal stop? The
   * runner reads this between demands on a short-circuit pipeline; a non-short-
   * circuit chain always answers `false`, so traversal runs to source exhaustion.
   */
  cancellationRequested(): boolean;
}

/**
 * A `Sink` that wraps a `downstream` sink and, by default, forwards every callback
 * to it — the base every op sink extends so lifecycle and cancellation propagation
 * are inherited, not re-implemented. An op overrides only `accept` (its actual
 * behavior: filter, map, route); `begin`/`end`/`cancellationRequested` delegate
 * downstream unless the op is stateful and needs to override them (S1.x).
 *
 * The default `begin` forwards `size` unchanged: correct for a size-preserving op
 * (`map`); a size-clearing op (`filter`) overrides `begin` to pass `SIZE_UNKNOWN`.
 * The default `cancellationRequested` returns the downstream's answer, so a latch
 * set at the terminal is visible all the way up to the runner.
 */
export abstract class ChainedSink<In, Out> implements Sink<In> {
  protected readonly downstream: Sink<Out>;

  constructor(downstream: Sink<Out>) {
    this.downstream = downstream;
  }

  begin(size: number): void {
    this.downstream.begin(size);
  }

  abstract accept(element: In): void;

  end(): void {
    this.downstream.end();
  }

  cancellationRequested(): boolean {
    return this.downstream.cancellationRequested();
  }
}
