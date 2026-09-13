// PROTOTYPE — requirement inspector panel with full decision chain and non-destructive updating.
import { useMemo } from 'react';
import type { EventReachability } from './reachability';
import { translate } from '../../i18n/translate';
import type { Language, GameState, HistoryItem } from '../../types/game';
import {
  formatEffectWithProjection,
  formatRequirementDisplay,
  parseStatusRequirement,
  humanizeStatusName,
  splitTopLevelOr,
} from './formatters';
import { buildDecisionChainForStat, buildDecisionChainForStatus, type DecisionChainItem } from './decisionChainEngine';
import { getAllConsequencesForDecision } from './dependencyIndex';
import { evaluateCondition } from '../../engine/evaluator';
import { findRoutesForClause } from './routePlanner';

function shortDecisionLabel(id: string): string {
  const tr = translate('English', id);
  if (tr && tr !== id) return tr;
  const parts = id.split('_DECISION_');
  return parts[1] ? parts[1].replace(/_/g, ' ') : id;
}

function shortEventLabel(id: string): string {
  const tr = translate('English', id);
  if (tr && tr !== id) return tr;
  return id.replace(/^EVENTS_[A-Z]+_/, '').replace(/_/g, ' ');
}

// Extracts a single atomic stat/status comparison out of a clause fragment (no && / ||).
// Returns display info + the decision chain that can satisfy it.
function analyzeAtom(
  rawAtom: string,
  gameState: GameState,
  timeline: HistoryItem[],
  plannedDecisions: Record<number, string>
) {
  const trimmed = rawAtom.trim();
  const statMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*(>=|<=|>|<|==|!=)\s*([-+]?\d+)$/);
  const statName = statMatch ? statMatch[1] : null;
  const statusReq = parseStatusRequirement(trimmed);

  let currentValInfo: string | null = null;
  if (statName) {
    if (statName in gameState.stats) {
      currentValInfo = `current ${statName} = ${gameState.stats[statName]}`;
    } else if (statName in gameState.characters) {
      currentValInfo = `current ${statName} = ${gameState.characters[statName].relations}`;
    }
  } else if (statusReq) {
    const c = gameState.characters[statusReq.person];
    if (c) {
      const currentStatusPretty = c.status ? humanizeStatusName(c.status) : 'no status set';
      currentValInfo = `current: ${statusReq.person} is ${currentStatusPretty}`;
    }
  }

  const decisionChain: DecisionChainItem[] = statName
    ? buildDecisionChainForStat(statName, timeline, plannedDecisions)
    : statusReq
      ? buildDecisionChainForStatus(statusReq.person, statusReq.statusName, timeline, plannedDecisions)
      : [];

  const chainLabel = statName ?? (statusReq ? `${statusReq.person}'s status` : '');
  const satisfied = evaluateCondition(trimmed, gameState);

  return { raw: trimmed, satisfied, currentValInfo, decisionChain, chainLabel };
}

