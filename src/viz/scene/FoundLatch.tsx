"use client";

import { Html } from "@react-three/drei";
import { stageX } from "../geometry";
import { regionGlyph, regionHue } from "../encoding";
import { type FoundLatch as FoundLatchState } from "../projection";
import { useScene } from "./useScene";

/**
 * The terminal's **FOUND latch** (S2.2, Slice B): once the run short-circuits, a
 * ring pulses around the terminal neuron and a "FOUND" badge names the matched
 * element. It is deliberately a *different motif* from the region bins (S2.3-side
 * towers): the latch fires **on the terminal itself**, ringed and badged, so early
 * termination reads as a distinct payoff rather than "one more bin" (AC2).
 *
 * Everything is a pure read of `useScene().found`, which is non-null exactly once
 * the playhead passes the `found` event and carries `found.elementId` verbatim
 * (AC1) — so the thing that glows FOUND is always the engine's matched element,
 * never a re-derived one. The badge carries the region as glyph + name and the
 * label spells "FOUND", so the payoff never depends on color alone (AC2, spec §3.7).
 */
function LatchBadge({ found }: { found: FoundLatchState }) {
  const x = stageX("terminal");
  const hue = regionHue(found.region);

  return (
    <group position={[x, 0, 0]}>
      {/* A bright ring encircling the terminal — the "latched" halo, not a tower. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.95, 0.09, 16, 48]} />
        <meshStandardMaterial
          color={hue}
          emissive={hue}
          emissiveIntensity={3.2}
          toneMapped={false}
        />
      </mesh>
      <Html
        center
        position={[0, 1.7, 0]}
        distanceFactor={12}
        style={{
          pointerEvents: "none",
          padding: "3px 10px",
          borderRadius: "7px",
          background: "rgba(8, 12, 22, 0.85)",
          border: `2px solid ${hue}`,
          color: "#eaf1ff",
          font: "700 13px ui-monospace, SFMono-Regular, Menlo, monospace",
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
          textShadow: "0 1px 3px rgba(0,0,0,0.95)",
        }}
      >
        FOUND · {regionGlyph(found.region)} #{found.elementId} · {found.region} ${Math.round(found.total)}
      </Html>
    </group>
  );
}

/**
 * The FOUND latch layer (S2.2): renders the badge once the projection reports a
 * latched result, and nothing before it (or in Slice A, which never finds). A pure
 * function of the log + playhead, like the rest of the scene.
 */
export function FoundLatch() {
  const { found } = useScene();
  return found ? <LatchBadge found={found} /> : null;
}
