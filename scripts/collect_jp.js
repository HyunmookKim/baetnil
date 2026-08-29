// 뱃일 — 일본 정박지 자료 만들기 (STEP 8)
//
// ★ 왜 이렇게 하나 — 관 자료가 전부 막혀 있다 (2026-08 확인)
//   · 국토수치정보 「어항(C09)」  → 이용허락조건 「非商用」. 상업 앱은 못 쓴다. 게다가 2006년판이 최신
//   · 국토수치정보 「항만(C02)」  → 역시 「非商用」. 2014년판
//   · 각 현의 ビジターバース 목록 → 이름·주소·요금·설비는 있는데 **좌표가 없다**
//   · 海の駅 공식 목록          → robots.txt 로 기계가 못 읽는다
//   · 국토지리원 주소검색 API    → 문서에 없는 내부 창구다. 약관이 불분명해서 안 쓴다
//
//   ★ 그래서 둘로 나눈다.
//     자리(좌표)  ← OpenStreetMap (ODbL · 상업 가능 · 출처 표시)
//     알맹이(요금·설비·연락) ← 각 현이 공개한 ビジターバース 자료 (아래 표에 손으로 옮겨 적는다)
//
//   ★ ODbL 이 무엇을 요구하나
//     만들어진 spots-jp.json 은 「파생 데이터베이스」다. 그래서 이 파일도 ODbL 로 밝힌다.
//     앱 화면에는 출처를 적는다(© OpenStreetMap contributors). 타일에 이미 적고 있는 그 문구다.
//
// ★ 지어내지 않는다
//   아래 표에 없는 곳은 안 싣는다. 좌표는 OSM 에서 온 것만 쓴다.
//   「대충 이 근처일 것이다」 로 점을 찍지 않는다 — 그 점을 믿고 배를 몰면 사람이 다친다.

const fs = require('fs');

// ── 현이 공개한 ビジターバース (방문 정박지). 출처를 줄마다 적는다.
//   name  : OSM 에서 찾을 때 쓰는 이름 (일본어)
//   port  : 어느 항인지
//   addr  : 현 자료의 주소
//   fee   : 현 자료의 요금 표기 그대로
//   fac   : power(전기) water(물) fuel(연료)
//   src   : 출처
const VISITOR = [
  // 香川県 — https://www.pref.kagawa.lg.jp/kowan/riyo/visiter.html (16곳)
  { name:'高松港',   berth:'西浜1号浮き桟橋',    addr:'高松市浜ノ町',            fee:'전장 10m 이하 2,130엔', fac:'',            pref:'香川' },
  { name:'高松港',   berth:'西浜さん橋',          addr:'高松市浜ノ町',            fee:'전장 10m 이하 2,130엔', fac:'',            pref:'香川' },
  { name:'高松港',   berth:'玉藻地区 -10M岸壁',   addr:'高松市サンポート',        fee:'800엔/m',              fac:'water',       pref:'香川' },
  { name:'高松港',   berth:'中央埠頭 -7.5M岸壁',  addr:'高松市玉藻町',            fee:'800엔/m',              fac:'water',       pref:'香川' },
  { name:'坂出港',   berth:'中央埠頭浮さん橋',    addr:'坂出市入船町二丁目',      fee:'문의',                 fac:'',            pref:'香川' },
  { name:'多度津港', berth:'外港浮桟橋',          addr:'多度津町東浜',            fee:'1,390엔~',             fac:'',            pref:'香川' },
  { name:'仁尾港',   berth:'金坂地区2号浮桟橋',   addr:'三豊市仁尾町',            fee:'문의',                 fac:'power,water', pref:'香川' },
  { name:'池田港',   berth:'池田港浮桟橋',        addr:'小豆島町池田',            fee:'문의',                 fac:'',            pref:'香川' },
  { name:'土庄港',   berth:'2号浮桟橋',           addr:'小豆郡土庄町吉ケ浦',      fee:'문의',                 fac:'',            pref:'香川' },
  { name:'内海港',   berth:'草壁港桟橋',          addr:'小豆郡小豆島町草壁本町',  fee:'문의',                 fac:'power,water', pref:'香川' },
  { name:'坂手港',   berth:'坂手第1岸壁',         addr:'小豆郡小豆島町坂手',      fee:'1,390엔~',             fac:'',            pref:'香川' },
  { name:'宮浦港',   berth:'宮浦1号浮桟橋',       addr:'香川郡直島町宮ノ浦',      fee:'1,390엔~',             fac:'',            pref:'香川' },
  { name:'直島港',   berth:'本村2号浮桟橋',       addr:'香川郡直島町本村',        fee:'1,390엔~',             fac:'',            pref:'香川' },
  { name:'丸亀港',   berth:'福島2号浮桟橋',       addr:'丸亀市福島町',            fee:'1,390엔~',             fac:'',            pref:'香川' },
  { name:'女木港',   berth:'3号浮桟橋',           addr:'高松市女木町',            fee:'문의',                 fac:'',            pref:'香川' },
  { name:'男木港',   berth:'男木港一文字防波堤内', addr:'高松市男木町',           fee:'문의',                 fac:'',            pref:'香川' }
];
const VISITOR_SRC = '香川県 港湾課 ビジターバース情報';

