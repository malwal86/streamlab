"use client";

import { Html } from "@react-three/drei";
import { useAppStore } from "@/store/appStore";
import { CONDUIT_NODES, stageX } from "../geometry";
import { regionGlyph, regionHue } from "../encoding";
import {
  activeLaneSpike,
  cancelledLanes,
  forkLayout,
  parallelFoundLatch,
  type ParallelFoundLatch,
} from "../parallel";

/**
 * The forked lane conduits (S3.4 → S4.3): when the current log is a *parallel* run, the
 * source splits into N lane-conduits — each a copy of `source → filter → map →
 * terminal` at its own y — and the one active lane shows its retrograde `lane-demand`
 * spike (or forward pulse). In Slice B the lanes race to a short-circuit: a **dark
 * cancellation wavefront** dims the lanes the engine cancelled, and a "FOUND" latch
 * rings the winning lane's terminal. Everything is a pure read of the projection
 * (`forkLayout` + `activeLaneSpike` + `cancelledLanes` + `parallelFoundLatch`), so the
 * dimmed set is *exactly* the engine's `cancel` events (S4.3 AC1) and the latch is
 * *exactly* its `found` (AC2) — never a viz guess.
 *
 * Renders nothing for a sequential log (no `fork` ⇒ empty layout), so the sequential
 * chassis is untouched. R3F components aren't unit-tested (jsdom has no WebGL); the
 * guardrails live in `parallel-fork.test.ts` / `cancellation-wavefront.test.ts` against
 * the same pure functions.
 */
export function ParallelFork() {
  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  const lanes = forkLayout(log);
  if (lanes.length === 0) return null;

  const spike = activeLaneSpike(log, playhead, { reducedMotion });
  const cancelled = cancelledLanes(log, playhead);
  const latch = parallelFoundLatch(log, playhead);
  const fromX = stageX("source");
  const toX = stageX("terminal");
  const midX = (fromX + toX) / 2;
  const length = Math.abs(toX - fromX);

  return (
    <>
      {lanes.map((lane) => {
        // A cancelled lane goes dark — the wavefront swept it (spec §3.4, S4.3).
        const dark = cancelled.has(lane.lane);
        return (
          <group key={lane.lane} position={[0, lane.y, 0]}>
            {/* the lane's axon — a faint copy of the conduit trunk */}
            <mesh position={[midX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.02, 0.02, length, 8]} />
              <meshStandardMaterial
                color={dark ? "#0f131c" : "#1c2740"}
                emissive={dark ? "#000000" : "#16305e"}
                emissiveIntensity={dark ? 0 : 0.4}
                transparent
                opacity={dark ? 0.4 : 1}
              />
            </mesh>
            {/* the lane's stage nodes */}
            {CONDUIT_NODES.map((node) => (
              <mesh key={node.id} position={[node.x, 0, 0]}>
                <sphereGeometry args={[0.16, 12, 12]} />
                <meshStandardMaterial
                  color={dark ? "#141821" : "#26324c"}
                  emissive={dark ? "#000000" : "#0b1a33"}
                  emissiveIntensity={dark ? 0 : 0.5}
                  transparent
                  opacity={dark ? 0.4 : 1}
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {spike && (
        <mesh position={[spike.x, spike.y, 0]}>
          <sphereGeometry args={[spike.kind === "demand" ? 0.13 : 0.22, 14, 14]} />
          <meshStandardMaterial
            color={spike.kind === "demand" ? "#2c4a66" : "#7fd4ff"}
            emissive={spike.kind === "demand" ? "#3d63a8" : "#4aa8ff"}
            emissiveIntensity={spike.kind === "demand" ? 0.9 : 1.6}
            transparent
            opacity={spike.kind === "demand" ? 0.5 : 1}
          />
        </mesh>
      )}

      {latch && <LaneLatchBadge latch={latch} y={laneY(lanes, latch.lane)} />}
    </>
  );
}

/** The y-offset of a lane conduit, or 0 if the lane is unknown (defensive). */
function laneY(lanes: readonly { lane: string; y: number }[], lane: string): number {
  return lanes.find((l) => l.lane === lane)?.y ?? 0;
}

/**
 * The winning lane's "FOUND" latch (S4.3) — the parallel echo of the sequential
 * {@link FoundLatch}. Rings the winner lane's terminal and badges the matched element
 * (glyph + id + region + discounted total), riding the lane's own y so the payoff sits
 * on the conduit that actually matched. Region never conveyed by color alone (AC / spec
 * §3.7): the glyph and region name carry it too.
 */
function LaneLatchBadge({ latch, y }: { latch: ParallelFoundLatch; y: number }) {
  const x = stageX("terminal");
  const hue = regionHue(latch.region);

  return (
    <group position={[x, y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.7, 0.07, 16, 48]} />
        <meshStandardMaterial color={hue} emissive={hue} emissiveIntensity={3.2} toneMapped={false} />
      </mesh>
      <Html
        center
        position={[0, 1.15, 0]}
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
        FOUND · {latch.lane} · {regionGlyph(latch.region)} #{latch.elementId} · {latch.region} $
        {Math.round(latch.total)}
      </Html>
    </group>
  );
}
