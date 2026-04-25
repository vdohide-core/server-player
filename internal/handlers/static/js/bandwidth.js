/**
 * Bandwidth Monitor — Network speed tracking & UI indicators
 *
 * Self-contained module. Load this script to enable:
 * - Bandwidth byte tracking (total data consumed)
 * - Real-time download speed calculation
 * - Speed indicator in player controlbar
 * - Buffer speed overlay during buffering
 *
 * Usage in embed.html:
 *   <script src="/js/bandwidth.js"></script>   ← เปิดใช้
 *   <!-- <script src="/js/bandwidth.js"></script> -->  ← ปิด
 *
 * Integration (called by jw-v2.js if available):
 *   window.BandwidthMonitor.init(jwplayerInstance)
 *   window.BandwidthMonitor.stop()
 */
(function () {
  // ─── Config ────────────────────────────────────────────────────
  var BUTTON_DELAY = 100;

  // ─── Bandwidth Byte Tracking ───────────────────────────────────
  var totalBytes = 0;
  var segCount = 0;
  var lastLogged = 0;

  // ─── Network Speed State ───────────────────────────────────────
  var completedSegments = [];
  var currentSpeed = 0;
  var avgSpeed = 0;
  var isLoading = false;
  var lastUpdateTime = 0;
  var recentBytes = 0;
  var recentDuration = 0;

  // ─── UI Elements ──────────────────────────────────────────────
  var speedIndicator = null;
  var bufferSpeedIndicator = null;
  var isBuffering = false;

  // ─── Observer & Intervals ─────────────────────────────────────
  var observer = null;
  var updateInterval = null;
  var player = null;

  // ─── Segment Detection ────────────────────────────────────────

  function isSegment(name) {
    return (
      name.includes(".ts") ||
      name.includes("/seg-") ||
      /\/v-\d+\.\w+/.test(name)
    );
  }

  function isVideoSegment(url) {
    return (
      /\/v-\d+\.jpeg$/i.test(url) ||
      url.includes(".ts") ||
      url.includes(".m4s")
    );
  }

  function fmt(b) {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    if (b < 1073741824) return (b / 1048576).toFixed(2) + " MB";
    return (b / 1073741824).toFixed(2) + " GB";
  }

  // ─── Speed Calculation ────────────────────────────────────────

  function handleSegmentComplete(entry) {
    var duration =
      entry.responseEnd - (entry.requestStart || entry.startTime);
    var size = entry.transferSize || entry.encodedBodySize || 0;

    if (duration > 0 && size > 0) {
      var speedMBps = size / 1024 / 1024 / (duration / 1000);
      var speedMbps = speedMBps * 8;

      completedSegments.push({
        speedMbps: speedMbps,
        timestamp: Date.now(),
        bytes: size,
        durationMs: duration,
      });

      if (completedSegments.length > 50) {
        completedSegments.shift();
      }

      recentBytes = size;
      recentDuration = duration;
      lastUpdateTime = Date.now();
      isLoading = true;

      calculateAverageSpeed();
      calculateRealtimeSpeed();
    }
  }

  function calculateRealtimeSpeed() {
    var now = Date.now();
    var timeSince = now - lastUpdateTime;

    if (timeSince > 2000) {
      currentSpeed = 0;
      isLoading = false;
    } else if (recentDuration > 0 && recentBytes > 0) {
      currentSpeed =
        (recentBytes / 1024 / 1024 / (recentDuration / 1000)) * 8;
      isLoading = true;
    } else {
      var recent3 = completedSegments.slice(-3);
      if (recent3.length > 0) {
        var total = recent3.reduce(function (s, seg) {
          return s + seg.speedMbps;
        }, 0);
        currentSpeed = total / recent3.length;
        isLoading = timeSince < 1000;
      }
    }

    updateUI();
  }

  function calculateAverageSpeed() {
    if (completedSegments.length === 0) {
      avgSpeed = 0;
      return;
    }
    var recent = completedSegments.slice(-10);
    var total = recent.reduce(function (s, seg) {
      return s + seg.speedMbps;
    }, 0);
    avgSpeed = total / recent.length;
  }

  // ─── Unified PerformanceObserver ───────────────────────────────

  function startObserver() {
    if (typeof PerformanceObserver === "undefined") return;

    try {
      observer = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          // 1) Bandwidth byte tracking (skip HEAD — no body)
          if (isSegment(entry.name)) {
            var bodySize = entry.decodedBodySize || 0;
            if (bodySize > 0) {
              var size = entry.transferSize || bodySize;
              totalBytes += size;
              segCount++;
              if (segCount % 10 === 0 && totalBytes !== lastLogged) {
                lastLogged = totalBytes;
                console.log(
                  "[Bandwidth] segments: " +
                    segCount +
                    ", total: " +
                    fmt(totalBytes)
                );
              }
            }
          }

          // 2) Speed calculation (only fetch/xhr video segments)
          if (
            (entry.initiatorType === "xmlhttprequest" ||
              entry.initiatorType === "fetch") &&
            isVideoSegment(entry.name) &&
            entry.responseEnd > 0
          ) {
            handleSegmentComplete(entry);
          }
        });
      });

      observer.observe({ type: "resource", buffered: true });

      // Realtime speed polling
      updateInterval = setInterval(function () {
        calculateRealtimeSpeed();
      }, 500);
    } catch (e) {}
  }

  // ─── UI: Speed Indicator (controlbar) ─────────────────────────

  function addSpeedIndicator() {
    setTimeout(function () {
      var controlbar = document.querySelector(".jw-controlbar");
      if (!controlbar) return;

      speedIndicator = document.createElement("div");
      speedIndicator.className = "jw-speed-indicator";
      speedIndicator.innerHTML =
        '<span class="speed-icon">⚡</span>' +
        '<span class="speed-value">-- Mbps</span>';

      var style = document.createElement("style");
      style.textContent =
        ".jw-speed-indicator{display:inline-flex;align-items:center;gap:4px;padding:0 8px;height:100%;color:#fff;font-size:11px;font-family:Arial,sans-serif;white-space:nowrap;opacity:0;transition:opacity .3s;user-select:none}" +
        ".jw-speed-indicator.active{opacity:1}" +
        ".jw-speed-indicator .speed-icon{font-size:14px;line-height:1}" +
        ".jw-speed-indicator .speed-value{font-weight:500;line-height:1}" +
        ".jw-speed-indicator.loading .speed-icon{animation:bw-pulse 1s ease-in-out infinite}" +
        "@keyframes bw-pulse{0%,100%{opacity:1}50%{opacity:.5}}";
      document.head.appendChild(style);

      var spacer = controlbar.querySelector(".jw-spacer");
      var btnContainer = controlbar.querySelector(".jw-button-container");

      if (spacer) {
        spacer.parentNode.insertBefore(speedIndicator, spacer);
      } else if (btnContainer) {
        var fsBtn = btnContainer.querySelector(".jw-icon-fullscreen");
        if (fsBtn) {
          btnContainer.insertBefore(speedIndicator, fsBtn);
        }
      }
    }, BUTTON_DELAY);
  }

  // ─── UI: Buffer Speed Indicator (center overlay) ──────────────

  function addBufferSpeedIndicator() {
    setTimeout(function () {
      var displayIcon = document.querySelector(".jw-display-icon-display");
      if (!displayIcon) return;

      bufferSpeedIndicator = document.createElement("div");
      bufferSpeedIndicator.className = "jw-buffer-speed-indicator";
      bufferSpeedIndicator.innerHTML =
        '<span class="buffer-speed-value"></span>';

      var style = document.createElement("style");
      style.textContent =
        ".jw-buffer-speed-indicator{position:absolute;bottom:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:8px 16px;border-radius:4px;font-size:13px;font-family:Arial,sans-serif;font-weight:500;white-space:nowrap;opacity:0;transition:opacity .3s;pointer-events:none;z-index:10}" +
        ".jw-buffer-speed-indicator.active{opacity:1}" +
        '.jw-buffer-speed-indicator .buffer-speed-value::before{content:"⚡ "}';
      document.head.appendChild(style);

      var playerContainer = document.querySelector(".jwplayer");
      if (playerContainer) {
        playerContainer.appendChild(bufferSpeedIndicator);
      }
    }, BUTTON_DELAY);
  }

  // ─── UI Update ────────────────────────────────────────────────

  function updateUI() {
    // Controlbar indicator
    if (speedIndicator) {
      if (isLoading && currentSpeed > 0) {
        speedIndicator.classList.add("active", "loading");
        speedIndicator.querySelector(".speed-value").textContent =
          currentSpeed.toFixed(2) + " Mbps";
      } else if (isLoading && avgSpeed > 0) {
        speedIndicator.classList.add("active", "loading");
        speedIndicator.querySelector(".speed-value").textContent =
          avgSpeed.toFixed(2) + " Mbps";
      } else {
        speedIndicator.classList.remove("active", "loading");
      }
    }

    // Buffer overlay
    if (bufferSpeedIndicator) {
      if (
        isBuffering &&
        isLoading &&
        (currentSpeed > 0 || avgSpeed > 0)
      ) {
        bufferSpeedIndicator.classList.add("active");
        var displaySpeed =
          currentSpeed > 0 ? currentSpeed.toFixed(2) : avgSpeed.toFixed(2);
        bufferSpeedIndicator.querySelector(
          ".buffer-speed-value"
        ).textContent = displaySpeed + " Mbps";
      } else {
        bufferSpeedIndicator.classList.remove("active");
      }
    }
  }

  // ─── Player Event Bindings ────────────────────────────────────

  function bindPlayerEvents(p) {
    p.on("buffer", function () {
      isBuffering = true;
    });
    p.on("idle", function () {
      isBuffering = false;
      if (bufferSpeedIndicator)
        bufferSpeedIndicator.classList.remove("active");
    });
    p.on("play", function () {
      isBuffering = false;
      if (bufferSpeedIndicator)
        bufferSpeedIndicator.classList.remove("active");
    });
  }

  // ─── Public API ───────────────────────────────────────────────

  window.BandwidthMonitor = {
    /**
     * Initialize bandwidth monitoring with a JWPlayer instance.
     * Called by jw-v2.js on player ready.
     */
    init: function (jwplayerInstance) {
      player = jwplayerInstance;
      startObserver();
      bindPlayerEvents(player);

      // Wait for player DOM to be ready before injecting UI
      player.on("ready", function () {
        addSpeedIndicator();
        addBufferSpeedIndicator();
      });
    },

    /**
     * Stop monitoring and cleanup.
     */
    stop: function () {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
      player = null;
    },

    /**
     * Get current stats.
     */
    getStats: function () {
      return {
        totalBytes: totalBytes,
        segCount: segCount,
        currentSpeed: currentSpeed.toFixed(2),
        avgSpeed: avgSpeed.toFixed(2),
        isLoading: isLoading,
      };
    },
  };
})();
