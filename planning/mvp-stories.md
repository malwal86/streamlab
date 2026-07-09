# StreamLab MVP — Detailed Story Specifications

> Companion to [`mvp-backlog.md`](./mvp-backlog.md) (the epic/milestone overview) and the source of
> truth [`streamlab-spec.md`](./streamlab-spec.md). This document gives each of the 37 stories a
> **precise, buildable specification**: user story, scope in/out, testable acceptance criteria,
> technical notes, and a TDD test plan.
>
> Read the **Shared Reference** section once; individual stories reference it rather than repeat it.

---

## Shared Reference

### R1. Domain model

```ts
type Region = "West" | "East" | "North" | "South"; // 3–4 regions used

interface Order {
  id: number;            // stable, drives elementId in the event log
  total: number;         // JDK int semantics; spans below/above 100 and the Slice-B target
  region: Region;        // categorical group key → pulse hue
}

// applyDiscount: pure value transform used by `map`. Lowers `total` (drives the size-morph).
declare function applyDiscount(o: Order): Order;
```

**Curated dataset (10–12 orders, 3–4 regions).** Must contain, deterministically:
- at least 2 orders with `total <= 100` (die at filter),
- the **Slice-B `findFirst` target**: the encounter-order-earliest survivor,
- a **decoy survivor after it** in a *different* lane-partition, so parallel `findFirst` must wait +
  cancel rather than accept the first lane home,
- totals large enough that `applyDiscount` produces a visible size change.

The exact fixture is defined in **S0.3** and frozen; all golden snapshots depend on it.

### R2. Event-log contract (the engine↔viz bridge)

Ordered, **immutable** discriminated union. One event per engine callback. Full field set defined in
**S0.4**; kinds (spec §5):

| kind | emitted when | primary payload |
|---|---|---|
| `demand` | terminal requests one element (`tryAdvance`) | — |
| `emit` | source encodes & releases next element | `elementId`, `input` |
| `test` | predicate evaluated at `filter` | `predicate`, `input`, `output: boolean` |
| `survive` | element passed `filter` | `elementId` |
| `die` | element rejected at `filter` | `elementId` |
| `transform` | `map` applied | `before`, `after` |
| `route` | `groupingBy` classifier picks bin | `key: Region` |
| `accumulate` | element added to a (partial) bin | `key`, `lane?`, `binCount` |
| `fork` | source split into lanes | `lanes`, split tree |
| `lane-demand` | per-lane retrograde request | `lane` |
| `combine` | combiner merges partial bins | merged bin state |
| `found` | `findFirst`/`findAny` latched a result | `elementId` |
| `cancel` | lane/work cancelled (short-circuit) | `lane?`, reason |
| `shortcircuit` | traversal ended early | `remainingUnpulled: number` |

Every event carries: `tick: number`, `lane?: string`, `elementId?: number`, `op?: string`,
`nextStage?: string`. **Invariant:** the viz is a *pure function of `(eventLog, playhead)`* — it may
never compute an outcome the log doesn't contain.

### R3. Store shape (Zustand, defined in S0.7)

```ts
interface Config {
  slice: "A" | "B";
  mode: "sequential" | "parallel";
  threadCount: 2 | 4;         // parallel only
  seed: number;               // varies interleaving
  terminal: "findFirst" | "findAny"; // Slice B only
}
interface StoreState {
  config: Config;
  eventLog: readonly EngineEvent[]; // swapped whenever config changes
  playhead: number;                 // fractional; interpolated between events
}
```
`select(log, playhead) → ViewState` is **pure and referentially stable**. Config change ⇒ engine
re-run ⇒ new frozen log ⇒ playhead reset per policy.

### R4. Test conventions (from [`tdd-guidelines.md`](./tdd-guidelines.md))

- **Red first, by a human.** AI implements to a pre-written failing test/property — never both in one
  turn.
- **Oracle equality.** Engine *outcome* `==` native-array reference for every generated case (S0.6).
- **Properties (fast-check).** Listed per story; the load-bearing ones are S4.1 (earliest-index) and
  S3.3 (combiner == sequential).
- **Golden event-log snapshots.** One per **preset × mode** (`seq`, `2-lane`, `4-lane`); regression
  net, never a replacement for properties.
- **Mutation testing (Stryker)** on the engine directory; surviving mutants are triaged.
- **Viz "purity" tests.** Assert the rendered view-state is derivable from the log alone (no hidden
  state, no faked outcomes).

### R5. Story fields (legend)

Each story below has: **Epic/Milestone**, **Depends on**, **User story**, **Description**,
**In scope / Out of scope**, **Acceptance criteria** (numbered, each independently checkable),
**Technical notes**, **Test plan**, **Definition of Done** (DoD = the shared DoD in `mvp-backlog.md`
plus story-specific items).

### R6. Estimation

T-shirt sizes are indicative (S = ≤1 day, M = 1–2 days, L = 2–4 days). Adjust to your team's scale.

---

# EPIC 0 — Foundation & Engine Core  *(spec P0)*  · Milestone M0

---

## S0.1 — Project & deploy scaffold  · **M** · Depends: none

**User story.** As a developer, I want a Next.js (App Router, client-only SPA shell) + TypeScript
project wired to Vercel, so that every later slice has a home and a live URL from commit one.

**Description.** Stand up the repo `streamlab-java-pipeline-visualizer` as a Next.js App Router app
configured as a **static, zero-serverless-function SPA** (no SSR data, no API routes — see spec §2
"Rejected outright: any backend"). Install the render/state stack so no later story is blocked on
dependency setup.

**In scope.** App Router shell; `"use client"` root; TS strict; ESLint + Prettier; path aliases
(`@/engine`, `@/viz`, `@/store`); install `three`, `@react-three/fiber`, `@react-three/drei`,
`@react-three/postprocessing`, `zustand`; a placeholder route that renders a canvas stub; Vercel
project + green preview deploy; static-export/prerender configured so the demo ships with **0
functions**.

**Out of scope.** Any engine, viz, or store logic (later stories).

**Acceptance criteria.**
1. `npm run dev` serves a client-rendered page locally.
2. The build produces **no serverless/edge functions** (verified in Vercel build output).
3. A Vercel **preview deploy is green** and reachable.
4. TS `strict` is on; `lint` passes; path aliases resolve.
5. R3F/drei/postprocessing/zustand are installed and import without error in a smoke component.

