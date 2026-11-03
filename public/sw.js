const CACHE_NAME="pcs-shell-v26";
const APP_SHELL=["/","/manifest.webmanifest?v=15","/assets/pcs-favicon.svg"];

async function cacheShell(){
  const cache=await caches.open(CACHE_NAME);
  await Promise.allSettled(APP_SHELL.map((url)=>cache.add(url)));
}

async function networkFirst(request){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),2000);
  const cache=await caches.open(CACHE_NAME);
  const cacheKey=request.url;
  try{
    const response=await fetch(request,{signal:controller.signal});
    if(response.ok && response.type!=="opaque") await cache.put(cacheKey,response.clone());
    return response;
  }catch{
    const cached=await cache.match(cacheKey);
    if(cached)return cached;
    if(request.mode==="navigate"){
      const home=await cache.match(new URL("/",self.location.origin).href);
      if(home)return home;
    }
    return new Response(request.mode==="navigate"?"<!doctype html><html lang=\"fr\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>PCS hors connexion</title><body><main><h1>PCS</h1><p>Connexion indisponible. Reconnectez-vous pour consulter les pages et envoyer un signalement.</p></main></body></html>":"Ressource temporairement indisponible.",{status:503,headers:{"Content-Type":request.mode==="navigate"?"text/html; charset=utf-8":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  }finally{clearTimeout(timer);}
}

async function cacheFirstBuildAsset(request){
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request);
  if(cached)return cached;
  try{
    const response=await fetch(request);
    if(response.ok && response.type!=="opaque")await cache.put(request,response.clone());
    return response;
  }catch{
    return new Response("Ressource PCS non disponible hors connexion.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  }
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request);
  const update=fetch(request).then((response)=>{
    if(response.ok && response.type!=="opaque")void cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  if(cached){void update;return cached;}
  const response=await update;
  if(response)return response;
  return new Response("Ressource temporairement indisponible.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
}

self.addEventListener("install",(event)=>{
  event.waitUntil(cacheShell().then(()=>self.skipWaiting()));
});

self.addEventListener("activate",(event)=>{
  event.waitUntil(caches.keys().then(async(keys)=>{
    const current=await caches.open(CACHE_NAME);
    for(const key of keys.filter((name)=>name.startsWith("pcs-shell-")&&name!==CACHE_NAME)){
      const previous=await caches.open(key);
      for(const request of await previous.keys()){
        if(!await current.match(request)){
          const response=await previous.match(request);
          if(response)await current.put(request,response);
        }
      }
      await caches.delete(key);
    }
  }).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",(event)=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  // Never cache API, authentication, or other application data endpoints.
  if(url.pathname.startsWith("/api/")||url.pathname.startsWith("/auth/"))return;
  if(request.mode==="navigate"){
    event.respondWith(networkFirst(request));
    return;
  }
  // Vite build assets use content-hashed filenames and are immutable by URL.
  const isHashedBuildAsset=url.pathname.startsWith("/assets/")&&/-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(url.pathname);
  if(isHashedBuildAsset&&(request.destination==="script"||request.destination==="style")){
    event.respondWith(cacheFirstBuildAsset(request));
    return;
  }
  const isStatic=request.destination==="image"||request.destination==="font"||request.destination==="manifest";
  if(isStatic)event.respondWith(staleWhileRevalidate(request));
});