/**
 * S0.2 toolchain fixture — NOT part of the real stream kernel.
 *
 * This module exists only to give the test toolchain (Vitest, fast-check,
 * Stryker) something concrete and mutable to exercise, and to serve as the
 * worked red→green + mutation-killing example S0.2 requires. Both functions are
 * deliberately thematic — they mirror semantics the real engine will own — so
 * the demonstration reads honestly, but nothing here is imported by production
 * code. Delete this file (and its tests) once S0.3 introduces the real domain
 * model; the toolchain will then mutate the actual engine.
 */

/**
 * The Slice-A filter predicate in miniature: does a JDK `int` total survive the
 * `> 100` threshold? Strictly greater than — a `>=` mutant is a real behavior
 * change and must be killed by a boundary test.
 */
export function survivesThreshold(total: number, threshold: number): boolean {
  return total > threshold;
}

/**
 * Encounter-order-earliest index — the shape `findFirst` reduces to. Returns
 * `null` for an empty sequence (nothing was pulled). Linear scan so the loop
 * bounds and the `<` comparison are both mutation-covered.
 *
 * Mutation triage (R4): `npm run mutation` leaves two *equivalent mutants* alive
 * on this function, and that is expected, not a test gap — they are the worked
 * example's demonstration that surviving mutants must be reasoned about, not
 * blindly chased to 100%:
 *   - `i < len` → `i <= len`: the extra iteration reads `indices[len]` which is
 *     `undefined`; `undefined < min` is `false`, so `min` is never touched.
 *   - `candidate < min` → `candidate <= min`: on a tie the assignment rewrites
 *     `min` to an equal value, so the returned minimum is identical.
 * Both are behavior-preserving by construction — a `min` scan cannot distinguish
 * them — so no test can (or should) kill them.
 */
export function encounterMin(indices: readonly number[]): number | null {
  if (indices.length === 0) return null;
  let min = indices[0]!;
  for (let i = 1; i < indices.length; i++) {
    const candidate = indices[i]!;
    if (candidate < min) min = candidate;
  }
  return min;
}
