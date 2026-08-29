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


// ── 언어별 주소 (STEP 7 나머지, 4.69)
//
// ★ 왜 필요한가
//   일본 사람이 「ヤンマー インペラ 交換」 으로 검색해서 우리 페이지에 닿아야 하는데,
//   페이지가 통째로 한국어면 구글이 「이건 한국어 문서」 로 보고 일본어 검색에 안 띄운다.
//   그래서 같은 기록을 언어마다 다른 주소로 굽고, hreflang 으로 서로를 가리킨다.
//   (레딧이 이렇게 한다.)
//
// ★ 무엇을 옮기고 무엇을 안 옮기나
//   옮기는 것 — 화면 틀(제목·칸 이름·안내문). 이 표에 있는 것이 전부다.
//   안 옮기는 것 — **배 주인이 쓴 글 그 자체.** 「임펠러가 갈려 있었다」 를
//   기계로 옮기면 뜻이 달라지고, 그 사람이 안 한 말이 그 사람 이름으로 남는다.
//   대신 「이 기록은 한국어로 쓰였습니다」 라고 그 나라 말로 적어 둔다.
//
// ★ 말은 앱 용어표를 그대로 따른다 (整備手帳 · パーツレビュー · 航海日誌 …).
//   여기서 새 말을 지어내면 앱과 웹이 서로 다른 말을 쓰게 된다.
// ★★★ 웹에 굽는 것은 「공개」 하나뿐이다 (4.72).
//
//   앱의 공개 단계는 셋이다 — 공개 / 일부 공개 / 비공개.
//   「일부 공개」 는 *목록에 안 싣는다* 는 뜻이고, 웹 페이지는 목록보다 더 열린 자리다.
//   구글이 긁어 가고 sitemap 에 올라가면 「목록에 없다」 가 아무 뜻이 없어진다.
//
//   ★ 실제로 샜다 — 사장님이 「일부 공개」 로 두신 8/13 항해가
//     baetnil.com/v/.../ 에 페이지로 나가 있었다. 앱만 막고 웹을 안 막았기 때문이다.
//   ★ lv 가 없는 옛 자료는 'com' 으로 본다 — 지금까지 나가던 것이 갑자기 사라지면 안 된다.
//     (앱이 4.70 부터 항해에 lv 를 실어 보내고 있다. 정비수첩·리뷰는 4.72 부터다.)
const openWeb = r => ((r && r.lv) || 'com') === 'com';

