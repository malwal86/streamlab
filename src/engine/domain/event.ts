/**
 * The engine→viz event-log contract (S0.4, R2 / spec §5): the *only* channel
 * between the pure stream kernel and the neural-conduit visualization. The whole
 * credibility argument rests on one invariant — **the viz is a pure function of
 * the event log** and may never compute an outcome the log does not already
 * contain (R2). For that to hold the log has to be:
 *
 *   - a **discriminated union** on `kind`, so every consumer branches on a closed
 *     set the compiler knows in full (see {@link summarizeEvent} + {@link assertNever}:
 *     adding a kind or dropping a `case` is a *compile* error, not a runtime bug);
 *   - **immutable at runtime** — one frozen event per engine callback (S0.5+),
 *     so the viz cannot accidentally mutate history and the log is safe to share
 *     across the store, the playhead projection, and golden snapshots
 *     ({@link freezeEvent} / {@link freezeLog}); and
 *   - **wall-clock-free** — `tick` is a *logical* counter, not a timestamp, so
 *     goldens are byte-stable across machines (see `../testing/serialize.ts`).
 *
 * This module owns the *shape of the wire*, not the act of putting events on it:
 * the sequential runner (S0.5) and the parallel scheduler (S3.1) construct these
 * values; the ops (E1/E2) decide *when*. Nothing here emits from a real pipeline.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */
import { type Order, type Region } from "./order";

/**
 * The order payload a `demand`/`emit`/`test` event carries as `input`: the datum
 * the pulse encodes, *minus its id*. The id travels separately as the top-level
 * `elementId` (so every event that names an element uses the same field), which
 * is exactly the shape spec §5's worked example shows —
 * `input: { total: 1200, region: "West" }`. Keeping goldens reading like the spec
 * is a stated requirement (S0.4 technical note), so the snapshot omits `id` on
 * purpose rather than duplicating it alongside `elementId`.
 */
export interface OrderSnapshot {
  readonly total: number;
  readonly region: Region;
}

/** Project an {@link Order} onto the wire snapshot the log carries (drops `id`). */
export function orderSnapshot(order: Order): OrderSnapshot {
  return { total: order.total, region: order.region };
}

/**
 * The partial-result state a `groupingBy` bin is in when `accumulate`/`combine`
 * report it: which region key it holds and how many elements have landed so far.
 * `combine` (parallel) reports the *merged* bins; `accumulate` (per element)
 * reports the one bin that grew. The viz renders `count` as bin height (spec §3).
 */
export interface BinState {
  readonly key: Region;
  readonly count: number;
}

/**
 * A node in the recursive-halving split tree a `fork` event carries (spec §3.4,
 * emitted for real in S3.1). Parallel traversal halves the source until each leaf
 * is a lane's partition; an internal node is a split, a leaf (no `children`) is a
 * lane's work. `estimatedSize` is the `Spliterator`'s size estimate for that
 * partition — what the fork animation grows its branches from. Binary by
 * construction because the split is a *halving*; S3.1 owns the emission and may
 * refine the payload, this fixes only the wire shape the viz can already draw.
 */
export interface SplitNode {
  readonly lane: string;
  readonly estimatedSize: number;
  readonly children?: readonly [SplitNode, SplitNode];
}

/**
 * Fields every event carries (R2). `tick` is a required *logical* counter — the
 * strictly-increasing position in the log, never a wall-clock time. The rest are
 * optional here and *narrowed to required* by the specific events that always
 * have them (e.g. `emit` always names an `elementId`, `lane-demand` always names
 * a `lane`); an event that legitimately lacks one simply omits it.
 *
 *   - `lane`      — worker/lane id in parallel mode (absent in sequential).
 *   - `elementId` — the `Order.id` this event is about.
 *   - `op`        — the pipeline stage that produced it (`"filter"`, `"map"`, …).
 *   - `nextStage` — where the pull/pulse is headed next (drives the heartbeat).
 */
export interface EventCommon {
  readonly tick: number;
  readonly lane?: string;
  readonly elementId?: number;
  readonly op?: string;
  readonly nextStage?: string;
}

/** Terminal (or lane) requests one element via `tryAdvance` — retrograde dim spike. */
export interface DemandEvent extends EventCommon {
  readonly kind: "demand";
}

/** Source encodes & releases the next element — bright pulse leaves the source. */
export interface EmitEvent extends EventCommon {
  readonly kind: "emit";
  readonly elementId: number;
  readonly input: OrderSnapshot;
}

/**
 * A `filter` predicate was evaluated — threshold readout (`1200 > 100`). Matches
 * spec §5's example event exactly: `predicate` is the human-readable source
 * (`"o.total > 100"`), `output` the boolean it produced.
 */
export interface TestEvent extends EventCommon {
  readonly kind: "test";
  readonly elementId: number;
  readonly predicate: string;
  readonly input: OrderSnapshot;
  readonly output: boolean;
}

/** Element passed `filter` — the pulse continues and glows. */
export interface SurviveEvent extends EventCommon {
  readonly kind: "survive";
  readonly elementId: number;
}

/** Element rejected at `filter` — the pulse dissipates into the void. */
export interface DieEvent extends EventCommon {
  readonly kind: "die";
  readonly elementId: number;
}

/** `map` applied — pulse size morph + label update. `before`/`after` are totals. */
export interface TransformEvent extends EventCommon {
  readonly kind: "transform";
  readonly elementId: number;
  readonly before: number;
  readonly after: number;
}

/** `groupingBy` classifier picked a bin — the pulse flies to its region bin. */
export interface RouteEvent extends EventCommon {
  readonly kind: "route";
  readonly elementId: number;
  readonly key: Region;
}

