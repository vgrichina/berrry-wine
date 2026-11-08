'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const {closeBrowser} = require('./native-browser-close.cjs');
const {repairDriver} = require('./darkstone-browser-driver.cjs');
const root = path.resolve(__dirname, '..');
const selected = root + '/scratch/runs/20261108-darkstone-bat-continuation-1910';
const pause = ms => new Promise(r => setTimeout(r, ms));

async function child(t, mode = 'delay') {
  const p = spawn(process.execPath, ['-e', `
    process.on('SIGTERM',()=>{if('${mode}'!=='stubborn')process.exit(0)});
    process.on('message',()=>{if('${mode}'==='delay')setTimeout(()=>process.exit(0),180)});
    setInterval(()=>{},1000);process.send('ready');
  `], {stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
  t.after(async () => {
    if (p.exitCode === null && p.signalCode === null) {
      const closed = once(p, 'close'); p.kill('SIGKILL'); await closed;
    }
  });
  await once(p, 'message');
  return p;
}

test('CDP ACK plus delayed real exit waits, no escalation, actual close drained', async t => {
  const p = await child(t), rows = []; let calls = 0;
  const receipt = await closeBrowser({browser: p, graceMs: 600, termMs: 100, killMs: 200,
    requestClose: async () => { calls++; p.send('close'); }, record: r => rows.push(r)});
  assert.equal(calls, 1); assert.equal(receipt.normal, true);
  assert(receipt.elapsedMs >= 150);
  assert.deepEqual(rows.map(r => r.kind), ['close-ack', 'exit', 'drained', 'result']);
  assert.equal(p.exitCode, 0); assert.equal(p.stdout.destroyed, true);
  assert.throws(() => process.kill(p.pid, 0), {code: 'ESRCH'});
  console.log(JSON.stringify({case: 'delayed-exit', receipt, rows}));
});

test('stubborn actual child receives TERM then KILL and drains before return', async t => {
  const p = await child(t, 'stubborn'), rows = [];
  const receipt = await closeBrowser({browser: p, requestClose: async () => {},
    graceMs: 100, termMs: 100, killMs: 600, record: r => rows.push(r)});
  assert.deepEqual(rows.filter(r => r.kind === 'signal').map(r => r.signal), ['SIGTERM', 'SIGKILL']);
  assert.deepEqual(receipt.terminal, {code: null, signal: 'SIGKILL'});
  assert.equal(receipt.drained, true); assert.equal(receipt.normal, false);
  assert.equal(p.stdout.destroyed, true);
  assert.throws(() => process.kill(p.pid, 0), {code: 'ESRCH'});
  console.log(JSON.stringify({case: 'stubborn', receipt, rows}));
});

for (const disconnected of ['rejected', 'never settles']) {
  test('disconnected endpoint ' + disconnected + ' remains finite without replay', async t => {
    const p = await child(t, 'term'), rows = []; let calls = 0;
    const receipt = await closeBrowser({browser: p,
      requestClose: () => { calls++; return disconnected === 'rejected'
        ? Promise.reject(Error('disconnected')) : new Promise(() => {}); },
      graceMs: 100, termMs: 300, killMs: 200, record: r => rows.push(r)});
    assert.equal(calls, 1); assert.equal(receipt.drained, true);
    assert.equal(receipt.normal, false, 'TERM handler exit0 is still escalated');
    assert(receipt.elapsedMs < 600);
    assert.equal(rows.filter(r => r.kind === 'signal').length, 1);
    if (disconnected === 'rejected') assert(rows.some(r => r.kind === 'close-unknown' && r.noReplay));
  });
}

test('already signaled child is terminal, does not receive another close/signal', async t => {
  const p = await child(t, 'stubborn');
  const closed = once(p, 'close'); p.kill('SIGTERM');
  // Stubborn ignores TERM; use an actual signal termination.
  p.kill('SIGKILL'); await closed;
  const rows = [], receipt = await closeBrowser({browser: p,
    requestClose: () => assert.fail('replayed close'), record: r => rows.push(r)});
  assert.equal(receipt.terminal.signal, 'SIGKILL');
  assert.equal(receipt.drained, true); assert(!rows.some(r => r.kind === 'signal'));
});

test('historical selected close ACKs before stubborn child exit (scaled 8s/5s)', async t => {
  const source = fs.readFileSync(selected + '/browser.cjs', 'utf8');
  const browser = await child(t, 'stubborn');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'darkstone-old-close-'));
  t.after(() => fs.rmSync(out, {recursive: true, force: true}));
  fs.mkdirSync(out + '/chrome-profile');
  let cleanup;
  const context = vm.createContext({fs, console, browser, out, closing: false,
    timer: null, diskMonitor: null, clearTimeout, clearInterval, pending: new Map(),
    server: null, ws: {readyState: 1, close() {}}, send: async () => {},
    evaluate: async () => [], save() {},
    wait: ms => pause(ms / 100), t: {closed: (dir, code) => { cleanup = {code, signal: browser.signalCode}; }}});
  const close = source.slice(source.indexOf('async function close(reason)'), source.indexOf('async function execute('));
  vm.runInContext(close, context);
  const closed = once(browser, 'close');
  await context.close('historical scaled control');
  assert.deepEqual(cleanup, {code: null, signal: null});
  assert.equal(fs.existsSync(out + '/chrome-profile'), false);
  await closed;
  assert.equal(browser.signalCode, 'SIGKILL');
  console.log(JSON.stringify({case: 'historical-premature-cleanup', cleanup, laterSignal: browser.signalCode}));
});

