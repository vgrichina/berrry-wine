#!/usr/bin/env node
'use strict';
// Real run.js producer -> frozen schedule -> renderer -> guest queue tests.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { once } = require('events');
const { startControlSession } = require('./control-session');
const root = path.resolve(__dirname, '..');
const evidence = process.env.GUARD_TEST_EVIDENCE;
const port = 18000 + process.pid % 10000;
let session, send, armedAt, launchedAt, releaseEvidence;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Arm the separate absolute wall deadline before creating the runtime. Its
// target arrives later over stdin, with Linux start ticks to prevent PID reuse.
const watchdog = spawn(process.execPath, ['-e', `
 const fs=require('fs');let target;
 const ticks=p=>{const s=fs.readFileSync('/proc/'+p+'/stat','utf8');return s.slice(s.lastIndexOf(')')+2).trim().split(/\\s+/)[19]};
 const timer=setTimeout(()=>{try{if(target&&ticks(target.pid)===target.ticks)process.kill(-target.pid,'SIGTERM')}catch{};process.exit(2)},120000);
 console.log(JSON.stringify({armedAt:Date.now(),deadline:Date.now()+120000}));
 const rl=require('readline').createInterface({input:process.stdin});
 rl.on('line',s=>{target=JSON.parse(s)});rl.on('close',()=>{clearTimeout(timer)});
`], { stdio: ['pipe', 'pipe', 'pipe'] });
const watchdogClosed = once(watchdog, 'close');
const checks = [];
const check = (name, condition) => { assert(condition, name); checks.push(name); };
let bind, serial = 0;
const evaluate = code => send({ action: 'eval', code });
const bindOwner = async () => (bind = await send({ action: 'guarded-bind' }));
const queue = (cmd, extra = {}) => send({ action: 'guarded-input', cmd,
  guard: { ...bind, nonce: 'n' + (++serial), deadline: Date.now() + 5000, reviewed: true, ...extra } });
