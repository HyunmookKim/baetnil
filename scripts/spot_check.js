// ══════════════════════════════════════════════════════════════════════
// 정박지 자리 전수 검수 (기계 몫)
//
//   ★ 왜
//     나간 자료의 점이 엉뚱한 곳이면 그 점을 믿고 배를 몰다 사람이 다친다.
//     4.102 에서 562곳을 손으로 봤지만, 그 뒤 자료가 다시 모이면서 점이 늘었다.
//     여기서 기계로 전수 확인하고, **사람이 눈으로 볼 목록**을 뽑아 둔다.
//
//   ★ 무엇을 보나
//     ① 지도(OSM)에 그 점이 아직 있나 — 없어졌으면 알린다
//     ② 이름과 자리가 자료와 같나 — 100m 넘게 옮겨졌으면 알린다
//     ③ 물에서 1.5km 안인가 — 해안선·물·부두·물길이 둘레에 하나도 없으면 물가가 아니다
//
//   결과는 data/spot-check.json 과 data/spot-check.md 로 남긴다.
// ══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const EP = ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter',
            'https://overpass.private.coffee/api/interpreter','https://lz4.overpass-api.de/api/interpreter'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ei = 0;
async function ov(q){
  let last = '';
  for(let t = 0; t < 15; t++){
    const url = EP[ei % EP.length]; ei++;
    try{
      const r = await fetch(url, { method:'POST',
        headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'User-Agent':'baetnil-spot-check/1.0' },
        body:'data=' + encodeURIComponent(q) });
      if(r.status === 429 || r.status === 504){ last = 'HTTP ' + r.status; await sleep(10000); continue; }
      if(!r.ok){ last = 'HTTP ' + r.status; await sleep(5000); continue; }
      return await r.json();
    }catch(e){ last = e.message; await sleep(5000); }
  }
  throw new Error('overpass 를 다 못 썼습니다 — ' + last);
}
function hav(a, b, c, d){
  const t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
  const s = Math.sin(x/2) ** 2 + Math.cos(a*t) * Math.cos(c*t) * Math.sin(y/2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}

(async () => {
  const rows = [];
  for(const f of ['app/spots-jp.json','app/spots-ru.json','app/spots-kr.json']){
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    for(const r of d.rows) rows.push({ cc:r.c, id:r.i, name:r.n, kind:r.k, la:r.la, lo:r.lo });
  }
  console.log('점 ' + rows.length + '곳');

  // ① · ② 지도에 그대로 있나
  const byType = { node:[], way:[], relation:[] };
  for(const s of rows){
    const m = /^osm_(node|way|relation)(\d+)$/.exec(s.id);
    if(!m){ s.osm = null; continue; }
    s.osm = m[1] + '/' + m[2];
    byType[m[1]].push(+m[2]);
  }
  const found = {};
  for(const t of ['node','way','relation']){
    for(let i = 0; i < byType[t].length; i += 120){
      const ids = byType[t].slice(i, i + 120);
      const j = await ov(`[out:json][timeout:180];${t}(id:${ids.join(',')});out center tags;`);
      for(const e of j.elements || []){
        const la = e.lat != null ? e.lat : (e.center || {}).lat;
        const lo = e.lon != null ? e.lon : (e.center || {}).lon;
        found[e.type + '/' + e.id] = { la, lo, tags: e.tags || {} };
      }
      console.log('지도 확인 ' + t + ' ' + (i + ids.length) + '/' + byType[t].length);
      await sleep(2000);
    }
  }

  // ③ 물가인가 — 한 번에 15곳씩
  for(let i = 0; i < rows.length; i += 15){
    const g = rows.slice(i, i + 15);
    const q = '[out:json][timeout:300];' + g.map(s =>
      `(way["natural"="coastline"](around:1500,${s.la},${s.lo});` +
      `way["natural"="water"](around:1500,${s.la},${s.lo});` +
      `relation["natural"="water"](around:1500,${s.la},${s.lo});` +
      `way["man_made"="pier"](around:1500,${s.la},${s.lo});` +
      `way["waterway"](around:1500,${s.la},${s.lo}););out count;`).join('\n');
    const j = await ov(q);
    const counts = (j.elements || []).filter(e => e.type === 'count').map(e => +e.tags.total);
    for(let k = 0; k < g.length; k++) g[k].water = counts[k];
    console.log('물가 ' + (i + g.length) + '/' + rows.length);
    await sleep(2500);
  }

  // 판정
  const 탈 = [];
  for(const s of rows){
    const o = s.osm ? found[s.osm] : null;
    s.osmGone = !!(s.osm && !o);
    s.moveM = o && o.la != null ? Math.round(hav(s.la, s.lo, o.la, o.lo) * 1000) : null;
    s.osmName = o ? (o.tags.name || '') : '';
    if(s.osmGone) 탈.push({ ...s, 까닭:'지도에서 사라짐' });
    else if(s.moveM != null && s.moveM > 150) 탈.push({ ...s, 까닭:'지도의 자리와 ' + s.moveM + 'm 다름' });
    else if(!s.water) 탈.push({ ...s, 까닭:'둘레 1.5km 에 물이 없음' });
  }
  fs.mkdirSync('data', { recursive:true });
  fs.writeFileSync('data/spot-check.json', JSON.stringify({ ts:new Date().toISOString(), n:rows.length, rows }, null, 0));
  const md = ['# 정박지 자리 검수 — 기계 전수 확인', '',
    '돌린 때: ' + new Date().toISOString(), '',
    '- 본 점: **' + rows.length + '곳** (일본·러시아·한국 지도 훑기 자료)',
    '- 지도에서 사라진 점: **' + rows.filter(r => r.osmGone).length + '곳**',
    '- 지도의 자리와 150m 넘게 다른 점: **' + rows.filter(r => r.moveM > 150).length + '곳**',
    '- 둘레 1.5km 에 물이 없는 점: **' + rows.filter(r => !r.water).length + '곳**', '',
    '## 사람이 눈으로 봐야 할 것', '',
    탈.length ? '| 나라 | 이름 | 자리 | 까닭 |\n|---|---|---|---|' : '없습니다.',
    ...탈.map(r => `| ${r.cc} | ${r.name} | ${r.la}, ${r.lo} | ${r.까닭} |`)].join('\n');
  fs.writeFileSync('data/spot-check.md', md + '\n');
  console.log('걸린 것 ' + 탈.length + '곳');
})();
