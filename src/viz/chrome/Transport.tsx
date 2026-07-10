"use client";

import { useAppStore } from "@/store/appStore";
import { currentEventIndex, stepIndex } from "../transport";
import styles from "./chrome.module.css";

/**
 * Playback transport (S1.10, spec §7): play/pause · step (one event per press) ·
 * bidirectional scrub keyed to event indices · speed. It only ever reads the log
 * and moves the playhead / play-state — never mutates the log. All controls are
 * native (button / range / select), so they are keyboard-drivable and screen-
 * reader-labelled out of the box (AC5). Icons are Material Symbols; every control
 * carries an `aria-label` so meaning never depends on the glyph.
 */
export function Transport() {
  const length = useAppStore((s) => s.eventLog.length);
  const playhead = useAppStore((s) => s.playhead);
  const playing = useAppStore((s) => s.playing);
  const speed = useAppStore((s) => s.speed);
  const setPlayhead = useAppStore((s) => s.setPlayhead);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const setSpeed = useAppStore((s) => s.setSpeed);

  const last = Math.max(0, length - 1);
  const index = currentEventIndex(playhead, length);

  const step = (direction: 1 | -1) => {
    setPlaying(false); // stepping is a deliberate pause-and-advance
    setPlayhead(stepIndex(playhead, length, direction));
  };

  const playPause = () => {
    if (!playing && index >= last) {
      setPlayhead(0); // at the end ⇒ replay from the top
      setPlaying(true);
    } else {
      setPlaying(!playing);
    }
  };

  return (
    <div className={styles.transport} role="group" aria-label="Playback transport">
      <button className={styles.iconBtn} onClick={() => step(-1)} aria-label="Step back one event">
        <span className="material-symbols-outlined" aria-hidden>
          skip_previous
        </span>
      </button>
      <button
        className={styles.iconBtn}
        onClick={playPause}
        aria-label={playing ? "Pause" : "Play"}
        aria-pressed={playing}
      >
        <span className="material-symbols-outlined" aria-hidden>
          {playing ? "pause" : "play_arrow"}
        </span>
      </button>
      <button className={styles.iconBtn} onClick={() => step(1)} aria-label="Step forward one event">
        <span className="material-symbols-outlined" aria-hidden>
          skip_next
        </span>
      </button>

      <input
        className={styles.scrub}
        type="range"
        min={0}
        max={last}
        step={0.001}
        value={Math.min(Math.max(playhead, 0), last)}
        aria-label="Scrub timeline"
        aria-valuetext={`event ${index + 1} of ${length}`}
        onChange={(e) => {
          setPlaying(false);
          setPlayhead(Number(e.target.value));
        }}
      />
      <span className={styles.counter} aria-hidden>
        {index + 1}/{length}
      </span>

      <label className={styles.speed}>
        <span className="material-symbols-outlined" aria-hidden>
          speed
        </span>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          aria-label="Playback speed"
        >
          <option value={2}>0.5×</option>
          <option value={4}>1×</option>
          <option value={8}>2×</option>
          <option value={16}>4×</option>
        </select>
      </label>
    </div>
  );
}
