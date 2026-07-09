import { describe, it, expect } from "vitest";
import { serializeLog, canonicalize } from "./serialize";

/**
 * Serializer determinism contract (S0.2 AC3). These are the guarantees the whole
 * golden regression net rests on: byte-stability independent of key order, float
 * representation, and volatile bookkeeping.
 */
describe("serializeLog — deterministic, byte-stable serialization", () => {
  it("is independent of object key insertion order", () => {
    const a = { kind: "emit", tick: 1, elementId: 3, op: "source" };
    const b = { op: "source", elementId: 3, tick: 1, kind: "emit" };
    expect(serializeLog([a])).toBe(serializeLog([b]));
  });

  it("produces identical bytes across repeated calls", () => {
    const log = [
      { kind: "demand", tick: 0 },
      { kind: "emit", tick: 1, input: { total: 1200 } },
    ];
    expect(serializeLog(log)).toBe(serializeLog(log));
  });

  it("normalizes float drift to a fixed precision", () => {
    // 0.1 + 0.2 === 0.30000000000000004; it must serialize like a clean 0.3.
    expect(serializeLog([{ x: 0.1 + 0.2 }])).toBe(serializeLog([{ x: 0.3 }]));
  });

  it("collapses negative zero to zero", () => {
    expect(serializeLog([{ x: -0 }])).toBe(serializeLog([{ x: 0 }]));
  });

  it("serializes non-finite numbers as stable tags rather than null", () => {
    const out = serializeLog([{ a: NaN, b: Infinity, c: -Infinity }]);
    expect(out).toContain('"NaN"');
    expect(out).toContain('"Infinity"');
    expect(out).toContain('"-Infinity"');
  });

  it("strips volatile timestamp-like keys so snapshots do not churn", () => {
    const withClock = { kind: "emit", tick: 1, timestamp: 1_700_000_000, wallClock: 42 };
    const without = { kind: "emit", tick: 1 };
    expect(serializeLog([withClock])).toBe(serializeLog([without]));
  });

  it("preserves bigint losslessly with a tag", () => {
    expect(canonicalize(9007199254740993n)).toBe("9007199254740993n");
  });

  it("recursively sorts nested object keys", () => {
    const nested = canonicalize({ b: { d: 1, c: 2 }, a: 3 });
    expect(JSON.stringify(nested)).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });

  it("ends with a trailing newline", () => {
    expect(serializeLog([])).toBe("[]\n");
  });
});
