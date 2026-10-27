/* =====================================================================
   קזינו המאוחדת — האולם הווירטואלי: מסתובבים בין השולחנות, רואים מי
   משחק איפה, מלצריות, ברמן, מכונות מזל ושחקנים אמיתיים ממכשירים אחרים.
   ===================================================================== */
(function () {
  const C = window.Casino;
  const { $, esc } = C;
  const K = 0.62; /* דחיסת הרצפה — נותן מבט "מלמעלה באלכסון" */
  const WORLD = { w: 2400, h: 2300 };
  const WALK = { x0: 255, x1: 2085, y0: 165, y1: 2220 };

  const TABLES = (C.TABLES = [
    { key: "poker-1", game: "poker", name: "פוקר · שולחן 1", x: 620, y: 520, color: "#e6b647" },
    { key: "bj-1", game: "bj", name: "בלאק ג'ק · שולחן 1", x: 1170, y: 520, color: "#ff4d6d" },
    { key: "race-1", game: "race", name: "מירוץ גולות", x: 1720, y: 520, color: "#3ee0ff" },
    { key: "poker-2", game: "poker", name: "פוקר · שולחן 2", x: 620, y: 1080, color: "#e6b647", fem: true },
    { key: "bj-2", game: "bj", name: "בלאק ג'ק · שולחן 2", x: 1170, y: 1080, color: "#ff4d6d", fem: true },
    { key: "hilo-1", game: "hilo", name: "גבוה־נמוך", x: 1720, y: 1080, color: "#c86bff" },
    { key: "roulette-1", game: "roulette", name: "רולטה · שולחן 1", x: 620, y: 1640, color: "#ffd23f" },
    { key: "roulette-2", game: "roulette", name: "רולטה · שולחן 2", x: 1720, y: 1640, color: "#ffd23f", fem: true },
  ]);
  for (const t of TABLES) {
    Object.assign(
      t,
      { poker: { rx: 200, ry: 112 }, bj: { rx: 185, ry: 110 }, race: { rx: 215, ry: 118 }, hilo: { rx: 150, ry: 100 }, roulette: { rx: 215, ry: 118 } }[t.game],
    );
    t.ax = t.x;
    t.ay = t.y + t.ry + 75;
    t.dealerLook = t.fem ? C.DEALER_F : C.DEALER;
    const angs = t.game === "race" || t.game === "roulette" ? [20, 55, 90, 125, 160] : t.game === "hilo" ? [15, 55, 90, 125, 165] : [-5, 30, 65, 90, 115, 150, 185];
    t.chairs = angs.map((a) => {
      const r = (a * Math.PI) / 180;
      return { x: t.x + Math.cos(r) * (t.rx + 30), y: t.y + Math.sin(r) * (t.ry + 30) };
    });
  }

  /* ===================== מכשולים ומסלולים ===================== */
  const BAR = { x0: 2115, x1: 2210, y0: 290, y1: 930 };
  function blocked(x, y) {
    if (x < WALK.x0 || x > WALK.x1 || y < WALK.y0 || y > WALK.y1) return true;
    for (const t of TABLES) {
      const dx = (x - t.x) / (t.rx + 48);
      const dy = (y - t.y) / (t.ry + 48);
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  }
  const clear = (a, b) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 18);
    for (let i = 1; i <= n; i++) if (blocked(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n)) return false;
    return true;
  };
  const NODES = [];
  for (const y of [250, 800, 1360, 1940]) for (const x of [345, 895, 1445, 1995]) NODES.push({ x, y });
  NODES.push({ x: 1170, y: 1560 }, { x: 1170, y: 2140 });
  const ADJ = NODES.map((a) => NODES.map((b, j) => (a !== b && clear(a, b) ? j : -1)).filter((j) => j >= 0));
  function planPath(from, to) {
    if (clear(from, to)) return [to];
    const near = (p) =>
      NODES.map((n, i) => [i, Math.hypot(n.x - p.x, n.y - p.y)])
        .filter(([i]) => clear(p, NODES[i]))
        .sort((a, b) => a[1] - b[1])[0]?.[0];
    const s = near(from);
    const e = near(to);
    if (s == null || e == null) return [to];
    const dist = NODES.map(() => Infinity);
    const prev = NODES.map(() => -1);
    const done = new Set();
    dist[s] = 0;
    while (done.size < NODES.length) {
      let u = -1;
      for (let i = 0; i < NODES.length; i++) if (!done.has(i) && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || dist[u] === Infinity) break;
      done.add(u);
      for (const v of ADJ[u]) {
        const d = dist[u] + Math.hypot(NODES[u].x - NODES[v].x, NODES[u].y - NODES[v].y);
        if (d < dist[v]) (dist[v] = d), (prev[v] = u);
      }
    }
    const path = [to];
    for (let v = e; v >= 0; v = prev[v]) path.unshift(NODES[v]);
    return path;
  }

  /* ===================== דמויות ===================== */
  const spr = new Map();
  function sprite(look, frame) {
    const k = JSON.stringify([look, frame]);
    let s = spr.get(k);
    if (s) return s.ready ? s.cv : null;
    const img = C.avatarImg(look, frame);
    s = { cv: document.createElement("canvas"), ready: false };
    s.cv.width = 96;
    s.cv.height = 192;
    spr.set(k, s);
    const done = () => {
      s.cv.getContext("2d").drawImage(img, 0, 0, 96, 192);
      s.ready = true;
    };
    if (img.complete && img.naturalWidth) done();
    img.addEventListener("load", done);
    return null;
  }

  class Person {
    constructor(o) {
      Object.assign(this, { x: 0, y: 0, speed: 120, path: [], wait: 0, walkT: 0, seed: Math.random() * 10 }, o);
    }
    goTo(p) {
      this.path = planPath(this, p);
    }
    update(dt) {
      if (this.wait > 0) {
        this.wait -= dt;
        this.moving = false;
        return;
      }
      const tgt = this.path[0];
      if (!tgt) {
        this.moving = false;
        this.idle?.(this);
        return;
      }
      const dx = tgt.x - this.x;
      const dy = tgt.y - this.y;
      const d = Math.hypot(dx, dy);
      const step = this.speed * dt;
      if (d <= step) {
        this.x = tgt.x;
        this.y = tgt.y;
        this.path.shift();
        if (!this.path.length) this.arrive?.(this);
      } else {
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
      }
      this.moving = true;
      this.walkT += dt;
    }
  }

  /* ===================== מצב העולם ===================== */
  const W = { people: [], props: [], me: null, cam: { x: 1170, y: 1860 }, z: 1, t: 0 };
  let cv, g, dpr = 1, VW = 0, VH = 0;
  const proj = (x, y) => ({ x: (x - W.cam.x) * W.z + VW / 2, y: (y - W.cam.y) * W.z * K + VH / 2 });
  const unproj = (sx, sy) => ({ x: (sx - VW / 2) / W.z + W.cam.x, y: (sy - VH / 2) / (W.z * K) + W.cam.y });

  function buildWorld() {
    const rnd = C.rng(2026);
    /* דילרים */
    for (const t of TABLES) W.people.push(new Person({ x: t.x, y: t.y - t.ry - 18, look: t.dealerLook, dealer: t }));
    /* ברמן */
    W.people.push(
      new Person({
        x: 2250,
        y: 600,
        look: C.cleanLook({ kind: "bartender", skin: "#b07448", hair: "#16100e", hs: 0, beard: true }),
        speed: 40,
        idle(p) {
          p.wait = 1.5 + Math.random() * 3;
          p.path = [{ x: 2250, y: 360 + Math.random() * 520 }];
        },
      }),
    );
    /* שחקנים וירטואליים: על מכונות מזל, בבר, וליד חלק מהשולחנות */
    for (let i = 0; i < 4; i++) W.people.push(new Person({ x: 250, y: 360 + i * 300 + 40, look: C.randomLook(rnd), sit: true, npc: true }));
    for (let i = 0; i < 3; i++) W.people.push(new Person({ x: 2085, y: 380 + i * 210, look: C.randomLook(rnd), sit: true, npc: true }));
    [
      [0, 1],
      [0, 5],
      [1, 2],
      [3, 4],
      [4, 0],
      [5, 3],
      [2, 1],
      [6, 1],
      [6, 3],
      [7, 2],
    ].forEach(([ti, ci]) => {
      const c = TABLES[ti].chairs[ci];
      W.people.push(new Person({ x: c.x, y: c.y, look: C.randomLook(rnd), sit: true, npc: true, chairOf: TABLES[ti], chairI: ci }));
    });
    /* מסתובבים — עוצרים לפעמים ליד שולחן ומסתכלים */
    const spots = TABLES.flatMap((t) => [
      { x: t.x - t.rx - 70, y: t.y + 30 },
      { x: t.x + t.rx + 70, y: t.y + 30 },
      { x: t.x + 60, y: t.ay - 10 },
    ]).filter((p) => !blocked(p.x, p.y));
    for (let i = 0; i < 9; i++) {
      const n = NODES[Math.floor(rnd() * NODES.length)];
      W.people.push(
        new Person({
          x: n.x,
          y: n.y,
          look: C.randomLook(rnd),
          speed: 70 + rnd() * 40,
          npc: true,
          idle(p) {
            p.wait = 0.5 + Math.random() * 2.5;
            const r = Math.random();
            if (r < 0.45) p.goTo(C.pick(spots)), (p.wait = 0), (p.arrive = (q) => (q.wait = 3 + Math.random() * 7));
            else p.goTo(C.pick(NODES));
          },
        }),
      );
    }
    /* מלצריות — מסתובבות ומציעות בירה למי שעובר לידן */
    const WAITRESS_NAMES = ["שני", "נויה שוורץ", "אלה נצר"];
    for (let i = 0; i < WAITRESS_NAMES.length; i++) {
      const route = [{ x: 2060, y: 380 + i * 150 }, ...C.shuffle(spots.slice(), Math.random).slice(0, 4), ...NODES.slice(i * 3, i * 3 + 2)];
      let k = 0;
      W.people.push(
        new Person({
          x: 2060,
          y: 380 + i * 150,
          look: C.WAITRESS(i),
          name: WAITRESS_NAMES[i],
          waitress: true,
          speed: 105,
          npc: true,
          idle(p) {
            k = (k + 1) % route.length;
            p.goTo(route[k]);
            p.arrive = (q) => (q.wait = k === 0 ? 3 : 1.8);
          },
        }),
      );
    }
    /* מכונות מזל */
    for (let i = 0; i < 13; i++) W.props.push({ kind: "slot", x: 175, y: 260 + i * 150, seed: rnd() * 100, spin: 0, sym: [0, 1, 2] });
    for (const [x, y] of [
      [300, 175],
      [2050, 175],
      [300, 2205],
      [2050, 2205],
      [300, 1360],
      [2050, 1360],
      [895, 175],
      [1445, 175],
    ])
      W.props.push({ kind: "plant", x, y });
    for (const t of TABLES) W.props.push({ kind: "table", t, x: t.x, y: t.y });
    for (let i = 0; i < 4; i++) W.props.push({ kind: "stool", x: 2085, y: 380 + i * 210 });
  }

  /* ===================== נוכחות משותפת (לובי) ===================== */
  const Lobby = (C.Lobby = {
    people: new Map(),
    online: false,
    last: "",
    lastT: 0,
    me() {
      const pr = C.profile.get() || { name: "אורח", look: C.cleanLook() };
      const s = C.T.session;
      const sum = s?.summary();
      return {
        name: pr.name,
        look: myLook(),
        x: Math.round(W.me?.x || 0),
        y: Math.round(W.me?.y || 0),
        at: s ? s.def.key : null,
        solo: !!s?.solo,
        st: sum?.st || "",
      };
    },
    clean(m) {
      const at = TABLES.some((t) => t.key === m.at) ? m.at : null;
      return {
        name: String(m.name || "אורח").slice(0, 16),
        look: C.cleanLook(m.look),
        x: C.clamp(+m.x || 0, 0, WORLD.w),
        y: C.clamp(+m.y || 0, 0, WORLD.h),
        at,
        solo: !!m.solo,
        st: String(m.st || "").slice(0, 40),
      };
    },
    set(id, m) {
      if (id === this.room?.selfId) return;
      const c = this.clean(m);
      const p = this.people.get(id);
      if (p) Object.assign(p, c, { tx: c.x, ty: c.y, x: p.x, y: p.y, ts: Date.now() });
      else this.people.set(id, { ...c, tx: c.x, ty: c.y, ts: Date.now(), walkT: 0 });
    },
    async start() {
      clearInterval(this.iv);
      this.people.clear();
      this.room = new C.Room("lobby", {
        meta: () => this.me(),
        join: (id, m) => this.set(id, m),
        message: (id, m) => {
          if (this.room.role === "host" && m.t === "me") this.set(id, m);
          else if (m.t === "all" && Array.isArray(m.list)) {
            const seen = new Set();
            for (const [id, p] of m.list.slice(0, 80)) {
              if (typeof id !== "string") continue;
              seen.add(id);
              this.set(id, p);
            }
            for (const id of this.people.keys()) if (!seen.has(id)) this.people.delete(id);
          }
        },
        leave: (id) => this.people.delete(id),
        lost: () => this.restart(),
      });
      try {
        await this.room.open();
        this.online = true;
      } catch {
        this.online = false;
        this.room?.close();
        this.room = null;
        this.retry = setTimeout(() => this.start(), 25000);
      }
      netBanner();
      this.iv = setInterval(() => this.tick(), 300);
    },
    restart() {
      this.online = false;
      netBanner();
      clearInterval(this.iv);
      setTimeout(() => this.start(), 400 + Math.random() * 1500);
    },
    tick() {
      const r = this.room;
      if (!r?.role) return;
      const me = this.me();
      const k = JSON.stringify(me);
      const now = Date.now();
      if (r.role === "client") {
        if (k !== this.last || now - this.lastT > 2500) {
          r.send({ t: "me", ...me });
          this.last = k;
          this.lastT = now;
        }
      } else if (now - this.lastT > 450) {
        this.lastT = now;
        const list = [[r.selfId, me], ...[...this.people].map(([id, p]) => [id, { ...p, x: p.tx, y: p.ty }])];
        r.broadcast({ t: "all", list });
      }
      $("#online b").textContent = this.people.size + 1;
    },
  });

  function netBanner() {
    const b = $("#netBanner");
    b.hidden = Lobby.online;
  }

  /* ===================== ציור ===================== */
  let carpet = null;
  function makeCarpet() {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const x = c.getContext("2d");
    x.fillStyle = "#4a0a14";
    x.fillRect(0, 0, 160, 160);
    const gr = x.createRadialGradient(80, 80, 5, 80, 80, 90);
    gr.addColorStop(0, "#6b1220");
    gr.addColorStop(1, "#3d0710");
    x.fillStyle = gr;
    x.fillRect(0, 0, 160, 160);
    x.strokeStyle = "rgba(230,182,71,.38)";
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(80, 10);
    x.lineTo(150, 80);
    x.lineTo(80, 150);
    x.lineTo(10, 80);
    x.closePath();
    x.stroke();
    x.strokeStyle = "rgba(230,182,71,.22)";
    x.lineWidth = 2;
    x.beginPath();
    x.arc(80, 80, 26, 0, 7);
    x.stroke();
    x.fillStyle = "rgba(230,182,71,.35)";
    for (const [a, b] of [
      [0, 0],
      [160, 0],
      [0, 160],
      [160, 160],
      [80, 80],
    ]) {
      x.beginPath();
      x.arc(a, b, 6, 0, 7);
      x.fill();
    }
    x.fillStyle = "rgba(0,0,0,.18)";
    for (let i = 0; i < 400; i++) x.fillRect(Math.random() * 160, Math.random() * 160, 1.5, 1.5);
    return c;
  }

  function ellipse(cx, cy, rx, ry, fill, stroke, lw) {
    g.beginPath();
    g.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    if (fill) (g.fillStyle = fill), g.fill();
    if (stroke) (g.strokeStyle = stroke), (g.lineWidth = lw || 1), g.stroke();
  }
  function rr(x, y, w, h, r) {
    g.beginPath();
    g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
  }

  function drawFloor() {
    const z = W.z;
    g.fillStyle = "#0b0507";
    g.fillRect(0, 0, VW, VH);
    g.save();
    g.setTransform(dpr * z, 0, 0, dpr * z * K, dpr * (VW / 2 - W.cam.x * z), dpr * (VH / 2 - W.cam.y * z * K));
    g.fillStyle = (carpet ||= g.createPattern(makeCarpet(), "repeat"));
    g.fillRect(0, 120, WORLD.w, WORLD.h - 120);
    /* שטיח אדום בכניסה */
    g.fillStyle = "#9b1022";
    g.fillRect(1090, 1380, 160, 920);
    g.fillStyle = "#e6b647";
    g.fillRect(1086, 1380, 6, 920);
    g.fillRect(1248, 1380, 6, 920);
    /* פסי זהב סביב האולם */
    g.strokeStyle = "rgba(230,182,71,.5)";
    g.lineWidth = 6;
    g.strokeRect(240, 150, 1860, 2080);
    g.restore();
    /* בריכות אור של נברשות */
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const t of TABLES) {
      const p = proj(t.x, t.y);
      const r = 330 * W.z;
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      gr.addColorStop(0, "rgba(255,200,120,.16)");
      gr.addColorStop(1, "rgba(255,200,120,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(p.x, p.y, r, r * K, 0, 0, 7);
      g.fill();
    }
    g.restore();
  }

  function drawWall() {
    const z = W.z;
    const a = proj(0, 120);
    const b = proj(WORLD.w, 120);
    const top = a.y - 300 * z;
    const gr = g.createLinearGradient(0, top, 0, a.y);
    gr.addColorStop(0, "#14070a");
    gr.addColorStop(1, "#2b0d12");
    g.fillStyle = gr;
    g.fillRect(a.x, top, b.x - a.x, a.y - top);
    /* פאנלים */
    g.strokeStyle = "rgba(230,182,71,.18)";
    g.lineWidth = 2 * z;
    for (let x = 0; x < WORLD.w; x += 160) {
      const p = proj(x + 20, 120);
      g.strokeRect(p.x, a.y - 230 * z, 120 * z, 190 * z);
    }
    g.fillStyle = "#c9a43f";
    g.fillRect(a.x, a.y - 12 * z, b.x - a.x, 8 * z);
    g.fillRect(a.x, a.y - 300 * z, b.x - a.x, 6 * z);
    /* שלט ניאון */
    const c = proj(1170, 120);
    const pulse = 0.75 + Math.sin(W.t * 2.2) * 0.15 + (Math.random() < 0.01 ? -0.4 : 0);
    g.save();
    g.textAlign = "center";
    g.direction = "rtl";
    g.font = `${Math.round(78 * z)}px "Secular One", Heebo, sans-serif`;
    g.shadowColor = `rgba(255,190,70,${pulse})`;
    g.shadowBlur = 30 * z;
    g.fillStyle = "#ffd36b";
    g.fillText("קזינו המאוחדת", c.x, c.y - 150 * z);
    g.shadowBlur = 18 * z;
    g.shadowColor = "rgba(255,60,90,.9)";
    g.font = `700 ${Math.round(24 * z)}px Heebo, sans-serif`;
    g.fillStyle = "#ff8fa3";
    g.fillText("★  CASINO · HAMEUHEDET · מאז 2026  ★", c.x, c.y - 105 * z);
    g.restore();
    /* נורות */
    for (let i = 0; i < 26; i++) {
      const x = c.x + (i - 12.5) * 34 * z;
      const on = (i + Math.floor(W.t * 6)) % 3 === 0;
      ellipse(x, c.y - 238 * z, 4.5 * z, 4.5 * z, on ? "#fff3c4" : "#6b5520");
      ellipse(x, c.y - 82 * z, 4.5 * z, 4.5 * z, !on ? "#fff3c4" : "#6b5520");
    }
    /* מדפי הבר על הקיר */
    const s = proj(2110, 120);
    g.fillStyle = "#2a160c";
    g.fillRect(s.x, a.y - 250 * z, 260 * z, 220 * z);
    for (let r = 0; r < 3; r++) {
      g.fillStyle = "#6b4426";
      g.fillRect(s.x, a.y - (90 + r * 65) * z, 260 * z, 6 * z);
      for (let i = 0; i < 9; i++) {
        const hue = ["#3aa35b", "#c9a43f", "#8b1a2b", "#3b6fd1", "#e8e1d0"][(i + r) % 5];
        g.fillStyle = hue;
        rr(s.x + (10 + i * 27) * z, a.y - (90 + r * 65 + 44) * z, 12 * z, 44 * z, 3 * z);
        g.fill();
      }
    }
  }

  function drawBar() {
    const z = W.z;
    const p0 = proj(BAR.x0, BAR.y0);
    const p1 = proj(BAR.x1, BAR.y1);
    const h = 46 * z;
    g.fillStyle = "#3a1d0e";
    g.fillRect(p0.x, p0.y - h + 14 * z, p1.x - p0.x, p1.y - p0.y + h);
    const gr = g.createLinearGradient(p0.x, 0, p1.x, 0);
    gr.addColorStop(0, "#7a4a24");
    gr.addColorStop(1, "#4a2a12");
    g.fillStyle = gr;
    g.fillRect(p0.x, p0.y - h, p1.x - p0.x, p1.y - p0.y);
    g.fillStyle = "#c9a43f";
    g.fillRect(p0.x - 3 * z, p0.y - h, 5 * z, p1.y - p0.y + h);
    g.save();
    g.fillStyle = "#ffd36b";
    g.font = `700 ${Math.round(20 * z)}px "Secular One", Heebo`;
    g.textAlign = "center";
    g.shadowColor = "#ff9f1a";
    g.shadowBlur = 12 * z;
    g.translate(p0.x - 14 * z, (p0.y + p1.y) / 2 - h);
    g.rotate(-Math.PI / 2);
    g.fillText("🍸 הבר של המאוחדת", 0, 0);
    g.restore();
    for (let i = 0; i < 6; i++) {
      const p = proj(BAR.x0 + 30, BAR.y0 + 60 + i * 100);
      g.fillStyle = "rgba(255,255,255,.55)";
      g.fillRect(p.x, p.y - h - 16 * z, 8 * z, 16 * z);
      g.fillStyle = ["#e8a33a", "#b3262e", "#3aa35b"][i % 3];
      g.fillRect(p.x + z, p.y - h - 9 * z, 6 * z, 8 * z);
    }
  }

  function drawTable(t, active) {
    const z = W.z;
    const p = proj(t.x, t.y);
    const rx = t.rx * z;
    const ry = t.ry * z * K;
    const e = 30 * z;
    ellipse(p.x, p.y + 6 * z, rx * 1.05, ry * 1.12, "rgba(0,0,0,.45)");
    g.fillStyle = "#1a0f08";
    g.fillRect(p.x - 26 * z, p.y - e, 52 * z, e);
    const shape = (dy, sx, sy) => {
      g.beginPath();
      if (t.game === "bj") {
        g.ellipse(p.x, p.y - e + dy - ry * 0.35, rx * sx, ry * sy * 1.3, 0, 0, Math.PI);
        g.closePath();
      } else if (t.game === "race" || t.game === "roulette") {
        const w = rx * sx * 2;
        const hh = ry * sy * 2;
        g.roundRect ? g.roundRect(p.x - w / 2, p.y - e + dy - hh / 2, w, hh, 26 * z) : g.rect(p.x - w / 2, p.y - e + dy - hh / 2, w, hh);
      } else g.ellipse(p.x, p.y - e + dy, rx * sx, ry * sy, 0, 0, Math.PI * 2);
    };
    shape(10 * z, 1, 1);
    g.fillStyle = "#2a1408";
    g.fill();
    shape(0, 1, 1);
    const wood = g.createLinearGradient(0, p.y - e - ry, 0, p.y - e + ry);
    wood.addColorStop(0, "#8a5a2c");
    wood.addColorStop(1, "#4a2a12");
    g.fillStyle = wood;
    g.fill();
    const fc = {
      poker: ["#1f8a4c", "#0d4d2a"],
      bj: ["#1f8a4c", "#0d4d2a"],
      race: ["#1b3550", "#0b1a2a"],
      hilo: ["#3a2a8a", "#1a1046"],
      roulette: ["#1f8a4c", "#0d4d2a"],
    }[t.game];
    shape(0, 0.88, 0.84);
    const felt = g.createRadialGradient(p.x, p.y - e, 4, p.x, p.y - e, rx);
    felt.addColorStop(0, fc[0]);
    felt.addColorStop(1, fc[1]);
    g.fillStyle = felt;
    g.fill();
    g.strokeStyle = "rgba(230,182,71,.55)";
    g.lineWidth = 1.5 * z;
    shape(0, 0.8, 0.74);
    g.stroke();
    /* הדפס על הבד */
    g.save();
    g.translate(p.x, p.y - e + (t.game === "bj" ? ry * 0.15 : 0));
    g.scale(1, K);
    g.fillStyle = "rgba(230,182,71,.35)";
    g.font = `800 ${Math.round(22 * z)}px "Secular One", Heebo`;
    g.textAlign = "center";
    g.direction = "rtl";
    g.fillText(C.GAMES[t.game].title, 0, t.game === "race" || t.game === "roulette" ? -t.ry * z * 0.55 : 8 * z);
    g.restore();
    /* פרטים חיים על השולחן */
    if (t.game === "roulette") {
      const cy = p.y - e + 4 * z;
      const wx = p.x - rx * 0.5;
      const wr = 52 * z;
      g.save();
      g.translate(wx, cy);
      g.scale(1, K);
      g.beginPath();
      g.arc(0, 6 * z, wr * 1.12, 0, 7);
      g.fillStyle = "rgba(0,0,0,.45)";
      g.fill();
      g.beginPath();
      g.arc(0, 0, wr * 1.12, 0, 7);
      g.fillStyle = "#5a3417";
      g.fill();
      g.strokeStyle = "#d8b45a";
      g.lineWidth = 2 * z;
      g.stroke();
      const spin = W.t * (active ? 1.6 : 0.5);
      for (let i = 0; i < 37; i++) {
        const a = spin + (i / 37) * Math.PI * 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, wr, a, a + (Math.PI * 2) / 37 + 0.01);
        g.closePath();
        g.fillStyle = i === 0 ? "#0f8a3c" : i % 2 ? "#c8102e" : "#161616";
        g.fill();
      }
      g.beginPath();
      g.arc(0, 0, wr * 0.55, 0, 7);
      g.fillStyle = "#8a5a2c";
      g.fill();
      g.beginPath();
      g.arc(0, 0, wr * 0.14, 0, 7);
      g.fillStyle = "#e9c86e";
      g.fill();
      const ba = -W.t * 2.6;
      g.beginPath();
      g.arc(Math.cos(ba) * wr * 1.02, Math.sin(ba) * wr * 1.02, 4 * z, 0, 7);
      g.fillStyle = "#fff";
      g.fill();
      g.restore();
      /* לוח המספרים */
      const bw = rx * 0.95;
      const bh = 62 * z;
      g.save();
      g.translate(p.x + rx * 0.3, cy);
      g.scale(1, K);
      for (let c = 0; c < 12; c++)
        for (let r = 0; r < 3; r++) {
          g.fillStyle = (c + r) % 2 ? "#c8102e" : "#161616";
          g.fillRect(-bw / 2 + (c * bw) / 12, -bh / 2 + (r * bh) / 3, bw / 12 - z, bh / 3 - z);
        }
      g.strokeStyle = "rgba(255,255,255,.7)";
      g.lineWidth = z;
      g.strokeRect(-bw / 2, -bh / 2, bw, bh);
      if (active)
        ["#ff4d6d", "#3ea6ff", "#3ddc84", "#ffd23f"].forEach((c, i) => {
          const x = -bw / 2 + ((((i * 5 + Math.floor(W.t / 3)) % 12) + 0.5) * bw) / 12;
          const y = -bh / 2 + (((i % 3) + 0.5) * bh) / 3;
          g.beginPath();
          g.arc(x, y, 5 * z, 0, 7);
          g.fillStyle = c;
          g.fill();
          g.strokeStyle = "#fff";
          g.stroke();
        });
      g.restore();
    } else if (t.game === "race") {
      const tw = rx * 0.62;
      const th = ry * 0.5;
      g.strokeStyle = "#c9a43f";
      g.lineWidth = 7 * z;
      g.beginPath();
      g.ellipse(p.x, p.y - e + 6 * z, tw, th, 0, 0, 7);
      g.stroke();
      g.strokeStyle = "#0b1a2a";
      g.lineWidth = 4 * z;
      g.stroke();
      ["#e53935", "#1e88e5", "#43a047", "#fdd835", "#8e24aa", "#fb8c00"].forEach((c, i) => {
        const a = W.t * (0.9 + i * 0.07) + i;
        ellipse(p.x + Math.cos(a) * tw, p.y - e + 6 * z + Math.sin(a) * th, 3.6 * z, 3.6 * z, c);
      });
    } else {
      const n = active ? 5 : 2;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.2 + (i / Math.max(1, n - 1)) * 0.6);
        const cx = p.x + Math.cos(a) * rx * 0.55;
        const cy = p.y - e + Math.sin(a) * ry * 0.45;
        g.fillStyle = "#f4f1ea";
        g.save();
        g.translate(cx, cy);
        g.rotate((i - 2) * 0.15);
        g.fillRect(-6 * z, -4.5 * z, 12 * z, 9 * z);
        g.restore();
      }
      const stacks = [
        ["#c62828", -0.28],
        ["#1f5fbf", -0.12],
        ["#1b1b1f", 0.06],
      ];
      for (const [c, f] of stacks) {
        for (let k = 0; k < 4; k++) ellipse(p.x + rx * f, p.y - e - ry * 0.35 - k * 2.4 * z, 6 * z, 2.6 * z, k === 3 ? C.shade(c, 0.2) : c);
      }
    }
  }

  function drawSlot(m) {
    const z = W.z;
    const p = proj(m.x, m.y);
    const w = 66 * z;
    const h = 128 * z;
    ellipse(p.x, p.y, w * 0.65, 10 * z, "rgba(0,0,0,.45)");
    const gr = g.createLinearGradient(p.x - w / 2, 0, p.x + w / 2, 0);
    gr.addColorStop(0, "#8a1424");
    gr.addColorStop(1, "#3a050c");
    g.fillStyle = gr;
    rr(p.x - w / 2, p.y - h, w, h, 10 * z);
    g.fill();
    g.fillStyle = "#c9a43f";
    rr(p.x - w / 2 - 2 * z, p.y - h - 4 * z, w + 4 * z, 14 * z, 6 * z);
    g.fill();
    for (let i = 0; i < 5; i++) {
      const on = (i + Math.floor(W.t * 5 + m.seed)) % 2 === 0;
      ellipse(p.x - w / 2 + 9 * z + i * 12 * z, p.y - h + 3 * z, 3 * z, 3 * z, on ? "#fff3a8" : "#7a5a10");
    }
    g.fillStyle = "#0c0c10";
    rr(p.x - w / 2 + 7 * z, p.y - h + 20 * z, w - 14 * z, 32 * z, 4 * z);
    g.fill();
    const SY = ["🍒", "7️⃣", "🔔", "⭐", "💎", "🍋"];
    m.spin -= 1 / 60;
    if (m.spin <= 0 && Math.random() < 0.004) m.spin = 1.4;
    if (m.spin > 0) m.sym = m.sym.map(() => Math.floor(Math.random() * SY.length));
    g.font = `${Math.round(13 * z)}px sans-serif`;
    g.textAlign = "center";
    m.sym.forEach((s, i) => g.fillText(SY[s], p.x + (i - 1) * 17 * z, p.y - h + 42 * z));
    g.fillStyle = "#c9a43f";
    g.fillRect(p.x - w / 2 + 6 * z, p.y - h + 60 * z, w - 12 * z, 4 * z);
    g.fillStyle = "#222";
    g.fillRect(p.x + w / 2, p.y - h + 30 * z, 3 * z, 34 * z);
    ellipse(p.x + w / 2 + 1.5 * z, p.y - h + 28 * z, 5 * z, 5 * z, "#e53935");
  }

  function drawPlant(m) {
    const z = W.z;
    const p = proj(m.x, m.y);
    ellipse(p.x, p.y, 30 * z, 10 * z, "rgba(0,0,0,.4)");
    g.fillStyle = "#c9a43f";
    rr(p.x - 20 * z, p.y - 40 * z, 40 * z, 40 * z, 6 * z);
    g.fill();
    g.strokeStyle = "#2f7d3a";
    g.lineWidth = 7 * z;
    g.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42 + Math.sin(W.t + i) * 0.04;
      g.beginPath();
      g.moveTo(p.x, p.y - 40 * z);
      g.quadraticCurveTo(p.x + Math.cos(a) * 40 * z, p.y - 40 * z + Math.sin(a) * 80 * z, p.x + Math.cos(a) * 70 * z, p.y - 40 * z + Math.sin(a) * 50 * z);
      g.stroke();
    }
  }

  function drawStool(m) {
    const z = W.z;
    const p = proj(m.x, m.y);
    g.fillStyle = "#c9a43f";
    g.fillRect(p.x - 2 * z, p.y - 30 * z, 4 * z, 30 * z);
    ellipse(p.x, p.y - 32 * z, 14 * z, 6 * z, "#8b1a2b");
  }
  function drawChair(c) {
    const z = W.z;
    const p = proj(c.x, c.y);
    ellipse(p.x, p.y, 15 * z, 6 * z, "rgba(0,0,0,.4)");
    ellipse(p.x, p.y - 22 * z, 16 * z, 7 * z, "#7a1222");
    g.fillStyle = "#5a0d16";
    g.fillRect(p.x - 3 * z, p.y - 20 * z, 6 * z, 20 * z);
  }

  function drawPerson(p, tag, tagColor) {
    const z = W.z;
    const s = proj(p.x, p.y);
    if (s.x < -80 || s.x > VW + 80 || s.y < -40 || s.y > VH + 200 * z) return;
    const h = 122 * z;
    const w = h / 2;
    ellipse(s.x, s.y, w * 0.42, w * 0.14, "rgba(0,0,0,.4)");
    const frame = p.moving ? [1, 0, 2, 0][Math.floor(p.walkT * 7) % 4] : 0;
    const img = sprite(p.look, frame);
    if (!img) return;
    const bob = p.moving ? Math.abs(Math.sin(p.walkT * 11)) * 2.4 * z : Math.sin(W.t * 1.8 + p.seed) * 0.8 * z;
    if (p.sit) g.drawImage(img, 0, 0, 96, 130, s.x - w / 2, s.y - h * 0.86 - bob, w, h * (130 / 192));
    else g.drawImage(img, s.x - w / 2, s.y - h - bob, w, h);
    if (p.dealer && W.active.has(p.dealer.key)) {
      const k = Math.sin(W.t * 6 + p.seed);
      if (k > 0.7) ellipse(s.x + (k - 0.7) * 30 * z, s.y - h * 0.38, 4 * z, 3 * z, "#f4f1ea");
    }
    if (tag) {
      g.save();
      g.font = `700 ${Math.round(12.5 * Math.max(0.85, z))}px Heebo, sans-serif`;
      g.direction = "rtl";
      g.textAlign = "center";
      const tw = g.measureText(tag).width + 14;
      const ty = s.y - (p.sit ? h * 0.92 : h) - 12 * z - bob;
      g.fillStyle = "rgba(10,6,8,.78)";
      rr(s.x - tw / 2, ty - 15, tw, 20, 10);
      g.fill();
      g.strokeStyle = tagColor;
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = tagColor;
      g.fillText(tag, s.x, ty);
      g.restore();
    }
  }

  /* בועת דיבור מעל דמות באולם */
  function drawBubble(p, text) {
    const z = W.z;
    const s = proj(p.x, p.y);
    const h = 122 * z;
    g.save();
    g.font = `800 ${Math.round(Math.max(13, 15 * z))}px Heebo, sans-serif`;
    g.direction = "rtl";
    g.textAlign = "center";
    const label = p.name ? `${p.name}: ${text}` : text;
    const tw = g.measureText(label).width + 22;
    const by = s.y - h - 26 * z;
    g.shadowColor = "rgba(0,0,0,.5)";
    g.shadowBlur = 12;
    g.fillStyle = "#fff8e8";
    rr(s.x - tw / 2, by - 28, tw, 32, 16);
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.moveTo(s.x - 7, by + 3);
    g.lineTo(s.x + 7, by + 3);
    g.lineTo(s.x, by + 13);
    g.fill();
    g.fillStyle = "#2a1a00";
    g.fillText(label, s.x, by - 6);
    g.restore();
  }

  /* ===================== המלצריות מציעות בירה ===================== */
  const BEER_LINES = ["בירה קרה, על חשבון הבית? 🍺", "צמא? הבאתי לך בירה 🍺", "רוצה בירה לפני המשחק? 🍻", "משהו לשתות? בירה קרה 🍺"];
  function myLook() {
    const look = C.profile.get()?.look || C.cleanLook();
    return W.beerUntil > Date.now() ? { ...look, item: "beer" } : look;
  }
  function updateWaitresses() {
    const now = performance.now();
    const me = W.me;
    if (W.beerUntil && Date.now() > W.beerUntil) {
      W.beerUntil = 0;
      me.look = myLook();
    }
    const o = W.offer;
    if (o) {
      if (now > o.until || Math.hypot(o.w.x - me.x, o.w.y - me.y) > 320) endOffer(false, true);
      return;
    }
    if (!entered || C.T.session || now < (W.offerCool || 0) || !$("#profile").hidden) return;
    for (const w of W.people) {
      if (!w.waitress || now < (w.cool || 0)) continue;
      if (Math.hypot(w.x - me.x, w.y - me.y) < 170) return startOffer(w);
    }
  }
  function startOffer(w) {
    const now = performance.now();
    w.path = [];
    w.wait = 9;
    const text = C.pick(BEER_LINES);
    w.say = { text, until: now + 8000 };
    W.offer = { w, until: now + 8000 };
    const box = $("#offer");
    box.innerHTML = `<img src="${C.avatarURL(w.look)}" alt=""><div><b>${esc(w.name)}, המלצרית</b><p>${esc(text)}</p>
<div class="offer-btns"><button class="btn gold yes">🍺 כן, תודה!</button><button class="btn ghost no">לא תודה</button></div></div>`;
    box.hidden = false;
    $(".yes", box).onclick = () => endOffer(true);
    $(".no", box).onclick = () => endOffer(false);
    C.sfx.play("turn");
  }
  function endOffer(accept, quiet) {
    const o = W.offer;
    if (!o) return;
    const now = performance.now();
    const w = o.w;
    W.offer = null;
    $("#offer").hidden = true;
    w.cool = now + 45000;
    W.offerCool = now + 20000;
    w.wait = 1.2;
    if (accept) {
      W.beerUntil = Date.now() + 120000;
      W.me.look = myLook();
      w.say = { text: "לחיים! 🍻", until: now + 2500 };
      C.sfx.play("chip");
      C.sfx.play("chip", 0.12);
      C.toast("🍻 לחיים! הבירה על חשבון הבית");
      Lobby.tick();
    } else w.say = quiet ? null : { text: "אולי אחר כך 😉", until: now + 2200 };
  }
  /* בכניסה לאולם — המלצרית הקרובה ניגשת מיד להציע בירה */
  function greetOnEnter() {
    const me = W.me;
    const ws = W.people.filter((p) => p.waitress);
    const w = ws.reduce((a, b) => (Math.hypot(b.x - me.x, b.y - me.y) < Math.hypot(a.x - me.x, a.y - me.y) ? b : a));
    const speed = w.speed;
    let tries = 0;
    W.offerCool = Infinity;
    const done = () => {
      w.speed = speed;
      if (W.offerCool === Infinity) W.offerCool = 0;
    };
    const chase = () => {
      w.wait = 0;
      w.goTo({ x: me.x + 70, y: me.y - 30 });
      w.arrive = () => {
        if (W.offer || C.T.session || !$("#profile").hidden) return done();
        if (Math.hypot(w.x - me.x, w.y - me.y) > 200 && ++tries < 4) return chase();
        done();
        startOffer(w);
      };
    };
    w.speed = 280;
    chase();
  }

  function tableInfo(t) {
    const ps = [...Lobby.people.values()].filter((p) => p.at === t.key);
    const multi = ps.filter((p) => !p.solo);
    const solo = ps.filter((p) => p.solo);
    const names = (a) => a.slice(0, 3).map((p) => p.name).join(", ") + (a.length > 3 ? ` ועוד ${a.length - 3}` : "");
    return {
      multi,
      solo,
      line: multi.length
        ? `🟢 ${multi.length === 1 ? "משחק/ת" : multi.length + " משחקים"}: ${names(multi)}`
        : solo.length
          ? `🤖 ${names(solo)} מול המחשב`
          : "פנוי · בואו לשחק!",
      st: multi.find((p) => p.st)?.st || "",
    };
  }

  function drawSign(t) {
    const z = W.z;
    const p = proj(t.x, t.y - t.ry);
    const info = tableInfo(t);
    const hot = W.hover === t || W.near === t;
    const fy = Math.sin(W.t * 1.6 + t.x) * 3 * z;
    const y = p.y - 150 * z + fy;
    g.save();
    g.direction = "rtl";
    g.textAlign = "center";
    const f1 = Math.round(Math.max(14, 21 * z));
    const f2 = Math.round(Math.max(11, 13.5 * z));
    g.font = `${f1}px "Secular One", Heebo`;
    const title = `${C.GAMES[t.game].icon} ${t.name}`;
    g.font = `700 ${f2}px Heebo`;
    const line2 = info.line + (info.st && info.multi.length ? ` · ${info.st}` : "");
    const w2 = g.measureText(line2).width;
    g.font = `${f1}px "Secular One", Heebo`;
    const bw = Math.max(g.measureText(title).width, w2) + 34;
    const bh = f1 + f2 + 24;
    g.shadowColor = t.color;
    g.shadowBlur = hot ? 26 : 14;
    g.fillStyle = "rgba(12,6,10,.86)";
    rr(p.x - bw / 2, y - bh, bw, bh, 12);
    g.fill();
    g.strokeStyle = t.color;
    g.lineWidth = hot ? 3 : 2;
    g.stroke();
    g.shadowBlur = 10;
    g.fillStyle = "#fff";
    g.fillText(title, p.x, y - bh + f1 + 6);
    g.shadowBlur = 0;
    g.font = `700 ${f2}px Heebo`;
    g.fillStyle = info.multi.length ? "#7dffa8" : info.solo.length ? "#ffd36b" : "#c9b8ad";
    g.fillText(line2, p.x, y - 10);
    g.fillStyle = t.color;
    g.beginPath();
    g.moveTo(p.x - 8, y);
    g.lineTo(p.x + 8, y);
    g.lineTo(p.x, y + 9);
    g.fill();
    g.restore();
    t.signBox = { x: p.x - bw / 2, y: y - bh, w: bw, h: bh + 9 };
  }

  /* ===================== לולאה ===================== */
  const keys = new Set();
  function update(dt) {
    W.t += dt;
    const me = W.me;
    /* מקלדת */
    let kx = 0, ky = 0;
    if (keys.has("ArrowLeft") || keys.has("a")) kx -= 1;
    if (keys.has("ArrowRight") || keys.has("d")) kx += 1;
    if (keys.has("ArrowUp") || keys.has("w")) ky -= 1;
    if (keys.has("ArrowDown") || keys.has("s")) ky += 1;
    if (kx || ky) {
      me.path = [];
      W.goal = null;
      const l = Math.hypot(kx, ky);
      const sp = 300 * dt;
      const nx = me.x + (kx / l) * sp;
      const ny = me.y + (ky / l) * sp;
      if (!blocked(nx, ny)) (me.x = nx), (me.y = ny);
      else if (!blocked(nx, me.y)) me.x = nx;
      else if (!blocked(me.x, ny)) me.y = ny;
      me.moving = true;
      me.walkT += dt;
    } else me.update(dt);
    for (const p of W.people) p.update(dt);
    updateWaitresses();
    /* שחקנים אמיתיים — תנועה חלקה לעבר המיקום האחרון שקיבלנו */
    for (const p of Lobby.people.values()) {
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      p.moving = d > 3;
      if (d > 600) (p.x = p.tx), (p.y = p.ty);
      else {
        const k = Math.min(1, dt * 6);
        p.x += dx * k;
        p.y += dy * k;
      }
      if (p.moving) p.walkT += dt;
    }
    /* מצלמה */
    W.cam.x += (me.x - W.cam.x) * Math.min(1, dt * 4);
    W.cam.y += (me.y - 120 - W.cam.y) * Math.min(1, dt * 4);
    const hw = VW / 2 / W.z;
    const hh = VH / 2 / (W.z * K);
    W.cam.x = C.clamp(W.cam.x, Math.min(WORLD.w / 2, hw), Math.max(WORLD.w / 2, WORLD.w - hw));
    W.cam.y = C.clamp(W.cam.y, Math.min(WORLD.h / 2, hh - 260 / K), Math.max(WORLD.h / 2, WORLD.h - hh));
    /* קרוב לשולחן? */
    let near = null;
    for (const t of TABLES) if (Math.hypot(me.x - t.ax, me.y - t.ay) < 100 || Math.hypot(me.x - t.x, me.y - t.y) < t.rx + 90) near = t;
    W.near = near;
    if (!near) {
      if (W.cardFor) closeCard();
      W.cardFor = null;
    } else if (!me.moving && W.cardFor !== near) openCard(near);
    if (W.goal && !me.path.length) {
      const t = W.goal;
      W.goal = null;
      openCard(t);
    }
  }

  function render() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFloor();
    drawWall();
    drawBar();
    W.active = new Set([...Lobby.people.values()].map((p) => p.at).filter(Boolean));
    /* כל מי שעומד/יושב — ממוינים לפי עומק */
    const items = [];
    for (const m of W.props) items.push({ y: m.y, f: () => (m.kind === "slot" ? drawSlot(m) : m.kind === "plant" ? drawPlant(m) : m.kind === "stool" ? drawStool(m) : drawTable(m.t, W.active.has(m.t.key))) });
    for (const t of TABLES) for (const c of t.chairs) items.push({ y: c.y - 1, f: () => drawChair(c) });
    for (const p of W.people) items.push({ y: p.y, f: () => drawPerson(p) });
    /* שחקנים אמיתיים: מי שיושב בשולחן — על כיסא; השאר — איפה שהם */
    const seatUse = new Map();
    for (const [id, p] of Lobby.people) {
      let q = p;
      if (p.at) {
        const t = TABLES.find((x) => x.key === p.at);
        const used = seatUse.get(t) || new Set(W.people.filter((n) => n.chairOf === t).map((n) => n.chairI));
        seatUse.set(t, used);
        const ci = t.chairs.findIndex((_, i) => !used.has(i));
        if (ci >= 0) {
          used.add(ci);
          q = { ...p, x: t.chairs[ci].x, y: t.chairs[ci].y, sit: true, moving: false, seed: id.length };
        }
      }
      items.push({ y: q.y, f: () => drawPerson(q, p.name, "#7dffa8") });
    }
    items.push({ y: W.me.y, f: () => drawPerson(W.me, "אני · " + W.me.name, "#ffd36b") });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.f());
    const nowMs = performance.now();
    for (const p of W.people) if (p.say && nowMs < p.say.until) drawBubble(p, p.say.text);
    /* יעד הליכה */
    const dest = W.me.path[W.me.path.length - 1];
    if (dest) {
      const s = proj(dest.x, dest.y);
      const r = (8 + Math.sin(W.t * 8) * 2) * W.z;
      ellipse(s.x, s.y, r * 2, r * 0.8, null, "rgba(255,211,107,.8)", 2);
    }
    for (const t of TABLES) drawSign(t);
    /* וינייטה */
    const v = g.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.3, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.55)");
    g.fillStyle = v;
    g.fillRect(0, 0, VW, VH);
  }

  let lastT = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - lastT) / 1000 || 0);
    lastT = ts;
    if (!C.T.session) {
      update(dt);
      render();
    }
    requestAnimationFrame(loop);
  }

  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    VW = innerWidth;
    VH = innerHeight;
    cv.width = Math.round(VW * dpr);
    cv.height = Math.round(VH * dpr);
    cv.style.width = VW + "px";
    cv.style.height = VH + "px";
    W.z = VW < VH ? C.clamp(VH / 1150, 0.55, 0.85) : C.clamp(Math.min(VW / 1500, VH / 950), 0.5, 1);
    carpet = null;
  }

  /* ===================== קלט ===================== */
  function tableAt(sx, sy) {
    for (const t of TABLES) {
      const b = t.signBox;
      if (b && sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return t;
    }
    const w = unproj(sx, sy + 30 * W.z);
    for (const t of TABLES) {
      const dx = (w.x - t.x) / (t.rx + 30);
      const dy = (w.y - t.y) / (t.ry + 40);
      if (dx * dx + dy * dy < 1) return t;
    }
    return null;
  }
  function walkTo(t) {
    W.me.goTo({ x: t.ax, y: t.ay });
    W.goal = t;
  }
  function bindInput() {
    cv.addEventListener("pointerdown", (e) => {
      C.sfx.ac();
      const t = tableAt(e.clientX, e.clientY);
      if (t) return walkTo(t);
      const w = unproj(e.clientX, e.clientY);
      if (blocked(w.x, w.y)) return;
      W.goal = null;
      W.me.goTo(w);
      closeCard();
      $("#hint").classList.add("gone");
    });
    cv.addEventListener("pointermove", (e) => {
      W.hover = tableAt(e.clientX, e.clientY);
      cv.style.cursor = W.hover ? "pointer" : "default";
    });
    addEventListener("keydown", (e) => {
      if (C.T.session || e.target.closest("input, textarea")) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d"].includes(k)) {
        keys.add(k);
        e.preventDefault();
        $("#hint").classList.add("gone");
      }
      if ((k === "Enter" || k === "e") && W.near) openCard(W.near);
    });
    addEventListener("keyup", (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
    addEventListener("blur", () => keys.clear());
    addEventListener("resize", resize);
  }

  /* ===================== כרטיס שולחן ===================== */
  function openCard(t) {
    const card = $("#tableCard");
    const G = C.GAMES[t.game];
    const info = tableInfo(t);
    if (C.wallet.refillIfBroke()) C.toast("💸 נגמר הכסף? קיבלת <b>$100</b> חדשים!", "win");
    const cash = Math.floor(C.wallet.cash);
    W.cardFor = t;
    card.dataset.key = t.key;
    const def = Math.min(cash, t.game === "poker" ? 50 : cash);
    card.innerHTML = `
<button class="sheet-x" aria-label="סגירה">✕</button>
<div class="sheet-head" style="--c:${t.color}"><span class="sheet-ic">${G.icon}</span><div><h3>${esc(t.name)}</h3><p>${esc(G.blurb)}</p></div></div>
<div class="sheet-status ${info.multi.length ? "live" : ""}">${esc(info.line)}${info.st && info.multi.length ? ` · ${esc(info.st)}` : ""}</div>
${
  cash >= 1
    ? `<div class="buyin"><span>כמה כסף מביאים לשולחן?</span><div class="amt-big">$<b>${def}</b></div>
<input type="range" min="1" max="${cash}" value="${def}" class="amt-range" aria-label="סכום לשולחן"><small>בארנק: ${C.money(C.wallet.cash)} · מה שלא תפסידו חוזר לארנק כשקמים</small></div>
<div class="sheet-btns">
  <button class="btn gold join">👥 לשולחן המשותף<small>${
    info.multi.length ? "מצטרפים למי שכבר משחק" : "פותחים שולחן ומחכים לחברים מכל מכשיר"
  }</small></button>
  <button class="btn ghost solo">🤖 לבד מול המחשב<small>שולחן פרטי, מתחילים מיד</small></button>
</div>`
    : `<div class="sheet-empty">💸 הארנק ריק להיום.<br>מחר בבוקר מחכים לך <b>$100</b> חדשים!</div>`
}
<button class="link rules">איך משחקים?</button>`;
    card.hidden = false;
    requestAnimationFrame(() => card.classList.add("on"));
    $(".sheet-x", card).onclick = closeCard;
    const r = $(".amt-range", card);
    if (r) r.oninput = () => ($(".amt-big b", card).textContent = r.value);
    const go = (mode) => {
      const amt = +r.value;
      closeCard();
      const s = new C.Session({ key: t.key, game: t.game, name: t.name, dealer: t.dealerLook }, mode, {
        exit: () => {
          lastT = performance.now();
          if (C.wallet.refillIfBroke()) C.toast("💸 נגמר הכסף? קיבלת <b>$100</b> חדשים!", "win");
          updateCash();
          Lobby.tick();
        },
      });
      s.start(amt);
      Lobby.tick();
    };
    $(".join", card) && ($(".join", card).onclick = () => go("multi"));
    $(".solo", card) && ($(".solo", card).onclick = () => go("solo"));
    $(".rules", card).onclick = () => {
      card.querySelector(".sheet-rules")?.remove();
      $(".rules", card).insertAdjacentHTML("afterend", `<div class="sheet-rules">${G.rules}</div>`);
    };
  }
  function closeCard() {
    const card = $("#tableCard");
    card.classList.remove("on");
    setTimeout(() => !card.classList.contains("on") && (card.hidden = true), 250);
  }

  /* ===================== ממשק עליון ===================== */
  function updateCash() {
    $("#cash").textContent = C.money(C.wallet.cash).replace("$", "");
  }
  function openTables() {
    const d = $("#tablesDrawer");
    d.innerHTML = `<div class="drawer-card"><div class="drawer-head"><h3>🎲 השולחנות באולם</h3><button class="sheet-x">✕</button></div>
${TABLES.map((t) => {
  const i = tableInfo(t);
  return `<button class="tbl-row" data-k="${t.key}" style="--c:${t.color}"><span class="ic">${C.GAMES[t.game].icon}</span><span><b>${esc(t.name)}</b><small class="${i.multi.length ? "live" : ""}">${esc(i.line)}</small></span><span class="go">←</span></button>`;
}).join("")}</div>`;
    d.hidden = false;
    $(".sheet-x", d).onclick = () => (d.hidden = true);
    d.onclick = (e) => {
      if (e.target === d) return (d.hidden = true);
      const b = e.target.closest(".tbl-row");
      if (!b) return;
      d.hidden = true;
      const t = TABLES.find((x) => x.key === b.dataset.k);
      walkTo(t);
      openCard(t);
    };
  }

  function openProfile(first) {
    const m = $("#profile");
    const cur = C.profile.get() || { name: "", look: C.randomLook() };
    let look = { ...cur.look };
    const K = C.LOOK;
    const row = (label, inner) => `<div class="pf-row"><span>${label}</span>${inner}</div>`;
    const sw = (k, arr, label) =>
      row(label, `<div class="sw">${arr.map((c) => `<button data-k="${k}" data-v="${c}" style="--c:${c}" aria-label="${c}"></button>`).join("")}</div>`);
    const seg = (k, obj, label) =>
      row(label, `<div class="seg">${Object.entries(obj).map(([v, t]) => `<button data-k="${k}" data-v="${v}">${esc(t)}</button>`).join("")}</div>`);
    const tog = (k, t) => `<button data-k="${k}" data-v="t">${t}</button>`;
    const TABS = {
      body: ["🧍 גוף", () => sw("skin", K.skin, "גוון עור") + seg("nose", K.nose, "אף") + row("תוספות", `<div class="seg">${tog("blush", "☺️ לחיים ורודות")}${tog("freckles", "✨ נמשים")}${tog("earrings", "💎 עגילים")}</div>`)],
      face: [
        "🙂 פנים",
        () =>
          seg("eyes", K.eyes, "עיניים") +
          sw("eye", K.eye, "צבע עיניים") +
          seg("brows", K.brows, "גבות") +
          seg("mouth", K.mouth, "פה") +
          sw("lips", K.lips, "צבע שפתיים") +
          seg("facial", K.facial, "זקן ושפם"),
      ],
      hair: ["💇 שיער", () => seg("hs", Object.fromEntries(K.hs.map((h, i) => [i, h])), "תסרוקת") + sw("hair", K.hair, "צבע שיער")],
      wear: [
        "👕 תלבושת",
        () =>
          seg("outfit", K.outfit, "מה לובשים") +
          sw("top", K.top, "צבע ראשי") +
          sw("bottom", K.bottom, "מכנסיים") +
          sw("acc", K.acc, "צבע משני (עניבה, גלימה, פסים)") +
          row("מספר על החולצה", `<input type="number" min="0" max="99" class="pf-num" value="${look.num}">`),
      ],
      acc: ["🎩 אביזרים", () => seg("hat", K.hat, "כובע") + sw("hatc", K.hatc, "צבע כובע") + seg("glasses", K.glasses, "משקפיים") + seg("item", K.item, "ביד")],
      photo: ["📸 תמונה מהאתר", () => `<p class="pf-note">משתמשים בתמונה של שחקן מהאתר במקום הפנים. הכובע והמשקפיים נשארים מעליה.</p><div class="pf-photos"><span class="pf-note">טוענים את התמונות…</span></div>`],
    };
    let tab = "body";
    m.innerHTML = `<div class="modal-card pf-card">
${first ? `<div class="pf-hero"><img src="favicon.svg" alt=""><div><h2>ברוכים הבאים לקזינו המאוחדת</h2><p>כל אחד מקבל <b>$100</b> כסף משחק בכל יום. בונים דמות ונכנסים לאולם.</p></div></div>` : `<h2>הדמות שלי</h2>`}
<div class="pf-grid"><div class="pf-prev"><img id="pfImg" alt="הדמות שלך"><div class="pf-floor"></div>
<div class="pf-rands"><button class="btn ghost pf-rand">🎲 אקראי</button><button class="btn ghost pf-wild">🤪 מטורף</button></div></div>
<div class="pf-opts">
<label class="pf-name"><span>איך קוראים לך?</span><input id="pfName" maxlength="16" placeholder="השם שיופיע מעל הראש" value="${esc(cur.name)}"></label>
<div class="pf-tabs">${Object.entries(TABS).map(([k, [t]]) => `<button data-tab="${k}">${t}</button>`).join("")}</div>
<div class="pf-pane"></div>
</div></div>
<button class="btn gold big pf-go">${first ? "כניסה לקזינו ←" : "שמירה"}</button></div>`;
    m.hidden = false;
    const pane = $(".pf-pane", m);
    const paint = () => {
      $("#pfImg").src = C.avatarURL(look);
      m.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
      pane.querySelectorAll("[data-k]").forEach((b) => {
        const k = b.dataset.k;
        b.classList.toggle("on", b.dataset.v === "t" ? !!look[k] : String(look[k]) === b.dataset.v);
      });
    };
    const showTab = (t) => {
      tab = t;
      pane.innerHTML = TABS[t][1]();
      if (t === "photo")
        C.sitePhotos().then((list) => {
          if (tab !== "photo") return;
          $(".pf-photos", pane).innerHTML =
            `<button class="pf-ph" data-k="photo" data-v=""><span class="none">🙂</span><small>בלי תמונה</small></button>` +
            (list.length
              ? list.map((p) => `<button class="pf-ph" data-k="photo" data-v="${esc(p.url)}" data-n="${esc(p.name)}"><img src="${esc(p.url)}" alt="" loading="lazy"><small>${esc(p.name || "שחקן")}</small></button>`).join("")
              : `<span class="pf-note">עוד לא הועלו תמונות שחקנים לאתר. ברגע שיעלו תמונות בעמוד הסגל — הן יופיעו כאן.</span>`);
          paint();
        });
      paint();
    };
    showTab(tab);
    const onReady = () => (m.hidden ? C.offAvatarReady(onReady) : paint());
    C.onAvatarReady(onReady);
    m.querySelector(".pf-tabs").onclick = (e) => {
      const b = e.target.closest("[data-tab]");
      if (b) showTab(b.dataset.tab);
    };
    pane.oninput = (e) => {
      if (e.target.matches(".pf-num")) {
        look = C.cleanLook({ ...look, num: e.target.value });
        paint();
      }
    };
    pane.onclick = (e) => {
      const b = e.target.closest("[data-k]");
      if (!b) return;
      const k = b.dataset.k;
      const v = b.dataset.v;
      if (v === "t") look[k] = !look[k];
      else look[k] = k === "hs" ? +v : v;
      if (k === "photo" && v && b.dataset.n && !$("#pfName").value.trim()) $("#pfName").value = b.dataset.n.split(" ")[0];
      if (k === "outfit" && v === "jersey" && tab === "wear") showTab("wear");
      look = C.cleanLook(look);
      C.sfx.play("click");
      paint();
    };
    $(".pf-rand", m).onclick = () => {
      look = { ...C.randomLook(), photo: look.photo };
      showTab(tab);
    };
    $(".pf-wild", m).onclick = () => {
      look = { ...C.randomLook(Math.random, true), photo: look.photo };
      showTab(tab);
    };
    $(".pf-go", m).onclick = () => {
      const name = $("#pfName").value.replace(/\s+/g, " ").trim();
      if (!name) {
        $("#pfName").focus();
        $("#pfName").classList.add("err");
        return;
      }
      C.profile.set({ name, look });
      m.hidden = true;
      C.sfx.ac();
      applyProfile();
      if (first) enter();
    };
    if (!first) m.onclick = (e) => e.target === m && (m.hidden = true);
  }
  function applyProfile() {
    const p = C.profile.get();
    if (!p) return;
    $("#meAv").src = C.avatarURL(p.look);
    if (W.me) {
      W.me.look = myLook();
      W.me.name = p.name;
    }
  }

  /* ===================== הפעלה ===================== */
  let entered = false;
  function enter() {
    if (entered) return;
    entered = true;
    const p = C.profile.get();
    W.me = new Person({ x: 1170, y: 2200, look: p.look, name: p.name, speed: 290 });
    W.me.goTo({ x: 1170, y: 2060 });
    W.cam.x = 1170;
    W.cam.y = 1860;
    document.body.classList.add("entered");
    Lobby.start();
    setTimeout(greetOnEnter, 600);
    setTimeout(() => $("#hint").classList.add("gone"), 12000);
  }

  function init() {
    cv = $("#floor");
    g = cv.getContext("2d");
    C.wallet.init();
    C.wallet.refillIfBroke();
    C.wallet.on(updateCash);
    updateCash();
    buildWorld();
    resize();
    bindInput();
    W.me = new Person({ x: 1170, y: 2080, look: C.cleanLook(), name: "" });
    requestAnimationFrame(loop);
    const snd = $("#soundBtn");
    const sndTxt = () => (snd.textContent = C.sfx.on ? "🔊" : "🔇");
    sndTxt();
    snd.onclick = () => (C.sfx.toggle(), sndTxt());
    $("#tablesBtn").onclick = openTables;
    $("#meBtn").onclick = () => openProfile(false);
    $("#walletBtn").onclick = () => {
      const ms = C.wallet.untilReset();
      const h = Math.floor(ms / 3600000);
      const mi = Math.floor((ms % 3600000) / 60000);
      C.toast(
        `💰 בארנק: <b>${C.money(C.wallet.cash)}</b><br><small>נגמר הכסף? מקבלים מיד $100 חדשים. ובכל יום מי שיש לו פחות מ-$100 מקבל השלמה ל-$100 (בעוד ${h}:${String(mi).padStart(2, "0")} שעות).</small>`,
      );
    };
    setInterval(() => {
      if (C.wallet.checkDay()) C.toast("☀️ יום חדש! הארנק מולא ל-<b>$100</b>", "win");
      else if (!C.T.session && C.wallet.refillIfBroke()) C.toast("💸 נגמר הכסף? קיבלת <b>$100</b> חדשים!", "win");
    }, 30000);
    /* סוגרים את הדף באמצע משחק — מה שעל השולחן חוזר לארנק */
    addEventListener("pagehide", () => C.T.session?.close());
    $("#loading").classList.add("gone");
    C.onAvatarReady(applyProfile);
    if (C.profile.get()) {
      applyProfile();
      enter();
    } else openProfile(true);
  }

  if (document.readyState === "loading") addEventListener("DOMContentLoaded", init);
  else init();
})();