**Technical notes.** Prefer `output: "export"` (or fully prerendered client routes) so Vercel serves
static assets only. Keep the WebGL canvas dynamically imported (`ssr: false`) to avoid any SSR of
three.js.

**Test plan.** Smoke test that the placeholder route mounts (React Testing Library); CI runs
`lint` + `build`. No engine tests yet.

**DoD.** Shared DoD + criteria 1–5; deploy URL recorded in the repo README.

---

## S0.2 — Test infrastructure  · **M** · Depends: S0.1

**User story.** As a developer, I want Vitest + fast-check + a golden-snapshot harness + Stryker
configured, so that TDD and mutation testing are one command from story one.

**Description.** Establish the full testing toolchain the DoD (R4) assumes, with a worked red→green
example so conventions are demonstrated, not just documented.

**In scope.** Vitest runner + coverage; `fast-check` wired with a shared arbitraries module stub;
a **golden event-log snapshot helper** with stable, deterministic serialization (sorted keys, no
timestamps, normalized floats); Stryker config scoped to `@/engine`; npm scripts (`test`,
`test:prop`, `test:golden`, `mutation`); CI wiring.

**Out of scope.** Actual engine/domain tests (those live with their stories).

**Acceptance criteria.**
1. A sample unit test runs red then green under Vitest.
2. A sample fast-check property runs and can be seeded for reproduction.
3. The golden helper serializes a hand-built sample log **deterministically** (byte-stable across
   runs/machines).
4. `npm run mutation` executes Stryker against the (currently near-empty) engine target and reports.
5. CI runs unit + property + golden on every push.

**Technical notes.** Golden serialization must be independent of object key order and of any
wall-clock/seed noise so snapshots are meaningful diffs. Store goldens under `engine/__golden__/`.

**Test plan.** The sample tests *are* the deliverable; verify each tool's failure mode (a broken
assertion actually fails CI).

**DoD.** Shared DoD + criteria 1–5.

---

## S0.3 — Domain & value model  · **M** · Depends: S0.1

**User story.** As the engine, I want the `Order` domain, `applyDiscount`, and a tagged-union
`Value` model, so that ops operate on JDK-faithful, primitive-vs-boxed-aware data over a watchable
fixture.

**Description.** Implement R1. Freeze the curated 10–12-order dataset with the boundary properties R1
requires. Implement the `Value` tagged union (primitive `int` vs boxed reference) sufficient for the
`Order` domain and the group key.

**In scope.** `Order`, `Region`, `applyDiscount`, the frozen fixture, the `Value` union + helpers.

**Out of scope.** Ops, spliterator, events.

**Acceptance criteria.**
1. `applyDiscount` is pure and unit-tested (input unchanged, output total strictly lower by the
   defined rule).
2. The fixture contains ≥2 sub-100 orders, the defined `findFirst` target, and a later decoy in a
   different partition half (so recursive-halving places it in another lane — see S3.1).
3. Region cardinality is 3–4; every region has ≥1 surviving order (bins are non-trivial).
4. `Value` distinguishes primitive `int` from boxed reference and round-trips.
5. Fixture is frozen/immutable; mutating attempts throw or are type-errors.

**Technical notes.** Document *why* each order exists (a comment table mapping order → the scenario it
covers) so future edits don't silently break Slice-B parallel semantics.

**Test plan.** Unit tests for `applyDiscount` and `Value`; a fixture-invariant test asserting the
boundary properties in criteria 2–3 (this test guards every downstream golden).

**DoD.** Shared DoD + criteria 1–5; fixture rationale table committed.

---

## S0.4 — Event-log contract types  · **M** · Depends: S0.2, S0.3

**User story.** As the engine↔viz bridge, I want typed immutable event kinds, so the viz is a pure
function of the log and cannot drift.

**Description.** Implement R2 as a discriminated union with kind-specific payloads and the common
fields. Enforce immutability. Provide an exhaustiveness helper so adding a kind forces handling
everywhere.

**In scope.** The 14 event interfaces; the `EngineEvent` union; `readonly`/`Object.freeze` at
emission; an `assertNever` exhaustiveness utility; the golden serializer's awareness of every kind.

**Out of scope.** Emitting events from real ops (S0.5+).

**Acceptance criteria.**
1. All 14 kinds are represented with the payloads in R2.
2. Every event carries `tick`, and `lane?`/`elementId?`/`op?`/`nextStage?` as applicable.
3. A hand-built sample log matching spec §5's example type-checks and round-trips through the golden
   serializer.
4. Removing a `case` in any exhaustive switch is a **compile error**.
5. Events are immutable at runtime (frozen).

**Technical notes.** Match spec §5's example shape exactly for the `test` event so goldens read like
the spec.

**Test plan.** Type-level tests (exhaustiveness fails to compile when a kind is unhandled); a
round-trip golden of the sample log.

**DoD.** Shared DoD + criteria 1–5.

---

## S0.5 — Engine kernel: Spliterator pull + Sink chain + sequential runner  · **L** · Depends: S0.4

**User story.** As the credibility spine, I want a JDK-faithful `Spliterator.tryAdvance(sink)` pull
driving a `Sink` chain (`begin/accept/cancel/end`) with op **flags**, so the terminal pulls one
element at a time and the run emits an ordered immutable event log.

**Description.** Build the pull/push duality that the neural heartbeat renders (spec §4). The
`Spliterator` is *pulled* by the terminal; elements *push* down the `Sink` chain; each op carries
`STATEFUL | SHORT_CIRCUIT | ORDERED | SIZED` flags. The runner records one event per callback.

**In scope.** `Spliterator` (over the fixture), the `Sink` interface + chaining, flag plumbing, a
sequential runner, and event emission wired to `demand`/`emit`/`begin`/`accept`/`end`. Prove with a
pass-through (identity) sink; real ops come in E1.

**Out of scope.** filter/map/collect/find (E1/E2), parallelism (E3).

**Acceptance criteria.**
1. Running identity over the fixture emits a well-formed `demand → emit → … → end` log.
2. **Single-file invariant:** each element is fully resolved (`emit`…downstream) **before** the next
   `demand` — asserted structurally on the log (no two elements interleaved).
