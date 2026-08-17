/**
 * 사이트 전역 i18n 설정. 언어를 늘리는 지점은 여기 한 곳뿐이다.
 * 언어 추가 = LOCALES 에 코드 한 줄 + LOCALE_LABELS 한 줄 + src/locales/<code>.json 파일 1개.
 */

/** 배포 도메인. canonical / hreflang 절대 URL 생성에 쓴다. */
export const SITE = 'https://prelaps.com';

/** 지원 언어. 배열 순서가 hreflang / 언어 전환 UI 순서가 된다. */
export const LOCALES = ['ko', 'en', 'ja'] as const;

export type Locale = (typeof LOCALES)[number];

/** 기본 언어. 언어 없는 경로(/)가 향하는 곳이자 hreflang x-default 의 대상. */
export const DEFAULT_LOCALE: Locale = 'ko';

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
