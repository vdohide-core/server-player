window.qs = (selector) => document.querySelector(selector);

const CONFIG = {
  PLAYER: {
    KEY: "W7zSm81+mmIsg7F+fyHRKhF3ggLkTqtGMhvI92kbqf/ysE99",
    WIDTH: "100%",
    HEIGHT: "100%",
    PRELOAD: "metadata",
    PRIMARY: "html5",
    LIVE_TIMEOUT: 10,
  },
  TIMING: {
    MIN_SAVE_TIME: 5,
    MIN_CONTINUE_TIME: 10,
    SAVE_INTERVAL: 3,
    COUNTDOWN_DURATION: 10,
    BUTTON_DELAY: 100,
    OVERLAY_DELAY: 200,
    DIALOG_DELAY: 500,
    DEBOUNCE: 1000,
    THROTTLE: 500,
    ANNOUNCE_CLEAR: 1000,
    DIALOG_HIDE: 400,
    ENHANCE_CONTROLS: 500,
  },
  STORAGE: {
    TIME_PREFIX: "time_",
  },
  REGEX: {
    MOBILE: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i,
    VIDEO_ID: /\/(embed|v|e)\/([^?\/]+)/,
    VALID_ID: /^[a-zA-Z0-9_-]+$/,
  },
};

const Utils = {
  debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  throttle(func, wait) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), wait);
      }
    };
  },

  isMobile() {
    return CONFIG.REGEX.MOBILE.test(navigator.userAgent);
  },

  isValidVideoId(id) {
    return (
      typeof id === "string" &&
      id.length > 0 &&
      id.length <= 100 &&
      CONFIG.REGEX.VALID_ID.test(id)
    );
  },

  isValidTime(time) {
    return (
      typeof time === "number" && !isNaN(time) && time >= 0 && time <= 86400
    );
  },

  sanitizeKey(key) {
    if (typeof key !== "string") return "";
    return key.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);
  },

  formatTime(seconds) {
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    return [hours, minutes, remainingSeconds]
      .map((t) => String(t).padStart(2, "0"))
      .join(":");
  },

  getVideoId() {
    try {
      const matches = window.location.href.match(CONFIG.REGEX.VIDEO_ID);
      const id = matches ? matches[2] : null;
      return id && this.isValidVideoId(id) ? id : null;
    } catch (error) {
      console.error("Failed to extract video ID:", error);
      return null;
    }
  },

  async copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const textarea = document.createElement("textarea");
      textarea.value = text;
      Object.assign(textarea.style, {
        position: "fixed",
        opacity: "0",
        left: "-9999px",
      });
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  },
};

const StorageManager = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error("Storage read error:", error);
      return null;
    }
  },

  set(key, value) {
    try {
      const sanitizedKey = Utils.sanitizeKey(key);
      if (!sanitizedKey) return false;
      if (typeof value !== "string" && typeof value !== "number") return false;
      localStorage.setItem(sanitizedKey, String(value));
      return true;
    } catch (error) {
      console.error("Storage write error:", error);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error("Storage remove error:", error);
      return false;
    }
  },

  getSavedTime(videoId) {
    const key = CONFIG.STORAGE.TIME_PREFIX + videoId;
    const time = this.get(key);
    return time ? parseFloat(time) : null;
  },

  setSavedTime(videoId, time) {
    if (!Utils.isValidTime(time)) return false;
    const key = CONFIG.STORAGE.TIME_PREFIX + videoId;
    return this.set(key, time);
  },

  removeSavedTime(videoId) {
    const key = CONFIG.STORAGE.TIME_PREFIX + videoId;
    return this.remove(key);
  },
};

