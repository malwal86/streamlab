# StreamLab — Architecture & Build Spec (v2: Neural Demo)

> Repository: `streamlab-java-pipeline-visualizer`
> A faithful simulation of Java Stream **execution semantics** in TypeScript, presented as a
> **3D "neural conduit"** where operations are neurons and elements are electrical pulses that
> either fire through or die. Runs 100% client-side on Next.js.
>
> **v2 pivot (this revision):** narrowed from a maximalist all-25-op engine to a **sharp,
> demo-first build**: two pipelines built **end-to-end with 3D visualization**, sequential **and**
> parallel; everything else **documented, not built**. See [§2 Scope](#2-scope) and the
> [Decision Log](#decision-log) for what changed and why. v1 decisions that still hold are retained
> below; superseded ones are struck in the log.

---

## 1. Product thesis

The demo's job: in ~30 seconds, make a viewer *feel* how Java streams actually execute — **lazy,
demand-driven, one element at a time** — and in the next two minutes let a Java engineer verify it's
*correct*. Wow first, then depth. The signature idea:

> **A neural network wired backwards.** Unlike a real brain (which pushes signals forward from a
> stimulus), a stream is driven from the **output**: the terminal operation reaches back and pulls
> one element at a time. We dramatize this — the consumer drives the producer — as a *retrograde
> demand spike*. No other stream visualization shows demand direction. That is the differentiator.

Primary critic to satisfy: a **Java engineer** who will instinctively check that laziness,
short-circuiting, encounter order, and parallel merge are *actually* right. Faithfulness is the
product.

---

## 2. Scope

### Built in the demo (two slices, sequential + parallel)

| | **Slice A — Grouping** | **Slice B — Short-circuit** |
|---|---|---|
| Pipeline | `orders.stream().filter(o -> o.total > 100).map(Order::applyDiscount).collect(groupingBy(Order::region))` | `orders.stream().filter(o -> o.total > 100).map(Order::applyDiscount).findFirst()` **⇄** `.findAny()` (toggle) |
| Teaches | Lazy element-at-a-time flow → terminal accumulation into **bins** | Lazy flow → **early termination**; `findFirst` (ordered) vs `findAny` (unordered) |
| Sequential wow | Every surviving pulse travels the full conduit and drops into its **3D region bin** | First survivor **latches "FOUND"**; remaining source elements go **dark, never pulled** |
| Parallel wow | Conduit **forks into N lanes**, each fills **private partial bins**, then a **combiner merges** them | Lanes race; `findFirst` **waits for encounter-order-earliest + cancels** later lanes; `findAny` = first lane home wins |

**Built operation set (only these):** `stream`/`parallelStream` (source), `filter`, `map`,
`collect(groupingBy)` (with combiner), `findFirst`, `findAny`. Everything is a **fixed preset** —
no live pipeline editing in the demo.

### Documented, not built (see [§11](#11-documented--future))
All other 19 operations · the interactive type-aware builder · the type-checker · the optimization
advisor · shareable URLs · puzzles/challenge mode. These are specified as *future* work; the demo
does not implement them.

### Rejected outright
Free-form Java editor / Java parser · real Web Workers / OS threads (scheduler is **simulated** and
deterministic) · any backend.

---

## 3. The visual language — "Neural Conduit"

The whole visualization is a **pure function of the engine's event log** (see [§7](#7-engine--viz-event-log-contract)),
so the animation replays the real trace and **cannot drift** from the engine.

### 3.1 Topology
A **linear** left-to-right chain of neuron-nodes (not a blobby brain — linearity keeps it readable
and honest about single-file execution):

```
[ source soma ] --axon--> (filter neuron) --axon--> (map neuron) --axon--> [ terminal ]
                                                                              ├ Slice A: 3–4 region BINS
                                                                              └ Slice B: FOUND latch
```

### 3.2 The demand heartbeat (sequential) — the correctness spine
One beat per element, **exactly one spike in flight**:

1. **Demand spike (terminal → source, backward).** The terminal fires a *dim, thin retrograde*
   pulse up the chain. Caption: `spliterator.tryAdvance()` — "the collector asks for one element."
2. **Encode & emit (source).** The next `Order` lifts off the source stack and becomes a **bright
   forward pulse**. *Nothing glowed before this* — that's laziness, shown.
3. **filter neuron = firing threshold.** Predicate shown with the real value (`1200 > 100`).
   Fire → bright, propagates. Sub-threshold → **fizzles dark and dissipates right there**;
   downstream never sees it.
4. **map neuron = transform.** Pulse passes through and **visibly morphs** (see encoding below).
5. **Terminal.** Slice A: routes into its region bin, which lights and grows. Slice B: latches.
6. **Only now** the terminal fires the *next* demand spike. One element fully resolved before the
   next is pulled = "lazily, one after another," made literal.

Two visually distinct signals throughout: **dim/thin = demand (pull)**, **bright/fat = element
(push)**. Demand goes one way, data the other.

### 3.3 Pulse encoding (how an element becomes a spike)
- **Source** holds the raw `List<Order>` as a faint, inert stack (dim until first demanded).
- Each pulse encodes: **hue = region** (categorical, set at source, drives bin routing) · **size ∝
  total** (magnitude) · a small **DOM label riding the pulse** ("$1200 · West") for legibility.
- **`filter`** tests `total > 100` (fire/die).
- **`map` (`applyDiscount`)** is a *value transform* rendered as a **size morph** — the pulse
  visibly **shrinks** as the discount drops the total, label updates. (Chosen so `map` is visibly
  distinct from both `filter`'s threshold and `groupBy`'s hue-routing — no redundant-looking steps.)
- **`groupingBy(region)`** routes by the pulse's hue into the matching **3D bin**.
- Rich objects stay readable as fast pulses only via color/size/label — **not** mid-flight text
  morphing. Accept this trade (it's why `map` is a recolor/resize, not a text scramble).

### 3.4 Parallel mode (the "population brain")
Toggled by the **multithread button** + a **2 / 4 thread selector**. Parallelism is **simulated**
(deterministic tick-scheduler, N logical lanes, seed-varied interleaving) — *never* real threads.

- **Fork.** The source soma **splits** (recursive halving → a visible fork; optional split-tree
  detail) into N lane-conduits, each a copy of `filter → map`.
- **Per-lane heartbeat.** Within a lane it's still **one spike at a time**; *across* lanes they fire
  **concurrently**. That is the precise truth — the single-spike restraint lifts to one-per-lane.
- **Each lane has its own retrograde demand** driving its sub-spliterator. The backward-brain
  generalizes: terminal splits into N sub-demands.
- **Slice A merge.** Each lane fills its **own private partial bins**; at the end the partials
  **flow together and merge** (`Collector` combiner). Caption: "combiner merges partial maps." This
  *is* the reason parallel grouping works, and it's the money shot for Slice A parallel.
- **Slice B (`findFirst`).** Lanes race and may each find a candidate. The engine returns the
  **encounter-order-earliest** match — so a later-index lane finishing first does **not** win; it
  **waits/verifies** no earlier match exists, then **cancels** the now-irrelevant lanes (dark
  cancellation wavefront). Caption: "ordered short-circuit."
- **Slice B (`findAny`).** First lane to find a match **wins immediately**; others cancel. The
  live A/B contrast between these two is the canonical interview lesson, made visible.

### 3.5 Wow amplifiers (where 3D genuinely earns its cost)
Backward demand-spike as light · rejected pulses **dissipating into the void** below the conduit ·
bins growing in 3D · **bloom + depth-of-field on the single active pulse** (eye follows one element)
· orbit camera · parallel **fork + merge choreography**.

### 3.6 Correctness guardrails (the wow must not lie)
- Sequential: **never two spikes in flight**; demand **always precedes** element motion.
- Rejected pulses die **at the filter**, not later.
- Parallel: **one spike per lane** max; `findFirst` must honor encounter order + cancel; Slice A
  bins are **private per lane** until the explicit merge beat.
- Bin/latch outcomes come **from the event log**, never faked.

### 3.7 Reduced motion / accessibility
Honor `prefers-reduced-motion`: **snap** pulses stage-to-stage instead of animating flight; the
**event log step-list** (DOM) always carries full meaning without motion. Survival/death and region
must not rely on color alone (pair hue with shape/label for colorblind users). Keyboard-drivable
transport.

---

## 4. Engine core (scoped to the demo ops)

Framework-agnostic TypeScript, **zero React**. Pipeline in → **immutable event log** out. Unit-tested
headless. (This boundary is what keeps the credibility-critical code honest and testable.)

- **JDK-faithful model:** source **`Spliterator`** is *pulled* by the terminal
  (`tryAdvance(sink)`); elements *push* down a **`Sink` chain** (`begin`/`accept`/`cancel`/`end`);
  each op carries **flags** (`STATEFUL`, `SHORT_CIRCUIT`, `ORDERED`, `SIZED`). This push/pull duality
  is precisely what the neural heartbeat renders.
- **Trace = single source of truth.** Engine runs once, emits an ordered immutable event log;
  everything downstream is a pure function of `(eventLog, playhead)`.
- **Value model** (tagged union, primitive-vs-boxed aware) supporting the `Order` object domain:
  `Order { id, total: int, region: enum, ... }`, its `applyDiscount()` transform, and `region`
  as the group key. ~10–12 orders, 3–4 regions, totals spanning below/above 100 and the Slice-B
  target, so single-file animation stays watchable.

### Parallel engine
Deterministic **tick scheduler**, N logical lanes, **recursive-halving** split, **round-robin**
interleaving with a **seed** (seed varies interleaving to demonstrate non-determinism). Full
semantic fidelity for the built ops: encounter order, `findFirst` vs `findAny`, ordered
short-circuit + cancellation, `groupingBy` partial-accumulate + **combiner** merge.

---

## 5. Engine → viz event-log contract

The bridge between engine and neural viz. Event kinds (ordered, immutable):

| kind | meaning | drives (visual) |
|---|---|---|
| `demand` | terminal/lane requests one element (`tryAdvance`) | retrograde dim spike |
| `emit` | source encodes & releases next element | bright pulse leaves source |
| `test` | predicate evaluated at `filter` | threshold readout (`1200 > 100`) |
| `survive` | element passed `filter` | pulse continues, glows |
| `die` | element rejected at `filter` | pulse dissipates into void |
| `transform` | `map` applied | pulse size morph + label update |
| `route` | `groupingBy` classifier picks bin | pulse flies to region bin |
| `accumulate` | element added to a (partial) bin | bin grows |
| `fork` | source split into lanes | conduit forks / split tree |
| `lane-demand` | per-lane retrograde request | per-lane dim spike |
| `combine` | combiner merges partial bins | partial bins flow together |
| `found` | `findFirst`/`findAny` latched a result | terminal "FOUND" latch |
| `cancel` | lane/work cancelled (short-circuit) | dark cancellation wavefront |
| `shortcircuit` | traversal ended early | remaining source pulses go dark + counter |

Example:
```ts
{ tick: 42, lane: "worker-2", elementId: 7,
  kind: "test", op: "filter", predicate: "o.total > 100",
  input: { total: 1200, region: "West" }, output: true, nextStage: "map" }
```

---

## 6. Tech stack

- **Next.js** (App Router, client components; no SSR needed — SPA shell for routing + Vercel deploy
  + résumé signal) · **TypeScript** · **React**.
- **Visualization: hybrid.** **react-three-fiber (+ drei)** WebGL for the *one* neural-conduit
  canvas (pulses, neurons, bins, fork/merge, bloom/DoF). **DOM/SVG** for chrome: code panel, event
  log/step-list, transport controls, thread selector, explainer cards.
- **State:** **Zustand** holds `eventLog + playhead + config (slice, sequential/parallel, threadCount,
  seed, findFirst/findAny)`. Render subscribes; the engine stays pure TS outside React.
- **Tests:** **Vitest** + **fast-check** (property) + golden event-log snapshots (+ **Stryker**
  mutation on the engine).
- Deploy: **Vercel**. 100% client-side.

---

## 7. Demo UX

- **Cinematic autoplay on load** — the circuit powers up, the first demand spike fires, pulses flow,
  bins fill / "FOUND" latches. The 30-second wow with no interaction required.
- **Transport:** play/pause · **step (pause after every callback)** · scrub (bidirectional, keyed to
  the event log) · speed.
- **Toggles:** **Slice A ⇄ B** · **sequential ⇄ multithread** · **2/4 threads** · **findFirst ⇄
  findAny** (Slice B) · seed (to show non-determinism).
- **Explainer cards** (DOM, anchored to neurons): `tryAdvance`, sink chain, threshold/predicate with
  live values, `map` transform, `groupingBy` accumulate, fork/join split, **combiner**, encounter
  order, ordered vs unordered short-circuit, why parallel changes shape.

---

## 8. Testing strategy

Driven by `planning/tdd-guidelines.md`; the deterministic engine + immutable log make it clean.

1. **Oracle:** trivially-correct reference from native array ops (`filter`/`map`/reduce-into-map;
   simple parallel model). Assert engine result **== oracle** for every generated case.
2. **Property tests (fast-check):** parallel result **== sequential** for Slice A (grouping is
   order-agnostic in outcome); `findFirst` result is **always encounter-order-earliest** regardless
   of thread count/seed; `findAny` result is always *a* valid match; short-circuit never pulls past
   the decisive element; combiner-merged bins **== sequential bins**.
3. **Golden event-log snapshots** per preset × mode (seq / 2-lane / 4-lane) — regression net (backs
   up property tests; never replaces them).
4. **Mutation testing** on the engine. Human writes the failing test/property; AI implements to it —
   never both in one turn.

---

## 9. Build order (correctness-first, but demo emerges early)

| Phase | Deliverable | Done when |
|---|---|---|
| **P0** | Pure-TS engine: `Sink`/`Spliterator`, sequential runner, event-log types, oracle harness; ops `filter`, `map`, `collect(groupingBy)`, `findFirst`/`findAny` (sequential) | Slices A & B correct **headless**, property-tests green vs oracle |
| **P1** | Neural-conduit R3F scene (sequential): demand heartbeat, encoding, filter fire/die, map morph, bins / FOUND latch; DOM chrome + transport + reduced-motion | Slice A & B **sequential demo** plays from the real event log |
| **P2** | Parallel engine: tick scheduler, recursive-halving fork, ordered short-circuit + cancel, combiner merge; parallel viz (fork/merge, per-lane spikes, cancellation) + multithread/thread controls + findFirst⇄findAny | Slice A & B **parallel demo** plays; parallel property/golden suite green |
| **P3** | Polish: cinematic autoplay, bloom/DoF, explainer cards, orbit camera, landing page | Portfolio-ready demo |

---

## 10. Risks & honest cost

- **The multithread button is a feature, not a button** — it ~doubles the engine (split, per-lane
  traversal, combiner, ordered cancellation) and adds a second viz mode. Budget it as its own phase
  (P2).
- **Slice B parallel is the single most error-prone item:** `findFirst` must return
  encounter-order-earliest and cancel later lanes — showing "first lane home wins" would silently
  teach `findAny`. Lean hard on the property test that pins the earliest-index invariant.
- **Neural aesthetic vs correctness are in tension by default:** brains push forward and fire in
  populations; streams pull backward and (sequentially) fire single-file. The retrograde demand
  spike + linear topology + one-spike-per-lane are the deliberate constraints that resolve it. Do
  not relax them for prettiness.
- **Payload legibility:** fast glowing pulses can't carry rich text; identity lives in hue/size +
  a riding label. Keep datasets small (10–12) so the eye can follow.
- **WebGL cost:** shaders/particles/bloom in R3F are the priciest UI in the project — justified only
  because the wow is the point. Keep all non-conduit UI in DOM.

---

## 11. Documented / future (NOT built in the demo)

Specified for completeness; explicitly out of the demo build.

- **Remaining 19 operations** (`flatMap`, `sorted`, `distinct`, `limit`, `skip`, `peek`,
  `takeWhile`, `dropWhile`, `mapToInt/Long/Double`, `reduce`, `toList`, `toSet`, `count`, `sum`,
  `anyMatch`, `allMatch`, `noneMatch`, `forEach`, `forEachOrdered`). Each is a pluggable `Sink`; note
  `sorted`/`distinct` are **barriers** and would break the strict one-at-a-time neural narrative
  (they'd need a "buffer neuron" that holds all pulses before releasing) — a reason they're deferred.
- **Interactive type-aware builder** (op palette + curated lambda menus) and its **Java-ish
  type-checker** (tracks `Stream<T>`/`IntStream`, rejects illegal pipelines with teaching messages).
  The demo uses fixed presets instead.
- **Optimization advisor** (structural analysis over a built AST: filter-placement, `sorted→limit`,
  boxing, parallel-on-small-data). Requires the builder's AST to exist first.
- **Shareable-URL demos** and **puzzles / interview challenge mode.**
- **General parallel mode** across all ops (the full "population brain").

---

## Decision Log

Session 1 = original spec; Session 2 = this neural-demo pivot. Superseded rows struck.

| # | Decision | Chosen | Session |
|---|---|---|---|
| 1 | Source of truth | Reconcile 3 docs; faithful engine is the spine | 1 |
| 2 | Input model | ~~Structured builder as MVP~~ → **fixed presets in demo; builder documented** | 1→2 |
| 3 | Engine fidelity | Real pull-based engine (not scripted) | 1 |
| 6 | Parallel concurrency | Deterministic simulated tick scheduler (not Web Workers) | 1 |
| 7 | Op scope | ~~All 25 ops = MVP~~ → **6 ops built (2 slices); 19 documented** | 1→2 |
| 8 | Trace model | Immutable event log; UI = pure fn of (log, playhead) | 1 |
| 9 | Split strategy | Recursive halving + fork/split tree | 1 |
| 10 | Value model | Tagged union, primitive-vs-boxed, `Order` object domain | 1 |
| 11 | Op contract | JDK-faithful Sink chain + Spliterator pull + flags | 1 |
| 12 | Test strategy | Oracle + fast-check property + golden snapshots (+ mutation) | 1 |
| 13 | Interleave policy | Round-robin, seed varies it to teach non-determinism | 1 |
| 14 | Engine boundary | Pure TS engine (no React) + Zustand | 1 |
| 15 | Build order | ~~Engine-first headless, then viz~~ → **vertical-slice-first: slice built end-to-end incl. viz** | 1→2 |
| 16 | Render tech | ~~SVG/DOM + Framer Motion~~ → **hybrid: react-three-fiber WebGL for the conduit, DOM for chrome** | 1→2 |
| 17 | Log→motion | Events as keyframes; fractional playhead; interpolate | 1 |
| 18 | Design language | Distinctive custom system | 1 |
| 21 | Motion/a11y | Honor prefers-reduced-motion; event-log step-list fallback | 1 |
| 22 | Demo extras | Cut puzzles + shareable URLs | 1 |
| 23 | **Product frame** | **Demo-first: two slices built end-to-end, document the rest** | 2 |
| 24 | **Slices** | **A = grouping; B = short-circuit (findFirst⇄findAny)** | 2 |
| 25 | **Visual metaphor** | **Linear neural conduit; ops = neurons, elements = pulses (fire/die)** | 2 |
| 26 | **Demand direction** | **"Backward brain": retrograde demand spike (pull) vs forward element pulse (push)** | 2 |
| 27 | **Single-file rule** | **One spike in flight (sequential); one per lane (parallel)** | 2 |
| 28 | **Pulse encoding** | **hue=region, size=total, riding DOM label; `map` = size morph** | 2 |
| 29 | **Parallel in demo** | **Built for both slices** (multithread button + 2/4 selector), simulated | 2 |
| 30 | **Slice A parallel** | **Private partial bins per lane → combiner merge** | 2 |
| 31 | **Slice B parallel** | **findFirst = ordered wait+cancel; findAny = first-lane-wins; live toggle** | 2 |
| 32 | **Demo interactivity** | **Cinematic autoplay + transport (step/scrub/toggles); no live editing** | 2 |
| 33 | **Doc deliverable** | **Update this spec in place; built-vs-documented marked** | 2 |
```
