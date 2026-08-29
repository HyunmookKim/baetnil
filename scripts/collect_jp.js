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
  { name:'男木港',   berth:'男木港一文字防波堤内', addr:'高松市男木町',           fee:'문의',                 fac:'',            pref:'香川' },

  // 広島県 — 地方港湾厳島港 宮島ビジターバース
  //   https://www.pref.hiroshima.lg.jp/soshiki/211/miyajimabiijita-.html
  { name:'宮島港', alt:['厳島港','宮島桟橋'], berth:'宮島ビジターバース', addr:'廿日市市宮島町',
    fee:'24시간마다 · 25ft 미만 1,350엔 / 25~30ft 1,670엔 / 30~35ft 1,880엔 / 35~40ft 2,300엔 / 40~50ft 3,230엔 / 50~60ft 3,970엔 / 60ft 이상 5,120엔',
    fac:'power,water', tel:'0829-44-0430', pref:'広島' },

  // 広島県 — プレジャーボート係留保管施設 (현이 「이용해 달라」고 낸 목록)
  //   https://www.pref.hiroshima.lg.jp/site/hiroshimakennkouwann/1171005139373.html
  //   ★ 이 여덟은 「방문 계류를 받는다」고 적혀 있지 않다. 상시 보관 시설이다.
  //     그래서 갈래를 마리나로 두고, 대기 전에 전화로 확인하라고 줄마다 적는다.
  { name:'廿日市ボートパーク', kind:'marina', berth:'廿日市ボートパーク', addr:'廿日市市木材港北4番地先',
    fee:'', fac:'', tel:'082-234-7710', cap:575, pref:'広島' },
  { name:'五日市プレジャーボートスポット', kind:'marina', berth:'五日市プレジャーボートスポット',
    addr:'広島市佐伯区五日市町1番地先', fee:'', fac:'', tel:'082-234-7710', cap:69, pref:'広島' },
  { name:'五日市メープルマリーナ', kind:'marina', berth:'五日市メープルマリーナ',
    addr:'広島市佐伯区海老園三丁目25番1号', fee:'', fac:'', tel:'082-943-7760', cap:703, pref:'広島' },
  { name:'広島観音マリーナ', kind:'marina', berth:'広島観音マリーナ',
    addr:'広島市西区観音新町四丁目14番6号', fee:'', fac:'', tel:'082-234-7710', cap:367, pref:'広島' },
  { name:'ボートパーク広島', kind:'marina', berth:'ボートパーク広島',
    addr:'広島市中区南吉島一丁目1番', fee:'', fac:'', tel:'082-249-2855', cap:516, pref:'広島' },
  { name:'坂プレジャーボートスポット', kind:'marina', berth:'坂プレジャーボートスポット',
    addr:'安芸郡坂町平成ケ浜地先', fee:'', fac:'', tel:'082-234-7710', cap:24, pref:'広島' },
  { name:'柳津プレジャーボートスポット', kind:'marina', berth:'柳津プレジャーボートスポット',
    addr:'福山市柳津町市場沖地先', fee:'', fac:'', tel:'084-959-3302', cap:51, pref:'広島' },
  { name:'山根木材ボートパーク福山', kind:'marina', berth:'山根木材ボートパーク福山',
    addr:'福山市新涯町二丁目地先', fee:'', fac:'', tel:'084-959-3302', cap:442, pref:'広島' },

  // 兵庫県 — 家島港 ビジターバース
  //   https://web.pref.hyogo.lg.jp/chk11/iesima/visitor-berth.html
  { name:'家島港', berth:'家島港ビジターバース', addr:'姫路市家島町真浦',
    fee:'정장 1m당 · 3시간 이내 100엔 / 3~6시간 200엔 / 6~24시간 800엔',
    fac:'power,water', tel:'079-325-8777',
    memo:'예약이 필요합니다. 최대 50피트, 부잔교 34.5m(2척).', pref:'兵庫' },

  // 愛媛県 — いまばり・みやうら海の駅 (宮浦第一・第二桟橋)
  //   https://www.pref.ehime.jp/page/112471.html
  { name:'宮浦港', alt:['みやうら海の駅'], berth:'宮浦第一・第二桟橋 (みやうら海の駅)',
    addr:'今治市宮浦5714番地先',
    fee:'정장 1m·24시간마다 · 24m 미만 320엔 / 24m 이상 800엔 (2025-11-15부터)',
    fac:'power,water', tel:'0897-82-0173',
    memo:'전기 510엔/12시간(AC100·200V 50A), 물 650.3엔/㎥. 선박 길이 60m 이하, 흘수 북측 4.4m·남측 3.2m 미만.',
    pref:'愛媛' }
];
const VISITOR_SRC = '香川県·広島県·兵庫県·愛媛県 공개 자료';

