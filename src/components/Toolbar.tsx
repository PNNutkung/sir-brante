import type { Language } from '../types/game';
import { translate } from '../i18n/translate';
import { LanguageSelector } from './LanguageSelector';

export function Toolbar({
  lang,
  onLangChange,
  onReset,
  onClear,
  onSave,
}: {
  lang: Language;
  onLangChange: (l: Language) => void;
  onReset: () => void;
  onClear: () => void;
  onSave: () => void;
}) {
  return (
    <div className="toolbar">
      <h1 className="toolbar-title">{translate(lang, 'UI_TITLE')}</h1>
      <div className="toolbar-actions">
        <label className="toolbar-lang-label">
          {translate(lang, 'UI_LANGUAGE')}:
          <LanguageSelector lang={lang} onChange={onLangChange} />
        </label>
        <button className="btn" onClick={onSave}>{translate(lang, 'UI_SAVE')}</button>
        <button className="btn" onClick={onClear}>{translate(lang, 'UI_CLEAR')}</button>
        <button className="btn btn-danger" onClick={onReset}>{translate(lang, 'UI_RESET')}</button>
      </div>
    </div>
  );
}
