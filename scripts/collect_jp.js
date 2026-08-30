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
    pref:'愛媛' },

  // ── 岡山県 — https://www.pref.okayama.jp/page/658297.html
  //   ★ 요금·설비 표가 그림이라 못 읽는다. 이름과 자리만 싣고 요금은 「문의」로 둔다.
  //     없는 요금을 지어내지 않는다.
  { name:'牛窓港', alt:['牛窓かぜまち桟橋','うしまど海の駅'], berth:'牛窓かぜまち桟橋 (関町浮桟橋)',
    addr:'瀬戸内市牛窓町', fee:'문의', fac:'', pref:'岡山' },
  { name:'児島観光港', alt:['児島港','くらしき・こじま海の駅'], berth:'3号浮桟橋 (くらしき・こじま 海の駅)',
    addr:'倉敷市児島', fee:'문의', fac:'',
    memo:'JR 児島역에서 가깝습니다.', pref:'岡山' },
  { name:'宇野港', alt:['たまの・うの港海の駅'], berth:'たまの・うの港 海の駅',
    addr:'玉野市築港', fee:'문의', fac:'', pref:'岡山' },
  { name:'日生港', alt:['ひなせ海の駅'], berth:'ひなせ 海の駅',
    addr:'備前市日生町', fee:'문의', fac:'', pref:'岡山' },
  { name:'牛窓ヨットハーバー', kind:'marina', alt:['うしまどヨットハーバー海の駅'],
    berth:'うしまどヨットハーバー 海の駅', addr:'瀬戸内市牛窓町牛窓', fee:'문의', fac:'', pref:'岡山' },

  // ── 山口県 — 瀬戸内・海の路ネットワーク推進協議会 (uminet.jp) 「マリーナ・ビジターバース」
  //   ★ 현이 낸 방문 계류 목록은 여전히 없다. 여기 실린 것은 민간 시설이라 전화 확인이 필요하다.
  { name:'マリーナ岩国', kind:'marina', berth:'マリーナ岩国',
    addr:'岩国市', fee:'문의', fac:'', pref:'山口' },
  { name:'マリーナシーホース', kind:'marina', alt:['しゅうなん海の駅'],
    berth:'マリーナシーホース (しゅうなん海の駅)', addr:'周南市', fee:'문의', fac:'', pref:'山口' },
  { name:'UBEマリーナ', kind:'marina', alt:['宇部マリーナ'], berth:'UBEマリーナ',
    addr:'宇部市', fee:'문의', fac:'', pref:'山口' }
];
const VISITOR_SRC = '香川県·広島県·兵庫県·愛媛県·岡山県 공개 자료 · 瀬戸内海の路ネットワーク(山口県)';

// ★ 岡山·山口 (2026-08-29 다시 확인해서 넣음)
//   岡山県 — 요금·설비 표는 여전히 그림이라 못 읽는다. 다만 **시설 이름은 글로 있다.**
//            이름만 싣고 요금은 「문의」로 둔다.
//   山口県 — 현이 낸 목록은 없다. 대신 세토내해 해로 네트워크 협의회가 올려 둔 곳을 싣는다.
//   ★ 자리는 OSM 에서 이름으로 찾는다. **못 찾으면 그냥 안 싣는다 — 좌표를 지어내지 않는다.**

