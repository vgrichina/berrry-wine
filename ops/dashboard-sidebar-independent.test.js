'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const model = require('./blocker-model');
const app = process.argv.find(a => a.startsWith('--app='))?.slice(6) || path.join(__dirname, 'app.js');
const source = fs.readFileSync(app, 'utf8');
const boot = 'paintIcons();\nrefresh();\nsetInterval(refresh, 5000);';
assert(source.trimEnd().endsWith(boot));
const newLines = "  const blockerCounts = BlockerModel.countSummary(state);\n  $('#blocker-count').textContent = blockerCounts.rawBlockedRows ? `${blockerCounts.distinctBlockedTaskIds} distinct IDs${blockerCounts.anonymousBlockedRows ? ` + ${blockerCounts.anonymousBlockedRows} anonymous rows` : ''}` : '';\n  $('#blocker-count').title = BlockerModel.countSummaryText(blockerCounts);";
const oldLine = "  $('#blocker-count').textContent = state.tasks.filter(t => t.status === 'blocked').length || '';";
const baseline = source.replace(newLines, oldLine);

function harness(code = source, sharedModel = model) {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) {
      const values = {};
      const n = {addEventListener() {}};
      for (const key of ['textContent', 'title']) Object.defineProperty(n, key, {
        set(value) { values[key] = String(value); }, get() { return values[key] || ''; },
      });
      if (selector === '#blocker-count') Object.defineProperty(n, 'innerHTML', {
        set() { assert.fail('navigation badge must use DOM text/property assignment'); },
      });
      nodes.set(selector, n);
    }
    return nodes.get(selector);
  };
  const document = {body: {dataset: {}}, querySelector: node, addEventListener() {}};
  const external = Object.fromEntries(['renderChrome', 'renderApprovals', 'homeView', 'gamesView', 'tasksBoard',
    'agentsGrouped', 'activityView', 'moreView', 'dosView'].map(name => [name, () => '<p>external</p>']));
  const ctx = vm.createContext({document, location: {hash: '#blockers'}, window: {addEventListener() {}}, BlockerModel: sharedModel, ...external});
  vm.runInContext(code.slice(0, code.lastIndexOf(boot)), ctx);
  vm.runInContext(`
    morphHtml = (target, html) => { target.rendered = html; };
    stoppedAgentBanner = () => ''; terminalLink = () => '';
    globalThis.paint = (snapshot, route, search) => {
      state = snapshot; view = route; query = search; render();
    };
    globalThis.stats = () => {
      statusSummary = () => ''; currentAgents = () => []; taskRows = () => '';
      visualCards = () => ''; notice = () => ''; return overview();
    };
  `, ctx);
  return {
    draw(tasks, route = 'blockers', search = '', approvals = []) {
      const snapshot = {tasks, candidates: [], agents: [], runs: [], generatedAt: '2026-01-01T00:00:00Z', approvals: {items: approvals}};
      const before = JSON.stringify(snapshot);
      ctx.paint(snapshot, route, search);
      assert.equal(JSON.stringify(snapshot), before);
      return {text: node('#blocker-count').textContent, title: node('#blocker-count').title,
        html: node('#main').rendered, open: node('#task-count').textContent, route: document.body.dataset.view};
    },
    stats: () => ctx.stats(),
  };
}
const row = (id, line, extra = {}) => ({id, line, title: `Task ${line}`, status: 'blocked', ...extra});
function expectCounts(result, distinct, raw, duplicates, anonymous) {
  assert.equal(result.text, raw ? `${distinct} distinct IDs${anonymous ? ` + ${anonymous} anonymous rows` : ''}` : '');
  assert.equal(result.title, `${distinct} distinct blocked task IDs · ${raw} blocked rows · ${duplicates} duplicate-ID blocked rows · ${anonymous} anonymous blocked rows (counted separately)`);
}

test('exact source mutation reconstructs the pinned accepted main sidebar baseline', () => {
  assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'), '8c22bbbd063bb82ea8f3eae5cbcf4a49a52453d1ba1e9b4fc2e1725ad1994502');
});

test('numeric/boolean IDs, exact strings, prototype-looking names and missing forms follow accepted identity', () => {
  const ids = [0, 0, '0', false, false, 'false', '__proto__', '__proto__', 'constructor', 'A', ' A ', 'a',
    undefined, null, '', '\t\n', [], ['x'], ['x']];
  const result = harness().draw(ids.map((id, i) => row(id, i)));
  expectCounts(result, 11, 19, 3, 5);
  assert.equal((result.html.match(/<article class="blocker panel">/g) || []).length, 19);
});

