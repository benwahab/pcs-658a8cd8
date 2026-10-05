const CACHE_NAME="pcs-shell-v11";
const APP_SHELL=["/","/manifest.webmanifest?v=3","/icons/pcs-official.svg?v=3"];

async function cacheShell(){
  const cache=await caches.open(CACHE_NAME);
  await Promise.allSettled(APP_SHELL.map((url)=>cache.add(url)));
}

async function networkFirst(request){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  const cache=await caches.open(CACHE_NAME);
  const cacheKey=request.url;
  try{
    const response=await fetch(request,{signal:controller.signal});
    if(response.ok && response.type!=="opaque") await cache.put(cacheKey,response.clone());
    return response;
  }catch{
    const cached=await cache.match(cacheKey);
    if(cached)return cached;
    const url=new URL(request.url);
    if(request.mode==="navigate" && url.pathname==="/" && url.search===""){
      const home=await cache.match(new URL("/",self.location.origin).href);
      if(home)return home;
    }
    return new Response(
      request.mode==="navigate"
        ? "<!doctype html><html lang=\"fr\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>PCS hors connexion</title><body><main><h1>PCS</h1><p>Connexion indisponible. Reconnectez-vous pour consulter les pages et envoyer un signalement.</p></main></body></html>"
        : "Ressource temporairement indisponible.",
      {status:503,headers:{"Content-Type":request.mode==="navigate"?"text/html; charset=utf-8":"text/plain; charset=utf-8","Cache-Control":"no-store"}}
    );
  }finally{clearTimeout(timer);}
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
  event.waitUntil(
    caches.keys()
      .then((keys)=>Promise.all(keys.filter((key)=>key.startsWith("pcs-shell-")&&key!==CACHE_NAME).map((key)=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",(event)=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  // Do not cache API, authentication, or other application data endpoints.
  if(url.pathname.startsWith("/api/")||url.pathname.startsWith("/auth/"))return;

  if(request.mode==="navigate"){
    event.respondWith(networkFirst(request));
    return;
  }

  // Never cache executable code: mixing old JS chunks with a newer HTML shell can
  // break dynamic imports after a deployment. Let the browser fetch code directly.
  if(request.destination==="script"||request.destination==="style")return;

  const isStatic=request.destination==="image"||request.destination==="font"||request.destination==="manifest";
  if(isStatic)event.respondWith(staleWhileRevalidate(request));
});