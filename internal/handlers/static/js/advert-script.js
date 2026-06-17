/**
 * Advert Script — loads script ads from static host feed.
 *
 * Fetches: {protocol}//{playerConfig.static}/script/{playerConfig.adSlug}.json
 */
(function () {
  function feedUrl() {
    var cfg = window.playerConfig;
    if (!cfg || !cfg.static || !cfg.adSlug) return null;
    return (
      window.location.protocol +
      "//" +
      cfg.static +
      "/script/" +
      encodeURIComponent(cfg.adSlug) +
      ".json"
    );
  }

  function injectScript(content) {
    if (!content) return;
    var trimmed = String(content).trim();
    if (!trimmed) return;

    if (trimmed.indexOf("<") === 0) {
      var wrap = document.createElement("div");
      wrap.innerHTML = trimmed;
      var nodes = wrap.querySelectorAll("script");
      if (nodes.length) {
        nodes.forEach(function (node) {
          var script = document.createElement("script");
          if (node.src) {
            script.src = node.src;
            if (node.async) script.async = true;
            if (node.defer) script.defer = true;
          } else {
            script.textContent = node.textContent;
          }
          document.body.appendChild(script);
        });
        return;
      }
    }

    var script = document.createElement("script");
    script.textContent = trimmed;
    document.body.appendChild(script);
  }

  function parseScriptFeed(data) {
    if (!data || data.enabled === false) return [];
    var list = Array.isArray(data) ? data : data.list || data.scripts || [];
    return list
      .filter(function (item) {
        if (typeof item === "string") return !!item;
        return item && item.script && item.enabled !== false;
      })
      .map(function (item) {
        return typeof item === "string" ? item : item.script;
      });
  }

  function load() {
    var url = feedUrl();
    if (!url) return;

    fetch(url, { mode: "cors", credentials: "omit" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        parseScriptFeed(data).forEach(injectScript);
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
