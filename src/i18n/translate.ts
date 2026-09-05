import enData from '../locales/English.json';
import ruData from '../locales/Русский.json';
import zhData from '../locales/简体中文.json';
import type { Language } from '../types/game';

const dicts: Record<Language, Record<string, string>> = {
  English: enData as any,
  Русский: ruData as any,
  '简体中文': zhData as any,
};

const extra: Record<string, Record<Language, string>> = {
  UI_GROUP_LIFETIME: { English: 'Lifetime', Русский: 'За всю жизнь', '简体中文': '终身' },
  UI_GROUP_FAMILY: { English: 'Family', Русский: 'Семья', '简体中文': '家庭' },
  UI_GROUP_PROVINCE: { English: 'Province', Русский: 'Провинция', '简体中文': '省份' },
  UI_GROUP_YOUTH: { English: 'Youth', Русский: 'Юность', '简体中文': '青年' },
  UI_GROUP_CHILDHOOD: { English: 'Childhood', Русский: 'Детство', '简体中文': '童年' },
  UI_GROUP_ADOLESCENCE: { English: 'Adolescence', Русский: 'Отрочество', '简体中文': '青春期' },
  UI_GROUP_OCCUPATION: { English: 'Occupation', Русский: 'Занятие', '简体中文': '职业' },
  UI_GROUP_REVOLT: { English: 'Revolt', Русский: 'Восстание', '简体中文': '叛乱' },
  UI_CHARACTERS: { English: 'Characters', Русский: 'Персонажи', '简体中文': '角色' },
  UI_FLAGS: { English: 'Flags', Русский: 'Флаги', '简体中文': '标记' },
  UI_STATS: { English: 'Stats', Русский: 'Характеристики', '简体中文': '属性' },
  UI_EVENTS: { English: 'Story Events', Русский: 'События истории', '简体中文': '故事事件' },
  UI_RESET: { English: 'Reset', Русский: 'Сброс', '简体中文': '重置' },
  UI_SAVE: { English: 'Save selected decisions to .txt file', Русский: 'Сохранить решения в .txt', '简体中文': '将决定保存为 .txt 文件' },
  UI_CLEAR: { English: 'Clear saved decisions', Русский: 'Очистить сохранённые решения', '简体中文': '清除已保存的决定' },
  UI_LANGUAGE: { English: 'Language', Русский: 'Язык', '简体中文': '语言' },
  UI_NO_STATUS: { English: '—', Русский: '—', '简体中文': '—' },
  UI_TITLE: { English: 'Sir Brante Calculator', Русский: 'Калькулятор Sir Brante', '简体中文': 'Sir Brante 计算器' },
  UI_END_OF_STORY: { English: 'End of the story.', Русский: 'Конец истории.', '简体中文': '故事结束。' },
};

export function translate(lang: Language, key: string | null | undefined): string {
  if (!key) return '';
  if (extra[key]) return extra[key][lang];
  const dict = dicts[lang];
  return dict[key] ?? key;
}

export function getLogicalOp(lang: Language, key: 'LOGICAL_OPERATION_AND' | 'LOGICAL_OPERATION_OR' | 'LOGICAL_OPERATION_NOT'): string {
  return dicts[lang][key] ?? key;
}
