# StreamLab MVP — Epics & Vertical Stories

> Derived from [`streamlab-spec.md`](./streamlab-spec.md). The MVP **is the demo**: two slices
> (A = grouping, B = short-circuit), each built **sequential and parallel**, end-to-end including 3D
> visualization, plus portfolio polish. Everything under [§11 Documented / future](./streamlab-spec.md)
> is explicitly **out of scope** here.
>
> **Slicing philosophy (Decision 15, vertical-slice-first).** Each epic below is a *demo-able
> milestone* — a slice that plays from the real event log — not a horizontal layer. Stories inside an
> epic cut through **engine → event-log → R3F viz → DOM chrome** so each one is independently
> testable and moves the demo forward. Foundation (E0) and Polish (E5) are the two unavoidably
> cross-cutting epics.
>
> **Definition of Done (applies to every story), per [`tdd-guidelines.md`](./tdd-guidelines.md):**
> - Human writes the failing test/property **first**; AI implements to green — never both in one turn.
> - Engine stories: result **== oracle** for all generated cases; relevant **fast-check properties**
>   green; **golden event-log snapshot** committed for each preset × mode.
> - Viz/UI stories: the visual is a **pure function of `(eventLog, playhead)`** — it replays the real
>   trace and cannot drift from the engine. No faked bin/latch/cancel outcomes.
> - Engine remains **zero-React, framework-agnostic TS**. Non-conduit UI stays in DOM/SVG.
> - Accessibility: `prefers-reduced-motion` honored; survival/death/region never rely on color alone.
> - Material Design 3 fonts & icons where chrome uses iconography (per animation-and-ui-guidelines).

---

## Milestone map

| Milestone | Epic | "Done when" (from spec §9) |
|---|---|---|
| M0 | E0 — Foundation & Engine Core | Kernel + oracle + store green headless; app shell deploys |
| M1 | E1 — Slice A Sequential (grouping) | Slice A **sequential demo** plays from the real event log |
| M2 | E2 — Slice B Sequential (short-circuit) | Slice B **sequential demo** plays; `findFirst⇄findAny` toggle |
| M3 | E3 — Slice A Parallel (fork + combiner merge) | Slice A **parallel demo** plays; parallel props/goldens green |
| M4 | E4 — Slice B Parallel (ordered short-circuit vs findAny) | Slice B **parallel demo** plays; earliest-index invariant pinned |
| M5 | E5 — Cinematic Polish & Landing | Portfolio-ready demo |

Dependency spine: **E0 → E1 → E2 → E3 → E4 → E5**. E2 depends on E1's viz chassis; E3/E4 depend on
the parallel engine (first built in E3). E5 can start once M2 lands and finishes after M4.

---

## EPIC 0 — Foundation & Engine Core  *(spec P0; enabler)*

**Goal:** a headless, oracle-verified pull engine and the app/state/test scaffolding every slice
reuses. No visuals yet — but Slices A & B are provably correct in the terminal.

### S0.1 — Project & deploy scaffold
- **As a** developer, **I want** a Next.js (App Router, client-only SPA shell) + TypeScript project
  wired to Vercel, **so that** every later slice has a home and a live URL.
- **Includes:** App Router client-component shell, TS strict config, ESLint/Prettier, path aliases,
  R3F + drei + Zustand installed, a placeholder route that renders and deploys to Vercel.
- **Acceptance:** `dev` runs; a bare page renders client-side; a Vercel preview deploy is green.
- **Deps:** none.

### S0.2 — Test infrastructure
- **As a** developer, **I want** Vitest + fast-check + a golden-snapshot harness + Stryker configured,
  **so that** TDD and mutation testing are one command away from story #1.
- **Includes:** `vitest` runner, `fast-check` wired, a golden event-log snapshot helper (stable
  serialization), Stryker config scoped to the engine dir, CI script.
- **Acceptance:** a trivial red→green sample test runs under each tool; `stryker run` executes on the
  (empty) engine target.
- **Deps:** S0.1.

### S0.3 — Domain & value model
- **As an** engine, **I want** the `Order` domain and a tagged-union `Value` model, **so that** ops
  operate on JDK-faithful, primitive-vs-boxed-aware data.
- **Includes:** `Order { id, total: int, region: Region enum, ... }`, `applyDiscount()` transform,
  `region` group key; a curated dataset of **10–12 orders across 3–4 regions**, with totals spanning
  below/above `100` **and** straddling the Slice-B target so single-file animation stays watchable.
