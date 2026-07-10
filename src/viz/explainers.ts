/**
 * The explainer-card **content** (S5.3) — a pure function from `(log, playhead)` to
 * the one DOM card to show at the current beat: which conduit stage it anchors to,
 * a terse title, and a body carrying the beat's **live values** (the substituted
 * predicate, the map's before→after, the bin count, the found id). It is the
 * Java-engineer's running commentary — `tryAdvance`, the sink chain, the threshold,
 * `applyDiscount`, `groupingBy` accumulate, fork/join, the combiner, encounter
 * order, ordered-vs-unordered short-circuit (spec §7, S5.3).
 *
 * Pure and event-timed by construction: the card is keyed off the event the playhead
 * currently rests on, so it fires at exactly the right stage (AC1) and reads live
 * values straight off the log — never a re-computed outcome (R2). The rendering
 * component ({@link import("./scene/ExplainerCards").ExplainerCards}) is a thin DOM
 * shell over this, so what a card *says* is unit-testable without a GL context.
 */
import { type EngineEvent, type EventKind } from "@/engine/domain/event";
import { type StageId } from "./geometry";
import { regionGlyph } from "./encoding";

/** One explainer card: the stage neuron it anchors beside, and its title + live body. */
export interface ExplainerCard {
  /** The conduit stage this card sits beside — anchors it to that neuron (AC2). */
  readonly stage: StageId;
  /** Terse heading — the Java operation this beat performs. */
  readonly title: string;
  /** One line of commentary, with the beat's live values substituted in (AC1). */
  readonly body: string;
}

/** The first log event of `kind` naming `elementId` — shared payload lookup. */
function elementEvent<K extends EventKind>(
  log: readonly EngineEvent[],
  kind: K,
  elementId: number,
): Extract<EngineEvent, { kind: K }> | undefined {
  return log.find(
    (e): e is Extract<EngineEvent, { kind: K }> => e.kind === kind && e.elementId === elementId,
  );
}

/** A short `"▲ West $1200"`-style tag for an element, pulled from its `emit` payload. */
function elementTag(log: readonly EngineEvent[], elementId: number): string {
  const emit = elementEvent(log, "emit", elementId);
  if (!emit) return `#${elementId}`;
  return `${regionGlyph(emit.input.region)} ${emit.input.region} $${emit.input.total}`;
}

/**
 * The card for a single event — its stage anchor, title, and a body with the event's
 * live values substituted. Returns `null` for the beats with no card worth showing
 * (the frequent per-lane `lane-demand` pull), so the overlay stays uncluttered.
 */
function cardForEvent(log: readonly EngineEvent[], event: EngineEvent): ExplainerCard | null {
  switch (event.kind) {
    case "demand":
      return {
        stage: "terminal",
        title: "spliterator.tryAdvance()",
        body: "The terminal pulls the next element — demand flows backward to the source.",
      };
    case "emit":
      return {
        stage: "source",
        title: "source emits",
        body: `Releases order #${event.elementId} — ${elementTag(log, event.elementId)}.`,
      };
    case "test":
      // The live predicate with the element's total substituted (e.g. "1200 > 100").
      return {
        stage: "filter",
        title: "filter(predicate)",
        body: `${event.predicate.replace(/o\.total/, String(event.input.total))} → ${event.output}`,
      };
    case "survive":
      return {
        stage: "filter",
        title: "sink: survives",
        body: `#${event.elementId} passes the predicate and flows on to map.`,
      };
    case "die":
      return {
        stage: "filter",
        title: "sink: rejected",
        body: `#${event.elementId} fails the predicate — dropped; it never reaches map.`,
      };
    case "transform":
      // applyDiscount's real before→after off the log — int-division 10% off.
      return {
        stage: "map",
        title: "map(applyDiscount)",
        body: `$${event.before} → $${event.after} — 10% off via int division.`,
      };
    case "route":
      return {
        stage: "terminal",
        title: "groupingBy(region)",
        body: `#${event.elementId} classified → the ${regionGlyph(event.key)} ${event.key} bin.`,
      };
    case "accumulate":
      return {
        stage: "terminal",
        title: "downstream accumulate",
        body: `The ${regionGlyph(event.key)} ${event.key} bin now holds ${event.binCount}.`,
      };
    case "fork":
      return {
        stage: "source",
        title: "trySplit() — fork",
        body: `Source splits into ${event.lanes} lanes by recursive halving.`,
      };
    case "combine":
      return {
        stage: "terminal",
        title: "combiner — join",
        body: `Per-lane partial bins merge into ${event.merged.length} regions — identical to the sequential result.`,
      };
    case "found":
      return {
        stage: "terminal",
        title: "short-circuit — FOUND",
        body: `#${event.elementId} (${elementTag(log, event.elementId)}) latches — the encounter-order-first match.`,
      };
    case "cancel":
      return {
        stage: "source",
        title: "cancellation",
        body: `Work cancelled (${event.reason}) — no element past the match is pulled.`,
      };
    case "shortcircuit":
      return {
        stage: "source",
        title: "laziness proven",
        body: `${event.remainingUnpulled} trailing elements were never demanded.`,
      };
    case "lane-demand":
      return null; // per-lane pulls fire constantly; a card each would just flicker.
  }
}

/**
 * The explainer card at `playhead` — the card for the event the playhead rests on,
 * or `null` (empty log / pre-roll / a card-less beat). The integer part selects the
 * current event, exactly as the projection does, so the card is in lock-step with
 * what the conduit shows (AC1).
 */
export function explainerFor(log: readonly EngineEvent[], playhead: number): ExplainerCard | null {
  if (log.length === 0) return null;
  const index = Math.min(Math.max(Math.floor(playhead), 0), log.length - 1);
  return cardForEvent(log, log[index]!);
}
