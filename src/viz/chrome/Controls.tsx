"use client";

import { useAppStore } from "@/store/appStore";
import styles from "./chrome.module.css";

/**
 * Pipeline configuration controls (S2.4 + S3.6 + S4.4, spec §7): the **slice
 * selector** (A grouping ⇄ B short-circuit), the Slice-B **`findFirst` ⇄ `findAny`
 * toggle**, the **mode** (sequential ⇄ multithread), the **2/4 thread selector**, and a
 * **seed** control. Every control calls the store's config action, which re-runs the
 * *real engine*, swaps in a fresh frozen log, and resets the playhead (R3 / S0.7) — so
 * switching mode/threads/seed genuinely rebuilds the pipeline trace, never a viz hack
 * (AC1). The sequential path is untouched (AC2), and changing the seed re-interleaves
 * the lanes (AC3) while the merged result stays invariant.
 *
 * S4.4: in Slice B **parallel** the `findFirst`/`findAny` toggle re-runs the racer
 * (`runParallelFind`) on the *same seed*, so the canonical interview contrast —
 * ordered wait+cancel vs first-lane-home — is visible side-by-side (Decision 31). The
 * "ordered vs first-home" hint marks that this toggle now diverges (it is identical
 * sequentially). The seed persists across the toggle, so the comparison is same-seed.
 *
 * Segmented native `<button>`s with `aria-pressed`, grouped and labelled, so the
 * controls are keyboard-drivable and screen-reader legible (the DoD a11y bar). The
 * thread + seed controls appear only in multithread mode, where they have meaning.
 */
export function Controls() {
  const slice = useAppStore((s) => s.config.slice);
  const terminal = useAppStore((s) => s.config.terminal);
  const mode = useAppStore((s) => s.config.mode);
  const threadCount = useAppStore((s) => s.config.threadCount);
  const seed = useAppStore((s) => s.config.seed);
  const setSlice = useAppStore((s) => s.setSlice);
  const setTerminal = useAppStore((s) => s.setTerminal);
  const setMode = useAppStore((s) => s.setMode);
  const setThreads = useAppStore((s) => s.setThreads);
  const setSeed = useAppStore((s) => s.setSeed);

  const parallel = mode === "parallel";

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
          {parallel && (
            // Sequentially the two are identical; in parallel they diverge — findFirst
            // holds out for the encounter-order-earliest match, findAny takes the first
            // lane home. The hint marks where that A/B contrast lives (S4.4).
            <span className={styles.hint}>ordered vs first-home</span>
          )}
        </div>
      )}

      <div className={styles.segmented} role="group" aria-label="Mode">
        <span className={styles.segLabel}>Mode</span>
        <button
          className={!parallel ? styles.segOn : styles.segOff}
          aria-pressed={!parallel}
          onClick={() => setMode("sequential")}
        >
          sequential
        </button>
        <button
          className={parallel ? styles.segOn : styles.segOff}
          aria-pressed={parallel}
          onClick={() => setMode("parallel")}
        >
          multithread
        </button>
      </div>

      {parallel && (
        <>
          <div className={styles.segmented} role="group" aria-label="Threads">
            <span className={styles.segLabel}>Threads</span>
            <button
              className={threadCount === 2 ? styles.segOn : styles.segOff}
              aria-pressed={threadCount === 2}
              onClick={() => setThreads(2)}
            >
              2
            </button>
            <button
              className={threadCount === 4 ? styles.segOn : styles.segOff}
              aria-pressed={threadCount === 4}
              onClick={() => setThreads(4)}
            >
              4
            </button>
          </div>

          <div className={styles.segmented} role="group" aria-label="Seed">
            <span className={styles.segLabel}>Seed {seed}</span>
            <button className={styles.segOff} onClick={() => setSeed(seed + 1)} aria-label="New seed">
              ↻ reseed
            </button>
          </div>
        </>
      )}
    </div>
  );
}