3. `demand` **always precedes** the corresponding `emit`.
4. Flags are attached per op and reachable by the runner (used later by short-circuit).
5. Sink lifecycle `begin`/`end` bracket the run; `cancel` path exists (exercised in E2).

**Technical notes.** Keep the kernel **zero-React**. The runner returns a frozen `EngineEvent[]`. Model
`tryAdvance` returning `false` at exhaustion to end traversal.

**Test plan.** Golden of the identity log; property: for any fixture permutation, the single-file and
demand-precedes-emit invariants hold; unit tests on sink lifecycle ordering.

**DoD.** Shared DoD + criteria 1–5; kernel has no imports from React/Next.

---

## S0.6 — Oracle harness  · **M** · Depends: S0.3

**User story.** As a test author, I want a trivially-correct native-array reference, so every
generated case can assert `engine result == oracle`.

**Description.** Implement reference outcomes using plain array ops: `filter` (`total>100`), `map`
(`applyDiscount`), reduce-into-map (`groupingBy(region)`), and encounter-order-first for `find*`.
Provide the fast-check generator for order lists and the equality assertion.

**In scope.** Oracle functions for all built ops' **outcomes** (not events); order-list arbitrary;
`assertEqualsOracle` helper.

**Out of scope.** Any event-log modeling; parallel oracle nuances beyond outcome equality (Slice A
grouping outcome is order-agnostic; used by S3.3).

**Acceptance criteria.**
1. Oracle grouping/filter/map/find match hand-computed expectations on the fixture.
2. The arbitrary generates varied, shrinkable order lists (sizes, regions, totals around boundaries).
3. `assertEqualsOracle` gives readable diffs on failure.
4. Oracle is obviously correct by inspection (no shared code with the engine).

**Technical notes.** Independence is the point: the oracle must not import engine internals, or the
equality test is circular.

**Test plan.** Self-tests pinning oracle outputs on the fixture; a meta-test that a deliberately wrong
engine stub fails `assertEqualsOracle`.

**DoD.** Shared DoD + criteria 1–4.

---

## S0.7 — Zustand store + playhead projection  · **M** · Depends: S0.5

**User story.** As the UI, I want a store holding `config + eventLog + playhead` with a pure
`(log, playhead) → viewState` selector, so render subscribes while the engine stays pure TS.

**Description.** Implement R3. Config changes trigger an engine re-run that swaps in a new frozen log.
The fractional-playhead selector is stubbed here (interpolation lands in S1.5) but must already be
pure and referentially stable.

**In scope.** Store shape + actions (`setSlice/setMode/setThreads/setSeed/setTerminal`), engine-run
trigger on config change, playhead reset policy, the pure selector boundary.

**Out of scope.** Interpolation math (S1.5), transport UI (S1.10).

**Acceptance criteria.**
1. Changing any config field re-runs the engine and swaps `eventLog` (frozen).
2. The selector is pure: same `(log, playhead)` ⇒ referentially stable output.
3. **No React import reaches engine code** (enforced by lint boundary/test).
4. Playhead reset policy on log swap is defined and unit-tested.

**Technical notes.** Add an ESLint import-boundary rule: `@/engine` may not import React/Next/Zustand.

**Test plan.** Store unit tests for each action + reset policy; a boundary test asserting engine files
have no React imports; purity test on the selector.

**DoD.** Shared DoD + criteria 1–4.

---

# EPIC 1 — Slice A Sequential: Grouping  *(P0 ops + P1 viz)*  · Milestone M1

Pipeline: `orders.stream().filter(o -> o.total > 100).map(Order::applyDiscount).collect(groupingBy(Order::region))`

---

## S1.1 — `filter` op (engine)  · **M** · Depends: S0.5, S0.6

**User story.** As the engine, I want `filter(total > 100)` as a `Sink`, so surviving elements
propagate and rejects die at the filter with the predicate's live values visible.

**Description.** A stateless filtering sink emitting `test` (with `input` and `output`), then
`survive` or `die`. Rejects must terminate propagation immediately (spec §3.6: die *at the filter*).

**In scope.** filter sink + its three event kinds; wiring into the S0.5 chain.

**Out of scope.** map/collect; viz.

**Acceptance criteria.**
1. `test` carries the real comparison (e.g. `{ predicate: "o.total > 100", input:{total:1200,...},
   output:true }`).
2. Survivors continue; rejects emit `die` and **do not** produce any downstream event.
3. **Property:** engine survivor set `==` oracle `filter` set for all generated lists.
4. Golden snapshot of the filtered sub-log on the fixture.

**Test plan.** Property (criteria 3) + golden (4) + unit that a reject emits no `transform`/`route`.

**DoD.** Shared DoD + criteria 1–4.

---

## S1.2 — `map` op (engine)  · **S** · Depends: S1.1

**User story.** As the engine, I want `map(applyDiscount)` as a value-transform sink, so survivors
are transformed in encounter order with before/after totals recorded.

**Description.** Stateless mapping sink emitting `transform { before, after }`; order-preserving.

**In scope.** map sink + `transform` event.

**Out of scope.** collect; viz size-morph (S1.8).

**Acceptance criteria.**
1. `transform` records `before` and `after` totals from `applyDiscount`.
2. **Property:** mapped sequence `==` oracle `map(applyDiscount)` over the survivors, order preserved.
3. Golden snapshot including `transform` events.

**Test plan.** Property (2) + golden (3).

**DoD.** Shared DoD + criteria 1–3.

---

## S1.3 — `collect(groupingBy(region))` sequential (engine)  · **M** · Depends: S1.2

**User story.** As the engine, I want the grouping collector driving the pull, so elements route by
region and accumulate into bins, completing Slice A headless.

**Description.** Terminal collector: classifier `Order::region` → `route`, then `accumulate` into the
region bin; the collector drives `tryAdvance` to exhaustion.

**In scope.** grouping collector, `route` + `accumulate`, terminal pull loop for Slice A.

**Out of scope.** parallel combiner (S3.3); bins viz (S1.9).

**Acceptance criteria.**
1. Each survivor emits `route{key}` then `accumulate{key, binCount}`.
2. **Property:** final bins `==` oracle grouping for all generated lists.
3. Terminal pull **precedes every emit** (the collector is the demand driver).
4. Golden snapshot = the canonical **Slice A sequential** log.

