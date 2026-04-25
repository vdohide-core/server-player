/**
 * HLS Prewarm — warm CDN cache ahead of player
 *
 * Uses PerformanceObserver to detect player segment fetches and HEAD-prewarm
 * the next N segments. Works in both direct page loads and third-party iframes.
 *
 * Strategy: Pattern-based inference (no m3u8 parsing → no CORS issues)
 * - Detects segment fetches via PerformanceObserver
 * - Infers next segment URLs from URL pattern (seg-5 → seg-6..seg-9)
 * - On resolution switch: cancels in-flight prewarms, enters cooldown,
 *   then resumes prewarm from the new position
 */
(function() {
  var LOOKAHEAD = 5;
  var LOOKAHEAD_AFTER_SWITCH = 10; // more aggressive lookahead right after resolution switch
  var CONCURRENT = 2;
  var BATCH_DELAY_MS = 300;
  var SWITCH_COOLDOWN_MS = 1000; // wait after resolution switch before prewarming

  // Track current base URL to detect resolution changes
  var currentBase = null;
  var justSwitched = false; // flag for extra lookahead after switch

  var warmed = {};

  // Track highest segment number player has reached
  var highestPlayedSegNum = -1;

  // Track the last valid segment per base URL to avoid requesting past the end
  // key = base URL prefix, value = highest segment number known to NOT exist
  var maxSegCeiling = {};  // base → first-failed segment number

  // Resolution switch detection
  var switchCooldownUntil = 0; // timestamp until which prewarm is paused
  var currentAbort = null;     // AbortController for in-flight prewarm batch

  /**
   * Check if URL is a video segment.
   * Matches: .ts files, v-N.jpeg (nginx-vod-module segments)
   */
  function isSegmentUrl(url) {
    if (url.indexOf(".ts") === url.length - 3) return true;
    if (url.indexOf(".ts?") !== -1 || url.indexOf(".ts#") !== -1) return true;
    // nginx-vod-module segments: v-1.jpeg, v-2.jpeg, etc.
    if (/\/v-\d+\.jpeg/.test(url)) return true;
    return false;
  }

  /**
   * Parse a segment URL into { base, num, suffix }
   */
  function parseSegUrl(url) {
    // seg-N or seg_N pattern (.ts)
    var m = url.match(/^(.*\/seg[-_])(\d+)(.*\.ts.*)$/);
    if (m) return { base: m[1], num: parseInt(m[2], 10), suffix: m[3] };

    // v-N.jpeg pattern (nginx-vod-module)
    m = url.match(/^(.*\/v-)(\d+)(\.jpeg.*)$/);
    if (m) return { base: m[1], num: parseInt(m[2], 10), suffix: m[3] };

    // Generic: last number before .ts
    m = url.match(/^(.*\D)(\d+)(\.ts.*)$/);
    if (m) return { base: m[1], num: parseInt(m[2], 10), suffix: m[3] };

    return null;
  }

  /**
   * Cancel any in-flight prewarm batch
   */
  function cancelPrewarm() {
    if (currentAbort) {
      currentAbort.abort();
      currentAbort = null;
    }
  }

  /**
   * Record a failed segment so we never request at or beyond it
   */
  function markCeiling(base, num) {
    if (!(base in maxSegCeiling) || num < maxSegCeiling[base]) {
      maxSegCeiling[base] = num;
    }
  }

  /**
   * Check if a segment number is past the known end
   */
  function isPastEnd(base, num) {
    return (base in maxSegCeiling) && num >= maxSegCeiling[base];
  }

  function prewarmBatch(urls, parsedList, idx) {
    if (idx >= urls.length) return;

    // Don't start if in cooldown
    if (Date.now() < switchCooldownUntil) return;

    var abort = new AbortController();
    currentAbort = abort;

    var batch = urls.slice(idx, idx + CONCURRENT);
    var batchParsed = parsedList.slice(idx, idx + CONCURRENT);
    var promises = batch.map(function(url, bIdx) {
      warmed[url] = true;
      return fetch(url, {
        method: "HEAD",
        mode: "no-cors",
        signal: abort.signal,
        priority: "low"  // hint browser to prioritize player requests
      }).then(function(resp) {
        // mode:"no-cors" gives opaque response (status=0, type="opaque")
        // A successful opaque response means the server responded (even if we can't read status).
        // A network error / DNS failure will throw → caught below.
        // For same-origin or CORS-enabled, we can check status directly:
        if (resp.type !== "opaque" && !resp.ok) {
          var p = batchParsed[bIdx];
          if (p) markCeiling(p.base, p.num);
        }
      }).catch(function() {
        // Network error — likely 404 or server refused. Mark ceiling.
        var p = batchParsed[bIdx];
        if (p) markCeiling(p.base, p.num);
      });
    });
    Promise.all(promises).then(function() {
      // If aborted, stop
      if (abort.signal.aborted) return;
      if (idx + CONCURRENT < urls.length) {
        setTimeout(function() {
          prewarmBatch(urls, parsedList, idx + CONCURRENT);
        }, BATCH_DELAY_MS);
      }
    });
  }

  function prewarmAhead(parsed, extraLookahead) {
    var lookahead = extraLookahead || LOOKAHEAD;
    var ahead = [];
    var aheadParsed = [];
    for (var i = 1; i <= lookahead; i++) {
      var nextNum = parsed.num + i;
      // Skip if we already know this segment doesn't exist
      if (isPastEnd(parsed.base, nextNum)) break;
      var nextUrl = parsed.base + nextNum + parsed.suffix;
      if (!warmed[nextUrl]) {
        ahead.push(nextUrl);
        aheadParsed.push({ base: parsed.base, num: nextNum, suffix: parsed.suffix });
      }
    }
    if (ahead.length > 0) prewarmBatch(ahead, aheadParsed, 0);
  }

  function detectAndPrewarm(url) {
    if (!isSegmentUrl(url)) return;
    if (warmed[url]) return;
    warmed[url] = true;

    var parsed = parseSegUrl(url);
    if (!parsed) return;

    var segNum = parsed.num;

    // ─── Resolution switch detection ─────────────────────────
    // Detect when the base URL changes (different resolution stream)
    // or when segment number jumps backwards.
    var baseChanged = currentBase && parsed.base !== currentBase;
    var segBehind = highestPlayedSegNum > 0 && segNum < highestPlayedSegNum - 1;

    if (baseChanged || segBehind) {
      cancelPrewarm();
      // Clear ceiling cache for the new resolution so prewarm works
      delete maxSegCeiling[parsed.base];
      switchCooldownUntil = Date.now() + SWITCH_COOLDOWN_MS;
      justSwitched = true;
      currentBase = parsed.base;
      return; // don't prewarm — let the player catch up first
    }

    currentBase = parsed.base;

    // During cooldown, skip prewarm but still track position
    if (Date.now() < switchCooldownUntil) {
      if (segNum > highestPlayedSegNum) {
        highestPlayedSegNum = segNum;
      }
      return;
    }

    // Update highest played position
    if (segNum > highestPlayedSegNum) {
      highestPlayedSegNum = segNum;
    }

    // Only prewarm if this segment is at or near the frontier
    // (not a stale catch-up fetch)
    if (segNum >= highestPlayedSegNum) {
      // After a resolution switch, use extra lookahead to warm more segments
      var lookahead = justSwitched ? LOOKAHEAD_AFTER_SWITCH : 0;
      justSwitched = false;
      prewarmAhead(parsed, lookahead);
    }
  }

  // Use PerformanceObserver to detect player segment fetches
  if (typeof PerformanceObserver !== "undefined") {
    try {
      var segObs = new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          detectAndPrewarm(entry.name);
        });
      });
      segObs.observe({ type: "resource", buffered: true });
    } catch(e) {}
  }
})();
