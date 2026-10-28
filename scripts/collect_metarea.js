// 뱃일 5.10 — 러시아 극동·먼 바다 해상경보 (WMO METAREA XI · 일본 기상청 발표 WWJP90)
//
//   사장님: 「날씨관련해서는 자꾸 한국것만 하는거 같은데 일본 러시아꺼는 안하냐?」 (2026-09-22)
//   ★ 러시아 기상청(Приморское УГМС · primgidromet.ru)은 러시아 밖에서 열리지 않는다 (403 「only allowed from Russia」).
//     깃허브 작업도 러시아 밖이라 못 받는다.
//   ★ 대신 국제해사기구·세계기상기구의 GMDSS 체계에서 이 바다(METAREA XI)의 먼 바다 경보는
//     **일본 기상청이 맡아 낸다** (WWJP90 「HIGH SEAS FORECAST JAPAN」). 동해 북부·타타르해협·오호츠크해·
//     캄차카 앞바다까지 들어간다. WMO-IMO WWMIWS 가 그 전문을 그대로 공개한다.
//   ★ 이 전문을 읽어 경보마다 **중심 좌표와 반경(해리)**, **둘러싼 꼭짓점**, **해역 이름**을 뽑아 둔다.
//     앱은 날씨 지점이 그 안에 드는지 본다. 모르는 모양은 버리지 않고 원문 그대로 남긴다.
const fs = require('fs');
const URL = process.env.METAREA_URL || 'https://wwmiws.wmo.int/index.php/metareas/bulletinset/11/html';
// ★★★ 2026-10-27 — 예비 자료처 (사장님: 「실패했을때 백업으로 쓸 수 있는 소스 … 잘 찾아서 넣어라」)
//   10/21 부터 WMO WWMIWS 가 통째로 점검 중이다(「Le site est actuellement en maintenance」).
//   그동안 이 경보가 10/21 것에 멈춰 있었다.
//   ★ 같은 경보의 원본은 일본 기상청 「全般海上警報（定時）（英文）」 = 전문 이름 WWJP27, 하루 4번.
//     (気象庁 配信資料カタログ 「海上警報」: https://www.data.jma.go.jp/suishin/cgi-bin/catalogue/make_product_page.cgi?id=KaijoKei)
//     WWJP90 과 머리말만 다르고 꼴(WARNING AND SUMMARY · WARNING VALID · STORM/GALE WARNING …)이 같다.
//   ★ 그 전문을 미국 기상청(NOAA)이 세계 기상 통신망(GTS)에서 받아 그대로 공개한다 — tgftp 의 raw/ww.
//   ★ WMO 를 먼저 본다. 못 받았을 때만 NOAA 사본을 쓰고, 어디서 받았는지 파일에 적는다(via).
//   ★ 사본이 낡았으면(발표 12시간 넘음) 쓰지 않는다 — 옛 경보를 새것처럼 내면 안 된다.
const BACKUP = process.env.METAREA_BACKUP_URL || 'https://tgftp.nws.noaa.gov/data/raw/ww/wwjp27.rjtd..txt';
const MAX_AGE_H = 12;
const OUT = process.argv[2] || 'warn-metarea11.json';

