// 뱃일 — sitemap.xml · robots.txt 를 굽고, 옛 사본을 걷어낸다
//
// ★★★ 페이지는 여기서 안 만든다 (2026-08-29 부터)
//   전에는 기록 하나하나를 파일로 구워 저장소에 올려 두었다.
//   그러면 사람이 기록을 내려도 그 파일이 남아 있다가 다음 굽기 때야 사라진다.
//   ★ 사람은 내리기를 누르고 그 자리에서 확인한다. 하루를 기다리지 않는다.
//
//   그래서 사본을 없앴다. 페이지는 `worker.js` 가 **들어올 때** 만든다.
//   진실은 boatPublic 하나뿐이고, 내리면 그 다음 사람부터 404 다.
//
// ★ 여기 남은 일은 둘뿐이다
//   ① sitemap.xml — 구글에 「이런 주소가 있다」 고 알려 주는 목록.
//      이건 늦어도 된다. 없는 주소를 가리켜도 구글이 404 를 받고 스스로 지운다.
//   ② 옛 사본 걷어내기 — 예전에 구워 올려 둔 m/ v/ r/ ja/ en/ 파일들.
//      워커가 앞에서 가로채니 안 쓰이지만, 저장소에 남아 있으면 그대로 읽힌다.
//      ★ 워커를 먼저 붙인 뒤에 이 일이 돌아야 한다. 순서가 바뀌면 페이지가 잠깐 죽는다.
//
// ★ 열쇠가 없다. boatPublic 은 규칙이 `allow read: if true` 라 웹 apiKey 하나로 읽는다.

const fs = require('fs');
const path = require('path');

const PROJECT = 'baetnil';
const API_KEY = process.env.FB_API_KEY || 'AIzaSyAH1iM-ljsnTmzWmExfSqrMbILhVaJaITA';
const SITE    = (process.env.SITE_URL || 'https://baetnil.com').replace(/\/+$/, '');
const OUT     = process.env.OUT_DIR || '.';

const LANGS = ['ko', 'ja', 'en', 'ru'];
const LPATH = { ko:'', ja:'ja/', en:'en/', ru:'ru/' };

// ★ 웹에 나가는 것은 「공개」 하나뿐이다.
//   worker.js 와 같은 규칙이다 — 목록에만 있고 페이지가 없거나, 그 반대가 되면 안 된다.
//   lv 가 없는 옛 자료는 'com' 으로 본다 (지금까지 나가던 것이 갑자기 사라지면 안 된다).
const openWeb = r => ((r && r.lv) || 'com') === 'com';

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

