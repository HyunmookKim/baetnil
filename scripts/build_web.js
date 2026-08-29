// 뱃일 — 공개 기록을 웹 페이지로 굽는다 (STEP 7)
//
// ★ 왜 필요한가
//   지금 정비수첩·항해일지·제품 리뷰는 앱 안에만 있다. 구글은 앱 안을 못 본다.
//   일본어판 앱을 아무리 잘 만들어도 일본 사람이 그것을 알 방법이 없다 —
//   「ヤンマー 4JH 海水ポンプ 交換」 으로 우리 페이지가 뜨는 것이 유일한 입구다.
//   ★ 이것이 없으면 다국어도 일본 진출도 뜻이 없다. 그래서 여기가 먼저다.
//
// ★ 새는 길이 안 생긴다 — 구조로 막혀 있다
//   이 스크립트는 boatPublic 만 읽는다. 그것은 앱이 buildPublic() 으로
//   이미 걸러 놓은 「공개본」 이다. 배 안의 물품 자리·좌표·회비·메모는 애초에 거기 없다.
//   그러니 여기서 새로 뚫릴 구멍이 없다. 새 자료를 읽지 않는 것이 이 파일의 규칙이다.
//
// ★ 열쇠가 필요 없다
//   boatPublic 은 규칙이 `allow read: if true` 다 (누구나 본다).
//   그래서 웹 apiKey 하나로 읽는다 — 깃허브 비밀값을 안 만든다.
//   비밀값은 하나 늘 때마다 샐 자리가 하나 는다.

const fs = require('fs');
const path = require('path');

const PROJECT = 'baetnil';
const API_KEY = process.env.FB_API_KEY || 'AIzaSyAH1iM-ljsnTmzWmExfSqrMbILhVaJaITA';
const SITE    = (process.env.SITE_URL || 'https://baetnil.com').replace(/\/+$/, '');
const APP     = SITE + '/app/';
const OUT     = process.env.OUT_DIR || '.';

