// اليوم الجديد يبدأ الساعة 3 الفجر (عشان أذكار النوم بعد نص الليل تتحسب لنفس الليلة)
const DAY_START_HOUR = 3;
// الصباح من 3 الفجر لحد 3 العصر، والمساء من 3 العصر لحد 3 الفجر
const EVENING_START_HOUR = 15;
// بالليل بعد الساعة دي، لو أذكار المساء خلصت يفتح على أذكار النوم
const SLEEP_START_HOUR = 21;
// المسافة بين آخر مربع الذكر وأسفل الشاشة بعد الانتقال للذكر التالي (حوالي 10 سم)
const CARD_BOTTOM_GAP = 350;

const state = {
    category: "morning",
    progress: {},
    day: "",
    autoKey: ""
};

const tabs = document.querySelectorAll(".tab");
const list = document.getElementById("dhikrList");
const title = document.getElementById("categoryTitle");
const percent = document.getElementById("progressPercent");
const resetButton = document.getElementById("resetProgress");

function getCategory() {
    return azkarCategories[state.category];
}

function pad(value) {
    return String(value).padStart(2, "0");
}

function getDayKey(now) {
    const shifted = new Date(now || Date.now());
    shifted.setHours(shifted.getHours() - DAY_START_HOUR);
    return shifted.getFullYear() + "-" + pad(shifted.getMonth() + 1) + "-" + pad(shifted.getDate());
}

// التقدم محفوظ مع تاريخ اليوم، ولو اليوم اتغير يرجع من الأول
function loadProgress(categoryKey) {
    const category = azkarCategories[categoryKey];

    try {
        const saved = JSON.parse(localStorage.getItem(category.storageKey));
        if (saved && saved.day === getDayKey() && saved.progress) {
            return saved.progress;
        }
    } catch (error) {
        // تجاهل البيانات التالفة
    }

    return {};
}

function saveProgress() {
    const category = getCategory();
    localStorage.setItem(category.storageKey, JSON.stringify({
        day: getDayKey(),
        progress: state.progress
    }));
}

function isCategoryComplete(categoryKey) {
    const progress = loadProgress(categoryKey);

    return azkarCategories[categoryKey].items.every(function(item) {
        return (progress[item.id] || 0) >= item.count;
    });
}

// يختار القسم المناسب حسب وقت فتح التطبيق
function getCategoryForNow() {
    const hour = new Date().getHours();
    const isEvening = hour >= EVENING_START_HOUR || hour < DAY_START_HOUR;

    if (!isEvening) return "morning";

    const isNight = hour >= SLEEP_START_HOUR || hour < DAY_START_HOUR;
    if (isNight && isCategoryComplete("evening")) return "sleep";

    return "evening";
}

function getPeriodKey() {
    const hour = new Date().getHours();
    const isEvening = hour >= EVENING_START_HOUR || hour < DAY_START_HOUR;
    return getDayKey() + (isEvening ? "-evening" : "-morning");
}

function getCompletedCount() {
    const category = getCategory();

    return category.items.reduce(function(total, item) {
        return total + Math.min(state.progress[item.id] || 0, item.count);
    }, 0);
}

function getTotalCount() {
    return getCategory().items.reduce(function(total, item) {
        return total + item.count;
    }, 0);
}

