/**
 * A hand-built sample event log (S0.2 AC3). Not produced by any engine — it is a
 * fixed fixture that exercises the golden harness end-to-end today, before the
 * real event types (S0.4) or ops (S0.5+) exist. Its shape mirrors the R2 event
 * contract and spec §5's `test`-event example so the committed golden already
 * reads like a real one.
 */
export const SAMPLE_LOG: readonly Record<string, unknown>[] = [
  { kind: "demand", tick: 0, op: "collect", nextStage: "source" },
  { kind: "emit", tick: 1, elementId: 1, op: "source", input: { total: 1200, region: "West" } },
  {
    kind: "test",
    tick: 2,
    elementId: 1,
    op: "filter",
    predicate: "o.total > 100",
    input: { total: 1200, region: "West" },
    output: true,
  },
  { kind: "survive", tick: 3, elementId: 1, op: "filter" },
  { kind: "transform", tick: 4, elementId: 1, op: "map", before: 1200, after: 1080 },
  { kind: "route", tick: 5, elementId: 1, op: "collect", key: "West" },
  { kind: "accumulate", tick: 6, elementId: 1, op: "collect", key: "West", binCount: 1 },
  { kind: "demand", tick: 7, op: "collect", nextStage: "source" },
  { kind: "emit", tick: 8, elementId: 2, op: "source", input: { total: 80, region: "East" } },
  {
    kind: "test",
    tick: 9,
    elementId: 2,
    op: "filter",
    predicate: "o.total > 100",
    input: { total: 80, region: "East" },
    output: false,
  },
  { kind: "die", tick: 10, elementId: 2, op: "filter" },
];
