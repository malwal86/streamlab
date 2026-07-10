"use client";

import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { ConduitScene } from "./scene/ConduitScene";

/**
 * The WebGL canvas host (S1.4). Sets the camera framing so the whole conduit is in
 * view (spec §3.1, S1.4 AC2), mounts the {@link ConduitScene}, and applies the
 * bloom pass that makes the emissive neurons and (later) the active pulse glow.
 * Dynamically imported `ssr:false` by the page so three.js never runs during static
 * prerender.
 */
export default function ConduitCanvas() {
  return (
    <Canvas
      data-testid="conduit-canvas"
      camera={{ position: [0, 2.5, 18], fov: 50 }}
      dpr={[1, 2]}
    >
      <ConduitScene />
      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.25} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