**Test plan.** Property (2) + invariant test (3) + golden (4); oracle equality via S0.6.

**DoD.** Shared DoD + criteria 1–4; **M1 engine complete**.

---

## S1.4 — Neural-conduit scene chassis (R3F)  · **L** · Depends: S0.7, S1.3

**User story.** As a viewer, I want the linear neural conduit rendered in 3D, so the pipeline's
topology is legible before anything animates.

**Description.** R3F scene: **source soma → filter neuron → map neuron → terminal**, connected by
axons, left→right (spec §3.1). Orbit camera. Renders from a static golden log. All chrome stays DOM.

**In scope.** scene graph, neuron/axon meshes, orbit controls, canvas mounting (dynamic import,
`ssr:false`), reading a log from the store.

**Out of scope.** pulses/animation (S1.5+); bloom/DoF (S5.2).

**Acceptance criteria.**
1. The four-node linear topology with axons renders and is recognizable.
2. Orbit camera works; default framing shows the whole conduit.
3. Scene reads the current `eventLog` from the store (static, no motion yet).
4. Holds **60fps** with the fixture on target hardware (no perf regressions baseline).

**Technical notes.** Establish the coordinate convention (x = stage progression) reused by every viz
story. Keep meshes instanced where cheap.

**Test plan.** Component mount test; a manual/Playwright screenshot baseline of the topology; an fps
sanity check note.

**DoD.** Shared DoD + criteria 1–4.

---

## S1.5 — Demand heartbeat + emit (viz)  · **L** · Depends: S1.4

**User story.** As a viewer, I want the retrograde demand spike and the forward element pulse, so I
*feel* laziness: nothing glows until the terminal pulls.

**Description.** Render the §3.2 heartbeat: **dim/thin retrograde `demand`** (terminal→source), then
**bright/fat forward `emit`** pulse. The source stack is inert until first demanded. **Exactly one
spike in flight.** Implements the fractional-playhead interpolation stubbed in S0.7. Caption:
`spliterator.tryAdvance()`.

**In scope.** demand + emit animation, playhead→keyframe interpolation, single-spike enforcement,
source-inert-until-demanded, the two visually distinct signals (dim pull vs bright push).

**Out of scope.** filter fire/die (S1.7), transform morph (S1.8).

**Acceptance criteria.**
1. A `demand` renders as a dim, thin retrograde spike **before** its `emit` renders.
2. `emit` renders as a bright forward pulse leaving the source.
3. **Never two spikes in flight** at any playhead (asserted from the log projection).
4. The source shows nothing glowing before the first `demand` (laziness).
5. Interpolation is a pure fn of `(log, playhead)`; scrubbing is smooth and reversible.

**Technical notes.** Demand vs data direction and dim-vs-bright are load-bearing correctness signals
(spec §3.2, §3.6) — do not stylize them away.

**Test plan.** Purity test: view-state at fractional playheads derives from the log only; an invariant
test that no two element pulses are simultaneously "in flight" for any sequential log; visual
baseline.

**DoD.** Shared DoD + criteria 1–5; guardrail "never two spikes (seq)" has an automated check.

---

## S1.6 — Pulse encoding (viz)  · **M** · Depends: S1.5

**User story.** As a viewer, I want each pulse to encode its data, so I can track identity as it
flies: **hue = region, size ∝ total, plus a riding DOM label**.

**Description.** Implement §3.3 encoding. Region also paired with a **shape/label** cue so survival
and region never depend on color alone (§3.7, colorblind-safe). The label (`"$1200 · West"`) is a DOM
element tracking the pulse's screen position.

**In scope.** hue mapping, size scaling, DOM label overlay tracking a 3D position, non-color region
pairing.

**Out of scope.** size *morph* on map (S1.8) — encoding here is the initial state.

**Acceptance criteria.**
1. Hue is a deterministic function of `region`; size a function of `total`.
2. A DOM label rides each active pulse and stays legible.
3. Region is distinguishable **without color** (shape or label), verified against a grayscale render.
4. Encoding is a pure function of the element payload.

**Test plan.** Unit test hue/size mappings; purity test; a grayscale a11y check that regions remain
distinguishable.

**DoD.** Shared DoD + criteria 1–4.

---

## S1.7 — `filter` fire/die (viz)  · **M** · Depends: S1.6

**User story.** As a viewer, I want survivors to fire through and rejects to dissipate at the filter,
so the threshold reads as a real predicate with live values.

**Description.** At the filter neuron: show `test` readout (`1200 > 100`); on `survive` the pulse
brightens and propagates; on `die` it **dissipates into the void below the conduit** — right there,
never later (§3.6).

**In scope.** threshold readout, survive-glow, die-dissipation anchored to the filter stage.

**Out of scope.** map/bins.

**Acceptance criteria.**
1. The `test` value is shown at the neuron for each element.
2. Rejected pulses die **at the filter stage** and no pulse advances past it after `die`.
3. Survivors visibly continue.
4. Die/survive not conveyed by color alone (§3.7).

**Test plan.** Projection test: for every `die` event, no downstream position is ever rendered for
that element; visual baseline of a dissipation.

**DoD.** Shared DoD + criteria 1–4; guardrail "die at filter, not later" automated.

---

## S1.8 — `map` size-morph (viz)  · **S** · Depends: S1.7

**User story.** As a viewer, I want the pulse to visibly shrink at `map`, so `applyDiscount` reads as
a value transform distinct from the filter threshold and the groupBy routing.

**Description.** On `transform`, the pulse **shrinks** from `before`→`after` size and the riding label
updates (§3.3). Chosen so `map` is not a redundant-looking step.

**In scope.** size morph keyed to `transform.before/after`; label update.

**Out of scope.** text scrambling (explicitly rejected in §3.3).

**Acceptance criteria.**
1. Morph magnitude derives from `transform`'s before/after totals.
2. The riding label updates to the post-discount value.
3. The morph is visually distinct from filter and routing.

**Test plan.** Purity test tying morph to the event; visual baseline.

**DoD.** Shared DoD + criteria 1–3.

---

## S1.9 — 3D region bins fill & grow (viz)  · **M** · Depends: S1.8

