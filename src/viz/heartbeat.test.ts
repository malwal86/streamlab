/**
 * S1.5 — the demand heartbeat is a pure function of `(log, playhead)`, and it
 * upholds the load-bearing sequential guardrail: **never two signals in flight**
 * (spec §3.6). These tests assert the guardrail from the projection alone — no GL,
 * no animation — over the canonical Slice A log *and* as a property over generated
 * logs, so the "one spike at a time" claim the money shot rests on is machine-checked.
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { runSequential } from "@/engine/kernel/runner";
import { sliceASequentialPipeline } from "@/engine/pipelines";
import { type EngineEvent } from "@/engine/domain/event";
import { arbOrderList, DEFAULT_SEED } from "@/engine/testing/arbitraries";
import { stageX } from "./geometry";
import { projectScene } from "./projection";

const LOG = runEngine(DEFAULT_CONFIG);

/** Dense playhead samples across a log's whole domain. */
function sweep(log: readonly EngineEvent[], step = 0.1): number[] {
  const out: number[] = [];
  for (let p = 0; p <= log.length - 1 + 1e-9; p += step) out.push(Number(p.toFixed(4)));
  return out;
}

describe("S1.5 heartbeat — never two signals in flight (AC3)", () => {
  it("at every playhead, at most one of {demandSpike, pulse} is active (fixture log)", () => {
    for (const p of sweep(LOG)) {
      const { demandSpike, pulse } = projectScene(LOG, p);
      const inFlight = (demandSpike ? 1 : 0) + (pulse ? 1 : 0);
      expect(inFlight, `two signals in flight at playhead ${p}`).toBeLessThanOrEqual(1);
    }
  });

  it("holds for every generated Slice A log (property)", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const { log } = runSequential(sliceASequentialPipeline(orders));
        for (const p of sweep(log, 0.25)) {
          const { demandSpike, pulse } = projectScene(log, p);
          expect((demandSpike ? 1 : 0) + (pulse ? 1 : 0)).toBeLessThanOrEqual(1);
        }
      }),
      { seed: DEFAULT_SEED },
    );
  });
});

describe("S1.5 heartbeat — demand precedes emit, source inert before it (AC1, AC4)", () => {
  const firstEmitIndex = LOG.findIndex((e) => e.kind === "emit");
  const firstEmit = LOG[firstEmitIndex];

  it("the pulse is null everywhere before the first emit — source stays inert (AC4)", () => {
    for (let p = 0; p < firstEmitIndex; p += 0.1) {
      expect(projectScene(LOG, p).pulse, `pulse should be null at ${p}`).toBeNull();
    }
  });

  it("a demand spike is in flight during the beat that precedes the first emit (AC1)", () => {
    const { demandSpike, pulse } = projectScene(LOG, firstEmitIndex - 0.5);
    expect(demandSpike).not.toBeNull();
    expect(pulse).toBeNull();
  });

  it("the forward pulse for that element appears only once its emit is reached (AC1)", () => {
    const { pulse } = projectScene(LOG, firstEmitIndex + 0.01);
    expect(pulse?.elementId).toBe(firstEmit!.kind === "emit" ? firstEmit!.elementId : undefined);
  });
});

describe("S1.5 heartbeat — emit leaves the source, forward (AC2)", () => {
  it("the pulse starts at the source and moves toward the filter across the emit beat", () => {
    const emitIdx = LOG.findIndex((e) => e.kind === "emit");
    const atEmit = projectScene(LOG, emitIdx);
    expect(atEmit.pulse?.x).toBeCloseTo(stageX("source"));

    // As the fraction advances toward the next station (the filter `test`), x rises.
    const xs = [0, 0.25, 0.5, 0.75, 0.99].map((f) => projectScene(LOG, emitIdx + f).pulse!.x);
    for (let i = 1; i < xs.length; i += 1) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    expect(xs[xs.length - 1]!).toBeLessThanOrEqual(stageX("filter"));
  });

  it("the retrograde demand spike travels terminal → source (opposite direction)", () => {
    const demandIdx = LOG.findIndex((e) => e.kind === "demand");
    const start = projectScene(LOG, demandIdx).demandSpike!;
    const later = projectScene(LOG, demandIdx + 0.8).demandSpike!;
    expect(start.x).toBeCloseTo(stageX("terminal"));
    expect(later.x).toBeLessThan(start.x); // moving toward the source (decreasing x)
    expect(later.progress).toBeGreaterThan(start.progress);
  });
});

describe("S1.5 heartbeat — pure and reversible (AC5)", () => {
  it("the same (log, playhead) yields structurally identical state", () => {
    for (const p of sweep(LOG, 0.37)) {
      expect(projectScene(LOG, p)).toEqual(projectScene(LOG, p));
    }
  });

  it("scrubbing backward retraces the same states as scrubbing forward", () => {
    const ps = sweep(LOG, 0.5);
    const forward = ps.map((p) => projectScene(LOG, p));
    const backward = [...ps].reverse().map((p) => projectScene(LOG, p));
    expect(backward).toEqual([...forward].reverse());
  });
});
