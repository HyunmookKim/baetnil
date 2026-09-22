// 뱃일 5.10 — EOT20 해안 점마다 19년(2026~2044) 만조·간조를 셈해
//   최저천문조위(LAT)와 최고천문조위(HAT)를 잡는다. 앱의 높이는 LAT(해도 기준면과 같은 뜻) 위 높이다.
//   5.8 의 러시아 12곳과 똑같은 셈이다 (neaps = 앱 안에 든 그 계산기).
//   node eot20_lat.js <in.json> <out.json> <몇째> <몇 조각>
const fs = require('fs');
const N = require('./neaps.js');
const [,, IN, OUT, K, M] = process.argv;
const all = JSON.parse(fs.readFileSync(IN, 'utf8'));
const k = Number(K || 0), m = Number(M || 1);
const out = [];
for(let i = k; i < all.length; i += m){
  const [la, lo, cons] = all[i];
  const pr = N.createTidePredictor(cons.map(([n, a, ph]) => ({ name: n, amplitude: a / 1000, phase: ph })));
  let lo_ = 1e9, hi = -1e9;
  for(let y = 2026; y < 2045; y++){
    const ex = pr.getExtremesPrediction({ start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)) });
    for(const e of ex){ if(e.level < lo_) lo_ = e.level; if(e.level > hi) hi = e.level; }
  }
  out.push([la, lo, cons, +lo_.toFixed(3), +hi.toFixed(3)]);
  if(out.length % 200 === 0) console.log(k, out.length);
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('done', k, out.length);
