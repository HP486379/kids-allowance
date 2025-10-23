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
  assert.equal(ctx.renderGoalsCalls, 1);
  assert.equal(ctx.renderSavingsCalls, 1);
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
