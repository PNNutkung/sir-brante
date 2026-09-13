# Architecture

Code map for Sir Brante. Read this before touching `src/engine/`, `src/components/`, `src/hooks/`, or `src/prototype/`. Domain vocabulary lives in `CONTEXT.md`, not here — this doc is about *where code lives and how it flows*, not what terms mean.

## Subsystems

```
src/
├── engine/         pure calculation core (no rendering, no persistence)
├── hooks/           React adapter over engine/
├── components/       Variant A UI (the real, shipped app)
├── i18n/ + locales/   translation layer
├── data/             game-data.json — static content, not logic
├── types/            shared TS contracts
└── prototype/story-graph/   throwaway graph-viz prototype (see below)
```

### `src/engine/` — calculation core

| File | Role |
|---|---|
| `calculator.ts` | Event sequencing + timeline-edit entry points (`selectDecision`, `selectAtPosition`). Every edit calls `replay()`, which rebuilds `GameState` from scratch by walking the timeline from index 0 — there is no incremental update path. |
| `consequences.ts` | Applies one raw consequence string to `GameState`: stat deltas (clamped, with `childDeps` propagation), relations, status/name sets, flags, occupation-stat add/remove. |
| `evaluator.ts` | Tokenizer + recursive-descent parser + evaluator for the raw requirement grammar. `evaluateCondition()` is the only export used elsewhere; never throws outward (fails closed to `false`). AST cache is unbounded module-level state. |
| `initialState.ts` | Builds zero-state `GameState` from `game-data.json`; `cloneState()`. |

Data flow: UI calls `selectDecision`/`selectAtPosition` → `replay()` discards the old state, walks the timeline from scratch, calling `evaluateCondition()` (evaluator.ts) to re-check each step and `applyConsequences()` (consequences.ts) to mutate state → the first downstream item that fails re-validation **truncates the timeline right there** (see gap #1 below) → `getNextEvent()` appends the next event.

### `src/components/` + `src/hooks/` — Variant A app (the real UI)

The promoted "Classic 3-column" design (recent commits: 3 UI variants prototyped → Variant A promoted as main). `useGameEngine.ts` is a thin `useState` wrapper around `engine/calculator.ts`. `App.tsx` owns the only `EngineState` and `lang`, threaded down as props — no context, no store.

Click path: `DecisionOption` → `EventCard.onSelectDecision` → `EventTimeline.onChoose` → `App`'s `choose` (from the hook) → `selectAtPosition` → new `EngineState` → full re-render.

Some components (`EventTimeline`, `EventCard`) call `getEventByIndex`/`isDecisionAvailable` directly from `engine/calculator.ts` rather than through the hook — the hook is not a strict gateway.

### `src/prototype/story-graph/` — throwaway graph-viz prototype

**Current active work, branch `prototype/tree-graph`.** Per `mattpocock-skills:prototype` convention: throwaway code answering "what should a graph view of the story/decision tree look like, and does the underlying reachability/route model feel right?" Built on `@xyflow/react`. Reachable via `?prototype=story-graph`.

| File | Role |
|---|---|
| `StoryGraphPrototype.tsx` | Top-level route; owns live timeline, planned decisions, panel state; persists to `localStorage`. |
| `decisionChainEngine.ts` | `replayTimelinePreservingDownstream()` — a non-destructive replay that actually implements the documented Downstream Preservation invariant (production `engine/calculator.ts` does not yet — see gap #1). Also decision-chain solving. |
| `reachability.ts` | `computeReachability()` — full-graph sweep, not just "next event." |
| `routePlanner.ts` | `findRoutesForClause()` — bounded heuristic search, every candidate re-validated against real `applyConsequences`/`evaluateCondition`. |
| `dependencyIndex.ts` | Reverse index: consequence target → every `{event, decision}` that writes it. Shared by decision-chain building and route planning. |
| `graphModel.ts`, `StoryEventNode.tsx` | ReactFlow node/edge construction and rendering. |
| `RequirementInspector.tsx`, `CompactStatsBar.tsx` | Inspector panel UI. |
| `formatters.ts` | Display-only formatting; explicitly never consulted for evaluation. |
| `branchState.ts` | **Dead.** A discarded multi-branch/fork-tree design direction. Only its `Branch` *type* is used (by `graphModel.ts`); none of its functions are called anywhere. |

Per the throwaway convention, this code intentionally has no tests, `window.confirm`-based UX, `console.error`-only error handling, magic layout numbers, and a "not guaranteed" heuristic route search — none of that is a defect to fix here. It needs a real design pass (DAG layout, a real boolean-expression parser, a converged single "next event" implementation) before any of it becomes production code.

### `src/i18n/` + `src/locales/` — translation

`translate(lang, key)` looks up a small hardcoded `extra` dict first, then the per-language locale JSON, falling back to the raw key on miss (never throws, never warns — see gap #4). Event/decision ids double as their own localization keys.

### `src/data/game-data.json` — static content

232 events, 31 stats, 8 stat groups, 23 characters, 78 flags, 79 statuses. Imported wholesale (no lazy loading) by ~10 files across engine, components, and the prototype.

## Known gaps

Worth knowing before you change related code.

1. **OPEN — Downstream Preservation is documented but not yet real.** `CONTEXT.md`'s invariant describes `replayTimelinePreservingDownstream()` (prototype), not `calculator.ts`'s `replay()` (production, which truncates). Anyone editing an early decision in the shipped app today can lose later timeline entries, contrary to the glossary. Not yours to silently fix — folding prototype replay semantics into production is a functional decision; flag to the user or file an issue (`docs/agents/issue-tracker.md`) instead.
2. **FIXED (2026-09-13).** `src/engine/evaluator.ts`'s `Status.XYZ` symbolic resolution in `resolvePath` — previously every `Character == Status.X` requirement was silently unsatisfiable (431 raw expressions reference `Status.`).
3. **FIXED (2026-09-13).** `App.tsx` now lazy-loads `StoryGraphPrototype` via `React.lazy`/`Suspense` instead of a static import, so `@xyflow/react` and the prototype tree code-split out of the main bundle instead of shipping to every user.
4. **FIXED (2026-09-13).** Locale key drift: `game-data.json`'s `statuses.SHE_IS_EXECUTED` pointed at a locKey (`CHARACTER_SOPHIA_EXECUTED`) that existed in *no* locale file, and Simplified Chinese had 5 keys typo'd (`INQUISISTOR` vs `INQUISITOR`). Corrected the `game-data.json` locKey to match the pattern every other Sophia status follows, renamed the Russian key to match, and fixed the Chinese typo. All three locales now have identical key sets. `translate()` still falls back to echoing a raw key with no warning on future drift — worth a dev-mode check if this recurs.
5. **`compiled*` fields in `game-data.json` are dead and buggy** (see `CONTEXT.md`'s Raw/Compiled Expression entry) — don't build anything against them.
