/**
 * Shared fast-check arbitraries (S0.2 stub).
 *
 * Property tests draw their inputs from here so generators are defined once and
 * shrink consistently across the suite (R4). This is intentionally a *stub*: the
 * load-bearing domain arbitrary — the shrinkable `Order`-list generator with
 * totals clustered around the 100 boundary — is specified in S0.6 and will be
 * added there. For now it provides the primitive generators the S0.2 worked
 * example needs, plus the seam S0.6 will extend.
 */
import fc from "fast-check";

/**
 * Fixed default seed for reproducible property runs. Any failing property prints
 * the seed that reproduces it; pin it here (or via `fc.assert(..., { seed })`)
 * to replay a shrink deterministically.
 */
export const DEFAULT_SEED = 0x5747_2025;

/** Encounter-order indices: non-empty integer lists, the shape `find*` reasons over. */
export const arbIndexList = (): fc.Arbitrary<number[]> =>
  fc.array(fc.integer({ min: 0, max: 1_000 }), { minLength: 1, maxLength: 32 });

/** JDK `int`-range totals clustered around the Slice-A filter boundary (100). */
export const arbTotal = (): fc.Arbitrary<number> =>
  fc.oneof(
    fc.integer({ min: 90, max: 110 }), // dense around the threshold — the interesting region
    fc.integer({ min: -2_147_483_648, max: 2_147_483_647 }),
  );
