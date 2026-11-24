const state = {
    category: "morning",
    progress: {}
};

const tabs = document.querySelectorAll(".tab");
const list = document.getElementById("dhikrList");
const title = document.getElementById("categoryTitle");
const percent = document.getElementById("progressPercent");
const resetButton = document.getElementById("resetProgress");

function getCategory() {
    return azkarCategories[state.category];
}

function loadProgress(categoryKey) {
    const category = azkarCategories[categoryKey];

    try {
        return JSON.parse(localStorage.getItem(category.storageKey)) || {};
    } catch (error) {
        return {};
    }
}

function saveProgress() {
    const category = getCategory();
    localStorage.setItem(category.storageKey, JSON.stringify(state.progress));
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

    state.progress[item.id] = Math.min((state.progress[item.id] || 0) + 1, item.count);
    saveProgress();
    renderList();

    if (state.progress[item.id] >= item.count) {
        scrollToNextDhikr(item.id);
    }
});

// بعد إتمام الذكر ينزل تلقائياً للذكر التالي غير المكتمل
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
        if (card) {
            card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        }
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

setCategory(state.category);

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
