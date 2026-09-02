// 뱃일 — 공개 기록 페이지를 「볼 때」 만든다 (클라우드플레어 워커)
//
// ★★★ 왜 미리 안 굽나 (2026-08-29, 사장님 지시)
//   전에는 하루 한 번 페이지를 파일로 구워 저장소에 올려 두었다.
//   그러면 사람이 기록을 내려도 그 파일이 그대로 남아 있다가 다음 굽기 때야 사라진다.
//   ★ 사람은 내리기를 누르고 그 자리에서 확인한다. 하루를 기다리지 않는다.
//     「내렸다」 고 믿게 만들어 놓고 안 내리는 것이라 가장 나쁜 흠이다.
//
//   ★ 그래서 사본을 없앴다. 진실은 boatPublic 하나뿐이다.
//     들어오면 그때 읽어서 그 자리에서 만든다 — 내리면 그 다음 사람부터 404 다.
//     지울 것이 없으니 빠뜨릴 것도 없다.
//
// ★ 페이지를 만드는 곳은 이 파일 하나다.
//   build_web.js 는 이제 sitemap.xml · robots.txt 만 굽는다 (그건 늦어도 된다 —
//   구글에 알려 주는 목록일 뿐이고, 없는 주소는 404 를 받고 알아서 지운다).
//
// ★ 열쇠가 없다. boatPublic 은 규칙이 `allow read: if true` 라 웹 apiKey 하나로 읽는다.

