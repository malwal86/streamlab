import { describe, it, expect } from "vitest";
import {
  assertNever,
  freezeEvent,
  freezeLog,
  orderSnapshot,
  summarizeEvent,
  type EngineEvent,
  type EventKind,
} from "./event";
import { ORDERS } from "./fixture";

/**
 * S0.4 — the engine→viz event-log contract. These tests pin the five acceptance
 * criteria: all 14 kinds exist (AC1), the common + kind-specific fields are
 * present (AC2), a spec §5-shaped sample log round-trips through the golden
 * serializer (AC3, in `event.golden.test.ts`), removing a `case` is a compile
 * error (AC4, enforced by `summarizeEvent`/`assertNever` under `tsc`), and events
 * are frozen at runtime (AC5).
 */

/**
 * One representative event of every kind, keyed by discriminant. Typing this as
 * `Record<EventKind, …>` is itself an **exhaustiveness assertion**: add a member
 * to the `EngineEvent` union and this object fails to compile until the new key
 * is supplied; remove one and the stray key is flagged. So the catalog can never
 * silently drift out of sync with the union (AC1).
 */
const SAMPLE_EVENTS: Record<EventKind, EngineEvent> = {
  demand: { kind: "demand", tick: 0, op: "filter", nextStage: "source" },
  emit: {
    kind: "emit",
    tick: 1,
    elementId: 2,
    op: "source",
    input: { total: 1200, region: "West" },
  },
  test: {
    kind: "test",
    tick: 2,
    elementId: 2,
    op: "filter",
    predicate: "o.total > 100",
    input: { total: 1200, region: "West" },
    output: true,
    nextStage: "map",
  },
  survive: { kind: "survive", tick: 3, elementId: 2, op: "filter" },
  die: { kind: "die", tick: 4, elementId: 1, op: "filter" },
  transform: { kind: "transform", tick: 5, elementId: 2, op: "map", before: 1200, after: 1080 },
  route: { kind: "route", tick: 6, elementId: 2, op: "collect", key: "West" },
  accumulate: {
    kind: "accumulate",
    tick: 7,
    elementId: 2,
    op: "collect",
    key: "West",
    binCount: 1,
  },
  fork: {
    kind: "fork",
    tick: 8,
    op: "collect",
    lanes: 2,
    splitTree: {
      lane: "root",
      estimatedSize: 11,
      children: [
        { lane: "worker-1", estimatedSize: 6 },
        { lane: "worker-2", estimatedSize: 5 },
      ],
    },
  },
  "lane-demand": { kind: "lane-demand", tick: 9, lane: "worker-2", op: "filter" },
  combine: {
    kind: "combine",
    tick: 10,
    op: "collect",
    merged: [
      { key: "West", count: 3 },
      { key: "East", count: 2 },
    ],
  },
  found: { kind: "found", tick: 11, elementId: 2, op: "findFirst" },
  cancel: { kind: "cancel", tick: 12, lane: "worker-1", op: "findFirst", reason: "short-circuit" },
  shortcircuit: { kind: "shortcircuit", tick: 13, op: "findFirst", remainingUnpulled: 4 },
};

const ALL_KINDS = Object.keys(SAMPLE_EVENTS) as EventKind[];

describe("EngineEvent union — the 14 kinds (AC1)", () => {
  it("has exactly 14 kinds", () => {
    // The R2 contract names 14 event kinds. If a kind is added to or removed from
    // the union, `SAMPLE_EVENTS` fails to compile above — this count is the
    // runtime companion that pins the number the spec table promises.
    expect(ALL_KINDS).toHaveLength(14);
  });

  it("tags each sample event with its own discriminant", () => {
    for (const kind of ALL_KINDS) {
      expect(SAMPLE_EVENTS[kind].kind).toBe(kind);
    }
  });
});

describe("common + kind-specific fields (AC2)", () => {
  it("every event carries a logical tick", () => {
    for (const kind of ALL_KINDS) {
      expect(typeof SAMPLE_EVENTS[kind].tick).toBe("number");
    }
  });

  it("carries lane / elementId / op / nextStage where applicable", () => {
    expect(SAMPLE_EVENTS["lane-demand"].lane).toBe("worker-2"); // lane on a per-lane request
    expect(SAMPLE_EVENTS.emit.elementId).toBe(2); // elementId on an element event
    expect(SAMPLE_EVENTS.test.op).toBe("filter"); // op names the stage
    expect(SAMPLE_EVENTS.test.nextStage).toBe("map"); // nextStage drives the heartbeat
  });
});

