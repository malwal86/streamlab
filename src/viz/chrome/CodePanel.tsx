"use client";

import { useAppStore } from "@/store/appStore";
import { activeStageFor, type PipelineStage } from "../transport";
import styles from "./chrome.module.css";

/** The Slice A pipeline, one line per stage — the line highlighted as it runs. */
const LINES: readonly { stage: PipelineStage; code: string }[] = [
  { stage: "source", code: "orders.stream()" },
  { stage: "filter", code: "    .filter(o -> o.total > 100)" },
  { stage: "map", code: "    .map(Order::applyDiscount)" },
  { stage: "collect", code: "    .collect(groupingBy(Order::region))" },
];

/**
 * The code panel (S1.10, spec §7): the pipeline source with the **active op line
 * highlighted** to match the current event (AC3). The highlight is a pure read of
 * `activeStageFor(log, playhead)`, so it always tracks what the engine is doing at
 * the playhead — scrub anywhere and the right line lights.
 */
export function CodePanel() {
  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  const active = activeStageFor(log, playhead);

  return (
    <pre className={styles.code} aria-label="Pipeline source">
      {LINES.map((line) => {
        const isActive = active === line.stage;
        return (
          <code
            key={line.stage}
            className={isActive ? styles.codeActive : styles.codeLine}
            aria-current={isActive || undefined}
          >
            {line.code}
          </code>
        );
      })}
    </pre>
  );
}