- **Acceptance:** dataset documented; `applyDiscount` unit-tested; totals hit every needed boundary
  (below-100, above-100, the findFirst target and a decoy after it).
- **Deps:** S0.1.

### S0.4 — Event-log contract types
- **As** the engine↔viz bridge, **I want** typed, immutable event kinds, **so that** the viz is a
  pure function of the log and cannot drift.
- **Includes:** discriminated union for all 14 kinds — `demand, emit, test, survive, die, transform,
  route, accumulate, fork, lane-demand, combine, found, cancel, shortcircuit` — each carrying
  `tick`, optional `lane`, `elementId`, `op`, and kind-specific payload (see spec §5 example).
  Immutability enforced (readonly / frozen).
- **Acceptance:** types compile; a sample hand-built log round-trips through the golden serializer;
  exhaustiveness check on the union.
- **Deps:** S0.2, S0.3.

### S0.5 — Engine kernel: Spliterator pull + Sink chain + sequential runner
- **As** the credibility spine, **I want** a JDK-faithful `Spliterator.tryAdvance(sink)` pull driving
  a `Sink` chain (`begin/accept/cancel/end`) with op **flags** (`STATEFUL, SHORT_CIRCUIT, ORDERED,
  SIZED`), **so that** the terminal pulls one element at a time and the run emits an ordered
  immutable event log.
- **Includes:** the pull loop, sink-chain wiring, flag plumbing, and event emission at each callback.
  No ops yet beyond a pass-through sink used to prove the loop.
- **Acceptance:** running an identity pipeline over the dataset emits a well-formed `demand→emit→…`
  log with **exactly one element resolved before the next demand** (single-file invariant, headless).
- **Deps:** S0.4.

### S0.6 — Oracle harness
- **As a** test author, **I want** a trivially-correct native-array reference (`filter`/`map`/
  reduce-into-map), **so that** every generated case can assert `engine result == oracle`.
- **Includes:** oracle implementations for the built ops' *outcomes*, plus a fast-check generator for
  order lists, and the equality assertion utility.
- **Acceptance:** oracle self-checks against hand examples; harness ready for op stories to consume.
- **Deps:** S0.3.

### S0.7 — Zustand store + playhead projection
- **As** the UI, **I want** a store holding `eventLog + playhead + config (slice, mode, threadCount,
  seed, findFirst|findAny)` with a pure `(log, playhead) → viewState` selector, **so that** render
  subscribes while the engine stays pure TS outside React.
- **Includes:** store shape, config actions, fractional-playhead selector stub (interpolation added
  in E1), engine-run trigger that swaps the log on config change.
- **Acceptance:** store unit-tested; selector is pure and referentially stable; no React imports leak
  into engine code.
- **Deps:** S0.5.

---

## EPIC 1 — Slice A Sequential: Grouping  *(spec P0 ops + P1 viz)* — **M1**

**Pipeline:** `orders.stream().filter(o -> o.total > 100).map(Order::applyDiscount).collect(groupingBy(Order::region))`
**Goal:** the money shot of laziness — every surviving pulse travels the full conduit and drops into
its 3D region bin, driven by the retrograde demand heartbeat.

### S1.1 — `filter` op (engine)
- Predicate `total > 100` as a `Sink`; emits `test` (with live values, e.g. `1200 > 100`), then
  `survive` or `die`. **DoD:** property — engine-survivors `==` oracle-survivors; die happens **at
  the filter**, never later; golden snapshot.
- **Deps:** S0.5, S0.6.

### S1.2 — `map` op (engine)
- `applyDiscount` as a value-transform `Sink`; emits `transform` with before/after `total`.
  **DoD:** property — mapped values `==` oracle; order preserved; golden snapshot.
- **Deps:** S1.1.

### S1.3 — `collect(groupingBy(region))` sequential (engine)
- Classifier routes by `region`; emits `route` then `accumulate`; terminal drives the whole pull.
  **DoD:** property — resulting bins `==` oracle grouping; **terminal pull precedes every emit**;
  golden snapshot for Slice A sequential.
- **Deps:** S1.2.

### S1.4 — Neural-conduit scene chassis (R3F)
- Linear left→right chain: **source soma → filter neuron → map neuron → terminal**, with axons;
  orbit camera; renders from a static log. All non-conduit UI stays DOM. **DoD:** scene mounts,
  reads a golden log, shows the topology; 60fps on the target machine with the dataset.
