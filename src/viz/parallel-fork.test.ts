/**
 * S3.4 — the fork choreography is a pure function of the log: the lane geometry comes
 * from the `fork` split tree (AC1), each lane shows its own retrograde demand spike
 * (AC2), no lane ever has two spikes in flight at any playhead (AC3, the automated
 * "one spike per lane" guardrail), and reduced motion snaps the spike (AC4).
 */
import { describe, it, expect } from "vitest";
import { ORDERS } from "@/engine/domain/fixture";
import { runParallel } from "@/engine/parallel";
import { stageX } from "./geometry";
import {
  activeLaneSpike,
  forkLayout,
  laneSpikeLoad,
  parallelCaptionFor,
  LANE_Y_SPACING,
} from "./parallel";

const LOG_2 = runParallel(ORDERS, { threadCount: 2, seed: 1 }).log;
const LOG_4 = runParallel(ORDERS, { threadCount: 4, seed: 1 }).log;

describe("S3.4 fork geometry from the split tree (AC1)", () => {
  it("lays out 2 lanes, centered and spread along y", () => {
    const layout = forkLayout(LOG_2);
    expect(layout.map((l) => l.lane)).toEqual(["L0", "L1"]);
    expect(layout.map((l) => l.y)).toEqual([-LANE_Y_SPACING / 2, LANE_Y_SPACING / 2]);
    expect(layout.reduce((s, l) => s + l.estimatedSize, 0)).toBe(ORDERS.length);
  });

  it("lays out 4 lanes from the deeper split tree", () => {
    const layout = forkLayout(LOG_4);
    expect(layout.map((l) => l.lane)).toEqual(["L0", "L1", "L2", "L3"]);
    // symmetric about 0
    expect(layout.map((l) => l.y)).toEqual(layout.map((l) => l.y).slice().reverse().map((y) => -y));
  });

  it("returns [] for a log with no fork (a sequential log)", () => {
    expect(forkLayout([])).toEqual([]);
  });
});

describe("S3.4 each lane shows its own retrograde demand spike (AC2)", () => {
  it("a lane-demand projects a demand spike in that lane, terminal→source", () => {
    const idx = LOG_2.findIndex((e) => e.kind === "lane-demand");
    const lane = LOG_2[idx]!.lane!;
    const start = activeLaneSpike(LOG_2, idx)!;
    const end = activeLaneSpike(LOG_2, idx + 0.99)!;

    expect(start.kind).toBe("demand");
    expect(start.lane).toBe(lane);
    expect(start.x).toBeCloseTo(stageX("terminal")); // starts at the terminal
    // retrogrades toward the source: moves left, and ends nearer source than terminal
    expect(end.x).toBeLessThan(start.x);
    expect(Math.abs(end.x - stageX("source"))).toBeLessThan(Math.abs(end.x - stageX("terminal")));
    // rides its own lane's conduit (a non-zero y for a 2-lane split)
    expect(start.y).toBe(forkLayout(LOG_2).find((l) => l.lane === lane)!.y);
  });
});

describe("S3.4 one spike per lane max — the automated guardrail (AC3)", () => {
  it.each([
    ["2-lane", LOG_2],
    ["4-lane", LOG_4],
  ])("no lane exceeds one in-flight spike at any playhead (%s)", (_name, log) => {
    for (let p = 0; p <= log.length - 1; p += 0.25) {
      const load = laneSpikeLoad(log, p);
      for (const count of load.values()) expect(count).toBeLessThanOrEqual(1);
    }
  });

  it("framing beats (fork / combine) surface no lane spike", () => {
    expect(activeLaneSpike(LOG_2, 0)).toBeNull(); // fork is first
    const combineIdx = LOG_2.findIndex((e) => e.kind === "combine");
    expect(activeLaneSpike(LOG_2, combineIdx)).toBeNull();
  });
});

describe("S3.4 fork caption narrates the split", () => {
  it("the fork beat announces the lane count", () => {
    expect(parallelCaptionFor(LOG_2, 0)).toBe("parallelStream forks into 2 lanes");
    expect(parallelCaptionFor(LOG_4, 0)).toBe("parallelStream forks into 4 lanes");
  });
});

describe("S3.4 reduced motion snaps the fork (AC4)", () => {
  it("a demand spike renders its settled start with no tween", () => {
    const idx = LOG_2.findIndex((e) => e.kind === "lane-demand");
    const snapped = activeLaneSpike(LOG_2, idx + 0.5, { reducedMotion: true })!;
    expect(snapped.progress).toBe(0);
    expect(snapped.x).toBeCloseTo(stageX("terminal")); // no retrograde travel
  });
});
