/**
 * Transport logic (S1.10) — the pure functions behind the DOM chrome. Stepping,
 * active-stage highlighting, and step-list indexing are all pure functions of
 * `(log, playhead)`, so the transport can be unit-tested without rendering, and the
 * chrome components stay thin. The transport only ever *reads* the log and moves the
 * playhead — it never mutates the log (spec §7 / S1.10 technical note).
 */
import { type EngineEvent, type EventKind } from "@/engine/domain/event";

/** The four pipeline stages the code panel highlights. */
export type PipelineStage = "source" | "filter" | "map" | "collect";

/**
 * Which stage each event kind belongs to — the code-panel highlight key. `"collect"`
 * is the *terminal line* key: it lights for the grouping terminal's `route`/
 * `accumulate` (Slice A) and equally for the short-circuit terminal's
 * `found`/`shortcircuit` (Slice B), whichever terminal the code panel is showing.
 */
const STAGE_OF_KIND: Partial<Record<EventKind, PipelineStage>> = {
  demand: "collect", // the terminal's tryAdvance drives the pull
  emit: "source",
  test: "filter",
  survive: "filter",
  die: "filter",
  transform: "map",
  route: "collect",
  accumulate: "collect",
  found: "collect", // Slice B: the terminal latches — its line lights (S2.4)
  shortcircuit: "collect", // Slice B: the terminal ends early — still the terminal line
};

/**
 * Step the playhead by exactly one event (S1.10 AC1). Forward lands on the next
 * integer event, backward on the previous — snapping a fractional (mid-beat)
 * playhead to the adjacent event so one activation always advances one event,
 * deterministically. Clamped to `[0, len-1]`.
 */
export function stepIndex(playhead: number, length: number, direction: 1 | -1): number {
  if (length <= 0) return 0;
  const last = length - 1;
  const target = direction === 1 ? Math.floor(playhead) + 1 : Math.ceil(playhead) - 1;
  return Math.min(Math.max(target, 0), last);
}

/** The integer index of the event the playhead currently rests on (clamped). */
export function currentEventIndex(playhead: number, length: number): number {
  if (length <= 0) return -1;
  return Math.min(Math.max(Math.floor(playhead), 0), length - 1);
}

/**
 * The pipeline stage active at the current playhead — the line the code panel
 * highlights (S1.10 AC3). Derived from the current event's kind, so the highlight
 * always tracks what the engine is actually doing.
 */
export function activeStageFor(
  log: readonly EngineEvent[],
  playhead: number,
): PipelineStage | null {
  const index = currentEventIndex(playhead, log.length);
  if (index < 0) return null;
  return STAGE_OF_KIND[log[index]!.kind] ?? null;
}
