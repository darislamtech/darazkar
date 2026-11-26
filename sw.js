// التطبيق بيفتح على طول من النسخة المحفوظة على الجهاز، سواء فيه إنترنت أو لأ
// (حتى لو الواي فاي أو الداتا شغالين من غير إنترنت فعلي).
// وفي نفس الوقت، في الخلفية، بيجيب أحدث نسخة من الملفات ويحفظها. لو لقى تعديل
// بيبلّغ الصفحة، والصفحة بتتحدث لوحدها (لو لسه محدش بدأ يعدّ) أو في الفتحة الجاية.
// تغيير الرقم ده بيمسح النسخة المحفوظة القديمة كلها ويحمّل الملفات من جديد.
const CACHE_NAME = "dar-al-azkar-v9";

// ملفات الكود اللي بتتحدث في الخلفية مع كل فتح للتطبيق
const CODE_FILES = [
    "./index.html",
    "./style.css",
    "./data.js",
    "./app.js",
    "./manifest.webmanifest"
];

const ASSETS = CODE_FILES.concat([
    "./fonts/noto-naskh-arabic-arabic.woff2",
    "./fonts/noto-naskh-arabic-latin.woff2",
    "./icons/icon.svg",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/maskable-192.png",
    "./icons/maskable-512.png",
    "./icons/apple-touch-icon.png",
    "./icons/favicon-32.png"
]);

// أقصى وقت لانتظار الإنترنت في الخلفية قبل ما نسيب المحاولة للفتحة الجاية
const REFRESH_TIMEOUT_MS = 15000;

self.addEventListener("install", function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(ASSETS.map(function(url) {
                    return new Request(url, { cache: "no-cache" });
                }));
            })
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

function withTimeout(promise, ms) {
    return new Promise(function(resolve, reject) {
        const timer = setTimeout(function() { reject(new Error("timeout")); }, ms);
        promise.then(
            function(value) { clearTimeout(timer); resolve(value); },
            function(error) { clearTimeout(timer); reject(error); }
        );
    });
}

// يجيب ملف واحد من الإنترنت، ولو اتغير عن المحفوظ يحفظه ويرجّع true
function refreshFile(cache, url) {
    return withTimeout(fetch(url, { cache: "no-cache" }), REFRESH_TIMEOUT_MS)
        .then(function(response) {
            if (!response.ok) return false;
            return Promise.all([response.clone().text(), cache.match(url)])
                .then(function(results) {
                    const fresh = results[0];
                    const saved = results[1];
                    return (saved ? saved.text() : Promise.resolve(null)).then(function(old) {
                        if (old === fresh) return false;
                        return cache.put(url, response).then(function() { return true; });
                    });
                });
        })
        .catch(function() { return false; });
}

// يحدّث كل ملفات الكود مع بعض، ولو فيه أي تعديل يبلّغ الصفحات المفتوحة
let refreshing = null;
function refreshCode() {
    if (refreshing) return refreshing;

    refreshing = caches.open(CACHE_NAME)
        .then(function(cache) {
            return Promise.all(CODE_FILES.map(function(url) { return refreshFile(cache, url); }));
        })
        .then(function(changes) {
            if (!changes.some(Boolean)) return;
            return self.clients.matchAll({ type: "window" }).then(function(clients) {
                clients.forEach(function(client) { client.postMessage({ type: "updated" }); });
            });
        })
        .finally(function() { refreshing = null; });

    return refreshing;
}

self.addEventListener("message", function(event) {
    if (event.data && event.data.type === "refresh") {
        event.waitUntil(refreshCode());
    }
});

self.addEventListener("fetch", function(event) {
    const request = event.request;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

    // الصفحة نفسها: من النسخة المحفوظة على طول، والتحديث في الخلفية
    if (request.mode === "navigate") {
        event.respondWith(
            caches.match("./index.html").then(function(cached) {
                return cached || fetch(request);
            })
        );
        event.waitUntil(refreshCode());
        return;
    }

    // باقي الملفات: من النسخة المحفوظة على طول، ولو مش محفوظة من الإنترنت
    event.respondWith(
        caches.match(request, { ignoreSearch: true }).then(function(cached) {
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
