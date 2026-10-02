const STATIC_CACHE='campusos-static-v2';
const ANNOUNCEMENT_CACHE='campusos-announcements-v1';
const STATIC=['./','./index.html','./styles.css','./app.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(STATIC_CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const isAttachment=url.hostname.includes('supabase.co')&&url.pathname.includes('/storage/v1/object/');
  if(isAttachment){
    event.respondWith(caches.open(ANNOUNCEMENT_CACHE).then(async c=>{
      const hit=await c.match(event.request);
      try{const net=await fetch(event.request);if(net.ok){c.put(event.request,net.clone()).catch(()=>{});return net}}catch{}
      return hit||Response.error();
    }));
    return;
  }
  if(url.origin===location.origin){
    event.respondWith(fetch(event.request).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
  }
});
