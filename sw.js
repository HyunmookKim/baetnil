const CACHE = 'baetnil-3.43';
const TILES = 'baetnil-tiles';   // 지도 타일 전용 (앱 버전을 올려도 지우지 않는다)
const PHOTOS = 'baetnil-photos'; // 창고 사진 전용 (앱 버전을 올려도 지우지 않는다)

// ★ 왜 사진을 여기에 담는가
//   3.34~3.41 에서 사진을 파이어스토어 문서 밖 창고(Storage)로 옮겼다.
//   전송비가 크게 줄었지만, 대신 사진이 '주소' 가 되어 인터넷이 없으면 안 보인다.
//   배 위에서는 인터넷이 없는 것이 보통이다. 한 번 본 사진은 여기에 남긴다.
//   앱 버전을 올려도 지우지 않는다 — 지우면 배에 나갈 때마다 처음부터 다시 받아야 한다.
const PHOTO_HOSTS = ['firebasestorage.googleapis.com'];
const PHOTO_KEEP = 400;          // 이보다 많아지면 오래된 것부터 버린다
const ASSETS = ['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-180.png'];
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
    .then(ks=>Promise.all(ks.filter(k=>k!==CACHE && k!==TILES && k!==PHOTOS).map(k=>caches.delete(k))))
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
async function trimPhotos(){
  try{
    const c = await caches.open(PHOTOS);
    const ks = await c.keys();
    if(ks.length <= PHOTO_KEEP) return;
    for(const k of ks.slice(0, ks.length - PHOTO_KEEP)) await c.delete(k);
  }catch(_){}
}

// 창고 사진 — 저장분 우선.
// ★ 사진 주소는 올릴 때마다 새로 만들어지므로, 같은 주소의 내용이 바뀌는 일이 없다.
//   그래서 저장분에 있으면 그것을 믿어도 된다.
async function photoFetch(req){
  let c = null;
  try{
    c = await caches.open(PHOTOS);
    const hit = await c.match(req, { ignoreVary:true });
    if(hit) return hit;
  }catch(_){}
  // ★ <img> 는 no-cors 로 받아오는데, 그렇게 받은 것은 속을 볼 수 없는 껍데기라
  //   저장분에 담으면 브라우저가 자리를 몇 배로 잡는다.
  //   그래서 먼저 cors 로 받아 본다. 창고가 cors 를 안 주면 그때 원래대로 받는다.
  try{
    const res = await fetch(req.url, { mode:'cors', credentials:'omit' });
    if(res && res.ok){
      if(c) c.put(req, res.clone()).then(trimPhotos).catch(()=>{});
      return res;
    }
  }catch(_){}
  // 담지는 못해도 사진은 보여야 한다
  try{ return await fetch(req); }catch(_){ return new Response('', { status:504 }); }
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
