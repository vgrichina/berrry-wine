'use strict';
// Offline composition only. Importing this file never starts a browser.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const cache = require('./deusex-natural-bound-cache-driver.cjs');
const INSPECT_SHA = '83b48f6e23b80f92af6e078c2c17a3879cf3d0a69c43518002248b119a849949';
const CLOSURE = 'scratch/runs/20261104-deusex-natural-bound-cache/input-manifest.json';
const CLOSURE_SHA = '648115ab5604e24070534b6270a99ba64218f6b540e6aae9021ec8899130dfa0';
const selections = new WeakMap();

// Install before launchApp. Keep references, not copies, to the actual init and
// ready messages. No additional Worker commands or guest calls are introduced.
function installSelection() {
  if (globalThis.__deusexReadiness) throw Error('readiness selection already installed');
  const Native = globalThis.Worker;
  const state = globalThis.__deusexReadiness = { records: [], owner: null, failure: null, link: null,
    session: globalThis.crypto.randomUUID() };
  const fail = message => { state.failure ||= String(message); return Error(state.failure); };
  globalThis.Worker = class extends Native {
    constructor(url, options) {
      const target = new URL(String(url), location.href);
      const guest = target.pathname === '/lib/guest-worker.js';
      if (guest) {
        if (target.origin !== new URL(location.href).origin || target.searchParams.has('__deusex_readiness'))
          throw fail('untrusted or premarked Worker target');
        // Bind the browser target before startup. The server keys pins by
        // pathname, and Worker imports still use the unchanged v parameter.
        target.searchParams.set('__deusex_readiness', state.session + ':' + (state.records.length + 1));
      }
      super(guest ? target.href : url, options);
      if (!guest) return;
      const absolute = target.href;
      const record = { worker: this, url: absolute, init: null, ready: null };
      state.records.push(record);
      const original = this.postMessage;
      this.postMessage = function(message, ...rest) {
        if (message?.t === 'init') {
          if (record.init) throw fail('Worker instance replacement');
          if (!Number.isSafeInteger(message.endpointIdentity) || message.endpointIdentity < 1 ||
              !Number.isInteger(message.slot) || message.slot < 0 ||
              state.records.some(r => r.init?.endpoint === message.endpointIdentity))
            throw fail('ambiguous Worker init identity');
          record.init = { message, module: message.module, memory: message.memory,
            endpoint: message.endpointIdentity, slot: message.slot };
          if (message.slot === 0) {
            if (state.owner) throw fail('ambiguous owning Worker');
            state.owner = record;
          }
        }
        return Reflect.apply(original, this, [message, ...rest]);
      };
      this.addEventListener('message', event => {
        const message = event.data;
        if (message?.t === 'ready') {
          if (!record.init || record.ready) fail('unexpected Worker ready');
          else record.ready = message;
        }
        if (message?.t === 'error' && record === state.owner) fail(message.message || message.error || 'owning Worker error');
      });
      this.addEventListener('error', event => {
        if (record === state.owner) fail(event.message || 'owning Worker transport error');
      });
    }
  };
  return { installed: true };
}

function owningIdentity() {
  const state = globalThis.__deusexReadiness;
  if (!state) throw Error('readiness selection not installed before startup');
  if (state.failure) throw Error(state.failure);
  const link = globalThis.wine?.guestWorker?.link;
  const owner = state.owner;
  if (!owner || !link) throw Error('owning init/link missing');
  const init = owner.init;
  if (link.worker !== owner.worker || link.slot !== 0 || link.endpointIdentity !== init.endpoint ||
      link.module !== init.module || link.memory !== init.memory || init.slot !== 0 ||
      init.message.module !== init.module || init.message.memory !== init.memory ||
      init.message.endpointIdentity !== init.endpoint || init.message.slot !== 0 ||
      link._stopped || link._stopping || (state.link && state.link !== link))
    throw Error('stale owning link/module/session/slot');
  state.link = link;
  return { endpoint: init.endpoint, slot: 0, url: owner.url, session: state.session, ready: !!owner.ready };
}

// No guest getters execute here. Only the premarked owner is ever evaluated.
function provenance() {
  return { endpoint: typeof endpointIdentity === 'undefined' ? null : endpointIdentity,
    slot: typeof workerSlot === 'undefined' ? null : workerSlot,
    initialized: typeof instance !== 'undefined' && !!instance,
    sameMemory: typeof instance !== 'undefined' && !!instance && instance.exports.memory === memory };
}

async function selectOwner(page, bounded = p => p) {
  const identity = await bounded(page.evaluate(owningIdentity));
  if (!identity.ready) return null; // Original boot loop/deadline, no new waits.
  const matches = page.workers().filter(w => w.url() === identity.url);
  assert.equal(matches.length, 1, 'missing or ambiguous owning target');
  const worker = matches[0];
  const p = await bounded(worker.evaluate(provenance));
  assert.equal(p.endpoint, identity.endpoint, 'wrong owning endpoint instance');
  assert.equal(worker.url(), identity.url, 'stale owning target URL');
  assert.equal(p.slot, 0, 'wrong owning slot');
  assert.equal(p.initialized, true, 'owning Worker instance absent after ready');
  assert.equal(p.sameMemory, true, 'wrong owning instance memory');
  const previous = selections.get(page);
  if (previous) {
    assert.equal(previous.worker, worker, 'stale owning target/session');
    assert.equal(previous.endpoint, identity.endpoint, 'stale owning endpoint');
    assert.equal(previous.session, identity.session, 'stale owning session');
  } else selections.set(page, { worker, endpoint: identity.endpoint, session: identity.session });
  const after = await bounded(page.evaluate(owningIdentity));
  assert.deepEqual(after, identity, 'owning identity changed during selection');
  return worker;
}

