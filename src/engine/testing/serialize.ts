/**
 * Deterministic, byte-stable serialization for golden event-log snapshots (S0.2).
 *
 * The whole regression-net strategy (R4) depends on goldens being *meaningful
 * diffs*: two runs of the same engine on the same config must produce the same
 * bytes on every machine. Raw `JSON.stringify` does not guarantee that — object
 * key order is insertion-dependent, floats drift across platforms, `-0`/`NaN`/
 * `Infinity` serialize inconsistently, and any wall-clock field would make every
 * snapshot churn. This module normalizes all of that away.
 *
 * Zero engine/React imports: it operates on plain values so it can canonicalize
 * a hand-built sample log (S0.2) today and the real `EngineEvent[]` (S0.4) later
 * without change.
 */

/**
 * Number of decimal places floats are rounded to before serialization. Engine
 * outputs are integer-dominated (JDK `int` totals, tick counts); this only
 * guards the occasional interpolated/derived float against last-bit platform
 * drift. Kept generous so it never collapses genuinely distinct values.
 */
export const FLOAT_PRECISION = 9;

/**
 * Keys stripped from every object during canonicalization. The event contract
 * (R2) is intentionally wall-clock-free — `tick` is a logical counter, not a
 * timestamp — so this set is a guard rail, not a routine need: if volatile
 * bookkeeping ever leaks into a payload, it must not poison the snapshot.
 */
export const VOLATILE_KEYS: ReadonlySet<string> = new Set([
  "timestamp",
  "ts",
  "wallClock",
  "createdAt",
]);

function normalizeNumber(n: number): number | string {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "Infinity";
  if (n === -Infinity) return "-Infinity";
  if (Object.is(n, -0)) return 0; // collapse negative zero to a single representation
  if (Number.isInteger(n)) return n;
  // Round to a fixed precision so 0.1 + 0.2 == 0.30000000000000004 does not make
  // one machine's snapshot differ from another's.
  return Number(n.toFixed(FLOAT_PRECISION));
}

/**
 * Recursively rebuild `value` into a canonical form: object keys sorted, numbers
 * normalized, volatile keys dropped, `undefined` removed. The result is a plain
 * JSON-safe value whose `JSON.stringify` is stable across runs and machines.
 */
export function canonicalize(value: unknown): unknown {
  if (value === null) return null;

  const t = typeof value;
  if (t === "number") return normalizeNumber(value as number);
  if (t === "bigint") return `${value as bigint}n`; // JSON has no bigint; tag it losslessly
  if (t === "string" || t === "boolean") return value;
  if (t === "undefined" || t === "function" || t === "symbol") return undefined;

  if (Array.isArray(value)) {
    return value.map((el) => (el === undefined ? null : canonicalize(el)));
  }

  // Plain object: sort keys, drop volatile + undefined-valued entries.
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    if (VOLATILE_KEYS.has(key)) continue;
    const canon = canonicalize(source[key]);
    if (canon === undefined) continue;
    out[key] = canon;
  }
  return out;
}

/**
 * Serialize an event log (or any value) to the canonical golden string:
 * pretty-printed, key-sorted, number-normalized, trailing newline. Byte-stable
 * across runs and machines for equal logical content.
 */
export function serializeLog(log: unknown): string {
  return `${JSON.stringify(canonicalize(log), null, 2)}\n`;
}
