# prelaps-home

`prelaps.com` 의 허브 사이트. Astro 기반 정적 사이트.

전체 설계는 **`docs/ARCHITECTURE.md`** 에 있음. 구조/라우팅/SEO 관련 작업 전에 반드시 읽을 것.

---

## 이 프로젝트가 하는 일

- `prelaps.com` 루트에 서빙되는 허브 페이지 (도구 목록 + 사이트 소개)
- 정책 페이지 (privacy / about / contact) — 애드센스 심사 필수 요건
- 개별 도구(`/mojibake` 등)는 **별도 Pages 프로젝트**이며 Cloudflare Worker 가 경로별로 프록시함. 이 레포에 도구 코드를 넣지 말 것.

---

## 스택

- Astro (정적 생성)
- React 는 인터랙션이 필요한 컴포넌트에만 island 로 사용
- Node 24 LTS (`.nvmrc` 참조)
- 배포: Cloudflare Pages — 빌드 `npm run build`, 출력 `dist`

---

## 절대 규칙

### 1. 정적 생성이 목적

- 이 사이트의 존재 이유는 검색 유입과 애드센스 승인. **빌드 결과 HTML 에 콘텐츠가 실제로 들어있어야 함.**
- `client:*` 지시어는 꼭 필요한 곳에만. 표시 전용 컴포넌트에는 붙이지 말 것.
- 링크 이동은 `<a href>` 로. JS 라우팅 쓰지 말 것.
- 작업 후 `npm run build` → `dist/**/*.html` 을 열어 콘텐츠가 정적으로 들어갔는지 확인할 것.

### 2. 다국어 메타 태그

모든 언어 페이지 `<head>` 에 아래가 전부 들어가야 함:

- `<html lang="{lang}">`
- `canonical` — **자기 자신을 가리킬 것.** 다른 언어를 가리키면 색인에서 사라짐
- `hreflang` — 지원 언어 **전체 목록**을 모든 페이지에 동일하게. 하나라도 빠지면 구글이 무시
- `hreflang="x-default"` 필수
- `<title>`, `<meta description>` 은 언어마다 반드시 다르게

### 3. 애드센스

- 스크립트는 `Base.astro` 레이아웃에 **한 번만**. 개별 페이지에 중복 삽입 금지
- 퍼블리셔 ID 는 아직 미발급 → `ca-pub-XXXXXXXX` 플레이스홀더 유지
- privacy 페이지에 반드시 포함: 애드센스 쿠키 사용 고지 / 제3자 광고사업자 언급 / 개인화 광고 거부 방법 안내

### 4. 커스텀 도메인

- 이 Pages 프로젝트에 커스텀 도메인을 붙이지 않음. `.pages.dev` 만 두고 Worker 경유로만 노출 (중복 콘텐츠 방지)
- `.pages.dev` 색인 방지는 `_headers` 의 `X-Robots-Tag` 가 아니라 **canonical 태그**로 처리할 것. `_headers` 로 noindex 를 걸면 Worker 를 통과한 실제 페이지까지 noindex 됨

---

## 디렉터리 구조

```
src/
├── layouts/Base.astro      헤더/푸터/애드센스/hreflang
├── components/             필요 시 .jsx (island)
├── pages/
│   ├── index.astro         → /
│   └── [lang]/
│       ├── index.astro     → /ko, /en, /ja
│       ├── privacy.astro
│       ├── about.astro
│       └── contact.astro
└── locales/
    ├── ko.json
    ├── en.json
    └── ja.json
public/
docs/ARCHITECTURE.md
```

- 지원 언어는 `getStaticPaths()` 와 `locales/` 로 관리. 언어 추가 = JSON 1개 + 목록 한 줄
- 텍스트는 전부 `locales/*.json` 으로. `.astro` 파일에 문자열 하드코딩 금지

---

## 콘텐츠 작성 시 주의

- **허브에 링크만 나열하지 말 것.** 애드센스 심사에서 "저가치 콘텐츠" 로 거절되는 주된 원인.
  - 사이트 소개 1~2문단
  - 도구마다 설명 2~3줄 (이름만이 아니라 무엇을 해결하는지)
- 언어별 페이지가 기계번역 수준의 얇은 페이지가 되지 않도록 할 것. 각 언어에 실제 설명 콘텐츠 포함.

---

## 도구 추가 시 (이 레포에서 할 일)

도구 자체는 별도 레포/프로젝트지만, 추가될 때 이 레포에서 아래를 갱신해야 함:

```
□ locales/*.json 에 도구 이름 + 설명 추가 (전 언어)
□ 허브 도구 목록에 항목 추가
□ privacy "서비스별 안내" 에 블록 추가 (id 부여, 앵커 링크용)
□ sitemap 에 해당 도구 URL 추가 (언어별 전부)
```

---

## 현재 상태 / 미정

- 지원 언어 최종 미확정 (초안: ko / en / ja)
- 애드센스 퍼블리셔 ID 미발급
- 애널리틱스 도구 미선정
- 도구는 현재 mojibake 1개 (순수 HTML, 별도 프로젝트, 현행 유지)


## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