function transform(source) {
  source = cache.transform(source); // Exact published original SHA and cache integration.
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, 'unique readiness anchor: ' + before);
    source = source.replace(before, after);
  };
  replace("const {installFirstInit,cacheCommand}=require('./natural-bound-integration.cjs');",
    "const {installFirstInit,cacheCommand}=require('./natural-bound-integration.cjs');\nconst {installSelection,selectOwner}=require(process.cwd()+'/tools/deusex-owning-readiness-driver.cjs');");
  replace("await page.click('button[onclick=\"launchApp()\"]');",
    "write('owning-selection-installed.json',await page.evaluate(installSelection));await page.click('button[onclick=\"launchApp()\"]');");
  replace("const candidates=page.workers().filter(w=>w.url().includes('/guest-worker.js'));",
    "const selectedOwner=await selectOwner(page,bounded);const candidates=selectedOwner?[selectedOwner]:[];");
  replace("append('native-readiness',s);if(s.slot===0&&s.thread===1)",
    "append('native-readiness',s);if(s.slot!==0||s.thread!==1)throw Error('selected owning instance slot/thread mismatch');if(s.slot===0&&s.thread===1)");
  return source;
}

function read(file) {
  if (fs.existsSync(file)) return fs.readFileSync(file);
  return require('node:zlib').gunzipSync(fs.readFileSync(file + '.gz'));
}
function check(baseline) {
  const source = read(baseline).toString();
  const inspector = read(require('node:path').join(require('node:path').dirname(baseline), 'owner-inspect.cjs'));
  assert.equal(crypto.createHash('sha256').update(inspector).digest('hex'), INSPECT_SHA, 'original inspector SHA');
  const body = transform(source);
  new (require('node:vm').Script)(body);
  return body;
}
function helperClosure() {
  const bytes = read(CLOSURE);
  const hash = b => crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(hash(bytes), CLOSURE_SHA, 'retained actual closure manifest SHA');
  const pins = JSON.parse(bytes).pins, rows = [];
  for (const [name, pin] of Object.entries(pins)) {
    if (!name.startsWith('scratch/runs/') || !name.endsWith('.cjs')) continue;
    const b = read(name);
    assert.deepEqual({ size: b.length, sha256: hash(b) }, pin, 'original helper pin: ' + name);
    rows.push({ path: name, ...pin });
  }
  assert(rows.some(r => r.path.endsWith('/owner-inspect.cjs')));
  assert(rows.some(r => r.path.endsWith('/readiness/readiness.cjs')));
  assert(rows.some(r => r.path.endsWith('/transport.cjs')));
  assert.equal(hash(fs.readFileSync(require.resolve('./deusex-natural-bound-cache-driver.cjs'))),
    pins['scratch/runs/20261104-deusex-natural-bound-cache/natural-bound-integration.cjs'].sha256,
    'published cache composition changed');
  return { manifest: CLOSURE, sha256: CLOSURE_SHA, helpers: rows };
}
module.exports = { installSelection, owningIdentity, provenance, selectOwner, transform, check, read, helperClosure, INSPECT_SHA };
if (require.main === module) {
  const [mode, baseline, destination] = process.argv.slice(2);
  assert(['--check', '--generate', '--preflight', '--run'].includes(mode),
    'usage: node tools/deusex-owning-readiness-driver.cjs --check BASELINE | --generate BASELINE DESTINATION | --preflight|--run BASELINE STAGED_OUTPUT');
  const closure = helperClosure();
  const body = check(baseline);
  if (mode === '--generate') { assert(destination); fs.writeFileSync(destination, body); }
  if (mode === '--preflight' || mode === '--run') {
    assert(destination, 'staged output required');
    const path = require('node:path'), out = path.resolve(destination);
    assert.equal(path.resolve(process.env.DEUSEX_OUTPUT), out, 'explicit staged output mismatch');
    // All original bytes/media/modules are checked before any server/browser.
    require(out + '/input-preflight.cjs').prepare(process.cwd(), out);
    if (mode === '--run') {
      // Compile in the staged original helper directory without changing its
      // archived driver. The original main retains its preflight and cleanup.
      const Module = require('node:module'), filename = out + '/next-driver-fixed.cjs';
      const entry = new Module(filename, module); entry.filename = filename;
      entry.paths = Module._nodeModulePaths(out); entry._compile(body, filename);
      entry.exports.main();
    }
  }
  console.log('PASS exact original/cache/readiness composition and ' + closure.helpers.length + ' original helper pins');
}