- **Deps:** S0.7, S1.3.

### S1.5 — Demand heartbeat + emit (viz)
- Retrograde **dim/thin** demand spike (terminal→source) → **bright/fat** forward element pulse from
  source; **exactly one spike in flight**; source stack inert until first demanded (laziness shown).
  Caption: `spliterator.tryAdvance()`. **DoD:** playing the log never shows two spikes; demand always
  precedes element motion (asserted against the log order).
- **Deps:** S1.4.

### S1.6 — Pulse encoding (viz)
- **hue = region**, **size ∝ total**, plus a small **DOM label riding the pulse** (`"$1200 · West"`).
  Region paired with a **shape/label** cue (not color alone). **DoD:** encoding is a pure fn of the
  element payload; colorblind-safe pairing verified.
- **Deps:** S1.5.

### S1.7 — `filter` fire/die (viz)
- Threshold readout at the neuron (`1200 > 100`); survivors brighten and propagate; rejects
  **dissipate into the void below the conduit** at the filter. **DoD:** die animation is anchored to
  the `die` event's stage; no rejected pulse advances past filter.
- **Deps:** S1.6.

### S1.8 — `map` size-morph (viz)
- Pulse **visibly shrinks** as discount drops the total; riding label updates. Distinct from filter's
  threshold and groupBy's routing (no redundant-looking steps). **DoD:** morph keyframed off the
  `transform` event's before/after.
- **Deps:** S1.7.

### S1.9 — 3D region bins fill & grow (viz)
- On `route`, pulse flies to its region bin; on `accumulate`, the **3D bin lights and grows**. 3–4
  bins. **DoD:** final bin heights/counts match the engine's grouping exactly (from the log).
- **Deps:** S1.8.

### S1.10 — Transport + code panel + event-log step-list (DOM chrome)
- Play/pause · **step (pause after every callback)** · **bidirectional scrub keyed to the event log**
  · speed. Code panel highlights the active op; DOM step-list mirrors the log. **DoD:** scrub is
  deterministic and reversible; stepping lands exactly one event per press.
- **Deps:** S1.5 (usable as soon as pulses move; finalize after S1.9).

### S1.11 — Reduced-motion & a11y fallback
- `prefers-reduced-motion`: **snap** pulses stage-to-stage instead of animating flight; the DOM
  step-list carries full meaning without motion; transport is keyboard-drivable. **DoD:** with the
  media query forced, the full Slice-A story is followable without animation and via keyboard only.
- **Deps:** S1.10.

**Epic exit (M1):** Slice A sequential autoplays from the real event log; bins match the oracle.

---

## EPIC 2 — Slice B Sequential: Short-circuit  *(spec P0 ops + P1 viz)* — **M2**

**Pipeline:** `…filter(…).map(…).findFirst()` **⇄** `.findAny()` (live toggle, identical in sequential).
**Goal:** early termination made literal — the first survivor **latches "FOUND"** and remaining source
elements go **dark, never pulled**.

### S2.1 — `findFirst` / `findAny` short-circuit terminal (engine)
- `SHORT_CIRCUIT` terminal that stops the pull on first match; emits `found` then `shortcircuit`
  (with count of un-pulled remaining). Sequentially `findFirst == findAny` (first encounter).
  **DoD:** property — result is the encounter-order-first survivor; **traversal never pulls past the
  decisive element** (assert no `demand`/`emit` after `found`); golden snapshot for both toggles.
- **Deps:** S1.2 (reuses filter+map), S0.6.

### S2.2 — FOUND latch (viz)
- Terminal **latches "FOUND"** on the matched pulse; the latch is visually distinct from Slice A's
  bins. **DoD:** latched element == engine's `found` element.
- **Deps:** S1.8 (pulse chassis), S2.1.

### S2.3 — Dark-remainder / never-pulled (viz)
- Remaining source elements go **dark and are never demanded**; a counter shows "N never pulled."
  This is the visible payoff of laziness + short-circuit. **DoD:** dark set == source minus pulled
  set from the log; no forward pulse emitted for them.
- **Deps:** S2.2.

### S2.4 — Slice A⇄B and findFirst⇄findAny toggles (chrome)
- Slice selector rebuilds the pipeline/log; findFirst⇄findAny toggle (in Slice B) rebuilds the log
  and replays. **DoD:** toggling swaps the engine log (not a viz hack); transport state handled
  sanely across swaps.
