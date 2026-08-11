const CACHE = 'baetnil-3.10';
const TILES = 'baetnil-tiles';   // 지도 타일 전용 (앱 버전을 올려도 지우지 않는다)
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
    .then(ks=>Promise.all(ks.filter(k=>k!==CACHE && k!==TILES).map(k=>caches.delete(k))))
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
