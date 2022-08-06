//Ran when SW is installed. 
self.addEventListener('install', function (event) {
    console.log("[ServiceWorker] Installed");
});

//Service Worker Activate
self.addEventListener('activate', function(event) {
    console.log("[ServiceWorker] Activating");
});

self.addEventListener('fetch', (event) => {
    console.log('going to ' + event.request.url)
    console.log(event)
})