const PROJECT = 'baetnil';
const API_KEY = 'AIzaSyAH1iM-ljsnTmzWmExfSqrMbILhVaJaITA';
const SITE    = 'https://baetnil.com';
const APP     = SITE + '/app/';
const FS      = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/boatPublic`;

// ── 한 배만 읽는다 (기록 페이지)
async function readOne(id){
  const r = await fetch(`${FS}/${encodeURIComponent(id)}?key=${API_KEY}`);
  // ★ 404 는 「그런 배가 없다」 — 이건 진짜 없는 것이다.
  //   그 밖의 실패(500·끊김)는 「못 읽었다」 이지 「없다」 가 아니다. 던져서 503 으로 답한다.
  if(r.status === 404) return null;
  if(!r.ok) throw new Error('firestore ' + r.status);
  const d = await r.json();
  const o = {}; const f = d.fields || {};
  for(const k in f) o[k] = unwrap(f[k]);
  if(!o.id) o.id = String(d.name || '').split('/').pop();
  return o;
}
// ── 다 읽는다 (목록 페이지)
async function readAll(){
  const rows = []; let token = '';
  for(let guard = 0; guard < 100; guard++){
    const r = await fetch(`${FS}?pageSize=200&key=${API_KEY}` + (token ? `&pageToken=${encodeURIComponent(token)}` : ''));
    if(!r.ok) throw new Error('firestore ' + r.status);
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

const LANGS = ['ko', 'ja', 'en', 'ru'];
const LPATH = { ko:'', ja:'ja/', en:'en/', ru:'ru/' };
const L10N = {
  ja: {
    '뱃일 — 배 타는 사람들':'뱃일 — 船に乗る人たち',
    '앱에서 보기':'アプリで見る', '앱 열기 →':'アプリを開く →',
    '이용약관':'利用規約', '개인정보':'プライバシー',
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
    '이 기록은 한국어로 쓰였습니다.':'この記録は韓国語で書かれています。',
    '없는 기록입니다':'ない記録です',
    '이 기록은 내려갔거나 지워졌습니다.':'この記録は公開が取り下げられたか、削除されました。',
    '잠시 뒤에 다시 열어 주세요.':'しばらくしてからもう一度開いてください。'
  },
  en: {
    '뱃일 — 배 타는 사람들':'Baetnil — for people on boats',
    '앱에서 보기':'Open in the app', '앱 열기 →':'Open the app →',
    '이용약관':'Terms', '개인정보':'Privacy',
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
    '이 기록은 한국어로 쓰였습니다.':'This record was written in Korean.',
    '없는 기록입니다':'Not found',
    '이 기록은 내려갔거나 지워졌습니다.':'This record has been unpublished or deleted.',
    '잠시 뒤에 다시 열어 주세요.':'Please try again in a moment.'
  },
  // ★ 러시아어가 여기 없었다 (4.94 에 넣음).
  //   대문에는 러시아어가 있는데 기록 페이지에는 없어서, 앞문과 뒷문이 서로 다른 말을 썼다.
  ru: {
    '뱃일 — 배 타는 사람들':'Baetnil — для тех, кто выходит в море',
    '앱에서 보기':'Открыть в приложении', '앱 열기 →':'Открыть приложение →',
    '이용약관':'Условия', '개인정보':'Конфиденциальность',
    '이 기록은 「뱃일」 앱에서 배 주인이 직접 남긴 것입니다.':'Эту запись владелец лодки сделал сам в приложении Baetnil.',
    '내 배의 정비수첩·항해일지도 같은 방법으로 남길 수 있습니다.':'Свой журнал обслуживания и судовой журнал можно вести так же.',
    '정비 기록':'Запись обслуживания', '정비수첩':'Журнал обслуживания', '항해일지':'Судовой журнал',
    '제품 리뷰':'Отзыв на товар', '배 리뷰':'Отзыв о лодке', '리뷰':'Отзыв',
    '장비':'Оборудование', '부품 종류':'Тип запчасти', '계통':'Система', '한 날':'Дата работ',
    '난이도':'Сложность', '걸린 시간':'Время работ', '쓴 부품':'Использованные детали',
    '날짜':'Дата', '출발':'Отход', '도착':'Приход', '거리':'Расстояние',
    '항해 시간':'Время в пути', '종류':'Тип', '날씨':'Погода', '중간 기록':'Записи в пути',
    '별점':'Оценка', '또 살까':'Купил бы снова', '또 사겠다':'Купил бы снова', '다시는':'Больше нет',
    '써 본 기간':'Срок использования', '탄 기간':'Срок хождения',
    '갓 샀음':'Только куплено', '1년 미만':'меньше года', '1~3년':'1–3 года', '3년 넘게':'больше 3 лет',
    '연식':'Год', '산 값':'Цена покупки', '써 보니':'Впечатления', '타 보니':'Как ходит',
    '아쉬운 점':'Чего не хватает',
    '배 주인들이 직접 남긴 정비 절차입니다. 사진과 단계가 그대로 있습니다.':'Порядок работ, записанный самими владельцами лодок. Фотографии и шаги — как они их оставили.',
    '실제로 다녀온 항해 기록입니다.':'Записи о реально пройденных переходах.',
    '배에 달아 본 물건의 후기입니다.':'Отзывы о том, что люди ставили на свои лодки.',
    '이 기록은 한국어로 쓰였습니다.':'Эта запись написана на корейском языке.',
    '없는 기록입니다':'Запись не найдена',
    '이 기록은 내려갔거나 지워졌습니다.':'Эта запись снята с публикации или удалена.',
    '잠시 뒤에 다시 열어 주세요.':'Пожалуйста, откройте чуть позже.'
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
// 약관·개인정보는 말마다 파일이 따로다 (terms.html / .en / .ru / .ja).
// ★ 4.96 — 일본어 약관이 생겼다. 이제 넷 다 제 말로 건다.
//   그 파일들은 build_web.js 가 앱의 약관에서 구워 낸다.
//   대문(index.html)도 같은 규칙을 쓴다. 두 곳이 어긋나면 안 된다.
const DOC = { ko:'', ja:'.ja', en:'.en', ru:'.ru' };

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
<footer>뱃일 · <a href="${SITE}/terms${DOC[L]}.html">${esc(T(L,'이용약관'))}</a> ·
<a href="${SITE}/privacy${DOC[L]}.html">${esc(T(L,'개인정보'))}</a> · <a href="mailto:help@baetnil.com">help@baetnil.com</a></footer>
</div></body></html>`;
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
  // ★ 4.95 — 사진이 자리마다 붙는다 (출발 · 중간 기록 · 도착 · 이 항해 사진).
  //   읽는 사람에게는 「언제 어디서 찍은 것인지」 가 붙어 있어야 이야기가 된다.
  const shot = u => `<img src="${esc(u)}" style="width:100%;border-radius:12px;margin:10px 0" loading="lazy" alt="">`;
  const shots = a => (Array.isArray(a) ? a : []).map(pic).filter(Boolean).map(shot).join('');
  const pics = (v.photos||[]).map(pic).filter(Boolean).slice(0, 12);
  const body = `<h1>${esc(nm)}</h1>${byLine(b)}${wroteIn(L)}
<div style="margin:14px 0 4px">${rows.map(r =>
  `<div class="row"><b>${esc(r[0])}</b><span>${esc(r[1])}</span></div>`).join('')}</div>
${shots(v.phOut)}
${v.note ? `<p>${esc(v.note)}</p>` : ''}
${(v.logs||[]).length ? `<h2 style="font-size:16px;margin:22px 0 4px">${esc(T(L,'중간 기록'))}</h2>` +
  (v.logs||[]).map(g => `<div class="row"><b>${esc(g.time||'')}</b><span>${
    esc([g.kind, g.text].filter(Boolean).join(' · '))}</span></div>` + shots(g.photos)).join('') : ''}
${shots(v.phIn)}
${pics.map(shot).join('')}`;
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


