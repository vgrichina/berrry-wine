'use strict';
// Actual exports and broker, inert transport, real Node timers, no guest execution.
const assert = require('node:assert/strict');
const threads = require('node:worker_threads');
const {EventEmitter} = require('node:events');
const originalWorker = threads.Worker, originalInterval = global.setInterval;
let active;
class Transport extends EventEmitter {
  constructor() { super(); this.f = active; this.exits = 0; this.sent = []; active.transports.push(this); }
  postMessage(m) {
    this.sent.push(m); const f = this.f, link = f.host.link;
    if (m.t === 'init') {
      f.links.push(link); link._loaderRetireTimeout = 8;
      link._renderLegacyEndpoint = {terminate() { f.renderExits++; return f.render?.(); }};
      f.init?.(link);
      if (f.postThrow) throw f.source;
      if (!f.hold) queueMicrotask(() => {
        if (f.fail) { link._readyPromise?.reject(f.source); link._readyPromise = null; }
        else this.emit('message', {t: 'ready', exports: 0, imports: 0});
      });
    }
    if (m.t === 'retireScopedLoaders' && f.receipt !== 'timeout') queueMicrotask(() => this.emit('message', {
      t: 'retired', seq: m.seq, retired: f.receipt !== 'missing',
      endpointIdentity: m.endpointIdentity + (f.receipt === 'identity' ? 1 : 0),
      dllCallbacksRetired: f.receipt !== 'dll',
    }));
  }
  terminate() { this.exits++; return this.f.cpu?.(); }
}
threads.Worker = Transport;
global.setInterval = (...args) => { const t = originalInterval(...args); active.clocks.push(t); return t; };
const {GuestThreadHost, WorkerLink} = require('../lib/guest-thread-host');
const RPC = require('../lib/guest-rpc');
const Regions = require('../lib/region-map.generated');
// Plain JS shared storage for the actual broker's protocol views, never WASM memory.
const memory = {buffer: new SharedArrayBuffer(Math.max(RPC.RPC_BASE + 1024 * 1024,
  Regions.BASE.WRITER_SESSION + 65536))};
