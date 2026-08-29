// 뱃일 — 일본 물때(만조·간조) 자동 수집 (STEP 8)
//
// ★ 왜 필요한가
//   물때는 이 앱을 여는 큰 까닭 하나다. 그런데 지금 tide.json 은 한국 것뿐이다
//   (바다타임 · 원자료 국립해양조사원). 일본에서 앱을 켜면 물때 칸이 통째로 빈다.
//
// ★ 출처 — 気象庁(일본 기상청) 潮位表 텍스트판
//   https://www.data.jma.go.jp/kaiyou/db/tide/suisan/suisan.php
//   기상청 자료는 政府標準利用規約(제2.0판)을 따른다 — 출처를 밝히면 상업 이용이 된다.
//   ★ 그래서 만들어진 파일에 출처를 박고, 앱 화면에도 나오게 한다.
//
// ★ 자료 생김새 (한 줄 136칸 고정폭 — 気象庁 readme 대로다)
//     1~72  : 매시 조위 24개 (3칸씩, 0시~23시, cm)
//    73~78  : 연월일 (2칸씩. "26 1 1" = 2026-01-01)
//    79~80  : 지점 기호
//    81~108 : 만조 4개 (시각 4칸 + 조위 3칸). 시·분이 각각 2칸이라 "16 4" 는 16:04 다
//   109~136 : 간조 4개 (같은 모양)
//   예측이 없으면 시각 9999 · 조위 999 다. 그건 버린다.
//
// ★ 지어내지 않는다
//   받아오지 못한 지점은 그냥 빼고 몇 건인지 말한다. 물때를 지어내면 배가 바닥에 닿는다.
const fs = require('fs');

const BASE = process.env.JMA_TIDE_BASE
          || 'https://www.data.jma.go.jp/kaiyou/data/db/tide/suisan/txt';
const OUT  = 'tide-jp.json';
const GAP_MS = 300;
const DAYS = 15;          // 한국 것과 같게 — 오늘부터 보름
const SRC = '기상청(気象庁) 潮位表 · 政府標準利用規約';

