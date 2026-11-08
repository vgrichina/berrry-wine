'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const Module = require('node:module');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// Input ACK bounds belong to the accepted pulse/controller. A CDP timer must
// not erase the original promise: independent UP may precede a late DOWN reply.
// Disconnection is an explicit UNKNOWN, never a fabricated successful reply.
function createTransport({write, timeoutMs = 20000}) {
  assert.equal(typeof write, 'function');
  assert(Number.isFinite(timeoutMs) && timeoutMs > 0);
  let serial = 0, closed = false;
  const pending = new Map();
  function disconnect(error = Error('CDP disconnected; UNKNOWN; no replay')) {
    closed = true;
    for (const row of pending.values()) {
      clearTimeout(row.timer);
      row.reject(error);
    }
    pending.clear();
  }
  return {
    pending, disconnect,
    send(method, params = {}, sessionId) {
      if (closed) return Promise.reject(Error('CDP closed; UNKNOWN; no replay'));
      return new Promise((resolve, reject) => {
        const id = ++serial;
        const row = {resolve, reject, method, timer: null};
        if (method !== 'Input.dispatchKeyEvent' && method !== 'Input.dispatchMouseEvent') {
          row.timer = setTimeout(() => {
            pending.delete(id);
            reject(Error('CDP UNKNOWN ' + method + '; no replay'));
          }, timeoutMs);
        }
        pending.set(id, row);
        try { write(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})})); }
        catch (error) { disconnect(error); }
      });
    },
    receive(message) {
      const row = pending.get(message.id);
      if (!row) return false;
      clearTimeout(row.timer);
      pending.delete(message.id);
      if (message.error) row.reject(Error(JSON.stringify(message.error)));
      else row.resolve(message.result);
      return true;
    }
  };
}

function verify(root, pin) {
  const filename = path.resolve(root, pin.path);
  assert(filename.startsWith(path.resolve(root) + path.sep), 'provider outside root');
  const bytes = fs.readFileSync(filename);
  assert.equal(bytes.length, pin.size, pin.path);
  assert.equal(sha(bytes), pin.sha256, pin.path);
  return bytes;
}

// Strict unified hunks: no fuzz, shifted context, skipped removals or overlaps.
function applyPatch(bytes, patch) {
  const source = bytes.toString().split('\n'), lines = patch.split('\n');
  const output = []; let position = 0, count = 0;
  assert(lines[0].startsWith('--- ') && lines[1].startsWith('+++ '));
  for (let i = 2; i < lines.length; i++) {
    if (i === lines.length - 1 && lines[i] === '') break;
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i]);
    assert(header, 'unrecognized patch line');
    const start = Number(header[1]) - 1;
    assert(start >= position, 'overlapping patch');
    output.push(...source.slice(position, start)); position = start;
    assert.equal(output.length, Number(header[3]) - 1, 'new hunk offset');
    let removed = 0, added = 0;
    for (i++; i < lines.length && !lines[i].startsWith('@@ '); i++) {
      const line = lines[i];
      if (i === lines.length - 1 && line === '') break;
      assert([' ', '-', '+'].includes(line[0]), 'unrecognized patch content');
      if (line[0] !== '+') {
        assert.equal(source[position++], line.slice(1), 'exact patch context'); removed++;
      }
      if (line[0] !== '-') { output.push(line.slice(1)); added++; }
    }
    assert.equal(removed, header[2] === undefined ? 1 : Number(header[2]), 'old hunk count');
    assert.equal(added, header[4] === undefined ? 1 : Number(header[4]), 'new hunk count');
    count++; i--;
  }
  assert(count > 0, 'empty patch');
  return output.concat(source.slice(position)).join('\n');
}

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, 'exact integration site: ' + before.slice(0, 70));
  return source.replace(before, after);
}

// manifest contains only PATH+HASH references. The caller pins its exact bytes
// in the final startup barrier; compose rechecks every provider before launch.
// No source/media/module copy is written, and this function starts no runtime.
function compose({root, manifest}) {
  for (const pin of manifest.files) verify(root, pin);
  const lookup = p => {
    const pins = manifest.files.filter(pin => pin.path === p);
    assert.equal(pins.length, 1, 'unique pinned provider: ' + p);
    return verify(root, pins[0]);
  };
  for (const required of ['tools/supertux-native-driver-composition.cjs',
    'tools/supertux-native-pause-controller.cjs', 'tools/supertux-native-lifecycle.cjs',
    'tools/native-devtools-ready.cjs', 'tools/native-browser-close.cjs',
    'tools/native_kernel_custody.py', 'tools/native-command-log.cjs',
    'tools/native-startup-barrier.py', 'tools/gltron-logical-fps-local.cjs',
    ...['input.cjs', 'transport.cjs', 'bound-input.cjs', 'readiness.cjs', 'ordinary-keys-fixed.cjs']
      .map(name => 'scratch/runs/20261108-supertux-short-step-progression-2236/' + name)]) lookup(required);
  const base = manifest.base, patch = manifest.patch;
  let source = applyPatch(lookup(base), zlib.gunzipSync(lookup(patch)).toString());
  source = replaceOnce(source, "const run=__dirname,root=path.resolve(run,'../../..'),out=run+'/'",
    "const run=(()=>{const p=process.env.SUPERTUX_RUN_DIRECTORY;assert(p&&path.isAbsolute(p),'explicit fresh run directory');return p;})(),root=path.resolve(__dirname,'../../..'),out=run+'/'");
  // Keep helper resolution at the accepted retained driver's original path.
  source = replaceOnce(source, "const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));",
    "assert(run&&path.isAbsolute(run),'explicit fresh run directory');const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));");
  source = replaceOnce(source, 'let id=0;const pending=new Map(),workers=new Map(),workerPromises=[];',
    "const cdp=require(root+'/tools/supertux-native-driver-composition.cjs').createTransport({write:v=>ws.send(v)});const workers=new Map(),workerPromises=[];");
  const begin = source.indexOf('return new Promise((resolve,reject)=>{const n=++id;');
  const end = source.indexOf('\nasync function evaluate', begin);
  assert(begin > 0 && end > begin);
  source = source.slice(0, begin) + 'return cdp.send(method,params,sessionId);}' + source.slice(end);
  source = replaceOnce(source,
    "if(v.id){const p=pending.get(v.id);if(!p)return;clearTimeout(p.timer);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}else",
    'if(v.id){cdp.receive(v);}else');
  source = replaceOnce(source, "ws.onmessage=msg=>", "ws.onclose=()=>cdp.disconnect();ws.onmessage=msg=>");
  source = replaceOnce(source,
    "for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('runtime closed; no replay'));}pending.clear();",
    "cdp.disconnect(Error('browser terminal; unresolved CDP UNKNOWN; no replay'));await pauseController?.settle();await require('./input.cjs').drain();save('physical-terminal-drain.json',{pending:require('./input.cjs').physical.size,at:Date.now()});");
  assert(source.includes("supertux-native-lifecycle.cjs').ready({browser"));
  assert(source.includes("supertux-native-lifecycle.cjs').close({browser"));
  assert(source.includes('await pauseController.run({id:c.id,review,observation:c.observation'));
  new vm.Script(Module.wrap(source), {filename: base});
  return {source, filename: path.resolve(root, base), sha256: sha(source), providers: manifest.files.length};
}

module.exports = {createTransport, compose, applyPatch, verify};
