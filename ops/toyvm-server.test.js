'use strict';
// The /toyvm route over a temporary repository: a closed namespace, payload
// files only for a launchable title and only paths its manifest lists, size
// drift refused, blocked titles explained. No ToyVM or browser runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { createToyvmHandler, launchable } = require('./toyvm-server');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-route-'));
  const w = (rel, data) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), data); };
  const game = Buffer.from('GAMEBYTES'), data = Buffer.from('DATA');
  w('payload/ok/GAME.COM', game); w('payload/ok/DATA.DAT', data); w('payload/ok/SECRET.TXT', 'not listed');
  w('payload/blocked/FALL.EXE', 'MZ');
  w('outside.txt', 'private');
  const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
  w('test/toyvm-dos-corpus/manifest.json', JSON.stringify({ toyvmFacts: { 'no-dpmi': { text: 'no DPMI', cite: 'dos.js' } }, titles: [
    { id: 'ok', title: 'Ok Game', gameDir: 'payload/ok', entry: { program: 'GAME.COM', args: '' }, payload: { present: true }, toyvm: { status: 'untested', verdict: 'Untested.', blockers: [], cautions: [] } },
    { id: 'blocked', title: 'Blocked Game', gameDir: 'payload/blocked', entry: { program: 'FALL.EXE', args: 'Z.CFG' }, payload: { present: true }, toyvm: { status: 'blocked', verdict: 'Not expected to run.', blockers: [{ id: 'extender', text: 'needs DPMI', facts: ['no-dpmi'] }], cautions: [] } },
    { id: 'absent', title: 'Absent', gameDir: 'payload/none', entry: { program: 'X.EXE' }, payload: { present: false }, toyvm: { status: 'unknown', blockers: [], cautions: [] } },
  ] }));
  w('test/toyvm-dos-corpus/files/ok.json', JSON.stringify({ files: [{ path: 'GAME.COM', size: game.length, sha256: sha(game), load: 'preload' }, { path: 'DATA.DAT', size: data.length, sha256: sha(data), load: 'preload' }] }));
  w('test/toyvm-dos-corpus/files/blocked.json', JSON.stringify({ files: [{ path: 'FALL.EXE', size: 2, sha256: sha(Buffer.from('MZ')), load: 'preload' }] }));
  w('ops/toyvm-live/index.html', '<!doctype html><main id="toyvm-app"></main>');
  w('ops/toyvm-live/live.js', '/*live*/'); w('ops/toyvm-live/live.css', '/*css*/');
  w('docs/dos-corpus/live/toyvm-bundle.js', '/*bundle*/');
  return root;
}
async function withServer(root, fn) {
  const serve = createToyvmHandler(root);
  const server = http.createServer(async (req, res) => { if (!(await serve(req, res))) { res.writeHead(599); res.end('fallthrough'); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  // A raw request path: a URL string would be normalized by the client and
  // never send `..` at all, which is exactly what an attacker can do.
  const port = server.address().port;
  const get = (p, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method }, (res) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(c).toString() })); });
    req.on('error', reject); req.end();
  });
  try { await fn(get); } finally { server.close(); }
}

test('only launchable = untested, payload present, no blockers', () => {
  assert.equal(launchable({ payload: { present: true }, toyvm: { status: 'untested', blockers: [] } }), true);
  assert.equal(launchable({ payload: { present: true }, toyvm: { status: 'blocked', blockers: [{}] } }), false);
  assert.equal(launchable({ payload: { present: false }, toyvm: { status: 'untested', blockers: [] } }), false);
});

