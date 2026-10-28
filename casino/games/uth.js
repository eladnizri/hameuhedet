/* ===================== אולטימייט טקסס הולדם =====================
   משחק מול הדילר (לא מול השחקנים): אנטה + בליינד שווים, טריפס אופציונלי.
   לפני הפלופ: צ'ק או העלאה ×3/×4. אחרי הפלופ: צ'ק או ×2. אחרי הריבר: ×1 או פולד.
   הדילר "מעפיל" עם זוג ומעלה — אחרת האנטה חוזר. בליינד משלם רק על רצף ומעלה. */
(function () {
  const C = window.Casino;
  const { $, esc } = C;
  const T = C.T;
  const R = C.RANK;
  const { score, handName, best5 } = C.PK;

  const cat = (sc) => Math.floor(sc / 15 ** 5);
  const top = (sc) => Math.floor(sc / 15 ** 4) % 15;
  const isRoyal = (sc) => cat(sc) === 8 && top(sc) === 14;
  /* טבלאות תשלום (רווח על כל $1) */
  const blindPay = (sc) => (isRoyal(sc) ? 500 : [0, 0, 0, 0, 1, 1.5, 3, 10, 50][cat(sc)]);
  const tripsPay = (sc) => (isRoyal(sc) ? 50 : [0, 0, 0, 3, 4, 7, 8, 30, 40][cat(sc)]);
  const BLIND_TABLE = [
    ["רויאל פלאש", "500:1"],
    ["סטרייט פלאש", "50:1"],
    ["רביעייה", "10:1"],
    ["פול האוס", "3:1"],
    ["צבע", "3:2"],
    ["רצף", "1:1"],
    ["אחר", "חוזר"],
  ];
  const TRIPS_TABLE = [
    ["רויאל פלאש", "50:1"],
    ["סטרייט פלאש", "40:1"],
    ["רביעייה", "30:1"],
    ["פול האוס", "8:1"],
    ["צבע", "7:1"],
    ["רצף", "4:1"],
    ["שלישייה", "3:1"],
  ];
  const STREET = { pre: ["check", "x3", "x4"], flop: ["check", "x2"], river: ["x1", "fold"] };
  const DEC_TXT = { check: "צ'ק ✔", x4: "העלאה ×4 🔥", x3: "העלאה ×3", x2: "העלאה ×2", x1: "משחק ×1", fold: "פולד ✖" };
  const DEC_MS = 30000;

  const draw = (S) => S.deck.pop();
  const say = (S, pid, t) => (S.says[pid] = { t, k: (S.sk = (S.sk || 0) + 1) });
  const live = (S) => S.order.filter((id) => !S.hands[id].fold && S.players[id] && !S.players[id].left);
  const pending = (S) => live(S).filter((id) => !S.hands[id].play && S.hands[id].dec !== S.phase);

  /* ===== אסטרטגיה בסיסית — טיפ לשחקן ===== */
  function hidden(hole, board) {
    if (hole[0].r === hole[1].r) return true;
    return hole.some((h) => board.some((b) => b.r === h.r));
  }
  function tip(phase, hole, board) {
    if (!hole?.length || hole[0].back) return "";
    const [a, b] = [...hole].sort((x, y) => y.r - x.r);
    if (phase === "pre") {
      const suited = a.s === b.s;
      const pair = a.r === b.r;
      const good =
        (pair && a.r >= 3) ||
        a.r === 14 ||
        (a.r === 13 && (suited || b.r >= 5)) ||
        (a.r === 12 && (suited ? b.r >= 6 : b.r >= 8)) ||
        (a.r === 11 && (suited ? b.r >= 8 : b.r >= 10));
      return good ? "💡 יד חזקה לפי האסטרטגיה — כדאי להעלות ×4" : "💡 יד חלשה — עדיף צ'ק ולראות פלופ";
    }
    const all = hole.concat(board);
    const sc = score(all);
    const boardSc = score(board);
    if (phase === "flop") {
      const hp = hidden(hole, board) && !(hole[0].r === 2 && hole[1].r === 2);
      const better = cat(sc) >= 2 && cat(sc) > cat(boardSc);
      const fd = hole.some((h) => h.r >= 10 && all.filter((c) => c.s === h.s).length >= 4);
      return better || hp ? "💡 יש לך זוג משלך או יותר — כדאי להעלות ×2" : fd ? "💡 יש לך 4 לצבע עם קלף גבוה — כדאי להעלות ×2" : "💡 עדיף צ'ק ולראות טרן וריבר";
    }
    if (phase === "river") {
      const ok = cat(sc) > cat(boardSc) || (cat(sc) >= 1 && hidden(hole, board));
      return ok ? "💡 היד שלך משתמשת בקלפים שלך — כדאי לשחק ×1" : "💡 בלי זוג משלך — כנראה עדיף פולד";
    }
    return "";
  }

  /* ===================== מהלך היד ===================== */
  function deal(S, H) {
    S.phase = "deal";
    S.round++;
    S.results = null;
    S.why = null;
    S.says = {};
    S.deck = C.deck(1);
    S.board = [];
    S.order = S.seats.filter((id) => id && S.bets[id]?.ante > 0 && !S.players[id].left);
    for (const [id, b] of Object.entries(S.bets))
      if (!S.order.includes(id) && S.players[id]) S.players[id].stack = C.r2(S.players[id].stack + b.ante * 2 + (b.trips || 0));
    S.hands = {};
    for (const id of S.order) {
      const b = S.bets[id];
      S.hands[id] = { cards: [], ante: b.ante, blind: b.ante, trips: b.trips || 0, play: 0, x: 0, fold: false, dec: null };
      S.last[id] = { ...b };
    }
    S.dealer = { cards: [], hide: true };
    S.dq = null;
    H.say("אין יותר הימורים — מחלקים 🃏");
    let t = 150;
    for (let k = 0; k < 2; k++) {
      for (const id of S.order)
        H.after((t += 260), () => {
          S.hands[id].cards.push(draw(S));
          H.push();
        });
      H.after((t += 260), () => {
        S.dealer.cards.push(draw(S));
        H.push();
      });
    }
    H.after(t + 400, () => street(S, H, "pre"));
  }

  function street(S, H, ph) {
    S.phase = ph;
    S.decAt = 0;
    const left = pending(S);
    if (!left.length) return advance(S, H);
    H.say(
      ph === "pre"
        ? "לפני הפלופ: צ'ק — או העלאה ×3 / ×4 מהאנטה"
        : ph === "flop"
          ? "הפלופ על השולחן: צ'ק — או העלאה ×2"
          : "כל הקלפים על השולחן: משחקים ×1 — או פולד",
    );
    if (!S.solo) {
      S.decAt = Date.now() + DEC_MS;
      H.timer("dec", DEC_MS, () => {
        for (const id of pending(S)) decide(S, H, id, ph === "river" ? "fold" : "check", true);
      });
    }
    H.push();
  }

  function decide(S, H, pid, d, auto) {
    const h = S.hands[pid];
    const p = S.players[pid];
    if (!h || h.fold || h.play || h.dec === S.phase || !STREET[S.phase]?.includes(d)) return;
    if (d[0] === "x") {
      const x = +d.slice(1);
      const amt = C.r2(h.ante * x);
      if (p.stack < amt) return;
      p.stack = C.r2(p.stack - amt);
      h.play = amt;
      h.x = x;
    } else if (d === "fold") h.fold = true;
    h.dec = S.phase;
    say(S, pid, (auto ? "⏱ " : "") + DEC_TXT[d] + (h.play ? ` ${C.money(h.play)}` : ""));
    if (!pending(S).length) {
      H.clear("dec");
      S.decAt = 0;
      H.after(450, () => advance(S, H));
    }
  }

  function advance(S, H) {
    const ph = S.phase;
    if (ph === "pre" || ph === "deal") {
      S.phase = "dealing";
      H.say("הפלופ…");
      H.push();
      [0, 1, 2].forEach((i) =>
        H.after(250 + i * 260, () => {
          S.board.push(draw(S));
          H.push();
        }),
      );
      H.after(1250, () => street(S, H, "flop"));
    } else if (ph === "flop") {
      S.phase = "dealing";
      H.say("טרן וריבר…");
      H.push();
      [0, 1].forEach((i) =>
        H.after(250 + i * 420, () => {
          S.board.push(draw(S));
          H.push();
        }),
      );
      H.after(1300, () => street(S, H, "river"));
    } else showdown(S, H);
  }

  function showdown(S, H) {
    S.phase = "show";
    S.dealer.hide = false;
    const ds = score(S.dealer.cards.concat(S.board));
    const q = cat(ds) >= 1;
    S.dq = { sc: ds, name: handName(ds), q, best: best5(S.dealer.cards.concat(S.board)) };
    S.results = {};
    S.why = {};
    S.res = {};
    for (const id of S.order) {
      const h = S.hands[id];
      const p = S.players[id];
      const ps = score(h.cards.concat(S.board));
      h.name = handName(ps);
      h.best = best5(h.cards.concat(S.board));
      let back = 0;
      const parts = [];
      const res = { play: 0, ante: 0, blind: 0, trips: 0 };
      if (h.fold) {
        res.ante = -h.ante;
        res.blind = -h.blind;
        parts.push("פולד — האנטה והבליינד הלכו");
        h.out = "fold";
      } else {
        const cmp = Math.sign(ps - ds);
        h.out = cmp > 0 ? "win" : cmp < 0 ? "lose" : "push";
        if (cmp > 0) {
          res.play = h.play;
          res.ante = q ? h.ante : 0;
          res.blind = C.r2(h.blind * blindPay(ps));
          parts.push(cat(ps) === cat(ds) ? C.PK.versus(ps, ds) : `${h.name} גובר על ${S.dq.name}`);
          parts.push(`פליי ×${h.x} +${C.money(h.play)}`);
          parts.push(q ? `אנטה +${C.money(h.ante)}` : "אנטה חוזר (הדילר לא מעפיל)");
          parts.push(res.blind ? `בליינד ${blindPay(ps) === 1.5 ? "3:2" : blindPay(ps) + ":1"} +${C.money(res.blind)}` : "בליינד חוזר (רק רצף ומעלה משלם)");
        } else if (cmp < 0) {
          res.play = -h.play;
          res.ante = q ? -h.ante : 0;
          res.blind = -h.blind;
          parts.push(cat(ps) === cat(ds) ? C.PK.versus(ds, ps).replace(/^/, "לדילר: ") : `${S.dq.name} של הדילר גובר על ${h.name}`);
          if (!q) parts.push("האנטה חוזר (הדילר לא מעפיל)");
        } else parts.push(`תיקו — ${h.name}, הכל חוזר`);
        back += h.play + res.play + h.ante + res.ante + h.blind + res.blind;
      }
      if (h.trips) {
        const tp = tripsPay(ps);
        res.trips = tp ? C.r2(h.trips * tp) : -h.trips;
        if (tp) back += h.trips + res.trips;
        parts.push(tp ? `טריפס ${tp}:1 +${C.money(res.trips)} 💰` : "טריפס לא נכנס");
      }
      back = C.r2(back);
      if (p && !p.left) p.stack = C.r2(p.stack + back);
      const net = C.r2(res.play + res.ante + res.blind + res.trips);
      S.res[id] = res;
      S.results[id] = net;
      S.why[id] = parts.join(" · ");
      if (p) {
        say(S, id, h.out === "fold" ? "פולד" : `${h.name} ${net > 0 ? "+" + C.money(net) : net < 0 ? C.money(net) : "↩"}`);
        H.log(`${p.name}: ${net >= 0 ? "+" : ""}${C.money(net)}${h.out === "fold" ? " (פולד)" : ""}`);
      }
    }
    H.say(`לדילר: ${S.dq.name} — ${q ? "מעפיל ✔" : "לא מעפיל (צריך זוג) — האנטה חוזר"}`);
    H.push();
    H.after(5200, () => {
      S.phase = "bet";
      S.bets = {};
      S.hands = {};
      S.order = [];
      S.board = [];
      S.dealer = { cards: [], hide: false };
      S.dq = null;
      S.res = null;
      S.says = {};
      S.results = null;
      H.sweep();
      H.say("אנטה בבקשה! (הבליינד שווה לאנטה) 🎩");
      H.push();
    });
  }

  const POS_L = [
    [86, 52],
    [70, 72],
    [50, 80],
    [30, 72],
    [14, 52],
  ];
  const POS_P = [
    [83, 54],
    [74, 73],
    [50, 81],
    [26, 73],
    [17, 54],
  ];
  const need = (b) => (b.ante || 0) * 3 + (b.trips || 0);

  C.GAMES.uth = {
    title: "אולטימייט הולדם",
    icon: "🃏",
    seats: 5,
    blurb: "אולטימייט טקסס הולדם מול הדילר: אנטה + בליינד, העלאה ×4 לפני הפלופ, ×2 בפלופ, ×1 בריבר. טריפס עד 50:1.",
    rules: `<ul>
<li>שמים <b>אנטה</b> — ו<b>בליינד</b> בגובה זהה נכנס אוטומטית. אפשר להוסיף הימור צד <b>טריפס</b>. מוודאים שנשאר לפחות עוד אנטה אחד לסיבוב.</li>
<li>כל שחקן מקבל 2 קלפים, הדילר 2 קלפים סגורים. משחקים <b>מול הדילר</b> בלבד, היד הטובה מ-7 קלפים (2 שלכם + 5 על השולחן).</li>
<li><b>לפני הפלופ:</b> צ'ק, או הימור "פליי" של <b>×3 או ×4</b> מהאנטה.</li>
<li><b>אחרי הפלופ</b> (אם עשיתם צ'ק): צ'ק, או פליי של <b>×2</b>.</li>
<li><b>אחרי הטרן והריבר</b> (אם עדיין צ'ק): פליי של <b>×1</b> — או <b>פולד</b> (מפסידים אנטה ובליינד).</li>
<li>אפשר לשים פליי רק פעם אחת ביד.</li>
<li>הדילר <b>מעפיל</b> עם זוג ומעלה. לא מעפיל — האנטה חוזר אליכם, והפליי והבליינד עדיין מול היד שלו.</li>
<li><b>ניצחתם את הדילר:</b> פליי 1:1, אנטה 1:1 (אם הדילר מעפיל), בליינד לפי הטבלה — רצף ומעלה בלבד, אחרת חוזר.</li>
<li><b>הדילר ניצח:</b> הפליי והבליינד הולכים, וגם האנטה אם הדילר מעפיל. <b>תיקו:</b> הכל חוזר.</li>
<li><b>בליינד:</b> ${BLIND_TABLE.map(([a, b]) => `${a} ${b}`).join(" · ")}</li>
<li><b>טריפס</b> (לפי היד שלכם בלבד, גם אם הפסדתם לדילר או עשיתם פולד): ${TRIPS_TABLE.map(([a, b]) => `${a} ${b}`).join(" · ")}</li>
<li>💡 בכל שלב מופיע טיפ לפי האסטרטגיה הבסיסית של המשחק.</li></ul>`,
    init(S, H) {
      S.phase = "bet";
      S.bets = {};
      S.last = {};
      S.hands = {};
      S.order = [];
      S.board = [];
      S.dealer = { cards: [], hide: false };
      S.deck = [];
      S.says = {};
      S.results = null;
      H.say("ברוכים הבאים לאולטימייט! שימו אנטה 🎩");
    },
    status: (V) => (V.phase === "bet" ? "מקבלים הימורים" : "יד בעיצומה"),
    pending: (V, me) => (V.phase === "bet" && V.bets[me] ? V.bets[me].ante * 2 + (V.bets[me].trips || 0) : 0),
    atStake: (V, me) => !!V.hands?.[me] && V.phase !== "bet" && V.phase !== "show",
    onLeave(S, pid, H) {
      delete S.bets[pid];
      if (S.phase === "bet") return true;
      const h = S.hands[pid];
      if (h && !h.fold && S.phase !== "show") {
        h.fold = true;
        h.dec = S.phase;
        if (!pending(S).length && STREET[S.phase]) {
          H.clear("dec");
          H.after(300, () => advance(S, H));
        }
      }
      return S.phase === "show";
    },
    view(S, pid) {
      const hands = {};
      for (const id in S.hands) {
        const h = S.hands[id];
        hands[id] = { ...h, cards: id === pid || S.phase === "show" ? h.cards : h.cards.map(C.hideCard) };
      }
      return {
        ...S,
        deck: undefined,
        hands,
        dealer: { ...S.dealer, cards: S.dealer.hide ? S.dealer.cards.map(C.hideCard) : S.dealer.cards },
        decLeft: S.decAt ? S.decAt - Date.now() : 0,
      };
    },
    act(S, pid, a, H) {
      const p = S.players[pid];
      if (S.phase === "bet") {
        const b = { ...(S.bets[pid] || { ante: 0, trips: 0 }) };
        if (a.a === "ante") b.ante = Math.max(0, Math.floor(+a.amt) || 0);
        else if (a.a === "trips") b.trips = Math.max(0, Math.floor(+a.amt) || 0);
        else if (a.a === "deal") return void (S.bets[pid]?.ante > 0 && deal(S, H));
        else return;
        const old = S.bets[pid] ? S.bets[pid].ante * 2 + (S.bets[pid].trips || 0) : 0;
        const room = p.stack + old;
        if (need(b) > room) {
          if (a.a === "ante") b.ante = Math.max(0, Math.floor((room - (b.trips || 0)) / 3));
          else b.trips = Math.max(0, Math.floor(room - b.ante * 3));
        }
        p.stack = C.r2(room - b.ante * 2 - (b.trips || 0));
        if (b.ante > 0 || b.trips > 0) S.bets[pid] = b;
        else delete S.bets[pid];
        return;
      }
      if (a.a === "dec") decide(S, H, pid, String(a.d));
    },

    mount(ctx) {
      const sc = ctx.scene;
      const tbl = (t, rows) => `<div><b>${t}</b>${rows.map(([a, b]) => `<span><i>${a}</i><em>${b}</em></span>`).join("")}</div>`;
      sc.insertAdjacentHTML(
        "beforeend",
        `<div class="felt bj-felt uth-felt"><div class="felt-print"><b>ULTIMATE TEXAS HOLD'EM</b><span>הדילר מעפיל עם זוג · בליינד עד 500:1 · טריפס עד 50:1</span></div></div>
<div class="uth-pay">${tbl("בליינד", BLIND_TABLE)}${tbl("טריפס", TRIPS_TABLE)}</div>
<div class="uth-mid">
  <div class="uth-dbox"><div class="cards uth-dcards"></div><small class="uth-dl">דילר</small></div>
  <div class="pk-board uth-board"><div class="cards pk-bcards"></div><div class="pk-slots">${"<i></i>".repeat(5)}</div></div>
</div>`,
      );
      ctx.controls.innerHTML = `
<div class="ctl c-bet"><div class="ctl-info"></div><div class="chipbar"></div>
  <div class="pp-row uth-trips"><span>💰 טריפס <small>(עד 50:1)</small>: <b class="mytr">$0</b></span><button data-t="1">+1</button><button data-t="5">+5</button><button data-t="10">+10</button><button data-t="0" class="trclr">✕</button></div>
  <div class="ctl-btns"><button class="btn ghost clr">נקה</button><button class="btn ghost rebet">↺ <span>כמו קודם</span></button><button class="btn gold go">🃏 חלוקה!</button></div></div>
<div class="ctl c-play"><div class="ctl-btns uth-decs"></div></div>
<div class="ctl c-wait"><span class="wait-txt"></span></div>`;
      const c = ctx.controls;
      const my = () => ctx.sess.V?.bets[ctx.me] || { ante: 0, trips: 0 };
      T.chipBar($(".chipbar", c), (v) => ctx.send({ a: "ante", amt: my().ante + v }));
      $(".uth-trips", c).onclick = (e) => {
        const b = e.target.closest("[data-t]");
        if (!b) return;
        C.sfx.play("chip");
        const v = +b.dataset.t;
        ctx.send({ a: "trips", amt: v ? (my().trips || 0) + v : 0 });
      };
      $(".clr", c).onclick = () => {
        ctx.send({ a: "trips", amt: 0 });
        ctx.send({ a: "ante", amt: 0 });
      };
      $(".rebet", c).onclick = () => {
        const l = ctx.sess.V?.last?.[ctx.me];
        if (!l) return;
        ctx.send({ a: "ante", amt: l.ante });
        ctx.send({ a: "trips", amt: l.trips || 0 });
      };
      $(".go", c).onclick = () => ctx.send({ a: "deal" });
      $(".uth-decs", c).onclick = (e) => {
        const b = e.target.closest("[data-d]");
        if (b) ctx.send({ a: "dec", d: b.dataset.d });
      };
    },

    render(ctx, V) {
      const sc = ctx.scene;
      const me = ctx.me;
      const pos = ctx.portrait ? POS_P : POS_L;
      const mySeat = V.players[me]?.seat;
      const show = V.phase === "show";
      const myBest = new Set(show ? V.hands[me]?.best || [] : []);
      const dBest = new Set(show ? V.dq?.best || [] : []);
      for (let i = 0; i < 5; i++) {
        const el = T.seat(sc, i, pos[mySeat == null ? i : (i - mySeat + 7) % 5]);
        const id = V.seats[i];
        const p = id && V.players[id];
        const h = id && V.hands?.[id];
        T.fillSeat(el, p, {
          me: id === me,
          turn: !!h && !h.fold && !h.play && h.dec !== V.phase && !!STREET[V.phase],
          say: V.says?.[id]?.t,
          sayKey: String(V.says?.[id]?.k || ""),
          out: !!h?.fold,
        });
        let cb = $(".uth-cards", el);
        if (!cb) {
          el.insertAdjacentHTML("beforeend", `<div class="cards uth-cards"></div><div class="uth-bets"></div><div class="uth-res"></div>`);
          cb = $(".uth-cards", el);
        }
        T.syncCards(cb, h ? h.cards : [], { mark: id === me && show ? (c) => myBest.has(c.id) : null });
        const b = V.phase === "bet" ? V.bets[id] : h;
        const r = show ? V.res?.[id] : null;
        const pill = (k, lbl, amt) =>
          amt ? `<span class="${k}${r ? (r[k] > 0 ? " won" : r[k] < 0 ? " lost" : " push") : ""}">${lbl} ${C.money(amt)}</span>` : "";
        const bk = JSON.stringify([b, r]);
        const bets = $(".uth-bets", el);
        if (bets.dataset.k !== bk) {
          bets.dataset.k = bk;
          bets.innerHTML = b
            ? pill("ante", "A", b.ante) + pill("blind", "B", V.phase === "bet" ? b.ante : b.blind) + pill("play", "P", b.play) + pill("trips", "T", b.trips)
            : "";
        }
        $(".uth-res", el).textContent = show && h ? (h.fold ? "פולד" : `${h.out === "win" ? "🏆 " : ""}${h.name}`) : "";
        el.classList.toggle("won", show && V.results?.[id] > 0);
        el.classList.toggle("lost", show && V.results?.[id] < 0);
      }
      T.syncCards($(".uth-dcards", sc), V.dealer.cards, { mark: show ? (c) => dBest.has(c.id) : null });
      T.syncCards($(".pk-bcards", sc), V.board || [], {
        stagger: 180,
        mark: show ? (c) => myBest.has(c.id) || (!V.hands[me] && dBest.has(c.id)) : null,
      });
      const dl = $(".uth-dl", sc);
      dl.textContent = show && V.dq ? `דילר: ${V.dq.name} ${V.dq.q ? "✔ מעפיל" : "✖ לא מעפיל"}` : "דילר";
      dl.className = "uth-dl" + (show && V.dq ? (V.dq.q ? " q" : " nq") : "");

      /* כפתורים */
      const c = ctx.controls;
      const P = V.players[me];
      const h = V.hands?.[me];
      const myTurn = !!h && !h.fold && !h.play && h.dec !== V.phase && !!STREET[V.phase];
      let mode = "wait";
      if (V.phase === "bet") mode = "bet";
      else if (myTurn) mode = "play";
      if (c.dataset.mode !== mode) {
        c.dataset.mode = mode;
        if (mode === "play") C.sfx.play("turn");
      }
      if (mode === "bet") {
        const b = V.bets[me] || { ante: 0, trips: 0 };
        $(".mytr", c).textContent = C.money(b.trips || 0);
        $(".trclr", c).hidden = !b.trips;
        $(".go", c).disabled = !b.ante;
        const l = V.last?.[me];
        $(".rebet", c).hidden = !l || (l.ante === b.ante && (l.trips || 0) === (b.trips || 0));
        $(".clr", c).hidden = !b.ante && !b.trips;
        const others = Object.keys(V.bets).filter((id) => id !== me).length;
        $(".ctl-info", c).innerHTML = `אנטה <b>${C.money(b.ante)}</b> + בליינד <b>${C.money(b.ante)}</b>${
          b.ante ? ` <small>· צריך להשאיר עוד ${C.money(b.ante)} לפליי</small>` : " <small>· לחצו על צ'יפ כדי לשים אנטה</small>"
        }${others ? ` <small>· עוד ${others} שחקנים הימרו</small>` : ""}${b.trips && !b.ante ? ` <small class="warn">טריפס משחק רק עם אנטה</small>` : ""}${
          P && P.stack < 1 && !b.ante ? ` <small class="warn">אין כסף על השולחן — לחצו + למעלה</small>` : ""
        }`;
      } else if (mode === "play") {
        const decs = STREET[V.phase];
        const k = V.phase + V.round;
        const box = $(".uth-decs", c);
        if (box.dataset.k !== k) {
          box.dataset.k = k;
          box.innerHTML = decs
            .map((d) => {
              const x = d[0] === "x" ? +d.slice(1) : 0;
              const lbl = { check: "✔ צ'ק", fold: "✖ פולד" }[d] || `${d === "x1" ? "▶ משחק" : "⬆ העלאה"} ×${x} <small>${C.money(h.ante * x)}</small>`;
              return `<button class="btn ${x ? (x >= 3 ? "gold" : "act") : "act"}" data-d="${d}">${lbl}</button>`;
            })
            .join("");
        }
        box.querySelectorAll("[data-d]").forEach((bt) => {
          const x = bt.dataset.d[0] === "x" ? +bt.dataset.d.slice(1) : 0;
          bt.disabled = x > 0 && P.stack < h.ante * x;
        });
        const all = h.cards.concat(V.board);
        const hn = all.length >= 5 ? handName(score(all)) : h.cards[0].r === h.cards[1].r ? `זוג ${R(h.cards[0].r)}` : `${R(Math.max(h.cards[0].r, h.cards[1].r))}-${R(Math.min(h.cards[0].r, h.cards[1].r))}${h.cards[0].s === h.cards[1].s ? " באותו צבע" : ""}`;
        $(".c-play", c).dataset.hint = `היד שלך: ${hn} · ${tip(V.phase, h.cards, V.board)}`;
      } else {
        let t = "";
        if (V.phase === "deal" || V.phase === "dealing") t = "הדילר מחלק…";
        else if (STREET[V.phase]) t = h?.fold ? "עשית פולד — מחכים לסוף היד" : h ? `${h.play ? `הפליי שלך: ${C.money(h.play)} (×${h.x})` : "בחרת"} — מחכים לשאר השחקנים…` : "מחכים לשחקנים…";
        else if (show) {
          const r = V.results?.[me];
          t = h ? `${h.name}${r != null ? ` · ${r > 0 ? `ניצחת ${C.money(r)}! 🎉` : r < 0 ? `הפסדת ${C.money(-r)}` : "הכל חזר אליך"}` : ""}` : "יד חדשה מתחילה עוד רגע…";
        }
        if (V.phase !== "bet" && !h && !show) t += " (אתם ביד הבאה)";
        $(".wait-txt", c).textContent = t;
      }
      if (mode !== "play") delete $(".c-play", c).dataset.hint;
    },
  };
})();
