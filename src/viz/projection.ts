/**
 * The scene projection (S1.4 seed → S1.5+ full) — pure functions from the event log
 * (and, from S1.5, the playhead) to what the R3F scene draws. This is where the
 * credibility invariant (R2) lives on the viz side: **the scene is a pure function
 * of the log**, computing nothing the log does not contain. Keeping it here (not in
 * the components) is what makes the guardrails — "never two spikes", "die at the
 * filter", "bins == oracle" — headlessly testable without a GL context.
 *
 * S1.4 needs only the *static* topology plus one read of the log: the source stack.
 * S1.5 adds the fractional-playhead interpolation (the demand spike + forward
 * pulse); later stories add encoding, bins, and the found latch. Each addition is a
 * pure function with its own property/projection test.
 */
import { type EngineEvent, type EventKind } from "@/engine/domain/event";
import { REGIONS, type Region } from "@/engine/domain/order";
import { binPosition, stageX, type StageId } from "./geometry";

/**
 * How many elements the source will release over the whole run — the count of
 * `emit` events in the log. The scene renders these as the inert **source stack**
 * (spec §3.2: the stack sits dark until the terminal first demands from it, the
 * laziness cue S1.5 animates). A pure read of the log, so the stack height always
 * equals exactly what the engine emitted.
 */
export function sourceStackCount(log: readonly EngineEvent[]): number {
  return log.reduce((n, event) => (event.kind === "emit" ? n + 1 : n), 0);
}

// ── S1.5: the demand heartbeat + forward pulse ──────────────────────────────
//
// The scene at a fractional playhead is a pure function of `(log, playhead)`
// (R2). The log is a strict alternation of *beats*: a retrograde `demand`
// (terminal → source) followed by exactly one element's forward journey
// (`emit → test → survive → transform → route → accumulate`, or `emit → test →
// die`). So at any playhead **at most one** signal is in flight — a demand spike
// *or* a forward pulse, never two (spec §3.6, the single-file guardrail). This
// projection makes that a provable property rather than an animation convention:
// which signal (if any) is live, and where, both fall out of the event the
// playhead currently rests on.

/** Linear interpolation `a → b` by `t ∈ [0, 1]`. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp `v` into `[min, max]`. */
function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/**
 * The conduit stage each forward-journey event parks the pulse at — the "keyframe
 * stations" the pulse interpolates between (spec §3.2). `emit` releases at the
 * source; `test`/`survive`/`die` happen at the filter; `transform` at the map;
 * `route`/`accumulate` at the terminal (the bin refinement is S1.9). Events not in
 * this map (`demand`, and the parallel-only kinds) are not forward-pulse events.
 */
const FORWARD_STATION: Partial<Record<EventKind, StageId>> = {
  emit: "source",
  test: "filter",
  survive: "filter",
  die: "filter",
  transform: "map",
  route: "terminal",
  accumulate: "terminal",
  found: "terminal", // Slice B: the survivor reaches the terminal and latches (S2.2)
};

/** The x-station of a forward-journey event, or `null` if the kind isn't one. */
function forwardStationX(kind: EventKind): number | null {
  const stage = FORWARD_STATION[kind];
  return stage === undefined ? null : stageX(stage);
}

/** The retrograde demand spike in flight: its current x and `[0,1)` progress source-ward. */
export interface DemandSpike {
  readonly x: number;
  /** 0 at the terminal (just requested), →1 as it reaches the source. */
  readonly progress: number;
}

/** The single forward element pulse in flight: which element, where, and its current stage. */
export interface Pulse {
  readonly elementId: number;
  readonly x: number;
  readonly y: number;
  /** Depth — 0 on the main axis; swings toward the region bin as the pulse routes (S1.9). */
  readonly z: number;
  /** The forward event the pulse currently embodies — what S1.6+ encode/animate off. */
  readonly kind: EventKind;
  /** The element's group region (from its `emit`) — drives hue + glyph (S1.6). */
  readonly region: Region;
  /** The element's total the encoding sizes/labels off. Initial (pre-map) value; the morph is S1.8. */
  readonly total: number;
  /** `[0,1]` visibility — 1 normally; fades to 0 as a rejected pulse dissipates (S1.7). */
  readonly opacity: number;
}

