"use client";

import { useAppStore } from "@/store/appStore";
import { projectScene, type SceneState } from "../projection";

/**
 * The scene projection at the current playhead — the shared read every 3D component
 * (`Heartbeat`, `FilterReadout`, `RegionBins`) derives its geometry from. It wraps
 * the one store read + `projectScene(log, playhead, { reducedMotion })` call those
 * components would otherwise each repeat, so the pure-function-of-the-log contract
 * (R2) has a single call site on the viz side. Subscribes to the same three store
 * slices as before, so render/subscription behavior is unchanged.
 */
export function useScene(): SceneState {
  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  return projectScene(log, playhead, { reducedMotion });
}
