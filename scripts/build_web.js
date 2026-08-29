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

const LANGS = ['ko', 'ja', 'en'];
const LPATH = { ko:'', ja:'ja/', en:'en/' };

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
function sweep(dir){
  const abs = path.join(OUT, dir);
  if(!fs.existsSync(abs)) return 0;
  let n = 0;
  for(const e of fs.readdirSync(abs, { withFileTypes:true })){
    const rel = path.join(dir, e.name);
    if(e.isDirectory()){
      n += sweep(rel);
      try{ if(!fs.readdirSync(path.join(OUT, rel)).length) fs.rmdirSync(path.join(OUT, rel)); }catch(_){}
    } else {
      fs.unlinkSync(path.join(OUT, rel)); n++;
    }
  }
  try{ if(!fs.readdirSync(abs).length) fs.rmdirSync(abs); }catch(_){}
  return n;
}

(async () => {
  const boats = (await readAll()).filter(b => b && !b.adminHidden);

  // ── 사이트맵 — 지금 「공개」 인 것만
  const urls = [];
  const add = u => urls.push(u);
  LANGS.forEach(L => {
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
  let gone = 0;
  ['m','v','r'].forEach(d => { gone += sweep(d); });
  const LDIRS = LANGS.filter(L => LPATH[L]).map(L => LPATH[L].replace(/\/$/,''));
  LDIRS.forEach(d => { gone += sweep(d); });

  // ★ 지운 것을 git 에 알린다.
  //   일감(web.yml)의 `git add m v r sitemap.xml robots.txt` 에는 ja·en 이 없다.
  //   그 파일은 .github 안에 있어 내가 고칠 수 없는 자리다 —
  //   그래서 「내가 지운 것은 내가 담는다」 로 여기서 끝낸다.
  //   ★ git 이 없거나(내 컴퓨터에서 시험할 때) 담을 것이 없으면 조용히 넘어간다.
  if(gone){
    try{
      const { execFileSync } = require('child_process');
      LDIRS.forEach(d => {
        try{ execFileSync('git', ['add', '-A', '--', d], { cwd: OUT, stdio:'ignore' }); }catch(_){}
      });
    }catch(_){}
  }

  console.log(`구웠습니다: 주소 ${urls.length}개` + (gone ? ` · 옛 사본 ${gone}개 걷어냄` : ''));
})().catch(e => { console.error('★ 실패:', e && e.message || e); process.exit(1); });
