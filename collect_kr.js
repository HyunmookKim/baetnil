// 뱃일 — 한국 해양 소식 + 해상 특보 수집
//
// 옮겨 온 내력: 예전에는 first45 저장소가 이 일을 했다.
// 앱과 자료가 갈라져 있어 한쪽만 고치면 어긋났고, 옛 앱을 지우면 자료도 함께 죽었다.
// 이제 앱 저장소가 스스로 모은다.
//
// 함께 바꾼 것 — 전국으로 넓힘
//  · 뉴스 검색어가 '여수·요트' 하나뿐이라 여수에 기사가 없으면 며칠씩 화면이 그대로였다.
//  · 해상 특보는 남해서부만 걸러 담았다. 부산·인천·제주에 배를 댄 사람에게는 늘 '특보 없음' 이었다.
//    이제 전 구역을 담고, 어느 해역을 볼지는 앱이 배 위치로 고른다.
const Parser = require('rss-parser');
const fs = require('fs');
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9'
};
const strip = s => String(s||'').replace(/<[^>]*>/g,' ').replace(/&[a-z#0-9]+;/gi,' ').replace(/\s+/g,' ').trim();
const gn = q => 'https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=ko&gl=KR&ceid=KR:ko';

// ── 한국 해양 소식: 구글뉴스 RSS (무인증 공개 피드)
// ★ 한 피드가 마르면 화면이 통째로 멈춘다. 성격이 다른 피드를 여러 개 둔다.
//   when:3d — 하루 걸러 봐도 빠뜨리지 않게 사흘치를 본다.
const GOV_FEEDS = [
  { name:'해양정책', url: gn('해양수산부 OR 해양경찰청 (선박 OR 항만 OR 어선 OR 해상 OR 수상레저) when:3d'), quota: 25 },
  { name:'해양안전', url: gn('(해상 OR 해양) (사고 OR 침몰 OR 전복 OR 좌초 OR 충돌 OR 구조 OR 실종) when:3d'), quota: 25 },
  { name:'요트·마리나', url: gn('(요트 OR 마리나 OR 세일링 OR 보트) (계류 OR 대회 OR 면허 OR 조종 OR 개장 OR 산업 OR 항해) when:3d'), quota: 25 },
  { name:'낚시·어선', url: gn('(낚싯배 OR 낚시어선 OR 유어선 OR 어선) (안전 OR 단속 OR 사고 OR 규정 OR 출항) when:3d'), quota: 25 },
];
const GOV_MAX = 14;

async function collectGov(){
  const parser = new Parser({ timeout: 20000, headers: UA });
  const out = [];
  for(const g of GOV_FEEDS){
    try{
      const feed = await parser.parseURL(g.url);
      const rows = (feed.items||[]).map(it=>{
        const d = it.isoDate || it.pubDate;
        const raw = strip(it.title);
        const mm = raw.match(/^(.*) - ([^-]+)$/);
        return { title: mm? mm[1] : raw, press: mm? mm[2] : '', link: it.link||'', source: g.name,
          date: d? new Date(d).toISOString():'' };
      }).filter(x=>x.title && x.date)
        .sort((a,b)=> new Date(b.date)-new Date(a.date))
        .slice(0, g.quota);          // 피드별 할당 — 한쪽이 다 먹는 문제 방지
      out.push(...rows);
      console.log('GOV OK', g.name, (feed.items||[]).length, '→ 할당', rows.length);
    }catch(e){ console.warn('GOV FAIL', g.name, e.message); }
  }
  const seen = new Set();
  return out
    .filter(x=>{ const k=x.title.slice(0,25); if(seen.has(k)) return false; seen.add(k); return true; })
    .sort((a,b)=> new Date(b.date)-new Date(a.date));
}

// AI 선별: 후보 중 배 쓰는 사람에게 의미 있는 것만
async function pickGov(items){
  const key = process.env.ANTHROPIC_API_KEY;
  if(!key || !items.length){ console.warn('AI 선별 생략 — 최신순'); return items.slice(0, GOV_MAX); }
  const payload = items.map((x,i)=>({ i, title:x.title, press:x.press }));
  const prompt = `아래는 한국 해양 관련 뉴스 제목 목록이다.
너는 배를 직접 몰고 정비하는 사람들을 위해 뉴스를 고르는 편집자다.
읽는 사람은 전국에 흩어져 있고, 세일링 요트·모터보트·낚싯배를 모두 포함한다.
특정 지역 사람만 겨냥하지 마라.

최대 ${GOV_MAX}건을 골라 중요한 순서로 정렬해라.
우선: 해상 안전·사고, 수상레저/선박 규정·제도 변경, 항로·항만 운영, 기상·해상 상황,
     낚시어선·유어선 안전과 단속, 마리나·요트 산업, 면허·자격 제도
제외: 수산물 가격·양식·어업 경영, 지역 축제·관광 홍보, 인사·수상(受賞)·행사 개최,
     단순 실적 보도, 정치 공방

각 선정 기사에 cat을 붙여라 — 안전, 규정, 항만, 기상, 지역, 산업, 기타 중 하나.
JSON 배열만 출력. 마크다운 금지.
형식: [{"i":3,"cat":"안전"}]

${JSON.stringify(payload)}`;
  try{
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:1500,
        messages:[{role:'user', content:prompt}] })
    });
    if(!r.ok) throw new Error('API '+r.status);
    const data = await r.json();
    const text = (data.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
    const arr = JSON.parse(text.replace(/```json|```/g,'').trim());
    const picked = [];
    arr.slice(0, GOV_MAX).forEach(a=>{
      const src = items[a.i]; if(!src) return;
      picked.push({ ...src, cat: a.cat||'' });
    });
    if(!picked.length) throw new Error('선별 비어있음');
    console.log('AI 선별', items.length, '→', picked.length, '건');
    return picked;
  }catch(e){ console.warn('AI 선별 실패 — 최신순 대체:', e.message); return items.slice(0, GOV_MAX); }
}

