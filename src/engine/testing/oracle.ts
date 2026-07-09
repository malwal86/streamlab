/**
 * The **oracle** (S0.6, R4): a trivially-correct native-array reference for every
 * op *outcome*, so every generated case can assert `engine result == oracle`.
 *
 * The whole value of an oracle is its *independence*. If it shared code with the
 * engine, `engine == oracle` would be circular — a bug copied into both sides
 * would pass. So this module imports only the domain **types** (`Order`,
 * `Region`) — which carry no behavior — and re-derives every outcome from first
 * principles with plain array ops: `filter` is a bare `total > 100`, `map`
 * re-inlines the 10%-off integer math rather than calling the engine's
 * `applyDiscount`, grouping is a hand-rolled reduce-into-`Map`, and `find*` is
 * "first survivor in encounter order". A reader can check each function correct
 * by inspection (AC4); `oracle.property.test.ts` guards that inspection with
 * generated cases, and `oracle.test.ts` pins the fixture outcomes.
 *
 * These are **outcomes only** — never the event log. The log is the engine's
 * private business; the oracle asserts nothing about *how* the result was
 * reached, only *what* it is. (Grouping's cross-lane order nuance for parallel is
 * S3.3's concern; here bins are in encounter order.)
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */
import { expect } from "vitest";
import { type Order, type Region } from "../domain/order";

/**
 * The Slice `filter` boundary, re-declared here as a bare literal. Deliberately
 * *not* imported from `../domain/fixture` (`FILTER_THRESHOLD`): the oracle must be
 * legible in isolation, and coupling it to a shared constant would let a wrong
 * edit to that constant hide in both the engine and its reference.
 */
export const ORACLE_FILTER_THRESHOLD = 100;

/**
 * Reference `filter (total > 100)`: keep the survivors, in encounter order. A
 * bare predicate over the array — the one line the engine's stateful, event-
 * emitting `filter` sink must agree with on outcome.
 */
export function oracleFilter(orders: readonly Order[]): Order[] {
  return orders.filter((order) => order.total > ORACLE_FILTER_THRESHOLD);
}

/**
 * Reference `map (Order::applyDiscount)`: 10% off with JDK `int` truncation
 * (`total - trunc(total / 10)`), length/order/id/region preserved. The discount
 * math is **re-inlined**, not imported from `../domain/order`, precisely so this
 * reference can catch a bug in that function instead of mirroring it.
 */
export function oracleMap(orders: readonly Order[]): Order[] {
  return orders.map((order) => ({
    id: order.id,
    total: order.total - Math.trunc(order.total / 10),
    region: order.region,
  }));
}

/**
 * Reference `collect(groupingBy(Order::region))`: reduce into a `Map` keyed by
 * region, each bin holding its members in encounter order. First-seen key order
 * for the map itself (what a sequential run produces). Cross-lane bin ordering
 * under parallelism is order-agnostic and handled by S3.3, not here.
 */
export function oracleGroupingBy(orders: readonly Order[]): Map<Region, Order[]> {
  const bins = new Map<Region, Order[]>();
  for (const order of orders) {
    const bin = bins.get(order.region);
    if (bin) bin.push(order);
    else bins.set(order.region, [order]);
  }
  return bins;
}

/**
 * Reference `filter(...).findFirst()` / `.findAny()` **outcome**: the first
 * survivor in encounter order, or `undefined` when none survive. For an *ordered*
 * stream `findFirst` is exactly this; `findAny` sequentially returns the same
 * element, so this is a valid reference for both. `findAny`'s parallel freedom to
 * return *any* survivor is a set-membership property (S2.1/S4.1) checked against
 * {@link oracleSurvivors}, not an outcome the single-value oracle can pin.
 */
export function oracleFindFirst(orders: readonly Order[]): Order | undefined {
  return oracleFilter(orders)[0];
}

/**
 * The full set of survivors, in encounter order — the pool any `findAny` result
 * must belong to (membership is S4.1's load-bearing property). Provided here so
 * the parallel `findAny` tests assert `result ∈ oracleSurvivors` rather than a
 * single fixed element.
 */
export function oracleSurvivors(orders: readonly Order[]): Order[] {
  return oracleFilter(orders);
}

/**
 * Assert an engine `actual` outcome equals the oracle `expected`, with a readable
 * structural diff on failure (AC3). A thin, deliberate wrapper over Vitest's
 * `toEqual` so every call site reads as an intent ("this must match the oracle")
 * and failures name the op. `toEqual` compares by value — frozen engine `Order`s
 * and the oracle's plain objects match — and understands `Map`, so grouping
 * outcomes compare directly.
 *
 * `toEqual` is order-sensitive on arrays and bins; that is correct for every
 * sequential outcome (encounter order is preserved end to end). The order-
 * agnostic parallel-grouping comparison lives in S3.3, which needs it.
 */
export function assertEqualsOracle<T>(actual: T, expected: T, op?: string): void {
  expect(
    actual,
    op ? `engine ${op} outcome must equal the oracle` : "engine outcome must equal the oracle",
  ).toEqual(expected);
}