/** The filter's live threshold readout while a pulse is at the filter (S1.7). */
export interface FilterReadout {
  readonly elementId: number;
  /** The predicate with the live value substituted, e.g. `"1200 > 100"`. */
  readonly text: string;
  /** Whether the element passed — survivors glow, rejects dissipate. */
  readonly passed: boolean;
}

/** The specific event member for a given `kind` discriminant (e.g. `"emit"` → {@link EmitEvent}). */
type EventOfKind<K extends EventKind> = Extract<EngineEvent, { kind: K }>;

/**
 * The first log event of `kind` naming `elementId` — the single scan the payload
 * lookups below share. A pure read of the log (the first match is the canonical one,
 * since every element passes each stage at most once in encounter order).
 */
function findElementEvent<K extends EventKind>(
  log: readonly EngineEvent[],
  kind: K,
  elementId: number,
): EventOfKind<K> | undefined {
  return log.find(
    (event): event is EventOfKind<K> => event.kind === kind && event.elementId === elementId,
  );
}

/** The element's payload from its `emit` — region (fixed) and the pre-map total. */
function emitPayloadOf(
  log: readonly EngineEvent[],
  elementId: number,
): { region: Region; total: number } | null {
  const emit = findElementEvent(log, "emit", elementId);
  return emit ? { region: emit.input.region, total: emit.input.total } : null;
}

/** The element's `map` transform (before/after totals), or null if it never mapped (e.g. a reject). */
function transformOf(
  log: readonly EngineEvent[],
  elementId: number,
): { before: number; after: number } | null {
  const transform = findElementEvent(log, "transform", elementId);
  return transform ? { before: transform.before, after: transform.after } : null;
}

/**
 * The pulse's total *as of the current beat* — this is where the map size-morph
 * lives (S1.8). Before the map the total is the emit value; **at** the `transform`
 * beat it interpolates `before → after` over the fraction (the visible shrink); and
 * after the map it holds at the discounted `after`. So size and label follow the
 * discount exactly where `applyDiscount` happens, keyed off the `transform` event's
 * own before/after (spec §3.3), never a re-computed discount.
 */
function currentTotal(
  log: readonly EngineEvent[],
  current: EngineEvent,
  elementId: number,
  initialTotal: number,
  frac: number,
): number {
  if (current.kind === "transform") {
    return lerp(current.before, current.after, frac);
  }
  if (current.kind === "route" || current.kind === "accumulate") {
    return transformOf(log, elementId)?.after ?? initialTotal;
  }
  return initialTotal; // pre-map beats (emit/test/survive/die) carry the original total
}

/** A region bin's fill at the current playhead — its count so far (fractional while growing). */
export interface BinFill {
  readonly region: Region;
  /** Elements accumulated so far — grows by a fraction across the active `accumulate` beat. */
  readonly count: number;
}

/**
 * The terminal's "FOUND" latch (S2.2, Slice B) — the payoff of a short-circuit run.
 * Non-null once the playhead reaches the `found` event and **stays latched** for the
 * rest of the run (the terminal does not un-find). Carries the matched element's
 * identity + payload so the badge reads it without color (`elementId` is exactly
 * `found.elementId`, S2.2 AC1). Distinct from {@link BinFill}: bins are towers off
 * to the side; the latch fires *on the terminal itself*, the Slice B motif.
 */
export interface FoundLatch {
  readonly elementId: number;
  /** The matched element's region — glyph + hue on the badge (never color alone). */
  readonly region: Region;
  /** Its total (post-`map`, the discounted value the pulse carried in). */
  readonly total: number;
}

/**
 * The source stack's state at the current playhead (S2.3, Slice B wow). The stack
 * shows one slot per source element — `total` of them — regardless of how many were
 * pulled: a short-circuit run only *emits* the pulled prefix, so the un-pulled
 * remainder has no `emit` in the log and its count must come from
 * `shortcircuit.remainingUnpulled`. `neverPulledCount` is 0 until the playhead
 * reaches the `shortcircuit` beat, then equals that remainder — the slots that go
 * **dark** because they were never demanded (AC1/AC2). In Slice A everything is
 * pulled, so `neverPulledCount` stays 0 and `total` == the emit count.
 */
