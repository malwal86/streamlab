"use client";

import { Html } from "@react-three/drei";
import { useAppStore } from "@/store/appStore";
import { BIN_UNIT_HEIGHT, binPosition } from "../geometry";
import { regionGlyph, regionHue } from "../encoding";
import { forkLayout, parallelBins, LANE_Y_SPACING, type LaneBinFill } from "../parallel";
import { type BinFill } from "../projection";

/** A small private partial-bin tower, anchored at a lane's y (S3.5). */
function LaneBinTower({ fill, y, fade }: { fill: LaneBinFill; y: number; fade: number }) {
  const [x, , z] = binPosition(fill.region);
  const hue = regionHue(fill.region);
  const height = Math.max(fill.count * BIN_UNIT_HEIGHT, 0.001);
  if (fill.count <= 0) return null;

  return (
    <mesh position={[x, y + height / 2, z]}>
      <boxGeometry args={[0.5, height, 0.5]} />
      <meshStandardMaterial
        color={hue}
        emissive={hue}
        emissiveIntensity={0.25}
        transparent
        opacity={0.75 * fade}
      />
    </mesh>
  );
}

/** The merged tower (S3.5): the final grouping the combiner produced, centered on the axis. */
function MergedTower({ fill, rise }: { fill: BinFill; rise: number }) {
  const [x, , z] = binPosition(fill.region);
  const hue = regionHue(fill.region);
  const height = Math.max(fill.count * BIN_UNIT_HEIGHT * rise, 0.001);
  const lit = 0.2 + Math.min(fill.count, 4) * 0.35;

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[1.1, 0.04, 1.1]} />
        <meshStandardMaterial color="#0e1626" emissive={hue} emissiveIntensity={0.12} />
      </mesh>
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
 * The parallel region bins (S3.5): each lane fills its **own** private partial bins
 * (small towers at the lane's y-offset) and, at the `combine` beat, the partials flow
 * together into the merged towers on the central axis — captioned "combiner merges
 * partial maps". Pure read of `parallelBins(log, playhead)`: the partials are private
 * until combine, and the merged towers equal the engine result == oracle (AC1/AC2).
 * The partials fade out as `mergeProgress → 1`; the merged towers rise in.
 */
export function ParallelBins() {
  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  const lanes = forkLayout(log);
  if (lanes.length === 0) return null;

  const { perLane, merged, mergeProgress } = parallelBins(log, playhead, { reducedMotion });
  const yByLane = new Map(lanes.map((l) => [l.lane, l.y]));
  // Partials sit slightly forward per lane and fade as the merge completes.
  const partialFade = merged ? 1 - mergeProgress : 1;

  return (
    <>
      {partialFade > 0.01 &&
        perLane.map((fill) => (
          <LaneBinTower
            key={`${fill.lane}-${fill.region}`}
            fill={fill}
            y={(yByLane.get(fill.lane) ?? 0) + LANE_Y_SPACING * 0.5}
            fade={partialFade}
          />
        ))}
      {merged?.map((fill) => (
        <MergedTower key={fill.region} fill={fill} rise={Math.max(mergeProgress, 0.02)} />
      ))}
    </>
  );
}
