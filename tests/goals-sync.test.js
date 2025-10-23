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