const IconManager = {
  forward:
    '<svg xmlns="http://www.w3.org/2000/svg" class="jw-svg-icon jw-svg-icon-seek" viewBox="0 0 240 240" focusable="false"><path d="m 25.993957,57.778 v 125.3 c 0.03604,2.63589 2.164107,4.76396 4.8,4.8 h 62.7 v -19.3 h -48.2 v -96.4 H 160.99396 v 19.3 c 0,5.3 3.6,7.2 8,4.3 l 41.8,-27.9 c 2.93574,-1.480087 4.13843,-5.04363 2.7,-8 -0.57502,-1.174985 -1.52502,-2.124979 -2.7,-2.7 l -41.8,-27.9 c -4.4,-2.9 -8,-1 -8,4.3 v 19.3 H 30.893957 c -2.689569,0.03972 -4.860275,2.210431 -4.9,4.9 z m 163.422413,73.04577 c -3.72072,-6.30626 -10.38421,-10.29683 -17.7,-10.6 -7.31579,0.30317 -13.97928,4.29374 -17.7,10.6 -8.60009,14.23525 -8.60009,32.06475 0,46.3 3.72072,6.30626 10.38421,10.29683 17.7,10.6 7.31579,-0.30317 13.97928,-4.29374 17.7,-10.6 8.60009,-14.23525 8.60009,-32.06475 0,-46.3 z m -17.7,47.2 c -7.8,0 -14.4,-11 -14.4,-24.1 0,-13.1 6.6,-24.1 14.4,-24.1 7.8,0 14.4,11 14.4,24.1 0,13.1 -6.5,24.1 -14.4,24.1 z m -47.77056,9.72863 v -51 l -4.8,4.8 -6.8,-6.8 13,-12.99999 c 3.02543,-3.03598 8.21053,-0.88605 8.2,3.4 v 62.69999 z"></path></svg>',
  quality: {
    "360p":
      '<svg class="jw-svg-icon jw-svg-icon-qswitch" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 24"><path d="M7 15v-1.5A1.5 1.5 0 0 0 5.5 12 1.5 1.5 0 0 0 7 10.5V9a2 2 0 0 0-2-2H1v2h4v2H3v2h2v2H1v2h4a2 2 0 0 0 2-2M10 7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2V9h4V7h-4m0 6h2v2h-2v-2zM17 7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m0 2h2v6h-2V9zM28 7v10h2v-4h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4m2 2h2v2h-2V9m-6-6h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H24a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>',
    "480p":
      '<svg class="jw-svg-icon jw-svg-icon-qswitch" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 24"><path d="M1 7v6h4v4h2V7H5v4H3V7H1zM10 13h2v2h-2m0-6h2v2h-2m0 6h2a2 2 0 0 0 2-2v-1.5a1.5 1.5 0 0 0-1.5-1.5 1.5 1.5 0 0 0 1.5-1.5V9a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v1.5A1.5 1.5 0 0 0 9.5 12 1.5 1.5 0 0 0 8 13.5V15a2 2 0 0 0 2 2M17 7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m0 2h2v6h-2V9zM28 7v10h2v-4h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4m2 2h2v2h-2V9m-6-6h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H24a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>',
    "720p":
      '<svg class="jw-svg-icon jw-svg-icon-qswitch" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 24"><path d="M3 17l4-8V7H1v2h4l-4 8M8 7v2h4v2h-2a2 2 0 0 0-2 2v4h6v-2h-4v-2h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H8zM17 7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m0 2h2v6h-2V9zM28 7v10h2v-4h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4m2 2h2v2h-2V9m-6-6h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H24a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>',
    "1080p":
      '<svg class="jw-svg-icon jw-svg-icon-qswitch" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 24"><path d="M2 7v2h2v8h2V7H2zM10 7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m0 2h2v6h-2V9zM17 13h2v2h-2m0-6h2v2h-2m0 6h2a2 2 0 0 0 2-2v-1.5a1.5 1.5 0 0 0-1.5-1.5 1.5 1.5 0 0 0 1.5-1.5V9a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v1.5a1.5 1.5 0 0 0 1.5 1.5 1.5 1.5 0 0 0-1.5 1.5V15a2 2 0 0 0 2 2M24 7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m0 2h2v6h-2V9zM36 7v10h2v-4h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4m2 2h2v2h-2V9m-6-6h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H32a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>',
    Auto: '<svg class="jw-svg-icon jw-svg-icon-qswitch" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M0 0h24v24H0z"></path><path d="m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25zM11.5 9.5 9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zm-1.51 3.49L9 15.17l-.99-2.18L5.83 12l2.18-.99L9 8.83l.99 2.18 2.18.99-2.18.99z"></path></svg>',
  },

  get(label) {
    if (label === "forward") return this.forward;
    return this.quality[label];
  },
};

const ContextMenuBuilder = {
  create() {
    const menu = document.createElement("div");
    menu.className = "jw-context-menu";

    const items = [
      // {
      //   text: "Visit VDOHide",
      //   action: () => window.open("https://vdohide.com", "_blank"),
      // },
      { separator: true },
      {
        text: "Copy Video URL",
        action: () => Utils.copyToClipboard(window.location.href),
      },
    ];

    items.forEach((item) => {
      if (item.separator) {
        const sep = document.createElement("div");
        sep.className = "jw-context-menu-separator";
        menu.appendChild(sep);
      } else {
        const div = document.createElement("div");
        div.className = "jw-context-menu-item";
        div.addEventListener("click", item.action);
        const span = document.createElement("span");
        span.textContent = item.text;
        div.appendChild(span);
        menu.appendChild(div);
      }
    });

    return menu;
  },
};

const ContinuePlayDialog = {
  create(savedTime) {
    const formattedTime = Utils.formatTime(savedTime);
    const dialog = document.createElement("div");
    dialog.className = "jw-continue-play hidden";
    dialog.id = "continuePlayDialog";

    dialog.innerHTML = `
      <div class="continue-play-header">
        <div class="continue-play-icon">▶️</div>
        <div class="continue-play-title">เล่นต่อจากครั้งที่แล้ว?</div>
      </div>
      <div class="continue-play-content">
        <div class="continue-play-message">คุณเคยดูวิดีโอนี้มาแล้ว</div>
        <div class="continue-play-time">🕐 ตำแหน่งล่าสุด: ${formattedTime}</div>
        <div class="continue-play-countdown">
          <span>เล่นต่ออัตโนมัติใน</span>
          <div class="countdown-number">
            <span id="countdownNumber">${CONFIG.TIMING.COUNTDOWN_DURATION}</span>
            <svg class="progress-ring" width="40" height="40">
              <circle class="progress-ring-circle" cx="20" cy="20" r="16"/>
              <circle class="progress-ring-progress" cx="20" cy="20" r="16" 
                stroke-dasharray="100.5" stroke-dashoffset="0" id="progressCircle"/>
            </svg>
          </div>
          <span>วินาที</span>
        </div>
      </div>
      <div class="continue-play-buttons">
        <button class="continue-play-btn btn-continue" id="btnContinue">▶️ เล่นต่อ</button>
        <button class="continue-play-btn btn-restart" id="btnRestart">🔄 เริ่มต้นใหม่</button>
      </div>
    `;

    return dialog;
  },
};

