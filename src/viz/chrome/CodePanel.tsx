"use client";

import { useAppStore } from "@/store/appStore";
import { type Config } from "@/engine/run";
import { activeStageFor, type PipelineStage } from "../transport";
import styles from "./chrome.module.css";

/** One source line and the pipeline stage that highlights it. */
interface CodeLine {
  readonly stage: PipelineStage;
  readonly code: string;
}

/** The shared `filter → map` head both slices run before their terminal. */
const HEAD: readonly CodeLine[] = [
  { stage: "source", code: "orders.stream()" },
  { stage: "filter", code: "    .filter(o -> o.total > 100)" },
  { stage: "map", code: "    .map(Order::applyDiscount)" },
];

/**
 * The pipeline source for a config (S2.4). Slice A ends in the grouping collector;
 * Slice B ends in the selected short-circuit terminal (`findFirst()` / `findAny()`).
 * The terminal line keeps the `"collect"` stage key so it lights on that slice's
 * terminal events — `route`/`accumulate` for A, `found`/`shortcircuit` for B — via
 * the same `activeStageFor` mapping. So the panel always shows the *actual* pipeline
 * the engine just ran, and the right line lights as it runs.
 */
function linesFor(slice: Config["slice"], terminal: Config["terminal"]): readonly CodeLine[] {
  const terminalLine: CodeLine =
    slice === "A"
      ? { stage: "collect", code: "    .collect(groupingBy(Order::region))" }
      : { stage: "collect", code: `    .${terminal}()` };
  return [...HEAD, terminalLine];
}

/**
 * The code panel (S1.10 → S2.4, spec §7): the pipeline source with the **active op
 * line highlighted** to match the current event (AC3). It now rebuilds its lines
 * from the store's `config` so the source tracks the selected slice/terminal — the
 * whole panel is a pure read of `(config, log, playhead)`.
 */
export function CodePanel() {
  const slice = useAppStore((s) => s.config.slice);
  const terminal = useAppStore((s) => s.config.terminal);
  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  const active = activeStageFor(log, playhead);
  const lines = linesFor(slice, terminal);

  return (
    <pre className={styles.code} aria-label="Pipeline source">
      {lines.map((line) => {
        const isActive = active === line.stage;
        return (
          <code
            key={line.code}
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
