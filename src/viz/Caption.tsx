"use client";

import { useAppStore } from "@/store/appStore";
import { captionFor } from "./projection";
import { forkLayout, parallelCaptionFor } from "./parallel";

/**
 * The beat caption (S1.5) — a DOM overlay (non-conduit UI stays DOM, spec §3.1)
 * naming what the conduit is doing right now: `spliterator.tryAdvance()` while the
 * demand spike travels, or the active stage while the pulse flies. Pure read of the
 * store's `(log, playhead)`; `aria-live` so a screen reader announces each beat
 * (the a11y path S1.11 leans on).
 */
export function Caption() {
  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  // A parallel run (has a `fork`) narrates its own beats — fork, lane pulls, combine.
  const caption =
    forkLayout(log).length > 0 ? parallelCaptionFor(log, playhead) : captionFor(log, playhead);

  return (
    <output
      aria-live="polite"
      style={{
        position: "absolute",
        left: "50%",
        bottom: "1.25rem",
        transform: "translateX(-50%)",
        padding: "0.4rem 0.9rem",
        borderRadius: "999px",
        background: "rgba(8, 12, 22, 0.72)",
        border: "1px solid rgba(90, 120, 180, 0.35)",
        color: "#cfe0ff",
        font: "500 0.85rem ui-monospace, SFMono-Regular, Menlo, monospace",
        letterSpacing: "0.01em",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        opacity: caption ? 1 : 0,
        transition: "opacity 160ms ease",
      }}
    >
      {caption || " "}
    </output>
  );
}
