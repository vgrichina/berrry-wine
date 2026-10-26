'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const model = require('./blocker-model');

// Optional immutable source lets the same assertions demonstrate the original bug.
const sourcePath = process.argv.find(arg => arg.startsWith('--app='))?.slice(6) || path.join(__dirname, 'app.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const boot = 'paintIcons();\nrefresh();\nsetInterval(refresh, 5000);';
assert(source.trimEnd().endsWith(boot), 'only the automatic browser/network boot is omitted');
const task = (id, line, extra = {}) => ({id, line, title: `Synthetic row ${line}`, status: 'blocked', ...extra});

function dashboard() {
  const nodes = new Map();
  const document = {
    body: {dataset: {}},
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, {textContent: '', title: '', addEventListener() {}});
      return nodes.get(selector);
    },
    addEventListener() {},
  };
  const ctx = vm.createContext({document, location: {hash: '#blockers'}, window: {addEventListener() {}},
    BlockerModel: model, renderChrome() {}, renderApprovals() {},
    homeView() {}, gamesView() {}, tasksBoard() {}, agentsGrouped() {}, activityView() {}, moreView() {}, dosView() {}});
  vm.runInContext(source.slice(0, source.lastIndexOf(boot)), ctx);
  // Exercise the actual render entry point, detail view and row rendering.
  // Only DOM morphing and unrelated surfaces are replaced; no network or browser.
  vm.runInContext(`
    morphHtml = (target, html) => { target.html = html; };
    stoppedAgentBanner = () => '';
    terminalLink = () => '';
    globalThis.draw = (snapshot, search = '') => {
      state = snapshot; query = search; view = 'blockers'; render();
      return document.querySelector('#main').html;
    };
    globalThis.statusStats = () => {
      statusSummary = () => ''; currentAgents = () => []; taskRows = () => '';
      visualCards = () => ''; notice = () => '';
      return overview();
    };
  `, ctx);
  return {
    draw(tasks, search = '', approvals = []) {
      const snapshot = {tasks, candidates: [], agents: [], runs: [], generatedAt: '2026-01-01T00:00:00Z', approvals: {items: approvals}};
      const before = JSON.stringify(snapshot);
      const html = ctx.draw(snapshot, search);
      assert.equal(JSON.stringify(snapshot), before, 'render must retain every input row and classification field');
      return {html, badge: nodes.get('#blocker-count'), taskCount: nodes.get('#task-count').textContent};
    },
    statusStats: () => ctx.statusStats(),
  };
}

function check(result, label, counts) {
  const detailLabel = model.countSummaryText(counts);
  assert.equal(result.badge.textContent, label);
  assert.equal(result.badge.title, detailLabel, 'sidebar and detail use the same accepted summary text');
  assert(result.html.includes(`<p class="lead">${detailLabel}</p>`), 'detail retains exact count labels');
}

test('duplicate blocked IDs count once in navigation while detail and status statistics retain rows', () => {
  const tasks = [task('ALPHA', 1), task('ALPHA', 2), task('BETA', 3), task('ALPHA', 4, {status: 'done'})];
  const app = dashboard();
  const result = app.draw(tasks);
  check(result, '2 distinct IDs', {distinctBlockedTaskIds: 2, rawBlockedRows: 3, duplicateBlockedRows: 1, anonymousBlockedRows: 0});
  assert.equal(result.taskCount, 3, 'open-task statistic still counts rows');
  assert.match(app.statusStats(), /value task-label-blocked">3<\/div>/, 'ledger status statistic still counts rows');
});

test('anonymous-only blocked rows remain visible separately, including all accepted missing-ID forms', () => {
  const tasks = [task(undefined, 1), task(null, 2), task('', 3), task('  ', 4)];
  const result = dashboard().draw(tasks);
  check(result, '0 distinct IDs + 4 anonymous rows', {distinctBlockedTaskIds: 0, rawBlockedRows: 4, duplicateBlockedRows: 0, anonymousBlockedRows: 4});
  assert.match(result.html, /4 agent-resolvable · 0 dependent rows/);
  assert.equal((result.html.match(/<article class="blocker panel">/g) || []).length, 4);
});

test('mixed statuses and exact IDs use only blocked evidence; query does not change global navigation counts', () => {
  const tasks = [task('ID', 1), task('ID', 2), task('id', 3), task(' ID ', 4), task(undefined, 5),
    task('ID', 6, {status: 'active'}), task('OTHER', 7, {status: 'ready'}), task(null, 8, {status: 'done'}),
    task('', 9, {status: 'deferred'}), task('UNKNOWN', 10, {status: 'unknown'})];
  const app = dashboard();
  const expected = {distinctBlockedTaskIds: 3, rawBlockedRows: 5, duplicateBlockedRows: 1, anonymousBlockedRows: 1};
  check(app.draw(tasks), '3 distinct IDs + 1 anonymous rows', expected);
  check(app.draw(tasks, 'no-synthetic-row-matches'), '3 distinct IDs + 1 anonymous rows', expected);
});

test('empty and nonblocked snapshots clear stale navigation text while preserving explicit zero detail labels', () => {
  const app = dashboard();
  app.draw([task('OLD', 1), task(null, 2)]);
  const zero = {distinctBlockedTaskIds: 0, rawBlockedRows: 0, duplicateBlockedRows: 0, anonymousBlockedRows: 0};
  check(app.draw([]), '', zero);
  check(app.draw([task('READY', 1, {status: 'ready'}), task(null, 2, {status: 'done'})]), '', zero);
  check(app.draw([task('NEW', 1)]), '1 distinct IDs', {distinctBlockedTaskIds: 1, rawBlockedRows: 1, duplicateBlockedRows: 0, anonymousBlockedRows: 0});
});

test('deduplicated navigation leaves user, agent, dependency and live-approval row classifications unchanged', () => {
  const tasks = [task('ROOT', 1), task('ROOT', 2), task('USER', 3, {waitingOn: 'user input'}),
    task(undefined, 4), task('CHILD', 5, {dependencies: ['ROOT']})];
  const result = dashboard().draw(tasks, '', [{id: 'LIVE', sent: false}, {id: 'SENT', sent: true}]);
  check(result, '3 distinct IDs + 1 anonymous rows', {distinctBlockedTaskIds: 3, rawBlockedRows: 5, duplicateBlockedRows: 1, anonymousBlockedRows: 1});
  assert.match(result.html, /1 live approvals · 1 need your input · 3 agent-resolvable · 1 dependent rows \(filtered row classifications; not current eligibility\)/);
  assert.equal((result.html.match(/<article class="blocker panel">/g) || []).length, 4, 'duplicate roots and anonymous root remain rendered');
});