**User story.** As a viewer, I want survivors to fly into their region bin and the bin to grow, so
grouping's accumulation is the payoff of the sequential run.

**Description.** On `route` the pulse flies to its region bin; on `accumulate` the **3D bin lights and
grows** (§3.2 step 5). 3–4 bins.

**In scope.** bin meshes, route flight, accumulate growth, per-region binning.

**Out of scope.** private/partial bins + merge (E3).

**Acceptance criteria.**
1. Route destination == the pulse's region (hue) == engine `route.key`.
2. Final bin heights/counts **exactly match** the engine grouping (from the log), == oracle.
3. Growth animation is anchored to `accumulate` events.

**Test plan.** Projection test: final rendered bin counts derive from the log and equal the oracle;
visual baseline of filled bins.

**DoD.** Shared DoD + criteria 1–3; **Slice A sequential visually complete**.

---

## S1.10 — Transport + code panel + event-log step-list (DOM chrome)  · **L** · Depends: S1.5 (finalize after S1.9)

**User story.** As a viewer, I want transport controls, a code panel, and a step-list, so I can drive
and read the run.

**Description.** DOM chrome (spec §7): play/pause · **step (pause after every callback)** ·
**bidirectional scrub keyed to the event log** · speed. Code panel highlights the active op; the DOM
step-list mirrors the log line-by-line (and is the reduced-motion carrier, S1.11).

**In scope.** transport UI + keyboard control, code panel with active-op highlight, event-log
step-list synced to playhead.

**Out of scope.** toggles for slice/mode/threads (S2.4, S3.6, S4.4).

**Acceptance criteria.**
1. Play/pause/speed work; **step** advances exactly one event per activation.
2. Scrub is **bidirectional, deterministic, reversible**, keyed to event indices.
3. Code panel highlights the op corresponding to the current event.
4. Step-list row for the current event is highlighted and scrolled into view.
5. All controls are keyboard-drivable (§3.7).

**Technical notes.** Transport manipulates only `playhead`/play-state in the store; it never mutates
the log.

**Test plan.** Unit tests for step (one event), scrub monotonicity/reversibility; keyboard-driving
test; sync test between playhead and highlighted step row.

**DoD.** Shared DoD + criteria 1–5.

---

## S1.11 — Reduced-motion & a11y fallback  · **M** · Depends: S1.10

**User story.** As a motion-sensitive or keyboard-only viewer, I want a non-animated path, so the
full Slice-A story is followable without flight animation.

**Description.** Honor `prefers-reduced-motion` (§3.7): **snap** pulses stage-to-stage instead of
animating flight; the DOM step-list carries full meaning; transport is fully keyboard-drivable;
survival/death/region never rely on color alone.

**In scope.** reduced-motion branch (snap transitions), step-list completeness audit, keyboard path,
color-independence audit for Slice A.

**Out of scope.** Slice B / parallel a11y (revisited in S5.5).

**Acceptance criteria.**
1. With `prefers-reduced-motion` forced, pulses **snap** (no flight tweening) yet every event is
   still represented.
2. The Slice-A story is fully followable from the **step-list alone**.
3. Every transport action is reachable and operable by keyboard.
4. Survival/death and region are distinguishable without color.

**Test plan.** Test with the media query mocked true → assert no flight interpolation; step-list
semantic-completeness test; keyboard-only walkthrough test; grayscale check.

**DoD.** Shared DoD + criteria 1–4. **Epic exit M1:** Slice A sequential autoplays from the real log;
bins match the oracle.

---

# EPIC 2 — Slice B Sequential: Short-circuit  *(P0 ops + P1 viz)*  · Milestone M2

Pipeline: `…filter(…).map(…).findFirst()` ⇄ `.findAny()` (identical when sequential).

---

## S2.1 — `findFirst` / `findAny` short-circuit terminal (engine)  · **M** · Depends: S1.2, S0.6

**User story.** As the engine, I want a `SHORT_CIRCUIT` terminal that stops on first match, so Slice
B demonstrates early termination and un-pulled remainder headless.

**Description.** Terminal consuming survivors and stopping at the first: emits `found{elementId}` then
`shortcircuit{remainingUnpulled}`. Sequentially `findFirst == findAny` (both = first encounter).
Traversal must **not pull past the decisive element**.

**In scope.** short-circuit terminal reusing filter+map; `found` + `shortcircuit`; both toggle values
(same sequential behavior).

**Out of scope.** parallel find (E4); viz (S2.2/S2.3).

**Acceptance criteria.**
1. **Property:** result is the **encounter-order-first** survivor for all generated lists.
2. **No `demand`/`emit` after `found`** (traversal never pulls past the decisive element) — asserted
   on the log.
3. `shortcircuit.remainingUnpulled` equals source size minus pulled count.
4. Golden snapshots for both `findFirst` and `findAny` (identical outcome, sequential).

**Test plan.** Property (1) + log-invariant (2) + goldens (4); oracle equality via S0.6.

**DoD.** Shared DoD + criteria 1–4.

---

## S2.2 — FOUND latch (viz)  · **S** · Depends: S1.8, S2.1

**User story.** As a viewer, I want the terminal to latch "FOUND" on the matched pulse, so early
termination has a clear visual payoff distinct from Slice A's bins.

**Description.** On `found`, the terminal **latches "FOUND"** on the matched element (§3.2 step 5,
Slice B branch). Visually distinct from the region-bin motif.

**In scope.** FOUND latch anchored to `found`.

**Out of scope.** dark remainder (S2.3).

**Acceptance criteria.**
1. The latched element == engine `found.elementId`.
2. The latch visual is distinct from bins and not color-only.

**Test plan.** Projection test tying the latch to `found`; visual baseline.

**DoD.** Shared DoD + criteria 1–2.

---

## S2.3 — Dark-remainder / never-pulled (viz)  · **M** · Depends: S2.2

**User story.** As a viewer, I want the un-pulled source elements to go dark with a counter, so I see
that short-circuit means they were **never demanded**.

**Description.** After `found`/`shortcircuit`, remaining source elements go **dark and are never
demanded**; a counter shows "N never pulled" (§3.2 Slice B wow).

**In scope.** darkening of the un-pulled set; "never pulled" counter driven by `shortcircuit`.

