import { TOOLS } from './tools';
import type { Locale } from '../i18n/config';
import type { TranslationKey } from '../i18n/utils';

/**
 * 허브에서 도구 안의 글로 나가는 통로.
 *
 * 글은 각 도구 저장소 안에 있고 허브가 만들지 않는다. 그런데 허브가 링크를
 * 갖고 있지 않으면 홈에서 그 글로 가는 경로가 아예 없다 — 실제로 그 상태였고,
 * 크롤러 입장에서 이 사이트는 「도구 넷 찍고 끝」으로 보였다.
 * 여기 한 줄이 홈 → 글 의 유일한 통로다.
 *
 * href 는 **canonical 과 같은 형태**여야 한다. 글의 canonical 은 확장자가 없는
 * `/mojibake/encoding-basics` 다. `.html` 을 붙이면 자산 층이 확장자 없는 쪽으로
 * 301 을 내보내므로, 허브의 모든 링크에 리다이렉트가 한 번씩 붙는다.
 */
export interface Article {
  id: string;
  /** 이 글이 사는 도구. 읽을 거리 페이지가 이 값으로 묶는다 (tools.ts 의 id 와 같다). */
  tool: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  /** 글도 도구 안에 살므로 언어 URL 규칙은 그 도구를 따른다. */
  href: (lang: Locale) => string;
}

/** mojibake 는 한국어가 루트에 있는 구조다 (tools.ts 의 같은 주석 참고). */
const mojibake = (slug: string) => (lang: Locale) =>
  lang === 'ko' ? `/mojibake/${slug}` : `/mojibake/${lang}/${slug}`;

/** 나머지 도구는 전부 /<도구>/<언어>/ 아래다 (헌법 §5). */
const under = (tool: string) => (slug: string) => (lang: Locale) =>
  `/${tool}/${lang}/${slug}`;

const imagesquish = under('imagesquish');
const race = under('race');
const vfile = under('vfile');

export const ARTICLES: Article[] = [
  {
    id: 'encoding-basics',
    tool: 'mojibake',
    titleKey: 'articles.encodingBasics.title',
    descKey: 'articles.encodingBasics.desc',
    href: mojibake('encoding-basics'),
  },
  {
    id: 'excel-csv',
    tool: 'mojibake',
    titleKey: 'articles.excelCsv.title',
    descKey: 'articles.excelCsv.desc',
    href: mojibake('excel-csv'),
  },
  {
    id: 'zip-filename',
    tool: 'mojibake',
    titleKey: 'articles.zipFilename.title',
    descKey: 'articles.zipFilename.desc',
    href: mojibake('zip-filename'),
  },
  {
    id: 'image-sizes',
    tool: 'imagesquish',
    titleKey: 'articles.imageSizes.title',
    descKey: 'articles.imageSizes.desc',
    href: imagesquish('image-sizes'),
  },
  {
    id: 'fair-draw',
    tool: 'race',
    titleKey: 'articles.fairDraw.title',
    descKey: 'articles.fairDraw.desc',
    href: race('fair-draw'),
  },
  {
    id: 'organize-without-moving',
    tool: 'vfile',
    titleKey: 'articles.organize.title',
    descKey: 'articles.organize.desc',
    href: vfile('organize-without-moving'),
  },
  {
    id: 'notepad-utf8',
    tool: 'mojibake',
    titleKey: 'articles.notepadUtf8.title',
    descKey: 'articles.notepadUtf8.desc',
    href: mojibake('notepad-utf8'),
  },
  {
    id: 'image-quality',
    tool: 'imagesquish',
    titleKey: 'articles.imageQuality.title',
    descKey: 'articles.imageQuality.desc',
    href: imagesquish('image-quality'),
  },
  {
    id: 'draw-many',
    tool: 'race',
    titleKey: 'articles.drawMany.title',
    descKey: 'articles.drawMany.desc',
    href: race('draw-many'),
  },
  {
    id: 'not-a-backup',
    tool: 'vfile',
    titleKey: 'articles.notABackup.title',
    descKey: 'articles.notABackup.desc',
    href: vfile('not-a-backup'),
  },
];

/**
 * 증상 → 갈 곳.
 *
 * 홈이 도구 이름만 늘어놓으면, 이름을 모르는 사람은 무엇을 눌러야 할지 모른다.
 * 방문자가 아는 것은 도구 이름이 아니라 자기가 겪고 있는 증상이다.
 *
 * 답 문장에 링크를 끼우지 않는다. 언어마다 어순이 달라 조각을 이어 붙이게 되고,
 * 그러면 세 언어가 조용히 어긋난다 (헌법 §8 과 같은 이유).
 * 문장은 문장대로 두고, 갈 곳은 별도 링크 한 줄로 뺀다.
 */
export interface Symptom {
  id: string;
  /** 방문자가 겪고 있는 상태. 도구 이름을 쓰지 않는다. */
  qKey: TranslationKey;
  /** 왜 그렇게 되는지와 어떻게 풀리는지. 링크 없는 완결된 문장. */
  aKey: TranslationKey;
  /** 링크 글자. 도구·글의 이름 키를 그대로 재사용한다. */
  linkKey: TranslationKey;
  href: (lang: Locale) => string;
}

export const SYMPTOMS: Symptom[] = [
  {
    id: 'excel-csv',
    qKey: 'home.find.s1.q',
    aKey: 'home.find.s1.a',
    linkKey: 'articles.excelCsv.title',
    href: mojibake('excel-csv'),
  },
  {
    id: 'zip-filename',
    qKey: 'home.find.s2.q',
    aKey: 'home.find.s2.a',
    linkKey: 'articles.zipFilename.title',
    href: mojibake('zip-filename'),
  },
  {
    id: 'paste',
    qKey: 'home.find.s3.q',
    aKey: 'home.find.s3.a',
    linkKey: 'tools.mojibake.name',
    href: (lang) => (lang === 'ko' ? '/mojibake/' : `/mojibake/${lang}/`),
  },
  {
    id: 'why',
    qKey: 'home.find.s4.q',
    aKey: 'home.find.s4.a',
    linkKey: 'articles.encodingBasics.title',
    href: mojibake('encoding-basics'),
  },
  {
    id: 'images',
    qKey: 'home.find.s5.q',
    aKey: 'home.find.s5.a',
    linkKey: 'tools.imagesquish.name',
    href: (lang) => `/imagesquish/${lang}/`,
  },
  {
    id: 'order',
    qKey: 'home.find.s6.q',
    aKey: 'home.find.s6.a',
    linkKey: 'tools.race.name',
    href: (lang) => `/race/${lang}/`,
  },
  {
    id: 'scattered',
    qKey: 'home.find.s7.q',
    aKey: 'home.find.s7.a',
    linkKey: 'tools.vfile.name',
    href: (lang) => `/vfile/${lang}/`,
  },
];

/** 자주 묻는 질문. 문구는 locales 의 `home.faq.q<n>` · `home.faq.a<n>` 다. */
export const FAQ_COUNT = 6;

/**
 * 도구별로 묶어 준다. 순서는 TOOLS 를 따른다 — 홈의 도구 카드와 같은 순서라야
 * 두 화면을 오갈 때 같은 물건이 같은 자리에 있다.
 */
export function articlesByTool() {
  const order = TOOLS.map((t) => t.id);
  return order
    .map((id) => ({
      tool: TOOLS.find((t) => t.id === id)!,
      articles: ARTICLES.filter((a) => a.tool === id),
    }))
    .filter((g) => g.articles.length > 0);
}
