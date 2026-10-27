/* ===================== רולטה אירופאית =====================
   0–36, כל סוגי ההימורים: מספר בודד, ספליט, שורה, פינה, שתי שורות,
   טורים, תריסרים, אדום/שחור, זוגי/פרדי, 1–18/19–36. לכל שחקן צבע
   ז'יטונים משלו. אחרי "סובבו" יש עוד רגע להימורים אחרונים — ואז נסגר.
   התוצאה נקבעת רק ברגע הסגירה, והכדור "מתכוונן" אליה בעדינות. */
(function () {
  const C = window.Casino;
  const { $, esc } = C;
  const T = C.T;

  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = (n) => (n === 0 ? "g" : REDS.has(n) ? "r" : "b");
  const COLOR_WORD = { r: "אדום", b: "שחור", g: "ירוק" };
  const COLORS = ["#ff4d6d", "#3ea6ff", "#3ddc84", "#ffd23f", "#b06bff", "#ff9f1a", "#2ee6d6", "#ff7ad9"];
  const TAU = Math.PI * 2;
  const STEP = TAU / 37;

  /* ציר הזמן של סיבוב (מילישניות מרגע "סובבו") */
  const CLOSE = 3500;
  const DROP = 5600;
  const LAND = 7400;
  const SETTLE = 8000;
  const STOP = 11000;
  const SHOW = 4800;
  const AUTO = 25000;
  const W0 = 2.4;
  const B0 = 12;
  const TRACK = 0.84;
  const POCKET = 0.535;

  /* ===================== לוח ההימורים ===================== */
  /* יחידות לוח: 14 רוחב (אפס + 12 עמודות + טורים), 5 גובה (3 שורות + תריסרים + חוץ) */
  const BETS = new Map();
  const cellOf = (n) => (n === 0 ? { x: 0, y: 0, w: 1, h: 3 } : { x: 1 + Math.floor((n - 1) / 3), y: 2 - ((n - 1) % 3), w: 1, h: 1 });
  const E = 0.17;
  const sq = (x, y) => ({ x0: x - 0.21, y0: y - 0.21, x1: x + 0.21, y1: y + 0.21 });
  function nameOf(nums) {
    const s = [...nums].sort((a, b) => a - b);
    if (s.length === 1) return `מספר ${s[0]}`;
    if (s.length === 2) return `ספליט ${s.join("/")}`;
    if (s.length === 3) return s[0] === 0 ? `שלישייה ${s.join("/")}` : `שורה ${s[0]}–${s[2]}`;
    if (s.length === 4) return s[0] === 0 ? "ארבעה ראשונים 0–3" : `פינה ${s.join("/")}`;
    return `שתי שורות ${s[0]}–${s[5]}`;
  }
  function addIn(nums, x, y, hit, z) {
    const s = [...nums].sort((a, b) => a - b);
    const k = "i:" + s.join("-");
    BETS.set(k, { k, nums: s, x, y, hit, z, pay: 36 / s.length - 1, label: nameOf(s) });
  }
  function addOut(k, label, nums, pay, r) {
    BETS.set(k, { k, nums, x: r.x0 + (r.x1 - r.x0) / 2, y: r.y0 + (r.y1 - r.y0) / 2, hit: r, z: 1, pay, label, out: true });
  }
  {
    for (let n = 0; n <= 36; n++) {
      const c = cellOf(n);
      addIn([n], c.x + c.w / 2, c.y + c.h / 2, { x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h }, 1);
    }
    for (let n = 1; n <= 36; n++) {
      const c = cellOf(n);
      if (n <= 33) addIn([n, n + 3], c.x + 1, c.y + 0.5, { x0: c.x + 1 - E, y0: c.y + 0.2, x1: c.x + 1 + E, y1: c.y + 0.8 }, 2);
      if (n % 3 !== 0) {
        addIn([n, n + 1], c.x + 0.5, c.y, { x0: c.x + 0.2, y0: c.y - E, x1: c.x + 0.8, y1: c.y + E }, 2);
        if (n <= 32) addIn([n, n + 1, n + 3, n + 4], c.x + 1, c.y, sq(c.x + 1, c.y), 3);
      }
      if (n % 3 === 1) {
        addIn([n, n + 1, n + 2], c.x + 0.5, 3, { x0: c.x + 0.2, y0: 3 - E, x1: c.x + 0.8, y1: 3 + E }, 2);
        if (n <= 31) addIn([n, n + 1, n + 2, n + 3, n + 4, n + 5], c.x + 1, 3, sq(c.x + 1, 3), 3);
      }
    }
    for (const n of [1, 2, 3]) {
      const y = cellOf(n).y;
      addIn([0, n], 1, y + 0.5, { x0: 1 - E, y0: y + 0.2, x1: 1 + E, y1: y + 0.8 }, 2);
    }
    addIn([0, 1, 2], 1, 2, sq(1, 2), 3);
    addIn([0, 2, 3], 1, 1, sq(1, 1), 3);
    addIn([0, 1, 2, 3], 1, 3, sq(1, 3), 3);
    const all = Array.from({ length: 36 }, (_, i) => i + 1);
    for (let c = 1; c <= 3; c++) {
      const row = 3 - c;
      addOut(`c${c}`, `טור ${c}`, all.filter((n) => (n - 1) % 3 === c - 1), 2, { x0: 13, y0: row, x1: 14, y1: row + 1 });
    }
    ["12 ראשונים", "12 אמצעיים", "12 אחרונים"].forEach((l, d) =>
      addOut(`d${d + 1}`, l, all.slice(d * 12, d * 12 + 12), 2, { x0: 1 + d * 4, y0: 3, x1: 5 + d * 4, y1: 4 }),
    );
    [
      ["low", "1–18", (n) => n <= 18],
      ["even", "זוגי", (n) => n % 2 === 0],
      ["red", "אדום", (n) => REDS.has(n)],
      ["black", "שחור", (n) => !REDS.has(n)],
      ["odd", "פרדי", (n) => n % 2 === 1],
      ["high", "19–36", (n) => n >= 19],
    ].forEach(([k, l, f], i) => addOut(k, l, all.filter(f), 1, { x0: 1 + i * 2, y0: 4, x1: 3 + i * 2, y1: 5 }));
  }
  const total = (b) => C.r2(Object.values(b || {}).reduce((a, v) => a + v, 0));
  const short = (v) => (v >= 1000 ? C.r2(v / 1000) + "k" : String(Math.round(v)));
  const describe = (n) => (n === 0 ? "אפס · ירוק" : `${COLOR_WORD[colorOf(n)]} · ${n % 2 ? "פרדי" : "זוגי"} · ${n <= 18 ? "1–18" : "19–36"}`);
  const colorFor = (V, id) => COLORS[V.players[id]?.seat ?? 0];

  /* ===================== תנועת הגלגל והכדור ===================== */
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const wheelAt = (wa0, el) => wa0 + ((W0 * STOP) / 1000) * (1 - (1 - C.clamp(el / STOP, 0, 1)) ** 3) / 3;
  const ballBase = (el) => -Math.PI / 2 - ((B0 * LAND) / 1000) * (1 - (1 - C.clamp(el / LAND, 0, 1)) ** 3) / 3;
  const pocketA = (n) => ORDER.indexOf(n) * STEP - Math.PI / 2;
  function ballRad(el) {
    if (el < DROP) return TRACK;
    const v = C.clamp((el - DROP) / (LAND - DROP), 0, 1);
    return TRACK - (TRACK - POCKET) * smooth(v) + Math.abs(Math.sin(v * Math.PI * 3.5)) * (1 - v) * 0.07;
  }
  function spinState(wa0, el, n) {
    const wa = wheelAt(wa0, el);
    if (n == null) return { wa, a: ballBase(el), r: ballRad(el) };
    if (el >= LAND) return { wa, a: wa + pocketA(n), r: POCKET, landed: true };
    let d = (((wheelAt(wa0, LAND) + pocketA(n) - ballBase(LAND)) % TAU) + TAU) % TAU;
    if (d > Math.PI) d -= TAU;
    return { wa, a: ballBase(el) + d * smooth((el - CLOSE) / (LAND - CLOSE)), r: ballRad(el) };
  }

  /* ===================== המארח ===================== */
  const say = (S, pid, t) => (S.says[pid] = { t, k: (S.sk = (S.sk || 0) + 1) });

  function go(S, H) {
    if (S.phase !== "bet" || !Object.keys(S.bets).length) return;
    H.clear("auto");
    S.autoAt = 0;
    S.phase = "spin";
    S.open = true;
    S.round++;
    S.results = null;
    S.why = null;
    S.result = null;
    S.spinId = (S.spinId || 0) + 1;
    S.spinAt = Date.now();
    S.wa0 = S.wa;
    H.say("הגלגל מסתובב… הימורים אחרונים! ⏳");
    if (S.solo) botBets(S, H);
    H.after(CLOSE, () => {
      S.open = false;
      S.result = Math.floor(C.rand() * 37);
      S.hx = {};
      H.say("אין יותר הימורים! 🚫");
      H.push();
    });
    H.after(SETTLE, () => settle(S, H));
  }

  function settle(S, H) {
    const n = S.result;
    S.phase = "done";
    S.results = {};
    S.why = {};
    S.hist.unshift(n);
    S.hist.length = Math.min(S.hist.length, 14);
    S.wa = (S.wa0 + (W0 * STOP) / 3000) % TAU;
    const winners = [];
    for (const [id, bets] of Object.entries(S.bets)) {
      const p = S.players[id];
      if (!p) continue;
      let back = 0;
      const won = [];
      for (const k in bets) {
        const b = BETS.get(k);
        if (b.nums.includes(n)) {
          back += bets[k] * (b.pay + 1);
          won.push(`${b.label} (${b.pay}:1)`);
        }
      }
      back = C.r2(back);
      p.stack = C.r2(p.stack + back);
      const net = C.r2(back - total(bets));
      S.results[id] = net;
      S.why[id] = won.length ? `יצא ${n} — תפס: ${won.join(" · ")}` : `יצא ${n} ${COLOR_WORD[colorOf(n)]} — אף הימור לא תפס`;
      S.last[id] = { ...bets };
      if (net > 0) winners.push(`${p.name} +${C.money(net)}`);
      if (!p.bot) H.log(`${p.name}: ${net >= 0 ? "+" : ""}${C.money(net)}`);
      if (p.bot) say(S, id, net > 0 ? C.pick(["יש!! 🤑", "ידעתי! 😎", "תודה רבה 🙏"]) : C.pick(["אוף 😭", "בפעם הבאה…", "😤"]));
    }
    H.say(`🎯 ${n} ${COLOR_WORD[colorOf(n)]}!${winners.length ? " · " + winners.slice(0, 3).join(", ") : " הבית לוקח 😏"}`);
    H.push();
    H.after(SHOW, () => {
      S.phase = "bet";
      S.bets = {};
      S.hx = {};
      S.result = null;
      S.results = null;
      for (const id of Object.keys(S.players)) {
        const p = S.players[id];
        if (p.bot && p.stack < 5) p.stack = C.r2(p.stack + 100);
      }
      H.sweep();
      H.say("שימו ז'יטונים — ולחצו סובבו 🎡");
      H.push();
    });
  }

  /* בוטים במשחק לבד — שמים כמה ז'יטונים בזמן ההימורים האחרונים */
  const BOT_NAMES = ["רולטה-רותי", "דודו בוט", "מזל-מוטי", "צ׳יפ"];
  const BOT_LINES = { red: "הכל על אדום! 🔴", black: "שחור, תמיד שחור ⚫", odd: "פרדי 🍀", even: "זוגי, ברור", low: "נמוכים 👇", high: "גבוהים 👆" };
  function botBets(S, H) {
    for (const id of Object.keys(S.players)) {
      const p = S.players[id];
      if (!p.bot) continue;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        H.after(300 + Math.random() * 2700, () => {
          if (!S.open || !S.players[id]) return;
          const r = Math.random();
          let k;
          if (r < 0.45) k = C.pick(["red", "black", "odd", "even", "low", "high"]);
          else if (r < 0.65) k = C.pick(["d1", "d2", "d3", "c1", "c2", "c3"]);
          else if (r < 0.88) k = "i:" + Math.floor(Math.random() * 37);
          else k = C.pick([...BETS.keys()].filter((x) => x.startsWith("i:") && x.includes("-")));
          const amt = Math.min(C.pick([1, 5, 5, 10, 25]), Math.floor(p.stack));
          if (amt < 1) return;
          p.stack = C.r2(p.stack - amt);
          const mine = (S.bets[id] ||= {});
          mine[k] = (mine[k] || 0) + amt;
          const b = BETS.get(k);
          say(S, id, BOT_LINES[k] || (b.nums.length === 1 ? `${b.nums[0]}, תביא מזל 🍀` : `${b.label} 🎲`));
          H.push();
        });
      }
    }
  }

  const POS_L = [6.5, 18.9, 31.3, 43.7, 56.1, 68.5, 80.9, 93.3].map((x) => [x, 81]);
  const POS_P = [
    [14, 73],
    [38, 73],
    [62, 73],
    [86, 73],
    [14, 89],
    [38, 89],
    [62, 89],
    [86, 89],
  ];

  /* ===================== ציור הגלגל ===================== */
  function disc(g, r, fill) {
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fillStyle = fill;
    g.fill();
  }
  function ring(g, r, color, w) {
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.strokeStyle = color;
    g.lineWidth = w;
    g.stroke();
  }
  function makeBowl(R) {
    const c = document.createElement("canvas");
    c.width = c.height = Math.ceil(R * 2);
    const g = c.getContext("2d");
    g.translate(R, R);
    let gr = g.createRadialGradient(0, 0, R * 0.75, 0, 0, R);
    gr.addColorStop(0, "#3b200d");
    gr.addColorStop(0.6, "#8a5226");
    gr.addColorStop(1, "#2a1206");
    disc(g, R, gr);
    ring(g, R * 0.985, "#d8b45a", R * 0.022);
    gr = g.createRadialGradient(-R * 0.2, -R * 0.25, R * 0.1, 0, 0, R * 0.9);
    gr.addColorStop(0, "#5a3618");
    gr.addColorStop(0.85, "#2a160a");
    gr.addColorStop(1, "#140904");
    disc(g, R * 0.9, gr);
    ring(g, R * 0.9, "#d8b45a", R * 0.012);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      g.save();
      g.rotate(a);
      g.translate(0, -R * 0.795);
      g.beginPath();
      g.moveTo(0, -R * 0.03);
      g.lineTo(R * 0.022, 0);
      g.lineTo(0, R * 0.03);
      g.lineTo(-R * 0.022, 0);
      g.closePath();
      g.fillStyle = "#e9c86e";
      g.fill();
      g.restore();
    }
    disc(g, R * 0.765, "#0d0603");
    return c;
  }
  function makeRotor(R) {
    const c = document.createElement("canvas");
    c.width = c.height = Math.ceil(R * 2);
    const g = c.getContext("2d");
    g.translate(R, R);
    const OUT = R * 0.75;
    const MID = R * 0.6;
    const IN = R * 0.47;
    const FILL = { r: "#c8102e", b: "#161616", g: "#0f8a3c" };
    const DARK = { r: "#6e0817", b: "#070707", g: "#075a24" };
    ORDER.forEach((n, i) => {
      const a = i * STEP - Math.PI / 2;
      for (const [r0, r1, col] of [
        [MID, OUT, FILL],
        [IN, MID, DARK],
      ]) {
        g.beginPath();
        g.arc(0, 0, r1, a - STEP / 2, a + STEP / 2);
        g.arc(0, 0, r0, a + STEP / 2, a - STEP / 2, true);
        g.closePath();
        g.fillStyle = col[colorOf(n)];
        g.fill();
      }
    });
    g.strokeStyle = "#d8b45a";
    g.lineWidth = R * 0.009;
    ORDER.forEach((_, i) => {
      const a = i * STEP - Math.PI / 2 - STEP / 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * IN, Math.sin(a) * IN);
      g.lineTo(Math.cos(a) * OUT, Math.sin(a) * OUT);
      g.stroke();
    });
    ring(g, OUT, "#d8b45a", R * 0.014);
    ring(g, MID, "#d8b45a", R * 0.01);
    g.fillStyle = "#fff";
    g.font = `800 ${Math.round(R * 0.078)}px Heebo, Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    ORDER.forEach((n, i) => {
      g.save();
      g.rotate(i * STEP);
      g.fillText(String(n), 0, -R * 0.675);
      g.restore();
    });
    const gr = g.createRadialGradient(-R * 0.12, -R * 0.15, R * 0.02, 0, 0, IN);
    gr.addColorStop(0, "#c8894a");
    gr.addColorStop(0.5, "#7a4620");
    gr.addColorStop(1, "#2e1608");
    disc(g, IN, gr);
    ring(g, IN, "#d8b45a", R * 0.016);
    g.strokeStyle = "#e9c86e";
    g.lineCap = "round";
    g.lineWidth = R * 0.035;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
      g.stroke();
      g.beginPath();
      g.arc(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3, R * 0.035, 0, TAU);
      g.fillStyle = "#f6dc8a";
      g.fill();
    }
    const hub = g.createRadialGradient(-R * 0.02, -R * 0.03, 0, 0, 0, R * 0.09);
    hub.addColorStop(0, "#fff6d0");
    hub.addColorStop(1, "#a07a2a");
    disc(g, R * 0.09, hub);
    return c;
  }

  function spinEl(ctx, V) {
    if (V.phase === "bet" || !V.spinId) return null;
    if (ctx.spinId !== V.spinId) {
      ctx.spinId = V.spinId;
      ctx.t0 = performance.now() - (V.spinEl || 0) - (Date.now() - (V._recv || Date.now()));
      ctx.sndAt = 0;
      ctx.closedFx = (V.spinEl || 0) > CLOSE;
      ctx.landFx = (V.spinEl || 0) > LAND;
    }
    return performance.now() - ctx.t0;
  }

  function draw(ctx, V) {
    const cv = ctx.cv;
    const g = cv.getContext("2d");
    const R = Math.min(cv.width, cv.height) / 2 - 1;
    if (ctx.bowlR !== R) {
      ctx.bowlR = R;
      ctx.bowl = makeBowl(R);
      ctx.rotor = makeRotor(R);
    }
    g.clearRect(0, 0, cv.width, cv.height);
    g.save();
    g.translate(cv.width / 2, cv.height / 2);
    g.drawImage(ctx.bowl, -R, -R, R * 2, R * 2);
    const el = spinEl(ctx, V);
    let st;
    if (el == null) {
      const n = V.hist[0];
      st = { wa: V.wa, a: n == null ? null : V.wa + pocketA(n), r: POCKET, landed: n != null };
    } else st = spinState(V.wa0, el, V.result);
    g.save();
    g.rotate(st.wa);
    g.drawImage(ctx.rotor, -R, -R, R * 2, R * 2);
    if (V.phase === "done" && V.result != null) {
      const a = pocketA(V.result);
      g.beginPath();
      g.arc(0, 0, R * 0.75, a - STEP / 2, a + STEP / 2);
      g.arc(0, 0, R * 0.47, a + STEP / 2, a - STEP / 2, true);
      g.closePath();
      g.fillStyle = `rgba(255,230,140,${0.35 + Math.sin(performance.now() / 160) * 0.2})`;
      g.fill();
    }
    g.restore();
    if (st.a != null) {
      const x = Math.cos(st.a) * st.r * R;
      const y = Math.sin(st.a) * st.r * R;
      const br = R * 0.036;
      g.beginPath();
      g.arc(x + br * 0.3, y + br * 0.4, br, 0, TAU);
      g.fillStyle = "rgba(0,0,0,.45)";
      g.fill();
      const bg = g.createRadialGradient(x - br * 0.35, y - br * 0.35, br * 0.1, x, y, br);
      bg.addColorStop(0, "#fff");
      bg.addColorStop(0.6, "#e4e4e4");
      bg.addColorStop(1, "#8a8a8a");
      g.beginPath();
      g.arc(x, y, br, 0, TAU);
      g.fillStyle = bg;
      g.fill();
    }
    g.restore();
    /* צלילים ורגעים מיוחדים לפי הזמן — כך זה קורה אצל כולם באותו רגע */
    if (el != null) {
      const now = performance.now();
      if (el < DROP && now - ctx.sndAt > 130) {
        ctx.sndAt = now;
        C.sfx.play("roll");
      } else if (el >= DROP && el < LAND + 300 && now - ctx.sndAt > 70 + ((el - DROP) / (LAND - DROP)) * 220) {
        ctx.sndAt = now;
        C.sfx.play("tick");
      }
      if (!ctx.closedFx && el >= CLOSE) {
        ctx.closedFx = true;
        flash(ctx, "אין יותר הימורים! 🚫");
        C.sfx.play("turn");
      }
      if (!ctx.landFx && el >= LAND) {
        ctx.landFx = true;
        C.sfx.play("chip");
      }
    }
  }
  function flash(ctx, text) {
    const sc = ctx.scene;
    sc.querySelector(".rl-flash")?.remove();
    const f = document.createElement("div");
    f.className = "rl-flash";
    f.textContent = text;
    sc.appendChild(f);
    setTimeout(() => f.remove(), 1700);
  }

  /* ===================== המשחק ===================== */
  C.GAMES.roulette = {
    title: "רולטה",
    icon: "🎡",
    seats: 8,
    blurb: "רולטה אירופאית עם אפס אחד: מספרים, ספליטים, פינות, שורות, אדום/שחור ועוד. לכל שחקן ז'יטונים בצבע משלו.",
    rules: `<ul>
