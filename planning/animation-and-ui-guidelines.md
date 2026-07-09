# Animation & Rich-UI Guidelines

Distilled from *Filthy Rich Clients* by Chet Haase & Romain Guy (Addison-Wesley, 2007).
Swing/Java2D-specific API details translated to framework-neutral form so they apply equally
to web (CSS/Web Animations), native mobile, and any modern UI runtime.

---

## ⚠️ MANDATORY — Material Design 3 Fonts & Icons

**All UI built against this document MUST use Material Design 3 fonts and icons strictly.**
No exceptions, no mixed icon sets, no ad-hoc typefaces.

### Icons

- **Source:** [https://fonts.google.com/icons](https://fonts.google.com/icons) — Material Symbols.
- **Style:** Use **Material Symbols** (the variable-font replacement for the older Material Icons).
- **Allowed variants:**
  - **Outlined** (default — preferred for neutral UI affordances)
  - **Rounded** (use only when the brand visual language is soft / friendly)
  - **Sharp** (use only when the brand visual language is technical / editorial)
- **Pick ONE variant per product and stick to it.** Do not mix Outlined and Filled in the same surface.
- **Filled state** is reserved for *active / selected* states (selected tab, active nav item).
- **Sizes:** 20, 24 (default), 40, 48 dp/px. Don't invent intermediate sizes.
- **Weight:** 400 (default). 300 for dense data UIs, 500 for emphasis. Don't go heavier than 500.
- **Optical size (`opsz`):** match to the rendered pixel size (20, 24, 40, 48).
- **Color:** never hard-code black/white. Always tint to the current Material theme's `on-surface`,
  `primary`, or contextual role token.
- **Embedding:** prefer the variable font (`Material Symbols Outlined` / `Rounded` / `Sharp`) over the
  static webfont — it gives you `FILL`, `wght`, `GRAD`, `opsz` as smooth animatable axes.

### Type

- **Source:** [https://fonts.google.com/](https://fonts.google.com/) (Google Fonts).
- **Primary typeface:** **Roboto** (Material 3 default) or **Roboto Flex** if you need variable-font axes.
- **Acceptable alternates** (only one alternate per product, and only if there is a brand reason):
  **Inter**, **Noto Sans**, **DM Sans**, **Open Sans**. **No system stacks. No Times. No Comic Sans.**
- **Use the Material 3 type scale only.** The roles are:
  - **Display** — large, lg, sm
  - **Headline** — large, lg, sm
  - **Title** — large, lg, sm
  - **Body** — large, lg, sm
  - **Label** — large, lg, sm
- Never invent a font size outside this scale. If a design "needs" 17 px, use 16 (`bodyLarge`) or
  14 (`bodyMedium`).
- **Line height, letter spacing, and weight come from the M3 spec** — do not eyeball them.
  Reference: [https://m3.material.io/styles/typography/type-scale-tokens](https://m3.material.io/styles/typography/type-scale-tokens).
- **Load fonts with `font-display: swap`** (web) and preload critical weights to avoid FOIT.
- **Subset to the languages you actually ship.** Don't pull the full 1 MB+ Roboto family if you
  only render Latin glyphs.

### Why this is non-negotiable

Filthy Rich Clients hammers on **consistency** as the foundation of polish (see Ch 19, "the three
rules for non-artist designers"). Mixed icon sets and inconsistent typography read as
amateurish at a subconscious level — every effect, animation, and gradient below in this document
is undermined the moment the icon set drifts. Material Design 3 gives us a single coherent system
that already encodes hierarchy, weight, optical size, dark/light theming, and accessibility.

---

## Table of Contents

- [Part I — Graphics & Rendering Fundamentals](#part-i--graphics--rendering-fundamentals)
- [Part II — Performance](#part-ii--performance)
- [Part III — Composites, Gradients, Image Processing](#part-iii--composites-gradients-image-processing)
- [Part IV — Overlays, Glass Panes, Layered UI](#part-iv--overlays-glass-panes-layered-ui)
- [Part V — Animation Fundamentals](#part-v--animation-fundamentals)
- [Part VI — Smooth Moves: Avoiding Choppiness](#part-vi--smooth-moves-avoiding-choppiness)
- [Part VII — Animation Engine Concepts](#part-vii--animation-engine-concepts)
- [Part VIII — Static Effects (Blur, Shadow, Reflection, Highlight, Sharpen)](#part-viii--static-effects)
- [Part IX — Dynamic Effects](#part-ix--dynamic-effects)
- [Part X — Animated Transitions](#part-x--animated-transitions)
- [Part XI — Design Process](#part-xi--design-process)
- [Part XII — Cheat Sheet (synthesized)](#part-xii--cheat-sheet-synthesized)

---

# Part I — Graphics & Rendering Fundamentals

### Never block the UI thread
Long-running work (I/O, network, computation) on the UI/main thread freezes the entire interface.
Most "the UI feels slow" complaints are blocked-thread problems, not rendering problems. Run heavy
work on a worker and post results back to the UI thread.

### All UI mutation belongs on the UI thread
Constructors, property setters, repaint requests — anything that touches widget state must run on
the UI dispatch thread, even initial construction. Background threads marshal updates back via the
framework's "post to UI" mechanism (`requestAnimationFrame`, `postMessage`, `dispatch_async(main)`,
etc.). Multithreaded UI is the source of intermittent demo-day deadlocks.

### Coalesce repaint requests; don't paint synchronously unless you must
Prefer asynchronous "schedule a repaint." Multiple requests for the same region get coalesced into
a single paint pass. Synchronous immediate-paint paths skip coalescing and waste cycles.

### Use the smallest dirty rectangle you can
Targeted invalidation (`repaint(x, y, w, h)` / CSS containment / explicit dirty rects) is
dramatically cheaper than whole-component repaints. The book's GlassPanePainting demo went from
repainting 553×394 px to 4×10 px per frame — an order-of-magnitude win.

### Don't double-buffer on top of a toolkit that already double-buffers
"Triple buffering" by maintaining your own offscreen image adds copies and latency without
smoothing. Let the platform manage its back buffer.

### Mark non-opaque components honestly
If a component has rounded corners, transparency, or any translucency, declare it non-opaque.
Otherwise the toolkit's "skip repainting items behind opaque widgets" optimization leaves stale
pixels and visual artifacts.

### Shared rendering state is persistent and dangerous
A graphics context (or canvas state) passed in by the framework is reused for sibling/parent
rendering. Setting transform/color/composite on it has side effects outside your method. Either
work on a *cloned* copy, or *save and restore* state you change (`ctx.save()` / `ctx.restore()` on
web canvas; same pattern everywhere else).

### Never depend on graphics state set up by another component
Cross-platform: even when it "works on your machine," another platform may not preserve state the
same way. (Authors' anecdote: a JavaOne demo died on stage because macOS didn't preserve
antialiasing state across components the way Windows did.)

### Combine transforms; don't clobber them
Use methods that *concatenate* a new transform (translate, scale, rotate) onto the current one.
Replacing the entire matrix discards the offset that locates your component.

### Render hints are a quality-vs-performance tradeoff — make it explicit
Nearest-neighbor: fastest, ugliest. Bilinear: smooth scaling. Bicubic: best edges, slowest.
Antialiasing: real cost per primitive. Defaults are tuned for performance; opt into quality only
where it matters.

### Match text rendering to desktop settings
Read the host OS's font / anti-aliasing / LCD-subpixel preferences and apply them so text matches
native applications. Hard-coding one antialiasing mode looks wrong somewhere.

### Honor the clip rectangle
> **"The most important optimization rule of graphics-oriented applications is to never draw
> anything unnecessarily."**

Always retrieve the current clip and avoid issuing draw calls outside it.

### Prefer thin lines and dedicated primitives
1-pixel-wide lines are dramatically faster than wide lines (which require caps + joins). Use the
dedicated rectangle/line primitives instead of generic shape APIs — the renderer can optimize the
specific case but not the generic one.

---

# Part II — Performance

### Cache scaled image versions; never repeatedly scale at paint time
> **"The fastest operation is the one you don't have to perform."**

If you'll display an image at the same size repeatedly, scale once and blit the cache.

### Use progressive bilinear downscaling for large reductions
Direct bilinear at small target sizes drops too many source pixels. Iteratively halve with bilinear
filtering until you reach the target. The book reports ~6 ms vs. 132 ms for a typical reduction.

### Use display-compatible image formats
A pixel layout matching the display ships as a single block-memory copy; a mismatched format
requires per-pixel transformation. The hit is huge.

### Don't defeat GPU/system image acceleration
Two things make the runtime give up on accelerating an image:
1. Grabbing direct access to the raw pixel array.
2. Repeatedly re-rendering *into* the image. Acceleration only pays off if the image is read far
   more often than it is written.

### Cache complex rendering into "intermediate images"
Anything drawn repeatedly the same way — a complex shape, antialiased text, a gradient, a scaled
image — render once into a cached buffer, then blit. *"It is a lot faster to copy an image than to
perform a complex rendering operation."* Use weak/soft references so the runtime can reclaim under
memory pressure.

### Match intermediate-image type to content
Opaque image for opaque content. 1-bit alpha for hard-edged shapes. Full alpha for antialiased
content and soft shadows. Wrong type either over-pays for memory or under-renders quality.

### Profile before optimizing
> **"Premature optimization is the root of all evil." (Knuth, quoted by the authors.)**

Ask: is this big enough, repainted often enough, perceptible enough, to justify added code
complexity? *"The more you optimize your code, the messier it gets, and the messier it gets, the
more expensive it is to maintain."*

### Benchmark on the platforms your users have
A trick that's 800× faster on Windows may make zero difference on macOS. Test where it matters.

---

# Part III — Composites, Gradients, Image Processing

### Composites enable translucency — central to a rich UI
Source-over (SrcOver) with alpha is the workhorse. SrcIn is the trick for "draw only where the
destination already has content" — used for soft shadows and clipping fills to silhouettes.

### Compose effects in an offscreen buffer, then blit
Compositing pixels onto a complex live destination produces unpredictable results. Compose into a
scratch image, then copy.

### Cache rendered gradients as images
A 1-pixel-wide cached gradient stretched to fill can be up to ~800× faster than recomputing each
paint on some pipelines. Re-check on each target platform.

### Prefer cyclic / repeating gradients where geometry allows
They skip per-pixel boundary checks and run measurably faster.

### Light from above
Shading conventions (scrollbar tracks, panel bevels, button highlights) should assume a light
source from the top — highlights and shadows then match the physical world the eye expects.
Material 3's elevation model already follows this; do not invert it.

### Keep image filters immutable
A filter shouldn't change state mid-lifetime; immutability lets clients share and cache safely.

### Don't filter large images at paint time
A 3×3 convolution on 640×480 is already ~15 million operations. Pre-compute and cache.

### Kernels: odd-sized, small, and separable
- Even-sided kernels aren't centered on a pixel and produce unbalanced visuals.
- Larger kernels cost quadratically more.
- Decompose separable filters into horizontal + vertical 1-D passes (box blur: 3+3 ops/px instead
  of 9).

### Clamp filter results to the valid range
Sharpening/contrast can drive components below 0 or above 255, producing garish artifacts unless
clamped.

---

# Part IV — Overlays, Glass Panes, Layered UI

### Use overlay layers for ephemeral overlays — but keep them hidden when unused
A visible full-window overlay forces every component beneath it to repaint on every refresh, even
if transparent. Make overlays invisible by default; show only when needed.

### Make overlays mouse-transparent where appropriate
A transparent overlay still blocks cursor changes (e.g., the I-beam over a text field) and hover
effects on widgets beneath. Have your overlay declare which pixels it owns; pass-through the rest.
Honor the alpha channel — don't capture clicks on fully transparent pixels.

### Blocking input is a feature, not a bug
If your overlay represents a "busy" or modal state, swallow mouse + keyboard events, take focus,
and disable focus-traversal keys. Don't let the user click through to widgets they can't see.

### One glass pane per window
When you need stacking, use a layered-pane abstraction explicitly. Stacking multiple overlays is a
recipe for input-handling bugs.

### Don't fight a layout manager — transition through a separate animation container
When animating components between two layouts, run the transition in an absolute-positioned
scratch container and swap it in for the real container. Let the real layout managers do their
work at the endpoints.

---

# Part V — Animation Fundamentals

### Animate, don't teleport
> *"Filthy Rich Clients try to get away from the traditional model in which objects, GUI elements,
> text, and application state simply change immediately. There should be movement and transition
> in the application, not abrupt and discontinuous change."*

### Animation is time-based, not step-based
Drive every animation by elapsed wall-clock time, never by per-frame increments. A pixel-per-step
animation that looks great on your dev machine will run 10× too fast on tomorrow's hardware. The
formula:

```
value = start + ease(elapsedTime / duration) × (end - start)
```

### Aim for 20–30 fps as the smoothness floor; 60 fps for moving content
Below ~20 fps the eye sees discrete steps. Movies run at 24. Games push 60+ because their
frame-to-frame deltas are huge; UI animations don't have that problem. Anything above the display
refresh rate is wasted.

### A consistent lower frame rate beats a higher one with stutter
> *"It is far better to set a frame rate that you know is achievable in most situations than to
> have a jumpy animation."*

Users notice stutter far more than they notice the difference between 30 and 60 fps.

### Invest in *perceived* performance first
The fading animation that looked smoother than a faster motion animation taught the authors:
*what it looks like* matters more than what the FPS counter reads.

### Know your timer's resolution
Common platform timers floor to ~15–16 ms increments. Don't trust millisecond-precision
measurements of short operations. Don't try to animate at >60 fps using a timer with 16 ms
granularity.

### Don't trust the first-frame delta
Skip it or warm up before measuring.

### Use a timer that delivers callbacks on the UI thread
Background timers that deliver on random threads force manual cross-thread posting and create
deadlock risk. On web: `requestAnimationFrame`. Native: the framework's animation/display-link
primitive.

---

# Part VI — Smooth Moves: Avoiding Choppiness

Three contributors to choppiness: **timing, color contrast, vertical retrace.**

### Minimize per-pixel color change between frames
The *amount of change of any single pixel* is more visible than the *total* change across a region.
Implications:
- Smaller per-frame motion increments are visibly smoother.
- Lower contrast (object color closer to background) animates more smoothly.
- Antialiased edges hide jaggy motion.
- Irregular shapes (rounded corners, curves, images) hide motion artifacts better than rectangles
  with straight vertical edges.

### Use nonlinear motion curves
Linear interpolation looks unnatural — real-world objects accelerate, decelerate, anticipate,
settle. Linear motion also exposes any timing hiccup as a visible pause. Easing smooths both
perception of motion *and* perception of timing inconsistency.

### Motion blur is a legitimate trick
Movies blur each frame; that's why 24 fps looks smooth. Drawing trailing ghost images of an
animated object on previously occupied positions creates the same effect.

### Don't worry too much about vertical-retrace tearing
The standard smoothness tricks (low contrast, small per-frame deltas, irregular edges) make tearing
imperceptible. Modern compositing OSs eliminate it entirely. Platform-specific v-sync hacks are
rarely worth the complexity.

---

# Part VII — Animation Engine Concepts

### Express animations as: *duration, target property, start value, end value, interpolator*
The framework drives time forward; you describe the destination. This is the same model CSS
transitions, Core Animation, Web Animations, Compose, SwiftUI, and Flutter all adopt.

### Easing types
- **Linear** — almost never right for spatial motion.
- **Discrete** — for stepped state changes (no in-between).
- **Spline (cubic Bézier)** — the standard general-purpose easing.
  - **Ease-in/ease-out** (both ends decelerated) — the most natural default.
  - **Ease-in** — entering from rest.
  - **Ease-out** — settling at rest.

### Compose multi-segment motion from keyframes
For complex paths (a car through curves and straightaways), split into segments, each with its own
easing. Match exit and entry speeds at segment boundaries to avoid jolts.

### Compute easing by transforming *time*, not the value
This is the elegant insight: easing isn't applied to the value, it's applied to the time fraction.
The position equation stays linear.

```
t' = ease(t / duration)         // nonlinear time
value = start + t' × (end - start)   // linear position
```

### Animations must respond to opposite events mid-flight
If the user hovers a button (start animation), then unhovers before it finishes, the reverse must
pick up from the *current* state, not the end. Symmetrical, interruptible animations are essential
to a responsive feel.

### Triggers tie animations to lifecycle events
Click, focus, mouse enter/exit, timer, state-change. Setup is one-shot at construction; the
framework dispatches the trigger.

---

# Part VIII — Static Effects
*(Blur, Reflection, Shadow, Highlight, Sharpen)*

### Use blur to focus attention
Out-of-focus areas direct the eye to in-focus ones. Apply gentle blur to background context or
supporting labels so the eye lands on the actionable widget. Game menus and photography do this;
UIs should too.

### Use slight blur to deemphasize without hiding
Subtle blur communicates "this is informational, not the primary action."

### Use Gaussian blur, not box blur, on high-contrast content
Box blurs over hard edges produce visible rectangular artifacts; Gaussian's bell-curve weighting
gives natural soft falloff.

### Reflections and drop shadows add realism cheaply
A reflection: vertically flipped, faded, optionally blurred copy. A drop shadow: blurred, darkened
silhouette of the shape. Both transform perceived polish for modest code.

### Real-world shadows have soft edges
Sharp drop shadows betray their digital origin. Always blur shadows proportional to their size.
Diffuse light produces soft shadows; only point lights produce hard ones, and point lights don't
exist in nature. Material 3's elevation tokens already encode this — use them.

### Use highlights to communicate interactivity
Brightening, glow, color shift, border — all say "this element is alive and clickable." In Material
3 these map to `state-layer` overlays at standardized opacities.

### Use translucent text highlighting for readability on busy backgrounds
A soft, semi-transparent halo behind text keeps it legible without committing to a solid plate.

### Sharpen subtly
The most-abused effect. Small radii (~1 px), modest amounts (~70%), thresholds to skip subtle
areas. The result should be invisible until you compare side by side.

---

# Part IX — Dynamic Effects

### Animations must be short and simple
**The single most-emphasized rule in the book.** Typical UI animation duration is **16–300 ms**.
Anything longer feels sluggish.

### Pulsing/looping effects are the exception
- **Fast pulses (<500 ms cycle)** — urgency / error / attention demand.
- **Slow pulses (500 ms – 1 s cycle)** — indeterminate progress / "I'm working." Prefer this to a
  never-ending spinner when duration is unknown.

### Keep pulse transitions subtle
Don't oscillate between full red and full green. A faint glow between barely-visible and
slightly-visible is enough; anything stronger becomes nauseating.

### Fade things in and out — don't pop them
Anything appearing/disappearing should do so gradually: menus, tooltips, dialogs, palette panels,
search results. Brief fades preserve continuity.

### Cross-fade when swapping equal-importance content
Slideshow images, text-field captions, before/after states. Implement as simultaneous
fade-out-old + fade-in-new with inverse alphas.

### Animate location changes — never teleport
If the layout reflows, animate affected components into their new positions. The user's spatial
sense follows; instant rearrangement forces re-orientation.

### Use the spring effect for launch feedback
A quick scale-up-and-fade-out (macOS-style) confirms a launch action. Paint the spring *above* the
icon for launch confirmation; paint it *behind* the icon for mere hover affordance. The difference
matters: in front says "you launched it," behind says "you can launch this."

### Animate failed drag-and-drop back to origin
If a drop misses its target, animate the item back. Otherwise the user thinks the drag succeeded.

### Force a repaint when animating framework-invisible state
If you animate an internal field the toolkit can't observe, the setter must explicitly request
a repaint.

### Don't animate while the user is actively interacting
Animating elements the user is trying to click is hostile. Either disable input during animation,
or freeze the animation in response to interaction. Strong default: ignore input clicks during
transitions entirely.

---

# Part X — Animated Transitions

### Maintain logical, visual connection between states
> *"An application GUI animates between its different states to create a smoother and more logical
> flow for the user."*

The wipe-and-replace model disorients. The animated-transition model — move shared elements, fade
out departing, fade in arriving — keeps the user oriented.

### Three standard transition types
- **Present in both states** — animate position/size between layouts.
- **In old but not new** — fade out (or slide out).
- **In new but not old** — fade in (or slide in).

### Keep transitions short
The 16–300 ms rule. Screen-scale transitions can stretch to ~500 ms with strong easing — too long
for a hover.

### Scope transitions to the region that's actually changing
Leave stable chrome alone. Animating things that don't change wastes user attention and CPU.

### Transitions work *with* layout managers, not against them
Run the transition in an absolute-positioned scratch container; let the real layout managers
arrange the endpoints. The two endpoints can even use different layout managers.

### Use intermediate images for transition performance
You don't need to re-render the actual component during the animation if it looks the same every
frame. Snapshot each component to an image once; animate that image's position/alpha. (Exception:
scaling components needs real re-rendering — scaled images look terrible, unless the component is
itself an image.)

---

# Part XI — Design Process

### Design on paper before code
The point isn't UML; it's mapping features, workflow, and screen transitions so you can identify
*where animation and effects belong* in the user journey.

### Vision mockup first, then workflow, then per-screen mockups, then code
One or two high-fidelity screens early to set the visual tone — dark/light, gradient style,
shadow style, color palette. The vision motivates the team; it doesn't constrain implementation.

### Use layers obsessively in the graphics editor
The book's Aerith lobby screen used 47 layers. Layers let you swap alternatives in seconds and
export individual assets cleanly.

### Use rulers/guides and translate measurements directly into layout code
Pixel-level alignment separates "polished" from "almost-polished." Combine with the M3 8 dp grid.

### The three rules for non-artist designers
1. **Steal ideas elsewhere.** Apple, Material 3 reference apps, well-designed web apps.
2. **Pay attention to the details.** Every pixel should be intentional.
3. **Be consistent.** Adapt borrowed elements to fit your application's coherence.

### Use a small palette
Three or four colors is good; five or six is the upper bound. Material 3's tonal palette gives you
a coherent scheme — use it, don't pick colors at random.

### For gradients, prefer colors close to each other in hue
Subtle two-tone gradients look elegant; high-contrast gradients look like web-1.0 buttons.

### Implementation will never match the mockup 100%
Some effects are too expensive; some are platform-specific. The mockup is a target, not a
contract.

### Use effects to make applications more *effective*, not more *effect-ridden*
Every animation, every effect, must improve the UX. Gratuitous polish that distracts or slows the
workflow is a regression.

---

# Part XII — Cheat Sheet (synthesized)

## Timing — recommended durations

| Use case | Duration |
|---|---|
| Hover morph (button → arrow) | ~150 ms |
| Layout reflow, slide | 200 ms |
| Fade in/out (overlay, tooltip) | 100–250 ms |
| Spring / launch confirmation | ~250 ms |
| Screen-scale transition (whole pane) | up to 500 ms |
| Pulse — demands attention | <500 ms cycle |
| Pulse — indeterminate progress | 500 ms – 1 s cycle |
| **Absolute upper bound for any one-shot UI animation** | **~300 ms** |

These align with Material 3's motion duration tokens (`short1–4`, `medium1–4`, `long1–4`,
`extraLong1–4`); prefer the M3 tokens in code.

## Easing

| Scenario | Curve |
|---|---|
| Default UI motion | Ease-in/ease-out (both ends decelerated) |
| Entering from rest | Ease-in |
| Settling at rest | Ease-out (M3 *emphasized-decelerate*) |
| Stepped state (no in-between) | Discrete |
| Linear motion | **Almost never** |

Apply easing to **time**, not value. In Material 3 these correspond to the *standard*,
*emphasized*, *emphasized-decelerate*, and *emphasized-accelerate* easing tokens — use those tokens
in code, don't hard-code Bézier control points.

## Frame rate & smoothness

- Target ≥ 20–30 fps; aim for 60 fps for moving content.
- Don't exceed display refresh rate.
- **Consistency > peak rate.** Drop to a frame rate you can hit reliably.
- Smoothness perception is driven by per-pixel color delta more than raw FPS.

## Accessibility & restraint

- Short, simple, purposeful. Decorative animation is dangerous in excess.
- Don't animate during user interaction — freeze or ignore input.
- Respect `prefers-reduced-motion` (web) / accessibility motion settings (native). Replace large
  movement with cross-fade or no animation when set.
- Don't convey accessibility-critical state changes by animation alone — pair with text/icon/aria.

## Performance

- The fastest operation is the one you don't have to perform — cache aggressively.
- Honor dirty rectangles / clip; never repaint what isn't visible.
- Don't block the UI thread.
- Use display-compatible image formats; let the system manage acceleration; don't grab raw pixels.
- Profile before optimizing. Premature micro-optimization is the root of all evil.

## Polish

- Light from above. Soft shadows. Subtle gradients. Soft edges. (Material 3 elevation tokens
  already encode this.)
- Use blur, brightness, color shift to direct the eye.
- Use fades and motion to preserve spatial sense across state changes.
- Maintain a logical and visual connection between successive application states — arguably the
  conceptual core of the entire book.

## Process

- Design on paper. Then high-fidelity mock. Then code.
- Steal good ideas, adapt for consistency, sweat the pixels.
- Small palette (3–6 colors), close-hued gradients, M3 tonal system.
- **Strictly Material Design 3 fonts and icons** — Roboto family + Material Symbols from
  [fonts.google.com/icons](https://fonts.google.com/icons). No mixing.
- Verify on multiple platforms; appearance, timing resolution, and GPU support all vary.

---

## Source

- Book text extracted to: `ebooks/_extracted/frc_full.txt`
- Original: `ebooks/Filthy Rich Clients, 2007 bbbbb.pdf`
- Material Design 3 reference: [https://m3.material.io](https://m3.material.io)
- Material Symbols (icons): [https://fonts.google.com/icons](https://fonts.google.com/icons)
- Google Fonts (typography): [https://fonts.google.com](https://fonts.google.com)