// ── 해상 특보
// ★ 예전에는 여기서 남해서부만 걸러 담았다.
//   그러면 부산·인천·제주 사람에게는 언제나 '특보 없음' 이다 — 조용한 거짓말이다.
//   이제 전 구역을 그대로 담고, 어느 해역이 내 해역인지는 앱이 배 위치로 고른다.

async function fetchText(url, ms){
  const r = await fetch(url, { headers: UA, redirect:'follow',
    signal: AbortSignal.timeout(ms || 20000) });
  if(!r.ok) throw new Error('HTTP '+r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  let t = buf.toString('utf8');
  if(/charset=euc-kr/i.test(t.slice(0,800))){
    try{ t = new TextDecoder('euc-kr').decode(buf); }catch(e){}
  }
  return t;
}

function parseWarnText(body){
  const lines = [...body.matchAll(/(풍랑|태풍|폭풍해일|안개|강풍)\s*(주의보|경보)\s*[:：]?\s*([^o·<>{}\n]{2,90})/g)]
    .map(m=>`${m[1]}${m[2]}: ${strip(m[3])}`);
  return [...new Set(lines)];
}

// ── 기상청 API허브 특보현황 조회 (wrn_now_data.php)
// 실제 응답 형식 (2026-07-31 확인):
//   주석행은 '#'로 시작, 데이터행은 콤마 구분, 끝에 '=' 붙음
//   REG_UP, REG_UP_KO, REG_ID, REG_KO, TM_FC, TM_EF, WRN, LVL, CMD, ED_TM
//   WRN/LVL은 영문코드·숫자가 아니라 한글 (예: 폭염 / 중대경보, 풍랑 / 주의)
function parseHub(txt){
  const rows = [];
  for(const raw of txt.split(/\r?\n/)){
    const line = raw.trim();
    if(!line || line.startsWith('#')) continue;
    const c = line.replace(/=\s*$/,'').split(',').map(s=>s.trim());
    if(c.length < 9) continue;
    const REG_ID = c[2], REG_KO = c[3], TM_EF = c[5], WRN = c[6], LVL = c[7], CMD = c[8];
    if(!WRN || !REG_KO) continue;
    if(CMD === '해제') continue;
    // 해상 구역: 구역코드 S로 시작 또는 구역명에 바다/해상/해역 포함 (앞바다·먼바다)
    const marine = /^S/i.test(REG_ID) || /바다|해상|해역/.test(REG_KO);
    const lvl = LVL === '주의' ? '주의보' : (LVL || '특보');
    rows.push({ kind: WRN + lvl, reg: REG_KO, marine, tmEf: TM_EF });
  }
  return rows;
}

function groupWarn(rows){
  const m = new Map();
  rows.forEach(r=>{
    if(!m.has(r.kind)) m.set(r.kind, []);
    const a = m.get(r.kind);
    if(!a.includes(r.reg)) a.push(r.reg);
  });
  return [...m].map(([k,v])=> k + ': ' + v.join(', '));
}

// fetch 실패 시 진짜 원인은 e.cause 안에 있음 ('fetch failed'는 껍데기 메시지)
function why(e){
  const c = e && e.cause;
  if(!c) return e && e.message || String(e);
  const parts = [e.message];
  if(c.code) parts.push('code=' + c.code);
  if(c.message && c.message !== e.message) parts.push(c.message);
  if(c.errno !== undefined) parts.push('errno=' + c.errno);
  if(Array.isArray(c.errors))
    c.errors.forEach(x => parts.push('· ' + (x.code||'') + ' ' + (x.message||'')));
  return parts.join(' | ');
}

async function collectWxHub(){
  const key = process.env.KMA_HUB_KEY;
  if(!key){ console.log('WX HUB 키 없음 — 건너뜀'); return null; }
  const url = 'https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=f&disp=0&help=1&authKey=' + key;
  let txt = null;
  for(let i = 1; i <= 3; i++){
    try{
      txt = await fetchText(url, 25000);
      if(i > 1) console.log('WX HUB', i, '번째 시도 성공');
      break;
    }catch(e){
      console.warn('WX HUB 시도', i, '실패:', why(e));
      if(i < 3) await new Promise(r=>setTimeout(r, 3000));
    }
  }
  if(txt === null){ console.warn('WX HUB FAIL 3회 모두 실패'); return null; }
  try{
    if(txt.length < 400 && /401|403|Unauthorized|인증|권한/i.test(txt))
      throw new Error('인증/권한 실패 — 활용신청 상태 확인');
    const all = parseHub(txt);
    if(!all.length){
      console.warn('WX HUB 파싱 0건 — 응답 원문 앞부분:');
      console.warn(txt.replace(key,'***').slice(0, 600));
      return null;
    }
    const marine = all.filter(r=>r.marine);
    console.log('WX HUB 성공: 전체', all.length, '· 해상', marine.length, '건 (전 구역 수집)');
    return {
      src: 'KMA',
      // ★ 전 구역. 앱이 배 위치로 골라 쓴다.
      zones: marine.map(r=>({ kind:r.kind, reg:r.reg, tmEf:r.tmEf || '' })),
      // 아래 둘은 옛 앱(3.24 이하) 호환용 — 전국 요약이다.
      active: groupWarn(marine),
      summary: marine.length ? '' : '발효 중인 해상 특보 없음'
    };
  }catch(e){ console.warn('WX HUB FAIL', why(e)); return null; }
}

// 허브가 막히면 긁어 오거나 보도로 대체한다.
// 이 경로들은 구역을 또렷이 못 뽑아서 zones 를 만들지 않는다 — 앱은 그때 전국 줄을 그대로 보여 준다.
async function collectWx(){
  const hub = await collectWxHub();
  if(hub) return hub;
  const KMA = [
    'https://www.weather.go.kr/w/special-report/overall.do',
    'https://www.kma.go.kr/weather/warning/status.jsp',
  ];
  for(const url of KMA){
    try{
      const body = strip(await fetchText(url));
      const lines = parseWarnText(body);
      console.log('WX TRY', url.slice(8,40), '추출', lines.length, '건');
      if(lines.length)
        return { src:'KMA', active: lines.slice(0,8), summary:'' };
      if(/특보.{0,80}(없|해제)/.test(body))
        return { src:'KMA', active: [], summary:'발효 중인 해상 특보 없음' };
    }catch(e){ console.warn('WX FAIL', url, e.message); }
  }
  // 폴백: 구글뉴스 최근 36시간 특보 보도
  try{
    const parser = new Parser({ timeout: 20000, headers: UA });
    const feed = await parser.parseURL(gn('풍랑주의보 OR 풍랑경보 OR 해상특보 OR "강풍·풍랑"'));
    const cutoff = Date.now() - 36*3600e3;
    const items = (feed.items||[])
      .filter(i=>{ const d=i.isoDate||i.pubDate; return d && new Date(d).getTime() > cutoff; })
      .map(i=>strip(i.title).replace(/ - [^-]+$/,''));
    console.log('WX NEWS 폴백', items.length, '건');
    if(items.length)
      return { src:'NEWS', active: items.slice(0,4), summary:'※ 언론 보도 기준 — 기상청 실시간 확인 필수' };
    return { src:'NEWS', active: [], summary:'발효 중인 해상 특보 없음' };
  }catch(e){ console.warn('WX NEWS FAIL', e.message); }
  return { src:'NONE', active: [], summary:'자동 확인 불가 — 아래 기상청 링크로 직접 확인' };
}

(async ()=>{
  const govAll = await collectGov();
  const gov = await pickGov(govAll);
  const wx = await collectWx();
  console.log('한국소식', gov.length, '건 / 특보', wx.src,
    (wx.zones ? wx.zones.length + '구역' : (wx.active||[]).length + '줄'));
  fs.writeFileSync('kr.json', JSON.stringify({ updated:new Date().toISOString(), gov, wx }, null, 1));
  console.log('kr.json 저장 완료');
})().catch(e=>{ console.error(e); process.exit(1); });