// ══════════════════════════════════════════════════════════════
// 들어온 주소를 받아 그 자리에서 만든다
//
//   /m/{배}/{기록}/     정비수첩 한 건        /ja/m/... · /en/m/...
//   /v/{배}/{항해}/     항해일지 한 건
//   /r/{배}/{리뷰}/     리뷰 한 건
//   /m/  /v/  /r/       목록
//
// ★ 없는 것·내린 것은 404 다. 「빈 페이지」 를 주지 않는다 —
//   구글이 빈 페이지를 계속 들고 있게 된다.
const KIND = { m:'mlog', v:'voyage', r:'review' };
const HEAD = {
  m: ['정비수첩', '배 주인들이 직접 남긴 정비 절차입니다. 사진과 단계가 그대로 있습니다.'],
  v: ['항해일지', '실제로 다녀온 항해 기록입니다.'],
  r: ['제품 리뷰', '배에 달아 본 물건의 후기입니다.']
};
const HTML = (html, status) => new Response(html, {
  status: status || 200,
  headers: {
    'content-type': 'text/html; charset=utf-8',
    // ★ 담아 두지 않는다. 담아 두면 내린 것이 그 시간만큼 더 보인다.
    'cache-control': 'no-store',
    'x-robots-tag': status === 404 ? 'noindex' : 'all'
  }
});
function gone(L){
  return HTML(page({ lang:L, noindex:true,
    title: T(L,'없는 기록입니다') + ' | 뱃일',
    desc:  T(L,'이 기록은 내려갔거나 지워졌습니다.'),
    url:   SITE + '/',
    body:  `<h1>${esc(T(L,'없는 기록입니다'))}</h1><p class="meta">${
             esc(T(L,'이 기록은 내려갔거나 지워졌습니다.'))}</p>` }), 404);
}

// ══════════════════════════════════════════════════════════════
// 대문(/)에 들어온 사람을 그 나라 말판으로 보낸다
//
// ★ 왜 여기서 하나 (페이지 안의 자바스크립트가 아니라)
//   자바스크립트로 글자만 바꾸면, 구글 로봇이 뿌리(/)를 열었을 때 로봇의 말로 그려진다.
//   그런데 canonical 과 hreflang 은 「/ 는 한국어판」 이라고 말한다. 서로 어긋난다.
//   ★ 로봇은 Accept-Language 를 안 보낸다. 그래서 여기서 그 머리말로 가르면
//     로봇은 뿌리에 그대로 남아 한국어로 색인되고, 사람만 제 말판으로 간다.
//
// ★ 되돌릴 길을 반드시 둔다 — 말판마다 「그 나라 말로 보기」 띠가 있고,
//   한 번 고르면 쿠키(bt_lang)에 남아 다음부터는 안 보낸다. 안 그러면 갇힌다.
//
// ★ 대문(/)에서만 한다. 기록 페이지는 안 보낸다 —
//   검색으로 그 주소를 콕 집어 들어온 사람의 말을 뒤집으면 안 된다.
const FRONT_LANGS = ['ja', 'en', 'ru'];
function cookieLang(req){
  const c = req.headers.get('cookie') || '';
  const m = c.match(/(?:^|;\s*)bt_lang=([a-z]{2})/);
  return (m && (m[1] === 'ko' || FRONT_LANGS.indexOf(m[1]) >= 0)) ? m[1] : '';
}
function wantLang(req){
  // 'ja,en-US;q=0.9,en;q=0.8' → 앞에서부터 우리가 아는 말
  const raw = req.headers.get('accept-language') || '';
  if(!raw) return '';                        // 로봇은 여기서 끝난다 (뿌리에 남는다)
  const rows = raw.split(',').map(x => {
    const [tag, ...rest] = x.trim().split(';');
    const q = rest.map(r => r.trim()).find(r => r.startsWith('q='));
    return { v: String(tag || '').slice(0,2).toLowerCase(), q: q ? parseFloat(q.slice(2)) : 1 };
  }).filter(x => x.v).sort((a,b) => b.q - a.q);
  for(const r of rows){
    if(r.v === 'ko') return 'ko';
    if(FRONT_LANGS.indexOf(r.v) >= 0) return r.v;
    if(r.v === 'uk' || r.v === 'be' || r.v === 'kk') return 'ru';
  }
  return '';
}

