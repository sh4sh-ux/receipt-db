const CACHE_PREFIX='receipt-db-shell-';
// ⚠️ APP_VERSION과 같이 올릴 것(scripts/check_app.py가 확인). 이 파일 내용이 바뀌어야 폰이 새 서비스 워커를 설치한다.
const CACHE_NAME=CACHE_PREFIX+'v3.97';
const SHELL=[
  './prepaid.js',
  './prepaid.css',
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
  './icons/categories/spa-line.svg',
  './icons/categories/fitness.svg',
  './icons/categories/celebration.svg',
  './icons/categories/occasion.svg',
  './icons/categories/medical.svg',
  './icons/categories/other-line.svg',
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys
        .filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME)
        .map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});


// v3.97 — 모든 앱 셸 파일을 온라인 최신 우선(network-first)으로. 전에는 prepaid.js·prepaid.css·아이콘이
//   cache-first였고 캐시 이름이 v3.06에 멈춰 있어, 한 번 설치된 폰(특히 아이폰 홈 화면 앱)은 옛 선불권 화면·헤더 CSS를
//   계속 썼다(index.html만 최신 → 탭마다 모양이 어긋남). 연결이 끊겼을 때만 캐시를 쓴다.
async function networkFirst(request,key){
  const cache=await caches.open(CACHE_NAME);
  try{
    // 탐색 요청은 RequestInit을 붙일 수 없어 그대로, 파일은 HTTP 캐시도 재확인(no-cache)
    const response=request.mode==='navigate'?await fetch(request):await fetch(request.url,{cache:'no-cache'});
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
