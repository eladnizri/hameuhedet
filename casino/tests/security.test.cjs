const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const flush = () => new Promise((resolve) => setImmediate(resolve));

function environment(disk = new Map(), lock = { busy: false }) {
  const storage = new Map();
  let elapsed = 0;
  const indexedDB = {
    open() {
      const request = {};
      const database = {
        transaction() {
          const transaction = {
            objectStore() {
              return {
                get(key) {
                  const result = {};
                  queueMicrotask(() => {
                    result.result = structuredClone(disk.get(key));
                    result.onsuccess?.();
                  });
                  return result;
                },
                put(value, key) {
                  disk.set(key, structuredClone(value));
                  queueMicrotask(() => transaction.oncomplete?.());
                },
              };
            },
          };
          return transaction;
        },
      };
      queueMicrotask(() => {
        request.result = database;
        request.onsuccess();
      });
      return request;
    },
  };
  const context = vm.createContext({
    window: {}, indexedDB, crypto: webcrypto, console, queueMicrotask,
    performance: { now: () => elapsed },
    setTimeout, clearTimeout, setInterval, clearInterval,
    navigator: {
      locks: {
        request(name, options, callback) {
          const available = !lock.busy;
          if (available) lock.busy = true;
          return Promise.resolve(callback(available ? {} : null));
        },
      },
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  context.window.indexedDB = indexedDB;
  const load = (file) => vm.runInContext(readFileSync(path.join(root, file), "utf8"), context);
  load("core.js");
  const casino = context.window.Casino;
  casino.toast = () => {};
  return { casino, storage, load, lock, disk, tick(milliseconds) { elapsed += milliseconds; } };
}

function table(env, bank = 80, buyin = 20) {
  env.load("table.js");
  const casino = env.casino;
  casino.cleanLook = (look) => look || {};
  casino.randomLook = () => ({});
  casino.GAMES.test = {
    seats: 5,
    init(state) { state.bets = {}; },
    pending: (state, id) => state.bets[id] || 0,
    atStake: (state) => !!state.locked,
    act(state) { state.actions = (state.actions || 0) + 1; },
  };
  const session = new casino.Session({ key: "test", game: "test" }, "solo");
  session.role = "host";
  session.selfId = "me";
  session.render = (view) => { session.V = view; };
  session.close = () => { session.closed = true; };
  session.hostInit();
  session.addPlayer("me", { name: "Player", bank, buyin });
  return session;
}

function blackjack(solo = false) {
  const env = environment();
  table(env);
  env.load("games/bj.js");
  const game = env.casino.GAMES.bj;
  const state = {
    solo, round: 0,
    players: { first: { name: "First", stack: 100 }, second: { name: "Second", stack: 100 } },
    seats: solo ? ["first", null, null, null, null] : ["first", "second", null, null, null],
  };
  const tasks = [];
  let now = 0;
  const host = {
    say() {}, push() {}, log() {}, clear() {}, sweep() {}, turn() {}, endTurn() {},
    after(delay, callback) { tasks.push({ at: now + delay, callback }); },
  };
  game.init(state, host);
  return {
    state,
    act(id, action) { game.act(state, id, action, host); },
    leave(id) { state.players[id].left = true; game.onLeave(state, id, host); },
    step() {
      tasks.sort((first, second) => first.at - second.at);
      const task = tasks.shift();
      assert.ok(task);
      now = task.at;
      task.callback();
    },
  };
}

test("shared blackjack deals only after all seated players bet and confirm", () => {
  const game = blackjack();
  game.act("first", { a: "bet", amt: 5 });
  game.act("first", { a: "deal" });
  assert.equal(game.state.phase, "bet");
  game.act("first", { a: "ready", ready: true });
  game.act("first", { a: "ready", ready: true });
  game.act("second", { a: "ready", ready: true });
  assert.equal(game.state.phase, "bet");
  game.act("second", { a: "bet", amt: 10 });
  assert.equal(game.state.phase, "bet");
  game.act("second", { a: "ready", ready: true });
  assert.equal(game.state.phase, "deal");
  assert.equal(game.state.round, 1);
  assert.equal(Object.keys(game.state.ready).length, 0);
  game.act("second", { a: "ready", ready: true });
  assert.equal(game.state.round, 1);
});

test("blackjack bet changes, side-bet changes and cancellation clear readiness", () => {
  const game = blackjack();
  game.act("first", { a: "bet", amt: 5 });
  game.act("first", { a: "ready", ready: true });
  game.act("first", { a: "bet", amt: 10 });
  assert.ok(!game.state.ready.first);
  game.act("first", { a: "ready", ready: true });
  game.act("first", { a: "pp", amt: 1 });
  assert.ok(!game.state.ready.first);
  game.act("first", { a: "ready", ready: true });
  game.act("first", { a: "ready", ready: false });
  assert.ok(!game.state.ready.first);
  game.act("second", { a: "bet", amt: 5 });
  game.act("second", { a: "ready", ready: true });
  assert.equal(game.state.phase, "bet");
  game.act("first", { a: "ready", ready: true });
  assert.equal(game.state.phase, "deal");
});

test("blackjack rechecks readiness when an unready player leaves", () => {
  const game = blackjack();
  game.act("first", { a: "bet", amt: 5 });
  game.act("first", { a: "ready", ready: true });
  game.leave("second");
  assert.equal(game.state.phase, "deal");
  assert.deepEqual(Array.from(game.state.order), ["first"]);
});

test("a new blackjack player must also confirm before auto-deal", () => {
  const game = blackjack();
  game.act("first", { a: "bet", amt: 5 });
  game.act("first", { a: "ready", ready: true });
  game.state.players.third = { name: "Third", stack: 100 };
  game.state.seats[2] = "third";
  game.act("second", { a: "bet", amt: 5 });
  game.act("second", { a: "ready", ready: true });
  assert.equal(game.state.phase, "bet");
  game.act("third", { a: "bet", amt: 5 });
  game.act("third", { a: "ready", ready: true });
  assert.equal(game.state.phase, "deal");
});

test("solo blackjack still deals immediately and resets ready state next round", () => {
  const game = blackjack(true);
  game.act("first", { a: "bet", amt: 5 });
  game.act("first", { a: "deal" });
  assert.equal(game.state.phase, "deal");
  for (let step = 0; step < 100 && game.state.phase !== "bet"; step++) {
    while (game.state.phase === "play" && game.state.cur)
      game.act(game.state.cur.pid, { a: "stand" });
    game.step();
  }
  assert.equal(game.state.phase, "bet");
  assert.equal(Object.keys(game.state.ready).length, 0);
});

test("wallet ignores forged localStorage cash and stale holds", async () => {
  const env = environment();
  env.storage.set("hmh-casino-wallet-v1", JSON.stringify({ cash: 99999999 }));
  env.storage.set("hmh-casino-holds-v1", JSON.stringify({ fake: { stack: 99999999, ts: 0 } }));
  await env.casino.wallet.init();
  assert.equal(env.casino.wallet.cash, 100);
  env.storage.set("hmh-casino-wallet-v1", JSON.stringify({ cash: 100000 }));
  assert.equal(env.casino.wallet.cash, 100);
  assert.equal(env.casino.wallet.held, 0);
});

test("wallet cap includes held money and rejects non-finite credits", async () => {
  const { casino } = environment();
  casino.profile = { get: () => ({ name: "עומרי" }) };
  await casino.wallet.init();
  casino.wallet.add(-50);
  casino.wallet.hold("table", 50);
  casino.wallet.add(1000000);
  assert.equal(casino.wallet.cash + casino.wallet.held, 100000);
  casino.wallet.add(Infinity);
  casino.wallet.add(NaN);
  casino.wallet.add("90000");
  assert.equal(casino.wallet.cash + casino.wallet.held, 100000);
  casino.wallet.hold("table", Infinity);
  assert.equal(casino.wallet.held, 0);
});

test("exact Omri name gets a one-time capped bonus", async () => {
  const { casino, disk } = environment();
  await casino.wallet.init();
  casino.wallet.grantName("not עומרי");
  assert.equal(casino.wallet.cash, 100);
  casino.wallet.grantName("עומרי");
  assert.equal(casino.wallet.cash, 100000);
  casino.wallet.add(-500);
  casino.wallet.grantName("עומרי");
  assert.equal(casino.wallet.cash, 99500);
  await flush();
  const reopened = environment(disk);
  await reopened.casino.wallet.init();
  reopened.casino.wallet.grantName("עומרי");
  assert.equal(reopened.casino.wallet.cash, 99500);
});

test("broc receives a persistent 10000 bonus without repeated appearance refills", async () => {
  const env = environment();
  env.load("avatar.js");
  const { casino } = env;
  await casino.wallet.init();
  casino.profile.set({ name: "BROC", look: {} });
  assert.equal(casino.wallet.cash, 100);
  casino.profile.set({ name: "broc", look: {} });
  assert.equal(casino.wallet.cash, 10000);
  casino.wallet.add(-500);
  casino.profile.set({ name: "broc", look: {} });
  assert.equal(casino.wallet.cash, 9500);
  await flush();
  const reopened = environment(env.disk);
  await reopened.casino.wallet.init();
  reopened.casino.wallet.grantName("broc");
  assert.equal(reopened.casino.wallet.cash, 9500);
  casino.profile.set({ name: "Other", look: {} });
  casino.profile.set({ name: "broc", look: {} });
  assert.equal(casino.wallet.cash, 10000);
});

test("broc bonus includes held funds and never reduces a higher balance", async () => {
  const env = environment();
  const wallet = env.casino.wallet;
  await wallet.init();
  wallet.add(-50);
  wallet.hold("table", 50);
  wallet.grantName("broc");
  assert.equal(wallet.cash + wallet.held, 10000);
  wallet.grantName("עומרי");
  wallet.grantName("broc");
  assert.equal(wallet.cash + wallet.held, 100000);
});

test("changing from Omri to broc resets the old bonus then grants 10000", async () => {
  const env = environment();
  env.load("avatar.js");
  await env.casino.wallet.init();
  env.casino.profile.set({ name: "עומרי", look: {} });
  assert.equal(env.casino.wallet.cash, 100000);
  env.casino.profile.set({ name: "broc", look: {} });
  assert.equal(env.casino.wallet.cash, 10000);
});

test("renaming Omri resets cash and table funds, closes the table and persists the reset", async () => {
  const env = environment();
  env.load("avatar.js");
  const { casino } = env;
  await casino.wallet.init();
  casino.profile.set({ name: "עומרי", look: {} });
  casino.wallet.grantName("עומרי");
  casino.wallet.add(-50000);
  casino.wallet.hold("table", 50000);
  let closed = false;
  casino.T = { session: { close() { closed = true; casino.wallet.release(); } } };
  casino.profile.set({ name: "Other", look: {} });
  assert.equal(closed, true);
  assert.equal(casino.profile.get().name, "Other");
  assert.equal(casino.wallet.cash, 100);
  assert.equal(casino.wallet.held, 0);
  await flush();
  const reopened = environment(env.disk);
  await reopened.casino.wallet.init();
  assert.equal(reopened.casino.wallet.cash, 100);
  casino.profile.set({ name: "עומרי", look: {} });
  assert.equal(casino.wallet.cash, 100000);
  casino.profile.set({ name: "Another", look: {} });
  assert.equal(casino.wallet.cash, 100);
  casino.profile.set({ name: "עומרי", look: {} });
  assert.equal(casino.wallet.cash, 100000);
});

test("saving Omri's appearance or renaming other players does not reset money", async () => {
  const env = environment();
  env.load("avatar.js");
  const { casino } = env;
  await casino.wallet.init();
  casino.profile.set({ name: "עומרי", look: {} });
  casino.wallet.grantName("עומרי");
  casino.wallet.add(-500);
  casino.profile.set({ name: " עומרי ", look: {} });
  assert.equal(casino.wallet.cash, 99500);
  casino.profile.set({ name: "Other", look: {} });
  casino.wallet.add(-20);
  casino.profile.set({ name: "Another", look: {} });
  assert.equal(casino.wallet.cash, 80);
});

test("persisted wallet restores a held stack once and rejects a second active tab", async () => {
  const env = environment();
  await env.casino.wallet.init();
  await assert.rejects(environment(env.disk, env.lock).casino.wallet.init(), /already open/);
  env.casino.wallet.add(-40);
  env.casino.wallet.hold("table", 40);
  await flush();
  const next = environment(env.disk);
  await next.casino.wallet.init();
  assert.equal(next.casino.wallet.cash, 100);
  assert.equal(next.casino.wallet.held, 0);
  await flush();
  const reopened = environment(env.disk);
  await reopened.casino.wallet.init();
  assert.equal(reopened.casino.wallet.cash, 100);
});

test("no broke refill while a wager is outstanding", async () => {
  const { casino } = environment();
  await casino.wallet.init();
  casino.wallet.add(-100);
  casino.T = { session: { V: {}, selfId: "me", G: { atStake: () => true } } };
  assert.equal(casino.wallet.refillIfBroke(), false);
  assert.equal(casino.wallet.cash, 0);
  casino.T.session = null;
  assert.equal(casino.wallet.refillIfBroke(), true);
  assert.equal(casino.wallet.cash, 100);
});

test("one bot per session, including after removal", () => {
  const session = table(environment());
  const first = session.H.addBot("bot", {}, 100);
  assert.ok(first);
  assert.equal(session.H.addBot("another", {}, 100), null);
  session.removePlayer(first);
  assert.equal(session.H.addBot("replacement", {}, 100), null);
});

test("poker and roulette solo games each create exactly one bot", () => {
  const env = environment();
  table(env);
  env.load("games/poker.js");
  env.load("games/roulette.js");
  for (const game of ["poker", "roulette"]) {
    const session = new env.casino.Session({ key: game, game }, "solo");
    session.hostInit();
    session.G.solo(session.S, session.H);
    session.G.solo(session.S, session.H);
    assert.equal(Object.values(session.S.players).filter((player) => player.bot).length, 1);
  }
});

test("topup cannot mint a refill during a locked wager", async () => {
  const session = table(environment(), 0, 0);
  session.S.locked = true;
  session.hostAct("me", { a: "topup", amt: 100 });
  await flush();
  assert.equal(session.S.players.me.stack, 0);
  session.S.locked = false;
  session.hostAct("me", { a: "topup", amt: 100 });
  await flush();
  assert.equal(session.S.players.me.stack, 100);
});

test("topup consumes host budget instead of minting replayable money", async () => {
  const session = table(environment());
  session.hostAct("me", { a: "topup", amt: 50 });
  session.hostAct("me", { a: "topup", amt: 50 });
  assert.equal(session.S.players.me.stack, 70);
  assert.equal(session.S.players.me.bank, 30);
  session.hostAct("me", { a: "topup", amt: 30 });
  session.hostAct("me", { a: "topup", amt: 100 });
  await flush();
  assert.equal(session.S.players.me.stack, 100);
  assert.equal(session.S.players.me.bank, 0);
  assert.equal(session.V.players.me.bank, undefined);
});

test("host rejects invalid actions and clamps buyins, winnings and pending balances", async () => {
  const session = table(environment(), 100, 99999999);
  session.S.players.me.name = "עומרי";
  assert.equal(session.S.players.me.stack, 100000);
  for (const amt of [Infinity, NaN, -10, "100", 100001]) session.hostAct("me", { a: "bet", amt });
  assert.equal(session.S.actions, undefined);
  session.S.players.me.stack = 500000;
  session.S.players.me.bank = 500;
  session.S.bets.me = 100;
  session.push();
  await flush();
  assert.equal(session.S.players.me.stack, 99400);
  session.hostAct("unknown", { a: "topup", amt: 100 });
});

test("unexplained wallet credit resets to 100, but legitimate cash-out is preserved", async () => {
  const { casino } = environment();
  await casino.wallet.init();
  casino.wallet.add(99900);
  assert.equal(casino.wallet.cash, 100);
  casino.wallet.add(-100);
  casino.T = { session: { selfId: "me", V: { players: { me: { stack: 50000 } } }, G: {} } };
  casino.wallet.hold("table", 50000);
  casino.wallet.release();
  assert.equal(casino.wallet.cash, 50000);
  assert.equal(casino.wallet.release(), 0);
});

test("forged held balance cannot become a legitimate cash-out", async () => {
  const { casino } = environment();
  await casino.wallet.init();
  casino.wallet.hold("fake-table", 100000);
  assert.equal(casino.wallet.held, 0);
  assert.equal(casino.wallet.cash, 100);
  assert.equal(casino.wallet.release(), 0);
});

test("unexplained table balance jump closes the session and resets the wallet", async () => {
  const env = environment();
  await env.casino.wallet.init();
  const session = table(env, 0, 100);
  session.S.players.me.stack = 100000;
  session.push();
  await flush();
  assert.equal(session.closed, true);
  assert.equal(env.casino.wallet.cash, 100);
  assert.equal(env.casino.wallet.held, 0);
});

test("large game payouts are approved instead of triggering a jump reset", async () => {
  const env = environment();
  const session = table(env, 0, 100);
  session.G.act = (state) => { state.players.me.stack = 100000; };
  session.hostAct("me", { a: "settle" });
  await flush();
  assert.ok(!session.closed);
  assert.equal(session.S.players.me.stack, 100000);
});

test("delayed game payouts are approved before the next broadcast", async () => {
  const session = table(environment(), 0, 100);
  await new Promise((resolve) => session.H.after(0, () => {
    session.S.players.me.stack = 50000;
    session.H.push();
    resolve();
  }));
  await flush();
  assert.ok(!session.closed);
  assert.equal(session.V.players.me.stack, 50000);
});

test("remote unexplained jump notifies and removes only the flagged player", async () => {
  const session = table(environment(), 0, 100);
  const messages = [];
  session.room = { conns: new Map(), sendTo: (id, message) => messages.push({ id, message }) };
  session.addPlayer("remote", { name: "Other", bank: 0, buyin: 100 });
  session.S.players.remote.stack = 100000;
  session.push();
  await flush();
  assert.ok(!session.closed);
  assert.equal(session.S.players.remote, undefined);
  assert.equal(messages[0].id, "remote");
  assert.equal(messages[0].message.t, "balance-reset");
  assert.equal(session.S.players.me.stack, 100);
});

test("Omri is exempt from the table jump reset but still capped", async () => {
  const session = table(environment(), 0, 100);
  session.S.players.me.name = "עומרי";
  session.S.players.me.stack = 1000000;
  session.push();
  await flush();
  assert.ok(!session.closed);
  assert.equal(session.S.players.me.stack, 100000);
});

test("cigarette reward pays once only after the full duration, and cancellation pays nothing", async () => {
  const env = environment();
  const wallet = env.casino.wallet;
  await wallet.init();
  assert.equal(wallet.finishCigarette(), 0);
  assert.equal(wallet.startCigarette(), true);
  assert.equal(wallet.startCigarette(), false);
  env.tick(9999);
  assert.equal(wallet.finishCigarette(), 0);
  env.tick(1);
  assert.equal(wallet.finishCigarette(), 100);
  assert.equal(wallet.cash, 200);
  assert.equal(wallet.finishCigarette(), 0);
  assert.equal(wallet.startCigarette(), true);
  wallet.cancelCigarette();
  env.tick(10000);
  assert.equal(wallet.finishCigarette(), 0);
  assert.equal(wallet.cash, 200);
});

test("cigarette reward respects the total cap and cannot start at a game table", async () => {
  const env = environment();
  const wallet = env.casino.wallet;
  await wallet.init();
  wallet.grantName("עומרי");
  wallet.add(-50);
  assert.equal(wallet.startCigarette(), true);
  env.tick(10000);
  assert.equal(wallet.finishCigarette(), 50);
  assert.equal(wallet.cash, 100000);
  env.casino.T = { session: {} };
  assert.equal(wallet.startCigarette(), false);
});