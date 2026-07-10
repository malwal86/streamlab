/**
 * Conduit geometry (S1.4) — the coordinate convention every viz story shares.
 *
 * The neural conduit is a **linear chain along the x-axis**: `source → filter →
 * map → terminal`, left to right, at `y = 0, z = 0` (spec §3.1). x is stage
 * progression — a pulse's journey is monotonically increasing x, a retrograde
 * `demand` spike travels decreasing x. Every later story (the heartbeat's spike
 * path, the pulse's flight, the bins past the terminal) positions itself against
 * these constants, so they live in one pure, testable module rather than scattered
 * across the R3F components.
 *
 * This module is pure data + math — no React, no three.js — so the topology is
 * unit-testable without a GL context (which jsdom lacks; the R3F components that
 * consume this are smoke-tested at the page level, per S0.1).
 */

/** The four conduit stages, in pull order (source first, terminal last). */
export type StageId = "source" | "filter" | "map" | "terminal";

/** A three-component position/vector — the shape R3F's `position` prop takes. */
export type Vec3 = readonly [number, number, number];

/**
 * One node in the conduit. `op` is the pipeline op it visualizes — the key the
 * code panel (S1.10) highlights and events' `op` field maps to (`"source"` for the
 * spliterator, `"collect"` for the grouping terminal). `x` is its position on the
 * stage axis.
 */
export interface ConduitNode {
  readonly id: StageId;
  readonly label: string;
  readonly op: string;
  readonly x: number;
}

/** Even spacing between adjacent stages on the x-axis. */
export const STAGE_SPACING = 4;

/**
 * The conduit nodes, left→right, centered on the origin so the default orbit
 * framing (S1.4 AC2) shows the whole chain symmetrically. Four stages at
 * `x ∈ {-6, -2, 2, 6}` (spacing {@link STAGE_SPACING}). The terminal's `op` is
 * `"collect"` — Slice A's grouping terminal; Slice B swaps the terminal's *behavior*
 * (S2.1) but not this node.
 */
export const CONDUIT_NODES: readonly ConduitNode[] = Object.freeze([
  { id: "source", label: "source", op: "source", x: -1.5 * STAGE_SPACING },
  { id: "filter", label: "filter", op: "filter", x: -0.5 * STAGE_SPACING },
  { id: "map", label: "map", op: "map", x: 0.5 * STAGE_SPACING },
  { id: "terminal", label: "collect", op: "collect", x: 1.5 * STAGE_SPACING },
]);

/** Look up a node by stage id (throws on an unknown id — a programming error). */
export function conduitNode(id: StageId): ConduitNode {
  const node = CONDUIT_NODES.find((n) => n.id === id);
  if (!node) throw new Error(`Unknown conduit stage: ${id}`);
  return node;
}

/** The x-coordinate of a stage — the single accessor position math goes through. */
export function stageX(id: StageId): number {
  return conduitNode(id).x;
}

/** A node's full 3D position on the stage axis (`y = z = 0`). */
export function nodePosition(id: StageId): Vec3 {
  return [stageX(id), 0, 0];
}

/** A directed connection between two adjacent nodes — an axon the pulse travels. */
export interface Axon {
  readonly from: StageId;
  readonly to: StageId;
  readonly fromX: number;
  readonly toX: number;
}

/**
 * The axons connecting consecutive nodes — three segments for the four nodes.
 * Directed source→terminal (the forward flow direction); the retrograde demand
 * spike (S1.5) runs the same segments in reverse.
 */
export function axonSegments(): readonly Axon[] {
  const segments: Axon[] = [];
  for (let i = 0; i < CONDUIT_NODES.length - 1; i += 1) {
    const from = CONDUIT_NODES[i]!;
    const to = CONDUIT_NODES[i + 1]!;
    segments.push({ from: from.id, to: to.id, fromX: from.x, toX: to.x });
  }
  return segments;
}

/** Midpoint and length of an axon — what a cylinder mesh positions/scales from. */
export function axonMidpointAndLength(axon: Axon): { midX: number; length: number } {
  return { midX: (axon.fromX + axon.toX) / 2, length: Math.abs(axon.toX - axon.fromX) };
}
