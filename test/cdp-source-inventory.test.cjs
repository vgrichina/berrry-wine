'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createInventory, inspectorHash, digest} = require('../tools/cdp-source-inventory.cjs');
const SNAPSHOT = 'globalThis.__gltronObserver?.snapshot?.()??null';
function fixture(options = {}) {
  let time = 0, terminal = false;
  const requests = [], sources = new Map();
  const inventory = createInventory({send: async (method, params, sessionId) => {
    requests.push({method, ...params, sessionId});
    const source = sources.get(params.scriptId);
    if (source instanceof Error) throw source;
    return typeof source === 'function' ? source() : source;
  }, now: () => time, terminal: () => terminal, ...options});
  inventory.attach('session', 'target');
  inventory.contextCreated('session', {id: 1, uniqueId: 'context-1'});
  function parsed(id, source = SNAPSHOT, extra = {}) {
    sources.set(id, {scriptSource: source});
    return {scriptId: id, url: '', scriptLanguage: 'JavaScript', executionContextId: 1,
      hash: inspectorHash(source), length: source.length, startLine: 0, startColumn: 0, ...extra};
  }
  return {inventory, requests, sources, parsed, tick: t => time = t, terminal: () => terminal = true};
}
test('actual 47-byte controller fixture: fetch first, reuse verified source with full attribution', async () => {
  assert.equal(Buffer.byteLength(SNAPSHOT), 47);
  assert.equal(digest(Buffer.from(SNAPSHOT)), '000ba5e8856b8d2a95512815f84b8ee419cdcb73dbe015ee87dc832cc883f31c');
  const f = fixture(); f.inventory.noteEvaluation('session', SNAPSHOT);
  const first = await f.inventory.inspect('session', f.parsed('1'));
  assert.equal(first.actualBytesFetched, true); assert.equal(first.metadataHashValidated, true);
  for (let n = 2; n <= 412; n++) {
    f.inventory.noteEvaluation('session', SNAPSHOT);
    const row = await f.inventory.inspect('session', f.parsed(String(n)));
    assert.equal(row.sourceVerification, 'verified-controller-source-reuse');
    assert.equal(row.scriptId, String(n)); assert.equal(row.sessionId, 'session');
    assert.equal(row.targetId, 'target'); assert.equal(row.contextUniqueId, 'context-1');
    assert.equal(row.reusedFrom.scriptId, '1'); assert.equal(row.moduleByteProof, false);
    assert.equal(row.sha256, first.sha256);
  }
  assert.equal(f.requests.length, 1);
});
test('equal-length anonymous unknown and changed expressions fetch their distinct bytes', async () => {
  const f = fixture(); f.inventory.noteEvaluation('session', '1+1');
  await f.inventory.inspect('session', f.parsed('1', '1+1'));
  for (const [id, source] of [['2', '2+2'], ['3', '3+3'], ['4', '2+2']]) {
    const row = await f.inventory.inspect('session', f.parsed(id, source));
    assert(row.actualBytesFetched); assert.equal(row.sha256, digest(Buffer.from(source)));
  }
  assert.equal(f.requests.length, 4);
});
test('actual Chrome UTF8 hash and V8 UTF16 fallback both require first fetched bytes', async () => {
  for (const hash of [digest(Buffer.from(SNAPSHOT)), inspectorHash(SNAPSHOT)]) {
    const f = fixture(); f.inventory.noteEvaluation('session', SNAPSHOT);
    const first = await f.inventory.inspect('session', f.parsed('1', SNAPSHOT, {hash}));
    assert(first.actualBytesFetched && first.metadataHashValidated);
    const next = await f.inventory.inspect('session', f.parsed('2', SNAPSHOT, {hash}));
    assert.equal(next.actualBytesFetched, false); assert.equal(next.metadataHashEncoding, first.metadataHashEncoding);
    assert.equal(f.requests.length, 1);
  }
});
test('missing, malformed and incorrect metadata hashes never establish reusable identity', async () => {
  for (const hash of [undefined, '', 'bad', 'a'.repeat(64)]) {
    const f = fixture(); f.inventory.noteEvaluation('session', SNAPSHOT);
    for (const id of ['1', '2']) assert((await f.inventory.inspect('session', f.parsed(id, SNAPSHOT, {hash}))).actualBytesFetched);
    assert.equal(f.requests.length, 2);
  }
});
test('production/module/live-edited/unknown-language scripts always fetch', async () => {
  for (const extra of [{url: 'https://host/production.js'}, {isModule: true}, {isLiveEdit: true}, {scriptLanguage: undefined}, {startColumn: 1}, {length: 46}]) {
    const f = fixture(); f.inventory.noteEvaluation('session', SNAPSHOT);
    for (const id of ['1', '2']) assert((await f.inventory.inspect('session', f.parsed(id, SNAPSHOT, extra))).actualBytesFetched);
    assert.equal(f.requests.length, 2);
  }
});
test('metadata hash is checked against returned source; never fabricated from evaluator input', async () => {
  const f = fixture(); f.inventory.noteEvaluation('session', '1+1');
  for (const id of ['1', '2']) {
    const p = f.parsed(id, '2+2', {hash: inspectorHash('1+1')});
    const row = await f.inventory.inspect('session', p);
    assert.equal(row.sha256, digest(Buffer.from('2+2'))); assert(!row.metadataHashValidated);
  }
  assert.equal(f.requests.length, 2);
});
test('WASM always fetches actual bytecode, including different module versions', async () => {
  const f = fixture();
  for (const [id, version] of [['1', 1], ['2', 2], ['3', 1]]) {
    const p = f.parsed(id, '', {scriptLanguage: 'WebAssembly', hash: 'a'.repeat(64)});
    const bytes = Buffer.from([0, 97, 115, 109, version, 0, 0, 0]);
    f.sources.set(id, {scriptSource: '', bytecode: bytes.toString('base64')});
    const row = await f.inventory.inspect('session', p);
    assert.equal(row.sha256, digest(bytes)); assert(row.moduleByteProof && row.actualBytesFetched);
  }
  assert.equal(f.requests.length, 3);
  const p = f.parsed('4', '', {scriptLanguage: 'WebAssembly'});
  await assert.rejects(f.inventory.inspect('session', p), /missing actual WASM/);
  f.sources.set('4', {scriptSource: '', bytecode: '***'});
  await assert.rejects(f.inventory.inspect('session', p), /malformed/);
});
test('target/session and context replacement, clear, missing unique ID invalidate reuse', async () => {
  for (const replace of [i => i.contextCreated('session', {id: 1, uniqueId: 'new'}),
    i => i.contextCreated('session', {id: 1}), i => i.contextsCleared('session'),
    i => i.contextsCleared('session', 1), i => i.attach('session', 'other-target'),
    i => {i.detach('session'); i.attach('session', 'target');}]) {
    const f = fixture(); f.inventory.noteEvaluation('session', SNAPSHOT);
    await f.inventory.inspect('session', f.parsed('1'));
    replace(f.inventory); f.inventory.noteEvaluation('session', SNAPSHOT);
    assert((await f.inventory.inspect('session', f.parsed('2'))).actualBytesFetched);
    assert.equal(f.requests.length, 2);
  }
});
test('bounded lifetime and capacity evict reusable source', async () => {
  const f = fixture({maxEntries: 1, ttlMs: 10});
  for (const [id, source] of [['1', '1+1'], ['2', '2+2'], ['3', '1+1']]) {
    f.inventory.noteEvaluation('session', source);
    assert((await f.inventory.inspect('session', f.parsed(id, source))).actualBytesFetched);
  }
  f.tick(11); f.inventory.noteEvaluation('session', '1+1');
  assert((await f.inventory.inspect('session', f.parsed('4', '1+1'))).actualBytesFetched);
  const tiny = fixture({maxBytes: 1}); tiny.inventory.noteEvaluation('session', SNAPSHOT);
  for (const id of ['1', '2']) assert((await tiny.inventory.inspect('session', tiny.parsed(id))).actualBytesFetched);
});
test('malformed source replies and absent context identity cannot authorize reuse', async () => {
  for (const reply of [{}, {scriptSource: null}, {scriptSource: '', bytecode: null}]) {
    const f = fixture(), p = f.parsed('1'); f.sources.set('1', reply);
    await assert.rejects(f.inventory.inspect('session', p));
  }
  const f = fixture(); f.inventory.contextsCleared('session');
  f.inventory.noteEvaluation('session', SNAPSHOT);
  for (const id of ['1', '2']) {
    const row = await f.inventory.inspect('session', f.parsed(id));
    assert(row.actualBytesFetched); assert.equal(row.contextUniqueId, null);
  }
  assert.equal(f.requests.length, 2);
});
test('entry/byte bounds apply across Worker sessions, and close cannot issue requests', async () => {
  const f = fixture({maxEntries: 1}); f.inventory.noteEvaluation('session', SNAPSHOT);
  await f.inventory.inspect('session', f.parsed('1'));
  f.tick(1); f.inventory.attach('other-session', 'other-target');
  f.inventory.contextCreated('other-session', {id: 1, uniqueId: 'other-context'});
  f.inventory.noteEvaluation('other-session', '1+1');
  await f.inventory.inspect('other-session', f.parsed('2', '1+1'));
  f.inventory.noteEvaluation('session', SNAPSHOT);
  assert((await f.inventory.inspect('session', f.parsed('3'))).actualBytesFetched);
  assert.equal(f.requests.length, 3);
  f.inventory.close();
  await assert.rejects(f.inventory.inspect('session', f.parsed('4')), /UNKNOWN/);
  assert.equal(f.requests.length, 3);
});
test('failed fetches cannot seed cache; terminal remains sticky and late bytes cannot seed it', async () => {
  const f = fixture(); f.inventory.noteEvaluation('session', SNAPSHOT);
  const p = f.parsed('1'); f.sources.set('1', Error('fetch failed'));
  await assert.rejects(f.inventory.inspect('session', p), /fetch failed/);
  assert((await f.inventory.inspect('session', f.parsed('2'))).actualBytesFetched);
  let resolve; const late = f.parsed('3', '2+2');
  f.sources.set('3', () => new Promise(r => resolve = r));
  const pending = f.inventory.inspect('session', late);
  f.terminal(); resolve({scriptSource: '2+2'});
  await assert.rejects(pending, /UNKNOWN/);
  await assert.rejects(f.inventory.inspect('session', f.parsed('4')), /UNKNOWN/);
  assert.equal(f.requests.length, 3);
});
test('in-flight response after context or session replacement is UNKNOWN', async () => {
  for (const replace of [i => i.contextCreated('session', {id: 1, uniqueId: 'replaced'}), i => i.attach('session', 'new-target')]) {
    const f = fixture(), p = f.parsed('1'); let resolve;
    f.sources.set('1', () => new Promise(r => resolve = r));
    const pending = f.inventory.inspect('session', p); replace(f.inventory); resolve({scriptSource: SNAPSHOT});
    await assert.rejects(pending, /UNKNOWN/);
  }
});
test('reproduced unnecessary-source failure is avoided without skipping distinct source', async () => {
  let calls = 0;
  const send = async () => { if (++calls === 2) throw Error('UNKNOWN source deadline; never replay'); return {scriptSource: SNAPSHOT}; };
  await send(); await assert.rejects(send(), /UNKNOWN/); // old per-event policy
  const f = fixture({send}); calls = 0;
  f.inventory.noteEvaluation('session', SNAPSHOT);
  await f.inventory.inspect('session', f.parsed('1'));
  const reused = await f.inventory.inspect('session', f.parsed('2'));
  assert.equal(reused.actualBytesFetched, false); assert.equal(calls, 1);
  await assert.rejects(f.inventory.inspect('session', f.parsed('3', '2+2')), /UNKNOWN/);
});
test('controller inventory abort rejects pending CDP and sends zero later requests', async () => {
  const RealWebSocket = global.WebSocket, sent = [];
  class Socket extends EventTarget {
    constructor() {super(); queueMicrotask(() => this.onopen());}
    send(wire) {sent.push(JSON.parse(wire));}
    close() {this.dispatchEvent(new Event('close'));}
  }
  global.WebSocket = Socket;
  try {
    const c = require('../tools/quake3-browser-controller.cjs').connection('ws://fixture', null);
    await c.ready;
    const pending = c.send('Runtime.evaluate', {expression: '1+1'}, 'session');
    c.abort(Error('UNKNOWN source identity; never replay'));
    await assert.rejects(pending, /UNKNOWN source identity/); assert(c.closed);
    await assert.rejects(c.send('Debugger.getScriptSource', {scriptId: 'late'}, 'session'), /UNKNOWN/);
    assert.equal(sent.length, 1); c.ws.close();
  } finally {global.WebSocket = RealWebSocket;}
});

