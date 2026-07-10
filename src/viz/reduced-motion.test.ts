/**
 * S1.11 — with reduced motion the projection **snaps** stage-to-stage instead of
 * animating flight, yet every event is still represented (spec §3.7). Positions,
 * size, and opacity take their settled values (no tween); a bin counts its current
 * accumulate in full. Asserted against the normal (animated) projection to show the
 * motion is removed, not the meaning.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { stageX } from "./geometry";
import { projectScene } from "./projection";

const LOG = runEngine(DEFAULT_CONFIG);
const RM = { reducedMotion: true } as const;

describe("S1.11 reduced motion snaps flight (AC1)", () => {
  it("the pulse holds at its stage station mid-beat instead of tweening", () => {
    const emitIdx = LOG.findIndex((e) => e.kind === "emit" && e.elementId === 2);
    // Animated: mid-beat the pulse has left the source toward the filter.
    expect(projectScene(LOG, emitIdx + 0.5).pulse!.x).toBeGreaterThan(stageX("source"));
    // Reduced motion: it stays snapped at the source until the next event.
    expect(projectScene(LOG, emitIdx + 0.5, RM).pulse!.x).toBeCloseTo(stageX("source"));
  });

  it("a rejected pulse does not sink or fade mid-beat — it holds at the filter", () => {
    const dieIdx = LOG.findIndex((e) => e.kind === "die" && e.elementId === 1);
    const rm = projectScene(LOG, dieIdx + 0.5, RM).pulse!;
    expect(rm.y).toBeCloseTo(0); // no sinking
    expect(rm.opacity).toBe(1); // no fading
    expect(rm.x).toBeCloseTo(stageX("filter"));
  });

  it("the route pulse does not fly off-axis mid-beat", () => {
    const routeIdx = LOG.findIndex((e) => e.kind === "route" && e.elementId === 2);
    expect(projectScene(LOG, routeIdx + 0.5, RM).pulse!.z).toBeCloseTo(0);
  });
});

describe("S1.11 reduced motion settles bins (AC1)", () => {
  it("counts the current accumulate in full instead of growing it", () => {
    const accEntry = LOG.map((e, i) => ({ e, i })).find(
      ({ e }) => e.kind === "accumulate" && e.key === "West",
    )!;
    const region = "West";
    const animated = projectScene(LOG, accEntry.i + 0.5).bins.find((b) => b.region === region)!;
    const reduced = projectScene(LOG, accEntry.i + 0.5, RM).bins.find((b) => b.region === region)!;
    const binCount = accEntry.e.kind === "accumulate" ? accEntry.e.binCount : 0;
    expect(reduced.count).toBe(binCount); // fully settled
    expect(animated.count).toBeLessThan(reduced.count); // animated is mid-growth
  });
});

describe("S1.11 every event still represented (AC1, AC2)", () => {
  it("each forward beat still yields a pulse under reduced motion", () => {
    for (let i = 0; i < LOG.length; i += 1) {
      const event = LOG[i]!;
      const { pulse, demandSpike } = projectScene(LOG, i, RM);
      if (event.kind === "demand") expect(demandSpike).not.toBeNull();
      if (["emit", "test", "survive", "transform", "route"].includes(event.kind)) {
        expect(pulse, `event ${i} (${event.kind}) lost its pulse`).not.toBeNull();
      }
    }
  });

  it("final bins still equal the grouping under reduced motion (nothing lost)", () => {
    const bins = new Map(
      projectScene(LOG, LOG.length - 1, RM).bins.map((b) => [b.region, Math.round(b.count)]),
    );
    expect(bins.get("West")).toBe(3);
    expect(bins.get("East")).toBe(2);
    expect(bins.get("North")).toBe(2);
  });
});