**Acceptance criteria.**
1. The dark set == source minus pulled set (from the log); no forward `emit` is rendered for them.
2. The counter equals `shortcircuit.remainingUnpulled`.

**Test plan.** Projection test that darkened elements have no `emit` in the log; counter equality
test.

**DoD.** Shared DoD + criteria 1–2.

---

## S2.4 — Slice A⇄B and findFirst⇄findAny toggles (chrome)  · **M** · Depends: S1.10, S2.1

**User story.** As a viewer, I want to switch slices and (in B) the terminal, so I can compare
pipelines — each rebuilt from the real engine, not a viz hack.

**Description.** Slice selector rebuilds pipeline + log; the `findFirst⇄findAny` toggle (Slice B)
rebuilds the log and replays. Transport state handled sanely across swaps (per S0.7 reset policy).

**In scope.** slice toggle, terminal toggle, log swap + transport reset integration.

**Out of scope.** mode/threads/seed (S3.6), parallel find toggle (S4.4).

**Acceptance criteria.**
1. Toggling slice/terminal **swaps the engine log** (verified: the new log comes from a real run).
2. Playhead/transport reset per the S0.7 policy without visual glitches.
3. Sequential `findFirst` and `findAny` produce identical playback (correct for sequential).

**Test plan.** Store integration test that a toggle triggers an engine re-run and swaps the log;
reset-policy test.

**DoD.** Shared DoD + criteria 1–3. **Epic exit M2.**

---

# EPIC 3 — Slice A Parallel: Fork + Combiner Merge  *(spec P2)*  · Milestone M3

> Introduces the parallel engine (spec §10: the multithread button ~doubles the engine). E4 builds on it.

---

## S3.1 — Deterministic tick scheduler + recursive-halving fork (engine)  · **L** · Depends: S1.3, S0.5

**User story.** As the engine, I want a deterministic tick scheduler with recursive-halving fork and
seeded round-robin interleaving, so parallelism is faithful yet reproducible (never real threads).

**Description.** N logical lanes (2/4); **recursive-halving** split of the spliterator into a visible
split tree; **round-robin** interleaving varied by **seed** to demonstrate non-determinism (spec §4
parallel, Decision 6/9/13). Within a lane: one spike at a time; across lanes: concurrent. Emits
`fork` (with split tree) and `lane-demand`.

**In scope.** scheduler, recursive-halving partition, seeded interleaving, `fork`/`lane-demand`
events, per-lane single-file enforcement.

**Out of scope.** per-lane grouping (S3.2), combiner (S3.3), find (E4), viz (S3.4).

**Acceptance criteria.**
1. Given `(seed, threadCount)`, the interleaving is **fully deterministic** (repeat runs byte-identical).
2. **Property:** the union of lane inputs == full source; partitions are **disjoint** (a true
   partition) for 2 and 4 lanes.
3. Recursive halving is reflected in the `fork` split tree.
4. Within any lane, the single-file invariant holds (one spike at a time).
5. Golden snapshots for 2-lane and 4-lane forks.
6. Different seeds produce different interleavings (non-determinism demonstrated) while keeping the
   partition invariant.

**Technical notes.** The decoy placement from S0.3 must land in a **different lane** than the
`findFirst` target under halving — this is what makes E4's ordered-wait meaningful. Add a test pinning
that placement.

**Test plan.** Determinism test (1); partition property (2); seed-variation test (6); goldens (5);
decoy-placement test.

**DoD.** Shared DoD + criteria 1–6.

---

## S3.2 — Per-lane `filter → map` + private partial bins (engine)  · **M** · Depends: S3.1

**User story.** As the engine, I want each lane to run its own `filter → map` into **private partial
bins**, so parallel grouping accumulates independently before merge.

**Description.** Each lane runs a copy of `filter → map` and accumulates into **private partial bins**;
`accumulate` events are tagged with `lane`. No cross-lane contamination before the merge beat (§3.6).

**In scope.** per-lane sink chains, private partial bins, lane-tagged `accumulate`.

**Out of scope.** merge (S3.3).

**Acceptance criteria.**
1. Each lane's `accumulate` events are tagged with that `lane`.
2. **Property:** no element accumulates into more than one lane's bins; per-lane bins are disjoint
   until merge.
3. Golden snapshots (2-lane, 4-lane) of per-lane accumulation.

**Test plan.** Property (2); goldens (3).

**DoD.** Shared DoD + criteria 1–3.

---

## S3.3 — Combiner merge (engine)  · **M** · Depends: S3.2

**User story.** As the engine, I want the `Collector` combiner to merge partial bins, so parallel
grouping yields the same result as sequential.

**Description.** After lanes finish, combine partial bins → final bins; emit `combine`. This is the
reason parallel grouping works (§3.4).

**In scope.** combiner, `combine` event, final bin assembly.

**Acceptance criteria.**
1. Emits `combine` carrying the merged bin state.
2. **Load-bearing property:** combiner-merged bins **== sequential bins == oracle** for **all seeds
   and both thread counts**.
3. Golden snapshots of the merge (2-lane, 4-lane).

**Test plan.** The equivalence property (2) across seeds/threads is the headline test; goldens (3).

**DoD.** Shared DoD + criteria 1–3. **M3 engine complete.**

---

## S3.4 — Fork choreography (viz)  · **L** · Depends: S1.9, S3.3

**User story.** As a viewer, I want the source to split into N lane-conduits each with its own
retrograde demand, so parallelism reads as the "population brain."

**Description.** The source soma **splits** into N lane-conduits (visible fork; optional split-tree
detail), each a copy of `filter → map`, each with its **own `lane-demand`** spike (§3.4). One spike
per lane max.

**In scope.** fork geometry from the split tree, per-lane conduits, per-lane demand spikes.

**Out of scope.** private-bin/merge choreography (S3.5).

**Acceptance criteria.**
1. Fork geometry is driven by `fork`'s split tree; N ∈ {2,4} lanes render.
2. Each lane shows its **own** retrograde `lane-demand` spike.
3. **One spike per lane max** at any playhead (parallel single-file, §3.6).
4. Reduced-motion: fork snaps rather than animates.

**Test plan.** Projection test enforcing ≤1 in-flight spike per lane for any parallel log; fork-tree
render test; reduced-motion branch.

