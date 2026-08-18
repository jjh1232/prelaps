# prelaps.com 사이트 구조 설계

> Claude Code 전달용 컨텍스트 문서.
> 결정 사항 + 작업 절차 정리.

---

## 0. 전제

- 도메인: `prelaps.com` (신규, 2026-08 취득)
- 호스팅: Cloudflare (Pages + Workers)
- 현재 상태: `mojibake.prelaps.com` 에 도구 1개 배포됨
  - 순수 HTML, 빌드 없음
  - 다국어 이미 구현됨 (URL 분리, 언어별 HTML 파일)
- 목표: 도구 / 게임 / 블로그를 장기적으로 계속 추가. 애드센스 수익화.
- 작성자 기술 배경: Node, React 경험 있음. Astro 미경험.

---

## 1. 핵심 결정: 서브도메인 → 서브디렉터리

기존 `mojibake.prelaps.com` 을 `prelaps.com/mojibake` 로 변경한다.

### 이유

| 항목 | 서브도메인 | 서브디렉터리 |
|---|---|---|
| SEO 자산 | 도구마다 흩어짐 | `prelaps.com` 에 누적 |
| 애드센스 심사 | 루트 도메인 기준 (동일) | 루트 도메인 기준 (동일) |
| 루트 페이지 필요 | 필요 (껍데기가 됨) | 필요 (허브로 실제 활용) |
| 라우팅 레이어 | 불필요 | 필요 (Worker) |

- 애드센스는 2023년부터 **도메인 단위 인증**. 서브도메인 개별 등록 불가. 루트 인증 없이는 서브도메인에 코드를 넣어도 작동하지 않음.
- 어느 쪽이든 루트 페이지는 필수 → 그렇다면 도구도 그 아래 두는 편이 SEO 이득까지 가져감.
- 복리 효과: 도구 A가 검색에 잡히면 도메인에 신호가 쌓여 이후 도구 B가 유리하게 출발.

### 예외 (서브도메인 유지)

- `api.prelaps.com` — 색인 대상 아닌 API 엔드포인트
- `app.prelaps.com` — 로그인/세션 붙는 제품이 생길 경우

---

## 2. 아키텍처

```
Cloudflare Pages (각각 독립 레포 / 독립 배포 / 스택 자유)
├── prelaps-home       → 허브, privacy, about, contact   [Astro]
├── prelaps-mojibake   → 깨진 한글 복구기                [순수 HTML, 현행 유지]
├── prelaps-game       → (예정)                          [Astro + React island]
└── prelaps-blog       → (예정)                          [Astro]

Cloudflare Worker: prelaps-router
└── prelaps.com/* 전부 수신 → 경로별로 위 Pages 로 프록시
```

### 원칙

- **배포는 완전히 독립.** 한 프로젝트 수정 시 다른 프로젝트/Worker 안 건드림.
- **URL 은 하나로 통합.** 유저·구글에게는 `prelaps.com` 단일 사이트.
- **Pages 프로젝트에 커스텀 도메인을 붙이지 않는다.** `.pages.dev` 만 두고 Worker 를 통해서만 노출. (붙이면 같은 콘텐츠가 두 주소로 접근되어 중복 콘텐츠 발생)

---

## 3. Worker 코드

`prelaps-router/src/index.js` (전문)

