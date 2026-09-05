import type { Language } from '../types/game';

const LANGS: Language[] = ['English', 'Русский', '简体中文'];

export function LanguageSelector({ lang, onChange }: { lang: Language; onChange: (l: Language) => void }) {
  return (
    <select className="lang-select" value={lang} onChange={(e) => onChange(e.target.value as Language)}>
      {LANGS.map((l) => (
        <option key={l} value={l}>{l}</option>
      ))}
    </select>
  );
}
