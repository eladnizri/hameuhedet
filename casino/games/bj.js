/* ===================== בלאק ג'ק ===================== */
(function () {
  const C = window.Casino;
  const { $ } = C;
  const T = C.T;

  const val = (cards) => {
    let t = 0;
    let a = 0;
    for (const c of cards) {
      if (c.back) continue;
      t += c.r === 14 ? 11 : Math.min(c.r, 10);
      if (c.r === 14) a++;
    }
    while (t > 21 && a) (t -= 10), a--;
    return { t, soft: a > 0 };
  };
  const draw = (S) => {
    if (!S.shoe.length) S.shoe = C.deck(6);
    return S.shoe.pop();
  };
  const say = (S, pid, t) => (S.says[pid] = { t, k: (S.sk = (S.sk || 0) + 1) });
  const cv = (c) => (c.r === 14 ? 11 : Math.min(c.r, 10));
  /* פרפקט פייר: זוג בשני הקלפים הראשונים של השחקן */
  const PP = {
    perfect: { x: 25, n: "פרפקט פייר" },
    colored: { x: 12, n: "זוג באותו צבע" },
    mixed: { x: 6, n: "זוג מעורב" },
  };
  const red = (c) => c.s === "h" || c.s === "d";
  const ppKind = (a, b) =>
    !a || !b || a.r !== b.r ? null : a.s === b.s ? "perfect" : red(a) === red(b) ? "colored" : "mixed";

  /* כיתוב שקופץ על השולחן; x/y באחוזים מהסצנה */
  function fx(sc, cls, title, sub, x, y, delay = 0) {
    setTimeout(() => {
      const el = document.createElement("div");
      el.className = "bj-fx " + cls;
      el.style.left = x + "%";
      el.style.top = y + "%";
      el.innerHTML = `<b>${C.esc(title)}</b><span>${C.esc(sub)}</span>`;
      sc.appendChild(el);
      setTimeout(() => el.remove(), 2400);
    }, delay);
  }
  function confetti(sc, x, y) {
    const box = document.createElement("div");
    box.className = "confetti";
    box.style.left = x + "%";
    box.style.top = y + "%";
    const cols = ["#ffd36b", "#ff4d6d", "#7dffa8", "#3ee0ff", "#c86bff", "#fff"];
    box.innerHTML = Array.from({ length: 46 }, (_, i) => {
      const a = Math.random() * Math.PI * 2;
      const r = 80 + Math.random() * 190;
      return `<i style="--x:${(Math.cos(a) * r).toFixed(0)}px;--y:${(Math.sin(a) * r * 0.7 - 90).toFixed(0)}px;--r:${(Math.random() * 720 - 360).toFixed(0)}deg;--c:${cols[i % cols.length]};--d:${(Math.random() * 0.15).toFixed(2)}s"></i>`;
    }).join("");
    sc.appendChild(box);
    setTimeout(() => box.remove(), 2200);
  }

  function deal(S, H) {
    S.phase = "deal";
    S.round++;
    S.results = null;
    S.says = {};
    if (S.shoe.length < 80) {
      S.shoe = C.deck(6);
      H.log("הדילר ערבב 6 חפיסות חדשות");
    }
    S.order = S.seats.filter((id) => id && S.bets[id] && !S.players[id].left);
    /* פרפקט פייר בלי הימור ראשי — חוזר לשחקן */
    for (const id of Object.keys(S.pp)) {
      if (S.order.includes(id)) S.lastPP[id] = S.pp[id];
      else {
        if (S.players[id]) S.players[id].stack = C.r2(S.players[id].stack + S.pp[id]);
        delete S.pp[id];
      }
    }
    S.ppRes = {};
    S.hands = {};
    S.order.forEach((id) => {
      S.hands[id] = [{ cards: [], bet: S.bets[id] }];
      S.last[id] = S.bets[id];
    });
    S.dealer = { cards: [], hole: true };
    S.why = {};
    H.say("אין יותר הימורים 🙅");
    let t = 150;
    for (let k = 0; k < 2; k++) {
      for (const id of S.order)
        H.after((t += 300), () => {
          S.hands[id][0].cards.push(draw(S));
          H.push();
        });
      H.after((t += 300), () => {
        S.dealer.cards.push(draw(S));
        H.push();
      });
    }
    H.after(t + 450, () => afterDeal(S, H));
  }

  function afterDeal(S, H) {
    for (const [id, amt] of Object.entries(S.pp)) {
      const p = S.players[id];
      const [a, b] = S.hands[id]?.[0].cards || [];
      const k = ppKind(a, b);
      const pay = k ? amt * (PP[k].x + 1) : 0;
      if (p && !p.left) p.stack = C.r2(p.stack + pay);
      S.ppRes[id] = { k, net: C.r2(pay - amt), x: k ? PP[k].x : 0 };
      if (k) H.log(`${p?.name}: ${PP[k].n} ×${PP[k].x} → +${C.money(pay - amt)} 💎`);
    }
    S.pp = {};
    if (Object.values(S.ppRes).some((r) => r.k)) H.say("💎 יש פרפקט פייר על השולחן!");
    for (const id of S.order) {
      const h = S.hands[id][0];
      if (val(h.cards).t === 21) {
        h.done = h.bj = true;
        say(S, id, "בלאק ג'ק! 21 🔥");
      } else if (S.ppRes[id]?.k) say(S, id, `💎 ${PP[S.ppRes[id].k].n}! ×${S.ppRes[id].x}`);
      else say(S, id, `יש לך ${val(h.cards).t}`);
    }
    if (val(S.dealer.cards).t === 21) {
      S.dealer.hole = false;
      H.say("לדילר יש בלאק ג'ק 😬");
      H.push();
      H.after(1100, () => settle(S, H));
      return;
    }
    S.phase = "play";
    next(S, H);
    H.push();
  }

  function next(S, H) {
    H.endTurn();
    for (const id of S.order) {
      const hs = S.hands[id];
      const gone = !S.players[id] || S.players[id].left;
      for (let i = 0; i < hs.length; i++) {
        const h = hs[i];
        if (h.done) continue;
        if (gone || val(h.cards).t >= 21) {
          h.done = true;
          continue;
        }
        S.cur = { pid: id, h: i };
        const up = S.dealer.cards[0];
        H.say(`${S.players[id].name}${hs.length > 1 ? ` (יד ${i + 1})` : ""}: ${val(h.cards).t} מול ${up ? cv(up) : "?"} של הדילר`);
        H.turn(30000, () => {
          h.done = true;
          say(S, id, "עוצר (נגמר הזמן)");
          next(S, H);
        });
        return;
      }
    }
    S.cur = null;
    dealerPlay(S, H);
  }

  function dealerPlay(S, H) {
    S.phase = "dealer";
    S.dealer.hole = false;
    const live = S.order.some((id) => S.hands[id].some((h) => val(h.cards).t <= 21 && !h.bj));
    const step = () => {
      const v = val(S.dealer.cards).t;
      if (live && v < 17) {
        H.say(`לדילר ${v} — חייב למשוך קלף`);
        S.dealer.cards.push(draw(S));
        H.push();
        H.after(650, step);
      } else H.after(350, () => settle(S, H));
    };
    H.say(`הדילר הפך: ${val(S.dealer.cards).t}`);
    H.push();
    H.after(650, step);
  }

  function settle(S, H) {
    S.phase = "done";
    S.dealer.hole = false;
    S.cur = null;
    const dv = val(S.dealer.cards).t;
    const dBJ = dv === 21 && S.dealer.cards.length === 2;
    S.results = {};
    S.why = {};
    const dTxt = dv > 21 ? `הדילר עבר (${dv})` : dBJ ? "לדילר בלאק ג'ק" : `לדילר ${dv}`;
    const RES = { bj: "בלאק ג'ק!", win: "ניצחון", push: "תיקו", lose: "הפסד", bust: "באסט" };
    for (const id of S.order) {
      const p = S.players[id];
      let net = 0;
      const parts = [];
      for (const h of S.hands[id]) {
        const pv = val(h.cards).t;
        let pay = 0;
        if (pv > 21) h.res = "bust";
        else if (h.bj && !dBJ) (pay = h.bet * 2.5), (h.res = "bj");
        else if (dBJ && !h.bj) h.res = "lose";
        else if (dv > 21 || pv > dv) (pay = h.bet * 2), (h.res = "win");
        else if (pv === dv) (pay = h.bet), (h.res = "push");
        else h.res = "lose";
        h.net = C.r2(pay - h.bet);
        net += pay - h.bet;
        parts.push(
          h.res === "bust"
            ? `עברת את 21 (${pv})`
            : h.res === "bj"
              ? "בלאק ג'ק משלם 3:2"
              : `${pv} מול ${dv > 21 ? `${dv} (באסט של הדילר)` : dBJ ? "בלאק ג'ק" : dv}`,
        );
        if (p && !p.left) p.stack = C.r2(p.stack + pay);
      }
      if (p && !p.left) {
        const pr = S.ppRes?.[id];
        if (pr) {
          net += pr.net;
          parts.push(pr.k ? `💎 ${PP[pr.k].n} ×${pr.x}` : "פרפקט פייר לא נכנס");
        }
        net = C.r2(net);
        S.results[id] = net;
        S.why[id] = parts.join(" · ");
        const r = S.hands[id].length === 1 ? RES[S.hands[id][0].res] : net > 0 ? "רווח" : net < 0 ? "הפסד" : "תיקו";
        say(S, id, `${r} ${net > 0 ? "+" + C.money(net) : net < 0 ? C.money(net) : "↩"}`);
        H.log(`${p.name}: ${r} ${net > 0 ? "+" : ""}${C.money(net)}`);
      }
    }
    H.say(dv > 21 ? `${dTxt} — כל מי שנשאר מנצח! 🎉` : dTxt);
    H.push();
    H.after(2600, () => {
      S.phase = "bet";
      S.bets = {};
      S.ppRes = {};
      S.hands = {};
      S.order = [];
      S.dealer = { cards: [], hole: false };
      S.says = {};
      S.results = null;
      H.sweep();
      H.say("הימורים בבקשה! 🎩");
      H.push();
    });
  }

  const canSplit = (S, pid) => {
    const hs = S.hands[pid];
    const h = hs?.[S.cur?.h];
    return (
      h && hs.length === 1 && h.cards.length === 2 && cv(h.cards[0]) === cv(h.cards[1]) && S.players[pid].stack >= h.bet
    );
  };

  const POS_L = [
    [86, 50],
    [70, 69],
    [50, 76],
    [30, 69],
    [14, 50],
  ];
  const POS_P = [
    [83, 52],
    [74, 72],
    [50, 80],
    [26, 72],
    [17, 52],
  ];

  C.GAMES.bj = {
    title: "בלאק ג'ק",
    icon: "🂡",
    seats: 5,
    blurb: "מגיעים ל-21 בלי לעבור, ומנצחים את הדילר. בלאק ג'ק משלם 3:2.",
    rules: `<ul>
<li>בוחרים סכום עם הצ'יפים ולוחצים <b>חלוקה</b>. כל מי שהימר נכנס לסיבוב.</li>
<li>המטרה: להגיע קרוב ל-21 יותר מהדילר, בלי לעבור. תמונה = 10, אס = 1 או 11.</li>
<li><b>קלף</b> — עוד קלף. <b>עוצר</b> — מסיימים. <b>הכפלה</b> — מכפילים את ההימור ומקבלים קלף אחד בלבד. <b>פיצול</b> — זוג זהה נחלק לשתי ידיים.</li>
<li>אס + 10 בשני הקלפים הראשונים = בלאק ג'ק, משלם 3 ל-2.</li>
<li>הדילר (המחשב) מושך קלפים עד 17 ועוצר.</li>
<li>💎 <b>פרפקט פייר</b> — הימור צדדי ששני הקלפים הראשונים שלכם יהיו זוג: זוג מעורב (אדום+שחור) ×6, זוג באותו צבע ×12, זוג מושלם (אותו סוג בדיוק) ×25. משתלם מיד אחרי החלוקה, לא קשור לתוצאה מול הדילר.</li></ul>`,
    init(S, H) {
      S.phase = "bet";
      S.shoe = C.deck(6);
      S.bets = {};
      S.last = {};
      S.pp = {};
      S.lastPP = {};
      S.ppRes = {};
      S.hands = {};
      S.order = [];
      S.dealer = { cards: [], hole: false };
      S.cur = null;
      S.says = {};
      S.results = null;
      H.say("ברוכים הבאים! הימורים בבקשה 🎩");
    },
    status: (V) => (V.phase === "bet" ? "מקבלים הימורים" : "סיבוב בעיצומו"),
    pending: (V, me) => (V.phase === "bet" ? (V.bets[me] || 0) + (V.pp?.[me] || 0) : 0),
    atStake: (V, me) => !!V.hands?.[me] && V.phase !== "bet" && V.phase !== "done",
    onLeave(S, pid, H) {
      delete S.bets[pid];
      delete S.pp[pid];
      if (S.phase === "bet") return true;
      S.hands[pid]?.forEach((h) => (h.done = true));
      if (S.cur?.pid === pid) next(S, H);
      return false;
    },
    view(S) {
      return {
        ...S,
        shoe: undefined,
        shoeN: S.shoe.length,
        dealer: { ...S.dealer, cards: S.dealer.cards.map((c, i) => (i === 1 && S.dealer.hole ? C.hideCard(c) : c)) },
      };
    },
    act(S, pid, a, H) {
      const p = S.players[pid];
      if (S.phase === "bet") {
        if (a.a === "bet") {
          const want = Math.floor(+a.amt);
          if (!(want >= 0)) return;
          const old = S.bets[pid] || 0;
          const amt = Math.min(want, Math.floor(p.stack + old));
          p.stack = C.r2(p.stack + old - amt);
          if (amt > 0) S.bets[pid] = amt;
          else delete S.bets[pid];
        } else if (a.a === "pp") {
          const want = Math.floor(+a.amt);
          if (!(want >= 0)) return;
          const old = S.pp[pid] || 0;
          const amt = Math.min(want, Math.floor(p.stack + old));
          p.stack = C.r2(p.stack + old - amt);
          if (amt > 0) S.pp[pid] = amt;
          else delete S.pp[pid];
        } else if (a.a === "deal" && S.bets[pid]) deal(S, H);
        return;
      }
      if (S.phase !== "play" || S.cur?.pid !== pid) return;
      const h = S.hands[pid][S.cur.h];
      if (a.a === "hit") {
        h.cards.push(draw(S));
        const v = val(h.cards).t;
        say(S, pid, v > 21 ? `באסט! ${v} 💥` : v === 21 ? "21! 🎯" : `קלף → ${v}`);
        if (v >= 21) h.done = true;
      } else if (a.a === "stand") {
        h.done = true;
        say(S, pid, `עוצר על ${val(h.cards).t} ✋`);
      } else if (a.a === "double") {
        if (h.cards.length !== 2 || p.stack < h.bet) return;
        p.stack = C.r2(p.stack - h.bet);
        h.bet *= 2;
        h.dbl = true;
        h.cards.push(draw(S));
        h.done = true;
        say(S, pid, val(h.cards).t > 21 ? `באסט! ${val(h.cards).t} 💥` : `הכפלה → ${val(h.cards).t}`);
      } else if (a.a === "split") {
        if (!canSplit(S, pid)) return;
        p.stack = C.r2(p.stack - h.bet);
        const [c1, c2] = h.cards;
        const h2 = { cards: [c2, draw(S)], bet: h.bet, split: true };
        h.cards = [c1, draw(S)];
        h.split = true;
        S.hands[pid].push(h2);
        if (c1.r === 14) h.done = h2.done = true;
        say(S, pid, "פיצול ✂️");
      } else return;
      if (h.done) next(S, H);
      else
        H.turn(30000, () => {
          h.done = true;
          next(S, H);
        });
    },

    mount(ctx) {
      const sc = ctx.scene;
      sc.insertAdjacentHTML(
        "beforeend",
        `<div class="felt bj-felt"><div class="felt-print"><b>BLACKJACK PAYS 3 TO 2</b><span>הדילר מושך עד 17 · 💎 PERFECT PAIRS 25:1</span></div></div>
<div class="dealer-hand"><div class="cards bj-dcards"></div><div class="total"></div></div>`,
      );
      ctx.controls.innerHTML = `
<div class="ctl c-bet"><div class="ctl-info">ההימור שלך: <b class="mybet">$0</b></div><div class="chipbar"></div>
  <div class="pp-row"><span>💎 פרפקט פייר <small>(עד ×25)</small>: <b class="mypp">$0</b></span><button data-pp="1">+1</button><button data-pp="5">+5</button><button data-pp="10">+10</button><button data-pp="0" class="ppclr">✕</button></div>
  <div class="ctl-btns"><button class="btn ghost clr">נקה</button><button class="btn ghost rebet">↺ <span>כמו קודם</span></button><button class="btn gold go">🃏 חלוקה!</button></div></div>
<div class="ctl c-play"><button class="btn act hit">➕ קלף</button><button class="btn act stand">✋ עוצר</button><button class="btn act dbl">×2 הכפלה</button><button class="btn act split">✂️ פיצול</button></div>
<div class="ctl c-wait"><span class="wait-txt"></span></div>`;
      const c = ctx.controls;
      const bet = () => ctx.sess.V?.bets[ctx.me] || 0;
      const room = () => {
        const V = ctx.sess.V;
        return Math.floor((V?.players[ctx.me]?.stack || 0) + bet());
      };
      T.chipBar($(".chipbar", c), (v) => ctx.send({ a: "bet", amt: Math.min(room(), bet() + v) }));
      $(".clr", c).onclick = () => ctx.send({ a: "bet", amt: 0 });
      $(".rebet", c).onclick = () => {
        const V = ctx.sess.V;
        ctx.send({ a: "bet", amt: Math.min(room(), V?.last?.[ctx.me] || 0) });
        if (V?.lastPP?.[ctx.me]) ctx.send({ a: "pp", amt: V.lastPP[ctx.me] });
      };
      $(".pp-row", c).onclick = (e) => {
        const b = e.target.closest("[data-pp]");
        if (!b) return;
        C.sfx.play("chip");
        const V = ctx.sess.V;
        const cur = V?.pp?.[ctx.me] || 0;
        const v = +b.dataset.pp;
        ctx.send({ a: "pp", amt: v ? Math.min(cur + v, Math.floor((V?.players[ctx.me]?.stack || 0) + cur)) : 0 });
      };
      $(".go", c).onclick = () => ctx.send({ a: "deal" });
      $(".hit", c).onclick = () => ctx.send({ a: "hit" });
      $(".stand", c).onclick = () => ctx.send({ a: "stand" });
      $(".dbl", c).onclick = () => ctx.send({ a: "double" });
      $(".split", c).onclick = () => ctx.send({ a: "split" });
    },

    render(ctx, V) {
      const sc = ctx.scene;
      const me = ctx.me;
      const pos = ctx.portrait ? POS_P : POS_L;
      const left = V.turnLeft ? V.turnLeft - (Date.now() - V._recv) : 0;
      const mySeat = V.players[me]?.seat;
      for (let i = 0; i < 5; i++) {
        const el = T.seat(sc, i, pos[mySeat == null ? i : (i - mySeat + 7) % 5]);
        const id = V.seats[i];
        const p = id && V.players[id];
        T.fillSeat(el, p, {
          me: id === me,
          turn: V.cur?.pid === id,
          left,
          tk: V.turnK,
          say: V.says?.[id]?.t,
          sayKey: String(V.says?.[id]?.k || ""),
        });
        let spot = $(".bj-spot", el);
        let hb = $(".bj-hands", el);
        if (!spot) {
          el.insertAdjacentHTML("beforeend", `<div class="bj-spot"></div><div class="bj-hands"></div>`);
          spot = $(".bj-spot", el);
          hb = $(".bj-hands", el);
        }
        const hands = (id && V.hands?.[id]) || [];
        const b = V.phase === "bet" ? V.bets[id] || 0 : hands.reduce((s, h) => s + h.bet, 0);
        const ppAmt = (id && V.phase === "bet" && V.pp?.[id]) || 0;
        const ppr = id && V.phase !== "bet" ? V.ppRes?.[id] : null;
        const bk = b + ":" + ppAmt + ":" + (ppr ? ppr.k + ppr.net : "");
        if (spot.dataset.b !== bk) {
          spot.dataset.b = bk;
          spot.innerHTML =
            T.chips(b) +
            (ppAmt ? `<span class="pp-chip">💎 ${C.money(ppAmt)}</span>` : "") +
            (ppr ? `<span class="pp-chip ${ppr.k ? "won" : "lost"}">💎 ${ppr.k ? "×" + ppr.x : "✕"}</span>` : "");
        }
        while (hb.children.length > hands.length) hb.lastChild.remove();
        while (hb.children.length < hands.length)
          hb.insertAdjacentHTML("beforeend", `<div class="bj-hand"><div class="cards"></div><span class="tot"></span><span class="res"></span></div>`);
        hands.forEach((h, k) => {
          const box = hb.children[k];
          T.syncCards($(".cards", box), h.cards);
          const v = val(h.cards);
          $(".tot", box).textContent = h.cards.length ? (v.soft && v.t < 21 ? `${v.t - 10}/${v.t}` : v.t) : "";
          const res = { win: "ניצחון", bj: "בלאק ג'ק!", push: "תיקו", lose: "הפסד", bust: "באסט" }[h.res] || "";
          $(".res", box).textContent = res && h.net != null ? `${res} ${h.net > 0 ? "+" + C.money(h.net) : h.net < 0 ? C.money(h.net) : ""}` : res;
          box.className = `bj-hand${h.res ? " r-" + h.res : ""}${V.cur?.pid === id && V.cur.h === k ? " active" : ""}`;
        });
      }
      T.syncCards($(".bj-dcards", sc), V.dealer.cards);
      const dv = val(V.dealer.cards).t;
      $(".dealer-hand .total", sc).textContent = V.dealer.cards.length ? dv : "";
      $(".dealer-hand", sc).classList.toggle("busted", dv > 21);

      /* פרפקט פייר שלי נכנס */
      const myPP = V.ppRes?.[me];
      if (myPP?.k && ctx.ppRound !== V.round && mySeat != null) {
        ctx.ppRound = V.round;
        const el = sc.querySelector(`.seat[data-i="${mySeat}"]`);
        const x = parseFloat(el.style.left);
        const y = parseFloat(el.style.top);
        C.sfx.play(myPP.k === "perfect" ? "big" : "win");
        confetti(sc, x, y - 18);
        fx(sc, "fx-win fx-pp", `💎 ${PP[myPP.k].n}! ×${myPP.x}`, `+${C.money(myPP.net)}`, x, y - 32);
      }

      /* סוף סיבוב: הדילר נשרף / ניצחת */
      if (V.phase === "done" && ctx.fxRound !== V.round) {
        ctx.fxRound = V.round;
        const mine = V.hands?.[me] || [];
        const won = mine.find((h) => h.res === "bj") || mine.find((h) => h.res === "win");
        if (dv > 21) {
          C.sfx.play("boom");
          fx(sc, "fx-bust", "💥 הדילר נשרף! 💥", `עבר עם ${dv} — מי שלא עבר מנצח`, 50, 30);
        }
        if (won && mySeat != null) {
          const el = sc.querySelector(`.seat[data-i="${mySeat}"]`);
          const x = parseFloat(el.style.left);
          const y = parseFloat(el.style.top);
          el.classList.add("fx-winner");
          setTimeout(() => el.classList.remove("fx-winner"), 2400);
          const d = dv > 21 ? 600 : 0;
          setTimeout(() => confetti(sc, x, y - 18), d);
          fx(sc, "fx-win", won.res === "bj" ? "🃏 בלאק ג'ק! 🃏" : "🏆 ניצחת! 🏆", `+${C.money(won.net)}`, x, y - 32, d);
        }
      }

      /* כפתורים */
      const c = ctx.controls;
      const P = V.players[me];
      const myTurn = V.phase === "play" && V.cur?.pid === me;
      let mode = "wait";
      let txt = "";
      if (V.phase === "bet") mode = "bet";
      else if (myTurn) mode = "play";
      else if (V.phase === "deal") txt = "הדילר מחלק…";
      else if (V.phase === "play") txt = V.cur ? `התור של ${V.players[V.cur.pid]?.name || ""}…` : "";
      else if (V.phase === "dealer") txt = "הדילר משחק…";
      else if (V.phase === "done") txt = "סיבוב חדש מתחיל עוד רגע…";
      if (V.phase !== "bet" && !V.hands?.[me] && V.phase !== "done") txt += " (אתם בסיבוב הבא)";
      if (c.dataset.mode !== mode) {
        c.dataset.mode = mode;
        if (mode === "play") C.sfx.play("turn");
      }
      $(".wait-txt", c).textContent = txt;
      if (mode !== "play") delete $(".c-play", c).dataset.hint;
      if (mode === "bet") {
        const mb = V.bets[me] || 0;
        const mpp = V.pp?.[me] || 0;
        $(".mybet", c).textContent = C.money(mb);
        $(".mypp", c).textContent = C.money(mpp);
        $(".ppclr", c).hidden = !mpp;
        $(".go", c).disabled = !mb;
        const last = V.last?.[me] || 0;
        $(".rebet", c).hidden = !last || mb === last;
        $(".clr", c).hidden = !mb;
        const others = Object.keys(V.bets).filter((id) => id !== me).length;
        $(".ctl-info", c).innerHTML = `ההימור שלך: <b class="mybet">${C.money(mb)}</b>${
          others ? ` <small>· עוד ${others} שחקנים הימרו</small>` : ""
        }${mpp && !mb ? ` <small class="warn">פרפקט פייר משחק רק יחד עם הימור ראשי</small>` : ""}${
          P && P.stack < 1 && !mb ? ` <small class="warn">אין כסף על השולחן — לחצו + למעלה</small>` : ""
        }`;
      }
      if (mode === "play") {
        const h = V.hands[me][V.cur.h];
        const up = V.dealer.cards[0];
        $(".c-play", c).dataset.hint = `יש לך ${val(h.cards).t} · לדילר מראה ${up ? cv(up) : "?"}`;
        $(".dbl", c).disabled = !(h.cards.length === 2 && P.stack >= h.bet);
        $(".split", c).hidden = !(
          V.hands[me].length === 1 &&
          h.cards.length === 2 &&
          cv(h.cards[0]) === cv(h.cards[1]) &&
          P.stack >= h.bet
        );
      }
    },
  };
})();
