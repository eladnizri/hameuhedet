/* ===================== מירוץ גולות =====================
   פיזיקה אמיתית ודטרמיניסטית: גולות מתנגשות, עוקפות, נתקעות בחול,
   מקבלות דחיפה ממשטחי מהירות ונהדפות מעמודים. הכל מחושב מתוך "זרע"
   אחד, ובלי פונקציות טריגונומטריות — כך שכל מכשיר מקבל בדיוק את אותו
   מירוץ. כל אזורי החול/דחיפה/עמודים מצוירים על המסלול, רואים מה קרה. */
(function () {
  const C = window.Casino;
  const { $, esc } = C;
  const T = C.T;

  const MARBLES = [
    { n: "הבוערת", c: "#e53935" },
    { n: "הקרח", c: "#1e88e5" },
    { n: "הרעל", c: "#43a047" },
    { n: "הזהב", c: "#fdd835" },
    { n: "המלכה", c: "#8e24aa" },
    { n: "הלהבה", c: "#fb8c00" },
  ];
  const N = MARBLES.length;
  const PAY = 5.5;
  const FPS = 60;
  const V0 = 1 / 780;
  /* גודל גולה ביחידות המסלול: לאורך (s) ולרוחב (d בין 1- ל-1) */
  const DS = 0.0068;
  const DD = 0.3;
  /* מקטעי המסלול — אחוזים קבועים, כדי שהפיזיקה לא תלויה בגודל המסך */
  const SEG = [
    { t: "line", a: 0, b: 0.3, row: 0 },
    { t: "arc", a: 0.3, b: 0.37, inner: -1 },
    { t: "line", a: 0.37, b: 0.63, row: 1 },
    { t: "arc", a: 0.63, b: 0.7, inner: 1 },
    { t: "line", a: 0.7, b: 1, row: 2 },
  ];
  const ZONES = [
    { k: "boost", a: 0.12, b: 0.15, d0: -0.9, d1: -0.1 },
    { k: "sand", a: 0.21, b: 0.25, d0: 0, d1: 0.9 },
    { k: "boost", a: 0.44, b: 0.47, d0: 0.1, d1: 0.9 },
    { k: "sand", a: 0.52, b: 0.56, d0: -0.9, d1: -0.05 },
    { k: "boost", a: 0.78, b: 0.81, d0: -0.5, d1: 0.5 },
    { k: "sand", a: 0.88, b: 0.91, d0: 0.2, d1: 0.9 },
    { k: "sand", a: 0.88, b: 0.91, d0: -0.9, d1: -0.45 },
  ];
  const PEGS = [
    [0.08, 0.35],
    [0.18, -0.5],
    [0.33, 0],
    [0.4, 0.55],
    [0.59, -0.3],
    [0.67, 0.4],
    [0.74, -0.6],
    [0.95, 0],
  ];
  const curveAt = (s) => SEG.find((g) => g.t === "arc" && s >= g.a && s < g.b);

  /* ===================== הסימולציה ===================== */
  const simCache = new Map();
  function simulate(seed) {
    if (simCache.has(seed)) return simCache.get(seed);
    const R = C.rng(seed);
    const lanes = C.shuffle(
      MARBLES.map((_, i) => i),
      R,
    );
    const M = MARBLES.map((_, i) => ({
      s: 0,
      d: -0.75 + (lanes.indexOf(i) * 1.5) / (N - 1),
      v: 0,
      vd: 0,
      n: 0,
      base: 1 + (R() - 0.5) * 0.02,
      fin: -1,
    }));
    const frames = [];
    const ev = [];
    const finish = [];
    let leader = -1;
    let stretch = false;
    let close = false;
    let end = Infinity;
    for (let f = 0; f < 3000 && f < end; f++) {
      const lead = Math.max(...M.map((m) => m.s));
      let boost = 0;
      let bump = 0;
      for (let i = 0; i < N; i++) {
        const m = M[i];
        if (m.fin >= 0) continue;
        m.n += (R() - 0.5) * 0.03;
        m.n *= 0.985;
        let target = V0 * m.base * (1 + m.n * 0.6);
        target *= 1 + Math.min(0.1, (lead - m.s) * 1.4);
        for (const z of ZONES)
          if (m.s >= z.a && m.s < z.b && m.d >= z.d0 && m.d <= z.d1) {
            if (z.k === "boost") (target *= 1.6), (boost |= 1 << i);
            else target *= 0.5;
          }
        const cu = curveAt(m.s);
        if (cu) {
          target *= 1 + cu.inner * m.d * 0.12;
          const sp = m.v / V0;
          m.vd -= cu.inner * sp * sp * 0.0009;
        }
        m.v += (target - m.v) * (f < 30 ? 0.12 : 0.05);
        m.vd += (R() - 0.5) * 0.006;
        for (let j = 0; j < N; j++) {
          if (j === i || M[j].fin >= 0) continue;
          const ahead = M[j].s - m.s;
          if (ahead > 0 && ahead < 0.02 && Math.abs(M[j].d - m.d) < 0.35) m.vd += (m.d >= M[j].d ? 1 : -1) * 0.0025;
        }
        m.vd *= 0.94;
        m.d += m.vd;
        if (m.d > 0.85 || m.d < -0.85) {
          m.d = m.d > 0 ? 0.85 : -0.85;
          m.vd = -m.vd * 0.5;
        }
      }
      /* התנגשויות בין גולות */
      for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++) {
          const a = M[i];
          const b = M[j];
          if (a.fin >= 0 || b.fin >= 0) continue;
          const dx = (a.s - b.s) / DS;
          const dy = (a.d - b.d) / DD;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= 1 || dist === 0) continue;
          const o = (1 - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.s += nx * o * DS;
          b.s -= nx * o * DS;
          a.d += ny * o * DD;
          b.d -= ny * o * DD;
          const back = a.s < b.s ? a : b;
          const front = back === a ? b : a;
          const dv = back.v - front.v;
          if (dv > 0) {
            const k = Math.abs(nx) * 0.5;
            back.v -= dv * k;
            front.v += dv * k;
          }
          a.vd += ny * 0.012;
          b.vd -= ny * 0.012;
          bump |= (1 << i) | (1 << j);
        }
      /* עמודים */
      for (const m of M) {
        if (m.fin >= 0) continue;
        for (const [ps, pd] of PEGS) {
          const dx = (m.s - ps) / (DS * 0.9);
          const dy = (m.d - pd) / (DD * 0.6);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= 1 || dist === 0) continue;
          m.s += (dx / dist) * (1 - dist) * DS * 0.9;
          m.d += (dy / dist) * (1 - dist) * DD * 0.6;
          m.vd += (dy / dist) * 0.03;
          m.v *= 0.85;
          bump |= 1 << M.indexOf(m);
        }
      }
      /* תנועה וקו סיום */
      const crossed = [];
      for (let i = 0; i < N; i++) {
        const m = M[i];
        if (m.fin >= 0) continue;
        const before = m.s;
        m.s += m.v;
        if (m.s >= 1) {
          crossed.push([i, f + (1 - before) / (m.s - before || 1)]);
          m.s = 1;
          m.fin = f;
        }
      }
      crossed.sort((x, y) => x[1] - y[1]).forEach(([i, t]) => finish.push({ i, t }));
      if (finish.length && end === Infinity) end = f + 50;
      frames.push({ s: M.map((m) => m.s), d: M.map((m) => m.d), b: boost, k: bump });
      /* אירועים לפרשן */
      const order = M.map((_, i) => i).sort((x, y) => M[y].s - M[x].s);
      if (order[0] !== leader) {
        if (f > 70 && !finish.length) ev.push({ f, t: `${MARBLES[order[0]].n} עוקפת ועולה למקום הראשון! 🔥` });
        leader = order[0];
      }
      if (!stretch && M[order[0]].s > 0.84) {
        stretch = true;
        ev.push({ f, t: "ישורת אחרונה!! 🏁" });
      }
      if (!close && M[order[0]].s > 0.9 && M[order[0]].s - M[order[1]].s < 0.012 && !finish.length) {
        close = true;
        ev.push({ f, t: `צמוד!! ${MARBLES[order[0]].n} מול ${MARBLES[order[1]].n} 😱` });
      }
    }
    /* סדר סופי: מי שסיימה לפי זמן, השאר לפי מרחק */
    const order = finish.map((x) => x.i);
    const lastS = frames[frames.length - 1].s;
    MARBLES.map((_, i) => i)
      .filter((i) => !order.includes(i))
      .sort((a, b) => lastS[b] - lastS[a])
      .forEach((i) => order.push(i));
    const photo = finish.length > 1 && finish[1].t - finish[0].t < 2;
    /* ציר זמן: האטה דרמטית כשהישורת האחרונה צמודה, ועצירה לצילום פוטו־פיניש */
    const tl = [];
    let t = 0;
    let rate = 1;
    const winF = Math.floor(finish[0]?.t ?? frames.length - 1);
    frames.forEach((fr, i) => {
      const s = [...fr.s].sort((a, b) => b - a);
      const want = s[0] > 0.86 && s[0] - s[1] < 0.02 && i <= winF + 10 ? 0.4 : 1;
      rate += (want - rate) * 0.08;
      t += 1000 / FPS / rate;
      if (photo && i === winF + 1) t += 1500;
      tl.push(t);
    });
    const out = { frames, tl, order, winner: order[0], ms: t, photo, winF, ev };
    simCache.set(seed, out);
    if (simCache.size > 6) simCache.delete(simCache.keys().next().value);
    return out;
  }
  const frameAt = (sim, el) => {
    if (el < 0) return -1;
    let lo = 0, hi = sim.tl.length - 1;
    if (el >= sim.tl[hi]) return hi;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sim.tl[mid] < el) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  function go(S, H) {
    S.phase = "race";
    S.round++;
    S.results = null;
    S.why = null;
    S.seed = Math.floor(C.rand() * 2 ** 31);
    S.raceAt = Date.now() + 1800;
    const sim = simulate(S.seed);
    H.say("3… 2… 1… יוצאים לדרך! 🏁");
    H.push();
    H.after(1800 + sim.ms + 700, () => {
      const w = sim.winner;
      S.winner = w;
      S.order = sim.order;
      S.results = {};
      S.why = {};
      for (const [id, bets] of Object.entries(S.bets)) {
        const p = S.players[id];
        if (!p || p.left) continue;
        let staked = 0;
        for (const k in bets) staked += bets[k];
        const pay = C.r2((bets[w] || 0) * PAY);
        p.stack = C.r2(p.stack + pay);
        S.results[id] = C.r2(pay - staked);
        const mine = Object.keys(bets).map(Number);
        S.why[id] = bets[w]
          ? `${MARBLES[w].n} ניצחה ומשלמת ×${PAY}${sim.photo ? " — בפוטו־פיניש!" : ""}`
          : `ניצחה ${MARBLES[w].n}. ${mine.map((i) => `${MARBLES[i].n} סיימה במקום ${sim.order.indexOf(i) + 1}`).join(", ")}`;
        S.last[id] = { ...bets };
        H.log(`${p.name}: ${pay - staked >= 0 ? "+" : ""}${C.money(pay - staked)}`);
      }
      S.hist.unshift(w);
      S.hist.length = Math.min(S.hist.length, 10);
      S.phase = "done";
      H.say(`הגולה ${MARBLES[w].n} ניצחה!${sim.photo ? " (פוטו־פיניש 📸)" : ""} 🏆`);
      H.push();
      H.after(3500, () => {
        S.phase = "bet";
        S.bets = {};
        S.results = null;
        S.seed = null;
        S.winner = null;
        S.order = null;
        H.sweep();
        H.say("על איזו גולה אתם שמים?");
        H.push();
      });
    });
  }

  /* ===================== ציור ===================== */
  function buildTrack(W, H) {
    const rows = [H * 0.2, H * 0.5, H * 0.78];
    const r = (rows[1] - rows[0]) / 2;
    const r2 = (rows[2] - rows[1]) / 2;
    const m = r * 1.75 + 14;
    const geo = [
      { t: "line", p0: [W - m, rows[0]], p1: [m, rows[0]] },
      { t: "arc", c: [m, rows[0] + r], r, a0: -Math.PI / 2, a1: -Math.PI * 1.5 },
      { t: "line", p0: [m, rows[1]], p1: [W - m, rows[1]] },
      { t: "arc", c: [W - m, rows[1] + r2], r: r2, a0: -Math.PI / 2, a1: Math.PI / 2 },
      { t: "line", p0: [W - m, rows[2]], p1: [m, rows[2]] },
    ];
    return { W, H, geo, half: r * 0.72 };
  }
  function at(tr, s, d = 0) {
    s = C.clamp(s, 0, 1);
    let k = SEG.findIndex((g) => s < g.b);
    if (k < 0) k = SEG.length - 1;
    const sg = SEG[k];
    const g = tr.geo[k];
    const u = (s - sg.a) / (sg.b - sg.a);
    let x, y, tx, ty;
    if (g.t === "line") {
      x = g.p0[0] + (g.p1[0] - g.p0[0]) * u;
      y = g.p0[1] + (g.p1[1] - g.p0[1]) * u;
      const l = Math.hypot(g.p1[0] - g.p0[0], g.p1[1] - g.p0[1]) || 1;
      tx = (g.p1[0] - g.p0[0]) / l;
      ty = (g.p1[1] - g.p0[1]) / l;
    } else {
      const a = g.a0 + (g.a1 - g.a0) * u;
      const sgn = Math.sign(g.a1 - g.a0);
      x = g.c[0] + Math.cos(a) * g.r;
      y = g.c[1] + Math.sin(a) * g.r;
      tx = -Math.sin(a) * sgn;
      ty = Math.cos(a) * sgn;
    }
    const nx = -ty;
    const ny = tx;
    return { x: x + nx * d * tr.half, y: y + ny * d * tr.half, tx, ty, nx, ny };
  }
  function band(b, tr, a, z, d0, d1) {
    b.beginPath();
    const n = Math.max(8, Math.ceil((z - a) * 500));
    for (let i = 0; i <= n; i++) {
      const p = at(tr, a + ((z - a) * i) / n, d0);
      i ? b.lineTo(p.x, p.y) : b.moveTo(p.x, p.y);
    }
    for (let i = n; i >= 0; i--) {
      const p = at(tr, a + ((z - a) * i) / n, d1);
      b.lineTo(p.x, p.y);
    }
    b.closePath();
  }
  function drawBg(tr) {
    const { W, H } = tr;
    const bg = document.createElement("canvas");
    bg.width = W;
    bg.height = H;
    const b = bg.getContext("2d");
    const wood = b.createLinearGradient(0, 0, W, H);
    wood.addColorStop(0, "#3a2414");
    wood.addColorStop(1, "#24160c");
    b.fillStyle = wood;
    b.fillRect(0, 0, W, H);
    const rnd = C.rng(7);
    for (let i = 0; i < 70; i++) {
      b.strokeStyle = `rgba(255,220,170,${0.02 + rnd() * 0.03})`;
      b.beginPath();
      const y = rnd() * H;
      b.moveTo(0, y);
      b.bezierCurveTo(W / 3, y + 8, (2 * W) / 3, y - 8, W, y + 4);
      b.stroke();
    }
    /* מעקות זהב + בטון כהה */
    band(b, tr, 0, 1, -1.22, 1.22);
    b.fillStyle = "#c9a43f";
    b.fill();
    band(b, tr, 0, 1, -1.12, 1.12);
    b.fillStyle = "#1b2a3a";
    b.fill();
    for (let k = -2; k <= 2; k++) {
      if (!k) continue;
      b.strokeStyle = "rgba(255,255,255,.07)";
      b.setLineDash([6, 8]);
      b.beginPath();
      for (let i = 0; i <= 200; i++) {
        const p = at(tr, i / 200, k * 0.36);
        i ? b.lineTo(p.x, p.y) : b.moveTo(p.x, p.y);
      }
      b.stroke();
    }
    b.setLineDash([]);
    /* אזורי חול ודחיפה — מה שרואים על המסלול זה מה שמשפיע */
    for (const z of ZONES) {
      band(b, tr, z.a, z.b, z.d0, z.d1);
      if (z.k === "sand") {
        b.fillStyle = "#b8894a";
        b.fill();
        b.fillStyle = "rgba(90,60,20,.5)";
        for (let i = 0; i < 40; i++) {
          const p = at(tr, z.a + rnd() * (z.b - z.a), z.d0 + rnd() * (z.d1 - z.d0));
          b.fillRect(p.x, p.y, 2, 2);
        }
      } else {
        b.fillStyle = "rgba(0,229,255,.28)";
        b.fill();
        b.strokeStyle = "#7ff6ff";
        b.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const s = z.a + ((z.b - z.a) * (i + 0.5)) / 3;
          const mid = (z.d0 + z.d1) / 2;
          const p = at(tr, s + 0.006, mid);
          const l = at(tr, s - 0.004, z.d0 + 0.1);
          const r = at(tr, s - 0.004, z.d1 - 0.1);
          b.beginPath();
          b.moveTo(l.x, l.y);
          b.lineTo(p.x, p.y);
          b.lineTo(r.x, r.y);
          b.stroke();
        }
      }
    }
    /* עמודים */
    for (const [s, d] of PEGS) {
      const p = at(tr, s, d);
      const rr = tr.half * 0.14;
      b.fillStyle = "rgba(0,0,0,.45)";
      b.beginPath();
      b.arc(p.x + 2, p.y + 3, rr, 0, 7);
      b.fill();
      const gr = b.createRadialGradient(p.x - rr / 3, p.y - rr / 3, 1, p.x, p.y, rr);
      gr.addColorStop(0, "#fff3b0");
      gr.addColorStop(1, "#a07a1c");
      b.fillStyle = gr;
      b.beginPath();
      b.arc(p.x, p.y, rr, 0, 7);
      b.fill();
    }
    /* זינוק וסיום */
    const chk = (s) => {
      const n = 8;
      for (let k = 0; k < n; k++)
        for (let j = 0; j < 2; j++) {
          band(b, tr, s + j * 0.004, s + (j + 1) * 0.004, -1.12 + (k * 2.24) / n, -1.12 + ((k + 1) * 2.24) / n);
          b.fillStyle = (k + j) % 2 ? "#111" : "#fff";
          b.fill();
        }
    };
    chk(0.004);
    chk(0.992);
    b.font = `900 ${Math.round(H * 0.045)}px Heebo, sans-serif`;
    b.fillStyle = "#e6b647";
    b.textAlign = "center";
    const s0 = at(tr, 0.02, 0);
    b.fillText("זינוק ←", s0.x, s0.y - tr.half * 1.45);
    const e = at(tr, 1, 0);
    b.textAlign = "right";
    b.textBaseline = "middle";
    b.fillText("🏁", e.x - tr.half * 1.35, e.y);
    b.textBaseline = "alphabetic";
    return bg;
  }

  const smooth = (a, b, x) => {
    const t = C.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  function draw(ctx, V) {
    const cv = ctx.raceCanvas;
    const g = cv.getContext("2d");
    const W = cv.width;
    const H = cv.height;
    if (!ctx.track || ctx.track.W !== W || ctx.track.H !== H) {
      ctx.track = buildTrack(W, H);
      ctx.bg = drawBg(ctx.track);
    }
    const tr = ctx.track;
    const now = performance.now();
    let sim = null;
    let idx = -1;
    let el = 0;
    if (V.seed != null && (V.phase === "race" || V.phase === "done")) {
      sim = simulate(V.seed);
      el = V.phase === "done" ? Infinity : now - ctx.raceT0;
      idx = frameAt(sim, el);
      if (el < 0) {
        const n = Math.ceil(-el / 600);
        if (n !== ctx.cd) {
          ctx.cd = n;
          if (n <= 3) C.sfx.play("tick");
        }
      }
    }
    const fr = sim && idx >= 0 ? sim.frames[idx] : null;
    const order = fr ? MARBLES.map((_, i) => i).sort((a, b) => fr.s[b] - fr.s[a]) : null;
    /* מצלמה: בישורת האחרונה מתקרבים למובילות */
    let zoom = 1;
    let fx = W / 2;
    let fy = H / 2;
    if (fr && V.phase === "race") {
      const k = smooth(0.8, 0.93, fr.s[order[0]]);
      const p1 = at(tr, fr.s[order[0]], fr.d[order[0]]);
      const p2 = at(tr, fr.s[order[1]], fr.d[order[1]]);
      zoom = 1 + 0.9 * k;
      fx = W / 2 + ((p1.x + p2.x) / 2 - W / 2) * k;
      fy = H / 2 + ((p1.y + p2.y) / 2 - H / 2) * k;
      fx = C.clamp(fx, W / 2 / zoom, W - W / 2 / zoom);
      fy = C.clamp(fy, H / 2 / zoom, H - H / 2 / zoom);
    }
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(zoom, zoom);
    g.translate(-fx, -fy);
    g.drawImage(ctx.bg, 0, 0);
    const rad = tr.half * 0.2;
    const t = now / 1000;
    MARBLES.forEach((m, i) => {
      const s = fr ? fr.s[i] : 0.012;
      const d = fr ? fr.d[i] : sim ? 0 : -0.75 + (i * 1.5) / (N - 1);
      const p = at(tr, s + (fr ? 0 : 0.008), d + (fr ? 0 : Math.sin(t * 2 + i) * 0.02));
      if (fr && fr.b & (1 << i)) {
        for (let k = 1; k <= 4; k++) {
          const q = at(tr, s - k * 0.004, d);
          g.fillStyle = `rgba(127,246,255,${0.35 - k * 0.07})`;
          g.beginPath();
          g.arc(q.x, q.y, rad * (1 - k * 0.12), 0, 7);
          g.fill();
        }
      }
      g.fillStyle = "rgba(0,0,0,.45)";
      g.beginPath();
      g.ellipse(p.x + 2, p.y + 3, rad, rad * 0.8, 0, 0, 7);
      g.fill();
      const gr = g.createRadialGradient(p.x - rad * 0.35, p.y - rad * 0.4, rad * 0.1, p.x, p.y, rad);
      gr.addColorStop(0, "#fff");
      gr.addColorStop(0.25, m.c);
      gr.addColorStop(1, C.shade(m.c, -0.55));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(p.x, p.y, rad, 0, 7);
      g.fill();
      const rot = s * 900;
      g.strokeStyle = "rgba(255,255,255,.4)";
      g.lineWidth = rad * 0.22;
      g.beginPath();
      g.arc(p.x, p.y, rad * 0.6, rot, rot + 1.6);
      g.stroke();
      if (fr && fr.k & (1 << i)) {
        g.strokeStyle = "rgba(255,240,180,.85)";
        g.lineWidth = 1.5;
        for (let k = 0; k < 4; k++) {
          const a = k * 1.6 + t * 9;
          g.beginPath();
          g.moveTo(p.x + Math.cos(a) * rad * 1.2, p.y + Math.sin(a) * rad * 1.2);
          g.lineTo(p.x + Math.cos(a) * rad * 1.7, p.y + Math.sin(a) * rad * 1.7);
          g.stroke();
        }
      }
      if (order && order[0] === i) {
        g.font = `${Math.round(rad * 1.5)}px sans-serif`;
        g.textAlign = "center";
        g.fillText("👑", p.x, p.y - rad * 1.3);
      }
      if (V.phase === "done" && V.winner === i) {
        g.strokeStyle = "#ffe17a";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(p.x, p.y, rad + 5 + Math.sin(t * 6) * 2, 0, 7);
        g.stroke();
      }
    });
    g.restore();

    /* פס התקדמות — רואים מיד מי מובילה ובכמה */
    const by = H - Math.max(16, H * 0.06);
    const bx0 = W * 0.06;
    const bx1 = W * 0.94;
    g.fillStyle = "rgba(0,0,0,.6)";
    g.fillRect(bx0 - 8, by - 9, bx1 - bx0 + 16, 18);
    g.fillStyle = "#fff";
    g.fillRect(bx0, by - 1, 3, 2);
    g.fillStyle = "#e6b647";
    g.fillRect(bx0, by - 7, 3, 14);
    MARBLES.forEach((m, i) => {
      const s = fr ? fr.s[i] : 0;
      const x = bx1 - (bx1 - bx0) * s;
      g.fillStyle = m.c;
      g.beginPath();
      g.arc(x, by + (i - 2.5) * 1.2, 6, 0, 7);
      g.fill();
    });
    /* דירוג חי */
    if (order) {
      g.save();
      g.fillStyle = "rgba(0,0,0,.6)";
      g.fillRect(W - 46, 8, 38, 14 + order.length * 18);
      order.forEach((i, k) => {
        g.fillStyle = MARBLES[i].c;
        g.beginPath();
        g.arc(W - 20, 24 + k * 18, 6.5, 0, 7);
        g.fill();
        g.fillStyle = "#fff";
        g.font = "700 12px Heebo, sans-serif";
        g.textAlign = "center";
        g.fillText(String(k + 1), W - 37, 28 + k * 18);
      });
      g.restore();
    }
    /* פרשן: אירועי המירוץ מופיעים בבועה של הדילר בזמן הנכון */
    if (sim && V.phase === "race" && idx >= 0) {
      if (ctx.evSeed !== V.seed) (ctx.evSeed = V.seed), (ctx.evI = 0);
      while (ctx.evI < sim.ev.length && sim.ev[ctx.evI].f <= idx) {
        const b = $(".dealer-say", ctx.root);
        b.textContent = sim.ev[ctx.evI].t;
        b.classList.remove("pop");
        void b.offsetWidth;
        b.classList.add("pop");
        ctx.evI++;
      }
      if (idx !== ctx.lastIdx) {
        if (idx % 7 === 0) C.sfx.play("roll");
        if (fr.k && idx - (ctx.lastBump || 0) > 10) (ctx.lastBump = idx), C.sfx.play("tick");
        ctx.lastIdx = idx;
      }
    }
    const center = (txt, size, color) => {
      g.fillStyle = color;
      g.font = `900 ${Math.round(size)}px Heebo, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 6;
      g.strokeStyle = "rgba(0,0,0,.7)";
      g.strokeText(txt, W / 2, H / 2);
      g.fillText(txt, W / 2, H / 2);
      g.textBaseline = "alphabetic";
    };
    if (V.phase === "race" && sim && el < 0) {
      g.fillStyle = "rgba(0,0,0,.4)";
      g.fillRect(0, 0, W, H);
      center(String(Math.min(3, ctx.cd || 3)), H * 0.3, "#ffe17a");
    }
    if (sim && sim.photo && V.phase === "race" && idx >= sim.winF && idx <= sim.winF + 2) {
      g.fillStyle = "rgba(255,255,255,.18)";
      g.fillRect(0, 0, W, H);
      center("📸 פוטו־פיניש!", H * 0.13, "#fff");
    }
    if (sim && V.phase === "race" && idx >= 0 && fr) {
      const ls = fr.s[order[0]];
      if (ls > 0.84 && ls < 0.9) center("ישורת אחרונה!", H * 0.08, "rgba(255,225,122,.9)");
    }
  }

  const POS_L = [92, 80, 67, 56, 44, 33, 20, 8].map((x, i) => [x, i === 0 || i === 7 ? 84 : 88]);
  const POS_P = [
    [87, 79],
    [63, 79],
    [37, 79],
    [13, 79],
    [87, 93],
    [63, 93],
    [37, 93],
    [13, 93],
  ];

  C.GAMES.race = {
    title: "מירוץ גולות",
    icon: "🔮",
    seats: 8,
    sim: simulate,
    blurb: "6 גולות, מסלול עם חול, משטחי טורבו ועמודים. שמים על הגולה שלכם — זכייה משלמת ×5.5.",
    rules: `<ul>
<li>בוחרים סכום עם הצ'יפים ולוחצים על הגולה שרוצים — אפשר לשים על כמה גולות.</li>
<li>לוחצים <b>יוצאים לדרך</b>. הגולות מתנגשות ועוקפות באמת: <b style="color:#7ff6ff">משטח תכלת</b> מאיץ, <b style="color:#d9a55a">חול</b> מאט, ועמוד זהב מקפיץ הצידה.</li>
<li>נתיב הזינוק מוגרל בכל מירוץ, ולכל הגולות אותה מהירות בסיס — לכל אחת אותו סיכוי בדיוק.</li>
<li>הגולה שמגיעה ראשונה משלמת <b>×${PAY}</b> על מה ששמתם עליה. בסיום צמוד — פוטו־פיניש.</li>
<li>כל מי שליד השולחן, מכל מכשיר, רואה בדיוק את אותו מירוץ.</li></ul>`,
    init(S, H) {
      S.phase = "bet";
      S.bets = {};
      S.last = {};
      S.hist = [];
      S.seed = null;
      S.winner = null;
      S.results = null;
      H.say("על איזו גולה אתם שמים?");
    },
    status: (V) => (V.phase === "bet" ? "מקבלים הימורים" : "מירוץ באוויר!"),
    pending: (V, me) => (V.phase === "bet" ? Object.values(V.bets[me] || {}).reduce((a, b) => a + b, 0) : 0),
    atStake: (V, me) => V.phase === "race" && !!V.bets[me],
    onLeave(S, pid) {
      if (S.phase === "bet") delete S.bets[pid];
      return S.phase === "bet";
    },
    view(S) {
      return { ...S, raceEl: S.raceAt ? Date.now() - S.raceAt : 0 };
    },
    act(S, pid, a, H) {
      if (S.phase !== "bet") return;
      const p = S.players[pid];
      const mine = (S.bets[pid] ||= {});
      if (a.a === "bet") {
        const i = Math.floor(+a.i);
        if (!(i >= 0 && i < N)) return;
        const amt = Math.min(Math.floor(+a.amt), Math.floor(p.stack));
        if (!(amt >= 1)) return;
        p.stack = C.r2(p.stack - amt);
        mine[i] = (mine[i] || 0) + amt;
      } else if (a.a === "clear") {
        for (const k in mine) p.stack = C.r2(p.stack + mine[k]);
        delete S.bets[pid];
      } else if (a.a === "rebet") {
        const last = S.last[pid];
        if (!last) return;
        for (const k in mine) p.stack = C.r2(p.stack + mine[k]);
        S.bets[pid] = {};
        for (const k in last) {
          const amt = Math.min(last[k], Math.floor(p.stack));
          if (amt >= 1) {
            p.stack = C.r2(p.stack - amt);
            S.bets[pid][k] = amt;
          }
        }
      } else if (a.a === "go" && Object.keys(mine).length) go(S, H);
      if (S.bets[pid] && !Object.keys(S.bets[pid]).length) delete S.bets[pid];
    },

    mount(ctx) {
      const sc = ctx.scene;
      sc.insertAdjacentHTML("beforeend", `<div class="felt race-felt"><canvas class="race-cv"></canvas><div class="race-hist"></div></div>`);
      ctx.raceCanvas = $(".race-cv", sc);
      ctx.amt = 5;
      ctx.controls.innerHTML = `
<div class="ctl c-bet"><div class="ctl-info"></div><div class="chipbar"></div>
<div class="marble-btns">${MARBLES.map(
        (m, i) => `<button class="marble-btn" data-i="${i}" style="--m:${m.c}"><i></i><span>${m.n}</span><small>×${PAY}</small><b></b></button>`,
      ).join("")}</div>
<div class="ctl-btns"><button class="btn ghost clr">נקה</button><button class="btn ghost rebet">↺ כמו קודם</button><button class="btn gold go">🏁 יוצאים לדרך!</button></div></div>
<div class="ctl c-wait"><span class="wait-txt"></span></div>`;
      const c = ctx.controls;
      let fresh = true;
      T.chipBar($(".chipbar", c), (v) => {
        ctx.amt = fresh ? v : ctx.amt + v;
        fresh = false;
        ctx.sess.render(ctx.sess.V, true);
      });
      c.addEventListener("click", (e) => {
        const b = e.target.closest(".marble-btn");
        if (b && ctx.amt > 0) {
          C.sfx.play("chip");
          ctx.send({ a: "bet", i: +b.dataset.i, amt: ctx.amt });
          fresh = true;
        }
      });
      $(".clr", c).onclick = () => ctx.send({ a: "clear" });
      $(".rebet", c).onclick = () => ctx.send({ a: "rebet" });
      $(".go", c).onclick = () => ctx.send({ a: "go" });
      const loop = () => {
        if (!ctx.root.isConnected) return;
        const V = ctx.sess.V;
        if (V) {
          const cv = ctx.raceCanvas;
          const r = cv.getBoundingClientRect();
          const s = T.scale || 1;
          const dpr = Math.min(2, devicePixelRatio || 1);
          const w = Math.round((r.width / s) * dpr);
          const h = Math.round((r.height / s) * dpr);
          if (w > 10 && (cv.width !== w || cv.height !== h)) {
            cv.width = w;
            cv.height = h;
          }
          draw(ctx, V);
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
      if (V.phase === "race" && ctx.seed !== V.seed) {
        ctx.seed = V.seed;
        ctx.raceT0 = performance.now() - (V.raceEl || 0) - (Date.now() - V._recv);
        ctx.cd = 0;
      }
      const pos = ctx.portrait ? POS_P : POS_L;
      for (let i = 0; i < 8; i++) {
        const el = T.seat(sc, i, pos[i]);
        const id = V.seats[i];
        const p = id && V.players[id];
        T.fillSeat(el, p, { me: id === me });
        let rb = $(".race-bets", el);
        if (!rb) {
          el.insertAdjacentHTML("beforeend", `<div class="race-bets"></div>`);
          rb = $(".race-bets", el);
        }
        const bets = (id && V.bets[id]) || {};
        rb.innerHTML = Object.entries(bets)
          .map(([k, v]) => `<span style="--m:${MARBLES[k].c}" class="${V.winner == k && V.phase === "done" ? "w" : ""}">${C.money(v)}</span>`)
          .join("");
        el.classList.toggle("won", V.results?.[id] > 0);
      }
      $(".race-hist", sc).innerHTML = V.hist.length
        ? `<small>ניצחו לאחרונה:</small>` + V.hist.map((w) => `<i style="--m:${MARBLES[w].c}" title="${esc(MARBLES[w].n)}"></i>`).join("")
        : "";
      const c = ctx.controls;
      c.dataset.mode = V.phase === "bet" ? "bet" : "wait";
      $(".wait-txt", c).textContent =
        V.phase === "race"
          ? "המירוץ באוויר! 🏁"
          : V.order
            ? `🏆 ${V.order.map((w, k) => `${k + 1}. ${MARBLES[w].n}`).join("  ·  ")}`
            : "";
      if (V.phase === "bet") {
        const mine = V.bets[me] || {};
        const tot = Object.values(mine).reduce((a, b) => a + b, 0);
        const P = V.players[me];
        ctx.amt = C.clamp(ctx.amt, 0, Math.max(0, Math.floor(P?.stack || 0)));
        $(".ctl-info", c).innerHTML = `צ'יפ: <b>${C.money(ctx.amt)}</b> · לחצו על גולה כדי לשים עליה${
          tot ? ` · <small>סה״כ שמת ${C.money(tot)}</small>` : ""
        }`;
        c.querySelectorAll(".marble-btn").forEach((b) => {
          const v = mine[b.dataset.i];
          $("b", b).textContent = v ? C.money(v) : "";
          b.classList.toggle("sel", !!v);
          b.disabled = !(ctx.amt > 0);
        });
        $(".go", c).disabled = !tot;
        $(".clr", c).hidden = !tot;
        $(".rebet", c).hidden = !!tot || !V.last[me];
      }
    },
  };
})();
