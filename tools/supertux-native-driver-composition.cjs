'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const Module = require('node:module');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// JSON boundaries must retain the actual exception, including wrapper causes.
// Classification uses positive evidence only; an old capture alone is no proof
// that the exception was stale. Never put the stale code on the outer error:
// the generic numbered transport would turn it into a refresh authorization.
function failureDetail(error, depth = 0) {
  if (!error || depth > 8) return undefined;
  const row = {name: error.name || 'Error', message: error.message || String(error)};
  for (const key of ['code', 'stage', 'method', 'diagnostic', 'receipt', 'inputFailures'])
    if (error[key] !== undefined) row[key] = error[key];
  if (error.cause) row.cause = failureDetail(error.cause, depth + 1);
  return row;
}

// The accepted pulse retains physical promises and schedules UP independently,
// but its JSON receipt reduces a rejected CDP error to a string. Retain the
// rejected values without adding a timer, cancelling a promise or replaying.
async function runPulse(pulse, options) {
  const failures = [];
  const observe = (op, phase) => async () => {
    try { return await op(); }
    catch (error) { failures.push({phase, error}); throw error; }
  };
  try { return await pulse({...options, down: observe(options.down, 'down'), up: observe(options.up, 'up')}); }
  catch (error) {
    if (failures.length) {
      error.inputFailures = failures.map(f => ({phase: f.phase, failure: failureDetail(f.error)}));
      error.cause ??= failures[0].error;
    }
    throw error;
  }
}

function commandDiagnostic(command, capture) {
  const stamps = {commandAdmittedAt: Date.now(), captureProducedAt: capture?.at ?? null,
    captureCompletedAt: capture?.completedAt ?? null, captureReadAt: null, inputAdmittedAt: null};
  let stage = 'command-validation';
  return {
    stage(value) { stage = value; stamps[value + 'At'] = Date.now(); },
    read() { stamps.captureReadAt = Date.now(); },
    admitted() { stamps.inputAdmittedAt = Date.now(); },
    snapshot() {
      const at = Date.now(), source = Date.parse(stamps.captureProducedAt);
      return {id: command.id, stage, ...stamps, observedAt: at,
        sourceAgeMs: Number.isFinite(source) ? at - source : null, freshnessBudgetMs: 12000, aimMs: 8000};
    },
    failed(error) { error.diagnostic = this.snapshot(); return error; }
  };
}

function terminalDetail(error) {
  let reason = error, category = 'unknown';
  for (let e = error, depth = 0; e && depth <= 8; e = e.cause, depth++) {
    reason = e;
    if (e.code === 'STALE_SCENE_BEFORE_DISPATCH') category = 'stale';
    else if (['ENOENT', 'EIO', 'ENOSPC', 'EACCES', 'EEXIST', 'EROFS'].includes(e.code)) category = 'storage';
    else if (typeof e.code === 'string' && e.code.startsWith('CDP_')) category = 'browser';
    else if (e.receipt && [e.receipt.down, e.receipt.up].some(r => r?.unknown && r.error === 'ACK deadline')) category = 'helperACKtimeout';
  }
  return {category, exactReason: reason.message || String(reason), failure: failureDetail(error),
    stage: error.diagnostic?.stage ?? 'numbered-transport', failedAt: Date.now()};
}

