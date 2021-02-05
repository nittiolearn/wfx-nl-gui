const cacheStatic = 'NittioApp-Static-0.0.0';
const cacheDynamic = 'NittioApp-Dynamic-0.0.0';
const assets = [
  '/#/home',
  '../../views/default/index.html',
  './nittioold.css',
  './nl.bundle.css',
  './nittioold.bundle.js',
  './nl.bundle.js',
  './sw_entry.js',
  './service_worker.js'
];

// Install Event
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(cacheStatic).then(cache => {
      cache.addAll(assets);
    })
  );
});

// Activate Event
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        .filter(key => key !== cacheStatic && key !== cacheDynamic)
        .map(key => caches.delete(key))
      );
    })
  );
});

// Fetch Events
self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(cacheRes => {
      return cacheRes || fetch(evt.request).then(fetchRes => {
        return caches.open(cacheDynamic).then(cache => {
          cache.put(evt.request.url, fetchRes.clone());
          return fetchRes;
        })
      });
    }).catch(() => {
      if (evt.request.url.indexOf('.html') > -1) {
        return caches.match('./fallback.html');
      } 
    })
  );
});