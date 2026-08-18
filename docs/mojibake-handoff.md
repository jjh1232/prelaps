# prelaps-mojibake 배포 요청서

> 받는 곳: `prelaps-mojibake` 레포 (순수 HTML, 빌드 없음)
> 보내는 곳: prelaps-home / prelaps-router
> 기준일: 2026-08-18. 아래 응답 코드는 전부 그날 실측값이다.

---

## 0. 지금 상태 — /mojibake 는 죽어 있다

```
prelaps.com/mojibake       301 -> prelaps.com/mojibake/     (Worker)
prelaps.com/mojibake/      530  Origin DNS error            <- 여기서 끊김
mojibake.prelaps.com/      200  (구 서브도메인. 아직 살아 있음)
```

`prelaps-router` Worker 는 이미 `/mojibake/*` 를 `prelaps-mojibake.pages.dev` 로
보내고 있는데, **그 Pages 프로젝트가 아직 없다.** 현재 Cloudflare 계정의 Pages
프로젝트는 `prelaps-home` 하나뿐이다.

즉 이 문서의 작업은 "옮기기"가 아니라 "없는 것을 만들기"다.

---

## 1. 반드시 지켜야 할 것

### 1-1. 프로젝트 이름은 정확히 `prelaps-mojibake`

Worker 의 `ROUTES` 에 문자열로 박혀 있다. 다른 이름으로 만들면 계속 530 이다.

```js
const ROUTES = {
  '/mojibake': 'prelaps-mojibake.pages.dev',
};
```

이름을 바꿔야 한다면 `prelaps-router/src/index.js` 를 같이 고치고 Worker 를
재배포해야 한다.

### 1-2. 커스텀 도메인을 붙이지 말 것

`.pages.dev` 만 두고 Worker 를 통해서만 노출한다. 커스텀 도메인을 붙이면 같은
콘텐츠가 두 주소로 열려 중복 콘텐츠가 된다. (아키텍처 §2)

### 1-3. `404.html` 을 반드시 넣을 것 — 현재 없다

Cloudflare Pages 는 `404.html` 이 있으면 그것을 **status 404** 로 돌려주고,
**없으면 `index.html` 을 status 200 으로** 돌려준다. 없으면 존재하지 않는 모든
주소가 soft 404 가 되어 색인이 오염된다.

허브에서 실제로 이 문제를 겪었다. 게다가 진단까지 방해한다 — 없는 파일이 200 을
돌려주니 "배포가 됐다"고 잘못 읽게 된다.

```
(404.html 없을 때)  prelaps-home.pages.dev/아무거나  -> 200 + index.html
(404.html 넣은 뒤)  prelaps-home.pages.dev/아무거나  -> 404 + 404.html
```

기존 페이지와 같은 헤더/푸터/스타일을 쓰되, `<meta name="robots" content="noindex, follow">`
를 넣고 canonical 은 **넣지 않는다**. 실재하지 않는 주소를 자기 자신이라고 선언하면
잘못된 신호가 된다.

### 1-4. 내부 링크는 전부 상대 경로 유지 — 지금 잘 되어 있다

```html
href="index.html"           href="content/about.html"
href="../styles.css"        href="en/index.html"
```

절대 경로(`/styles.css`)를 쓰면 `prelaps.com` 루트 기준으로 풀려서 전부 깨진다.
도구는 `/mojibake/` 아래에 있지 루트에 있지 않다. **새 파일을 추가할 때도 절대
경로를 쓰지 말 것.**

### 1-5. canonical / hreflang 은 `https://prelaps.com/mojibake/...` 절대 URL — 지금 잘 되어 있다

```html
<link rel="canonical" href="https://prelaps.com/mojibake/">
<link rel="alternate" hreflang="ko" href="https://prelaps.com/mojibake/">
<link rel="alternate" hreflang="en" href="https://prelaps.com/mojibake/en/">
<link rel="alternate" hreflang="ja" href="https://prelaps.com/mojibake/ja/">
<link rel="alternate" hreflang="x-default" href="https://prelaps.com/mojibake/en/">
```

`.pages.dev` 를 가리키면 안 된다. 이 절대 URL 이 `.pages.dev` 중복 노출을 막는
유일한 장치다.

---

## 2. URL 형태 — 확장자 없는 쪽이 정식이다

Pages 는 평평한 `.html` 파일에 대해 확장자를 떼는 쪽으로 정규화한다.
허브(`prelaps-home`, 같은 구조)에서 실측한 값:

```
/ko.html        308 -> /ko          .html 은 정식 주소가 아니다
/ko             200                 이쪽이 정식
/ko/            308 -> /ko          끝 슬래시도 떼어낸다
```

mojibake 에 대입하면:

| 파일 | 정식 URL | 비고 |
|---|---|---|
| `index.html` | `/mojibake/` | 디렉터리 루트라 끝 슬래시가 붙는다 |
| `encoding-basics.html` | `/mojibake/encoding-basics` | |
| `content/about.html` | `/mojibake/content/about` | |
| `en/index.html` | `/mojibake/en/` | |

**현재 `sitemap.xml` 과 canonical 이 이미 이 형태다. 그대로 두면 된다.**
sitemap 주석의 "`.html` 을 떼고 301 한다"는 설명도 방향이 맞다 (301 이 아니라
308 이라는 것만 다르다).

내부 링크가 `.html` 을 유지하는 것도 그대로 둔다 — 로컬에서 `file://` 로 더블클릭해
열어야 하기 때문이고, 배포 후에는 Pages 가 308 로 정식 주소에 보내준다.
링크 한 번에 리다이렉트 한 번이 붙지만, 색인 대상인 canonical/sitemap 쪽이
정식 주소이므로 SEO 문제는 없다.

