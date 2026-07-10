/**
 * S1.6 — pulse encoding is a pure, injective, colorblind-safe function of the
 * payload. Hue and glyph are distinct per region (so region reads with *or*
 * without color); size is monotonic in total and clamped; the label carries the
 * region in two color-independent ways.
 */
import { describe, it, expect } from "vitest";
import { REGIONS } from "@/engine/domain/order";
import {
  PULSE_RADIUS_MAX,
  PULSE_RADIUS_MIN,
  pulseLabel,
  pulseRadius,
  regionGlyph,
  regionHue,
} from "./encoding";

describe("S1.6 region encoding — injective and grayscale-safe (AC1, AC3)", () => {
  it("hue is a distinct color per region", () => {
    const hues = REGIONS.map(regionHue);
    expect(new Set(hues).size).toBe(REGIONS.length);
  });

  it("glyph is a distinct, color-independent shape per region", () => {
    const glyphs = REGIONS.map(regionGlyph);
    expect(new Set(glyphs).size).toBe(REGIONS.length);
  });

  it("is deterministic — same region, same hue and glyph (AC4)", () => {
    expect(regionHue("West")).toBe(regionHue("West"));
    expect(regionGlyph("North")).toBe(regionGlyph("North"));
  });
});

describe("S1.6 size encoding — size ∝ total (AC1)", () => {
  it("is monotonic non-decreasing in total", () => {
    const totals = [0, 100, 250, 600, 1200, 2000, 50_000];
    const radii = totals.map(pulseRadius);
    for (let i = 1; i < radii.length; i += 1) {
      expect(radii[i]!).toBeGreaterThanOrEqual(radii[i - 1]!);
    }
  });

  it("clamps into [min, max] for tiny and huge totals", () => {
    expect(pulseRadius(-9999)).toBe(PULSE_RADIUS_MIN);
    expect(pulseRadius(0)).toBe(PULSE_RADIUS_MIN);
    expect(pulseRadius(2_147_483_647)).toBe(PULSE_RADIUS_MAX);
  });
});

describe("S1.6 riding label (AC2, AC3)", () => {
  it("formats glyph, dollar total, and region name", () => {
    expect(pulseLabel(1200, "West")).toBe("▲ $1200 · West");
    expect(pulseLabel(450, "East")).toBe("● $450 · East");
  });

  it("names the region in text — legible without color", () => {
    expect(pulseLabel(300, "North")).toContain("North");
  });
});
