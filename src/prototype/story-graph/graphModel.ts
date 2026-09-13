// PROTOTYPE — graph model builder for React Flow.
import type { Node, Edge } from '@xyflow/react';
import type { EventDef } from '../../types/game';
import { allEvents, type EventReachability } from './reachability';
import type { Branch } from './branchState';
import { translate } from '../../i18n/translate';
import type { StoryNodeData } from './StoryEventNode';

export type EdgeConfidence = 'known' | 'inferred' | 'linear';

export interface GraphBuildResult {
  nodes: Node<StoryNodeData>[];
  edges: Edge[];
}

function eventHasPassedRefs(ev: EventDef): string[] {
  const refs: string[] = [];
  const all = [
    ...ev.rawRequirements,
    ...ev.rawHiddenRequirements,
    ...ev.decisions.flatMap((d) => [...d.rawRequirements, ...d.rawHiddenRequirements]),
  ];
  for (const r of all) {
    const m = r.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\.HasPassed/g);
    for (const mm of m) refs.push(mm[1]);
  }
  return refs;
}

const varNameToEvent = new Map<string, EventDef>();
for (const ev of allEvents) {
  if (ev.varName) varNameToEvent.set(ev.varName, ev);
}

function getChapterLabel(eventId: string): string {
  const m = eventId.match(/^EVENTS_([A-Z]+)_/);
  if (!m) return '';
  const map: Record<string, string> = {
    CHILDHOOD: 'Childhood',
    ADOLESCENCE: 'Adolescence',
    YOUTH: 'Youth',
    PEACETIME: 'Peace',
    REVOLT: 'Revolt',
    GENERAL: 'General',
  };
  return map[m[1]] ?? m[1];
}

export function buildGraph(
  branch: Branch,
  reachabilityMap: EventReachability[],
  lookahead: number,
  currentPos: number,
  plannedDecisions: Record<number, string> = {},
  onPlannedBadgeClick?: (eventIndex: number) => void
): GraphBuildResult {
  const nodes: Node<StoryNodeData>[] = [];
  const edges: Edge[] = [];
  const includedIndices = new Set<number>();

  // 1. Walked path
  for (const item of branch.timeline) {
    includedIndices.add(item.eventIndex);
  }

  // 2. Lookahead
  const lastIdx = branch.timeline[branch.timeline.length - 1]?.eventIndex ?? 0;
  let added = 0;
  for (let i = lastIdx + 1; i < allEvents.length && added < lookahead; i++) {
    includedIndices.add(i);
    added++;
  }

  // 3. Bidirectional HasPassed dependencies
  const reportByIndex = new Map<number, EventReachability>();
  for (const r of reachabilityMap) reportByIndex.set(r.event.index, r);

  for (const idx of Array.from(includedIndices)) {
    const ev = allEvents[idx];
    for (const varName of eventHasPassedRefs(ev)) {
      const target = varNameToEvent.get(varName);
      if (target) includedIndices.add(target.index);
    }
  }

  const sortedIndices = Array.from(includedIndices).sort((a, b) => a - b);

  sortedIndices.forEach((idx, row) => {
    const ev = allEvents[idx];
    const report = reportByIndex.get(idx)!;
    const timelinePos = branch.timeline.findIndex((t) => t.eventIndex === idx);
    const isOnPath = timelinePos >= 0;
    const isPast = isOnPath && timelinePos < currentPos;
    const isCurrent = isOnPath && timelinePos === currentPos;
    const isFuture = !isOnPath;

    let selectedDecisionText: string | null = null;
    if (isOnPath && branch.timeline[timelinePos]?.selectedDecisionId) {
      const decId = branch.timeline[timelinePos].selectedDecisionId!;
      selectedDecisionText = translate('English', decId) || decId.split('_DECISION_')[1]?.replace(/_/g, ' ');
    }

    let plannedDecisionText: string | null = null;
    if (!selectedDecisionText && plannedDecisions[idx]) {
      const decId = plannedDecisions[idx];
      plannedDecisionText = translate('English', decId) || decId.split('_DECISION_')[1]?.replace(/_/g, ' ');
    }

    const playableCount = report.decisions.filter((d) => d.satisfied).length;
    const hasPlayableChoice = playableCount > 0;

    nodes.push({
      id: `ev-${idx}`,
      type: 'storyEvent',
      position: { x: isOnPath ? 300 : 700, y: row * 200 },
      data: {
        eventIndex: idx,
        eventId: ev.id,
        chapter: getChapterLabel(ev.id),
        isUnlocked: report.eventSatisfied,
        hasPlayableChoice,
        playableCount,
        decisionCount: ev.decisions.length,
        isPast,
        isCurrent,
        isFuture,
        selectedDecisionText,
        plannedDecisionText,
        onPlannedBadgeClick,
      },
    });
  });

  // Explicit HasPassed edges
  for (const idx of sortedIndices) {
    const ev = allEvents[idx];
    for (const varName of eventHasPassedRefs(ev)) {
      const target = varNameToEvent.get(varName);
      if (target && includedIndices.has(target.index)) {
        edges.push({
          id: `known-${target.index}-${idx}`,
          source: `ev-${target.index}`,
          target: `ev-${idx}`,
          type: 'straight',
          style: { stroke: '#c9a227', strokeWidth: 2 },
          label: 'requires',
          data: { confidence: 'known' as EdgeConfidence },
        });
      }
    }
  }

  // Linear progression fallback edges
  for (let i = 0; i < sortedIndices.length - 1; i++) {
    const a = sortedIndices[i];
    const b = sortedIndices[i + 1];
    const already = edges.some((e) => e.source === `ev-${a}` && e.target === `ev-${b}`);
    if (!already) {
      edges.push({
        id: `linear-${a}-${b}`,
        source: `ev-${a}`,
        target: `ev-${b}`,
        type: 'straight',
        style: { stroke: '#4a3d2c', strokeWidth: 1, strokeDasharray: '4 3' },
        data: { confidence: 'linear' as EdgeConfidence },
      });
    }
  }

  return { nodes, edges };
}
