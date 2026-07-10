/**
 * The autoplay clock's **pure advance step** (S5.1). `AutoPlay` (the R3F
 * `useFrame` driver) is a thin shell around this: each frame it hands the current
 * playback state and the frame `delta` here and writes back the result. Keeping
 * the decision pure — no `useFrame`, no store, no three.js — is what makes the
 * cinematic autoplay headlessly testable: "plays the full story on load", "snaps
 * (whole-event steps) under reduced motion", and "the transport can take over at
 * any point" all fall out of this one function (S5.1 AC1–AC3).
 *
 * The load-bearing rule for transport takeover (AC3): this function **only ever
 * advances a *playing* clock**. The moment the transport pauses, scrubs, or steps
 * (all of which set `playing = false` / move the playhead), `advancePlayback`
 * returns the state untouched — so a user grabbing the controls mid-run never
 * fights the autoplay, and there is no jarring state jump.
 */

/** The slice of playback state the autoplay clock reads and advances. */
export interface PlaybackState {
  /** Fractional playhead — the position the projection reads (S1.5). */
  readonly playhead: number;
  /** Whether the clock is running. Autoplay never advances a paused clock (AC3). */
  readonly playing: boolean;
  /** Playback rate in events per second (transport speed). */
  readonly speed: number;
  /** The event count — the run ends at index `length - 1`. */
  readonly length: number;
  /** `prefers-reduced-motion` mirror — snap to whole events instead of tweening (AC2). */
  readonly reducedMotion: boolean;
}

/** The autoplay's write-back: the next playhead and whether the clock keeps running. */
export interface PlaybackTick {
  readonly playhead: number;
  readonly playing: boolean;
}

/**
 * The autoplay cadence under reduced motion, in events per second. The projection
 * already *snaps* the picture stage-to-stage (no flight tween) when reduced motion
 * is on; here the clock also slows to a gentle, fixed pace so each event gets a
 * readable dwell for the step-list / screen reader to narrate (S5.1 AC2) instead of
 * flickering past at the user's chosen playback speed. Fixed (not `× speed`) because
 * the whole point is a calm, announce-able beat rather than a fast one.
 */
export const REDUCED_MOTION_SPEED = 1.5;

/**
 * Advance the playback clock one frame. Returns the next `{ playhead, playing }`:
 *
 *   - **Not playing / empty log** → returned unchanged. This is the transport
 *     takeover guarantee (AC3): a paused or scrubbing user is never overwritten.
 *   - **Reaches the end** → parks exactly on the final event and clears `playing`
 *     (the story finished; the transport can replay from the top).
 *   - **Reduced motion** → advances at the calm {@link REDUCED_MOTION_SPEED} so each
 *     event dwells long enough to be narrated; the playhead stays fractional (it must,
 *     to accumulate) while the projection snaps the *picture* to whole stations (AC2).
 *   - **Otherwise** → advances smoothly by `delta × speed` events (AC1).
 *
 * Pure and deterministic: the same `(state, delta)` always yields the same tick,
 * so autoplay is a function of wall-clock deltas alone, never hidden internal state.
 */
export function advancePlayback(state: PlaybackState, delta: number): PlaybackTick {
  const { playhead, playing, speed, length, reducedMotion } = state;

  // Transport takeover / nothing to play: never touch a paused or empty clock (AC3).
  if (!playing || length === 0) return { playhead, playing };

  const end = length - 1;
  const rate = reducedMotion ? REDUCED_MOTION_SPEED : speed;
  const raw = playhead + delta * rate;

  // Reached (or overran) the last event: park on it and stop — the run is done.
  if (raw >= end) return { playhead: end, playing: false };

  return { playhead: raw, playing: true };
}
