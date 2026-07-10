"use client";

import { Html } from "@react-three/drei";
import { BIN_UNIT_HEIGHT, binPosition } from "../geometry";
import { regionGlyph, regionHue } from "../encoding";
import { type BinFill } from "../projection";
import { useScene } from "./useScene";

/**
 * One region bin (S1.9): a tower at the region's bin anchor whose height is
 * `count × BIN_UNIT_HEIGHT` and whose emissive strength rises as it fills (it
 * "lights and grows", spec §3.2 step 5). Hue = region; a glyph + count label rides
 * it so the region and its size read without color. All from the projection —
 * final height equals the engine's grouping count, hence the oracle.
 */
function BinTower({ fill }: { fill: BinFill }) {
  const [x, , z] = binPosition(fill.region);
  const hue = regionHue(fill.region);
  const height = Math.max(fill.count * BIN_UNIT_HEIGHT, 0.001);
  const lit = 0.2 + Math.min(fill.count, 4) * 0.35;

  return (
    <group position={[x, 0, z]}>
      {/* Base pad — always visible so the bin's slot reads even when empty. */}
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[1.1, 0.04, 1.1]} />
        <meshStandardMaterial color="#0e1626" emissive={hue} emissiveIntensity={0.12} />
      </mesh>
      {/* The growing tower, base anchored at y=0. */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[0.9, height, 0.9]} />
        <meshStandardMaterial color={hue} emissive={hue} emissiveIntensity={lit} transparent opacity={0.85} />
      </mesh>
      <Html center position={[0, height + 0.4, 0]} distanceFactor={13}>
        <div
          style={{
            pointerEvents: "none",
            color: "#eaf1ff",
            font: "600 12px ui-monospace, SFMono-Regular, Menlo, monospace",
            whiteSpace: "nowrap",
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
          }}
        >
          {regionGlyph(fill.region)} {fill.region} · {Math.round(fill.count)}
        </div>
      </Html>
    </group>
  );
}

/**
 * The 3D region bins (S1.9): one tower per region, filled from the log. Survivors
 * fly in on `route` and each tower lights and grows on `accumulate`; at the end of
 * the run the heights are exactly the engine's grouping counts (== oracle, AC2).
 */
export function RegionBins() {
  const { bins } = useScene();

  return (
    <>
      {bins.map((fill) => (
        <BinTower key={fill.region} fill={fill} />
      ))}
    </>
  );
}
