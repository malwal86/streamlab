/**
 * The **parallel scene projection** (S3.4 → S3.5) — pure functions from a *parallel*
 * event log (fork + interleaved lane beats + combine) to what the forked R3F scene
 * draws. Like `projection.ts` for the sequential conduit, this keeps the credibility
 * invariant (R2) on the viz side: the fork geometry, the per-lane spikes, and the
 * private bins are all **pure reads of the log** — nothing invented.
 *
 * The engine simulates parallelism as a single totally-ordered log whose lane beats
 * interleave (never real threads — `parallel.ts`). So at any playhead exactly one
 * event is current, and the lane it belongs to is the one animating; the others rest
 * at their last-settled position. That is precisely the **"one spike per lane max"**
 * guardrail (S3.4 AC3, spec §3.6): the projection can never surface two in-flight
 * spikes for a single lane, because it reads one event at a time and the engine's
 * per-lane single-file invariant (S3.1) guarantees a lane's beats never overlap.
 *
 * S3.4 owns the fork geometry + per-lane demand/pulse spike; S3.5 adds the private
 * partial bins and the merge beat.
 */
import { type EngineEvent, type EventKind, type SplitNode } from "@/engine/domain/event";
import { stageX, type StageId } from "./geometry";

/** Vertical spacing between adjacent lane conduits — lanes fan out along y. */
export const LANE_Y_SPACING = 2.4;

/**
 * One lane's conduit placement in the forked scene: its `lane` id, the vertical `y`
 * its copy of `source → filter → map → terminal` sits at, and the `estimatedSize` its
 * fork branch grows from (the leaf's split-tree size).
 */
export interface LaneLayout {
  readonly lane: string;
  readonly y: number;
  readonly estimatedSize: number;
}

/** The `fork` event of a parallel log, or null if it has none (a sequential log). */
function forkEvent(log: readonly EngineEvent[]): Extract<EngineEvent, { kind: "fork" }> | null {
  const fork = log.find((e) => e.kind === "fork");
  return fork && fork.kind === "fork" ? fork : null;
}

/** The split tree's leaves, left-to-right (encounter order across lanes = lane order). */
function leaves(node: SplitNode): SplitNode[] {
  if (!node.children) return [node];
  return [...leaves(node.children[0]), ...leaves(node.children[1])];
}

/**
 * The lane layout for a parallel log: one {@link LaneLayout} per leaf of the fork's
 * split tree, spread symmetrically along y and centered on the axis (AC1). Returns
 * `[]` for a log with no fork (sequential), so the forked scene simply renders
 * nothing then. Pure over the log — the geometry is driven entirely by the `fork`
 * event's split tree, never by a lane count guessed elsewhere.
 */
export function forkLayout(log: readonly EngineEvent[]): LaneLayout[] {
  const fork = forkEvent(log);
  if (!fork) return [];
  const laneLeaves = leaves(fork.splitTree);
  const n = laneLeaves.length;
  return laneLeaves.map((leaf, i) => ({
    lane: leaf.lane,
    y: (i - (n - 1) / 2) * LANE_Y_SPACING,
    estimatedSize: leaf.estimatedSize,
  }));
}

/**
 * The conduit station a forward-journey event parks the pulse at (the parallel mirror
 * of `projection.ts`'s `FORWARD_STATION`). Per-lane events travel the same left→right
 * stages, just at the lane's y-offset.
 */
const FORWARD_STATION: Partial<Record<EventKind, StageId>> = {
  emit: "source",
  test: "filter",
  survive: "filter",
  die: "filter",
  transform: "map",
  route: "terminal",
  accumulate: "terminal",
};

/** Linear interpolation `a → b` by `t ∈ [0, 1]`. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp `v` into `[min, max]`. */
function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/**
 * The single in-flight signal at a playhead, if any: a retrograde `lane-demand`
 * spike or a forward pulse, tagged with the lane it belongs to. Exactly one lane can
 * be active at a time (the log is totally ordered), so this is the whole content of
 * the "one spike per lane" guarantee.
 */
export interface LaneSpike {
  readonly lane: string;
  /** `demand` = retrograde pull spike (terminal→source); `pulse` = forward element. */
  readonly kind: "demand" | "pulse";
  /** Current x along the stage axis. */
  readonly x: number;
  /** The lane's conduit y-offset (from {@link forkLayout}). */
  readonly y: number;
  /** `[0,1]` progress across the current beat. */
  readonly progress: number;
  /** For a pulse: the element and the forward event it currently embodies. */
  readonly elementId?: number;
  readonly forwardKind?: EventKind;
}

