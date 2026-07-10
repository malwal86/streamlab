"use client";

import { useAppStore } from "@/store/appStore";
import { projectScene } from "../projection";

/**
 * The demand heartbeat (S1.5): renders the two signals the projection reports at
 * the current playhead — never more than one at a time (spec §3.6). The visual
 * contrast is load-bearing correctness, not decoration (spec §3.2):
 *
 *   - the **demand spike** is dim and thin (a small, translucent, low-glow marker)
 *     travelling terminal → source — the *pull*, backwards;
 *   - the **element pulse** is bright and fat (a large, un-tone-mapped, high-glow
 *     sphere the bloom pass blooms) travelling forwards — the *data*.
 *
 * Position is a pure read of `projectScene(log, playhead)`, so what glows is always
 * exactly what the log says, and scrubbing the playhead moves it deterministically.
 */
export function Heartbeat() {
  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  const { demandSpike, pulse } = projectScene(log, playhead);

  return (
    <>
      {demandSpike && (
        <mesh position={[demandSpike.x, 0, 0]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial
            color="#2c4a66"
            emissive="#3d63a8"
            emissiveIntensity={0.9}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}
      {pulse && (
        <mesh position={[pulse.x, pulse.y, 0]}>
          <sphereGeometry args={[0.34, 20, 20]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#93d0ff"
            emissiveIntensity={2.2}
            toneMapped={false}
          />
        </mesh>
      )}
    </>
  );
}