describe("summarizeEvent — the exhaustiveness spine (AC4)", () => {
  // The exact step-list label each kind must render (spec §7). Asserting the
  // *content* (not merely "non-empty") is what makes each `case` load-bearing:
  // a wrong or dropped field shows up here rather than passing silently. The
  // compile-time half of AC4 is `assertNever(event)` in the switch default —
  // drop a `case` and `tsc` rejects it (`npm run typecheck` enforces this).
  const EXPECTED: Record<EventKind, string> = {
    demand: "demand → source",
    emit: "emit #2 (West $1200)",
    test: "test o.total > 100 → true",
    survive: "survive #2",
    die: "die #1",
    transform: "transform #2 1200 → 1080",
    route: "route #2 → West",
    accumulate: "accumulate West (count 1)",
    fork: "fork → 2 lanes",
    "lane-demand": "lane-demand worker-2",
    combine: "combine 2 bins",
    found: "found #2",
    cancel: "cancel worker-1 (short-circuit)",
    shortcircuit: "shortcircuit (4 unpulled)",
  };

  it("renders the exact summary for every kind", () => {
    for (const kind of ALL_KINDS) {
      expect(summarizeEvent(SAMPLE_EVENTS[kind])).toBe(EXPECTED[kind]);
    }
  });

  it("falls back to 'source' for a demand with no explicit nextStage", () => {
    // Exercises the `?? "source"` default — a demand event omits nextStage in
    // sequential mode, and the label must still name where the pull is headed.
    expect(summarizeEvent({ kind: "demand", tick: 0 })).toBe("demand → source");
  });

  it("omits the lane segment for a laneless cancel (sequential short-circuit)", () => {
    // The `event.lane ? … : ""` branch: sequential cancels carry no lane, so the
    // summary drops the segment cleanly rather than printing 'undefined'.
    expect(summarizeEvent({ kind: "cancel", tick: 5, reason: "found target" })).toBe(
      "cancel (found target)",
    );
  });
});

describe("assertNever — runtime backstop", () => {
  it("throws naming the offending value when types are subverted", () => {
    // Only reachable if a bad value slips past the compiler (e.g. a hand-built
    // log); it must fail loudly, not silently pass through.
    const bogus = { kind: "not-a-kind" } as unknown as never;
    expect(() => assertNever(bogus)).toThrow("Unhandled EngineEvent kind");
  });
});

describe("freezeEvent / freezeLog — runtime immutability (AC5)", () => {
  it("deep-freezes an event and its nested payload", () => {
    const frozen = freezeEvent(SAMPLE_EVENTS.emit as typeof SAMPLE_EVENTS.emit & { input: object });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen((frozen as { input: object }).input)).toBe(true); // nested, not just top level
  });

  it("deep-freezes the fork split tree recursively", () => {
    const fork = freezeEvent(SAMPLE_EVENTS.fork) as Extract<EngineEvent, { kind: "fork" }>;
    expect(Object.isFrozen(fork.splitTree)).toBe(true);
    expect(Object.isFrozen(fork.splitTree.children)).toBe(true);
    expect(Object.isFrozen(fork.splitTree.children?.[0])).toBe(true); // leaf level too
  });

  it("rejects mutation of a frozen event in strict mode", () => {
    "use strict";
    const frozen = freezeEvent({ kind: "demand", tick: 0 } satisfies EngineEvent);
    expect(() => {
      (frozen as { tick: number }).tick = 99;
    }).toThrow(TypeError);
  });

  it("freezes both the log array and every event in it", () => {
    const log = freezeLog([
      { kind: "demand", tick: 0 },
      { kind: "found", tick: 1, elementId: 2 },
    ]);
    expect(Object.isFrozen(log)).toBe(true); // length/order can't change
    expect(log.every((e) => Object.isFrozen(e))).toBe(true); // nor any element
  });
});

describe("orderSnapshot — wire projection", () => {
  it("drops id, keeping total and region (matches spec §5 input shape)", () => {
    const order = ORDERS[1]; // id 2, total 1200, West — the findFirst target
    expect(orderSnapshot(order!)).toEqual({ total: 1200, region: "West" });
    expect(orderSnapshot(order!)).not.toHaveProperty("id");
  });
});