const status = nonce => send({ action: 'guarded-status', nonce });
const events = () => evaluate('globalThis.guardEvents');
(async () => {
  const [armed] = await once(watchdog.stdout, 'data');
  armedAt = JSON.parse(String(armed)).armedAt;
  launchedAt = Date.now();
  session = startControlSession(['test/run.js', '--app=sol', '--no-build',
    '--control-stdin', '--control=' + port, '--frozen', '--max-seconds=60',
    '--quiet-api', '--quiet-blocks', '--d3d-worker', '--live-present'],
    { cwd: root, spawnOptions: { detached: true } });
  send = session.send;
  const stat = fs.readFileSync('/proc/'+session.child.pid+'/stat','utf8');
  watchdog.stdin.write(JSON.stringify({pid:session.child.pid,
    ticks:stat.slice(stat.lastIndexOf(')')+2).trim().split(/\s+/)[19]})+'\n');
  check('independent watchdog armed before launch', armedAt <= launchedAt);
  await send({ action: 'step', n: 10 });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('!!ctx.d3dCommands?.snapshot().ready')) break;
    if (i === 99) throw new Error('actual D3DIM worker not ready');
    await sleep(20);
  }
  await evaluate(`globalThis.guardEvents=[];globalThis.realDown=renderer.handleKeyDown;
    renderer.handleKeyDown=function(k){guardEvents.push(k);return realDown.call(this,k)};true`);
  await bindOwner();
  const q = await queue('keydown:65');
  check('queued ACK has no effect', q.queued && !q.consumed && (await events()).length === 0);
  await send({ action: 'step', n: 1 });
  check('actual consumer effect receipt', (await status(q.nonce)).consumed && (await events()).length === 1);
  await assert.rejects(queue('keydown:65', { nonce: q.nonce }), /nonce/);
  await send({ action: 'step', n: 1 });
  check('known duplicate has one effect', (await events()).length === 1);
  await send({ action: 'guarded-release', owner: bind.owner });
  const e = await queue('keydown:66', { deadline: Date.now() + 100 });
  await sleep(150);
  await send({ action: 'step', n: 1 });
  check('expiry between enqueue and consume', (await status(e.nonce)).state === 'CANCELLED' && (await events()).length === 1);
  // A synchronous long turn prevents the timer firing first: consumption itself
  // must check the immutable deadline.
  const late = await queue('keydown:67', { deadline: Date.now() + 100 });
  await evaluate('(()=>{const end=Date.now()+150;while(Date.now()<end){};return true})()');
  await send({ action: 'step', n: 1 });
  check('deadline checked after long producer turn', !(await status(late.nonce)).consumed && (await events()).length === 1);
  for (const [name, replace, restore] of [
    ['queue', 'globalThis.saved=renderer.inputQueue;renderer.inputQueue=[]', 'renderer.inputQueue=saved'],
    ['window', 'globalThis.saved=renderer.windows[exports.get_main_hwnd()];renderer.windows[exports.get_main_hwnd()]={...saved}', 'renderer.windows[exports.get_main_hwnd()]=saved'],
    ['device', 'globalThis.saved=ctx.d3dCommands;ctx.d3dCommands={}', 'ctx.d3dCommands=saved'],
  ]) {
    const before = (await events()).length;
    const t = await queue('keydown:68');
    await evaluate(replace + ';true');
    await send({ action: 'step', n: 1 });
    check(name + ' replaced after enqueue', !(await status(t.nonce)).consumed && (await events()).length === before);
    await evaluate(restore + ';true');
    await bindOwner();
  }
  const inspection = await queue('keydown:74');
  await evaluate('globalThis.savedSnapshot=ctx.d3dCommands.snapshot;ctx.d3dCommands.snapshot=()=>{throw Error("fixture inspect error")};true');
  await send({ action: 'step', n: 1 });
  check('inspection error cancels with terminal UNKNOWN', (await status(inspection.nonce)).state === 'UNKNOWN' && !(await events()).includes(74));
  await evaluate('ctx.d3dCommands.snapshot=savedSnapshot;true');
  await bindOwner();
  const replaced = await queue('keydown:69');
  const old = bind;
  await bindOwner();
  await send({ action: 'step', n: 1 });
  check('owner epoch replacement cancels pending DOWN', !(await status(replaced.nonce)).consumed);
  await assert.rejects(send({ action: 'guarded-input', cmd: 'keydown:69', guard: { ...old,
    nonce: 'stale-epoch', deadline: Date.now()+1000, reviewed: true } }), /owner|epoch/);
  const pending = await queue('keydown:70');
  const release = spawn(process.execPath, ['-e', `fetch('http://127.0.0.1:${port}/ctl',{
    method:'POST',signal:AbortSignal.timeout(5000),body:JSON.stringify({action:'guarded-release',owner:${JSON.stringify(bind.owner)}})
  }).then(r=>r.json()).then(r=>{console.log(JSON.stringify(r));if(!r.ok)process.exitCode=1}).catch(e=>{console.error(e);process.exitCode=1})`], { stdio: ['ignore', 'pipe', 'pipe'] });
  let releaseOut='', releaseErr='';release.stdout.on('data', b=>releaseOut+=b);release.stderr.on('data', b=>releaseErr+=b);
  const [releaseCode] = await once(release, 'close');
  releaseEvidence = { pid: release.pid, returncode: releaseCode, stdoutEOF: true, stderrEOF: true,
    stdout: releaseOut, stderr: releaseErr };
  check('independent release HTTP receipt', releaseCode === 0 && JSON.parse(releaseOut).value.released);
  await send({ action: 'step', n: 1 });
  check('UP before pending DOWN cancels it', !(await status(pending.nonce)).consumed && !(await events()).includes(70));
  // Handler errors are terminal UNKNOWN; no retry even if restored.
  await evaluate('renderer.handleKeyDown=function(){throw Error("fixture effect error")};true');
  await bindOwner();
  const bad = await queue('keydown:71');
  await send({ action: 'step', n: 1 });
  check('effect error sticky UNKNOWN', (await status(bad.nonce)).state === 'UNKNOWN');
  await assert.rejects(queue('keydown:71', { nonce: bad.nonce }), /nonce/);
  await evaluate('renderer.handleKeyDown=realDown;true');
  await bindOwner();
  // Keep the actual renderer queue undrained after the physical handler. On
  // expiry it must lose the queued DOWN and retain an independent release.
  await evaluate('globalThis.realCheck=renderer.checkInput;renderer.checkInput=()=>0;true');
  const held = await queue('keydown:72', { deadline: Date.now() + 300 });
  await send({ action: 'step', n: 1 });
  check('physical handler consumed once', (await status(held.nonce)).consumed);
  await sleep(350);
  const queuedKeys = await evaluate('renderer.inputQueue.map(e=>({msg:e.msg,key:e.wParam}))');
  check('expired undelivered DOWN removed', !queuedKeys.some(e=>e.msg===256 && e.key===72));
  check('cleanup UP survives expiry', queuedKeys.some(e=>e.msg===257 && e.key===72));
  check('physical cleanup despite refusal', await evaluate('renderer.peekKeyDownState(72)===0'));
  await evaluate('renderer.checkInput=realCheck;true');
  await send({ action: 'step', n: 1 });
  await evaluate('renderer.checkInput=realCheck;true');
  await bindOwner();
  await evaluate('renderer.checkInput=()=>0;true');
  const delivery = await queue('keydown:73');
  await send({ action: 'step', n: 1 });
  await evaluate('globalThis.oldDeliveryWindow=renderer.windows[exports.get_main_hwnd()];renderer.windows[exports.get_main_hwnd()]={...oldDeliveryWindow};true');
  const taken = await evaluate('(()=>{const out=[];for(let i=0;i<20;i++){const e=renderer.takeInput();if(!e)break;out.push({msg:e.msg,key:e.wParam})};return out})()');
  check('owner rechecked before actual takeInput effect', !taken.some(e=>e.msg===256 && e.key===73) && (await status(delivery.nonce)).state === 'CANCELLED');
  await evaluate('renderer.windows[exports.get_main_hwnd()]=oldDeliveryWindow;renderer.checkInput=realCheck;true');
  await bindOwner();
  // Exercise production transport timeout against the same production guard,
  // including the real scheduled consumer callback after cancellation.
  const { createGuardedInput } = require('../lib/cli-guarded-input');
  const { startControlServer } = require('../lib/control-server');
  let effects = 0;
  const queueRef = [], refs = { queue: queueRef };
  const guard = createGuardedInput({ snapshot: () => ({ refs, healthy: true }), cleanup: () => {} });
  const owner = guard.bind();
  let ticket;
  const transport = startControlServer({ port: 0, commandTimeoutMs: 50,
    onCommand: () => {
      ticket = guard.prepare({ ...owner, nonce: 'timeout', reviewed: true, deadline: Date.now()+5000 }, { action: 'keydown' });
      return guard.wait(ticket);
    } });
  await once(transport.server, 'listening');
  try {
    const r = await fetch('http://127.0.0.1:' + transport.server.address().port + '/ctl', { method: 'POST', body: '{}' });
    const timeoutReply = await r.json();
    check('real transport timeout response', r.status === 504 && timeoutReply.timedOut && timeoutReply.noReplay && timeoutReply.guarded.state === 'UNKNOWN');
    guard.consume(ticket, () => { effects++; });
    check('timeout cancels real guard consumption', effects === 0 && guard.status('timeout').state === 'UNKNOWN');
  } finally { guard.close(); transport.close(); }
  await assert.rejects(queue('poke:0:1'), /guarded|unsupported/);
  await send({ action: 'quit' }); session.child.stdin.end();
  check('normal quit actual wait and both EOF', await session.exited === 0);
  console.log('PASS guarded actual CLI: ' + checks.join(', '));
})().catch(async e => {
  console.error(e.stack || e);process.exitCode=1;
  try { if (session) await session.quit(); } catch (_) {}
}).finally(async () => {
  watchdog.stdin.end();const [code] = await watchdogClosed;
  if (evidence) {
    fs.writeFileSync(path.join(evidence,'cli-test-output.log'),session?.output() || 'no runtime');
    fs.writeFileSync(path.join(evidence,'cli-test-result.json'),JSON.stringify({ checks,
      passed: !process.exitCode, nativePauseProof: false, watchdogArmedAt:armedAt, cliLaunchedAt:launchedAt, childPid:session?.child.pid,
      childExit:session?.child.exitCode, childClosedBothEOF:true, watchdogPid:watchdog.pid,
      watchdogExit:code, watchdogClosedBothEOF:true, independentRelease:releaseEvidence },null,2)+'\n');
  }
});