class EventManager {
  constructor() {
    this.listeners = new Map();
    this.counter = 0;
  }

  add(element, event, handler, options = false) {
    if (!element?.addEventListener) return null;
    element.addEventListener(event, handler, options);
    const key = `listener_${this.counter++}_${event}_${Date.now()}`;
    this.listeners.set(key, { element, event, handler, options });
    return key;
  }

  remove(key) {
    const data = this.listeners.get(key);
    if (data) {
      const { element, event, handler, options } = data;
      element?.removeEventListener?.(event, handler, options);
      this.listeners.delete(key);
    }
  }

  clear() {
    this.listeners.forEach((data) => {
      const { element, event, handler, options } = data;
      element?.removeEventListener?.(event, handler, options);
    });
    this.listeners.clear();
  }
}

class AccessibilityManager {
  constructor(player, playerElement) {
    this.player = player;
    this.playerElement = playerElement;
    this.region = null;
    this.eventManager = new EventManager();
  }

  setup() {
    this.setupKeyboard();
    this.setupAriaLabels();
    this.setupAnnouncements();
    this.setupFocusStyles();
  }

  setupKeyboard() {
    if (!this.playerElement) return;

    Object.assign(this.playerElement, { tabIndex: 0 });
    this.playerElement.setAttribute("role", "application");
    this.playerElement.setAttribute("aria-label", "Video Player");

    const handler = (e) => {
      if (e.target.matches("input, textarea")) return;

      const actions = {
        " ": () => this.togglePlayPause(e),
        k: () => this.togglePlayPause(e),
        ArrowLeft: () => this.seek(e, -10),
        ArrowRight: () => this.seek(e, 10),
        ArrowUp: () => this.adjustVolume(e, 10),
        ArrowDown: () => this.adjustVolume(e, -10),
        m: () => this.toggleMute(e),
        f: () => this.toggleFullscreen(e),
        Escape: () => this.exitFullscreen(e),
        0: () => this.seekToPercent(e, 0),
        1: () => this.seekToPercent(e, 10),
        2: () => this.seekToPercent(e, 20),
        3: () => this.seekToPercent(e, 30),
        4: () => this.seekToPercent(e, 40),
        5: () => this.seekToPercent(e, 50),
        6: () => this.seekToPercent(e, 60),
        7: () => this.seekToPercent(e, 70),
        8: () => this.seekToPercent(e, 80),
        9: () => this.seekToPercent(e, 90),
      };

      actions[e.key]?.();
    };

    this.eventManager.add(this.playerElement, "keydown", handler);
  }

  togglePlayPause(e) {
    e.preventDefault();
    if (this.player.getState() === "playing") {
      this.player.pause();
      this.announce("วิดีโอหยุดชั่วคราว");
    } else {
      this.player.play();
      this.announce("วิดีโอกำลังเล่น");
    }
  }

  seek(e, offset) {
    e.preventDefault();
    const time = Math.max(0, this.player.getPosition() + offset);
    this.player.seek(time);
    this.announce(
      `กรอ${offset > 0 ? "ไปข้างหน้า" : "กลับ"}ถึง ${Utils.formatTime(time)}`
    );
  }

  adjustVolume(e, change) {
    e.preventDefault();
    const volume = Math.max(0, Math.min(100, this.player.getVolume() + change));
    this.player.setVolume(volume);
    this.announce(`ระดับเสียง ${volume}%`);
  }

  toggleMute(e) {
    e.preventDefault();
    const muted = this.player.getMute();
    this.player.setMute(!muted);
    this.announce(muted ? "เปิดเสียง" : "ปิดเสียง");
  }

  toggleFullscreen(e) {
    e.preventDefault();
    const fullscreen = this.player.getFullscreen();
    this.player.setFullscreen(!fullscreen);
    this.announce(fullscreen ? "ออกจากเต็มหน้าจอ" : "เข้าสู่เต็มหน้าจอ");
  }

  exitFullscreen(e) {
    if (this.player.getFullscreen()) {
      e.preventDefault();
      this.player.setFullscreen(false);
      this.announce("ออกจากเต็มหน้าจอ");
    }
  }

  seekToPercent(e, percent) {
    e.preventDefault();
    const duration = this.player.getDuration();
    const time = (duration * percent) / 100;
    this.player.seek(time);
    this.announce(`กรอไปที่ ${percent}% - ${Utils.formatTime(time)}`);
  }

