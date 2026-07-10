/**
 * Recursive-halving source split (S3.1, spec §3.4 / §4 parallel) — the partition
 * the parallel scheduler forks the source into. Faithful to how
 * `AbstractPipeline.copyInto` reaches `Spliterator.trySplit`: a SIZED array source
 * halves at its midpoint (`mid = origin + ((fence - origin) >>> 1)`, the JDK's
 * `ArraySpliterator.trySplit`), and to reach N lanes the halving recurses `log2(N)`
 * levels deep — a **binary split tree** whose leaves are the lanes, left-to-right.
 *
 * Two things fall out of this and are load-bearing for later stories:
 *
 *   - The lanes are a **true partition**: contiguous, disjoint index ranges whose
 *     union is the whole source (S3.1 AC2). No element is dropped or duplicated, so
 *     merging the per-lane bins (S3.3) can equal the sequential grouping exactly.
 *   - The partition is **seed-independent** — only the *interleaving* (scheduler.ts)
 *     varies with the seed. So the `findFirst` decoy always lands in a *different*
 *     lane than the target under halving (S3.1 technical note, the thing that makes
 *     E4's ordered-wait meaningful), regardless of seed.
 *
 * Emits nothing itself — it is pure geometry over the order list. `parallel.ts`
 * turns the tree into the `fork` event and drives each lane's traversal.
 *
 * Zero React/Next imports (kernel boundary — see `../README.md`).
 */
import { type SplitNode } from "../domain/event";
import { type Order } from "../domain/order";

/** The number of lanes the source forks into — a power of two so halving is exact. */
export type ThreadCount = 2 | 4;

/**
 * One leaf of the split tree: a lane's private partition. `lane` is the lane id
 * (`"L0"`…`"L{N-1}"`, left-to-right leaf order — encounter order across lanes is
 * lane order); `orders` is its slice of the source in encounter order; `range` is
 * the half-open `[origin, fence)` index window it came from (what the disjoint /
 * union partition property is checked over).
 */
export interface LanePartition {
  readonly lane: string;
  readonly orders: readonly Order[];
  readonly range: readonly [number, number];
}

/** The result of a fork: the `fork` event's split tree plus the lanes it names. */
export interface SplitResult {
  readonly tree: SplitNode;
  readonly lanes: readonly LanePartition[];
}

/** `log2` for the two legal lane counts — the depth the halving recurses to. */
function splitDepth(threadCount: ThreadCount): number {
  return threadCount === 2 ? 1 : 2;
}

/**
 * Split `orders` into `threadCount` lanes by recursive halving, returning the
 * binary split tree and the per-lane partitions. Leaves are assigned lane ids
 * `L0…L{N-1}` in left-to-right order, so lane order *is* encounter order across
 * lanes (index ranges ascend), which is why concatenating the lanes' bins in lane
 * order reproduces the sequential encounter order (S3.3).
 *
 * An internal node's `lane` is a cosmetic range label (`"L0-L1"`); only leaf
 * `lane`s match the `lane-demand`/`accumulate` events, so the viz keys geometry off
 * the leaves. `estimatedSize` is the exact remaining count of that sub-range (the
 * array source is SIZED), which the fork animation grows its branches from.
 */
export function splitRecursive(orders: readonly Order[], threadCount: ThreadCount): SplitResult {
  const lanes: LanePartition[] = [];

  function build(origin: number, fence: number, depth: number): SplitNode {
    const estimatedSize = fence - origin;
    if (depth === 0) {
      const lane = `L${lanes.length}`;
      lanes.push({ lane, orders: orders.slice(origin, fence), range: [origin, fence] });
      return { lane, estimatedSize };
    }
    // JDK ArraySpliterator.trySplit: halve at the midpoint, low half splits off.
    const mid = origin + ((fence - origin) >>> 1);
    const left = build(origin, mid, depth - 1);
    const right = build(mid, fence, depth - 1);
    return { lane: `${left.lane}-${right.lane}`, estimatedSize, children: [left, right] };
  }

  const tree = build(0, orders.length, splitDepth(threadCount));
  return { tree, lanes };
}
