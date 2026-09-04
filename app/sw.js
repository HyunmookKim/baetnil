const CACHE = 'baetnil-4.102';
const TILES = 'baetnil-tiles';   // 지도 타일 전용 (앱 버전을 올려도 지우지 않는다)
const PHOTOS = 'baetnil-photos'; // 창고 사진 전용 (앱 버전을 올려도 지우지 않는다)

// ★ 왜 사진을 여기에 담는가
//   3.34~3.41 에서 사진을 파이어스토어 문서 밖 창고(Storage)로 옮겼다.
//   전송비가 크게 줄었지만, 대신 사진이 '주소' 가 되어 인터넷이 없으면 안 보인다.
//   배 위에서는 인터넷이 없는 것이 보통이다. 한 번 본 사진은 여기에 남긴다.
//   앱 버전을 올려도 지우지 않는다 — 지우면 배에 나갈 때마다 처음부터 다시 받아야 한다.
const PHOTO_HOSTS = ['firebasestorage.googleapis.com'];
// 내 배 사진 한도는 앱이 폰 여유를 보고 정한다 (index.html · photoKeepN).
// 여기서는 숫자를 갖지 않는다 — 두 곳에 두면 어긋난다.

// ★★★ 사진이 느렸던 까닭 ③ — 이미 올라간 사진은 창고가 여전히 「들고 있지 말라」 고 한다 (4.82).
//
//   여태 여기 주석에 「여기 없는 사진도 브라우저가 한 시간쯤은 들고 있으므로
//   같은 화면을 다시 봐도 인터넷을 다시 쓰지 않는다」 고 적어 두었다. **틀렸다.**
//   실제로 재 보니 창고가 cache-control: private, max-age=0 을 붙여 보내고 있었다 —
//   브라우저에게 「저장하지 마라」 다. 그래서 화면을 돌아올 때마다 다시 받았다.
//
//   4.82 부터 올리는 사진에는 「1년 들고 있어도 된다」 를 붙인다. 그런데 **이미 올라간
//   사진은 그대로다.** 그것들까지 빨라지게 하려면 우리가 들고 있는 수밖에 없다.
//
//   ★ 창고 사진(PHOTOS) 400장을 건드리지 않는다. 그 자리는 배에 나갔을 때
//     인터넷 없이 봐야 하는 내 물품·정비·도면 사진 몫이다. 남의 사진이 그 자리를
//     차지하면 정작 바다에서 못 본다. 그래서 **자리를 따로 판다.**
const SEEN = 'baetnil-seen';     // 한 번 본 사진 (글판·장터·정박지·남의 배)
const SEEN_KEEP = 200;
const ASSETS = ['./','./index.html','./manifest.webmanifest','./font.woff2','./icon-192.png','./icon-512.png','./icon-180.png'];
const TILE_HOSTS = ['tile.openstreetmap.org','tiles.openseamap.org'];

// ★ 왜 이렇게 하는가 (2.13 까지 실제로 겪은 사고)
//   앱은 2.11 이 돌고 있는데 저장분 이름은 2.12 였다. 새 버전을 올려도
//   고친 것이 하나도 안 보였다. 원인은 두 가지였다.
//   1) install 에서 addAll 로 받으면 브라우저가 가진 옛 사본(HTTP 캐시)을
//      그대로 담는다 → 이름만 새 버전인 저장분 안에 옛 index.html 이 들어간다.
//      cache:'reload' 로 받아야 서버에서 새로 가져온다.
//   2) fetch 가 저장분 우선이라, 한 번 담긴 index.html 은 영영 새로 안 받는다.
//      화면 파일만은 인터넷 우선으로 바꾼다. 인터넷이 없으면 저장분으로 버틴다.