// ── Firestore REST — 담긴 모양(typed value)을 그냥 값으로 푼다
function unwrap(v){
  if(v == null) return null;
  if('stringValue'  in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue'  in v) return Number(v.doubleValue);
  if('booleanValue' in v) return v.booleanValue;
  if('nullValue'    in v) return null;
  if('timestampValue' in v) return v.timestampValue;
  if('arrayValue'   in v) return (v.arrayValue.values || []).map(unwrap);
  if('mapValue'     in v){
    const o = {}; const f = v.mapValue.fields || {};
    for(const k in f) o[k] = unwrap(f[k]);
    return o;
  }
  return null;
}
async function readAll(){
  const rows = [];
  let token = '';
  for(let guard = 0; guard < 100; guard++){
    const u = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/boatPublic`
            + `?pageSize=200&key=${API_KEY}` + (token ? `&pageToken=${encodeURIComponent(token)}` : '');
    const r = await fetch(u);
    if(!r.ok) throw new Error('firestore ' + r.status + ' ' + (await r.text()).slice(0, 300));
    const j = await r.json();
    (j.documents || []).forEach(d => {
      const o = {}; const f = d.fields || {};
      for(const k in f) o[k] = unwrap(f[k]);
      if(!o.id) o.id = d.name.split('/').pop();
      rows.push(o);
    });
    token = j.nextPageToken || '';
    if(!token) break;
  }
  return rows;
}

// ── 글자 다루기
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const trim = (s, n) => { const v = String(s == null ? '' : s).replace(/\s+/g,' ').trim();
  return v.length > n ? v.slice(0, n - 1) + '…' : v; };
// ★ 사진 — data: 로 들어온 것은 페이지에 안 싣는다.
//   한 장에 수백 KB 라 페이지가 통째로 무거워지고, 구글이 그런 페이지를 싫어한다.
//   창고에 올라간 것(https)만 싣는다.
const pic = u => (typeof u === 'string' && /^https:\/\//.test(u)) ? u : '';

const CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0a1628;color:#e8eef5;font-family:'Pretendard','Apple SD Gothic Neo',
  'Noto Sans KR','Segoe UI',system-ui,sans-serif;line-height:1.65;letter-spacing:-.012em}
a{color:#9CC6E8}
.wrap{max-width:720px;margin:0 auto;padding:22px 18px 60px}
header.top{border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:22px;padding-bottom:14px;
  display:flex;align-items:center;gap:10px;flex-wrap:wrap}
header.top a.brand{color:#c8dff0;font-weight:800;text-decoration:none;font-size:15px}
header.top .sp{flex:1}
.btn{display:inline-block;background:rgba(156,198,232,.16);color:#9CC6E8;border-radius:999px;
  padding:8px 15px;font-size:13px;font-weight:600;text-decoration:none}
h1{font-size:23px;line-height:1.35;margin:0 0 8px;font-weight:800;color:#f0f5fa}
.meta{color:#8398AC;font-size:13px;margin-bottom:4px}
.chip{display:inline-block;background:rgba(255,255,255,.075);border-radius:999px;
  padding:3px 10px;font-size:12px;color:#c9d6e2;margin:0 5px 5px 0}
.step{display:flex;gap:12px;padding:14px 0;border-top:1px solid rgba(255,255,255,.07)}
.num{flex:0 0 26px;height:26px;border-radius:999px;background:rgba(255,255,255,.08);
  color:#c8dff0;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center}
.step img{width:100%;height:auto;border-radius:10px;display:block;margin-bottom:8px;background:#0b1420}
.body{flex:1;min-width:0}
.row{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:14px}
.row b{flex:0 0 88px;color:#8398AC;font-weight:600}
ul.list{list-style:none;padding:0;margin:0}
ul.list li{padding:13px 0;border-bottom:1px solid rgba(255,255,255,.07)}
ul.list a{text-decoration:none;color:#e8eef5;font-weight:600;font-size:15.5px}
ul.list .sub{color:#8398AC;font-size:13px;margin-top:3px}
footer{margin-top:34px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);
  color:#7b8794;font-size:12.5px}
.cta{margin:26px 0 0;padding:16px;border-radius:14px;background:rgba(156,198,232,.10)}
.cta b{display:block;color:#f0f5fa;margin-bottom:6px}
`;

function page({ title, desc, url, body, jsonld, noindex }){
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="뱃일">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body><div class="wrap">
<header class="top"><a class="brand" href="${SITE}/">뱃일 — 배 타는 사람들</a><span class="sp"></span>
<a class="btn" href="${APP}">앱에서 보기</a></header>
${body}
<div class="cta"><b>이 기록은 「뱃일」 앱에서 배 주인이 직접 남긴 것입니다.</b>
내 배의 정비수첩·항해일지도 같은 방법으로 남길 수 있습니다.
<a href="${APP}">앱 열기 →</a></div>
<footer>뱃일 · <a href="${SITE}/terms.html">이용약관</a> ·
<a href="${SITE}/privacy.html">개인정보</a> · <a href="mailto:help@baetnil.com">help@baetnil.com</a></footer>
</div></body></html>`;
}

function write(rel, html){
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
}

// ── 한 배가 내놓은 것에서 페이지를 만든다
const HARD = n => '★★★★★'.slice(0, Math.max(0, Math.min(5, Number(n)||0)))
                + '☆☆☆☆☆'.slice(0, 5 - Math.max(0, Math.min(5, Number(n)||0)));
const durText = h => { const n = Number(h); if(!isFinite(n) || n <= 0) return '';
  const m = Math.round(n * 60); return m >= 60 ? `${Math.floor(m/60)}시간 ${m%60 ? (m%60)+'분' : ''}`.trim() : m + '분'; };

function byLine(b){
  return `<div class="meta">${esc([b.name, b.port, b.typeName].filter(Boolean).join(' · '))}</div>`;
}

function mlogPage(b, m){
  const prod = [m.maker, m.model].filter(Boolean).join(' ');
  const title = `${m.title || '정비 기록'}${prod ? ' — ' + prod : ''} | 뱃일 정비수첩`;
  const desc = trim(`${prod ? prod + ' ' : ''}${m.title || ''} 정비 절차 ${(m.how||[]).length}단계.`
    + ((m.how||[])[0] ? ' ' + (m.how[0].v || '') : ''), 155);
  const url = `${SITE}/m/${b.id}/${m.id}/`;
  // ★ 장비 이름을 안 적으면 종류가 이름 자리에 선다 — 그러면 두 줄이 같은 말이 된다.
  const gname = m.gear || prod;
  const rows = [
    ['장비',      gname],
    ['부품 종류', (m.kind && m.kind !== gname) ? m.kind : ''],
    ['계통',      m.sys],
    ['한 날',     m.date],
    ['난이도',    m.hard ? HARD(m.hard) : ''],
    ['걸린 시간', durText(m.work)],
    ['쓴 부품',   m.used]
  ].filter(r => r[1]);
  const body = `<h1>${esc(m.title || '정비 기록')}</h1>
${byLine(b)}
${prod ? `<div>${esc(prod)}${m.kind ? ` <span class="chip">${esc(m.kind)}</span>` : ''}</div>` : ''}
<div style="margin:14px 0 4px">${rows.map(r =>
  `<div class="row"><b>${esc(r[0])}</b><span>${esc(r[1])}</span></div>`).join('')}</div>
${(m.how||[]).map((s, i) => `<div class="step"><div class="num">${i+1}</div><div class="body">${
  pic(s.p) ? `<img src="${esc(pic(s.p))}" alt="${esc(trim(s.v, 60))}" loading="lazy">` : ''}${
  s.v ? `<div>${esc(s.v)}</div>` : ''}</div></div>`).join('')}`;
  const jsonld = { '@context':'https://schema.org', '@type':'HowTo',
    name: m.title || '정비 기록', description: desc, url,
    step: (m.how||[]).map((s,i)=>({ '@type':'HowToStep', position:i+1, text:String(s.v||'') })) };
  return { rel:`m/${b.id}/${m.id}/index.html`, url, title, desc,
           html: page({ title, desc, url, body, jsonld, noindex: !!b.adminHidden }) };
}

function voyPage(b, v){
  const nm = v.title || [v.from, v.to].filter(Boolean).join(' → ') || v.date;
  const title = `${nm} | 뱃일 항해일지`;
  const desc = trim(`${b.name || ''} ${v.date || ''} ${[v.from, v.to].filter(Boolean).join(' → ')}`
    + (v.nm ? ` ${v.nm}NM` : '') + (v.note ? ' · ' + v.note : ''), 155);
  const url = `${SITE}/v/${b.id}/${v.id}/`;
  const rows = [
    ['날짜', v.date], ['출발', [v.from, v.timeOut].filter(Boolean).join(' · ')],
    ['도착', [v.to, v.timeIn].filter(Boolean).join(' · ')],
    ['거리', v.nm ? v.nm + ' NM' : ''], ['항해 시간', durText(v.hours)],
    ['갈래', v.kind], ['날씨', [v.wxOut, v.wxIn].filter(Boolean).join(' → ')]
  ].filter(r => r[1]);
  const pics = (v.photos||[]).map(pic).filter(Boolean).slice(0, 12);
  const body = `<h1>${esc(nm)}</h1>${byLine(b)}
<div style="margin:14px 0 4px">${rows.map(r =>
  `<div class="row"><b>${esc(r[0])}</b><span>${esc(r[1])}</span></div>`).join('')}</div>
${v.note ? `<p>${esc(v.note)}</p>` : ''}
${(v.logs||[]).length ? `<h2 style="font-size:16px;margin:22px 0 4px">중간 기록</h2>` +
  (v.logs||[]).map(g => `<div class="row"><b>${esc(g.time||'')}</b><span>${
    esc([g.kind, g.text].filter(Boolean).join(' · '))}</span></div>`).join('') : ''}
${pics.map(u => `<img src="${esc(u)}" style="width:100%;border-radius:12px;margin:10px 0" loading="lazy" alt="">`).join('')}`;
  return { rel:`v/${b.id}/${v.id}/index.html`, url, title, desc,
           html: page({ title, desc, url, body, noindex: !!b.adminHidden }) };
}

function rvPage(b, r){
  const nm = r.title || [r.maker, r.model].filter(Boolean).join(' ') || r.kind || '리뷰';
  const isBoat = r.typ === 'boat';
  const title = `${nm} 후기 | 뱃일 ${isBoat ? '배 리뷰' : '제품 리뷰'}`;
  const desc = trim(`${nm} — ${r.stars ? '별점 ' + r.stars + '/5. ' : ''}${r.text || ''}`, 155);
  const url = `${SITE}/r/${b.id}/${r.id}/`;
  const rows = [
    ['별점', r.stars ? HARD(r.stars) + ` ${r.stars}/5` : ''],
    ['또 살까', r.again === true ? '또 사겠다' : r.again === false ? '다시는' : ''],
    [isBoat ? '탄 기간' : '써 본 기간', ({ new:'갓 샀음', y1:'1년 미만', y3:'1~3년', y3up:'3년 넘게' })[r.used] || ''],
    ['연식', r.year], ['종류', r.kind], ['계통', r.sys],
    ['산 값', r.price != null ? Number(r.price).toLocaleString() + (r.cur || '원') : '']
  ].filter(x => x[1]);
  const pics = (r.photos||[]).map(pic).filter(Boolean).slice(0, 8);
  const body = `<h1>${esc(nm)}</h1>${byLine(b)}
<div style="margin:14px 0 4px">${rows.map(x =>
  `<div class="row"><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('')}</div>
${r.text ? `<h2 style="font-size:16px;margin:20px 0 2px">${isBoat ? '타 보니' : '써 보니'}</h2><p>${esc(r.text)}</p>` : ''}
${r.bad ? `<h2 style="font-size:16px;margin:18px 0 2px">아쉬운 점</h2><p>${esc(r.bad)}</p>` : ''}
${pics.map(u => `<img src="${esc(u)}" style="width:100%;border-radius:12px;margin:10px 0" loading="lazy" alt="">`).join('')}`;
  const jsonld = (r.stars >= 1 && r.stars <= 5) ? { '@context':'https://schema.org', '@type':'Review',
    itemReviewed:{ '@type':'Product', name: nm, brand: r.maker || undefined },
    reviewRating:{ '@type':'Rating', ratingValue: r.stars, bestRating:5 },
    reviewBody: String(r.text || ''), url } : null;
  return { rel:`r/${b.id}/${r.id}/index.html`, url, title, desc,
           html: page({ title, desc, url, body, jsonld, noindex: !!b.adminHidden }) };
}

function listPage(dir, heading, blurb, items){
  const url = `${SITE}/${dir}/`;
  const title = `${heading} | 뱃일`;
  const body = `<h1>${esc(heading)}</h1><p class="meta">${esc(blurb)}</p>
<ul class="list">${items.map(x => `<li><a href="${esc(x.url)}">${esc(x.name)}</a>
  <div class="sub">${esc(x.sub)}</div></li>`).join('')}</ul>`;
  return { rel:`${dir}/index.html`, url, title, desc:blurb,
           html: page({ title, desc:blurb, url, body }) };
}

(async () => {
  const boats = (await readAll()).filter(b => b && b.id);
  const pages = [];
  const idxM = [], idxV = [], idxR = [];

  boats.forEach(b => {
    (b.mlog || []).forEach(m => {
      if(!m || !m.id || !(m.how || []).length) return;   // 단계가 없으면 남이 볼 것이 없다
      const p = mlogPage(b, m); pages.push(p);
      if(!b.adminHidden) idxM.push({ url:p.url, name:m.title || '정비 기록',
        sub:[m.gear || [m.maker,m.model].filter(Boolean).join(' '), m.date, b.name].filter(Boolean).join(' · ') });
    });
    (b.voyage || []).forEach(v => {
      if(!v || !v.id) return;
      const p = voyPage(b, v); pages.push(p);
      if(!b.adminHidden) idxV.push({ url:p.url, name:v.title || [v.from,v.to].filter(Boolean).join(' → ') || v.date,
        sub:[v.date, v.nm ? v.nm + ' NM' : '', b.name].filter(Boolean).join(' · ') });
    });
    (b.review || []).forEach(r => {
      if(!r || !r.id) return;
      const p = rvPage(b, r); pages.push(p);
      if(!b.adminHidden) idxR.push({ url:p.url, name:r.title || [r.maker,r.model].filter(Boolean).join(' ') || r.kind || '리뷰',
        sub:[r.stars ? '★'+r.stars : '', r.kind, b.name].filter(Boolean).join(' · ') });
    });
  });

  pages.push(listPage('m', '정비수첩', '배 주인들이 직접 남긴 정비 절차입니다. 사진과 단계가 그대로 있습니다.', idxM));
  pages.push(listPage('v', '항해일지', '실제로 다녀온 항해 기록입니다.', idxV));
  pages.push(listPage('r', '제품 리뷰', '배에 달아 본 물건의 후기입니다.', idxR));

  pages.forEach(p => write(p.rel, p.html));

  // ── 사이트맵 · 로봇
  const urls = pages.filter(p => !/noindex/.test(p.html)).map(p => p.url);
  write('sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n')
    + `\n</urlset>\n`);
  write('robots.txt',
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  console.log(`구웠습니다: 페이지 ${pages.length}개 (정비수첩 ${idxM.length} · 항해일지 ${idxV.length} · 리뷰 ${idxR.length}), 사이트맵 ${urls.length}줄`);
})().catch(e => { console.error('★ 실패:', e && e.message || e); process.exit(1); });
