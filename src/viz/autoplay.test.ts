/**
 * S5.1 — the cinematic autoplay clock, tested headlessly through its pure advance
 * step. The R3F `useFrame` shell (`AutoPlay`) only forwards deltas here, so these
 * assertions cover the whole autoplay contract: plays the full story on load (AC1),
 * snaps to whole events under reduced motion (AC2), and yields to the transport the
 * instant it pauses (AC3).
 */
import { describe, it, expect } from "vitest";
import { advancePlayback, REDUCED_MOTION_SPEED, type PlaybackState } from "./autoplay";

const base: PlaybackState = {
  playhead: 0,
  playing: true,
  speed: 4,
  length: 10,
  reducedMotion: false,
};

describe("S5.1 autoplay advances the story on load (AC1)", () => {
  it("moves the playhead forward by delta × speed while playing", () => {
    const tick = advancePlayback(base, 0.5); // 0.5s × 4 ev/s = +2
    expect(tick.playhead).toBeCloseTo(2);
    expect(tick.playing).toBe(true);
  });

  it("plays unattended from the start to the end across successive frames", () => {
    let s = { ...base };
    for (let i = 0; i < 100 && s.playing; i += 1) {
      const tick = advancePlayback(s, 0.1);
      s = { ...s, ...tick };
    }
    expect(s.playhead).toBe(base.length - 1); // reached the final event
    expect(s.playing).toBe(false); // and stopped there
  });

  it("parks exactly on the last event and stops when it reaches the end", () => {
    const tick = advancePlayback({ ...base, playhead: 9.9 }, 1);
    expect(tick.playhead).toBe(9); // length - 1, not overshot
    expect(tick.playing).toBe(false);
  });
});

describe("S5.1 reduced motion narrates at a calm per-event cadence (AC2)", () => {
  it("advances slower than the user's playback speed so each event can be narrated", () => {
    const rm = { ...base, reducedMotion: true };
    const reduced = advancePlayback(rm, 0.4).playhead;
    const normal = advancePlayback(base, 0.4).playhead;
    expect(reduced).toBeCloseTo(0.4 * REDUCED_MOTION_SPEED); // fixed calm rate, not × speed
    expect(reduced).toBeLessThan(normal); // demonstrably calmer than speed=4
  });

  it("dwells on each whole event long enough to be highlighted (none skipped past)", () => {
    let s: PlaybackState = { ...base, reducedMotion: true };
    const dwelt = new Set<number>();
    for (let i = 0; i < 500 && s.playing; i += 1) {
      const tick = advancePlayback(s, 1 / 60); // 60fps frames
      dwelt.add(Math.floor(tick.playhead)); // the step-list highlights floor(playhead)
      s = { ...s, ...tick };
    }
    expect(s.playhead).toBe(base.length - 1);
    expect(s.playing).toBe(false);
    // Every event index was the current (highlighted) event on at least one frame.
    for (let e = 0; e <= base.length - 1; e += 1) expect(dwelt.has(e)).toBe(true);
  });
});

describe("S5.1 transport can take over at any point (AC3)", () => {
  it("never advances a paused clock — a user pause is not overwritten", () => {
    const paused = { ...base, playing: false, playhead: 3.5 };
    expect(advancePlayback(paused, 1)).toEqual({ playhead: 3.5, playing: false });
  });

  it("leaves a scrubbed-to position untouched while paused (no jarring jump)", () => {
    const scrubbed = { ...base, playing: false, playhead: 7 };
    const tick = advancePlayback(scrubbed, 0.25);
    expect(tick.playhead).toBe(7);
  });

  it("does nothing for an empty log", () => {
    const empty = { ...base, length: 0 };
    expect(advancePlayback(empty, 1)).toEqual({ playhead: 0, playing: true });
  });
});
