/* KYRO service worker — network-first shell with consent-based activation */
const SW_VERSION = "2026-08-01-bulletproof-update-share-v14";
const CACHE_VERSION = "kyro-shell-" + SW_VERSION;
const PREF_CACHE = "kyro-preferences-v1";
const LANGUAGE_REQUEST = new Request(new URL("./__kyro_language__", self.location.href));
const SHELL_ASSETS = [
  "./manifest.json", "./manifest-en.json", "./icon-192.png", "./icon-512.png"
];
const NAVIGATION_TIMEOUT_MS = 2500;

function isCacheableResponse(response){return response&&response.ok&&response.type!=="opaque";}
function canonicalIndexUrl(){return new URL("./index.html",self.location.href).href;}

async function saveLanguage(value){
  const cache=await caches.open(PREF_CACHE);
  await cache.put(LANGUAGE_REQUEST,new Response(value==="en"?"en":"pt",{headers:{"content-type":"text/plain"}}));
}
async function readLanguage(){
  try{
    const response=await(await caches.open(PREF_CACHE)).match(LANGUAGE_REQUEST);
    return response&&(await response.text())==="pt"?"pt":"en";
  }catch(_){return "en";}
}
async function cacheFreshIndex(cache){
  const url=new URL("./index.html",self.location.href);
  url.searchParams.set("kyro_install",SW_VERSION);
  const response=await fetch(url.href,{cache:"no-store",credentials:"same-origin"});
  if(!isCacheableResponse(response))return false;
  await Promise.all([
    cache.put(canonicalIndexUrl(),response.clone()),
    cache.put(new URL("./",self.location.href).href,response.clone())
  ]);
  return true;
}

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_VERSION);
    try{await cacheFreshIndex(cache);}catch(_){}
    await Promise.allSettled(SHELL_ASSETS.map(asset=>cache.add(new Request(asset,{cache:"reload"}))));
    // First install may activate immediately. Upgrades wait for the person's Update choice.
    if(!self.registration.active)await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>(key.startsWith("kyro-shell-")||key.startsWith("ramon-log-"))&&key!==CACHE_VERSION).map(key=>caches.delete(key)));
    if("navigationPreload" in self.registration){try{await self.registration.navigationPreload.enable();}catch(_){}}
    await self.clients.claim();
  })());
});
self.addEventListener("message",event=>{
  const data=event.data||{};
  const port=event.ports&&event.ports[0];
  if(data.type==="GET_VERSION"){
    if(port)port.postMessage({type:"KYRO_SW_VERSION",version:SW_VERSION});
    return;
  }
  if(data.type==="SKIP_WAITING"){
    event.waitUntil(self.skipWaiting());
    return;
  }
  if(data.type==="REFRESH_SHELL"){
    event.waitUntil((async()=>{
      let ok=false;
      try{ok=await cacheFreshIndex(await caches.open(CACHE_VERSION));}catch(_){}
      if(port)port.postMessage({ok,version:SW_VERSION});
    })());
    return;
  }
  if(data.type==="CLEAR_SHELL"){
    event.waitUntil((async()=>{
      const keys=await caches.keys();
      await Promise.all(keys.filter(key=>key.startsWith("kyro-shell-")||key.startsWith("ramon-log-")).map(key=>caches.delete(key)));
      if(port)port.postMessage({ok:true});
    })());
    return;
  }
  if(data.type==="SET_LANGUAGE")event.waitUntil(saveLanguage(data.language));
});

async function storeNavigationResponse(response){
  if(!isCacheableResponse(response))return false;
  const cache=await caches.open(CACHE_VERSION);
  await Promise.all([
    cache.put(canonicalIndexUrl(),response.clone()),
    cache.put(new URL("./",self.location.href).href,response.clone())
  ]);
  return true;
}
async function navigationFromNetwork(request,preloadPromise){
  try{
    const preload=await preloadPromise;
    if(isCacheableResponse(preload))return preload;
  }catch(_){}
  try{return await fetch(new Request(request,{cache:"no-store"}));}catch(_){return null;}
}
async function networkFirstNavigation(event){
  const networkPromise=navigationFromNetwork(event.request,event.preloadResponse);
  const timed=await Promise.race([
    networkPromise,
    new Promise(resolve=>setTimeout(()=>resolve(null),NAVIGATION_TIMEOUT_MS))
  ]);
  if(isCacheableResponse(timed)){
    event.waitUntil(storeNavigationResponse(timed.clone()).catch(()=>false));
    return timed;
  }

  const cache=await caches.open(CACHE_VERSION);
  const cached=await cache.match(canonicalIndexUrl(),{ignoreSearch:true})||await cache.match(new URL("./",self.location.href).href,{ignoreSearch:true});
  if(cached){
    event.waitUntil(networkPromise.then(async response=>{if(isCacheableResponse(response))await storeNavigationResponse(response.clone());}).catch(()=>undefined));
    return cached;
  }
  const late=await networkPromise;
  if(isCacheableResponse(late)){
    event.waitUntil(storeNavigationResponse(late.clone()).catch(()=>false));
    return late;
  }
  return new Response("KYRO is temporarily offline. Reconnect and try again.",{status:503,headers:{"content-type":"text/plain; charset=utf-8"}});
}
async function staleWhileRevalidate(request,event){
  const cache=await caches.open(CACHE_VERSION);
  const cached=await cache.match(request,{ignoreSearch:true});
  const update=fetch(request,{cache:"no-cache"}).then(async response=>{
    if(isCacheableResponse(response))await cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  if(cached){event.waitUntil(update.catch(()=>undefined));return cached;}
  return await update||Response.error();
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||request.headers.has("authorization"))return;

  // Update metadata and worker scripts must always bypass the application cache.
  if(url.pathname.endsWith("/version.json")||url.pathname.endsWith("/sw.js")||url.searchParams.has("kyro_version_probe")||url.searchParams.has("kyro_update_check"))return;

  if(request.mode==="navigate"||request.destination==="document"){
    event.respondWith(networkFirstNavigation(event));
    return;
  }
  if(new Set(["script","style","image","font","manifest"]).has(request.destination)){
    event.respondWith(staleWhileRevalidate(request,event));
  }
});

function cleanNotificationText(value,fallback,maxLength){
  const text=typeof value==="string"?value.replace(/[\u0000-\u001F\u007F]/g," ").trim():"";
  return(text||fallback).slice(0,maxLength);
}
self.addEventListener("push",event=>{
  event.waitUntil((async()=>{
    let payload={};try{payload=event.data?event.data.json():{};}catch(_){}
    const notification=payload.notification||{},lang=await readLanguage();
    const title=cleanNotificationText(notification.title||payload.title,"KYRO",80);
    const fallback=lang==="en"?"You have a new notification.":"Você tem uma nova notificação.";
    const body=cleanNotificationText(notification.body||payload.body,fallback,240);
    await self.registration.showNotification(title,{body,icon:"./icon-192.png",badge:"./icon-192.png",tag:"kyro-notification",renotify:false,data:{url:"./index.html?lang="+lang}});
  })());
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const lang=await readLanguage(),url="./index.html?lang="+lang;
    const list=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of list){if("focus" in client){await client.focus();if("navigate" in client)await client.navigate(url);return;}}
    if(self.clients.openWindow)await self.clients.openWindow(url);
  })());
});
