const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGoalHydrationContext() {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const start = appJs.indexOf('// Remote goals -> apply to UI/state');
  const end = appJs.indexOf('// Remote chores -> apply to UI/state');
  if (start === -1 || end === -1) {
    throw new Error('Unable to locate goal hydration block in app.js');
  }
  const snippet = appJs.slice(start, end);

  const context = {
    window: {},
    state: { goals: [], transactions: [] },
    persistCalls: 0,
    renderGoalsCalls: 0,
    renderSavingsCalls: 0,
    renderHomeCalls: 0,
    idCounter: 0,
    console,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    parseInt,
    parseFloat,
    isFinite,
    setTimeout,
    clearTimeout,
  };

  context.id = () => `goal_${++context.idCounter}`;
  context.persistWithoutSync = () => {
    context.persistCalls += 1;
    context.lastPersisted = JSON.parse(JSON.stringify(context.state));
  };
  context.renderGoals = () => {
    context.renderGoalsCalls += 1;
  };
  context.renderSavings = () => {
    context.renderSavingsCalls += 1;
  };
  context.renderHome = () => {
    context.renderHomeCalls += 1;
  };

  const script = new vm.Script(snippet, { filename: 'app.js-goals-snippet' });
  const sandbox = vm.createContext(context);
  script.runInContext(sandbox);
  return sandbox;
}

function loadApplyPendingContext() {
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const start = mainJs.indexOf('const goalSyncState');
  const end = mainJs.indexOf('function initRealtimeListeners()', start);
  if (start === -1 || end === -1) {
    throw new Error('Unable to locate pending goals helpers in main.js');
  }
  const snippet = mainJs.slice(start, end);

  const context = {
    window: {},
    console,
    JSON,
    Number,
    Object,
    Array,
    Date,
    Math,
    Set,
    Map,
  };

  const script = new vm.Script(snippet, { filename: 'main.js-pending-snippet' });
  const sandbox = vm.createContext(context);
  script.runInContext(sandbox);
  return sandbox;
}

function loadGoalContributionContext() {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  let start = appJs.indexOf('function findStateGoal');
  if (start === -1) {
    start = appJs.indexOf('function renderSavings');
  }
  const end = appJs.indexOf('// ----- Effects -----', start);
  if (start === -1 || end === -1) {
    throw new Error('Unable to locate goal contribution block in app.js');
  }
  const snippet = appJs.slice(start, end);

  const context = {
    window: { __goalsDirty: false },
    state: { currency: '¥', transactions: [], goals: [] },
    console,
    Math,
    Number,
    Date,
    JSON,
    setTimeout,
    clearTimeout,
  };

  context.available = 0;
  context.promptValue = '0';
  context.toasts = [];
  context.addedTx = [];
  context.saveCalls = 0;
  context.renderGoalsCalls = 0;
  context.renderSavingsCalls = 0;
  context.renderHomeCalls = 0;
  context.renderTransactionsCalls = 0;
  context.markCalls = 0;

  context.availableBalance = () => context.available;
  context.toast = (msg) => context.toasts.push(msg);
  context.idCounter = 0;
  context.id = () => `ctx_${++context.idCounter}`;
  context.computeBalance = () => Number(context.currentBalance || 0);
  context.parseAmount = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  context.validAmount = (n) => Number.isFinite(n) && n > 0 && n <= 1_000_000;
  context.sanitizeAmount = (n) => {
    let value = Math.round(Number(n) || 0);
    if (value < 0) value = 0;
    if (value > 1_000_000) value = 1_000_000;
    return value;
  };
  context.money = (n) => `¥${Number(n)}`;
  context.escapeHtml = (s) => String(s);
  context.addTx = (type, amount, note, animateCoin = false) => {
    const tx = {
      id: `tx_${++context.idCounter}`,
      type,
      amount: context.sanitizeAmount(amount),
      note,
      dateISO: new Date().toISOString(),
    };
    context.state.transactions.push(tx);
    context.save();
    context.renderHome();
    context.renderTransactions();
    context.addedTx.push({ type, amount: tx.amount, note, animateCoin });
  };
  context.save = () => {
    context.saveCalls += 1;
  };
  context.renderGoals = () => {
    context.renderGoalsCalls += 1;
  };
  context.renderSavings = () => {
    context.renderSavingsCalls += 1;
  };
  context.renderHome = () => {
    context.renderHomeCalls += 1;
  };
  context.renderTransactions = () => {
    context.renderTransactionsCalls += 1;
  };
  context.confetti = () => {};
  context.markGoalsDirty = () => {
    context.markCalls += 1;
    context.window.__goalsDirty = true;
  };
  context.prompt = () => context.promptValue;
  context.confirm = () => true;
  context.document = {
    getElementById: (id) => {
      if (id === 'savingsList') {
        return {
          innerHTML: '',
          appendChild: () => {},
        };
      }
      if (id === 'savingsSummary') {
        return { textContent: '' };
      }
      if (id === 'balance') {
        return { textContent: '' };
      }
      return { textContent: '' };
    },
    createElement: () => ({
      style: {},
      className: '',
      innerHTML: '',
      textContent: '',
      appendChild: () => {},
      querySelectorAll: () => [{ onclick: null }, { onclick: null }],
    }),
    body: { appendChild: () => {} },
  };

  const script = new vm.Script(snippet, { filename: 'app.js-goal-contribution-snippet' });
  const sandbox = vm.createContext(context);
  script.runInContext(sandbox);

  sandbox.__renderGoalsStub = context.renderGoals;
  sandbox.__renderSavingsStub = context.renderSavings;
  sandbox.__renderHomeStub = context.renderHome;
  sandbox.__renderTransactionsStub = context.renderTransactions;
  sandbox.__markGoalsDirtyStub = context.markGoalsDirty;
  sandbox.__idStub = context.id;
  sandbox.__escapeHtmlStub = context.escapeHtml;
  sandbox.__addTxStub = context.addTx;

  vm.runInContext(
    `renderGoals = __renderGoalsStub;
     renderSavings = __renderSavingsStub;
     renderHome = __renderHomeStub;
     renderTransactions = __renderTransactionsStub;
     markGoalsDirty = __markGoalsDirtyStub;
     id = __idStub;
     escapeHtml = __escapeHtmlStub;
     addTx = __addTxStub;`,
    sandbox
  );

  delete sandbox.__renderGoalsStub;
  delete sandbox.__renderSavingsStub;
  delete sandbox.__renderHomeStub;
  delete sandbox.__renderTransactionsStub;
  delete sandbox.__markGoalsDirtyStub;
  delete sandbox.__idStub;
  delete sandbox.__escapeHtmlStub;
  delete sandbox.__addTxStub;

  return sandbox;
}