async function pipeChild(t) {
  const p = spawn(process.execPath, ['-e', `
      const {spawn}=require('node:child_process');
      const writer=spawn(process.execPath,['-e','setTimeout(()=>process.exit(0),400)'],
        {stdio:['ignore',process.stdout,process.stderr]});
      writer.unref();process.send({writer:writer.pid});
      process.on('message',()=>setTimeout(()=>process.exit(0),30));
    `], {stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
  await once(p, 'message');
  const closed = once(p, 'close');
  t.after(async () => { if(p.exitCode===null&&p.signalCode===null)p.kill('SIGKILL'); await closed; });
  return p;
}

for (const capFails of [false, true]) {
  test('real inherited pipe writer ' + (capFails ? 'exceeds cap: UNKNOWN' : 'drains after root exit'), async t => {
    const p = await pipeChild(t), closed = once(p, 'close'), rows = [];
    const operation = closeBrowser({browser: p, requestClose: async () => p.send('close'),
      graceMs: capFails ? 80 : 700, termMs: 50, killMs: 50, record: r => rows.push(r)});
    if (capFails) {
      await assert.rejects(operation, e => {
        assert.equal(e.receipt.drained, false);
        assert.equal(e.receipt.terminal.code, 0);
        assert.equal(e.receipt.normal, false); return /UNKNOWN/.test(e.message);
      });
      assert.equal(p.stdout.destroyed, false);
      assert(!rows.some(r => r.kind === 'signal'));
    } else {
      const receipt = await operation;
      assert.equal(receipt.normal, true); assert(receipt.elapsedMs >= 300);
      assert(rows.findIndex(r=>r.kind==='exit') < rows.findIndex(r=>r.kind==='drained'));
      assert.equal(p.stdout.destroyed, true);
    }
    await closed;
    console.log(JSON.stringify({case: capFails ? 'pipe-cap-unknown' : 'pipe-drain', rows}));
  });
}

for (const capFails of [false, true]) {
test('exact repaired driver quit ' + (capFails ? 'UNKNOWN retains profile, no ACK' : 'ACK follows terminal and drain'), async t => {
  const source = repairDriver(fs.readFileSync(selected + '/browser.cjs', 'utf8'));
  assert.throws(() => repairDriver(source), /unrecognized/);
  new vm.Script(source);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'darkstone-close-'));
  t.after(() => fs.rmSync(out, {recursive: true, force: true}));
  fs.mkdirSync(out + '/commands'); fs.mkdirSync(out + '/chrome-profile');
  const browser = capFails ? await pipeChild(t) : await child(t), rows = [], server = http.createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const port = server.address().port;
  let requested = 0, wsClosed = false;
  const load = name => name === root + '/tools/native-browser-close.cjs' && capFails
    ? {closeBrowser: options => closeBrowser({...options, graceMs: 80, termMs: 50, killMs: 50})} : require(name);
  const context = vm.createContext({fs, console, require: load, process: {exitCode: 0}, root, out, browser, server,
    closing: false, timer: null, diskMonitor: null, pending: new Map(),
    clearTimeout, clearInterval, Date, assert, deadline: Date.now() + 5000,
    ws: {readyState: 1, close: () => { wsClosed = true; }},
    send: async method => { assert.equal(method, 'Browser.close'); requested++; browser.send('close'); },
    evaluate: async expr => expr.includes('v?.files') ? [] : [],
    save: (n, v) => fs.writeFileSync(out + '/' + n, JSON.stringify(v)),
    log: (n, v) => rows.push(v),
    t: require(selected + '/transport.cjs')});
  const close = source.slice(source.indexOf('let closePromise;function close(reason)'), source.indexOf('async function execute('));
  const execute = source.slice(source.indexOf('async function execute('), source.indexOf('(async()=>{\n server='));
  vm.runInContext(close + '\n' + execute, context);
  fs.writeFileSync(out + '/commands/0.json', JSON.stringify({id: 'finish-run', action: 'quit'}));
  const completion = context.t.consume(out, 0, context.execute);
  await pause(50);
  const concurrentClose = context.close('concurrent deadline');
  concurrentClose.catch(() => {});
  assert.equal(fs.existsSync(out + '/reply-0.json'), false);
  assert.equal(fs.existsSync(out + '/cleanup.json'), false);
  assert.equal(fs.existsSync(out + '/chrome-profile'), true);
  if (capFails) {
    await assert.rejects(completion, /UNKNOWN/);
    await assert.rejects(concurrentClose, /UNKNOWN/);
    assert.equal(requested, 1); assert.equal(wsClosed, true);
    assert.equal(fs.existsSync(out + '/chrome-profile'), true);
    assert.equal(fs.existsSync(out + '/reply-0.json'), false);
    assert.equal(fs.existsSync(out + '/cleanup.json'), false);
    assert.equal(JSON.parse(fs.readFileSync(out + '/browser-drain-unknown.json')).receipt.drained, false);
    assert.equal(JSON.parse(fs.readFileSync(out + '/first-failure.json')).noReplay, true);
    await assert.rejects(fetch('http://127.0.0.1:' + port), /fetch failed/);
    return;
  }
  await completion; await concurrentClose;
  assert.equal(requested, 1); assert.equal(wsClosed, true);
  assert.equal(fs.existsSync(out + '/chrome-profile'), false);
  assert.equal(JSON.parse(fs.readFileSync(out + '/reply-0.json')).ok, true);
  const receipt = JSON.parse(fs.readFileSync(out + '/browser-terminal.json'));
  assert.equal(receipt.normal, true); assert.equal(receipt.drained, true);
  await assert.rejects(fetch('http://127.0.0.1:' + port), /fetch failed/);
  assert(rows.findIndex(r => r.kind === 'drained') < rows.findIndex(r => r.kind === 'result'));
  console.log(JSON.stringify({case: 'driver-quit', receipt, portClosed: true, profileRemovedAfterDrain: true}));
});
}
