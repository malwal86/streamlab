# Coding Standards from Three Classics

A consolidated reference of coding and design principles drawn from three books in `ebooks/`:

1. **A Philosophy of Software Design** (2nd ed.) — John Ousterhout
2. **The Pragmatic Programmer: From Journeyman to Master** — Andy Hunt & Dave Thomas
3. **The Design of Design: Essays from a Computer Scientist** — Fred Brooks

Each section preserves the original book's terminology so you can search back to the source.

---

## Quick Index

- [Part I — A Philosophy of Software Design (Ousterhout)](#part-i--a-philosophy-of-software-design-ousterhout)
  - [Design principles (summary list)](#posd-design-principles-summary)
  - [Red flags](#posd-red-flags)
  - [Per-chapter principles](#posd-per-chapter)
- [Part II — The Pragmatic Programmer (Hunt & Thomas)](#part-ii--the-pragmatic-programmer-hunt--thomas)
  - [All 70 numbered tips](#pp-tips)
  - [Named concepts](#pp-named-concepts)
- [Part III — The Design of Design (Brooks)](#part-iii--the-design-of-design-brooks)
  - [Per-chapter principles](#dod-per-chapter)
  - [Cross-cutting lessons from case studies](#dod-cross-cutting)
- [Part IV — Where the three books agree (and disagree)](#part-iv--where-the-three-books-agree-and-disagree)

---

# Part I — A Philosophy of Software Design (Ousterhout)

> The core thesis: **complexity is the central problem of software design.** Every principle in the book is judged by whether it reduces complexity.

<a id="posd-design-principles-summary"></a>
## Design Principles — the book's own summary list

1. Complexity is incremental: you have to sweat the small stuff.
2. Working code isn't enough.
3. Make continual small investments to improve system design.
4. Modules should be deep.
5. Interfaces should be designed to make the most common usage as simple as possible.
6. It's more important for a module to have a simple interface than a simple implementation.
7. General-purpose modules are deeper.
8. Separate general-purpose and special-purpose code.
9. Different layers should have different abstractions.
10. Pull complexity downward.
11. Define errors out of existence.
12. Design it twice.
13. Comments should describe things that are not obvious from the code.
14. Software should be designed for ease of reading, not ease of writing.
15. The increments of software development should be abstractions, not features.
16. Separate what matters from what doesn't matter and emphasize the things that matter.

<a id="posd-red-flags"></a>
## Red Flags

Use these as triggers in code review. When you spot one, stop and look for a redesign that eliminates it.

| Red flag | Meaning |
|----------|---------|
| **Shallow Module** | Interface for a class/method isn't much simpler than its implementation. |
| **Information Leakage** | A design decision is reflected in multiple modules. |
| **Temporal Decomposition** | Code structure follows order of execution rather than information hiding. |
| **Overexposure** | API forces callers to learn rarely used features in order to use commonly used ones. |
| **Pass-Through Method** | A method does almost nothing except pass arguments to another with a similar signature. |
| **Repetition** | A nontrivial piece of code is repeated. You haven't found the right abstraction. |
| **Special-General Mixture** | Special-purpose code is not cleanly separated from general-purpose code. |
| **Conjoined Methods** | Two methods are so coupled you can't understand one without the other. |
| **Comment Repeats Code** | All the comment's info is already obvious from adjacent code. |
| **Implementation Documentation Contaminates Interface** | Interface comment describes details not needed by users. |
| **Vague Name** | A name so imprecise it doesn't convey useful information. |
| **Hard to Pick Name** | Can't come up with a precise, intuitive name — usually means the entity conflates ideas. |
| **Hard to Describe** | Variable/method docs must be long to be complete — abstraction is weak. |
| **Nonobvious Code** | Reader can't grasp behavior at a quick reading. |

Informal red flags also mentioned in the text:

- **Tactical Tornado** — a prolific programmer who codes fast but tactically, leaving a wake of destruction.
- **False Abstraction** — abstraction that hides what users actually need to know (e.g. `backspace()` on a text class).
- **Classitis** — proliferation of small shallow classes (length rules taken to extremes).
- **Need for extensive documentation** — design is probably not right.
- **Method used in only one place** — possible over-specialization.
- **Caller writes lots of glue code** — possible over-generalization.
- **Adjacent layers with the same abstraction** — usually pass-through methods or shallow decorators.
- **Long comment needed to describe a variable/method** — the underlying abstraction is unclean.

<a id="posd-per-chapter"></a>
## Per-Chapter Principles

### Ch 2 — The Nature of Complexity
- **Complexity** is anything about the structure of a system that makes it hard to understand or modify.
- It is what a developer *experiences* at a moment in time when trying to get something done. So it's weighted by frequency: isolating complexity where it's rarely touched is almost as good as eliminating it.
- Complexity is **more apparent to readers than writers**. Optimize for the reader.
- **Three symptoms:** change amplification, cognitive load, unknown unknowns. The last is the worst — antidote is obvious code.
- **Two causes:** dependencies (unavoidable, minimize and make obvious) and obscurity (often signals a design flaw, not just a docs gap).
- Complexity is **incremental**. Adopt zero tolerance.

### Ch 3 — Working Code Isn't Enough
- **Tactical programming** — "just make it work" — accumulates complexity. **Strategic programming** — producing a great design that also works — requires an investment mindset.
- Spend ~10–20% of dev time on proactive design investment and on reactive cleanup. Payback in 6–18 months.
- Technical debt compounds. Don't say "after the crunch" — delays become permanent.
- **Spaghetti code in a startup is nearly impossible to fix.** Great engineers want clean codebases.

### Ch 4 — Modules Should Be Deep
- A module's **interface should be much simpler than its implementation**. Cost ≈ interface complexity; benefit ≈ functionality.
- Interface has formal (signatures, types, exceptions) and informal (behavior, ordering, side effects) parts; the informal usually dominates and lives in comments.
- **Abstraction failures:** including unimportant details (high cognitive load) or omitting important ones (false abstraction).
- Examples of deep modules: Unix file I/O (5 calls), garbage collectors (no interface).
- **Make the most common usage the simplest.** Hide rarely used features behind a separate mechanism; provide sensible defaults.
- Reject "every method over N lines must be split" — it produces classitis.

### Ch 5 — Information Hiding (and Leakage)
- **Information hiding (Parnas):** each module encapsulates design decisions in its implementation, not its interface.
- `private` is not the same as information hiding; getters/setters leak just as much as public fields.
- **Information leakage:** the same design decision is reflected in multiple modules. Often back-door (shared knowledge with no interface link).
- **Temporal decomposition** (structuring by execution order: read → modify → write) almost always leaks information. Focus on knowledge required, not order.
- Sometimes combining classes deepens the resulting class and simplifies callers.
- **Provide sensible defaults; "do the right thing"** — best features are the ones users get without knowing they exist.
- Information hiding applies *inside* a class too: minimize the number of places each instance variable is used.

### Ch 6 — General-Purpose Modules Are Deeper
- **Over-specialization is the single greatest cause of complexity.**
- Sweet spot: **somewhat general-purpose** — implementation reflects today's needs, interface is general enough for multiple uses.
- Ask: What is the simplest interface that covers all my current needs? In how many situations will this method be used? Is the API easy for the current use?
- **Push specialization upward** (into top-level code) or **downward** (into device-driver-like modules). Keep the middle general.
- **Eliminate special cases in code** — design the normal case to handle edges automatically (e.g., represent "no selection" as an empty selection).

### Ch 7 — Different Layer, Different Abstraction
- If adjacent layers have similar abstractions, that's a red flag.
- **Pass-through methods** are pure overhead. Fix by exposing the lower class, redistributing functionality, or merging classes.
- Duplicate interfaces are OK when each implementation adds distinct value (dispatchers; multiple device drivers).
- **Decorators are often shallow.** Before creating one, consider adding to the underlying class, merging with the use case, or combining decorators.
- **Pass-through variables** force every method on the path to know about them. Fixes: shared state object, global (poor), or a **context object** (least-bad) with mostly immutable fields.

### Ch 8 — Pull Complexity Downwards
- It is more important for a module to have a simple interface than a simple implementation. Most modules have more users than developers.
- **Configuration parameters often push complexity up** — ask whether users can actually choose better than the module can.
- Each module should solve its problem completely.
- *Only* pull complexity down when it's closely related to existing functionality, simplifies things elsewhere, and simplifies the interface.

### Ch 9 — Better Together Or Better Apart?
- Subdivision has real costs (more components, interfaces, separation, duplication).
- **Bring together if:** they share information, they're used together (bidirectionally), they overlap conceptually, or one can't be understood without the other.
- Bring together to simplify the interface or eliminate duplication.
- **Splitting methods:** length is not enough reason. Two good splits — extracting a subtask (parent interface unchanged) or splitting one method that was doing two unrelated things. Each result must be simpler in isolation.
- **Depth > length.** Make functions deep, then short enough to read.

### Ch 10 — Define Errors Out of Existence
Reduce the number of places where exceptions are handled. Techniques:
- **Define errors out of existence** — redefine semantics so the error can't arise (e.g., Tcl `unset` = "ensure variable no longer exists"; Python slices clamp).
- **Mask exceptions** at a low layer so higher layers never see them (TCP retransmits, NFS retries).
- **Exception aggregation** — let exceptions propagate; one handler near the top owns "how to generate error responses." Combine with **error promotion** (crash a server on object corruption instead of having a specialized recovery path).
- **Just crash** for rare, hard, unworth-recovering errors (out-of-memory, internal inconsistencies). Use wrappers like `ckalloc`.
- Don't define unnecessary exceptions; throwing exceptions punts complexity to callers.

### Ch 11 — Design It Twice
- Design every major decision at least twice with **radically different** approaches.
- List pros and cons (ease of use, interface simplicity, generality, performance).
- Cost is small (an hour or two per class) vs. the cost of building the wrong thing.
- At sufficient problem scale, no one gets it right the first time.

### Ch 12–13 — Comments
- Comments are **essential to abstraction** — they capture what the designer knew but couldn't express in code.
- The guiding principle: comments must add information **not deducible from the code next to them**.
- Categories: interface, data-structure member, implementation, cross-module.
- Every class needs an interface comment; every class variable a comment; every method an interface comment.
- **Lower-level comments add precision** — units, inclusive/exclusive boundaries, null meaning, ownership/freeing, invariants.
- **Higher-level comments add intuition** — what the code is trying to do, not what each line literally does.
- "How we get here" comments (what conditions caused this code to run) are very useful.
- Interface comments should NOT describe implementation. Users shouldn't need to read the body.
- Implementation comments are **what and why, not how**. Reference bug IDs for tricky fixes.
- Cross-module docs: put them where developers will naturally encounter them, or in a `designNotes` file referenced from short pointers in code.
- "Obvious" is from the reader's perspective — if a reviewer says it isn't obvious, it isn't.

### Ch 14 — Choosing Names
- Names create an image; ask "if someone saw this name in isolation, how closely would they guess what it refers to?"
- **Precise** (`numActiveIndexlets`, `cursorVisible`, `charIndex/lineIndex`) over generic (`count`, `status`, `result`).
- **Distinguishable** for similar concepts (`struct sock_base` vs. `struct inet_sock`).
- Boolean names should be predicates (`cursorVisible` not `blinkStatus`).
- Loop iterators `i`, `j` are fine if scope is small.
- **Hard to name = poorly defined** — the entity probably conflates ideas.
- Use names **consistently**: one common name per purpose, never reuse for another purpose, keep the purpose narrow.
- Drop generic suffixes (`Object`/`Field`) and Hungarian type prefixes — IDEs handle that.
- One Go-style rule worth keeping: "The greater the distance between a name's declaration and its uses, the longer the name should be."

### Ch 15 — Write the Comments First
1. Write the class interface comment.
2. Write interface comments and signatures for the most important public methods (empty bodies).
3. Iterate until the structure feels right.
4. Write declarations + comments for key instance variables.
5. Fill in method bodies, adding implementation comments as needed.

Benefits: better comments; better design (forces early thinking about abstractions); more fun. **If you can't describe a method or variable simply and completely, the abstraction is probably wrong.**

### Ch 16 — Modifying Existing Code
- Don't ask "what's the smallest change that does what I need?" Ask "what would the design look like if it had been built with this change in mind from the start?"
- Every modification is a chance to improve the design.
- Keep comments **near the code they describe** — not in the commit log.
- Avoid duplication — document each decision in exactly one place.
- Check diffs before committing — catches stale comments, leftover TODOs, debug code.
- Higher-level comments are easier to maintain because they aren't tied to code details.

### Ch 17 — Consistency
- Consistency is cognitive leverage and lets assumptions be safe.
- Apply at names, style, interfaces with multiple implementations, design patterns, and **invariants** (always-true properties that reduce special cases).
- Document conventions; enforce with automated checkers; use code reviews to teach (be nit-picky).
- **"When in Rome..."** — mimic existing patterns in unfamiliar files.
- Don't change established conventions just because you have a "better idea."
- Don't force dissimilar things into the same shape just for surface consistency.

### Ch 18 — Code Should Be Obvious
- Obvious code: a reader skims quickly and their first guesses are right.
- Increase obviousness via good names, consistency, whitespace, strategic comments.
- Decreases obviousness: event-driven flow, generic containers (`Pair`), declared-type ≠ allocated-type, code violating reader expectations.
- "Software should be designed for ease of reading, not ease of writing."

### Ch 19 — Software Trends
- **Implementation inheritance** creates parent/subclass dependencies (information leakage). Prefer composition.
- **Agile** is right to iterate but tempts you to defer abstractions. The increments should be **abstractions, not features**.
- **Unit tests** enable refactoring and are higher-leverage than system tests for design.
- **TDD** is feature-focused, hence tactical — Ousterhout opposes it as a *default* practice (he wants abstractions, not features, to be the unit of work). Exception he grants: TDD for bug fixes. **For this project we follow [`tdd-guidelines.md`](./tdd-guidelines.md), which adopts TDD as the standard** — see "Reconciling Ousterhout's TDD skepticism" in [Part IV](#part-iv--where-the-three-books-agree-and-disagree) below for why that's not a contradiction.
- **Design patterns** good when they fit — don't force a problem into one.
- **Getters/setters** are shallow methods that defeat information hiding.

### Ch 20 — Designing for Performance
- Clean and fast usually coexist; simpler code tends to be faster.
- Develop awareness of expensive operations (network, disk I/O, allocation, cache misses) via microbenchmarks.
- **Deep classes are more efficient** — fewer layer crossings.
- Don't optimize blindly. Measure before/after; roll back changes that don't help (unless they also simplify).
- **Design around the critical path.** Imagine the minimum code that must run for the common case; redesign reality toward that ideal.
- Remove special cases from the critical path — ideally one test at the start covers all of them; off-path branches handle them in code optimized for simplicity, not speed.

### Ch 21 — Decide What Matters
- Separating what matters from what doesn't is the heart of design.
- Look for **leverage** — things that, once solved or known, simplify many others.
- Minimize what matters (fewer required parameters; sensible defaults; auto-compute when possible).
- Emphasize what matters via **prominence**, **repetition**, **centrality**.
- Two mistakes: treating too many things as important (clutter), or failing to recognize that something *is* important (unknown unknowns).
- **Good taste = the ability to distinguish what matters from what doesn't.**

---

# Part II — The Pragmatic Programmer (Hunt & Thomas)

> Organized around 70 numbered tips. The book's voice: take responsibility, automate, stay flexible, and write code that survives.

<a id="pp-tips"></a>
## All 70 Numbered Tips

### Ch 1 — A Pragmatic Philosophy
- **Tip 1: Care About Your Craft.** Worth building only if you genuinely care about doing it well.
- **Tip 2: Think! About Your Work.** Never code on autopilot. Critically appraise every decision in real time.
- **Tip 3: Provide Options, Don't Make Lame Excuses.** When something breaks, present a recovery path instead of blame.
- **Tip 4: Don't Live with Broken Windows.** Bad designs, wrong decisions, or rough code signal decay. Fix or board up immediately.
- **Tip 5: Be a Catalyst for Change** ("Stone Soup"). Build something small and good; let others join the ongoing success.
- **Tip 6: Remember the Big Picture** ("Boiled Frog"). Disasters accumulate gradually — keep looking up.
- **Tip 7: Make Quality a Requirements Issue.** Quality and scope live in the requirements set. Know when to stop painting.
- **Tip 8: Invest Regularly in Your Knowledge Portfolio.** Diversify; learn a new language each year; read a technical book each quarter (plus non-technical); attend classes/user groups; experiment.
- **Tip 9: Critically Analyze What You Read and Hear.** Apply skepticism to vendors, media, gurus, zealots.
- **Tip 10: It's Both What You Say and the Way You Say It.** Know your audience and timing.

### Ch 2 — A Pragmatic Approach
- **Tip 11: DRY — Don't Repeat Yourself.** Every piece of knowledge has a single, unambiguous, authoritative representation. Four sources of duplication: imposed, inadvertent, impatient, interdeveloper.
- **Tip 12: Make It Easy to Reuse.** If reuse is harder than rewriting, people rewrite.
- **Tip 13: Eliminate Effects Between Unrelated Things.** *Orthogonality* — a single requirement change should ideally touch one module.
- **Tip 14: There Are No Final Decisions.** *Reversibility* — hide third-party choices behind abstract interfaces.
- **Tip 15: Use Tracer Bullets to Find the Target.** A thin, production-quality, end-to-end skeleton that you keep and grow.
- **Tip 16: Prototype to Learn.** Throwaway code to answer specific questions. Skip correctness, completeness, robustness, style.
- **Tip 17: Program Close to the Problem Domain.** Build mini-languages (data or imperative) that raise abstraction.
- **Tip 18: Estimate to Avoid Surprises.** Scale units (days/weeks/months) to convey accuracy.
- **Tip 19: Iterate the Schedule with the Code.** Honest answer to an estimate request is usually "I'll get back to you."

### Ch 3 — The Basic Tools
- **Tip 20: Keep Knowledge in Plain Text.** Survives any binary format and tool universe.
- **Tip 21: Use the Power of Command Shells.** GUIs limit you to WYSIAYG.
- **Tip 22: Use a Single Editor Well.** One configurable, extensible, programmable editor everywhere.
- **Tip 23: Always Use Source Code Control.** Even for prototypes, docs, shell scripts.
- **Tip 24: Fix the Problem, Not the Blame.** Whose bug it is doesn't matter.
- **Tip 25: Don't Panic.** Compile with max warnings first. Use **rubber-ducking** (explain the problem aloud). Binary-chop.
- **Tip 26: "select" Isn't Broken.** Suspect your own code before suspecting the OS/lib.
- **Tip 27: Don't Assume It — Prove It.** Prove in *this* context with *this* data. After fixing, look for the same flaw elsewhere; add a regression test.
- **Tip 28: Learn a Text Manipulation Language.** awk, sed, Perl, Python — hours become minutes.
- **Tip 29: Write Code That Writes Code.** *Passive* generators scaffold once; *active* generators run every build to keep multiple representations in sync (DRY across languages).

### Ch 4 — Pragmatic Paranoia
- **Tip 30: You Can't Write Perfect Software.** Defensive coding starts there.
- **Tip 31: Design with Contracts.** Pre/postconditions and invariants. Be strict in what you accept, modest in what you promise. Subclasses must honor base contracts (Liskov).
- **Tip 32: Crash Early.** A dead program does less damage than a corrupted one.
- **Tip 33: If It Can't Happen, Use Assertions to Ensure That It Won't.** Don't use assertions for normal error handling. Leave them on in production except for measured hot spots.
- **Tip 34: Use Exceptions for Exceptional Problems.** Exceptions are nonlocal goto — don't use them as control flow.
- **Tip 35: Finish What You Start.** The routine/object that allocates is responsible for deallocating. Deallocate in reverse order. Track high-water marks.

### Ch 5 — Bend or Break
- **Tip 36: Minimize Coupling Between Modules.** *Law of Demeter* — talk only to immediate friends. Don't reach through objects.
- **Tip 37: Configure, Don't Integrate.** Deep choices (algorithms, DBs, middleware, UI style) belong in metadata.
- **Tip 38: Put Abstractions in Code, Details in Metadata.** Engine + metadata, not hardcoded specifics.
- **Tip 39: Analyze Workflow to Improve Concurrency.** Users describe sequentially what could run in parallel.
- **Tip 40: Design Using Services.** Independent, concurrent objects behind well-defined interfaces.
- **Tip 41: Always Design for Concurrency.** Even if you deploy single-threaded — forces cleaner interfaces.
- **Tip 42: Separate Views from Models.** MVC + publish/subscribe so producers and consumers don't know about each other.
- **Tip 43: Use Blackboards to Coordinate Workflow.** Anonymous, asynchronous coordination via shared space — when data arrives out of order, from many sources.

### Ch 6 — While You Are Coding
- **Tip 44: Don't Program by Coincidence.** Code that "works" without you knowing why. Be deliberate: work from a plan, rely only on reliable things, document assumptions, test assumptions, refactor when needed.
- **Tip 45: Estimate the Order of Your Algorithms.** Know what *n* can grow to in production.
- **Tip 46: Test Your Estimates.** Theoretical complexity is incomplete; measure with real input sizes and watch for cliffs (swap, thrash, cache).
- **Tip 47: Refactor Early, Refactor Often.** Software is gardening, not construction. Don't refactor and add features at the same time; have good tests; small steps.
- **Tip 48: Design to Test.** Design contract and tests at the same time as the unit. Test against the contract.
- **Tip 49: Test Your Software, or Your Users Will.** Build a culture of testing. Add a "test window" — log files, hot-keys, status pages — to inspect prod without a debugger.
- **Tip 50: Don't Use Wizard Code You Don't Understand.** Wizard output becomes *your* code; if you can't maintain it, don't use it.

### Ch 7 — Before the Project
- **Tip 51: Don't Gather Requirements — Dig for Them.** Distinguish requirement from policy; encode policy as metadata.
- **Tip 52: Work with a User to Think Like a User.** Sit in their seat.
- **Tip 53: Abstractions Live Longer than Details.** Build a DATE module; don't hardcode the current calendar choices.
- **Tip 54: Use a Project Glossary.** One place where all domain terms are defined.
- **Tip 55: Don't Think Outside the Box — Find the Box.** Identify which constraints are real and which are preconceived.
- **Tip 56: Listen to Nagging Doubts — Start When You're Ready.** Subconscious pattern-recognition is informative; distinguish doubt from procrastination via a quick prototype.
- **Tip 57: Some Things Are Better Done Than Described.** Treat requirements, design, and coding as one process.
- **Tip 58: Don't Be a Slave to Formal Methods.** Methodologies are tools, not religions.
- **Tip 59: Expensive Tools Do Not Produce Better Designs.** Price is no signal of quality.

### Ch 8 — Pragmatic Projects
- **Tip 60: Organize Around Functionality, Not Job Functions.** Small, self-contained teams owning cohesive parts of the system.
- **Tip 61: Don't Use Manual Procedures.** Anything done twice should be scripted.
- **Tip 62: Test Early. Test Often. Test Automatically.** Tests on the shelf are worthless.
- **Tip 63: Coding Ain't Done 'Til All the Tests Run.** Types: unit, integration, validation/verification, resource exhaustion, performance, usability.
- **Tip 64: Use Saboteurs to Test Your Testing.** Deliberately reintroduce bugs to verify the suite alarms.
- **Tip 65: Test State Coverage, Not Code Coverage.** Combinations and traversal order matter more than lines hit.
- **Tip 66: Find Bugs Once.** Once a human finds it, automation should catch it forever after.
- **Tip 67: Treat English as Just Another Programming Language.** DRY, orthogonality, automation apply to docs.
- **Tip 68: Build Documentation In, Don't Bolt It On.** Comments explain **why**, not how. Skip lists of exports, revision history — tools handle that.
- **Tip 69: Gently Exceed Your Users' Expectations.** Communicate so expectations match reality, then deliver a small surprise.
- **Tip 70: Sign Your Work.** Anonymity breeds sloppiness; ownership creates accountability.

<a id="pp-named-concepts"></a>
## Named Concepts — Quick Glossary

| Concept | Meaning | Tip |
|---------|---------|-----|
| **DRY** | Single, authoritative representation of every piece of knowledge | 11 |
| **Orthogonality** | Independent components; changing one doesn't ripple | 13 |
| **Reversibility** | No final decisions; design to absorb change | 14 |
| **Tracer Bullets** | Thin, production-quality end-to-end skeleton you keep | 15 |
| **Prototypes** | Disposable code built to learn one thing | 16 |
| **Broken Windows** | Small unrepaired imperfections accelerate decay | 4 |
| **Stone Soup** | Catalyze change by starting small and visible | 5 |
| **Boiled Frog** | Disasters accumulate gradually; watch the big picture | 6 |
| **Knowledge Portfolio** | Manage learning like investing | 8 |
| **Design by Contract** | Pre/postconditions and invariants | 31 |
| **Crash Early** | Terminate at the first impossible state | 32 |
| **Assertive Programming** | Encode "can't happen" beliefs as runtime checks | 33 |
| **Finish What You Start** | Allocators are deallocators | 35 |
| **Law of Demeter** | Talk only to your immediate friends | 36 |
| **Configure Don't Integrate** | Push specifics into metadata | 37–38 |
| **Temporal Coupling** | Surface and break implicit ordering | 39–41 |
| **MVC** | Separate data, presentation, control | 42 |
| **Publish/Subscribe** | Producers/consumers via subscription, not direct calls | 42 |
| **Blackboard Systems** | Anonymous async coordination via shared space | 43 |
| **Programming by Coincidence** | Code that works by accident | 44 |
| **Refactoring** | Continuous, test-protected redesign | 47 |
| **Rubber Ducking** | Explain the bug aloud | 25 |
| **Hungry Consumer Model** | Workers pulling from a shared queue | 40 |
| **Evil Wizards** | Code-gen wizards whose output you don't understand | 50 |
| **Sign Your Work** | Ownership as a quality forcing function | 70 |

---

# Part III — The Design of Design (Brooks)

> Brooks treats design as the act of shaping a **conceptual construct**. Many of his principles transfer directly to code, especially around conceptual integrity, requirements, budgeting scarce resources, and the limits of process.

<a id="dod-per-chapter"></a>
## Per-Chapter Principles

### Ch 1 — The Design Question
- **Idea, Implementation, Interaction** (Sayers): every created work has three phases. The Idea can be complete in the mind before realization begins.
- **Essence vs. accident:** the essence is the mental crafting of the conceptual construct; implementation is the accident. Focus design effort on the concept — conceptual mistakes aren't recoverable.
- Separate **architecture** (what the programmer sees) from **implementation** (logical structure underneath) from **realization** (physical instantiation).
- Idea→Implementation→Interaction operates **recursively** at every level — library, service, deployment.
- Hold the team's conversation at the level of the **Design Concept** itself, not derivative representations.
- **The boldest design decisions account for the highest fraction of goodness.** Don't hedge the foundational decisions.

### Ch 2 — The Rational Model
- Up front, make explicit: primary goal, secondary desiderata, utility function (weights), constraints, decision tree.
- Most utility curves saturate; recognize diminishing returns.
- **Satisfice, don't optimize.** Walk the design tree depth-first toward "good enough."

### Ch 3 — What's Wrong with the Rational Model
- **The hardest part of design is deciding what to design.** A chief service of a designer is helping clients discover what they want.
- The design tree is **discovered, not mapped** — alternatives only become visible as you start cutting code.
- Nodes are tentative *complete designs*, not single decisions. A "small" choice often implies a whole consequent design.
- **Ordering matters (Parnas):** put decisions least apt to change nearest the tree root. Encapsulate volatile decisions behind interfaces.
- **The situation talks back (Schön):** as you shape it, the desiderata get re-weighted.
- Constraints keep changing — periodically scan and ask whether each can still be assumed.
- **Sometimes the breakthrough is removing a constraint, not solving within it.**
- **The Waterfall Model is wrong and harmful.** Iterate over requirements and solution together.

### Ch 4 — Requirements, Sin, and Contracts
- Requirements generated by committee become a bloated wish-list with no advocate for the product's own integrity.
- A few clear overriding objectives + schedule urgency are the best defense against bloat and creep.
- **Trace each requirement to a real goal.** Reject orphans, including "completeness" features the designer adds.
- Get agreements in writing. Phase contracts to match design maturity — don't sign fixed-price before requirements iteration is done.

### Ch 5 — Better Design Process Models
- Use a clearly visualizable lifecycle (e.g., Spiral) — abstract verbal descriptions don't stick.
- **Co-evolve problem and solution.** Refine spec and prototype in lock-step.
- Bazaar/open-source works when (a) builders are users and (b) there's already a unifying conceptual spec.
- Punctuate the Spiral with explicit contracting points.
- All models are oversimplifications; choose the dominant model carefully.

### Ch 6 — Collaboration in Design
- **Conceptual integrity is the most important consideration in system design.** Coherence yields ease of learning and use.
- Negotiation among peers (consensus design) produces bloat. **Empower a single system architect.**
- One UI designer per surface. "If one architect can't master it, one user can't either."
- Achieve **consistency, propriety, parsimony, generality.** Few concepts, many compositions.
- If no single person can explain the whole system, that's a fatal warning, not a sign of sophistication.
- Brainstorming: groups yield *more* ideas; individuals yield *better* ones. Use groups for divergence, individuals for depth.
- Group **design reviews** need multidisciplinary reviewers — much larger than the design team.
- Real collaboration isn't "everyone edits the model together." Each piece has one owner who prepares proposals; sessions are micro-reviews.
- **Two-person teams are magical.** Pair programming has lower initial productivity but radically lower error rates.
- Change control (version control + review + ownership boundaries) is non-negotiable in team design.

### Ch 7 — Telecollaboration
- Clean interfaces between teams/modules pay off hugely.
- Beyond interfaces, define a predetermined mechanism for resolving disagreement.
- Face time is irreplaceable; documents-plus-phone beats either alone.
- Toolsmithing starts with the user and the real task — buggy prototypes get blunt feedback.

### Ch 8 — Rationalism vs. Empiricism
- **Be a dyed-in-the-wool empiricist.** Early prototypes, early user testing, iterative incremental implementation, test banks, regression testing.
- Reserve formal proof for the small set of components that need it (security kernels). Use group code review elsewhere — a wise and practical balance.
- **No proof can show the original goals were right.** Verification confirms internal correctness, not fitness.

### Ch 9 — User Models: Better Wrong than Vague
- Write down what you know about the user, the purposes of use, the modes of use, and what you're assuming.
- An **articulated guess beats an unspoken assumption.** Concrete personas, traffic numbers, and use-frequency estimates — even invented — drive better design than "lots of users."
- "Wrong explicit assumptions are much better than vague ones. Wrong ones will perhaps be questioned; vague ones won't."
- When you don't pick a real user, you implicitly pick yourself — and your needs aren't theirs.

### Ch 10 — The Budgeted Resource
- Every design has a scarce resource. **Name it, track it publicly, control it firmly.**
- The critical resource often isn't dollars: it's memory bandwidth, instruction-format bits, latency budget, screen real estate, lines of API surface, cognitive load.
- Surrogates (LOC, function points, story points, class count) age — reassess them.
- The critical resource can change mid-design (OS/360 went from "memory bytes" to "disk accesses"). Build a performance simulator/benchmark early.
- **Only one person controls budgeting and rebudgeting.**
- Keep a small personal kitty for late allocation; don't allocate 100% of any budget on day one.

### Ch 11 — Constraints Are Friends
- **Form is liberating.** Constraints shrink the search space — focusing, speeding, stimulating creation.
- Categorize each constraint: real / obsolete / misperceived / intentional artificial. Audit periodically.
- **Specs should constrain outcomes, not implementations.** Don't tell the designer how — tell them what properties are needed.
- **General-purpose designs are harder than special-purpose.** Resist gratuitous generality. Pick a narrow purpose; do it superbly.

### Ch 12 — Esthetics and Style
- **Firmness, usefulness, delight (Vitruvius).** Aesthetics are co-equal with function. "Elegant" and "ugly" are real properties.
- **Parsimony alone yields puzzles, not tools.** "Programming languages exist to facilitate the writing — and the much more frequent reading — of programs, not to serve as puzzles." Optimize for the reader.
- Structural clarity: a direct route from what one wants to say to how one says it.
- Use familiar, simple metaphors (desktop, spreadsheet).
- **Consistency underlies all principles of quality.** From consistency flow three principles:
  - **Orthogonality** — do not link what is independent.
  - **Propriety** — do not introduce what is immaterial. (Parsimony is a subset.)
  - **Generality** — do not restrict what is inherent. ("When you don't know, grant freedom.")
- **Consistency resolves the ease-of-use vs. ease-of-learning tension.** Layer so simple cases stay simple and advanced cases compose smoothly.
- **Style = repeated microdecisions resolved the same way.** Document them — style guides grow long because real style is hierarchical.
- **Document the why, not just the what** — capture intent so maintainers don't pull a load-bearing stone from the arch.
- How to develop style: study others' work intentionally; practice in another's style; revise looking for inconsistencies; practice, practice, practice.

### Ch 13 — Exemplars in Design
- **Originality is no excuse for ignorance.** Study the masters.
- "**Gratuitous innovation** … is a foolish idea and a selfish indulgence of pride." Innovate only when there's a real expected gain.
- "He who seeks originality is apt to find novelty, but not permanence of delight."
- The most potent reason to study design history is to **learn what doesn't work, and why.**
- Read old code with "what led such a smart designer to do that?" rather than "why did he do such a fool thing?"

### Ch 14 — How Expert Designers Go Wrong
- "The besetting mistake of expert designers is not designing the thing wrong, but **designing the wrong thing.**"
- Petroski's pattern: tread cautiously → master → extend boldly while forgetting underlying assumptions → overreach.
- **Success is more dangerous than failure.** Failure stimulates rethinking; success stimulates over-confidence.
- Watch for paradigm shifts under you. Recognize when the thing you're building is becoming a different kind of thing (e.g., a config file growing branches/loops becomes a programming language — design it as one).

### Ch 15 — The Divorce of Design
- Mitigate the designer-user-implementer gap. Even a small amount of use-scenario experience is invaluable.
- **Incremental development + iterative delivery.** Build a minimal version that works; give it to users; observe; iterate.
- True implementers should be involved in the design process.
- **"Reviewed with users" near release ≠ designed with users.**

### Ch 16 — Representing Designs' Trajectories and Rationales
- Document design **whys**, not just whats. ADRs, commit messages with rationale, design docs that record what was *not* chosen and why.
- Beware: a maintainer touching code without understanding the original constraints destroys load-bearing structure.
- Design isn't just satisfying requirements — it's **uncovering them.**
- A major part of design is realizing that **alternatives exist.** Brainstorming a third option is the creative work.
- **Modularity is a tradeoff.** Module boundaries are worth their cost — but the cost is real (you lose optimization across boundaries).
- Sometimes the right answer is "good enough, but easy to change later."
- Don't use highly structured tools too early — they restrict the ease of having vague ideas.

### Ch 17–18 — Design Tooling (generalizable lessons)
- **Progressive truthfulness:** start from a model that fully resembles the goal, refine attributes. Don't start from a blank file.
- Great designers rarely start from scratch — they take ideas from many sources, mix them, and wrestle the result into conceptual integrity.
- Capture whys, not just whats, in work logs. The whys are priceless for new team members and for project heirs.
- **Tests are first-class design artifacts** — they belong alongside code and spec.
- Build tools incrementally with real users.

### Ch 19 — Great Designs Come from Great Designers
- **Great designs come from great designers, not from great processes.**
- Process is conservative: it aims to bring different things into one framework. "Predictability and great design are not friends."
- Process "fights the last war"; it raises the floor, not the ceiling.
- Beware design-by-review-board: consensus mechanisms take off the sharp edges, but the sharp edges are the cutting edges.
- Hold process off long enough for great design to occur. Product processes are for follow-ons, not innovation.
- Build in exception mechanisms. "All rules can be broken."
- **Securely protect crown jewels; don't build high fences around garbage cans.** Aggressive review on what matters, light touch elsewhere.
- Entrust each design task to a gifted chief designer. Don't second-guess; shield them; give them tools.

### Ch 20 — Where Do Great Designers Come From?
- Professional skills are mastered by **critiqued practice.** Pair programming, structured code review, mentorship — not lectures.
- **Recruit by portfolio**, not by interview alone.
- A **real dual ladder.** Pay, prestige, and resource grants for tech leaders must match those for managers.
- Plan designers' education the way you plan managers' — formal education plus critiqued practice with a master, plus user/customer assignments and sabbaticals.
- **Protect designers from distraction** ("design productivity requires flow") and from management overhead.
- Treat each great designer according to their nature; top contributors don't fit one mold.
- Constantly sketch designs — some fully detailed, because the devil is in the details.
- Seek knowledgeable criticism of your designs.

<a id="dod-cross-cutting"></a>
## Cross-Cutting Lessons from Brooks's Case Studies (Ch 21–27)

- **Spend more time on design.** Every case study repeats this: time invested in design makes the product better, makes it useful longer, and often makes delivery sooner.
- **Defer cost constraints; design for function first; then value-engineer.** Build the effective system, then cost-reduce — not the cheap one that you augment until useful.
- Book/project finishing has **logarithmic convergence** — the last details take a disproportionate share of effort. Budget for it.
- **Multiple concurrent implementations protect the architecture** — with only one impl, it's always cheaper to change the manual than the machine.
- Establish performance metrics and cost surrogates early. Build a performance simulator/benchmark from day one.
- **Information hiding** (Parnas, OO) would have avoided most OS/360 grief — encapsulate; don't expose shared state.
- Use the best available high-level language. Don't drop to a lower-level tool out of habit or unwarranted performance fear.
- **Maintain rigid architectural control over interfaces** — generate interface bindings from one source.
- Even competent architects make mistakes. **Inspect often.** Review external work as carefully as your own.
- **Think about maintenance from the start.** Library/dependency/material choices have multi-year maintenance costs.
- A late-discovered low-frequency use case can justify a major redesign — don't dismiss late discoveries as small.
- When a constraint dissolves, **walk back through earlier decisions** that depended on it.
- Allow design changes during construction; mockups, prototypes, and walk-throughs catch errors drawings miss.
- **Run lots of use scenarios.** Probe how the system is *actually* used, not just imagined.
- Wide consultation with outsiders surfaces blind spots.
- A single standard interface for plug-ins/extensions/devices is enormously valuable (S/360 standard I/O channel).
- **Error detection / validation / observability are professional responsibilities** — even if customers don't ask for them.
- Distinguish **issues of fundamental importance** (require strong agreement) from routine ones (lightweight decision-making).
- Provide an escape hatch / empowered tie-breaker — it defuses tension even when never invoked.

---

# Part IV — Where the three books agree (and disagree)

## Things all three reinforce

- **Code is read more than written.** Optimize for the reader (Ousterhout Ch 18, Hunt & Thomas Tip 22 + 68, Brooks Ch 12).
- **One person owns the design / interface / budget.** (POSD Ch 8 "pull complexity downward"; PP Tip 70 "Sign Your Work"; DoD Ch 6 "empower a single system architect" + Ch 10 "only one person controls budgeting.")
- **Iterate; the waterfall model is wrong.** (POSD Ch 1 + 16; PP Tip 47 + 62; DoD Ch 3 + 5.)
- **Document the why, not the what.** (POSD Ch 13: "what and why, not how"; PP Tip 68: comments explain *why*; DoD Ch 12 + 16.)
- **Constraints/contracts make systems honest.** (POSD interface comments; PP Tip 31 "Design with Contracts"; DoD Ch 4 + 11.)
- **Hide volatile decisions; expose only what's stable.** (POSD information hiding Ch 5; PP Tip 14 reversibility; DoD Parnas/Ch 3 + Ch 21 "information hiding was the OS/360 regret.")
- **Build the smallest end-to-end working thing first; learn from it.** (POSD increments-are-abstractions Ch 19; PP Tip 15 tracer bullets; DoD Ch 15 incremental delivery.)
- **Test early, automatically, and treat tests as design artifacts.** (POSD Ch 19; PP Tip 48 + 62; DoD Ch 17.)

## Where they disagree

- **Length rules for methods.**
  - Robert Martin (*Clean Code*) and the "make every method tiny" school: extract aggressively.
  - **Ousterhout (POSD Ch 9):** depth > length. Don't split methods just for length; doing so produces classitis and conjoined methods.
- **Comments.**
  - "Code should be self-documenting" / "comments are failures."
  - **Ousterhout (POSD Ch 12):** comments are essential to abstraction; replacing them with very long method names provides *less* information.
  - PP Tip 68 agrees: build documentation in; don't bolt it on.
- **TDD — resolved in favor of TDD; see [`tdd-guidelines.md`](./tdd-guidelines.md).**
  - **Ousterhout (POSD Ch 19, 2018/2021):** TDD is feature-focused, hence tactical. The unit of development should be the abstraction, not a feature passing a test. He allows TDD for bug fixes only.
  - **Hunt & Thomas (PP Tip 48, "Design to Test"):** design contract and tests at the same time as the unit; ideally write the test first. Closer to a TDD-friendly stance.
  - **Reconciling Ousterhout's TDD skepticism with this project's policy:** Ousterhout's objection is specifically that *features-passing-tests* is the wrong unit of design — abstractions are. That critique is a critique of *naïve* TDD (write a feature test, hack code until it passes, move on). It is **not** a critique of:
    - using tests as the executable spec the implementer must satisfy,
    - using tests to guard against regressions during refactoring (which Ousterhout explicitly endorses — "unit tests enable refactoring"),
    - using tests to catch hallucinated APIs and plausible-but-wrong logic in AI-generated code (a failure mode that didn't exist when POSD was written).
  - **Our policy:** follow [`tdd-guidelines.md`](./tdd-guidelines.md) — write tests first, but design the **abstractions** first, and let the tests pin down the abstraction's contract rather than chase features. Ousterhout's "design it twice" (Ch 11) still applies *before* the first test is written; TDD then drives the implementation of the chosen abstraction. This is the synthesis: **abstraction-first design, test-first implementation.**
- **Process maturity.**
  - **DoD Ch 19:** process raises the floor, not the ceiling. Great design comes from great designers, not great processes.
  - PP is more pro-process (Ubiquitous Automation, Tip 60 team structure).
- **Generality.**
  - **POSD Ch 6:** general-purpose modules are deeper.
  - **DoD Ch 11:** general-purpose designs are *harder*; favor special-purpose if you want excellence; resist gratuitous generality.
  - Reconciliation: both agree to avoid *over-specialization* and *gratuitous generality*. Aim for "somewhat general-purpose" — general enough for foreseeable needs, not more.

---

## Companion documents

This file is one of three in `ebooks/`. They are meant to be read together:

- **[`coding-standards.md`](./coding-standards.md)** *(this file)* — design principles from Ousterhout, Hunt & Thomas, Brooks.
- **[`tdd-guidelines.md`](./tdd-guidelines.md)** — the project's TDD policy (DORA-2025 era, AI-aware). Supersedes Ousterhout's anti-TDD stance for *this* project; see the TDD entry in Part IV for the reasoning.
- **[`animation-and-ui-guidelines.md`](./animation-and-ui-guidelines.md)** — animation/rich-UI principles from *Filthy Rich Clients* plus the mandatory Material Design 3 fonts/icons directive.

## Source files

The plain-text extracts used to build this document live in `ebooks/_extracted/`:

- `posd_full.txt` — A Philosophy of Software Design (EPUB → text via pandoc)
- `pp_full.txt` — The Pragmatic Programmer (EPUB → text via pandoc)
- `dod_full.txt` — The Design of Design (PDF → text via pdftotext)
