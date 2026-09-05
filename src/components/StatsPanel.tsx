import type { GameState, StatGroupDef } from '../types/game';
import type { Language } from '../types/game';
import { translate } from '../i18n/translate';
import gameData from '../data/game-data.json';

const statLocKeys: Record<string, string> = {
  Willpower: 'STAT_LIFETIME_WILLPOWER',
  Deaths: 'STAT_LIFETIME_DEATHS',
  Reputation: 'STAT_FAMILY_REPUTATION',
  Wealth: 'STAT_FAMILY_WEALTH',
  Unity: 'STAT_FAMILY_UNITY',
  Order: 'STAT_PROVINCE_ORDER',
  WealthOfMagra: 'STAT_PROVINCE_WEALTH_OF_MAGRA',
  Power: 'STAT_PROVINCE_POWER',
  Church: 'STAT_PROVINCE_CHURCH',
  Diplomacy: 'STAT_YOUTH_DIPLOMACY',
  Valor: 'STAT_YOUTH_VALOR',
  Theology: 'STAT_YOUTH_THEOLOGY',
  Eloquence: 'STAT_YOUTH_ELOQUENCE',
  Manipulation: 'STAT_YOUTH_MANIPULATION',
  Scheming: 'STAT_YOUTH_SCHEMING',
  Determination: 'STAT_CHILDHOOD_DETERMINATION',
  Perception: 'STAT_CHILDHOOD_PERCEPTION',
  Nobility: 'STAT_ADOLESCENCE_NOBILITY',
  Ingenuity: 'STAT_ADOLESCENCE_INGENUITY',
  Spirituality: 'STAT_ADOLESCENCE_SPIRITUALITY',
  Career: 'STAT_OCCUPATION_JUDGE_CAREER',
  Justice: 'STAT_OCCUPATION_JUDGE_JUSTICE',
  Inquisition: 'STAT_OCCUPATION_INQUISITOR_INQUISITION_POWER',
  Tolerance: 'STAT_OCCUPATION_INQUISITOR_TOLERANCE_OF_FAITHS',
  Unrest: 'STAT_OCCUPATION_CONSPIRATOR_UNREST',
  Network: 'STAT_OCCUPATION_CONSPIRATOR_SPY_NETWORK',
  Revolt: 'STAT_REVOLT_REVOLT',
  Troops: 'STAT_REVOLT_TROOPS',
  Nobles: 'STAT_REVOLT_NOBLES',
  Clergy: 'STAT_REVOLT_CLERGY',
  CommonFolk: 'STAT_REVOLT_COMMON_FOLK',
};

export function StatsPanel({ state, lang }: { state: GameState; lang: Language }) {
  const groups = gameData.statGroups as StatGroupDef[];

  return (
    <div className="panel stats-panel">
      <h3 className="panel-title">{translate(lang, 'UI_STATS')}</h3>
      {groups.map((g) => {
        // occupation group only shows active stats
        const visibleStats = g.id === 'occupation'
          ? state.activeOccupationStats.filter((s) => g.stats.includes(s))
          : g.stats;
        if (visibleStats.length === 0) return null;
        return (
          <div key={g.id} className="stat-group">
            <div className="stat-group-title">{translate(lang, g.locKey)}</div>
            {visibleStats.map((statName) => (
              <div key={statName} className="stat-row">
                <span className="stat-name">{translate(lang, statLocKeys[statName] ?? statName)}</span>
                <span className="stat-value">{state.stats[statName]}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