self.addEventListener('install', e=>{
  e.waitUntil((async ()=>{
    const c = await caches.open(CACHE);
    // 하나씩 받는다. addAll 은 한 개만 실패해도 전부 실패한다.
    await Promise.all(ASSETS.map(async u=>{
      try{
        const res = await fetch(new Request(u, { cache:'reload' }));
        if(res && res.ok) await c.put(u, res);
      }catch(_){ /* 없는 파일 하나 때문에 설치가 통째로 깨지면 안 된다 */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k!==CACHE && k!==TILES && k!==PHOTOS && k!==SEEN).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

// 화면 파일 — 인터넷 우선. 새로 받으면 저장분도 갱신한다.
async function networkFirst(req){
  try{
    const res = await fetch(new Request(req, { cache:'reload' }));
    if(res && res.ok){
      const copy = res.clone();
      caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
    }
    return res;
  }catch(_){
    const hit = await caches.match(req);
    return hit || await caches.match('./index.html') || new Response('', {status:504});
  }
}

// 오래된 사진부터 버린다. Cache 는 넣은 차례대로 열쇠를 돌려준다.
// ★ 내 배 사진(PHOTOS)을 버리는 일은 **여기서 안 한다** (4.90).
//
//   여태 이 자리에 trimPhotos 가 있었는데 **아무 데서도 안 불리고 있었다.**
//   그래서 내 배 사진은 한 번도 안 버려지고 계속 쌓이는 중이었다.
//
//   그리고 여기서는 버릴 수가 없다 — 저장분에는 「이게 도면인지 항해 사진인지」가
//   안 적혀 있다. 넣은 순서밖에 모른다. 그러면 제일 먼저 넣고 제일 오래 쓰는
//   도면이 제일 먼저 버려진다. 거꾸로다.
//
//   그것을 아는 것은 앱이다. 그래서 앱의 trimBoatPhotos 한 곳에서만 한다.
//   문이 둘이면 서로 다른 판단을 하고, 그러면 사람은 왜 사진이 사라졌는지 모른다.

// 오래된 것부터 버린다 — 본 사진 자리도 같은 방식이다
async function trimSeen(){
  try{
    const c = await caches.open(SEEN);
    const ks = await c.keys();
    if(ks.length <= SEEN_KEEP) return;
    for(const k of ks.slice(0, ks.length - SEEN_KEEP)) await c.delete(k);
  }catch(_){}
}

// 창고 사진 — 담아 둔 것이 있으면 그것부터. 없으면 받아 오고, 받은 것은 남긴다.
//
// ★ 자리가 둘인 까닭
//   ① PHOTOS(400장) — 배에 나갔을 때 인터넷 없이 봐야 하는 것.
//     무엇을 남길지는 **앱이 고른다**(primePhoto · keepPhoto). 여기 담긴 것은
//     오래돼도 안 버린다. 배에서 못 보면 그때는 방법이 없기 때문이다.
//   ② SEEN(200장) — 그냥 한 번 본 것. 글판·장터·정박지·남의 배 사진.
//     4.82 에서 새로 팠다. 이것이 없으면 화면을 돌아올 때마다 다시 받는다
//     (창고가 「저장하지 마라」 를 붙여 보내기 때문이다 — 위 주석 참고).
//     ★ 오래된 것부터 버린다. ①의 400장은 건드리지 않는다.
async function photoFetch(req){
  try{
    const c = await caches.open(PHOTOS);
    const hit = await c.match(req, { ignoreVary:true });
    if(hit) return hit;
  }catch(_){}
  try{
    const c2 = await caches.open(SEEN);
    const hit2 = await c2.match(req, { ignoreVary:true });
    if(hit2) return hit2;
  }catch(_){}
  try{
    const res = await fetch(req);
    // ★ 200 만 담는다. 오류 화면을 담아 두면 그 사진이 영영 안 보인다.
    if(res && res.status === 200){
      const copy = res.clone();
      caches.open(SEEN)
        .then(c => c.put(req, copy))
        .then(() => trimSeen())
        .catch(()=>{});
    }
    return res;
  }catch(_){ return new Response('', { status:504 }); }
}

self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  let u;
  try{ u = new URL(e.request.url); }catch(err){ return; }

  // 지도 타일: 저장분 우선. 한 번 본 구간은 인터넷이 없어도 남는다.
  if(TILE_HOSTS.includes(u.hostname)){
    e.respondWith(
      caches.match(e.request).then(hit=> hit || fetch(e.request).then(res=>{
        if(res && res.ok){
          const copy = res.clone();
          caches.open(TILES).then(c=>c.put(e.request, copy)).catch(()=>{});
        }
        return res;
      }).catch(()=> new Response('', {status:504})))
    );
    return;
  }

  // 창고 사진: 저장분 우선. 한 번 본 사진은 인터넷이 없어도 남는다.
  if(PHOTO_HOSTS.includes(u.hostname)){
    e.respondWith(photoFetch(e.request));
    return;
  }

  // 그 밖의 외부 요청(날씨 API, Firebase 등)은 건드리지 않는다.
  // 캐시하면 지난 예보가 최신인 것처럼 표시되어 위험하다.
  if(u.origin !== self.location.origin) return;

  // 화면 파일(index.html · 서비스워커 자신 · 화면 이동)은 인터넷 우선
  const isDoc = e.request.mode === 'navigate'
             || /\/(index\.html)?$/.test(u.pathname)
             || u.pathname.endsWith('/sw.js');
  if(isDoc){ e.respondWith(networkFirst(e.request)); return; }

  // 아이콘·매니페스트 같은 것은 저장분 우선 (배 위에서 인터넷이 없다)
  e.respondWith(
    caches.match(e.request).then(hit=> hit || fetch(e.request).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
      return res;
    }).catch(()=>caches.match('./index.html')))
  );
});
