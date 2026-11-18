'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const cp = require('node:child_process');
const flags = require('../tools/browser-component-update-args.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const free = () => { const s = fs.statfsSync('/home'); return s.bavail * s.bsize; };
const join = child => new Promise(resolve => child.once('close', (code, signal) => resolve({
  code, signal, stdoutEOF: child.stdout.readableEnded, stderrEOF: child.stderr.readableEnded,
})));

// Exercise the real updater against loopback. No update package is offered,
// so the negative proves the old background writer starts without filling a
// shared filesystem or depending on an external update server.
async function browser(disabled) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'component-writer-'));
  const profile = path.join(root, 'profile'), temporary = path.join(root, 'tmp');
  fs.mkdirSync(temporary);
  let checks = 0, minimumFree = free(), low = false, child, watchdog, childWait, watchdogWait, stderr = '';
  const server = http.createServer((req, res) => {
    let bytes = 0;
    req.on('data', b => { bytes += b.length; if (bytes > 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      checks++;
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({response:{protocol:'3.1', app:[]}}));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/update';
  let monitor;
  try {
    assert(minimumFree > 1500000000, 'actual disk floor before fixture');
    child = cp.spawn('/usr/bin/google-chrome', [
      ...(disabled ? flags : []), '--headless=new', '--no-sandbox', '--no-first-run',
      '--no-default-browser-check', '--disable-dev-shm-usage', '--disable-background-networking',
      '--disable-sync', '--bw-timezone=Etc/UTC', '--remote-debugging-port=0',
      '--component-updater=initial-delay=1,disable-pings,url-source=' + url,
      '--user-data-dir=' + profile, 'about:blank',
    ], {detached:true, stdio:['ignore','pipe','pipe'], env:{...process.env,TMPDIR:temporary}});
    childWait = join(child); child.stdout.resume();
    child.stderr.on('data', b => { if (stderr.length < 4000) stderr += b.toString(); });
    const kill = signal => { try { process.kill(-child.pid, signal); } catch (e) { if (e.code !== 'ESRCH') throw e; } };
    // Independent finite watchdog survives a stalled test event loop.
    watchdog = cp.spawn(process.execPath, ['-e', `
      const pid=Number(process.argv[1]);
      const timer=setTimeout(()=>{try{process.kill(-pid,'SIGKILL')}catch{};console.log('deadline');process.exit(1)},40000);
      process.stdin.once('data',()=>{clearTimeout(timer);console.log('joined');process.exit(0)});
      process.stdin.once('end',()=>{try{process.kill(-pid,'SIGKILL')}catch{};process.exit(1)});
    `, String(child.pid)], {stdio:['pipe','pipe','pipe']});
    watchdogWait = join(watchdog); watchdog.stdout.resume(); watchdog.stderr.resume();
    monitor = setInterval(() => {
      minimumFree = Math.min(minimumFree, free());
      if (minimumFree <= 1550000000) { low = true; kill('SIGTERM'); }
    }, 50);
    const active = path.join(profile, 'DevToolsActivePort'), deadline = Date.now() + 15000;
    while (!fs.existsSync(active) && child.exitCode === null && Date.now() < deadline) await delay(20);
    assert(fs.existsSync(active), 'real browser started: ' + stderr);
    const until = Date.now() + 8000;
    while (Date.now() < until && !low && child.exitCode === null) await delay(20);
    assert(!low, 'fixture interrupted by actual disk reserve');
    const [port, endpoint] = fs.readFileSync(active, 'utf8').trim().split('\n');
    const ws = new WebSocket('ws://127.0.0.1:' + port + endpoint);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    ws.send(JSON.stringify({id:1,method:'Browser.close'}));
    let timer;
    const receipt = await Promise.race([childWait, new Promise(resolve => {
      timer = setTimeout(() => { kill('SIGKILL'); resolve(childWait); }, 5000);
    })]);
    clearTimeout(timer); ws.close();
    assert.equal(receipt.stdoutEOF, true); assert.equal(receipt.stderrEOF, true);
    watchdog.stdin.end('done');
    const watchReceipt = await watchdogWait;
    assert.deepEqual(watchReceipt, {code:0,signal:null,stdoutEOF:true,stderrEOF:true});
    assert(!fs.existsSync('/proc/' + child.pid), 'actual browser PID drained');
    return {checks, minimumFree, receipt, watchReceipt};
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }
    if (childWait) await childWait;
    if (watchdog && watchdog.exitCode === null) watchdog.stdin.end('done');
    if (watchdogWait) await watchdogWait;
    clearInterval(monitor);
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, {recursive:true,force:true});
    assert(!fs.existsSync(root), 'profile and updater temp files removed after actual drain');
    assert(free() > 1500000000, 'actual disk floor after drain');
  }
}

test('real component updater starts with old args and stays disabled with project args', {timeout:60000}, async () => {
  for (const name of ['gltron-browser-controller.cjs','revolt-manual-controller.cjs','caesar3-native-browser.cjs']) {
    assert(fs.readFileSync(path.join(__dirname,'../tools',name),'utf8').includes("...require('./browser-component-update-args.cjs')"));
  }
  const old = await browser(false);
  assert(old.checks > 0, 'old launch starts the unrelated component updater');
  const fixed = await browser(true);
  assert.equal(fixed.checks, 0, 'fixed launch prevents the writer before its update request');
  console.log(JSON.stringify({old, fixed}));
});
