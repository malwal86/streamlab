/**
 * `EventRecorder` (S0.5) — the one place the kernel *puts events on the wire*. The
 * runner and every op sink hand it tickless events; it stamps the monotonic
 * logical `tick` (never a wall-clock time — see `domain/event.ts`), appends, and at
 * the end freezes the whole log (`freezeLog`) into the immutable `EngineEvent[]`
 * the store holds and goldens serialize (R2, AC).
 *
 * Centralizing tick assignment here is what guarantees the log is *totally
 * ordered*: `tick` is the append index, so no two callers can mint the same tick
 * and the single-file invariant (AC2) is checkable as a pure function of the log.
 * The runner emits `demand`/`emit`; op sinks (E1+) emit the rest through
 * {@link EventRecorder.record}.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */
import { freezeLog, orderSnapshot, type EngineEvent, type DemandEvent } from "../domain/event";
import { type Order } from "../domain/order";

/** Distribute `Omit` over each member of a union rather than the union as a whole. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/**
 * An {@link EngineEvent} minus its `tick` — the shape callers hand the recorder,
 * which assigns the tick. Uses {@link DistributiveOmit} so each member keeps its own
 * kind-specific fields; a plain `Omit<EngineEvent, "tick">` would collapse to only
 * the fields *common* to all 14 kinds and lose `input`, `predicate`, `merged`, …
 * Callers still get full per-kind checking.
 */
export type TicklessEvent = DistributiveOmit<EngineEvent, "tick">;

/** Optional retrograde/lane context a `demand` carries — see {@link DemandEvent}. */
type DemandFields = Omit<DemandEvent, "kind" | "tick">;

/**
 * Accumulates the ordered event log for one engine run. Not reusable across runs —
 * construct one per `runSequential` call so ticks start at 0 and the log is a clean
 * slate (test-isolation, per tdd-guidelines §4.5).
 */
export class EventRecorder {
  private readonly events: EngineEvent[] = [];
  private nextTick = 0;

  /**
   * Append `event`, stamping the next logical tick. The single entry point every
   * convenience method funnels through, so tick assignment lives in exactly one
   * place. Returns the assigned tick (handy for a caller correlating events).
   */
  record(event: TicklessEvent): number {
    const tick = this.nextTick;
    this.nextTick += 1;
    // `tick` is the missing field; the spread reunites it with a fully-typed event.
    this.events.push({ ...event, tick } as EngineEvent);
    return tick;
  }

  /**
   * Record the terminal's (or a lane's) `demand` — the retrograde pull spike that
   * opens each heartbeat (spec §3.2). `op`/`nextStage`/`lane` describe where the
   * pull originates and heads; the array-source runner passes
   * `{ op: <terminal>, nextStage: "source" }`.
   */
  demand(fields: DemandFields = {}): number {
    return this.record({ kind: "demand", ...fields });
  }

  /**
   * Record the source `emit` — one `Order` encoded and released as the bright
   * forward pulse (spec §3.2). `elementId` is the order's id and `input` its wire
   * snapshot (id dropped, per `orderSnapshot`); `op` is fixed `"source"` because
   * emission is always the source releasing an element.
   */
  emit(order: Order): number {
    return this.record({
      kind: "emit",
      elementId: order.id,
      op: "source",
      input: orderSnapshot(order),
    });
  }

  /** The number of events recorded so far (also the next tick to be assigned). */
  get size(): number {
    return this.nextTick;
  }

  /**
   * Finalize: deep-freeze every event and the array (`freezeLog`) and return the
   * immutable log. Call once at end of run; the recorder should not be used after.
   */
  freeze(): readonly EngineEvent[] {
    return freezeLog(this.events);
  }
}