export interface SourceState {
  /** Total source elements — pulled (`emit`s) plus the never-pulled remainder. */
  readonly total: number;
  /** How many trailing slots are dark ("never pulled"); 0 until `shortcircuit`. */
  readonly neverPulledCount: number;
}

/**
 * What the scene draws at a playhead. Exactly one of `demandSpike`/`pulse` is
 * non-null while a beat is in flight (or both null on a non-heartbeat event) — the
 * "never two spikes" guardrail, true by construction (S1.5 AC3).
 */
export interface SceneState {
  readonly demandSpike: DemandSpike | null;
  readonly pulse: Pulse | null;
  /** The filter's threshold readout, non-null while a pulse is being decided at the filter (S1.7). */
  readonly filterReadout: FilterReadout | null;
  /** Every region bin's fill up to the playhead — the growing 3D towers (S1.9). */
  readonly bins: readonly BinFill[];
  /** The terminal's latched "FOUND" result once the playhead passes `found` (S2.2); else null. */
  readonly found: FoundLatch | null;
  /** The source stack: its total height and how much of it has gone dark, never-pulled (S2.3). */
  readonly source: SourceState;
}

/** Zero-fill bins for every region — the empty-scene / pre-roll state. */
const EMPTY_BINS: readonly BinFill[] = Object.freeze(
  REGIONS.map((region) => Object.freeze({ region, count: 0 })),
);

/** The zero source stack — an empty log has no elements to pull. */
const EMPTY_SOURCE: SourceState = Object.freeze({ total: 0, neverPulledCount: 0 });

/** The empty scene — nothing in flight (empty log, or a non-heartbeat event). */
const EMPTY_SCENE: SceneState = Object.freeze({
  demandSpike: null,
  pulse: null,
  filterReadout: null,
  bins: EMPTY_BINS,
  found: null,
  source: EMPTY_SOURCE,
});

/**
 * Every region bin's fill at `(eventIndex, frac)`: one count per `accumulate` seen
 * up to `eventIndex`, with the *current* accumulate contributing only `frac` so the
 * tower grows smoothly across its beat (spec §3.2 step 5). A pure read of the log,
 * so at the end of the run each bin equals the engine's grouping count — and thus
 * the oracle (S1.9 AC2).
 */
function binsAt(log: readonly EngineEvent[], eventIndex: number, frac: number): readonly BinFill[] {
  const counts = new Map<Region, number>();
  for (let i = 0; i <= eventIndex; i += 1) {
    const event = log[i]!;
    if (event.kind !== "accumulate") continue;
    const contribution = i === eventIndex ? frac : 1; // the active accumulate grows in
    counts.set(event.key, (counts.get(event.key) ?? 0) + contribution);
  }
  return REGIONS.map((region) => ({ region, count: counts.get(region) ?? 0 }));
}

/**
 * The terminal's latch at `eventIndex`: the `found` event at or before the playhead,
 * projected to a {@link FoundLatch} (S2.2). Scans forward for the first `found` (a
 * short-circuit run has at most one) and, if it is at or before the current index,
 * reads the matched element's payload — region from its `emit`, total from its
 * `map` (the discounted value it carried into the terminal). The latch is a pure
 * read of the log, so what glows "FOUND" is always exactly `found.elementId` (AC1),
 * and once set it persists to the end of the run (the scan never clears it).
 */
function foundLatchAt(log: readonly EngineEvent[], eventIndex: number): FoundLatch | null {
  for (let i = 0; i <= eventIndex; i += 1) {
    const event = log[i]!;
    if (event.kind !== "found") continue;
    const payload = emitPayloadOf(log, event.elementId);
    if (!payload) return null;
    const total = transformOf(log, event.elementId)?.after ?? payload.total;
    return { elementId: event.elementId, region: payload.region, total };
  }
  return null;
}

