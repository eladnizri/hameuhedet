/* =====================================================================
   קזינו המאוחדת — מנוע השולחן: חיבור, מצב משותף, דילר, מושבים, קלפים.
   המארח (או המחשב, במשחק לבד) מחזיק את מצב המשחק האמיתי ומשדר לכולם.
   ===================================================================== */
(function () {
  const C = window.Casino;
  const { $, $$, esc } = C;
  C.GAMES = {};
  const T = (C.T = { scale: 1 });
  const REACT_EMOJI = ["👏", "😂", "😱", "🔥", "😭", "🍀", "😎", "🤑", "💪", "🙏", "😡", "🎉"];
  const REACT_TEXT = ["בהצלחה! 🍀", "יפה מאוד 👏", "וואו 😱", "חחחח 😂", "לא נכון... 😭", "עוד סיבוב?", "הכל או כלום! 🔥", "יאללה, מחכים 😴", "תודה 🙏", "GG 🤝"];

  /* ===================== צ'יפים ===================== */
  const DEN = [
    [500, "#7b2cbf"],
    [100, "#1b1b1f"],
    [25, "#1f8a4c"],
    [10, "#1f5fbf"],
    [5, "#c62828"],
    [1, "#efeae2"],
  ];
  T.chipColor = (v) => (DEN.find((d) => d[0] === v) || DEN[5])[1];
  T.chips = (amount, label = true) => {
    amount = C.r2(amount);
    if (!(amount > 0)) return "";
    let a = Math.max(1, Math.floor(amount));
    const out = [];
    for (const [v, c] of DEN)
      while (a >= v && out.length < 9) {
        out.push(c);
        a -= v;
      }
    return `<div class="chips">${out.map((c, i) => `<i style="--c:${c};--i:${i}"></i>`).join("")}${
      label ? `<b>${C.money(amount)}</b>` : ""
    }</div>`;
  };
  T.CHIPS = [1, 5, 10, 25, 100];
  T.chipBar = (el, onPick) => {
    el.classList.add("chip-bar");
    el.innerHTML = T.CHIPS.map(
      (v) => `<button class="chip-btn" data-v="${v}" style="--c:${T.chipColor(v)}" aria-label="${v} דולר"><span>${v}</span></button>`,
    ).join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest(".chip-btn");
      if (!b) return;
      C.sfx.play("chip");
      onPick(+b.dataset.v);
    });
  };

  /* ===================== קלפים ===================== */
  T.faceHTML = (c) => {
    const r = C.RANK(c.r);
    const s = C.SUIT[c.s];
    return `<span class="ci">${r}<i>${s}</i></span><span class="cs">${s}</span><span class="ci b">${r}<i>${s}</i></span>`;
  };
  /* מסנכרן קופסת קלפים עם רשימה. קלף חדש "עף" מהנעל, קלף שנחשף מתהפך. */
  T.syncCards = (box, cards, o = {}) => {
    const have = new Map();
    for (const el of box.children) have.set(el.dataset.id, el);
    let k = 0;
    cards.forEach((c, i) => {
      let el = have.get(c.id);
      if (el) have.delete(c.id);
      else {
        el = document.createElement("div");
        el.className = "pc";
        el.dataset.id = c.id;
        el.innerHTML = `<div class="pc-in"><div class="pc-f"></div><div class="pc-b"></div></div>`;
        box.insertBefore(el, box.children[i] || null);
        const from = o.from || T.shoe;
        if (from && !o.noFly) {
          const a = from.getBoundingClientRect();
          const b = el.getBoundingClientRect();
          const s = T.scale || 1;
          el.style.setProperty("--fx", (a.left + a.width / 2 - b.left - b.width / 2) / s + "px");
          el.style.setProperty("--fy", (a.top + a.height / 2 - b.top - b.height / 2) / s + "px");
          const d = (o.delay || 0) + k++ * (o.stagger ?? 150);
          el.style.animationDelay = d + "ms";
          el.style.transitionDelay = d + 120 + "ms";
          el.classList.add("fly");
          el.addEventListener(
            "animationend",
            () => {
              el.classList.remove("fly");
              el.style.transitionDelay = "";
            },
            { once: true },
          );
          C.sfx.play("card", d / 1000);
          T.dealerMove?.();
        }
      }
      if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
      const face = c.back ? "" : c.r + c.s;
      if (el.dataset.face !== face) {
        if (face) {
          el.querySelector(".pc-f").innerHTML = T.faceHTML(c);
          el.classList.toggle("red", c.s === "h" || c.s === "d");
          if (el.dataset.face === "") C.sfx.play("flip");
        }
        el.dataset.face = face;
      }
      el.classList.toggle("up", !c.back);
      el.classList.toggle("hl", !!o.mark?.(c));
    });
    have.forEach((el) => el.remove());
  };

  /* ===================== מושבים ===================== */
  T.seat = (scene, i, pos) => {
    let el = scene.querySelector(`.seat[data-i="${i}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "seat empty";
      el.dataset.i = i;
      el.innerHTML = `<div class="seat-av"><svg class="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20"/></svg><img alt=""></div>
<div class="seat-plate"><b class="nm">פנוי</b><span class="stk"></span></div><div class="seat-say"></div>`;
      scene.appendChild(el);
    }
    el.style.left = pos[0] + "%";
    el.style.top = pos[1] + "%";
    return el;
  };
  T.fillSeat = (el, p, o = {}) => {
    el.classList.toggle("empty", !p);
    el.classList.toggle("me", !!o.me);
    el.classList.toggle("turn", !!o.turn);
    el.classList.toggle("bot", !!p?.bot);
    el.classList.toggle("gone", !!p?.left);
    el.classList.toggle("out", !!o.out);
    const img = $("img", el);
    if (!p) {
      $(".nm", el).textContent = "פנוי";
      $(".stk", el).textContent = "";
      img.removeAttribute("src");
    } else {
      const url = C.avatarURL(p.look);
      if (img.getAttribute("src") !== url) img.src = url;
      $(".nm", el).textContent = p.name + (p.bot ? " 🤖" : "");
      $(".stk", el).textContent = C.money(p.stack);
    }
    const ring = $(".ring", el);
    if (o.turn && o.left > 0) {
      if (el.dataset.tk !== String(o.tk)) {
        el.dataset.tk = o.tk;
        ring.classList.remove("run");
        void ring.getBoundingClientRect();
        ring.style.animationDuration = o.left + "ms";
        ring.classList.add("run");
      }
    } else {
      ring.classList.remove("run");
      el.dataset.tk = "";
    }
    const say = $(".seat-say", el);
    const txt = p && o.say ? o.say : "";
    if (say.dataset.k !== (o.sayKey ?? txt)) {
      say.dataset.k = o.sayKey ?? txt;
      say.textContent = txt;
      say.classList.remove("pop");
      if (txt) {
        void say.offsetWidth;
        say.classList.add("pop");
        C.sfx.play("chip");
      }
    }
  };
  /* מושב חלופי: כשאני יושב — מסובבים כך שאני תמיד למטה באמצע */
  T.rotate = (seat, mySeat, n) => (mySeat == null ? seat : (seat - mySeat + n) % n);
  T.seated = (S) => S.seats.filter((id) => id && S.players[id] && !S.players[id].left);

  /* הודעת תוצאה גדולה על השולחן, עם הסבר למה */
  T.banner = (root, title, sub = "", kind = "", ms = 2600) => {
    const st = $(".tv-controls", root);
    if (!st) return;
    st.querySelector(".tv-banner")?.remove();
    const b = document.createElement("div");
    b.className = "tv-banner " + kind;
    b.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}`;
    st.appendChild(b);
    setTimeout(() => b.classList.add("out"), ms);
    setTimeout(() => b.remove(), ms + 400);
  };

  /* חלון בחירת סכום בתוך השולחן */
  T.askAmount = (root, { title, text = "", max, value }) =>
    new Promise((res) => {
      const ov = $(".tv-overlay", root);
      max = Math.floor(max);
      value = C.clamp(Math.floor(value || max), 1, max);
      ov.innerHTML = `<div class="tv-dialog"><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ""}
<div class="amt-big">$<b>${value}</b></div><input type="range" min="1" max="${max}" value="${value}" class="amt-range">
<div class="tv-dialog-row"><button class="btn gold ok">אישור</button><button class="btn ghost no">ביטול</button></div></div>`;
      ov.hidden = false;
      const r = $(".amt-range", ov);
      r.oninput = () => ($(".amt-big b", ov).textContent = r.value);
      const done = (v) => {
        ov.hidden = true;
        ov.innerHTML = "";
        res(v);
      };
      $(".ok", ov).onclick = () => done(+r.value);
      $(".no", ov).onclick = () => done(null);
    });

  /* ===================== סשן של שולחן ===================== */
  class Session {
    constructor(def, mode, hooks = {}) {
      this.def = def;
      this.G = C.GAMES[def.game];
      this.mode = mode;
      this.hooks = hooks;
      this.tl = new Set();
      this.named = new Map();
      this.lastRound = -1;
      this.stack = 0;
    }
    get solo() {
      return this.mode === "solo";
    }
    meta() {
      const pr = C.profile.get();
      return { name: pr.name, look: pr.look, buyin: this.stack };
    }

    async start(buyin) {
      this.build();
      C.T.session = this;
      await this.connect(buyin);
    }

    async connect(buyin) {
      buyin = C.r2(Math.max(0, Math.min(buyin, C.wallet.cash)));
      C.wallet.add(-buyin);
      this.stack = buyin;
      C.wallet.hold(this.def.key, buyin);
      if (this.solo) {
        this.selfId = "me";
        this.role = "host";
        this.hostInit();
        this.addPlayer("me", this.meta());
        this.G.solo?.(this.S, this.H, this);
        this.setNet();
        this.push();
        return;
      }
      this.setNet("⏳ מתחברים לשולחן…");
      const room = (this.room = new C.Room("t-" + this.def.key, {
        meta: () => this.meta(),
        join: (id, m) => {
          if (!this.S) return;
          this.addPlayer(id, m);
          this.push();
          this.setNet();
        },
        message: (id, m) => this.onMsg(id, m),
        leave: (id) => {
          this.dropPlayer(id);
          this.setNet();
        },
        lost: () => this.hostLost(),
      }));
      try {
        await room.open();
      } catch {
        if (this.closed) return;
        this.fail("לא הצלחנו להתחבר לשולחן המשותף (אולי אין אינטרנט). אפשר לשחק לבד מול המחשב.");
        return;
      }
      if (this.closed) return room.close();
      this.selfId = room.selfId;
      this.role = room.role;
      if (this.role === "host") {
        this.hostInit();
        this.addPlayer(this.selfId, this.meta());
        this.push();
      }
      this.setNet();
    }

    hostInit() {
      const S = (this.S = {
        key: this.def.key,
        game: this.def.game,
        solo: this.solo,
        players: {},
        seats: Array(this.G.seats).fill(null),
        round: 0,
        log: [],
        say: "",
        sayId: 0,
        rev: 0,
      });
      const self = this;
      this.H = {
        get solo() {
          return self.solo;
        },
        push: () => this.push(),
        after: (ms, fn) => {
          const t = setTimeout(() => {
            this.tl.delete(t);
            if (!this.closed && this.S === S) fn();
          }, ms);
          this.tl.add(t);
          return t;
        },
        /* טיימר בעל שם (למשל תור) — מתחלף כשמגדירים אותו מחדש */
        timer: (name, ms, fn) => {
          clearTimeout(this.named.get(name));
          this.named.set(
            name,
            setTimeout(() => {
              this.named.delete(name);
              if (!this.closed && this.S === S) {
                fn();
                this.push();
              }
            }, ms),
          );
        },
        clear: (name) => {
          clearTimeout(this.named.get(name));
          this.named.delete(name);
        },
        /* תור עם שעון: במשחק משותף — 30 שניות, לבד — בלי הגבלה */
        turn: (ms, fn) => {
          if (this.solo) {
            S.turnAt = 0;
            return;
          }
          S.turnAt = Date.now();
          S.turnMs = ms;
          S.turnK = (S.turnK || 0) + 1;
          this.H.timer("turn", ms, fn);
        },
        endTurn: () => {
          S.turnAt = 0;
          this.H.clear("turn");
        },
        log: (t) => {
          S.log.push(t);
          if (S.log.length > 8) S.log.shift();
        },
        say: (t) => {
          S.say = t;
          S.sayId++;
        },
        sweep: () => {
          for (const id of Object.keys(S.players)) if (S.players[id].left) this.removePlayer(id);
        },
        name: (id) => S.players[id]?.name || "",
        addBot: (name, look, stack) => {
          const id = "bot-" + C.uid();
          return this.addPlayer(id, { name, look, buyin: stack, bot: true }) ? id : null;
        },
        remove: (id) => this.removePlayer(id),
      };
      this.G.init(S, this.H);
    }

    addPlayer(id, m) {
      const S = this.S;
      if (S.players[id]) return true;
      const seat = S.seats.indexOf(null);
      if (seat < 0) {
        this.room?.sendTo(id, { t: "full" });
        return false;
      }
      const name = String(m.name || "אורח").replace(/\s+/g, " ").trim().slice(0, 16) || "אורח";
      const buy = C.r2(C.clamp(+m.buyin || 0, 0, 1e6));
      S.players[id] = { id, name, look: C.cleanLook(m.look), stack: buy, seat, bot: !!m.bot };
      S.seats[seat] = id;
      if (!m.bot) this.H.log(`${name} הצטרף/ה לשולחן`);
      this.G.onJoin?.(S, id, this.H);
      return true;
    }
    dropPlayer(id) {
      const S = this.S;
      const p = S?.players[id];
      if (!p || p.left) return;
      p.left = true;
      this.H.log(`${p.name} קם/ה מהשולחן`);
      if (this.G.onLeave ? this.G.onLeave(S, id, this.H) : true) this.removePlayer(id);
      this.push();
    }
    removePlayer(id) {
      const S = this.S;
      const p = S.players[id];
      if (!p) return;
      if (S.seats[p.seat] === id) S.seats[p.seat] = null;
      delete S.players[id];
    }

    onMsg(from, m) {
      if (this.role === "host") {
        const p = this.S?.players[from];
        if (!p || p.left) return;
        if (m.t === "act" && m.a && typeof m.a === "object") this.hostAct(from, m.a);
        else if (m.t === "chat") this.hostChat(from, m.text);
        else if (m.t === "bye") this.dropPlayer(from);
        return;
      }
      if (m.t === "state" && m.S) {
        m.S._recv = Date.now();
        this.render(m.S);
      } else if (m.t === "chat" && m.m) this.addChat(m.m);
      else if (m.t === "full") this.fail("השולחן מלא כרגע — נסו שולחן אחר או שחקו לבד מול המחשב.");
    }

    /* ===================== צ'אט חי ליד השולחן ===================== */
    hostChat(pid, text) {
      const p = this.S?.players[pid];
      text = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
      if (!p || !text) return;
      const now = Date.now();
      if (now - (p.chatAt || 0) < 350) return;
      p.chatAt = now;
      const msg = { id: pid, name: p.name, text, look: p.look };
      this.room?.broadcast({ t: "chat", m: msg });
      this.addChat(msg);
      if (this.solo && Math.random() < 0.5)
        setTimeout(
          () => !this.closed && this.addChat({ id: "dealer", name: "הדילר", text: C.pick(["😄", "בהצלחה! 🍀", "הבית תמיד מקשיב 😏", "איזה משחק!", "👏👏"]) }),
          900,
        );
    }
    chatSend(text) {
      text = String(text).trim();
      if (!text) return;
      if (this.role === "host") this.hostChat(this.selfId, text);
      else this.room?.send({ t: "chat", text });
    }
    addChat(m) {
      if (this.closed || typeof m.text !== "string") return;
      const msg = { id: String(m.id || ""), name: String(m.name || "").slice(0, 16), text: m.text.slice(0, 140) };
      (this.chat ||= []).push(msg);
      if (this.chat.length > 60) this.chat.shift();
      const list = $(".chat-list", this.root);
      const mine = msg.id === this.selfId;
      list.insertAdjacentHTML(
        "beforeend",
        `<div class="chat-msg${mine ? " me" : ""}${msg.id === "dealer" ? " sys" : ""}"><b>${esc(msg.name)}</b><span>${esc(msg.text)}</span></div>`,
      );
      while (list.children.length > 60) list.firstChild.remove();
      list.scrollTop = list.scrollHeight;
      /* בועה מעל הראש של מי שכתב — אימוג'י לבד נראה גדול ומרחף */
      const seat = this.V?.players[msg.id]?.seat;
      const el = seat != null && this.scene.querySelector(`.seat[data-i="${seat}"]`);
      if (el) {
        el.querySelector(".seat-chat")?.remove();
        const b = document.createElement("div");
        const emoji = /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(msg.text);
        b.className = "seat-chat" + (emoji ? " emoji" : "");
        b.textContent = msg.text.length > 60 ? msg.text.slice(0, 58) + "…" : msg.text;
        el.appendChild(b);
        el.classList.add("chatting");
        clearTimeout(el._chatT);
        el._chatT = setTimeout(() => {
          b.remove();
          el.classList.remove("chatting");
        }, 4500);
      }
      const hidden = !$(".tv-side", this.root).offsetParent;
      if (!mine) {
        C.sfx.play("click");
        if (hidden) {
          this.unread = (this.unread || 0) + 1;
          const badge = $(".chat-badge", this.root);
          badge.textContent = this.unread;
          badge.hidden = false;
        }
      }
    }
    toggleChat(open = !this.root.classList.contains("chat-open")) {
      /* במחשב הצ'אט תמיד פתוח בצד; בטלפון הוא נפתח כמגירה */
      this.root.classList.toggle("chat-open", open);
      $(".tv-react", this.root).hidden = true;
      if (open) {
        this.unread = 0;
        $(".chat-badge", this.root).hidden = true;
        const list = $(".chat-list", this.root);
        list.scrollTop = list.scrollHeight;
        if (matchMedia("(pointer: fine)").matches) $(".chat-in", this.root).focus();
      }
    }
    hostAct(pid, a) {
      const p = this.S.players[pid];
      if (a.a === "topup") {
        const amt = C.r2(+a.amt);
        if (amt > 0 && amt <= 1e6) {
          p.stack = C.r2(p.stack + amt);
          this.H.log(`${p.name} הביא/ה עוד ${C.money(amt)} לשולחן`);
        }
      } else this.G.act(this.S, pid, a, this.H);
      this.push();
    }
    send(a) {
      C.sfx.ac();
      if (this.role === "host") this.hostAct(this.selfId, a);
      else this.room?.send({ t: "act", a });
    }
    async topup() {
      C.wallet.refillIfBroke();
      const cash = Math.floor(C.wallet.cash);
      if (cash < 1) return C.toast("כל הכסף שלך כבר על השולחן 🙂");
      const v = await T.askAmount(this.root, {
        title: "להביא עוד כסף לשולחן",
        text: `בארנק: ${C.money(C.wallet.cash)}`,
        max: cash,
        value: Math.min(cash, 20),
      });
      if (!v || this.closed) return;
      C.wallet.add(-v);
      this.stack = C.r2(this.stack + v);
      C.wallet.hold(this.def.key, this.stack);
      this.send({ a: "topup", amt: v });
    }

    viewFor(id) {
      const V = JSON.parse(JSON.stringify(this.G.view ? this.G.view(this.S, id) : this.S));
      if (this.S.turnAt) V.turnLeft = this.S.turnAt + this.S.turnMs - Date.now();
      return V;
    }
    push() {
      if (this.pq || this.role !== "host") return;
      this.pq = true;
      queueMicrotask(() => {
        this.pq = false;
        if (this.closed || !this.S) return;
        this.S.rev++;
        if (this.room) for (const id of this.room.conns.keys()) this.room.sendTo(id, { t: "state", S: this.viewFor(id) });
        const V = this.viewFor(this.selfId);
        V._recv = Date.now();
        this.render(V);
      });
    }

    /* ===================== ממשק ===================== */
    build() {
      const G = this.G;
      const root = (this.root = document.createElement("div"));
      root.className = `tview g-${this.def.game}`;
      root.innerHTML = `
<div class="tv-bg"><div class="tv-lights"></div><div class="tv-crowd"></div><img class="tv-walker" alt=""></div>
<header class="tv-top">
  <button class="tv-btn tv-leave" title="חזרה לאולם הקזינו">→ <span>לאולם</span></button>
  <div class="tv-title"><span class="tv-ic">${G.icon}</span><div><b>${esc(this.def.name)}</b><small>${this.solo ? "לבד מול המחשב" : "שולחן משותף"}</small></div></div>
  <div class="tv-net"></div>
  <div class="tv-money">
    <div><small>על השולחן</small><b class="tv-stack">$0</b></div>
    <div><small>בארנק</small><b class="tv-cash">$0</b></div>
    <button class="tv-btn tv-topup" title="להביא עוד כסף מהארנק">+</button>
  </div>
  <button class="tv-btn tv-react-btn" title="תגובה מהירה">😀</button>
  <button class="tv-btn tv-chat-btn" title="צ'אט עם מי שליד השולחן">💬<i class="chat-badge" hidden></i></button>
  <button class="tv-btn tv-snd" title="צלילים"></button>
  <button class="tv-btn tv-help" title="איך משחקים">?</button>
</header>
<div class="tv-say"><img class="tv-say-av" alt=""><div class="dealer-say"></div></div>
<div class="tv-stage"><div class="scene">
  <div class="dealer"><img alt="הדילר"></div>
  <div class="shoe" title="נעל קלפים"><i></i><i></i><i></i></div>
</div></div>
<aside class="tv-side"><h4>ליד השולחן</h4><div class="tv-people"></div><h4>מה קורה</h4><div class="tv-log"></div>
<section class="tv-chat" aria-label="צ'אט">
  <div class="chat-head"><b>💬 צ'אט השולחן</b><button class="chat-x" aria-label="סגירה">✕</button></div>
  <div class="chat-list"><div class="chat-msg sys"><b>הדילר</b><span>${this.solo ? "אתם לבד בשולחן — אבל אני קורא 😉" : "כל מה שתכתבו כאן יופיע לכולם, גם כבועה מעל הדמות שלכם"}</span></div></div>
  <div class="chat-quick">${REACT_EMOJI.map((e) => `<button>${e}</button>`).join("")}</div>
  <div class="chat-quick phrases">${REACT_TEXT.map((e) => `<button>${e}</button>`).join("")}</div>
  <form class="chat-form"><input class="chat-in" maxlength="140" placeholder="כתבו משהו…" autocomplete="off" enterkeyhint="send"><button class="btn gold">שלח</button></form>
</section></aside>
<div class="tv-react" hidden><div class="react-emoji">${REACT_EMOJI.map((e) => `<button>${e}</button>`).join("")}</div><div class="react-text">${REACT_TEXT.map((e) => `<button>${e}</button>`).join("")}</div></div>
<div class="tv-controls"></div>
<div class="tv-overlay" hidden></div>`;
      document.body.appendChild(root);
      document.body.classList.add("at-table");
      this.scene = $(".scene", root);
      T.shoe = $(".shoe", root);
      const dealer = $(".dealer", root);
      $("img", dealer).src = C.avatarURL(this.def.dealer || C.DEALER);
      $(".tv-say-av", root).src = C.avatarURL(this.def.dealer || C.DEALER);
      T.dealerMove = () => {
        dealer.classList.remove("move");
        void dealer.offsetWidth;
        dealer.classList.add("move");
      };
      /* קהל ואווירה מאחורי השולחן */
      const rnd = C.rng(this.def.key.length * 977 + this.def.game.charCodeAt(0));
      $(".tv-crowd", root).innerHTML = Array.from({ length: 7 }, (_, i) => {
        const x = 4 + i * 14 + rnd() * 6;
        return `<img src="${C.avatarURL(C.randomLook(rnd))}" style="left:${x}%;--d:${(rnd() * 3).toFixed(2)}s;--s:${(0.8 + rnd() * 0.35).toFixed(2)}" alt="">`;
      }).join("");
      $(".tv-walker", root).src = C.avatarURL(C.WAITRESS(1), { frame: 1 });

      $(".tv-leave", root).onclick = () => this.leave();
      $(".tv-topup", root).onclick = () => this.topup();
      $(".tv-chat-btn", root).onclick = () => {
        if (innerWidth > 860) {
          $(".chat-in", root).focus();
          const list = $(".chat-list", root);
          list.scrollTop = list.scrollHeight;
        } else this.toggleChat();
      };
      $(".chat-x", root).onclick = () => this.toggleChat(false);
      $(".chat-form", root).onsubmit = (e) => {
        e.preventDefault();
        const inp = $(".chat-in", root);
        this.chatSend(inp.value);
        inp.value = "";
      };
      const quick = (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        this.chatSend(b.textContent);
        $(".tv-react", root).hidden = true;
      };
      root.querySelectorAll(".chat-quick").forEach((q) => (q.onclick = quick));
      $(".tv-react", root).onclick = quick;
      $(".tv-react-btn", root).onclick = (e) => {
        e.stopPropagation();
        const r = $(".tv-react", root);
        r.hidden = !r.hidden;
      };
      root.addEventListener("click", (e) => {
        if (!e.target.closest(".tv-react, .tv-react-btn")) $(".tv-react", root).hidden = true;
      });
      const snd = $(".tv-snd", root);
      const sndTxt = () => (snd.textContent = C.sfx.on ? "🔊" : "🔇");
      sndTxt();
      snd.onclick = () => (C.sfx.toggle(), sndTxt());
      $(".tv-help", root).onclick = () => {
        const ov = $(".tv-overlay", root);
        ov.innerHTML = `<div class="tv-dialog rules"><h3>${G.icon} ${esc(G.title)} — איך משחקים</h3>${G.rules}<div class="tv-dialog-row"><button class="btn gold ok">הבנתי</button></div></div>`;
        ov.hidden = false;
        $(".ok", ov).onclick = () => (ov.hidden = true);
      };
      this.onCash = () => {
        if (!this.closed) $(".tv-cash", root).textContent = C.money(C.wallet.cash);
      };
      C.wallet.on(this.onCash);
      this.onAv = () => this.V && !this.closed && this.render(this.V, true);
      C.onAvatarReady(this.onAv);
      this.onCash();
      this.ctx = {
        sess: this,
        root,
        scene: this.scene,
        controls: $(".tv-controls", root),
        send: (a) => this.send(a),
        get me() {
          return this.sess.selfId;
        },
        get portrait() {
          return root.classList.contains("portrait");
        },
      };
      this.onResize = () => this.fit();
      addEventListener("resize", this.onResize);
      this.fit();
      this.holdT = setInterval(() => {
        if (!this.closed && this.V?.players[this.selfId]) C.wallet.hold(this.def.key, this.stack);
        if (this.V?.turnLeft > 0) this.render(this.V, true);
      }, 4000);
    }
    fit() {
      const st = $(".tv-stage", this.root);
      const w = st.clientWidth;
      const h = st.clientHeight;
      const portrait = w / h < 0.9;
      const was = this.root.classList.contains("portrait");
      this.root.classList.toggle("portrait", portrait);
      const W = portrait ? 640 : 1000;
      const H = portrait ? 900 : 620;
      this.scene.style.width = W + "px";
      this.scene.style.height = H + "px";
      T.scale = Math.min(w / W, h / H);
      this.scene.style.transform = `translate(-50%,-50%) scale(${T.scale})`;
      if (was !== portrait && this.V) this.render(this.V, true);
    }
    setNet(msg) {
      const el = $(".tv-net", this.root);
      if (!el) return;
      if (msg) return (el.innerHTML = `<span class="net wait">${esc(msg)}</span>`);
      if (this.solo) el.innerHTML = `<span class="net">🤖 מול המחשב</span>`;
      else if (this.role === "host") {
        const n = this.room?.conns.size || 0;
        el.innerHTML = `<span class="net ok">🟢 פתחתם את השולחן${n ? ` · ${n} מחוברים` : " · מחכים לחברים"}</span>`;
      } else if (this.role === "client") el.innerHTML = `<span class="net ok">🟢 מחובר לשולחן</span>`;
    }

    render(V, quiet) {
      if (this.closed) return;
      this.V = V;
      const me = V.players[this.selfId];
      if (me) {
        /* הימור שעדיין אפשר לבטל נחשב "על השולחן" — חוזר לארנק אם יוצאים */
        this.stack = C.r2(me.stack + (this.G.pending?.(V, this.selfId) || 0));
        C.wallet.hold(this.def.key, this.stack);
        /* נגמר הכסף לגמרי (ואין כלום על הקו) — מקבלים $100 חדשים ישר לשולחן */
        if (this.stack < 1 && C.wallet.cash < 1 && !this.G.atStake?.(V, this.selfId) && !this.refilling) {
          this.refilling = true;
          this.stack = C.r2(this.stack + C.DAILY);
          C.wallet.hold(this.def.key, this.stack);
          this.send({ a: "topup", amt: C.DAILY });
          C.toast(`💸 נגמר הכסף? קיבלת <b>${C.money(C.DAILY)}</b> חדשים!`, "win");
        } else if (me.stack >= 1) this.refilling = false;
      }
      $(".tv-stack", this.root).textContent = C.money(me ? me.stack : this.stack);
      if (!this.mounted) {
        this.G.mount(this.ctx);
        this.mounted = true;
      }
      this.G.render(this.ctx, V);
      if (quiet) return;
      /* דילר מדבר */
      if (V.sayId !== this.sayId) {
        this.sayId = V.sayId;
        const b = $(".dealer-say", this.root);
        b.textContent = V.say || "";
        b.classList.remove("pop");
        if (V.say) {
          void b.offsetWidth;
          b.classList.add("pop");
        }
      }
      /* מי ליד השולחן */
      const people = T.seated(V)
        .map((id) => V.players[id])
        .map(
          (p) =>
            `<div class="person${p.id === this.selfId ? " me" : ""}"><img src="${C.avatarURL(p.look)}" alt=""><span>${esc(p.name)}${
              p.bot ? " 🤖" : ""
            }</span><b>${C.money(p.stack)}</b></div>`,
        )
        .join("");
      $(".tv-people", this.root).innerHTML = people;
      $(".tv-log", this.root).innerHTML = V.log
        .slice()
        .reverse()
        .map((l) => `<div>${esc(l)}</div>`)
        .join("");
      /* תוצאה שלי בסיבוב */
      if (V.results && V.round !== this.lastRound && V.results[this.selfId] != null) {
        this.lastRound = V.round;
        this.celebrate(V.results[this.selfId], V.why?.[this.selfId]);
      }
      this.hooks.change?.();
    }
    celebrate(d, why = "") {
      if (d > 0) {
        C.sfx.play(d >= 40 ? "big" : "win");
        T.banner(this.root, `ניצחת \u2066+${C.money(d)}\u2069`, why, "win");
        const box = document.createElement("div");
        box.className = "coin-burst";
        box.innerHTML = Array.from({ length: Math.min(40, 12 + Math.floor(d / 3)) }, () => {
          const a = Math.random() * Math.PI * 2;
          const r = 120 + Math.random() * 260;
          return `<i style="--x:${(Math.cos(a) * r).toFixed(0)}px;--y:${(Math.sin(a) * r - 120).toFixed(0)}px;--d:${(Math.random() * 0.25).toFixed(2)}s">$</i>`;
        }).join("");
        this.root.appendChild(box);
        setTimeout(() => box.remove(), 1800);
      } else if (d < 0) {
        C.sfx.play("lose");
        T.banner(this.root, `הפסדת \u2066${C.money(-d)}\u2069`, why, "lose");
      } else T.banner(this.root, "תיקו — הכסף חזר אליך", why, "push");
    }
    summary() {
      const V = this.V;
      if (!V) return null;
      return { st: this.G.status?.(V) || "", n: T.seated(V).filter((id) => !V.players[id].bot).length };
    }

    async hostLost() {
      if (this.closed) return;
      const s = this.stack;
      C.wallet.hold(null);
      C.wallet.add(s);
      this.S = null;
      this.room = null;
      this.role = null;
      this.setNet("🔄 המארח יצא — מתחברים מחדש…");
      await C.sleep(300 + Math.random() * 1200);
      if (this.closed) return;
      this.connect(s);
    }
    fail(msg) {
      C.toast(esc(msg), "lose");
      this.close();
    }
    leave() {
      const atStake = this.V && this.G.atStake?.(this.V, this.selfId);
      if (atStake && !confirm("יש לך הימור פתוח בסיבוב הזה. לצאת בכל זאת? ההימור יאבד.")) return;
      this.close();
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      this.tl.forEach(clearTimeout);
      this.named.forEach(clearTimeout);
      clearInterval(this.holdT);
      removeEventListener("resize", this.onResize);
      C.wallet.fns.delete(this.onCash);
      C.offAvatarReady(this.onAv);
      const room = this.room;
      if (room) {
        room.send({ t: "bye" });
        setTimeout(() => room.close(), 200);
      }
      const back = C.wallet.held;
      C.wallet.hold(null);
      C.wallet.add(back);
      this.G.unmount?.(this.ctx);
      this.root.remove();
      document.body.classList.remove("at-table");
      if (C.T.session === this) C.T.session = null;
      this.hooks.exit?.();
    }
  }
  C.Session = Session;
})();
