/**
 * Player Analytics — Watch time & bandwidth reporting
 *
 * Self-contained module. Load this script to enable:
 * - Watch time tracking (actual play time)
 * - Bandwidth consumption (from BandwidthMonitor if loaded)
 * - Periodic reporting to analytics API
 * - Final report on page unload (sendBeacon)
 *
 * Requires playerConfig.analyticsUrl to be set.
 *
 * Usage in embed.html:
 *   <script src="/js/analytics.js"></script>   ← เปิดใช้
 *   <!-- <script src="/js/analytics.js"></script> -->  ← ปิด
 *
 * Integration (called by jw-v2.js if available):
 *   window.PlayerAnalytics.init(jwplayerInstance)
 *   window.PlayerAnalytics.stop()
 */
(function () {
  // ─── Config ────────────────────────────────────────────────────
  var SEND_INTERVAL_SEC = 30;

  // ─── State ─────────────────────────────────────────────────────
  var player = null;
  var apiUrl = null;
  var slug = null;
  var sessionId = null;
  var watchTime = 0;
  var lastTick = 0;
  var isPlaying = false;
  var resolution = "";
  var timer = null;
  var hasSent = false;

  // ─── Helpers ──────────────────────────────────────────────────

  function uid() {
    return (
      Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
    );
  }

  function getSlug() {
    var m = window.location.href.match(/\/(embed|v|e)\/([^?\/]+)/);
    return m ? m[2] : null;
  }

  function tickWatchTime() {
    if (isPlaying && lastTick > 0) {
      watchTime += (Date.now() - lastTick) / 1000;
    }
    lastTick = Date.now();
  }

  // ─── Payload ──────────────────────────────────────────────────

  function buildPayload() {
    var bw = window.BandwidthMonitor
      ? window.BandwidthMonitor.getStats()
      : null;

    return {
      session_id: sessionId,
      slug: slug,
      bandwidth: bw ? bw.totalBytes : 0,
      watch_time: Math.round(watchTime),
      resolution: resolution || "",
      referrer: document.referrer || "",
      duration: player ? Math.round(player.getDuration() || 0) : 0,
      timestamp: Date.now(),
    };
  }

  // ─── Send ─────────────────────────────────────────────────────

  function send() {
    if (!apiUrl || !slug) return;

    tickWatchTime();
    var data = buildPayload();
    if (data.watch_time <= 0 && !hasSent) return;

    hasSent = true;

    try {
      var blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
      });
      navigator.sendBeacon(apiUrl, blob);
    } catch (e) {
      fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        keepalive: true,
      }).catch(function () {});
    }
  }

  // ─── Timer ────────────────────────────────────────────────────

  function startTimer() {
    if (timer) return;
    timer = setInterval(function () {
      tickWatchTime();
      send();
    }, SEND_INTERVAL_SEC * 1000);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // ─── Player Events ────────────────────────────────────────────

  function bindPlayerEvents(p) {
    p.on("play", function () {
      isPlaying = true;
      lastTick = Date.now();
    });

    p.on("pause", function () {
      tickWatchTime();
      isPlaying = false;
      send();
    });

    p.on("buffer", function () {
      tickWatchTime();
      isPlaying = false;
    });

    p.on("idle", function () {
      tickWatchTime();
      isPlaying = false;
    });

    p.on("complete", function () {
      tickWatchTime();
      isPlaying = false;
      send();
    });

    p.on("visualQuality", function (e) {
      if (e.level && e.level.label) {
        resolution = e.level.label;
      }
    });
  }

  // ─── Page Unload ──────────────────────────────────────────────

  window.addEventListener("beforeunload", function () {
    tickWatchTime();
    isPlaying = false;
    send();
  });

  // ─── Public API ───────────────────────────────────────────────

  window.PlayerAnalytics = {
    /**
     * Initialize analytics with a JWPlayer instance.
     * Requires playerConfig.analyticsUrl to be set.
     */
    init: function (jwplayerInstance) {
      var config = window.playerConfig;
      if (!config || !config.analyticsUrl) return;

      player = jwplayerInstance;
      apiUrl = config.analyticsUrl;
      slug = getSlug();
      sessionId = uid();

      bindPlayerEvents(player);
      startTimer();
    },

    /**
     * Stop tracking and send final report.
     */
    stop: function () {
      tickWatchTime();
      isPlaying = false;
      send();
      stopTimer();
      player = null;
    },

    /**
     * Get current stats (for debugging).
     */
    getStats: function () {
      var current = watchTime;
      if (isPlaying && lastTick > 0) {
        current += (Date.now() - lastTick) / 1000;
      }
      return {
        slug: slug,
        session_id: sessionId,
        bandwidth: window.BandwidthMonitor
          ? window.BandwidthMonitor.getStats().totalBytes
          : 0,
        watch_time: Math.round(current),
        resolution: resolution,
      };
    },
  };
})();
