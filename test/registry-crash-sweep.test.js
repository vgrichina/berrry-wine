'use strict';
// Entire sweep is evaluated with a fixture-only child_process replacement.
// No test/run.js, compiler, WebAssembly or guest is executed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../tools/registry-crash-sweep.js'), 'utf8');
const cases = [];
function test(name, fn) { cases.push([name, fn]); }
async function sweep({ log, output = '300 batches in 1s\n', code = 0, before = false, budget = 300, arm = 300, limit = 1, stalePng = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crash-sweep-fixture-'));
  const out = path.join(dir, 'out'); fs.mkdirSync(out);
  const baseline = path.join(dir, 'baseline.json');
  fs.writeFileSync(baseline, JSON.stringify({ results: [{ id: 'fixture', runs: { [`off${arm}`]: { crash: before } } }] }));
  if (log !== undefined) fs.writeFileSync(path.join(out, 'fixture.log'), log);
  if (stalePng) fs.writeFileSync(path.join(out, 'fixture.png'), 'old attempt');
  let launches = 0;
  const proc = { argv: ['node', 'sweep', `--out=${out}`, `--baseline=${baseline}`, `--budget=${budget}`, `--limit=${limit}`], stdout: { write() {} }, exit(c) { throw Error(`unexpected exit ${c}`); } };
  try {
    await vm.runInNewContext(source, {
      require(name) {
        if (name === '../lib/apps') return { APPS: { fixture: {} } };
        if (name === 'child_process') return { execFile(_cmd, _args, _opts, cb) { launches++; cb(code ? { code } : null, output, ''); } };
        return require(name);
      }, __dirname: path.join(__dirname, '../tools'), process: proc, console: { log() {}, error() {} },
    }, { timeout: 1000 });
    assert.equal(proc.exitCode, undefined, 'sweep rejected fixture');
    return { ...JSON.parse(fs.readFileSync(path.join(out, 'result.json'), 'utf8')), launches,
      log: fs.existsSync(path.join(out, 'fixture.log')) ? fs.readFileSync(path.join(out, 'fixture.log'), 'utf8') : null };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test('complete success is OK', async () => assert.equal((await sweep()).results[0].status, 'OK'));
test('complete success against crash is FIXED', async () => assert.equal((await sweep({ before: true })).results[0].status, 'FIXED'));
test('actual crash is NEW CRASH', async () => assert.equal((await sweep({ output: 'RuntimeError: unreachable\n', code: 1 })).results[0].status, 'NEW CRASH'));
test('timeout is TIMEOUT', async () => assert.equal((await sweep({ code: 124 })).results[0].status, 'TIMEOUT'));
test('missing fixture is NO FIXTURE', async () => assert.equal((await sweep({ output: 'ENOENT fixture.exe\n', code: 1 })).results[0].status, 'NO FIXTURE'));
test('missing exit marker cannot be FIXED', async () => {
  const r = await sweep({ log: '300 batches in 1s\n', before: true, limit: 0 });
  assert.equal(r.results[0].status, 'INCOMPLETE'); assert.equal(r.results[0].code, null); assert.equal(r.status, 'INCONCLUSIVE');
});
test('nonzero runner exit cannot be FIXED', async () => assert.equal((await sweep({ code: 2, before: true })).results[0].status, 'RUNNER ERROR'));
test('truncated resumed output is rerun', async () => {
  const r = await sweep({ log: '300 batches in 1s\n[sweep] exit=' });
  assert.equal(r.launches, 1); assert.equal(r.results[0].status, 'OK');
});
test('matching complete output is reused', async () => {
  const first = await sweep(); const r = await sweep({ log: first.log });
  assert.equal(r.launches, 0); assert.equal(r.results[0].status, 'OK');
});
test('different resume budget is rerun', async () => {
  const first = await sweep(); const r = await sweep({ log: first.log, budget: 400, arm: 400 }); assert.equal(r.launches, 1);
});
test('different baseline budget remains unknown', async () => {
  const r = await sweep({ before: true, budget: 400 });
  assert.equal(r.results[0].baseline, null); assert.equal(r.results[0].baselineStatus, 'UNKNOWN'); assert.notEqual(r.results[0].status, 'FIXED'); assert.equal(r.status, 'INCONCLUSIVE');
});
test('old exit marker followed by truncated output cannot succeed', async () => {
  const r = await sweep({ log: '300 batches in 1s\n[sweep] exit=0\npartial new attempt', limit: 0 }); assert.equal(r.results[0].status, 'INCOMPLETE');
});
test('zero exit without runner progress is inconclusive', async () => {
  const r = await sweep({ output: 'runner startup only\n' }); assert.equal(r.results[0].status, 'INCONCLUSIVE'); assert.equal(r.status, 'INCONCLUSIVE');
});
test('string runner errors remain nonzero and inconclusive', async () => {
  const r = await sweep({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }); assert.equal(r.results[0].code, -1); assert.equal(r.results[0].status, 'RUNNER ERROR'); assert.equal(r.status, 'INCONCLUSIVE');
});
test('complete failure is reusable but never successful', async () => {
  const first = await sweep({ code: 2 }); const r = await sweep({ log: first.log }); assert.equal(r.launches, 0); assert.equal(r.results[0].status, 'RUNNER ERROR');
});
test('truncated exit record with matching settings is rerun', async () => {
  const first = await sweep(); const r = await sweep({ log: first.log.trimEnd() }); assert.equal(r.launches, 1);
});
test('retry discards stale screenshot evidence', async () => {
  const r = await sweep({ log: 'interrupted', stalePng: true }); assert.equal(r.results[0].painted, false);
});
test('missing baseline crash verdict stays unknown', async () => {
  const r = await sweep({ before: null }); assert.equal(r.results[0].baselineStatus, 'UNKNOWN'); assert.equal(r.status, 'INCONCLUSIVE');
});
test('summary distinguishes success, crash and pending', async () => {
  assert.equal((await sweep()).status, 'PASS');
  assert.equal((await sweep({ output: 'CRASH\n', code: 1 })).status, 'FAIL');
  const pending = await sweep({ limit: 0 }); assert.equal(pending.pending, 1); assert.equal(pending.status, 'INCONCLUSIVE');
});
(async () => {
  let failed = 0;
  for (const [name, fn] of cases) { try { await fn(); console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); } }
  console.log(`${cases.length - failed}/${cases.length} passed`); process.exitCode = failed ? 1 : 0;
})();
