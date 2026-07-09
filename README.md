# StreamLab — Java Pipeline Visualizer

A faithful, client-side simulation of **Java Stream execution semantics**, presented as a 3D
**"neural conduit"** where operations are neurons and elements are electrical pulses that either fire
through or die. The signature idea: **a neural network wired backwards** — the terminal operation
reaches back and pulls one element at a time (a _retrograde demand spike_), dramatizing that streams
are lazy and demand-driven.

Runs **100% client-side** on Next.js (App Router) and deploys to Vercel as a **static, zero-function
SPA**. See [`planning/streamlab-spec.md`](./planning/streamlab-spec.md) and
[`planning/mvp-stories.md`](./planning/mvp-stories.md).

## Live demo

<!-- TODO: record the Vercel preview/production URL once the first deploy is green. -->

_Deploy URL: pending first Vercel deploy._

## Tech stack

- **Next.js 14** (App Router, `output: "export"` → static assets, **0 serverless/edge functions**)
- **TypeScript** (`strict`)
- **three.js** + **@react-three/fiber** + **@react-three/drei** + **@react-three/postprocessing** — the WebGL conduit
- **Zustand** — state (`config + eventLog + playhead`, arriving in S0.7)
- **Vitest** + **@testing-library/react** — tests

### Path aliases

| Alias        | Path           |
| ------------ | -------------- |
| `@/*`        | `src/*`        |
| `@/engine/*` | `src/engine/*` |
| `@/viz/*`    | `src/viz/*`    |
| `@/store/*`  | `src/store/*`  |

## Scripts

| Command             | Purpose                               |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Client-rendered dev server            |
| `npm run build`     | Static export to `out/` (0 functions) |
| `npm run lint`      | ESLint (`next lint`)                  |
| `npm run typecheck` | `tsc --noEmit` (strict)               |
| `npm run format`    | Prettier write                        |
| `npm test`          | Vitest run                            |

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

## Architecture guardrail

The visualization is a **pure function of the engine's event log** — it replays the real trace and
cannot drift from the engine. The engine stays **zero-React, framework-agnostic TypeScript**; all
non-conduit UI stays in DOM/SVG. (Enforced by an import boundary from S0.7 onward.)
