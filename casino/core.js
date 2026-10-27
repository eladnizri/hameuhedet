/* =====================================================================
   קזינו המאוחדת — ליבה: כלים, ארנק יומי, פרופיל, רשת (PeerJS),
   קלפים, דמויות ו־צלילים. כסף משחק בלבד — אין כאן כסף אמיתי.
   ===================================================================== */
(function () {
  const C = (window.Casino = {});

  C.$ = (s, r = document) => r.querySelector(s);
  C.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  C.esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  C.r2 = (n) => Math.round((+n || 0) * 100) / 100;
  C.money = (n) => {
    n = C.r2(n);
    return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
  };
  C.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  C.uid = () => Math.random().toString(36).slice(2, 10);
  C.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  C.rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  C.pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];
  /* מחולל אקראי עם זרע — כדי שכל המכשירים יראו את אותו מירוץ בדיוק */
  C.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  C.shuffle = (arr, rnd = C.rand) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  /* ===================== קלפים ===================== */
  C.SUIT = { s: "♠", h: "♥", d: "♦", c: "♣" };
  C.RANK = (r) => ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[r] || String(r);
  C.deck = (n = 1) => {
    const d = [];
    for (let k = 0; k < n; k++)
      for (const s of "shdc") for (let r = 2; r <= 14; r++) d.push({ r, s, id: C.uid() });
    return C.shuffle(d);
  };
  C.hideCard = (c) => ({ id: c.id, back: true });

  /* ===================== אחסון ===================== */
  const read = (k, def) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? def;
    } catch {
      return def;
    }
  };
  const write = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  };
  C.store = { read, write };

  /* ===================== ארנק יומי =====================
     cash — הכסף בארנק. hold — מה שיושב כרגע על שולחן (נשמר כל הזמן,
     כך שאם הדפדפן נסגר באמצע — הכסף חוזר לארנק בכניסה הבאה).
     כל יום חדש: מי שיש לו פחות מ-$100 מקבל השלמה ל-$100.        */
  const WKEY = "hmh-casino-wallet-v1";
  const HKEY = "hmh-casino-holds-v1";
  const SID = C.uid();
  C.DAILY = 100;
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  const holds = () => {
    const h = read(HKEY, {});
    return h && typeof h === "object" && !Array.isArray(h) ? h : {};
  };
  C.wallet = {
    fns: new Set(),
    on(f) {
      this.fns.add(f);
    },
    emit() {
      this.fns.forEach((f) => f());
    },
    init() {
      const w = read(WKEY, null) || { cash: C.DAILY, day: today() };
      /* החזקה ישנה = טאב שנסגר באמצע משחק. החזקה טרייה = טאב אחר פתוח עכשיו */
      const h = holds();
      for (const [sid, v] of Object.entries(h))
        if (Date.now() - (v?.ts || 0) > 20000) {
          w.cash = C.r2(w.cash + (+v?.stack || 0));
          delete h[sid];
        }
      write(HKEY, h);
      write(WKEY, w);
      this.checkDay();
    },
    checkDay() {
      const w = read(WKEY, { cash: 0, day: "" });
      if (w.day === today()) return false;
      w.day = today();
      const total = w.cash + this.held;
      let refilled = false;
      if (total < C.DAILY) {
        w.cash = C.r2(C.DAILY - this.held);
        refilled = true;
      }
      write(WKEY, w);
      this.emit();
      return refilled;
    },
    get cash() {
      return read(WKEY, { cash: 0 }).cash;
    },
    get held() {
      return +holds()[SID]?.stack || 0;
    },
    add(delta) {
      const w = read(WKEY, { cash: 0, day: today() });
      w.cash = C.r2(Math.max(0, w.cash + delta));
      write(WKEY, w);
      this.emit();
      return w.cash;
    },
    hold(table, stack) {
      const h = holds();
      if (table == null) delete h[SID];
      else h[SID] = { table, stack: C.r2(stack), ts: Date.now() };
      write(HKEY, h);
      this.emit();
    },
    /* זמן עד חצות — לתצוגת "מתחדש בעוד" */
    untilReset() {
      const n = new Date();
      const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
      return m - n;
    },
  };


  /* ===================== צלילים (מסונתזים, בלי קבצים) ===================== */
  const SKEY = "hmh-casino-sound";
  C.sfx = {
    on: read(SKEY, true),
    ctx: null,
    ac() {
      if (!this.ctx) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A) return null;
        this.ctx = new A();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    toggle() {
      this.on = !this.on;
      write(SKEY, this.on);
      return this.on;
    },
    tone(f, d, type = "sine", v = 0.12, w = 0) {
      const a = this.ac();
      if (!a) return;
      const t = a.currentTime + w;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + d + 0.03);
    },
    noise(d, v, hp, w = 0) {
      const a = this.ac();
      if (!a) return;
      const n = Math.floor(a.sampleRate * d);
      const b = a.createBuffer(1, n, a.sampleRate);
      const ch = b.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
      const s = a.createBufferSource();
      s.buffer = b;
      const fl = a.createBiquadFilter();
      fl.type = "highpass";
      fl.frequency.value = hp;
      const g = a.createGain();
      g.gain.value = v;
      s.connect(fl).connect(g).connect(a.destination);
      s.start(a.currentTime + w);
    },
    play(name, w = 0) {
      if (!this.on) return;
      try {
        if (name === "card") this.noise(0.07, 0.35, 2600, w);
        else if (name === "flip") this.noise(0.05, 0.25, 1800, w);
        else if (name === "chip") {
          this.tone(2350, 0.06, "triangle", 0.1, w);
          this.tone(3300, 0.05, "triangle", 0.07, w + 0.035);
        } else if (name === "win")
          [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.1, w + i * 0.09));
        else if (name === "big")
          [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, "triangle", 0.1, w + i * 0.08));
        else if (name === "lose") {
          this.tone(294, 0.22, "sine", 0.08, w);
          this.tone(220, 0.35, "sine", 0.08, w + 0.18);
        } else if (name === "tick") this.tone(1200, 0.03, "square", 0.025, w);
        else if (name === "click") this.tone(700, 0.04, "triangle", 0.06, w);
        else if (name === "turn") {
          this.tone(880, 0.12, "sine", 0.08, w);
          this.tone(1320, 0.16, "sine", 0.07, w + 0.1);
        } else if (name === "roll") this.noise(0.02, 0.12, 4000, w);
        else if (name === "boom") {
          this.noise(0.5, 0.6, 60, w);
          this.tone(110, 0.45, "sawtooth", 0.09, w);
          this.tone(70, 0.6, "sine", 0.14, w + 0.05);
        }
      } catch {}
    },
  };

  /* ===================== הודעות קופצות ===================== */
  C.toast = (html, kind = "") => {
    let box = C.$("#toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      document.body.appendChild(box);
    }
    const t = document.createElement("div");
    t.className = "toast " + kind;
    t.innerHTML = html;
    box.appendChild(t);
    setTimeout(() => t.classList.add("out"), 3400);
    setTimeout(() => t.remove(), 3900);
  };

  /* ===================== רשת: חדרים משותפים בין מכשירים =====================
     אין לנו שרת — משתמשים ב-PeerJS (WebRTC) עם שרת התיווך הציבורי והחינמי שלו.
     לכל שולחן יש מזהה קבוע. מי שמגיע ראשון "תופס" את המזהה והופך למארח:
     הדפדפן שלו מריץ את הדילר ואת חוקי המשחק, וכל השאר מתחברים אליו.
     אם המארח יוצא — אחד המשתתפים תופס את המזהה וממשיך.               */
  const PEER_SRC = "https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js";
  const PREFIX = "hameuhedet-casino-v1-";
  let libP = null;
  C.loadPeer = () =>
    (libP ||= new Promise((res, rej) => {
      if (window.Peer) return res();
      const s = document.createElement("script");
      s.src = PEER_SRC;
      s.crossOrigin = "anonymous";
      const to = setTimeout(() => {
        libP = null;
        rej(new Error("timeout"));
      }, 12000);
      s.onload = () => (clearTimeout(to), res());
      s.onerror = () => {
        clearTimeout(to);
        libP = null;
        rej(new Error("peerjs"));
      };
      document.head.appendChild(s);
    }));

  class Room {
    constructor(name, h) {
      this.id = PREFIX + name;
      this.h = h;
      this.conns = new Map();
      this.seen = new Map();
      this.role = null;
      this.closed = false;
    }
    async open() {
      await C.loadPeer();
      for (let i = 0; i < 5 && !this.closed; i++) {
        try {
          await this._host();
          return this.role;
        } catch (e) {
          if (e.type !== "unavailable-id") throw e;
        }
        try {
          await this._join();
          return this.role;
        } catch (e) {
          if (e.type !== "peer-unavailable" && e.message !== "join-timeout") throw e;
        }
        await C.sleep(300 + Math.random() * 1200);
      }
      throw new Error("room");
    }
    _host() {
      return new Promise((res, rej) => {
        const p = new Peer(this.id, { debug: 0 });
        let ok = false;
        p.on("open", () => {
          ok = true;
          this.peer = p;
          this.role = "host";
          this.selfId = this.id;
          this._tick = setInterval(() => this._hostTick(), 3000);
          res();
        });
        p.on("error", (e) => {
          if (!ok) {
            p.destroy();
            rej(e);
          }
        });
        p.on("connection", (c) => this._accept(c));
        p.on("disconnected", () => {
          if (!this.closed && !p.destroyed)
            try {
              p.reconnect();
            } catch {}
        });
      });
    }
    _accept(c) {
      c.on("open", () => {
        this.conns.set(c.peer, c);
        this.seen.set(c.peer, Date.now());
        this.h.join?.(c.peer, c.metadata || {});
      });
      c.on("data", (m) => {
        this.seen.set(c.peer, Date.now());
        if (m && typeof m === "object" && m.t !== "ping") this.h.message?.(c.peer, m);
      });
      const drop = () => {
        if (this.conns.get(c.peer) === c) {
          this.conns.delete(c.peer);
          this.h.leave?.(c.peer);
        }
      };
      c.on("close", drop);
      c.on("error", drop);
    }
    _hostTick() {
      const now = Date.now();
      for (const [id, c] of this.conns)
        if (now - (this.seen.get(id) || 0) > 15000) {
          this.conns.delete(id);
          try {
            c.close();
          } catch {}
          this.h.leave?.(id);
        }
      this.broadcast({ t: "ping" });
    }
    _join() {
      return new Promise((res, rej) => {
        const p = new Peer({ debug: 0 });
        let done = false;
        const fail = (e) => {
          if (done) return;
          done = true;
          clearTimeout(to);
          p.destroy();
          rej(e);
        };
        const to = setTimeout(() => fail(new Error("join-timeout")), 9000);
        p.on("error", (e) => (done ? this._lost() : fail(e)));
        p.on("open", (myId) => {
          const c = p.connect(this.id, { reliable: true, serialization: "json", metadata: this.h.meta?.() || {} });
          c.on("open", () => {
            if (done) return;
            done = true;
            clearTimeout(to);
            this.peer = p;
            this.host = c;
            this.role = "client";
            this.selfId = myId;
            this.lastHost = Date.now();
            this._tick = setInterval(() => {
              this.send({ t: "ping" });
              if (Date.now() - this.lastHost > 15000) this._lost();
            }, 3000);
            res();
          });
          c.on("data", (m) => {
            this.lastHost = Date.now();
            if (m && typeof m === "object" && m.t !== "ping") this.h.message?.(this.id, m);
          });
          c.on("close", () => (done ? this._lost() : fail(new Error("join-timeout"))));
          c.on("error", () => (done ? this._lost() : fail(new Error("join-timeout"))));
        });
      });
    }
    _lost() {
      if (this.closed || this.role !== "client") return;
      this.role = null;
      clearInterval(this._tick);
      try {
        this.peer.destroy();
      } catch {}
      this.h.lost?.();
    }
    send(m) {
      if (this.role === "client" && this.host?.open)
        try {
          this.host.send(m);
        } catch {}
    }
    sendTo(id, m) {
      const c = this.conns.get(id);
      if (c?.open)
        try {
          c.send(m);
        } catch {}
    }
    broadcast(m) {
      for (const c of this.conns.values())
        if (c.open)
          try {
            c.send(m);
          } catch {}
    }
    close() {
      this.closed = true;
      clearInterval(this._tick);
      try {
        this.peer?.destroy();
      } catch {}
      this.conns.clear();
    }
  }
  C.Room = Room;
})();