```js
/**
 * prelaps.com 의 단일 진입점.
 *
 * 경로 앞부분을 보고 해당 Cloudflare Pages 프로젝트로 프록시한다.
 * 각 Pages 프로젝트에는 커스텀 도메인을 붙이지 않는다 —
 * 붙이면 같은 콘텐츠가 .pages.dev 와 prelaps.com 두 주소로 열려 중복 콘텐츠가 된다.
 * (docs/prelaps-architecture.md §2)
 */

/**
 * 도구를 추가할 때 여기 한 줄.
 * 키 = prelaps.com 에서의 URL 접두사, 값 = 그 프로젝트의 .pages.dev 호스트.
 */
const ROUTES = {
  '/mojibake': 'prelaps-mojibake.pages.dev',
  // '/game': 'prelaps-game.pages.dev',
  // '/blog': 'prelaps-blog.pages.dev',
};

/** ROUTES 에 안 걸리는 경로는 전부 허브로. 허브가 자기 404 를 돌려준다. */
const HOME = 'prelaps-home.pages.dev';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    for (const [prefix, host] of Object.entries(ROUTES)) {
      // 접두사 뒤는 경로 구분자이거나 끝이어야 한다.
      // 이 검사가 없으면 /mojibake-old 같은 남의 경로까지 삼킨다.
      if (path !== prefix && !path.startsWith(prefix + '/')) continue;

      // 끝 슬래시가 없으면 붙여서 되돌린다.
      // /mojibake 상태에서는 HTML 의 상대 링크(content/about.html)가
      // 루트 기준으로 풀려 /content/about.html 이 되어 전부 깨진다.
      if (path === prefix) {
        url.pathname = prefix + '/';
        return Response.redirect(url.toString(), 301);
      }

      // Pages 프로젝트는 자기 루트에 배포돼 있다.
      // prelaps.com/mojibake/en/ -> prelaps-mojibake.pages.dev/en/
      // 접두사를 떼지 않으면 Pages 쪽에서 전부 404 가 난다.
      const target = new URL(url);
      target.hostname = host;
      target.pathname = path.slice(prefix.length);
      return fetch(new Request(target, request));
    }

    return serveHome(url, request);
  },
};

/**
 * 허브(prelaps-home)로 넘긴다.
 *
 * 허브의 주소는 끝 슬래시 없는 /ko, /ko/about 한 형태뿐이다.
 * canonical / hreflang / sitemap / 내부 링크가 전부 이 형태로 나간다.
 *
 * 문제는 Cloudflare Pages 가 확장자 없는 경로를 무조건 끝 슬래시로 308 시킨다는 것.
 * (/ko -> /ko/, /ko/about -> /ko/about/ — 실측. dist 를 파일 형식으로 뽑아
 *  ko.html 이 실제로 있어도 마찬가지다. Pages 자체 정규화라 빌드로는 못 막는다.)
 * 그대로 두면 우리가 색인시키려는 주소가 전부 리다이렉트되는 주소가 된다.
 *
 * 그래서 여기서 두 방향으로 정리한다.
 *  - 들어온 주소가 정식 형태가 아니면 정식 형태로 301.
 *  - 업스트림에는 .html 을 직접 집어서 요청한다. 확장자가 붙으면 Pages 가
 *    끝 슬래시를 붙이지 않으므로 308 없이 바로 200 이 온다.
 * 결과적으로 주소창은 /ko 인 채로 리다이렉트 0회.
 */
function serveHome(url, request) {
  const path = url.pathname;

  const canonical = canonicalPath(path);
  if (canonical !== path) {
    url.pathname = canonical;
    return Response.redirect(url.toString(), 301);
  }

  const target = new URL(url);
  target.hostname = HOME;

  // 확장자 없는 경로만 .html 로 바꿔 집는다.
  // /robots.txt, /sitemap-0.xml, /_astro/*.css 같은 실제 파일은 그대로 통과.
  // 루트(/)는 Pages 의 _redirects 가 301 로 /ko 에 넘겨준다.
  if (path !== '/' && !hasExtension(path)) {
    target.pathname = path + '.html';
  }

  return fetch(new Request(target, request));
}

/** 허브 경로의 정식 형태. 이미 정식이면 받은 값을 그대로 돌려준다. */
function canonicalPath(path) {
  if (path === '/') return path;

  // /ko.html, /ko/about.html 로 직접 들어온 경우. 확장자 없는 쪽이 정식이다.
  let p = path.endsWith('.html') ? path.slice(0, -'.html'.length) : path;

  // /index 는 홈이지 별도 주소가 아니다. (/index.html 도 여기로 모인다)
  if (p === '/index') return '/';

  // 끝 슬래시를 뗀다. //ko// 처럼 연속으로 붙어 온 경우까지 한 번에.
  p = p.replace(/\/+$/, '');

  return p === '' ? '/' : p;
}

/** 마지막 경로 조각에 점이 있으면 파일로 본다. */
function hasExtension(path) {
  return path.slice(path.lastIndexOf('/') + 1).includes('.');
}
```

`prelaps-router/wrangler.toml`

```toml
name = "prelaps-router"
main = "src/index.js"
compatibility_date = "2026-08-17"

# workers.dev 하위 주소로도 열리면 같은 콘텐츠가 두 곳에서 접근된다.
workers_dev = false

# prelaps.com 으로 들어오는 모든 요청을 이 Worker 가 받는다.
# 서브도메인(mojibake.prelaps.com)은 이 패턴에 걸리지 않는다 — 별개 호스트다.
# 구 서브도메인의 301 은 Cloudflare Rules > Redirect Rules 가 담당한다.
routes = [
  { pattern = "prelaps.com/*", zone_name = "prelaps.com" }
]
```

