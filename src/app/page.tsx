"use client";

import dynamic from "next/dynamic";
import styles from "./page.module.css";
import { Caption } from "@/viz/Caption";
import { Transport } from "@/viz/chrome/Transport";
import { CodePanel } from "@/viz/chrome/CodePanel";
import { StepList } from "@/viz/chrome/StepList";

// The WebGL canvas is dynamically imported with `ssr: false` so three.js never
// runs during (static) prerender — the conduit is a client-only concern.
const ConduitCanvas = dynamic(() => import("@/viz/ConduitCanvas"), {
  ssr: false,
  loading: () => <div className={styles.canvasFallback} aria-hidden />,
});

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>StreamLab</h1>
        <p className={styles.tagline}>
          A neural network wired backwards — the consumer drives the producer.
        </p>
      </header>

      <div className={styles.workspace}>
        <section className={styles.stage} aria-label="Neural conduit stage">
          <div className={styles.canvasWrap}>
            <ConduitCanvas />
            <Caption />
          </div>
          <Transport />
        </section>

        <aside className={styles.sidebar} aria-label="Pipeline and event log">
          <CodePanel />
          <StepList />
        </aside>
      </div>
    </main>
  );
}