/**
 * The source stack's state at `eventIndex` (S2.3). `total` is every source element
 * — the `emit`s (pulled) plus `shortcircuit.remainingUnpulled` (never pulled), the
 * only place the un-pulled count is recorded (they have no `emit`). `neverPulledCount`
 * stays 0 until the playhead reaches the `shortcircuit` beat, then reveals that
 * remainder as the dark, never-demanded slots (AC1/AC2). A pure read of the log, so
 * the counter always equals the engine's `remainingUnpulled`, never a re-count.
 */
function sourceStateAt(log: readonly EngineEvent[], eventIndex: number): SourceState {
  let emits = 0;
  let scIndex = -1;
  let remaining = 0;
  for (let i = 0; i < log.length; i += 1) {
    const event = log[i]!;
    if (event.kind === "emit") emits += 1;
    else if (event.kind === "shortcircuit") {
      scIndex = i;
      remaining = event.remainingUnpulled;
    }
  }
  const neverPulledCount = scIndex >= 0 && eventIndex >= scIndex ? remaining : 0;
  return { total: emits + remaining, neverPulledCount };
}

/** How far below the conduit a rejected pulse sinks as it dissipates (spec §3.6). */
const DIE_DEPTH = 3.2;

/** The filter stages a pulse is "at the filter" for — where the readout shows and death happens. */
const FILTER_STAGE_KINDS: ReadonlySet<EventKind> = new Set(["test", "survive", "die"]);

/**
 * The filter's live readout for the element a pulse currently embodies, if that
 * pulse is at the filter (`test`/`survive`/`die`). Substitutes the element's total
 * into its `test` predicate (`"o.total > 100"` → `"1200 > 100"`) and reports the
 * boolean — so the neuron shows the real comparison the engine made (S1.7 AC1),
 * never a re-derived one.
 */
function filterReadoutFor(log: readonly EngineEvent[], pulse: Pulse): FilterReadout | null {
  if (!FILTER_STAGE_KINDS.has(pulse.kind)) return null;
  const test = findElementEvent(log, "test", pulse.elementId);
  if (!test) return null;
  return {
    elementId: pulse.elementId,
    text: test.predicate.replace(/o\.total/, String(test.input.total)),
    passed: test.output,
  };
}

/**
 * Project `(log, playhead)` to the scene's in-flight state. The playhead's integer
 * part selects the current event; its fraction tweens toward the next.
 *
 *   - On a `demand`, a dim retrograde spike travels terminal → source over the
 *     fraction — the pull that *precedes* the element leaving the source (AC1).
 *   - On a forward event, the bright pulse for that element travels from this
 *     event's station toward the next event's station *if the next event continues
 *     the same element's journey*; otherwise it rests (e.g. `accumulate` → the next
 *     beat's `demand`, so the pulse holds at the terminal and fades).
 *
 * Pure and deterministic: the same `(log, playhead)` always yields structurally
 * identical state, so scrubbing is smooth and reversible (AC5).
 *
 * `reducedMotion` (S1.11): honor `prefers-reduced-motion` by **snapping** — the
 * pulse jumps stage-to-stage instead of animating flight (position/size/opacity use
 * the current event's settled value, no tween), and a bin counts its current
 * `accumulate` in full. Every event is still represented; the motion is removed, not
 * the meaning (spec §3.7). The step-list carries the full story regardless.
 */