// ★ 왜 岡山·山口 이 없나 (2026-08-29 확인)
//   岡山県 — 현 페이지의 ビジターバース·海の駅 표가 전부 **그림 파일**이다. 글로 못 읽는다.
//            시설 이름만 글로 있고 주소·요금·설비가 없다. 이름만으로는 못 싣는다.
//   山口県 — 현이 낸 「방문 계류」 목록 자체가 없다. 長田フィッシャリーナ·徳山漁港 은
//            둘 다 「상시 이용자 모집」이지 방문 계류가 아니다.
//   ★ 둘 다 「없어서 못 넣은 것」이지 「빠뜨린 것」이 아니다. 지어내서 채우지 않는다.

// ── OSM 에서 자리를 받아 온다
// ★ 왜 이름으로 안 찾고 테두리로 찾나
//   이름이 똑같은 항이 여럿 있다(内海港은 여러 현에 있다). 현 테두리 안에서 찾아야 안 헷갈린다.
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const PREF_BOX = {   // [남, 서, 북, 동]
  '香川': [34.00, 133.45, 34.60, 134.45],
  '広島': [34.00, 132.00, 34.99, 133.50],
  '兵庫': [34.15, 134.25, 35.10, 135.47],   // 세토 쪽만. 북쪽 동해 연안은 안 본다
  '愛媛': [32.90, 132.00, 34.35, 133.75]
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
// ★ 이름 후보를 여럿 받는다. 같은 곳을 OSM 이 다른 이름으로 들고 있는 일이 잦다
//   (宮島港 / 厳島港, 宮浦港 / みやうら海の駅). 못 찾으면 그냥 안 싣는다 — 지어내지 않는다.
function findSpot(list, name, alts){
  for(const cand of [name].concat(alts || [])){
    const n = norm(cand);
    const hit = list.find(x => norm(x.name) === n)
             || list.find(x => norm(x.name).indexOf(n) === 0);
    if(hit) return hit;
  }
  return null;
}

(async () => {
  const rows = [];
  const miss = [];
  const cache = {};
  for(const v of VISITOR){
    const box = PREF_BOX[v.pref];
    if(!box){ miss.push(v.berth + ' (테두리 없음)'); continue; }
    if(!cache[v.pref]){ cache[v.pref] = await osmIn(box); await new Promise(r=>setTimeout(r, 1200)); }
    const hit = findSpot(cache[v.pref], v.name, v.alt);
    if(!hit){ miss.push(v.berth + ' — ' + v.name + ' 을(를) OSM 에서 못 찾음'); continue; }
    rows.push({
      i: 'jp_' + v.pref + '_' + rows.length,
      n: v.berth + ' (' + v.name + ')',
      k: v.kind || 'port',
      la: Math.round(hit.lat * 1e5) / 1e5,
      lo: Math.round(hit.lon * 1e5) / 1e5,
      r: v.pref,
      f: v.fac,
      p: false,
      t: [ v.addr,
           v.fee ? ('요금 — ' + v.fee) : '',
           v.tel ? ('전화 — ' + v.tel) : '',
           v.cap ? ('수용 ' + v.cap + '척') : '',
           v.memo || '',
           '※ 자리는 그 항의 대표 좌표입니다. 방문 정박지(ビジターバース)의 정확한 자리는 현지에서 확인해 주세요.',
           v.kind === 'marina'
             ? '※ 상시 보관 시설입니다. 방문 계류가 되는지는 대기 전에 전화로 확인해 주세요.'
             : '※ 일본에서는 어항에 레저보트를 대는 것이 원칙적으로 제한됩니다. 여기 실린 곳은 현이 방문 계류를 받는다고 밝힌 곳입니다.'
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
