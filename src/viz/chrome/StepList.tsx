"use client";

import { useEffect, useRef } from "react";
import { summarizeEvent } from "@/engine/domain/event";
import { useAppStore } from "@/store/appStore";
import { currentEventIndex } from "../transport";
import styles from "./chrome.module.css";

/**
 * The event-log step-list (S1.10, spec §7): one row per event, `summarizeEvent`
 * rendered line-by-line, with the current event highlighted and scrolled into view
 * (AC4). It mirrors the log the viz replays — and it is the reduced-motion carrier
 * (S1.11): the whole Slice A story is followable from this list alone, no animation.
 * The current row is `aria-current` so a screen reader can track the beat.
 */
export function StepList() {
  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  const index = currentEventIndex(playhead, log.length);
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    // Guarded: jsdom (tests) does not implement scrollIntoView.
    activeRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [index]);

  return (
    <ol className={styles.stepList} aria-label="Event log">
      {log.map((event, i) => {
        const isActive = i === index;
        return (
          <li
            key={i}
            ref={isActive ? activeRef : undefined}
            className={isActive ? styles.stepActive : styles.step}
            aria-current={isActive || undefined}
          >
            <span className={styles.stepTick}>{event.tick}</span>
            <span className={styles.stepText}>{summarizeEvent(event)}</span>
          </li>
        );
      })}
    </ol>
  );
}
