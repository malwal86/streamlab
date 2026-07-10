/**
 * S3.1 — the parallel runner forks the source and interleaves the lanes' beats into
 * one well-formed log: a leading `fork`, per-lane `lane-demand → emit` beats, and the
 * per-lane single-file heartbeat (AC4). Determinism (AC1) and seed-variation (AC6)
 * are asserted on the whole log, not just the schedule.
 */
import { describe, it, expect } from "vitest";
import { ORDERS } from "./domain/fixture";
import { runParallel } from "./parallel";
import { serializeLog } from "./testing/serialize";
import { countKind, isPerLaneSingleFile } from "./testing/logInvariants";
import { type ThreadCount } from "./kernel/split";

const THREAD_COUNTS: readonly ThreadCount[] = [2, 4];

describe("S3.1 parallel run — fork + interleaved lane beats", () => {
  it.each(THREAD_COUNTS)("opens with a single fork carrying %i lanes", (threadCount) => {
    const { log } = runParallel(ORDERS, { threadCount, seed: 1 });
    expect(countKind(log, "fork")).toBe(1);
    const fork = log[0]!;
    expect(fork.kind).toBe("fork");
    if (fork.kind === "fork") expect(fork.lanes).toBe(threadCount);
  });

  it.each(THREAD_COUNTS)("emits every source element exactly once across lanes (%i)", (threadCount) => {
    const { log } = runParallel(ORDERS, { threadCount, seed: 3 });
    const emitted = log.filter((e) => e.kind === "emit").map((e) => e.elementId).sort((a, b) => a! - b!);
    expect(emitted).toEqual(ORDERS.map((o) => o.id));
  });

  it.each(THREAD_COUNTS)("every emit is tagged with a lane (%i)", (threadCount) => {
    const { log } = runParallel(ORDERS, { threadCount, seed: 3 });
    for (const event of log) {
      if (event.kind === "emit" || event.kind === "lane-demand") {
        expect(event.lane).toMatch(/^L\d+$/);
      }
    }
  });
});

describe("S3.1 per-lane single-file heartbeat (AC4)", () => {
  it.each(THREAD_COUNTS)("no lane has two spikes in flight — %i lanes, several seeds", (threadCount) => {
    for (const seed of [1, 2, 7, 42]) {
      const { log } = runParallel(ORDERS, { threadCount, seed });
      expect(isPerLaneSingleFile(log)).toBe(true);
    }
  });
});

describe("S3.1 determinism (AC1) and seed-variation (AC6)", () => {
  it("same (threads, seed) yields byte-identical logs", () => {
    const a = serializeLog(runParallel(ORDERS, { threadCount: 4, seed: 5 }).log);
    const b = serializeLog(runParallel(ORDERS, { threadCount: 4, seed: 5 }).log);
    expect(a).toBe(b);
  });

  it("different seeds change the interleaving (same partition, different order)", () => {
    const a = serializeLog(runParallel(ORDERS, { threadCount: 2, seed: 1 }).log);
    const b = serializeLog(runParallel(ORDERS, { threadCount: 2, seed: 2 }).log);
    expect(a).not.toBe(b);
  });
});
