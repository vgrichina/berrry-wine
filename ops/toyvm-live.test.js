'use strict';
// The ToyVM launch state machine (ops/toyvm-live/live.js) with fake time and
// fake fetches: the 500 ms dialog rule, real byte percentages, manifest sha256
// checks, cancel and retry. No browser, no ToyVM.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createLauncher, DIALOG_DELAY_MS, formatBytes } = require('./toyvm-live/live.js');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function harness({ files, runtimeMs = 0, chunk = 4, failAt = null, status = 200, statusText = '' } = {}) {
  let now = 0; const timers = [];
  const clock = {
    setTimeout(fn, ms) { const t = { at: now + ms, fn, dead: false }; timers.push(t); return t; },
    clearTimeout(t) { if (t) t.dead = true; },
    async advance(ms) { const end = now + ms; for (;;) { const due = timers.filter((t) => !t.dead && t.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; now = due.at; due.dead = true; due.fn(); await flush(); } now = end; await flush(); },
  };
  const flush = () => new Promise((r) => setImmediate(r));
  const events = [];
  const body = (bytes, signal) => {
    let i = 0;
    return { getReader: () => ({ read: async () => { if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' }); if (i >= bytes.length) return { done: true }; const v = bytes.subarray(i, i + chunk); i += chunk; return { done: false, value: v }; } }) };
  };
  const byUrl = new Map(files.map((f) => [f.url, f]));
  let runtimeResolve;
  const deps = {
    now: () => now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    fetch: async (url, { signal }) => {
      const f = byUrl.get(url);
      if (failAt === url) return { ok: false, status, text: async () => statusText };
      return { ok: true, status: 200, body: body(f.bytes, signal) };
    },
    digest: async (bytes) => crypto.createHash('sha256').update(bytes).digest(),
    loadRuntime: () => runtimeMs ? new Promise((r) => { runtimeResolve = r; }) : Promise.resolve(),
    start: async (map) => { events.push(['start', Object.keys(map)]); return { stop() { events.push(['stop']); } }; },
    ui: {
      showDialog: () => events.push(['show']), hideDialog: () => events.push(['hide']),
      phase: (p) => events.push(['phase', p.id, p.percent, p.received, p.total]),
      error: (e) => events.push(['error', e.message]), ready: () => events.push(['ready']),
      running: () => events.push(['running']), cancelled: () => events.push(['cancelled']),
    },
  };
  return { deps, clock, events, flush, releaseRuntime: () => runtimeResolve && runtimeResolve() };
}
const mk = (name, text, over = {}) => { const bytes = Buffer.from(text); return { path: name, url: '/f/' + name, size: bytes.length, sha256: sha(bytes), bytes, ...over }; };

test('mount keeps full manifest paths and distinct same-basename bytes', async () => {
  const files = ['DATA', 'FLICS', 'GFX', 'LFX', 'SFX'].map(d => mk(d + '/DATA.FIL', d));
  const h = harness({ files }); let mounted;
  h.deps.start = async map => { mounted = map; return { stop() {} }; };
  const l = createLauncher({ files }, h.deps); await l.launch();
  assert.equal(l.state, 'running');
  assert.deepEqual(Object.keys(mounted), files.map(f => f.path));
  for (const f of files) assert.equal(Buffer.from(mounted[f.path]).toString(), f.path.split('/')[0]);
});

test('ambiguous and escaping manifests fail before runtime, fetch or mount', async () => {
  for (const names of [['DATA.FIL', 'data.fil'], ['DATA.FIL', 'DATA.FIL.'], ['DATA', 'data/FILE'],
    ['../file'], ['/file'], ['C:/file'], ['data//file'], ['data\\file'], ['data/./file'], ['file\0']]) {
    const files = names.map(n => mk(n, 'x')), h = harness({ files });
    h.deps.loadRuntime = h.deps.fetch = h.deps.start = () => assert.fail('invalid manifest reached an effect');
    const l = createLauncher({ files }, h.deps); await l.launch();
    assert.equal(l.state, 'error', names.join(','));
  }
});

test('explicit original-file overlay mounts at its guest name; collisions are refused', async () => {
  const files = [mk('__support/save/PARTY.SAV', 'original', { guestPath: 'PARTY.SAV' }), mk('DATA/PARTY.SAV', 'different')];
  const h = harness({ files }); let mounted;
  h.deps.start = async map => { mounted = map; return { stop() {} }; };
  await createLauncher({ files }, h.deps).launch();
  assert.deepEqual(Object.keys(mounted), ['PARTY.SAV', 'DATA/PARTY.SAV']);
  assert.equal(Buffer.from(mounted['PARTY.SAV']).toString(), 'original');
  for (const guestPath of ['../PARTY.SAV', '/PARTY.SAV', 'DATA/PARTY.SAV']) {
    files[0].guestPath = guestPath;
    const denied = harness({ files });
    denied.deps.loadRuntime = () => assert.fail('invalid guest path reached runtime');
    const launcher = createLauncher({ files }, denied.deps); await launcher.launch();
    assert.equal(launcher.state, 'error');
  }
});

test('a launch that finishes inside 500 ms never shows the dialog', async () => {
  const files = [mk('GAME.COM', 'ABCDEFGH')];
  const h = harness({ files });
  const l = createLauncher({ files }, h.deps);
  await l.launch(); await h.flush();
  assert.equal(l.state, 'running');
  assert.ok(!h.events.some((e) => e[0] === 'show'), JSON.stringify(h.events));
  assert.deepEqual(h.events.find((e) => e[0] === 'start'), ['start', ['GAME.COM']]);
});

test('a slow launch shows the dialog at 500 ms, not before, and hides it when running', async () => {
  const files = [mk('GAME.COM', 'ABCDEFGH')];
  const h = harness({ files, runtimeMs: 1 });
  const l = createLauncher({ files }, h.deps);
  const p = l.launch();
  await h.clock.advance(DIALOG_DELAY_MS - 1);
  assert.ok(!h.events.some((e) => e[0] === 'show'), 'shown before 500 ms');
  await h.clock.advance(1);
  assert.ok(h.events.some((e) => e[0] === 'show'), 'not shown at 500 ms');
  h.releaseRuntime(); await p; await h.flush();
  assert.equal(l.state, 'running');
  assert.ok(h.events.findIndex((e) => e[0] === 'hide') > h.events.findIndex((e) => e[0] === 'show'));
});

test('download percentages are bytes received over the manifest total, monotonic, ending at 100', async () => {
  const files = [mk('A.DAT', 'x'.repeat(10)), mk('B.DAT', 'y'.repeat(30))];
  const h = harness({ files, chunk: 5 });
  await createLauncher({ files }, h.deps).launch();
  const dl = h.events.filter((e) => e[0] === 'phase' && e[1] === 'download');
  assert.ok(dl.every((e) => e[4] === 40), 'total is the manifest sum');
  const pct = dl.map((e) => e[2]);
  assert.deepEqual(pct, [...pct].sort((a, b) => a - b), 'monotonic');
  assert.equal(pct.at(-1), 100); assert.equal(dl.at(-1)[3], 40);
  assert.ok(h.events.some((e) => e[0] === 'phase' && e[1] === 'verify'));
});

test('a file whose sha256 differs from the manifest stops the launch with a named error', async () => {
  const files = [mk('GAME.COM', 'ABCD', { sha256: '0'.repeat(64) })];
  const h = harness({ files });
  const l = createLauncher({ files }, h.deps);
  await l.launch();
  assert.equal(l.state, 'error');
  assert.match(h.events.find((e) => e[0] === 'error')[1], /GAME\.COM does not match its manifest sha256/);
  assert.ok(!h.events.some((e) => e[0] === 'start'));
});

test('a short body is refused rather than mounted', async () => {
  const files = [mk('GAME.COM', 'ABCD', { size: 99 })];
  const h = harness({ files });
  await createLauncher({ files }, h.deps).launch();
  assert.match(h.events.find((e) => e[0] === 'error')[1], /received 4 bytes, the manifest says 99/);
});

test('an expired session (401) says so; Retry then succeeds', async () => {
  const files = [mk('GAME.COM', 'ABCD')];
  const h = harness({ files, failAt: '/f/GAME.COM', status: 401 });
  const l = createLauncher({ files }, h.deps);
  await l.launch();
  assert.match(h.events.find((e) => e[0] === 'error')[1], /session has expired/);
  h.deps.fetch = (orig => async (u, o) => ({ ok: true, status: 200, body: { getReader: () => { let d = false; return { read: async () => d ? { done: true } : (d = true, { done: false, value: files[0].bytes }) }; } } }))(h.deps.fetch);
  await l.retry();
  assert.equal(l.state, 'running');
});

test('Cancel during loading aborts, reports cancelled, never starts, and hides the dialog', async () => {
  const files = [mk('GAME.COM', 'ABCD')];
  const h = harness({ files, runtimeMs: 1 });
  const l = createLauncher({ files }, h.deps);
  const p = l.launch();
  await h.clock.advance(600);
  assert.equal(l.cancel(), true);
  h.releaseRuntime(); await p; await h.flush();
  assert.equal(l.state, 'idle');
  assert.ok(h.events.some((e) => e[0] === 'cancelled'));
  assert.ok(h.events.some((e) => e[0] === 'hide'));
  assert.ok(!h.events.some((e) => e[0] === 'start' || e[0] === 'running'));
  assert.equal(l.cancel(), false, 'nothing left to cancel');
});

test('bytes are formatted without invented precision', () => {
  assert.equal(formatBytes(512), '512 B'); assert.equal(formatBytes(2048), '2.0 KB'); assert.equal(formatBytes(5 * 1048576), '5.0 MB'); assert.equal(formatBytes(NaN), '?');
});