test('hydrates remote goals into state and triggers renders', () => {
  const ctx = loadGoalHydrationContext();
  ctx.window.__goalsDirty = false;

  ctx.window.kidsAllowanceHydrateGoals([
    { id: 'g1', name: 'ギター', target: '5000', saved: '120' },
    { id: 'g2', name: 'マンガ', target: 1500, saved: -20 },
  ]);

  assert.equal(ctx.persistCalls, 1, 'persistWithoutSync should run once');
  assert.equal(ctx.renderGoalsCalls, 1, 'renderGoals should run once');
  assert.equal(ctx.renderSavingsCalls, 1, 'renderSavings should run once');
  assert.equal(ctx.renderHomeCalls, 1, 'renderHome should run for remote hydration');

  const hydrated = JSON.parse(JSON.stringify(ctx.state.goals));
  assert.deepEqual(hydrated, [
    { id: 'g1', name: 'ギター', target: 5000, saved: 120 },
    { id: 'g2', name: 'マンガ', target: 1500, saved: 0 },
  ]);
  assert.equal(ctx.window.__goalsDirty, false);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.__KA_STATE.goals)), hydrated);
});

test('defers hydration while goals are dirty and replays later', () => {
  const ctx = loadGoalHydrationContext();
  ctx.state.goals = [{ id: 'existing', name: 'レゴ', target: 2000, saved: 300 }];
  ctx.window.__goalsDirty = true;

  ctx.window.kidsAllowanceHydrateGoals([{ id: 'pending', name: 'Switch', target: 25000, saved: 100 }]);

  assert.equal(ctx.persistCalls, 0, 'should not persist while dirty');
  assert.equal(ctx.renderGoalsCalls, 0, 'should not render while dirty');
  assert.ok(Array.isArray(ctx.window.__pendingGoalsAfterSync), 'pending goals should be queued');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.state.goals)), [{ id: 'existing', name: 'レゴ', target: 2000, saved: 300 }]);

  ctx.window.__goalsDirty = false;
  const pending = ctx.window.__pendingGoalsAfterSync;
  ctx.window.kidsAllowanceHydrateGoals(pending);

  assert.equal(ctx.persistCalls, 1, 'persist should run after replay');
  assert.equal(ctx.renderGoalsCalls, 1, 'renderGoals should run after replay');
  assert.equal(ctx.renderSavingsCalls, 1, 'renderSavings should run after replay');
  assert.equal(ctx.renderHomeCalls, 1, 'renderHome should run after replay');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.state.goals)), [{ id: 'pending', name: 'Switch', target: 25000, saved: 100 }]);
  assert.equal(ctx.window.__pendingGoalsAfterSync, undefined, 'pending queue should clear');
});