### Cloudflare Pages 의 끝 슬래시 정규화 (2026-08-18 실측)

Pages 는 **확장자 없는 경로를 무조건 끝 슬래시 쪽으로 308** 시킨다.

```
prelaps-home.pages.dev/ko            -> 308  Location: /ko/
prelaps-home.pages.dev/ko/about      -> 308  Location: /ko/about/
prelaps-home.pages.dev/ko.html       -> 200
prelaps-home.pages.dev/ko/about.html -> 200
```

`/ko/about` 은 옆에 `about/` 디렉터리가 아예 없는데도 308 이 난다. 즉
"폴더로 뽑아서 그렇다"가 아니라 Pages 자체의 정규화다. `build.format: 'file'` 로
`ko.html` 을 실제로 만들어 놔도 막히지 않는다.

그대로 두면 canonical / hreflang / sitemap / 내부 링크가 가리키는 주소 전부가
리다이렉트되는 주소가 된다. 그래서 Worker 의 `serveHome()` 이 정리한다.

- 들어온 주소가 정식 형태(`/ko`)가 아니면 → 301 로 정식 형태에 보낸다
- 업스트림에는 `.html` 을 붙여 요청한다 → 확장자가 있으면 308 이 안 붙어 바로 200

주소창은 `/ko` 인 채로 리다이렉트 0회가 된다.
`astro.config.mjs` 의 `trailingSlash: 'never'` / `build.format: 'file'` 은 이 구조의 전제이므로
둘 다 그대로 유지해야 한다.

### 404

Pages 는 `404.html` 이 있으면 그것을 status 404 로 돌려주고, **없으면 `index.html` 을
status 200 으로** 돌려준다(SPA 폴백). 허브에 404 페이지가 없던 동안 존재하지 않는 모든
주소가 soft 404 였다. `src/pages/404.astro` 가 그 구멍을 막는다 — 이 파일은 지우지 말 것.

---

## 4. 스택 결정: Astro

### 왜 Astro 인가

- **빌드 시점에 완성된 정적 HTML 생성** → 색인 확실. React CSR 은 빈 `<div id="root">` 만 배포되어 구글봇의 JS 렌더링 대기에 걸림.
- **언어별 `<title>` / `<meta description>` / `hreflang` 이 HTML 에 정적으로 박힘** → 다국어 SEO 에 필수.
- **다국어 파일 폭증 문제 해결** — 템플릿 1개 + 언어 JSON 으로 언어별 HTML 자동 생성. 헤더/푸터/애드센스 스크립트를 한 곳에서 관리.
- **Islands** — 인터랙션 필요한 부분만 `client:*` 지시어로 React 컴포넌트 사용. 나머지는 JS 0바이트.

### 적용 범위

| 프로젝트 | 스택 | 비고 |
|---|---|---|
| prelaps-home | Astro | 첫 Astro 프로젝트. 페이지 4~5개로 부담 적음 |
| prelaps-mojibake | 순수 HTML 유지 | 이미 동작 중. 나중에 여유 되면 이전 |
| 이후 도구 | Astro | |
| 게임 | Astro + React island | 캔버스/게임루프는 `client:load` 컴포넌트로. 소개 페이지는 정적 |

프로젝트가 독립적이라 스택 혼용에 문제 없음.

### Astro 초기 설정

```bash
npm create astro@latest prelaps-home
# 템플릿: Empty / TypeScript: No / 의존성 설치: Yes / git: Yes

cd prelaps-home
npx astro add react     # React island 쓸 경우
npm run dev             # localhost:4321
```

Cloudflare Pages 설정:
- 빌드 명령: `npm run build`
- 출력 디렉터리: `dist`

---

## 5. 다국어 구조

### URL 규칙: 도구 우선

```
prelaps.com/ko                  ← 허브
prelaps.com/mojibake/ko         ← 도구
prelaps.com/mojibake/ko/guide   ← 도구 하위 문서
```

언어 우선(`/ko/mojibake`)은 배포가 프로젝트별로 분리돼 있어 Worker 가 언어를 먼저 파싱해야 하므로 라우팅이 복잡해짐. 도구별 지원 언어가 달라질 때도 꼬임.