const LANGS = ['ko', 'ja', 'en'];
const LPATH = { ko:'', ja:'ja/', en:'en/' };
const L10N = {
  ja: {
    '뱃일 — 배 타는 사람들':'뱃일 — 船に乗る人たち',
    '앱에서 보기':'アプリで見る', '앱 열기 →':'アプリを開く →',
    '이용약관':'이용약관', '개인정보':'개인정보',
    '이 기록은 「뱃일」 앱에서 배 주인이 직접 남긴 것입니다.':'この記録は「뱃일」アプリで船主が自分で残したものです。',
    '내 배의 정비수첩·항해일지도 같은 방법으로 남길 수 있습니다.':'ご自分の船の整備手帳・航海日誌も同じように残せます。',
    '정비 기록':'整備記録', '정비수첩':'整備手帳', '항해일지':'航海日誌',
    '제품 리뷰':'パーツレビュー', '배 리뷰':'船のレビュー', '리뷰':'レビュー',
    '장비':'装備', '부품 종류':'パーツ種類', '계통':'系統', '한 날':'作業日',
    '난이도':'難易度', '걸린 시간':'作業時間', '쓴 부품':'使用パーツ',
    '날짜':'日付', '출발':'出発', '도착':'到着', '거리':'距離',
    '항해 시간':'航海時間', '종류':'種類', '날씨':'天気', '중간 기록':'途中記録',
    '별점':'評価', '또 살까':'また買うか', '또 사겠다':'また買う', '다시는':'もう買わない',
    '써 본 기간':'使用期間', '탄 기간':'乗った期間',
    '갓 샀음':'買ったばかり', '1년 미만':'1年未満', '1~3년':'1〜3年', '3년 넘게':'3年以上',
    '연식':'年式', '산 값':'購入価格', '써 보니':'使ってみて', '타 보니':'乗ってみて',
    '아쉬운 점':'物足りない点',
    '배 주인들이 직접 남긴 정비 절차입니다. 사진과 단계가 그대로 있습니다.':'船主が自分で残した整備手順です。写真と手順がそのまま残っています。',
    '실제로 다녀온 항해 기록입니다.':'実際に行ってきた航海の記録です。',
    '배에 달아 본 물건의 후기입니다.':'船に取り付けてみたものの使用感です。',
    '이 기록은 한국어로 쓰였습니다.':'この記録は韓国語で書かれています。'
  },
  en: {
    '뱃일 — 배 타는 사람들':'Baetnil — for people on boats',
    '앱에서 보기':'Open in the app', '앱 열기 →':'Open the app →',
    '이용약관':'이용약관', '개인정보':'개인정보',
    '이 기록은 「뱃일」 앱에서 배 주인이 직접 남긴 것입니다.':'This record was written by the boat owner in the Baetnil app.',
    '내 배의 정비수첩·항해일지도 같은 방법으로 남길 수 있습니다.':'You can keep your own maintenance log and passage log the same way.',
    '정비 기록':'Maintenance record', '정비수첩':'Maintenance log', '항해일지':'Passage log',
    '제품 리뷰':'Product review', '배 리뷰':'Boat review', '리뷰':'Review',
    '장비':'Equipment', '부품 종류':'Part type', '계통':'System', '한 날':'Date done',
    '난이도':'Difficulty', '걸린 시간':'Time taken', '쓴 부품':'Parts used',
    '날짜':'Date', '출발':'From', '도착':'To', '거리':'Distance',
    '항해 시간':'Time under way', '종류':'Kind', '날씨':'Weather', '중간 기록':'Log entries',
    '별점':'Rating', '또 살까':'Buy again', '또 사겠다':'Would buy again', '다시는':'Would not',
    '써 본 기간':'Used for', '탄 기간':'Sailed for',
    '갓 샀음':'Brand new', '1년 미만':'under 1 year', '1~3년':'1–3 years', '3년 넘게':'over 3 years',
    '연식':'Year', '산 값':'Price paid', '써 보니':'How it went', '타 보니':'How she sails',
    '아쉬운 점':'What is lacking',
    '배 주인들이 직접 남긴 정비 절차입니다. 사진과 단계가 그대로 있습니다.':'Maintenance procedures written by boat owners, with the photos and steps as they left them.',
    '실제로 다녀온 항해 기록입니다.':'Records of passages actually made.',
    '배에 달아 본 물건의 후기입니다.':'Reviews of gear people have fitted to their boats.',
    '이 기록은 한국어로 쓰였습니다.':'This record was written in Korean.'
  }
};
// ★ 옮긴 말이 없으면 한국어를 그대로 낸다. 빈 칸이 나오면 안 된다 (앱의 t() 와 같은 규칙).
const T = (lang, s) => (lang === 'ko') ? s : ((L10N[lang] || {})[s] || s);
// ★ 배 주인이 쓴 글은 옮기지 않는다. 기계로 옮기면 그 사람이 안 한 말이 그 사람 이름으로 남는다.
//   대신 무슨 말로 쓰인 글인지 그 나라 말로 밝힌다.
const wroteIn = L => (L === 'ko') ? '' :
  `<div class="meta">${esc(T(L,'이 기록은 한국어로 쓰였습니다.'))}</div>`;
// 같은 기록의 다른 언어 주소
const alt = (lang, rel) => `${SITE}/${LPATH[lang]}${rel}`;