const result = p => Promise.resolve(p).then(value => ({ok: true, value}), error => ({ok: false, error}));
const turn = () => new Promise(resolve => setImmediate(resolve));
const contains = (e, x) => e === x || !!e?.errors?.some(v => contains(v, x));
const tests = [], test = (name, run) => tests.push({name, run});
async function using(options, run) {
  const f = {transports: [], clocks: [], links: [], renderExits: 0, ticks: 0, ...options}; active = f;
  f.host = new GuestThreadHost({memory, sigs: {}, clockIntervalMs: 2, log() {},
    localMainExports: f.local ? () => ({}) : null,
    tickMs() { f.ticks++; return f.tick?.(f) ?? f.ticks; }});
  try { await run(f); }
  finally {
    f.fail = false; f.receipt = 'valid'; f.cpu = null; f.render = null; f.tick = null;
    await result(f.host.stop()); await result(f.host.stop());
    // Baseline leak recovery uses the actual orphaned owners captured at init.
    for (const link of f.links) { await result(link.stop()); await result(link.stop()); }
    for (const clock of f.clocks) clearInterval(clock);
    await turn();
  }
}
function retired(f) {
  assert(f.links.every(l => l instanceof WorkerLink && l._retirementComplete));
  assert(f.clocks.every(t => t._destroyed), 'every real interval cancelled');
  assert.equal(f.host._startingLinks.size, 0);
  assert(!f.host._retirementLinks?.size);
  assert.equal(f.host.link, null);
}
function annotated(r, source, link) {
  assert.equal(r.ok, false); assert(r.error?.workerLink === link, 'failed startup exposes its actual owner');
  if (r.error !== source) assert(r.error.cause === source, 'exact original cause');
}
test('overlapping start shares exact promise, broker, interval and actual slot0', () => using({}, async f => {
  const a = f.host.start(), b = f.host.start(); const same = a === b;
  const [x,y] = await Promise.all([a,b]);
  assert(same, 'same startup promise'); assert.equal(x,y);
  assert.equal(f.transports.length, 1); assert.equal(f.clocks.length, 1);
  assert.equal(f.host.start(), a); await f.host.stop(); retired(f);
  assert.equal(f.transports[0].exits, 1); assert.equal(f.renderExits, 1);
}));
test('overlap shutdown retires every started slot0 and clears every real interval', () => using({}, async f => {
  await Promise.all([f.host.start(), f.host.start()]); await f.host.stop();
  const live = f.transports.filter(t => !t.exits).length, clocks = f.clocks.filter(t => !t._destroyed).length;
  assert.equal(live,0, `unreachable live transports=${live}, leaked real intervals=${clocks}`);
  assert.equal(clocks,0); retired(f);
}));
test('reentrant initial clock callback joins startup before any owner exists', () => using({}, async f => {
  let nested, entered = false; f.tick = () => { if (!entered) { entered = true; nested = f.host.start(); } return 1; };
  const p = f.host.start(); await p; assert(nested === p, 'reentrant promise identity');
  assert.equal(f.clocks.length,1); assert.equal(f.transports.length,1);
  await f.host.stop(); retired(f);
}));
test('reentrant transport startup shares the same startup', () => using({}, async f => {
  let nested, entered = false; f.init = () => { if (!entered) { entered = true; nested = f.host.start(); } };
  const p = f.host.start(); await p; assert(nested === p, 'reentrant promise identity');
  assert.equal(f.transports.length,1); await f.host.stop(); retired(f);
}));
for (const [name, source] of [['Error', Error('startup')], ['null', null], ['undefined',undefined],
  ['frozen',Object.freeze(Error('frozen'))], ['symbol',Symbol('failure')],
  ['conflicting',Object.defineProperty(Error('conflict'),'workerLink',{value:'foreign'})],
  ['setter',Object.defineProperty(Error('setter'),'workerLink',{configurable:true,set() { throw Error('setter called'); }})],
  ['noncoercible',Object.freeze({[Symbol.toPrimitive]() { throw Error('coerced'); }})]]) {
  test(`rejected ${name} startup retires all owners and remains failed`, () => using({fail:true,source}, async f => {
    const p = f.host.start(), r = await result(p); annotated(r,source,f.links[0]); retired(f);
    assert(f.host.start() === p, 'failed startup identity'); annotated(await result(f.host.start()),source,f.links[0]);
    assert.equal(f.transports.length,1); assert.equal(f.transports[0].exits,1); assert.equal(f.renderExits,1);
  }));
}
test('synchronous tick failure is cached and shuts down without an interval', () => using({}, async f => {
  const source = Error('tick'); f.tick = () => { throw source; };
  const p = f.host.start(), r = await result(p); assert.equal(r.ok,false);
  assert(r.error === source || r.error.cause === source); assert(f.host._stopped);
  assert(f.host.start() === p, 'failed startup identity'); assert.equal(f.clocks.length,0);
}));
test('stop before deferred startup admits no new owner', () => using({}, async f => {
  const p = f.host.start(); await f.host.stop(); assert.equal((await result(p)).ok,false);
  assert.equal(f.transports.length,0); retired(f);
}));
test('stop from initial tick cannot create an interval or slot0 afterward', () => using({}, async f => {
  let stop; f.tick = () => { stop = f.host.stop(); return 1; };
  const p = f.host.start(); assert.equal((await result(p)).ok,false); await stop;
  assert.equal(f.clocks.length,0); assert.equal(f.transports.length,0); retired(f);
}));
test('stop while readiness is pending rejects shared startup and joins both exits', () => using({hold:true}, async f => {
  const p = f.host.start(); await turn(); const stop = f.host.stop();
  assert.equal((await result(p)).ok,false); await stop; retired(f);
  assert.equal(f.transports[0].exits,1); assert.equal(f.renderExits,1);
}));
test('stop with rejected receipt while ready is pending settles startup and retains its owner', () => using({hold:true,receipt:'identity'}, async f => {
  f.init = link => { link._notificationUsed = true; };
  let settled = false; const p = result(f.host.start()).then(r => { settled = true; return r; });
  await turn(); assert.equal((await result(f.host.stop())).ok,false); await turn();
  assert(settled, 'startup must observe retirement without waiting for readiness timeout');
  const r = await p; assert.equal(r.ok,false); assert(r.error.retirementError);
  assert(f.host._retirementLinks.has(f.links[0])); assert.equal(f.transports[0].exits,0);
  f.receipt = 'valid'; await f.host.stop(); retired(f);
}));
for (const receipt of ['missing','identity','dll','timeout']) {
  test(`${receipt} receipt retains failed main owner until genuine retry`, () => using({fail:true,source:Error('init'),receipt}, async f => {
    f.init = link => { link._notificationUsed = true; };
    const r = await result(f.host.start()); annotated(r,f.source,f.links[0]);
    assert(r.error.retirementError); assert(f.host._retirementLinks.has(f.links[0]));
    assert.equal(f.transports[0].exits,0); assert.equal(f.renderExits,0);
    assert(f.clocks.every(t => t._destroyed));
    assert.equal((await result(f.host.stop())).ok,false); assert(f.host._retirementLinks.has(f.links[0]));
    f.receipt = 'valid'; await f.host.stop(); retired(f);
    assert.equal(f.transports[0].exits,1); assert.equal(f.renderExits,1);
  }));
}
for (const boundary of ['cpu','render']) {
  test(`${boundary} exit failure remains observable and retained for explicit stop retry`, () => using({fail:true,source:Error('init')}, async f => {
    const error = Error(boundary); f[boundary] = () => Promise.reject(error);
    const r = await result(f.host.start()); annotated(r,f.source,f.links[0]);
    assert(contains(r.error.retirementError,error)); assert(f.host._retirementLinks.has(f.links[0]));
    f[boundary] = null; await f.host.stop(); retired(f);
    assert.equal(f.transports[0].exits,boundary === 'cpu' ? 2 : 1);
    assert.equal(f.renderExits,boundary === 'render' ? 2 : 1);
  }));
}
test('synchronous init transport rejection also observes abandoned readiness', () => using({postThrow:true,source:Error('post')}, async f => {
  const r = await result(f.host.start()); annotated(r,f.source,f.links[0]); retired(f);
}));
test('failed startup waits for successful CPU and renderer exits', () => using({fail:true,source:Error('init')}, async f => {
  let cpuDone, renderDone, settled = false;
  f.cpu = () => new Promise(resolve => { cpuDone = resolve; });
  f.render = () => new Promise(resolve => { renderDone = resolve; });
  const p = result(f.host.start()).then(r => { settled = true; return r; }); await turn();
  assert(!settled); assert(f.host._retirementLinks.has(f.links[0]));
  cpuDone(); await turn(); assert(!settled, 'renderer exit must settle too');
  renderDone(); annotated(await p,f.source,f.links[0]); retired(f);
}));
test('stop during transport init is safe and cannot report startup success', () => using({}, async f => {
  let stop; f.init = () => { stop = f.host.stop(); };
  const r = await result(f.host.start()); assert.equal(r.ok,false); await stop; retired(f);
}));
test('startup rejection exposes shutdown hook failure after retiring physical owners', () => using({fail:true,source:Error('init')}, async f => {
  const hook = Error('audio'); f.host.hostImports = {beep_shutdown() { throw hook; }};
  const r = await result(f.host.start()); annotated(r,f.source,f.links[0]);
  assert(contains(r.error.retirementError,hook)); retired(f);
}));
test('start after successful shutdown refuses admission', () => using({}, async f => {
  await f.host.start(); await f.host.stop(); const r = await result(f.host.start());
  assert.equal(r.ok,false); assert.equal(f.transports.length,1); retired(f);
}));
test('local main startup shares exactly one broker and real clock', () => using({local:true}, async f => {
  const p = f.host.start(), q = f.host.start(); assert.equal(await p,null); await q;
  assert.equal(p,q); assert.equal(f.clocks.length,1); assert.equal(f.transports.length,0);
  await f.host.stop(); retired(f);
}));
(async () => {
  let failed = 0; const unhandled = []; const listener = e => unhandled.push(e);
  process.on('unhandledRejection',listener);
  try {
    for (const {name,run} of tests) {
      let timer;
      try { await Promise.race([run(),new Promise((_,reject) => { timer = setTimeout(() => reject(Error('case deadline')),1200); })]); console.log(`PASS ${name}`); }
      catch (e) { failed++; console.log(`FAIL ${name}: ${e?.message || 'arbitrary failure'}`); }
      finally { clearTimeout(timer); }
    }
    await turn(); assert.equal(unhandled.length,0,'no orphan rejections');
    console.log(`${tests.length-failed}/${tests.length} PASS`); process.exitCode = failed ? 1 : 0;
  } finally { process.removeListener('unhandledRejection',listener); threads.Worker = originalWorker; global.setInterval = originalInterval; }
})().catch(e => { console.error(e); process.exitCode = 1; });
