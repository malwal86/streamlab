/**
 * S5.2 — bloom + depth-of-field, tested through the pure {@link postFx} decision.
 * The R3F composer is a thin shell that only reads these values, so the two
 * headlessly-verifiable acceptance criteria live here: focus follows the single
 * active pulse (AC1) and every effect is disabled under reduced motion (AC3).
 */
import { describe, it, expect } from "vitest";
import { postFx, DEFAULT_FOCUS } from "./postfx";
import { type Pulse } from "./projection";

const pulseAt = (x: number, y = 0, z = 0): Pulse => ({
  elementId: 1,
  x,
  y,
  z,
  kind: "transform",
  region: "West",
  total: 100,
  opacity: 1,
});

describe("S5.2 depth-of-field focuses the active pulse (AC1)", () => {
  it("targets the pulse's world position when one is in flight", () => {
    const fx = postFx(false, pulseAt(2, 0, 1.5));
    expect(fx.enabled).toBe(true);
    if (fx.enabled) expect(fx.dof.target).toEqual([2, 0, 1.5]);
  });

  it("the focus target tracks the pulse as it moves down the conduit", () => {
    const early = postFx(false, pulseAt(-6));
    const late = postFx(false, pulseAt(6));
    if (early.enabled && late.enabled) {
      expect(late.dof.target[0]).toBeGreaterThan(early.dof.target[0]); // sharp plane followed it
    }
  });

  it("falls back to the conduit centre when no pulse is in flight (demand / rest)", () => {
    const fx = postFx(false, null);
    if (fx.enabled) expect(fx.dof.target).toEqual(DEFAULT_FOCUS);
  });

  it("keeps bloom on outside reduced motion (the neurons still glow)", () => {
    const fx = postFx(false, null);
    expect(fx.enabled).toBe(true);
    if (fx.enabled) expect(fx.bloom.intensity).toBeGreaterThan(0);
  });
});

describe("S5.2 effects are disabled under reduced motion (AC3)", () => {
  it("returns no composer at all — nothing glows or blurs", () => {
    expect(postFx(true, null)).toEqual({ enabled: false });
  });

  it("stays disabled even with a pulse in flight (the preference wins)", () => {
    expect(postFx(true, pulseAt(0)).enabled).toBe(false);
  });
});
