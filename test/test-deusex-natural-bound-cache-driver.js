'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const tool = require('../tools/deusex-natural-bound-cache-driver.cjs');
(async () => {
  let posts = [];
  class Worker {
    constructor(url, options) { this.url = url; this.options = options; this.listeners = []; }
    postMessage(...args) { posts.push({ receiver: this, args }); return 71; }
    addEventListener(name, fn) { assert.equal(name, 'message'); this.listeners.push(fn); }
  }
  const context = vm.createContext({ Worker, URL, location: { href: 'http://127.0.0.1:8123/index.html' } });
  vm.runInContext('(' + tool.installFirstInit + ')()', context);
  assert.throws(() => vm.runInContext('(' + tool.installFirstInit + ')()', context), /already installed/);
  const C = context.Worker, other = new C('/lib/render-worker.js'), child = new C('/lib/guest-worker.js?v=dev');
  const foreign = { t: 'init', slot: 1 }, transfer = [];
  assert.equal(other.postMessage(foreign, transfer), 71);
  assert.equal(child.postMessage(foreign), 71);
  assert(!Object.hasOwn(foreign, 'cacheObservation'));
  const owner = new C('/lib/guest-worker.js?v=dev');
  const message = { t: 'init', slot: 0, endpointIdentity: { process: 9 }, seq: 10, module: {}, memory: {} };
  assert.equal(owner.postMessage(message, transfer), 71);
  assert.equal(posts.at(-1).args[0], message);
  assert.equal(posts.at(-1).args[1], transfer);
  assert.equal(posts.at(-1).receiver, owner);
  assert.equal(message.cacheObservation.limits.maxMs, 10000);
  assert.equal(message.seq, 10);
  assert.equal(context.__deusexCacheInit.commands[0].endpointIdentity, message.endpointIdentity);
  assert.throws(() => owner.postMessage({ t: 'init', slot: 0 }), /duplicate/);
  let seq = 20;
  context.wine = { guestWorker: { link: { slot: 0, async _ask(command) {
    command.seq = ++seq;
    owner.postMessage(command);
    const response = { t: 'cacheObservationResult', seq, result: { sources: [], unknownHistory: true } };
    owner.listeners.forEach(fn => fn({ data: response }));
    return response;
  } } } };
  const run = action => vm.runInContext('(' + tool.cacheCommand + ')(' + JSON.stringify(action) + ')', context);
  const status = await run('status');
  assert.equal(status.response, context.__deusexCacheInit.responses[0]);
  assert.equal(status.response.seq, 21);
  assert.equal((await run('stop')).response.seq, 22);
  await assert.rejects(run('start'), /invalid/);
  context.wine.guestWorker.link._ask = async () => ({ t: 'cacheObservationResult', seq: 99, result: {} });
  await assert.rejects(run('status'), /identity mismatch/);
  context.wine.guestWorker.link._ask = async () => ({ t: 'cacheObservationResult', seq: 99, result: null });
  await assert.rejects(run('stop'), /binding response absent/);
  const baseline = fs.readFileSync('scratch/runs/20261104-deusex-complete-driver-input-preflight/next-driver-fixed.cjs', 'utf8');
  const inspectorContext = vm.createContext({ setTimeout, module: { exports: {} } });
  vm.runInContext(fs.readFileSync('scratch/runs/20261104-deusex-complete-driver-input-preflight/owner-inspect.cjs', 'utf8'), inspectorContext);
  await assert.rejects(inspectorContext.module.exports.inspect(), /Worker instance absent/);
  const generated = tool.transform(baseline);
  assert.throws(() => tool.transform(baseline + '\n'), /actual driver SHA/);
  new vm.Script(generated);
  assert(generated.indexOf('page.evaluate(installFirstInit)') < generated.indexOf("page.click('button"));
  assert(generated.includes("page.evaluate(cacheCommand,'stop')"));
  for (const body of ["start+8*60*1000", "write('raw-surfaces.json'", "const png=await page.evaluate", "const result=await collect(page,{guard,record:(name,value)=>append(name,value)});"])
    assert(generated.includes(body), body);
  assert(generated.indexOf("write('raw-surfaces.json'") < generated.indexOf('const png=await page.evaluate'));
  for (const line of generated.split('\n').filter(s => /installFirstInit|cacheCommand/.test(s)))
    assert(!/callExport|set_reg|repaint|\.run\(/.test(line));
  console.log('PASS first-init same-message/transfer/receiver/return identity; foreign Worker passthrough; duplicate rejection; queued status/stop response identity and negatives; exact original driver transformation; unchanged natural bounds and raw-before-PNG');
})().catch(error => { console.error(error); process.exitCode = 1; });
