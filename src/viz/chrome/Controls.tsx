"use client";

import { useAppStore } from "@/store/appStore";
import styles from "./chrome.module.css";

/**
 * Pipeline configuration controls (S2.4, spec §7): the **slice selector** (A
 * grouping ⇄ B short-circuit) and, in Slice B, the **`findFirst` ⇄ `findAny`
 * terminal toggle**. Each control calls the store's config action, which re-runs the
 * *real engine*, swaps in a fresh frozen log, and resets the playhead (R3 / S0.7) —
 * so a toggle genuinely rebuilds the pipeline and its trace, never a viz hack (AC1,
 * AC2). Sequentially `findFirst` and `findAny` produce identical playback (AC3); the
 * toggle is here so Slice B can still expose the distinction the parallel epics use.
 *
 * Segmented native `<button>`s with `aria-pressed` reflecting the current selection,
 * grouped and labelled, so the controls are keyboard-drivable and screen-reader
 * legible (the DoD a11y bar). The terminal toggle appears only in Slice B, where it
 * has meaning.
 */
export function Controls() {
  const slice = useAppStore((s) => s.config.slice);
  const terminal = useAppStore((s) => s.config.terminal);
  const setSlice = useAppStore((s) => s.setSlice);
  const setTerminal = useAppStore((s) => s.setTerminal);

  return (
    <div className={styles.controls} role="group" aria-label="Pipeline configuration">
      <div className={styles.segmented} role="group" aria-label="Slice">
        <span className={styles.segLabel}>Slice</span>
        <button
          className={slice === "A" ? styles.segOn : styles.segOff}
          aria-pressed={slice === "A"}
          onClick={() => setSlice("A")}
        >
          A · grouping
        </button>
        <button
          className={slice === "B" ? styles.segOn : styles.segOff}
          aria-pressed={slice === "B"}
          onClick={() => setSlice("B")}
        >
          B · short-circuit
        </button>
      </div>

      {slice === "B" && (
        <div className={styles.segmented} role="group" aria-label="Terminal">
          <span className={styles.segLabel}>Terminal</span>
          <button
            className={terminal === "findFirst" ? styles.segOn : styles.segOff}
            aria-pressed={terminal === "findFirst"}
            onClick={() => setTerminal("findFirst")}
          >
            findFirst
          </button>
          <button
            className={terminal === "findAny" ? styles.segOn : styles.segOff}
            aria-pressed={terminal === "findAny"}
            onClick={() => setTerminal("findAny")}
          >
            findAny
          </button>
        </div>
      )}
    </div>
  );
}
