"use client";

import { useFrame } from "@react-three/fiber";
import { useAppStore } from "@/store/appStore";

/**
 * A minimal autoplay driver (S1.5) — advances the store playhead over wall-clock
 * time so the heartbeat *plays* before real transport exists. `speed` is events per
 * second; the playhead loops back to the start at the end of the log.
 *
 * This is a stand-in the transport (S1.10) supersedes: once play/pause/scrub/speed
 * land, that owns the playhead and this component is removed. Kept deliberately
 * small so the seam is clean. It mutates only the playhead (never the log) via
 * `getState()`, so it does not itself subscribe or re-render.
 */
export function AutoPlay({ speed = 5 }: { speed?: number }) {
  const length = useAppStore((s) => s.eventLog.length);

  useFrame((_, delta) => {
    const { playhead, setPlayhead } = useAppStore.getState();
    const end = Math.max(0, length - 1);
    const next = playhead + delta * speed;
    setPlayhead(next > end ? 0 : next);
  });

  return null;
}