// ── 지점 (気象庁 「潮位表掲載地点一覧表」 에서 옮겨 적었다)
//   https://ds.data.jma.go.jp/kaiyou/db/tide/suisan/station2026.php
//   ★ 좌표를 잘못 옮겨 적으면 엉뚱한 항의 물때를 보여 준다. 그래서 아래 SANITY 로 다시 잰다.
const ST = [
  ['WN','稚内',45.400,141.683], ['KE','枝幸',44.933,142.583], ['A0','紋別',44.350,143.367],
  ['AS','網走',44.017,144.283], ['A6','羅臼',44.017,145.200], ['NM','根室',43.350,145.583],
  ['HN','花咲',43.283,145.567], ['KP','霧多布',43.083,145.117], ['KR','釧路',42.983,144.367],
  ['B1','十勝',42.300,143.317], ['A9','浦河',42.167,142.767], ['C8','苫小牧東',42.600,141.817],
  ['TM','苫小牧西',42.633,141.617], ['SO','白老',42.517,141.317], ['A8','室蘭',42.350,140.950],
  ['A3','森',42.117,140.600], ['HK','函館',41.783,140.717], ['Q0','吉岡',41.450,140.233],
  ['A5','松前',41.417,140.100], ['ES','江差',41.867,140.133], ['ZP','奥尻',42.083,139.483],
  ['OR','奥尻港',42.167,139.517], ['SE','瀬棚',42.450,139.850], ['B6','寿都',42.800,140.233],
  ['B5','岩内',42.983,140.500], ['Z8','忍路',43.217,140.867], ['B3','小樽',43.200,141.000],
  ['IK','石狩新港',43.217,141.300], ['B2','留萌',43.950,141.633], ['F3','沓形',45.183,141.133],
  ['Q1','竜飛',41.250,140.383], ['AO','青森',40.833,140.767], ['ZA','浅虫',40.900,140.867],
  ['Q2','大湊',41.250,141.150], ['B4','大間',41.533,140.900], ['SH','下北',41.367,141.233],
  ['XS','むつ小川原',40.933,141.383], ['HG','八戸港',40.533,141.550], ['XT','久慈',40.200,141.800],
  ['MY','宮古',39.650,141.983], ['Q6','釜石',39.267,141.883], ['OF','大船渡',39.017,141.750],
  ['AY','鮎川',38.300,141.500], ['E6','石巻',38.400,141.267], ['SG','塩釜',38.317,141.033],
  ['SD','仙台新港',38.267,141.000], ['ZM','相馬',37.833,140.967], ['ON','小名浜',36.933,140.900],
  ['D1','日立',36.500,140.633], ['D3','大洗',36.300,140.567], ['D2','鹿島',35.933,140.700],
  ['CS','銚子漁港',35.750,140.867], ['ZF','勝浦',35.133,140.250], ['MR','布良',34.917,139.833],
  ['TT','館山',34.983,139.850], ['KZ','木更津',35.367,139.917], ['QL','千葉',35.567,140.050],
  ['CB','千葉港',35.600,140.100], ['TK','東京',35.650,139.767], ['KW','川崎',35.517,139.750],
  ['YK','京浜港',35.467,139.633], ['QS','横浜',35.450,139.650], ['HM','本牧',35.433,139.667],
  ['QN','横須賀',35.283,139.650], ['Z1','油壺',35.167,139.617], ['OK','岡田',34.783,139.383],
  ['QO','神津島',34.217,139.133], ['MJ','三宅島(坪田)',34.050,139.550], ['QP','三宅島(阿古)',34.067,139.483],
  ['D4','八丈島(八重根)',33.100,139.767], ['QQ','八丈島(神湊)',33.133,139.800],
  ['CC','父島',27.100,142.200], ['MC','南鳥島',24.283,153.983],
  ['D8','湘南港',35.300,139.483], ['OD','小田原',35.233,139.150], ['Z3','伊東',34.900,139.133],
  ['D6','下田',34.683,138.967], ['QK','南伊豆',34.633,138.883], ['G9','石廊崎',34.617,138.850],
  ['Z4','田子',34.800,138.767], ['UC','内浦',35.017,138.883], ['SM','清水港',35.017,138.517],
  ['Z5','焼津',34.867,138.333], ['OM','御前崎',34.617,138.217], ['MI','舞阪',34.683,137.617],
  ['I4','赤羽根',34.600,137.183], ['G4','三河',34.733,137.317], ['G5','形原',34.783,137.183],
  ['G8','衣浦',34.883,136.950], ['ZD','鬼崎',34.900,136.817], ['NG','名古屋',35.083,136.883],
  ['G3','四日市港',34.967,136.633], ['TB','鳥羽',34.483,136.817], ['OW','尾鷲',34.083,136.200],
  ['KN','熊野',33.933,136.167], ['UR','浦神',33.567,135.900], ['KS','串本',33.483,135.767],
  ['SR','白浜',33.683,135.383], ['GB','御坊',33.850,135.167], ['H1','下津',34.117,135.133],
  ['Z9','海南',34.150,135.200], ['WY','和歌山',34.217,135.150], ['TN','淡輪',34.333,135.183],
  ['KK','関空島',34.433,135.200], ['J2','岸和田',34.467,135.367], ['IO','泉大津',34.517,135.400],
  ['SI','堺',34.600,135.467], ['OS','大阪',34.650,135.433], ['AM','尼崎',34.700,135.400],
  ['J5','西宮',34.717,135.333], ['KB','神戸',34.683,135.183], ['AK','明石',34.650,134.983],
  ['ST','洲本',34.350,134.900], ['EI','江井',34.467,134.833], ['K1','姫路(飾磨)',34.783,134.667],
  ['SB','三蟠',34.600,133.983], ['UN','宇野',34.483,133.950], ['MM','水島',34.533,133.733],
  ['LG','乙島',34.500,133.683], ['IZ','糸崎',34.400,133.083], ['TH','竹原',34.333,132.917],
  ['Q9','呉',34.233,132.550], ['Q8','広島',34.350,132.467], ['QA','徳山',34.033,131.800],
  ['J9','三田尻',34.033,131.583], ['WH','宇部',33.933,131.250], ['CF','長府',34.017,131.000],
  ['A1','弟子待',33.933,130.933], ['TI','田ノ首',33.917,130.917], ['OH','大山の鼻',33.917,130.900],
  ['HR','南風泊',33.950,130.883], ['MT','松山',33.867,132.717], ['M3','波止浜',34.100,132.933],
  ['M0','今治市小島',34.133,132.983], ['M1','来島航路',34.117,132.983], ['L0','今治',34.067,133.000],
  ['NI','新居浜',33.967,133.267], ['L8','伊予三島',33.983,133.550], ['TX','多度津',34.283,133.750],
  ['AX','青木',34.367,133.683], ['J8','与島',34.383,133.817], ['TA','高松',34.350,134.050],
  ['KM','小松島',34.017,134.583], ['J6','橘',33.867,134.633], ['AW','阿波由岐',33.767,134.600],
  ['HW','日和佐',33.717,134.550], ['L7','甲浦',33.550,134.300], ['MU','室戸岬',33.267,134.167],
  ['KC','高知',33.500,133.567], ['V7','須崎',33.383,133.300], ['ZH','久礼',33.333,133.250],
  ['L6','高知下田',32.933,133.000], ['TS','土佐清水',32.783,132.967], ['SU','片島',32.917,132.700]
];

