"use client";

import { useFrame } from "@react-three/fiber";
import { useAppStore } from "@/store/appStore";

/**
 * The playback clock (S1.5 → driven by transport in S1.10): advances the store
 * playhead over wall-clock time while `playing`, at `speed` events per second. It
 * reads play-state and speed from the store, so the transport's play/pause/speed
 * controls steer it. On reaching the end it stops at the last event and clears
 * `playing` (the autoplay finished) — the transport, or S5.1's cinematic loop, can
 * restart it. It mutates only playhead/playing via `getState()`, never the log.
 */
export function AutoPlay() {
  const length = useAppStore((s) => s.eventLog.length);

  useFrame((_, delta) => {
    const { playing, speed, playhead, setPlayhead, setPlaying } = useAppStore.getState();
    if (!playing || length === 0) return;

    const end = length - 1;
    const next = playhead + delta * speed;
    if (next >= end) {
      setPlayhead(end);
      setPlaying(false); // reached the end — pause; transport can replay
    } else {
      setPlayhead(next);
    }
  });

  return null;
}