  setupAriaLabels() {
    this.region = document.createElement("div");
    Object.assign(this.region, { id: "player-announcements" });
    this.region.setAttribute("aria-live", "polite");
    this.region.setAttribute("aria-atomic", "true");
    Object.assign(this.region.style, {
      position: "absolute",
      left: "-10000px",
      width: "1px",
      height: "1px",
      overflow: "hidden",
    });
    document.body.appendChild(this.region);

    this.player.on("ready", () => {
      setTimeout(
        () => this.enhanceControlLabels(),
        CONFIG.TIMING.ENHANCE_CONTROLS
      );
    });
  }

  enhanceControlLabels() {
    if (!this.playerElement) return;

    const labels = {
      ".jw-icon-playback": "เล่นหรือหยุดวิดีโอ",
      ".jw-icon-volume": "ควบคุมระดับเสียง",
      ".jw-icon-fullscreen": "สลับเต็มหน้าจอ",
      ".jw-icon-settings": "ตั้งค่าเครื่องเล่น",
      ".jw-icon-rewind": "กรอกลับ 10 วินาที",
      ".jw-icon-seek": "กรอไปข้างหน้า 10 วินาที",
      ".jw-slider-time": "แถบความคืบหน้าวิดีโอ",
      ".jw-slider-volume": "แถบระดับเสียง",
    };

    Object.entries(labels).forEach(([selector, label]) => {
      const el = this.playerElement.querySelector(selector);
      if (el) {
        el.setAttribute("aria-label", label);
        el.setAttribute("role", "button");
        if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
      }
    });
  }

  setupAnnouncements() {
    this.player.on("play", () => this.announce("วิดีโอเริ่มเล่น"));
    this.player.on("pause", () => this.announce("วิดีโอหยุดชั่วคราว"));
    this.player.on("complete", () => this.announce("การเล่นวิดีโอเสร็จสิ้น"));
    this.player.on("buffer", () => this.announce("กำลังโหลดวิดีโอ"));
    this.player.on("error", (e) =>
      this.announce(`เกิดข้อผิดพลาด: ${e.message || "มีปัญหา"}`)
    );
    this.player.on("mute", (e) =>
      this.announce(e.mute ? "ปิดเสียง" : "เปิดเสียง")
    );
    this.player.on("volume", (e) =>
      this.announce(`เปลี่ยนระดับเสียงเป็น ${e.volume}%`)
    );
  }

  setupFocusStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .jwplayer:focus { outline: 2px solid #007acc; outline-offset: 2px; }
      .jwplayer .jw-button-container:focus-within { outline: 1px solid #007acc; }
      .jw-icon:focus { outline: 2px solid #007acc; outline-offset: 1px; }
    `;
    document.head.appendChild(style);
  }

  announce(message) {
    if (!this.region) return;
    this.region.textContent = message;
    setTimeout(() => {
      if (this.region) this.region.textContent = "";
    }, CONFIG.TIMING.ANNOUNCE_CLEAR);
  }

  cleanup() {
    this.eventManager.clear();
    this.region?.remove();
    this.region = null;
  }
}

class ContinuePlayManager {
  constructor(player, videoId) {
    this.player = player;
    this.videoId = videoId;
    this.dialog = null;
    this.timer = null;
    this.countdown = CONFIG.TIMING.COUNTDOWN_DURATION;
    this.eventManager = new EventManager();
    this.keyHandler = null;
    this.clickHandler = null;
  }

  check() {
    if (!this.videoId) return false;

    const savedTime = StorageManager.getSavedTime(this.videoId);
    if (!savedTime || savedTime <= CONFIG.TIMING.MIN_CONTINUE_TIME)
      return false;

    const config = window.playerConfig;
    if (config?.continuePlayBackArk) {
      this.show(savedTime);
    } else {
      this.continue(savedTime);
    }
    return true;
  }

  show(savedTime) {
    qs("#continuePlayDialog")?.remove();
    this.player.pause();

    this.dialog = ContinuePlayDialog.create(savedTime);
    document.body.appendChild(this.dialog);

    setTimeout(
      () => this.dialog?.classList.remove("hidden"),
      CONFIG.TIMING.BUTTON_DELAY
    );

    this.setupEvents(savedTime);
    this.startCountdown(savedTime);

    const playerEl = qs(".jwplayer");
    if (playerEl) playerEl.style.pointerEvents = "none";
  }

  setupEvents(savedTime) {
    qs("#btnContinue")?.addEventListener("click", () =>
      this.continue(savedTime)
    );
    qs("#btnRestart")?.addEventListener("click", () => this.restart());

    this.clickHandler = (e) => {
      if (
        this.dialog &&
        !this.dialog.contains(e.target) &&
        !e.target.closest(".jw-controls")
      ) {
        this.continue(savedTime);
      }
    };
    document.addEventListener("click", this.clickHandler);

    this.keyHandler = (e) => {
      if (!this.dialog) return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        this.continue(savedTime);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.restart();
      }
    };
    document.addEventListener("keydown", this.keyHandler);
  }

  startCountdown(savedTime) {
    this.countdown = CONFIG.TIMING.COUNTDOWN_DURATION;
    const countEl = qs("#countdownNumber");
    const circleEl = qs("#progressCircle");
    const circumference = 2 * Math.PI * 16;

    this.timer = setInterval(() => {
      this.countdown--;

      if (countEl) {
        countEl.textContent = this.countdown;
        countEl.parentElement.style.animation = "countdownPulse 1s ease-in-out";
      }

      if (circleEl) {
        const offset =
          circumference -
          (circumference *
            (CONFIG.TIMING.COUNTDOWN_DURATION - this.countdown)) /
            CONFIG.TIMING.COUNTDOWN_DURATION;
        circleEl.style.strokeDashoffset = offset;
      }

      if (this.countdown <= 0) {
        clearInterval(this.timer);
        this.continue(savedTime);
      }
    }, 1000);
  }

  continue(savedTime) {
    this.hide();
    this.player.seek(savedTime);
    this.player.play();
  }

  restart() {
    this.hide();
    this.player.seek(0);
    this.player.play();
    if (this.videoId) StorageManager.removeSavedTime(this.videoId);
  }

  hide() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }

    if (this.clickHandler) {
      document.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }

    const playerEl = qs(".jwplayer");
    if (playerEl) playerEl.style.pointerEvents = "auto";

    if (this.dialog) {
      this.dialog.classList.add("hiding");
      setTimeout(() => {
        this.dialog?.remove();
        this.dialog = null;
      }, CONFIG.TIMING.DIALOG_HIDE);
    }
  }

  cleanup() {
    this.hide();
    this.eventManager.clear();
  }
}


class UIController {
  constructor(player) {
    this.player = player;
    this.qualityLevels = null;
    this.labelMap = null; // normalized label map for vertical videos
  }

  /**
   * Normalize quality label from JWPlayer.
   * For vertical videos, JWPlayer uses the larger dimension as label
   * (e.g. "1280p" instead of "720p"). This maps them to standard names
   * using the medias config from the server.
   */
  normalizeQualityLabel(label) {
    if (!label) return label;
    if (this.labelMap && this.labelMap[label]) {
      return this.labelMap[label];
    }
    return label;
  }

  /**
   * Build a label mapping for non-standard quality labels.
   * Maps dimension-based labels (1280p, 854p, 640p) to standard resolution names.
   */
  buildLabelMap(levels) {
    const medias = window.playerConfig?.medias;
    if (!medias || !levels) return null;

    // Standard resolutions we expect
    const standardLabels = ["360p", "480p", "720p", "1080p"];
    const allStandard = levels.every(
      (l) => !l.label || l.label === "Auto" || standardLabels.includes(l.label)
    );
    if (allStandard) return null; // labels are already correct

    // Known dimension → standard resolution mapping
    // Covers both portrait and landscape edge cases
    const dimensionToRes = {
      "640": "360p",
      "854": "480p",
      "1280": "720p",
      "1920": "1080p",
    };

    const map = {};
    levels.forEach((level) => {
      if (!level.label || level.label === "Auto") return;
      const numStr = level.label.replace("p", "");
      if (dimensionToRes[numStr]) {
        map[level.label] = dimensionToRes[numStr];
      }
    });

    return Object.keys(map).length > 0 ? map : null;
  }

  handleQualitySwitch(currentQuality) {
    const level = this.qualityLevels?.[currentQuality];
    const normalizedLabel = this.normalizeQualityLabel(level?.label);
    const icon = IconManager.get(normalizedLabel);

    if (!icon) {
      this.player.removeButton("qSwitch");
    } else {
      this.player.addButton(icon, normalizedLabel, () => {}, "qSwitch");
    }
  }


  addForwardButton() {
    const icon = IconManager.get("forward");
    const label = "ไปข้างหน้า 10 วินาที";
    const action = () => this.player.seek(this.player.getPosition() + 10);

    this.player.addButton(icon, label, action, "seek", "jw-icon-seek");

    setTimeout(() => this.reorderButtons(), CONFIG.TIMING.BUTTON_DELAY);
    setTimeout(
      () => this.addForwardOverlay(icon, label, action),
      CONFIG.TIMING.OVERLAY_DELAY
    );
  }

  reorderButtons() {
    const container = qs(".jw-button-container");
    if (!container) return;

    const rewind = container.querySelector(".jw-icon-rewind");
    const forward = container.querySelector(".jw-icon-seek");
    const fullscreen = container.querySelector(".jw-icon-fullscreen");

    if (rewind && forward && fullscreen && container) {
      container.appendChild(rewind);
      container.appendChild(forward);
      forward.classList.add("jw-icon-rewind");
    }
  }

  addForwardOverlay(icon, label, action) {
    const rewindContainer = qs(".jw-display-icon-rewind");
    if (!rewindContainer) return;

    const forwardContainer = rewindContainer.cloneNode(true);
    const forwardBtn = forwardContainer.querySelector(".jw-icon-rewind");

    if (forwardBtn) {
      forwardBtn.ariaLabel = label;
      forwardBtn.innerHTML = icon;
      forwardBtn.onclick = action;
    }

    const nextContainer = qs(".jw-display-icon-next");
    if (nextContainer?.parentNode) {
      nextContainer.parentNode.insertBefore(forwardContainer, nextContainer);
      nextContainer.remove();
    }
  }

  addCustomContextMenu() {
    const playerEl = qs(".jwplayer");
    if (!playerEl) return;

    playerEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const featured = qs(".jw-featured");
      if (featured) {
        featured.innerHTML = "";
        featured.appendChild(ContextMenuBuilder.create());
      }
    });
  }

  setQualityLevels(levels) {
    this.qualityLevels = levels;
    this.labelMap = this.buildLabelMap(levels);

    // Watch for quality menu rendering and rename labels
    if (this.labelMap) {
      this.watchQualityMenu();
    }
  }

  /**
   * Use MutationObserver to rename quality labels in JWPlayer's settings menu.
   * JWPlayer renders the quality menu lazily (only when user opens settings),
   * so we must observe DOM mutations to catch when items are added.
   */
  watchQualityMenu() {
    if (!this.labelMap) return;
    if (this._qualityObserver) return; // already watching

    const playerEl = qs(".jwplayer");
    if (!playerEl) return;

    const labelMap = this.labelMap;

    const applyRename = () => {
      const items = playerEl.querySelectorAll(
        ".jw-settings-content-item"
      );
      items.forEach((item) => {
        // Find the text element inside each quality menu item
        const walker = document.createTreeWalker(
          item, NodeFilter.SHOW_TEXT, null
        );
        let node;
        while ((node = walker.nextNode())) {
          const text = node.textContent.trim();
          if (text && labelMap[text]) {
            node.textContent = labelMap[text];
          }
        }
      });
    };

    this._qualityObserver = new MutationObserver(() => {
      applyRename();
    });

    this._qualityObserver.observe(playerEl, {
      childList: true,
      subtree: true,
    });

    // Also try immediately in case menu is already rendered
    applyRename();
  }
}

class PlayerSetup {
  constructor() {
    this.player = jwplayer("player");
    this.videoId = Utils.getVideoId();
    this.uiController = new UIController(this.player);
    this.accessibilityManager = null;
    this.continuePlayManager = null;
    this.eventManager = new EventManager();
    this.lastSavedTime = 0;
    this.debouncedSave = Utils.debounce(
      (id, time) => StorageManager.setSavedTime(id, time),
      CONFIG.TIMING.DEBOUNCE
    );

    this.hasTriedFallback = false;
    this.fallbackDomain = window.location.origin;
    this.segmentErrorCount = 0;
    this.segmentErrorThreshold = 20;

    // CCU WebSocket
    this.ccuWs = null;
    this.ccuWsUrl = null;
    this.ccuReconnectTimer = null;
    this.ccuReconnectDelay = 3000;
    this.ccuShouldReconnect = true;
  }

  async init() {
    const config = await this.createConfig();
    this.player.setup(config);

    // เริ่มต้น continuePlayManager ก่อน setupEvents
    if (window.playerConfig?.continuePlayBack) {
      this.continuePlayManager = new ContinuePlayManager(
        this.player,
        this.videoId
      );
    }

    this.setupCcuWs();
    this.setupEvents();

    const playerEl = qs(".jwplayer");
    if (playerEl) {
      this.accessibilityManager = new AccessibilityManager(
        this.player,
        playerEl
      );
      this.accessibilityManager.setup();
    }

    // Bandwidth monitoring (optional — loaded via /js/bandwidth.js)
    if (window.BandwidthMonitor) {
      window.BandwidthMonitor.init(this.player);
    }

    // Analytics (optional — loaded via /js/analytics.js)
    if (window.PlayerAnalytics) {
      window.PlayerAnalytics.init(this.player);
    }

    // Advert image overlay (optional — loaded via /js/advert-image.js)
    if (window.AdvertImage) {
      window.AdvertImage.init(this.player);
    }
  }

  async createConfig() {
    const config = window.playerConfig;
    const baseConfig = {
      key: CONFIG.PLAYER.KEY,
      width: CONFIG.PLAYER.WIDTH,
      height: CONFIG.PLAYER.HEIGHT,
      preload: CONFIG.PLAYER.PRELOAD,
      primary: CONFIG.PLAYER.PRIMARY,
      hlshtml: "true",
      controls: "true",
      pipIcon: config?.pip ? "enabled" : "disabled",
      autostart: !!config.autostart && !!config.mute,
      horizontalVolumeSlider: false,
      playbackRateControls: !!config.playbackRate,
      displayPlaybackLabel: false,
      liveTimeout: CONFIG.PLAYER.LIVE_TIMEOUT,
      trusted: true,
      autoPause: { viewability: true, pauseAds: true },
      cast: {},
      skin: {
        controlbar: { iconsActive: base_color },
        timeslider: { progress: base_color },
        menus: { background: "#121212", textActive: base_color },
      },
      repeat: config.repeat || false,
    };

    if (config.playlistUrl) {
      baseConfig.sources = [
        {
          file: `${config.playlistUrl}`,
          type: "application/vnd.apple.mpegurl",
        },
      ];
      baseConfig.image = `${config.poster}`;

      // Sprite thumbnail preview on seek bar
      if (config.spriteVttUrl) {
        baseConfig.tracks = [
          {
            file: config.spriteVttUrl,
            kind: "thumbnails",
          },
        ];
      }
    }

    if (config.watermarkEnabled) {
      baseConfig.logo = {
        file: config.watermarkUrl,
        link: config.watermarkWebUrl,
        position: config.watermarkPosition || "top-left",
        hide: true,
        opacity: config.watermarkOpacity || 50,
      };
    }

    if (config.vastUrl) {
      baseConfig.advertising = {
        client: "vast",
        outstream: false,
        preloadAds: false,
        rules: { startOnSeek: "pre", timeBetweenAds: 0 },
        schedule: [
          {
            offset: "pre",
            tag: `${window.location.origin}${config.vastUrl}`,
            type: "linear",
          },
        ],
      };
    }

    return baseConfig;
  }

  setupCcuWs() {
    const config = window.playerConfig;
    if (!config?.ccuWs || !this.videoId) return;

    this.ccuWsUrl = config.ccuWs;
    this.connectCcuWs();
  }

  connectCcuWs() {
    if (!this.ccuWsUrl || this.ccuWs) return;
    try {
      // Auto-detect ws/wss: localhost uses ws://, external domains use wss://
      const host = this.ccuWsUrl.replace(/^wss?:\/\//, "");
      const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
      const wsProtocol = isLocal ? "ws://" : "wss://";
      const wsUrl = `${wsProtocol}${host}/ws?slug=${encodeURIComponent(this.videoId)}`;
      this.ccuWs = new WebSocket(wsUrl);
      this.ccuWs.onopen = () => {
        this.ccuReconnectDelay = 3000;
      };
      this.ccuWs.onclose = () => {
        this.ccuWs = null;
        if (this.ccuShouldReconnect) this.scheduleCcuReconnect();
      };
      this.ccuWs.onerror = () => {
        if (this.ccuWs) this.ccuWs.close();
      };
    } catch (e) {
      this.scheduleCcuReconnect();
    }
  }

  scheduleCcuReconnect() {
    if (!this.ccuShouldReconnect) return;
    if (this.ccuReconnectTimer) clearTimeout(this.ccuReconnectTimer);
    this.ccuReconnectTimer = setTimeout(() => {
      this.ccuReconnectTimer = null;
      this.connectCcuWs();
    }, this.ccuReconnectDelay);
    this.ccuReconnectDelay = Math.min(this.ccuReconnectDelay * 1.5, 30000);
  }

  disconnectCcuWs() {
    this.ccuShouldReconnect = false;
    if (this.ccuReconnectTimer) {
      clearTimeout(this.ccuReconnectTimer);
      this.ccuReconnectTimer = null;
    }
    if (this.ccuWs) {
      this.ccuWs.close();
      this.ccuWs = null;
    }
  }


  /**
   * Proactively prefetch the video.m3u8 of a new resolution
   * when user switches quality. This warms the CDN cache so the player
   * doesn't have to wait for cold origin pulls.
   * Actual segment prewarming is handled by prewarm.js once the player
   * starts fetching from the new stream.
   */
  prefetchResolutionM3u8(qualityIndex) {
    try {
      const levels = this.player.getQualityLevels();
      if (!levels || qualityIndex <= 0) return; // 0 = Auto, skip

      const level = levels[qualityIndex];
      if (!level?.label) return;

      // Get the content host from playlist URL
      const config = window.playerConfig;
      if (!config?.playlistUrl) return;

      // Parse the playlist URL to get the content host
      const playlistUrl = new URL(config.playlistUrl);
      const contentHost = playlistUrl.origin;

      // Determine which resolution slug to prefetch from medias config
      const medias = config.medias;
      if (!medias) return;

      // Map label to resolution key (handle both normal and vertical videos)
      const labelNum = level.label.replace("p", "");
      const resMap = {
        "360": "360", "640": "360",
        "480": "480", "854": "480",
        "720": "720", "1280": "720",
        "1080": "1080", "1920": "1080",
      };
      const resKey = resMap[labelNum];
      const mediaSlug = resKey ? medias[resKey] : null;

      if (!mediaSlug) return;

      // Prefetch only the video.m3u8 of the target resolution
      // prewarm.js will handle segment prewarming once player starts fetching
      const m3u8Url = `${contentHost}/${mediaSlug}/video.m3u8`;

      console.log(`🔥 Prefetch quality switch: ${level.label} → ${m3u8Url}`);

      fetch(m3u8Url, { method: "GET", mode: "no-cors", priority: "high" })
        .catch(() => {});
    } catch (e) {
      // Silently fail — prefetch is best-effort
    }
  }

  tryFallbackSource() {
    // ถ้าลอง fallback แล้วไม่ต้องลองอีก
    if (this.hasTriedFallback) {
      console.error("Fallback already tried, giving up");
      return;
    }

    this.hasTriedFallback = true;
    const config = window.playerConfig;

    if (!config || !config.playlistUrl) {
      console.error("No playlistUrl to fallback");
      return;
    }

    // ── Disable VAST ads on fallback to prevent re-loading video ads ──
    delete config.vastUrl;

    // ดึง path จาก playlistUrl เดิม แล้วใช้ fallbackDomain แทน
    try {
      const originalUrl = new URL(config.playlistUrl);
      const fallbackUrl = `${this.fallbackDomain}${originalUrl.pathname}`;
      const fallbackImage = config.poster
        ? `${this.fallbackDomain}${new URL(config.poster).pathname}`
        : "";

      console.log(`🔄 Trying fallback: ${fallbackUrl}`);

      // Load with per-item adschedule override to disable ads on retry
      this.player.load([{
        file: fallbackUrl,
        type: "application/vnd.apple.mpegurl",
        image: fallbackImage,
        adschedule: []
      }]);

    } catch (e) {
      console.error("Fallback URL construction failed:", e);
    }
  }

  setupEvents() {
    this.player
      .on("ready", () => {
        this.uiController.addForwardButton();
        this.uiController.addCustomContextMenu();
      })
      .on("levels", (e) => {
        this.uiController.setQualityLevels(e.levels);
        this.uiController.handleQualitySwitch(e.currentQuality);
      })
      .on("levelsChanged", (e) => {
        this.uiController.handleQualitySwitch(e.currentQuality);
        // Proactively prefetch the new resolution's m3u8 to warm CDN cache
        this.prefetchResolutionM3u8(e.currentQuality);
      })
      .on("visualQuality", (e) =>
        this.uiController.handleQualitySwitch(e.level.index)
      )
      .on("complete", () => {
        if (this.videoId) StorageManager.removeSavedTime(this.videoId);
      })
      .on("error", (e) => {
        console.error("Player error:", this.videoId, e.message || e);
        this.tryFallbackSource();
      })
      .on("warning", (e) => {
        // JWPlayer warning event จับ segment errors ได้
        if (e.code >= 300000 && e.code < 400000) {
          // HLS segment errors (3xxxxx codes)
          this.segmentErrorCount++;
          console.warn(`⚠️ HLS warning ${this.segmentErrorCount}/${this.segmentErrorThreshold}:`, e.message);
          
          if (this.segmentErrorCount >= this.segmentErrorThreshold) {
            console.error(`❌ Segment errors exceeded threshold, switching to fallback`);
            this.tryFallbackSource();
          }
        }
      })
      .on("setupError", (e) => console.error("Setup error:", e.message || e));

    if (this.continuePlayManager) {
      this.player.on("ready", () => {
        setTimeout(
          () => this.continuePlayManager.check(),
          CONFIG.TIMING.DIALOG_DELAY
        );
      });

      this.player.on("time", (e) => {
        if (!this.videoId) return;
        const time = e.position;
        if (!Utils.isValidTime(time)) return;

        if (
          time - this.lastSavedTime >= CONFIG.TIMING.SAVE_INTERVAL ||
          Math.abs(time - this.lastSavedTime) >= 10
        ) {
          this.debouncedSave(this.videoId, time);
          this.lastSavedTime = time;
        }
      });

      this.player.on("pause", () => {
        if (!this.videoId) return;
        const time = this.player.getPosition();
        if (Utils.isValidTime(time) && time > CONFIG.TIMING.MIN_SAVE_TIME) {
          this.debouncedSave(this.videoId, time);
          this.lastSavedTime = time;
        }
      });

      this.player.on("seek", (e) => {
        if (!this.videoId) return;
        const time = e.position;
        if (Utils.isValidTime(time) && time > CONFIG.TIMING.MIN_SAVE_TIME) {
          this.debouncedSave(this.videoId, time);
          this.lastSavedTime = time;
        }
      });
    }
  }

  cleanup() {
    window.BandwidthMonitor?.stop();
    window.PlayerAnalytics?.stop();
    window.AdvertImage?.stop();
    this.disconnectCcuWs();
    this.accessibilityManager?.cleanup();
    this.continuePlayManager?.cleanup();
    this.eventManager.clear();
    this.player?.remove();
  }
}

function initPlayer() {
  if (window.hplayInstance) {
    console.warn("Player already initialized");
    return window.hplayInstance;
  }

  if (typeof jwplayer === "undefined") {
    console.error("JWPlayer not loaded");
    return null;
  }

  if (!window.playerConfig) {
    console.error("Player config not found");
    return null;
  }

  try {
    const instance = new PlayerSetup();
    instance.init();
    window.hplayInstance = instance;
    return instance;
  } catch (error) {
    console.error("Player init failed:", error);
    return null;
  }
}

function waitForJWPlayer(callback) {
  const check = setInterval(() => {
    if (typeof jwplayer !== "undefined") {
      clearInterval(check);
      callback();
    }
  }, 100);

  setTimeout(() => {
    clearInterval(check);
    if (!window.hplayInstance) {
      console.error("JWPlayer timeout");
    }
  }, 10000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () =>
    waitForJWPlayer(initPlayer)
  );
} else {
  waitForJWPlayer(initPlayer);
}

window.oncontextmenu = () => false;

document.addEventListener("keydown", (e) => {
  if (
    (e.ctrlKey && e.key === "u") ||
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && ["I", "C", "J"].includes(e.key))
  ) {
    e.preventDefault();
  }
});

window.addEventListener("beforeunload", () => window.hplayInstance?.cleanup());
window.addEventListener("pagehide", () => window.hplayInstance?.cleanup());
