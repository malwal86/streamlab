"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { advancePlayback } from "@/viz/autoplay";

/**
 * The flow-map's playback clock — the DOM twin of the 3D scene's `AutoPlay`. That
 * one is a `useFrame` shell only usable inside an R3F `<Canvas>`; the 2D interface
 * has no such frame loop, so this drives the *same* pure {@link advancePlayback}
 * step from a plain `requestAnimationFrame`. All policy still lives in the tested
 * pure function (play-on-load, reduced-motion cadence, transport takeover); this is
 * only the wall-clock-delta pump around it.
 *
 * It reads/writes the store imperatively via `getState()` inside the frame — never
 * subscribing — so the rAF loop mounts once and never restarts on playhead churn.
 */
export function useAutoPlay(): void {
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    const loop = (now: number) => {
      const prev = lastRef.current ?? now;
      // Seconds since the last frame, clamped so a backgrounded tab that resumes
      // after seconds does not leap the playhead across the whole run.
      const delta = Math.min((now - prev) / 1000, 0.1);
      lastRef.current = now;

      const { playhead, playing, speed, eventLog, reducedMotion, setPlayhead, setPlaying } =
        useAppStore.getState();
      const tick = advancePlayback(
        { playhead, playing, speed, length: eventLog.length, reducedMotion },
        delta,
      );
      if (tick.playhead !== playhead) setPlayhead(tick.playhead);
      if (tick.playing !== playing) setPlaying(tick.playing);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
