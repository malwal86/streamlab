/**
 * The `Order` domain (S0.3, R1): the object the Slice pipelines stream over, its
 * `region` group key, and the pure `applyDiscount` transform that `map` renders
 * as a size morph (spec §3.3). The frozen dataset itself lives in `./fixture`;
 * this module owns the *types and behavior*, the fixture owns the *data*.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */
import { intValue, refValue, type IntValue, type RefValue } from "./value";

/**
 * The regions orders group into. Cardinality 3 keeps the grouping slice's 3D
 * bins watchable (spec: 3–4 regions). Declared as a `const` tuple so it is both
 * the runtime source of truth for iteration and the compile-time `Region` type —
 * adding a region in one place updates both.
 */
export const REGIONS = ["West", "East", "North"] as const;
export type Region = (typeof REGIONS)[number];

/**
 * One order in the stream. `total` is a JDK primitive `int` (whole dollars): the
 * magnitude `filter` tests (`total > 100`) and `map` shrinks. `region` is the
 * `groupingBy` key. Fields are `readonly`; fixture instances are also frozen at
 * runtime (see `./fixture`).
 */
export interface Order {
  readonly id: number;
  readonly total: number;
  readonly region: Region;
}

/**
 * The `Order::applyDiscount` transform — pure, JDK-faithful integer arithmetic.
 * Takes 10% off using `int` division (`total - total / 10`, truncating toward
 * zero exactly as Java's `int / int` does), and returns a **new frozen** order;
 * the input is never mutated.
 *
 * Strict decrease (AC1) holds for every total the pipeline actually feeds it:
 * `applyDiscount` runs after `filter (total > 100)`, and for any `total >= 10`
 * the truncated 10% is at least 1, so the result is strictly lower. Below 10 the
 * discount can round to 0 — outside the domain by construction, and never
 * reached in the fixture.
 */
export function applyDiscount(order: Order): Order {
  const discount = Math.trunc(order.total / 10);
  return Object.freeze({ ...order, total: order.total - discount });
}

/**
 * The order's total as a primitive `int` value — what `filter` compares and
 * `map` morphs. Ties the {@link Value} model to the domain it exists to serve.
 */
export function totalValue(order: Order): IntValue {
  return intValue(order.total);
}

/**
 * The `groupingBy(Order::region)` key as a boxed reference. Regions are interned
 * string constants, so two West orders yield identity-equal keys and land in the
 * same bin — the enum-key behavior the JDK relies on (see `valueEquals`).
 */
export function groupKey(order: Order): RefValue {
  return refValue(order.region);
}
