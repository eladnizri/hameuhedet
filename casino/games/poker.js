/* ===================== פוקר — טקסס הולדם ===================== */
(function () {
  const C = window.Casino;
  const { $ } = C;
  const T = C.T;
  const SB = 1;
  const BB = 2;
  const R = C.RANK;

  /* ===== דירוג יד (5–7 קלפים) ===== */
  const enc = (cat, arr) => {
    let v = cat;
    for (let i = 0; i < 5; i++) v = v * 15 + (arr[i] || 0);
    return v;
  };
  const straightTop = (has) => {
    for (let t = 14; t >= 5; t--) {
      let ok = true;
      for (let k = 0; k < 5 && ok; k++) if (!has[t - k === 1 ? 14 : t - k]) ok = false;
      if (ok) return t;
    }
    return 0;
  };
  function score(cards) {
    const cnt = new Array(15).fill(0);
    const suits = { s: [], h: [], d: [], c: [] };
    for (const c of cards) {
      cnt[c.r]++;
      suits[c.s].push(c.r);
    }
    let fl = null;
    for (const s in suits) if (suits[s].length >= 5) fl = suits[s].sort((a, b) => b - a);
    if (fl) {
      const has = [];
      fl.forEach((r) => (has[r] = 1));
      const t = straightTop(has);
      if (t) return enc(8, [t]);
    }
    const groups = [];
    for (let r = 14; r >= 2; r--) if (cnt[r]) groups.push([cnt[r], r]);
    groups.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const kick = (ex, n) => {
      const out = [];
      for (let r = 14; r >= 2 && out.length < n; r--) if (cnt[r] && !ex.includes(r)) out.push(r);
      return out;
    };
    const [g0, g1] = groups;
    if (g0[0] === 4) return enc(7, [g0[1], ...kick([g0[1]], 1)]);
    if (g0[0] === 3 && g1 && g1[0] >= 2) return enc(6, [g0[1], g1[1]]);
    if (fl) return enc(5, fl.slice(0, 5));
    const has = [];
    for (let r = 2; r <= 14; r++) if (cnt[r]) has[r] = 1;
    const st = straightTop(has);
    if (st) return enc(4, [st]);
    if (g0[0] === 3) return enc(3, [g0[1], ...kick([g0[1]], 2)]);
    if (g0[0] === 2 && g1 && g1[0] === 2) return enc(2, [g0[1], g1[1], ...kick([g0[1], g1[1]], 1)]);
    if (g0[0] === 2) return enc(1, [g0[1], ...kick([g0[1]], 3)]);
    return enc(0, kick([], 5));
  }
  function handName(sc) {
    const cat = Math.floor(sc / 15 ** 5);
    const a = Math.floor(sc / 15 ** 4) % 15;
    const b = Math.floor(sc / 15 ** 3) % 15;
    return [
      `קלף גבוה ${R(a)}`,
      `זוג ${R(a)}`,
      `שני זוגות ${R(a)} ו-${R(b)}`,
      `שלישיית ${R(a)}`,
      `רצף עד ${R(a)}`,
      `צבע (פלאש)`,
      `פול האוס ${R(a)} על ${R(b)}`,
      `רביעיית ${R(a)}`,
      a === 14 ? "רויאל פלאש!!" : "סטרייט פלאש!",
    ][cat];
  }
  /* חמשת הקלפים שיוצרים את היד הכי טובה (להדגשה על השולחן) */
  function best5(cards) {
    let best = -1;
    let pick = [];
    const n = cards.length;
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++)
        for (let c = b + 1; c < n; c++)
          for (let d = c + 1; d < n; d++)
            for (let e = d + 1; e < n; e++) {
              const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
              const s = score(five);
              if (s > best) (best = s), (pick = five);
            }
    return pick.map((c) => c.id);
  }
  /* הסבר מדויק: מה הכריע בין שתי ידיים */
  const digits = (s) => [4, 3, 2, 1, 0].map((i) => Math.floor(s / 15 ** i) % 15);
  function versus(win, lose) {
    const cw = Math.floor(win / 15 ** 5);
    const cl = Math.floor(lose / 15 ** 5);
    if (cw !== cl) return `${handName(win)} גובר על ${handName(lose)}`;
    const a = digits(win);
    const b = digits(lose);
    const i = a.findIndex((v, k) => v !== b[k]);
    if (i < 0) return `${handName(win)} — תיקו`;
    const main = { 0: 1, 1: 1, 2: 2, 3: 1, 4: 1, 5: 0, 6: 2, 7: 1, 8: 1 }[cw];
    if (i < main || cw === 4 || cw === 8) return `${handName(win)} גבוה יותר מ${handName(lose)}`;
    return `${handName(win)} מול ${handName(lose)} — הכריע הקיקר ${R(a[i])} מול ${R(b[i])}`;
  }
  C.PK = { score, handName, best5, versus };
  function equity(hole, board, nOpp, iters = 160) {
    const used = new Set([...hole, ...board].map((c) => c.r + c.s));
    const rest = [];
    for (const s of "shdc") for (let r = 2; r <= 14; r++) if (!used.has(r + s)) rest.push({ r, s });
    const need = 5 - board.length + nOpp * 2;
    let win = 0;
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < need; i++) {
        const j = i + Math.floor(Math.random() * (rest.length - i));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      let k = 5 - board.length;
      const b = board.concat(rest.slice(0, k));
      const mine = score(hole.concat(b));
      let tie = 0;
      let lose = false;
      for (let o = 0; o < nOpp; o++) {
        const s = score([rest[k++], rest[k++], ...b]);
        if (s > mine) {
          lose = true;
          break;
        }
        if (s === mine) tie++;
      }
      if (!lose) win += 1 / (tie + 1);
    }
    return win / iters;
  }

  /* ===== מהלך יד ===== */
  const nextIn = (list, id) => list[(list.indexOf(id) + 1) % list.length];
  const mark = (S, id, t) => {
    S.pk[id].last = t;
    S.pk[id].lk = (S.lk = (S.lk || 0) + 1);
  };
  function post(S, id, amt) {
    const p = S.players[id];
    const k = S.pk[id];
    const a = C.r2(Math.min(amt, p.stack));
    p.stack = C.r2(p.stack - a);
    k.bet = C.r2(k.bet + a);
    k.total = C.r2(k.total + a);
    if (p.stack <= 0) k.allin = true;
  }
  const needsAct = (S, id) => {
    const k = S.pk[id];
    return k && !k.folded && !k.allin && (!k.acted || k.bet < S.curBet);
  };

  const BOT_NAMES = ["שמעון המחשב", "רובו-ריקי", "דודו בוט", "אלגו-אבי", "צ׳יפ", "טורבו טלי", "ביבי-בייט"];
  function addBot(S, H) {
    const used = new Set(Object.values(S.players).map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || "בוט " + C.uid().slice(0, 3);
    const id = H.addBot(name, C.randomLook(), 100);
    if (id) S.players[id].pers = 0.75 + Math.random() * 0.6;
    return id;
  }

  function startHand(S, H) {
    const ids = S.seats.filter((id) => id && S.players[id] && !S.players[id].left && S.players[id].stack > 0);
    if (ids.length < 2 || !ids.some((id) => !S.players[id].bot)) {
      S.phase = "wait";
      S.pk = {};
      S.board = [];
      H.say(ids.length < 2 ? "מחכים לעוד שחקנים…" : "מחכים לשחקן אנושי עם כסף…");
      H.push();
      return;
    }
    S.phase = "hand";
    S.round++;
    S.results = null;
    S.win = null;
    S.why = null;
    S.best = null;
    S.shown = null;
    S.pots = null;
    S.deck = C.deck(1);
    S.board = [];
    S.street = 0;
    S.pk = {};
    S.inHand = ids;
    ids.forEach((id) => (S.pk[id] = { cards: [], bet: 0, total: 0, folded: false, allin: false, acted: false, last: "", lk: 0 }));
    const bs = S.btnSeat ?? -1;
    const btn = ids.find((id) => S.players[id].seat > bs) || ids[0];
    S.btn = btn;
    S.btnSeat = S.players[btn].seat;
    const sb = ids.length === 2 ? btn : nextIn(ids, btn);
    const bb = nextIn(ids, sb);
    post(S, sb, SB);
    post(S, bb, BB);
    mark(S, sb, `בליינד ${C.money(SB)}`);
    mark(S, bb, `בליינד ${C.money(BB)}`);
    S.curBet = BB;
    S.minRaise = BB;
    S.turn = null;
    H.say("יד חדשה! 🃏");
    let t = 250;
    const start = nextIn(ids, btn);
    for (let k = 0; k < 2; k++)
      for (let j = 0; j < ids.length; j++) {
        const id = ids[(ids.indexOf(start) + j) % ids.length];
        H.after((t += 230), () => {
          S.pk[id].cards.push(S.deck.pop());
          H.push();
        });
      }
    H.after(t + 450, () => {
      advance(S, H, bb);
      H.push();
    });
    H.push();
  }

  function advance(S, H, after) {
    H.endTurn();
    S.turn = null;
    const live = S.inHand.filter((id) => !S.pk[id].folded);
    if (live.length === 1) return finish(S, H, null, live);
    const ids = S.inHand;
    const i0 = ids.indexOf(after);
    for (let k = 1; k <= ids.length; k++) {
      const id = ids[(i0 + k) % ids.length];
      if (needsAct(S, id)) {
        S.turn = id;
        const p = S.players[id];
        if (p.bot || p.left) {
          const r = S.round;
          H.after(p.left ? 200 : 700 + Math.random() * 1000, () => {
            if (S.phase === "hand" && S.turn === id && S.round === r) {
              if (p.left) doAct(S, H, id, { a: "fold" });
              else botAct(S, H, id);
              H.push();
            }
          });
        } else
          H.turn(30000, () => {
            doAct(S, H, id, { a: S.pk[id].bet >= S.curBet ? "check" : "fold" });
          });
        return;
      }
    }
    endStreet(S, H);
  }

  function doAct(S, H, id, a) {
    const k = S.pk[id];
    const p = S.players[id];
    const toCall = C.r2(S.curBet - k.bet);
    if (a.a === "fold") {
      k.folded = true;
      mark(S, id, "פולד");
    } else if (a.a === "check") {
      if (toCall > 0) return;
      mark(S, id, "צ׳ק");
    } else if (a.a === "call") {
      if (toCall <= 0) return doAct(S, H, id, { a: "check" });
      post(S, id, toCall);
      mark(S, id, k.allin ? "אול-אין! 🔥" : `קול ${C.money(toCall)}`);
    } else if (a.a === "raise" || a.a === "allin") {
      const max = C.r2(k.bet + p.stack);
      let to = a.a === "allin" ? max : Math.floor(+a.to);
      if (!(to > 0)) return;
      to = Math.min(to, max);
      if (to <= S.curBet) return doAct(S, H, id, { a: "call" });
      const minTo = S.curBet + S.minRaise;
      if (to < minTo) to = Math.min(minTo, max);
      const inc = to - S.curBet;
      post(S, id, to - k.bet);
      if (inc >= S.minRaise) S.minRaise = inc;
      S.curBet = to;
      mark(S, id, k.allin ? "אול-אין! 🔥" : `רייז ל-${C.money(to)}`);
    } else return;
    k.acted = true;
    advance(S, H, id);
  }

  function endStreet(S, H) {
    S.turn = null;
    H.endTurn();
    for (const id of S.inHand) {
      S.pk[id].bet = 0;
      S.pk[id].acted = false;
    }
    S.curBet = 0;
    S.minRaise = BB;
    const live = S.inHand.filter((id) => !S.pk[id].folded);
    if (S.street >= 3) return showdown(S, H, live);
    const runout = live.filter((id) => !S.pk[id].allin).length <= 1;
    if (runout) live.forEach((id) => (S.pk[id].show = true));
    const r = S.round;
    H.after(650, () => {
      if (S.round !== r) return;
      S.street++;
      S.deck.pop();
      if (S.street === 1) S.board.push(S.deck.pop(), S.deck.pop(), S.deck.pop());
      else S.board.push(S.deck.pop());
      H.say(["", "הפלופ 🃏", "הטרן", "הריבר"][S.street]);
      if (runout) H.after(1500, () => S.round === r && endStreet(S, H));
      else advance(S, H, S.btn);
      H.push();
    });
    H.push();
  }

  function showdown(S, H, live) {
    live.forEach((id) => (S.pk[id].show = true));
    const sc = {};
    live.forEach((id) => (sc[id] = score(S.pk[id].cards.concat(S.board))));
    finish(S, H, sc, live);
  }

  /* חלוקת הקופה, כולל קופות צד כשמישהו באול-אין */
  function finish(S, H, sc, live) {
    S.phase = "show";
    S.turn = null;
    H.endTurn();
    const all = S.inHand;
    const levels = [...new Set(all.map((id) => S.pk[id].total).filter((v) => v > 0))].sort((a, b) => a - b);
    let prev = 0;
    const won = {};
    const pots = [];
    for (const lv of levels) {
      let amt = 0;
      for (const id of all) amt += Math.max(0, Math.min(S.pk[id].total, lv) - prev);
      prev = lv;
      amt = C.r2(amt);
      if (!amt) continue;
      let elig = live.filter((id) => S.pk[id].total >= lv);
      if (!elig.length) elig = live;
      const best = Math.max(...elig.map((id) => (sc ? sc[id] : 0)));
      const ws = elig.filter((id) => (sc ? sc[id] : 0) === best);
      const share = Math.floor((amt / ws.length) * 100) / 100;
      const rem = C.r2(amt - share * ws.length);
      ws.forEach((id, i) => (won[id] = C.r2((won[id] || 0) + share + (i ? 0 : rem))));
      /* קופות עם אותם משתתפים ואותם זוכים מאוחדות להצגה */
      const last = pots[pots.length - 1];
      if (last && last.ws.join() === ws.join() && last.n === elig.length) last.amt = C.r2(last.amt + amt);
      else pots.push({ amt, ws, n: elig.length });
    }
    const nm = (id) => S.players[id]?.name || "";
    S.results = {};
    S.why = {};
    S.win = [];
    S.best = {};
    S.shown = {};
    for (const id of all) {
      const p = S.players[id];
      const w = won[id] || 0;
      if (p) p.stack = C.r2(p.stack + w);
      if (p && !p.left) S.results[id] = C.r2(w - S.pk[id].total);
      if (w > 0) S.win.push({ id, amt: w, hand: sc ? handName(sc[id]) : "" });
      S.pk[id].bet = 0;
    }
    if (sc) {
      live.forEach((id) => (S.shown[id] = handName(sc[id])));
      S.win.forEach((w) => (S.best[w.id] = best5(S.pk[w.id].cards.concat(S.board))));
    }
    /* הסבר מדויק לכל שחקן: מי ניצח את מי ולמה */
    const main = pots[0];
    const top = main?.ws[0];
    for (const id of all) {
      if (!S.players[id] || S.players[id].left) continue;
      if (!sc) {
        S.why[id] = won[id] ? "כולם פרשו — הקופה שלך בלי להראות קלפים" : `פרשת — ${nm(live[0])} לקח כשכולם פרשו`;
        continue;
      }
      if (S.pk[id].folded) {
        S.why[id] = `פרשת — ${nm(top)} לקח עם ${handName(sc[top])}`;
        continue;
      }
      const mine = sc[id];
      if (main.ws.includes(id)) {
        const rivals = live.filter((x) => !main.ws.includes(x));
        const second = rivals.length ? Math.max(...rivals.map((x) => sc[x])) : null;
        S.why[id] =
          main.ws.length > 1
            ? `תיקו מוחלט עם ${main.ws.filter((x) => x !== id).map(nm).join(", ")} (${handName(mine)}) — הקופה מתחלקת`
            : second == null
              ? handName(mine)
              : versus(mine, second);
      } else {
        S.why[id] = `${nm(top)}: ${versus(sc[top], mine)}`;
        if (won[id]) S.why[id] += ` · לקחת קופת צד של ${C.money(won[id])}`;
      }
    }
    if (pots.length) {
      const potTxt = (pt, i) => {
        const label = pots.length > 1 ? (i ? "קופת צד" : "הקופה הראשית") : "הקופה";
        return pt.ws.length > 1
          ? `${label} (${C.money(pt.amt)}) מתחלקת: ${pt.ws.map(nm).join(" ו")}`
          : `${nm(pt.ws[0])} לוקח/ת ${label === "הקופה" ? "" : label + " — "}${C.money(pt.amt)}${sc ? " עם " + handName(sc[pt.ws[0]]) : ""}`;
      };
      H.say(pots.map(potTxt).join(" · ") + " 🏆");
      pots.forEach((pt, i) => H.log(potTxt(pt, i)));
    }
    const r = S.round;
    H.after(sc ? 6000 : 3800, () => {
      if (S.round !== r) return;
      H.sweep();
      for (const id of S.seats) {
        const p = id && S.players[id];
        if (p?.bot && p.stack < BB) {
          p.stack = 100;
          H.log(`${p.name} קנה צ'יפים חדשים`);
        }
      }
      startHand(S, H);
    });
    H.push();
  }

  function botAct(S, H, id) {
    const k = S.pk[id];
    const p = S.players[id];
    const toCall = S.curBet - k.bet;
    const live = S.inHand.filter((x) => !S.pk[x].folded);
    const eq = equity(k.cards, S.board, Math.max(1, live.length - 1));
    const pot = S.inHand.reduce((s, x) => s + S.pk[x].total, 0);
    const odds = toCall / (pot + toCall || 1);
    const pers = p.pers || 1;
    const r = Math.random();
    const sized = (f) => S.curBet + Math.max(S.minRaise, Math.round(pot * f));
    let a;
    if (toCall <= 0) {
      if ((eq > 0.6 && r < 0.65 * pers) || r < 0.07 * pers) a = { a: "raise", to: sized(0.45 + Math.random() * 0.5) };
      else a = { a: "check" };
    } else if (eq < odds * 0.95 && r > 0.07 * pers) a = { a: "fold" };
    else if (eq > 0.7 && r < 0.5 * pers) a = { a: "raise", to: sized(0.6 + Math.random() * 0.6) };
    else a = { a: "call" };
    if (a.a === "raise" && a.to >= k.bet + p.stack * 0.8) a = eq > 0.58 ? { a: "allin" } : toCall > 0 ? { a: "call" } : { a: "check" };
    doAct(S, H, id, a);
  }

  /* ===== מיקומים ===== */
  const POS_L = [
    [50, 85],
    [15, 74],
    [8, 40],
    [27, 14],
    [73, 14],
    [92, 40],
    [85, 74],
  ];
  const POS_P = [
    [50, 87],
    [14, 73],
    [11, 44],
    [24, 17],
    [76, 17],
    [89, 44],
    [86, 73],
  ];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  C.GAMES.poker = {
    title: "פוקר",
    icon: "♠️",
    seats: 7,
    blurb: "טקסס הולדם. שני קלפים ביד, חמישה על השולחן — היד הטובה או הבלוף הטוב לוקחים.",
    rules: `<ul>
<li>כל שחקן מקבל 2 קלפים סגורים. על השולחן נפתחים 5 קלפים משותפים: פלופ (3), טרן (1), ריבר (1).</li>
<li>בליינדים: ${C.money(SB)} / ${C.money(BB)}. בכל סיבוב הימורים: <b>פולד</b> (פורשים), <b>צ׳ק</b> (ממשיכים בלי לשים), <b>קול</b> (משווים), <b>רייז</b> (מעלים) או <b>אול-אין</b>.</li>
<li>היד הטובה ביותר מ-5 קלפים (מתוך 7) לוקחת את הקופה. דירוג: קלף גבוה, זוג, שני זוגות, שלישייה, רצף, צבע, פול האוס, רביעייה, סטרייט פלאש.</li>
<li>הדילר הוא המחשב — רק מחלק. אפשר להוסיף <b>בוטים</b> כדי למלא את השולחן.</li>
<li>הכסף שהבאתם לשולחן חוזר לארנק כשקמים.</li></ul>`,
    init(S, H) {
      S.phase = "wait";
      S.pk = {};
      S.board = [];
      S.inHand = [];
      S.deck = [];
      S.curBet = 0;
      S.minRaise = BB;
      S.results = null;
      S.win = null;
      H.say("ברוכים הבאים לשולחן הפוקר ♠️");
    },
    solo(S, H) {
      for (let i = 0; i < 3; i++) addBot(S, H);
      H.say("שלושה בוטים מחכים לכם. לחצו על התחלת יד!");
    },
    status: (V) => (V.phase === "wait" ? "מחכים להתחלת יד" : "יד בעיצומה"),
    atStake: (V, me) => V.phase === "hand" && V.pk[me] && !V.pk[me].folded && V.pk[me].total > 0,
    onLeave(S, id, H) {
      const k = S.pk[id];
      if (S.phase !== "hand" || !k) return S.phase !== "show" || !k;
      if (!k.folded) {
        k.folded = true;
        mark(S, id, "קם מהשולחן");
        if (S.turn === id) advance(S, H, id);
        else {
          const live = S.inHand.filter((x) => !S.pk[x].folded);
          if (live.length === 1) finish(S, H, null, live);
        }
      }
      return false;
    },
    view(S, pid) {
      const pk = {};
      for (const id in S.pk) {
        const k = S.pk[id];
        pk[id] = { ...k, cards: id === pid || k.show ? k.cards : k.cards.map(C.hideCard) };
      }
      const pot = S.phase === "show" ? 0 : Object.values(S.pk).reduce((s, k) => s + k.total, 0);
      return { ...S, deck: undefined, pk, pot: C.r2(pot) };
    },
    act(S, pid, a, H) {
      if (a.a === "start") {
        if (S.phase === "wait") startHand(S, H);
        return;
      }
      if (a.a === "addBot") {
        if (addBot(S, H)) H.log("בוט הצטרף לשולחן 🤖");
        if (S.phase === "wait") H.say("יש מספיק שחקנים? לחצו התחלת יד");
        return;
      }
      if (a.a === "rmBot") {
        const bots = S.seats.filter((id) => id && S.players[id]?.bot && !S.players[id].left);
        const id = bots[bots.length - 1];
        if (!id) return;
        S.players[id].left = true;
        H.log(`${S.players[id].name} עזב את השולחן`);
        if (C.GAMES.poker.onLeave(S, id, H)) H.remove(id);
        return;
      }
      if (S.phase !== "hand" || S.turn !== pid) return;
      doAct(S, H, pid, a);
    },

    mount(ctx) {
      const sc = ctx.scene;
      sc.insertAdjacentHTML(
        "beforeend",
        `<div class="felt pk-felt"><div class="felt-print"><b>TEXAS HOLD'EM</b><span>בליינדים ${C.money(SB)}/${C.money(BB)}</span></div></div>
<div class="pk-board"><div class="cards pk-bcards"></div><div class="pk-slots">${"<i></i>".repeat(5)}</div></div>
<div class="pk-pot"></div><div class="pk-dbtn">D</div>`,
      );
      ctx.controls.innerHTML = `
<div class="ctl c-wait"><span class="wait-txt"></span><div class="ctl-btns"><button class="btn gold start">▶ התחלת יד</button><button class="btn ghost addb">🤖 + בוט</button><button class="btn ghost rmb">🤖 − בוט</button></div></div>
<div class="ctl c-play"><div class="pk-raise"><input type="range" class="rs" min="0" max="1" step="1"><div class="pk-presets"><button data-f="min">מינימום</button><button data-f=".5">½ קופה</button><button data-f="1">קופה</button><button data-f="all">הכל</button></div></div>
<div class="ctl-btns"><button class="btn act fold">✖ פולד</button><button class="btn act call"></button><button class="btn gold raise"></button></div></div>
<div class="ctl c-idle"><span class="wait-txt idle-txt"></span><div class="ctl-btns"><button class="btn ghost addb">🤖 + בוט</button><button class="btn ghost rmb">🤖 − בוט</button></div></div>`;
      const c = ctx.controls;
      $(".start", c).onclick = () => ctx.send({ a: "start" });
      c.querySelectorAll(".addb").forEach((b) => (b.onclick = () => ctx.send({ a: "addBot" })));
      c.querySelectorAll(".rmb").forEach((b) => (b.onclick = () => ctx.send({ a: "rmBot" })));
      $(".fold", c).onclick = () => ctx.send({ a: "fold" });
      $(".call", c).onclick = () => {
        const V = ctx.sess.V;
        ctx.send({ a: V.curBet > (V.pk[ctx.me]?.bet || 0) ? "call" : "check" });
      };
      const rs = $(".rs", c);
      const label = () => {
        const V = ctx.sess.V;
        const max = V ? V.pk[ctx.me].bet + V.players[ctx.me].stack : 0;
        $(".raise", c).textContent = +rs.value >= max ? `🔥 אול-אין ${C.money(max)}` : `⬆ ${V?.curBet ? "רייז ל-" : "בט "}${C.money(+rs.value)}`;
      };
      rs.oninput = label;
      ctx.pkLabel = label;
      $(".pk-presets", c).onclick = (e) => {
        const f = e.target.dataset.f;
        if (!f) return;
        const V = ctx.sess.V;
        const min = +rs.min;
        const max = +rs.max;
        rs.value = f === "min" ? min : f === "all" ? max : C.clamp(Math.round(V.curBet + V.pot * +f), min, max);
        label();
      };
      $(".raise", c).onclick = () => ctx.send({ a: "raise", to: +rs.value });
    },
    render(ctx, V) {
      const sc = ctx.scene;
      const me = ctx.me;
      const pos = ctx.portrait ? POS_P : POS_L;
      const mySeat = V.players[me]?.seat;
      const n = 7;
      const left = V.turnLeft ? V.turnLeft - (Date.now() - V._recv) : 0;
      const winners = new Set((V.win || []).map((w) => w.id));
      const hot = new Set(Object.values(V.best || {}).flat());
      const mark = V.phase === "show" && hot.size ? (c) => hot.has(c.id) : null;
      const center = [50, 46];
      for (let s = 0; s < n; s++) {
        const vis = T.rotate(s, mySeat, n);
        const el = T.seat(sc, s, pos[vis]);
        const id = V.seats[s];
        const p = id && V.players[id];
        const k = id && V.pk[id];
        T.fillSeat(el, p, {
          me: id === me,
          turn: V.turn === id,
          left,
          tk: V.turnK,
          say: k?.last,
          sayKey: k ? String(k.lk) : "",
          out: !!k?.folded || (V.phase === "hand" && p && !k),
        });
        el.classList.toggle("won", winners.has(id));
        let cb = $(".pk-cards", el);
        if (!cb) {
          el.insertAdjacentHTML("beforeend", `<div class="cards pk-cards"></div><div class="pk-hand"></div>`);
          cb = $(".pk-cards", el);
        }
        T.syncCards(cb, k && !(k.folded && id !== me) ? k.cards : [], { mark: winners.has(id) ? mark : null });
        const w = (V.win || []).find((x) => x.id === id);
        const hn = $(".pk-hand", el);
        hn.textContent = V.phase === "show" ? (w ? `🏆 ${w.hand || "לוקח את הקופה"} +${C.money(w.amt)}` : V.shown?.[id] || "") : "";
        hn.classList.toggle("lose", V.phase === "show" && !w);
        /* צ'יפים של הסיבוב — בין המושב לאמצע */
        let bs = sc.querySelector(`.pk-bet[data-i="${s}"]`);
        if (!bs) {
          bs = document.createElement("div");
          bs.className = "pk-bet";
          bs.dataset.i = s;
          sc.appendChild(bs);
        }
        const bp = lerp(pos[vis], center, 0.42);
        bs.style.left = bp[0] + "%";
        bs.style.top = bp[1] + "%";
        const bk = String(k?.bet || 0);
        if (bs.dataset.b !== bk) {
          bs.dataset.b = bk;
          bs.innerHTML = T.chips(k?.bet || 0);
        }
        if (id && id === V.btn && V.phase !== "wait") {
          const dp = lerp(pos[vis], center, 0.27);
          const d = $(".pk-dbtn", sc);
          d.style.left = dp[0] + 4 + "%";
          d.style.top = dp[1] + "%";
        }
      }
      $(".pk-dbtn", sc).hidden = V.phase === "wait" || !V.btn;
      T.syncCards($(".pk-bcards", sc), V.board || [], { stagger: 180, mark });
      $(".pk-pot", sc).innerHTML = V.pot ? `${T.chips(V.pot, false)}<span>קופה <b>${C.money(V.pot)}</b></span>` : "";

      /* כפתורים */
      const c = ctx.controls;
      const P = V.players[me];
      const k = V.pk[me];
      let mode = "idle";
      if (V.phase === "wait") mode = "wait";
      else if (V.phase === "hand" && V.turn === me) mode = "play";
      if (c.dataset.mode !== mode) {
        c.dataset.mode = mode;
        if (mode === "play") C.sfx.play("turn");
      }
      const humans = T.seated(V).filter((id) => !V.players[id].bot);
      const ready = T.seated(V).filter((id) => V.players[id].stack > 0);
      const bots = T.seated(V).length - humans.length;
      c.querySelectorAll(".rmb").forEach((b) => (b.hidden = !bots));
      c.querySelectorAll(".addb").forEach((b) => (b.disabled = T.seated(V).length >= n));
      if (mode === "wait") {
        $(".start", c).disabled = ready.length < 2 || !P || P.stack <= 0;
        $(".wait-txt", c).textContent =
          ready.length < 2
            ? humans.length > 1
              ? "צריך לפחות 2 שחקנים עם כסף"
              : "מחכים לחברים שיצטרפו… או שמוסיפים בוטים 🤖"
            : `${ready.length} שחקנים מוכנים — אפשר להתחיל!`;
        if (P && P.stack <= 0) $(".wait-txt", c).textContent = "נגמר הכסף על השולחן — לחצו + למעלה כדי להביא עוד";
      } else if (mode === "play") {
        const toCall = C.r2(V.curBet - k.bet);
        const max = C.r2(k.bet + P.stack);
        $(".call", c).textContent = toCall > 0 ? (toCall >= P.stack ? `אול-אין ${C.money(max)}` : `קול ${C.money(toCall)}`) : "✔ צ׳ק";
        const rs = $(".rs", c);
        const min = Math.min(V.curBet + V.minRaise, max);
        const canRaise = max > V.curBet && P.stack > toCall;
        $(".pk-raise", c).hidden = !canRaise;
        $(".raise", c).hidden = !canRaise;
        if (rs.dataset.k !== V.turnK + ":" + V.rev) {
          rs.dataset.k = V.turnK + ":" + V.rev;
          rs.min = Math.ceil(min);
          rs.max = Math.floor(max);
          if (+rs.value < +rs.min || +rs.value > +rs.max || rs.dataset.t !== String(V.turnK) + V.round + V.street) rs.value = rs.min;
          rs.dataset.t = String(V.turnK) + V.round + V.street;
          ctx.pkLabel();
        }
      } else {
        let t = "";
        if (V.phase === "hand") {
          if (!k) t = "תצטרפו ביד הבאה";
          else if (k.folded) t = "יצאתם מהיד הזאת";
          else if (V.turn) t = `התור של ${V.players[V.turn]?.name || ""}…`;
          else t = "הדילר מחלק…";
        } else if (V.phase === "show") t = "היד הסתיימה — הבאה מתחילה עוד רגע";
        if (k && k.cards.length === 2 && !k.cards[0].back && !k.folded) {
          const all = k.cards.concat(V.board || []);
          const hn =
            all.length >= 5
              ? handName(score(all))
              : k.cards[0].r === k.cards[1].r
                ? `זוג ${R(k.cards[0].r)}`
                : `${R(Math.max(k.cards[0].r, k.cards[1].r))}-${R(Math.min(k.cards[0].r, k.cards[1].r))}`;
          t += ` · היד שלך: ${hn}`;
        }
        $(".idle-txt", c).textContent = t;
      }
    },
  };
})();
