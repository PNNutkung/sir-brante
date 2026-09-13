# ADR 0001: Non-Destructive Downstream Timeline Preservation & In-Place Decision Chains

- **Status**: Accepted
- **Date**: 2026-09-05

## Context
In interactive fiction calculation tools (and specifically *The Life and Suffering of Sir Brante*), changing an early decision traditionally invalidates the entire downstream playthrough or rolls the user's cursor back to the altered step. When users are planning late-game requirements (such as Adulthood career choices or Revolt outcomes), they need to experiment with earlier choices to meet stat prerequisites without losing their work in later chapters.

## Decision
1. **Downstream Preservation**: Changing an earlier choice at step `k` does not truncate downstream steps `k+1..N`. Instead, the timeline runs a deterministic replay from step 1. Decisions that remain valid stay selected. Decisions rendered invalid by the stat shift are marked unselected/invalidated in place without destroying the timeline sequence or resetting the user's step focus.
2. **Decision Chains**: For unmet prerequisite stats (e.g. `Determination >= 2`), the UI surfaces an aggregated decision chain of all upstream candidate choices, showing which ones are currently selected, and allowing one-click toggling directly from the requirement inspector.
3. **Full-Bleed Viewport Layout**: The application root container (`#root`) fills 100vw and 100vh with zero margin or container constraints, allocating maximum visual space to the story graph canvas.

## Consequences
- **Positive**: Seamless time-traveling through decisions; users can tweak early stats to test downstream unlock conditions effortlessly.
- **Trade-offs**: Downstream re-evaluation requires non-destructive reconciliation rather than naive array slicing. Handled deterministically by our pure replay evaluator.
