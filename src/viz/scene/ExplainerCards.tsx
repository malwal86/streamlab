"use client";

import { Html } from "@react-three/drei";
import { useAppStore } from "@/store/appStore";
import { nodePosition } from "../geometry";
import { explainerFor } from "../explainers";

/**
 * The explainer card overlay (S5.3): a DOM card anchored above the neuron for the
 * current beat's stage, showing the Java operation and its live values. It is `Html`
 * (DOM, not WebGL — AC2) positioned at the stage's world coordinate, so it rides
 * beside its neuron as the orbit moves. Content is the pure {@link explainerFor}
 * read of `(log, playhead)`, so the card is event-timed and accurate (AC1/AC3).
 *
 * Accessibility (AC4): the card is a focusable `role="note"` (keyboard-reachable) and
 * an `aria-live` region so a screen reader announces each beat's explanation; it is
 * plain DOM text with no motion dependence, so it reads identically under reduced
 * motion. Rendered above the anchor with a small offset so it never occludes the
 * pulse passing through the neuron.
 */
export function ExplainerCards() {
  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  const card = explainerFor(log, playhead);

  if (!card) return null;

  const [x, y, z] = nodePosition(card.stage);

  return (
    <Html center position={[x, y + 1.9, z]} distanceFactor={14} zIndexRange={[20, 0]}>
      <div
        role="note"
        tabIndex={0}
        aria-live="polite"
        aria-label={`${card.title}. ${card.body}`}
        style={{
          width: "17rem",
          padding: "0.55rem 0.75rem",
          borderRadius: "0.6rem",
          background: "rgba(8, 12, 22, 0.86)",
          border: "1px solid rgba(90, 120, 180, 0.4)",
          color: "#dce7ff",
          textAlign: "left",
          boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            font: "600 12px ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "#8fb4ff",
            marginBottom: "0.25rem",
          }}
        >
          {card.title}
        </div>
        <div style={{ font: "500 13px ui-sans-serif, system-ui, sans-serif", lineHeight: 1.35 }}>
          {card.body}
        </div>
      </div>
    </Html>
  );
}
