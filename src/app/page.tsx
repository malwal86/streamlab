"use client";

import dynamic from "next/dynamic";
import styles from "./page.module.css";
import { Landing } from "./Landing";
import { Caption } from "@/viz/Caption";
import { Transport } from "@/viz/chrome/Transport";
import { Controls } from "@/viz/chrome/Controls";
import { CodePanel } from "@/viz/chrome/CodePanel";
import { StepList } from "@/viz/chrome/StepList";
import { useAutoPlay } from "@/viz/flowmap/useAutoPlay";
import { useSyncReducedMotion } from "@/viz/useReducedMotion";

// The flow-map canvas is client-only (it measures the DOM and paints per frame),
// so it is dynamically imported with `ssr: false` — nothing renders during the
// static prerender, just the ground until the client mounts.
const FlowMap = dynamic(() => import("@/viz/flowmap/FlowMap").then((m) => m.FlowMap), {
  ssr: false,
  loading: () => <div className={styles.canvasFallback} aria-hidden />,
});

export default function Home() {
  useSyncReducedMotion(); // mirror prefers-reduced-motion into the store (S1.11)
  useAutoPlay(); // advance the playhead each frame from the pure playback clock (S5.1)

  return (
    <>
      <Landing />

      <main id="demo" className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>StreamLab</h1>
          <p className={styles.tagline}>
            A stream pipeline wired backwards. The terminal pulls, one element at a time.
          </p>
        </header>

        <div className={styles.workspace}>
          <section className={styles.stage} aria-label="Stream pipeline flow-map">
            <div className={styles.canvasWrap}>
              <FlowMap />
              <Caption />
            </div>
            <Transport />
          </section>

          <aside className={styles.sidebar} aria-label="Pipeline and event log">
            <Controls />
            <CodePanel />
            <StepList />
          </aside>
        </div>
      </main>
    </>
  );
}
