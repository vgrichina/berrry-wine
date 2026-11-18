'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const cp = require('node:child_process');
const {initialize, boundary, guardedConnection, lifecycle, FLOOR} = require('./browser-disk-admission.cjs');
const wait = ms => new Promise(r => setTimeout(r, ms));
function fixture(t, readFree) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-disk-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const dir = root + '/scope', owner = initialize(dir, Date.now() + 10000);
  return {dir, owner, scope:boundary(dir, owner, readFree ? {readFree} : {})};
}
class Socket {
  constructor() { this.requests = []; queueMicrotask(() => this.onopen()); }
  send(s) { this.requests.push(JSON.parse(s)); }
  close() {}
}
test('actual statfs healthy control, LOW startup and sticky late diagnostic refusal', async t => {
  const actual = fixture(t); assert((await actual.scope.observe()).free > FLOOR);
  let free = FLOOR; const {scope} = fixture(t, () => free);
  const c = guardedConnection('fixture', scope, {WebSocketClass:Socket});
  t.after(() => c.stop()); await c.ready;
  await assert.rejects(c.send('Browser.getVersion'), /LOW/);
  free = FLOOR + 1000000;
  await assert.rejects(c.send('Target.getTargets'), /closed/);
  assert.equal(c.ws.requests.length, 0);
});
test('watchdog closure rejects in-flight, queued diagnostic and late input', async t => {
  const {dir, owner, scope} = fixture(t);
  const c = guardedConnection('fixture', scope, {WebSocketClass:Socket});
  t.after(() => c.stop()); await c.ready;
  const pending = assert.rejects(c.send('Runtime.evaluate'), /LOW/);
  while (c.ws.requests.length === 0) await wait(1);
  // A real second process observes an injected bounded LOW while the first
  // process has an unresolved CDP query. No global disk allocation is made.
  const script = `const m=require(${JSON.stringify(__dirname + '/browser-disk-admission.cjs')});m.boundary(process.argv[1],JSON.parse(process.argv[2]),{readFree:()=>1}).observe().catch(()=>{});`;
  const child = cp.spawn(process.execPath, ['-e',script,dir,JSON.stringify(owner)], {stdio:['ignore','pipe','pipe']});
  const receipt = await new Promise(r => child.once('close', (code,signal) => r({code,signal,out:child.stdout.readableEnded,err:child.stderr.readableEnded})));
  assert.deepEqual(receipt, {code:0,signal:null,out:true,err:true});
  await pending;
  await Promise.all(['Target.getTargets','Input.dispatchKeyEvent'].map(method => assert.rejects(c.send(method), /closed/)));
  assert.equal(c.ws.requests.length, 1);
});
test('error observation closes; queued work cannot cross the boundary', async t => {
  let fail = false;
  const {scope} = fixture(t, () => { if (fail) throw Error('injected statfs EIO'); return FLOOR+1; });
  const issued = [];
  await scope.issue(() => issued.push('healthy'));
  fail = true;
  const low = assert.rejects(scope.observe(), /EIO/);
  const queued = assert.rejects(scope.issue(() => issued.push('queued')), /closed/);
  await Promise.all([low,queued]); assert.deepEqual(issued,['healthy']);
});
test('stale owner closes before any issue', async t => {
  const {dir,owner} = fixture(t);
  const scope = boundary(dir, {...owner, generation:'stale'});
  await assert.rejects(scope.issue(() => assert.fail('wire issue')), /stale scope owner/);
});
test('parent death and signals share closure with the actual child', async t => {
  const {dir,owner,scope} = fixture(t);
  const script = `const m=require(${JSON.stringify(__dirname + '/browser-disk-admission.cjs')});const s=m.boundary(process.argv[1],JSON.parse(process.argv[2]));process.on('SIGTERM',async()=>{await s.close('SIGTERM');process.exitCode=0;});console.log('ready');setTimeout(()=>{},100);`;
  const child = cp.spawn(process.execPath,['-e',script,dir,JSON.stringify(owner)],{stdio:['ignore','pipe','pipe']});
  await new Promise(r => child.stdout.once('data',r)); child.kill('SIGTERM');
  await new Promise(r => child.once('close',r));
  await assert.rejects(scope.issue(() => assert.fail('late send')), /SIGTERM/);
  const f = fixture(t); f.owner.owner.token = 'retired';
  fs.writeFileSync(f.dir+'/owner.json',JSON.stringify(f.owner));
  await assert.rejects(boundary(f.dir,f.owner).check(), /owner replaced/);
});
test('IPC error/disconnect closes before forwarding; parent custody mismatch refuses diagnostics', async t => {
  for (const event of ['error','disconnect']) {
    const {scope} = fixture(t), emitter = new (require('node:events').EventEmitter)();
    const forwarded = new Promise(resolve => lifecycle(scope,emitter,resolve));
    emitter.emit(event, 'injected IPC failure'); await forwarded;
    await assert.rejects(scope.issue(() => assert.fail('diagnostic issue')), /IPC failure/);
  }
  const {dir,owner} = fixture(t);
  await assert.rejects(boundary(dir,owner,{parents:[{pid:process.pid,token:'stale'}]}).check(), /parent replaced/);
});
