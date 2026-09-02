const CACHE_PREFIX='receipt-db-shell-';
const CACHE_NAME=CACHE_PREFIX+'v2.92';
const SHELL=[
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

async function applyCategoryGridLayout(response){
  if(!response)return response;
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.includes('text/html'))return response;

  const html=await response.text();
  if(html.includes('id="category-grid-layout"')){
    return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
  }

  const style='<style id="category-grid-layout">.cat-picker-popover{grid-template-columns:repeat(8,minmax(0,1fr))}</style>';
  const transformed=html.includes('</head>')?html.replace('</head>',style+'</head>'):html;
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(transformed,{status:response.status,statusText:response.statusText,headers});
}

async function networkFirst(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request);
    if(response&&response.ok){
      const transformed=await applyCategoryGridLayout(response.clone());
      await cache.put('./index.html',transformed.clone());
      return transformed;
    }
    return response;
  }catch(error){
    const cached=(await cache.match('./index.html'))||(await cache.match('./'));
    return cached?applyCategoryGridLayout(cached):Response.error();
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
