// PROTOTYPE — top-level route: single-timeline story graph with history stack, decision chains & localStorage persistence.
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { replayTimelinePreservingDownstream, loadPlannedDecisions, savePlannedDecisions, type PlannedDecisions } from './decisionChainEngine';
import { computeReachability, type EventReachability } from './reachability';
import { buildGraph } from './graphModel';
import { StoryEventNode } from './StoryEventNode';
import { RequirementInspector } from './RequirementInspector';
import { CompactStatsBar } from './CompactStatsBar';
import { getEventByIndex, initEngine } from '../../engine/calculator';
import { translate } from '../../i18n/translate';
import type { Language, HistoryItem } from '../../types/game';
import { formatEffectWithProjection } from './formatters';
import './story-graph.css';

const nodeTypes = { storyEvent: StoryEventNode };
const STORAGE_KEY = 'sir_brante_story_timeline_v1';
const PANEL_WIDTHS_KEY = 'sir_brante_story_panel_widths_v1';

const LEFT_WIDTH_MIN = 160;
const LEFT_WIDTH_MAX = 480;
const LEFT_WIDTH_DEFAULT = 240;
const RIGHT_WIDTH_MIN = 260;
const RIGHT_WIDTH_MAX = 600;
const RIGHT_WIDTH_DEFAULT = 350;

function clampWidth(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function loadPanelWidths(): { left: number; right: number } {
  try {
    const raw = localStorage.getItem(PANEL_WIDTHS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        left: clampWidth(Number(parsed.left), LEFT_WIDTH_MIN, LEFT_WIDTH_MAX, LEFT_WIDTH_DEFAULT),
        right: clampWidth(Number(parsed.right), RIGHT_WIDTH_MIN, RIGHT_WIDTH_MAX, RIGHT_WIDTH_DEFAULT),
      };
    }
  } catch (err) {
    console.error('Failed to parse persisted panel widths:', err);
  }
  return { left: LEFT_WIDTH_DEFAULT, right: RIGHT_WIDTH_DEFAULT };
}

function loadPersistedTimeline(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to parse persisted timeline:', err);
  }
  const defaultEngine = initEngine();
  return defaultEngine.timeline;
}