/** Element added to a (partial) bin — the bin grows. `binCount` is the new size. */
export interface AccumulateEvent extends EventCommon {
  readonly kind: "accumulate";
  readonly key: Region;
  readonly binCount: number;
}

/** Source split into lanes — conduit forks along the {@link SplitNode} tree. */
export interface ForkEvent extends EventCommon {
  readonly kind: "fork";
  readonly lanes: number;
  readonly splitTree: SplitNode;
}

/** Per-lane retrograde request — a lane pulls one element (`lane` always present). */
export interface LaneDemandEvent extends EventCommon {
  readonly kind: "lane-demand";
  readonly lane: string;
}

/** Combiner merged partial bins — the partial bins flow together into `merged`. */
export interface CombineEvent extends EventCommon {
  readonly kind: "combine";
  readonly merged: readonly BinState[];
}

/** `findFirst`/`findAny` latched a result — the terminal "FOUND" latch fires. */
export interface FoundEvent extends EventCommon {
  readonly kind: "found";
  readonly elementId: number;
}

/** Lane/work cancelled on short-circuit — a dark cancellation wavefront. */
export interface CancelEvent extends EventCommon {
  readonly kind: "cancel";
  readonly reason: string;
}

/** Traversal ended early — remaining source pulses go dark, `remainingUnpulled` counts them. */
export interface ShortCircuitEvent extends EventCommon {
  readonly kind: "shortcircuit";
  readonly remainingUnpulled: number;
}

/**
 * The engine→viz event log's element type: the closed discriminated union of all
 * 14 kinds (R2). A consumer that `switch`es on `.kind` and ends with
 * {@link assertNever} is compile-checked to handle every one — the mechanism
 * behind the "removing a case is a compile error" guarantee (S0.4 AC4).
 */
export type EngineEvent =
  | DemandEvent
  | EmitEvent
  | TestEvent
  | SurviveEvent
  | DieEvent
  | TransformEvent
  | RouteEvent
  | AccumulateEvent
  | ForkEvent
  | LaneDemandEvent
  | CombineEvent
  | FoundEvent
  | CancelEvent
  | ShortCircuitEvent;

/** The set of `kind` discriminants — `"demand" | "emit" | …`. */
export type EventKind = EngineEvent["kind"];

/**
 * Exhaustiveness guard. In the `default` of a `switch` over a discriminated
 * union, the value narrows to `never` *only if* every case is handled; calling
 * this there makes the compiler enforce that — add a `kind` (or delete a `case`)
 * and the argument is no longer `never`, so the code fails to type-check. The
 * runtime `throw` is a belt-and-braces backstop for a value that slipped past the
 * types (e.g. a hand-built log), and names the offender for debugging.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled EngineEvent kind: ${JSON.stringify(x)}`);
}

/**
 * Recursively `Object.freeze` a value in place. Events nest — `input`, `merged`,
 * and the `splitTree` are objects/arrays — so a shallow freeze would leave the
 * payloads mutable and the "immutable at runtime" contract (AC5) would be a lie
 * one level down. Skips already-frozen subtrees so re-freezing a shared log is
 * cheap and cycle-safe. Returns the same (now frozen) reference.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/**
 * Freeze one event (and its nested payload) at emission — the runtime half of the
 * immutability contract the `readonly` types promise at compile time (AC5). The
 * runner (S0.5) calls this as it appends each event so the viz can never mutate
 * history.
 */
export function freezeEvent<E extends EngineEvent>(event: E): E {
  return deepFreeze(event);
}

/**
 * Freeze a whole log: every event deep-frozen and the array itself frozen, so
 * neither an element's fields nor the log's length/order can change after the
 * run. Returns a frozen `readonly EngineEvent[]` — the shape the store holds and
 * goldens serialize.
 */
export function freezeLog(events: readonly EngineEvent[]): readonly EngineEvent[] {
  return Object.freeze(events.map(freezeEvent));
}

/**
 * A one-line human-readable summary of an event, for the DOM event-log / step
 * list (spec §7). Its real job here is doubling as the module's **exhaustiveness
 * spine**: it must have a `case` for every kind and bottoms out in
 * {@link assertNever}, so the type system rejects any future edit that leaves a
 * kind unhandled (AC4). Keep the summaries terse — this is a step-list label, not
 * prose.
 */
export function summarizeEvent(event: EngineEvent): string {
  switch (event.kind) {
    case "demand":
      return `demand → ${event.nextStage ?? "source"}`;
    case "emit":
      return `emit #${event.elementId} (${event.input.region} $${event.input.total})`;
    case "test":
      return `test ${event.predicate} → ${event.output}`;
    case "survive":
      return `survive #${event.elementId}`;
    case "die":
      return `die #${event.elementId}`;
    case "transform":
      return `transform #${event.elementId} ${event.before} → ${event.after}`;
    case "route":
      return `route #${event.elementId} → ${event.key}`;
    case "accumulate":
      return `accumulate ${event.key} (count ${event.binCount})`;
    case "fork":
      return `fork → ${event.lanes} lanes`;
    case "lane-demand":
      return `lane-demand ${event.lane}`;
    case "combine":
      return `combine ${event.merged.length} bins`;
    case "found":
      return `found #${event.elementId}`;
    case "cancel":
      return `cancel${event.lane ? ` ${event.lane}` : ""} (${event.reason})`;
    case "shortcircuit":
      return `shortcircuit (${event.remainingUnpulled} unpulled)`;
    default:
      return assertNever(event);
  }
}
