import { describe, it, expect } from "vitest";
import { ORDERS, FILTER_THRESHOLD, FIND_FIRST_TARGET_ID, DECOY_ID } from "./fixture";
import { REGIONS, type Order } from "./order";

/**
 * The fixture-invariant guard (S0.3 AC2–3, AC5). Every downstream golden depends
 * on these boundary properties, so this test is their tripwire: an edit that
 * quietly breaks Slice-B parallel semantics fails *here*, three stories before
 * S3.1, instead of as an inscrutable golden diff. If you change the fixture and a
 * property below fails, that is the test doing its job — re-derive the constants,
 * don't delete the assertion.
 */
const survives = (order: Order) => order.total > FILTER_THRESHOLD;
const byId = (id: number) => {
  const order = ORDERS.find((o) => o.id === id);
  if (!order) throw new Error(`fixture has no order with id ${id}`);
  return order;
};

describe("fixture size & identity", () => {
  it("has 10–12 orders (watchable single-file animation)", () => {
    expect(ORDERS.length).toBeGreaterThanOrEqual(10);
    expect(ORDERS.length).toBeLessThanOrEqual(12);
  });

  it("has unique ids", () => {
    expect(new Set(ORDERS.map((o) => o.id)).size).toBe(ORDERS.length);
  });

  it("only uses declared regions", () => {
    for (const order of ORDERS) expect(REGIONS).toContain(order.region);
  });
});

describe("AC2 — filter boundary population", () => {
  it("contains at least two sub-100 orders (pulses that die)", () => {
    const subHundred = ORDERS.filter((o) => o.total < FILTER_THRESHOLD);
    expect(subHundred.length).toBeGreaterThanOrEqual(2);
  });

  it("includes an order exactly at the threshold that dies under strict `>`", () => {
    const atBoundary = ORDERS.filter((o) => o.total === FILTER_THRESHOLD);
    expect(atBoundary.length).toBeGreaterThanOrEqual(1);
    for (const o of atBoundary) expect(survives(o)).toBe(false);
  });
});

describe("AC2 — findFirst target and decoy", () => {
  it("names as the target the earliest surviving order in encounter order", () => {
    const firstSurvivor = ORDERS.find(survives);
    expect(firstSurvivor?.id).toBe(FIND_FIRST_TARGET_ID);
  });

  it("the decoy is itself a surviving order (a genuine findAny candidate)", () => {
    expect(survives(byId(DECOY_ID))).toBe(true);
  });

  it("places the decoy in a different partition half than the target", () => {
    // Recursive-halving's first split is [0, mid) | [mid, len). The target must
    // fall in the first half and the decoy in the second, so they land in
    // different lanes and findAny can beat findFirst to the decoy (S3.1).
    const targetIndex = ORDERS.findIndex((o) => o.id === FIND_FIRST_TARGET_ID);
    const decoyIndex = ORDERS.findIndex((o) => o.id === DECOY_ID);
    const mid = Math.floor(ORDERS.length / 2);
    expect(targetIndex).toBeGreaterThanOrEqual(0);
    expect(targetIndex).toBeLessThan(mid);
    expect(decoyIndex).toBeGreaterThanOrEqual(mid);
  });
});

describe("AC3 — region bins are non-trivial", () => {
  it("uses 3–4 distinct regions", () => {
    const used = new Set(ORDERS.map((o) => o.region));
    expect(used.size).toBeGreaterThanOrEqual(3);
    expect(used.size).toBeLessThanOrEqual(4);
  });

  it("every declared region has at least one surviving order", () => {
    for (const region of REGIONS) {
      const survivorsInRegion = ORDERS.filter((o) => o.region === region && survives(o));
      expect(survivorsInRegion.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("AC5 — the fixture is frozen", () => {
  it("freezes the array (push throws in strict mode)", () => {
    expect(Object.isFrozen(ORDERS)).toBe(true);
    expect(() => (ORDERS as Order[]).push({ id: 99, total: 1, region: "West" })).toThrow(TypeError);
  });

  it("freezes each order (field assignment throws in strict mode)", () => {
    const first = ORDERS[0]!;
    expect(Object.isFrozen(first)).toBe(true);
    expect(() => {
      (first as { total: number }).total = 0;
    }).toThrow(TypeError);
  });
});
