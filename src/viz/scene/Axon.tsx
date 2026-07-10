"use client";

import { axonMidpointAndLength, type Axon as AxonSegment } from "../geometry";

/**
 * An axon (S1.4): a thin emissive cylinder joining two adjacent neurons along the
 * x-axis. A cylinder's default axis is y, so it is rotated 90° about z to lie along
 * the stage axis; its length and midpoint come from {@link axonMidpointAndLength}.
 * The conduit the pulse (S1.5) travels forward and the demand spike travels back.
 */
export function Axon({ axon }: { axon: AxonSegment }) {
  const { midX, length } = axonMidpointAndLength(axon);
  return (
    <mesh position={[midX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.05, 0.05, length, 8]} />
      <meshStandardMaterial color="#1a2740" emissive="#123a6b" emissiveIntensity={0.4} />
    </mesh>
  );
}
