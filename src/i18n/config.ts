/**
 * 사이트 전역 i18n 설정. 언어를 늘리는 지점은 여기 한 곳뿐이다.
 * 언어 추가 = LOCALES 에 코드 한 줄 + LOCALE_LABELS 한 줄 + src/locales/<code>.json 파일 1개.
 */

/** 배포 도메인. canonical / hreflang 절대 URL 생성에 쓴다. */
export const SITE = 'https://prelaps.com';

/** 지원 언어. 배열 순서가 hreflang / 언어 전환 UI 순서가 된다. */
export const LOCALES = ['ko', 'en', 'ja'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * 기본 언어. 언어 없는 경로(/)가 향하는 곳이다.
 * "우리 주 방문자층이 누구냐" 에 답하는 값이다.
 */
export const DEFAULT_LOCALE: Locale = 'ko';

/**
 * hreflang x-default 가 향하는 곳.
 *
 * DEFAULT_LOCALE 과 **다른 질문에 답하는 값**이라 상수를 나눠 둔다.
 * x-default 는 ko·en·ja 어디에도 안 맞는 방문자 — 이를테면 독일어로 검색한
 * 사람 — 를 어디로 보낼지다. 제2언어로 영어를 읽는 사람이 압도적으로 많으므로
 * 영어가 맞다. 한국어가 루트인 것과는 별개 문제다.
 *
 * 둘을 한 값으로 묶었더니 mojibake(x-default = en)와 허브(x-default = ko)의
 * 신호가 같은 도메인 안에서 엇갈렸다. 그래서 분리했다.
 */
export const XDEFAULT_LOCALE: Locale = 'en';

/** 언어 전환 UI 에 노출할 이름. 각 언어는 자기 언어로 표기한다. */
export const LOCALE_LABELS: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
};

/** 임의 문자열이 지원 언어인지 좁혀준다. */
export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}