### Astro 디렉터리 구조 (허브 기준)

```
src/
├── layouts/Base.astro          ← 헤더/푸터/애드센스 스크립트/hreflang
├── components/                 ← 필요 시 .jsx (client:* 지시어 사용)
├── pages/
│   ├── index.astro             → / (언어 선택 or 기본 언어)
│   └── [lang]/
│       ├── index.astro         → /ko, /en, /ja
│       ├── privacy.astro       → /ko/privacy ...
│       ├── about.astro
│       └── contact.astro
└── locales/
    ├── ko.json
    ├── en.json
    └── ja.json
public/                         ← 정적 파일
```

`getStaticPaths()` 로 언어 목록 지정. 언어 추가 = JSON 파일 1개 + 목록에 한 줄.

### 언어 정책

- **초기 3~5개 언어만 제대로.** 텍스트 적은 도구 × 언어 20개 = 얇은 페이지 대량 생산 → 구글 스팸 정책 / 애드센스 "저가치 콘텐츠" 거절 사유.
- 각 언어 페이지에 UI 문자열만이 아니라 **설명 콘텐츠**를 포함할 것 (예: 왜 한글이 깨지는지, EUC-KR/UTF-8 차이, 사용 상황). 얇은 페이지가 아니라 검색 유입 문서가 되도록.
- 언어 확대는 애드센스 승인 이후.

### 필수 메타 태그

각 언어 페이지 `<head>`:

```html
<html lang="ko">
<link rel="canonical" href="https://prelaps.com/mojibake/ko">
<link rel="alternate" hreflang="ko" href="https://prelaps.com/mojibake/ko">
<link rel="alternate" hreflang="en" href="https://prelaps.com/mojibake/en">
<link rel="alternate" hreflang="ja" href="https://prelaps.com/mojibake/ja">
<link rel="alternate" hreflang="x-default" href="https://prelaps.com/mojibake/en">
```

- `alternate` 목록은 **모든 언어 페이지에 전체가 동일하게** 들어가야 함. 하나라도 빠지면 구글이 무시.
- `x-default` 필수.
- **canonical 은 각 언어가 자기 자신을 가리킬 것.** 다른 언어를 가리키면 해당 언어가 색인에서 사라짐.
- `<title>`, `<meta description>` 은 언어마다 반드시 다르게. 영어로 통일 시 중복 페이지 판정.

### 언어 없는 루트 경로

`/mojibake` 로 언어 없이 진입 시:
- 권장: 기본 언어 실물 페이지를 두고 canonical 은 자기 자신. 언어 선택 UI 제공.
- 비권장: `Accept-Language` 자동 리다이렉트 — 구글봇이 항상 같은 언어로만 접근해 다른 언어가 색인 안 되는 사고 빈발.

---

## 6. 초기 셋업 순서

1. **mojibake 경로 수정** — 파일 내 `href="/`, `src="/` 를 전부 `./` 로 변경 (절대 경로는 서브디렉터리 아래로 들어가면 깨짐)
2. **mojibake 메타 태그 보강** — canonical + hreflang 세트 추가
3. **`prelaps-home` 생성 (Astro)** — 허브 + privacy / about / contact, 다국어 라우팅
4. **`prelaps-home` Pages 배포** (커스텀 도메인 X)
5. **`prelaps-mojibake` Pages 배포** (커스텀 도메인 X)
6. **Worker 배포** — `npx wrangler deploy`
7. **동작 확인** — `prelaps.com`, `prelaps.com/mojibake/ko` 등 정상 렌더 + CSS/JS 로드
8. **기존 서브도메인 정리** — `mojibake.prelaps.com` → `prelaps.com/mojibake` 301 (Cloudflare Rules → Redirect Rules)
9. **Search Console** — `prelaps.com` 속성 추가, sitemap 제출

---

## 7. 도구 추가 체크리스트

```
□ Pages 프로젝트 생성 및 배포 (커스텀 도메인 X)
□ Worker ROUTES 에 한 줄 추가 → wrangler deploy
□ 허브 도구 목록에 항목 추가 (locales/*.json 에 설명 문구도)
□ privacy "3. 서비스별 안내" 에 블록 추가 (id 부여)
□ 도구 페이지 푸터에 /privacy#도구명 링크
□ 도구 페이지 <head> 에 canonical + hreflang + 애드센스 스크립트
□ sitemap.xml 에 URL 추가 (언어별 전부)
```

