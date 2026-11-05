'use strict';
// Merged navigation: retired classic hashes redirect into Home / Tasks / Agents, and
// agent titles become short readable names instead of a raw clipped goal prompt.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const boot = 'paintIcons();\nrefresh();\nsetInterval(refresh, 5000);';

function load(hash) {
  const replaced = [];
  const node = () => ({addEventListener() {}, dataset: {}, textContent: '', title: ''});
  const document = {body: {dataset: {}}, querySelector: node, addEventListener() {}};
  const ctx = vm.createContext({document, location: {hash}, window: {addEventListener() {}},
    history: {replaceState: (_s, _t, url) => replaced.push(url)}, BlockerModel: require('./blocker-model')});
  vm.runInContext(source.slice(0, source.lastIndexOf(boot)), ctx);
  return {replaced, run: code => vm.runInContext(code, ctx)};
}

test('retired hashes canonicalize to the merged views', () => {
  const {run} = load('#home');
  const cases = {overview: 'home', tasklist: 'tasks/all', blockers: 'tasks/blocked', agentlist: 'agents/list',
    '': 'home', tasks: 'tasks', 'tasks/needs': 'tasks/needs', corpus: 'corpus'};
  for (const [hash, canon] of Object.entries(cases)) assert.equal(run(`route(${JSON.stringify(hash)}).canon`), canon, hash);
  assert.deepEqual(JSON.parse(run(`JSON.stringify(route('blockers'))`)), {base: 'tasks', sub: 'blocked', canon: 'tasks/blocked'});
});

// Loading app.js runs applyHash() once before the boot lines, as a page load does.
test('a legacy hash is rewritten in place on load without adding history', () => {
  for (const [hash, canon] of [['#overview', 'home'], ['#tasklist', 'tasks/all'], ['#blockers', 'tasks/blocked'], ['#agentlist', 'agents/list']]) {
    const {run, replaced} = load(hash);
    assert.equal(run('view'), canon);
    assert.deepEqual(replaced, ['#' + canon]);
  }
  const {run, replaced} = load('#tasks/ready');
  assert.equal(run('view'), 'tasks/ready');
  assert.deepEqual(replaced, [], 'a canonical hash is left alone');
});

test('lane ids and clipped goal prompts become short readable titles', () => {
  const {run} = load('#home');
  const title = s => run(`readableTitle(${JSON.stringify(s)})`);
  assert.equal(run(`humanizeLane('mdk2-native-tracked-original-20261105')`), 'Mdk2: native tracked original');
  assert.equal(run(`humanizeLane('Plain words stay')`), 'Plain words stay');
  const clipped = 'Goal: keep two new games moving toward playable gameplay with screenshots and verified FPS measurements across every renderer that the corpus currentl';
  const t = title(clipped);
  assert.ok(t.length <= 91, t);
  assert.ok(!/^Goal:/.test(t), t);
  assert.ok(t.endsWith('…'), t);
  assert.ok(clipped.replace(/^Goal: /, '').toLowerCase().startsWith(t.slice(0, -1).trimEnd().toLowerCase()), 'cut at a word boundary: ' + t);
  assert.equal(title('[codex] Task: Fix the MSPaint tool palette repaint. Then verify every screen.'), 'Fix the MSPaint tool palette repaint');
  assert.equal(title('Ship it. Short.'), 'Ship it. Short.', 'a sentence under 20 characters is not split off');
});