function textOf(html){
  return html.replace(/<hr[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
             .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
const P = s => {   // "40N" "40.5N" "154E" "154.3E" → 숫자 (S·W 는 음수)
  const m = String(s).match(/^(\d+(?:\.\d+)?)([NSEW])$/); if(!m) return null;
  const v = Number(m[1]); return (m[2] === 'S' || m[2] === 'W') ? -v : v;
};
function coords(str){
  const out = [], re = /(\d+(?:\.\d+)?[NS])\s+(\d+(?:\.\d+)?[EW])/g; let m;
  while((m = re.exec(str))) out.push([P(m[1]), P(m[2])]);
  return out;
}
// 해역 이름 → 대략의 상자 [남, 서, 북, 동]  (JMA 전문에 나오는 이름)
const AREAS = {
  'SEA OF JAPAN':        [34.0, 127.0, 52.0, 142.5],
  'TATARSKIY STRAIT':    [45.5, 138.0, 52.5, 142.5],
  'TATAR STRAIT':        [45.5, 138.0, 52.5, 142.5],
  'SEA OF OKHOTSK':      [43.0, 135.0, 62.0, 163.0],
  'SEA EAST OF KAMCHATKA': [50.0, 158.0, 62.0, 170.0],
  'BERING SEA':          [52.0, 162.0, 66.0, 180.0],
  'YELLOW SEA':          [31.0, 119.0, 41.0, 127.0],
  'EAST CHINA SEA':      [23.0, 117.0, 33.5, 131.0],
  'SEA AROUND HOKKAIDO': [40.5, 138.5, 46.0, 147.0],
};
function parse(t, want){
  want = want || 'WWJP90';
  const i = t.indexOf(want);
  if(i < 0) throw new Error(want + ' 없음');
  let body = t.slice(i);
  const end = body.indexOf('JAPAN METEOROLOGICAL AGENCY.=');
  if(end > 0) body = body.slice(0, end);
  const lines = body.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const head = lines[0];
  const issued = (body.match(/WARNING AND SUMMARY (\d{6})/) || [])[1] || '';
  const valid  = (body.match(/WARNING VALID (\d{6})/) || [])[1] || '';
  // 경보 덩이: 「… WARNING.」 줄에서 시작해 다음 경보나 SUMMARY. 에서 끝난다
  const warns = []; let cur = null;
  for(const L of lines){
    if(/^SUMMARY\.?$/.test(L)){ if(cur) warns.push(cur); cur = null; break; }
    const k = L.match(/^((?:TYPHOON|STORM|GALE|DENSE FOG|NEAR GALE|HIGH SEAS|ICING)?\s*WARNING)\.$/);
    if(k){ if(cur) warns.push(cur); cur = { kind: k[1].trim(), lines: [] }; continue; }
    if(cur) cur.lines.push(L);
  }
  if(cur) warns.push(cur);
  const out = warns.map(w => {
    const text = w.lines.join(' ');
    const r = { kind: w.kind, text };
    // 중심과 반경 — 「AT 54N 137E …」 + 「WITHIN 200 MILES」 (가장 큰 값). 예보 위치는 제 반경을 더한다.
    const at = text.match(/\bAT\s+(\d+(?:\.\d+)?[NS])\s+(\d+(?:\.\d+)?[EW])/);
    const within = [...text.matchAll(/WITHIN\s+(\d+)\s+MILES/g), ...text.matchAll(/OVER \d+ KNOT WINDS (\d+) MILES/g)].map(m => Number(m[1]));
    const R = within.length ? Math.max(...within) : null;
    const circles = [];
    if(at && R != null) circles.push([P(at[1]), P(at[2]), R]);
    for(const m of text.matchAll(/FORECAST POSITION FOR (\d{6})UTC AT\s+(\d+(?:\.\d+)?[NS])\s+(\d+(?:\.\d+)?[EW])\s+WITH(?: UNCERTAINTY OF)?\s+(\d+)\s+MILES/g)){
      circles.push([P(m[2]), P(m[3]), (R || 0) + Number(m[4])]);
    }
    if(circles.length) r.circles = circles;
    const b = text.match(/BOUNDED BY ([\dNSEW.\s]+?)\./);
    if(b){ const pts = coords(b[1]); if(pts.length >= 3) r.poly = pts; }
    const areas = Object.keys(AREAS).filter(n => text.includes(n));
    if(areas.length) r.areas = areas;
    const kt = text.match(/(\d+)\s+TO\s+(\d+)\s+KNOTS/); if(kt) r.kt = [Number(kt[1]), Number(kt[2])];
    return r;
  });
  return { head, issued, valid, warnings: out };
}
// 「DDHHMM」(UTC) → 그 시각. 달이 바뀌는 날(예: 1일에 받은 31일 발표)도 맞게 지난달로 돌린다.
function issuedAt(ddhhmm, now){
  const m = String(ddhhmm || '').match(/^(\d{2})(\d{2})(\d{2})$/); if(!m) return null;
  now = now || new Date();
  let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), +m[1], +m[2], +m[3]));
  if(d.getTime() - now.getTime() > 2 * 86400e3) d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, +m[1], +m[2], +m[3]));
  return d;
}
const UA = { headers: { 'user-agent': 'baetnil-collector (+https://baetnil.com)' } };
async function fromWMO(){
  const r = await fetch(URL, UA);
  if(!r.ok) throw new Error('WMO HTTP ' + r.status);
  return { via: 'wmo', link: URL, from: 'WMO METAREA XI · 일본 기상청(JMA) WWJP90 High Seas Forecast',
           ...parse(textOf(await r.text()), 'WWJP90') };
}
async function fromNOAA(now){
  const r = await fetch(BACKUP, UA);
  if(!r.ok) throw new Error('NOAA HTTP ' + r.status);
  const p = parse(await r.text(), 'WWJP27');
  const at = issuedAt(p.issued, now);
  if(!at) throw new Error('NOAA 사본에 발표 시각이 없음');
  const age = ((now || new Date()) - at) / 3600e3;
  if(age > MAX_AGE_H) throw new Error('NOAA 사본이 낡음 (' + age.toFixed(1) + '시간 전 발표)');
  return { via: 'noaa', link: BACKUP, from: '일본 기상청(JMA) 全般海上警報 영문 WWJP27 · 미국 NOAA 사본(GTS)', ...p };
}
if(require.main === module){
  (async () => {
    let p, why = '';
    try{ p = await fromWMO(); }
    catch(e){
      why = String(e && e.message || e);
      console.error('WMO 못 받음 — ' + why + ' → NOAA 사본(WWJP27)으로');
      p = await fromNOAA();          // 이것도 못 받으면 던진다 → 실패(옛 파일은 그대로 둔다)
    }
    const data = { ok: true, read: new Date().toISOString(), areas: AREAS, ...p };
    if(why) data.wmoFail = why;
    fs.writeFileSync(OUT, JSON.stringify(data));
    console.log('[' + p.via + ']', p.head, '경보', p.warnings.length, p.warnings.map(w => w.kind + (w.circles ? ' 원' + w.circles.length : '') + (w.poly ? ' 다각' : '') + (w.areas ? ' ' + w.areas.join('/') : '')).join(' | '));
  })().catch(e => { console.error(e); process.exit(1); });
}
module.exports = { parse, textOf, AREAS, issuedAt, fromWMO, fromNOAA };