test('pages and runtime come from the allowlist with ToyVM headers; other paths do not', async () => {
  const root = fixture();
  await withServer(root, async (get) => {
    const page = await get('/toyvm/');
    assert.equal(page.status, 200); assert.match(page.headers['content-type'], /text\/html/);
    assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.match(page.headers['content-security-policy'], /script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'/);
    assert.equal(page.headers['cross-origin-opener-policy'], 'same-origin');
    assert.equal((await get('/toyvm/runtime/toyvm-bundle.js')).body, '/*bundle*/');
    assert.equal((await get('/toyvm')).status, 308);
    assert.equal((await get('/toyvm/../outside.txt')).status, 403);
    assert.equal((await get('/toyvm/%2e%2e/outside.txt')).status, 403);
    assert.equal((await get('/toyvm/ops%2ftoyvm-server.js')).status, 403);
    assert.equal((await get('/toyvm/anything.js')).status, 404);
    assert.equal((await get('/toyvm/', 'POST')).status, 405);
    assert.equal((await get('/elsewhere')).status, 599, 'other routes fall through');
  });
});

test('title API: launchable title lists its files; blocked title explains itself', async () => {
  const root = fixture();
  await withServer(root, async (get) => {
    const ok = JSON.parse((await get('/toyvm/api/title?id=ok')).body);
    assert.equal(ok.launchable, true);
    assert.deepEqual(ok.files.map((f) => f.url), ['/toyvm/files/ok/GAME.COM', '/toyvm/files/ok/DATA.DAT']);
    const blocked = JSON.parse((await get('/toyvm/api/title?id=blocked')).body);
    assert.equal(blocked.launchable, false); assert.deepEqual(blocked.files, []);
    assert.equal(blocked.blockers[0].id, 'extender'); assert.equal(blocked.facts['no-dpmi'].text, 'no DPMI');
    assert.equal(JSON.parse((await get('/toyvm/api/title?id=absent')).body).reason, 'The payload is not on this machine.');
    assert.equal((await get('/toyvm/api/title?id=nope')).status, 404);
    assert.equal((await get('/toyvm/api/title?id=../x')).status, 400);
  });
});

test('payload files: listed paths of launchable titles only, sizes must still match', async () => {
  const root = fixture();
  await withServer(root, async (get) => {
    const game = await get('/toyvm/files/ok/GAME.COM');
    assert.equal(game.status, 200); assert.equal(game.body, 'GAMEBYTES'); assert.equal(game.headers['content-length'], '9');
    assert.equal((await get('/toyvm/files/ok/SECRET.TXT')).status, 404, 'present but not in the manifest');
    assert.equal((await get('/toyvm/files/blocked/FALL.EXE')).status, 409, 'blocked title serves nothing');
    assert.match((await get('/toyvm/files/blocked/FALL.EXE')).body, /extender/);
    assert.equal((await get('/toyvm/files/ok/..%2f..%2foutside.txt')).status, 403);
    fs.writeFileSync(path.join(root, 'payload/ok/DATA.DAT'), 'DATA-CHANGED');
    const drift = await get('/toyvm/files/ok/DATA.DAT');
    assert.equal(drift.status, 409); assert.match(drift.body, /changed since the manifest/);
    fs.rmSync(path.join(root, 'payload/ok/GAME.COM'));
    assert.equal((await get('/toyvm/files/ok/GAME.COM')).status, 404);
  });
});

test('a symlink inside the payload that escapes it is refused', async () => {
  const root = fixture();
  fs.rmSync(path.join(root, 'payload/ok/DATA.DAT'));
  fs.symlinkSync(path.join(root, 'outside.txt'), path.join(root, 'payload/ok/DATA.DAT'));
  await withServer(root, async (get) => { assert.equal((await get('/toyvm/files/ok/DATA.DAT')).status, 404); });
});

test('the existing authenticated gateway protects every /toyvm request; a session cookie opens them', async () => {
  const crypto = require('node:crypto'), { createGateway } = require('./hosting/public-server');
  const root = fixture(), serve = createToyvmHandler(root);
  const upstream = http.createServer(async (req, res) => { if (!(await serve(req, res))) { res.writeHead(404); res.end(); } });
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  const config = { origin: 'https://private.example', salt: '11'.repeat(16), passwordHash: '22'.repeat(32), sessionKey: '33'.repeat(32) };
  const gateway = createGateway(config, upstream.address().port); await new Promise((r) => gateway.listen(0, '127.0.0.1', r));
  const port = gateway.address().port;
  const req = (p, headers) => new Promise((resolve, reject) => { const q = http.request({ host: '127.0.0.1', port, path: p, headers }, (res) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() })); }); q.on('error', reject); q.end(); });
  try {
    for (const p of ['/toyvm/?title=ok', '/toyvm/api/title?id=ok', '/toyvm/runtime/toyvm-bundle.js', '/toyvm/files/ok/GAME.COM']) assert.equal((await req(p, { Host: 'private.example' })).status, 401, p);
    const value = (Date.now() + 60000) + '.test', sig = crypto.createHmac('sha256', Buffer.from(config.sessionKey, 'hex')).update(value).digest('hex');
    const cookie = { Host: 'private.example', Cookie: '__Host-wine_ops=' + value + '.' + sig };
    assert.equal((await req('/toyvm/files/ok/GAME.COM', cookie)).body, 'GAMEBYTES');
    assert.equal(JSON.parse((await req('/toyvm/api/title?id=ok', cookie)).body).launchable, true);
  } finally { await new Promise((r) => gateway.close(r)); await new Promise((r) => upstream.close(r)); }
});