function page({ title, desc, url, body, jsonld, noindex, lang, rel }){
  const L = lang || 'ko';
  // ★ hreflang — 「같은 글의 다른 언어판은 저기 있다」 를 구글에 알려 준다.
  //   서로를 다 가리켜야 한다. 한쪽만 가리키면 구글이 무시한다.
  const hre = rel ? LANGS.map(x =>
      `<link rel="alternate" hreflang="${x}" href="${esc(alt(x, rel))}">`).join('\n')
      + `\n<link rel="alternate" hreflang="x-default" href="${esc(alt('ko', rel))}">` : '';
  return `<!doctype html>
<html lang="${esc(L)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(url)}">
${hre}
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="뱃일">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body><div class="wrap">
<header class="top"><a class="brand" href="${SITE}/">${esc(T(L,'뱃일 — 배 타는 사람들'))}</a><span class="sp"></span>
<a class="btn" href="${APP}">${esc(T(L,'앱에서 보기'))}</a></header>
${body}
<div class="cta"><b>${esc(T(L,'이 기록은 「뱃일」 앱에서 배 주인이 직접 남긴 것입니다.'))}</b>
${esc(T(L,'내 배의 정비수첩·항해일지도 같은 방법으로 남길 수 있습니다.'))}
<a href="${APP}">${esc(T(L,'앱 열기 →'))}</a></div>
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

function mlogPage(b, m, L){
  const prod = [m.maker, m.model].filter(Boolean).join(' ');
  const title = `${m.title || T(L,'정비 기록')}${prod ? ' — ' + prod : ''} | 뱃일 ${T(L,'정비수첩')}`;
  const desc = trim(`${prod ? prod + ' ' : ''}${m.title || ''} 정비 절차 ${(m.how||[]).length}단계.`
    + ((m.how||[])[0] ? ' ' + (m.how[0].v || '') : ''), 155);
  const rel = `m/${b.id}/${m.id}/`;
  const url = alt(L, rel);
  // ★ 장비 이름을 안 적으면 종류가 이름 자리에 선다 — 그러면 두 줄이 같은 말이 된다.
  const gname = m.gear || prod;
  const rows = [
    [T(L,'장비'),      gname],
    [T(L,'부품 종류'), (m.kind && m.kind !== gname) ? m.kind : ''],
    [T(L,'계통'),      m.sys],
    [T(L,'한 날'),     m.date],
    [T(L,'난이도'),    m.hard ? HARD(m.hard) : ''],
    [T(L,'걸린 시간'), durText(m.work)],
    [T(L,'쓴 부품'),   m.used]
  ].filter(r => r[1]);
  const body = `<h1>${esc(m.title || T(L,'정비 기록'))}</h1>${wroteIn(L)}
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
  return { rel: LPATH[L] + `m/${b.id}/${m.id}/index.html`, url, title, desc,
           html: page({ title, desc, url, body, jsonld, noindex: !!b.adminHidden, lang:L, rel }) };
}

function voyPage(b, v, L){
  const nm = v.title || [v.from, v.to].filter(Boolean).join(' → ') || v.date;
  const title = `${nm} | 뱃일 ${T(L,'항해일지')}`;
  const desc = trim(`${b.name || ''} ${v.date || ''} ${[v.from, v.to].filter(Boolean).join(' → ')}`
    + (v.nm ? ` ${v.nm}NM` : '') + (v.note ? ' · ' + v.note : ''), 155);
  const rel = `v/${b.id}/${v.id}/`;
  const url = alt(L, rel);
  const rows = [
    [T(L,'날짜'), v.date], [T(L,'출발'), [v.from, v.timeOut].filter(Boolean).join(' · ')],
    [T(L,'도착'), [v.to, v.timeIn].filter(Boolean).join(' · ')],
    [T(L,'거리'), v.nm ? v.nm + ' NM' : ''], [T(L,'항해 시간'), durText(v.hours)],
    [T(L,'종류'), v.kind], [T(L,'날씨'), [v.wxOut, v.wxIn].filter(Boolean).join(' → ')]
  ].filter(r => r[1]);
  const pics = (v.photos||[]).map(pic).filter(Boolean).slice(0, 12);
  const body = `<h1>${esc(nm)}</h1>${byLine(b)}${wroteIn(L)}
<div style="margin:14px 0 4px">${rows.map(r =>
  `<div class="row"><b>${esc(r[0])}</b><span>${esc(r[1])}</span></div>`).join('')}</div>
${v.note ? `<p>${esc(v.note)}</p>` : ''}
${(v.logs||[]).length ? `<h2 style="font-size:16px;margin:22px 0 4px">${esc(T(L,'중간 기록'))}</h2>` +
  (v.logs||[]).map(g => `<div class="row"><b>${esc(g.time||'')}</b><span>${
    esc([g.kind, g.text].filter(Boolean).join(' · '))}</span></div>`).join('') : ''}
${pics.map(u => `<img src="${esc(u)}" style="width:100%;border-radius:12px;margin:10px 0" loading="lazy" alt="">`).join('')}`;
  return { rel: LPATH[L] + `v/${b.id}/${v.id}/index.html`, url, title, desc,
           html: page({ title, desc, url, body, noindex: !!b.adminHidden, lang:L, rel }) };
}