/**
 * Project the active lane spike at `(log, playhead)` — the one lane animating, or
 * `null` on a framing event (`fork`/`combine`) or an empty log. A `lane-demand`
 * yields a retrograde demand spike in its lane; a forward lane event yields a pulse
 * traveling toward the next station of the same element's journey. Under
 * `reducedMotion` the spike **snaps** — it renders the settled start of its beat with
 * no tween (AC4). The lane's y comes from {@link forkLayout}, so the spike rides its
 * own conduit.
 */
export function activeLaneSpike(
  log: readonly EngineEvent[],
  playhead: number,
  options: { readonly reducedMotion?: boolean } = {},
): LaneSpike | null {
  if (log.length === 0) return null;
  const { reducedMotion = false } = options;

  const clamped = clamp(playhead, 0, log.length - 1);
  const index = Math.floor(clamped);
  const frac = reducedMotion ? 0 : clamped - index;
  const current = log[index]!;
  if (current.lane === undefined) return null; // fork/combine framing — no lane spike

  const yById = new Map(forkLayout(log).map((l) => [l.lane, l.y]));
  const y = yById.get(current.lane) ?? 0;

  if (current.kind === "lane-demand") {
    const fromX = stageX("terminal");
    const toX = stageX("source");
    return { lane: current.lane, kind: "demand", x: lerp(fromX, toX, frac), y, progress: frac };
  }

  const fromStage = FORWARD_STATION[current.kind];
  if (fromStage === undefined || current.elementId === undefined) return null;
  const fromX = stageX(fromStage);
  // Travel toward the next station only if the next event continues this element's
  // journey in the same lane; otherwise hold (e.g. accumulate → the next lane's beat).
  const next = log[index + 1];
  const nextStage =
    next && next.elementId === current.elementId && next.lane === current.lane
      ? FORWARD_STATION[next.kind]
      : undefined;
  const toX = nextStage !== undefined ? stageX(nextStage) : fromX;
  return {
    lane: current.lane,
    kind: "pulse",
    x: lerp(fromX, toX, frac),
    y,
    progress: frac,
    elementId: current.elementId,
    forwardKind: current.kind,
  };
}

/**
 * In-flight spikes **per lane** at a playhead — 0 or 1 for each lane, keyed by lane
 * id. The guardrail the S3.4 projection test samples across the whole log: no lane's
 * load ever exceeds 1 (spec §3.6 parallel single-file, AC3). A pure read: at most one
 * lane is active per playhead (from {@link activeLaneSpike}), so every entry is 0 or
 * exactly 1, for every parallel log the engine can produce.
 */
export function laneSpikeLoad(log: readonly EngineEvent[], playhead: number): Map<string, number> {
  const load = new Map(forkLayout(log).map((l) => [l.lane, 0]));
  const spike = activeLaneSpike(log, playhead);
  if (spike) load.set(spike.lane, (load.get(spike.lane) ?? 0) + 1);
  return load;
}

/**
 * The caption for a parallel beat — the fork/merge narration the DOM shows (spec
 * §3.4). `fork` announces the split; `combine` the merge ("combiner merges partial
 * maps", S3.5); a lane spike reuses the sequential per-stage captions. Pure over the
 * log so the caption can never disagree with what is on screen.
 */
export function parallelCaptionFor(log: readonly EngineEvent[], playhead: number): string {
  if (log.length === 0) return "";
  const index = Math.floor(clamp(playhead, 0, log.length - 1));
  const current = log[index]!;
  if (current.kind === "fork") return `parallelStream forks into ${current.lanes} lanes`;
  if (current.kind === "combine") return "combiner merges partial maps";
  const spike = activeLaneSpike(log, playhead);
  if (spike?.kind === "demand") return "lane pulls the next element";
  if (spike?.kind === "pulse") return LANE_PULSE_CAPTION[spike.forwardKind ?? "emit"] ?? "";
  return "";
}

/** Per-stage caption for a forward lane pulse (the parallel echo of the sequential captions). */
const LANE_PULSE_CAPTION: Partial<Record<EventKind, string>> = {
  emit: "lane emits the next element",
  test: "lane filters the predicate",
  survive: "element survives the filter",
  die: "element rejected at the filter",
  transform: "lane maps applyDiscount",
  route: "groupingBy routes to the lane's bin",
  accumulate: "accumulate into the lane's private bin",
};