---

## 8. 정책 페이지 구조

`prelaps.com/{lang}/privacy` **한 파일**로 관리. 도구별 개별 정책 파일을 만들지 않음. (관리 지점 분산 방지 + 중복 콘텐츠 방지)

```
개인정보처리방침

1. 총칙

2. 공통 사항                    ← 도구 늘어도 변하지 않음
   - 광고: 애드센스, 쿠키, 제3자 광고사업자, 개인화 광고 거부 안내
   - 애널리틱스
   - 보안 / 이용자 권리 / 문의처

3. 서비스별 안내                ← 여기만 늘어남

   [mojibake]  id="mojibake"
   - 수집 항목: 없음
   - 수집 목적: -
   - 보관 기간: -
   - 제3자 제공: 없음
   - 비고: 입력 텍스트는 브라우저 내에서만 처리, 서버 전송 없음

   [webgame]   id="webgame"     ← 블록 복사해서 추가
   - 수집 항목:
   - 수집 목적:
   - 보관 기간:
   - 제3자 제공:

4. 최종 수정일
```

각 도구 블록은 **수집 항목 / 목적 / 보관 기간 / 제3자 제공** 4개만 채움. 없으면 "없음".
3번 섹션이 페이지 절반을 넘어가면 분리 검토.

각 도구 페이지 푸터에서 `/{lang}/privacy#도구명` 앵커로 링크.

---

## 9. 애드센스 요건

- **계정 1개 / 퍼블리셔 ID 1개** (`ca-pub-XXXXXXXX`) 로 전체 사이트 커버
- 광고를 띄울 **모든 페이지**의 `<head>` 에 동일 스크립트 (Astro 는 `Base.astro` 레이아웃에 한 번만 넣으면 전체 적용)
- `ads.txt` 는 루트에만: `prelaps.com/ads.txt`
- 필수 페이지: privacy / about / contact
- privacy 필수 포함: 애드센스 쿠키 사용 고지, 제3자 광고사업자 언급, 개인화 광고 거부 방법 안내

### 신청 타이밍

도구 1개로는 "저가치 콘텐츠" 거절 확률 높음.
**도구 2~3개 + 색인 확인 후** 신청. 거절 시 재신청 텀이 생기므로 서두르지 말 것.

허브는 링크 나열만으로는 부족. 사이트 소개 1~2문단 + 도구별 설명 2~3줄 필요.

### 게임 추가 시 주의

- 플레이 중 광고 노출 금지 (조작 방해 / 실수 클릭 유발로 정책 위반)
- 안전한 위치: 라운드 종료 후, 로딩 화면, 게임 시작 전
- 버튼 인접 배치, 게임 화면 위 오버레이 금지
- **도메인 단위 심사이므로 게임 하나의 위반이 사이트 전체에 영향**

---

## 10. 주의사항

- Pages 프로젝트에 커스텀 도메인 붙이지 말 것 (중복 콘텐츠)
- `.pages.dev` 색인 방지는 `_headers` 의 `X-Robots-Tag` 대신 **canonical 태그**로 처리
  (`_headers` 로 noindex 를 걸면 Worker 경유 응답에도 헤더가 따라붙어 실제 페이지까지 noindex 됨)
- 순수 HTML 프로젝트는 절대 경로(`/style.css`) 금지, 상대 경로(`./style.css`) 사용
- Vite/React 도구 추가 시 `base: '/도구명/'` 설정 필요 (Next.js 는 `basePath`)
- Astro 는 기본이 정적. 인터랙션 필요한 컴포넌트에만 `client:load` / `client:visible` 부여.
  각 island 는 상태를 공유하지 않으므로, 상태 공유가 필요하면 하나의 부모 컴포넌트로 묶어서 지시어를 부여할 것.
- 각 Pages 프로젝트에 `404.html` 이 반드시 있어야 한다. 없으면 `index.html` 이 200 으로 나가 soft 404 가 된다 (§3)
- 새 도구가 데이터를 수집하는데 privacy 업데이트를 누락하면 애드센스 정책 위반 → 체크리스트 준수

---

## 11. 미정

- 지원 언어 확정 (초기 3~5개)
- 블로그 플랫폼 (Astro Content Collections 유력)
- 애널리틱스 도구
- 애드센스 퍼블리셔 ID (신청 후 발급)
- Pages 프로젝트 실제 명명 규칙 (위 이름은 임시)
