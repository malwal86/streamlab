"use client";

import { OrbitControls } from "@react-three/drei";
import { useAppStore } from "@/store/appStore";
import { CONDUIT_NODES, axonSegments, conduitNode } from "../geometry";
import { sourceStackCount } from "../projection";
import { Neuron } from "./Neuron";
import { Axon } from "./Axon";
import { Heartbeat } from "./Heartbeat";
import { AutoPlay } from "./AutoPlay";
import { FilterReadout } from "./FilterReadout";
import { RegionBins } from "./RegionBins";

/**
 * The inert **source stack** (S1.4): one dim dot per element the source will
 * release (`sourceStackCount`), stacked vertically just left of the source neuron.
 * It sits dark until the terminal first demands from it — the laziness cue S1.5
 * animates. Its height is a pure read of the log, so it always shows exactly what
 * the engine emitted.
 */
function SourceStack({ count }: { count: number }) {
  const x = conduitNode("source").x - 1.4;
  return (
    <group position={[x, 0, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[0, (i - (count - 1) / 2) * 0.32, 0]}>
          <sphereGeometry args={[0.11, 12, 12]} />
          <meshStandardMaterial color="#26324c" emissive="#0b1a33" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The neural-conduit scene chassis (S1.4): the static `source → filter → map →
 * terminal` topology with axons, lit and orbit-controllable, rendered from the
 * current event log in the store. No motion yet — S1.5 adds the demand heartbeat
 * and forward pulse on top of this exact geometry. All non-conduit chrome stays in
 * the DOM (S1.10); this component owns only what lives in 3D.
 */
export function ConduitScene() {
  const log = useAppStore((s) => s.eventLog);
  const stack = sourceStackCount(log);

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 6, 9]} intensity={140} />
      <pointLight position={[-8, -4, 6]} intensity={40} color="#3b6cff" />

      {axonSegments().map((axon) => (
        <Axon key={`${axon.from}-${axon.to}`} axon={axon} />
      ))}
      {CONDUIT_NODES.map((node) => (
        <Neuron key={node.id} id={node.id} />
      ))}
      <SourceStack count={stack} />
      <RegionBins />

      <Heartbeat />
      <FilterReadout />
      <AutoPlay />

      <OrbitControls enablePan={false} enableDamping dampingFactor={0.1} target={[1, 0.4, 0]} />
    </>
  );
}
