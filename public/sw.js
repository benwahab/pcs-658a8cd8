const CACHE_NAME="pcs-shell-v5";
const APP_SHELL=["/","/index.html","/manifest.webmanifest","/assets/pcs-splash.jpg","/icons/icon-192.jpg","/icons/icon-512.jpg"];

async function cacheShell(){
  const cache=await caches.open(CACHE_NAME);
  await Promise.allSettled(APP_SHELL.map((url)=>cache.add(url)));
}

async function networkFirst(request){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),3500);
  try{
    const response=await fetch(request,{signal:controller.signal});
    if(response.ok){
      const cache=await caches.open(CACHE_NAME);
      await cache.put("/index.html",response.clone());
    }
    return response;
  }catch{
    const cached=await caches.match("/index.html");
    if(cached)return cached;
    throw new Error("Offline");
  }finally{clearTimeout(timer);}
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request);
  const update=fetch(request).then((response)=>{
    if(response.ok)void cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  if(cached){void update;return cached;}
  const response=await update;
  if(response)return response;
  throw new Error("Resource unavailable");
}

self.addEventListener("install",(event)=>{
  event.waitUntil(cacheShell().then(()=>self.skipWaiting()));
});

self.addEventListener("activate",(event)=>{
  event.waitUntil(
    caches.keys()
      .then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE_NAME).map((key)=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",(event)=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==="navigate"){
    event.respondWith(networkFirst(request));
    return;
  }

  const isCode=request.destination==="script"||request.destination==="style";
  const isStatic=request.destination==="image"||request.destination==="font"||request.destination==="manifest";
  if(isCode){
    event.respondWith(networkFirst(request));
    return;
  }
  if(isStatic){
    event.respondWith(staleWhileRevalidate(request));
  }
});