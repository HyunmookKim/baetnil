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
  return dedupeEvent(out
    .filter(x=>{ const k=x.title.slice(0,25); if(seen.has(k)) return false; seen.add(k); return true; })
    .sort((a,b)=> new Date(b.date)-new Date(a.date)));
}

// ★ 같은 사건, 다른 기사를 하나로 묶는다.
//   피드가 넷이라 큰 사고가 나면 같은 일이 네 군데에 다 걸린다.
//   앞 25자 완전 일치만 보던 옛 방식으로는
//   '여수 해상 어선 전복…' 과 '[속보] 여수 앞바다 어선 전복' 이 다른 것으로 남았다.
//   제목의 낱말이 절반 넘게 겹치면 같은 사건으로 보고 하나만 남긴다.
const STOP = new Set(['속보','단독','종합','오늘','내일','관련','대한','위한','통해','밝혀',
                      '했다','한다','있다','없다','되다','기사','뉴스','사진','영상']);
function wordsOf(t){
  return new Set(String(t||'')
    .replace(/\[[^\]]*\]/g, ' ')            // [속보] 같은 머리표 제거
    .replace(/[^가-힣0-9a-zA-Z]+/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/(에서|으로|에게|까지|부터|이나|라도|마다|보다|처럼|한다|했다|된다|되다)$/, ''))
    .filter(w => w.length >= 2 && !STOP.has(w)));
}
function overlap(a, b){
  if(!a.size || !b.size) return 0;
  let n = 0;
  for(const w of a) if(b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}
// ★ 낱말만으로는 부족하다.
//   한국어는 붙여 쓰는 말이 많아 '수상레저기구' 와 '수상레저' 가 다른 낱말이 된다.
//   두 글자씩 겹쳐 자르면 이런 것도 걸린다.
function gramsOf(t){
  const c = String(t||'').replace(/\[[^\]]*\]/g,'').replace(/[^가-힣0-9a-zA-Z]/g,'');
  const g = new Set();
  for(let i = 0; i + 2 <= c.length; i++) g.add(c.slice(i, i + 2));
  return g;
}
function sameEvent(a, b){
  // 둘 중 하나만 걸려도 같은 사건으로 본다
  return overlap(a.w, b.w) >= 0.5 || overlap(a.g, b.g) >= 0.45;
}
function dedupeEvent(rows){
  const kept = [];
  for(const r of rows){
    const key = { w: wordsOf(r.title), g: gramsOf(r.title) };
    const dup = kept.find(k => sameEvent(key, k._k));
    if(dup){
      // 제목이 더 긴 쪽이 대개 더 자세하다 — 그쪽을 남긴다
      if(String(r.title).length > String(dup.title).length){
        dup.title = r.title; dup.link = r.link; dup.press = r.press;
        dup._k = key;                       // ★ 열쇠도 같이 갈아야 다음 것과 제대로 견준다
      }
      continue;
    }
    kept.push(Object.assign({ _k:key }, r));
  }
  return kept.map(x=>{ const y = Object.assign({}, x); delete y._k; return y; });
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

★ 같은 사건은 한 건만 골라라.
   여러 언론사가 같은 사고·같은 발표를 따로 쓴다. 제목이 달라도 같은 일이면 하나만 남겨라.
   남길 때는 가장 자세하고 사실이 많이 담긴 것을 골라라.
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

// ★★★ 2026-09-04 — **글자가 깨져서 특보를 못 알아본 일이 있었다** (사장님 지적)
//
//   사장님: 「야 특보 있는데 왜 없다고 하냐」
//
//   그날 기상청에는 **풍랑경보(남해서부동쪽먼바다)** 와 **강풍주의보(전남 여수)** 가 떠 있었다.
//   그런데 앱은 「전남 해역은 특보 없음 · 다른 해역 22구역 발효 중」 이라고 했다.
//   자료를 열어 보니 구역 이름이 「남해서부동쪽먼바다」 가 아니라 「���ؼ��ε��ʸչٴ�」 였다.
//
//   ★ 왜 — 기상청 API허브는 **EUC-KR** 로 준다. 그런데 여기서 EUC-KR 인지 가리는 잣대가
//     「본문 앞 800자에 charset=euc-kr 이 있나」 하나뿐이었다. 그건 **HTML** 에나 있는 말이고,
//     API허브 응답은 `#` 로 시작하는 **그냥 글 파일**이라 그 말이 없다. 그래서 UTF-8 로 읽었고,
//     한글이 전부 깨진 채로 자료에 실렸다. 앱은 그 글자를 「내 해역」 과 맞춰 볼 수 없었다.
//
//   ★ **이건 조용한 거짓말이라 제일 나쁜 갈래다.** 경보가 떠 있는데 「없음」 이라고 했다.
//     그 말을 믿고 나가면 사람이 다친다.
//
//   ★ 그래서 잣대를 셋으로 늘린다 —
//     ① 서버가 알려 준 Content-Type ② HTML 의 charset ③ **읽어 보고 깨졌으면 다시 읽는다**
//     ③번이 핵심이다. 앞의 둘은 서버가 안 알려 주면 소용이 없다.
function 깨진수(t){ let n = 0; for(const c of String(t)) if(c === '\uFFFD') n++; return n; }
function 한글수(t){ return (String(t).match(/[가-힣]/g) || []).length; }
// ★★★ 2026-09-04 — **어떻게든 읽어 낸다** (사장님: 「어떻게든 싣게 만들어야지」)
//
//   기상청 API허브는 EUC-KR 로 주는데 charset 을 안 알려 준다. 전에는 그걸 UTF-8 로 읽어
//   한글이 통째로 깨진 채 자료에 실렸고, 앱은 「특보 없음」 이라고 했다.
//   ★ 처음 고칠 때 나는 「깨졌으면 안 싣는다」 로 막았다. 그건 포기다 —
//     그러면 특보가 떠 있는 날 화면이 비어 버린다. **읽어 내는 것이 일이다.**
//
// ★ 그래서 **글자표를 하나씩 다 대 본다.** 한국 사이트가 쓰는 것은 사실상 이 넷뿐이다.
//   한글이 제일 많이 나오고 깨진 글자가 없는 쪽을 고른다. 사람이 눈으로 고르는 것과 같다.
const 글자표들 = ['utf-8', 'euc-kr', 'cp949', 'windows-949', 'iso-8859-1'];
function 제일잘읽힌것(buf, 힌트){
  const 잰것 = [];
  for(const enc of (힌트 ? [힌트].concat(글자표들) : 글자표들)){
    let t = null;
    try{ t = new TextDecoder(enc).decode(buf); }catch(_){ continue; }
    잰것.push({ enc, t, 깨짐: 깨진수(t), 한글: 한글수(t) });
  }
  if(!잰것.length) return { enc:'utf-8', t: buf.toString('utf8') };
  // ① 깨진 글자가 없는 것 ② 그중 한글이 제일 많은 것
  잰것.sort((a, b) => (a.깨짐 - b.깨짐) || (b.한글 - a.한글));
  return 잰것[0];
}
async function fetchText(url, ms){
  const r = await fetch(url, { headers: UA, redirect:'follow',
    signal: AbortSignal.timeout(ms || 20000) });
  if(!r.ok) throw new Error('HTTP '+r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  // 서버가 알려 준 것이 있으면 그것부터 대 본다 (없어도 상관없다 — 어차피 다 대 본다)
  const ct = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
  const 미리 = buf.toString('latin1').slice(0, 800);
  let 힌트 = '';
  const m = /charset=["']?([\w-]+)/i.exec(ct) || /charset=["']?([\w-]+)/i.exec(미리);
  if(m) 힌트 = m[1].toLowerCase();
  const 고른것 = 제일잘읽힌것(buf, 힌트);
  if(고른것.enc !== 'utf-8')
    console.log('   글자표 — ' + 고른것.enc + ' 로 읽었습니다 (한글 ' + (고른것.한글 || 0) + '자)');
  return 고른것.t;
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
    let all = parseHub(txt);
    // ★★★ 글자가 깨졌으면 **바이트로 되돌려 다시 읽는다** (2026-09-04, 사장님 지적)
    //   사장님: 「야 장난하냐? 어떻게든 싣게 만들어야지」 — 맞다. 안 싣는 것은 포기다.
    //   여기까지 왔다는 것은 글자표 고르기가 어쩌다 빗나갔다는 뜻이다. 한 번 더 대 본다.
    const 깨진줄 = r => /\uFFFD/.test(r.reg + r.kind) || !/[가-힣]/.test(r.reg);
    if(all.some(깨진줄)){
      console.warn('WX HUB 글자가 깨졌습니다 — 다시 읽어 봅니다.');
      const buf2 = Buffer.from(txt, 'latin1');           // 읽은 것을 바이트로 되돌린다
      for(const enc of ['euc-kr', 'cp949', 'windows-949']){
        let t2 = null;
        try{ t2 = new TextDecoder(enc).decode(buf2); }catch(_){ continue; }
        const 다시 = parseHub(t2);
        if(다시.length && !다시.some(깨진줄)){
          console.log('   ' + enc + ' 로 되읽어 살렸습니다 — ' + 다시.length + '건');
          all = 다시; txt = t2;
          break;
        }
      }
    }
    // 그래도 안 되면 **깨진 줄만 버리고 성한 줄은 싣는다.** 하나도 못 싣는 것보다 낫다.
    if(all.some(깨진줄)){
      const 성한 = all.filter(r => !깨진줄(r));
      console.warn('WX HUB 되읽기 실패 — 성한 줄 ' + 성한.length + '/' + all.length + '건만 싣습니다.');
      all = 성한;
    }
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
      // ★★★ 2026-09-04 — **육상 특보도 담는다** (사장님 지적)
      //   그날 기상청에는 「강풍주의보 : 전라남도(여수, 거문도·초도, 고흥…)」 가 떠 있었다.
      //   배는 마리나에 매여 있어도 강풍을 맞는다. 계류줄·펜더·비미니는 육상 특보로 챙긴다.
      //   ★ 해상과 섞지 않는다. 앱에서 줄을 나눠 보여 준다 — 둘은 뜻이 다르다.
      land: all.filter(r => !r.marine).map(r=>({ kind:r.kind, reg:r.reg, tmEf:r.tmEf || '' })),
      // 아래 둘은 옛 앱(3.24 이하) 호환용 — 전국 요약이다.
      active: groupWarn(marine),
      summary: marine.length ? '' : '발효 중인 해상 특보 없음'
    };
  }catch(e){ console.warn('WX HUB FAIL', why(e)); return null; }
}

// ★★★ 2026-09-04 — 긁어 온 것에서도 **구역을 뽑아낸다** (사장님: 「어떻게든 싣게 만들어야지」)
//
//   전에는 허브가 막히면 「풍랑주의보: 남해동부안쪽먼바다, 남해동부바깥먼바다 …」 라는
//   **한 줄 글**만 실었다. 그러면 앱이 「내 해역」 을 못 가려 전국 특보를 그대로 보여 준다.
//   여수에 댄 배에 동해 특보가 섞여 나오면 사람이 그걸 제 해역으로 읽는다.
//   ★ 그 줄에 구역 이름이 이미 다 들어 있다. 쉼표로 갈라 담으면 된다. 안 할 까닭이 없었다.
function zonesFromLines(lines){
  const 바다 = /바다|해상|해역|앞바다|먼바다/;
  const out = [];
  (lines || []).forEach(줄 => {
    const m = /^(.+?)\s*[:：]\s*(.+)$/.exec(String(줄));
    if(!m) return;
    const kind = m[1].trim();
    m[2].split(/\s*[,，·]\s*/).forEach(reg => {
      const r = reg.replace(/\s+/g, ' ').trim();
      // 「전라남도(여수」 처럼 괄호가 열린 채 잘린 것은 괄호 안쪽만 쓴다
      const 안 = /\(([^)]*)$/.exec(r);
      const 이름 = (안 ? 안[1] : r).replace(/[()]/g, '').trim();
      if(!이름 || !/[가-힣]/.test(이름)) return;
      if(out.some(z => z.kind === kind && z.reg === 이름)) return;
      out.push({ kind, reg: 이름, marine: 바다.test(이름), tmEf: '' });
    });
  });
  return out;
}

// 허브가 막히면 긁어 오거나 보도로 대체한다.
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
      if(lines.length){
        // ★ 줄에서 구역을 뽑아 담는다 — 그래야 앱이 「내 해역」 을 가릴 수 있다
        const z = zonesFromLines(lines);
        const marine = z.filter(x => x.marine);
        console.log('   구역으로 갈라 담았습니다 — 해상', marine.length, '· 육상', z.length - marine.length);
        return { src:'KMA', active: lines.slice(0,8), summary:'',
                 zones: marine.map(x=>({ kind:x.kind, reg:x.reg, tmEf:'' })),
                 land:  z.filter(x=>!x.marine).map(x=>({ kind:x.kind, reg:x.reg, tmEf:'' })) };
      }
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

// ★ 이레치를 쌓아 둔다
//   전에는 돌 때마다 통째로 덮어써서 어제 소식이 그냥 사라졌다.
//   배 타는 사람은 며칠씩 바다에 있다. 사흘 만에 들어왔는데 오늘 것만 있으면
//   그 사흘은 통째로 못 본다.
//   이레가 지난 것은 버린다 — 안 그러면 파일이 끝없이 커진다.
const KEEP_DAYS = 7;
const dayOf = r => String(r && r.date || '').slice(0, 10);
function mergeDays(oldRows, newRows){
  const cut = Date.now() - KEEP_DAYS * 864e5;
  const byLink = new Map();
  // 새 것을 먼저 담는다 — 같은 기사면 이번에 받은 쪽이 이긴다
  for(const r of [...(newRows||[]), ...(oldRows||[])]){
    if(!r || !r.link) continue;
    const t = new Date(r.date || 0).getTime();
    if(!isFinite(t) || t < cut) continue;
    if(!byLink.has(r.link)) byLink.set(r.link, r);
  }
  // ★ 같은 사건 묶기는 '같은 날 안에서만' 한다.
  //   날을 넘어 묶으면 어제 목록이 오늘 바뀌어 버린다.
  const byDay = new Map();
  for(const r of byLink.values()){
    const d = dayOf(r);
    if(!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(r);
  }
  const out = [];
  for(const d of [...byDay.keys()].sort().reverse()){
    out.push(...dedupeEvent(byDay.get(d).sort((a,b)=> new Date(b.date)-new Date(a.date))));
  }
  return out;
}

(async ()=>{
  const govAll = await collectGov();
  const govNew = await pickGov(govAll);
  const wx = await collectWx();
  // 지난번에 모아 둔 것을 읽어 함께 담는다 (없으면 이번 것만)
  let prev = null;
  try{ prev = JSON.parse(fs.readFileSync('kr.json', 'utf8')); }catch(_){}
  const gov = mergeDays((prev && prev.gov) || [], govNew);
  const days = new Set(gov.map(dayOf)).size;
  console.log('한국소식 이번', govNew.length, '건 / 쌓인 것', gov.length, '건 (', days, '일치 )',
    '/ 특보', wx.src, (wx.zones ? wx.zones.length + '구역' : (wx.active||[]).length + '줄'));
  fs.writeFileSync('kr.json', JSON.stringify({ updated:new Date().toISOString(), gov, wx }, null, 1));
  console.log('kr.json 저장 완료');
})().catch(e=>{ console.error(e); process.exit(1); });
