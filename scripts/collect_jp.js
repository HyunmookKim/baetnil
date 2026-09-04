// 뱃일 — 정박지 자료 만들기 (일본 + 한국 마리나)
//
// ★ 만드는 파일 둘
//     app/spots-jp.json — 일본 (현이 낸 방문 정박지 + 지도가 마리나라고 부르는 곳)
//     app/spots-kr.json — 한국 (지도가 마리나라고 부르는 곳)
//   ★ 파일 이름에 jp 가 붙어 있는 까닭 — 일감(.github/workflows/jp.yml)이 그 이름 하나만
//     담게 되어 있고, .github 는 내가 못 고치는 자리다. 한국 파일은 이 스크립트가
//     스스로 `git add` 한다. 사장님께 일을 하나 더 시키지 않기 위해서다.
//
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

// ══════════════════════════════════════════════════════════════════════
// ★★★ 2026-09-01 — 그물을 **뒤집는다** (사장님 지적)
//
//   사장님 말씀: "일본 거는 겨우 세 개 들어 있네"
//               "지도 어플 같은 데 마리나라고 쳐 가지고, 진짜 마리나와 가짜 마리나들
//                구분한 다음에 또 넣을 수는 없나?"
//
//   ★ 왜 세 개뿐이었나 — 방향이 거꾸로였다.
//     여태는 **내가 손으로 적은 35곳**을 들고 OSM 에 「이 이름 있냐」고 물었다.
//     그래서 「없다」는 답을 13번 받았고, 마리나 13곳 중 **3곳**만 좌표를 얻었다.
//     사장님이 보신 그 세 개다. 손으로 적은 목록보다 넓어질 길이 아예 없었다.
//
//   ★ 이제 반대로 묻는다 — 「이 바다에서 **마리나인 곳을 다 내놔라**」.
//     OSM 에서 `leisure=marina` 는 글자 그대로 「마리나」다. 지도 앱에서 마리나를
//     쳐서 나오는 것과 같은 자료다. 이러면 35곳이 아니라 수백 곳이 나온다.
//
//   ★ 진짜와 가짜는 어떻게 가르나 — **내가 안 가른다.**
//     `leisure=marina` 중에는 배 올리는 경사로 하나뿐인 곳도 섞인다. 내가 미리
//     걸러내면 그것이 곧 짐작이다(사장님이 정하신 것 8번). 그래서 다 싣되
//     **「아직 확인 안 된 곳」(v:0)** 딱지를 붙인다. 쓰는 사람이 「여기 맞습니다」 /
//     「여긴 마리나가 아닙니다」를 눌러 정리한다 — 사장님이 정하신 위키 방식 그대로다.
//
//   ★ 확인된 것(v:1) 은 **관이 이름과 자리를 함께 낸 것** 뿐이다.
//     아래 VISITOR 표에서 맞은 것이 그것이다.
//
//   ★ 이름이 없는 것은 안 싣는다. 사람에게 「(이름 없음)」은 아무 쓸모가 없다.
// ══════════════════════════════════════════════════════════════════════
// ★★★ 일본은 **전국**을 훑는다 (사장님 지적, 2026-09-02)
//   전에는 세토내해와 규슈북부 두 상자뿐이었다. 그래서 지도를 열면 일본에서 한 동네만
//   점이 찍혔다. 「세토내해 중심으로 먼저」 는 **어디부터 채우나**를 정한 말이지
//   나머지를 안 넣는다는 말이 아니었다. 내가 잘못 알아들었다.
//   ★ 상자를 잘게 나누는 까닭 — Overpass 는 남의 서버다. 한 번에 일본 전체를 물으면
//     시간이 넘어 통째로 빈손이 된다. 나누면 한 상자가 실패해도 나머지가 남는다.
const MARINA_BOX = {
  // 일본 — 홋카이도부터 오키나와까지. 위도 띠로 잘랐다.
  'jp:홋카이도':     { c:'jp', box:[41.30, 139.30, 45.60, 146.00] },
  'jp:도호쿠동':     { c:'jp', box:[36.80, 140.20, 41.60, 142.30] },
  'jp:도호쿠서':     { c:'jp', box:[36.80, 138.80, 41.60, 140.60] },
  'jp:간토':         { c:'jp', box:[34.60, 138.90, 36.90, 141.20] },
  'jp:이즈오가사와라':{ c:'jp', box:[24.00, 138.00, 34.80, 142.50] },
  'jp:주부동해안':   { c:'jp', box:[34.40, 136.30, 35.60, 139.10] },
  'jp:호쿠리쿠':     { c:'jp', box:[35.20, 132.60, 38.60, 139.00] },
  'jp:긴키':         { c:'jp', box:[33.30, 134.80, 35.80, 136.60] },
  'jp:세토내해':     { c:'jp', box:[33.40, 130.80, 35.10, 135.50] },
  'jp:시코쿠남':     { c:'jp', box:[32.60, 132.20, 33.90, 135.00] },
  'jp:규슈북부':     { c:'jp', box:[32.60, 129.30, 34.10, 131.60] },
  'jp:규슈남부':     { c:'jp', box:[30.90, 129.80, 32.80, 132.20] },
  'jp:난세이':       { c:'jp', box:[24.00, 122.80, 31.00, 131.20] },
  // 한국 — 남해·서해·동해를 한 번에. 제주와 울릉도까지 든다.
  'kr:남해':      { c:'kr', box:[33.00, 126.00, 35.20, 129.60] },
  'kr:서해':      { c:'kr', box:[34.60, 125.60, 37.90, 127.00] },
  'kr:동해':      { c:'kr', box:[35.00, 128.90, 38.70, 131.10] },
  'kr:제주':      { c:'kr', box:[33.05, 126.10, 33.65, 126.99] },
  // ★★★ 4.100 — 러시아 극동 (사장님: 「일본까지 끝나면 러시아 마리나 쪽도 한번 해봐라」)
  //   우리 배가 실제로 갈 수 있는 바다부터 넣는다 —
  //   블라디보스토크·나홋카(표트르대제만)가 제일 가깝고, 그다음이 사할린·하바롭스크 앞바다다.
  //   ★ 캄차카·북극해는 아직 안 넣는다. 요트가 우리 바다에서 닿는 거리가 아니다.
  //     넣어야 할 까닭이 생기면 여기 한 줄을 더한다 (문 하나).
  'ru:연해주':    { c:'ru', box:[42.20, 130.60, 45.20, 136.20] },   // 표트르대제만·블라디보스토크·나홋카
  'ru:하바롭스크':{ c:'ru', box:[45.20, 136.20, 51.50, 141.50] },   // 타타르해협 서안
  'ru:사할린':    { c:'ru', box:[45.80, 141.50, 54.50, 144.90] }    // 사할린 섬 둘레
};
// ★ 「마리나」 라고 부르는 꼬리표만 본다.
//   leisure=marina 가 본줄기고, 바다 지도 쪽 seamark:type=marina 도 같은 뜻이다.
//   항(harbour)·부두(pier)는 여기 안 넣는다 — 그건 마리나가 아니다.
//   ★ 넓히고 싶어지면 그때 여기 한 줄을 더한다. 두 군데서 정하지 않는다.
const MARINA_TAGS = [ '"leisure"="marina"', '"seamark:type"="marina"' ];
async function osmMarinas(box){
  const B = `(${box[0]},${box[1]},${box[2]},${box[3]})`;
  const 줄 = [];
  ['node','way','relation'].forEach(종 =>
    MARINA_TAGS.forEach(꼬 => 줄.push('  ' + 종 + '[' + 꼬 + ']' + B + ';')));
  const q = '[out:json][timeout:90];\n(\n' + 줄.join('\n') + '\n);\nout center tags;';
  const j = await ovAsk(q);
  const 본 = new Set();
  const out = [];
  (j.elements || []).forEach(e => {
    const T = e.tags || {};
    // ★ 이름은 그 나라 말을 먼저 쓴다. 앱이 보는 사람 말로 다시 옮긴다.
    const name = T['name'] || T['name:ko'] || T['name:ja'] || T['name:en'] || '';
    const lat = e.lat != null ? e.lat : (e.center && e.center.lat);
    const lon = e.lon != null ? e.lon : (e.center && e.center.lon);
    if(!name || lat == null || lon == null) return;
    const key = e.type + '/' + e.id;
    if(본.has(key)) return;
    본.add(key);
    // ★ 꼬리표만 믿지 않는다 — 이름으로 한 번 더 거른다 (계류자리인가)
    if(typeof 계류자리인가 === 'function' && !계류자리인가(name, key)) return;
    // ★★★ 2026-09-04 — 그 나라 말이 아닌 사람을 위한 이름을 **자료에 담아 간다**.
    //   사장님 지적: 「일본 항구들 번역 안 된 건 이유가 뭐지?」
    //   ★ 지명은 뜻으로 옮기면 없는 곳이 된다(「미야지마 방문자 버스」). 그래서 옮기지 않는다.
    //     대신 지도 앱들이 하는 그대로 — **OSM 에 사람이 적어 둔 이름**을 그대로 가져간다.
    //     name:ko 가 있으면 그것이 제일 좋고, 없으면 가나(name:ja-Hira)를 담아 두면
    //     앱이 국립국어원 「가나와 한글 대조표」로 한글 소리를 만들 수 있다.
    //   ★ 없으면 안 담는다. 지어내지 않는다.
    const 이름들 = {};
    ['name:ko','name:en','name:ja','name:ja-Hira','name:ja_kana','name:ru'].forEach(k => {
      if(T[k] && T[k] !== name) 이름들[k.replace('name:','')] = T[k];
    });
    out.push({ key, name, lat, lon,
               nm: Object.keys(이름들).length ? 이름들 : undefined,
               tel: T['phone'] || T['contact:phone'] || '',
               web: T['website'] || T['contact:website'] || '' });
  });
  return out;
}
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



