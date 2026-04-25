/**
 * Advert Video — Custom pre-roll video ad system
 *
 * Self-contained module. Plays video ads before main content using
 * a separate <video> element overlaid on the player.
 *
 * Features:
 * - Sequential pre-roll ads from playerConfig.advert[]
 * - Custom controls: skip countdown button, "Visit" button with ad name
 * - Hides player controls during ads
 * - Progress text: "โฆษณาจะจบใน XX วินาที" + "โฆษณา 1/3"
 * - Click during ad → redirect to ad website
 * - After all ads → plays main content
 *
 * Usage in embed.html:
 *   <script src="/js/advert-video.js"></script>   ← เปิดใช้
 *   <!-- <script src="/js/advert-video.js"></script> -->  ← ปิด
 *
 * Integration (called by jw-v2.js if available):
 *   window.AdvertVideo.init(jwplayerInstance)
 *   window.AdvertVideo.stop()
 */
(function () {
  // ─── State ─────────────────────────────────────────────────────
  var player = null;
  var ads = [];
  var currentIndex = 0;
  var isPlayingAd = false;
  var skipTimer = null;
  var countdownInterval = null;

  // ─── DOM Elements ──────────────────────────────────────────────
  var overlay = null;
  var videoEl = null;
  var styleEl = null;
  var uiContainer = null;

  // ─── CSS ──────────────────────────────────────────────────────

  var CSS = [
    ".ad-video-overlay{position:absolute;top:0;left:0;right:0;bottom:0;z-index:25;background:#000;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .3s}",
    ".ad-video-overlay.visible{opacity:1;pointer-events:auto}",
    ".ad-video-overlay video{width:100%;height:100%;object-fit:contain;cursor:pointer}",
    ".ad-ui{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:26}",
    // Top bar
    ".ad-top-bar{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;pointer-events:auto;background:linear-gradient(to bottom,rgba(0,0,0,.7),transparent)}",
    ".ad-counter{color:#fff;font-size:12px;font-family:Arial,sans-serif;opacity:.9;user-select:none}",
    ".ad-countdown{color:#ffd700;font-size:12px;font-family:Arial,sans-serif;font-weight:500;user-select:none}",
    // Bottom bar
    ".ad-bottom-bar{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;pointer-events:auto;background:linear-gradient(to top,rgba(0,0,0,.7),transparent)}",
    ".ad-visit-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:4px;color:#fff;font-size:13px;font-family:Arial,sans-serif;cursor:pointer;text-decoration:none;transition:background .2s;user-select:none;white-space:nowrap}",
    ".ad-visit-btn:hover{background:rgba(255,255,255,.3)}",
    ".ad-visit-btn .ad-visit-icon{font-size:16px}",
    ".ad-skip-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 16px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.4);border-radius:4px;color:#fff;font-size:13px;font-family:Arial,sans-serif;cursor:pointer;transition:background .2s,opacity .2s;user-select:none;white-space:nowrap}",
    ".ad-skip-btn:hover{background:rgba(255,255,255,.2)}",
    ".ad-skip-btn.disabled{opacity:.5;cursor:default;pointer-events:none}",
    // Center play overlay
    ".ad-play-hint{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:14px;font-family:Arial,sans-serif;opacity:0;transition:opacity .3s;pointer-events:none;user-select:none;background:rgba(0,0,0,.5);padding:8px 20px;border-radius:6px}",
    ".ad-play-hint.visible{opacity:1}",
  ].join("\n");

  // ─── Build Overlay ────────────────────────────────────────────

  function buildOverlay() {
    // Style
    styleEl = document.createElement("style");
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    // Overlay container
    overlay = document.createElement("div");
    overlay.className = "ad-video-overlay";

    // Video element
    videoEl = document.createElement("video");
    videoEl.setAttribute("playsinline", "");
    videoEl.setAttribute("webkit-playsinline", "");
    videoEl.preload = "auto";

    // UI container
    uiContainer = document.createElement("div");
    uiContainer.className = "ad-ui";
    uiContainer.innerHTML =
      '<div class="ad-top-bar">' +
      '  <span class="ad-counter"></span>' +
      '  <span class="ad-countdown"></span>' +
      "</div>" +
      '<div class="ad-bottom-bar">' +
      '  <a class="ad-visit-btn" target="_blank" rel="noopener">' +
      '    <span class="ad-visit-icon">🔗</span>' +
      '    <span class="ad-visit-name"></span>' +
      "  </a>" +
      '  <button class="ad-skip-btn disabled">ข้ามใน <span class="ad-skip-count"></span></button>' +
      "</div>" +
      '<div class="ad-play-hint">▶ คลิกเพื่อเล่นต่อ</div>';

    overlay.appendChild(videoEl);
    overlay.appendChild(uiContainer);

    // Append to player container
    var playerContainer = document.querySelector(".jwplayer");
    if (playerContainer) {
      playerContainer.appendChild(overlay);
    }

    // Events
    videoEl.addEventListener("click", onVideoClick);
    videoEl.addEventListener("ended", onVideoEnded);
    videoEl.addEventListener("timeupdate", onTimeUpdate);
    videoEl.addEventListener("error", onVideoError);

    var skipBtn = uiContainer.querySelector(".ad-skip-btn");
    skipBtn.addEventListener("click", onSkipClick);
  }

  // ─── Play Ad Sequence ─────────────────────────────────────────

  function startAds() {
    isPlayingAd = true;
    currentIndex = 0;

    // Pause main player
    try {
      player.pause(true);
      player.setMute(true);
    } catch (e) {}

    // Hide player controls
    hidePlayerControls(true);

    // Show overlay
    overlay.classList.add("visible");

    playCurrentAd();
  }

  function playCurrentAd() {
    if (currentIndex >= ads.length) {
      finishAds();
      return;
    }

    var ad = ads[currentIndex];

    // Update UI
    updateAdUI(ad);

    // Load and play
    videoEl.src = ad.mp4Url;
    videoEl.load();
    var playPromise = videoEl.play();
    if (playPromise) {
      playPromise.catch(function () {
        // Autoplay blocked — show hint
        showPlayHint(true);
      });
    }

    // Start skip countdown
    startSkipCountdown(ad.skipSeconds || 5);
  }

  function finishAds() {
    isPlayingAd = false;

    // Hide overlay
    overlay.classList.remove("visible");
    videoEl.pause();
    videoEl.src = "";

    // Restore controls
    hidePlayerControls(false);

    // Play main content
    try {
      player.setMute(false);
      player.play();
    } catch (e) {}

    clearCountdowns();
  }

  // ─── UI Updates ───────────────────────────────────────────────

  function updateAdUI(ad) {
    var counter = uiContainer.querySelector(".ad-counter");
    counter.textContent =
      "โฆษณา " + (currentIndex + 1) + "/" + ads.length;

    var visitBtn = uiContainer.querySelector(".ad-visit-btn");
    var visitName = uiContainer.querySelector(".ad-visit-name");
    visitName.textContent = ad.name || "เยี่ยมชม";
    visitBtn.href = ad.websiteUrl || "#";

    var skipBtn = uiContainer.querySelector(".ad-skip-btn");
    skipBtn.classList.add("disabled");

    updateCountdownText(0);
  }

  function updateCountdownText(remaining) {
    var cdEl = uiContainer.querySelector(".ad-countdown");
    if (remaining > 0) {
      cdEl.textContent = "โฆษณาจะจบใน " + remaining + " วินาที";
    } else {
      cdEl.textContent = "";
    }
  }

  function startSkipCountdown(skipSeconds) {
    clearCountdowns();

    var remaining = skipSeconds;
    var skipBtn = uiContainer.querySelector(".ad-skip-btn");
    var skipCount = uiContainer.querySelector(".ad-skip-count");

    if (remaining <= 0) {
      skipBtn.classList.remove("disabled");
      skipBtn.textContent = "ข้าม ▸";
      return;
    }

    skipCount.textContent = remaining;
    skipBtn.classList.add("disabled");

    skipTimer = setInterval(function () {
      remaining--;
      if (remaining <= 0) {
        clearInterval(skipTimer);
        skipTimer = null;
        skipBtn.classList.remove("disabled");
        skipBtn.innerHTML = "ข้าม ▸";
      } else {
        skipCount.textContent = remaining;
      }
    }, 1000);
  }

  function showPlayHint(show) {
    var hint = uiContainer.querySelector(".ad-play-hint");
    if (hint) {
      hint.classList.toggle("visible", !!show);
    }
  }

  function clearCountdowns() {
    if (skipTimer) {
      clearInterval(skipTimer);
      skipTimer = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  // ─── Player Controls ──────────────────────────────────────────

  function hidePlayerControls(hide) {
    var controlbar = document.querySelector(".jw-controlbar");
    var display = document.querySelector(".jw-display");
    if (controlbar) controlbar.style.display = hide ? "none" : "";
    if (display) display.style.display = hide ? "none" : "";
  }

  // ─── Event Handlers ───────────────────────────────────────────

  function onVideoClick() {
    if (!videoEl) return;

    if (videoEl.paused) {
      videoEl.play();
      showPlayHint(false);
    } else {
      // Pause → open ad website
      var ad = ads[currentIndex];
      if (ad && ad.websiteUrl) {
        window.open(ad.websiteUrl, "_blank", "noopener");
      }
      videoEl.pause();
      showPlayHint(true);
    }
  }

  function onVideoEnded() {
    currentIndex++;
    playCurrentAd();
  }

  function onVideoError() {
    // Skip broken ad
    currentIndex++;
    playCurrentAd();
  }

  function onTimeUpdate() {
    if (!videoEl || !videoEl.duration) return;
    var remaining = Math.ceil(videoEl.duration - videoEl.currentTime);
    updateCountdownText(remaining);
  }

  function onSkipClick() {
    var skipBtn = uiContainer.querySelector(".ad-skip-btn");
    if (skipBtn.classList.contains("disabled")) return;

    clearCountdowns();
    currentIndex++;
    playCurrentAd();
  }

  // ─── Public API ───────────────────────────────────────────────

  window.AdvertVideo = {
    /**
     * Initialize video ads with a JWPlayer instance.
     * Reads config from playerConfig.advert[].
     */
    init: function (jwplayerInstance) {
      var config = window.playerConfig;
      if (!config || !config.advert || !config.advert.length) return;

      player = jwplayerInstance;
      ads = config.advert;

      buildOverlay();

      // Start ads on player ready
      player.on("ready", function () {
        startAds();
      });
    },

    /**
     * Stop ads and cleanup.
     */
    stop: function () {
      clearCountdowns();
      if (videoEl) {
        videoEl.pause();
        videoEl.src = "";
      }
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      hidePlayerControls(false);
      overlay = null;
      videoEl = null;
      uiContainer = null;
      styleEl = null;
      player = null;
      ads = [];
      isPlayingAd = false;
    },

    /**
     * Check if ads are currently playing.
     */
    isPlaying: function () {
      return isPlayingAd;
    },
  };
})();
