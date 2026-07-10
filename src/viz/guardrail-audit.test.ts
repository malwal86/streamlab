/**
 * S5.5 — the **final correctness-guardrail audit** (spec §3.6 / §3.7). Epic 5's
 * closing pass: every guardrail is re-verified *end-to-end across all four
 * slices/modes* — Slice A/B × sequential/parallel — in one place, so the "the wow
 * must not lie" contract has a single, exhaustive spine rather than a guarantee
 * scattered across a dozen story tests. Companion checklist:
 * `planning/s5.5-guardrail-audit.md` maps each row here back to the spec clause.
 *
 * Everything here is a pure function of a real engine log or the projection — no GL,
 * no timing — so the guardrails are provable, not merely animated.
 */
import { describe, it, expect } from "vitest";
import { runEngine, type Config } from "@/engine/run";
import { FIND_FIRST_TARGET_ID } from "@/engine/domain/fixture";
import { REGIONS } from "@/engine/domain/order";
import {
  isSingleFilePull,
  isPerLaneSingleFile,
  pullsAfterFound,
  countKind,
} from "@/engine/testing/logInvariants";
import { projectScene } from "./projection";
import { stageX } from "./geometry";
import { regionGlyph, pulseLabel } from "./encoding";

const base = { threadCount: 2, seed: 1, terminal: "findFirst" } as const;

/** The four quadrants — the whole matrix the audit must cover. */
const A_SEQ: Config = { ...base, slice: "A", mode: "sequential" };
const A_PAR: Config = { ...base, slice: "A", mode: "parallel" };
const B_SEQ: Config = { ...base, slice: "B", mode: "sequential" };
const B_PAR: Config = { ...base, slice: "B", mode: "parallel" };

const QUADRANTS: { readonly name: string; readonly config: Config }[] = [
  { name: "Slice A · sequential", config: A_SEQ },
  { name: "Slice A · parallel", config: A_PAR },
  { name: "Slice B · sequential", config: B_SEQ },
  { name: "Slice B · parallel", config: B_PAR },
];

const logFor = (config: Config) => runEngine(config);

const HEARTBEAT_FORWARD = new Set(["emit", "test", "survive", "transform", "route", "found"]);

describe("§3.6 sequential: never two spikes, demand precedes motion", () => {
  for (const { name, config } of QUADRANTS.filter((q) => q.config.mode === "sequential")) {
    it(`${name} is a well-formed single-file pull`, () => {
      expect(isSingleFilePull(logFor(config))).toBe(true);
    });
  }
});

describe("§3.6 parallel: at most one spike per lane", () => {
  for (const { name, config } of QUADRANTS.filter((q) => q.config.mode === "parallel")) {
    it(`${name} is per-lane single-file across seeds`, () => {
      for (const seed of [1, 2, 3]) {
        for (const threadCount of [2, 4] as const) {
          expect(isPerLaneSingleFile(runEngine({ ...config, seed, threadCount }))).toBe(true);
        }
      }
    });
  }
});

describe("§3.6 rejected pulses die at the filter, not later", () => {
  for (const { name, config } of QUADRANTS) {
    it(`${name}: every die holds the pulse at the filter and sinks (never advances x)`, () => {
      const log = logFor(config);
      const filterX = stageX("filter");
      log.forEach((event, i) => {
        if (event.kind !== "die") return;
        for (const f of [0, 0.25, 0.5, 0.9]) {
          const pulse = projectScene(log, i + f).pulse!;
          expect(pulse.x).toBeCloseTo(filterX); // pinned at the filter across the whole beat
          expect(pulse.y).toBeLessThanOrEqual(0); // sinks into the void, does not fly on
        }
      });
    });
  }
});

describe("§3.6 findFirst honors encounter order + cancels (Slice B)", () => {
  for (const { name, config } of QUADRANTS.filter((q) => q.config.slice === "B")) {
    it(`${name}: never pulls past the match`, () => {
      expect(pullsAfterFound(logFor(config))).toEqual([]);
    });

    it(`${name}: findFirst latches the encounter-order-earliest survivor`, () => {
      const found = logFor(config).find((e) => e.kind === "found");
      expect(found && found.kind === "found" && found.elementId).toBe(FIND_FIRST_TARGET_ID);
    });
  }

  it("Slice B parallel cancels the now-irrelevant lanes on short-circuit", () => {
    expect(countKind(logFor(B_PAR), "cancel")).toBeGreaterThan(0);
  });
});

describe("§3.6 Slice A bins are private per lane until the explicit merge", () => {
  it("parallel: every accumulate precedes the single combine beat", () => {
    const log = logFor(A_PAR);
    const kinds = log.map((e) => e.kind);
    const lastAccumulate = kinds.lastIndexOf("accumulate");
    const firstCombine = kinds.indexOf("combine");
    expect(countKind(log, "combine")).toBe(1); // one explicit merge beat
    expect(firstCombine).toBeGreaterThan(lastAccumulate); // no merge until every lane is done
  });
});

describe("§3.6 outcomes come from the event log, never faked", () => {
  it("Slice A grouping bins equal the engine's accumulate counts at the end", () => {
    const log = logFor(A_SEQ);
    const bins = new Map(
      projectScene(log, log.length - 1).bins.map((b) => [b.region, Math.round(b.count)]),
    );
    // Fixture survivors per region: West {2,6,11}, East {4,7}, North {5,9}.
    expect(bins.get("West")).toBe(3);
    expect(bins.get("East")).toBe(2);
    expect(bins.get("North")).toBe(2);
  });

  it("the FOUND latch reads exactly the found event's element (Slice B)", () => {
    const log = logFor(B_SEQ);
    const found = log.find((e) => e.kind === "found");
    const latch = projectScene(log, log.length - 1).found;
    if (found && found.kind === "found") expect(latch?.elementId).toBe(found.elementId);
  });
});

describe("§3.7 reduced motion: every event still represented, all four quadrants", () => {
  for (const { name, config } of QUADRANTS) {
    it(`${name}: each heartbeat beat still yields its spike/pulse under reduced motion`, () => {
      const log = logFor(config);
      log.forEach((event, i) => {
        const { pulse, demandSpike } = projectScene(log, i, { reducedMotion: true });
        if (event.kind === "demand") expect(demandSpike, `demand @${i}`).not.toBeNull();
        if (HEARTBEAT_FORWARD.has(event.kind)) expect(pulse, `${event.kind} @${i}`).not.toBeNull();
      });
    });
  }
});

describe("§3.7 color independence: region legible without color", () => {
  it("every region has a distinct glyph (injective, grayscale-safe)", () => {
    const glyphs = REGIONS.map(regionGlyph);
    expect(new Set(glyphs).size).toBe(REGIONS.length);
  });

  it("the riding label names the region in text, not color alone", () => {
    for (const region of REGIONS) {
      const label = pulseLabel(500, region);
      expect(label).toContain(region); // region name is in the label
      expect(label).toContain(regionGlyph(region)); // and its color-independent glyph
    }
  });
});
