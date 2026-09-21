/**
 * IndexNow — 바뀐 주소를 네이버·Bing 에 즉시 알린다.
 *
 * 왜 필요한가 — 구글은 2026-08-25 이후로 이 도메인의 페이지를 새로 긁지 않았다.
 * 색인 생성 요청을 넣어도 크롤 예산이 바닥이면 큐에서 기다릴 뿐이고, 구글은
 * 같은 URL 을 반복 요청해도 우선순위를 올리지 않는다고 명시한다.
 *
 * 네이버는 다르다. 2023-07 부터 IndexNow 를 지원하고, 웹마스터도구의
 * 「웹 페이지 수집」을 하나씩 손으로 넣는 대신 여기서 전부 밀어 넣을 수 있다.
 * 실제 유입이 네이버에서 나오고 있으므로(2026-09 기준 노출 1.2천 / 클릭 30)
 * 여기가 값이 나오는 쪽이다.
 *
 * ⚠ 구글은 IndexNow 를 받지 않는다. 2021 년부터 테스트만 하고 있다.
 *   구글 쪽은 이 스크립트로 어떻게 할 수 없고 기다리는 수밖에 없다.
 *
 * 주소 목록은 **라이브 사이트맵에서 읽는다.** 로컬 dist 를 읽으면 아직 배포되지
 * 않은 주소를 알리게 되고, 받는 쪽이 404 를 보면 신뢰를 잃는다.
 * 그래서 배포가 끝난 뒤에 돌리는 것이 맞다.
 *
 *   node scripts/indexnow.mjs            실제 제출
 *   node scripts/indexnow.mjs --dry-run  목록만 확인
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HOST = 'prelaps.com';
const ORIGIN = `https://${HOST}`;
const INDEX = `${ORIGIN}/sitemap-index.xml`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const DRY = process.argv.includes('--dry-run');

/** public/ 에 놓아둔 <키>.txt 에서 키를 읽는다. 키를 코드에 박지 않는 이유는 그 파일이 곧 소유 증명이라서다 — 둘이 어긋나면 받는 쪽이 거부한다. */
async function readKey() {
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
  const hit = (await readdir(publicDir)).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
  if (!hit) throw new Error('public/ 에 <키>.txt 가 없다. IndexNow 키 파일을 먼저 만들 것.');

  const key = hit.replace(/\.txt$/, '');
  const body = (await readFile(join(publicDir, hit), 'utf8')).trim();
  if (body !== key) throw new Error(`키 파일 내용이 파일 이름과 다르다 — 파일 ${key}, 내용 ${body}`);
  return key;
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

/** 사이트맵 인덱스 → 각 사이트맵 → URL. 도구 사이트맵이 인덱스에 물려 있어 한 곳에서 전부 모인다. */
async function collectUrls() {
  const index = await fetchText(INDEX);
  const sitemaps = locs(index);
  if (!sitemaps.length) throw new Error('사이트맵 인덱스가 비어 있다');

  const urls = new Set();
  for (const sm of sitemaps) {
    const found = locs(await fetchText(sm));
    console.log(`  ${sm.replace(ORIGIN + '/', '')} — ${found.length}개`);
    found.forEach((u) => urls.add(u));
  }
  return [...urls].sort();
}

const key = await readKey();
console.log(`키 ${key}\n사이트맵에서 주소를 모은다:`);

const urlList = await collectUrls();

// 다른 호스트가 섞이면 제출 전체가 거부된다. 섞일 일이 없는 구조지만 한 번 거른다.
const foreign = urlList.filter((u) => !u.startsWith(ORIGIN + '/'));
if (foreign.length) throw new Error(`다른 호스트가 섞였다: ${foreign.slice(0, 3).join(', ')}`);

console.log(`\n합계 ${urlList.length}개`);

if (DRY) {
  urlList.forEach((u) => console.log('  ' + u));
  console.log('\n--dry-run 이라 제출하지 않았다.');
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `${ORIGIN}/${key}.txt`, urlList }),
});

// 200 과 202 가 정상이다. 202 는 "받았고 키는 나중에 확인한다" 는 뜻.
console.log(`\n${ENDPOINT} → ${res.status} ${res.statusText}`);
const text = (await res.text()).trim();
if (text) console.log(text);

if (!res.ok) {
  console.error('\n제출 실패. 422 면 키 파일이 안 열리는 것이고, 403 이면 키가 안 맞는 것이다.');
  process.exit(1);
}
console.log(`\n${urlList.length}개를 네이버·Bing·Yandex 에 알렸다. 구글은 IndexNow 를 받지 않는다 — 그쪽은 별개다.`);
