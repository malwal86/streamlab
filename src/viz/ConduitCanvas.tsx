"use client";

import { Canvas } from "@react-three/fiber";
import { ConduitScene } from "./scene/ConduitScene";

/**
 * The WebGL canvas host (S1.4). Sets the camera framing so the whole conduit is in
 * view (spec §3.1, S1.4 AC2) and mounts the {@link ConduitScene}. The bloom +
 * depth-of-field postprocessing moved into the scene as `PostFx` (S5.2), so it can
 * follow the active pulse and switch off under reduced motion. Dynamically imported
 * `ssr:false` by the page so three.js never runs during static prerender.
 */
export default function ConduitCanvas() {
  return (
    <Canvas data-testid="conduit-canvas" camera={{ position: [1, 3, 21], fov: 50 }} dpr={[1, 2]}>
      <ConduitScene />
    </Canvas>
  );
}