// ★ 옮겨 적다가 한 자리 틀리면 엉뚱한 항의 물때가 나온다. 최소한 일본 안인지는 본다.
function sanity(){
  const bad = [];
  const seen = new Map();
  ST.forEach(([c,n,la,lo])=>{
    if(!(la > 20 && la < 46.5 && lo > 122 && lo < 154.5)) bad.push(c+' '+n+' 좌표가 일본 밖');
    const k = la.toFixed(3)+','+lo.toFixed(3);
    if(seen.has(k)) bad.push(c+' '+n+' 이(가) '+seen.get(k)+' 와 좌표가 같다');
    else seen.set(k, c+' '+n);
    if(!/^[A-Z0-9]{2}$/.test(c)) bad.push(c+' 기호가 두 칸이 아니다');
  });
  return bad;
}

// ── 한 줄 136칸을 뜯는다
const num3 = s => { const v = s.trim(); return v === '999' || v === '' ? null : Number(v); };
function hhmm(s){
  const h = s.slice(0,2).trim(), m = s.slice(2,4).trim();
  if(s.trim() === '9999' || h === '' || m === '') return null;
  const H = Number(h), M = Number(m);
  if(!(H >= 0 && H <= 23 && M >= 0 && M <= 59)) return null;
  return String(H).padStart(2,'0') + ':' + String(M).padStart(2,'0');
}
function parseLine(line){
  if(line.length < 80) return null;
  const yy = Number(line.slice(72,74)), mo = Number(line.slice(74,76)), dd = Number(line.slice(76,78));
  if(!(mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31)) return null;
  const d = (2000 + yy) + '-' + String(mo).padStart(2,'0') + '-' + String(dd).padStart(2,'0');
  const pick = (off) => {
    const out = [];
    for(let i = 0; i < 4; i++){
      const seg = line.slice(off + i*7, off + i*7 + 7);
      if(seg.length < 7) break;
      const t = hhmm(seg.slice(0,4)), v = num3(seg.slice(4,7));
      if(t !== null && v !== null) out.push({ t, v });
    }
    return out;
  };
  return { d, stn: line.slice(78,80).trim(), h: pick(80), l: pick(108) };
}

