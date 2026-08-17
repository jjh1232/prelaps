import type { Locale } from '../i18n/config';
import type { TranslationKey } from '../i18n/utils';

export interface Tool {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  /** 도구 우선 URL 규칙: /mojibake/ko (docs/prelaps-architecture.md §5) */
  href: (lang: Locale) => string;
}

/** 도구를 추가할 때 여기에 한 항목 + locales/*.json 에 name/desc 문구를 넣는다. */
export const TOOLS: Tool[] = [
  {
    id: 'mojibake',
    nameKey: 'tools.mojibake.name',
    descKey: 'tools.mojibake.desc',
    href: (lang) => `/mojibake/${lang}`,
  },
];