function write(rel, body){
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ★ 옛 사본 걷어내기.
//   ★ 통째로 지웠다 다시 만들지 않는다 — 만들다 실패하면 사이트가 통째로 빈다.
//     여기서는 만들 것이 없으니 그냥 지우기만 하고, 무엇을 지웠는지 말한다.
function sweep(dir, keep){
  const abs = path.join(OUT, dir);
  if(!fs.existsSync(abs)) return 0;
  let n = 0;
  for(const e of fs.readdirSync(abs, { withFileTypes:true })){
    const rel = path.join(dir, e.name);
    if(keep && keep.indexOf(e.name) >= 0) continue;      // 남길 것 (대문 말판)
    if(e.isDirectory()){
      // ★ 남길 것은 맨 윗자리에만 해당한다.
      //   안 그러면 ja/v/b1/v1/index.html 같은 옛 사본까지 살아남는다 (실제로 그랬다).
      n += sweep(rel, null);
      try{ if(!fs.readdirSync(path.join(OUT, rel)).length) fs.rmdirSync(path.join(OUT, rel)); }catch(_){}
    } else {
      fs.unlinkSync(path.join(OUT, rel)); n++;
    }
  }
  try{ if(!fs.readdirSync(abs).length) fs.rmdirSync(abs); }catch(_){}
  return n;
}

// ══════════════════════════════════════════════════════════════
// 대문(index.html)을 말마다 한 장씩 굽는다  —  /ja/  /en/  /ru/
//
// ★ 왜 필요한가
//   대문은 자바스크립트로 글자만 바꿔 왔다. 주소가 하나뿐이었다.
//   그래서 구글이 보는 것은 「한국어 문서 한 장」 이었고,
//   일본 사람이 구글에서 우리를 찾을 길이 없었다.
//   구글 문서: 각 말판은 자기 자신과 나머지 전부를 hreflang 으로 가리켜야 하고,
//   서로 안 가리키면 무시한다. 그러려면 말마다 주소가 있어야 한다.
//
// ★ 사본이 아니다 — 사전은 index.html 안에 하나뿐이고, 여기서는 그것으로 굽기만 한다.
//   index.html 을 고치면 다음 굽기 때 셋이 따라온다.
//
// ★ 구운 판에서도 자바스크립트는 그대로 돈다. 주소가 /ja/ 면 일본어를 집으므로
//   구운 글자와 다시 그린 글자가 같다 (화면이 깜빡이지 않는다).
function bakeFront(){
  const srcPath = path.join(OUT, 'index.html');
  if(!fs.existsSync(srcPath)) return 0;
  const html = fs.readFileSync(srcPath, 'utf8');

  // 사전을 꺼낸다
  const m = html.match(/var I18N = \{[\s\S]*?\n\};/);
  if(!m){ console.log('※ 대문 사전을 못 찾았습니다 — 대문은 안 굽습니다'); return 0; }
  let I18N;
  try{ I18N = new Function(m[0] + '\nreturn I18N;')(); }
  catch(e){ console.log('※ 대문 사전을 못 읽었습니다:', e.message); return 0; }

  let made = 0;
  for(const L of LANGS){
    if(L === 'ko') continue;                 // 한국어는 뿌리(index.html) 그대로다
    const d = I18N[L];
    if(!d){ console.log('※ 대문에 ' + L + ' 사전이 없습니다 — 건너뜁니다'); continue; }
    let out = html;

    // 글자를 미리 채운다 — data-t 자리는 원래 비어 있다
    out = out.replace(/(data-t="([^"]+)"[^>]*>)(<\/)/g,
      (all, open, key, close) => (d[key] === undefined ? all : open + d[key] + close));

    // 머리
    out = out.replace('<html lang="ko">', '<html lang="' + L + '">');
    out = out.replace(/<title>[\s\S]*?<\/title>/, '<title>' + esc(d.title) + '</title>');
    out = out.replace(/(<meta name="description" content=")[^"]*(">)/, '$1' + esc(d.desc) + '$2');
    out = out.replace(/(<meta property="og:title" content=")[^"]*(">)/, '$1' + esc(d.title) + '$2');
    out = out.replace(/(<meta property="og:description" content=")[^"]*(">)/, '$1' + esc(d.desc) + '$2');
    out = out.replace(/(<meta property="og:url" content=")[^"]*(">)/, '$1' + SITE + '/' + L + '/$2');
    out = out.replace(/(<link rel="canonical" href=")[^"]*(">)/, '$1' + SITE + '/' + L + '/$2');

    // 말 고르는 줄 — 지금 판을 눌린 것으로
    out = out.replace(/(<button type="button" data-lang=")([a-z]{2})(" aria-pressed=")(?:true|false)(")/g,
      (all, a, v, b2, c) => a + v + b2 + (v === L ? 'true' : 'false') + c);

    // 약관은 말마다 파일이 따로다 (bakeLegal 이 넷 다 굽는다).
    //   ★ 자바스크립트도 같은 규칙을 쓴다 (index.html). 두 곳이 어긋나면 안 된다.
    const dl = L;
    out = out.replace(/(<a href=")([a-z]+)(\.html"[^>]*data-doc=)/g, (all, a, name, b2) =>
      a + '/' + name + (dl === 'ko' ? '' : '.' + dl) + '.html"' + b2.slice(b2.indexOf(' ')));

    write(L + '/index.html', out);
    made++;
  }
  return made;
}

// ══════════════════════════════════════════════════════════════
// 약관·개인정보·위치정보를 **앱에서 구워 낸다**  (4.96)
//
// ★ 왜 필요한가
//   웹의 terms.html 은 판 1.2 인데 앱 안의 약관은 1.6 이었다. 사본이 둘이라 어긋난 것이다.
//   법 문서가 두 곳에서 서로 다른 말을 하고 있었다 — 제일 나쁜 종류의 어긋남이다.
//   ★ 이제 정본은 앱(app/index.html)의 LEGAL_DOCS 하나뿐이고, 여기서는 굽기만 한다.
//     앱을 고치면 다음 굽기 때 웹이 따라온다. 손으로 맞출 일이 없어진다.
const LEGAL_KEYS  = ['terms', 'privacy', 'location'];
const LEGAL_HEAD  = {           // 「판 …부터 적용 …」 줄. 말마다 적는 법이 다르다.
  ko: (v, d) => `판 ${v}부터 적용 ${d}`,
  en: (v, d) => `Version ${v}, in effect from ${d}`,
  ru: (v, d) => `Версия ${v}, действует с ${d}`,
  ja: (v, d) => `版 ${v}・${d} から適用`
};
const LEGAL_FOOT = {
  ko: '뱃일 — 배 타는 사람들을 위한 앱',
  en: 'Baetnil — an app for people who go out on the water',
  ru: 'Baetnil — приложение для тех, кто выходит в море',
  ja: '뱃일 — 船に乗る人たちのアプリ'
};
const LEGAL_OPEN = { ko:'앱 열기', en:'Open the app', ru:'Открыть приложение', ja:'アプリを開く' };
const LEGAL_ASK  = { ko:'문의', en:'Contact', ru:'Связаться', ja:'お問い合わせ' };
const legalFile = (k, L) => k + (L === 'ko' ? '' : '.' + L) + '.html';

const LEGAL_CSS = `
  :root{--bg:#081521;--sf:#0E1D2B;--bd:#1B2E3E;--tx:#D6E2EC;--th:#F1F7FC;--tm:#8AA0B4;--ac:#9CC6E8}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--tx);
    font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Hiragino Sans","Pretendard","Malgun Gothic",sans-serif;
    line-height:1.75;font-size:15px;-webkit-text-size-adjust:100%}
  .wrap{max-width:760px;margin:0 auto;padding:28px 20px 80px}
  header{border-bottom:1px solid var(--bd);padding-bottom:16px;margin-bottom:22px}
  .app{font-size:13px;letter-spacing:.14em;color:var(--tm);font-weight:700}
  h1{font-size:23px;margin:8px 0 6px;color:var(--th);letter-spacing:-.02em}
  .meta{font-size:13px;color:var(--tm)}
  nav{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0}
  nav a{display:inline-block;padding:7px 13px;border:1px solid var(--bd);border-radius:999px;
    color:var(--tx);text-decoration:none;font-size:13px;font-weight:600;background:var(--sf)}
  nav a[aria-current]{background:var(--ac);border-color:var(--ac);color:#08131F}
  pre{white-space:pre-wrap;word-break:break-word;font:inherit;margin:0}
  footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--bd);font-size:13px;color:var(--tm)}
  footer a{color:var(--ac)}
  @media(prefers-color-scheme:light){
    body{background:#fff;color:#1a2632}
    :root{--sf:#f2f6fa;--bd:#d6e0ea;--th:#0d1a26;--tm:#5b7085;--ac:#1d6ea8}
    nav a[aria-current]{color:#fff}
  }`;

function bakeLegal(){
  const appPath = path.join(OUT, 'app', 'index.html');
  if(!fs.existsSync(appPath)){ console.log('※ app/index.html 이 없어 약관은 안 굽습니다'); return 0; }
  const src = fs.readFileSync(appPath, 'utf8');
  const pick = re => (src.match(re) || [''])[0];
  const grab = name => {
    const i = src.indexOf('function ' + name + '(');
    if(i < 0) return '';
    let d = 0, j = src.indexOf('{', i);
    for(; j < src.length; j++){
      if(src[j] === '{') d++;
      else if(src[j] === '}'){ d--; if(!d) return src.slice(i, j + 1); }
    }
    return '';
  };
  let API;
  try{
    API = new Function('langNow',
      [ pick(/const LEGAL_VER  = [^\n]*\n/),
        pick(/const LEGAL_DATES = \{[\s\S]*?\};/),
        pick(/const LEGAL_DATE = [^\n]*\n/),
        pick(/const LEGAL_OWNER = \{[\s\S]*?\n\};/),
        pick(/const LEGAL_BIZ = \{[\s\S]*?\n\};/),
        pick(/const LEGAL_LBS = [^\n]*\n/),
        pick(/const LEGAL_DOCS = \{[\s\S]*?\n\};/),
        pick(/const LEGAL_DOCS_EN = \{[\s\S]*?\n\};/),
        pick(/const LEGAL_DOCS_JA = \{[\s\S]*?\n\};/),
        pick(/const LEGAL_DOCS_RU = \{[\s\S]*?\n\};/),
        grab('legalSet'), grab('legalText'),
        'return { legalText, legalSet, LEGAL_VER, LEGAL_DATES };'
      ].join('\n'))(() => 'ko');
  }catch(e){ console.log('※ 앱에서 약관을 못 읽었습니다:', e.message); return 0; }

  let made = 0;
  for(const L of LANGS){
    for(const k of LEGAL_KEYS){
      let body = '', title = '';
      try{
        body  = API.legalText(k, L);
        title = (API.legalSet(L)[k] || {}).title || '';
      }catch(e){ continue; }
      if(!body || !title) continue;
      const date = API.LEGAL_DATES[L] || API.LEGAL_DATES.ko;
      const head = (LEGAL_HEAD[L] || LEGAL_HEAD.ko)(API.LEGAL_VER, date);
      const navDocs = LEGAL_KEYS.map(kk => {
        const nm = (API.legalSet(L)[kk] || {}).title || kk;
        return `<a href="${legalFile(kk, L)}"${kk === k ? ' aria-current="page"' : ''}>${esc(nm)}</a>`;
      }).join('');
      const navLang = LANGS.filter(x => x !== L).map(x =>
        `<a href="${legalFile(k, x)}" hreflang="${x}">${
          ({ ko:'한국어', en:'English', ru:'Русский', ja:'日本語' })[x]}</a>`).join('');
      const hre = LANGS.map(x =>
        `<link rel="alternate" hreflang="${x}" href="${SITE}/${legalFile(k, x)}">`).join('\n')
        + `\n<link rel="alternate" hreflang="x-default" href="${SITE}/${legalFile(k, 'ko')}">`;
      const html = `<!doctype html>
<html lang="${L}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — 뱃일</title>
<meta name="description" content="${esc(title)} — 뱃일. ${esc(head)}">
<link rel="canonical" href="${SITE}/${legalFile(k, L)}">
${hre}
<style>${LEGAL_CSS}</style>
<div class="wrap">
<header>
  <div class="app">뱃일 · BAETNIL</div>
  <h1>${esc(title)}</h1>
  <div class="meta">${esc(head)}</div>
  <nav>${navDocs}</nav>
  <nav style="margin-top:8px">${navLang}</nav>
</header>
<pre>${esc(body)}</pre>
<footer>
  ${esc(LEGAL_FOOT[L] || LEGAL_FOOT.ko)} · <a href="${SITE}/${L === 'ko' ? '' : L + '/'}">${
    esc(LEGAL_OPEN[L] || LEGAL_OPEN.ko)}</a><br>
  ${esc(LEGAL_ASK[L] || LEGAL_ASK.ko)} <a href="mailto:help@baetnil.com">help@baetnil.com</a>
</footer>
</div>
`;
      write(legalFile(k, L), html);
      made++;
    }
  }
  return made;
}

(async () => {
  const boats = (await readAll()).filter(b => b && !b.adminHidden);

  // ── 사이트맵 — 지금 「공개」 인 것만
  const urls = [];
  const add = u => urls.push(u);
  LANGS.forEach(L => {
    add(`${SITE}/${LPATH[L]}`);                      // 대문
    ['m','v','r'].forEach(d => add(`${SITE}/${LPATH[L]}${d}/`));
    boats.forEach(b => {
      const say = (d, arr, ok) => (b[arr] || []).forEach(r => {
        if(!r || !r.id || !openWeb(r)) return;
        if(ok && !ok(r)) return;
        add(`${SITE}/${LPATH[L]}${d}/${b.id}/${r.id}/`);
      });
      say('m', 'mlog',   r => (r.how || []).length);   // 단계가 없으면 남이 볼 것이 없다
      say('v', 'voyage', null);
      say('r', 'review', null);
    });
  });

  write('sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map(u => `<url><loc>${esc(u)}</loc></url>`).join('\n')
    + `\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  // ── 옛 사본 걷어내기
  //
  // ★ 일감(web.yml)의 마지막 줄이 `git add m v r sitemap.xml robots.txt` 다.
  //   폴더를 통째로 지워 버리면 그 줄이 「pathspec 'm' did not match any files」 로 죽는다.
  //   실제로 build-web #3 이 그렇게 실패했다.
  //   ★ .github 는 내 도구가 못 쓰는 자리라 그 줄을 고칠 수 없다. 그러니 여기서 맞춘다 —
  //     폴더는 남기고 그 안에 표식 파일 하나만 둔다. 페이지는 워커가 만든다.
  let gone = 0;
  ['m','v','r'].forEach(d => { gone += sweep(d); });
  ['m','v','r'].forEach(d => write(d + '/.keep',
    '이 폴더는 비어 있습니다. 기록 페이지는 클라우드플레어 워커가 볼 때 만듭니다.\n'));
  // ★ 전에는 ja/ en/ 을 통째로 걷어냈다. 기록 페이지 사본이 거기 있었기 때문이다.
  //   지금 그 자리에는 **대문의 말판**이 산다. 걷어내면 안 된다.
  //   기록 페이지는 워커가 앞에서 가로채므로 이 폴더 안에 파일로 있으면 안 된다 —
  //   그래서 index.html 만 남기고 나머지는 그대로 걷어낸다.
  const LDIRS = LANGS.filter(L => LPATH[L]).map(L => LPATH[L].replace(/\/$/,''));
  LDIRS.forEach(d => { gone += sweep(d, ['index.html']); });
  const baked = bakeFront();
  const legal = bakeLegal();

  // ★ 지운 것을 git 에 알린다.
  //   일감(web.yml)의 `git add m v r sitemap.xml robots.txt` 에는 ja·en 이 없다.
  //   그 파일은 .github 안에 있어 내가 고칠 수 없는 자리다 —
  //   그래서 「내가 지운 것은 내가 담는다」 로 여기서 끝낸다.
  //   ★ git 이 없거나(내 컴퓨터에서 시험할 때) 담을 것이 없으면 조용히 넘어간다.
  //
  // ★★★ 4.94 — 전에는 「걷어낸 것이 있을 때만(if(gone))」 담았다.
  //   이제 여기서 대문 말판을 **굽기도** 한다. 걷어낼 것이 하나도 없는 날에는
  //   구운 ru/index.html 이 커밋에 안 담겨 영영 안 올라간다.
  //   (일감의 `git add m v r ja en …` 줄에는 ru 가 없다. 그 파일은 내가 못 고치는 자리다.)
  //   그래서 걷어냈든 구웠든 **늘** 담는다.
  //
  // ★★★ 약관은 뿌리에 있는 낱개 파일이다 (terms.ja.html 처럼).
  //   일감의 `git add m v r ja en …` 줄에도, 위의 폴더 목록에도 안 들어간다.
  //   여기 안 적으면 **구워 놓고 영영 안 올라간다.** 대문 말판에서 이미 한 번 겪었다.
  const LEGAL_FILES = [];
  LEGAL_KEYS.forEach(k => LANGS.forEach(L => LEGAL_FILES.push(legalFile(k, L))));
  try{
    const { execFileSync } = require('child_process');
    LDIRS.concat(['m','v','r']).concat(LEGAL_FILES).forEach(d => {
      try{ execFileSync('git', ['add', '-A', '--', d], { cwd: OUT, stdio:'ignore' }); }catch(_){}
    });
  }catch(_){}

  console.log(`구웠습니다: 주소 ${urls.length}개 · 대문 ${baked}장 · 약관 ${legal}장` + (gone ? ` · 옛 사본 ${gone}개 걷어냄` : ''));
})().catch(e => { console.error('★ 실패:', e && e.message || e); process.exit(1); });
