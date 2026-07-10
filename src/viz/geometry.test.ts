/**
 * S1.4 — the conduit topology is correct and legible: four stages in pull order,
 * strictly left→right, connected by three axons. These pin the coordinate
 * convention every later viz story builds on, so a stray edit that reorders or
 * collapses a stage fails here rather than silently in a 3D scene no test can see.
 */
import { describe, it, expect } from "vitest";
import {
  axonMidpointAndLength,
  axonSegments,
  CONDUIT_NODES,
  conduitNode,
  nodePosition,
  stageX,
} from "./geometry";

describe("S1.4 conduit topology", () => {
  it("has the four stages in pull order (AC1)", () => {
    expect(CONDUIT_NODES.map((n) => n.id)).toEqual(["source", "filter", "map", "terminal"]);
  });

  it("is laid out strictly left→right on the x-axis (AC1)", () => {
    const xs = CONDUIT_NODES.map((n) => n.x);
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    }
  });

  it("is centered on the origin so the default framing is symmetric (AC2)", () => {
    const sum = CONDUIT_NODES.reduce((s, n) => s + n.x, 0);
    expect(sum).toBeCloseTo(0);
  });

  it("maps each node to the op the code panel will highlight", () => {
    expect(conduitNode("filter").op).toBe("filter");
    expect(conduitNode("map").op).toBe("map");
    expect(conduitNode("terminal").op).toBe("collect");
  });

  it("places every node on the stage axis (y = z = 0)", () => {
    for (const node of CONDUIT_NODES) {
      expect(nodePosition(node.id)).toEqual([node.x, 0, 0]);
    }
  });

  it("throws on an unknown stage id (a programming error, not a silent default)", () => {
    // @ts-expect-error — exercising the runtime guard with an invalid id.
    expect(() => stageX("nucleus")).toThrow();
  });
});

describe("S1.4 axons connect consecutive nodes", () => {
  it("has one axon per adjacent pair (three for four nodes)", () => {
    const axons = axonSegments();
    expect(axons.map((a) => [a.from, a.to])).toEqual([
      ["source", "filter"],
      ["filter", "map"],
      ["map", "terminal"],
    ]);
  });

  it("each axon spans exactly its two endpoints", () => {
    for (const axon of axonSegments()) {
      expect(axon.fromX).toBe(stageX(axon.from));
      expect(axon.toX).toBe(stageX(axon.to));
      const { midX, length } = axonMidpointAndLength(axon);
      expect(midX).toBeCloseTo((axon.fromX + axon.toX) / 2);
      expect(length).toBeCloseTo(Math.abs(axon.toX - axon.fromX));
    }
  });
});
