import { describe, it, expect } from "vitest";
import { applyDiscount, totalValue, groupKey, type Order } from "./order";
import { isInt, isRef } from "./value";

/**
 * S0.3 AC1 — `applyDiscount` is pure and strictly lowers the total; plus the
 * `Value` projections that connect the model to the domain (AC4). Property
 * generalizations live in `order.property.test.ts`.
 */
describe("applyDiscount — pure 10% (JDK int division)", () => {
  it("matches the golden example: 1200 → 1080", () => {
    expect(applyDiscount({ id: 2, total: 1200, region: "West" }).total).toBe(1080);
  });

  it("truncates toward zero like Java int division (105 → 95, not 94.5)", () => {
    // 105 / 10 = 10 (truncated), so 105 - 10 = 95.
    expect(applyDiscount({ id: 1, total: 105, region: "East" }).total).toBe(95);
  });

  it("strictly lowers the total", () => {
    const before = { id: 1, total: 450, region: "East" } as const;
    expect(applyDiscount(before).total).toBeLessThan(before.total);
  });

  it("preserves id and region (only the total morphs)", () => {
    const out = applyDiscount({ id: 7, total: 600, region: "North" });
    expect(out.id).toBe(7);
    expect(out.region).toBe("North");
  });

  it("does not mutate its input (purity)", () => {
    const input: Order = { id: 1, total: 200, region: "West" };
    const snapshot = { ...input };
    applyDiscount(input);
    expect(input).toEqual(snapshot);
  });

  it("returns a frozen order", () => {
    expect(Object.isFrozen(applyDiscount({ id: 1, total: 200, region: "West" }))).toBe(true);
  });
});

describe("Value projections of an order", () => {
  it("totalValue is a primitive int carrying the total", () => {
    const v = totalValue({ id: 1, total: 450, region: "East" });
    expect(isInt(v)).toBe(true);
    expect(v.int).toBe(450);
  });

  it("groupKey is a boxed reference to the region", () => {
    const v = groupKey({ id: 1, total: 450, region: "East" });
    expect(isRef(v)).toBe(true);
    expect(v.ref).toBe("East");
  });
});
