const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extractFunction(source, name, { fromEnd = false } = {}) {
  const signature = `function ${name}`;
  const matchIndex = fromEnd ? source.lastIndexOf(signature) : source.indexOf(signature);
  if (matchIndex === -1) {
    throw new Error(`Unable to locate function ${name}`);
  }
  const bodyStart = source.indexOf('{', matchIndex);
  if (bodyStart === -1) {
    throw new Error(`Unable to parse body for ${name}`);
  }
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(matchIndex, i + 1);
      }
    }
  }
  throw new Error(`Unterminated function ${name}`);
}

test('deleteTx syncs balance updates and supports undo', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const formatSrc = extractFunction(appJs, 'format');
  const moneySrc = extractFunction(appJs, 'money');
  const sanitizeAmountSrc = extractFunction(appJs, 'sanitizeAmount');
  const computeBalanceSrc = extractFunction(appJs, 'computeBalance');
  const signForKindSrc = extractFunction(appJs, '_signForKind');
  const fpSrc = extractFunction(appJs, '_fp');
  const loadDeletedSrc = extractFunction(appJs, '_loadDeletedSet');
  const saveDeletedSrc = extractFunction(appJs, '_saveDeletedSet');
  const deleteTxSrc = extractFunction(appJs, 'deleteTx', { fromEnd: true });

  const scriptSource = `
    const LS_KEY = 'kid-allowance-v1';
    ${formatSrc}
    ${moneySrc}
    ${sanitizeAmountSrc}
    ${computeBalanceSrc}
    ${signForKindSrc}
    ${fpSrc}
    ${loadDeletedSrc}
    ${saveDeletedSrc}
    let META = { currentId: 'profile1' };
    function pidKey(id){ return 'profile:' + id; }
    function renderTransactions(){ window.__renderTransactionsCalled = true; }
    function renderHome(){ window.__renderHomeCalled = true; }
    function toastAction(){ window.__undoCallback = arguments[2]; }
    function toast(){ window.__toastCalled = true; }
    function save(){ window.__saveCalls = (window.__saveCalls || 0) + 1; }
    let state = { currency: '¥', transactions: [] };
    let _undoTimer = null; let _lastDeletedTx = null;
    ${deleteTxSrc}
    window.__testDeleteTx = deleteTx;
    window.__testState = state;
    window.__getState = () => state;
  `;

  const context = {
    window: {},
    localStorage: {
      _store: new Map(),
      getItem(key) {
        return this._store.has(key) ? this._store.get(key) : null;
      },
      setItem(key, value) {
        this._store.set(key, String(value));
      },
      removeItem(key) {
        this._store.delete(key);
      },
    },
    document: {
      getElementById() {
        return {
          _value: '',
          get textContent() {
            return this._value;
          },
          set textContent(val) {
            this._value = val;
          },
        };
      },
    },
    console,
    Math,
    JSON,
    Number,
    String,
    Array,
    Date,
    setTimeout,
    clearTimeout,
  };

  context.confirmCalls = 0;
  context.confirm = () => {
    context.confirmCalls += 1;
    return true;
  };

  context.window.kidsAllowanceUpdateBalance = (st) => {
    context.window.__updateCalls = (context.window.__updateCalls || 0) + 1;
    context.window.__lastBalanceState = JSON.parse(JSON.stringify(st));
  };

  const script = new vm.Script(scriptSource, { filename: 'app-deleteTx-snippet' });
  const sandbox = vm.createContext(context);
  script.runInContext(sandbox);

  const tx = { id: 'tx1', type: 'expense', amount: 350, note: 'おもちゃ', dateISO: '2024-01-01T00:00:00.000Z' };
  const initialState = context.window.__getState();
  initialState.transactions = [tx];
  context.window.__saveCalls = 0;
  context.window.__updateCalls = 0;

  context.window.__testDeleteTx('tx1');

  assert.equal(context.confirmCalls, 1, 'confirm should be requested once');
  assert.equal(context.window.__getState().transactions.length, 0, 'transaction should be removed');
  assert.equal(context.window.__saveCalls, 1, 'save should run after deletion');
  assert.equal(context.window.__updateCalls, 1, 'balance update should be triggered');
  assert.ok(typeof context.window.__undoCallback === 'function', 'undo callback should be provided');

  context.window.__undoCallback();

  assert.equal(context.window.__getState().transactions.length, 1, 'undo should restore the transaction');
  assert.equal(context.window.__saveCalls, 2, 'save should run after undo');
  assert.equal(context.window.__updateCalls, 2, 'balance update should rerun after undo');
});
