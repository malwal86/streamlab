"use client";

import { Html } from "@react-three/drei";
import { conduitNode, type StageId } from "../geometry";

/**
 * One conduit neuron (S1.4): a glowing wireframe soma at its stage position with a
 * DOM label riding above it. The label is `Html` (DOM, not WebGL) so type stays
 * crisp and the conduit's non-mesh text lives in the DOM per the spec's "non-conduit
 * UI stays DOM" rule. Inert here — S1.5+ drive brightness/pulses off the log.
 */
export function Neuron({ id }: { id: StageId }) {
  const node = conduitNode(id);
  return (
    <group position={[node.x, 0, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial
          color="#12203a"
          emissive="#2b6cff"
          emissiveIntensity={0.35}
          wireframe
        />
      </mesh>
      <Html
        center
        position={[0, -1.15, 0]}
        distanceFactor={14}
        style={{
          pointerEvents: "none",
          color: "#c9d6ef",
          font: "500 14px ui-sans-serif, system-ui, sans-serif",
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
        }}
      >
        {node.label}
      </Html>
    </group>
  );
}
