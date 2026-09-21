// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';

/**
 * 페이지 소스가 마지막으로 바뀐 날을 Date 로 돌려준다. 여러 개를 주면 가장 최근.
 *
 * ⚠ 빌드 시각(new Date())을 쓰면 안 된다. 배포할 때마다 전 페이지가 「오늘 바뀜」이
 *   되고, 구글은 그게 사실이 아닌 것을 알아채면 **이 사이트의 lastmod 를 통째로
 *   무시한다.** 없는 것만 못한 상태가 되므로 git 이 아는 실제 날짜를 쓴다.
 *
 * 커밋 안 된 수정이 있는 파일은 **파일 수정 시각**을 쓴다. 오늘로 찍으면 안 된다 —
 * 커밋만 안 했을 뿐 내용은 며칠 전에 올라간 경우가 있고, 그때 오늘로 적으면
 * 구글이 다시 긁어보고 바뀐 게 없다는 것을 알게 된다. 그게 반복되면 무시당한다.
 * git 을 못 쓰는 환경이면 undefined 를 돌려 lastmod 를 아예 안 넣는다.
 * 틀린 날짜보다 없는 편이 낫다.
 */
const lastmodCache = new Map();
function lastmodOf(...files) {
  let newest;
  for (const f of files) {
    if (!lastmodCache.has(f)) {
      let iso;
      try {
        const dirty = execSync('git status --porcelain -- "' + f + '"', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        iso = dirty
          ? statSync(f).mtime.toISOString().slice(0, 10)
          : execSync('git log -1 --format=%cs -- "' + f + '"', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      } catch {
        iso = '';
      }
      lastmodCache.set(f, iso ? new Date(iso + 'T00:00:00Z') : null);
    }
    const d = lastmodCache.get(f);
    if (d && (!newest || d > newest)) newest = d;
  }
  return newest;
}

// https://astro.build/config
export default defineConfig({
  // canonical / hreflang / sitemap 의 절대 URL 기준. 반드시 실제 도메인이어야 한다.
  site: 'https://prelaps.com',

  // 주소는 /ko 형태로 통일한다. canonical / hreflang / sitemap 이 모두 이 형태다.
  trailingSlash: 'never',

  // 페이지를 폴더(dist/ko/index.html)가 아니라 파일(dist/ko.html)로 뽑는다.
  //
  // 폴더로 뽑으면 Cloudflare Pages 가 /ko 를 /ko/ 로 308 리다이렉트한다.
  // (끝 슬래시를 떼는 게 아니라 붙이는 쪽으로 정규화한다 — 실측으로 확인)
  // 그러면 canonical 이 가리키는 /ko 가 정작 리다이렉트되는 주소가 되어
  // 색인 신호가 흐려지고, 모든 요청에 리다이렉트가 한 번씩 붙는다.
  build: { format: 'file' },

  // 루트로 들어오면 기본 언어 페이지로 보낸다.
  // 개발 서버와 빌드 결과물 양쪽에 적용된다.
  // (실제 배포에서의 301 응답은 public/_redirects 가 담당)
  redirects: {
    '/': '/ko',
  },

  integrations: [
    sitemap({
      // 루트(/)는 /ko 로 넘기기만 하는 통로다. 색인 대상은 /ko 쪽이므로 목록에서 뺀다.
      filter: (page) => page !== 'https://prelaps.com/',

      // 각 URL 에 그 페이지가 실제로 바뀐 날을 붙인다.
      // 없으면 구글이 「발견은 했는데 언제 다시 볼지」를 스스로 정한다 —
      // 신규 도메인에서는 그게 몇 주씩 걸린다.
      //
      // 화면에 보이는 글은 대부분 locales/*.json 에 있으므로 그쪽도 같이 본다.
      // Base.astro 같은 공통 껍데기는 일부러 뺐다 — 헤더 한 줄 고쳤다고
      // 전 페이지가 「내용이 바뀌었다」고 나가면 그게 곧 부정확한 lastmod 다.
      serialize(item) {
        const m = new URL(item.url).pathname.match(/^\/(ko|en|ja)(?:\/([^/]+))?$/);
        if (!m) return item;
        const [, lang, page = 'index'] = m;
        const sources = [`src/pages/[lang]/${page}.astro`, `src/locales/${lang}.json`];
        if (page === 'index') sources.push('src/data/tools.ts');
        if (page === 'guides') sources.push('src/data/articles.ts');
        const d = lastmodOf(...sources);
        if (d) item.lastmod = d;
        return item;
      },

      // 언어별 URL 을 서로의 대체 버전으로 묶어 sitemap 에 hreflang 을 넣어준다.
      i18n: {
        defaultLocale: 'ko',
        locales: { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' },
      },
    }),
  ],
});