// ══════════════════════════════════════════════════════════════
// ★★★ 일본 해상경보 — /app/warn-jp.json  (4.99 뒤에 붙인 것)
//
// ★ 무엇을 하나
//   気象庁이 낸 「地方海上警報」 전문을 그 자리에서 읽어, 지금 발효 중인
//   경보만 추려 앱에 넘긴다. 해역 이름·해역 번호·경보 이름은 전문에 적힌
//   글자를 **그대로** 옮긴다. 여기서 새로 지어내는 값은 하나도 없다.
//
// ★ 왜 워커에서 하나 (일감으로 하루 한 번 굽지 않고)
//   해상경보는 여섯 시간마다 나오고, 바다가 험해지면 그 사이에도 나온다.
//   하루 한 번 구워 두면 「어제 것」 을 오늘 것인 양 보여 주게 된다.
//   사람이 이 화면을 보고 바다에 나간다. 여기서 늦은 자료를 주면 안 된다.
//   ★ 대신 気象庁 쪽은 10분 갈무리한다 — 남의 서버다. 아껴 쓴다.
//
// ★ 출처 — 気象庁 防災情報XML (政府標準利用規約).
//   출처를 밝히면 상업 이용이 된다. 자료에도 화면에도 적는다. 빼면 못 쓴다.
//
// ★ 못 읽었을 때 빈 목록을 주지 않는다.
//   빈 목록은 앱에서 「경보 없음」 으로 읽힌다. 그건 조용한 거짓말이고
//   그 말을 믿고 나가면 배가 위험해진다. 못 읽었으면 못 읽었다고 말한다.
// ★ 소식줄을 둘 다 읽는다.
//   other.xml     — 잦은 것. 바로 앞 한두 시간만 담는다.
//   other_l.xml   — 긴 것. 며칠치를 담는데 갱신이 한 발 늦을 때가 있다 (실제로 하루 늦은 것을 봤다).
//   ★ 하나만 읽으면 어느 쪽이든 구멍이 난다. 둘을 합치고 발표 시각으로 다시 세운다.
const JMA_FEEDS = [
  'https://www.data.jma.go.jp/developer/xml/feed/other.xml',
  'https://www.data.jma.go.jp/developer/xml/feed/other_l.xml'
];
const JMA_KIND  = '地方海上警報';
const JMA_LINK  = 'https://www.jma.go.jp/bosai/seawarning/';
const JMA_FROM  = '気象庁 防災情報XML (政府標準利用規約)';
const JMA_TTL   = 600;   // 초. 気象庁 쪽 갈무리
const JMA_MAX   = 14;    // 한 번에 읽을 해상기상대 수 (지금 열둘이다. 여유를 둔다)

// 이름칸(namespace)이 붙든 안 붙든 같은 이름표를 잡는다.
// ★ 気象庁 전문은 <Report> 안에서 이름칸이 세 번 바뀐다. 이름칸을 따지기 시작하면
//   전문 모양이 조금만 달라져도 통째로 못 읽는다. 이름표만 본다.
function jmaTag(name){
  return new RegExp('<(?:[A-Za-z_][\\w.-]*:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?' + name + '>', 'g');
}
function jmaOne(xml, name){
  const m = jmaTag(name).exec(String(xml || ''));
  return m ? m[1].trim() : '';
}
function jmaAll(xml, name){
  const re = jmaTag(name), s = String(xml || ''), out = [];
  let m; while((m = re.exec(s))) out.push(m[1]);
  return out;
}

