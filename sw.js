const CACHE_PREFIX='receipt-db-shell-';
// ⚠️ APP_VERSION과 같이 올릴 것(scripts/check_app.py가 확인). 이 파일 내용이 바뀌어야 폰이 새 서비스 워커를 설치한다.
const APP_VERSION='v5.52';
const CACHE_NAME=CACHE_PREFIX+APP_VERSION;
const SHELL=[
  './prepaid.js',
  './prepaid.css',
  './advance.js',
  './advance.css',
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/categories/dining.svg',
  './icons/categories/cafe-line.svg',
  './icons/categories/bar-line.svg',
  './icons/categories/karaoke.svg',
  './icons/categories/shopping.svg',
  './icons/categories/culture.svg',
  './icons/categories/transport.svg',
  './icons/categories/travel.svg',
  './icons/categories/lodging.svg',
  './icons/categories/golf-line.svg',
  './icons/categories/beauty-line.svg',
  './icons/categories/fitness.svg',
  './icons/categories/celebration.svg',
  './icons/categories/occasion.svg',
  './icons/categories/medical.svg',
  './icons/categories/other-line.svg',
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache=>{
      // 문서만 업데이트의 필수 조건으로 둔다. 아이콘 등 부가 파일 하나의 일시적 실패가
      // 새 워커 전체의 설치를 취소해 구버전에 고정시키지 않도록 각각 독립적으로 저장한다.
      await cache.add(new Request('./index.html',{cache:'reload'}));
      await Promise.allSettled(SHELL
        .filter(path=>path!=='./index.html')
        .map(path=>cache.add(new Request(path,{cache:'reload'}))));
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys
        .filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME)
        .map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
      // v5.36 — 열린 화면을 워커가 직접 navigate하지 않는다. 입력 중인 화면까지 새로고침돼 글이 사라졌다.
      //          갱신 시점은 페이지가 controllerchange에서 입력 상태를 보고 정한다(_appUpdateBusy).
  );
});


// v3.97 — 모든 앱 셸 파일을 온라인 최신 우선(network-first)으로. 전에는 prepaid.js·prepaid.css·아이콘이
//   cache-first였고 캐시 이름이 v3.06에 멈춰 있어, 한 번 설치된 폰(특히 아이폰 홈 화면 앱)은 옛 선불권 화면·헤더 CSS를
//   계속 썼다(index.html만 최신 → 탭마다 모양이 어긋남). 연결이 끊겼을 때만 캐시를 쓴다.
async function networkFirst(request,key){
  const cache=await caches.open(CACHE_NAME);
  try{
    // iOS 홈 화면 앱이 오래된 index.html HTTP 캐시를 돌려주지 못하도록 문서는 완전히 우회한다.
    const response=request.mode==='navigate'
      ?await fetch(new Request(request,{cache:'no-store'}))
      :await fetch(request.url,{cache:'no-cache'});
    if(response&&response.ok)await cache.put(key||request,response.clone());
    return response;
  }catch(error){
    return (await cache.match(key||request,{ignoreSearch:true}))||(request.mode==='navigate'?await cache.match('./'):undefined)||Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request,'./index.html'));
    return;
  }
  if(!SHELL.some(path=>url.pathname.endsWith(path.replace('./','/'))))return;
  event.respondWith(networkFirst(request));
});
