/**
 * The flow-map metrics are a pure function of a *real engine log* — so these tests
 * drive the actual engine (`runEngine`) rather than hand-built logs, pinning the
 * read-out (and the teaching claims the wall-clock makes) to what the engine really
 * produces. The load-bearing facts: sequential grouping pulls the whole fixture;
 * Slice B `findFirst` short-circuits after the earliest survivor and leaves the rest
 * un-pulled; and a parallel run's modeled wall-clock is below its total CPU work.
 */
import { describe, it, expect } from "vitest";
import { runEngine, type Config } from "@/engine/run";
import { ORDERS } from "@/engine/domain/fixture";
import { flowMetrics, WORK_PER_PULL } from "./metrics";

const SEQ_A: Config = { slice: "A", mode: "sequential", threadCount: 2, seed: 1, terminal: "findFirst" };
const SEQ_B: Config = { ...SEQ_A, slice: "B" };
const PAR_A: Config = { ...SEQ_A, mode: "parallel", threadCount: 2 };

/** Run the engine and read the metrics at the very end of the log. */
function finalMetrics(config: Config) {
  const log = runEngine(config);
  return { log, m: flowMetrics(log, log.length) };
}

describe("flowMetrics — pure over a real engine log", () => {
  it("empty log yields all-zero metrics", () => {
    expect(flowMetrics([], 0).wallClock).toBe(0);
    expect(flowMetrics([], 0).index).toBe(-1);
  });

  it("Slice A sequential pulls the whole fixture and never short-circuits", () => {
    const { m } = finalMetrics(SEQ_A);
    expect(m.pulled).toBe(ORDERS.length);
    expect(m.totalPulled).toBe(ORDERS.length);
    expect(m.neverPulled).toBe(0);
    expect(m.lanes).toBe(0);
    // Sequential: wall-clock == CPU work == every element pulled once.
    expect(m.wallClock).toBe(ORDERS.length * WORK_PER_PULL);
    expect(m.cpuWork).toBe(m.wallClock);
  });

  it("Slice B findFirst short-circuits: pulls only up to the earliest survivor", () => {
    const { m } = finalMetrics(SEQ_B);
    // Fixture: order #1 (80) dies, #2 (1200) is the first survivor → findFirst latches.
    expect(m.found).toBe(true);
    expect(m.pulled).toBe(2);
    expect(m.neverPulled).toBe(ORDERS.length - 2);
    // Less work pulled ⇒ a smaller modeled wall-clock than the full grouping run.
    expect(m.wallClock).toBeLessThan(ORDERS.length * WORK_PER_PULL);
  });

  it("parallel grouping splits the work: wall-clock below total CPU work", () => {
    const { m } = finalMetrics(PAR_A);
    expect(m.lanes).toBe(2);
    expect(m.totalPulled).toBe(ORDERS.length); // grouping still pulls everything…
    expect(m.wallClock).toBeLessThan(m.cpuWork); // …but split across lanes it finishes sooner
  });

  it("wallElapsed ticks from below the final wall-clock up to it", () => {
    const log = runEngine(SEQ_A);
    const mid = flowMetrics(log, log.length / 2);
    const end = flowMetrics(log, log.length);
    expect(mid.wallElapsed).toBeLessThan(end.wallElapsed);
    expect(end.wallElapsed).toBe(end.wallClock);
  });
});
