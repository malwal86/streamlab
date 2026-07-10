/**
 * The postprocessing **decision** (S5.2) — a pure function from the reduced-motion
 * flag and the active pulse to the bloom + depth-of-field configuration the
 * {@link import("./scene/PostFx").PostFx} composer renders. Kept pure and out of the
 * R3F tree so the two load-bearing rules are headlessly testable without a GL
 * context: **focus follows the single active pulse** (AC1) and **effects are
 * disabled under reduced motion** (AC3). The frame-budget rule (AC2) is a runtime
 * property of the real composer, not something a unit test can assert — the pure
 * split at least keeps the per-frame work to a target-vector lookup.
 */
import { type Vec3 } from "./geometry";
import { type Pulse } from "./projection";

/**
 * Where depth-of-field focuses when no pulse is in flight (a demand beat, pre-roll,
 * or the end) — the conduit's centre, matching the orbit target so the resting frame
 * is sharp through the middle of the chain rather than snapping focus to the origin.
 */
export const DEFAULT_FOCUS: Vec3 = [1, 0.4, 0];

/** The bloom pass parameters — the emissive glow that has lit the neurons since S1.4. */
export interface BloomConfig {
  readonly intensity: number;
  readonly luminanceThreshold: number;
}

/** The depth-of-field pass: the world-space point to hold in focus, plus lens shape. */
export interface DofConfig {
  /** The focal point — the active pulse's position, so the sharp plane tracks it (AC1). */
  readonly target: Vec3;
  readonly focalLength: number;
  readonly bokehScale: number;
}

/**
 * The resolved postprocessing configuration. `enabled: false` means render *no*
 * composer at all — the reduced-motion path (AC3), where bloom/DoF are removed so
 * nothing pulses or blurs. When enabled, both passes are configured and `dof.target`
 * is the point to keep sharp.
 */
export type PostFxConfig =
  | { readonly enabled: false }
  | { readonly enabled: true; readonly bloom: BloomConfig; readonly dof: DofConfig };

/** Bloom: unchanged from the always-on S1.4 look, now gated behind reduced motion. */
const BLOOM: BloomConfig = { intensity: 0.7, luminanceThreshold: 0.25 };

/**
 * Resolve the postprocessing config for the current beat.
 *
 *   - **Reduced motion** → `{ enabled: false }`: bloom and DoF are switched off so
 *     the scene neither glows nor blurs (AC3, spec §3.7).
 *   - **Otherwise** → bloom on, and DoF focused on the **active pulse** if one is in
 *     flight, else the conduit centre. Because there is at most one pulse at a time
 *     (the single-file guarantee, projection R2), the focus is unambiguous — the
 *     viewer's eye is pulled to the one element in motion (AC1).
 *
 * Pure: the same `(reducedMotion, pulse)` always yields the same config, so the
 * composer is a deterministic function of the scene, never hidden lens state.
 */
export function postFx(reducedMotion: boolean, pulse: Pulse | null): PostFxConfig {
  if (reducedMotion) return { enabled: false };
  const target: Vec3 = pulse ? [pulse.x, pulse.y, pulse.z] : DEFAULT_FOCUS;
  return {
    enabled: true,
    bloom: BLOOM,
    dof: { target, focalLength: 0.02, bokehScale: 3 },
  };
}
