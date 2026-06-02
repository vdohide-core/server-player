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

const IconManager = {
    forward: '<svg xmlns="http://www.w3.org/2000/svg" class="jw-svg-icon jw-svg-icon-seek" viewBox="0 0 240 240" focusable="false"><path d="m 25.993957,57.778 v 125.3 c 0.03604,2.63589 2.164107,4.76396 4.8,4.8 h 62.7 v -19.3 h -48.2 v -96.4 H 160.99396 v 19.3 c 0,5.3 3.6,7.2 8,4.3 l 41.8,-27.9 c 2.93574,-1.480087 4.13843,-5.04363 2.7,-8 -0.57502,-1.174985 -1.52502,-2.124979 -2.7,-2.7 l -41.8,-27.9 c -4.4,-2.9 -8,-1 -8,4.3 v 19.3 H 30.893957 c -2.689569,0.03972 -4.860275,2.210431 -4.9,4.9 z m 163.422413,73.04577 c -3.72072,-6.30626 -10.38421,-10.29683 -17.7,-10.6 -7.31579,0.30317 -13.97928,4.29374 -17.7,10.6 -8.60009,14.23525 -8.60009,32.06475 0,46.3 3.72072,6.30626 10.38421,10.29683 17.7,10.6 7.31579,-0.30317 13.97928,-4.29374 17.7,-10.6 8.60009,-14.23525 8.60009,-32.06475 0,-46.3 z m -17.7,47.2 c -7.8,0 -14.4,-11 -14.4,-24.1 0,-13.1 6.6,-24.1 14.4,-24.1 7.8,0 14.4,11 14.4,24.1 0,13.1 -6.5,24.1 -14.4,24.1 z m -47.77056,9.72863 v -51 l -4.8,4.8 -6.8,-6.8 13,-12.99999 c 3.02543,-3.03598 8.21053,-0.88605 8.2,3.4 v 62.69999 z"></path></svg>',
    download: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-icon lucide-download"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info-icon lucide-info"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    screenshot: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scan-eye-icon lucide-scan-eye"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="1"/><path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/></svg>',
    settings: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    chevronLeft : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left-icon lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>',
chevronRight : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right-icon lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>',
check: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-icon lucide-check"><path d="M20 6 9 17l-5-5"/></svg>',
cast: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><path d="M2 12a9 9 0 0 1 8 8"/><path d="M2 16a5 5 0 0 1 4 4"/><line x1="2" y1="20" x2="2.01" y2="20"/></svg>',
pip: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-picture-in-picture2-icon lucide-picture-in-picture-2"><path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4"/><rect width="10" height="7" x="12" y="13" rx="2"/></svg>',
fullscreenOn: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-maximize-icon lucide-maximize"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
fullscreenOff: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minimize-icon lucide-minimize"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>'
};

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