// ── OSM 에서 자리를 받아 온다
// ★ 왜 이름으로 안 찾고 테두리로 찾나
//   이름이 똑같은 항이 여럿 있다(内海港은 여러 현에 있다). 현 테두리 안에서 찾아야 안 헷갈린다.
// ★★★ 2026-08 — 본 서버가 406(Not Acceptable) 을 내면서 일감이 통째로 실패했다.
//   까닭: overpass-api.de 가 「사람이 아니라 프로그램이 부른 것 같은」 요청을 막기
//   시작했다. IP 문제가 아니라 **머리글(headers) 문제**다. 고치는 법 두 가지를 다 쓴다.
//
//   ① 누가 부르는지 밝힌다 — User-Agent 를 제대로 적는다. 이것만으로 풀린 사례가 많다.
//      (OSM 커뮤니티 143198 「setting the user-agent in the header solved the problem」)
//   ② 그래도 막히면 거울 서버로 넘어간다. 거울들은 이 검사를 세게 안 한다.
//
//   ★ 한 곳만 믿지 않는다. 남의 서버라 언제든 또 막힐 수 있고, 그때마다 일본 정박지가
//     통째로 비는 것은 안 된다.
const OVERPASS_LIST = (process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [ 'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://z.overpass-api.de/api/interpreter' ]);
// ★ 누가 왜 부르는지 밝힌다. 남의 서버를 쓰는 쪽의 예의이자, 막히지 않는 길이다.
//
// ★★★ 머리글 값에는 한글을 쓰면 안 된다 (2026-08-30 — 여기서 한 번 터졌다).
//   HTTP 머리글은 한 글자가 한 바이트(0~255)여야 한다. 한글은 그 범위를 넘는다.
//   'baetnil/1.0 (…) 일본 정박지 자료 만들기' 로 적었다가
//   「Cannot convert argument to a ByteString … index 35」 로 다섯 서버가 다 죽었다.
//   설명은 주석에 적고, 머리글 값은 영문·숫자·기호만 쓴다.
const OV_HEAD = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'baetnil/1.0 (+https://baetnil.com) japan-mooring-data',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://baetnil.com/'
};
// ★ 못을 박는다. 머리글에 한 바이트를 넘는 글자가 들어가면 부르기도 전에 잡는다 —
//   남의 서버 탓으로 헤매지 않도록, 우리 잘못은 우리 자리에서 터뜨린다.
for(const [k, v] of Object.entries(OV_HEAD)){
  if(!/^[\x20-\x7e]*$/.test(String(v)))
    throw new Error('머리글 ' + k + ' 에 ASCII 아닌 글자가 있습니다: ' + v);
}
const 잠깐 = ms => new Promise(r => setTimeout(r, ms));
const PREF_BOX = {   // [남, 서, 북, 동]
  '香川': [34.00, 133.45, 34.60, 134.45],
  '広島': [34.00, 132.00, 34.99, 133.50],
  '兵庫': [34.15, 134.25, 35.10, 135.47],   // 세토 쪽만. 북쪽 동해 연안은 안 본다
  '愛媛': [32.90, 132.00, 34.35, 133.75],
  '岡山': [34.30, 133.30, 34.80, 134.45],
  '山口': [33.70, 130.85, 34.50, 132.30]    // 세토 쪽만. 동해(일본해) 연안은 안 본다
};
// ★★★ 얼마나 걸리나 (사장님이 「이게 도는 건가 멈춘 건가」 를 물으셔야 했다 — 내 잘못)
//   현 여섯 곳을 하나씩 물어본다. 한 번에 서버 쪽 제한이 90초라 다 하면 길게 9분쯤 걸린다.
//   그동안 아무것도 안 찍으면 일감 화면이 빈 채로 멈춰 보인다. 그래서 한 걸음마다 찍는다.
const 짧게 = u => String(u).replace(/^https:\/\//,'').split('/')[0];
// ★ 한없이 기다리지 않는다. Overpass 가 답을 안 주고 물고 있으면 여섯 현이 한 시간을 넘긴다.
//   서버 쪽 제한(90초)보다 조금 길게 잡아 우리 쪽에서도 끊는다.
const OV_WAIT = 120000;
// ★ 물어보기. 막히면 다음 서버로 넘어간다. 다 막히면 그때 소리 내어 실패한다 —
//   조용히 빈 자료를 내면 앱에서 일본 정박지가 통째로 사라진 채 아무도 모른다.
async function ovAsk(q){
  const 탈 = [];
  for(const url of OVERPASS_LIST){
    for(let 번 = 0; 번 < 2; 번++){
      try{
        const 시작 = Date.now();
        const r = await fetch(url, { method:'POST', body:'data=' + encodeURIComponent(q),
                                     headers: OV_HEAD,
                                     signal: AbortSignal.timeout(OV_WAIT) });
        if(r.ok){
          console.log('   ' + 짧게(url) + ' 에서 받았습니다 ('
            + Math.round((Date.now() - 시작) / 1000) + '초)');
          return await r.json();
        }
        탈.push(url.replace(/^https:\/\//,'').split('/')[0] + ' ' + r.status);
        // 429·504 는 「지금 바쁘다」 다 — 한 번 더 기다렸다 물어본다.
        //   406·403 은 「너는 안 받는다」 라 기다려도 소용없다. 바로 다음 서버로.
        if(r.status !== 429 && r.status !== 504 && r.status !== 503) break;
        await 잠깐(20000);
      }catch(e){
        탈.push(url.replace(/^https:\/\//,'').split('/')[0] + ' ' + (e.message || '터짐'));
        break;
      }
    }
    await 잠깐(2000);
  }
  throw new Error('overpass 를 다 못 썼습니다 — ' + 탈.join(' / '));
}
// ★★★ 왜 그물을 넓혔나 (2026-08-30 — 첫 성공 판에서 35곳 중 10곳만 실렸다)
//   여태는 harbour · leisure=marina · seamark:type=harbour 세 가지 꼬리표만 봤다.
//   그런데 일본의 항은 OSM 에 제각각으로 들어 있다 — 어떤 곳은 amenity=ferry_terminal,
//   어떤 곳은 landuse=harbour, 桟橋 는 man_made=pier, 큰 항은 relation(여러 선의 묶음)이다.
//   그래서 高松港·坂出港 같은 큰 항까지 통째로 빠졌다.
//
// ★ 제일 확실한 그물은 「이름」 이다.
//   우리는 어차피 이름으로 맞춰 본다(findSpot). 그러니 그 테두리 안에서
//   이름이 「…港」 으로 끝나거나 マリーナ·ヨットハーバー·海の駅 가 든 것을 다 받아 온다.
//   꼬리표가 무엇이든 상관없어진다.
//
// ★ 넓혀도 좌표를 지어내지 않는다. 받아 온 것 중에서 **이름이 맞는 것만** 싣는다.
//   못 찾으면 그냥 안 싣는다 — 이 원칙은 그대로다.
async function osmIn(box){
  const B = `(${box[0]},${box[1]},${box[2]},${box[3]})`;
  // ★ 2026-08-30 2차 — 22/35 까지 왔다. 남은 것 중 7곳이 그물에 아예 안 걸리는 이름이었다:
  //   廿日市ボートパーク · ボートパーク広島 · 五日市プレジャーボートスポット …
  //   「ボートパーク」 「プレジャーボート」 는 내가 그물에 안 넣어 둔 말이다. 넣는다.
  const 이름그물 = '"name"~"港$|マリーナ|ヨットハーバー|ハーバー|海の駅'
                 + '|ボートパーク|プレジャーボート|ボートスポット|ヨットクラブ|フィッシャリーナ"';
  const 꼬리표들 = [
    '"harbour"',
    '"leisure"="marina"',
    '"seamark:type"~"harbour|harbour_basin|marina|mooring|berth"',
    '"landuse"="harbour"',
    '"amenity"="ferry_terminal"',
    '"man_made"="pier"'
  ];
  const 줄 = [];
  // ★ relation 도 본다. 큰 항은 선 하나가 아니라 여러 선의 묶음으로 들어 있다.
  ['node','way','relation'].forEach(종 => {
    줄.push('  ' + 종 + '[' + 이름그물 + ']' + B + ';');
    꼬리표들.forEach(꼬 => 줄.push('  ' + 종 + '[' + 꼬 + ']' + B + ';'));
  });
  const q = '[out:json][timeout:90];\n(\n' + 줄.join('\n') + '\n);\nout center tags;';
  const j = await ovAsk(q);
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
// ★ 무르게 맞춘 것은 몇 자 이상만 (2026-08-30 2차)
//   OSM 이 「シーホースマリーナ」 처럼 앞뒤를 바꿔 들고 있는 일이 있다. 그래서 「들어 있으면」
//   도 마지막에 한 번 본다. 다만 짧은 이름에 이걸 쓰면 엉뚱한 곳을 집는다 —
//   「池田港」 로 「新池田港」 을 집으면 배가 딴 데로 간다. 다섯 자 이상만 무르게 본다.
const LOOSE_MIN = 5;
function findSpot(list, name, alts){
  for(const cand of [name].concat(alts || [])){
    const n = norm(cand);
    const hit = list.find(x => norm(x.name) === n)
             || list.find(x => norm(x.name).indexOf(n) === 0);
    if(hit) return hit;
  }
  // ★ 여기까지 못 찾았을 때만 무르게 본다. 딱 맞는 것이 있으면 늘 그것이 이긴다.
  for(const cand of [name].concat(alts || [])){
    const n = norm(cand);
    if(n.length < LOOSE_MIN) continue;
    const hit = list.find(x => norm(x.name).includes(n));
    if(hit){ hit.무르게 = cand; return hit; }
  }
  return null;
}

(async () => {
  const rows = [];
  const miss = [];
  const loose = [];
  const cache = {};
  // ★ 물어볼 현이 몇 곳인지 먼저 알린다. 「1/6」 이 보이면 멈춘 것이 아님을 안다.
  const 현들 = [...new Set(VISITOR.map(v => v.pref))].filter(p => PREF_BOX[p]);
  console.log('현 ' + 현들.length + '곳을 OSM 에 물어봅니다. 한 곳에 길게 2분까지 걸립니다.');
  let 몇째 = 0;
  for(const v of VISITOR){
    const box = PREF_BOX[v.pref];
    if(!box){ miss.push(v.berth + ' (테두리 없음)'); continue; }
    if(!cache[v.pref]){
      console.log('[' + (++몇째) + '/' + 현들.length + '] ' + v.pref + ' 물어보는 중…');
      cache[v.pref] = await osmIn(box);
      console.log('   ' + v.pref + ' — 자리 ' + cache[v.pref].length + '곳을 받았습니다');
      await new Promise(r=>setTimeout(r, 1200));
    }
    const hit = findSpot(cache[v.pref], v.name, v.alt);
    if(!hit){ miss.push(v.berth + ' — ' + v.name + ' 을(를) OSM 에서 못 찾음'); continue; }
    // ★ 무르게 맞춘 것은 따로 적어 둔다. 이름이 딱 안 맞았다는 뜻이라
    //   사람이 한 번 눈으로 훑어야 한다 — 배가 딴 데로 가면 안 된다.
    if(hit.무르게) loose.push(v.name + ' → OSM 「' + hit.name + '」');
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
    // ★★★ 얼마나 건졌나를 자료 안에 같이 남긴다 (2026-08-30).
    //   첫 성공 판에서 35곳 중 10곳만 실렸다. 그런데 무엇이 왜 빠졌는지는
    //   일감 기록을 뒤져야만 알 수 있었고, 나는 그걸 못 본 채 짐작으로 고치려 했다.
    //   ★ 따로 파일을 만들면 일감(.github/workflows/jp.yml)에 올리는 줄을 더해야 한다.
    //     사장님께 일을 하나 더 시키게 되므로, 이미 올라가는 이 파일 안에 넣는다.
    //   ★ 앱은 rows 만 읽는다. 아래 것들은 사람이 보는 것이다.
    했나: {
      넣어둔곳: VISITOR.length,
      실린곳: rows.length,
      // 현마다 OSM 에서 몇 개를 받아 왔나 — 그물이 좁은지 여기서 바로 보인다
      현마다받은수: Object.fromEntries(Object.entries(cache).map(([k, v]) => [k, v.length])),
      못찾음: miss,
      // ★ 이름이 딱 안 맞아 무르게 집은 것 — 한 번 눈으로 훑어 주십시오
      무르게맞춘것: loose
    },
    rows
  };
  fs.writeFileSync('spots-jp.json', JSON.stringify(out));
  console.log(`만들었습니다: ${rows.length}곳 / 넣어 둔 ${VISITOR.length}곳`
    + (loose.length ? `\n무르게 맞춘 것 ${loose.length}건 (눈으로 한 번 봐 주십시오):\n  ` + loose.join('\n  ') : '')
    + (miss.length ? `\n못 찾음 ${miss.length}건 (spots-jp.json 의 「했나」 에도 남겼습니다):\n  ` + miss.join('\n  ') : ''));
})().catch(e => { console.error('★ 실패:', e && e.message || e); process.exit(1); });