---

## 3. 이미 Worker 쪽에서 막아둔 것 (알고만 있으면 됨)

`/mojibake/*` 는 접두사를 떼고 업스트림에 넘긴다. 그래서 업스트림이 돌려주는
리다이렉트의 Location 에는 접두사가 빠져 있다.

```
/mojibake/index.html -> 업스트림 308 Location: /      -> 그대로 흘리면 허브 홈으로 이탈
/mojibake/en         -> 업스트림 308 Location: /en/   -> 허브의 영어 페이지로 이탈
```

내부 링크가 `href="index.html"` 이므로 **홈 버튼 한 번에 사이트 밖으로 튕겨나간다.**
Worker 의 `withPrefixedLocation()` 이 Location 에 `/mojibake` 를 다시 붙여 막아뒀다.
배포 후 §5 체크리스트에서 이게 실제로 도는지 확인해야 한다.

---

## 4. 배포

```bash
npx wrangler pages project create prelaps-mojibake --production-branch main
npx wrangler pages deploy . --project-name prelaps-mojibake --branch main
```

빌드가 없으므로 배포 디렉터리는 레포 루트다. `.git` 등 불필요한 파일이 함께
올라가지 않도록 확인할 것.

**GitHub 연동을 걸더라도 push 만으로 배포됐다고 믿지 말 것.** `prelaps-home` 은
연동이 걸려 있는데도 최근 세 커밋이 자동 빌드를 만들지 못했고, 프로덕션이 12시간
전 커밋에 멈춰 있었다. 이번 `/ko` 문제의 진짜 원인이 그것이었다.

배포된 커밋은 status code 가 아니라 이걸로 확인한다:

```bash
npx wrangler pages deployment list --project-name prelaps-mojibake
```

---

## 5. 배포 후 검증 체크리스트

```bash
for u in /mojibake /mojibake/ /mojibake/index.html /mojibake/en/ /mojibake/en \
         /mojibake/encoding-basics /mojibake/encoding-basics.html \
         /mojibake/content/about /mojibake/styles.css /mojibake/sitemap.xml \
         /mojibake/없는주소; do
  printf '%-38s ' "$u"
  curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://prelaps.com$u"
done
```

기대값:

| 요청 | 기대 | 틀리면 |
|---|---|---|
| `/mojibake` | 301 → `/mojibake/` | Worker 문제 |
| `/mojibake/` | 200 | 프로젝트 이름 확인 (530 이면 없는 것) |
| `/mojibake/index.html` | 308 → **`/mojibake/`** | `/` 로 가면 `withPrefixedLocation` 미적용 |
| `/mojibake/en` | 308 → **`/mojibake/en/`** | `/en/` 로 가면 같은 문제 |
| `/mojibake/en/` | 200 | |
| `/mojibake/encoding-basics` | 200 | |
| `/mojibake/encoding-basics.html` | 308 → `/mojibake/encoding-basics` | |
| `/mojibake/content/about` | 200 | |
| `/mojibake/styles.css` | 200 | 404 면 절대 경로가 섞여 있는 것 |
| `/mojibake/sitemap.xml` | 200 | 허브 robots.txt 가 이 주소를 적어둠 |
| `/mojibake/없는주소` | **404** | 200 이면 `404.html` 이 없는 것 |

CSS / JS 가 실제로 붙는지는 브라우저에서 `/mojibake/`, `/mojibake/en/`,
`/mojibake/content/about` 세 곳을 열어 콘솔에 404 가 없는지 눈으로 볼 것.
상대 경로는 깊이마다 다르게 풀리므로 세 깊이를 다 봐야 한다.

---

## 6. 같이 처리해야 할 두 가지

### 6-1. 구 서브도메인 301 — 아직 안 걸려 있다

```
mojibake.prelaps.com/   200   <- 지금 살아 있다
```

`/mojibake/` 가 뜨는 순간 같은 콘텐츠가 두 주소로 열린다. Cloudflare
Rules > Redirect Rules 에 걸 것.

```
When:  hostname equals mojibake.prelaps.com
Then:  301 -> https://prelaps.com/mojibake/${http.request.uri.path}
```

`/mojibake/` 가 200 을 돌려주는 것을 확인한 **뒤에** 건다. 순서가 바뀌면 구
주소까지 같이 죽는다.

### 6-2. `robots.txt` 는 지워도 된다

`robots.txt` 는 도메인 루트에서만 읽힌다. `/mojibake/robots.txt` 는 아무도 안 본다.
실제로 적용되는 것은 허브의 `public/robots.txt` 이고, 거기에 mojibake sitemap 이
이미 들어가 있다.

```
Sitemap: https://prelaps.com/sitemap-index.xml
Sitemap: https://prelaps.com/mojibake/sitemap.xml
```

남겨둬도 무해하지만, 두 개가 따로 노는 것으로 오해할 여지가 있으니 지우는 쪽을
권한다. **`sitemap.xml` 은 반드시 남겨야 한다** — 위 robots.txt 가 그 주소를 가리킨다.

---

## 7. 요약 — 하나씩 지워가며 확인

- [ ] Pages 프로젝트 `prelaps-mojibake` 생성 (이름 정확히)
- [ ] 커스텀 도메인 붙이지 않음
- [ ] `404.html` 추가 (noindex, canonical 없음)
- [ ] 배포 후 `deployment list` 로 올라간 커밋 확인
- [ ] §5 체크리스트 11개 항목 통과
- [ ] 브라우저에서 3개 깊이 콘솔 404 없음
- [ ] `mojibake.prelaps.com` → `prelaps.com/mojibake/` 301 Redirect Rule
- [ ] `/mojibake/robots.txt` 삭제 (`sitemap.xml` 은 유지)