function updateSummary() {
    const total = getTotalCount();
    const completed = getCompletedCount();
    const value = total === 0 ? 0 : Math.round((completed / total) * 100);

    title.textContent = getCategory().title;
    percent.textContent = value + "%";
    document.documentElement.style.setProperty("--progress", value + "%");
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderList() {
    const category = getCategory();
    list.innerHTML = "";

    category.items.forEach(function(item) {
        const done = Math.min(state.progress[item.id] || 0, item.count);
        const remaining = Math.max(item.count - done, 0);
        const complete = remaining === 0;
        const card = document.createElement("article");

        card.className = "dhikr-card" + (complete ? " complete" : "");
        card.dataset.id = item.id;
        card.innerHTML = [
            '<div class="card-top">',
            '<span class="counter">' + done + " / " + item.count + "</span>",
            item.note ? '<span class="note">' + escapeHtml(item.note) + "</span>" : "",
            "</div>",
            '<p class="dhikr-text">' + escapeHtml(item.text) + "</p>",
            item.fadl ? '<p class="dhikr-fadl">' + escapeHtml(item.fadl) + "</p>" : "",
            '<button class="count-button" type="button" data-id="' + item.id + '"' + (complete ? " disabled" : "") + ">",
            complete ? "تم الذكر" : "تكرار متبقّي: " + remaining,
            "</button>"
        ].join("");

        list.appendChild(card);
    });

    updateSummary();
}

function setCategory(categoryKey) {
    state.category = categoryKey;
    state.progress = loadProgress(categoryKey);
    state.day = getDayKey();

    tabs.forEach(function(tab) {
        tab.classList.toggle("active", tab.dataset.category === categoryKey);
    });

    renderList();
}

list.addEventListener("click", function(event) {
    const button = event.target.closest(".count-button");
    if (!button) return;

    const item = getCategory().items.find(function(entry) {
        return entry.id === button.dataset.id;
    });

    if (!item) return;

    // لو اليوم اتغير والتطبيق مفتوح، ابدأ يوم جديد قبل العد
    if (state.day !== getDayKey()) {
        state.progress = {};
        state.day = getDayKey();
    }

    state.progress[item.id] = Math.min((state.progress[item.id] || 0) + 1, item.count);
    saveProgress();
    renderList();

    if (state.progress[item.id] >= item.count) {
        scrollToNextDhikr(item.id);
    }
});

// بعد إتمام الذكر ينزل تلقائياً للذكر التالي غير المكتمل،
// بحيث آخر مربع الذكر (والزر) يقف دايماً على بعد حوالي 5 سم من أسفل الشاشة (مكان الصباع)، مهما كان طول الذكر
function scrollToNextDhikr(finishedId) {
    const items = getCategory().items;
    const start = items.findIndex(function(entry) { return entry.id === finishedId; });
    const ordered = items.slice(start + 1).concat(items.slice(0, start));
    const next = ordered.find(function(entry) {
        return (state.progress[entry.id] || 0) < entry.count;
    });

    if (!next) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setTimeout(function() {
        const card = list.querySelector('.dhikr-card[data-id="' + next.id + '"]');
        if (!card) return;

        const offset = card.getBoundingClientRect().bottom - (window.innerHeight - CARD_BOTTOM_GAP);
        window.scrollTo({
            top: window.scrollY + offset,
            behavior: reduceMotion ? "auto" : "smooth"
        });
    }, 350);
}

tabs.forEach(function(tab) {
    tab.addEventListener("click", function() {
        setCategory(tab.dataset.category);
    });
});

resetButton.addEventListener("click", function() {
    state.progress = {};
    saveProgress();
    renderList();
});

function openCategoryForNow() {
    state.autoKey = getPeriodKey();
    setCategory(getCategoryForNow());
    window.scrollTo(0, 0);
}

// لما ترجع للتطبيق وهو مفتوح في الخلفية: لو الفترة اتغيرت (صباح/مساء/يوم جديد) يتحدث لوحده
document.addEventListener("visibilitychange", function() {
    if (document.visibilityState !== "visible") return;

    if (state.autoKey !== getPeriodKey()) {
        openCategoryForNow();
    } else if (state.day !== getDayKey()) {
        setCategory(state.category);
    }
});

openCategoryForNow();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function() {
        navigator.serviceWorker.register("sw.js").catch(function() {});
    });
}

// زر تثبيت التطبيق على الموبايل (أندرويد / كروم) وتلميح للآيفون
(function() {
    const installButton = document.getElementById("installApp");
    const iosHint = document.getElementById("iosHint");
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    let deferredPrompt = null;

    if (standalone) return;

    window.addEventListener("beforeinstallprompt", function(event) {
        event.preventDefault();
        deferredPrompt = event;
        installButton.hidden = false;
    });

    installButton.addEventListener("click", function() {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function() {
            deferredPrompt = null;
            installButton.hidden = true;
        });
    });

    window.addEventListener("appinstalled", function() {
        installButton.hidden = true;
    });

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIos && !localStorage.getItem("dar_azkar_ios_hint_seen")) {
        iosHint.hidden = false;
        localStorage.setItem("dar_azkar_ios_hint_seen", "1");
    }
})();
