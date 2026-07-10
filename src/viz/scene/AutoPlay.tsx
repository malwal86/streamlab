"use client";

import { useFrame } from "@react-three/fiber";
import { useAppStore } from "@/store/appStore";
import { advancePlayback } from "../autoplay";

/**
 * The playback clock (S1.5 → transport-driven S1.10 → cinematic autoplay S5.1): a
 * thin `useFrame` shell over the pure {@link advancePlayback} step. Each frame it
 * reads the live playback state, hands the frame `delta` to the pure advance
 * function, and writes back the next `{ playhead, playing }`.
 *
 * All policy lives in `advancePlayback` (tested headlessly): the store boots with
 * `playing: true`, so the default Slice-A story powers up and plays on load with no
 * interaction (S5.1 AC1); reduced motion snaps the playhead to whole events (AC2);
 * and because the step never advances a *paused* clock, the transport can take over
 * at any point without a fight or a jump (AC3). It mutates only playhead/playing via
 * `getState()`, never the log.
 */
export function AutoPlay() {
  const length = useAppStore((s) => s.eventLog.length);

  useFrame((_, delta) => {
    const { playhead, playing, speed, reducedMotion, setPlayhead, setPlaying } =
      useAppStore.getState();
    const tick = advancePlayback({ playhead, playing, speed, length, reducedMotion }, delta);
    if (tick.playhead !== playhead) setPlayhead(tick.playhead);
    if (tick.playing !== playing) setPlaying(tick.playing);
  });

  return null;
}
