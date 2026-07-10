"use client";

import { Html } from "@react-three/drei";
import { conduitNode } from "../geometry";
import { useScene } from "./useScene";

/**
 * The filter's threshold readout (S1.7): a DOM chip above the filter neuron showing
 * the live comparison the engine made — `1200 > 100 ✓` for a survivor, `80 > 100 ✗`
 * for a reject. The pass/fail cue is a **glyph** (✓ / ✗), not color alone (spec
 * §3.7). Pure read of `projectScene`, so the readout is always the engine's actual
 * `test`, never a re-derived one.
 */
export function FilterReadout() {
  const { filterReadout } = useScene();
  if (!filterReadout) return null;

  const node = conduitNode("filter");
  const { text, passed } = filterReadout;

  return (
    <Html center position={[node.x, 1.35, 0]} distanceFactor={12}>
      <div
        style={{
          pointerEvents: "none",
          padding: "3px 9px",
          borderRadius: "6px",
          background: "rgba(8, 12, 22, 0.82)",
          border: `1px solid ${passed ? "#4bd08a" : "#ff6b6b"}88`,
          color: passed ? "#bff2d6" : "#ffc9c9",
          font: "600 13px ui-monospace, SFMono-Regular, Menlo, monospace",
          whiteSpace: "nowrap",
        }}
      >
        {text} {passed ? "✓" : "✗"}
      </div>
    </Html>
  );
}
