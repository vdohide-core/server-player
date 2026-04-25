/**
 * Advert Image — Image ad overlay for JWPlayer
 *
 * Self-contained module. Load this script to enable:
 * - Image overlay on player ready / pause / end
 * - Clickable image linking to advertiser website
 * - Close button to dismiss overlay
 *
 * Requires playerConfig.advertImage to be set:
 *   { imageUrl, websiteUrl, showOn: ["ready", "pause", "end"] }
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
  var config = null; // { imageUrl, websiteUrl, showOn }
  var overlay = null;
  var styleEl = null;
  var dismissed = {}; // track dismissed states per event

  // ─── CSS ──────────────────────────────────────────────────────

  var CSS =
    ".ad-image-overlay{position:absolute;top:0;left:0;right:0;bottom:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.7);opacity:0;pointer-events:none;transition:opacity .3s ease}" +
    ".ad-image-overlay.visible{opacity:1;pointer-events:auto}" +
    ".ad-image-overlay .ad-image-link{position:relative;max-width:90%;max-height:80%;cursor:pointer}" +
    ".ad-image-overlay .ad-image-link img{max-width:100%;max-height:70vh;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.5);display:block}" +
    ".ad-image-overlay .ad-close-btn{position:absolute;top:-12px;right:-12px;width:32px;height:32px;background:rgba(0,0,0,.85);color:#fff;border:2px solid rgba(255,255,255,.3);border-radius:50%;font-size:18px;line-height:28px;text-align:center;cursor:pointer;z-index:21;transition:transform .2s,background .2s;user-select:none}" +
    ".ad-image-overlay .ad-close-btn:hover{transform:scale(1.15);background:rgba(220,50,50,.9)}" +
    ".ad-image-overlay .ad-label{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;padding:2px 8px;border-radius:3px;font-family:Arial,sans-serif;user-select:none}";

  // ─── Create Overlay DOM ───────────────────────────────────────

  function createOverlay() {
    if (overlay) return;

    // Inject styles
    styleEl = document.createElement("style");
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    // Build overlay
    overlay = document.createElement("div");
    overlay.className = "ad-image-overlay";
    overlay.innerHTML =
      '<div class="ad-image-link">' +
      '<span class="ad-label">AD</span>' +
      '<img src="' + escapeHtml(config.imageUrl) + '" alt="Advertisement" />' +
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
      if (config.websiteUrl) {
        window.open(config.websiteUrl, "_blank", "noopener");
      }
    });

    // Click outside image → close
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        hide();
      }
    });

    // Append to player container
    var playerContainer = document.querySelector(".jwplayer");
    if (playerContainer) {
      playerContainer.appendChild(overlay);
    }
  }

  // ─── Show / Hide ──────────────────────────────────────────────

  function show(eventType) {
    if (!overlay || !config) return;
    if (dismissed[eventType]) return;
    overlay.classList.add("visible");
  }

  function hide() {
    if (!overlay) return;
    overlay.classList.remove("visible");
    // Mark current context as dismissed so it doesn't show again on same event
    dismissed._last = true;
  }

  function shouldShow(eventType) {
    if (!config || !config.showOn) return false;
    return config.showOn.indexOf(eventType) !== -1;
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
    p.on("ready", function () {
      createOverlay();
      if (shouldShow("ready")) {
        show("ready");
      }
    });

    p.on("play", function () {
      hide();
      dismissed = {}; // reset on play
    });

    p.on("pause", function () {
      if (shouldShow("pause")) {
        // Small delay to avoid showing during seek
        setTimeout(function () {
          if (player && player.getState() === "paused") {
            show("pause");
          }
        }, 300);
      }
    });

    p.on("complete", function () {
      if (shouldShow("end")) {
        show("end");
      }
    });
  }

  // ─── Public API ───────────────────────────────────────────────

  window.AdvertImage = {
    /**
     * Initialize with a JWPlayer instance.
     * Reads config from playerConfig.advertImage.
     */
    init: function (jwplayerInstance) {
      var cfg = window.playerConfig;
      if (!cfg || !cfg.advertImage || !cfg.advertImage.imageUrl) return;

      player = jwplayerInstance;
      config = cfg.advertImage;
      dismissed = {};

      bindPlayerEvents(player);
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
      config = null;
      dismissed = {};
    },
  };
})();
