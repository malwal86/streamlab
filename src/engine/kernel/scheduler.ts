/**
 * The deterministic tick scheduler (S3.1, spec §4 parallel / Decision 6/9/13) — the
 * seeded interleaving of the lanes' beats. Real threads are never used: parallelism
 * is *simulated* as a single totally-ordered event log whose lane beats are woven
 * together in a **reproducible** order. Given `(seed, threadCount)` the interleaving
 * is byte-identical on every run and machine (AC1); a *different* seed produces a
 * *different* interleaving (AC6, the non-determinism the multithread demo shows),
 * while the partition itself never changes (split.ts owns that).
 *
 * The schedule is a sequence of lane indices — lane `i` appears exactly `counts[i]`
 * times, once per element it will pull. Consuming a lane's beats front-to-back as
 * its index comes up preserves **encounter order within each lane** (the single-file
 * invariant per lane, AC4); only *which lane advances next* is seeded. The order is a
 * seeded Fisher-Yates shuffle of that multiset, driven by a small deterministic PRNG
 * — enough to demonstrate non-determinism without pulling in a dependency or any
 * wall-clock entropy (which would break goldens).
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */

/**
 * `mulberry32` — a tiny, well-distributed 32-bit PRNG. Deterministic from `seed`
 * (same seed ⇒ same stream), fast, and dependency-free. Used only to order the
 * schedule; the engine's *outcomes* never depend on it (the partition and the merged
 * bins are seed-independent), so this is entropy for interleaving alone.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build the interleaving schedule from per-lane beat `counts` and a `seed`.
 *
 * Returns a sequence of lane indices in which lane `i` occurs `counts[i]` times —
 * the order lanes are serviced, one element-beat each. A seeded Fisher-Yates
 * shuffle of the multiset `[0×counts[0], 1×counts[1], …]`, so:
 *
 *   - deterministic given `(counts, seed)` (AC1),
 *   - varies with `seed` (AC6), and
 *   - order-preserving *within* a lane regardless — the caller pops each lane's
 *     beats in encounter order, so a lane's elements never reorder (AC4).
 */
export function buildSchedule(counts: readonly number[], seed: number): number[] {
  const schedule: number[] = [];
  counts.forEach((count, lane) => {
    for (let i = 0; i < count; i += 1) schedule.push(lane);
  });

  // Seeded Fisher-Yates: deterministic permutation of the lane multiset.
  const rand = mulberry32(seed);
  for (let i = schedule.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = schedule[i]!;
    schedule[i] = schedule[j]!;
    schedule[j] = tmp;
  }
  return schedule;
}
