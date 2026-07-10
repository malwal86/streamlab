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
import { type EngineEvent } from "@/engine/domain/event";

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
