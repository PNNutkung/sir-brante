import { useState, useEffect } from 'react';
import type { Language } from './types/game';
import { useGameEngine } from './hooks/useGameEngine';
import { Toolbar } from './components/Toolbar';
import { VariantA } from './components/VariantA';
import { VariantB } from './components/VariantB';
import { VariantC } from './components/VariantC';
import { PrototypeSwitcher, type PrototypeVariant } from './components/PrototypeSwitcher';
import { translate } from './i18n/translate';
import { getEventByIndex } from './engine/calculator';
import './App.css';

const VARIANTS: PrototypeVariant[] = [
  {
    id: 'A',
    name: 'Classic 3-Column',
    description: 'Faithful reproduction of WPF desktop GUI layout (Characters/Flags left, Events center, Stats right).',
  },
  {
    id: 'B',
    name: 'Grimoire / Two-Page Tome',
    description: 'Book-style narrative: Story on the left page, interactive Ledger with tabbed stats on the right.',
  },
  {
    id: 'C',
    name: 'Focused Stepper & Vitals',
    description: 'Single-event focus stage, top vitals HUD, collapsible history drawer, and compact side dossier.',
  },
];

function App() {
  const [lang, setLang] = useState<Language>('English');
  const { engine, choose, reset } = useGameEngine();

  // Read variant from URL search param (?variant=A/B/C)
  const [variant, setVariant] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('variant') || 'A';
  });

  const handleVariantChange = (newV: string) => {
    setVariant(newV);
    const url = new URL(window.location.href);
    url.searchParams.set('variant', newV);
    window.history.replaceState({}, '', url.toString());
  };

  useEffect(() => {
    const onPopState = () => {
      const p = new URLSearchParams(window.location.search);
      setVariant(p.get('variant') || 'A');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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

      <main className="variant-stage">
        {variant === 'A' && <VariantA engine={engine} lang={lang} onChoose={choose} />}
        {variant === 'B' && <VariantB engine={engine} lang={lang} onChoose={choose} />}
        {variant === 'C' && <VariantC engine={engine} lang={lang} onChoose={choose} />}
      </main>

      <PrototypeSwitcher
        variants={VARIANTS}
        current={variant}
        onChange={handleVariantChange}
      />
    </div>
  );
}

export default App;
