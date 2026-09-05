import { useState } from 'react';
import type { Language } from './types/game';
import { useGameEngine } from './hooks/useGameEngine';
import { Toolbar } from './components/Toolbar';
import { CharacterPanel } from './components/CharacterPanel';
import { FlagPanel } from './components/FlagPanel';
import { StatsPanel } from './components/StatsPanel';
import { EventTimeline } from './components/EventTimeline';
import { translate } from './i18n/translate';
import { getEventByIndex } from './engine/calculator';
import './App.css';

function App() {
  const [lang, setLang] = useState<Language>('English');
  const { engine, choose, reset } = useGameEngine();

  const handleSave = () => {
    const lines: string[] = [];
    let n = 1;
    for (const item of engine.timeline) {
      if (!item.selectedDecisionId) continue;
      const ev = getEventByIndex(item.eventIndex);
      const dec = ev.decisions.find((d) => d.id === item.selectedDecisionId);
      if (!dec || ev.decisions.length <= 1) continue;
      lines.push(`${n}. ${translate(lang, ev.id)}: ${translate(lang, dec.id)}`);
      n++;
    }
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sir-brante-decisions.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    reset();
  };

  return (
    <div className="app-shell">
      <Toolbar
        lang={lang}
        onLangChange={setLang}
        onReset={reset}
        onClear={handleClear}
        onSave={handleSave}
      />

      <main className="main-layout">
        <div className="left-column">
          <CharacterPanel state={engine.gameState} lang={lang} />
          <FlagPanel state={engine.gameState} lang={lang} />
        </div>
        <div className="center-column">
          <EventTimeline engine={engine} lang={lang} onChoose={choose} />
        </div>
        <div className="right-column">
          <StatsPanel state={engine.gameState} lang={lang} />
        </div>
      </main>
    </div>
  );
}

export default App;