// ── 해뜸·해짐 (NOAA 셈). 気象庁 조위표에는 없다 — 지어내는 것이 아니라 계산이다.
function sunTimes(y, m, day, lat, lon){
  const N = Math.floor((Date.UTC(y, m-1, day) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  const rad = Math.PI/180, deg = 180/Math.PI;
  const out = {};
  for(const which of ['sr','ss']){
    const t = N + ((which === 'sr' ? 6 : 18) - lon/15) / 24;
    const M = (0.9856 * t) - 3.289;
    let L = M + (1.916 * Math.sin(M*rad)) + (0.020 * Math.sin(2*M*rad)) + 282.634;
    L = (L + 360) % 360;
    let RA = deg * Math.atan(0.91764 * Math.tan(L*rad));
    RA = (RA + 360) % 360;
    RA += (Math.floor(L/90) * 90) - (Math.floor(RA/90) * 90);
    RA /= 15;
    const sinDec = 0.39782 * Math.sin(L*rad), cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(90.833*rad) - (sinDec * Math.sin(lat*rad))) / (cosDec * Math.cos(lat*rad));
    if(cosH > 1 || cosH < -1){ out[which] = ''; continue; }
    let H = which === 'sr' ? (360 - deg*Math.acos(cosH)) : (deg*Math.acos(cosH));
    H /= 15;
    let T = H + RA - (0.06571 * t) - 6.622;
    let UT = ((T - lon/15) % 24 + 24) % 24;
    const JST = (UT + 9) % 24;                    // 일본 표준시
    const hh = Math.floor(JST), mm = Math.round((JST - hh) * 60);
    out[which] = String((hh + (mm === 60 ? 1 : 0)) % 24).padStart(2,'0') + ':'
               + String(mm === 60 ? 0 : mm).padStart(2,'0');
  }
  return out;
}

const sleep = ms => new Promise(r=>setTimeout(r, ms));
const ymd = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

(async () => {
  const bad = sanity();
  if(bad.length){ console.error('★ 지점표가 이상합니다:\n  ' + bad.join('\n  ')); process.exit(1); }

  const now = new Date();
  const want = new Set();
  for(let i = 0; i < DAYS; i++){ const d = new Date(now); d.setDate(d.getDate() + i); want.add(ymd(d)); }
  const years = [...new Set([...want].map(s => s.slice(0,4)))];

  const spots = [], miss = [];
  for(const [code, name, lat, lon] of ST){
    const days = [];
    try{
      for(const y of years){
        const r = await fetch(`${BASE}/${y}/${code}.txt`);
        if(!r.ok){ if(y === years[0]) throw new Error('HTTP ' + r.status); continue; }
        const txt = await r.text();
        txt.split(/\r?\n/).forEach(line => {
          const p = parseLine(line);
          if(!p || !want.has(p.d)) return;
          if(p.stn !== code) return;             // 남의 지점 줄이 섞이면 버린다
          if(!p.h.length && !p.l.length) return; // 예측이 없는 날은 안 싣는다
          const [Y, M, D] = p.d.split('-').map(Number);
          const s = sunTimes(Y, M, D, lat, lon);
          days.push({ d: p.d, h: p.h, l: p.l, sr: s.sr, ss: s.ss });
        });
      }
    }catch(e){ miss.push(code + ' ' + name + ' — ' + (e && e.message || e)); await sleep(GAP_MS); continue; }
    if(!days.length){ miss.push(code + ' ' + name + ' — 받은 날이 없음'); await sleep(GAP_MS); continue; }
    days.sort((a,b)=> a.d.localeCompare(b.d));
    spots.push({ id: 'jp_' + code, name, lat, lon, days });
    await sleep(GAP_MS);
  }

  if(!spots.length){ console.error('★ 실패: 한 지점도 못 받았습니다'); process.exit(1); }
  const data = {
    updated: new Date().toISOString(),
    source: SRC,
    note: '기상청(気象庁) 潮位表 자료입니다. 해뜸·해짐은 앱이 계산한 값입니다.',
    count: spots.length,
    spots
  };
  fs.writeFileSync(OUT, JSON.stringify(data));
  const kb = (fs.statSync(OUT).size/1024).toFixed(0);
  console.log(`만들었습니다: ${spots.length}지점 · ${kb}KB`
    + (miss.length ? `\n못 받음 ${miss.length}건:\n  ` + miss.join('\n  ') : ''));
})().catch(e => { console.error('★ 실패:', e && e.message || e); process.exit(1); });
