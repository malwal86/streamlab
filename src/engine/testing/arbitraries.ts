/**
 * Shared fast-check arbitraries (S0.2 → S0.6).
 *
 * Property tests draw their inputs from here so generators are defined once and
 * shrink consistently across the suite (R4). The primitive generators (S0.2)
 * feed the worked example; the load-bearing domain arbitrary — {@link arbOrderList},
 * a shrinkable `Order`-list generator with totals clustered around the 100
 * boundary — is the seam S0.6 filled, and is what every oracle-equality property
 * draws its inputs from.
 */
import fc from "fast-check";
import { REGIONS, type Order, type Region } from "../domain/order";

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

/** One of the three `groupingBy` regions — a shrinkable draw from the enum. */
export const arbRegion = (): fc.Arbitrary<Region> => fc.constantFrom(...REGIONS);

/**
 * An arbitrary `Order`. `id` stays small and positive so failing cases print
 * legibly (the oracle's outcome never depends on `id`'s magnitude); `total` uses
 * {@link arbTotal}, so a generated stream is dense with orders that sit right on
 * the `> 100` filter boundary — the region a survivor/die bug hides in.
 */
export const arbOrder = (): fc.Arbitrary<Order> =>
  fc.record({
    id: fc.integer({ min: 1, max: 9_999 }),
    total: arbTotal(),
    region: arbRegion(),
  });

/**
 * The load-bearing domain arbitrary (S0.6): a varied, shrinkable list of orders —
 * the input every oracle-equality property runs the engine and the oracle over.
 * Includes the empty list (`minLength: 0`, exercising `find*` → `undefined` and
 * empty grouping) and shrinks toward shorter lists of boundary-hugging totals, so
 * a counterexample minimizes to the smallest stream that still reproduces. Capped
 * at 24 to keep shrink search and golden-adjacent runs fast.
 */
export const arbOrderList = (): fc.Arbitrary<Order[]> =>
  fc.array(arbOrder(), { minLength: 0, maxLength: 24 });
