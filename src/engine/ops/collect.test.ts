/**
 * S1.3 unit tests — the `route`/`accumulate` event shape (AC1) and the fixture's
 * final bin counts. Pins that each survivor routes then accumulates, that
 * `binCount` is the running height the viz grows to, and that the bins hold the
 * mapped (post-discount) orders in encounter order.
 */
import { describe, it, expect } from "vitest";
import { ORDERS } from "../domain/fixture";
import { type Region } from "../domain/order";
import { runSequential } from "../kernel/runner";
import { sliceASequentialPipeline } from "../pipelines";

describe("S1.3 groupingBy — route then accumulate per survivor (AC1)", () => {
  it("each survivor emits route{key} immediately followed by accumulate{key}", () => {
    const { log } = runSequential(sliceASequentialPipeline(ORDERS));
    const routes = log.filter((e) => e.kind === "route");
    // Survivors in encounter order: #2 W, #4 E, #5 N, #6 W, #7 E, #9 N, #11 W.
    expect(routes.map((e) => e.kind === "route" && e.elementId)).toEqual([2, 4, 5, 6, 7, 9, 11]);

    for (const route of routes) {
      if (route.kind !== "route") continue;
      const next = log[route.tick + 1];
      expect(next, `event after route #${route.elementId}`).toBeDefined();
      expect(next?.kind).toBe("accumulate");
      expect(next?.kind === "accumulate" && next.key).toBe(route.key);
    }
  });

  it("binCount is the running height of each region bin", () => {
    const { log } = runSequential(sliceASequentialPipeline(ORDERS));
    const heights = new Map<Region, number>();
    for (const e of log) {
      if (e.kind !== "accumulate") continue;
      const expected = (heights.get(e.key) ?? 0) + 1;
      heights.set(e.key, expected);
      expect(e.binCount, `bin ${e.key} height`).toBe(expected);
    }
    // Final heights: West {2,6,11}=3, East {4,7}=2, North {5,9}=2.
    expect(heights.get("West")).toBe(3);
    expect(heights.get("East")).toBe(2);
    expect(heights.get("North")).toBe(2);
  });
});

describe("S1.3 groupingBy — result bins", () => {
  it("bins hold the mapped survivors in encounter order, keyed by region", () => {
    const { result } = runSequential(sliceASequentialPipeline(ORDERS));
    // Order #2 ($1200 → $1080 after discount) leads the West bin.
    expect(result.get("West")?.map((o) => o.id)).toEqual([2, 6, 11]);
    expect(result.get("West")?.[0]).toMatchObject({ id: 2, total: 1080, region: "West" });
    expect(result.get("East")?.map((o) => o.id)).toEqual([4, 7]);
    expect(result.get("North")?.map((o) => o.id)).toEqual([5, 9]);
  });
});
