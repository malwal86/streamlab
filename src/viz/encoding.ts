/**
 * Pulse encoding (S1.6, spec §3.3) — the pure mapping from an element's payload to
 * how its pulse looks: **hue = region, size ∝ total, plus a riding label**. Every
 * function here is a pure function of the payload (S1.6 AC4), so the pulse's
 * appearance can never diverge from the data it carries.
 *
 * Accessibility is built in, not bolted on (spec §3.7): region is paired with a
 * distinct **glyph/shape** so it is legible without color (AC3). `regionHue` and
 * `regionGlyph` are both injective over the three regions, and the glyphs are
 * chosen with distinct silhouettes *and* distinct grayscale luminance so a
 * colorblind or grayscale viewer still tells them apart.
 */
import { type Region } from "@/engine/domain/order";

/**
 * Region → hue. A small colorblind-aware categorical palette (blue / amber /
 * violet) — well separated in hue *and* luminance, so the three regions stay
 * distinguishable under the common CVD types. Never the sole cue, though: the glyph
 * below is the color-independent pairing.
 */
const REGION_HUE: Record<Region, string> = {
  West: "#5aa0ff",
  East: "#ffab3d",
  North: "#c77dff",
};

/**
 * Region → glyph. A distinct silhouette per region (triangle / circle / square) —
 * the non-color cue that keeps region legible in grayscale (AC3). Shown in the
 * riding label so survival and region never depend on color alone (spec §3.7).
 */
const REGION_GLYPH: Record<Region, string> = {
  West: "▲",
  East: "●",
  North: "■",
};

/** The pulse hue for a region (a deterministic function of `region`). */
export function regionHue(region: Region): string {
  return REGION_HUE[region];
}

/** The color-independent glyph for a region — the grayscale-safe pairing (AC3). */
export function regionGlyph(region: Region): string {
  return REGION_GLYPH[region];
}

/** The visual size range (sphere radius) a pulse maps into, whatever its total. */
export const PULSE_RADIUS_MIN = 0.22;
export const PULSE_RADIUS_MAX = 0.5;

/** The total at which the pulse reaches {@link PULSE_RADIUS_MAX} (larger saturates). */
export const PULSE_SIZE_SATURATION = 2000;

/**
 * Total → pulse radius, size ∝ total (spec §3.3). Monotonic non-decreasing and
 * clamped into `[PULSE_RADIUS_MIN, PULSE_RADIUS_MAX]` so a tiny survivor is still
 * visible and a huge (or generated int-max) total does not swamp the scene. The
 * `map` size-morph (S1.8) animates *between* two of these radii.
 */
export function pulseRadius(total: number): number {
  const t = Math.min(Math.max(total, 0), PULSE_SIZE_SATURATION) / PULSE_SIZE_SATURATION;
  return PULSE_RADIUS_MIN + (PULSE_RADIUS_MAX - PULSE_RADIUS_MIN) * t;
}

/**
 * The riding DOM label text (spec §3.3): `"▲ $1200 · West"` — glyph, dollar total,
 * region name. Carries region in *two* color-independent ways (glyph + name), so a
 * grayscale reader loses nothing.
 */
export function pulseLabel(total: number, region: Region): string {
  // Round: the map morph passes fractional totals mid-shrink; the label reads dollars.
  return `${regionGlyph(region)} $${Math.round(total)} · ${region}`;
}
