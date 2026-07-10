import styles from "./landing.module.css";

/**
 * The landing hero (S5.4, spec §1) — the first screen a portfolio visitor sees. Its
 * one job is to make the differentiator land *before* any interaction: a Java stream
 * is a **neural network wired backwards**, where the consumer drives the producer and
 * demand flows *retrograde* from the terminal to the source. The thesis is legible in
 * under ten seconds of reading (AC1); the CTA drops straight into the live demo (AC2).
 *
 * Pure static markup — no client hooks, no engine — so it prerenders into the static
 * export with zero serverless functions (AC3). The CTA is a plain in-page anchor to
 * the `#demo` section, so "entering the demo" needs no JS.
 */
export function Landing() {
  return (
    <section className={styles.landing} aria-label="Introduction">
      <p className={styles.eyebrow}>Portfolio · Java Stream semantics, visualized as a live flow-map</p>

      <h1 className={styles.thesis}>
        A stream pipeline <span className={styles.wiredBack}>wired backwards</span>.
      </h1>

      <p className={styles.lead}>
        In a Java stream the <strong>consumer drives the producer</strong>. The terminal operation
        pulls; demand travels <em>backward</em> to the source, which releases one element at a time
        — lazily, only when asked. StreamLab makes that retrograde pull visible as a living
        flow-map.
      </p>

      <p className={styles.differentiator}>
        Nothing here is faked. Every pulse, fork, and short-circuit is a{" "}
        <strong>pure function of a real Java Stream execution log</strong> — the visualization can
        never show an outcome the engine did not actually produce.
      </p>

      <a className={styles.cta} href="#demo">
        Launch the live demo <span aria-hidden>→</span>
      </a>

      <p className={styles.subcta}>
        Sequential &amp; parallel · grouping &amp; short-circuit · plays on load, no setup.
      </p>
    </section>
  );
}