// Input ACK bounds belong to the accepted pulse/controller. A CDP timer must
// not erase the original promise: independent UP may precede a late DOWN reply.
// Disconnection is an explicit UNKNOWN, never a fabricated successful reply.
function createTransport({write, timeoutMs = 20000}) {
  assert.equal(typeof write, 'function');
  assert(Number.isFinite(timeoutMs) && timeoutMs > 0);
  let serial = 0, closed = false;
  const pending = new Map();
  function disconnect(error = Object.assign(Error('CDP disconnected; UNKNOWN; no replay'), {code: 'CDP_DISCONNECTED'})) {
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
      if (closed) return Promise.reject(Object.assign(Error('CDP closed; UNKNOWN; no replay'), {code: 'CDP_CLOSED', method}));
      return new Promise((resolve, reject) => {
        const id = ++serial;
        const row = {resolve, reject, method, timer: null};
        if (method !== 'Input.dispatchKeyEvent' && method !== 'Input.dispatchMouseEvent') {
          row.timer = setTimeout(() => {
            pending.delete(id);
            reject(Object.assign(Error('CDP UNKNOWN ' + method + '; no replay'), {code: 'CDP_TIMEOUT', method}));
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
      if (message.error) row.reject(Object.assign(Error(JSON.stringify(message.error)), {code: 'CDP_ERROR', method: row.method}));
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

// Both legacy queued commands and asynchronous startup continuations share
// this latch. Reading sticky records at each effect boundary also observes a
// sender timeout while startup is still awaiting a browser/guest reply.
function createSession({out, deadline, publish}) {
  let ready = false, closed = false;
  function stop(error) {
    closed = true;
    const file = path.join(out, 'transport-closed.json');
    if (!fs.existsSync(file)) publish(file, {error: String(error), sticky: true, noReplay: true});
  }
  function check(command = false) {
    try {
      assert(!closed && Date.now() < deadline, 'session closed/expired; UNKNOWN; no replay');
      for (const name of ['first-failure.json', 'transport-closed.json', 'cleanup.json', 'first-browser-failure.json'])
        assert(!fs.existsSync(path.join(out, name)), 'session failure/closure; UNKNOWN; no replay');
      if (!ready) assert(!fs.readdirSync(path.join(out, 'commands')).some(n => /^\d+\.json\.gz$/.test(n)),
        'command queued before readiness; UNKNOWN; no replay');
      if (command) assert(ready, 'command before readiness; UNKNOWN; no replay');
    } catch (error) { stop(error); throw error; }
  }
  return {check, close: () => stop(Error('session closing; UNKNOWN; no replay')),
    admit() { check(); ready = true; publish(path.join(out, 'ready.json'), {ready: true, deadline}); }};
}

// Readiness consumes the existing request budget, never the ACK budget plus
// another startup allowance. No ID, lock or command is admitted before ready.
async function requestReady(transport, out, id, command, timeout = 30000) {
  const until = Date.now() + timeout;
  const timing = {helperStartedAt: Date.now(), readyObservedAt: null, commandSubmittedAt: null, ackReadAt: null};
  let stage = 'helper-readiness';
  try {
    for (;;) {
      for (const name of ['first-failure.json', 'transport-closed.json', 'cleanup.json', 'first-browser-failure.json'])
        assert(!fs.existsSync(path.join(out, name)), 'session failure/closure; UNKNOWN; no replay');
      const file = path.join(out, 'ready.json');
      if (fs.existsSync(file)) {
        const ready = JSON.parse(fs.readFileSync(file));
        assert(ready.ready === true && ready.deadline > Date.now(), 'live readiness required');
        assert(Date.now() < until, 'UNKNOWN command readiness deadline');
        timing.readyObservedAt = Date.now();
        stage = 'helper-command-ack';timing.commandSubmittedAt = Date.now();
        const ack = await transport.request(out, id, command, Math.min(until - Date.now(), ready.deadline - Date.now()));
        timing.ackReadAt = Date.now();
        transport.publish(path.join(out, 'request-' + id + '-timing.json'), timing);
        return ack;
      }
      assert(Date.now() < until, 'UNKNOWN command readiness deadline');
      await new Promise(resolve => setTimeout(resolve, Math.min(20, until - Date.now())));
    }
  } catch (error) {
    try {
      const file = path.join(out, 'transport-closed.json');
      if (!fs.existsSync(file)) transport.publish(file, {id, error: String(error), sticky: true, noReplay: true});
      // The retained sender throws a generic failed-ACK assertion. Recover only
      // the durable detail for this exact command, never infer from capture age.
      const terminal = path.join(out, 'terminal-failure.json');
      if (fs.existsSync(terminal)) {
        const detail = JSON.parse(fs.readFileSync(terminal));
        if (detail.id === id) {
          error.terminal = detail;
          const closed = JSON.parse(fs.readFileSync(file));
          transport.publish(file, {...closed, terminal: detail});
        }
      } else {
        const detail = {id, ...terminalDetail(error), stage, timing};
        if (stage === 'helper-command-ack' && error.message === 'UNKNOWN command ACK deadline') detail.category = 'helperACKtimeout';
        error.terminal = detail;
        const closed = JSON.parse(fs.readFileSync(file));
        if (!closed.terminal) transport.publish(file, {...closed, terminal: detail});
      }
    } catch { /* Diagnostic storage cannot replace the actual sender failure. */ }
    throw error;
  }
}

// The generic retained transport allows a fresh capture after a zero-effect
// stale refusal. The persistent Pause controller instead closes on that same
// exception. Preserve the controller's stronger UNKNOWN across this boundary.
async function runController(controller, command) {
  try { return await controller.run(command); }
  catch (cause) {
    if (controller.closed) throw Error('native Pause controller UNKNOWN; no replay', {cause});
    throw cause;
  }
}

// The composed native session stops on its first failed menu action too.
// Retained generic transports can refresh a zero-effect stale refusal, but
// this session must reach its outer close handler without another command.
async function runBoundAction(chain, review, effect) {
  try { return await chain.admit(review, effect); }
  catch (cause) { throw Error('native menu action UNKNOWN; no replay', {cause}); }
}

// A terminal consumer failure has no success ACK. Notify the waiting sender
// immediately instead of leaving it polling until its unchanged ACK deadline.
async function consumeTerminal(transport, out, number, execute) {
  const terminal = path.join(out, 'terminal-failure.json');
  if (fs.existsSync(terminal)) {
    throw Object.assign(Error('UNKNOWN/partial closure is sticky; no replay'),
      {terminal: JSON.parse(fs.readFileSync(terminal))});
  }
  try { return await transport.consume(out, number, execute); }
  catch (cause) {
    try {
      const failure = JSON.parse(fs.readFileSync(path.join(out, 'first-failure.json')));
      const command = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(out, 'commands', number + '.json.gz'))));
      const reply = path.join(out, 'reply-' + number + '.json');
      if (failure.number === number && typeof command.id === 'string' &&
          /^[a-zA-Z0-9_-]+$/.test(command.id) && !fs.existsSync(reply)) {
        const detail = {id: command.id, number, ...terminalDetail(cause)};
        transport.publish(path.join(out, 'terminal-failure.json'), detail);
        transport.publish(path.join(out, 'first-failure.json'), {...failure, terminal: detail});
        transport.publish(reply, {ok: false, id: command.id, error: String(cause), terminal: detail, noReplay: true});
      }
    } catch { /* Preserve the original terminal failure if notification fails. */ }
    throw cause;
  }
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
  source = replaceOnce(source, 'let pauseController;',
    "const session=require(root+'/tools/supertux-native-driver-composition.cjs').createSession({out,deadline,publish:t.publish});let pauseController;");
  source = replaceOnce(source, 'async function capture(label){', 'async function capture(label){session.check();');
  source = replaceOnce(source, 'const shot=await chain.capture(label);', 'session.check();const shot=await chain.capture(label);session.check();');
  source = replaceOnce(source, 'if(closing)return;closing=true;', 'session.close();if(closing)return;closing=true;');
  source = replaceOnce(source, 'async function execute(c,markDispatch){',
    "async function execute(c,markDispatch){const diagnostic=require(root+'/tools/supertux-native-driver-composition.cjs').commandDiagnostic(c,latest);try{session.check(true);");
  source = replaceOnce(source, "assert(latest&&c.reviewRef===latest.label);const review=",
    "diagnostic.stage('review-storage');diagnostic.read();assert(latest&&c.reviewRef===latest.label);const review=");
  source = replaceOnce(source, "if(c.action==='pause-step'){", "diagnostic.stage('review-admission');if(c.action==='pause-step'){");
  source = replaceOnce(source, "markDispatch();save('input-'+c.id+'-admission.json',receipt);",
    "diagnostic.admitted();diagnostic.stage('input');markDispatch();save('input-'+c.id+'-admission.json',receipt);");
  source = replaceOnce(source, 'await pulse({down,up,deadline,',
    "await require(root+'/tools/supertux-native-driver-composition.cjs').runPulse(pulse,{down,up,deadline,");
  source = replaceOnce(source, 'await wait(c.waitMs);await capture(c.label);\n}',
    "diagnostic.stage('post-input-wait');await wait(c.waitMs);diagnostic.stage('capture');await capture(c.label);save('command-'+c.id+'-timing.json',diagnostic.snapshot());}catch(error){throw diagnostic.failed(error);}\n}");
  source = replaceOnce(source, "await capture('startup');save('ready.json',{ready:true,deadline});",
    "await capture('startup');session.admit();");
  source = replaceOnce(source, "async function send(method,params={},sessionId){",
    "async function send(method,params={},sessionId){if(method==='Page.captureScreenshot'||((method==='Input.dispatchKeyEvent'||method==='Input.dispatchMouseEvent')&&!['keyUp','mouseReleased'].includes(params.type)))session.check();");
  source = replaceOnce(source, 'await t.consume(out,n,execute)',
    "await require(root+'/tools/supertux-native-driver-composition.cjs').consumeTerminal(t,out,n,execute)");
  source = replaceOnce(source, 'let pauseController;', 'let pauseCommandId,pauseController;');
  source = replaceOnce(source, "if(c.action==='pause-step'){", "if(c.action==='pause-step'){pauseCommandId=c.id;");
  source = replaceOnce(source, "save:r=>log('pause-composition.jsonl',{id:c.id,...r})",
    "save:r=>log('pause-composition.jsonl',{id:pauseCommandId,...r})");
  source = replaceOnce(source, '}else await chain.admit(review,async receipt=>{',
    "}else await require(root+'/tools/supertux-native-driver-composition.cjs').runBoundAction(chain,review,async receipt=>{");
  source = replaceOnce(source,
    'await pauseController.run({id:c.id,review,observation:c.observation,keys:c.keys,holdMs:c.holdMs,markDispatch});',
    "await require(root+'/tools/supertux-native-driver-composition.cjs').runController(pauseController,{id:c.id,review,observation:c.observation,keys:c.keys,holdMs:c.holdMs,kind:c.kind,markDispatch});");
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
  source = source.slice(0, begin) + "if(method==='Page.captureScreenshot')session.check();return cdp.send(method,params,sessionId);}" + source.slice(end);
  source = replaceOnce(source,
    "if(v.id){const p=pending.get(v.id);if(!p)return;clearTimeout(p.timer);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}else",
    'if(v.id){cdp.receive(v);}else');
  source = replaceOnce(source, "ws.onmessage=msg=>", "ws.onclose=()=>{session.close();cdp.disconnect();};ws.onmessage=msg=>");
  source = replaceOnce(source, 'if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));',
    "if(r.exceptionDetails)throw Object.assign(Error(JSON.stringify(r.exceptionDetails)),{code:'CDP_EVALUATION',method:'Runtime.evaluate'});");
  source = replaceOnce(source, "browser.once('exit',(code,signal)=>save('chrome-exit.json',",
    "browser.once('exit',()=>session.close());browser.once('exit',(code,signal)=>save('chrome-exit.json',");
  source = replaceOnce(source,
    "for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('runtime closed; no replay'));}pending.clear();",
    "cdp.disconnect(Error('browser terminal; unresolved CDP UNKNOWN; no replay'));await pauseController?.settle();await require('./input.cjs').drain();save('physical-terminal-drain.json',{pending:require('./input.cjs').physical.size,at:Date.now()});");
  assert(source.includes("supertux-native-lifecycle.cjs').ready({browser"));
  assert(source.includes("supertux-native-lifecycle.cjs').close({browser"));
  assert(source.includes('.runController(pauseController,{id:c.id,review,observation:c.observation'));
  new vm.Script(Module.wrap(source), {filename: base});
  return {source, filename: path.resolve(root, base), sha256: sha(source), providers: manifest.files.length};
}

module.exports = {createTransport, compose, applyPatch, verify, runController, runBoundAction, consumeTerminal, createSession, requestReady, failureDetail, commandDiagnostic, terminalDetail, runPulse};