test('reviewed route launch validates entry, all files and actual payload availability', async () => {
  const root = fixture();
  const p = path.join(root, 'test/toyvm-dos-corpus/manifest.json');
  const m = JSON.parse(fs.readFileSync(p)); m.titles[0].toyvm.status = 'reviewed-gameplay'; fs.writeFileSync(p, JSON.stringify(m));
  const { titleView, validFiles } = require('./toyvm-server');
  assert.equal((await titleView(root, 'ok')).launchable, true);
  const list = JSON.parse(fs.readFileSync(path.join(root, 'test/toyvm-dos-corpus/files/ok.json')));
  assert.equal(validFiles({ program: 'ABSENT.EXE' }, list.files), false);
  assert.equal(validFiles({ program: 'GAME.COM' }, [...list.files, { ...list.files[0], path: 'sub/game.com' }]), true);
  for (const name of ['game.com', 'GAME.COM.', '../game.com', '/game.com', 'C:game.com', 'GAME.COM/child']) {
    assert.equal(validFiles({ program: 'GAME.COM' }, [...list.files, { ...list.files[0], path: name }]), false, name);
  }
  assert.equal(validFiles({ program: 'GAME.COM' }, [{ ...list.files[0], sha256: 'bad' }]), false);
  fs.unlinkSync(path.join(root, 'payload/ok/DATA.DAT'));
  assert.equal((await titleView(root, 'ok')).launchable, false);
});

test('title view preserves explicit original-file guest mappings without basename aliases', async () => {
  const root = fixture(), { titleView } = require('./toyvm-server');
  const manifestPath = path.join(root, 'test/toyvm-dos-corpus/manifest.json');
  const listPath = path.join(root, 'test/toyvm-dos-corpus/files/ok.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath)), list = JSON.parse(fs.readFileSync(listPath));
  const original = list.files.find(f => f.path === 'DATA.DAT');
  fs.mkdirSync(path.join(root, 'payload/ok/support'));
  fs.copyFileSync(path.join(root, 'payload/ok/DATA.DAT'), path.join(root, 'payload/ok/support/DATA.DAT'));
  list.files.push({ ...original, path: 'support/DATA.DAT' });
  manifest.titles[0].requiredOriginalFiles = [{ path: 'support/DATA.DAT', guestPath: 'TEMPLATE.DAT' }];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest)); fs.writeFileSync(listPath, JSON.stringify(list));
  const view = await titleView(root, 'ok');
  assert.equal(view.launchable, true);
  const mapped = view.files.find(f => f.path === 'support/DATA.DAT');
  assert.equal(mapped.guestPath, 'TEMPLATE.DAT');
  assert.equal(mapped.url, '/toyvm/files/ok/support/DATA.DAT');
  for (const guestPath of ['DATA.DAT', '../escape']) {
    manifest.titles[0].requiredOriginalFiles[0].guestPath = guestPath;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.equal((await titleView(root, 'ok')).launchable, false);
  }
});
