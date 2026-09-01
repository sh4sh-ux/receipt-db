const CACHE_PREFIX='receipt-db-shell-';
const CACHE_NAME=CACHE_PREFIX+'v2.82';
const SHELL=[
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/categories/bar.png',
  './icons/categories/cafe.png',
  './icons/categories/movie.png',
  './icons/categories/golf.png',
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

async function networkFirst(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request);
    if(response&&response.ok)await cache.put('./index.html',response.clone());
    return response;
  }catch(error){
    return (await cache.match('./index.html'))||(await cache.match('./'))||Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request));
    return;
  }
  if(!SHELL.some(path=>url.pathname.endsWith(path.replace('./','/'))))return;
  event.respondWith(
    caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      if(response&&response.ok)caches.open(CACHE_NAME).then(cache=>cache.put(request,response.clone()));
      return response;
    }))
  );
});
