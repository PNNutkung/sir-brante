# Domain Context: Sir Brante Decision Engine & Story Graph

This document defines the ubiquitous language and domain concepts for the Sir Brante narrative calculator, condition solver, and story graph visualization.

## Glossary

### Timeline
The ordered sequence of story events encountered during a playthrough. Each timeline item represents a specific event at a given step position (`1..N`), optionally paired with the player's chosen decision (`selectedDecisionId`).

### Decision History Stack
The persistent, linear stack of chosen decisions representing the user's active playthrough. Unlike a tree with divergent branches, the history stack is single and continuous, allowing in-place edits of past decisions.

### Downstream Preservation (Invariant)
When an earlier decision at step `k` is altered:
- Subsequent steps `k+1..N` are preserved in the timeline.
- The state engine replays from step 1 forward.
- If a downstream decision's conditions are still met, it remains selected.
- If a downstream decision's conditions are violated by the change, that specific decision is flagged as invalid or unselected, but the event node itself remains in the timeline without rolling back the user's active step focus.

**Implementation status (as of 2026-09-13): this invariant is NOT yet true of the production engine.** `src/engine/calculator.ts`'s `replay()` truncates — the first downstream item whose decision fails re-validation, and everything after it, is dropped from the timeline outright, not flagged in place. The invariant as specified above is upheld today only by the prototype's `replayTimelinePreservingDownstream()` in `src/prototype/story-graph/decisionChainEngine.ts`. Don't assume the production timeline preserves downstream steps until that prototype logic is folded into `src/engine/`. See `docs/architecture.md`.

### Decision Chain
A set or sequence of upstream decision choices capable of contributing to a required stat threshold (e.g. accumulating `Determination >= 2` via multiple +1 sources). The UI displays the full chain, highlights which choices are currently active, and allows direct toggling to fulfill target conditions.

### Prerequisite / Requirement
- **Event-Level Requirement**: Conditions that must be met for an event to be reached or appear in the timeline (e.g., `!TheSacrament.HasPassed`).
- **Choice-Level Requirement**: Conditions that gate a specific decision option within an event (e.g., `Determination >= 2`, `Willpower >= 0`).

### Consequence / Yield
Stat modifications, character relationship changes, or narrative plot flags applied upon selecting a decision option. Formatted cleanly as `{Stat} +{N}` or `{Character}: {Status}`.

### Raw Expression / Compiled Expression
Requirements and consequences in `game-data.json` each carry two string representations. **Raw** (`rawRequirements`, `rawConsequences`, etc.) is the original C#-derived mini-language (e.g. `Determination.Add(2)`, `Lydia == Status.GRATEFUL`) and is the only form actually evaluated, by `src/engine/evaluator.ts` and `src/engine/consequences.ts`. **Compiled** (`compiledReqs`, `compiledConseqs`, etc.) is a leftover JS-flavored translation from an earlier build step; it is dead data, unread by any code in `src/`, and contains a known bug (`state.flags.state.flags.` double-prefixing). Always work against raw expressions; don't wire anything to read compiled ones without fixing that bug first.

### GameState
The player's current simulated values, reconstructed from scratch on every timeline edit (no incremental update path): `stats`, `characters` (per-character relation score + status), `flags`, `activeOccupationStats` (the path-dependent subset of occupation stats currently visible), and `passedEvents`. Paired with a `Timeline` as `EngineState`.

## Story Graph Prototype (exploratory — not yet validated)

Vocabulary introduced by the in-progress graph-visualization prototype at `src/prototype/story-graph/` (see `docs/architecture.md`). Not part of the production data model until a decision is made to fold it in.

### Reachability
A full sweep over *every* event in the game against a given `GameState` (not just the single next one), classifying each event/decision as satisfied or blocked with a per-clause breakdown. Answers "what's unlocked right now, everywhere" — contrast with the production engine's single deterministic "find the next event."

### Planned Decision
A decision the player stages now for an event not yet reached on the live timeline. Auto-applies the moment replay naturally advances to that event, provided it's still valid then. Distinct from a Decision Chain: a plan is one staged future choice, not an enumeration of ways to satisfy a stat.

### Route
A scored, ordered combination of decision steps that, when simulated through the real engine, jointly satisfy a blocked requirement clause — produced by a bounded, capped heuristic search, not a guaranteed solver. Contrast with Decision Chain, which lists known sources for a single identifier without searching combinations.
