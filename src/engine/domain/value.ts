/**
 * The `Value` tagged union (S0.3, R1): the engine's JDK-faithful datum, aware of
 * the distinction Java draws between a **primitive `int`** and a **boxed
 * reference** (`Integer`, `Order`, a `String` group key, …).
 *
 * Why the engine needs this distinction rather than plain JS numbers/objects:
 * the whole point of the visualization is semantic fidelity, and two of Java's
 * most surprising stream behaviors fall directly out of primitive-vs-boxed —
 *   - **equality:** `int` compares by value (`1000 == 1000` is always true);
 *     a boxed `Integer` compares by *identity* (`Integer.valueOf(1000) ==
 *     Integer.valueOf(1000)` is false outside the small-value cache). `groupingBy`
 *     keying, `distinct`, and `findAny` all ride on which one you have.
 *   - **nullability:** a primitive `int` can never be null; a reference can.
 * Modeling both arms lets later ops behave the way the JDK actually does instead
 * of the way JS coincidentally does.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`). Values are
 * plain readonly literals, not frozen: the sequential runner (S0.5) mints many
 * per run, `readonly` already forbids mutation at compile time, and freezing the
 * hot path would buy nothing the type system doesn't already guarantee.
 */

/** Bounds of a JDK 32-bit signed `int`. A total or index outside this is not an `int`. */
export const INT_MIN = -2_147_483_648;
export const INT_MAX = 2_147_483_647;

/** A primitive `int`: a whole number in `[INT_MIN, INT_MAX]`, compared by value. */
export interface IntValue {
  readonly kind: "int";
  readonly int: number;
}

/**
 * A boxed reference: an `Order`, a `Region` group key, a boxed `Integer`, or
 * `null`. Compared by *identity* — see {@link valueEquals}.
 */
export interface RefValue {
  readonly kind: "ref";
  readonly ref: unknown;
}

export type Value = IntValue | RefValue;

/**
 * Construct a primitive `int` value. Crashes early (R-quality: a bad datum must
 * not silently propagate) if `n` is not a whole number in the JDK `int` range —
 * a non-integer or out-of-range number is simply not an `int`, and pretending
 * otherwise would corrupt every downstream comparison.
 */
export function intValue(n: number): IntValue {
  if (!Number.isInteger(n)) {
    throw new RangeError(`intValue: ${n} is not a whole number (a JDK int has no fractional part)`);
  }
  if (n < INT_MIN || n > INT_MAX) {
    throw new RangeError(`intValue: ${n} is outside the JDK int range [${INT_MIN}, ${INT_MAX}]`);
  }
  return { kind: "int", int: n };
}

/** Wrap any reference (object, string key, or `null`) as a boxed `Value`. */
export function refValue(ref: unknown): RefValue {
  return { kind: "ref", ref };
}

export function isInt(v: Value): v is IntValue {
  return v.kind === "int";
}

export function isRef(v: Value): v is RefValue {
  return v.kind === "ref";
}

/**
 * JDK-faithful equality. Two `int`s are equal iff their numeric values match
 * (`==` on primitives). Two references are equal iff they are the *same object*
 * (`==` on references, i.e. `Object.is`) — so two independently boxed `Integer`s
 * of 1000 are **not** equal, exactly as in Java. A primitive and a reference are
 * never equal (no implicit unboxing here). Note that interned references —
 * `String` literals, enum constants — are identity-equal to themselves, which is
 * why a `Region` works as a `groupingBy` key.
 */
export function valueEquals(a: Value, b: Value): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "int") return a.int === (b as IntValue).int;
  return Object.is(a.ref, (b as RefValue).ref);
}

/**
 * Autoboxing: lift a primitive `int` into a *fresh* boxed reference (`Integer
 * .valueOf`). Each call yields a distinct object, so `valueEquals(boxInt(x),
 * boxInt(x))` is `false` — the model's one-line proof that boxing trades value
 * equality for identity.
 */
export function boxInt(v: IntValue): RefValue {
  return refValue({ boxedInt: v.int });
}

/** Unboxing: recover the primitive `int` from a reference produced by {@link boxInt}. */
export function unboxInt(v: RefValue): IntValue {
  const r = v.ref;
  if (r === null || typeof r !== "object" || !("boxedInt" in r)) {
    throw new TypeError("unboxInt: reference does not hold a boxed int");
  }
  return intValue((r as { boxedInt: number }).boxedInt);
}
