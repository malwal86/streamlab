"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { useAppStore } from "@/store/appStore";
import { CONDUIT_NODES, axonSegments, conduitNode } from "../geometry";
import { type SourceState } from "../projection";
import { forkLayout } from "../parallel";
import { useScene } from "./useScene";
import { Neuron } from "./Neuron";
import { Axon } from "./Axon";
import { Heartbeat } from "./Heartbeat";
import { AutoPlay } from "./AutoPlay";
import { FilterReadout } from "./FilterReadout";
import { RegionBins } from "./RegionBins";
import { FoundLatch } from "./FoundLatch";
import { ParallelFork } from "./ParallelFork";
import { ParallelBins } from "./ParallelBins";

/**
 * The **source stack** (S1.4 → S2.3): one dot per source element, stacked vertically
 * just left of the source neuron. Its height is `source.total` — every element the
 * source *holds*, pulled or not. In Slice B a short-circuit run leaves a tail of
 * elements **never demanded**: once the playhead passes `shortcircuit`, the trailing
 * `source.neverPulledCount` dots go **dark** (desaturated, dimmed) and a
 * "N never pulled" counter appears — the visible proof that laziness meant they were
 * never touched (spec §3.2 Slice B wow, AC1/AC2). All a pure read of the projection.
 */
function SourceStack({ source }: { source: SourceState }) {
  const x = conduitNode("source").x - 1.4;
  const { total, neverPulledCount } = source;
  // The un-pulled remainder is the encounter-order tail — the top slots here.
  const firstDarkIndex = total - neverPulledCount;

  return (
    <group position={[x, 0, 0]}>
      {Array.from({ length: total }, (_, i) => {
        const dark = i >= firstDarkIndex;
        return (
          <mesh key={i} position={[0, (i - (total - 1) / 2) * 0.32, 0]}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial
              color={dark ? "#141821" : "#26324c"}
              emissive={dark ? "#000000" : "#0b1a33"}
              emissiveIntensity={dark ? 0 : 0.5}
              transparent
              opacity={dark ? 0.35 : 1}
            />
          </mesh>
        );
      })}
      {neverPulledCount > 0 && (
        <Html
          center
          position={[0, (total - 1) / 2 + 0.55, 0]}
          distanceFactor={13}
          style={{
            pointerEvents: "none",
            color: "#8a94a8",
            font: "600 12px ui-monospace, SFMono-Regular, Menlo, monospace",
            whiteSpace: "nowrap",
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
          }}
        >
          {neverPulledCount} never pulled
        </Html>
      )}
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
  const { source } = useScene();
  // A `fork` in the log means this is a parallel run — render the forked lane
  // conduits (S3.4) in place of the single sequential trunk + heartbeat, so the two
  // never double-render. Bins are shared: they grow from the (per-lane) accumulate
  // events in both modes; S3.5 makes the parallel bins visibly private-per-lane.
  const parallel = useAppStore((s) => forkLayout(s.eventLog).length > 0);

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 6, 9]} intensity={140} />
      <pointLight position={[-8, -4, 6]} intensity={40} color="#3b6cff" />

      {!parallel && (
        <>
          {axonSegments().map((axon) => (
            <Axon key={`${axon.from}-${axon.to}`} axon={axon} />
          ))}
          {CONDUIT_NODES.map((node) => (
            <Neuron key={node.id} id={node.id} />
          ))}
          <SourceStack source={source} />
          <FoundLatch />
          <Heartbeat />
          <FilterReadout />
        </>
      )}
      {parallel && (
        <>
          <ParallelFork />
          <ParallelBins />
        </>
      )}

      {!parallel && <RegionBins />}
      <AutoPlay />

      <OrbitControls enablePan={false} enableDamping dampingFactor={0.1} target={[1, 0.4, 0]} />
    </>
  );
}
