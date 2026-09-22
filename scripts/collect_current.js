// 뱃일 — 조류(유속·유향) 자동 수집 (5.10, 2026-09-22)
// 출처: 해양수산부 국립해양조사원 「조류예보(시계열)」 (공공데이터포털 15156024, 공공누리 제1유형·출처표시)
//   관할해역 조류 예보지점 204곳 · 1시간 간격 · 오늘부터 14일
// ★ 인증키는 깃허브 비밀값 DATA_GO_KR_KEY 로만 받는다. 파일·기록에 남기지 않는다.
// 결과: app/current.json
//   { updated, source, days:[YYYY-MM-DD…], spots:[{ c, n, la, lo, v:{ 'YYYY-MM-DD':[24개 cm/s] }, dir:{ 날짜:[24개 16방위] } }] }
const fs = require('fs');
const path = require('path');

const KEY = process.env.DATA_GO_KR_KEY;
if(!KEY){ console.log('★ 실패: DATA_GO_KR_KEY 가 없습니다'); process.exit(1); }
const BASE = 'https://apis.data.go.kr/1192136/crntFcstTime/GetCrntFcstTimeApiService';
const DAYS = 14;
const CONC = 4;
const OUT = 'current.json';
// 예보지점 204곳 — 오픈API 활용가이드(조류예보 시계열, 2025-12-12 배포)의 「예보지점 목록」 그대로
const CODES = require(path.join(__dirname, 'current_codes.json'));

const sleep = ms => new Promise(r => setTimeout(r, ms));
function ymd(d){ return d.getUTCFullYear() + String(d.getUTCMonth()+1).padStart(2,'0') + String(d.getUTCDate()).padStart(2,'0'); }
function kstToday(){ const n = new Date(Date.now() + 9*3600e3); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); }

async function getDay(code, day){
  const u = `${BASE}?serviceKey=${encodeURIComponent(KEY)}&type=json&obsCode=${encodeURIComponent(code)}&reqDate=${day}&min=60&numOfRows=30&pageNo=1`;
  for(let t = 0; t < 3; t++){
    try{
      const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
      const txt = await r.text();
      let j; try{ j = JSON.parse(txt); }catch(_){ throw new Error('JSON 아님: ' + txt.slice(0, 120)); }
      const code0 = j && j.header && j.header.resultCode;
      if(code0 === '03' || code0 === '3') return [];          // 자료 없음
      if(code0 !== '00' && code0 !== '0') throw new Error('resultCode ' + code0 + ' ' + (j.header && j.header.resultMsg));
      let it = j.body && j.body.items && j.body.items.item;
      if(!it) return [];
      if(!Array.isArray(it)) it = [it];
      return it;
    }catch(e){
      if(t === 2) throw e;
      await sleep(1500 * (t + 1));
    }
  }
}

(async () => {
  const t0 = kstToday();
  const days = [];
  for(let i = 0; i < DAYS; i++){ const d = new Date(t0.getTime() + i*864e5); days.push(ymd(d)); }
  const spots = [];
  let fails = 0, calls = 0;
  let qi = 0;
  async function worker(){
    while(qi < CODES.length){
      const [c, n] = CODES[qi++];
      const s = { c, n, la: null, lo: null, v: {}, dir: {} };
      for(const day of days){
        calls++;
        let it;
        try{ it = await getDay(c, day); }catch(e){ fails++; console.log('못 받음', c, n, day, e.message); continue; }
        const key = day.slice(0,4) + '-' + day.slice(4,6) + '-' + day.slice(6,8);
        const v = new Array(24).fill(null), dr = new Array(24).fill(null);
        for(const x of it){
          if(s.la == null && isFinite(+x.lat)){ s.la = +(+x.lat).toFixed(5); s.lo = +(+x.lot).toFixed(5); }
          const tm = String(x.predcDt || x.obsrvnDt || '');
          const h = parseInt(tm.slice(11, 13), 10);
          if(!(h >= 0 && h < 24)) continue;
          const sp = Number(x.crsp);
          if(isFinite(sp)) v[h] = Math.round(sp * 10) / 10;
          if(x.crdir != null) dr[h] = String(x.crdir);
        }
        if(v.some(x => x != null)){ s.v[key] = v; s.dir[key] = dr; }
        await sleep(120);
      }
      if(s.la != null && Object.keys(s.v).length) spots.push(s);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  spots.sort((a, b) => a.c.localeCompare(b.c));
  console.log(`지점 ${spots.length}/${CODES.length} · 부른 수 ${calls} · 못 받음 ${fails}`);
  // ★ 절반도 못 받았으면 옛 파일을 지키고 멈춘다 — 빈 자료로 덮으면 앱이 「자료 없음」 이 된다
  if(spots.length < CODES.length / 2){ console.log('★ 실패: 받은 지점이 너무 적어 저장하지 않습니다'); process.exit(1); }
  const out = {
    updated: new Date().toISOString(),
    source: '해양수산부 국립해양조사원 조류예보(시계열) · 공공누리 제1유형',
    unit: 'cm/s',
    days: days.map(d => d.slice(0,4) + '-' + d.slice(4,6) + '-' + d.slice(6,8)),
    spots
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('저장', OUT, fs.statSync(OUT).size, 'bytes');
})().catch(e => { console.log('★ 실패:', e.message); process.exit(1); });
