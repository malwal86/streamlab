/**
 * S1.9 — region bins fill from the log and their final heights equal the engine's
 * grouping, hence the oracle (AC2). Asserted from the projection: the pulse routes
 * to its bin's z on `route`, each bin grows across its `accumulate` beat, and the
 * end-of-run fills match `oracleGroupingBy(oracleMap(oracleFilter))`.
 */
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { runSequential } from "@/engine/kernel/runner";
import { sliceASequentialPipeline } from "@/engine/pipelines";
import { arbOrderList, DEFAULT_SEED } from "@/engine/testing/arbitraries";
import { oracleFilter, oracleGroupingBy, oracleMap } from "@/engine/testing/oracle";
import { type Region } from "@/engine/domain/order";
import { binPosition } from "./geometry";
import { projectScene } from "./projection";

const LOG = runEngine(DEFAULT_CONFIG);

/** The bins at the very end of the run (playhead at the last event). */
function finalBins(log: ReturnType<typeof runEngine>): Map<Region, number> {
  const { bins } = projectScene(log, log.length - 1);
  return new Map(bins.map((b) => [b.region, Math.round(b.count)]));
}

describe("S1.9 route flight to the region bin (AC1)", () => {
  it("the pulse swings toward its region's bin z on route", () => {
    // Element #2 is West; its bin sits off the main axis in z.
    const routeIdx = LOG.findIndex((e) => e.kind === "route" && e.elementId === 2);
    const [binX, , binZ] = binPosition("West");
    const atStart = projectScene(LOG, routeIdx).pulse!;
    const atEnd = projectScene(LOG, routeIdx + 0.99).pulse!;

    expect(atStart.z).toBeCloseTo(0); // leaves the main axis
    expect(Math.abs(atEnd.z)).toBeGreaterThan(Math.abs(atStart.z)); // arrives off-axis
    expect(atEnd.z).toBeCloseTo(binZ, 1);
    expect(atEnd.x).toBeCloseTo(binX, 1);
  });
});

describe("S1.9 bins grow on accumulate", () => {
  it("a bin's count rises across its accumulate beat and holds after", () => {
    const westAcc = LOG.map((e, i) => ({ e, i })).filter(
      ({ e }) => e.kind === "accumulate" && e.key === "West",
    );
    const firstWest = westAcc[0]!.i;
    const before = projectScene(LOG, firstWest - 0.001).bins.find((b) => b.region === "West")!.count;
    const mid = projectScene(LOG, firstWest + 0.5).bins.find((b) => b.region === "West")!.count;
    const after = projectScene(LOG, firstWest + 1).bins.find((b) => b.region === "West")!.count;
    expect(mid).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(mid);
  });
});

describe("S1.9 final bins == oracle (AC2)", () => {
  it("the fixture's final bin heights match the grouping / oracle", () => {
    const bins = finalBins(LOG);
    expect(bins.get("West")).toBe(3);
    expect(bins.get("East")).toBe(2);
    expect(bins.get("North")).toBe(2);
  });

  it("holds for every generated Slice A log (property)", () => {
    fc.assert(
      fc.property(arbOrderList(), (orders) => {
        const { log } = runSequential(sliceASequentialPipeline(orders));
        const bins = finalBins(log);
        const oracle = oracleGroupingBy(oracleMap(oracleFilter(orders)));
        for (const [region, members] of oracle) {
          expect(bins.get(region) ?? 0).toBe(members.length);
        }
      }),
      { seed: DEFAULT_SEED },
    );
  });
});