export function projectScene(
  log: readonly EngineEvent[],
  playhead: number,
  options: { readonly reducedMotion?: boolean } = {},
): SceneState {
  if (log.length === 0) return EMPTY_SCENE;
  const { reducedMotion = false } = options;

  const clamped = clamp(playhead, 0, log.length - 1);
  const index = Math.floor(clamped);
  const frac = clamped - index;
  // Under reduced motion, snap: use 0 for every tween so a beat renders its start
  // (settled) state and only jumps when the playhead crosses to the next event.
  const posT = reducedMotion ? 0 : frac;
  const current = log[index]!;
  const next = log[index + 1];

  // The bins grow independently of what is in flight — they hold their fill during a
  // demand, and the active region's tower grows across its `accumulate` beat (S1.9).
  // Reduced motion counts the current accumulate in full (no growth animation).
  const bins = binsAt(log, index, reducedMotion ? 1 : frac);
  // The FOUND latch persists once passed — independent of what is in flight (S2.2).
  const found = foundLatchAt(log, index);
  // The source stack + its never-pulled dark remainder, revealed at shortcircuit (S2.3).
  const source = sourceStateAt(log, index);

  // Retrograde demand spike (terminal → source): the beat's opening pull.
  if (current.kind === "demand") {
    const fromX = stageX("terminal");
    const toX = stageX("source");
    return {
      demandSpike: { x: lerp(fromX, toX, posT), progress: posT },
      pulse: null,
      filterReadout: null,
      bins,
      found,
      source,
    };
  }

  // Forward element pulse.
  const fromX = forwardStationX(current.kind);
  if (fromX !== null && current.elementId !== undefined) {
    const payload = emitPayloadOf(log, current.elementId);
    if (payload) {
      const base = {
        elementId: current.elementId,
        kind: current.kind,
        region: payload.region,
        // The morphing total: original pre-map, shrinking across the transform beat,
        // discounted after (S1.8). Snaps (no gradual shrink) under reduced motion.
        total: currentTotal(log, current, current.elementId, payload.total, posT),
      };
      const [binX, , binZ] = binPosition(payload.region);

      let pulse: Pulse;
      if (current.kind === "die") {
        // Rejected *at the filter* (spec §3.6): sinks into the void, never advancing
        // in x — the guarantee no pulse renders past the filter after a `die` (AC2).
        pulse = { ...base, x: fromX, y: lerp(0, -DIE_DEPTH, posT), z: 0, opacity: 1 - posT };
      } else if (current.kind === "route") {
        // On `route` the classifier picks the bin — the pulse flies off the main axis
        // toward its region bin (S1.9): x terminal→bin, z 0→binZ.
        pulse = { ...base, x: lerp(stageX("terminal"), binX, posT), y: 0, z: lerp(0, binZ, posT), opacity: 1 };
      } else if (current.kind === "accumulate") {
        // Landed at the bin, merging in as the tower grows over the beat.
        pulse = { ...base, x: binX, y: 0, z: binZ, opacity: 1 - posT };
      } else if (current.kind === "found") {
        // Slice B: the survivor reaches the terminal and *latches* — it holds there,
        // fully lit, rather than dispersing to a bin (the FOUND payoff, S2.2).
        pulse = { ...base, x: stageX("terminal"), y: 0, z: 0, opacity: 1 };
      } else {
        // emit/test/survive/transform: travel along the main axis toward the next
        // station while the journey continues; otherwise hold in place.
        const nextX =
          next && next.elementId === current.elementId ? forwardStationX(next.kind) : null;
        const toX = nextX ?? fromX;
        pulse = { ...base, x: lerp(fromX, toX, posT), y: 0, z: 0, opacity: 1 };
      }

      return {
        demandSpike: null,
        pulse,
        filterReadout: filterReadoutFor(log, pulse),
        bins,
        found,
        source,
      };
    }
  }

  // A non-heartbeat event (`shortcircuit`, or parallel `fork`/`lane-demand`/… —
  // later epics): nothing in flight, but the bins, FOUND latch, and dark source
  // remainder still show.
  return { demandSpike: null, pulse: null, filterReadout: null, bins, found, source };
}

/** The caption shown for each forward-pulse stage (the demand caption is fixed). */
const PULSE_CAPTION: Partial<Record<EventKind, string>> = {
  emit: "source emits the next element",
  test: "filter evaluates the predicate",
  survive: "element survives the filter",
  die: "element rejected at the filter",
  transform: "map applies applyDiscount",
  route: "groupingBy routes by region",
  accumulate: "accumulate into the region bin",
  found: "findFirst latches · FOUND",
};

/**
 * The DOM caption for the current beat (spec §3.2). A demand spike always reads
 * `spliterator.tryAdvance()` — the pull that opens the beat; a forward pulse reads
 * its stage. Pure over `(log, playhead)`, like everything else the viz shows.
 */
export function captionFor(log: readonly EngineEvent[], playhead: number): string {
  const { demandSpike, pulse } = projectScene(log, playhead);
  if (demandSpike) return "spliterator.tryAdvance()";
  if (pulse) return PULSE_CAPTION[pulse.kind] ?? "";
  return "";
}
