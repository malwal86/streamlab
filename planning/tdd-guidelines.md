# Test-Driven Development — Practical Guidelines

A working reference for **what to test**, **how to test it**, and **how to use TDD to keep
AI-generated code honest**. Drawn primarily from Google Cloud's article on TDD and AI quality,
the underlying 2025 DORA report, and adjacent industry guidance on edge cases, boundary
conditions, and error handling.

> **Note on the apparent conflict with [`coding-standards.md`](./coding-standards.md).**
> Ousterhout (*A Philosophy of Software Design*, Ch 19) is skeptical of TDD as a *default*
> practice, on the grounds that "features passing tests" is the wrong unit of design —
> abstractions are. He's right about that, and this document does not contradict him:
> **design the abstraction first (Ousterhout's "Design It Twice"), then use TDD to drive the
> implementation of the chosen abstraction.** Tests pin down the abstraction's contract; they
> do not replace the act of choosing it. With AI-assisted development, this matters more, not
> less: the failing test is the spec the AI must satisfy, and it's the safety net against
> hallucinated APIs and plausible-but-wrong logic. See the TDD entry in
> [`coding-standards.md` Part IV](./coding-standards.md#part-iv--where-the-three-books-agree-and-disagree)
> for the full reconciliation.

## Sources

- [TDD and AI: Quality in the DORA report — Google Cloud](https://cloud.google.com/discover/how-test-driven-development-amplifies-ai-success) *(primary)*
- [Announcing the 2025 DORA Report — Google Cloud Blog](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report)
- [DORA — State of AI-assisted Software Development 2025](https://dora.dev/dora-report-2025/)
- [How are developers using AI? Inside Google's 2025 DORA report — Google Blog](https://blog.google/innovation-and-ai/technology/developers-tools/dora-report-2025/)
- [Leveraging TDD for AI System Architecture — Galileo](https://galileo.ai/blog/tdd-ai-system-architecture)
- [DORA 2025 State of AI-assisted Software Development Report — Google Research](https://research.google/pubs/dora-2025-state-of-ai-assisted-software-development-report/)
- [AI Is Amplifying Software Engineering Performance — InfoQ](https://www.infoq.com/news/2026/03/ai-dora-report/)
- Industry guidance on edge cases & error handling: [Virtuoso QA](https://www.virtuosoqa.com/post/edge-case-testing), [TestRail](https://www.testrail.com/blog/how-to-write-unit-tests/), [freeCodeCamp](https://www.freecodecamp.org/news/a-beginners-guide-to-testing-implement-these-quick-checks-to-test-your-code-d50027ad5eed/), [Bomberbot](https://www.bomberbot.com/testing/a-beginners-guide-to-testing-error-handling-edge-cases/)

---

## Table of Contents

- [1. What TDD Is](#1-what-tdd-is)
- [2. Why TDD Matters — Especially with AI](#2-why-tdd-matters--especially-with-ai)
- [3. What to Test](#3-what-to-test)
- [4. How to Test](#4-how-to-test)
- [5. TDD with AI-Generated Code](#5-tdd-with-ai-generated-code)
- [6. Anti-Patterns](#6-anti-patterns)
- [7. Cheat Sheet](#7-cheat-sheet)

---

## 1. What TDD Is

TDD is a **red → green → refactor** loop:

1. **Red.** Write a small failing test that describes the next bit of behavior you want.
2. **Green.** Write the *minimum* production code that makes the test pass — no more.
3. **Refactor.** Clean up the design now that you have a safety net. Tests must stay green.

Each loop is small (minutes, not hours). The test suite is **the executable specification** of
what the system is supposed to do.

Key invariants:

- You never write production code without a failing test first.
- You never write more test code than is sufficient to fail.
- You never write more production code than is sufficient to pass.
- The suite stays green between loops; only one test is allowed to fail at a time.

---

## 2. Why TDD Matters — Especially with AI

The 2025 DORA report frames AI as an **amplifier**: it magnifies existing strengths and existing
weaknesses. A team with strong testing discipline gets dramatically faster with AI; a team
without it gets dramatically buggier.

> *"AI's primary role is as an amplifier, magnifying an organization's existing strengths and
> weaknesses."* — DORA 2025

> *"Without robust control systems, like strong automated testing, mature version control
> practices, and fast feedback loops, an increase in change volume leads to instability."* —
> DORA 2025

Concretely, TDD does three things that matter more once AI is generating code:

1. **It defines "done" before code exists.** The AI (or you) has a concrete, executable target.
   Without it, "looks right" becomes the acceptance criterion — and AI-generated code is very
   good at *looking* right while being wrong.
2. **It enforces working in small batches.** DORA finds small batches are a critical capability
   for high performers. TDD enforces small batches at the cell-mitosis level: one behavior, one
   test, one commit-sized step.
3. **It gives you a safety net for change.** AI accelerates the *volume* and *velocity* of
   change. Without a regression net, that velocity becomes destabilizing instead of productive.

> *"TDD prioritizes writing tests first, [which] gives developers a high degree of confidence
> when making changes because the tests act as a safety net — particularly important in an
> AI-assisted environment where the volume and velocity of changes are dramatically
> increasing."* — DORA 2025

---

## 3. What to Test

For every unit of behavior, work through this checklist. Each row is a question your test suite
should be able to answer "yes" to.

### 3.1 Happy Path

- Does the function produce the **documented output** for **typical, well-formed input**?
- Does it produce that output across the full range of valid inputs (not just one example)?

### 3.2 Boundary Conditions

Most bugs hide here. Use **boundary value analysis** + **equivalence partitioning**.

- **Min and max** of the valid range.
- **Just below min** and **just above max** — what happens?
- **Zero** (for numeric inputs that allow it).
- **Negative numbers** (for inputs where the type allows it but the contract may not).
- **One** (for inputs where 0 is a special case and 1 is the smallest "normal" case).
- **Off-by-one neighbors** of any threshold the code branches on.
- **Empty collection** vs. **single-element collection** vs. **many-element collection**.
- **First and last index** of a sequence.
- **Maximum representable value** (e.g., `Number.MAX_SAFE_INTEGER`, `Long.MAX_VALUE`).

### 3.3 Null / Empty / Missing Inputs

- `null` / `None` / `nil` / `undefined` for every parameter.
- Empty string `""`.
- Empty array `[]`.
- Empty object `{}`.
- Missing optional field.
- Missing required field.
- Whitespace-only string `"   "`.
- All-null collection `[null, null]`.

Pick the contract explicitly: **does this function reject null, treat it as a default, or
propagate it?** Then write a test that pins down the choice. Future-you should not have to guess.

### 3.4 Error Handling

- **Invalid input is rejected loudly**, not silently coerced. Negative testing: malformed,
  wrong type, out-of-range, poorly formatted.
- **The right error type is thrown** (not a bare `Exception` / `Error`).
- **Error messages contain enough context** to debug (which input, which constraint).
- **Resources are cleaned up** when the function errors mid-way (files closed, transactions
  rolled back, locks released).
- **Caller can distinguish recoverable from unrecoverable errors.**
- **Retry behavior** is bounded; transient errors trigger retries, permanent errors don't.

### 3.5 Unexpected / Malformed / Hostile Inputs

- Wrong type (string where number expected).
- Extra fields the contract didn't ask for.
- Truncated data (half a JSON object, partial UTF-8 sequence).
- Encoding edge cases: emoji, surrogate pairs, RTL text, zero-width characters, normalization
  forms (NFC vs. NFD).
- Strings with embedded control characters (`\0`, `\r`, `\n`).
- Pathological sizes (1 GB string, 100k-element array).
- Inputs designed to inject: SQL fragments, shell metacharacters, path traversal (`../`),
  template-injection sequences (`{{}}`, `${}`).

### 3.6 Contract / Type Violations

- **Preconditions**: does the function fail fast when its preconditions are violated?
- **Postconditions**: does the return value satisfy what the contract promises?
- **Invariants**: are object invariants preserved across every public method?
- **Liskov substitution**: does every subclass behave correctly when used through the parent's
  interface?

### 3.7 Concurrency / State

- Same input run twice gives the same output (idempotence).
- Function called in parallel doesn't corrupt shared state.
- Deadlock scenarios on contended resources.
- Timeout behavior — does the function actually give up when it should?
- State machine: every defined transition fires; every undefined transition is rejected.

### 3.8 Integration Points

Things outside your process are the most common bug source. Test them explicitly:

- **Network**: timeouts, connection refused, slow responses, partial responses, 5xx, 4xx,
  unexpected redirects.
- **Database**: unique-constraint violations, transaction rollback, connection pool exhaustion,
  schema mismatch.
- **Filesystem**: missing file, permission denied, disk full, file modified during read.
- **External APIs**: rate limit hit, auth expired, response schema changed, response too large.
- **Time/clock**: DST transitions, leap seconds, timezone boundaries, fixed clock for
  determinism.

### 3.9 Security Inputs (where relevant)

- Injection: SQL, shell, template, LDAP, XPath.
- XSS payloads (for any user-rendered output).
- Path traversal.
- Oversized inputs (DoS).
- Auth: missing token, expired token, wrong-scope token, replay.
- Privilege escalation: user A's token used on user B's resource.

### 3.10 Performance / Load (where relevant)

- Does the operation complete within its latency budget?
- Does memory stay within bounds for the largest realistic input?
- Galileo's recommendation for AI-flavored systems: *"measure latency, throughput, and resource
  utilization under various loads."*

### 3.11 AI-Specific Tests (for AI components / LLM calls / probabilistic systems)

When you're testing code that calls a model or otherwise behaves probabilistically:

- **Statistical/property tests**, not exact-match tests. Confidence intervals; results
  consistently fall within a tolerance band.
- **Metamorphic tests**: similar inputs should produce appropriately similar outputs (e.g.,
  re-ordering an unordered input must not change the result).
- **Seeded reproducibility** for any stochastic path, so failures can be debugged.
- **Contract tests** that pin down the shape of the response (fields present, types correct,
  ranges valid) even if the *content* varies.
- **Schema validation** on every LLM JSON output.
- **Fallback behavior** when the model returns malformed output, hits a rate limit, or times
  out.
- **Tolerance thresholds** derived from real business requirements, not from "what the model
  happened to do this run."

---

## 4. How to Test

### 4.1 The Test Pyramid

Use lots of cheap, fast tests at the bottom; a few expensive, slow ones at the top.

```
              ▲   E2E / UI       (few — slow, brittle, high value when they catch real
            ▲▲▲                   user-flow regressions)
          ▲▲▲▲▲   Integration    (some — fast enough to run in CI; verify real boundaries)
        ▲▲▲▲▲▲▲   Unit           (many — milliseconds; cover every branch)
```

- **Unit tests** drive design. They run in milliseconds, test one thing, and mock everything
  outside the unit.
- **Integration tests** verify that real components talk to each other — real DB, real HTTP
  client, real filesystem in a temp dir.
- **End-to-end / UI tests** prove the whole stack works for a real user flow. Keep them few;
  they're slow and flaky.

### 4.2 Test Structure: Arrange-Act-Assert (AAA) / Given-When-Then (GWT)

Every test, three sections:

```
// Arrange / Given
const cart = new Cart()
cart.add({ id: "sku-1", qty: 2 })

// Act / When
const total = cart.subtotal()

// Assert / Then
expect(total).toBe(20)
```

A test that doesn't fit this shape is usually trying to test two things.

### 4.3 One Logical Concept per Test

Not literally one assertion — but **one reason to fail**. If a test can fail for two unrelated
reasons, split it. Tests should answer the question "what broke?" in their name, not require you
to read the body.

### 4.4 Naming

A good test name is a sentence describing the expected behavior:

```
returns_empty_list_when_user_has_no_orders
throws_when_amount_is_negative
rounds_half_to_even
retries_three_times_on_5xx_then_gives_up
```

Bad test names (what the production method does, not what the test asserts):

```
testGetOrders          // doesn't say what it expects
test1                  // not a name
order_test             // the file already says this
```

### 4.5 Test Isolation & Determinism

- **No shared state.** Each test runs from a clean slate. No `setUpAll` side effects bleeding
  between tests.
- **Order-independent.** The suite must pass in any order, including reversed and randomized.
- **No network, no real clock, no real filesystem** in unit tests. Mock or inject.
- **Seeded random.** Any randomness uses a fixed seed in tests.
- **Fixed clock.** Time-dependent code uses an injected clock, not `Date.now()`.
- A flaky test is a broken test. Quarantine and fix; don't retry-until-green.

### 4.6 Mocks, Stubs, Fakes — When Each

- **Stub** — returns canned answers ("when called with X, return Y"). Used to drive the unit
  under test down a specific path.
- **Mock** — a stub that *also* verifies it was called the right way. Use sparingly; over-mocking
  couples tests to implementation.
- **Fake** — a lightweight working implementation (in-memory DB, in-memory queue). Often the
  cleanest option. Preferred for integration-flavored tests.
- **Real** — for trivially fast dependencies (a pure function, a value object) just use the real
  thing.

Rule of thumb: **mock at the boundary you own** (your `UserRepository` interface), not at the
boundary you don't (the raw SQL driver).

### 4.7 Test Data: Builders & Fixtures

- Avoid 30-line object literals in every test. Build a **test data builder** that produces a
  reasonable default object, and override only the fields the test cares about:

  ```
  const user = aUser().withEmail("x@y.com").build()
  ```

- Each test should make its data-relevance obvious. If the test cares about email, email is the
  thing overridden — everything else is built-in default.
- Avoid shared mutable fixtures; they create test-order dependencies.

### 4.8 Property-Based Testing

Instead of hand-picking inputs, declare a property and let a generator produce hundreds:

> "For any list `l`, `reverse(reverse(l))` equals `l`."

Tools: Hypothesis (Python), fast-check (JS/TS), QuickCheck-family (Haskell, Scala, Erlang),
jqwik (Java).

Especially valuable for:

- Parsers and serializers (round-trip property).
- Math-heavy code.
- AI/probabilistic outputs where you can describe *properties* but not exact values.
- Finding edge cases you'd never think of (the shrinker minimizes the failing input for you).

### 4.9 Mutation Testing

Property: "if I deliberately break the production code, does at least one test fail?"

Mutation-testing tools (Stryker, PIT, mutmut) mutate your code (e.g., flip `>` to `>=`, return
`null` instead of a value) and run the suite. **Surviving mutants = tests that pass on broken
code = tests that don't actually assert what they should.**

This is your strongest defense against the failure mode where AI writes both the code and the
tests, and the tests just happen to confirm whatever the code does.

### 4.10 Code Coverage — What It Does and Doesn't Mean

- Coverage tells you which lines/branches were *executed*. It does **not** tell you those lines
  were *asserted on*.
- 100% line coverage with no assertions = 100% useless.
- Aim for high coverage as a *floor* (e.g., 80% line, 70% branch), not a *ceiling*.
- Pair coverage with **mutation score** for a real signal.
- Use coverage to find *untested* code, not to claim *tested* code.

### 4.11 Run Tests Constantly — Small Batches

The DORA capability the 2025 report repeatedly highlights:

> *"Working in small batches is a critical capability for high-performing teams … this practice
> allows teams to get feedback on changes quickly and more easily address issues. When AI is
> used in conjunction with this practice, it has a positive impact on product performance and
> helps to reduce friction within the development process."* — DORA 2025

In practice:

- Tests run **on save** locally (watch mode). Sub-second feedback.
- Tests run **on every commit** in CI.
- A failing main branch blocks merges; fix-forward within minutes.
- A pre-commit hook prevents pushing without a green local suite.
- Slow tests get sharded/parallelized — never deferred to "nightly" if they gate quality.

### 4.12 Make Tests Part of Code Review

Review the tests at least as carefully as the production code. Ask:

- What behaviors are being asserted?
- What's *missing*? (boundary, null, error paths)
- Could this test pass on broken code?
- Does the test name match what it actually asserts?
- Is the test deterministic?

---

## 5. TDD with AI-Generated Code

This is where the Google Cloud article lands its core argument: **AI doesn't replace TDD — it
makes TDD more valuable.**

### 5.1 Why AI Code Especially Needs Tests

- AI generates **plausible-looking code that calls APIs that don't exist** (hallucinated method
  names, wrong argument order, fabricated library functions).
- AI generates **logic that is right for the wrong inputs** (off-by-one, inverted condition,
  swapped error branches).
- AI **confidently invents edge cases** in the wrong direction (returns `[]` when it should
  throw; throws when it should return `[]`).
- AI **reads the prompt, not the codebase** — it often duplicates existing helpers, ignores
  established patterns, and misses cross-cutting concerns (logging, auth, transactions).
- AI writes **plausible tests for plausible-but-wrong code** — both can be wrong in the same
  way.

### 5.2 Write the Test First — Especially with AI

Reversing the order matters more, not less, when AI is the implementer:

1. **You** write the failing test. The test is the spec.
2. **AI** implements code to pass the test.
3. **You** verify the test actually exercises the behavior, not just executes the lines.
4. **You** add more tests (boundaries, errors, nulls) and let AI extend the implementation.

The test suite becomes the **non-negotiable contract** the AI must satisfy. If the AI's solution
passes a malformed suite, you've shipped malformed behavior — so the test design is now where
your senior judgment lives.

### 5.3 Treat AI Like an Aggressive Junior Engineer

Match your review intensity to the actor:

- Read every line.
- Assume any unfamiliar API call is hallucinated until you've verified the symbol exists.
- Assume any edge case the AI handled is handled in the wrong direction until you've checked.
- Assume any test the AI wrote without seeing your existing test patterns will diverge in style.

### 5.4 Don't Let AI Write Both the Tests and the Code in the Same Turn

If the same prompt produces the test and the implementation, the test and the implementation
share the same hallucination. Two defenses:

1. **You** write the tests; AI writes only the implementation.
2. Run **mutation testing** against any test suite the AI authored. Surviving mutants are
   tests that confirm whatever the AI's code happened to do.

### 5.5 Use Tests as the Spec the AI Reads

For larger AI-assisted changes, paste the failing tests into the AI's context as the spec.
This:

- Constrains the AI to a concrete success criterion.
- Catches hallucinated APIs immediately (the test imports them; the AI sees what's real).
- Surfaces ambiguity before code is generated (if you can't write the test, the requirement
  isn't clear).

### 5.6 Review *Test Quality*, Not Just *Code Quality*

When AI produces tests, the dangerous failure mode is **tests that pass too easily**:

- Tests that mock the unit under test (so they verify nothing).
- Tests that assert "doesn't throw" without asserting *what* it returns.
- Tests that re-implement the production logic inside the assertion (tautology).
- Tests with no edge cases — only the example the AI was prompted with.

Make "what would have to be wrong for this test to fail?" a required review question.

### 5.7 Small Batches with AI

Every DORA finding about small batches applies double when AI is the implementer:

- One behavior per AI turn.
- One failing test → one passing test → review → commit.
- Don't accept a 500-line AI diff as a single change. Break it into the natural TDD steps and
  walk the AI through them.

---

## 6. Anti-Patterns

| Anti-pattern | Why it's bad |
|---|---|
| Writing tests *after* the code | You test what was written, not what was required. Coverage looks good; specification is gone. |
| 100% coverage as the goal | Easy to game with assertion-free tests. Use mutation score as the real signal. |
| `try/catch` that swallows errors | Hides the failure case; the bug ships. Re-throw or assert explicitly on the error. |
| Tests that depend on each other | Run order becomes a hidden contract. Reordering or sharding breaks the suite. |
| Real network / clock / DB in unit tests | Slow, flaky, and not under your control. Inject. |
| One giant "happy path" integration test | Failures don't localize. You see "something broke" but not what. |
| Mocking everything | Tests pass; production breaks. The mocks drifted from reality. |
| Asserting implementation details (private fields, call counts) | Refactor breaks the test even though behavior is identical. |
| Flaky tests retried until green | A flaky test is a real bug — usually concurrency or hidden state. Fix it, don't paper over it. |
| Skipping tests "just for now" | The skip never gets unskipped. Either delete or fix. |
| Letting AI generate both tests and code in one turn | Same hallucination on both sides; suite passes; behavior is wrong. |
| "AI says it works" | The AI cannot verify behavior. Only a green, mutation-tested suite can. |

---

## 7. Cheat Sheet

### The loop

```
Red    →  write smallest failing test
Green  →  write smallest code to pass
Refactor → improve design; keep tests green
Commit →  smallest meaningful change; descriptive message
```

### Per-function test checklist

- [ ] Happy path with typical input
- [ ] Boundary: min, max, just-below-min, just-above-max
- [ ] Zero / one / negative / empty
- [ ] `null` / `undefined` / missing field
- [ ] Wrong type (where the language allows it)
- [ ] Oversized input
- [ ] Whitespace / encoding edge cases
- [ ] Error path — right exception type, useful message
- [ ] Resources cleaned up on error
- [ ] Idempotence (same input → same output, repeatable)
- [ ] Integration boundaries: network failure, timeout, malformed response
- [ ] Concurrency (if relevant)
- [ ] Security inputs (if user-facing)
- [ ] Determinism (no real clock, no real RNG, no real network)

### Test quality questions

- What is the **one** behavior this asserts?
- What would have to be wrong for this test to fail?
- Could the production code be broken and this test still pass?
- Is the test name a sentence about the behavior?
- Can the test run in any order? In parallel?
- Does it run in milliseconds?

### When using AI to write code

- [ ] I wrote the failing test myself.
- [ ] I read every line the AI produced.
- [ ] I verified every imported symbol actually exists.
- [ ] I added boundary / null / error tests the AI didn't think of.
- [ ] I ran mutation testing on anything the AI tested.
- [ ] The change is small enough to review in one sitting.
- [ ] The commit message describes the behavior change, not "AI changes."

### The DORA-2025 framing to remember

> AI is an amplifier. Strong testing discipline → AI makes you faster *and* safer.
> Weak testing discipline → AI just ships your bugs faster.

---

*This file lives at `ebooks/tdd-guidelines.md` alongside `coding-standards.md` and
`animation-and-ui-guidelines.md`. Update as the DORA report iterates and as AI-assisted
development patterns evolve.*