test('applyGoalsDirectly skips home render for local imports', () => {
  const ctx = loadGoalHydrationContext();
  ctx.window.__goalsDirty = false;

  ctx.window.applyGoalsDirectly([
    { id: 'local', name: 'ノートPC', target: 80000, saved: 5000 },
  ]);

  assert.equal(ctx.persistCalls, 1);
  // render helpers are stubbed in this harness, so we only ensure the call did not throw.
  assert.equal(ctx.renderHomeCalls, 0, 'local apply should not trigger home render');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.state.goals)), [{ id: 'local', name: 'ノートPC', target: 80000, saved: 5000 }]);
});

test('applyPendingGoalsAfterSync tolerates newer server version when payload matches', () => {
  const ctx = loadApplyPendingContext();
  const payload = [
    { id: 'g1', name: 'ギター', target: 5000, saved: 0 },
    { id: 'g2', name: 'マンガ', target: 1500, saved: 200 },
  ];

  ctx.window.__pendingGoalsAfterSync = JSON.parse(JSON.stringify(payload));
  ctx.window.__pendingGoalsVersion = 3;
  ctx.window.__latestServerGoalsVersion = 5;
  ctx.window.__latestServerGoalsKey = ctx.fingerprintGoals(payload);

  let applied;
  ctx.window.kidsAllowanceApplyGoals = (list) => {
    applied = JSON.parse(JSON.stringify(list));
  };

  const result = ctx.applyPendingGoalsAfterSync();

  assert.equal(result, true);
  assert.deepEqual(applied, payload);
  assert.equal(ctx.window.__pendingGoalsAfterSync, undefined);
  assert.equal(ctx.window.__pendingGoalsVersion, undefined);
});

test('applyPendingGoalsAfterSync keeps queue when snapshot diverges', () => {
  const ctx = loadApplyPendingContext();
  const pending = [{ id: 'g1', name: 'ギター', target: 5000, saved: 0 }];
  const latest = [{ id: 'g1', name: 'ギター', target: 5000, saved: 300 }];

  ctx.window.__pendingGoalsAfterSync = JSON.parse(JSON.stringify(pending));
  ctx.window.__pendingGoalsVersion = 2;
  ctx.window.__latestServerGoalsVersion = 3;
  ctx.window.__latestServerGoalsKey = ctx.fingerprintGoals(latest);

  let applied = false;
  ctx.window.kidsAllowanceApplyGoals = () => {
    applied = true;
  };

  const result = ctx.applyPendingGoalsAfterSync();

  assert.equal(result, false);
  assert.equal(applied, false);
  assert.deepEqual(ctx.window.__pendingGoalsAfterSync, pending, 'pending payload should remain for future attempts');
  assert.equal(ctx.window.__pendingGoalsVersion, 2);
});

test('applyPendingGoalsAfterSync drops pending snapshot when last sync differs', () => {
  const ctx = loadApplyPendingContext();
  const pending = [{ id: 'g1', name: 'おもちゃ', target: 2000, saved: 0 }];
  const synced = [{ id: 'g1', name: 'おもちゃ', target: 2000, saved: 500 }];

  ctx.window.__pendingGoalsAfterSync = JSON.parse(JSON.stringify(pending));
  ctx.window.__pendingGoalsVersion = 4;
  ctx.window.__latestServerGoalsVersion = 4;
  ctx.window.__latestServerGoalsKey = ctx.fingerprintGoals(pending);
  ctx.window.__lastSyncedGoalsKey = ctx.fingerprintGoals(synced);

  let applied = false;
  ctx.window.kidsAllowanceApplyGoals = () => {
    applied = true;
  };

  const result = ctx.applyPendingGoalsAfterSync();

  assert.equal(result, false);
  assert.equal(applied, false);
  assert.equal(ctx.window.__pendingGoalsAfterSync, undefined, 'stale pending payload should be cleared');
  assert.equal(ctx.window.__pendingGoalsVersion, undefined, 'stale pending version should be cleared');
});