// ── 소식줄(Atom)에서 「地方海上警報」 줄만 뽑는다
function jmaFeedRows(xml){
  const out = [];
  jmaAll(xml, 'entry').forEach(e => {
    if(jmaOne(e, 'title').indexOf(JMA_KIND) !== 0) return;
    const m = /<link[^>]*\shref="([^"]+)"/.exec(e);
    if(!m) return;
    out.push({ who: jmaOne(e, 'content') || jmaOne(e, 'id'), href: m[1], at: jmaOne(e, 'updated') });
  });
  return out;
}
// 여러 소식줄을 합쳐 해상기상대마다 **가장 새로 낸 것** 하나씩 고른다.
// ★ 「소식줄에서 먼저 나온 것이 최신」 이라고 믿지 않는다. 발표 시각으로 다시 세운다.
function jmaFeedPick(){
  const rows = [];
  for(let i = 0; i < arguments.length; i++)
    jmaFeedRows(arguments[i]).forEach(r => rows.push(r));
  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const seen = {}, out = [];
  rows.forEach(r => { if(!r.who || seen[r.who]) return; seen[r.who] = 1; out.push(r); });
  return out.slice(0, JMA_MAX);
}

// ── 전문 하나를 읽는다
//
// ★ 무엇을 「지금 걸린 경보」 로 보나
//   気象庁이 Headline 에 적어 둔 것만 본다. 그것이 그 전문의 요지다.
//   해제·경보없음(코드 00)은 경보로 세지 않는다 — 세면 없는 위험을 있다고 말하게 된다.
function jmaParse(xml){
  const head  = jmaOne(xml, 'Head');
  const ctrl  = jmaOne(xml, 'Control');
  const info  = jmaOne(jmaOne(head, 'Headline'), 'Information');
  const zones = [];
  jmaAll(info, 'Item').forEach(it => {
    const k    = jmaOne(it, 'Kind');
    const kind = jmaOne(k, 'Name');
    const code = jmaOne(k, 'Code');
    if(!kind || kind.indexOf('警報') < 0) return;
    if(kind.indexOf('解除') >= 0 || kind.indexOf('なし') >= 0 || code === '00') return;
    jmaAll(jmaOne(it, 'Areas'), 'Area').forEach(a => {
      const reg = jmaOne(a, 'Name');
      if(!reg) return;
      zones.push({ kind, code, reg, regCode: jmaOne(a, 'Code') });
    });
  });
  return {
    office: jmaOne(head, 'Title'),                 // 神戸海上気象
    by:     jmaOne(ctrl, 'PublishingOffice'),      // 高松地方気象台
    at:     jmaOne(head, 'ReportDateTime'),
    until:  jmaOne(head, 'ValidDateTime'),
    zones
  };
}

// 유효 시각이 지난 전문은 안 쓴다. 지난 경보를 지금 경보인 양 보여 주면 안 된다.
function jmaLive(rep, now){
  if(!rep || !rep.zones || !rep.zones.length) return false;
  if(!rep.until) return true;                      // 유효 시각이 없으면 그대로 둔다
  const t = Date.parse(rep.until);
  return !isFinite(t) || t >= now;
}

async function jmaGet(url){
  const r = await fetch(url, {
    cf: { cacheTtl: JMA_TTL, cacheEverything: true },
    headers: { 'user-agent': 'baetnil.com marine app (contact help@baetnil.com)' }
  });
  if(!r.ok) throw new Error(url.replace(/^https?:\/\/[^/]+/, '') + ' → ' + r.status);
  return await r.text();
}

async function jmaWarnJson(){
  const now  = Date.now();
  const feeds = [], bad = [];
  for(const f of JMA_FEEDS){
    try{ feeds.push(await jmaGet(f)); }catch(e){ bad.push(String(e && e.message || e)); }
  }
  // ★ 둘 다 못 읽었을 때만 성을 낸다. 하나라도 읽었으면 그것으로 한다.
  if(!feeds.length) throw new Error(bad.join(' · ') || '소식줄을 못 읽었습니다');
  const rows = jmaFeedPick.apply(null, feeds);
  if(!rows.length)
    return { ok:true, read:new Date(now).toISOString(), from:JMA_FROM, link:JMA_LINK,
             reports:[], zones:[] };
  const reps = [];
  for(const row of rows){
    const url = new URL(row.href, JMA_FEEDS[0]).href;
    let rep;
    try{ rep = jmaParse(await jmaGet(url)); }catch(e){ continue; }
    if(jmaLive(rep, now)) reps.push(rep);
  }
  const zones = [];
  reps.forEach(r => r.zones.forEach(z => zones.push({ ...z, office: r.office, until: r.until })));
  return { ok:true, read:new Date(now).toISOString(), from:JMA_FROM, link:JMA_LINK,
           reports:reps, zones };
}