// ── OSM 에서 자리를 받아 온다
// ★ 왜 이름으로 안 찾고 테두리로 찾나
//   이름이 똑같은 항이 여럿 있다(内海港은 여러 현에 있다). 현 테두리 안에서 찾아야 안 헷갈린다.
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const PREF_BOX = {   // [남, 서, 북, 동]
  '香川': [34.00, 133.45, 34.60, 134.45]
};
async function osmIn(box){
  const q = `[out:json][timeout:90];
（
  node["harbour"](${box[0]},${box[1]},${box[2]},${box[3]});
  way["harbour"](${box[0]},${box[1]},${box[2]},${box[3]});
  node["leisure"="marina"](${box[0]},${box[1]},${box[2]},${box[3]});
  way["leisure"="marina"](${box[0]},${box[1]},${box[2]},${box[3]});
  node["seamark:type"="harbour"](${box[0]},${box[1]},${box[2]},${box[3]});
）;
out center tags;`.replace(/（/g,'(').replace(/）/g,')');
  const r = await fetch(OVERPASS, { method:'POST', body:'data=' + encodeURIComponent(q),
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' } });
  if(!r.ok) throw new Error('overpass ' + r.status);
  const j = await r.json();
  return (j.elements || []).map(e => ({
    name: (e.tags && (e.tags['name'] || e.tags['name:ja'])) || '',
    lat: e.lat != null ? e.lat : (e.center && e.center.lat),
    lon: e.lon != null ? e.lon : (e.center && e.center.lon)
  })).filter(x => x.name && x.lat != null && x.lon != null);
}
// 이름 맞추기 — 「高松港」 이 OSM 에 「高松港」 · 「高松港 (Takamatsu Port)」 로 들어 있다
const norm = s => String(s||'').replace(/\s+/g,'').replace(/[（(].*?[)）]/g,'');
function findSpot(list, name){
  const n = norm(name);
  return list.find(x => norm(x.name) === n)
      || list.find(x => norm(x.name).indexOf(n) === 0)
      || null;
}

(async () => {
  const rows = [];
  const miss = [];
  const cache = {};
  for(const v of VISITOR){
    const box = PREF_BOX[v.pref];
    if(!box){ miss.push(v.berth + ' (테두리 없음)'); continue; }
    if(!cache[v.pref]){ cache[v.pref] = await osmIn(box); await new Promise(r=>setTimeout(r, 1200)); }
    const hit = findSpot(cache[v.pref], v.name);
    if(!hit){ miss.push(v.berth + ' — ' + v.name + ' 을(를) OSM 에서 못 찾음'); continue; }
    rows.push({
      i: 'jp_' + v.pref + '_' + rows.length,
      n: v.berth + ' (' + v.name + ')',
      k: 'port',
      la: Math.round(hit.lat * 1e5) / 1e5,
      lo: Math.round(hit.lon * 1e5) / 1e5,
      r: v.pref,
      f: v.fac,
      p: false,
      t: [ v.addr,
           v.fee ? ('요금 — ' + v.fee) : '',
           '※ 자리는 그 항의 대표 좌표입니다. 방문 정박지(ビジターバース)의 정확한 자리는 현지에서 확인해 주세요.',
           '※ 일본에서는 어항에 레저보트를 대는 것이 원칙적으로 제한됩니다. 여기 실린 곳은 현이 방문 계류를 받는다고 밝힌 곳입니다.'
         ].filter(Boolean).join('\n')
    });
  }
  const out = {
    from: VISITOR_SRC + ' · 자리 © OpenStreetMap contributors (ODbL)',
    license: 'ODbL-1.0',
    note: '이 파일은 OpenStreetMap 에서 뽑은 자리를 담고 있어 ODbL 을 따릅니다.',
    ts: new Date().toISOString(),
    rows
  };
  fs.writeFileSync('spots-jp.json', JSON.stringify(out));
  console.log(`만들었습니다: ${rows.length}곳` + (miss.length ? `\n못 찾음 ${miss.length}건:\n  ` + miss.join('\n  ') : ''));
})().catch(e => { console.error('★ 실패:', e && e.message || e); process.exit(1); });
