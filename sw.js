/* KYRO service worker — bilingual fast-start build */
const CACHE_VERSION = "kyro-shell-2026-08-01-onboarding-auto-language-v2";
const PREF_CACHE = "kyro-preferences-v1";
const LANGUAGE_REQUEST = new Request(new URL("./__kyro_language__", self.location.href));
const SHELL_ASSETS = [
  "./", "./index.html", "./manifest.json", "./manifest-en.json",
  "./icon-192.png", "./icon-512.png"
];

async function saveLanguage(value){
  const lang=value==="en"?"en":"pt";
  const cache=await caches.open(PREF_CACHE);
  await cache.put(LANGUAGE_REQUEST,new Response(lang,{headers:{"content-type":"text/plain"}}));
}
async function readLanguage(){
  try{
    const cache=await caches.open(PREF_CACHE), response=await cache.match(LANGUAGE_REQUEST);
    const value=response?await response.text():"en";
    return value==="en"?"en":"pt";
  }catch(_){ return "en"; }
}

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_VERSION);
    await Promise.allSettled(SHELL_ASSETS.map(asset=>cache.add(new Request(asset,{cache:"reload"}))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>(key.startsWith("kyro-shell-")||key.startsWith("ramon-log-"))&&key!==CACHE_VERSION).map(key=>caches.delete(key)));
    if("navigationPreload" in self.registration){ try{await self.registration.navigationPreload.enable();}catch(_){} }
    await self.clients.claim();
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    await Promise.all(windows.map(client=>"navigate" in client?client.navigate(client.url).catch(()=>undefined):undefined));
  })());
});

self.addEventListener("message",event=>{
  if(event.data&&event.data.type==="SKIP_WAITING") self.skipWaiting();
  if(event.data&&event.data.type==="SET_LANGUAGE") event.waitUntil(saveLanguage(event.data.language));
});

function isCacheableResponse(response){return response&&response.ok&&response.type!=="opaque";}
async function updateNavigationCache(request){
  const cache=await caches.open(CACHE_VERSION);
  try{
    const response=await fetch(request,{cache:"no-store"});
    if(isCacheableResponse(response)) await Promise.all([cache.put(request,response.clone()),cache.put("./index.html",response.clone())]);
    return response;
  }catch(_){return null;}
}
async function fastNavigation(request,preloadPromise){
  const cache=await caches.open(CACHE_VERSION);
  const cached=await cache.match(request,{ignoreSearch:true})||await cache.match("./index.html",{ignoreSearch:true})||await cache.match("./",{ignoreSearch:true});
  const refreshPromise=(async()=>{
    try{
      const preload=await preloadPromise;
      if(isCacheableResponse(preload)){
        await Promise.all([cache.put(request,preload.clone()),cache.put("./index.html",preload.clone())]);
        return preload;
      }
    }catch(_){}
    return updateNavigationCache(request);
  })();
  if(cached) return {response:cached,refreshPromise};
  return {response:await refreshPromise||Response.error(),refreshPromise:Promise.resolve()};
}
async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE_VERSION),cached=await cache.match(request,{ignoreSearch:true});
  const update=fetch(request,{cache:"no-store"}).then(async response=>{if(isCacheableResponse(response))await cache.put(request,response.clone());return response;}).catch(()=>null);
  return {response:cached||await update||Response.error(),update};
}
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||request.headers.has("authorization"))return;
  if(request.mode==="navigate"||request.destination==="document"){
    const task=fastNavigation(request,event.preloadResponse);
    event.respondWith(task.then(result=>result.response));
    event.waitUntil(task.then(result=>result.refreshPromise).catch(()=>undefined));
    return;
  }
  if(new Set(["script","style","image","font","manifest"]).has(request.destination)){
    const task=staleWhileRevalidate(request);
    event.respondWith(task.then(result=>result.response));
    event.waitUntil(task.then(result=>result.update).catch(()=>undefined));
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
    const clientsList=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of clientsList){if("focus" in client){await client.focus();if("navigate" in client)await client.navigate(url);return;}}
    if(self.clients.openWindow)await self.clients.openWindow(url);
  })());
});
