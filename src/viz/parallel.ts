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
import { REGIONS, type Region } from "@/engine/domain/order";
import { stageX, type StageId } from "./geometry";
import { type BinFill } from "./projection";

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
 * The caption for a parallel beat — the fork/merge/short-circuit narration the DOM
 * shows (spec §3.4). `fork` announces the split; `combine` the merge ("combiner merges
 * partial maps", S3.5); `found`/`cancel` narrate the Slice-B short-circuit (S4.3) —
 * the ordered-vs-first-home contrast made legible; a lane spike reuses the sequential
 * per-stage captions. Pure over the log so the caption can never disagree with what is
 * on screen.
 */
export function parallelCaptionFor(log: readonly EngineEvent[], playhead: number): string {
  if (log.length === 0) return "";
  const index = Math.floor(clamp(playhead, 0, log.length - 1));
  const current = log[index]!;
  if (current.kind === "fork") return `parallelStream forks into ${current.lanes} lanes`;
  if (current.kind === "combine") return "combiner merges partial maps";
  if (current.kind === "found") {
    // The terminal drives the caption's framing: findFirst is the *ordered*
    // short-circuit (the earliest encounter-order match, reached only after the wait);
    // findAny is *first lane home*. Which one is legible from the cancel reasons the
    // engine already wrote (see parallelTerminalOf) — no viz-side re-derivation.
    const terminal = parallelTerminalOf(log);
    if (terminal === "findFirst") return "findFirst — ordered short-circuit: earliest match wins";
    if (terminal === "findAny") return "findAny — first lane home wins";
    return "FOUND — the terminal latches";
  }
  if (current.kind === "cancel") {
    return `lane ${current.lane ?? ""} cancelled — ${current.reason}`.replace("  ", " ");
  }
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

// ── S3.5: private partial bins + the combiner merge ─────────────────────────
//
// Each lane fills its **own** partial bins as its `accumulate` beats play; the
// bins stay private per lane until the `combine` beat, when the partials flow
// together into the final merged grouping. Both are pure reads of the log, so the
// per-lane towers never cross-contaminate before the merge (spec §3.6) and the
// merged towers equal the engine result — and thus the oracle (S3.5 AC2).

/** One lane's partial bin fill: the count in `lane`'s private `region` bin so far. */
export interface LaneBinFill {
  readonly lane: string;
  readonly region: Region;
  readonly count: number;
}

/**
 * The parallel bins at a playhead: the **private** per-lane partials, plus the
 * **merged** bins once the playhead reaches the `combine` beat. `merged` is `null`
 * before combine — the visible proof the partials are private until the merge
 * (AC1) — and, from combine on, the final grouping the engine reported (AC2).
 * `mergeProgress` tweens `0 → 1` across the combine beat so the R3F merge animation
 * can flow the partials into the center (spec §3.4).
 */
export interface ParallelBins {
  readonly perLane: readonly LaneBinFill[];
  readonly merged: readonly BinFill[] | null;
  readonly mergeProgress: number;
}

/** The index of the log's `combine` beat, or -1 if the playhead-run has none yet. */
function combineIndexOf(log: readonly EngineEvent[]): number {
  return log.findIndex((e) => e.kind === "combine");
}

/**
 * Project the parallel bins at `(log, playhead)` (S3.5). Sums each lane's own
 * `accumulate` events up to the playhead into its private partial bins — the active
 * accumulate growing by the fraction (or in full under `reducedMotion`) — and, once
 * the playhead crosses the `combine` beat, exposes the merged bins the combiner
 * reported. Pure over the log: the per-lane towers are exactly the lane's
 * accumulates, and the merged towers are exactly `combine.merged` (== oracle).
 */
export function parallelBins(
  log: readonly EngineEvent[],
  playhead: number,
  options: { readonly reducedMotion?: boolean } = {},
): ParallelBins {
  const lanes = forkLayout(log).map((l) => l.lane);
  if (lanes.length === 0 || log.length === 0) {
    return { perLane: [], merged: null, mergeProgress: 0 };
  }
  const { reducedMotion = false } = options;
  const clamped = clamp(playhead, 0, log.length - 1);
  const index = Math.floor(clamped);
  const frac = reducedMotion ? 1 : clamped - index;

  // Private per-lane partial counts up to the playhead (active accumulate grows in).
  const counts = new Map<string, Map<Region, number>>();
  for (let i = 0; i <= index; i += 1) {
    const event = log[i]!;
    if (event.kind !== "accumulate" || event.lane === undefined) continue;
    const laneCounts = counts.get(event.lane) ?? new Map<Region, number>();
    counts.set(event.lane, laneCounts);
    const contribution = i === index ? frac : 1;
    laneCounts.set(event.key, (laneCounts.get(event.key) ?? 0) + contribution);
  }
  const perLane: LaneBinFill[] = [];
  for (const lane of lanes) {
    const laneCounts = counts.get(lane);
    for (const region of REGIONS) {
      perLane.push({ lane, region, count: laneCounts?.get(region) ?? 0 });
    }
  }

  // Merged bins appear only once the playhead reaches combine — private until then.
  const combineIndex = combineIndexOf(log);
  let merged: readonly BinFill[] | null = null;
  let mergeProgress = 0;
  if (combineIndex >= 0 && index >= combineIndex) {
    mergeProgress = index > combineIndex ? 1 : frac;
    const combine = log[combineIndex]!;
    if (combine.kind === "combine") {
      merged = REGIONS.map((region) => ({
        region,
        count: combine.merged.find((b) => b.key === region)?.count ?? 0,
      }));
    }
  }

  return { perLane, merged, mergeProgress };
}

// ── S4.3: the lane race + cancellation wavefront ────────────────────────────
//
// Slice B parallel races the lanes to a short-circuit: one lane's match `found`
// latches the winner, and a **dark cancellation wavefront** sweeps the lanes made
// irrelevant (the engine's `cancel` events, S4.1/S4.2). Both are pure reads of the
// log, so what the scene dims is *exactly* the engine's cancel set (AC1) and what
// latches "FOUND" is *exactly* the engine's `found` (AC2) — never a viz guess. The
// ordered-vs-first-home contrast (AC3) is inherent in the log the engine wrote: the
// wavefront and latch simply replay it.

/**
 * Which short-circuit terminal produced this log, read from the `cancel` reasons the
 * engine wrote (`findFirst` cancels name the *encounter-order* match; `findAny` names
 * *another lane first*). Returns `null` for a log with no cancels — a run where no lane
 * had to be made irrelevant (or a non-Slice-B log). Lets the caption frame the found
 * beat as ordered short-circuit vs first-home without the viz re-deriving semantics.
 */
export function parallelTerminalOf(log: readonly EngineEvent[]): "findFirst" | "findAny" | null {
  const cancel = log.find((e) => e.kind === "cancel");
  if (cancel?.kind !== "cancel") return null;
  return cancel.reason.includes("encounter-order") ? "findFirst" : "findAny";
}

/**
 * The set of lane ids the cancellation wavefront has swept by the playhead — every
 * lane whose `cancel` event sits at or before the current index. The set *grows* as
 * the playhead advances (the wavefront sweeping), and by the end of the run equals
 * exactly the engine's cancelled lanes (S4.3 AC1). A pure read of the log.
 */
export function cancelledLanes(log: readonly EngineEvent[], playhead: number): Set<string> {
  const cancelled = new Set<string>();
  if (log.length === 0) return cancelled;
  const index = Math.floor(clamp(playhead, 0, log.length - 1));
  for (let i = 0; i <= index; i += 1) {
    const event = log[i]!;
    if (event.kind === "cancel" && event.lane !== undefined) cancelled.add(event.lane);
  }
  return cancelled;
}

/**
 * The winning lane's "FOUND" latch (S4.3) — the parallel echo of the sequential
 * {@link FoundLatch}. Non-null once the playhead reaches the `found` event and stays
 * latched thereafter. Carries the winner's `lane` (so the badge rides the right
 * conduit) and the matched element's payload — region from its `emit`, total from its
 * `map` (the discounted value it carried in) — read straight from the log, so what
 * glows "FOUND" is always exactly `found.elementId` on `found.lane` (AC2).
 */
export interface ParallelFoundLatch {
  readonly lane: string;
  readonly elementId: number;
  readonly region: Region;
  readonly total: number;
}

export function parallelFoundLatch(
  log: readonly EngineEvent[],
  playhead: number,
): ParallelFoundLatch | null {
  if (log.length === 0) return null;
  const index = Math.floor(clamp(playhead, 0, log.length - 1));
  for (let i = 0; i <= index; i += 1) {
    const event = log[i]!;
    if (event.kind !== "found") continue;
    const emit = log.find((e) => e.kind === "emit" && e.elementId === event.elementId);
    if (emit?.kind !== "emit") return null;
    const transform = log.find((e) => e.kind === "transform" && e.elementId === event.elementId);
    const total = transform?.kind === "transform" ? transform.after : emit.input.total;
    return {
      lane: event.lane ?? emit.lane ?? "",
      elementId: event.elementId,
      region: emit.input.region,
      total,
    };
  }
  return null;
}
