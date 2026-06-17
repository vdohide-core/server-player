/**
 * Advert Image — Image ad overlay for JWPlayer
 *
 * Self-contained module. Load this script to enable:
 * - Image overlay on player ready / pause / end
 * - Clickable image linking to advertiser website
 * - Close button to dismiss overlay
 * - Multiple ads supported — randomly selects one each time
 *
 * Fetches ads from {playerConfig.static}/image/{playerConfig.adSlug}.json
 *
 * Usage in embed.html:
 *   <script src="/js/advert-image.js"></script>   ← เปิดใช้
 *   <!-- <script src="/js/advert-image.js"></script> -->  ← ปิด
 *
 * Integration (called by jw-v2.js if available):
 *   window.AdvertImage.init(jwplayerInstance)
 *   window.AdvertImage.stop()
 */
(function () {
  // ─── State ─────────────────────────────────────────────────────
  var player = null;
  var ads = []; // array of { imageUrl, websiteUrl, showOn }
  var overlay = null;
  var styleEl = null;
  var dismissed = {}; // ready = once per session after close
  var currentAd = null;
  var activeEventType = null;
  var pendingReady = false;
  var adsLoaded = false;
  var eventsBound = false;
  var pauseTimer = null;
  var PAUSE_DELAY = 450;

  function getPlayerRoot() {
    if (player && typeof player.getContainer === "function") {
      return player.getContainer();
    }
    return document.querySelector(".jwplayer");
  }

  function getOverlayParent() {
    var root = getPlayerRoot();
    if (!root) return null;
    return root.querySelector(".jw-media") || root.querySelector(".jw-wrapper") || root;
  }

  function isPlayerInteractive() {
    if (!player || typeof player.getState !== "function") return false;
    var state = player.getState();
    return state === "idle" || state === "paused" || state === "complete";
  }

  function isAdPlaying() {
    var root = getPlayerRoot();
    return !!(root && root.classList.contains("jw-flag-ads"));
  }

  function cancelPauseAd() {
    if (pauseTimer) {
      clearTimeout(pauseTimer);
      pauseTimer = null;
    }
  }

  function resetCycleDismissed() {
    delete dismissed.pause;
    delete dismissed.end;
  }

  function parseImageFeed(data) {
    if (!data || data.enabled === false) return [];
    var list = Array.isArray(data) ? data : data.list || data.ads || [];
    return list
      .filter(function (item) {
        return item && item.imageUrl && item.enabled !== false;
      })
      .map(function (item) {
        return {
          imageUrl: item.imageUrl,
          websiteUrl: item.websiteUrl || "",
          showOn: item.showOn || [],
        };
      });
  }

  function onAdsLoaded() {
    if (!player || !ads.length) return;
    adsLoaded = true;
    if (!pendingReady) return;
    pendingReady = false;
    scheduleReadyAd();
  }

  function scheduleReadyAd() {
    if (!adsLoaded || !pickAd("ready") || isAdPlaying()) return;

    var attempt = function () {
      if (!isPlayerInteractive() || isAdPlaying()) return;
      tryShow("ready");
    };

    if (typeof player.getState === "function" && player.getState() !== "setup") {
      requestAnimationFrame(attempt);
      return;
    }

    player.once("ready", function () {
      requestAnimationFrame(attempt);
    });
  }

  // ─── CSS ──────────────────────────────────────────────────────

  var CSS =
    ".jwplayer .jw-media{position:relative}" +
    ".ad-image-overlay{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity .3s ease}" +
    ".ad-image-overlay.visible{opacity:1}" +
    ".ad-image-overlay .ad-image-link{position:relative;display:flex;align-items:center;justify-content:center;max-width:min(90%,420px);max-height:90%;cursor:pointer;pointer-events:auto}" +
    ".ad-image-overlay .ad-image-link img{max-width:100%;max-height:100%;width:auto;height:auto;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.5);display:block}" +
    ".ad-image-overlay .ad-close-btn{position:absolute;top:-12px;right:-12px;width:32px;height:32px;background:rgba(0,0,0,.85);color:#fff;border:2px solid rgba(255,255,255,.3);border-radius:50%;font-size:18px;line-height:28px;text-align:center;cursor:pointer;z-index:21;transition:transform .2s,background .2s;user-select:none}" +
    ".ad-image-overlay .ad-close-btn:hover{transform:scale(1.15);background:rgba(220,50,50,.9)}" +
    ".ad-image-overlay .ad-label{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;padding:2px 8px;border-radius:3px;font-family:Arial,sans-serif;user-select:none}";

  // ─── Pick Random Ad ──────────────────────────────────────────

  function pickAd(eventType) {
    // Filter ads that should show on this event
    var eligible = ads.filter(function (ad) {
      return ad.showOn && ad.showOn.indexOf(eventType) !== -1;
    });
    if (eligible.length === 0) return null;
    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  // ─── Create / Update Overlay DOM ─────────────────────────────

  function ensureOverlayContainer() {
    var parent = getOverlayParent();
    if (!parent) return false;

    if (!overlay) {
      styleEl = document.createElement("style");
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);

      overlay = document.createElement("div");
      overlay.className = "ad-image-overlay";
    }

    if (overlay.parentNode !== parent) {
      parent.appendChild(overlay);
    }
    return true;
  }

  function tryShow(eventType) {
    if (!adsLoaded || !ads.length) return;
    if (!ensureOverlayContainer()) return;
    show(eventType);
  }

  function renderAd(ad) {
    if (!overlay || !ad) return;
    currentAd = ad;

    overlay.innerHTML =
      '<div class="ad-image-link">' +
      '<span class="ad-label">AD</span>' +
      '<img src="' + escapeHtml(ad.imageUrl) + '" alt="Advertisement" />' +
      '<span class="ad-close-btn">✕</span>' +
      "</div>";

    // Close button
    overlay.querySelector(".ad-close-btn").addEventListener(
      "click",
      function (e) {
        e.stopPropagation();
        hide();
      }
    );

    // Image click → open website
    var link = overlay.querySelector(".ad-image-link");
    link.addEventListener("click", function () {
      if (ad.websiteUrl) {
        window.open(ad.websiteUrl, "_blank", "noopener");
      }
    });
  }

  // ─── Show / Hide ──────────────────────────────────────────────

  function show(eventType) {
    if (!overlay || ads.length === 0) return;
    // ready shows once per session after user closes
    if (eventType === "ready" && dismissed.ready) return;

    var ad = pickAd(eventType);
    if (!ad) return;

    renderAd(ad);
    activeEventType = eventType;
    overlay.classList.add("visible");
  }

  function hide(markDismissed) {
    if (!overlay) return;
    overlay.classList.remove("visible");

    var wasPauseAd = activeEventType === "pause";
    if (markDismissed !== false && activeEventType === "ready") {
      dismissed.ready = true;
    }
    activeEventType = null;

    if (wasPauseAd && player && player.getState() === "paused") {
      player.play();
    }
  }

  // ─── Escape HTML ──────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─── Player Events ────────────────────────────────────────────

  function bindPlayerEvents(p) {
    if (eventsBound) return;
    eventsBound = true;

    p.on("adBreakEnd", function () {
      scheduleReadyAd();
    });

    p.on("play", function () {
      cancelPauseAd();
      resetCycleDismissed();
      if (overlay && overlay.classList.contains("visible")) {
        hide(false);
      }
    });

    p.on("seek", cancelPauseAd);
    p.on("buffer", cancelPauseAd);

    p.on("pause", function () {
      cancelPauseAd();
      pauseTimer = setTimeout(function () {
        pauseTimer = null;
        if (!player || player.getState() !== "paused" || isAdPlaying()) return;
        tryShow("pause");
      }, PAUSE_DELAY);
    });

    p.on("complete", function () {
      cancelPauseAd();
      tryShow("end");
    });
  }

  // ─── Feed URL ─────────────────────────────────────────────────

  function feedUrl() {
    var cfg = window.playerConfig;
    if (!cfg || !cfg.static || !cfg.adSlug) return null;
    return (
      window.location.protocol +
      "//" +
      cfg.static +
      "/image/" +
      encodeURIComponent(cfg.adSlug) +
      ".json"
    );
  }

  // ─── Public API ───────────────────────────────────────────────

  window.AdvertImage = {
    init: function (jwplayerInstance) {
      var url = feedUrl();
      if (!url || !jwplayerInstance) return;
      if (player === jwplayerInstance && adsLoaded) return;

      player = jwplayerInstance;
      dismissed = {};
      pendingReady = true;
      adsLoaded = false;
      ads = [];
      bindPlayerEvents(player);

      fetch(url, { mode: "cors", credentials: "omit" })
        .then(function (res) {
          if (!res.ok) return null;
          return res.json();
        })
        .then(function (data) {
          if (!data) {
            pendingReady = false;
            return;
          }
          ads = parseImageFeed(data);
          onAdsLoaded();
        })
        .catch(function () {});
    },

    /**
     * Stop and cleanup.
     */
    stop: function () {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      overlay = null;
      styleEl = null;
      player = null;
      ads = [];
      currentAd = null;
      dismissed = {};
      activeEventType = null;
      pendingReady = false;
      adsLoaded = false;
      eventsBound = false;
      cancelPauseAd();
    },
  };
})();
