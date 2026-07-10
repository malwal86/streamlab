/**
 * The **playhead projection** (S0.7, R3): the pure boundary `select(log, playhead)
 * → ViewState`. Render subscribes to this; the engine stays pure TS on the other
 * side of it. The whole credibility invariant (R2) lives here — the view is a
 * *pure function of the log and the playhead*, and may never compute an outcome
 * the log does not already contain.
 *
 * The fractional-playhead **interpolation is stubbed** here (it lands in S1.5):
 * this projection reports which event the playhead sits on and how far past it,
 * but does not yet tween between events. What it must already be — and is —
 * is **pure** and **referentially stable**: the same `(log, playhead)` returns
 * the identically-referenced `ViewState`, so a subscribed component re-renders
 * only when the projection genuinely changes.
 *
 * Zero engine mutation, zero hidden outcomes: everything in `ViewState` is read
 * straight off the log at an index derived from `playhead`.
 */
import { type EngineEvent } from "@/engine/domain/event";

/**
 * The projected view at a playhead. Deliberately minimal in S0.7 — the scene
 * (S1.4) and interpolation (S1.5) grow it. `event` is the event the playhead
 * currently rests on (or `null` for an empty log / a playhead before the first
 * event); `frac` is the fractional distance toward the *next* event, the seam
 * S1.5's tween reads; `atEnd` latches once the playhead reaches the final event.
 */
export interface ViewState {
  /** Index of the event the playhead rests on, clamped to `[-1, log.length-1]` (`-1` ⇒ before the first). */
  readonly eventIndex: number;
  /** The event at `eventIndex`, or `null` when there is none (empty log or pre-roll). */
  readonly event: EngineEvent | null;
  /** Fractional progress `[0, 1)` from the current event toward the next — interpolation stub (S1.5). */
  readonly frac: number;
  /** True once the playhead has reached the last event of the log. */
  readonly atEnd: boolean;
}

/** The view for a log with no events — a stable shared constant so empty runs never re-render. */
const EMPTY_VIEW: ViewState = Object.freeze({
  eventIndex: -1,
  event: null,
  frac: 0,
  atEnd: true,
});

/** Compute the projection from scratch (no memoization) — the pure core. */
function project(log: readonly EngineEvent[], playhead: number): ViewState {
  if (log.length === 0) return EMPTY_VIEW;

  // Clamp the playhead into the log's domain, then split into the integer event
  // index and the fractional distance toward the next event.
  const clamped = Math.min(Math.max(playhead, 0), log.length - 1);
  const eventIndex = Math.floor(clamped);
  const frac = clamped - eventIndex;

  return Object.freeze({
    eventIndex,
    event: log[eventIndex] ?? null,
    frac,
    atEnd: eventIndex >= log.length - 1,
  });
}

/**
 * The last `(log, playhead) → view` computed, cached so repeated identical calls
 * — the overwhelmingly common React render pattern — return the *same reference*.
 * This is the referential-stability guarantee (AC2). It is a memo, not shared
 * mutable state a caller can observe: for any given `(log, playhead)` the output
 * value is always structurally identical, so the function stays referentially
 * transparent.
 */
let lastCall: { log: readonly EngineEvent[]; playhead: number; view: ViewState } | null = null;

/**
 * Project `(log, playhead)` to a `ViewState` — pure and referentially stable.
 * Calling twice with the same arguments returns the identically-referenced
 * result (AC2); the log is never mutated and no outcome is invented (R2).
 */
export function selectViewState(log: readonly EngineEvent[], playhead: number): ViewState {
  if (lastCall && lastCall.log === log && lastCall.playhead === playhead) {
    return lastCall.view;
  }
  const view = project(log, playhead);
  lastCall = { log, playhead, view };
  return view;
}
