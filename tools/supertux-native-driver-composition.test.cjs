'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const readline = require('node:readline');
const {createTransport, compose, applyPatch} = require('./supertux-native-driver-composition.cjs');
const lifecycle = require('./supertux-native-lifecycle.cjs');
const root = path.resolve(__dirname, '..');
const run = process.env.COMPOSITION_RUN;
assert(run && path.isAbsolute(run), 'explicit evidence directory');

(async () => {
  const manifest = JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(run + '/composition-pins.json.gz')));
  const integrated = compose({root, manifest});
  assert(integrated.source.indexOf('await pauseController?.settle()') < integrated.source.indexOf('await logs.drainStreams()'));
  assert(!integrated.source.includes('pending.delete(n)'));
  assert.throws(() => compose({root, manifest: {...manifest, files: manifest.files.map((pin, i) =>
    i === 0 ? {...pin, sha256: '0'.repeat(64)} : pin)}}));
  assert.throws(() => compose({root, manifest: {...manifest, files: manifest.files.filter(pin =>
    pin.path !== 'tools/supertux-native-lifecycle.cjs')}}), /unique pinned provider/);
  assert.throws(() => applyPatch('a\nb\n', '--- a\n+++ a\n@@ -1,1 +1,1 @@\n-c\n+d\n'));
  assert.throws(() => applyPatch('a\nb\n', '--- a\n+++ a\n@@ -1,2 +1,1 @@\n-a\n+d\n'));

  let child, closed;
  // Observable finite cap precedes the actual Node child, never Chrome/game.
  const cap = setTimeout(() => child?.kill('SIGKILL'), 8000);
  const fixture = String.raw`
    const fs=require('node:fs'),rl=require('node:readline');
    setTimeout(()=>fs.writeFileSync(process.argv[1]+'/DevToolsActivePort','43210\n/devtools/browser/composition-fixture\n'),80);
    const input=rl.createInterface({input:process.stdin});
    input.on('line',line=>{
      if(line==='STOP'){input.close();process.stdin.destroy();return;}
      const m=JSON.parse(line);
      if(m.params.code==='Never')return;
      setTimeout(()=>process.stdout.write(JSON.stringify({id:m.id,result:{actual:true,type:m.params.type}})+'\n'),m.params.type==='keyDown'?250:5);
    });
  `;
  child = cp.spawn(process.execPath, ['-e', fixture, run], {stdio: ['pipe', 'pipe', 'pipe']});
  closed = new Promise((resolve, reject) => {child.once('error', reject);child.once('close', (code, signal) => resolve({code, signal}));});
  let stderr = ''; child.stderr.on('data', b => { stderr += b; });
  const cdp = createTransport({write: line => child.stdin.write(line + '\n'), timeoutMs: 20});
  const lines = readline.createInterface({input: child.stdout});
  lines.on('line', line => cdp.receive(JSON.parse(line)));
  child.once('close', () => cdp.disconnect());
  try {
    const ready = await lifecycle.ready({browser: child, profile: run, deadline: Date.now() + 2000});
    assert.equal(ready.debugPort, 43210);
    const input = require('../scratch/runs/20261108-supertux-short-step-progression-2236/input.cjs');
    let downDone = false, upDone = false, down, up;
    const began = Date.now();
    await assert.rejects(input.pulse({deadline: Date.now() + 2000, holdMs: 60, ackMs: 30,
      down: () => down = cdp.send('Input.dispatchKeyEvent', {type: 'keyDown', code: 'ArrowRight'}).then(r => {downDone = true;return r;}),
      up: () => up = cdp.send('Input.dispatchKeyEvent', {type: 'keyUp', code: 'ArrowRight'}).then(r => {upDone = true;return r;})}), /UNKNOWN/);
    assert(!downDone && upDone, 'real UP precedes pending real DOWN');
    assert.equal(cdp.pending.size, 1);
    await input.drain();
    assert(downDone && Date.now() - began >= 200, 'original DOWN survived ordinary CDP timeout');
    assert((await down).actual && (await up).actual);
    assert.equal(cdp.pending.size, 0);
    const never = cdp.send('Input.dispatchKeyEvent', {type: 'keyDown', code: 'Never'});
    const neverRejected = assert.rejects(never, /disconnected/);
    const receipt = await lifecycle.close({browser: child, requestClose: () => {
      child.stdin.end('STOP\n'); return new Promise(() => {});
    }});
    await neverRejected;
    assert(receipt.drained && receipt.normal && receipt.closeRequest === 'pending');
    assert.deepEqual(await closed, {code: 0, signal: null});
    assert.equal(stderr, '');
    await assert.rejects(cdp.send('Input.dispatchKeyEvent', {}), /closed/);
    assert.equal(cdp.pending.size, 0);
    assert.equal(input.physical.size, 0);
    console.log(JSON.stringify({passed: true, actualNodeChild: child.pid, terminal: await closed,
      stdioEOF: true, lifecycleReceipt: receipt, integratedSHA256: integrated.sha256,
      providers: integrated.providers, pendingDOWNIndependentUP: true,
      originalReplyRetainedPastTimeout: true, syntaxOnlyBrowser: true, noBrowserOrGame: true}));
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed; lines.close(); clearTimeout(cap);
  }
})().catch(error => {console.error(error);process.exitCode = 1;});
