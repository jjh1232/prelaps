import en from '../locales/en.json';
import ko from '../locales/ko.json';
import ja from '../locales/ja.json';
import { DEFAULT_LOCALE, LOCALES, SITE, type Locale } from './config';

/**
 * en.json 이 키 목록의 기준(source of truth)이다.
 * 다른 언어 파일에 키가 빠지거나 오타가 나면 아래 `satisfies` 에서
 * `npm run check` 시 타입 에러로 잡힌다.
 */
type Dictionary = typeof en;

const dictionaries = { en, ko, ja } satisfies Record<Locale, Dictionary>;

/**
 * 해당 언어의 번역 함수를 돌려준다.
 *   const t = useTranslations('ko');
 *   t('home.heading')
 * 존재하지 않는 키는 에디터에서 즉시 빨간 줄이 그어진다.
 */
export function useTranslations(lang: Locale) {
  const dict = dictionaries[lang];
  return function t(key: keyof Dictionary): string {
    return dict[key];
  };
}

/**
 * 언어 없는 경로를 그 언어의 실제 경로로 바꾼다.
 *   localizePath('ko', '')       -> '/ko'
 *   localizePath('ko', '/about') -> '/ko/about'
 */
export function localizePath(lang: Locale, path = ''): string {
  return `/${lang}${path}`;
}

/** canonical / hreflang 용 절대 URL. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE).href;
}

/**
 * 페이지 하나가 가져야 할 hreflang 목록 전체를 만든다.
 * 규칙(docs/prelaps-architecture.md §5):
 *  - 모든 언어 페이지가 "전체 목록"을 동일하게 갖는다. 하나라도 빠지면 구글이 무시한다.
 *  - x-default 는 필수. 언어를 특정하지 못한 방문자를 어디로 보낼지 알리는 값이므로
 *    기본 언어(DEFAULT_LOCALE) 페이지를 가리킨다.
 */
export function hreflangLinks(path = '') {
  const links = LOCALES.map((lang) => ({
    hreflang: lang as string,
    href: absoluteUrl(localizePath(lang, path)),
  }));

  links.push({
    hreflang: 'x-default',
    href: absoluteUrl(localizePath(DEFAULT_LOCALE, path)),
  });

  return links;
}

/**
 * [lang] 동적 라우트가 공통으로 쓰는 getStaticPaths.
 * 템플릿 1개 -> 언어 수만큼 정적 HTML 이 빌드된다.
 */
export function localeStaticPaths() {
  return LOCALES.map((lang) => ({ params: { lang }, props: { lang } }));
}

/** locales/*.json 에 존재하는 키만 허용하는 타입. 데이터 파일에서 키를 참조할 때 쓴다. */
export type TranslationKey = keyof Dictionary;
