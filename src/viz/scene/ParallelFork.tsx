"use client";

import { useAppStore } from "@/store/appStore";
import { CONDUIT_NODES, stageX } from "../geometry";
import { activeLaneSpike, forkLayout } from "../parallel";

/**
 * The forked lane conduits (S3.4): when the current log is a *parallel* run, the
 * source splits into N lane-conduits — each a copy of `source → filter → map →
 * terminal` at its own y — and the one active lane shows its retrograde `lane-demand`
 * spike (or forward pulse). Everything is a pure read of the projection
 * (`forkLayout` + `activeLaneSpike`), so the fork geometry is driven by the `fork`
 * split tree and at most one spike is ever in flight per lane (spec §3.6, S3.4 AC3).
 *
 * Renders nothing for a sequential log (no `fork` ⇒ empty layout), so the sequential
 * chassis is untouched. R3F components aren't unit-tested (jsdom has no WebGL); the
 * guardrails live in `parallel-fork.test.ts` against the same pure functions.
 */
export function ParallelFork() {
  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  const lanes = forkLayout(log);
  if (lanes.length === 0) return null;

  const spike = activeLaneSpike(log, playhead, { reducedMotion });
  const fromX = stageX("source");
  const toX = stageX("terminal");
  const midX = (fromX + toX) / 2;
  const length = Math.abs(toX - fromX);

  return (
    <>
      {lanes.map((lane) => (
        <group key={lane.lane} position={[0, lane.y, 0]}>
          {/* the lane's axon — a faint copy of the conduit trunk */}
          <mesh position={[midX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, length, 8]} />
            <meshStandardMaterial color="#1c2740" emissive="#16305e" emissiveIntensity={0.4} />
          </mesh>
          {/* the lane's stage nodes */}
          {CONDUIT_NODES.map((node) => (
            <mesh key={node.id} position={[node.x, 0, 0]}>
              <sphereGeometry args={[0.16, 12, 12]} />
              <meshStandardMaterial color="#26324c" emissive="#0b1a33" emissiveIntensity={0.5} />
            </mesh>
          ))}
        </group>
      ))}

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
    </>
  );
}
