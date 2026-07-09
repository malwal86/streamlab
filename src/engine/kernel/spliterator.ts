/**
 * `Spliterator<T>` (S0.5, spec §4) — the **source, pulled by the terminal**. This
 * is the backward half of the pull/push duality the neural heartbeat renders: the
 * terminal calls {@link Spliterator.tryAdvance} (a *demand*), and only then does
 * the source hand exactly one element to the sink (a *push*). Nothing glows before
 * the pull — laziness made literal (spec §3.2).
 *
 * Faithful to `java.util.Spliterator`, minus the parts the MVP never uses:
 *
 *   - `tryAdvance(action)` — if an element remains, pass it to `action` and return
 *     `true`; otherwise return `false` and do nothing. **Exactly one** element per
 *     successful call — this is what makes "one element fully resolved before the
 *     next is pulled" (AC2) enforceable on the log.
 *   - `estimateSize()` / `getExactSizeIfKnown()` — the size the sink pre-sizes bins
 *     from; the array source knows it exactly, so `begin(size)` gets a real count.
 *   - `characteristics()` — the source's {@link FlagSet} (ORDERED | SIZED for an
 *     array), folded into the pipeline flags the runner reasons over.
 *
 * Omitted on purpose: `trySplit` (parallel splitting arrives with the recursive-
 * halving scheduler in S3.1 — sequential traversal never splits), and the
 * `Comparator`/`forEachRemaining` conveniences the runner does not need (the runner
 * drives the pull loop itself so it can record a `demand` per beat).
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */
import { combineFlags, OpFlag, type FlagSet } from "./flags";

/** Size returned by {@link Spliterator.getExactSizeIfKnown} when the count is unknown. */
export const SIZE_UNKNOWN = -1;

/**
 * A source of elements pulled one at a time by the terminal. Generic over the
 * element type so the same contract serves the `Order` fixture today and any op's
 * output stream later.
 */
export interface Spliterator<T> {
  /**
   * Pull the next element. If one remains, invoke `action` with it exactly once
   * and return `true`; at exhaustion, invoke nothing and return `false`. A `false`
   * return is the terminal's signal to stop the pull loop (spec §4 technical note).
   */
  tryAdvance(action: (element: T) => void): boolean;

  /**
   * A best-effort estimate of the number of elements a full traversal would
   * encounter. For the array source this is exact and equals the remaining count;
   * a future filtered source would over-estimate (it cannot know how many survive).
   */
  estimateSize(): number;

  /**
   * The exact remaining count if this source is SIZED, else {@link SIZE_UNKNOWN}.
   * `Sink.begin` uses it to pre-size; an unSIZED source makes `begin(SIZE_UNKNOWN)`.
   */
  getExactSizeIfKnown(): number;

  /** This source's characteristic {@link FlagSet} (e.g. ORDERED | SIZED). */
  characteristics(): FlagSet;
}

/**
 * A `Spliterator` over a fixed array — the JDK's `ArraySpliterator`. Faithful
 * traversal over a *snapshot* of `items` taken at construction (the array is copied
 * so a later mutation of the caller's array cannot change an in-flight traversal;
 * the fixture is already frozen, but a generated order list from a property test is
 * not). ORDERED (encounter order is the array order) and SIZED (length is known);
 * the remaining count shrinks by one per successful {@link tryAdvance}.
 */
class ArraySpliterator<T> implements Spliterator<T> {
  private readonly items: readonly T[];
  private index = 0;

  constructor(items: readonly T[]) {
    // Defensive copy: traversal reflects the source as it was when handed over.
    this.items = items.slice();
  }

  tryAdvance(action: (element: T) => void): boolean {
    if (this.index >= this.items.length) return false;
    // Read + advance *before* invoking the action so a re-entrant pull (or an
    // action that throws) cannot replay the same element.
    const element = this.items[this.index];
    this.index += 1;
    action(element as T);
    return true;
  }

  estimateSize(): number {
    return this.items.length - this.index;
  }

  getExactSizeIfKnown(): number {
    return this.estimateSize(); // SIZED ⇒ the estimate is exact.
  }

  characteristics(): FlagSet {
    return combineFlags(OpFlag.ORDERED, OpFlag.SIZED);
  }
}

/**
 * Build a fresh `Spliterator` over `items` (the fixture, or a generated order
 * list). Each call returns an independent, un-started traversal, so a test can run
 * the same source twice without state bleeding between runs.
 */
export function arraySpliterator<T>(items: readonly T[]): Spliterator<T> {
  return new ArraySpliterator(items);
}
