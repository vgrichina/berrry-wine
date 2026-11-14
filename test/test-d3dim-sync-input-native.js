#!/usr/bin/env node
'use strict';
// Actual CLI endpoint, shared WASM owner/window and native synchronous D3DIM.
// Solitaire is only a window fixture; the test initializes a real lazy GL target.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {startControlSession} = require('./control-session');
const hgl = require('../lib/headless-gl');
if (!hgl.available()) {
  if (process.env.REQUIRE_NATIVE_GL) throw new Error(hgl.unavailableReason());
  console.log('SKIP synchronous native input: optional GL provider unavailable');
  process.exit(0);
}
const port = 20000 + process.pid % 10000;
let session, nativeIdentity, result, failure;
const watchdog = spawn(process.execPath, ['-e', `
  const fs=require('fs');let target;
  const token=p=>{const s=fs.readFileSync('/proc/'+p+'/stat','utf8');return s.slice(s.lastIndexOf(')')+2).split(/\\s+/)[19]};
  const timer=setTimeout(()=>{try{if(target&&token(target.pid)===target.token)process.kill(-target.pid,'SIGTERM')}catch{};process.exit(2)},90000);
  console.log(JSON.stringify({armedAt:Date.now(),deadline:Date.now()+90000}));
  const rl=require('readline').createInterface({input:process.stdin});
  rl.on('line',s=>target=JSON.parse(s));rl.on('close',()=>clearTimeout(timer));
`], {stdio: ['pipe', 'pipe', 'pipe']});
const watchdogClosed = once(watchdog, 'close');
(async () => {
  const [armed] = await once(watchdog.stdout, 'data');
  const deadline = JSON.parse(String(armed));
  session = startControlSession(['test/run.js', '--app=sol', '--no-build', '--frozen',
    '--control-stdin', '--control='+port, '--max-seconds=70', '--quiet-api', '--quiet-blocks',
    '--headless-gl', '--d3dim-gpu'], {cwd: path.resolve(__dirname, '..'), spawnOptions: {detached: true}});
  const stat = fs.readFileSync('/proc/'+session.child.pid+'/stat', 'utf8');
  watchdog.stdin.write(JSON.stringify({pid: session.child.pid, token: stat.slice(stat.lastIndexOf(')')+2).split(/\s+/)[19]})+'\n');
  const send = session.send;
  const evaluate = code => send({action: 'eval', code});
  const http = async command => {
    const r = await fetch('http://127.0.0.1:'+port+'/ctl', {method: 'POST',
      signal: AbortSignal.timeout(10000), body: JSON.stringify(command)});
    const reply = await r.json();
    if (!reply.ok) throw new Error(reply.error || JSON.stringify(reply));
    return reply.value;
  };
  await send({action: 'step', n: 10});
  await assert.rejects(http({action: 'guarded-bind'}), /unavailable/);
  nativeIdentity = await evaluate(`(()=>{
    const d=ctx.d3dCommands;
    if(d.constructor.name!=='D3DIMGpu')throw Error('wrong executor');
    const t=d._target({rt:64,dib:256,pitch:128,width:32,height:32,bpp:32,format:0});
    const g=t.device.gpu.gl;
    return {className:d.constructor.name,ready:d.snapshot().ready,renderer:g.getParameter(g.RENDERER),version:g.getParameter(g.VERSION)};
  })()`);
  assert.equal(nativeIdentity.ready, true);
  const owner = await http({action: 'guarded-bind'});
  const receipt = await http({action: 'guarded-input', cmd: 'keydown:65',
    guard: {...owner, nonce: 'native-sync', reviewed: true, deadline: Date.now()+5000}});
  assert.equal(receipt.queued, true);
  await send({action: 'step', n: 1});
  const consumed = await http({action: 'guarded-status', nonce: 'native-sync'});
  assert.equal(consumed.state, 'CONSUMED'); assert.equal(consumed.consumed, true); assert.equal(consumed.noReplay, true);
  await http({action: 'guarded-release', owner: owner.owner});
  await evaluate('ctx.d3dCommands.stop();true');
  await assert.rejects(http({action: 'guarded-bind'}), /unavailable/);
  await send({action: 'quit'}); session.child.stdin.end();
  assert.equal(await session.exited, 0);
  result = {nativeIdentity, consumed, watchdog: deadline, actualChildWait: true, childExit: session.child.exitCode, bothEOF: true};
  console.log('PASS actual native synchronous D3DIM/public guarded CLI admission, consumption, independent release and stopped refusal');
})().catch(async error => {
  failure = error.stack; console.error(failure); process.exitCode = 1;
  try {await session?.quit();} catch (_) {}
}).finally(async () => {
  watchdog.stdin.end(); const [code] = await watchdogClosed;
  assert.equal(code, 0, 'independent fixture watchdog fired');
  if (process.env.SYNC_NATIVE_EVIDENCE) {
    fs.writeFileSync(path.join(process.env.SYNC_NATIVE_EVIDENCE, 'native-guard-result.json'), JSON.stringify({...result, failure, watchdogExit: code, watchdogBothEOF: true}, null, 2)+'\n');
    fs.writeFileSync(path.join(process.env.SYNC_NATIVE_EVIDENCE, 'native-guard-cli.log'), session?.output() || 'not launched');
  }
});
