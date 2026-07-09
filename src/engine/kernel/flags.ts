/**
 * Stream op **flags** (S0.5, spec §4) — the JDK's `StreamOpFlag` set, pared to the
 * four characteristics the Slice pipelines actually reason over:
 *
 *   - `STATEFUL`      — the op must see elements it has already seen to produce a
 *                       result (`sorted`, `distinct`, `groupingBy`'s accumulate).
 *                       The sequential runner treats every op as one-pass today;
 *                       the flag is plumbed so the parallel scheduler (S3.1) can
 *                       refuse to split a stateful barrier.
 *   - `SHORT_CIRCUIT` — the op can end traversal before the source is exhausted
 *                       (`findFirst`/`findAny`, `limit`). This is the load-bearing
 *                       one for the runner: it selects the *cancellable* pull loop
 *                       (checks `cancellationRequested()` between demands) so the
 *                       "remaining source goes dark, never pulled" wow (spec §3.1)
 *                       is real, not scripted. Exercised for real in E2.
 *   - `ORDERED`       — encounter order is significant (it is, for `findFirst` and
 *                       the whole single-file heartbeat). The array source sets it.
 *   - `SIZED`         — the source's element count is exactly known up front, so
 *                       `Sink.begin(size)` can pre-size a bin. The array source is
 *                       SIZED; a `filter` downstream clears it (S1.1).
 *
 * Modeled as a **bitmask** (`FlagSet`) exactly as the JDK packs op characteristics
 * into an `int`, so a pipeline's combined flags are one `|` of its ops' flags and a
 * check is one `&`. Kept far simpler than `StreamOpFlag`'s three-domain
 * set/clear/preserve encoding — the MVP never needs to *clear* an upstream flag
 * mid-chain except SIZED at `filter`, which S1.1 handles explicitly.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */

/**
 * The four op characteristics as single-bit masks. Declared as a `const` object
 * (not a TS `enum`) so it is both the runtime source of truth and, via
 * {@link OpFlag}, the compile-time type — and so {@link FLAG_NAMES} can iterate it.
 */
export const OpFlag = {
  STATEFUL: 1 << 0,
  SHORT_CIRCUIT: 1 << 1,
  ORDERED: 1 << 2,
  SIZED: 1 << 3,
} as const;

/** One of the four flag bits — `OpFlag.STATEFUL | OpFlag.SHORT_CIRCUIT | …`. */
export type OpFlag = (typeof OpFlag)[keyof typeof OpFlag];

/**
 * A combined set of flags: the bitwise-OR of zero or more {@link OpFlag} bits. A
 * distinct name from {@link OpFlag} because the runner reasons over *sets* (a
 * pipeline's flags), not individual bits.
 */
export type FlagSet = number;

/** The empty flag set — an op with no characteristics (e.g. a bare pass-through). */
export const NO_FLAGS: FlagSet = 0;

/**
 * Combine flags into one set: `combineFlags(OpFlag.ORDERED, OpFlag.SIZED)`. Also
 * how the runner folds a pipeline's ops into a single set to test against.
 */
export function combineFlags(...flags: readonly FlagSet[]): FlagSet {
  return flags.reduce((acc, f) => acc | f, NO_FLAGS);
}

/**
 * Does `set` contain `flag`? The single check the runner makes per decision — e.g.
 * `hasFlag(pipelineFlags, OpFlag.SHORT_CIRCUIT)` selects the cancellable loop.
 * Guards against a non-single-bit `flag` so a caller can't accidentally pass a
 * combined set where a single bit is meant (which `&` would answer "true" for on a
 * partial overlap).
 */
export function hasFlag(set: FlagSet, flag: OpFlag): boolean {
  return (set & flag) === flag;
}

/**
 * Every declared bit paired with its name — the source {@link flagNames} filters.
 * `OpFlag` is declared in ascending bit order (`STATEFUL`=1 … `SIZED`=8) and
 * `Object.entries` preserves insertion order, so this is already bit-ascending; no
 * sort is needed (and adding one would be a no-op). Keep the declaration ordered.
 */
const FLAG_ENTRIES = Object.entries(OpFlag) as readonly (readonly [string, OpFlag])[];

/**
 * The names of the flags present in `set`, in a stable bit order — for readable
 * assertions and any debug/step-list rendering (never for golden bytes; goldens
 * carry structured events, not flag prose). `flagNames(OpFlag.ORDERED | OpFlag.SIZED)`
 * → `["ORDERED", "SIZED"]`.
 */
export function flagNames(set: FlagSet): readonly string[] {
  return FLAG_ENTRIES.filter(([, bit]) => hasFlag(set, bit)).map(([name]) => name);
}
