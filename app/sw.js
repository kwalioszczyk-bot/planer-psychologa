// Planer Gabinetu – service worker: działa offline. Buforuje TYLKO pliki aplikacji, nigdy danych pacjentów.
const CACHE='planer-psychologa-v5';
const CORE=['./','./index.html','./kliniczne.js','./planer.config.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./fonts/fonts.css'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  if(u.hostname.endsWith('googleapis.com')&&!u.hostname.startsWith('fonts')||u.hostname==='accounts.google.com')return; // Google API – zawsze sieć
  if(u.origin===location.origin){ // aplikacja: najpierw sieć (aktualizacje), offline z bufora
    e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
  }else if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return res})));
  }
});
