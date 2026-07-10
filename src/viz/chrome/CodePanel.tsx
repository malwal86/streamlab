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

/** The shared `filter → map` head both slices run after the source. */
const HEAD: readonly CodeLine[] = [
  { stage: "filter", code: "    .filter(o -> o.total > 100)" },
  { stage: "map", code: "    .map(Order::applyDiscount)" },
];

/**
 * The pipeline source for a config (S2.4 → S4.4). The source line is
 * `stream()` sequentially and `parallelStream()` under multithread — so the panel
 * names the actual traversal the engine ran, the very thing that makes `findFirst` ≠
 * `findAny` (parallel) rather than identical (sequential). Slice A ends in the grouping
 * collector; Slice B ends in the selected short-circuit terminal (`findFirst()` /
 * `findAny()`). The terminal line keeps the `"collect"` stage key so it lights on that
 * slice's terminal events — `route`/`accumulate` for A, `found`/`shortcircuit`/`cancel`
 * for B — via the same `activeStageFor` mapping.
 */
function linesFor(
  slice: Config["slice"],
  terminal: Config["terminal"],
  mode: Config["mode"],
): readonly CodeLine[] {
  const sourceLine: CodeLine = {
    stage: "source",
    code: mode === "parallel" ? "orders.parallelStream()" : "orders.stream()",
  };
  const terminalLine: CodeLine =
    slice === "A"
      ? { stage: "collect", code: "    .collect(groupingBy(Order::region))" }
      : { stage: "collect", code: `    .${terminal}()` };
  return [sourceLine, ...HEAD, terminalLine];
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
  const mode = useAppStore((s) => s.config.mode);
  const log = useAppStore((s) => s.eventLog);
  const playhead = useAppStore((s) => s.playhead);
  const active = activeStageFor(log, playhead);
  const lines = linesFor(slice, terminal, mode);

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
