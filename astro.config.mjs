// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

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

      // 언어별 URL 을 서로의 대체 버전으로 묶어 sitemap 에 hreflang 을 넣어준다.
      i18n: {
        defaultLocale: 'ko',
        locales: { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' },
      },
    }),
  ],
});
