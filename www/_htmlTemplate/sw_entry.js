// Register Service Worker (PWA)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/static/_script_bundles/service_worker.js')
    .then(reg => console.log('service worker registered', reg))
    .catch(error => console.log('service worker not registered', error));
}
