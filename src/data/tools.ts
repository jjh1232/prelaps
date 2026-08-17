import type { Locale } from '../i18n/config';
import type { TranslationKey } from '../i18n/utils';

export interface Tool {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  /**
   * 도구는 각자 배포되므로 언어 URL 규칙도 도구마다 다를 수 있다.
   * 허브가 규칙을 강제하지 않고, 도구가 자기 규칙을 함수로 알려준다.
   */
  href: (lang: Locale) => string;
}

/** 도구를 추가할 때 여기에 한 항목 + locales/*.json 에 name/desc 문구를 넣는다. */
export const TOOLS: Tool[] = [
  {
    id: 'mojibake',
    nameKey: 'tools.mojibake.name',
    descKey: 'tools.mojibake.desc',
    // mojibake 는 한국어가 루트에 있는 구조다 (/mojibake/, /mojibake/en/, /mojibake/ja/).
    // 서브도메인 시절 색인된 경로를 그대로 유지하려고 재구조화하지 않았다.
    href: (lang) => (lang === 'ko' ? '/mojibake/' : `/mojibake/${lang}/`),
  },
];
