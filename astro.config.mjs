// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // canonical / hreflang / sitemap 의 절대 URL 기준. 반드시 실제 도메인이어야 한다.
  site: 'https://prelaps.com',

  // Cloudflare Pages 는 끝의 슬래시를 떼는 쪽으로 정규화한다.
  // canonical 이 /ko 인데 실제 주소가 /ko/ 가 되는 불일치를 막는다.
  trailingSlash: 'never',

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