function initCustomUI(playerId, playerInstance) {
    if (!playerInstance) return;

    // ---- Shared Helpers (ใช้ร่วมกันหลายที่) ----

    const hexToRgba = (hex, op) => {
        if (!hex) return '';
        hex = String(hex).replace('#','');
        const r = parseInt(hex.substring(0,2), 16) || 255;
        const g = parseInt(hex.substring(2,4), 16) || 255;
        const b = parseInt(hex.substring(4,6), 16) || 255;
        const a = (op !== undefined && op !== null) ? op / 100 : 1;
        return `rgba(${r},${g},${b},${a})`;
    };

    const SP_CAP_DEFAULTS = {
        color: "#ffffff", fontOpacity: 100, fontFamily: "Arial", userFontScale: 1,
        edgeStyle: "none", edgeColor: "#000000", backgroundColor: "#000000",
        backgroundOpacity: 50, windowColor: "#000000", windowOpacity: 0
    };

    const colorDot = (hex) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${hex};margin-right:4px;border:1px solid rgba(255,255,255,.3);vertical-align:middle;"></span>`;

    // สร้าง CSS Override สำหรับ caption styles
    const buildCaptionCSS = (cap) => {
        const color = hexToRgba(cap.color, cap.fontOpacity);
        const bg = hexToRgba(cap.backgroundColor, cap.backgroundOpacity);
        const win = hexToRgba(cap.windowColor, cap.windowOpacity);
        const ff = cap.fontFamily || 'Arial';
        const fs = cap.userFontScale ? `${cap.userFontScale}em` : '';
        let ts = '';
        const ec = hexToRgba(cap.edgeColor, 100) || '#000000';
        if (cap.edgeStyle === 'dropShadow') ts = `0px 2px 2px ${ec}, 0px 2px 2px ${ec}, 0px 2px 2px ${ec}`;
        else if (cap.edgeStyle === 'raised') ts = `0px 0px 2px ${ec}, 0px 0px 2px ${ec}, 0px 0px 2px ${ec}`;
        else if (cap.edgeStyle === 'depressed') ts = `0px 0px 2px ${ec}`;
        else if (cap.edgeStyle === 'uniform') ts = `0px 0px 2px ${ec}, 0px 0px -2px ${ec}`;
        const props = `
            ${color ? `color: ${color} !important;` : ''}
            ${bg ? `background-color: ${bg} !important;` : ''}
            ${ff ? `font-family: ${ff} !important;` : ''}
            ${fs ? `font-size: ${fs} !important;` : ''}
            ${ts ? `text-shadow: ${ts} !important;` : ''}
        `;
        return `
            #${playerId} .jw-captions-text { ${props} }
            #${playerId} .jw-captions-text * { ${props} }
            #${playerId} .jw-captions-window { ${win ? `background-color: ${win} !important;` : ''} }
            #${playerId} video::cue { ${props} }
            #${playerId} video::cue(c) { ${props} }
            #${playerId} video::-webkit-media-text-track-display { ${bg ? `background-color: ${bg} !important;` : ''} }
            button[aria-controls="jw-${playerId}-settings-submenu-captionsSettings"] { display: none !important; }
        `;
    };

    // ดึง/สร้าง style element สำหรับ caption override
    const getCaptionStyleEl = () => {
        let el = document.getElementById(`sp-cc-override-${playerId}`);
        if (!el) {
            el = document.createElement("style");
            el.id = `sp-cc-override-${playerId}`;
            document.head.appendChild(el);
        }
        return el;
    };

    // ระบบดึงภาษาอ้างอิงจากตั้งค่าของ JW Player
    const getI18n = (key) => {
        const pConfig = playerInstance.getConfig();
        const activeLang = pConfig.language || "en";
        // ลองดึงภาษาปัจจุบัน ถ้าไม่มีคีย์นี้ให้ดึงจาก en แทน
        if (pConfig.intl && pConfig.intl[activeLang] && pConfig.intl[activeLang][key]) {
            return pConfig.intl[activeLang][key];
        }
        if (pConfig.intl && pConfig.intl["en"] && pConfig.intl["en"][key]) {
            return pConfig.intl["en"][key];
        }
        return key; // Fallback
    };

    // Helper for animating height when switching views
    const switchSpView = (hideEl, showEl) => {
        if (!hideEl || !showEl) return;
        const panel = document.getElementById("sp-panel");
        if (!panel) {
            hideEl.style.display = "none";
            showEl.style.display = showEl.id === "sp-view-caption" || showEl.id === "sp-view-cc-style" ? "flex" : "block";
            return;
        }
        const startHeight = panel.offsetHeight;
        panel.style.transition = "none";
        panel.style.height = startHeight + "px";
        
        hideEl.style.display = "none";
        showEl.style.display = showEl.id === "sp-view-caption" || showEl.id === "sp-view-cc-style" ? "flex" : "block";
        
        panel.style.height = "auto";
        const endHeight = panel.offsetHeight;
        
        panel.style.height = startHeight + "px";
        panel.offsetHeight; // force reflow
        
        panel.style.transition = "height 0.25s ease";
        panel.style.height = endHeight + "px";
        
        setTimeout(() => {
            panel.style.transition = "none";
            panel.style.height = "auto";
        }, 250);
    };


    // ===== Screenshot Modal (Shared) =====
    const openScreenshotModal = () => {
        const playerEl = document.getElementById(playerId);
        if (!playerEl) return;
        const v = playerEl.querySelector("video");
        if (!v || !v.videoWidth) return;

        // ปิด context menu / panels ก่อนแคป
        const ctxMenu = playerEl.querySelector(`#sp-ctx-${playerId}`);
        if (ctxMenu) ctxMenu.style.display = "none";
        const jwMenu = playerEl.querySelector(".jw-rightclick");
        if (jwMenu) jwMenu.style.display = "none";

        playerInstance.pause();

        const doCapture = () => {
            // 1. แคปเฟรมวิดีโอก่อน (ก่อนซ่อน <video>)
            let videoFrameCanvas = null;
            try {
                videoFrameCanvas = document.createElement("canvas");
                videoFrameCanvas.width = v.videoWidth;
                videoFrameCanvas.height = v.videoHeight;
                videoFrameCanvas.getContext("2d").drawImage(v, 0, 0);
            } catch (e) { videoFrameCanvas = null; }

            // 2. ซ่อนเฉพาะ <video> — ไม่ซ่อน subtitle/controls
            const videoRect = v.getBoundingClientRect();
            const playerRect = playerEl.getBoundingClientRect();
            const allVideos = playerEl.querySelectorAll("video");
            allVideos.forEach(vid => { vid.dataset.origDisplay = vid.style.display || ""; vid.style.setProperty("display", "none", "important"); });

            // 3. html2canvas จับ UI (subtitle + controls + overlays)
            window.html2canvas(playerEl, { useCORS: true, allowTaint: true, backgroundColor: null }).then(uiCanvas => {
                allVideos.forEach(vid => { vid.style.display = vid.dataset.origDisplay; });

                // 4. Composite: UI (base) → video (ใส่แทนที่จุดดำ) → subtitle (บนสุด)
                const ctx = uiCanvas.getContext("2d");
                const scaleX = uiCanvas.width / playerRect.width;
                const scaleY = uiCanvas.height / playerRect.height;

                // วาด video frame ลงตรงตำแหน่งวิดีโอ (แทนที่ช่องดำที่ video ถูกซ่อน)
                if (videoFrameCanvas && videoRect) {
                    const elemX = videoRect.left - playerRect.left;
                    const elemY = videoRect.top - playerRect.top;
                    const elemW = videoRect.width;
                    const elemH = videoRect.height;
                    const ratio = Math.min(elemW / v.videoWidth, elemH / v.videoHeight);
                    const contentW = v.videoWidth * ratio;
                    const contentH = v.videoHeight * ratio;
                    const contentX = elemX + (elemW - contentW) / 2;
                    const contentY = elemY + (elemH - contentH) / 2;
                    ctx.drawImage(videoFrameCanvas, contentX * scaleX, contentY * scaleY, contentW * scaleX, contentH * scaleY);
                }

                showScreenshotModal(uiCanvas.toDataURL("image/png"));

            }).catch(err => {
                allVideos.forEach(vid => { vid.style.display = vid.dataset.origDisplay; });
                if (videoFrameCanvas) {
                    showScreenshotModal(videoFrameCanvas.toDataURL("image/png"));
                } else {
                    alert(getI18n("customScreenshotFailed") || "Cannot capture screenshot");
                }
            });
        };

        const initCapture = () => {
            const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
            if (fsEl) {
                const exitFn = document.exitFullscreen ? document.exitFullscreen.bind(document) : document.webkitExitFullscreen ? document.webkitExitFullscreen.bind(document) : null;
                if (exitFn) { exitFn(); setTimeout(doCapture, 500); } else { setTimeout(doCapture, 100); }
            } else { setTimeout(doCapture, 100); }
        };

        // โหลด html2canvas ถ้ายังไม่มี
        if (!window.html2canvas) {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
            script.onload = initCapture;
            document.head.appendChild(script);
        } else {
            initCapture();
        }
    };

    // Premium modal UI สำหรับแสดง screenshot
    const showScreenshotModal = (imageURL) => {
        const playerEl = document.getElementById(playerId);
        if (!playerEl) return;
        const old = document.getElementById("sp-screenshot-modal"); if (old) old.remove();
        const i18nTitle = getI18n("customScreenshotTitle") || "Save Screenshot";
        const i18nDl = getI18n("customScreenshotDownload") || "Download Screenshot";

        const overlay = document.createElement("div");
        overlay.id = "sp-screenshot-modal";
        overlay.style.cssText = "position:absolute;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.82);backdrop-filter:blur(8px);animation:sp-ss-in .25s ease-out;";
        overlay.innerHTML = `<style>
            @keyframes sp-ss-in{0%{opacity:0;transform:scale(.92)}100%{opacity:1;transform:scale(1)}}
            @keyframes sp-ss-out{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.92)}}
            .sp-ss-card{background:rgba(25,25,30,.96);border-radius:16px;max-width:560px;width:92%;max-height:88%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.06);display:flex;flex-direction:column}
            .sp-ss-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.06)}
            .sp-ss-title{color:#fff;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
            .sp-ss-title svg{width:18px;height:18px}
            .sp-ss-x{background:none;border:none;color:rgba(255,255,255,.45);font-size:18px;cursor:pointer;padding:2px 8px;border-radius:6px;transition:all .12s}
            .sp-ss-x:hover{background:rgba(255,255,255,.08);color:#fff}
            .sp-ss-body{padding:16px;overflow-y:auto;flex:1}
            .sp-ss-img{width:100%;border-radius:10px;border:1px solid rgba(255,255,255,.08);box-shadow:0 4px 20px rgba(0,0,0,.4)}
            .sp-ss-foot{padding:12px 18px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:10px}
            .sp-ss-btn{flex:1;padding:11px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px}
            .sp-ss-p{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
            .sp-ss-p:hover{filter:brightness(1.15);transform:translateY(-1px)}
            .sp-ss-s{background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08)}
            .sp-ss-s:hover{background:rgba(255,255,255,.1);color:#fff}
        </style>
        <div class="sp-ss-card">
            <div class="sp-ss-head"><span class="sp-ss-title">${IconManager.screenshot} ${i18nTitle}</span><button class="sp-ss-x" id="sp-ss-x">✕</button></div>
            <div class="sp-ss-body"><img src="${imageURL}" class="sp-ss-img" alt="Screenshot"></div>
            <div class="sp-ss-foot">
                <a class="sp-ss-btn sp-ss-p" href="${imageURL}" download="screenshot_${Date.now()}.png" id="sp-ss-dl"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>${i18nDl}</a>
                <button class="sp-ss-btn sp-ss-s" id="sp-ss-cls">Close</button>
            </div>
        </div>`;

        const wrapper = playerEl.querySelector(".jw-wrapper") || playerEl;
        wrapper.appendChild(overlay);
        const closeModal = () => { overlay.style.animation = "sp-ss-out .2s ease-in forwards"; setTimeout(() => { overlay.remove(); playerInstance.play(); }, 200); };
        overlay.querySelector("#sp-ss-x").onclick = closeModal;
        overlay.querySelector("#sp-ss-cls").onclick = closeModal;
        overlay.querySelector("#sp-ss-dl").addEventListener("click", () => setTimeout(closeModal, 150));
        overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
    };

    // ===== Watched Segments Tracker (jw-timesegment) =====
    const setupWatchedSegments = () => {
        const cfg = {...window.playerConfig,highlightWatched:true};
        if (!cfg.highlightWatched) return; // ปิดไว้ไม่ต้องแสดง
        const playerEl = document.getElementById(playerId);
        if (!playerEl) return;

        // events: [{start, end, status:'idle'|'watching'}]
        let events = [];
        let duration = 0;
        let rail = null;
        let activeIdx = -1; // index ของ event ที่กำลังดูอยู่

        const findRail = () => {
            // เช็คว่า rail ยังอยู่ใน DOM ไหม
            if (rail && rail.isConnected) return;
            rail = playerEl.querySelector(".jw-slider-time .jw-rail");
            if (rail) {
                rail.style.position = "relative";
                rail.style.zIndex = "1";
            }
        };

        // คำนวณ merged ranges จาก events ทั้งหมด (ไม่แก้ events)
        const getMergedRanges = () => {
            if (!events.length) return [];
            const ranges = events.map(e => ({ start: e.start, end: e.end }));
            ranges.sort((a, b) => a.start - b.start);
            const merged = [{ ...ranges[0] }];
            for (let i = 1; i < ranges.length; i++) {
                const last = merged[merged.length - 1];
                if (ranges[i].start <= last.end) {
                    last.end = Math.max(last.end, ranges[i].end);
                } else {
                    merged.push({ ...ranges[i] });
                }
            }
            return merged;
        };

        // render gradient
        const render = () => {
            findRail(); // ตรวจสอบ rail ทุกครั้ง
            if (!rail || !duration) return;
            const merged = getMergedRanges();
            if (!merged.length) { rail.style.backgroundImage = ""; return; }

            const stops = [];
            const color = "rgba(229,9,20,.35)";
            merged.forEach(r => {
                const s = (Math.max(0, r.start) / duration * 100).toFixed(2);
                const e = (Math.min(r.end, duration) / duration * 100).toFixed(2);
                if (s === e) return;
                stops.push(`transparent ${s}%`, `${color} ${s}%`, `${color} ${e}%`, `transparent ${e}%`);
            });
            rail.style.backgroundImage = stops.length
                ? `linear-gradient(to right, ${stops.join(", ")})`
                : "";
        };

        // เริ่ม event ใหม่ (ปิดอันเก่าก่อน)
        const startNewEvent = (pos) => {
            // ปิด event เก่า
            if (activeIdx >= 0 && events[activeIdx]) {
                events[activeIdx].status = "idle";
            }
            // สร้าง event ใหม่
            events.push({ start: pos, end: pos, status: "watching" });
            activeIdx = events.length - 1;
        };

        // อัพเดต end ของ event ที่กำลังดู
        const updateActiveEvent = (pos) => {
            if (activeIdx < 0 || !events[activeIdx] || events[activeIdx].status !== "watching") return false;
            events[activeIdx].end = Math.max(events[activeIdx].end, pos);
            return true;
        };

        // --- Events ---

        // เมื่อเริ่มเล่น
        playerInstance.on("play", () => {
            findRail();
            const pos = Math.floor(playerInstance.getPosition() || 0);
            // ถ้าไม่มี active event หรือ active event ห่างจาก pos มาก → สร้างใหม่
            if (activeIdx < 0 || !events[activeIdx] || events[activeIdx].status !== "watching" ||
                Math.abs(pos - events[activeIdx].end) > 3) {
                startNewEvent(pos);
            }
        });

        // seek → ปิด event เก่า
        playerInstance.on("seek", () => {
            if (activeIdx >= 0 && events[activeIdx]) {
                events[activeIdx].status = "idle";
            }
        });

        // seeked → เริ่ม event ใหม่ที่ตำแหน่งใหม่
        playerInstance.on("seeked", () => {
            setTimeout(() => {
                const pos = Math.floor(playerInstance.getPosition() || 0);
                startNewEvent(pos);
                render();
            }, 100);
        });

        // time → อัพเดต end ทุก tick
        playerInstance.on("time", (e) => {
            duration = e.duration || 0;
            if (!duration) return;
            findRail();

            const pos = Math.floor(e.position);
            if (pos < 0) return;

            // ถ้ามี active event → ขยาย end
            if (!updateActiveEvent(pos)) {
                // ไม่มี active → สร้างใหม่
                startNewEvent(pos);
            }

            render();
        });

        // pause → ไม่ปิด event (เพราะ buffering ก็ trigger pause)
        // event จะถูกปิดเมื่อ seek หรือเปลี่ยนวิดีโอเท่านั้น

        // เปลี่ยนวิดีโอ → reset ทั้งหมด
        playerInstance.on("playlistItem", () => {
            events = []; activeIdx = -1; duration = 0;
            if (rail) rail.style.backgroundImage = "";
        });
    };

    // ===== Resume Playback (เล่นต่อจากเดิม) =====
    const setupResumePlayback = () => {
        const cfg = window.playerConfig || {};
        const vodId = cfg.vodId || Utils.getVideoId();
        const resumeMode = cfg.resumePlay || (cfg.continuePlayBack ? "ask" : "off");
        const minViewTime = cfg.minViewTime || 10;
        if (!vodId || !resumeMode || resumeMode === "off") return;

        const storageKey = `sp-resume-${vodId}`;
        let saveTimer = null;
        let hasSeeked = false;

        // format seconds → "MM:SS"
        const fmtTime = (s) => {
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m}:${sec.toString().padStart(2, "0")}`;
        };

        // บันทึกตำแหน่งทุก 1 วินาที (debounced)
        playerInstance.on("time", (e) => {
            if (!e.position || e.position < minViewTime) return;
            if (saveTimer) return;
            saveTimer = setTimeout(() => {
                try {
                    localStorage.setItem(storageKey, JSON.stringify({
                        pos: Math.floor(e.position),
                        dur: Math.floor(e.duration || 0),
                        ts: Date.now()
                    }));
                } catch (err) {}
                saveTimer = null;
            }, 1000);
        });

        // ลบ record เมื่อดูจบ
        playerInstance.on("complete", () => {
            try { localStorage.removeItem(storageKey); } catch (e) {}
        });

        // เช็คตอนกดเล่นครั้งแรก
        playerInstance.on("play", () => {
            if (hasSeeked) return;
            hasSeeked = true;

            let saved;
            try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch (e) {}
            if (!saved || !saved.pos || saved.pos < minViewTime) return;

            const resumePos = saved.pos;

            if (resumeMode === "auto") {
                playerInstance.seek(resumePos);
                return;
            }

            // "ask" mode — แสดง dialog
            playerInstance.pause();
            const playerEl = document.getElementById(playerId);
            if (!playerEl) return;

            const overlay = document.createElement("div");
            overlay.id = "sp-resume-modal";
            overlay.style.cssText = "position:absolute;inset:0;z-index:19000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);animation:sp-ss-in .25s ease-out;";
            overlay.innerHTML = `<style>
                .sp-res-card{background:rgba(25,25,30,.96);border-radius:16px;max-width:380px;width:88%;box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.06);overflow:hidden}
                .sp-res-body{padding:24px 22px;text-align:center}
                .sp-res-icon{margin:0 auto 14px;width:52px;height:52px;border-radius:50%;background:rgba(229,9,20,.12);display:flex;align-items:center;justify-content:center}
                .sp-res-icon svg{width:26px;height:26px;color:#e50914}
                .sp-res-t{color:#fff;font-size:15px;font-weight:600;margin-bottom:6px}
                .sp-res-sub{color:rgba(255,255,255,.5);font-size:13px;margin-bottom:20px}
                .sp-res-time{display:inline-block;background:rgba(229,9,20,.15);color:#e50914;font-weight:700;font-size:14px;padding:6px 14px;border-radius:20px;margin-bottom:18px}
                .sp-res-btns{display:flex;gap:10px}
                .sp-res-btn{flex:1;padding:12px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;text-align:center}
                .sp-res-p{background:linear-gradient(135deg,#e50914,#ff3d47);color:#fff}
                .sp-res-p:hover{filter:brightness(1.15);transform:translateY(-1px)}
                .sp-res-s{background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08)}
                .sp-res-s:hover{background:rgba(255,255,255,.1);color:#fff}
            </style>
            <div class="sp-res-card">
                <div class="sp-res-body">
                    <div class="sp-res-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
                    <div class="sp-res-t">${getI18n("resumeTitle") || "Continue watching?"}</div>
                    <div class="sp-res-sub">${getI18n("resumeSubtitle") || "You left off at"}</div>
                    <div class="sp-res-time">${fmtTime(resumePos)}${saved.dur ? " / " + fmtTime(saved.dur) : ""}</div>
                    <div class="sp-res-btns">
                        <button class="sp-res-btn sp-res-p" id="sp-res-yes">${getI18n("resumeYes") || "Resume"}</button>
                        <button class="sp-res-btn sp-res-s" id="sp-res-no">${getI18n("resumeNo") || "Start over"}</button>
                    </div>
                </div>
            </div>`;

            const wrapper = playerEl.querySelector(".jw-wrapper") || playerEl;
            wrapper.appendChild(overlay);

            const closeModal = () => {
                overlay.style.animation = "sp-ss-out .2s ease-in forwards";
                setTimeout(() => overlay.remove(), 200);
            };

            overlay.querySelector("#sp-res-yes").addEventListener("click", () => {
                closeModal();
                playerInstance.seek(resumePos);
                playerInstance.play();
            });

            overlay.querySelector("#sp-res-no").addEventListener("click", () => {
                closeModal();
                try { localStorage.removeItem(storageKey); } catch (e) {}
                playerInstance.play();
            });

            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) {
                    closeModal();
                    playerInstance.play();
                }
            });
        });
    };

    // ===== Seek Indicator (Animated) =====
    const setupSeekIndicator = () => {
        const playerEl = document.getElementById(playerId);
        if (!playerEl) return;

        // inject CSS animations once
        const css = document.createElement("style");
        css.textContent = `
            @keyframes sp-seek-pop{0%{transform:scale(.7);opacity:0}30%{transform:scale(1.18);opacity:1}100%{transform:scale(1);opacity:1}}
            @keyframes sp-dot-r{0%{transform:translateX(0);opacity:.9}100%{transform:translateX(22px);opacity:0}}
            @keyframes sp-dot-l{0%{transform:translateX(0);opacity:.9}100%{transform:translateX(-22px);opacity:0}}
            .sp-sk{position:absolute;top:50%;z-index:500;pointer-events:none;display:flex;align-items:center;gap:6px;
                background:rgba(0,0,0,.55);backdrop-filter:blur(6px);color:#fff;font-family:inherit;font-size:20px;font-weight:700;
                padding:10px 18px;border-radius:50px;text-shadow:0 1px 4px rgba(0,0,0,.5);opacity:0;transition:opacity .15s}
            .sp-sk.show{opacity:1}
            .sp-sk.r{right:15%;transform:translate(50%,-50%)}
            .sp-sk.l{left:15%;transform:translate(-50%,-50%)}
            .sp-sk-t{animation:sp-seek-pop .32s ease-out}
            .sp-sk-c{position:relative;display:flex;align-items:center;width:22px;height:22px}
            .sp-sk-c svg{width:22px;height:22px}
            .sp-sk-d{position:absolute;width:5px;height:5px;border-radius:50%;background:#fff;top:50%;margin-top:-2.5px}
            .sp-sk-d.dr{left:50%;animation:sp-dot-r .4s ease-out forwards}
            .sp-sk-d.dl{right:50%;animation:sp-dot-l .4s ease-out forwards}
            .sp-sk-d:nth-child(2){animation-delay:.07s;opacity:.6}
            .sp-sk-d:nth-child(3){animation-delay:.14s;opacity:.3}
        `;
        document.head.appendChild(css);

        const wrapper = playerEl.querySelector(".jw-wrapper") || playerEl;
        const mkBadge = (cls) => { const el = document.createElement("div"); el.className = "sp-sk " + cls; wrapper.appendChild(el); return el; };
        const leftEl = mkBadge("l");
        const rightEl = mkBadge("r");
        let hideTimer = null, accumulated = 0, lastDir = 0;

        const showSeek = (sec) => {
            if ((sec > 0 && lastDir >= 0) || (sec < 0 && lastDir <= 0)) accumulated += sec;
            else accumulated = sec;
            lastDir = sec > 0 ? 1 : -1;

            const isR = accumulated > 0;
            const el = isR ? rightEl : leftEl;
            const other = isR ? leftEl : rightEl;
            const chev = isR ? IconManager.chevronRight : IconManager.chevronLeft;
            const dc = isR ? "dr" : "dl";

            const txt = `<span class="sp-sk-t" style="animation:none">${accumulated > 0 ? "+" : ""}${accumulated}s</span>`;
            const dots = `<span class="sp-sk-c">${chev}<span class="sp-sk-d ${dc}"></span><span class="sp-sk-d ${dc}"></span><span class="sp-sk-d ${dc}"></span></span>`;

            el.innerHTML = isR ? txt + dots : dots + txt;

            // re-trigger pop animation
            const t = el.querySelector(".sp-sk-t");
            if (t) { void t.offsetWidth; t.style.animation = ""; }

            el.classList.add("show");
            other.classList.remove("show");

            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => { leftEl.classList.remove("show"); rightEl.classList.remove("show"); accumulated = 0; lastDir = 0; }, 900);
        };


        // keyboard seek (←→ / J L) ก็ต้อง set flag
        document.addEventListener("keydown", (e) => {
            if (["ArrowLeft","ArrowRight","j","l"].includes(e.key) || ["ArrowLeft","ArrowRight","j","l"].includes(e.key.toLowerCase())) {
                playerInstance._seekFromBtn = true;
            }
        }, true);

        playerInstance.on("seek", (e) => {
            if (!playerInstance._seekFromBtn) return;
            playerInstance._seekFromBtn = false;
            const diff = Math.round(e.offset - e.position);
            if (Math.abs(diff) >= 2) showSeek(diff);
        });
    };

    // 1. เพิ่มปุ่ม ข้าม 10 วินาที (Forward)
    const addForwardButton = () => {
        const action = () => { playerInstance._seekFromBtn = true; playerInstance.seek(playerInstance.getPosition() + 10); };
        playerInstance.addButton(IconManager.forward, getI18n("customForward"), action, "seek", "jw-icon-seek");
        
        // จัดลำดับปุ่มข้างล่าง (รอ DOM พร้อมก่อน)
        setTimeout(() => reorderControlbar(), 100);

        // ดึงปุ่มข้ามขึ้นไปโชว์กลางจอคู่กับปุ่ม Play (สำหรับในมือถือหรือจอเล็ก)
        setTimeout(() => addForwardOverlay(IconManager.forward, getI18n("customForward"), action), 500);

        // Hook native rewind button + overlay rewind ให้ set flag ด้วย
        setTimeout(() => {
            const playerEl = document.getElementById(playerId);
            if (!playerEl) return;
            playerEl.querySelectorAll(".jw-icon-rewind").forEach(btn => {
                btn.addEventListener("click", () => { playerInstance._seekFromBtn = true; }, true);
            });
        }, 600);
    };

    // ฟังก์ชันเสริมสำหรับดึงปุ่มข้าม (Forward) ไปโชว์กลางจอเหมือนแอปมือถือ
    const addForwardOverlay = (icon, label, action) => {
        const playerEl = document.getElementById(playerId);
        if (!playerEl) return;

        const rewindContainer = playerEl.querySelector(".jw-display-icon-rewind");
        if (!rewindContainer) return;

        const forwardContainer = rewindContainer.cloneNode(true);
        const forwardBtn = forwardContainer.querySelector(".jw-icon-rewind");

        if (forwardBtn) {
            forwardBtn.ariaLabel = label;
            forwardBtn.innerHTML = icon;
            forwardBtn.onclick = action;
        }

        const nextContainer = playerEl.querySelector(".jw-display-icon-next");
        if (nextContainer && nextContainer.parentNode) {
            // สลับเอาปุ่ม Forward ไปแทนที่ Next
            nextContainer.parentNode.insertBefore(forwardContainer, nextContainer);
            nextContainer.remove();
        }
    };

    // 2. จัดลำดับปุ่มใน Controlbar แบบ Configurable
    // ใช้งาน: reorderControlbar(["rewind", "forward", "settings"])
    // ปุ่มที่รองรับ: "rewind", "forward", "settings"
    let _controlbarOrder = ["rewind", "forward", "settings"]; // ค่าเริ่มต้น
    const reorderControlbar = (order) => {
        if (order) _controlbarOrder = order;
        const playerEl = document.getElementById(playerId);
        if (!playerEl) return;
        const container = playerEl.querySelector(".jw-button-container");
        if (!container) return;

        // ทะเบียน selector ของแต่ละปุ่ม
        const selectorMap = {
            rewind:   ".jw-icon-rewind",
            forward:  ".jw-icon-seek",
            settings: ".jw-icon-settings-custom",
        };

        // หาปุ่มตาม order แล้ว append ใหม่ตามลำดับ (ปุ่มที่ append ทีหลังจะอยู่ขวาสุด)
        _controlbarOrder.forEach(name => {
            const sel = selectorMap[name];
            if (!sel) return;
            const btn = container.querySelector(sel);
            if (btn) {
                container.appendChild(btn);
                // forward ต้องมี class jw-icon-rewind เพื่อให้ JW จัดขนาดเหมือน rewind
                if (name === "forward") btn.classList.add("jw-icon-rewind");
            }
        });
    };

    // 3. เพิ่มปุ่ม Download อ้างอิงจาก jw-v2.js
    const addDownloadButton = () => {
        // โยนฟังก์ชันว่างๆ ไปให้ JW Player ก่อน เพื่อป้องกันการยิง Event ทับซ้อน
        playerInstance.addButton(IconManager.download, getI18n("customDownload"), () => {}, "download", "jw-icon-download");
    };

    // ปุ่มแคปหน้าจอ UI ทั้งเว็บ
    const addScreenshotButton = () => {
        playerInstance.addButton(IconManager.screenshot, getI18n("customScreenshot") || "Screenshot", () => {}, "screenshot", "jw-icon-screenshot");
    };

    // 4. แสดงการสร้าง Modal โดยใช้โครงสร้าง HTML ของ jw-shortcuts-tooltip เป๊ะๆ
    const createCustomModal = (title, contentHTML, options = {}) => {
        let overlays = document.querySelector(".jw-overlays");
        if (!overlays) overlays = document.getElementById(playerId);

        // ลบตัวเก่าทิ้งเพื่อไม่ให้ซ้อนกัน
        const oldModal = document.getElementById("my-custom-modal");
        if (oldModal) oldModal.remove();

        // 1. สร้างกล่องหลัก (Main Envelope)
        const modalDiv = document.createElement("div");
        modalDiv.id = "my-custom-modal";
        // ต้องมี jw-open เพื่อให้มันเด้งเปิดขึ้นมา
        modalDiv.className = "jw-shortcuts-tooltip jw-modal jw-reset jw-open";
        modalDiv.title = title;

        if (options.isLarge) {
            modalDiv.style.maxWidth = "800px";
            modalDiv.style.width = "90%";
            modalDiv.style.maxHeight = "95vh";
            modalDiv.style.overflowY = "auto";
        }

        // ป้องกันไม่ให้ JW Player รับรู้การคลิกภายใน Modal แล้วเผลอปิดมันทิ้งอัตโนมัติ
        // modalDiv.addEventListener("click", (e) => {
        //     e.stopPropagation();
        // });

        // 2. สร้างปุ่มกากบาทปิด (Close Button) ลอกคลาสจากที่คุณส่งมา
        const closeBtn = document.createElement("div");
        closeBtn.className = "jw-icon jw-icon-inline jw-button-color jw-reset jw-shortcuts-close";
        closeBtn.setAttribute("role", "button");
        closeBtn.setAttribute("tabindex", "0");
        closeBtn.setAttribute("aria-label", "Close");
        closeBtn.onclick = () => modalDiv.remove();
        closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="jw-svg-icon jw-svg-icon-close" viewBox="0 0 240 240" focusable="false"><path d="M134.8,120l48.6-48.6c2-1.9,2.1-5.2,0.2-7.2c0,0-0.1-0.1-0.2-0.2l-7.4-7.4c-1.9-2-5.2-2.1-7.2-0.2c0,0-0.1,0.1-0.2,0.2L120,105.2L71.4,56.6c-1.9-2-5.2-2.1-7.2-0.2c0,0-0.1,0.1-0.2,0.2L56.6,64c-2,1.9-2.1,5.2-0.2,7.2c0,0,0.1,0.1,0.2,0.2l48.6,48.7l-48.6,48.6c-2,1.9-2.1,5.2-0.2,7.2c0,0,0.1,0.1,0.2,0.2l7.4,7.4c1.9,2,5.2,2.1,7.2,0.2c0,0,0.1-0.1,0.2-0.2l48.7-48.6l48.6,48.6c1.9,2,5.2,2.1,7.2,0.2c0,0,0.1-0.1,0.2-0.2l7.4-7.4c2-1.9,2.1-5.2,0.2-7.2c0,0-0.1-0.1-0.2-0.2L134.8,120z"></path></svg>';

        // 3. สร้าง Container หลักสำหรับเนื้อหา
        const containerDiv = document.createElement("div");
        containerDiv.className = "jw-reset jw-shortcuts-container";
        containerDiv.setAttribute("role", "menu");

        // 4. ส่วนหัวเรื่อง (Header & Title)
        const headerDiv = document.createElement("div");
        headerDiv.className = "jw-reset jw-shortcuts-header";
        const titleSpan = document.createElement("span");
        titleSpan.className = "jw-reset jw-shortcuts-title";
        titleSpan.innerText = title;
        headerDiv.appendChild(titleSpan);

        const listDiv = document.createElement("div");
        listDiv.className = "jw-reset jw-shortcuts-tooltip-list";
        if (options.isLarge) {
            listDiv.style.maxHeight = "none";
        }
        
        const descDiv = document.createElement("div");
        descDiv.className = "jw-shortcuts-tooltip-descriptions jw-reset";
        if (options.isLarge) {
            descDiv.style.display = "flex";
            descDiv.style.flexDirection = "column";
            descDiv.style.gap = "15px";
            descDiv.style.width = "100%";
            descDiv.style.padding = "20px";
            descDiv.style.boxSizing = "border-box";
        }
        
        // ยัด HTML พิเศษแบบที่คุณต้องการเข้าไปข้างในนี้
        descDiv.innerHTML = contentHTML;
        
        listDiv.appendChild(descDiv);

        // นำทุกส่วนมาประกอบร่างกัน
        containerDiv.appendChild(headerDiv);
        containerDiv.appendChild(listDiv);

        modalDiv.appendChild(closeBtn);
        modalDiv.appendChild(containerDiv);

        overlays.appendChild(modalDiv);
    };

    // ปุ่มทดสอบเปิด Modal
    const addModalButton = () => {
        // สร้างปุ่มไว้ใน Controlbar ไปก่อน แล้วเดี๋ยวค่อยย้ายออก (ทิ้ง action ว่างไว้กันมันเล่นซ้ำตอนคลิก)
        playerInstance.addButton(IconManager.info, getI18n("customInfo"), () => {}, "info", "jw-icon-info");
    };

    // 6. ระบบ Toolbox แบบ Configurable — วางปุ่มอะไรตรงไหนก็ได้
    // ใช้งาน: setupTools({position:"top-right", button:["download","screenshot","info"]})
    //         setupTools({position:"bottom-right", button:["cast","pip","fullscreen"]})
    // position รองรับ: "top-left", "top-right", "bottom-left", "bottom-right"
    const setupTools = (config) => {
        const { position = "top-right", button = [] } = config || {};
        if (!button.length) return;


        const [vPos, hPos] = position.split("-");
        const isTop = vPos === "top";
        const isLeft = hPos === "left";
        const delay = isTop ? 150 : 200;

        setTimeout(() => {
            const playerEl = document.getElementById(playerId);
            if (!playerEl) return;

            // สร้างกล่อง Toolbox
            const toolbox = document.createElement("div");
            toolbox.className = `jw-reset my-toolbox-${position}`;
            toolbox.style.cssText = `
                position:absolute;
                ${isTop ? 'top:15px' : ''};
                ${isLeft ? 'left:15px' : 'right:15px'};
                display:flex;
                opacity:0;
                pointer-events:none;
                transition:opacity 0.25s ease${!isTop ? ', bottom 0.15s ease' : ''};
                background:rgba(0,0,0,.3);
                border-radius:28px;
            `;

            // Bottom position: คำนวณตำแหน่งตาม controlbar
            if (!isTop) {
                const repositionToolbox = () => {
                    const cb = playerEl.querySelector(".jw-controlbar");
                    const h = cb ? cb.offsetHeight : 44;
                    toolbox.style.bottom = (h + 14) + "px";
                };
                playerInstance.on('resize', repositionToolbox);
                playerInstance.on('fullscreen', () => setTimeout(repositionToolbox, 100));
                playerInstance.on('ready', repositionToolbox);
                playerInstance.on('firstFrame', repositionToolbox);
                playerInstance.on('play', repositionToolbox);
                window.addEventListener('resize', repositionToolbox);
                repositionToolbox();
                setTimeout(repositionToolbox, 500);
                setTimeout(repositionToolbox, 1000);
            }

            // Helper สร้างปุ่มใหม่
            const createBtn = (icon, label) => {
                const btn = document.createElement("div");
                btn.className = "jw-icon jw-icon-inline jw-button-color jw-reset";
                btn.setAttribute("role", "button");
                btn.setAttribute("tabindex", "0");
                btn.setAttribute("title", label);
                btn.setAttribute("aria-label", label);
                btn.innerHTML = icon;
                btn.style.cssText = "position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;width:44px;height:44px;";
                return btn;
            };

            // Helper ผูกปุ่มเข้า toolbox พร้อม debounce
            const attachButton = (btn, actionCallback) => {
                toolbox.appendChild(btn);
                btn.style.position = "relative";
                btn.style.cursor = "pointer";
                let isExecuting = false;
                const safeAction = (e) => {
                    if (e && e.preventDefault) e.preventDefault();
                    if (e && e.stopPropagation) e.stopPropagation();
                    if (isExecuting) return;
                    isExecuting = true;
                    setTimeout(() => isExecuting = false, 300);
                    actionCallback(e, btn);
                };
                btn.addEventListener("click", safeAction);
                btn.addEventListener("touchend", safeAction);
            };

            // ===== ทะเบียนปุ่มทั้งหมด =====
            const toolDefs = {
                download: () => {
                    const cfg = window.playerConfig;
                    if (!cfg || !cfg.downloadUrl) return; // ไม่มี URL ไม่ต้องแสดงปุ่ม
                    const btn = createBtn(IconManager.download, getI18n("customDownload") || "Download");
                    attachButton(btn, () => {
                        window.open(cfg.downloadUrl, '_blank');
                    });
                },

                info: () => {
                    let btn = playerEl.querySelector(".jw-icon-info");
                    if (!btn) btn = createBtn(IconManager.info, getI18n("customInfo") || "Info");
                    btn.setAttribute("title", getI18n("customInfo") || "Info");
                    btn.setAttribute("aria-label", getI18n("customInfo") || "Info");
                    attachButton(btn, (e) => {
                        if (e && e.preventDefault) e.preventDefault();
                        const existingModal = document.getElementById("my-custom-modal");
                        if (existingModal) { existingModal.remove(); return; }
                        playerInstance.pause();
                        setTimeout(() => {
                            createCustomModal(getI18n("customInfoTitle"), "ใส่ HTML หรือตัวเลือกของเมนูตรงนี้ได้เลย<br>ตอนนี้คลิกยังไงก็ไม่หายแล้วครับ (นอกจากกากบาท)");
                        }, 50);
                    });
                },

                screenshot: () => {
                    let btn = playerEl.querySelector(".jw-icon-screenshot");
                    if (!btn) btn = createBtn(IconManager.screenshot, getI18n("customScreenshot") || "Screenshot");
                    btn.setAttribute("title", getI18n("customScreenshot") || "Screenshot");
                    btn.setAttribute("aria-label", getI18n("customScreenshot") || "Screenshot");
                    attachButton(btn, openScreenshotModal);
                },

                cast: () => {
                    const castLabel = getI18n("customCast") || "Cast";
                    const btn = createBtn(IconManager.cast, castLabel);
                    btn.style.display = "none";
                    attachButton(btn, () => {
                        const nativeCast = playerEl.querySelector(".jw-icon-cast button, .jw-icon-cast google-cast-launcher");
                        if (nativeCast) { nativeCast.click(); }
                        else { const airplay = playerEl.querySelector(".jw-icon-airplay"); if (airplay) airplay.click(); }
                    });
                    // JW ใช้ internal model change ไม่ใช่ public event ต้องดูจาก native element แทน
                    const nativeCastIcon = playerEl.querySelector(".jw-icon-cast");
                    if (nativeCastIcon) {
                        const syncCast = () => {
                            const visible = nativeCastIcon.style.display !== "none" && !nativeCastIcon.classList.contains("jw-hidden");
                            btn.style.display = visible ? "" : "none";
                        };
                        syncCast();
                        new MutationObserver(syncCast).observe(nativeCastIcon, { attributes: true, attributeFilter: ["style", "class"] });
                    }
                },

                pip: () => {
                    const pipLabel = getI18n("customPip") || "Picture in Picture";
                    const btn = createBtn(IconManager.pip, pipLabel);
                    if (!document.pictureInPictureEnabled) btn.style.display = "none";
                    attachButton(btn, () => {
                        const video = playerEl.querySelector("video");
                        if (!video) return;
                        if (document.pictureInPictureElement) { document.exitPictureInPicture().catch(() => {}); }
                        else { video.requestPictureInPicture().catch(() => {}); }
                    });
                },

                fullscreen: () => {
                    const fsLabel = getI18n("customFullscreen") || "Fullscreen";
                    const btn = createBtn(IconManager.fullscreenOn, fsLabel);
                    attachButton(btn, () => {
                        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
                        if (isFs) { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); }
                        else { if (playerEl.requestFullscreen) playerEl.requestFullscreen(); else if (playerEl.webkitRequestFullscreen) playerEl.webkitRequestFullscreen(); }
                    });
                    const updateFsIcon = () => {
                        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
                        btn.innerHTML = isFs ? IconManager.fullscreenOff : IconManager.fullscreenOn;
                    };
                    document.addEventListener("fullscreenchange", updateFsIcon);
                    document.addEventListener("webkitfullscreenchange", updateFsIcon);
                }
            };

            // วนใส่ปุ่มตามลำดับที่กำหนด
            button.forEach(name => { if (toolDefs[name]) toolDefs[name](); });

            // ติดตั้งลงใน jw-overlays
            const overlays = playerEl.querySelector(".jw-overlays") || playerEl;
            overlays.appendChild(toolbox);

            // ซิงค์สถานะแสดง/ซ่อนกับ Controlbar จริงๆ
            const showToolbox = () => { toolbox.style.opacity = "1"; toolbox.style.pointerEvents = "auto"; };
            const hideToolbox = () => { toolbox.style.opacity = "0"; toolbox.style.pointerEvents = "none"; };

            // ดู class ของ controlbar จริง (jw-flag-user-inactive)
            const syncWithControlbar = () => {
                const state = playerInstance.getState();
                if (state === 'idle') { hideToolbox(); return; }
                if (state === 'paused') { showToolbox(); return; }
                const hasInactive = playerEl.classList.contains('jw-flag-user-inactive');
                if (hasInactive) { hideToolbox(); } else { showToolbox(); }
            };

            // MutationObserver จับ class change ของ playerEl
            const observer = new MutationObserver(syncWithControlbar);
            observer.observe(playerEl, { attributes: true, attributeFilter: ['class'] });

            playerInstance.on('userActive', syncWithControlbar);
            playerInstance.on('userInactive', syncWithControlbar);
            playerInstance.on('play', () => setTimeout(syncWithControlbar, 50));
            playerInstance.on('pause', showToolbox);

        }, delay);
    };


    // 5a. แก้ปัญหาเมนูคลิกขวา (JW Player Context Menu) ทะลุขอบวิดีโอ
    const fixContextMenuClipping = () => {
        const playerEl = document.getElementById(playerId);
        if (!playerEl) return;
        playerEl.addEventListener('contextmenu', () => {
            setTimeout(() => {
                const rightClickMenu = playerEl.querySelector(".jw-rightclick") || playerEl.querySelector(".jw-menu");
                if (rightClickMenu) {
                    rightClickMenu.style.marginLeft = "0px";
                    rightClickMenu.style.marginTop = "0px";
                    const menuRect = rightClickMenu.getBoundingClientRect();
                    const playerRect = playerEl.getBoundingClientRect();
                    if (menuRect.right > playerRect.right) {
                        rightClickMenu.style.marginLeft = `-${menuRect.right - playerRect.right + 10}px`;
                    }
                    if (menuRect.bottom > playerRect.bottom) {
                        rightClickMenu.style.marginTop = `-${menuRect.bottom - playerRect.bottom + 10}px`;
                    }
                }
            }, 10);
        });
    };

    // 5b. Custom Context Menu — แทนที่เมนูคลิกขวาทั้ง native และ JW (YouTube-style)
    const setupContextMenu = () => {
        const playerEl = document.getElementById(playerId);
        if (!playerEl) return;
        const cfg = window.playerConfig || {};
        const siteName = cfg.abouttext || "My Custom Player";

        // SVG Icons
        const ci = {
            play: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>`,
            pause: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
            mute: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>`,
            muteOff: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
            fs: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
            pip: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>`,
            loop: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>`,
            shot: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`,
            copy: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
            stats: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>`,
            kbd: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/></svg>`,
        };

        // Menu structure
        const sections = [
            { header: `PLAYER ${siteName.toUpperCase()}`, items: [
                { ic: "play", label: getI18n("customContextPlay") || "Play / Pause", key: "K",
                  action: () => playerInstance.getState() === "playing" ? playerInstance.pause() : playerInstance.play(),
                  getIcon: () => playerInstance.getState() === "playing" ? ci.pause : ci.play },
                { ic: "mute", label: getI18n("customContextMute") || "Mute / Unmute", key: "M",
                  action: () => playerInstance.setMute(!playerInstance.getMute()),
                  getIcon: () => playerInstance.getMute() ? ci.muteOff : ci.mute },
                { ic: "fs", label: getI18n("customFullscreen") || "Fullscreen", key: "F",
                  action: () => { const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement); if (isFs) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } else { (playerEl.requestFullscreen || playerEl.webkitRequestFullscreen).call(playerEl); } }},
                { ic: "pip", label: getI18n("customPip") || "Picture in Picture",
                  action: () => { const v = playerEl.querySelector("video"); if (!v) return; document.pictureInPictureElement ? document.exitPictureInPicture().catch(()=>{}) : v.requestPictureInPicture().catch(()=>{}); },
                  hidden: !document.pictureInPictureEnabled },
                { ic: "loop", label: getI18n("customContextLoop") || "Loop", toggle: true, _active: false,
                  action: (item) => { const l = !playerInstance.getConfig().repeat; playerInstance.setConfig({ repeat: l }); item._active = l; }},
            ]},
            { header: `TOOLS ${siteName.toUpperCase()}`, items: [
                { ic: "shot", label: getI18n("customScreenshot") || "Screenshot",
                  action: openScreenshotModal },
                { ic: "copy", label: getI18n("customContextCopyUrl") || "Copy Video URL",
                  action: () => navigator.clipboard.writeText(window.location.href).catch(()=>{}) },
                { ic: "stats", label: getI18n("customContextStats") || "Stats for Nerds", key: "I",
                  action: () => {
                      let o = document.getElementById(`sp-stats-${playerId}`);
                      if (o) { o.remove(); return; }
                      o = document.createElement("div"); o.id = `sp-stats-${playerId}`;
                      o.style.cssText = "position:absolute;top:10px;left:10px;background:rgba(0,0,0,.82);color:#0f0;font-family:monospace;font-size:11px;padding:12px 16px;border-radius:6px;z-index:9999;line-height:1.7;pointer-events:none;";
                      const upd = () => { if (!document.getElementById(`sp-stats-${playerId}`)) return; const q = (playerInstance.getVisualQuality && playerInstance.getVisualQuality()) || {};
                          o.innerHTML = [`<b>Resolution:</b> ${q.width||'-'}×${q.height||'-'}`,`<b>Bitrate:</b> ${q.bitrate?(q.bitrate/1000).toFixed(0)+'k':'-'}`,`<b>Buffer:</b> ${playerInstance.getBuffer?playerInstance.getBuffer().toFixed(1)+'s':'-'}`,`<b>Position:</b> ${playerInstance.getPosition?playerInstance.getPosition().toFixed(1)+'s':'-'}`,`<b>Duration:</b> ${playerInstance.getDuration?playerInstance.getDuration().toFixed(1)+'s':'-'}`,`<b>FPS:</b> ${q.frameRate||'-'}`,`<b>State:</b> ${playerInstance.getState()}`].join("<br>");
                          setTimeout(upd, 1000); };
                      (playerEl.querySelector(".jw-wrapper") || playerEl).appendChild(o); upd();
                  }},
                { ic: "kbd", label: getI18n("customContextKeyboard") || "Keyboard Shortcuts", key: "?",
                  action: () => {
                      let o = document.getElementById(`sp-shortcuts-${playerId}`);
                      if (o) { o.remove(); return; }
                      o = document.createElement("div"); o.id = `sp-shortcuts-${playerId}`;
                      o.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,.85);color:#fff;z-index:10001;display:flex;align-items:center;justify-content:center;cursor:pointer;";
                      o.onclick = () => o.remove();
                      const sc = [["K / Space",getI18n("customContextPlay")||"Play / Pause"],["M",getI18n("customContextMute")||"Mute / Unmute"],["F",getI18n("customFullscreen")||"Fullscreen"],["← / →",getI18n("customContextSeek")||"Seek ±10s"],["↑ / ↓",getI18n("customContextVolume")||"Volume ±5%"],["> / <",getI18n("customContextSpeed")||"Speed"]];
                      o.innerHTML = `<div style="background:rgba(30,30,30,.95);border-radius:12px;padding:24px 32px;min-width:300px;box-shadow:0 12px 40px rgba(0,0,0,.5);"><div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#ccc;">${getI18n("customContextKeyboard")||"Keyboard Shortcuts"}</div>${sc.map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);"><span style="color:#aaa;">${v}</span><kbd style="background:rgba(255,255,255,.1);padding:2px 10px;border-radius:4px;font-family:monospace;font-size:12px;color:#fff;">${k}</kbd></div>`).join("")}</div>`;
                      (playerEl.querySelector(".jw-wrapper") || playerEl).appendChild(o);
                  }},
            ]},
        ];

        // ซ่อน JW native context menu
        const hideStyle = document.createElement("style");
        hideStyle.textContent = `#${playerId} .jw-rightclick { display:none !important; }`;
        document.head.appendChild(hideStyle);

        // สร้าง menu
        const menu = document.createElement("div");
        menu.id = `sp-context-menu-${playerId}`;
        menu.style.cssText = "display:none;position:absolute;z-index:10000;min-width:240px;padding:0;background:rgba(20,20,25,.96);backdrop-filter:blur(16px);border-radius:10px;color:#fff;font-size:13px;font-family:inherit;box-shadow:0 10px 40px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.06);overflow:hidden;";

        const allItems = [];
        sections.forEach((sec, si) => {
            const hdr = document.createElement("div");
            hdr.style.cssText = `padding:10px 16px 4px;font-size:10px;font-weight:700;letter-spacing:1.5px;color:rgba(180,160,255,.7);text-transform:uppercase;${si > 0 ? "border-top:1px solid rgba(255,255,255,.07);margin-top:2px;" : ""}`;
            hdr.textContent = sec.header;
            menu.appendChild(hdr);

            sec.items.forEach(item => {
                if (item.hidden) return;
                allItems.push(item);
                const row = document.createElement("div");
                row.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:7px 16px;cursor:pointer;transition:background .1s;";
                row.addEventListener("mouseenter", () => row.style.background = "rgba(255,255,255,.07)");
                row.addEventListener("mouseleave", () => row.style.background = "");

                const left = document.createElement("span");
                left.style.cssText = "display:flex;align-items:center;gap:10px;";
                const iconEl = document.createElement("span");
                iconEl.style.cssText = "width:20px;height:20px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);";
                iconEl.innerHTML = item.getIcon ? item.getIcon() : (ci[item.ic] || "");
                const lblEl = document.createElement("span");
                lblEl.textContent = item.label;
                left.appendChild(iconEl);
                left.appendChild(lblEl);

                const right = document.createElement("span");
                right.style.cssText = "display:flex;align-items:center;gap:4px;";
                if (item.toggle) {
                    const tick = document.createElement("span");
                    tick.className = "sp-ctx-tick";
                    tick.style.cssText = "color:rgba(180,160,255,.9);font-size:14px;";
                    tick.textContent = item._active ? "✓" : "";
                    right.appendChild(tick);
                }
                if (item.key) {
                    const kbd = document.createElement("kbd");
                    kbd.style.cssText = "background:rgba(255,255,255,.08);color:rgba(255,255,255,.4);font-family:inherit;font-size:11px;padding:1px 7px;border-radius:4px;border:1px solid rgba(255,255,255,.08);";
                    kbd.textContent = item.key;
                    right.appendChild(kbd);
                }
                row.appendChild(left);
                row.appendChild(right);

                row.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (item.action) item.action(item);
                    if (item.toggle) { const t = row.querySelector(".sp-ctx-tick"); if (t) t.textContent = item._active ? "✓" : ""; }
                    if (item.getIcon) iconEl.innerHTML = item.getIcon();
                    if (!item.toggle) hideMenu();
                });
                item._row = row; item._iconEl = iconEl;
                menu.appendChild(row);
            });
        });

        (playerEl.querySelector(".jw-wrapper") || playerEl).appendChild(menu);
        const hideMenu = () => { menu.style.display = "none"; };

        playerEl.addEventListener("contextmenu", (e) => {
            e.preventDefault(); e.stopPropagation();
            allItems.forEach(it => {
                if (it.getIcon && it._iconEl) it._iconEl.innerHTML = it.getIcon();
                if (it.toggle && it._row) { const t = it._row.querySelector(".sp-ctx-tick"); if (t) t.textContent = it._active ? "✓" : ""; }
            });
            const rect = playerEl.getBoundingClientRect();
            let x = e.clientX - rect.left, y = e.clientY - rect.top;
            menu.style.display = "block";
            if (x + menu.offsetWidth > rect.width) x = rect.width - menu.offsetWidth - 8;
            if (y + menu.offsetHeight > rect.height) y = rect.height - menu.offsetHeight - 8;
            menu.style.left = Math.max(4, x) + "px";
            menu.style.top = Math.max(4, y) + "px";
        });

        document.addEventListener("click", hideMenu);
        document.addEventListener("contextmenu", (e) => { if (!playerEl.contains(e.target)) hideMenu(); });
        playerInstance.on("play", hideMenu);
        playerInstance.on("pause", hideMenu);
        playerInstance.on("seek", hideMenu);
    };

    // ---- Settings Button ----
    const addSettingsButton = () => {
        // JW Player API removeButton ไม่รองรับการลบปุ่ม Native (เช่น Settings, CC) 
        // ดังนั้นต้องใช้ CSS ในการซ่อนปุ่มเหล่านี้ออกจาก Controlbar
        const _styleId = `sp-hide-jw-settings-${playerId}`;
        if (!document.getElementById(_styleId)) {
            const _s = document.createElement("style");
            _s.id = _styleId;
            _s.textContent = [
                `#${playerId} .jw-icon-settings { display:none !important; }`,
                `#${playerId} .jw-settings-menu { display:none !important; }`,
                `#${playerId} .jw-icon-cc { display:none !important; }`,
                `#${playerId} .jw-icon-fullscreen { display:none !important; }`,
                `#${playerId} .jw-icon-pip { display:none !important; }`,
                `#${playerId} .jw-icon-cast { visibility:hidden !important; width:0 !important; padding:0 !important; overflow:hidden !important; }`,
                `#${playerId} .jw-icon-airplay { visibility:hidden !important; width:0 !important; padding:0 !important; overflow:hidden !important; }`
            ].join("\n");
            document.head.appendChild(_s);
        }

        playerInstance.addButton(IconManager.settings, getI18n("customSettings") || "Settings", () => {}, "settings", "jw-icon-settings-custom");
    };

    // สร้าง Settings Panel (positioned bottom-right เหนือ controlbar)
    const openSettingsModal = () => {
        const existing = document.getElementById("sp-panel");
        if (existing) { existing.remove(); return; }

        const playerEl = document.getElementById(playerId);
        if (!playerEl) return;

        let ignoreOutsideClick = false;

        // ---- ดึงข้อมูลจาก JW Player ----
        const levels = playerInstance.getQualityLevels ? playerInstance.getQualityLevels() : [];
        const currentQuality = playerInstance.getCurrentQuality ? playerInstance.getCurrentQuality() : 0;
        const rates = playerInstance.getPlaybackRates ? playerInstance.getPlaybackRates() : [0.25,0.5,0.75,1,1.25,1.5,1.75,2, 3, 4, 8];
        const currentRate = playerInstance.getPlaybackRate ? playerInstance.getPlaybackRate() : 1;
        const currentTrack = playerInstance.getCurrentCaptions ? playerInstance.getCurrentCaptions() : 0;

        // ---- label ตามภาษาของ JW ----
        const i18n = {
            settings : getI18n('customSettings') || 'Settings',
            captions : getI18n('customCaptions') || 'Subtitles',
            speed    : getI18n('customSpeed')    || 'Playback Speed',
            quality  : getI18n('customQuality')  || 'Quality',
            audio    : getI18n('customAudio')    || 'Audio Track',
            auto     : getI18n('customAuto')     || 'Auto',
            normal   : getI18n('customNormal')   || 'Normal',
        };

        // ---- Helper แปลงชื่อคุณภาพความคมชัด ----
        const formatQualityLabel = (lv) => {
            if (!lv) return '';
            
            // ตรวจสอบจาก height เป็นหลัก
            let h = lv.height ? parseInt(lv.height) : 0;
            
            // ถ้าไม่มี height ให้พยายามดึงตัวเลขจาก label
            if (!h && lv.label) {
                const numMatch = lv.label.match(/\d+/);
                if (numMatch) h = parseInt(numMatch[0]);
            }

            if (h) {
                // Map Vertical video dimensions to standard resolutions
                if (h === 640 || h === 360) return '360p';
                if (h === 854 || h === 480) return '480p';
                if (h === 1280 || h === 720) return '720p';
                if (h === 1920 || h === 1080) return '1080p';
                if (h === 2560 || h === 1440) return '1440p';
                if (h === 3840 || h === 2160) return '2K';
                if (h === 7680 || h === 4320) return '4K';
                return h + 'p';
            }
            
            return lv.label || '';
        };

        // คุณภาพที่กำลังเล่นจริง — ถ้า label เป็น "auto" ให้ใช้ height แทน
        const visualQ = playerInstance.getVisualQuality ? playerInstance.getVisualQuality() : null;
        const visualLabel = (() => {
            if (!visualQ || !visualQ.level) return '';
            const lv = visualQ.level;
            // ถ้า label เป็น "auto" → ใช้ height (เช่น 720p) แทน
            if (/^auto$/i.test((lv.label || '').trim())) {
                return lv.height ? formatQualityLabel({height: lv.height}) : '';
            }
            return formatQualityLabel(lv);
        })();

        // ---- Build Quality HTML — ข้าม JW Auto ใช้แถวของเราแทน ----
        const qualityHTML = (() => {
            if (!levels || levels.length === 0) return '<p style="color:#aaa;font-size:13px;padding:8px 0;">ไม่พบข้อมูลคุณภาพ</p>';

            const autoIdx = levels.findIndex(lv => /^auto$/i.test((lv.label || '').trim()));
            const autoTarget = autoIdx !== -1 ? autoIdx : -1; // index ที่ JW ใช้สำหรับ Auto

            const isAutoActive = currentQuality === autoTarget;
            const playingHint = isAutoActive && visualLabel ? ` <span style="color:#888;font-size:11px;">${visualLabel}</span>` : '';

            // แถว "อัตโนมัติ" ของเรา ชี้ไปที่ index Auto จริงของ JW
            let rows = `<div class="sp-item" data-quality="${autoTarget}"><span>${i18n.auto}${playingHint}</span><span class="sp-tick">${isAutoActive ? IconManager.check : ''}</span></div>`;

            // แถว resolution — loop forward = ลำดับ high→low ตาม JW, ข้าม Auto
            let hasResolution = false;
            for (let i = 0; i < levels.length; i++) {
                if (i === autoIdx) continue;
                const lv = levels[i];
                const label = formatQualityLabel(lv);
                if (!label) continue;
                hasResolution = true;
                const isActive = currentQuality === i;
                rows += `<div class="sp-item" data-quality="${i}"><span>${label}</span><span class="sp-tick">${isActive ? IconManager.check : ''}</span></div>`;
            }

            // ถ้าไม่มี resolution อื่น → แสดงข้อความแจ้ง
            if (!hasResolution) {
                rows += `<p style="color:#666;font-size:12px;padding:8px 16px;margin:0;">${getI18n('customNoOtherQuality') || 'ไม่พบคุณภาพอื่น'}</p>`;
            }

            return rows;
        })();

        // ---- Build Speed HTML ----
        const speedHTML = rates.map(r => {
            const label = r === 1 ? i18n.normal : r + 'x';
            return `<div class="sp-item" data-rate="${r}"><span>${label}</span><span class="sp-tick">${parseFloat(currentRate) === r ? IconManager.check : ''}</span></div>`;
        }).join('');

        // ---- Build Audio HTML ----
        const audioTracks   = playerInstance.getAudioTracks ? playerInstance.getAudioTracks() : [];
        const currentAudio  = playerInstance.getCurrentAudioTrack ? playerInstance.getCurrentAudioTrack() : 0;
        const hasMultiAudio = audioTracks.length > 1;
        const audioHTML = hasMultiAudio ? audioTracks.map((t, i) => {
            const label = t.name || t.language || ('Track ' + i);
            return `<div class="sp-item" data-audio="${i}"><span>${label}</span><span class="sp-tick">${currentAudio === i ? IconManager.check : ''}</span></div>`;
        }).join('') : '';
        const curAudioLabel = hasMultiAudio && audioTracks[currentAudio]
            ? (audioTracks[currentAudio].name || audioTracks[currentAudio].language || '')
            : '';

        // ---- Build Caption List ----
        const captionsList  = playerInstance.getCaptionsList ? playerInstance.getCaptionsList() : [];
        const hasMultiCaptions = captionsList.length > 1; // index 0 = off, 1+ = tracks
        const captionHTML = captionsList.map((c, i) => {
            return `<div class="sp-item" data-caption="${i}"><span>${c.label}</span><span class="sp-tick">${currentTrack === i ? IconManager.check : ''}</span></div>`;
        }).join('');
        const curCaptionLabel = captionsList[currentTrack] ? captionsList[currentTrack].label : '';

        // ---- คำนวณตำแหน่ง panel (เรียกซ้ำได้เมื่อ player resize) ----
        const settingsBtn2 = playerEl.querySelector(".jw-icon-settings-custom");
        const controlbar   = playerEl.querySelector(".jw-controlbar");
        const wrapperEl    = playerEl.querySelector(".jw-wrapper") || playerEl;

        const updatePanelPosition = (p) => {
            if (!p) return;
            const wRect = wrapperEl.getBoundingClientRect();
            const cbH   = controlbar ? controlbar.offsetHeight : 50;
            let left    = wRect.width - 230 - 8; // ค่าเริ่มต้นเผื่อปุ่มหาย
            if (settingsBtn2) {
                const bRect = settingsBtn2.getBoundingClientRect();
                // จุดเริ่มต้นให้เท่ากับขอบซ้ายของปุ่ม (start ที่ปุ่ม)
                left = bRect.left - wRect.left;
                // จำกัดไม่ให้ทะลุขอบขวาของวิดีโอ (width กล่อง = 230)
                const maxLeft = wRect.width - 230 - 4;
                left = Math.max(4, Math.min(left, maxLeft));
            }
            // โหมดจอเล็ก (jw-flag-small-player) → ลด max-height ลง
            const isSmall = playerEl.classList.contains("jw-flag-small-player");
            const maxH    = Math.round(wrapperEl.offsetHeight * (isSmall ? 0.6 : 0.75));
            p.style.bottom    = (cbH + 4) + 'px';
            p.style.left      = left + 'px';
            p.style.right     = 'auto';
            p.style.maxHeight = maxH + 'px';
        };

        // ---- สร้าง Panel DOM ----
        const panel = document.createElement("div");
        panel.id = "sp-panel";
        panel.style.cssText = `
            position:absolute;
            width:230px;
            background:rgba(15,15,15,.95);
            border-radius:6px;
            color:#fff;
            font-size:14px;
            font-family:inherit;
            z-index:1000;
            overflow:hidden;
            display:flex;
            flex-direction:column;
            box-shadow:0 4px 20px rgba(0,0,0,.6);
            pointer-events:auto;
        `;

        panel.innerHTML = `
<style>
@keyframes spFadeSlide {
    0% { opacity: 0; transform: translateX(10px); }
    100% { opacity: 1; transform: translateX(0); }
}
#sp-panel > div { animation: spFadeSlide 0.2s ease-out; }
#sp-panel .sp-header{padding:10px 16px;font-weight:600;font-size:13px;color:#aaa;border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0;}
#sp-panel .sp-item{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;cursor:pointer;transition:background .15s;}
#sp-panel .sp-item:hover{background:rgba(255,255,255,.08);}
#sp-panel .sp-item span:last-child{color:#aaa;font-size:13px;min-width:14px;text-align:right;}
#sp-panel .sp-row{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;cursor:pointer;transition:background .15s;}
#sp-panel .sp-row:hover{background:rgba(255,255,255,.08);}
#sp-panel .sp-value{font-size:13px;color:#aaa;display:flex;align-items:center;gap:4px;}
#sp-panel .sp-back{display:flex;align-items:center;gap:6px;padding:10px 16px;cursor:pointer;font-size:13px;color:#aaa;border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0;}
#sp-panel .sp-back:hover{background:rgba(255,255,255,.08);}
#sp-panel .sp-toggle{width:38px;height:22px;border-radius:11px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0;}
#sp-panel .sp-toggle-knob{width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;transition:left .2s;}
#sp-panel #sp-view-quality,#sp-panel #sp-view-speed{display:flex;flex-direction:column;overflow:hidden;}
#sp-panel #sp-quality-list,#sp-panel #sp-speed-list{overflow-y:auto;flex:1;max-height:200px;}
#sp-panel #sp-quality-list::-webkit-scrollbar,#sp-panel #sp-speed-list::-webkit-scrollbar{width:4px;}
#sp-panel #sp-quality-list::-webkit-scrollbar-thumb,#sp-panel #sp-speed-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:2px;}
#sp-panel svg { width: 16px; height: 16px; vertical-align: middle; }
#sp-panel .sp-value svg { margin-left: 4px; }
</style>
<div id="sp-view-main">
  <div class="sp-header">${i18n.settings}</div>
  ${hasMultiCaptions ? `<div class="sp-row" id="sp-open-caption">
    <span>${i18n.captions}</span>
    <span class="sp-value"><span id="sp-cur-caption">${curCaptionLabel}</span> ${IconManager.chevronRight}</span>
  </div>
  <div class="sp-row" id="sp-open-cc-style">
    <span>${getI18n('customCaptionSettings') || 'Caption Settings'}</span>
    <span class="sp-value">${IconManager.chevronRight}</span>
  </div>` : ''}
  <div class="sp-row" id="sp-open-speed">
    <span>${i18n.speed}</span>
    <span class="sp-value"><span id="sp-cur-speed">${currentRate === 1 ? i18n.normal : currentRate + 'x'}</span> ${IconManager.chevronRight}</span>
  </div>
  <div class="sp-row" id="sp-open-quality">
    <span>${i18n.quality}</span>
    <span class="sp-value"><span id="sp-cur-quality">${(() => {
        const lv = levels[currentQuality];
        if (!lv) return '';
        const isAuto = /^auto$/i.test((lv.label || '').trim());
        if (isAuto) return i18n.auto + (visualLabel ? ' ' + visualLabel : '');
        return formatQualityLabel(lv);
    })()}</span> ${IconManager.chevronRight}</span>
  </div>
  ${hasMultiAudio ? `<div class="sp-row" id="sp-open-audio">
    <span>${i18n.audio}</span>
    <span class="sp-value"><span id="sp-cur-audio">${curAudioLabel}</span> ${IconManager.chevronRight}</span>
  </div>` : ''}
</div>
<div id="sp-view-quality" style="display:none;">
  <div class="sp-back" id="sp-back-quality">${IconManager.chevronLeft} ${i18n.quality}</div>
  <div id="sp-quality-list">${qualityHTML}</div>
</div>
<div id="sp-view-speed" style="display:none;">
  <div class="sp-back" id="sp-back-speed">${IconManager.chevronLeft} ${i18n.speed}</div>
  <div id="sp-speed-list">${speedHTML}</div>
</div>
${hasMultiAudio ? `<div id="sp-view-audio" style="display:none;">
  <div class="sp-back" id="sp-back-audio">${IconManager.chevronLeft} ${i18n.audio}</div>
  <div id="sp-audio-list">${audioHTML}</div>
</div>` : ''}
${hasMultiCaptions ? `<div id="sp-view-caption" style="display:none;flex-direction:column;overflow:hidden;">
  <div class="sp-back" id="sp-back-caption">${IconManager.chevronLeft} ${i18n.captions}</div>
  <div id="sp-caption-list" style="overflow-y:auto;">${captionHTML}</div>
</div>` : ''}`;

        // แนบ panel กับ .jw-wrapper เพื่อให้อยู่เหนือ .jw-media (video element)
        const wrapper = playerEl.querySelector(".jw-wrapper") || playerEl;
        wrapper.appendChild(panel);
        updatePanelPosition(panel); // คำนวณตำแหน่งเริ่มต้น

        // ซ่อน JW native settings menu ถ้าเปิดอยู่
        const jwSettingsMenu = playerEl.querySelector(".jw-settings-menu");
        if (jwSettingsMenu) jwSettingsMenu.style.display = "none";

        // ResizeObserver — recalculate เมื่อ player เปลี่ยนขนาด
        const resizeObs = new ResizeObserver(() => {
            updatePanelPosition(document.getElementById("sp-panel"));
        });
        resizeObs.observe(wrapperEl);

        // ปิด panel เมื่อคลิกนอก panel (เหมือน JW native settings)
        const settingsBtnEl = playerEl.querySelector(".jw-icon-settings-custom");
        const onOutsideClick = (e) => {
            if (ignoreOutsideClick) return;
            const p = document.getElementById("sp-panel");
            if (!p) return;
            if (p.contains(e.target)) return;
            if (settingsBtnEl && settingsBtnEl.contains(e.target)) return;
            p.remove();
            // คืน JW settings menu กลับมา
            if (jwSettingsMenu) jwSettingsMenu.style.display = "";
            playerEl.removeEventListener("click", onOutsideClick, true);
            playerInstance.off("userInactive", keepControlsAlive);
            resizeObs.disconnect();
        };
        // ใช้ capture=true เพื่อให้รับ event ก่อน JW จะ stopPropagation
        setTimeout(() => playerEl.addEventListener("click", onOutsideClick, true), 0);

        // กัน controls ไม่ให้ซ่อนขณะ panel เปิดอยู่ (เหมือน JW native settings)
        const keepControlsAlive = () => {
            if (document.getElementById("sp-panel")) {
                // panel ยังเปิดอยู่ → รีเซ็ต inactivity timer ด้วย mousemove
                playerEl.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
            } else {
                // panel ปิดแล้ว → หยุด listen
                playerInstance.off("userInactive", keepControlsAlive);
            }
        };
        playerInstance.on("userInactive", keepControlsAlive);

        // ---- Wire up interactions ----
        setTimeout(() => {
            // navigate to quality
            const btnQ = document.getElementById("sp-open-quality");
            if (btnQ) btnQ.onclick = () => switchSpView(document.getElementById("sp-view-main"), document.getElementById("sp-view-quality"));
            
            // navigate to speed
            const btnS = document.getElementById("sp-open-speed");
            if (btnS) btnS.onclick = () => switchSpView(document.getElementById("sp-view-main"), document.getElementById("sp-view-speed"));
            
            // back buttons
            const backQ = document.getElementById("sp-back-quality");
            if (backQ) backQ.onclick = () => switchSpView(document.getElementById("sp-view-quality"), document.getElementById("sp-view-main"));
            
            const backS = document.getElementById("sp-back-speed");
            if (backS) backS.onclick = () => switchSpView(document.getElementById("sp-view-speed"), document.getElementById("sp-view-main"));
            
            // navigate to audio
            const btnA = document.getElementById("sp-open-audio");
            if (btnA) btnA.onclick = () => switchSpView(document.getElementById("sp-view-main"), document.getElementById("sp-view-audio"));
            
            const backA = document.getElementById("sp-back-audio");
            if (backA) backA.onclick = () => switchSpView(document.getElementById("sp-view-audio"), document.getElementById("sp-view-main"));
            // quality select
            document.querySelectorAll("#sp-quality-list .sp-item").forEach(el => {
                el.onclick = () => {
                    const q = parseInt(el.dataset.quality);
                    if (playerInstance.setCurrentQuality) playerInstance.setCurrentQuality(q);
                    document.querySelectorAll("#sp-quality-list .sp-item").forEach(x => { const s = x.querySelector(".sp-tick"); if(s) s.innerHTML = ""; });
                    const tick = el.querySelector(".sp-tick"); if(tick) tick.innerHTML = IconManager.check;
                    const cur = document.getElementById("sp-cur-quality");
                    if (cur) cur.textContent = q === -1 ? 'อัตโนมัติ' : (el.querySelector("span").textContent);
                    setTimeout(() => { document.getElementById("sp-view-quality").style.display = "none"; document.getElementById("sp-view-main").style.display = "block"; }, 150);
                };
            });
            // speed select
            document.querySelectorAll("#sp-speed-list .sp-item").forEach(el => {
                el.onclick = () => {
                    const r = parseFloat(el.dataset.rate);
                    if (playerInstance.setPlaybackRate) playerInstance.setPlaybackRate(r);
                    document.querySelectorAll("#sp-speed-list .sp-item").forEach(x => { const s = x.querySelector("span:last-child"); if(s) s.innerHTML = ""; });
                    const tick = el.querySelector("span:last-child"); if(tick) tick.innerHTML = IconManager.check;
                    const cur = document.getElementById("sp-cur-speed");
                    if (cur) cur.textContent = r === 1 ? 'ปกติ' : r + 'x';
                    setTimeout(() => switchSpView(document.getElementById("sp-view-speed"), document.getElementById("sp-view-main")), 150);
                };
            });
            // caption → เปิด sub-view ของเรา (track list + style settings)
            const btnCap = document.getElementById("sp-open-caption");
            if (btnCap) btnCap.onclick = () => switchSpView(document.getElementById("sp-view-main"), document.getElementById("sp-view-caption"));
            
            const backCap = document.getElementById("sp-back-caption");
            if (backCap) backCap.onclick = () => switchSpView(document.getElementById("sp-view-caption"), document.getElementById("sp-view-main"));

            // caption track select
            document.querySelectorAll("#sp-caption-list .sp-item").forEach(el => {
                el.onclick = () => {
                    const idx = parseInt(el.dataset.caption);
                    if (playerInstance.setCurrentCaptions) playerInstance.setCurrentCaptions(idx);
                    document.querySelectorAll("#sp-caption-list .sp-item").forEach(x => { const s = x.querySelector("span:last-child"); if(s) s.innerHTML = ""; });
                    const tick = el.querySelector("span:last-child"); if(tick) tick.innerHTML = IconManager.check;
                    const cur = document.getElementById("sp-cur-caption");
                    if (cur) cur.textContent = el.querySelector("span:first-child").textContent;
                    setTimeout(() => switchSpView(document.getElementById("sp-view-caption"), document.getElementById("sp-view-main")), 150);
                };
            });

            // ---- Caption Style Settings ----
            // ค่าจาก JW source (jwplayer.core.controls.js line 7842)
            const CC_HEX_OPTS = [
                {l: getI18n("colorWhite") || "White", v:"#ffffff"},
                {l: getI18n("colorBlack") || "Black", v:"#000000"},
                {l: getI18n("colorRed") || "Red", v:"#ff0000"},
                {l: getI18n("colorGreen") || "Green", v:"#00ff00"},
                {l: getI18n("colorBlue") || "Blue", v:"#0000ff"},
                {l: getI18n("colorYellow") || "Yellow", v:"#ffff00"},
                {l: getI18n("colorMagenta") || "Magenta", v:"#ff00ff"},
                {l: getI18n("colorCyan") || "Cyan", v:"#00ffff"}
            ];
            const CC_CONFIG = [
                { id:"color",            label: getI18n("fontColor") || "Color",          isColor:true,  isStr:true,  def:"#ffffff", opts:CC_HEX_OPTS },
                { id:"fontOpacity",      label: getI18n("fontOpacity") || "Font Opacity", isColor:false, isStr:false, def:100,       opts:[{l:"100%",v:100},{l:"75%",v:75},{l:"50%",v:50},{l:"25%",v:25}] },
                { id:"userFontScale",    label: getI18n("userFontScale") || "Font Size",        isColor:false, isStr:false, def:1,         opts:[{l:"200%",v:2},{l:"175%",v:1.75},{l:"150%",v:1.5},{l:"125%",v:1.25},{l:"100%",v:1},{l:"75%",v:0.75},{l:"50%",v:0.5}] },
                { id:"fontFamily",       label: getI18n("fontFamily") || "Font Family",      isColor:false, isStr:true,  def:"Arial",   opts:[{l:"Arial",v:"Arial"},{l:"Courier",v:"Courier"},{l:"Georgia",v:"Georgia"},{l:"Impact",v:"Impact"},{l:"Lucida Console",v:"Lucida Console"},{l:"Tahoma",v:"Tahoma"},{l:"Times New Roman",v:"Times New Roman"},{l:"Trebuchet MS",v:"Trebuchet MS"},{l:"Verdana",v:"Verdana"}] },
                { id:"edgeStyle",        label: getI18n("edgeStyle") || "Character Edge",        isColor:false, isStr:true,  def:"none",    opts:[{l: getI18n("edgeStyleNone") || "None",v:"none"},{l:"Raised",v:"raised"},{l:"Depressed",v:"depressed"},{l:"Uniform",v:"uniform"},{l:"Drop Shadow",v:"dropShadow"}] },
                { id:"edgeColor",        label: getI18n("edgeColor") || "Edge Color",      isColor:true,  isStr:true,  def:"#000000", opts:CC_HEX_OPTS },
                { id:"backgroundColor", label: getI18n("backgroundColor") || "Background Color",           isColor:true,  isStr:true,  def:"#000000", opts:CC_HEX_OPTS },
                { id:"backgroundOpacity",label: getI18n("backgroundOpacity") || "Background Opacity",    isColor:false, isStr:false, def:50,        opts:[{l:"100%",v:100},{l:"75%",v:75},{l:"50%",v:50},{l:"25%",v:25},{l:"0%",v:0}] },
                { id:"windowColor",      label: getI18n("windowColor") || "Window Color",           isColor:true,  isStr:true,  def:"#000000", opts:CC_HEX_OPTS },
                { id:"windowOpacity",    label: getI18n("windowOpacity") || "Window Opacity",    isColor:false, isStr:false, def:0,         opts:[{l:"100%",v:100},{l:"75%",v:75},{l:"50%",v:50},{l:"25%",v:25},{l:"0%",v:0}] },
            ];

            const curCC = (playerInstance.getConfig ? (playerInstance.getConfig().captions || {}) : {}) || {};
            const colorDot = (hex) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${hex};margin-right:4px;border:1px solid rgba(255,255,255,.3);vertical-align:middle;"></span>`;

            // สร้าง sp-view-cc-style
            const ccStyleView = document.createElement("div");
            ccStyleView.id = "sp-view-cc-style";
            ccStyleView.style.cssText = "display:none;flex-direction:column;overflow:hidden;";
            ccStyleView.innerHTML = `<div class="sp-back" id="sp-back-cc-style">${IconManager.chevronLeft} ${getI18n("customCaptionSettings") || "Caption Settings"}</div><div id="sp-cc-style-list" style="overflow-y:auto;flex:1;">` +
                CC_CONFIG.map(cfg => {
                    const cv = curCC[cfg.id] != null ? curCC[cfg.id] : cfg.def;
                    const co = cfg.opts.find(o => String(o.v) === String(cv));
                    const cl = co ? co.l : String(cv);
                    const dot = cfg.isColor ? colorDot(cv) : "";
                    return `<div class="sp-row" id="sp-cc-open-${cfg.id}"><span>${cfg.label}</span><span class="sp-value"><span id="sp-cc-cur-${cfg.id}">${dot}${cl}</span> ${IconManager.chevronRight}</span></div>`;
                }).join("") + `</div><div class="sp-row" id="sp-cc-reset" style="justify-content:center;color:#ff4444;border-top:1px solid rgba(255,255,255,0.1);font-weight:bold;cursor:pointer;">${getI18n("reset") || "Reset"}</div>`;
            const jwPanelEl = document.getElementById("sp-panel");
            if (jwPanelEl) jwPanelEl.appendChild(ccStyleView);

            // สร้าง option sub-view สำหรับแต่ละ setting
            CC_CONFIG.forEach(cfg => {
                const cv = curCC[cfg.id] != null ? curCC[cfg.id] : cfg.def;
                const optView = document.createElement("div");
                optView.id = `sp-view-cc-opt-${cfg.id}`;
                optView.style.cssText = "display:none;";
                optView.innerHTML = `<div class="sp-back" id="sp-back-cc-opt-${cfg.id}">${IconManager.chevronLeft} ${cfg.label}</div>` +
                    cfg.opts.map(o => {
                        const dot = cfg.isColor ? colorDot(o.v) : "";
                        const active = String(o.v) === String(cv);
                        return `<div class="sp-item" data-cc-id="${cfg.id}" data-cc-v="${o.v}" data-cc-l="${o.l}"><span>${dot}${o.l}</span><span class="sp-tick">${active ? IconManager.check : ''}</span></div>`;
                    }).join("");
                if (jwPanelEl) jwPanelEl.appendChild(optView);

                // back
                setTimeout(() => {
                    const b = document.getElementById(`sp-back-cc-opt-${cfg.id}`);
                    if (b) b.onclick = () => switchSpView(optView, ccStyleView);
                    // open
                    const btn = document.getElementById(`sp-cc-open-${cfg.id}`);
                    if (btn) btn.onclick = () => switchSpView(ccStyleView, optView);
                    // select → คลิก native button แบบไม่ปิดแท็บเอง
                    optView.querySelectorAll(".sp-item").forEach(el => {
                        el.onclick = (e) => {
                            e.stopPropagation(); // ไม่ให้ bubble ไปถึง onOutsideClick
                            const raw = el.dataset.ccV;
                            const lbl = el.dataset.ccL;
                            const applyVal = cfg.isStr ? raw : parseFloat(raw);
                            
                            // 1. รวมค่า Defaults ทั้งหมดเพื่อให้ครบถ้วน
                            const SP_CAP_DEFAULTS = {
                                color: "#ffffff", fontOpacity: 100, fontFamily: "Arial", userFontScale: 1,
                                edgeStyle: "none", edgeColor: "#000000", backgroundColor: "#000000",
                                backgroundOpacity: 50, windowColor: "#000000", windowOpacity: 0
                            };
                            const curCap = (playerInstance.getConfig ? (playerInstance.getConfig().captions || {}) : {}) || {};
                            const newCap = Object.assign({}, SP_CAP_DEFAULTS, curCap, { [cfg.id]: applyVal });
                            
                            // 2. เรียกใช้ Native API ตามคำขอ เพื่อให้บันทึกและอัพเดต Model ทันที
                            if (playerInstance.setCaptions) {
                                playerInstance.setCaptions(newCap);
                            }

                            // 3. Hack: บังคับปิดแล้วเปิดซับใหม่ เพื่อดึงซับที่หายไปกลับมา (ทำทุกการตั้งค่า)
                            const savedIdx = playerInstance.getCurrentCaptions ? playerInstance.getCurrentCaptions() : 0;
                            if (savedIdx > 0 && playerInstance.setCurrentCaptions) {
                                playerInstance.setCurrentCaptions(0);
                                setTimeout(() => {
                                    playerInstance.setCurrentCaptions(savedIdx);
                                }, 50);
                            }

                            // 4. สร้าง CSS Injection แบบ Force Override ทับ VTT Inline Styles และ JW Bugs!
                            getCaptionStyleEl().innerHTML = buildCaptionCSS(newCap);

                            // Update UI เครื่องหมายถูก
                            optView.querySelectorAll(".sp-tick").forEach(s => s.innerHTML = "");
                            const tick = el.querySelector(".sp-tick"); if (tick) tick.innerHTML = IconManager.check;
                            const curEl = document.getElementById(`sp-cc-cur-${cfg.id}`);
                            if (curEl) curEl.innerHTML = (cfg.isColor ? colorDot(raw) : "") + lbl;
                            
                            // ไม่มีการใช้ setTimeout ปิดหน้าต่างอีกต่อไป
                        };
                    });
                }, 0);
            });

            // wire cc-style: เปิดจาก main view, back กลับ main view
            setTimeout(() => {
                const bcs = document.getElementById("sp-back-cc-style");
                if (bcs) bcs.onclick = () => switchSpView(ccStyleView, document.getElementById("sp-view-main"));
                const openStyle = document.getElementById("sp-open-cc-style");
                if (openStyle) openStyle.onclick = () => switchSpView(document.getElementById("sp-view-main"), ccStyleView);
                
                // ปุ่มรีเซ็ตการตั้งค่าซับ
                const resetBtn = document.getElementById("sp-cc-reset");
                if (resetBtn) {
                    resetBtn.onclick = () => {
                        // 1. คืนค่า Default ให้ JW Player Native
                        if (playerInstance.setCaptions) {
                            playerInstance.setCaptions(SP_CAP_DEFAULTS);
                        }
                        
                        // 2. Hack ปิด/เปิดเพื่อรีเฟรชหน้าจอ
                        const savedIdx = playerInstance.getCurrentCaptions ? playerInstance.getCurrentCaptions() : 0;
                        if (savedIdx > 0 && playerInstance.setCurrentCaptions) {
                            playerInstance.setCurrentCaptions(0);
                            setTimeout(() => playerInstance.setCurrentCaptions(savedIdx), 50);
                        }

                        // 3. คืนค่า UI (หน้าตั้งค่าและปุ่มติ๊กถูก)
                        CC_CONFIG.forEach(cfg => {
                            const cv = cfg.def;
                            const co = cfg.opts.find(o => String(o.v) === String(cv));
                            const cl = co ? co.l : String(cv);
                            const dot = cfg.isColor ? colorDot(cv) : "";
                            const curEl = document.getElementById(`sp-cc-cur-${cfg.id}`);
                            if (curEl) curEl.innerHTML = `${dot}${cl}`;
                            
                            const optView = document.getElementById(`sp-view-cc-opt-${cfg.id}`);
                            if (optView) {
                                optView.querySelectorAll(".sp-tick").forEach(s => s.innerHTML = "");
                                const activeItem = optView.querySelector(`.sp-item[data-cc-v="${cv}"]`);
                                if (activeItem) {
                                    const tick = activeItem.querySelector(".sp-tick");
                                    if (tick) tick.innerHTML = IconManager.check;
                                }
                            }
                        });

                        // 4. รีเซ็ต CSS Injection กลับเป็นค่าดั้งเดิม
                        getCaptionStyleEl().innerHTML = buildCaptionCSS(SP_CAP_DEFAULTS);
                    };
                }
            }, 0);

            // audio track select
            document.querySelectorAll("#sp-audio-list .sp-item").forEach(el => {
                el.onclick = () => {
                    const idx = parseInt(el.dataset.audio);
                    if (playerInstance.setCurrentAudioTrack) playerInstance.setCurrentAudioTrack(idx);
                    document.querySelectorAll("#sp-audio-list .sp-item").forEach(x => { const s = x.querySelector("span:last-child"); if(s) s.innerHTML = ""; });
                    const tick = el.querySelector("span:last-child"); if(tick) tick.innerHTML = IconManager.check;
                    const cur = document.getElementById("sp-cur-audio");
                    if (cur) cur.textContent = el.querySelector("span").textContent;
                    setTimeout(() => switchSpView(document.getElementById("sp-view-audio"), document.getElementById("sp-view-main")), 150);
                };
            });

            // ---- live update เมื่อ JW เปลี่ยนคุณภาพ (auto switching) ----
            const onVisualQuality = (e) => {
                if (!document.getElementById("sp-panel")) {
                    playerInstance.off("visualQuality", onVisualQuality);
                    return;
                }
                // คำนวณ label ใหม่
                const lv = e && e.level ? e.level : null;
                let newVisual = '';
                if (lv) {
                    newVisual = /^auto$/i.test((lv.label || '').trim())
                        ? (lv.height ? formatQualityLabel({height: lv.height}) : '')
                        : formatQualityLabel(lv);
                }

                // อัพ label ใน main view (sp-cur-quality)
                const curQ = document.getElementById("sp-cur-quality");
                if (curQ) {
                    const activeLv = levels[playerInstance.getCurrentQuality ? playerInstance.getCurrentQuality() : 0];
                    const isAuto = activeLv && /^auto$/i.test((activeLv.label || '').trim());
                    curQ.textContent = isAuto
                        ? i18n.auto + (newVisual ? ' ' + newVisual : '')
                        : (activeLv ? formatQualityLabel(activeLv) : '');
                }

                // อัพ hint ในแถว อัตโนมัติ ใน quality list — recalculate autoIdx เพราะอยู่นอก IIFE scope
                const _autoIdx = levels.findIndex(l => /^auto$/i.test((l.label || '').trim()));
                const autoRow = document.querySelector("#sp-quality-list .sp-item[data-quality=\"" + _autoIdx + "\"]");
                if (autoRow) {
                    const nameSpan = autoRow.querySelector("span:first-child");
                    if (nameSpan) {
                        const hint = newVisual ? ` <span style="color:#888;font-size:11px;">${newVisual}</span>` : '';
                        nameSpan.innerHTML = 'อัตโนมัติ' + hint;
                    }
                }
            };
            playerInstance.on("visualQuality", onVisualQuality);
        }, 50);
    };


    // สั่งรันการแสดงปุ่มและระบบแก้ไข
    addForwardButton();
    setupSeekIndicator();
    setupWatchedSegments();
    setupResumePlayback();
    addSettingsButton();
    // Context Menu — ถ้าเปิด contextMenu ใน config ใช้ custom, ไม่งั้นใช้ fix clipping
    const cfg = window.playerConfig || {};
    if (cfg.contextMenu !== false) {
        setupContextMenu();
    } else {
        fixContextMenuClipping();
    }

    // Configurable Toolbox — วางปุ่มอะไรตรงไหนก็ได้
    setupTools({position:"top-right", button:["download","screenshot","cast",]});
    setupTools({position:"bottom-right", button:["pip","fullscreen","info"]});


    // ดึงค่า localStorage มาสร้าง CSS Override ทันทีตั้งแต่เริ่ม เพื่อลบล้าง VTT inline styles
    const applyInitialCaptionCSS = () => {
        try {
            const lsKey = 'jwplayer.captionSettings';
            const curLS = JSON.parse(localStorage.getItem(lsKey) || '{}');
            if (Object.keys(curLS).length > 0) {
                getCaptionStyleEl().innerHTML = buildCaptionCSS(curLS);
            } else {
                // ซ่อน native button เฉยๆ
                getCaptionStyleEl().innerHTML = `button[aria-controls="jw-${playerId}-settings-submenu-captionsSettings"] { display: none !important; }`;
            }
        } catch(e) {}
    };
    applyInitialCaptionCSS();

    // ผูกปุ่ม Settings หลัง UI พร้อม
    setTimeout(() => {
        const playerEl = document.getElementById(playerId);
        if (!playerEl) return;
        const settingsBtn = playerEl.querySelector(".jw-icon-settings-custom");
        if (settingsBtn) {
            settingsBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                openSettingsModal();
            });
        }
    }, 300);
}