export function StoryGraphPrototype() {
  const [lang] = useState<Language>('English');
  const [timeline, setTimeline] = useState<HistoryItem[]>(loadPersistedTimeline);
  const [inspectedEventIndex, setInspectedEventIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [initialWidths] = useState(loadPanelWidths);
  const [leftWidth, setLeftWidth] = useState<number>(initialWidths.left);
  const [rightWidth, setRightWidth] = useState<number>(initialWidths.right);
  // Decisions staged for events not yet reached on the live timeline. Auto-applied
  // the moment the story naturally advances to that event (if still valid), so
  // pre-choosing a future decision updates the whole downstream trace instead of
  // just panning the camera there.
  const [plannedDecisions, setPlannedDecisions] = useState<PlannedDecisions>(loadPlannedDecisions);
  const dragRef = useRef<'left' | 'right' | null>(null);

  const rfInstanceRef = useRef<any>(null);

  const onSplitterPointerDown = (side: 'left' | 'right', e: React.PointerEvent) => {
    dragRef.current = side;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onLayoutPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    if (dragRef.current === 'left') {
      setLeftWidth(clampWidth(e.clientX, LEFT_WIDTH_MIN, LEFT_WIDTH_MAX, LEFT_WIDTH_DEFAULT));
    } else {
      setRightWidth(clampWidth(window.innerWidth - e.clientX, RIGHT_WIDTH_MIN, RIGHT_WIDTH_MAX, RIGHT_WIDTH_DEFAULT));
    }
  }, []);

  const onLayoutPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Persist planned decisions to localStorage whenever they change
  useEffect(() => {
    savePlannedDecisions(plannedDecisions);
  }, [plannedDecisions]);

  // Auto-persist timeline to localStorage on any change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timeline));
    } catch (err) {
      console.error('Failed to persist timeline:', err);
    }
  }, [timeline]);

  // Persist panel widths (debounced so we don't spam localStorage on every pointermove)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(PANEL_WIDTHS_KEY, JSON.stringify({ left: leftWidth, right: rightWidth }));
      } catch (err) {
        console.error('Failed to persist panel widths:', err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [leftWidth, rightWidth]);

  // Replay timeline preserving all downstream choices, applying any planned future decisions
  const engineState = useMemo(
    () => replayTimelinePreservingDownstream(timeline, plannedDecisions),
    [timeline, plannedDecisions]
  );
  const reachabilityMap = useMemo(() => computeReachability(engineState.gameState), [engineState]);
  const reportByIndex = useMemo(() => {
    const m = new Map<number, EventReachability>();
    for (const r of reachabilityMap) m.set(r.event.index, r);
    return m;
  }, [reachabilityMap]);

  const currentPos = engineState.timeline.length - 1;

  // Adapt to graph builder
  const branchView = useMemo(() => ({
    id: 'main',
    label: 'Current Story',
    timeline: engineState.timeline,
    parentBranchId: null,
    forkPosition: null,
    createdAt: 0,
  }), [engineState.timeline]);

  const inspected = inspectedEventIndex !== null ? reportByIndex.get(inspectedEventIndex) ?? null : null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((cur) => (cur === msg ? null : cur)), 3500);
  };

  // Stable ref-based pan function: `nodes` is produced by a useMemo below that
  // itself needs a stable click-handler reference, so panToNode must not depend
  // on `nodes` directly (that would create a circular dependency). Route reads
  // through a ref that's kept in sync via effect instead.
  const nodesRef = useRef<Node[]>([]);

  const panToNode = useCallback((eventIndex: number) => {
    const rf = rfInstanceRef.current;
    if (!rf) return;
    const node = nodesRef.current.find((n) => (n.data as any).eventIndex === eventIndex);
    if (node) {
      rf.setCenter(node.position.x + 160, node.position.y + 60, { zoom: 0.95, duration: 400 });
    }
  }, []);

  const handlePlannedBadgeClick = useCallback((eventIndex: number) => {
    setInspectedEventIndex(eventIndex);
    panToNode(eventIndex);
  }, [panToNode]);

  const { nodes, edges } = useMemo(
    () => buildGraph(branchView, reachabilityMap, 12, currentPos, plannedDecisions, handlePlannedBadgeClick),
    [branchView, reachabilityMap, currentPos, plannedDecisions, handlePlannedBadgeClick]
  );

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const handleNodeClick = useCallback((_: any, node: Node) => {
    const evIdx = (node.data as any).eventIndex as number;
    setInspectedEventIndex(evIdx);
  }, []);

  // Make a decision at current live step
  const livePos = engineState.timeline.findIndex((t) => t.selectedDecisionId === null);
  const activePos = livePos >= 0 ? livePos : engineState.timeline.length - 1;
  const activeItem = engineState.timeline[activePos];
  const activeEvent = activeItem ? getEventByIndex(activeItem.eventIndex) : null;
  const activeReport = activeItem ? reportByIndex.get(activeItem.eventIndex) ?? null : null;

  const handleChooseDecision = (decisionId: string) => {
    const decReport = activeReport?.decisions.find((d) => d.decision.id === decisionId);
    const ok = decReport?.satisfied ?? true;

    if (!ok) {
      if (activeEvent) {
        setInspectedEventIndex(activeEvent.index);
        panToNode(activeEvent.index);
        showToast(`Condition not met! Inspected requirements below.`);
      }
      return;
    }

    const nextTimeline = [...engineState.timeline];
    nextTimeline[activePos] = { ...nextTimeline[activePos], selectedDecisionId: decisionId };
    const extended = replayTimelinePreservingDownstream(nextTimeline);
    setTimeline(extended.timeline);
  };

  // Directly change or clear a past decision in-place WITHOUT resetting downstream decisions or cursor
  const handleUpdateDecisionAtPosition = (pos: number, decisionId: string | null) => {
    const nextTimeline = [...engineState.timeline];
    nextTimeline[pos] = { ...nextTimeline[pos], selectedDecisionId: decisionId };
    // Replay preserving downstream choices!
    const extended = replayTimelinePreservingDownstream(nextTimeline);
    setTimeline(extended.timeline);

    const ev = getEventByIndex(nextTimeline[pos].eventIndex);
    const title = translate('English', ev.id) || ev.id;
    if (decisionId) {
      showToast(`Updated choice for "${title}" without losing downstream progress.`);
    } else {
      showToast(`Cleared decision for "${title}". Choose again.`);
    }
  };

  // When clicking an option in the Decision Chain:
  // - If the source event is already on the timeline, update it in-place (no reset of downstream).
  // - If the source event has NOT been reached yet, stage it as a "planned" decision so it
  //   auto-applies the moment the story naturally advances there — no forced navigation back.
  const handleToggleChainChoice = useCallback((sourceEventIndex: number, targetDecisionId: string) => {
    const posOnTimeline = engineState.timeline.findIndex((t) => t.eventIndex === sourceEventIndex);

    if (posOnTimeline >= 0) {
      // Event already exists on our timeline! Update it in-place
      const currentDecision = engineState.timeline[posOnTimeline].selectedDecisionId;
      // If already selected, clicking it unselects; otherwise selects it
      const newDecisionId = currentDecision === targetDecisionId ? null : targetDecisionId;

      const nextTimeline = [...engineState.timeline];
      nextTimeline[posOnTimeline] = {
        ...nextTimeline[posOnTimeline],
        selectedDecisionId: newDecisionId,
      };

      // Non-destructive downstream replay!
      const extended = replayTimelinePreservingDownstream(nextTimeline, plannedDecisions);
      setTimeline(extended.timeline);

      const ev = getEventByIndex(sourceEventIndex);
      const dec = ev.decisions.find((d) => d.id === targetDecisionId);
      const decName = dec ? translate('English', dec.id) || dec.id.split('_DECISION_')[1]?.replace(/_/g, ' ') : 'Choice';

      if (newDecisionId) {
        showToast(`Updated Step #${posOnTimeline + 1} (${ev.id.replace(/^EVENTS_[A-Z]+_/, '')}) to "${decName}". Downstream preserved!`);
      } else {
        showToast(`Unchecked Step #${posOnTimeline + 1}. Downstream choices preserved.`);
      }
    } else {
      // Event is not yet on the active timeline. Stage this decision as "planned":
      // it will auto-apply the instant the story naturally reaches this event.
      // Deliberately do NOT navigate/pan away — the user is mid-inspection of a
      // different (downstream) requirement and shouldn't be yanked elsewhere.
      const ev = getEventByIndex(sourceEventIndex);
      const name = translate('English', ev.id) || ev.id;
      const dec = ev.decisions.find((d) => d.id === targetDecisionId);
      const decName = dec ? translate('English', dec.id) || dec.id.split('_DECISION_')[1]?.replace(/_/g, ' ') : 'Choice';

      setPlannedDecisions((prev) => {
        const next = { ...prev };
        if (next[sourceEventIndex] === targetDecisionId) {
          // Toggling off an already-planned choice
          delete next[sourceEventIndex];
          showToast(`Unplanned "${decName}" for "${name}".`);
        } else {
          next[sourceEventIndex] = targetDecisionId;
          showToast(`Planned "${decName}" for "${name}". It will auto-apply once reached, updating the trace.`);
        }
        return next;
      });
    }
  }, [engineState.timeline, plannedDecisions]);

  // Reset entire story history back to birth
  const handleResetAll = () => {
    if (window.confirm('Reset all decisions back to the beginning of the story?')) {
      const defaultEngine = initEngine();
      setTimeline(defaultEngine.timeline);
      setInspectedEventIndex(null);
      localStorage.removeItem(STORAGE_KEY);
      showToast('Timeline reset to Birth.');
    }
  };

  return (
    <div className="sg-root">
      {/* Top Banner with Reset Button */}
      <div className="sg-banner">
        <span className="sg-banner-badge">CALCULATOR</span>
        Story Event Graph &amp; Condition Solver. Changes persist across browser refresh.
        <button className="sg-banner-reset-btn" onClick={handleResetAll} title="Reset all story decisions back to Birth">
          🔄 Reset All Decisions
        </button>
      </div>

      {/* Global Compact Stats Bar */}
      <CompactStatsBar state={engineState.gameState} />

      {toastMessage && (
        <div className="sg-toast" role="status">
          {toastMessage}
        </div>
      )}

      <div
        className="sg-layout"
        style={{ gridTemplateColumns: `${leftWidth}px 6px minmax(0, 1fr) 6px ${rightWidth}px` }}
        onPointerMove={onLayoutPointerMove}
        onPointerUp={onLayoutPointerUp}
      >
        {/* Left Sidebar: Timeline History Stack */}
        <aside className="sg-branch-sidebar">
          <div className="sg-sidebar-header">
            <h3>Decision History ({engineState.timeline.length})</h3>
            <p className="sg-sidebar-desc">
              Chronological sequence of choices. Click any past step to pan to it, or clear its choice to rethink.
            </p>
          </div>

          <div className="sg-timeline-list">
            {engineState.timeline.map((item, pos) => {
              const ev = getEventByIndex(item.eventIndex);
              const title = translate('English', ev.id) || ev.id.replace(/^EVENTS_[A-Z]+_/, '').replace(/_/g, ' ');
              const dec = ev.decisions.find((d) => d.id === item.selectedDecisionId);
              const decText = dec ? translate('English', dec.id) || dec.id.split('_DECISION_')[1]?.replace(/_/g, ' ') : null;

              return (
                <div key={pos} className={`sg-timeline-item ${pos === activePos ? 'live' : ''}`}>
                  <span className="sg-timeline-idx">{pos + 1}.</span>
                  <div className="sg-timeline-content">
                    <div
                      className="sg-timeline-name"
                      onClick={() => {
                        setInspectedEventIndex(item.eventIndex);
                        panToNode(item.eventIndex);
                      }}
                      title="Click to view in graph"
                    >
                      {title}
                    </div>
                    {decText ? (
                      <div className="sg-timeline-choice">↳ {decText}</div>
                    ) : (
                      <div className="sg-timeline-awaiting">Awaiting choice...</div>
                    )}
                  </div>
                  {dec && (
                    <button
                      className="sg-rethink-btn"
                      onClick={() => handleUpdateDecisionAtPosition(pos, null)}
                      title="Clear choice on this event and choose again"
                    >
                      ✕ clear
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {Object.keys(plannedDecisions).length > 0 && (
            <div className="sg-planned-section">
              <div className="sg-sidebar-header">
                <h3>Planned Choices ({Object.keys(plannedDecisions).length})</h3>
                <p className="sg-sidebar-desc">
                  Staged for events not yet reached. They auto-apply the moment the story gets there.
                </p>
              </div>
              <div className="sg-timeline-list">
                {Object.entries(plannedDecisions)
                  .map(([idxStr, decisionId]) => ({ eventIndex: Number(idxStr), decisionId }))
                  .sort((a, b) => a.eventIndex - b.eventIndex)
                  .map(({ eventIndex, decisionId }) => {
                    const ev = getEventByIndex(eventIndex);
                    const title = translate('English', ev.id) || ev.id.replace(/^EVENTS_[A-Z]+_/, '').replace(/_/g, ' ');
                    const dec = ev.decisions.find((d) => d.id === decisionId);
                    const decText = dec ? translate('English', dec.id) || dec.id.split('_DECISION_')[1]?.replace(/_/g, ' ') : decisionId;
                    const onTimelinePos = engineState.timeline.findIndex((t) => t.eventIndex === eventIndex);
                    const isReached = onTimelinePos >= 0;
                    const isApplied = isReached && engineState.timeline[onTimelinePos].selectedDecisionId === decisionId;
                    const isInvalidated = isReached && !isApplied;

                    return (
                      <div key={eventIndex} className="sg-timeline-item sg-planned-item">
                        <span className="sg-timeline-idx">⏳</span>
                        <div className="sg-timeline-content">
                          <div
                            className="sg-timeline-name"
                            onClick={() => {
                              setInspectedEventIndex(eventIndex);
                              panToNode(eventIndex);
                            }}
                            title="Click to inspect this event"
                          >
                            {title}
                          </div>
                          <div className={`sg-timeline-choice ${isInvalidated ? 'sg-planned-invalidated' : ''}`}>
                            {isApplied ? '✓ Applied: ' : isInvalidated ? '⚠ Invalidated (was): ' : '⏳ Planned: '}
                            {decText}
                          </div>
                        </div>
                        <button
                          className="sg-rethink-btn"
                          onClick={() => handleToggleChainChoice(eventIndex, decisionId)}
                          title="Clear this planned choice"
                        >
                          ✕ clear
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </aside>

        {/* Left Splitter */}
        <div
          className="sg-resizer"
          onPointerDown={(e) => onSplitterPointerDown('left', e)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize decision history panel"
        />

        {/* Center: Graph Canvas (Takes the largest screen area) */}
        <div className="sg-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            onInit={(inst) => {
              rfInstanceRef.current = inst;
            }}
            fitView
          >
            <Background color="#3a2e1f" gap={24} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Right Splitter */}
        <div
          className="sg-resizer"
          onPointerDown={(e) => onSplitterPointerDown('right', e)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector panel"
        />

        {/* Right Panel: Current Action + Requirement Inspector */}
        <aside className="sg-right-panel">
          {activeEvent && activeItem.selectedDecisionId === null && (
            <div className="sg-active-decision">
              <span className="sg-action-kicker">STEP #{activePos + 1} AWAITING CHOICE</span>
              <h3>{translate(lang, activeEvent.id) || activeEvent.id}</h3>
              <p className="sg-action-hint">Choose an option below to advance this path:</p>
              {activeEvent.decisions.map((dec) => {
                const decReport = activeReport?.decisions.find((d) => d.decision.id === dec.id);
                const ok = decReport?.satisfied ?? true;
                const decText = translate(lang, dec.id) || dec.id.split('_DECISION_')[1]?.replace(/_/g, ' ');
                const formattedEffects = dec.rawConsequences.map((raw) =>
                  formatEffectWithProjection(raw, engineState.gameState)
                );

                return (
                  <button
                    key={dec.id}
                    className={`sg-decision-btn-card ${ok ? 'ok' : 'blocked'}`}
                    onClick={() => handleChooseDecision(dec.id)}
                    title={ok ? 'Select this decision' : 'Click to inspect how to meet this condition'}
                  >
                    <div className="sg-dec-card-title-row">
                      <span className="sg-dec-card-title">{decText}</span>
                      {!ok ? (
                        <span className="sg-lock-tag">🔒 Locked (Click to inspect)</span>
                      ) : (
                        <span className="sg-available-tag">Available ↵</span>
                      )}
                    </div>
                    {formattedEffects.length > 0 && (
                      <div className="sg-dec-card-effects">
                        <span className="sg-effects-badge">Yields:</span>
                        <ul className="sg-effects-list">
                          {formattedEffects.map((eff, ei) => (
                            <li key={ei}>{eff}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <RequirementInspector
            info={inspected}
            gameState={engineState.gameState}
            timeline={engineState.timeline}
            plannedDecisions={plannedDecisions}
            lang={lang}
            onToggleChainChoice={handleToggleChainChoice}
          />
        </aside>
      </div>
    </div>
  );
}
