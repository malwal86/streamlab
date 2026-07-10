/**
 * S1.8 — the map size-morph is keyed off the `transform` event's before/after and
 * happens at the map. The pulse's total (which drives radius + label) shrinks from
 * `before` to `after` across the transform beat, holds at `after` afterward, and is
 * the original before the map. All derived from the log — no re-computed discount.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, runEngine } from "@/engine/run";
import { pulseRadius } from "./encoding";
import { projectScene } from "./projection";

const LOG = runEngine(DEFAULT_CONFIG);
// Element #2: $1200 → applyDiscount → $1080.
const TRANSFORM = LOG.find((e) => e.kind === "transform" && e.elementId === 2)!;
const transformIdx = LOG.indexOf(TRANSFORM);

describe("S1.8 map size-morph (AC1)", () => {
  it("starts the morph at `before` and ends at `after` (from the transform event)", () => {
    const before = TRANSFORM.kind === "transform" ? TRANSFORM.before : 0;
    const after = TRANSFORM.kind === "transform" ? TRANSFORM.after : 0;
    expect(projectScene(LOG, transformIdx).pulse!.total).toBeCloseTo(before);
    expect(projectScene(LOG, transformIdx + 0.999).pulse!.total).toBeCloseTo(after, 0);
  });

  it("shrinks monotonically across the transform beat (radius decreases)", () => {
    const radii = [0, 0.25, 0.5, 0.75, 0.99].map(
      (f) => pulseRadius(projectScene(LOG, transformIdx + f).pulse!.total),
    );
    for (let i = 1; i < radii.length; i += 1) expect(radii[i]!).toBeLessThan(radii[i - 1]!);
  });

  it("holds at the discounted total after the map (AC2 — label updates to post-discount)", () => {
    const routeIdx = LOG.findIndex((e) => e.kind === "route" && e.elementId === 2);
    expect(projectScene(LOG, routeIdx).pulse!.total).toBe(1080);
  });

  it("carries the original total before the map", () => {
    const emitIdx = LOG.findIndex((e) => e.kind === "emit" && e.elementId === 2);
    expect(projectScene(LOG, emitIdx).pulse!.total).toBe(1200);
  });

  it("is distinct from filter/routing — only the transform beat changes size", () => {
    // Across the survive→transform boundary, size is flat then shrinks.
    const surviveIdx = LOG.findIndex((e) => e.kind === "survive" && e.elementId === 2);
    const flat = pulseRadius(projectScene(LOG, surviveIdx + 0.5).pulse!.total);
    const atFilterEmit = pulseRadius(projectScene(LOG, surviveIdx).pulse!.total);
    expect(flat).toBeCloseTo(atFilterEmit); // no size change at the filter
  });
});
