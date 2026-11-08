'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const {once} = require('node:events');
const lifecycle = require('./supertux-native-lifecycle.cjs');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'supertux-native-lifecycle-'));
  const children = [];
  function child(script, ...args) {
    const p = cp.spawn(process.execPath, ['-e', script, ...args], {stdio: ['ignore', 'pipe', 'pipe']});
    children.push(p);
    p.wait = once(p, 'close');
    p.stdout.resume(); p.stderr.resume();
    return p;
  }
  // Observable, independent finite cap precedes the first fixture child.
  const cap = setTimeout(() => { for (const p of children) p.kill('SIGKILL'); }, 30000);
  const results = [];
  try {
    const profile = path.join(root, 'late'); fs.mkdirSync(profile);
    const rows = [], deadline = Date.now() + 20000;
    const late = child(`const fs=require('fs');setTimeout(()=>fs.writeFileSync(process.argv[1], '43123\\n/devtools/browser/late-endpoint\\n'),11000);setInterval(()=>{},1000);`, path.join(profile, 'DevToolsActivePort'));
    const endpoint = await lifecycle.ready({browser: late, profile, deadline, record: r => rows.push(r)});
    assert(endpoint.elapsedMs >= 10000, 'must cross the original failing ten-second boundary');
    assert.equal(endpoint.debugPort, 43123);
    assert.equal(endpoint.browserPath, '/devtools/browser/late-endpoint');
    assert(rows[0].startupDeadline <= deadline);
    const closed = await lifecycle.close({browser: late, requestClose: () => { late.kill('SIGTERM'); return new Promise(() => {}); }, record: r => rows.push(r)});
    await late.wait;
    assert(closed.drained && closed.terminal.signal === 'SIGTERM');
    assert.equal(closed.closeRequest, 'pending');
    assert.equal(closed.normal, false);
    assert.deepEqual(closed.signals, []);
    assert(rows.some(r => r.kind === 'drained'));
    results.push('late endpoint after ten seconds; pending close reply does not block actual terminal/stdio drain');

    const partial = path.join(root, 'partial'); fs.mkdirSync(partial);
    fs.writeFileSync(path.join(partial, 'DevToolsActivePort'), '43123\n');
    const sleeper = child('setInterval(()=>{},1000)');
    const capRows = [], began = Date.now();
    await assert.rejects(lifecycle.ready({browser: sleeper, profile: partial, deadline: began + 200, record: r => capRows.push(r)}), /startup deadline.*incomplete/);
    assert.equal(capRows[0].startupDeadline, began + 200);
    assert(capRows.some(r => r.noReplay === true));
    sleeper.kill('SIGTERM'); await sleeper.wait;
    results.push('partial endpoint refused at original immutable deadline');

    const exited = child('process.exit(7)'); await exited.wait;
    await assert.rejects(lifecycle.ready({browser: exited, profile, deadline: Date.now() + 1000}), /terminated before DevTools/);
    await assert.rejects(lifecycle.ready({browser: exited, profile, deadline: Date.now() - 1}), /expired/);
    results.push('dead Chrome identity and expired budget refused without launch or replay');
    console.log(JSON.stringify({passed: true, controls: results, actualChildWaits: children.length,
      noChrome: true, noGameOrInput: true, nativeConsumers: ['native-devtools-ready.cjs', 'native-browser-close.cjs']}));
  } finally {
    for (const p of children) if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL');
    await Promise.all(children.map(p => p.wait));
    clearTimeout(cap);
    fs.rmSync(root, {recursive: true, force: true});
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
