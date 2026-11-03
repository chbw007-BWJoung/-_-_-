const CACHE='tree-diagnosis-integrated-v14';
const ASSETS=[
 './','./index.html','./profile.html','./manager.html','./manifest.webmanifest',
 './diagnosis/','./diagnosis/index.html','./prescription/','./prescription/index.html',
 './jinryobu/','./jinryobu/index.html','./survey/','./survey/index.html','./opinion/','./opinion/index.html',
 './docstore.js','./sync.js','./supabase-config.js','./bio-search.js','./resources.html','./data/insects.json','./data/diseases.json',
 './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png'
];
// 하나라도 실패해도 설치가 중단되지 않도록 개별 저장
self.addEventListener('install',e=>e.waitUntil(
 caches.open(CACHE).then(c=>Promise.all(ASSETS.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',e=>{
 const req=e.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==location.origin)return;              // CDN 등 외부 요청은 건드리지 않음
 // 같은 경로의 서브앱(진료부·기초조사표)은 각자의 서비스워커가 처리
 if(/\/(jinryobu|survey)\/sw\.js$/.test(url.pathname))return;
 // 네트워크 우선 → 실패 시 캐시 (최신 화면 유지 + 오프라인 지원)
 e.respondWith(fetch(req).then(r=>{
   if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
   return r;
 }).catch(()=>caches.match(req).then(c=>c||(req.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
