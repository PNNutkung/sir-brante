## Agent skills

### Issue tracker

Issues are tracked as GitHub Issues in this repo (`PNNutkung/sir-brante`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Architecture — read before any implementation or decision

Code map and known gaps: `docs/architecture.md`. Required reading before touching `src/engine/`, `src/components/`, `src/hooks/`, or `src/prototype/` — it documents where the production engine's behavior currently diverges from `CONTEXT.md`'s stated invariants, and which files are dead/throwaway vs. shipped.

### Project phase

Currently in the **prototype** phase (`/mattpocock-skills:prototype`), branch `prototype/tree-graph`, exploring a graph-based story visualization at `src/prototype/story-graph/`. That directory is throwaway per the skill's convention: no tests, no polish, not a spec. Don't extend it toward production quality, and don't fold any of it into `src/engine/` or `src/components/` without an explicit go-ahead — real implementation happens later via `/mattpocock-skills:implement`, against validated decisions folded in by hand.

### Decision authority

UX/UI and functional/product decisions are directed by the user, not by an AI session. Propose options and trade-offs within the engine's existing constraints; don't choose a UI direction, state-model shape, or feature scope unilaterally.