**DoD.** Shared DoD + criteria 1–4; guardrail "one spike per lane" automated.

---

## S3.5 — Private-bin fill + merge choreography (viz)  · **M** · Depends: S3.4

**User story.** As a viewer, I want each lane to fill its private bins and then see the partials flow
together and merge, so I see *why* parallel grouping is correct — the money shot for Slice A parallel.

**Description.** Each lane fills its own partial bins; at the end partials **flow together and merge**
with caption "combiner merges partial maps" (§3.4). Merge anchored to `combine`.

**In scope.** per-lane partial bins, merge flow animation, caption.

**Acceptance criteria.**
1. Partial bins are visibly **private per lane** until the merge beat.
2. The merge animation is anchored to `combine`; final merged bins == the engine result == oracle.
3. Reduced-motion path represents the merge in the step-list.

**Test plan.** Projection test (private until `combine`; final == oracle); visual baseline of the
merge; reduced-motion check.

**DoD.** Shared DoD + criteria 1–3.

---

## S3.6 — Multithread + 2/4-thread + seed controls (chrome)  · **M** · Depends: S2.4, S3.3

**User story.** As a viewer, I want a multithread button, a 2/4 selector, and a seed control, so I
can switch modes and watch non-determinism — each rebuilding the real log.

**Description.** Sequential⇄multithread button, **2/4 thread selector**, seed control (spec §7); each
rebuilds the engine log. Sequential path remains intact.

**In scope.** the three controls + log-swap integration.

**Out of scope.** parallel find toggle (S4.4).

**Acceptance criteria.**
1. Switching mode/threads/seed **swaps the real engine log** (verified from a run).
2. Sequential playback still works unchanged.
3. Changing seed visibly changes interleaving (via the new log).

**Test plan.** Store integration test per control (re-run + swap); regression test that sequential
still plays.

**DoD.** Shared DoD + criteria 1–3. **Epic exit M3:** Slice A parallel plays; fork + private bins +
combiner merge visible; parallel property/golden suite green.

---

# EPIC 4 — Slice B Parallel: Ordered Short-circuit vs findAny  *(spec P2)*  · Milestone M4

> Spec §10: the single most error-prone item. The property in S4.1 is load-bearing.

---

## S4.1 — Parallel `findFirst` — ordered wait + cancel (engine)  · **L** · Depends: S3.1, S2.1

**User story.** As the engine, I want parallel `findFirst` to return the **encounter-order-earliest**
match and cancel later lanes, so we never silently teach `findAny`.

**Description.** Lanes race; each may find a candidate; the engine returns the
**encounter-order-earliest** match. A later-index lane finishing first does **not** win — it
waits/verifies no earlier match exists, then **cancels** now-irrelevant lanes (§3.4, Decision 31).
Emits `found` + `cancel`.

**In scope.** ordered wait/verify logic, lane cancellation, `found`/`cancel` events, no-pull-past
per lane.

**Out of scope.** `findAny` (S4.2); cancellation viz (S4.3).

**Acceptance criteria.**
1. **Load-bearing property:** `findFirst` result is **always encounter-order-earliest**, for **all
   thread counts and all seeds**. (Uses the S0.3 decoy in a different lane — S3.1.)
2. No lane pulls past its decisive element (asserted on per-lane `demand`/`emit`).
3. `cancel` events cover exactly the lanes made irrelevant after the earliest match is confirmed.
4. Golden snapshots for 2-lane and 4-lane across ≥2 seeds each.

**Technical notes.** The failure mode to guard against is "first lane home wins" — which would equal
`findAny`. Property (1) is the pin; it must exercise seeds where a later lane finishes first.

**Test plan.** Property (1) is the headline (many seeds/threads); log-invariants (2,3); goldens (4);
oracle equality (encounter-order-first).

**DoD.** Shared DoD + criteria 1–4; the earliest-index property is in CI and mutation-covered.

---

## S4.2 — Parallel `findAny` — first-lane-wins (engine)  · **M** · Depends: S4.1

**User story.** As the engine, I want parallel `findAny` to return the first lane's match and cancel
the rest, so the A/B contrast with `findFirst` is real.

**Description.** First lane to find a match **wins immediately**; others cancel (§3.4). Result may
differ from `findFirst` across seeds — that difference is the lesson.

**In scope.** first-home logic, immediate cancel of others, `found`/`cancel`.

**Acceptance criteria.**
1. **Property:** `findAny` result is always **a valid match** (a survivor).
2. There exist seeds where `findAny` ≠ `findFirst` (contrast is demonstrable, not faked).
3. Golden snapshots (2-lane, 4-lane, ≥2 seeds).

**Test plan.** Validity property (1); a test asserting existence of a divergent seed (2); goldens (3).

**DoD.** Shared DoD + criteria 1–3.

---

## S4.3 — Lane race + cancellation wavefront (viz)  · **L** · Depends: S3.5, S4.2

**User story.** As a viewer, I want lanes to race and a dark cancellation wavefront to sweep cancelled
lanes, so ordered short-circuit vs first-home is visible.

**Description.** Lanes race visibly; on short-circuit a **dark cancellation wavefront** sweeps the
cancelled lanes (§3.4). `findFirst`: the earliest-index winner latches after the ordered wait;
`findAny`: the first-home latches. Captions: "ordered short-circuit" vs first-lane-wins.

**In scope.** race visualization, cancellation wavefront keyed to `cancel`, winner latch keyed to
`found`, captions.

**Acceptance criteria.**
1. The cancelled-lane set rendered == engine `cancel` events.
2. The winning latch == engine `found` (correct winner for each terminal).
3. `findFirst` shows the **wait-then-cancel** ordering; `findAny` shows immediate first-home.
4. Reduced-motion represents cancellation in the step-list.

**Test plan.** Projection tests tying wavefront to `cancel` and latch to `found`; a test contrasting
the two terminals on the same seed; reduced-motion check.

**DoD.** Shared DoD + criteria 1–4.

---

## S4.4 — Live findFirst⇄findAny parallel toggle (chrome)  · **S** · Depends: S3.6, S4.2

**User story.** As a viewer, I want to toggle findFirst⇄findAny in parallel on the same seed, so the
canonical interview contrast is visible side-by-side.

