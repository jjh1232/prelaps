import type { Locale } from '../i18n/config';
import type { TranslationKey } from '../i18n/utils';

/**
 * 도구를 묶는 갈래. 홈에서 이 순서대로 구획이 나온다.
 * 갈래를 늘릴 때는 여기 한 줄 + locales 의 `home.cat.<이름>` 한 줄이면 된다.
 */
export const CATEGORIES = ['tool', 'roulette'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Tool {
  id: string;
  category: Category;
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
    category: 'tool',
    nameKey: 'tools.mojibake.name',
    descKey: 'tools.mojibake.desc',
    // mojibake 는 한국어가 루트에 있는 구조다 (/mojibake/, /mojibake/en/, /mojibake/ja/).
    // 서브도메인 시절 색인된 경로를 그대로 유지하려고 재구조화하지 않았다.
    href: (lang) => (lang === 'ko' ? '/mojibake/' : `/mojibake/${lang}/`),
  },
  {
    id: 'race',
    category: 'roulette',
    nameKey: 'tools.race.name',
    descKey: 'tools.race.desc',
    // 허브와 같은 세 언어를 갖추고 있다. 언어판은 전부 /race/<언어>/ 아래다 (헌법 §5).
    href: (lang) => `/race/${lang}/`,
  },
];

/** 갈래별로 묶어 준다. 비어 있는 갈래는 홈에 아예 안 나온다. */
export function byCategory() {
  return CATEGORIES
    .map((category) => ({ category, tools: TOOLS.filter((t) => t.category === category) }))
    .filter((group) => group.tools.length > 0);
}
