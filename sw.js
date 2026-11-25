// ملفات الكود (الصفحة، الأذكار، الشكل، البرمجة) بتيجي من الشبكة أولاً، فأي تعديل بيوصل لوحده أول ما التطبيق يتفتح.
// النسخة المحفوظة بتستخدم بس لما يكون مفيش إنترنت. تغيير الرقم ده بيمسح النسخة المحفوظة القديمة كلها.
const CACHE_NAME = "dar-al-azkar-v8";

const ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./data.js",
    "./app.js",
    "./manifest.webmanifest",
    "./fonts/noto-naskh-arabic-arabic.woff2",
    "./fonts/noto-naskh-arabic-latin.woff2",
    "./icons/icon.svg",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/maskable-192.png",
    "./icons/maskable-512.png",
    "./icons/apple-touch-icon.png",
    "./icons/favicon-32.png"
];

self.addEventListener("install", function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) { return cache.addAll(ASSETS); })
            .then(function() { return self.skipWaiting(); })
    );
});

self.addEventListener("activate", function(event) {
    event.waitUntil(
        caches.keys()
            .then(function(keys) {
                return Promise.all(keys
                    .filter(function(key) { return key !== CACHE_NAME; })
                    .map(function(key) { return caches.delete(key); }));
            })
            .then(function() { return self.clients.claim(); })
    );
});

self.addEventListener("fetch", function(event) {
    const request = event.request;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

    // الصفحة نفسها: من الشبكة أولاً ثم النسخة المحفوظة عند انقطاع الإنترنت
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request, { cache: "no-cache" })
                .then(function(response) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) { cache.put("./index.html", copy); });
                    return response;
                })
                .catch(function() { return caches.match("./index.html"); })
        );
        return;
    }

    // ملفات الكود: من الشبكة أولاً (مع التأكد إنها أحدث نسخة) ثم المحفوظة عند انقطاع الإنترنت
    if (/\.(js|css|webmanifest)$/.test(new URL(request.url).pathname)) {
        event.respondWith(
            fetch(request, { cache: "no-cache" })
                .then(function(response) {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) { cache.put(request, copy); });
                    }
                    return response;
                })
                .catch(function() {
                    return caches.match(request, { ignoreSearch: true });
                })
        );
        return;
    }

    // الخطوط والأيقونات: من النسخة المحفوظة أولاً
    event.respondWith(
        caches.match(request).then(function(cached) {
            return cached || fetch(request).then(function(response) {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) { cache.put(request, copy); });
                }
                return response;
            });
        })
    );
});