<li>בוחרים ז'יטון למטה ולוחצים על הלוח. כל לחיצה מוסיפה ז'יטון — לכל שחקן <b>צבע משלו</b>.</li>
<li><b>מספר בודד</b> משלם 35:1 · <b>ספליט</b> (על הקו בין 2 מספרים) 17:1 · <b>שורה</b> (בתחתית עמודה, 3 מספרים) 11:1 · <b>פינה</b> (בצומת של 4) 8:1 · <b>שתי שורות</b> (בתחתית, בין עמודות) 5:1.</li>
<li><b>תריסר</b> או <b>טור</b> (2:1) משלמים 2:1 · <b>אדום/שחור, זוגי/פרדי, 1–18/19–36</b> משלמים 1:1.</li>
<li>כשהעכבר על הלוח רואים בדיוק אילו מספרים ההימור מכסה וכמה הוא משלם.</li>
<li>לוחצים <b>🎡 סובבו</b>: הגלגל מתחיל להסתובב ויש עוד כמה שניות להימורים אחרונים — ואז <b>אין יותר הימורים</b>. בשולחן משותף הגלגל מסתובב לבד ${AUTO / 1000} שניות אחרי הז'יטון הראשון.</li>
<li>יצא 0 — כל ההימורים בחוץ (אדום/שחור, תריסרים וכו') מפסידים.</li></ul>`,
    init(S, H) {
      S.phase = "bet";
      S.bets = {};
      S.last = {};
      S.hx = {};
      S.says = {};
      S.hist = [];
      S.result = null;
      S.results = null;
      S.wa = C.rand() * TAU;
      S.wa0 = S.wa;
      H.say("שימו ז'יטונים — ולחצו סובבו 🎡");
    },
    solo(S, H) {
      for (let i = 0; i < 2; i++) H.addBot(BOT_NAMES[i], C.randomLook(), 100);
    },
    status: (V) => (V.phase === "bet" ? "מקבלים הימורים" : "הגלגל מסתובב!"),
    pending: (V, me) => (V.phase === "bet" || V.open ? total(V.bets[me]) : 0),
    atStake: (V, me) => V.phase === "spin" && !V.open && !!V.bets[me],
    onLeave(S, pid) {
      if (S.phase === "bet" || S.open) {
        delete S.bets[pid];
        return true;
      }
      return false;
    },
    view(S, id) {
      return {
        ...S,
        hx: undefined,
        canUndo: !!S.hx[id]?.length,
        spinEl: S.spinAt ? Date.now() - S.spinAt : 0,
        autoLeft: S.autoAt ? S.autoAt - Date.now() : 0,
      };
    },
    act(S, pid, a, H) {
      const p = S.players[pid];
      if (!p) return;
      if (a.a === "go") return void (S.bets[pid] && go(S, H));
      if (!(S.phase === "bet" || (S.phase === "spin" && S.open))) return;
      const mine = S.bets[pid] || {};
      const snap = () => {
        const h = (S.hx[pid] ||= []);
        h.push({ ...mine });
        if (h.length > 40) h.shift();
      };
      const setBets = (nb) => {
        const diff = C.r2(total(nb) - total(mine));
        if (diff > p.stack) return false;
        p.stack = C.r2(p.stack - diff);
        if (Object.keys(nb).length) S.bets[pid] = nb;
        else delete S.bets[pid];
        return true;
      };
      if (a.a === "bet") {
        const b = BETS.get(String(a.k));
        const amt = Math.min(Math.floor(+a.amt), Math.floor(p.stack));
        if (!b || !(amt >= 1)) return;
        snap();
        setBets({ ...mine, [b.k]: (mine[b.k] || 0) + amt });
      } else if (a.a === "undo") {
        const h = S.hx[pid];
        if (h?.length && setBets(h[h.length - 1])) h.pop();
      } else if (a.a === "clear") {
        if (!S.bets[pid]) return;
        snap();
        setBets({});
      } else if (a.a === "rebet") {
        const last = S.last[pid];
        if (!last) return;
        const nb = { ...mine };
        let left = p.stack;
        for (const k in last) {
          const put = Math.min(last[k], Math.floor(left));
          if (put >= 1 && BETS.has(k)) {
            nb[k] = (nb[k] || 0) + put;
            left -= put;
          }
        }
        snap();
        setBets(nb);
      } else if (a.a === "double") {
        if (!S.bets[pid] || total(mine) > p.stack) return;
        snap();
        setBets(Object.fromEntries(Object.entries(mine).map(([k, v]) => [k, v * 2])));
      } else return;
      if (S.phase !== "bet" || S.solo) return;
      if (!Object.keys(S.bets).length) {
        H.clear("auto");
        S.autoAt = 0;
      } else if (!S.autoAt) {
        S.autoAt = Date.now() + AUTO;
        H.timer("auto", AUTO, () => go(S, H));
      }
    },

    mount(ctx) {
      const sc = ctx.scene;
      const cells = [];
      for (let n = 0; n <= 36; n++) {
        const c = cellOf(n);
        cells.push({ cls: colorOf(n), x: c.x, y: c.y, w: c.w, h: c.h, t: n, n, k: "i:" + n });
      }
      for (const b of BETS.values())
        if (b.out) {
          const r = b.hit;
          const t = b.k === "red" || b.k === "black" ? "◆" : b.k[0] === "c" ? "2:1" : b.label;
          cells.push({ cls: "o " + b.k, x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0, t, k: b.k });
        }
      const pc = (v, of) => ((v / of) * 100).toFixed(3) + "%";
      const box = (x, y, w, h) => `left:${pc(x, 14)};top:${pc(y, 5)};width:${pc(w, 14)};height:${pc(h, 5)}`;
      sc.insertAdjacentHTML(
        "beforeend",
        `<div class="felt rl-felt"></div>
<div class="rl-wheel"><canvas></canvas><div class="rl-big"></div></div>
<div class="rl-hist"></div>
<div class="rl-board">
  ${cells.map((c) => `<div class="rl-cell ${c.cls}" data-k="${c.k}" style="${box(c.x, c.y, c.w, c.h)}"><span>${esc(String(c.t))}</span></div>`).join("")}
  ${[...BETS.values()]
    .map((b) => `<button class="rl-hot z${b.z}" data-k="${b.k}" aria-label="${esc(b.label)}" style="${box(b.hit.x0, b.hit.y0, b.hit.x1 - b.hit.x0, b.hit.y1 - b.hit.y0)}"></button>`)
    .join("")}
  <div class="rl-chips"></div>
  <div class="rl-tip"></div>
</div>`,
      );
      ctx.cv = $(".rl-wheel canvas", sc);
      ctx.board = $(".rl-board", sc);
      ctx.chipsEl = $(".rl-chips", sc);
      ctx.cellEls = new Map([...sc.querySelectorAll(".rl-cell")].map((el) => [el.dataset.k, el]));
      ctx.amt = 5;
      const hover = (k) => {
        ctx.board.querySelectorAll(".rl-cell.hov").forEach((el) => el.classList.remove("hov"));
        const b = k && BETS.get(k);
        const tip = $(".rl-tip", ctx.board);
        if (!b) return (tip.textContent = "");
        for (const n of b.nums) ctx.cellEls.get("i:" + n)?.classList.add("hov");
        if (b.out) ctx.cellEls.get(b.k)?.classList.add("hov");
        const mine = ctx.sess.V?.bets[ctx.me]?.[k];
        tip.textContent = `${b.label} · משלם ${b.pay}:1${mine ? ` · שמת ${C.money(mine)}` : ""}`;
      };
      ctx.board.addEventListener("pointerover", (e) => hover(e.target.closest(".rl-hot")?.dataset.k));
      ctx.board.addEventListener("pointerleave", () => hover(null));
      ctx.board.addEventListener("click", (e) => {
        const h = e.target.closest(".rl-hot");
        if (!h || ctx.board.classList.contains("closed")) return;
        if (!(ctx.amt > 0)) return C.toast("אין לך מספיק כסף על השולחן — לחצו + למעלה");
        C.sfx.play("chip");
        ctx.send({ a: "bet", k: h.dataset.k, amt: ctx.amt });
        hover(h.dataset.k);
      });

      ctx.controls.innerHTML = `
<div class="ctl c-bet"><div class="ctl-info"></div><div class="chipbar"></div>
  <div class="ctl-btns"><button class="btn ghost undo">↶ בטל</button><button class="btn ghost clr">נקה</button><button class="btn ghost rebet">↺ כמו קודם</button><button class="btn ghost dbl">×2</button><button class="btn gold go">🎡 סובבו!</button></div></div>
<div class="ctl c-wait"><span class="wait-txt"></span></div>`;
      const c = ctx.controls;
      T.chipBar($(".chipbar", c), (v) => {
        ctx.amt = v;
        ctx.sess.render(ctx.sess.V, true);
      });
      $(".undo", c).onclick = () => ctx.send({ a: "undo" });
      $(".clr", c).onclick = () => ctx.send({ a: "clear" });
      $(".rebet", c).onclick = () => ctx.send({ a: "rebet" });
      $(".dbl", c).onclick = () => ctx.send({ a: "double" });
      $(".go", c).onclick = () => ctx.send({ a: "go" });

      const loop = () => {
        if (!ctx.root.isConnected) return;
        const V = ctx.sess.V;
        if (V) {
          const cv = ctx.cv;
          const r = cv.getBoundingClientRect();
          const s = T.scale || 1;
          const dpr = Math.min(2, devicePixelRatio || 1);
          const w = Math.round((r.width / s) * dpr);
          if (w > 10 && cv.width !== w) cv.width = cv.height = w;
          draw(ctx, V);
          const cd = $(".rl-cd", ctx.controls);
          if (cd) {
            let t = "";
            if (V.phase === "bet" && V.autoLeft > 0) {
              const left = Math.ceil((V.autoLeft - (Date.now() - V._recv)) / 1000);
              if (left > 0) t = `⏱ הגלגל יסתובב בעוד ${left} שנ׳`;
            } else if (V.phase === "spin" && V.open) {
              const left = Math.ceil((CLOSE - (performance.now() - ctx.t0)) / 1000);
              t = `⏳ הימורים אחרונים! ${Math.max(0, left)}`;
            }
            if (cd.textContent !== t) cd.textContent = t;
          }
        }
        ctx.raf = requestAnimationFrame(loop);
      };
      ctx.raf = requestAnimationFrame(loop);
    },
    unmount(ctx) {
      cancelAnimationFrame(ctx.raf);
    },
    render(ctx, V) {
      const sc = ctx.scene;
      const me = ctx.me;
      const pos = ctx.portrait ? POS_P : POS_L;
      const done = V.phase === "done";
      for (let i = 0; i < 8; i++) {
        const el = T.seat(sc, i, pos[i]);
        el.style.setProperty("--pc", COLORS[i]);
        const id = V.seats[i];
        const p = id && V.players[id];
        T.fillSeat(el, p, { me: id === me, say: V.says?.[id]?.t, sayKey: String(V.says?.[id]?.k || "") });
        let rb = $(".rl-bet", el);
        if (!rb) {
          el.insertAdjacentHTML("beforeend", `<div class="rl-bet"></div>`);
          rb = $(".rl-bet", el);
        }
        const tot = id ? total(V.bets[id]) : 0;
        rb.textContent = tot ? C.money(tot) : "";
        el.classList.toggle("won", done && V.results?.[id] > 0);
        el.classList.toggle("lost", done && V.results?.[id] < 0);
      }

      /* ז'יטונים על הלוח — כל שחקן בצבע שלו */
      const have = new Map([...ctx.chipsEl.querySelectorAll(".rl-chip")].map((el) => [el.dataset.id, el]));
      const byKey = {};
      for (const id of V.seats) if (id && V.bets[id]) for (const k in V.bets[id]) (byKey[k] ||= []).push(id);
      for (const k in byKey) {
        const b = BETS.get(k);
        if (!b) continue;
        byKey[k].forEach((id, j) => {
          const amt = V.bets[id][k];
          const key = id + "|" + k;
          let el = have.get(key);
          if (el) have.delete(key);
          else {
            el = document.createElement("div");
            el.className = "rl-chip";
            el.dataset.id = key;
            el.style.left = ((b.x / 14) * 100).toFixed(3) + "%";
            el.style.top = ((b.y / 5) * 100).toFixed(3) + "%";
            ctx.chipsEl.appendChild(el);
            if (id !== me && ctx.ready) C.sfx.play("chip");
          }
          el.style.setProperty("--c", colorFor(V, id));
          el.style.setProperty("--dx", j * 5 + "px");
          el.style.setProperty("--dy", -j * 5 + "px");
          const res = done ? (b.nums.includes(V.result) ? "win" : "lose") : "";
          const sig = amt + res;
          if (el.dataset.sig !== sig) {
            if (el.dataset.sig && !res) {
              el.classList.remove("bump");
              void el.offsetWidth;
              el.classList.add("bump");
            }
            el.dataset.sig = sig;
            el.classList.toggle("win", res === "win");
            el.classList.toggle("lose", res === "lose");
            el.innerHTML = `<span>${short(amt)}</span>${res === "win" ? `<i>+${C.money(amt * b.pay)}</i>` : ""}`;
          }
        });
      }
      have.forEach((el) => el.remove());
      ctx.ready = true;

      /* המספר הזוכה: "בובה" על הלוח, הדגשה, ומספר גדול במרכז הגלגל */
      const wk = done ? String(V.result) : "";
      if (ctx.wk !== wk) {
        ctx.wk = wk;
        ctx.board.querySelectorAll(".rl-cell.win").forEach((el) => el.classList.remove("win"));
        ctx.chipsEl.querySelector(".rl-dolly")?.remove();
        const big = $(".rl-big", sc);
        big.className = "rl-big";
        if (done) {
          const n = V.result;
          for (const b of BETS.values()) if ((b.out || b.nums.length === 1) && b.nums.includes(n)) ctx.cellEls.get(b.k)?.classList.add("win");
          const c = cellOf(n);
          ctx.chipsEl.insertAdjacentHTML(
            "beforeend",
            `<div class="rl-dolly" style="left:${(((c.x + c.w / 2) / 14) * 100).toFixed(3)}%;top:${(((c.y + c.h / 2) / 5) * 100).toFixed(3)}%"></div>`,
          );
          big.innerHTML = `${n}<small>${describe(n)}</small>`;
          void big.offsetWidth;
          big.classList.add(colorOf(n), "show");
        }
      }
      $(".rl-hist", sc).innerHTML = V.hist.length
        ? V.hist.map((n) => `<i class="${colorOf(n)}">${n}</i>`).join("")
        : `<small>עוד לא סובבו היום</small>`;

      /* פקדים */
      const c = ctx.controls;
      const open = V.phase === "bet" || (V.phase === "spin" && V.open);
      c.dataset.mode = open ? "bet" : "wait";
      ctx.board.classList.toggle("closed", !open);
      if (V.phase === "spin" && ctx.flashSpin !== V.spinId) {
        ctx.flashSpin = V.spinId;
        if ((V.spinEl || 0) < 1500) flash(ctx, "🎡 הגלגל מסתובב!");
      }
      const mine = V.bets[me] || {};
      const tot = total(mine);
      if (!open) {
        const r = V.results?.[me];
        $(".wait-txt", c).textContent = done
          ? `יצא ${V.result} — ${describe(V.result)}${r != null ? (r > 0 ? ` · ניצחת ${C.money(r)}! 🎉` : r < 0 ? ` · הפסדת ${C.money(-r)}` : " · יצאת באפס") : ""}`
          : tot
            ? `אין יותר הימורים — ${C.money(tot)} שלך על הלוח 🤞`
            : "אין יותר הימורים — הכדור מתגלגל…";
        return;
      }
      const P = V.players[me];
      const stack = Math.floor(P?.stack || 0);
      if (ctx.amt > stack) ctx.amt = stack >= 1 ? Math.max(...T.CHIPS.filter((v) => v <= stack)) : 0;
      else if (!ctx.amt && stack >= 1) ctx.amt = 1;
      const amt = ctx.amt;
      c.querySelectorAll(".chip-btn").forEach((b) => b.classList.toggle("sel", +b.dataset.v === ctx.amt));
      $(".ctl-info", c).innerHTML = `<i class="rl-me" style="--c:${colorFor(V, me)}"></i> הז'יטונים שלך · צ'יפ <b>${C.money(amt)}</b>${
        tot ? ` · על הלוח <b>${C.money(tot)}</b>` : ` · <small>לחצו על מספר, קו או פינה</small>`
      } <span class="rl-cd"></span>`;
      $(".undo", c).hidden = !V.canUndo;
      $(".clr", c).hidden = !tot;
      $(".dbl", c).hidden = !tot;
      $(".dbl", c).disabled = tot > (P?.stack || 0);
      $(".rebet", c).hidden = !!tot || !V.last[me];
      $(".go", c).hidden = V.phase !== "bet";
      $(".go", c).disabled = !tot;
    },
  };
})();