// ══════════════════════════════════════════════════════════════════════
// ★★★ 한국 마리나 — 관 자료 (사장님 지적, 2026-09-02)
//
// ★ 무엇이 잘못이었나
//   앱에 든 한국 정박지는 해양수산부 「마리나항만 기본계획」 39곳 + 어항 목록이다.
//   그래서 **여수 이순신마리나(150선석)·원형마리나(36선석)** 처럼 실제로 운영 중인
//   민간·지자체 마리나가 통째로 빠져 있었다. 사장님이 두 번 짚으셨는데
//   나는 「지도 자료(OSM)에서 긁어 오게 고쳤다」고만 하고 **그 세 곳이 실제로 들어오는지
//   확인하지 않았다.** 그건 거짓말이었다.
//
// ★ 이제 관 자료를 그대로 싣는다
//   해양수산부 마리나 정보화시스템 「전국 마리나 현황」 (infomarina.go.kr) —
//   **운영 중 72곳**. 여덟 쪽을 한 줄씩 그대로 옮겨 적었다(71곳 읽음. 아래 「했나」 참고).
//   이름·소재지·항만구분·선석수는 그 표에 적힌 글자 그대로다.
//
// ★ 자리(좌표)는 지어내지 않는다 — 이 표에는 좌표가 없다. 순서대로 찾는다.
//     ① 이 저장소가 이미 훑어 둔 OSM 마리나에서 이름이 맞는 것
//     ② 그래도 없으면 Nominatim 에 「그 이름 + 그 지역」 으로 물어본다 (OSM · ODbL)
//     ③ 둘 다 없으면 **안 싣는다.** 「자리 못 찾음」 에 이름을 남긴다.
//        엉뚱한 점을 찍어 두면 그 점을 믿고 배를 몰다 사람이 다친다.
//
// ★ 앱에 이미 있는 곳(어항·기본계획 39곳)과 겹치는 것은 **앱이** 걸러낸다.
//   여기서 또 거르면 두 곳에서 정하게 된다 (사장님이 정하신 것 3번).
// ★★★ 사람이 눈으로 보고 정한 것은 여기 하나에 모아 둔다 (문 하나).
//   수집기도 이 표를 보고, 이미 나간 자료를 고칠 때도 같은 표를 본다.
const 손 = require('./spot_hand.js');
const KRGOV_SRC = '해양수산부 마리나 정보화시스템 「전국 마리나 현황」';
const KRGOV = [
  { n:'아라마리나', at:'경인', port:'무역항', berth:194, reg:'수도권' },
  { n:'안산해양아카데미', at:'탄도강', port:'지방어항', berth:20, reg:'수도권' },
  { n:'서울(여의도)', at:'한강', port:'무역항', berth:90, reg:'수도권' },
  { n:'제부마리나', at:'제부', port:'연안', berth:300, reg:'수도권' },
  { n:'왕산마리나', at:'왕산', port:'연안', berth:319, reg:'수도권' },
  { n:'전곡마리나', at:'전곡', port:'지방어항', berth:200, reg:'수도권' },
  { n:'삼길포항 어촌마리나역', at:'삼길포', port:'국가어항', berth:16, reg:'충남권' },
  { n:'보령요트경기장', at:'보령', port:'연안', berth:50, reg:'충남권' },
  { n:'격포마리나', at:'격포', port:'국가어항', berth:37, reg:'전북권' },
  { n:'비봉마리나', at:'비봉', port:'어촌정주어항', berth:34, reg:'전남권' },
  { n:'목포마리나', at:'목포', port:'무역항', berth:57, reg:'전남권' },
  { n:'소호마리나', at:'여수시', port:'연안', berth:21, reg:'전남권' },
  { n:'이순신마리나', at:'여수시', port:'연안', berth:150, reg:'전남권' },
  { n:'원형마리나', at:'여수시', port:'연안', berth:36, reg:'전남권' },
  { n:'여수낭만바다마리나', at:'여수신항', port:'무역항', berth:4, reg:'전남권' },
  { n:'수산마리나', at:'수산', port:'국가어항', berth:130, reg:'강원권' },
  { n:'공현진마리나', at:'공현진', port:'국가어항', berth:14, reg:'강원권' },
  { n:'속초요트계류시설', at:'속초(청초호)', port:'무역항', berth:30, reg:'강원권' },
  { n:'강릉항 요트마리나', at:'강릉', port:'국가어항', berth:42, reg:'강원권' },
  { n:'형산강마리나', at:'포항시', port:'하천', berth:74, reg:'경북권' },
  { n:'후포마리나항만구역', at:'후포', port:'연안', berth:307, reg:'경북권' },
  { n:'골장마리나', at:'골장', port:'지방어항', berth:14, reg:'경북권' },
  { n:'사동마리나', at:'사동', port:'국가어항', berth:20, reg:'경북권' },
  { n:'오산마리나', at:'오산', port:'국가어항', berth:30, reg:'경북권' },
  { n:'방석마리나', at:'방석', port:'지방어항', berth:6, reg:'경북권' },
  { n:'양포마리나', at:'양포', port:'국가어항', berth:36, reg:'경북권' },
  { n:'두호마리나', at:'포항시', port:'소규모항포구', berth:14, reg:'경북권' },
  { n:'여남요트계류장', at:'포항시', port:'소규모항포구', berth:10, reg:'경북권' },
  { n:'포항요트계류장(동빈내항)', at:'포항구항(동빈내항)', port:'무역항', berth:55, reg:'경북권' },
  { n:'근포마리나', at:'대포근포', port:'국가어항', berth:64, reg:'경남권' },
  { n:'물건마리나', at:'물건', port:'국가어항', berth:20, reg:'경남권' },
  { n:'엘림마리나', at:'물건', port:'국가어항', berth:40, reg:'경남권' },
  { n:'적량마리나', at:'적량', port:'지방어항', berth:21, reg:'경남권' },
  { n:'삼천포(광포)마리나', at:'광포', port:'어촌정주어항', berth:24, reg:'경남권' },
  { n:'당항포마리나', at:'동천', port:'어촌정주어항', berth:105, reg:'경남권' },
  { n:'한산마리나리조트', at:'당항포', port:'연안', berth:8, reg:'경남권' },
  { n:'충무마리나', at:'통영', port:'무역항', berth:132, reg:'경남권' },
  { n:'통영항 요트계류시설', at:'통영', port:'무역항', berth:37, reg:'경남권' },
  { n:'통영요트학교', at:'통영', port:'무역항', berth:20, reg:'경남권' },
  { n:'매물도마리나', at:'당금', port:'국가어항', berth:16, reg:'경남권' },
  { n:'죽림요트계류시설', at:'통영시', port:'연안', berth:12, reg:'경남권' },
  { n:'능양항 요트계류시설', at:'능량', port:'국가어항', berth:12, reg:'경남권' },
  { n:'진촌항 요트계류시설', at:'진촌', port:'지방어항', berth:4, reg:'경남권' },
  { n:'욕지항 요트계류시설', at:'욕지', port:'국가어항', berth:10, reg:'경남권' },
  { n:'학림항 요트계류시설', at:'학림', port:'지방어항', berth:4, reg:'경남권' },
  { n:'연대항 요트계류시설', at:'연대', port:'지방어항', berth:4, reg:'경남권' },
  { n:'봉암항 요트계류시설', at:'봉암', port:'어촌정주어항', berth:4, reg:'경남권' },
  { n:'통영 한산 마리나호텔', at:'통영', port:'연안', berth:10, reg:'경남권' },
  { n:'소노캄', at:'거제시', port:'국가어항', berth:8, reg:'경남권' },
  { n:'지세포마리나', at:'지세포', port:'국가어항', berth:20, reg:'경남권' },
  { n:'진해 명동 마리나', at:'부산항', port:'무역항', berth:300, reg:'경남권' },
  { n:'화명수상 레포츠타운', at:'부산시', port:'하천', berth:30, reg:'부산권' },
  { n:'부산북항마리나', at:'부산북항', port:'무역항', berth:250, reg:'부산권' },
  { n:'수영만마리나', at:'수영만', port:'연안', berth:446, reg:'부산권' },
  { n:'광안리 해양 레포츠센터', at:'부산시', port:'연안', berth:10, reg:'부산권' },
  { n:'남천마리나', at:'남천', port:'연안', berth:36, reg:'부산권' },
  { n:'삼락수상레포츠타운', at:'부산시', port:'하천', berth:40, reg:'부산권' },
  { n:'해운대마리나', at:'해운대', port:'연안', berth:61, reg:'부산권' },
  { n:'중문마리나', at:'중문', port:'무역항', berth:5, reg:'제주권' },
  { n:'대포마리나', at:'대포근포', port:'지방어항', berth:4, reg:'제주권' },
  { n:'강정공공요트계류시설', at:'강정', port:'지방어항', berth:18, reg:'제주권' },
  { n:'M1971 요트투어(운진항마리나)', at:'서귀포시 운진', port:'지방어항', berth:27, reg:'제주권' },
  { n:'신창마리나', at:'제주시', port:'지방어항', berth:15, reg:'제주권' },
  { n:'도두마리나(민간)', at:'도두', port:'국가어항', berth:13, reg:'제주권' },
  { n:'한라(제주요트면허시험장)', at:'도두', port:'국가어항', berth:6, reg:'제주권' },
  { n:'도두마리나(공공)', at:'도두', port:'국가어항', berth:14, reg:'제주권' },
  { n:'김녕마리나(민간)', at:'김녕', port:'국가어항', berth:4, reg:'제주권' },
  { n:'김녕마리나(공공)', at:'김녕', port:'국가어항', berth:31, reg:'제주권' },
  { n:'신양마리나(추자도)', at:'신양(추자도)', port:'국가어항', berth:16, reg:'제주권' },
  { n:'위미마리나', at:'위미(민자)', port:'국가어항', berth:1, reg:'제주권' },
  { n:'해오름마리나(울산)', at:'울산시', port:'하천', berth:9, reg:'울산권' }
];
// 지역 이름 → Nominatim 에 같이 넣을 말. 관 자료의 「권역」 을 그대로 쓴다.
const KRGOV_AREA = {
  '수도권':'인천 경기', '충남권':'충청남도', '전북권':'전라북도', '전남권':'전라남도',
  '강원권':'강원도', '경북권':'경상북도', '경남권':'경상남도', '부산권':'부산',
  '제주권':'제주', '울산권':'울산'
};
// ★ 자리 물어보는 곳. 검사에서는 딴 데로 돌린다 — 검사가 남의 서버를 두들기면 안 된다.
const NOMI = process.env.NOMI_URL || 'https://nominatim.openstreetmap.org/search';
// Nominatim 규칙 — 1초에 한 번만 묻는다. 검사에서는 0 으로 두고 돌린다(남의 서버를 안 부른다).
const NOMI_WAIT = Number(process.env.NOMI_WAIT != null ? process.env.NOMI_WAIT : 1200);
const NOMI_HEAD = { 'user-agent':'baetnil.com marine app (contact help@baetnil.com)' };
const 이름씻기 = s => String(s || '')
  .replace(/\(.*?\)/g, '')
  .replace(/[\s·]/g, '')
  .replace(/마리나|요트계류시설|요트계류장|계류시설|항만구역|어촌마리나역|요트마리나|요트경기장|레포츠센터|레포츠타운|요트학교|리조트|호텔/g, '');

