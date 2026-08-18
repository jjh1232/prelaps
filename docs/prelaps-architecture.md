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
      return withPrefixedLocation(
        await fetch(new Request(target, request)),
        prefix,
        host,
      );
    }

    // ROUTES 에 안 걸리면 허브로. 경로를 손대지 않는다 —
    // Pages 가 /ko/ 와 /ko.html 을 알아서 /ko 로 308 해 준다.
    const target = new URL(url);
    target.hostname = HOME;
    return fetch(new Request(target, request));
  },
};

/**
 * 업스트림이 돌려준 리다이렉트의 Location 에 접두사를 다시 붙인다.
 *
 * Pages 는 Location 을 자기 루트 기준으로 쓴다. 그대로 흘려보내면
 * 접두사가 사라져 엉뚱한 곳으로 간다.
 *   /mojibake/index.html -> 업스트림 308 Location: /      -> 허브 홈으로 튕김
 *   /mojibake/en         -> 업스트림 308 Location: /en/   -> 허브의 영어 페이지로 튕김
 * 도구 안에서 홈 링크(href="index.html")를 누르면 사이트 밖으로 나가버린다.
 */
function withPrefixedLocation(response, prefix, host) {
  const location = response.headers.get('location');
  if (!location) return response;

  const to = new URL(location, `https://${host}/`);

  // 남의 도메인으로 내보내는 리다이렉트는 우리 경로가 아니다. 건드리지 않는다.
  if (to.hostname !== host) return response;

  const headers = new Headers(response.headers);
  headers.set('location', prefix + to.pathname + to.search + to.hash);

  // 리다이렉트 응답이라 body 는 비어 있다. 상태 코드는 업스트림 것을 그대로 쓴다.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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

### 배포는 수동이다 (중요)

**Pages 에 GitHub 연동은 걸려 있지만 push 로 빌드가 돌지 않는다.**
`3a5321c`, `44f97aa`, `3413060` 어느 것도 자동 빌드를 만들지 못했고, 프로덕션은
12시간 전 `0059ea6` 에 멈춰 있었다. 원인을 잡기 전까지는 아래를 직접 실행할 것.
(대시보드 Settings > Builds & deployments 에서 자동 배포 상태를 확인해야 한다.)

```bash
npm run build
npx wrangler pages deploy dist --project-name prelaps-home --branch main
```

배포된 커밋 확인:

```bash
npx wrangler pages deployment list --project-name prelaps-home
```

2026-08-18 의 "`/ko` 가 `/ko/` 로 튄다" 문제는 실은 이것이 원인이었다.
끝 슬래시를 고치는 커밋(`3a5321c`)이 push 만 되고 배포가 안 된 상태였는데,
`.pages.dev` 를 찔러 보면 **없는 파일도 200 을 돌려주기 때문에**(아래 404 항목)
`/ko.html` 이 200 인 것을 보고 "배포됐다"고 잘못 읽었다.
빌드 결과가 올라갔는지는 status code 가 아니라 `deployment list` 로 확인할 것.

### 끝 슬래시는 build.format 이 결정한다 (2026-08-18 실측)

| `build.format` | dist | `/ko` | `/ko/` | `/ko.html` |
|---|---|---|---|---|
| `'directory'` | `ko/index.html` | **308 → `/ko/`** | 200 | — |
| `'file'` | `ko.html` | **200** | 308 → `/ko` | 308 → `/ko` |

`'file'` 이면 Pages 가 알아서 끝 슬래시와 `.html` 을 떼는 쪽으로 정규화한다.
`astro.config.mjs` 의 `trailingSlash: 'never'` 와 방향이 맞으므로 **Worker 가 허브 경로를
건드릴 필요가 없다.** 허브 요청은 경로 그대로 프록시한다.

두 설정은 세트다. 한쪽만 바꾸면 canonical 이 가리키는 주소가 리다이렉트되는 주소가 된다.

### 프록시 응답의 Location 은 접두사를 잃는다

`/mojibake/*` 는 접두사를 떼고 넘기므로, 업스트림이 돌려준 리다이렉트의 Location 도
접두사가 빠진 채로 나온다. 그대로 흘리면 도구 밖으로 튕긴다.

```
/mojibake/index.html -> 업스트림 308 Location: /     -> 허브 홈으로 이탈
/mojibake/en         -> 업스트림 308 Location: /en/  -> 허브의 영어 페이지로 이탈
```

mojibake 의 내부 링크가 `href="index.html"` 이므로 홈 버튼 한 번에 바로 터진다.
`withPrefixedLocation()` 이 Location 에 접두사를 다시 붙여 막는다.

### mojibake 는 Pages 가 아니라 Worker 다 — ROUTES 의 프록시는 곧 죽는다

`ROUTES` 의 `'/mojibake': 'prelaps-mojibake.pages.dev'` 는 **틀린 전제였다.**
그런 Pages 프로젝트는 존재한 적이 없고(`/mojibake/*` 가 530 인 이유),
mojibake 는 별도 저장소(`breakkorean`, GitHub `jjh1232/mojam`)의
**Workers + Static Assets** 프로젝트로 `mojibake.prelaps.com` 에 붙어 있다.

옮기는 방식은 프록시가 아니라 **그 Worker 에 `prelaps.com/mojibake/*` 라우트를
직접 붙이는 것**이다. Cloudflare 가 더 구체적인 라우트를 먼저 쓰므로
`prelaps.com/*` 와 겹쳐도 mojibake 쪽이 이긴다. 요청이 한 번만 돌고,
`.pages.dev` 중복 노출도 Location 접두사 문제도 아예 생기지 않는다.

절차 전문은 `breakkorean/docs/배포.md` 에 있다.

그 배포가 끝나면 이 Worker 의 `ROUTES` 항목과 `withPrefixedLocation()` 은
호출되지 않는 죽은 코드가 된다. **다만 `/mojibake` (끝 슬래시 없음) → `/mojibake/`
301 은 남겨야 한다** — 그 경로는 `prelaps.com/mojibake/*` 패턴에 안 걸려서
계속 여기로 들어온다.

두 번째 도구부터 Pages 를 쓸지 Workers Assets 를 쓸지는 §11 미정으로 남긴다.
`html_handling` 과 `not_found_handling` 을 명시할 수 있는 쪽은 Workers Assets 뿐이다.

### 404

Pages 는 `404.html` 이 있으면 그것을 status 404 로 돌려주고, **없으면 `index.html` 을
status 200 으로** 돌려준다(SPA 폴백). 허브에 404 페이지가 없던 동안 존재하지 않는 모든
주소가 soft 404 였다. `src/pages/404.astro` 가 그 구멍을 막는다 — 이 파일은 지우지 말 것.
새로 붙이는 Pages 프로젝트도 전부 `404.html` 을 가져야 한다.

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

> 도메인 공통 규칙의 짧은 요약본이 `D:\SUBsite\CLAUDE.md` 에 있다.
> 세 저장소의 공통 상위 폴더라 어느 저장소에서 작업하든 Claude 가 자동으로 읽는다.
> **이 문서가 원본이고 그쪽은 요약이다.** 규칙을 바꾸면 여기를 먼저 고칠 것.


`prelaps.com/<도구>` 를 새로 붙일 때. mojibake 이전(2026-08-18)에서 얻은 것을 반영했다.
대부분 복사이고, 새로 판단할 일은 거의 없다.

### 새 저장소에서

```
□ 저장소 생성. 스택은 자유 — 도구마다 독립이다
□ wrangler.jsonc
    main    ./src/index.js
    routes  prelaps.com/<도구>/*   (zone_name: prelaps.com)
    assets  directory / binding ASSETS / run_worker_first: true
            html_handling / not_found_handling 을 명시할 것
□ src/index.js  — breakkorean 것을 복사해 PREFIX 만 교체
    · URL 의 /<도구> 접두사를 떼어 자산 루트에 맞춘다
    · 자산 층 리다이렉트의 Location 에 접두사를 다시 붙인다  ← 빠뜨리면 도구 밖으로 튕긴다
    · 접두사로 시작하지 않는 경로는 손대지 않는다            ← 가정이 깨지는 입구를 막는다
□ 404.html  — noindex, canonical 없음
□ canonical · hreflang · og:url · sitemap 을 https://prelaps.com/<도구>/... 절대 URL 로
□ x-default 는 영어  (도메인 공통 규칙. §5 참고)
□ 내부 링크는 전부 상대 경로. 절대 경로(/style.css)는 루트로 풀려 깨진다
□ 푸터에서 허브 정책으로 앵커 링크  →  /{lang}/privacy#<도구>
□ 링크·hreflang 전수 검사 스크립트  (breakkorean/test/links.js 참고)
□ CLAUDE.md + docs/배포.md
```

### 허브(prelaps-home)에서

```
□ public/robots.txt 에 한 줄       Sitemap: https://prelaps.com/<도구>/sitemap.xml
□ src/data/tools.ts 에 항목 하나 + locales/*.json 에 이름·설명 (3언어)
□ {lang}/privacy 의 "3. 서비스별 안내" 에 블록 추가 (id=<도구>)
    수집 항목 / 목적 / 보관 기간 / 제3자 제공 — 없으면 "없음"
□ 빌드 후 수동 배포        npx wrangler pages deploy dist --project-name prelaps-home
```

### 라우터(prelaps-router)에서

```
□ TOOLS 배열에 '/​<도구>' 한 줄  — 끝 슬래시 없는 진입을 /<도구>/ 로 301 한다
□ npx wrangler deploy
```

### 검색엔진

```
□ 아무것도 안 한다
```

하위 경로는 전부 같은 사이트라 재등록이 없다. 사이트맵만 허브 `robots.txt` 에 등록하면 된다.
**서브도메인이었으면 도구마다 소유확인부터 다시 해야 했다** — 하위 경로로 옮긴 이득이 여기서 나온다.

### 배포·검증

순서는 **받는 쪽 먼저**다. 도구를 배포해 `/<도구>/` 가 200 인 것을 확인한 뒤에
라우터와 허브를 올린다. 거꾸로 하면 그 사이 갈 곳 없는 주소가 생긴다.

검증은 도구 저장소의 `docs/배포.md` 표를 그대로 쓴다. **`/ko` 도 같이 찍을 것** —
라우트가 잘못 겹치면 허브가 먼저 죽는다.

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

### 러시아어 추가 검토 (2026-08-18 기록)

mojibake 의 벤치마크에서 **키릴 구간이 유독 강하다.** 표준 도구인 ftfy 와 비교하면:

| 깨짐 구간 | 건수 | ftfy 6.3.1 | mojibake |
|---|---|---|---|
| 키릴 인코딩으로 오독 | 39 | 15.4% | **97.4%** |
| CJK 인코딩으로 오독 | 20 | 0.0% | **100%** |
| UTF-8 → 서구권 오독 (ftfy 주력) | 31 | 96.8% | 100% |

**표준 도구가 거의 못 고치는 구간을 97% 로 잡는다.** 러시아어권에 이 문제를
제대로 푸는 도구가 없을 가능성이 크고, 그러면 경쟁이 비어 있는 시장이다.

다만 **순서를 지켜야 한다.** 검색엔진 등록이 노출을 만들지 않는다 — 그 언어로 된
페이지가 있어야 그 나라 사람이 검색해서 찾는다.

```
1. 러시아어 페이지 추가   mojibake: i18n.ru.js + 페이지 5장
                          허브:     locales/ru.json 1개
2. 그 다음에 얀덱스 등록
```

거꾸로 하면 아무 일도 일어나지 않는다.

중국어는 벤치마크가 좋아도(CJK 100%) **별개 문제다.** ICP 비안 없이는 본토에서
사이트가 제대로 열리지 않고, 바이두 웹마스터 계정 생성에 중국 휴대폰 번호가
필요한 경우가 많으며, Cloudflare 는 본토 성능이 나쁘다(China Network 는 유료
기업 플랜). 언어를 추가해도 실익이 잘 안 난다.

### 그 밖에

- 지원 언어 확정 (초기 3~5개)
- 블로그 플랫폼 (Astro Content Collections 유력)
- 애널리틱스 도구
- 애드센스 퍼블리셔 ID (신청 후 발급)
- Pages 프로젝트 실제 명명 규칙 (위 이름은 임시)
