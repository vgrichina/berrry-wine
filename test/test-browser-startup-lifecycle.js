'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {Lifecycle, StartupCancelled, ownChild} = require(process.env.STARTUP_LIFECYCLE_MODULE || '../tools/browser-startup-lifecycle.cjs');
function fixture(t) {
  const out = fs.mkdtempSync(path.join('/dev/shm', 'startup-unit-'));
  t.after(() => fs.rmSync(out, {recursive: true, force: true}));
  const events = [], cancelFile = out + '/cancel';
  const lifecycle = new Lifecycle({cancelFile, deadline: Date.now() + 5000, floor: null, record: e => events.push(e)});
  return {out, events, lifecycle, cancel: () => fs.writeFileSync(cancelFile, 'authored cancellation')};
}
test('pre-cancel gates dispatch and capture', async t => {
  const f = fixture(t); f.cancel(); let calls = 0;
  await assert.rejects(f.lifecycle.run('capture', () => calls++), StartupCancelled);
  assert.equal(calls, 0);
});
test('in-flight completion retained, next dispatch prohibited, event tasks drained', async t => {
  const f = fixture(t); let finish, calls = 0;
  const connection = f.lifecycle.wrapConnection({send: () => { calls++; return new Promise(r => { finish = r; }); }});
  const pending = connection.send('Runtime.evaluate'); f.cancel(); finish({value: 42});
  await assert.rejects(pending, StartupCancelled);
  assert(f.events.some(e => e.kind === 'completed' && e.phase === 'CDP:Runtime.evaluate'));
  await assert.rejects(connection.send('Page.enable'), StartupCancelled);
  await f.lifecycle.drain(); assert.equal(f.lifecycle.pending.size, 0); assert.equal(calls, 1);
});
test('cancel during acquisition adopts the actual owned resource before throwing', async t => {
  const f = fixture(t); const resource = {}; let adopted;
  await assert.rejects(f.lifecycle.run('launch', async () => { f.cancel(); return resource; }, v => { adopted = v; }), StartupCancelled);
  assert.equal(adopted, resource);
});
test('healthy completion, deadline and permanent closure', async t => {
  const f = fixture(t); assert.equal(await f.lifecycle.run('healthy', () => 7), 7);
  f.lifecycle.deadline = Date.now() - 1;
  await assert.rejects(f.lifecycle.run('late', () => 8), StartupCancelled);
  fs.rmSync(f.out + '/cancel', {force:true}); f.lifecycle.deadline = Date.now() + 5000;
  await assert.rejects(f.lifecycle.run('no-replay', () => 9), StartupCancelled);
});
test('owned spawn error has an actual close wait and both EOFs', async () => {
  const owned = ownChild(require('node:child_process').spawn('/does-not-exist-startup-fixture', [], {stdio:['ignore','pipe','pipe']}));
  const wait = await owned.waited;
  assert(wait.error); assert(wait.actualWait && wait.stdoutEOF && wait.stderrEOF);
});