- **Deps:** S1.10, S2.1.

**Epic exit (M2):** Slice B sequential plays; FOUND latches; remainder darkens; toggles rebuild the
real log. E5 landing work may now begin in parallel.

---

## EPIC 3 — Slice A Parallel: Fork + Combiner Merge  *(spec P2)* — **M3**

**Goal:** the population brain for grouping — the conduit **forks into N lanes**, each fills **private
partial bins**, then a **combiner merges** them. This is Slice A parallel's money shot.

> **Cost note (spec §10):** the multithread capability ~doubles the engine. This epic *introduces* the
> parallel engine that E4 also builds on.

### S3.1 — Deterministic tick scheduler + recursive-halving fork (engine)
- N logical lanes (2/4), **recursive-halving** split of the spliterator, **round-robin** interleaving
  with a **seed** (seed varies interleaving to demonstrate non-determinism). Emits `fork` and
  `lane-demand`. Within a lane: still **one spike at a time**; across lanes: concurrent.
  **DoD:** scheduler is deterministic given (seed, threadCount); property — union of lane inputs ==
  full source, partition disjoint; golden snapshots for 2-lane and 4-lane.
- **Deps:** S1.3 (sequential grouping), S0.5.

### S3.2 — Per-lane `filter → map` + private partial bins (engine)
- Each lane runs its own `filter → map` and accumulates into **private partial bins**; per-lane
  `accumulate` events tagged with `lane`. **DoD:** property — per-lane bins never cross-contaminate
  before the merge beat.
- **Deps:** S3.1.

### S3.3 — Combiner merge (engine)
- `Collector` combiner flows partial bins together; emits `combine`. **DoD:** property —
  **combiner-merged bins == sequential bins** (and == oracle), for all seeds and both thread counts;
  golden snapshot of the merge.
- **Deps:** S3.2.

### S3.4 — Fork choreography (viz)
- Source soma **splits** into N lane-conduits (visible fork; optional split-tree detail), each a copy
  of `filter → map`, each with its **own retrograde lane-demand** spike. **DoD:** one spike per lane
  max; fork geometry driven by `fork`/`lane-demand` events.
- **Deps:** S1.9 (bins/pulses), S3.3.

### S3.5 — Private-bin fill + merge choreography (viz)
- Each lane fills its own partial bins; at the end partials **flow together and merge** with caption
  "combiner merges partial maps." **DoD:** merge animation anchored to `combine`; final bins == the
  merged engine result.
- **Deps:** S3.4.

### S3.6 — Multithread + 2/4-thread + seed controls (chrome)
- Multithread button, **2/4 thread selector**, seed control; each rebuilds the engine log.
  **DoD:** switching mode/threads/seed swaps the real log; sequential path still intact.
- **Deps:** S2.4, S3.3.

**Epic exit (M3):** Slice A parallel plays; fork + private bins + combiner merge visible; parallel
property/golden suite green.

---

## EPIC 4 — Slice B Parallel: Ordered Short-circuit vs findAny  *(spec P2)* — **M4**

**Goal:** the canonical interview lesson made visible — `findFirst` returns the **encounter-order-
earliest** match (waits/verifies, then **cancels** later lanes) while `findAny` = **first lane home
wins**. Spec §10 flags this as the single most error-prone item.

### S4.1 — Parallel `findFirst` — ordered wait + cancel (engine)
- Lanes race; each may find a candidate; engine returns the **encounter-order-earliest** match — a
  later-index lane finishing first does **not** win; it waits/verifies no earlier match exists, then
  cancels now-irrelevant lanes. Emits `found`, `cancel`. **DoD (the load-bearing property):**
  `findFirst` result is **always encounter-order-earliest regardless of thread count/seed**; no lane
  pulls past its decisive element; golden snapshots for 2/4 lanes × seeds.
- **Deps:** S3.1 (parallel engine), S2.1 (short-circuit terminal).

### S4.2 — Parallel `findAny` — first-lane-wins (engine)
- First lane to find a match **wins immediately**; others cancel. **DoD:** property — `findAny`
  result is always *a* valid match; may differ from `findFirst` across seeds (the contrast is real);
  golden snapshots.
- **Deps:** S4.1.