function rvPage(b, r, L){
  const nm = r.title || [r.maker, r.model].filter(Boolean).join(' ') || r.kind || T(L,'리뷰');
  const isBoat = r.typ === 'boat';
  const title = `${nm} | 뱃일 ${T(L, isBoat ? '배 리뷰' : '제품 리뷰')}`;
  const desc = trim(`${nm} — ${r.stars ? '별점 ' + r.stars + '/5. ' : ''}${r.text || ''}`, 155);
  const rel = `r/${b.id}/${r.id}/`;
  const url = alt(L, rel);
  const rows = [
    [T(L,'별점'), r.stars ? HARD(r.stars) + ` ${r.stars}/5` : ''],
    [T(L,'또 살까'), r.again === true ? T(L,'또 사겠다') : r.again === false ? T(L,'다시는') : ''],
    [T(L, isBoat ? '탄 기간' : '써 본 기간'),
      ({ new:T(L,'갓 샀음'), y1:T(L,'1년 미만'), y3:T(L,'1~3년'), y3up:T(L,'3년 넘게') })[r.used] || ''],
    [T(L,'연식'), r.year], [T(L,'종류'), r.kind], [T(L,'계통'), r.sys],
    [T(L,'산 값'), r.price != null ? Number(r.price).toLocaleString() + (r.cur || '원') : '']
  ].filter(x => x[1]);
  const pics = (r.photos||[]).map(pic).filter(Boolean).slice(0, 8);
  const body = `<h1>${esc(nm)}</h1>${byLine(b)}${wroteIn(L)}
<div style="margin:14px 0 4px">${rows.map(x =>
  `<div class="row"><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('')}</div>
${r.text ? `<h2 style="font-size:16px;margin:20px 0 2px">${esc(T(L, isBoat ? '타 보니' : '써 보니'))}</h2><p>${esc(r.text)}</p>` : ''}
${r.bad ? `<h2 style="font-size:16px;margin:18px 0 2px">${esc(T(L,'아쉬운 점'))}</h2><p>${esc(r.bad)}</p>` : ''}
${pics.map(u => `<img src="${esc(u)}" style="width:100%;border-radius:12px;margin:10px 0" loading="lazy" alt="">`).join('')}`;
  const jsonld = (r.stars >= 1 && r.stars <= 5) ? { '@context':'https://schema.org', '@type':'Review',
    itemReviewed:{ '@type':'Product', name: nm, brand: r.maker || undefined },
    reviewRating:{ '@type':'Rating', ratingValue: r.stars, bestRating:5 },
    reviewBody: String(r.text || ''), url } : null;
  return { rel: LPATH[L] + `r/${b.id}/${r.id}/index.html`, url, title, desc,
           html: page({ title, desc, url, body, jsonld, noindex: !!b.adminHidden, lang:L, rel }) };
}

function listPage(dir, heading, blurb, items, L){
  const rel = `${dir}/`;
  const url = alt(L, rel);
  const h = T(L, heading), bl = T(L, blurb);
  const title = `${h} | 뱃일`;
  const body = `<h1>${esc(h)}</h1><p class="meta">${esc(bl)}</p>