test('hostile ID/title evidence is escaped; navigation tooltip remains a numeric summary', () => {
  const hostile = '\"><img src=x onerror="boom()"> & \' </pre>';
  const result = harness().draw([row(hostile, 1, {title: hostile}), row(hostile, 2, {title: hostile})]);
  expectCounts(result, 1, 2, 1, 0);
  assert(!result.html.includes('<img src=x'));
  assert(result.html.includes('&lt;img src=x'));
  assert(!result.title.includes(hostile));
});

test('tooltip uses literal DOM property assignment even for adversarial summary text', () => {
  const payload = '\" onmouseover=\"boom() <script>&\'';
  const result = harness(source, {...model, countSummaryText: () => payload}).draw([row('SAFE', 1)]);
  assert.equal(result.title, payload);
  assert(!result.html.includes('<script>'));
  assert(result.html.includes('&lt;script&gt;'));
});

test('same snapshot keeps exact baseline detail HTML, classifications, row statistics and open count', () => {
  const tasks = [row('ROOT', 1), row('ROOT', 2), row('CHILD', 3, {dependencies: ['ROOT']}),
    row('A', 4, {dependencies: ['B']}), row('B', 5, {dependencies: ['A']}), row(null, 6),
    row('USER', 7, {waitingOn: 'user input'}), row('CAP', 8, {needs: 'GPU capacity'}),
    row('REVIEW', 9, {waitingOn: 'automated review resolution'}), row('ROOT', 10, {status: 'done'}),
    row('READY', 11, {status: 'ready'}), row('OLD', 12, {status: 'deferred'})];
  const a = harness(), b = harness(baseline);
  for (const query of ['', 'Task 3', 'not-present']) {
    const now = a.draw(tasks, 'blockers', query, [{id: 'pending', sent: false}, {id: 'sent', sent: true}]);
    const old = b.draw(tasks, 'blockers', query, [{id: 'pending', sent: false}, {id: 'sent', sent: true}]);
    assert.equal(now.html, old.html);
    assert.equal(now.open, old.open);
    assert.equal(a.stats(), b.stats());
    expectCounts(now, 7, 9, 1, 1);
  }
});

test('all-cycle fallback retains rows and classifications', () => {
  const tasks = [row('A', 1, {dependencies: ['B']}), row('B', 2, {dependencies: ['A']})];
  const now = harness().draw(tasks), old = harness(baseline).draw(tasks);
  expectCounts(now, 2, 2, 0, 0);
  assert.equal(now.html, old.html);
  assert.equal((now.html.match(/<article class="blocker panel">/g) || []).length, 2);
});

test('route and refresh transitions clear stale anonymous counts and preserve global identity', () => {
  const app = harness();
  for (const route of ['home', 'games', 'tasks', 'agents', 'more', 'blockers', 'invalid-route']) {
    expectCounts(app.draw([row('X', 1), row('X', 2), row(undefined, 3)], route), 1, 3, 1, 1);
    expectCounts(app.draw([row('X', 4, {status: 'active'})], route), 0, 0, 0, 0);
    expectCounts(app.draw([row('\u00a0', 5)], route), 0, 1, 0, 1);
    expectCounts(app.draw([], route), 0, 0, 0, 0);
  }
});

test('deterministic duplicate/status matrix and exact baseline controls across 128 snapshots', () => {
  const ids = ['A', 'A', 'a', ' A ', '', null, undefined, '\n', 'constructor', '__proto__', 0, '0'];
  const statuses = ['blocked', 'blocked', 'active', 'ready', 'done', 'deferred', 'unknown', 'review'];
  const app = harness(), control = harness(baseline);
  for (let seed = 0; seed < 128; seed++) {
    const tasks = Array.from({length: seed % 19}, (_, i) => row(ids[(seed * 7 + i * 5) % ids.length], i,
      {status: statuses[(seed + i * 3) % statuses.length]}));
    const blocked = tasks.filter(t => t.status === 'blocked');
    const named = blocked.filter(t => t.id !== null && t.id !== undefined && String(t.id).trim().length);
    const distinct = new Set(named.map(t => t.id)).size;
    const now = app.draw(tasks), old = control.draw(tasks);
    expectCounts(now, distinct, blocked.length, named.length - distinct, blocked.length - named.length);
    assert.equal(now.html, old.html);
    assert.equal(now.open, old.open);
  }
});
