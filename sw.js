var CACHE_NAME = "budget-pwa-v8";
var APP_SHELL = [
  "./",
  "index.html",
  "manifest.json",
  "css/styles.css",
  "js/utils.js",
  "js/db.js",
  "js/categories.js",
  "js/derived.js",
  "js/budgets.js",
  "js/charts.js",
  "js/forms.js",
  "js/home.js",
  "js/trends.js",
  "js/profile.js",
  "js/bankAccounts.js",
  "js/investments.js",
  "js/loans.js",
  "js/creditCards.js",
  "js/about.js",
  "js/accounts.js",
  "js/app.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon-180.png",
];

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE_NAME;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy);
        });
        return response;
      }).catch(function () {
        return cached;
      });
    })
  );
});
