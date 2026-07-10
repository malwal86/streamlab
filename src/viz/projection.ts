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
import { type Region } from "@/engine/domain/order";
import { stageX, type StageId } from "./geometry";

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

/** The element's payload from its `emit` — region (fixed) and the pre-map total. */
function emitPayloadOf(
  log: readonly EngineEvent[],
  elementId: number,
): { region: Region; total: number } | null {
  for (const event of log) {
    if (event.kind === "emit" && event.elementId === elementId) {
      return { region: event.input.region, total: event.input.total };
    }
  }
  return null;
}

/** The element's `map` transform (before/after totals), or null if it never mapped (e.g. a reject). */
function transformOf(
  log: readonly EngineEvent[],
  elementId: number,
): { before: number; after: number } | null {
  for (const event of log) {
    if (event.kind === "transform" && event.elementId === elementId) {
      return { before: event.before, after: event.after };
    }
  }
  return null;
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
}

/** The empty scene — nothing in flight (empty log, or a non-heartbeat event). */
const EMPTY_SCENE: SceneState = Object.freeze({
  demandSpike: null,
  pulse: null,
  filterReadout: null,
});

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
  for (const event of log) {
    if (event.kind === "test" && event.elementId === pulse.elementId) {
      return {
        elementId: pulse.elementId,
        text: event.predicate.replace(/o\.total/, String(event.input.total)),
        passed: event.output,
      };
    }
  }
  return null;
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
 */
export function projectScene(log: readonly EngineEvent[], playhead: number): SceneState {
  if (log.length === 0) return EMPTY_SCENE;

  const clamped = clamp(playhead, 0, log.length - 1);
  const index = Math.floor(clamped);
  const frac = clamped - index;
  const current = log[index]!;
  const next = log[index + 1];

  // Retrograde demand spike (terminal → source): the beat's opening pull.
  if (current.kind === "demand") {
    const fromX = stageX("terminal");
    const toX = stageX("source");
    return {
      demandSpike: { x: lerp(fromX, toX, frac), progress: frac },
      pulse: null,
      filterReadout: null,
    };
  }

  // Forward element pulse: interpolate between this station and the next, but only
  // while the next event continues *this* element's journey.
  const fromX = forwardStationX(current.kind);
  if (fromX !== null && current.elementId !== undefined) {
    const payload = emitPayloadOf(log, current.elementId);
    if (payload) {
      const base = {
        elementId: current.elementId,
        kind: current.kind,
        region: payload.region,
        // The morphing total: original pre-map, shrinking across the transform beat,
        // discounted after (S1.8).
        total: currentTotal(log, current, current.elementId, payload.total, frac),
      };

      // A rejected pulse dies *at the filter* (spec §3.6): it never advances in x —
      // it sinks into the void below the conduit and fades. This is what guarantees
      // no pulse is ever rendered past the filter after a `die` (AC2).
      const pulse: Pulse =
        current.kind === "die"
          ? { ...base, x: fromX, y: lerp(0, -DIE_DEPTH, frac), opacity: 1 - frac }
          : (() => {
              const nextX =
                next && next.elementId === current.elementId ? forwardStationX(next.kind) : null;
              const toX = nextX ?? fromX; // no continuation ⇒ hold in place
              return { ...base, x: lerp(fromX, toX, frac), y: 0, opacity: 1 };
            })();

      return { demandSpike: null, pulse, filterReadout: filterReadoutFor(log, pulse) };
    }
  }

  // A non-heartbeat event (parallel `fork`/`lane-demand`/… — later epics). Nothing
  // in flight in the sequential heartbeat.
  return EMPTY_SCENE;
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