function jmaRes(body, ok){
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': ok ? 'public, max-age=300' : 'no-store'
    }
  });
}

export default {
  async fetch(req){
    const u = new URL(req.url);
    const p = u.pathname;

    // ── 일본 해상경보 (気象庁). 파일이 아니라 그 자리에서 읽어 낸다.
    if(p === '/app/warn-jp.json'){
      try{ return jmaRes(await jmaWarnJson(), true); }
      catch(e){
        // ★ 빈 목록을 주지 않는다. 못 읽었으면 못 읽었다고 말한다.
        return jmaRes({ ok:false, why:String(e && e.message || e),
                        read:new Date().toISOString(), from:JMA_FROM, link:JMA_LINK }, false);
      }
    }

    // ── 대문 — 그 나라 말판으로 보낸다
    if(p === '/' || p === '/index.html'){
      const r = await fetch(req);
      // ★ 어느 말로 줄지가 머리말·쿠키에 따라 갈린다는 것을 중간 저장소에 알려야 한다.
      //   이걸 빠뜨리면 한 사람이 받은 판이 다음 사람에게 그대로 나간다.
      const out = new Response(r.body, r);
      out.headers.set('vary', 'Accept-Language, Cookie');
      const got = cookieLang(req) || wantLang(req);
      // ★ FRONT_LANGS 에 ko 는 없다 — 뿌리(/)가 한국어판이므로 한국 사람은 안 보낸다.
      if(got && FRONT_LANGS.indexOf(got) >= 0){
        return new Response(null, { status: 302, headers: {
          'location': '/' + got + '/',
          'vary': 'Accept-Language, Cookie',
          'cache-control': 'no-store'
        }});
      }
      return out;
    }

    const mm = p.match(/^\/(?:(ja|en|ru)\/)?(m|v|r)\/(?:([^/]+)\/([^/]+)\/)?$/);
    if(!mm) return fetch(req);                      // 우리 자리가 아니면 그대로 넘긴다
    const L = mm[1] || 'ko', d = mm[2], bid = mm[3], rid = mm[4];

    try{
      // ── 목록
      if(!bid){
        const boats = await readAll();
        const items = [];
        boats.filter(b => b && !b.adminHidden).forEach(b => {
          (b[KIND[d]] || []).forEach(r => {
            if(!r || !r.id || !openWeb(r)) return;
            if(d === 'm' && !(r.how || []).length) return;
            items.push({
              url: alt(L, `${d}/${b.id}/${r.id}/`),
              name: r.title
                 || (d === 'v' ? [r.from, r.to].filter(Boolean).join(' → ') : '')
                 || [r.maker, r.model].filter(Boolean).join(' ')
                 || r.date || T(L, HEAD[d][0]),
              sub: (d === 'v' ? [r.date, r.nm ? r.nm + ' NM' : '', b.name]
                  : d === 'm' ? [r.gear || [r.maker,r.model].filter(Boolean).join(' '), r.date, b.name]
                              : [r.stars ? '★'+r.stars : '', r.kind, b.name]).filter(Boolean).join(' · ')
            });
          });
        });
        return HTML(listPage(d, HEAD[d][0], HEAD[d][1], items, L).html);
      }

      // ── 한 건
      const b = await readOne(bid);
      if(!b) return gone(L);
      const r = (b[KIND[d]] || []).find(x => x && String(x.id) === String(rid));
      // ★★★ 여기가 그 문이다. 「공개」 가 아니면 없는 것과 같다.
      if(!r || !openWeb(r)) return gone(L);
      if(d === 'm' && !(r.how || []).length) return gone(L);
      const mk = d === 'm' ? mlogPage : d === 'v' ? voyPage : rvPage;
      return HTML(mk(b, r, L).html);
    }catch(e){
      // ★ 자료를 못 읽었을 때 「없다」 고 하면 안 된다 — 멀쩡한 기록이 사라진 것처럼 된다.
      return HTML(page({ lang:L, noindex:true,
        title:'뱃일', desc:'', url: SITE + p,
        body:`<h1>${esc(T(L,'잠시 뒤에 다시 열어 주세요.'))}</h1>` }), 503);
    }
  }
};