export function RequirementInspector({
  info,
  gameState,
  timeline,
  plannedDecisions,
  lang,
  onToggleChainChoice,
}: {
  info: EventReachability | null;
  gameState: GameState;
  timeline: HistoryItem[];
  plannedDecisions: Record<number, string>;
  lang: Language;
  onToggleChainChoice: (eventIndex: number, decisionId: string) => void;
}) {
  if (!info) {
    return (
      <div className="rg-inspector rg-inspector-empty">
        <h4>Target Event Conditions</h4>
        <p>Click any node in the graph — past, present, or future — to inspect its conditions and decision chain here.</p>
      </div>
    );
  }

  const { event, eventSatisfied, eventReport, decisions } = info;
  const title = translate(lang, event.id) || shortEventLabel(event.id);
  const playableCount = decisions.filter((d) => d.satisfied).length;

  return (
    <div className="rg-inspector">
      <div className="rg-header-row">
        <div>
          <span className="rg-inspector-kicker">INSPECTING EVENT</span>
          <h3 className="rg-inspector-title">{title}</h3>
        </div>
        <div className={`rg-inspector-status ${eventSatisfied ? 'ok' : 'blocked'}`}>
          {eventSatisfied ? 'UNLOCKED' : 'EVENT LOCKED'}
        </div>
      </div>

      <p className="rg-inspector-summary">
        {eventSatisfied
          ? `${playableCount} of ${decisions.length} choices are playable in your current timeline.`
          : 'This event will not appear on your timeline until its prerequisites are fulfilled.'}
      </p>

      {eventReport.length > 0 && (
        <div className="rg-req-block">
          <div className="rg-req-block-title">Event Prerequisites</div>
          {eventReport.map((report, ri) => (
            <div key={ri} className="rg-clause-group">
              {report.clauses.map((clause, ci) => (
                <ClauseRow
                  key={ci}
                  clause={clause}
                  gameState={gameState}
                  timeline={timeline}
                  plannedDecisions={plannedDecisions}
                  onToggleChainChoice={onToggleChainChoice}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="rg-req-block">
        <div className="rg-req-block-title">Choices &amp; Requirements</div>
        {decisions.map((d, di) => {
          const decTitle = translate(lang, d.decision.id) || shortDecisionLabel(d.decision.id);
          const allConsequences = [...d.decision.rawConsequences, ...d.decision.rawHiddenConsequences];
          const formattedEffects = allConsequences.map((raw) => formatEffectWithProjection(raw, gameState));

          return (
            <div key={di} className={`rg-decision-block ${d.satisfied ? 'ok' : 'blocked'}`}>
              <div className="rg-decision-header">
                <span className={`rg-decision-icon ${d.satisfied ? 'ok' : 'blocked'}`}>
                  {d.satisfied ? '✓' : '✗'}
                </span>
                <span className="rg-decision-name">{decTitle}</span>
                <span className={`rg-decision-badge ${d.satisfied ? 'ok' : 'blocked'}`}>
                  {d.satisfied ? 'AVAILABLE' : 'LOCKED'}
                </span>
              </div>

              {formattedEffects.length > 0 && (
                <div className="rg-decision-effects-preview">
                  <span className="rg-effects-label">Trade-off if chosen:</span>
                  <ul className="rg-effects-list">
                    {formattedEffects.map((eff, ei) => (
                      <li key={ei}>{eff}</li>
                    ))}
                  </ul>
                </div>
              )}

              {d.report.map((report, ri) => (
                <div key={ri} className="rg-clause-group">
                  {report.clauses.map((clause, ci) => (
                    <ClauseRow
                      key={ci}
                      clause={clause}
                      gameState={gameState}
                      timeline={timeline}
                      plannedDecisions={plannedDecisions}
                      onToggleChainChoice={onToggleChainChoice}
                    />
                  ))}
                </div>
              ))}
              {d.report.length === 0 && (
                <div className="rg-clause-none">Always available (no requirements)</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClauseRow({
  clause,
  gameState,
  timeline,
  plannedDecisions,
  onToggleChainChoice,
}: {
  clause: {
    raw: string;
    satisfied: boolean;
    sources: { eventIndex: number; eventId: string; decisionId: string; raw: string }[];
  };
  gameState: GameState;
  timeline: HistoryItem[];
  plannedDecisions: Record<number, string>;
  onToggleChainChoice: (eventIndex: number, decisionId: string) => void;
}) {
  const displayExpr = formatRequirementDisplay(clause.raw, translate);

  // The `clause.raw` may itself be a top-level OR expression (reachability.ts only splits on
  // top-level &&). Split it here so each branch gets its own current-value readout and
  // decision chain — otherwise compound OR clauses show no related previous choices at all.
  const orBranches = splitTopLevelOr(clause.raw);
  const atoms = orBranches.map((atom) => analyzeAtom(atom, gameState, timeline, plannedDecisions));
  const isCompound = atoms.length > 1;

  return (
    <div className={`rg-clause ${clause.satisfied ? 'ok' : 'blocked'}`}>
      <div className="rg-clause-expr">
        <span className="rg-clause-status-dot">{clause.satisfied ? '✓ Met:' : '✗ Need:'}</span>{' '}
        <code>{displayExpr}</code>
      </div>

      {isCompound && !clause.satisfied && (
        <div className="rg-clause-or-hint">Any one of these is enough:</div>
      )}

      {atoms.map((atom, ai) => (
        <AtomRow
          key={ai}
          atom={atom}
          showLabel={isCompound}
          gameState={gameState}
          timeline={timeline}
          onToggleChainChoice={onToggleChainChoice}
        />
      ))}
    </div>
  );
}

function RouteRecommendations({ clauseRaw, gameState, timeline }: { clauseRaw: string; gameState: GameState; timeline: HistoryItem[] }) {
  const routes = useMemo(() => findRoutesForClause(clauseRaw, gameState, timeline, 3), [clauseRaw, gameState, timeline]);
  if (routes.length === 0) return null;

  return (
    <div className="rg-routes">
      <div className="rg-routes-title">Recommended ways (heuristic, not guaranteed)</div>
      {routes.map((route, ri) => (
        <div key={ri} className="rg-route-card">
          <div className="rg-route-header">
            <span className="rg-route-label">{ri === 0 ? 'Best route' : `Alternative ${ri}`}</span>
            <span className="rg-route-meta">
              {route.steps.length} {route.steps.length === 1 ? 'choice' : 'choices'}
              {route.negativeEffects.length > 0 ? ` · ${route.negativeEffects.length} trade-off${route.negativeEffects.length > 1 ? 's' : ''}` : ' · no negative effects'}
            </span>
          </div>
          <ol className="rg-route-steps">
            {route.steps.map((s, si) => (
              <li key={si}>
                <span className="rg-chain-ev">{shortEventLabel(s.eventId)}</span>
                {' → '}
                <span className="rg-chain-dec">{shortDecisionLabel(s.decisionId)}</span>
              </li>
            ))}
          </ol>
          {route.negativeEffects.length > 0 && (
            <div className="rg-route-tradeoffs">
              <span className="rg-route-tradeoffs-label">Trade-offs:</span>
              <ul className="rg-route-tradeoffs-list">
                {route.negativeEffects.map((e, ei) => (
                  <li key={ei}>{formatEffectWithProjection(e, gameState)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AtomRow({
  atom,
  showLabel,
  gameState,
  timeline,
  onToggleChainChoice,
}: {
  atom: ReturnType<typeof analyzeAtom>;
  showLabel: boolean;
  gameState: GameState;
  timeline: HistoryItem[];
  onToggleChainChoice: (eventIndex: number, decisionId: string) => void;
}) {
  const { satisfied, currentValInfo, decisionChain, chainLabel, raw } = atom;

  return (
    <div className="rg-atom">
      {showLabel && (
        <div className={`rg-atom-label ${satisfied ? 'ok' : 'blocked'}`}>
          <span className="rg-clause-status-dot">{satisfied ? '✓' : '✗'}</span>{' '}
          <code>{formatRequirementDisplay(raw, translate)}</code>
          {currentValInfo && (
            <span className={`rg-current-stat-tag ${satisfied ? 'ok' : 'blocked'}`}>
              ({currentValInfo})
            </span>
          )}
        </div>
      )}
      {!showLabel && currentValInfo && (
        <span className={`rg-current-stat-tag ${satisfied ? 'ok' : 'blocked'}`}>
          ({currentValInfo})
        </span>
      )}

      {/* Show the Decision Chain if this atom is unmet */}
      {!satisfied && decisionChain.length > 0 && (
        <div className="rg-clause-sources">
          <div className="rg-chain-header">
            <span className="rg-chain-title">Decision Chain to Reach Required {chainLabel}:</span>
            <span className="rg-chain-hint">Click any option to toggle it in your timeline</span>
          </div>

          <div className="rg-chain-list">
            {decisionChain.map((item, i) => {
              const allConsequences = getAllConsequencesForDecision(item.eventIndex, item.decisionId);
              const isOnTimeline = item.stepNumber !== null;
              const cardState = item.isSelected
                ? 'selected'
                : item.isInvalidated
                  ? 'invalidated'
                  : item.isPlanned
                    ? 'planned'
                    : 'unselected';
              return (
                <button
                  key={i}
                  className={`rg-chain-item-card ${cardState}`}
                  onClick={() => onToggleChainChoice(item.eventIndex, item.decisionId)}
                  title={
                    item.isSelected
                      ? 'Currently selected in your timeline'
                      : item.isInvalidated
                        ? 'This planned choice is no longer reachable after an earlier change. Click to clear the stale plan.'
                        : item.isPlanned
                          ? 'Planned — will auto-apply once this event is reached. Click to unplan.'
                          : isOnTimeline
                            ? 'Click to select this decision and recalculate stats'
                            : 'Not yet reached — click to plan this choice for when it becomes available'
                  }
                >
                  <div className="rg-chain-status-col">
                    <span className="rg-chain-checkbox">
                      {item.isSelected || item.isPlanned ? '☑' : item.isInvalidated ? '⚠' : '☐'}
                    </span>
                    {isOnTimeline ? (
                      <span className="rg-chain-step-badge">Step #{item.stepNumber}</span>
                    ) : item.isInvalidated ? (
                      <span className="rg-chain-invalidated-badge">Invalidated</span>
                    ) : item.isPlanned ? (
                      <span className="rg-chain-planned-badge">Planned</span>
                    ) : (
                      <span className="rg-chain-future-badge">Not yet reached</span>
                    )}
                  </div>

                  <div className="rg-chain-info-col">
                    <div className="rg-chain-names">
                      <span className="rg-chain-ev">{shortEventLabel(item.eventId)}</span>
                      <span className="rg-chain-arrow">→</span>
                      <span className="rg-chain-dec">{shortDecisionLabel(item.decisionId)}</span>
                    </div>
                    <div className="rg-chain-yield">
                      <span className="rg-chain-yield-badge">Yields:</span>
                      {allConsequences.length > 0 ? (
                        <ul className="rg-chain-yield-list">
                          {allConsequences.map((raw, ei) => (
                            <li key={ei}>{formatEffectWithProjection(raw, gameState)}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="rg-chain-yield-list-empty">{item.rawEffect}</span>
                      )}
                      {item.isSelected ? (
                        <span className="rg-chain-active-tag">Active Choice</span>
                      ) : item.isInvalidated ? (
                        <span className="rg-chain-invalidated-tag">Plan unavailable after this change — click to clear</span>
                      ) : item.isPlanned ? (
                        <span className="rg-chain-planned-tag">Planned — click to unplan ↵</span>
                      ) : isOnTimeline ? (
                        <span className="rg-chain-action-tag">Click to choose ↵</span>
                      ) : (
                        <span className="rg-chain-action-tag">Click to plan ↵</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!satisfied && decisionChain.length === 0 && (
        <div className="rg-clause-sources rg-clause-sources-unknown">
          Depends on starting character background or hidden storyline conditions.
        </div>
      )}

      {!satisfied && (
        <RouteRecommendations clauseRaw={raw} gameState={gameState} timeline={timeline} />
      )}
    </div>
  );
}