test('buildGoalsPayload preserves updatedAt and removal ids', () => {
  const ctx = loadApplyPendingContext();
  const originalNow = ctx.Date.now;
  ctx.Date.now = () => 4242;

  ctx.updateServerGoalSnapshot([
    { id: 'keep', name: 'Switch', target: 3000, saved: 500, updatedAt: 1111 },
    { id: 'drop', name: '古い', target: 1000, saved: 0, updatedAt: 900 },
  ]);

  const localInput = [
    { id: 'keep', name: 'Switch', target: '3500', saved: '800', updatedAt: 2222 },
    { id: 'new', name: 'ギター', target: '5000', saved: '0' },
  ];

  const { payload, removals } = ctx.buildGoalsPayload(localInput, [' drop', '', null, 'drop']);
  const plainPayload = JSON.parse(JSON.stringify(payload));

  assert.deepEqual(plainPayload, [
    { id: 'keep', name: 'Switch', target: 3500, saved: 800, updatedAt: 2222 },
    { id: 'new', name: 'ギター', target: 5000, saved: 0, updatedAt: 4242 },
  ]);
  assert.deepEqual(removals, ['drop']);

  ctx.updateServerGoalSnapshot(payload, { merge: true, removals });
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.getServerGoalSnapshot())), plainPayload);

  ctx.Date.now = originalNow;
});

test('getPendingGoalRemovalIds drops active goal ids from the queue', () => {
  const ctx = loadApplyPendingContext();
  ctx.window.__goalRemovalQueue = ['keep', 'remove', 'keep', ''];

  const pending = ctx.getPendingGoalRemovalIds([
    { id: 'keep', name: 'Switch' },
    { id: 'still-here', name: 'Guitar' },
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(pending)), ['remove']);
  assert.deepEqual(
    JSON.parse(JSON.stringify(ctx.window.__goalRemovalQueue)),
    ['remove']
  );
});

test('contributeToGoal marks goals dirty and increases savings', () => {
  const ctx = loadGoalContributionContext();
  const goal = { id: 'g1', name: 'ギター', target: 5000, saved: 0 };
  ctx.state.goals = [goal];
  ctx.available = 5000;
  ctx.promptValue = '3000';

  const beforeLen = ctx.state.transactions.length;
  ctx.contributeToGoal(goal);

  assert.equal(goal.saved, 3000);
  assert.equal(ctx.window.__goalsDirty, true);
  assert.ok(ctx.markCalls >= 1);
  assert.ok(ctx.saveCalls >= 2);
  assert.equal(ctx.state.transactions.length, beforeLen + 1);
  const tx = ctx.state.transactions[ctx.state.transactions.length - 1];
  assert.equal(tx.type, 'goal');
  assert.equal(tx.amount, 3000);
  assert.equal(tx.note, 'ちょきん: ギター');
});

test('contributeToGoal updates canonical state when handler receives cloned goal', () => {
  const ctx = loadGoalContributionContext();
  const source = { id: 'g1', name: 'ギター', target: 5000, saved: 1000 };
  ctx.state.goals = [JSON.parse(JSON.stringify(source))];
  const cloned = JSON.parse(JSON.stringify(source));
  ctx.available = 5000;
  ctx.promptValue = '3000';

  ctx.contributeToGoal(cloned);

  assert.equal(ctx.state.goals[0].saved, 4000);
  assert.equal(cloned.saved, 4000);
});

test('withdrawFromGoal marks goals dirty and decreases savings', () => {
  const ctx = loadGoalContributionContext();
  const goal = { id: 'g1', name: 'ギター', target: 5000, saved: 4000 };
  ctx.state.goals = [goal];
  ctx.promptValue = '1000';

  const beforeLen = ctx.state.transactions.length;
  ctx.withdrawFromGoal(goal, false);

  assert.equal(goal.saved, 3000);
  assert.equal(ctx.window.__goalsDirty, true);
  assert.ok(ctx.markCalls >= 1);
  assert.ok(ctx.saveCalls >= 2);
  assert.equal(ctx.state.transactions.length, beforeLen + 1);
  const tx = ctx.state.transactions[ctx.state.transactions.length - 1];
  assert.equal(tx.type, 'income');
  assert.equal(tx.amount, 1000);
  assert.equal(tx.note, 'もどす: ギター');
  // render helpers are stubbed in this harness, so we only ensure the calls did not throw.
});

test('withdrawFromGoal writes back to canonical state when using cloned goal object', () => {
  const ctx = loadGoalContributionContext();
  const source = { id: 'g1', name: 'ギター', target: 5000, saved: 4000 };
  ctx.state.goals = [JSON.parse(JSON.stringify(source))];
  const cloned = JSON.parse(JSON.stringify(source));
  ctx.promptValue = '1000';

  ctx.withdrawFromGoal(cloned, false);

  assert.equal(ctx.state.goals[0].saved, 3000);
  assert.equal(cloned.saved, 3000);
});
