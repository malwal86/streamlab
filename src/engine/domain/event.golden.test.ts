import { describe, it, expect } from "vitest";
import { assertMatchesGolden } from "../testing/golden";
import { serializeLog } from "../testing/serialize";
import { freezeLog, type EngineEvent } from "./event";

/**
 * S0.4 AC3 — a hand-built log, now *typed as `EngineEvent[]`* (unlike the S0.2
 * `SAMPLE_LOG`, which predated the contract and is `Record<string, unknown>`),
 * type-checks and round-trips through the golden serializer. The sequence traces
 * one surviving order (id 2) and one that dies (id 1) through
 * demand→emit→test→survive/die→map→collect, and embeds spec §5's worked `test`
 * event **verbatim** so the committed golden reads like the spec.
 */

/** Spec §5's example event, reproduced exactly — the anchor for AC3. */
const SPEC_EXAMPLE_TEST_EVENT: EngineEvent = {
  tick: 42,
  lane: "worker-2",
  elementId: 7,
  kind: "test",
  op: "filter",
  predicate: "o.total > 100",
  input: { total: 1200, region: "West" },
  output: true,
  nextStage: "map",
};

const TYPED_SAMPLE_LOG: readonly EngineEvent[] = freezeLog([
  { kind: "demand", tick: 0, op: "collect", nextStage: "source" },
  { kind: "emit", tick: 1, elementId: 2, op: "source", input: { total: 1200, region: "West" } },
  {
    kind: "test",
    tick: 2,
    elementId: 2,
    op: "filter",
    predicate: "o.total > 100",
    input: { total: 1200, region: "West" },
    output: true,
    nextStage: "map",
  },
  { kind: "survive", tick: 3, elementId: 2, op: "filter" },
  { kind: "transform", tick: 4, elementId: 2, op: "map", before: 1200, after: 1080 },
  { kind: "route", tick: 5, elementId: 2, op: "collect", key: "West" },
  { kind: "accumulate", tick: 6, elementId: 2, op: "collect", key: "West", binCount: 1 },
  { kind: "demand", tick: 7, op: "collect", nextStage: "source" },
  { kind: "emit", tick: 8, elementId: 1, op: "source", input: { total: 80, region: "West" } },
  {
    kind: "test",
    tick: 9,
    elementId: 1,
    op: "filter",
    predicate: "o.total > 100",
    input: { total: 80, region: "West" },
    output: false,
  },
  { kind: "die", tick: 10, elementId: 1, op: "filter" },
  SPEC_EXAMPLE_TEST_EVENT,
]);

describe("golden — typed EngineEvent[] sample log (S0.4 AC3)", () => {
  it("type-checks and matches the committed golden snapshot", () => {
    assertMatchesGolden("event-contract-sample", TYPED_SAMPLE_LOG);
  });

  it("serializes byte-identically when key order is shuffled (canonical)", () => {
    // A typed log frozen and re-emitted with keys in reverse order must serialize
    // to the same bytes — the golden is a diff of *content*, not key insertion.
    const shuffled = TYPED_SAMPLE_LOG.map((event) => {
      const reversed: Record<string, unknown> = {};
      for (const key of Object.keys(event).reverse()) {
        reversed[key] = (event as unknown as Record<string, unknown>)[key];
      }
      return reversed;
    });
    expect(serializeLog(shuffled)).toBe(serializeLog(TYPED_SAMPLE_LOG));
  });
});