class PlayerSetup {
  constructor() {
    this.player = jwplayer("player");
    this.videoId = Utils.getVideoId();
        this.accessibilityManager = null;
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
    const config = {
      ...window.playerConfig,
      resumeMode:"ask"
    };
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
      intl: {
            th: {
                customForward: "กรอไปข้างหน้า 10 วินาที",
                customDownload: "โหลดวิดีโอ",
                customInfo: "ข้อมูล",
                customInfoTitle: "เกี่ยวกับวิดีโอนี้",
                customSettings: "การตั้งค่า",
                customCaptions: "คำบรรยาย",
                customCaptionSettings: "ตั้งค่าคำบรรยาย",
                customSpeed: "ความเร็วในการเล่น",
                customQuality: "คุณภาพ",
                customAuto: "อัตโนมัติ",
                customNormal: "ปกติ",
                customNoOtherQuality: "ไม่พบคุณภาพอื่น",
                customAudio: "เสียง",
                colorWhite: "ขาว",
                colorBlack: "ดำ",
                colorRed: "แดง",
                colorGreen: "เขียว",
                colorBlue: "น้ำเงิน",
                colorYellow: "เหลือง",
                colorMagenta: "ชมพู",
                colorCyan: "ฟ้า",
                fontColor: "สีตัวอักษร",
                fontOpacity: "ความเข้มตัวอักษร",
                userFontScale: "ขนาดตัวอักษร",
                fontFamily: "ตระกูลตัวอักษร",
                edgeStyle: "กรอบตัวอักษร",
                edgeStyleNone: "ไม่มี",
                edgeColor: "สีกรอบตัวอักษร",
                backgroundColor: "สีพื้นหลัง",
                backgroundOpacity: "ความเข้มพื้นหลัง",
                windowColor: "สีกรอบซับ",
                windowOpacity: "ความเข้มกรอบซับ",
                reset: "รีเซ็ตค่าเริ่มต้น",
                customScreenshot: "แคปภาพหน้าจอ",
                customScreenshotTitle: "บันทึกภาพหน้าจอ",
                customScreenshotDownload: "ดาวน์โหลดภาพหน้าจอ",
                customScreenshotFailed: "ไม่สามารถแคปภาพได้",
                customCast: "แคสต์",
                customPip: "ภาพในภาพ",
                customFullscreen: "เต็มหน้าจอ",
                customContextPlay: "เล่น / หยุด",
                customContextLoop: "วนซ้ำ",
                customContextSpeed: "ความเร็ว",
                customContextCopyUrl: "คัดลอก URL วิดีโอ",
                customContextMute: "ปิด / เปิดเสียง",
                customContextStats: "สถิติสำหรับเด็กเนิร์ด",
                customContextKeyboard: "ปุ่มลัดคีย์บอร์ด",
                customContextSeek: "กรอ ±10 วินาที",
                customContextVolume: "ระดับเสียง ±5%",
                resumeTitle: "เล่นต่อจากครั้งที่แล้ว?",
                resumeSubtitle: "คุณเคยดูวิดีโอนี้มาแล้ว",
                resumeYes: "เล่นต่อ",
                resumeNo: "เริ่มต้นใหม่"
            },
            en: {
                customForward: "Forward 10 Seconds",
                customDownload: "Download Video",
                customInfo: "Info",
                customInfoTitle: "About this Video",
                customSettings: "Settings",
                customCaptions: "Subtitles",
                customCaptionSettings: "Caption Settings",
                customSpeed: "Playback Speed",
                customQuality: "Quality",
                customAuto: "Auto",
                customNormal: "Normal",
                customNoOtherQuality: "No other quality available",
                customAudio: "Audio Track",
                colorWhite: "White",
                colorBlack: "Black",
                colorRed: "Red",
                colorGreen: "Green",
                colorBlue: "Blue",
                colorYellow: "Yellow",
                colorMagenta: "Magenta",
                colorCyan: "Cyan",
                fontColor: "Font Color",
                fontOpacity: "Font Opacity",
                userFontScale: "Font Size",
                fontFamily: "Font Family",
                edgeStyle: "Character Edge",
                edgeStyleNone: "None",
                edgeColor: "Edge Color",
                backgroundColor: "Background Color",
                backgroundOpacity: "Background Opacity",
                windowColor: "Window Color",
                windowOpacity: "Window Opacity",
                reset: "Reset",
                customScreenshot: "Screenshot",
                customScreenshotTitle: "Save Screenshot",
                customScreenshotDownload: "Download Screenshot",
                customScreenshotFailed: "Cannot capture screenshot",
                customCast: "Cast",
                customPip: "Picture in Picture",
                customFullscreen: "Fullscreen",
                customContextPlay: "Play / Pause",
                customContextLoop: "Loop",
                customContextSpeed: "Speed",
                customContextCopyUrl: "Copy Video URL",
                customContextMute: "Mute / Unmute",
                customContextStats: "Stats for Nerds",
                customContextKeyboard: "Keyboard Shortcuts",
                customContextSeek: "Seek ±10s",
                customContextVolume: "Volume ±5%",
                resumeTitle: "Continue watching?",
                resumeSubtitle: "You left off at",
                resumeYes: "Resume",
                resumeNo: "Start over"
            }
        }
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
            tag: config.vastUrl.startsWith("http") || config.vastUrl.startsWith("//") ? config.vastUrl : `${window.location.origin}${config.vastUrl}`,
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
        if (typeof initCustomUI === "function") {
          initCustomUI(this.player.id, this.player);
        }
      })
      .on("levelsChanged", (e) => {
        // Proactively prefetch the new resolution's m3u8 to warm CDN cache
        this.prefetchResolutionM3u8(e.currentQuality);
      })
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

      }

  cleanup() {
    window.BandwidthMonitor?.stop();
    window.PlayerAnalytics?.stop();
    window.AdvertImage?.stop();
    this.disconnectCcuWs();
    this.accessibilityManager?.cleanup();
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