**Description.** The Slice-B parallel toggle re-runs the engine so the contrast (ordered wait+cancel
vs first-home) is visible across the same seed (Decision 31). Rebuilds the real log.

**In scope.** parallel terminal toggle + log swap; same-seed comparison affordance.

**Acceptance criteria.**
1. Toggling rebuilds the **real engine log** (verified from a run).
2. On a divergent seed, the two terminals visibly differ.

**Test plan.** Store integration test (re-run + swap); a scripted comparison on a known divergent
seed.

**DoD.** Shared DoD + criteria 1–2. **Epic exit M4:** Slice B parallel plays; earliest-index invariant
pinned; cancellation and the findFirst/findAny contrast correct and visible.

---

# EPIC 5 — Cinematic Polish & Landing  *(spec P3)*  · Milestone M5

> WebGL cost is justified only here (spec §10). Keep all non-conduit UI in DOM.

---

## S5.1 — Cinematic autoplay on load  · **M** · Depends: M1 (richer as M2–M4 land)

**User story.** As a first-time viewer, I want the demo to power up and play on load, so I get the
30-second wow with no interaction.

**Description.** On load: the circuit powers up, the first demand spike fires, pulses flow, bins fill
/ "FOUND" latches — **no interaction required** (spec §7).

**In scope.** autoplay sequencing, power-up intro, sensible default slice/mode.

**Acceptance criteria.**
1. Loading the page plays the full default (Slice A sequential) story unattended.
2. Autoplay respects reduced-motion (snaps, still narrates via step-list).
3. Transport can take over at any point without a jarring state jump.

**Test plan.** E2E (Playwright) load→play assertion; reduced-motion variant.

**DoD.** Shared DoD + criteria 1–3.

---

## S5.2 — Bloom + depth-of-field on the active pulse  · **M** · Depends: S1.5

**User story.** As a viewer, I want bloom and depth-of-field focusing the single active pulse, so my
eye follows one element.

**Description.** **Bloom + DoF** postprocessing on the active pulse; orbit framing (§3.5). Disabled
under reduced-motion; must stay within frame budget.

**In scope.** postprocessing pass, focus-follows-active-pulse, reduced-motion disable.

**Acceptance criteria.**
1. Bloom/DoF emphasize the single active pulse.
2. Frame time stays within budget on target hardware (measured, no dropped-frame regression).
3. Effects are disabled (or minimized) under reduced-motion.

**Test plan.** Perf measurement note/baseline; reduced-motion toggle test; visual baseline.

**DoD.** Shared DoD + criteria 1–3.

---

## S5.3 — Explainer cards (DOM, anchored to neurons)  · **L** · Depends: relevant slice per card

**User story.** As a Java engineer, I want anchored explainer cards with live values, so I can verify
the semantics I care about.

**Description.** DOM cards anchored to neurons (spec §7), each firing at the right event: `tryAdvance`,
sink chain, threshold/predicate with **live values**, `map` transform, `groupingBy` accumulate,
fork/join split, **combiner**, encounter order, **ordered vs unordered short-circuit**, why parallel
changes shape.

**In scope.** the card set, anchoring, event-timed reveal, accurate copy.

**Acceptance criteria.**
1. Each card appears at the correct event/stage and shows live values where applicable.
2. Cards are DOM (not WebGL) and positioned relative to their neuron.
3. Copy is Java-engineer-accurate (reviewed against the spec's semantics).
4. Cards are readable under reduced-motion and keyboard-reachable.

**Test plan.** Per-card timing tests (fires on the right event); an accuracy review checklist; a11y
check.

**DoD.** Shared DoD + criteria 1–4.

---

## S5.4 — Landing page & résumé framing  · **M** · Depends: M2+

**User story.** As a portfolio visitor, I want a landing page framing the "neural network wired
backwards" thesis, so the differentiator lands before I even interact.

**Description.** Landing/intro conveying the backward-demand thesis and the differentiator (spec §1),
linking into the demo; deployed to Vercel (static).

**In scope.** landing page, thesis copy, entry into the demo, deploy.

**Acceptance criteria.**
1. The "consumer drives the producer / retrograde demand" idea is legible in <10s of reading.
2. Clear entry into the live demo.
3. Vercel deploy green (still 0 functions).

**Test plan.** Content review; link/e2e smoke; deploy check.

**DoD.** Shared DoD + criteria 1–3.

---

## S5.5 — Final a11y & correctness-guardrail pass  · **M** · Depends: M4

**User story.** As the release owner, I want every spec §3.6 guardrail and §3.7 a11y contract
re-verified end-to-end, so the wow provably doesn't lie.

**Description.** A closing audit mapping each guardrail to a passing test/golden and verifying the
a11y contract across **all four slices/modes**: never two spikes (seq); one per lane (parallel); die
at filter; `findFirst` honors order + cancels; private bins until merge; nothing faked; reduced-motion
+ keyboard path on every slice; color-independence throughout.

**In scope.** the audit checklist, any gap-filling tests, cross-slice a11y verification.

**Acceptance criteria.**
1. A checklist maps **every** §3.6 guardrail to a specific passing test or golden.
2. Reduced-motion + keyboard-only paths verified on **all four** slices.
3. No rendered outcome anywhere is computed outside the event log (purity re-audited).

**Test plan.** The checklist is the deliverable; each row links to a green test; a11y walkthroughs
recorded.

**DoD.** Shared DoD + criteria 1–3. **Epic exit M5:** portfolio-ready demo.

---

## Appendix — Traceability

| Story | Spec anchors |
|---|---|
| S0.1–S0.7 | §4, §5, §6, §9 P0 |
| S1.1–S1.3 | §2 Slice A, §5, §9 P0 |
| S1.4–S1.11 | §3.1–3.3, §3.7, §7, §9 P1 |
| S2.1–S2.4 | §2 Slice B, §3.2, §7 |
| S3.1–S3.6 | §3.4, §4 parallel, §9 P2, Decisions 6/9/13/30 |
| S4.1–S4.4 | §3.4, §10, Decision 31 |
| S5.1–S5.5 | §3.5, §3.6, §3.7, §7, §9 P3 |

Out of scope for all stories: everything in [spec §11](./streamlab-spec.md) (19 other ops, builder,
type-checker, advisor, shareable URLs, puzzles, general parallel).