### S4.3 — Lane race + cancellation wavefront (viz)
- Lanes race visibly; on short-circuit a **dark cancellation wavefront** sweeps the cancelled lanes.
  `findFirst`: earliest-index winner latches after the ordered wait; `findAny`: first-home latches.
  Caption: "ordered short-circuit" vs first-lane-wins. **DoD:** cancellation set == engine `cancel`
  events; the winning latch == engine `found`.
- **Deps:** S3.5 (parallel viz chassis), S4.2.

### S4.4 — Live findFirst⇄findAny parallel toggle (chrome)
- The Slice-B parallel toggle re-runs the engine so the A/B contrast (ordered wait+cancel vs
  first-home) is visible side-by-side across the same seed. **DoD:** toggle rebuilds the real log;
  the difference is demonstrable, not faked.
- **Deps:** S3.6, S4.2.

**Epic exit (M4):** Slice B parallel plays; earliest-index invariant pinned by property test;
cancellation wavefront and the findFirst/findAny contrast are correct and visible.

---

## EPIC 5 — Cinematic Polish & Landing  *(spec P3)* — **M5**

**Goal:** portfolio-ready. Wow in ~30s with no interaction, depth on demand. WebGL cost is justified
only here (spec §10) — keep all non-conduit UI in DOM.

### S5.1 — Cinematic autoplay on load
- Circuit powers up, first demand spike fires, pulses flow, bins fill / "FOUND" latches — the 30s wow,
  **no interaction required**. **DoD:** load → full Slice-A sequential story plays unattended.
- **Deps:** M1 (min); richer once M2–M4 land.

### S5.2 — Bloom + depth-of-field on the active pulse
- **Bloom + DoF** focus the eye on the single active pulse; orbit camera framing. **DoD:** perf stays
  within frame budget on target hardware; effects disabled under reduced-motion.
- **Deps:** S1.5.

### S5.3 — Explainer cards (DOM, anchored to neurons)
- Anchored cards: `tryAdvance`, sink chain, threshold/predicate with **live values**, `map` transform,
  `groupingBy` accumulate, fork/join split, **combiner**, encounter order, **ordered vs unordered
  short-circuit**, why parallel changes shape. **DoD:** each card fires at the right event; content is
  Java-engineer-accurate; DOM (not WebGL).
- **Deps:** relevant slice done for each card.

### S5.4 — Landing page & résumé framing
- Landing/intro framing the "neural network wired backwards" thesis + differentiator; links into the
  demo; deployed to Vercel. **DoD:** deploy green; the backward-demand story is legible in <10s of
  reading.
- **Deps:** M2+.

### S5.5 — Final a11y & correctness-guardrail pass
- Re-verify all spec §3.6 guardrails end-to-end (never two spikes seq; one/lane parallel; die at
  filter; `findFirst` honors order + cancels; private bins until merge; nothing faked) and the §3.7
  a11y contract across every slice/mode. **DoD:** a checklist mapping each guardrail to a passing
  test or golden; reduced-motion + keyboard path verified on all four slices.
- **Deps:** M4.

---

## Coverage check against the spec

| Spec element | Covered by |
|---|---|
| Ops: stream/parallelStream, filter, map, groupingBy+combiner, findFirst/findAny | S0.5, S1.1–1.3, S2.1, S3.1–3.3, S4.1–4.2 |
| Event kinds (all 14) | S0.4 (types) + each viz story consumes them |
| Sequential demand heartbeat / single-file | S1.5, guardrails S5.5 |
| Pulse encoding (hue/size/label; map=morph) | S1.6, S1.8 |
| Slice A sequential + parallel | E1, E3 |
| Slice B sequential + parallel (findFirst⇄findAny) | E2, E4 |
| Parallel: scheduler, recursive-halving, seed, ordered short-circuit, combiner | S3.1–3.3, S4.1–4.2 |
| Transport (play/pause/step/scrub/speed) + toggles + seed | S1.10, S2.4, S3.6, S4.4 |
| Reduced-motion / a11y / colorblind pairing | S1.11, S5.5, encoding S1.6 |
| Testing: oracle, fast-check properties, golden snapshots, mutation | S0.2, S0.6 + per-story DoD |
| Cinematic autoplay, bloom/DoF, explainer cards, orbit, landing | E5 |
| **Out of scope (§11):** 19 other ops, builder, type-checker, advisor, shareable URLs, puzzles | *not built* |

**Rough sequencing:** E0 must fully precede E1. E1→E2 share the sequential viz chassis. E3 introduces
the parallel engine that E4 extends. E5 overlaps from M2 onward and closes after M4.