// Run only after the assigned runtime predecessors release. The outer recipe
// provides the observable independent watchdog; this fixture launches no game.
test('actual Chrome: repeated/changed evaluator source, Worker replacement and WASM bytes',
  {skip: !process.env.CDP_SOURCE_CHROME_OUT}, async () => {
  const fs = require('node:fs'), cp = require('node:child_process'), path = require('node:path');
  const out = process.env.CDP_SOURCE_CHROME_OUT;
  assert(path.isAbsolute(out)); fs.mkdirSync(out, {recursive: true});
  const watchdog = JSON.parse(fs.readFileSync(out + '/watchdog-armed.json'));
  assert(watchdog.independent && fs.existsSync('/proc/' + watchdog.pid));
  const profile = out + '/profile', rows = [], metadata = [], requests = [], tasks = [], errors = [];
  const chrome = cp.spawn('/usr/bin/google-chrome', ['--headless=new', '--no-sandbox', '--no-first-run',
    '--disable-dev-shm-usage', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'],
    {stdio: ['ignore', 'pipe', 'pipe']});
  let stdout = '', stderr = '', c, baseline = false;
  const baselineRows = [];
  chrome.stdout.on('data', b => stdout += b); chrome.stderr.on('data', b => stderr += b);
  const joined = new Promise(resolve => chrome.once('close', (exit, signal) => resolve({pid: chrome.pid,
    exit, signal, actualWait: true, stdoutEOF: chrome.stdout.readableEnded, stderrEOF: chrome.stderr.readableEnded})));
  fs.writeFileSync(out + '/browser-pid.json', JSON.stringify({pid: chrome.pid}));
  const report = {originalLaunched: false, rows, metadata, requests, baselineRows, contexts: []};
  try {
    const active = profile + '/DevToolsActivePort', until = Date.now() + 5000;
    while (!fs.existsSync(active) || fs.readFileSync(active, 'utf8').trim().split('\n').length !== 2) {
      assert(Date.now() < until && chrome.exitCode === null); await new Promise(r => setTimeout(r, 20));
    }
    const [port, endpoint] = fs.readFileSync(active, 'utf8').trim().split('\n');
    c = require('../tools/quake3-browser-controller.cjs').connection('ws://127.0.0.1:' + port + endpoint);
    await c.ready;
    const inventory = createInventory({terminal: () => c.closed, send: async (method, params, sessionId) => {
      requests.push({method, ...params, sessionId}); return c.send(method, params, sessionId);
    }});
    const workers = new Map();
    c.event = v => {
      if (v.method === 'Target.attachedToTarget' && v.params.targetInfo.type === 'worker') {
        const {sessionId, targetInfo} = v.params; inventory.attach(sessionId, targetInfo.targetId);
        const task = (async () => {await c.send('Runtime.enable', {}, sessionId);
          await c.send('Debugger.enable', {}, sessionId); await c.send('Runtime.runIfWaitingForDebugger', {}, sessionId);
          workers.set(sessionId, targetInfo.targetId);})(); tasks.push(task); task.catch(e => errors.push(String(e)));
      } else if (v.method === 'Target.detachedFromTarget') {
        inventory.detach(v.params.sessionId); workers.delete(v.params.sessionId);
      } else if (v.method === 'Runtime.executionContextCreated') {report.contexts.push({sessionId: v.sessionId, context: v.params.context});inventory.contextCreated(v.sessionId, v.params.context);}
      else if (v.method === 'Runtime.executionContextDestroyed') inventory.contextsCleared(v.sessionId, v.params.executionContextId);
      else if (v.method === 'Runtime.executionContextsCleared') inventory.contextsCleared(v.sessionId);
      else if (v.method === 'Debugger.scriptParsed') {
        metadata.push({sessionId: v.sessionId, ...v.params});
        if (baseline) {
          const task = c.send('Debugger.getScriptSource', {scriptId: v.params.scriptId}, v.sessionId).then(source => {
            assert.equal(typeof source.scriptSource, 'string');
            baselineRows.push({sessionId: v.sessionId, scriptId: v.params.scriptId,
              executionContextId: v.params.executionContextId, contentHash: v.params.hash,
              sha256: digest(Buffer.from(source.scriptSource)), size: Buffer.byteLength(source.scriptSource), actualBytesFetched: true});
          }); tasks.push(task); task.catch(e => errors.push(String(e))); return;
        }
        const task = inventory.inspect(v.sessionId, v.params).then(row => rows.push(row));
        tasks.push(task); task.catch(e => errors.push(String(e)));
      }
    };
    report.browser = await c.send('Browser.getVersion');
    const page = (await c.send('Target.getTargets')).targetInfos.find(t => t.type === 'page');
    const session = (await c.send('Target.attachToTarget', {targetId: page.targetId, flatten: true})).sessionId;
    inventory.attach(session, page.targetId);
    await c.send('Runtime.enable', {}, session); await c.send('Debugger.enable', {}, session);
    await c.send('Target.setAutoAttach', {autoAttach: true, waitForDebuggerOnStart: true, flatten: true}, session);
    async function evaluate(expression, sid = session) {
      inventory.noteEvaluation(sid, expression);
      const r = await c.send('Runtime.evaluate', {expression, returnByValue: true}, sid);
      assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value;
    }
    async function settle() { for (let n = 0; n < tasks.length; n++) await tasks[n]; assert.deepEqual(errors, []); }
    async function worker() {
      await evaluate("globalThis.sourceWorker=new Worker(URL.createObjectURL(new Blob(['globalThis.__gltronObserver={snapshot:()=>null};'],{type:'text/javascript'})));true");
      const end = Date.now() + 3000;
      while (!workers.size) {assert(Date.now() < end); await new Promise(r => setTimeout(r, 10));}
      await settle(); return [...workers.keys()][0];
    }
    const first = await worker();
    baseline = true;
    for (let n = 0; n < 6; n++) {await evaluate(SNAPSHOT, first); await settle();}
    baseline = false;
    const baselineSnapshots = baselineRows.filter(r => r.sha256 === digest(Buffer.from(SNAPSHOT)));
    assert.equal(baselineSnapshots.length, 6);
    for (let n = 0; n < 6; n++) {await evaluate(SNAPSHOT, first); await settle();}
    const matches = rows.filter(r => r.sha256 === digest(Buffer.from(SNAPSHOT)));
    assert(matches.length >= 6); assert.equal(matches.filter(r => r.actualBytesFetched).length, 1);
    assert(matches.slice(1).every(r => r.sourceVerification === 'verified-controller-source-reuse'));
    for (const expression of ['1+1', '2+2', '"é😀"']) {await evaluate(expression, first); await settle();}
    for (const source of ['1+1', '2+2', '"é😀"']) assert(rows.some(r =>
      r.sha256 === digest(Buffer.from(source)) && r.actualBytesFetched && r.metadataHashValidated));
    for (let n = 0; n < 2; n++) {await evaluate('eval("40+2")', first); await settle();}
    const unknown = rows.filter(r => r.sessionId === first && r.sha256 === digest(Buffer.from('40+2')));
    assert(unknown.length >= 2 && unknown.every(r => r.actualBytesFetched), 'unknown anonymous source still fetches');
    const wasmControls = [42, 43].map(answer => Buffer.from([0,97,115,109,1,0,0,0,
      1,5,1,96,0,1,127,3,2,1,0,7,10,1,6,97,110,115,119,101,114,0,0,10,6,1,4,0,65,answer,11]));
    for (const bytes of wasmControls) {
      await evaluate('new WebAssembly.Module(new Uint8Array(' + JSON.stringify([...bytes]) + '));true', first); await settle();
    }
    const wasm = rows.filter(r => r.scriptLanguage === 'WebAssembly');
    assert(wasm.length > 0 && wasm.every(r => r.actualBytesFetched && r.moduleByteProof));
    for (const bytes of wasmControls) assert(wasm.some(r => r.sha256 === digest(bytes)));
    await evaluate('sourceWorker.terminate();true');
    const end = Date.now() + 3000;
    while (workers.size) {assert(Date.now() < end); await new Promise(r => setTimeout(r, 10));}
    const second = await worker(); assert.notEqual(first, second);
    await evaluate(SNAPSHOT, second); await settle();
    assert(rows.some(r => r.sessionId === second && r.sha256 === matches[0].sha256 && r.actualBytesFetched));
    // Same target/session, distinct real execution contexts must fetch again.
    const frameId = (await c.send('Page.getFrameTree', {}, session)).frameTree.frame.id;
    const contextRows = [];
    for (const worldName of ['inventory-control-a', 'inventory-control-b']) {
      const world = await c.send('Page.createIsolatedWorld', {frameId, worldName}, session);
      inventory.noteEvaluation(session, SNAPSHOT);
      const value = await c.send('Runtime.evaluate', {expression: SNAPSHOT,
        contextId: world.executionContextId, returnByValue: true}, session);
      assert(!value.exceptionDetails); await settle();
      const row = rows.find(r => r.sessionId === session && r.executionContextId === world.executionContextId && r.sha256 === matches[0].sha256);
      assert(row?.actualBytesFetched); contextRows.push(row);
    }
    assert.notEqual(contextRows[0].contextUniqueId, contextRows[1].contextUniqueId);
    report.passed = true; report.rows = rows; report.metadata = metadata; report.requests = requests;
    report.sameContextSnapshotFetches = 1; report.sameContextSnapshotScripts = matches.length;
    report.baselineSameContextSnapshotFetches = baselineSnapshots.length;
    report.distinctRealContextControls = contextRows;
    report.unknownAnonymousActualFetches = unknown.length;
    inventory.close();
  } finally {
    // Terminal CDP is never used for cleanup; the independent host path owns it.
    let closeError; const terminalBeforeClose = !c || c.closed;
    try { if (c && !c.closed) await c.send('Browser.close'); }
    catch (error) { closeError = error; report.closeError = String(error); }
    if ((terminalBeforeClose || closeError) && chrome.exitCode === null) chrome.kill('SIGTERM');
    report.chromeWait = await joined; c?.ws.close();
    fs.rmSync(profile, {recursive: true, force: true});
    fs.writeFileSync(out + '/chrome.stdout.log', stdout); fs.writeFileSync(out + '/chrome.stderr.log', stderr);
    fs.writeFileSync(out + '/source-chrome-report.json', JSON.stringify(report, null, 2) + '\n');
    if (closeError) throw closeError;
  }
});