<ul class="list">${items.map(x => `<li><a href="${esc(x.url)}">${esc(x.name)}</a>
  <div class="sub">${esc(x.sub)}</div></li>`).join('')}</ul>`;
  return { rel: LPATH[L] + `${dir}/index.html`, url, title, desc:bl,
           html: page({ title, desc:bl, url, body, lang:L, rel }) };
}

(async () => {
  const boats = (await readAll()).filter(b => b && b.id);
  const pages = [];
  let nM = 0, nV = 0, nR = 0;

  // ★ 언어마다 한 벌씩 굽는다. 같은 기록이 ko · ja · en 세 주소를 갖고,
  //   hreflang 으로 서로를 가리킨다 — 그래야 일본어 검색에 일본어 페이지가 뜬다.
  LANGS.forEach(L => {
    const idxM = [], idxV = [], idxR = [];
    boats.forEach(b => {
      (b.mlog || []).forEach(m => {
        if(!m || !m.id || !(m.how || []).length) return;   // 단계가 없으면 남이 볼 것이 없다
        if(!openWeb(m)) return;                            // ★ 「일부 공개」 는 웹에 안 굽는다
        const p = mlogPage(b, m, L); pages.push(p);
        if(!b.adminHidden) idxM.push({ url:p.url, name:m.title || T(L,'정비 기록'),
          sub:[m.gear || [m.maker,m.model].filter(Boolean).join(' '), m.date, b.name].filter(Boolean).join(' · ') });
      });
      (b.voyage || []).forEach(v => {
        if(!v || !v.id) return;
        if(!openWeb(v)) return;                            // ★ 「일부 공개」 는 웹에 안 굽는다
        const p = voyPage(b, v, L); pages.push(p);
        if(!b.adminHidden) idxV.push({ url:p.url, name:v.title || [v.from,v.to].filter(Boolean).join(' → ') || v.date,
          sub:[v.date, v.nm ? v.nm + ' NM' : '', b.name].filter(Boolean).join(' · ') });
      });
      (b.review || []).forEach(r => {
        if(!r || !r.id) return;
        if(!openWeb(r)) return;                            // ★ 「일부 공개」 는 웹에 안 굽는다
        const p = rvPage(b, r, L); pages.push(p);
        if(!b.adminHidden) idxR.push({ url:p.url, name:r.title || [r.maker,r.model].filter(Boolean).join(' ') || r.kind || T(L,'리뷰'),
          sub:[r.stars ? '★'+r.stars : '', r.kind, b.name].filter(Boolean).join(' · ') });
      });
    });
    pages.push(listPage('m', '정비수첩', '배 주인들이 직접 남긴 정비 절차입니다. 사진과 단계가 그대로 있습니다.', idxM, L));
    pages.push(listPage('v', '항해일지', '실제로 다녀온 항해 기록입니다.', idxV, L));
    pages.push(listPage('r', '제품 리뷰', '배에 달아 본 물건의 후기입니다.', idxR, L));
    if(L === 'ko'){ nM = idxM.length; nV = idxV.length; nR = idxR.length; }
  });

  pages.forEach(p => write(p.rel, p.html));

  // ★★★ 내린 것은 실제로 사라져야 한다 (4.73)
  //
  //   여태 이 스크립트는 쓰기만 했다. 그래서 사람이 기록을 내리거나 지워도
  //   웹 페이지는 그 자리에 그대로 남았다. 앱에서만 사라지고 밖에는 남는다 —
  //   「내렸다」 고 믿게 만들어 놓고 안 내리는 것이라 가장 나쁜 흠이다.
  //
  //   ★ 지울 목록을 따로 들고 다니지 않는다. 그런 목록은 반드시 빠뜨린다.
  //     이 스크립트는 「지금 있어야 할 페이지 전부」 를 알고 있다(pages).
  //     그러니 폴더를 훑어 그 목록에 없는 것을 지운다 — 그것이 곧 내려간 것이다.
  //   ★ 통째로 지웠다 다시 굽지 않는다. 굽다가 중간에 실패하면 사이트가 통째로 빈다.
  //     쓸 것을 다 쓴 뒤에, 남는 것만 지운다.
  {
    const keep = new Set(pages.map(p => path.normalize(path.join(OUT, p.rel))));
    let gone = 0;
    const sweep = dir => {
      const abs = path.join(OUT, dir);
      if(!fs.existsSync(abs)) return;
      for(const e of fs.readdirSync(abs, { withFileTypes:true })){
        const rel = path.join(dir, e.name);
        if(e.isDirectory()){ sweep(rel); 
          try{ if(!fs.readdirSync(path.join(OUT, rel)).length) fs.rmdirSync(path.join(OUT, rel)); }catch(_){}
        } else if(!keep.has(path.normalize(path.join(OUT, rel)))){
          fs.unlinkSync(path.join(OUT, rel)); gone++;
          console.log('  내려감: ' + rel.split(path.sep).join('/'));
        }
      }
    };
    ['m','v','r'].forEach(sweep);
    LANGS.filter(L => LPATH[L]).forEach(L => ['m','v','r'].forEach(d => sweep(LPATH[L] + d)));
    console.log(`내려간 페이지 ${gone}개`);
  }

  // ── 사이트맵 · 로봇
  const urls = pages.filter(p => !/noindex/.test(p.html)).map(p => p.url);
  write('sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n')
    + `\n</urlset>\n`);
  write('robots.txt',
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  console.log(`구웠습니다: 페이지 ${pages.length}개 · 말 ${LANGS.length}가지 `
    + `(정비수첩 ${nM} · 항해일지 ${nV} · 리뷰 ${nR}), 사이트맵 ${urls.length}줄`);
})().catch(e => { console.error('★ 실패:', e && e.message || e); process.exit(1); });
