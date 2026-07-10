/**
 * S1.7 — filter fire/die, asserted from the projection (no GL). The load-bearing
 * guardrail (spec §3.6): a rejected pulse dies **at the filter** and no pulse is
 * ever rendered past the filter for a died element (AC2). Plus the live threshold
 * readout (AC1) and the survive/fade behavior.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { stageX } from "./geometry";
import { projectScene } from "./projection";

const LOG = runEngine(DEFAULT_CONFIG);

/** Playhead samples across the whole log. */
function sweep(step = 0.05): number[] {
  const out: number[] = [];
  for (let p = 0; p <= LOG.length - 1 + 1e-9; p += step) out.push(Number(p.toFixed(4)));
  return out;
}

describe("S1.7 die at the filter — no pulse advances past it (AC2)", () => {
  // Fixture rejects: #1 ($80), #3 ($95), #8 ($99), #10 ($100).
  const rejects = [1, 3, 8, 10];

  it("a rejected element's pulse is never rendered past the filter x", () => {
    const filterX = stageX("filter");
    for (const p of sweep()) {
      const { pulse } = projectScene(LOG, p);
      if (pulse && rejects.includes(pulse.elementId)) {
        expect(pulse.x, `element #${pulse.elementId} advanced past the filter`).toBeLessThanOrEqual(
          filterX + 1e-9,
        );
      }
    }
  });

  it("the dying pulse sinks below the conduit and fades to nothing", () => {
    const dieIdx = LOG.findIndex((e) => e.kind === "die" && e.elementId === 1);
    const start = projectScene(LOG, dieIdx).pulse!;
    const mid = projectScene(LOG, dieIdx + 0.5).pulse!;
    const late = projectScene(LOG, dieIdx + 0.95).pulse!;

    expect(start.y).toBeCloseTo(0);
    expect(mid.y).toBeLessThan(0); // sinking into the void
    expect(late.y).toBeLessThan(mid.y);
    expect(late.opacity).toBeLessThan(start.opacity); // fading out
  });

  it("no reject ever produces a route or accumulate in the log (death is terminal)", () => {
    for (const id of rejects) {
      const downstream = LOG.filter(
        (e) => (e.kind === "route" || e.kind === "accumulate") && e.elementId === id,
      );
      expect(downstream).toEqual([]);
    }
  });
});

describe("S1.7 threshold readout (AC1)", () => {
  it("shows the live comparison and pass for a survivor (#2, $1200)", () => {
    const testIdx = LOG.findIndex((e) => e.kind === "test" && e.elementId === 2);
    const { filterReadout } = projectScene(LOG, testIdx + 0.2);
    expect(filterReadout).toMatchObject({ elementId: 2, text: "1200 > 100", passed: true });
  });

  it("shows the live comparison and fail for a reject (#1, $80)", () => {
    const testIdx = LOG.findIndex((e) => e.kind === "test" && e.elementId === 1);
    const { filterReadout } = projectScene(LOG, testIdx + 0.2);
    expect(filterReadout).toMatchObject({ elementId: 1, text: "80 > 100", passed: false });
  });

  it("is absent when the pulse is not at the filter (e.g. at the source emit)", () => {
    const emitIdx = LOG.findIndex((e) => e.kind === "emit" && e.elementId === 2);
    expect(projectScene(LOG, emitIdx + 0.1).filterReadout).toBeNull();
  });
});

describe("S1.7 survivors continue (AC3)", () => {
  it("a survivor's pulse advances past the filter toward the map", () => {
    // Element #2 survives; at its transform beat it is at the map, well past filter.
    const transformIdx = LOG.findIndex((e) => e.kind === "transform" && e.elementId === 2);
    const { pulse } = projectScene(LOG, transformIdx);
    expect(pulse!.x).toBeGreaterThan(stageX("filter"));
    expect(pulse!.opacity).toBe(1);
  });
});
