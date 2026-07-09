/**
 * The frozen order fixture (S0.3, R1). This dataset is **load-bearing**: every
 * downstream golden — sequential logs, parallel interleavings, findFirst/findAny
 * toggles — is a function of it, so the boundary properties encoded here are
 * frozen on purpose. `fixture.test.ts` asserts each property below; do not edit
 * an order without reading that test, or a silent edit will break Slice-B
 * parallel semantics (S3.1) three stories away.
 *
 * Curated for watchability (11 orders, spec's 10–12) and to exercise every
 * boundary the acceptance criteria name. Each order earns its place:
 *
 *   idx id total region  survives?  scenario it covers
 *   --- -- ----- ------  ---------  ----------------------------------------------
 *    0   1    80 West     no        first pulse *dies* — lazy flow is visible before
 *                                   any survivor exists (sub-100 #1)
 *    1   2  1200 West     yes       findFirst TARGET — earliest survivor in encounter
 *                                   order; latches "FOUND" in Slice-B
 *    2   3    95 East     no        sub-100 #2, just under the boundary
 *    3   4   450 East     yes       East bin survivor (Slice-A grouping)
 *    4   5   300 North    yes       North bin survivor — keeps North non-trivial
 *    5   6   150 West     yes       2nd West survivor — a bin with count > 1
 *    6   7   600 East     yes       first survivor of the 2nd partition half
 *    7   8    99 North    no        sub-100 #3, boundary-adjacent (99 vs 100)
 *    8   9  2000 North    yes       findFirst DECOY — a *later* survivor in the 2nd
 *                                   half; recursive-halving lands it in a different
 *                                   lane than the target, so findAny may return it
 *                                   but findFirst must not (S3.1)
 *    9  10   100 West     no        boundary EXACTLY 100 — dies under strict `>`
 *                                   (kills the `> → >=` mutant)
 *   10  11   250 West     yes       tail survivor — flow continues past the decoy
 *
 * Survivors per region (all non-empty ⇒ bins are non-trivial): West {2,6,11},
 * East {4,7}, North {5,9}.
 */
import { type Order } from "./order";

/**
 * The Slice pipeline's `filter` boundary: an order *survives* iff `total >
 * FILTER_THRESHOLD`. Defined here because it is a property of the *scenario* the
 * fixture was curated against (and the invariant test needs it); the `filter` op
 * that enforces it at runtime arrives later (S0.5/E1).
 */
export const FILTER_THRESHOLD = 100;

/** Id of the earliest surviving order — what `findFirst` (ordered) must return. */
export const FIND_FIRST_TARGET_ID = 2;

/**
 * Id of the later surviving decoy in the opposite partition half. `findAny`
 * (unordered) may legitimately return it under parallelism; `findFirst` may not.
 */
export const DECOY_ID = 9;

const RAW_ORDERS: readonly Order[] = [
  { id: 1, total: 80, region: "West" },
  { id: 2, total: 1200, region: "West" },
  { id: 3, total: 95, region: "East" },
  { id: 4, total: 450, region: "East" },
  { id: 5, total: 300, region: "North" },
  { id: 6, total: 150, region: "West" },
  { id: 7, total: 600, region: "East" },
  { id: 8, total: 99, region: "North" },
  { id: 9, total: 2000, region: "North" },
  { id: 10, total: 100, region: "West" },
  { id: 11, total: 250, region: "West" },
];

/**
 * The frozen dataset. Both the array and every order are `Object.freeze`d, so a
 * stray `ORDERS[0].total = 0` or `ORDERS.push(...)` throws in strict mode rather
 * than silently corrupting a shared fixture (AC5).
 */
export const ORDERS: readonly Order[] = Object.freeze(
  RAW_ORDERS.map((order) => Object.freeze(order)),
);
