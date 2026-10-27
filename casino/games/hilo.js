/* ===================== גבוה־נמוך — רצף ניחושים =====================
   שמים סכום וממשיכים לנחש קלף אחרי קלף. כל ניחוש נכון מכפיל את הקופה
   לפי הסיכוי של אותו ניחוש. טעות אחת — הקופה הולכת. לוקחים מתי שרוצים. */
(function () {
  const C = window.Casino;
  const { $ } = C;
  const T = C.T;
  const R = C.RANK;

  const count = (r, pick) => (pick === "hi" ? 14 - r : r - 2);
  /* 13 ערכים אפשריים; מכפיל הוגן = 13/מספר הערכים המנצחים, פחות 3% לבית */
  const mult = (r, pick) => {
    const n = count(r, pick);
    return n > 0 ? C.r2((13 / n) * 0.97) : 0;
  };
  const draw = (S) => {
    if (S.deck.length < 6) S.deck = C.deck(1);
    return S.deck.pop();
  };
  const say = (S, pid, t) => (S.says[pid] = { t, k: (S.sk = (S.sk || 0) + 1) });

  function maybeReveal(S, H) {
    const st = Object.values(S.st);
    if (!st.some((s) => s.pick)) return H.clear("auto");
    if (st.every((s) => s.pick)) return H.after(S.solo ? 120 : 400, () => reveal(S, H));
    if (!S.solo) H.timer("auto", 12000, () => reveal(S, H));
  }

  function reveal(S, H) {
    if (S.phase !== "bet" || !Object.values(S.st).some((s) => s.pick)) return;
    H.clear("auto");
    S.phase = "flip";
    S.round++;
    S.results = {};
    S.why = {};
    S.next = draw(S);
    S.nextHidden = true;
    H.say("והקלף הבא הוא…");
    H.push();
    H.after(S.solo ? 550 : 800, () => {
      S.nextHidden = false;
      H.push();
      H.after(400, () => settle(S, H));
    });
  }

  function settle(S, H) {
    const b = S.base.r;
    const n = S.next.r;
    for (const [id, s] of Object.entries(S.st)) {
      if (!s.pick) continue;
      const p = S.players[id];
      const win = (s.pick === "hi" && n > b) || (s.pick === "lo" && n < b);
      if (win) {
        const m = mult(b, s.pick);
        s.pot = C.r2(s.pot * m);
        s.steps++;
        s.pick = null;
        say(S, id, `✔ ×${m} → ${C.money(s.pot)}`);
      } else {
        S.results[id] = -s.stake;
        S.why[id] =
          n === b
            ? `יצא ${R(n)} — אותו ערך, הבית לוקח את הקופה של ${C.money(s.pot)}`
            : `ניחשת ${s.pick === "hi" ? "גבוה" : "נמוך"} ויצא ${R(n)} — הקופה של ${C.money(s.pot)} אבדה`;
        say(S, id, "✖ הקופה אבדה");
        if (p) H.log(`${p.name}: נפל/ה אחרי ${s.steps} ניחושים (${C.money(s.pot)})`);
        delete S.st[id];
      }
    }
    H.say(n === b ? `${R(n)} — אותו ערך! 😈` : n > b ? `${R(n)} — גבוה! ⬆` : `${R(n)} — נמוך! ⬇`);
    S.phase = "done";
    H.push();
    H.after(S.solo ? 650 : 1100, () => {
      S.hist.push(S.base);
      if (S.hist.length > 14) S.hist.shift();
      S.base = S.next;
      S.next = null;
      S.phase = "bet";
      H.sweep();
      H.say(Object.keys(S.st).length ? "ממשיכים לנחש — או לוקחים את הכסף?" : "שימו סכום ובחרו גבוה או נמוך");
      H.push();
    });
  }

  const POS_L = [
    [89, 50],
    [77, 71],
    [60, 80],
    [40, 80],
    [23, 71],
    [11, 50],
  ];
  const POS_P = [
    [85, 56],
    [76, 74],
    [60, 84],
    [40, 84],
    [24, 74],
    [15, 56],
  ];

  C.GAMES.hilo = {
    title: "גבוה־נמוך",
    icon: "🔼",
    seats: 6,
    blurb: "רצף ניחושים: כל ניחוש נכון מכפיל את הקופה. טעות אחת — הכל הולך. לוקחים מתי שרוצים.",
    rules: `<ul>
<li>שמים סכום התחלתי ומנחשים: הקלף הבא יהיה <b>גבוה</b> או <b>נמוך</b> מהקלף שעל השולחן (2 הכי נמוך, אס הכי גבוה).</li>
<li>ניחוש נכון — הקופה שלכם מוכפלת, וממשיכים לקלף הבא. ניחוש שגוי — כל הקופה הולכת.</li>
<li>המכפיל תלוי בסיכון: על 8 כל כיוון נותן בערך ×2.1. על 3 "גבוה" כמעט בטוח ונותן רק ×1.15, אבל "נמוך" נותן ×12.6!</li>
<li>אותו ערך בדיוק — הבית מנצח.</li>
<li>לוחצים <b>💰 לקחת</b> מתי שרוצים, והקופה עוברת לכסף שעל השולחן.</li></ul>`,
    init(S, H) {
      S.phase = "bet";
      S.deck = C.deck(1);
      S.base = draw(S);
      S.next = null;
      S.st = {};
      S.says = {};
      S.hist = [];
      S.results = null;
      H.say("שימו סכום ובחרו גבוה או נמוך");
    },
    status: (V) => {
      const n = Object.keys(V.st).length;
      return n ? `${n} ברצף` : "מקבלים הימורים";
    },
    pending: (V, me) => {
      const s = V.st[me];
      return s && (V.phase === "bet" || !s.pick) ? s.pot : 0;
    },
    atStake: (V, me) => !!V.st[me]?.pick && V.phase !== "bet",
    onLeave(S, pid) {
      const s = S.st[pid];
      if (s && (S.phase === "bet" || !s.pick)) delete S.st[pid];
      return S.phase === "bet";
    },
    view(S) {
      return { ...S, deck: undefined, next: S.next && (S.nextHidden ? C.hideCard(S.next) : S.next) };
    },
    act(S, pid, a, H) {
      if (S.phase !== "bet") return;
      const p = S.players[pid];
      const s = S.st[pid];
      if (a.a === "start" && !s) {
        const amt = Math.min(Math.floor(+a.amt), Math.floor(p.stack));
        if (!(amt >= 1) || !mult(S.base.r, a.pick)) return;
        p.stack = C.r2(p.stack - amt);
        S.st[pid] = { pot: amt, stake: amt, pick: a.pick, steps: 0 };
        say(S, pid, a.pick === "hi" ? `⬆ גבוה · ${C.money(amt)}` : `⬇ נמוך · ${C.money(amt)}`);
      } else if (a.a === "pick" && s) {
        if (!mult(S.base.r, a.pick)) return;
        s.pick = a.pick;
        say(S, pid, a.pick === "hi" ? "⬆ גבוה" : "⬇ נמוך");
      } else if (a.a === "cash" && s) {
        p.stack = C.r2(p.stack + s.pot);
        S.round++;
        S.results = { [pid]: C.r2(s.pot - s.stake) };
        S.why = { [pid]: `${s.steps} ניחושים נכונים ברצף: ${C.money(s.stake)} → ${C.money(s.pot)}` };
        say(S, pid, `💰 לקח/ה ${C.money(s.pot)}`);
        H.log(`${p.name} לקח/ה ${C.money(s.pot)} אחרי ${s.steps} ניחושים 💰`);
        delete S.st[pid];
      } else if (a.a === "go" && s?.pick) return reveal(S, H);
      else return;
      maybeReveal(S, H);
    },

    mount(ctx) {
      const sc = ctx.scene;
      sc.insertAdjacentHTML(
        "beforeend",
        `<div class="felt hilo-felt"><div class="felt-print"><b>HIGH · LOW</b><span>רצף ניחושים · אותו ערך — הבית מנצח</span></div></div>
<div class="hilo-mid"><div class="hilo-slot"><small>הקלף על השולחן</small><div class="cards big hl-base"></div></div>
<div class="hilo-arrows"><span>⬆</span><span>⬇</span></div>
<div class="hilo-slot"><small>הקלף הבא</small><div class="cards big hl-next"></div><div class="hl-ghost"></div></div></div>
<div class="hilo-ladder"></div><div class="hilo-hist"></div>`,
      );
      ctx.amt = 5;
      ctx.controls.innerHTML = `
<div class="ctl c-bet"><div class="ctl-info"></div><div class="chipbar"></div>
  <div class="ctl-btns"><button class="btn act hi">⬆ גבוה <small></small></button><button class="btn act lo">⬇ נמוך <small></small></button>
  <button class="btn gold cash"></button><button class="btn ghost go">🂠 חשוף עכשיו</button></div></div>
<div class="ctl c-wait"><span class="wait-txt"></span></div>`;
      const c = ctx.controls;
      let fresh = true;
      T.chipBar($(".chipbar", c), (v) => {
        const max = Math.floor(ctx.sess.V?.players[ctx.me]?.stack || 0);
        ctx.amt = C.clamp(fresh ? v : ctx.amt + v, 0, max);
        fresh = false;
        ctx.sess.render(ctx.sess.V, true);
      });
      const pick = (p) => {
        if (ctx.sess.V.st[ctx.me]) ctx.send({ a: "pick", pick: p });
        else if (ctx.amt > 0) {
          ctx.send({ a: "start", amt: ctx.amt, pick: p });
          fresh = true;
        }
      };
      $(".hi", c).onclick = () => pick("hi");
      $(".lo", c).onclick = () => pick("lo");
      $(".cash", c).onclick = () => ctx.send({ a: "cash" });
      $(".go", c).onclick = () => ctx.send({ a: "go" });
    },
    render(ctx, V) {
      const sc = ctx.scene;
      const me = ctx.me;
      const pos = ctx.portrait ? POS_P : POS_L;
      const mySeat = V.players[me]?.seat;
      for (let i = 0; i < 6; i++) {
        const el = T.seat(sc, i, pos[mySeat == null ? i : (i - mySeat + 8) % 6]);
        const id = V.seats[i];
        const p = id && V.players[id];
        const s = id && V.st[id];
        T.fillSeat(el, p, { me: id === me, say: V.says?.[id]?.t, sayKey: String(V.says?.[id]?.k || "") });
        let spot = $(".bj-spot", el);
        if (!spot) {
          el.insertAdjacentHTML("beforeend", `<div class="bj-spot"></div>`);
          spot = $(".bj-spot", el);
        }
        const k = s ? s.pot + ":" + s.steps : "";
        if (spot.dataset.b !== k) {
          spot.dataset.b = k;
          spot.innerHTML = s ? T.chips(s.pot) + (s.steps ? `<em class="streak">🔥${s.steps}</em>` : "") : "";
        }
        el.classList.toggle("won", !!s?.steps);
        el.classList.toggle("lost", V.results?.[id] < 0);
      }
      T.syncCards($(".hl-base", sc), [V.base], { stagger: 0 });
      T.syncCards($(".hl-next", sc), V.next ? [V.next] : []);
      $(".hl-ghost", sc).hidden = !!V.next;
      $(".hilo-hist", sc).innerHTML = V.hist
        .map((h) => `<span class="${h.s === "h" || h.s === "d" ? "red" : ""}">${R(h.r)}${C.SUIT[h.s]}</span>`)
        .join("");
      const mh = mult(V.base.r, "hi");
      const ml = mult(V.base.r, "lo");
      $(".hilo-ladder", sc).innerHTML = `<span>⬆ גבוה: ${mh ? `${count(V.base.r, "hi")} מתוך 13 · ×${mh}` : "בלתי אפשרי"}</span><span>⬇ נמוך: ${
        ml ? `${count(V.base.r, "lo")} מתוך 13 · ×${ml}` : "בלתי אפשרי"
      }</span>`;

      const c = ctx.controls;
      const mode = V.phase === "bet" ? "bet" : "wait";
      c.dataset.mode = mode;
      const mine = V.st[me];
      $(".wait-txt", c).textContent =
        V.phase === "flip"
          ? mine?.pick
            ? `הקופה שלך ${C.money(mine.pot)} על הקו… 🤞`
            : "חושפים את הקלף…"
          : mine
            ? `הקופה שלך: ${C.money(mine.pot)} 🔥`
            : "קלף חדש עוד רגע…";
      if (mode !== "bet") return;
      const P = V.players[me];
      if (!mine) ctx.amt = C.clamp(ctx.amt, 0, Math.floor(P?.stack || 0));
      const hi = $(".hi", c);
      const lo = $(".lo", c);
      const base = mine ? mine.pot : ctx.amt;
      $("small", hi).textContent = mh ? `×${mh} → ${C.money(base * mh)}` : "—";
      $("small", lo).textContent = ml ? `×${ml} → ${C.money(base * ml)}` : "—";
      hi.disabled = !mh || (!mine && !(ctx.amt > 0));
      lo.disabled = !ml || (!mine && !(ctx.amt > 0));
      hi.classList.toggle("sel", mine?.pick === "hi");
      lo.classList.toggle("sel", mine?.pick === "lo");
      $(".chipbar", c).hidden = !!mine;
      $(".cash", c).hidden = !mine;
      $(".cash", c).textContent = mine ? `💰 לקחת ${C.money(mine.pot)}` : "";
      const others = Object.keys(V.st).filter((id) => id !== me);
      $(".go", c).hidden = V.solo || !mine?.pick || others.every((id) => V.st[id].pick);
      $(".ctl-info", c).innerHTML = mine
        ? `🔥 רצף ${mine.steps} · קופה <b>${C.money(mine.pot)}</b> <small>(התחלת ב-${C.money(mine.stake)})</small>${
            mine.pick ? ` <small>· בחרת ${mine.pick === "hi" ? "גבוה" : "נמוך"} — מחכים לשאר</small>` : ""
          }`
        : `סכום התחלתי: <b>${C.money(ctx.amt)}</b> <small>· בחרו גבוה או נמוך כדי להתחיל רצף</small>`;
    },
  };
})();