// Nominatim 은 남의 서버다. 1초에 한 번만 묻는다 (그쪽이 정한 규칙이다).
async function 자리물어보기(q){
  const u = NOMI + '?format=jsonv2&limit=1&countrycodes=kr&q=' + encodeURIComponent(q);
  const r = await fetch(u, { headers: NOMI_HEAD, signal: AbortSignal.timeout(20000) });
  if(!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if(!Array.isArray(j) || !j.length) return null;
  const la = Number(j[0].lat), lo = Number(j[0].lon);
  if(!isFinite(la) || !isFinite(lo)) return null;
  // 우리나라 밖으로 나간 답은 버린다
  if(la < 33 || la > 39 || lo < 124 || lo > 132) return null;
  return { la, lo, from: j[0].display_name || '' };
}


// ══════════════════════════════════════════════════════════════════════
// ★★★ 마리나로 표시됐다고 다 마리나가 아니다 (2026-09-03, 사장님 지적)
//
// 사장님 말씀:
//   「마리나로 표시된 곳이 진짜 마리나인지 아니면 마리나에 딸린 뭐 식당 같은 건지
//    확인하는 것도 안 했다는 소리냐?」
//
// 실제로 자료를 하나하나 보니 이런 것들이 실려 있었다:
//   · 한국 — 「제주유람선」·「목포유람선」 같은 **유람선 회사** 35곳,
//            「함구미 여객선터미널」, 「옹포방파제」, 「김시민호 선창장」
//   · 일본 — 「ジョナサン」(패밀리 레스토랑), 「府中湖カヌー競技場」(카누장),
//            「安土城お堀めぐり和船乗り場」(성 해자 나룻배 타는 곳),
//            「兵庫県立海洋体育館」(체육관), 「長沼ボート場」(조정 연못)
//   · 그리고 제부항 한 자리에 「대부·한진·마이·AB·뽀빠이·에코프로아」 처럼
//     **마리나 안의 가게**가 저마다 한 곳으로 실려 있었다 (제부 7곳, 전곡 3곳).
//
// ★ 왜 이런 것이 걸렸나 — OSM 에서 사람들이 `leisure=marina` 를 넓게 붙인다.
//   꼬리표만 믿으면 안 된다. 그래서 **이름으로 한 번 더 거른다.**
//
// ★ 거르는 잣대는 여기 한 곳에만 둔다. 두 곳에 두면 한쪽만 고쳐진다.
//   ★ 계류를 뜻하는 말(마리나·요트·ヨットハーバー…)이 이름에 있으면 거르지 않는다 —
//     「高松市ヨット競技場」 은 진짜 요트 계류장이다. 「府中湖カヌー競技場」 과 다르다.
const 계류하는말 = ['마리나','요트','ヨット','マリーナ','マリン','ボートパーク','ハーバー','ハーバ',
                   'フィッシャリーナ','プレジャーボート','海の駅','ボートスポット'];
const 계류아닌말 = [
  // 한국
  '유람선','여객선터미널','페리터미널','방파제','선창장','관광선','수상택시','수상레저기구',
  // 일본
  '遊覧船','観光船','渡船','カヌー','ボート場','体育館','競技場','艇庫','和船乗り場',
  'レストラン','食堂','カフェ','駐車場','バス停','自然公園','博物館','資料館','水族館'
];
// 이름이 안 걸러도 사람이 보고 뺀 것 — 까닭을 옆에 적는다. 지우지 말 것.
const 손으로뺀것 = {
  'node/4233335367': 'ジョナサン — 패밀리 레스토랑 (OSM 에 marina 로 잘못 붙어 있다)'
};
function 계류자리인가(name, key){
  const n = String(name || '');
  if(key && 손으로뺀것[key]) return false;
  // ★ 사람이 하나하나 찾아보고 「배를 매는 곳이 아니다」 라고 적어 둔 것 (spot_hand.js)
  if(손.계류자리아님[n]) return false;
  if(계류하는말.some(w => n.indexOf(w) >= 0)) return true;
  return !계류아닌말.some(w => n.indexOf(w) >= 0);
}
// ★★★ 한 자리에 여러 개가 실리는 것을 막는다 (제부항 7곳 · 전곡항 3곳)
//   250m 안에 여럿이 있으면 **한 곳**만 남긴다. 배를 대는 자리는 하나인데
//   그 안의 가게 수만큼 핀이 찍히면 지도가 못 쓰게 된다.
//   ★ 남길 것을 고르는 차례 — ① 관 자료에 실린 것 ② 계류를 뜻하는 말이 든 이름
//     ③ 이름이 긴 것(대개 정식 이름이다). 지어내지 않고 있는 것 중에서 고른다.
const 묶는거리 = 0.25;   // km
function 거리km(a, b){
  const R = Math.PI / 180;
  return Math.hypot((a.la - b.la) * 111,
                    (a.lo - b.lo) * 111 * Math.cos(a.la * R));
}
//   ★★ 관(官)이 이름을 낸 곳은 **절대 안 뺀다.**
//     처음에 아무거나 묶었더니 「도두마리나(공공)」 과 「도두마리나(민간)」,
//     「西浜さん橋」 와 「玉藻地区 -10M岸壁」 처럼 **관 자료에 따로 실린 두 곳**이 하나로 뭉쳤다.
//     그건 있는 정박지를 지우는 것이다. 빼는 것은 **지도에서 훑어 온 것**뿐이다.
const 관자료인가 = x => {
  const i = String(x.i || '');
  return i.startsWith('krgov_') || i.startsWith('jp_');
};
function 한자리로묶기(rows){
  const 남길것 = rows.filter(관자료인가);     // 관 자료는 그대로 다 남긴다
  const 뺀것 = [];
  const 점수 = x => (계류하는말.some(w => String(x.n).indexOf(w) >= 0) ? 10 : 0)
                  + Math.min(String(x.n || '').length, 9) / 10;
  rows.filter(x => !관자료인가(x)).sort((a, b) => 점수(b) - 점수(a)).forEach(x => {
    const 가까운 = 남길것.find(y => y.c === x.c && 거리km(x, y) <= 묶는거리);
    if(가까운){ 뺀것.push({ 뺌: x.n, 남김: 가까운.n }); return; }
    남길것.push(x);
  });
  return { rows: 남길것, 뺀것 };
}
// 관 자료 71곳에 자리를 붙인다
// ★★★ 이 점이 물가인가 — 마리나라면 물에서 1.5km 안이어야 한다.
//   해안선(natural=coastline)·물(natural=water)·부두(man_made=pier)가 둘레에 하나도 없으면
//   그건 물가가 아니다. 강·호수 마리나도 natural=water 로 잡히므로 같이 산다.
//   ★ 못 물어봤을 때(서버가 죽었을 때)는 **모른다(null)** 로 두고 그냥 싣는다 —
//     남의 서버가 안 된다고 우리 자료를 지우면 안 된다.
const 물반경m = 1500;
const 물에서먼것 = [];
async function 물가인가(la, lo){
  const q = `[out:json][timeout:25];(
    way["natural"="coastline"](around:${물반경m},${la},${lo});
    way["natural"="water"](around:${물반경m},${la},${lo});
    rel["natural"="water"](around:${물반경m},${la},${lo});
    way["man_made"="pier"](around:${물반경m},${la},${lo});
    way["waterway"="riverbank"](around:${물반경m},${la},${lo});
  );out ids 1;`;
  try{
    const j = await ovAsk(q);
    if(!j || !Array.isArray(j.elements)) return null;   // 모르겠다 — 그냥 싣는다
    return j.elements.length > 0;
  }catch(_){ return null; }
}
async function 한국관마리나(osmKr){
  const 있는것 = {};
  (osmKr || []).forEach(x => { 있는것[이름씻기(x.n)] = x; });
  const out = [], 못찾음 = [], loose = [], 어디서 = { 사람이확인:0, 지도훑기:0, 물어봄:0, 소재지이름:0 };
  const 쓴자리 = {};               // 이미 쓴 점 → 그 점을 쓴 곳의 「소재지·항 구분」
  const 쓴번호 = {};               // 이름을 씻으면 겹치는 것이 있다 (도두 공공/민간)
  for(const g of KRGOV){
    const key = 이름씻기(g.n);
    let la = null, lo = null, how = '';
    // ★★★ ⓪ 사람이 눈으로 보고 정한 것이 제일 앞이다 (spot_hand.js)
    const 찍은 = 손.손으로찍은자리[g.n];
    if(찍은){ la = 찍은.la; lo = 찍은.lo; how = '사람이확인'; }
    if(la == null){
      // ★★★ 2026-09-03 — 「진해 명동 마리나」 가 **부산항**에 찍혀 있었다 (25km 어긋남).
      //   관 자료의 「소재지」 칸은 곳에 따라 **관할 무역항**이 적혀 있다.
      //   명동은 창원시 진해구인데 그 칸에 '부산항' 이 적혀 있었고, 그 이름으로 지도를 뒤져
      //   부산 북항의 점을 집어 왔다. 배가 딴 데로 간다.
      //   ★ 그래서 믿는 차례를 바꾼다 — ① 마리나 **제 이름** 으로 지도에서 찾기
      //     ② 주소로 물어보기 ③ 그래도 없으면 그때만 소재지 이름으로 찾기.
      //   소재지는 제일 나중이다. 그게 틀릴 수 있는 칸이기 때문이다.
      let m = 있는것[key];
      if(!m && key.length >= 3){
        const 품은 = Object.keys(있는것).find(k => k.length >= 3 && (k.indexOf(key) >= 0 || key.indexOf(k) >= 0));
        if(품은) m = 있는것[품은];
      }
      if(m){ la = m.la; lo = m.lo; how = '지도훑기'; }
      else if(손.자리를못찾은곳[g.n]){
        // ★★★ 사람이 「그 자리는 틀렸다」 고 확인해 둔 곳이다 — **짐작으로 자리를 주지 않는다.**
        //   ★ 다만 지도(OSM)에 그 마리나가 이름째 있으면 그건 짐작이 아니라 실제 자리라
        //     바로 위 ① 에서 이미 썼다. 여기까지 오는 것은 짐작밖에 안 남았을 때다.
        못찾음.push(g.n + ' (' + g.at + ') — ' + 손.자리를못찾은곳[g.n]);
        continue;
      }
      else{
        const 지역 = KRGOV_AREA[g.reg] || '';
        const 항씻김 = 이름씻기(String(g.at || '').replace(/항$/, ''));
        try{
          // ★ 한 가지 말로만 물으면 못 찾는다. 좁은 것부터 넓은 것까지 차례로 묻는다.
          //   ★ 못 찾으면 안 싣는다 — 엉뚱한 점을 찍지 않는다는 원칙은 그대로다.
          const 물을말 = [
            g.n + ' ' + 지역,
            g.at + ' ' + 지역,
            (String(g.at || '').replace(/항$/, '') + '항 ' + 지역),
            (g.port ? g.port + ' ' + 지역 : '')
          ].filter(Boolean);
          let hit = null;
          for(const q of 물을말){
            try{ hit = await 자리물어보기(q); }catch(_){}
            // ★★★ 같은 점을 **다른 곳**에 주지 않는다 (2026-09-03)
            //   「형산강마리나(포항시·하천)」 와 「여남요트계류장(포항시·소규모항포구)」 가
            //   **똑같은 점**에 찍혀 있었다. 둘 다 못 찾아 '포항시' 로 떨어진 것이다.
            //   그건 찾은 것이 아니라 시청 자리다. 못 찾은 것으로 치고 이름을 남긴다.
            //   ★ 다만 소재지와 항 구분이 **둘 다 같으면** 진짜로 한 자리다 —
            //     「도두마리나(공공)」 과 「도두마리나(민간)」, 「이순신」 과 「원형」(둘 다 여수시·연안)
            //     은 같은 점을 나눠 갖는 것이 맞다.
            // ★★★ 되짚어 확인 (2026-09-04) — 나온 자리가 **그 도(道)** 안인가.
            //   구글 주소 확인이 쓰는 방법이다: 주소로 자리를 찾은 뒤 거꾸로 되돌려 맞춰 본다.
            //   「진해 명동 마리나(경남권)」 에 부산 북항 자리가 나왔던 것을 여기서 막는다.
            if(hit && !손.도가맞나(g.reg, hit.from)){
              loose.push(g.n + ' — 지도가 딴 도를 줬습니다: ' + hit.from);
              hit = null;
            }
            if(hit){
              const 점 = hit.la.toFixed(5) + ',' + hit.lo.toFixed(5);
              const 나 = String(g.at || '') + '·' + String(g.port || '');
              if(쓴자리[점] && 쓴자리[점] !== 나) hit = null;
            }
            if(hit) break;
            if(NOMI_WAIT) await 잠깐(NOMI_WAIT);
          }
          if(hit){ la = hit.la; lo = hit.lo; how = '물어봄'; }
        }catch(_){}
        if(NOMI_WAIT) await 잠깐(NOMI_WAIT);
        // ③ 그래도 없으면 그때만 소재지(항) 이름으로 지도에서 찾는다
        if(la == null){
          const m2 = 있는것[이름씻기(g.at)] || 있는것[항씻김]
            || (항씻김.length >= 3
                  ? 있는것[Object.keys(있는것).find(k => k.length >= 3 && k.indexOf(항씻김) >= 0)]
                  : null);
          if(m2){ la = m2.la; lo = m2.lo; how = '소재지이름'; }
        }
      }
    }
    if(la == null){ 못찾음.push(g.n + ' (' + g.at + ')'); continue; }
    // ★★★ 2026-09-04 — **바다에서 먼 점은 안 싣는다** (사장님 지적)
    //
    //   「여수 원형마리나 보니까 바다가 아니라 어디 이상한 산 같은 데로 좌표가 찍혀 있던데」
    //
    //   재 보니 실제로 **물에서 4.0km** 들어간 자리였다. 마리나는 물가에 있다 —
    //   4km 안쪽이면 그건 마리나 자리가 아니라 주소의 한가운데(동사무소 근처)다.
    //   ★ 지도에서 마리나 자체를 찾은 것(지도훑기)은 물 위에 있으니 안 잰다.
    //     **주소·소재지 이름으로 찾은 것만** 잰다 — 틀리는 것은 늘 그쪽이다.
    //   ★ 못 미더우면 **안 싣는다.** 엉뚱한 점을 찍느니 그 마리나가 목록에 없는 편이 낫다.
    //     (배를 그 점으로 몰고 가면 산으로 간다)
    if(how !== '지도훑기' && how !== '사람이확인'){
        const 물 = await 물가인가(la, lo);
        if(물 === false){
          못찾음.push(g.n + ' (' + g.at + ') — 물에서 멉니다: ' + la.toFixed(5) + ',' + lo.toFixed(5));
          물에서먼것.push({ 이름:g.n, 소재지:g.at, la, lo, 어떻게:how });
          continue;
        }
    }
    어디서[how]++;
    쓴자리[la.toFixed(5) + ',' + lo.toFixed(5)] = String(g.at || '') + '·' + String(g.port || '');
    const 줄 = [
      g.at + ' · ' + g.port,
      g.berth ? ('계류 ' + g.berth + '척') : '',
      '※ ' + KRGOV_SRC + ' 에 실린 곳입니다. 자리는 ' +
        (how === '사람이확인' ? '사람이 눈으로 확인한 것'
          : how === '지도훑기' ? '지도 자료(OpenStreetMap)'
          : how === '소재지이름' ? '소재지 이름으로 지도에서 찾은 것' : '주소로 찾은 것') +
        '이라 실제 접안 자리와 다를 수 있습니다.'
    ].filter(Boolean).join('\n');
    // ★★★ 이름을 씻으면 「도두마리나(공공)」 과 「도두마리나(민간)」 이 같은 번호가 된다.
    //   번호가 같으면 앱에서 한 곳이 다른 곳을 덮어써 한 곳이 사라진다. 뒤에 번호를 붙인다.
    쓴번호[key] = (쓴번호[key] || 0) + 1;
    const 번호 = 'krgov_' + key + (쓴번호[key] > 1 ? '_' + 쓴번호[key] : '');
    out.push({ i:번호, n:g.n, k:'marina', c:'kr',
               v:1,                       // 관이 이름을 낸 곳이다 — 「확인 안 됨」 딱지를 안 붙인다
               la: Math.round(la * 1e5) / 1e5,
               lo: Math.round(lo * 1e5) / 1e5,
               r: g.reg.replace(/권$/, ''), f:'', t: 줄 });
  }
  return { rows: out, 못찾음, 무른것: loose, 어디서 };
}

// ══════════════════════════════════════════════════════════════════════
// ★★★ 해상 예보구 경계 — app/sea-jp.json
//
// ★ 왜 있어야 하나
//   気象庁 해상경보는 「四国沖南部에 海上風警報」 처럼 **해역 이름**으로 나온다.
//   배가 어느 해역에 있는지 모르면, 홋카이도 앞바다 경보를 세토내해에 댄 배에
//   보여 주게 된다. 그건 없는 위험을 있다고 말하는 것이고, 반대로 제 해역 경보를
//   딴 데 것 사이에 묻어 버리는 것이다. 둘 다 사람을 다치게 한다.
//
// ★ 자리는 지어내지 않는다
//   경계는 気象庁이 낸 「予報区等GISデータ」 를 Geoshape(ROIS-DS 인문학오픈데이터
//   공동이용센터)가 GeoJSON 으로 펴 놓은 것을 그대로 받아 쓴다.
//   ★ 출처 — 気象庁 予報区等GISデータ / Geoshape リポジトリ (CC BY 4.0).
//     자료에도 앱 화면에도 적는다. 빼면 못 쓴다.
//
// ★ 무엇을 덜어내나
//   ① 안쪽 구멍(섬)은 뺀다. 배를 대는 자리는 대개 섬이나 뭍의 가장자리다.
//      구멍을 남기면 「다카마쓰항은 세토내해가 아니다」 같은 답이 나온다.
//   ② 테두리는 2km 눈금으로 성글게 만든다. 여기서 하는 일은 「어느 해역인가」
//      하나를 가리는 것뿐이라 그보다 촘촘할 까닭이 없다. 앱이 받아야 하는 파일이다.
//
// ★ 담는 해역 — 사장님이 정하신 대로 세토내해 언저리부터다 (일본 서쪽·남쪽 바다).
//   여기 없는 해역의 경보는 앱이 「내 해역」 으로 세지 않고, 이름만 그대로 보여 준다.
const SEA_SRC  = '地方海上予報区 — 気象庁 予報区等GISデータ / Geoshape (ROIS-DS CODH) CC BY 4.0';
const SEA_BASE = process.env.SEA_BASE_URL || 'https://geoshape.ex.nii.ac.jp/jma/resource/AreaMarineAJ/20190125/';
const SEA_TOL  = 0.02;   // 도. 위도 1도가 111km 이니 대략 2km 눈금이다
const SEA_DIG  = 3;      // 소수 셋째 자리 (약 110m) 까지만 적는다

// 気象庁 「地方海上予報区」 목록에 적힌 이름·번호를 그대로 옮긴 것이다.
// 부모(p)는 그 목록의 상위 예보구다 — 경보가 상위 예보구로 나올 때가 있다.
const SEA_AREAS = [
  { c:'4010', n:'瀬戸内海',                 p:'4000', pn:'四国沖及び瀬戸内海' },
  { c:'4020', n:'四国沖北部',               p:'4000', pn:'四国沖及び瀬戸内海' },
  { c:'4030', n:'四国沖南部',               p:'4000', pn:'四国沖及び瀬戸内海' },
  { c:'4110', n:'日本海北西部',             p:'4100', pn:'日本海西部' },
  { c:'4120', n:'山陰沖東部及び若狭湾付近', p:'4100', pn:'日本海西部' },
  { c:'4130', n:'山陰沖西部',               p:'4100', pn:'日本海西部' },
  { c:'5000', n:'対馬海峡',                 p:'',     pn:'' },
  { c:'5110', n:'済州島西海上',             p:'5100', pn:'九州西方海上' },
  { c:'5120', n:'長崎西海上',               p:'5100', pn:'九州西方海上' },
  { c:'5130', n:'女島南西海上',             p:'5100', pn:'九州西方海上' },
  { c:'5210', n:'日向灘',                   p:'5200', pn:'九州南方海上及び日向灘' },
  { c:'5220', n:'鹿児島海域',               p:'5200', pn:'九州南方海上及び日向灘' },
  { c:'5230', n:'奄美海域',                 p:'5200', pn:'九州南方海上及び日向灘' },
  { c:'3210', n:'東海海域東部',             p:'3200', pn:'東海海域' },
  { c:'3220', n:'東海海域西部',             p:'3200', pn:'東海海域' },
  { c:'3230', n:'東海海域南部',             p:'3200', pn:'東海海域' }
];

// 점이 선분에서 얼마나 떨어졌나 (도 단위. 굵게() 안에서만 쓴다)
function 선까지(p, a, b){
  const x = a[0], y = a[1];
  let dx = b[0] - x, dy = b[1] - y;
  if(dx !== 0 || dy !== 0){
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if(t > 1){ return Math.hypot(p[0] - b[0], p[1] - b[1]); }
    if(t > 0){ return Math.hypot(p[0] - (x + t * dx), p[1] - (y + t * dy)); }
  }
  return Math.hypot(p[0] - x, p[1] - y);
}
// 테두리를 성글게 (Douglas–Peucker)
function 굵게(pts, tol){
  if(pts.length < 3) return pts.slice();
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const 할일 = [[0, pts.length - 1]];
  while(할일.length){
    const [a, b] = 할일.pop();
    let far = -1, fd = 0;
    for(let i = a + 1; i < b; i++){
      const d = 선까지(pts[i], pts[a], pts[b]);
      if(d > fd){ fd = d; far = i; }
    }
    if(fd > tol && far > 0){ keep[far] = true; 할일.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const 자르기 = v => Number(v.toFixed(SEA_DIG));

// GeoJSON 하나에서 바깥 테두리들만 뽑는다
function 테두리들(gj){
  const out = [];
  const 담기 = poly => { if(Array.isArray(poly) && poly.length) out.push(poly[0]); };  // [0] 이 바깥, 나머지는 구멍
  (gj.features || []).forEach(f => {
    const g = f && f.geometry; if(!g) return;
    if(g.type === 'Polygon') 담기(g.coordinates);
    else if(g.type === 'MultiPolygon') (g.coordinates || []).forEach(담기);
  });
  return out;
}

async function 해역경계(){
  const areas = [], 못받음 = [];
  for(const a of SEA_AREAS){
    let gj;
    try{
      const r = await fetch(SEA_BASE + a.c + '.geojson');
      if(!r.ok) throw new Error('HTTP ' + r.status);
      gj = await r.json();
    }catch(e){ 못받음.push(a.c + ' ' + a.n + ' — ' + (e && e.message || e)); continue; }

    const rings = [];
    let la0 = 90, lo0 = 180, la1 = -90, lo1 = -180;
    테두리들(gj).forEach(ring => {
      ring.forEach(pt => {
        if(!Array.isArray(pt) || !isFinite(pt[0]) || !isFinite(pt[1])) return;
        if(pt[1] < la0) la0 = pt[1];
        if(pt[1] > la1) la1 = pt[1];
        if(pt[0] < lo0) lo0 = pt[0];
        if(pt[0] > lo1) lo1 = pt[0];
      });
      const 성근 = 굵게(ring, SEA_TOL).map(p => [자르기(p[0]), 자르기(p[1])]);
      const 줄인 = 성근.filter((p, i) => i === 0 || p[0] !== 성근[i-1][0] || p[1] !== 성근[i-1][1]);
      if(줄인.length >= 4) rings.push(줄인);
    });
    if(!rings.length){ 못받음.push(a.c + ' ' + a.n + ' — 테두리가 비었습니다'); continue; }
    areas.push({ c:a.c, n:a.n, p:a.p, pn:a.pn,
                 box:[자르기(la0), 자르기(lo0), 자르기(la1), 자르기(lo1)], rings });
  }

  // ★ 하나도 못 받았으면 파일을 안 건드린다. 지난 것을 그대로 두는 편이 낫다 —
  //   빈 파일을 써 두면 앱이 「일본 해역이 아니다」 라고 말하게 된다.
  if(!areas.length){
    console.error('★ 해상 예보구 경계를 하나도 못 받았습니다. 지난 파일을 그대로 둡니다.');
    못받음.forEach(m => console.error('   ' + m));
    return null;
  }
  const out = {
    from: SEA_SRC,
    license: 'CC-BY-4.0',
    note: '바깥 테두리만 2km 눈금으로 성글게 만든 것입니다. 항해용이 아닙니다.',
    ts: new Date().toISOString(),
    했나: { 넣어둔곳: SEA_AREAS.length, 실린곳: areas.length, 못받음 },
    areas
  };
  fs.writeFileSync('sea-jp.json', JSON.stringify(out));
  try{
    const { execFileSync } = require('child_process');
    execFileSync('git', ['add', '-A', '--', 'sea-jp.json'], { stdio:'ignore' });
  }catch(_){}
  const 크기 = fs.statSync('sea-jp.json').size;
  console.log(`해상 예보구 경계 ${areas.length}곳 · ${(크기/1024).toFixed(0)}KB`
    + (못받음.length ? `\n못 받은 곳 ${못받음.length}:\n  ` + 못받음.join('\n  ') : ''));
  return out;
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
      c: 'jp',
      // ★ 관이 이름과 자리를 함께 낸 것이다 — 확인된 것으로 본다
      v: 1,
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
  // ══════════════════════════════════════════════════════════════════
  // ★★★ 두 번째 걸음 — 「이 바다에서 마리나인 곳을 다 내놔라」 (2026-09-01)
  //   위에서 만든 것은 **관이 낸 방문 정박지** 다. 여기서 만드는 것은
  //   **지도가 마리나라고 부르는 곳 전부** 다. 둘은 겹칠 수 있으므로 이름으로 맞춰 본다.
  // ══════════════════════════════════════════════════════════════════
  const 마리나 = { jp: [], kr: [], ru: [] };
  const 마리나샘 = {};
  const 이미 = new Set(rows.map(r => norm(r.n)));
  // 관 자료 이름(高松港 같은 항 이름)도 맞춰 볼 수 있게 넣어 둔다
  VISITOR.forEach(v => { 이미.add(norm(v.name)); (v.alt||[]).forEach(a2 => 이미.add(norm(a2))); });
  const 겹침 = [];
  const 테두리들 = Object.keys(MARINA_BOX);
  console.log('마리나를 훑습니다 — 바다 ' + 테두리들.length + '곳.');
  let 몇 = 0;
  for(const 이름 of 테두리들){
    const M = MARINA_BOX[이름];
    console.log('[' + (++몇) + '/' + 테두리들.length + '] ' + 이름 + ' 훑는 중…');
    let got = [];
    try{ got = await osmMarinas(M.box); }
    catch(e){
      // ★ 한 바다가 막혔다고 나머지까지 버리지 않는다. 다만 조용히 넘어가지도 않는다 —
      //   몇 곳이 왜 비었는지 자료 안에 남긴다.
      마리나샘[이름] = '★ 못 받음: ' + ((e && e.message) || e);
      console.log('   ★ ' + 이름 + ' 못 받았습니다 — ' + ((e && e.message) || e));
      await 잠깐(2000);
      continue;
    }
    마리나샘[이름] = got.length;
    console.log('   ' + 이름 + ' — 마리나 ' + got.length + '곳');
    got.forEach(g => {
      // 관 자료로 이미 실은 곳이면 또 싣지 않는다 (사본을 안 만든다)
      const n = norm(g.name);
      if(이미.has(n)){ 겹침.push(g.name); return; }
      이미.add(n);
      마리나[M.c].push({
        i: 'osm_' + g.key.replace('/', ''),
        n: g.name,
        k: 'marina',
        c: M.c,
        // ★ 아직 사람이 확인 안 한 곳이다. 앱이 딱지를 붙여 보여 준다.
        v: 0,
        la: Math.round(g.lat * 1e5) / 1e5,
        lo: Math.round(g.lon * 1e5) / 1e5,
        r: '',
        f: '',
        p: false,
        t: [ g.tel ? ('전화 — ' + g.tel) : '',
             g.web ? ('누리집 — ' + g.web) : '',
             '※ 지도 자료에 「마리나」로 적혀 있는 곳입니다. 아직 확인되지 않았습니다 —'
             + ' 실제로 배를 댈 수 있는지는 가시기 전에 확인해 주세요.'
           ].filter(Boolean).join('\n')
      });
    });
    await 잠깐(2000);
  }

  const OSM_FROM = '자리 © OpenStreetMap contributors (ODbL)';
  const 머리 = (from, 했나) => ({
    from, license: 'ODbL-1.0',
    note: '이 파일은 OpenStreetMap 에서 뽑은 자리를 담고 있어 ODbL 을 따릅니다.',
    ts: new Date().toISOString(),
    했나
  });

  // ── 일본 꾸러미 (관 자료 + 마리나 훑은 것)
  //   ★ 한 자리에 여러 개가 실리는 것을 여기서 막는다 (사장님 지적 — 제부항 7곳)
  const jp묶기 = 한자리로묶기(rows.concat(마리나.jp));
  const jpRows = jp묶기.rows;
  const out = Object.assign(머리(VISITOR_SRC + ' · ' + OSM_FROM, {
    // ★★★ 얼마나 건졌나를 자료 안에 같이 남긴다 (2026-08-30).
    //   무엇이 왜 빠졌는지는 일감 기록을 뒤져야만 알 수 있었고, 나는 그걸 못 본 채
    //   짐작으로 고치려 했다. 따로 파일을 만들면 일감에 줄을 더해야 하므로 여기 넣는다.
    넣어둔곳: VISITOR.length,
    실린곳: rows.length,
    현마다받은수: Object.fromEntries(Object.entries(cache).map(([k, v]) => [k, v.length])),
    못찾음: miss,
    무르게맞춘것: loose,
    마리나훑은수: 마리나샘,
    마리나실린수: { jp: 마리나.jp.length, kr: 마리나.kr.length },
    관자료와겹쳐서뺀것: 겹침,
    한자리라뺀것: jp묶기.뺀것
  }), { rows: jpRows });
  fs.writeFileSync('spots-jp.json', JSON.stringify(out));

  // ── 한국 관 자료 마리나 (해양수산부 「전국 마리나 현황」 71곳)
  //   ★ 이순신·원형처럼 실제로 운영 중인데 앱에 없던 곳이 여기로 들어온다.
  console.log('관 자료 마리나에 자리를 붙입니다 — ' + KRGOV.length + '곳.');
  let 관마리나 = { rows: [], 못찾음: [], 무른것: [], 어디서: {} };
  try{ 관마리나 = await 한국관마리나(마리나.kr); }
  catch(e){ console.error('★ 관 자료 마리나 실패:', e && e.message || e); }
  console.log('   자리를 찾은 곳 ' + 관마리나.rows.length + '곳'
    + (관마리나.못찾음.length ? ' · 못 찾은 곳 ' + 관마리나.못찾음.length + '곳' : ''));

  // ── 러시아 극동 꾸러미 (2026-09-03, 사장님이 시키신 것)
  //   ★ 관(官) 자료가 없다. 지도가 「마리나」라고 부르는 곳만 담는다 —
  //     전부 「아직 확인 안 됨(v:0)」 이다. 쓰는 사람이 눌러 정리한다.
  //   ★ 우리 배가 갈 수 있는 바다부터다 (연해주·하바롭스크·사할린).
  const ru묶기 = 한자리로묶기(마리나.ru);
  const ru = Object.assign(머리(OSM_FROM, {
    마리나훑은수: Object.fromEntries(Object.entries(마리나샘).filter(([k]) => k.startsWith('ru:'))),
    마리나실린수: { ru: ru묶기.rows.length },
    한자리라뺀것: ru묶기.뺀것,
    적바림: '러시아는 관 자료가 없어 지도(OpenStreetMap)에서 훑은 것만 담습니다. '
          + '전부 「아직 확인 안 됨」 입니다.'
  }), { rows: ru묶기.rows });
  fs.writeFileSync('spots-ru.json', JSON.stringify(ru));
  console.log('러시아 마리나 ' + ru묶기.rows.length + '곳을 담았습니다.');

  // ── 한국 꾸러미 (관 자료 + 지도가 마리나라고 부르는 곳)
  //   ★ 앱 안의 152곳과 겹치는 것은 **앱이** 걸러낸다. 여기서는 앱이 무엇을 들고 있는지
  //     알 수 없다 — 두 군데서 정하면 반드시 어긋난다 (사장님이 정하신 것 3번).
  //   ★ 관 자료가 먼저다. 같은 이름이 지도 훑기에도 있으면 관 자료 줄만 남긴다.
  const 관이름 = new Set(관마리나.rows.map(x => 이름씻기(x.n)));
  const kr묶기 = 한자리로묶기(관마리나.rows.concat(마리나.kr.filter(x => !관이름.has(이름씻기(x.n)))));
  const krRows = kr묶기.rows;
  const kr = Object.assign(머리(KRGOV_SRC + ' · ' + OSM_FROM, {
    관자료넣어둔곳: KRGOV.length,
    관자료실린곳: 관마리나.rows.length,
    관자료자리못찾음: 관마리나.못찾음,
    관자료딴도가나온것: 관마리나.무른것,   // 되짚어 확인에 걸린 것 — 자리를 안 쓴다
    사람이확인한자리: Object.fromEntries(Object.entries(손.손으로찍은자리).map(([k,v])=>[k, v.왜])),
    배매는곳이아니라뺀것: 손.계류자리아님,
    관자료자리어디서: 관마리나.어디서,
    마리나훑은수: Object.fromEntries(Object.entries(마리나샘).filter(([k]) => k.startsWith('kr:'))),
    마리나실린수: { kr: 마리나.kr.length },
    한자리라뺀것: kr묶기.뺀것,
    물에서먼것,                       // ★ 바다에서 멀어 안 실은 것 — 왜 빠졌는지 자료에 남긴다
    물본반경m: 물반경m,
    적바림: '관 자료는 운영 중 72곳이라 적혀 있는데 여덟 쪽에서 71곳을 읽었습니다.'
  }), { rows: krRows });
  fs.writeFileSync('spots-kr.json', JSON.stringify(kr));

  // ★ 일감(jp.yml)은 `git add app/spots-jp.json` 한 줄뿐이다. 그 파일은 .github 안에 있어
  //   내가 못 고친다. 그러니 새로 만든 파일은 **내가 담는다** — 사장님께 일을 더 시키지 않는다.
  try{
    const { execFileSync } = require('child_process');
    execFileSync('git', ['add', '-A', '--', 'spots-kr.json', 'spots-ru.json'], { stdio:'ignore' });
  }catch(_){}

  // ── 해상 예보구 경계 (気象庁 해상경보를 「내 해역」 으로 가리기 위한 것)
  //   ★ 이것이 안 되어도 정박지 자료는 이미 다 썼다. 여기서 멈추면 안 된다.
  try{ await 해역경계(); }catch(e){ console.error('★ 해상 예보구 경계 실패:', e && e.message || e); }

  console.log(`만들었습니다 — 일본 ${jpRows.length}곳 (관 자료 ${rows.length} + 마리나 ${마리나.jp.length})`
    + ` · 한국 마리나 ${krRows.length}곳 (관 자료 ${관마리나.rows.length} + 지도 훑기 ${krRows.length - 관마리나.rows.length})`
    + (겹침.length ? `\n관 자료와 겹쳐서 뺀 것 ${겹침.length}곳` : '')
    + (loose.length ? `\n무르게 맞춘 것 ${loose.length}건 (눈으로 한 번 봐 주십시오):\n  ` + loose.join('\n  ') : '')
    + (miss.length ? `\n관 자료 중 못 찾음 ${miss.length}건 (「했나」 에도 남겼습니다):\n  ` + miss.join('\n  ') : ''));
})().catch(e => { console.error('★ 실패:', e && e.message || e); process.exit(1); });
