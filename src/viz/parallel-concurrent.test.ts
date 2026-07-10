/**
 * The concurrent parallel projection: `parallelLaneSpikes` must animate every lane at
 * once (real ForkJoin threads run simultaneously), not one lane at a time like the
 * log's linear order. These drive the real engine and assert that mid-run all lanes
 * carry a spike, each on its own lane, and that a sequential log yields none.
 */
import { describe, it, expect } from "vitest";
import { runEngine, type Config } from "@/engine/run";
import { parallelLaneSpikes, forkLayout } from "./parallel";

const PAR2: Config = { slice: "A", mode: "parallel", threadCount: 2, seed: 1, terminal: "findFirst" };
const PAR4: Config = { ...PAR2, threadCount: 4 };
const SEQ: Config = { ...PAR2, mode: "sequential" };

describe("parallelLaneSpikes — lanes animate concurrently", () => {
  it("a sequential log has no lane spikes", () => {
    const log = runEngine(SEQ);
    expect(parallelLaneSpikes(log, log.length / 2)).toEqual([]);
  });

  it("mid-run, every lane carries its own in-flight spike (2 lanes)", () => {
    const log = runEngine(PAR2);
    const spikes = parallelLaneSpikes(log, (log.length - 1) * 0.5);
    expect(spikes.length).toBe(2);
    const lanes = new Set(spikes.map((s) => s.lane));
    expect(lanes.size).toBe(2); // distinct lanes, one spike each
    for (const lane of lanes) expect(forkLayout(log).some((l) => l.lane === lane)).toBe(true);
  });

  it("scales to 4 concurrent lanes", () => {
    const log = runEngine(PAR4);
    const spikes = parallelLaneSpikes(log, (log.length - 1) * 0.5);
    expect(spikes.length).toBe(4);
    expect(new Set(spikes.map((s) => s.lane)).size).toBe(4);
  });

  it("never returns two spikes for the same lane, sampled across the run", () => {
    const log = runEngine(PAR4);
    for (let i = 0; i <= 20; i += 1) {
      const spikes = parallelLaneSpikes(log, ((log.length - 1) * i) / 20);
      const lanes = spikes.map((s) => s.lane);
      expect(new Set(lanes).size).toBe(lanes.length); // no lane appears twice
    }
  });
});
