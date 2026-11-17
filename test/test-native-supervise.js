#!/usr/bin/env node
'use strict';
// tools/native-supervise.cjs (L2 run supervisor), self-contained and fast:
//   1. normal exit: exit code recorded, receipt written, nothing leaked
//   2. deadline: a child plus a grandchild that ignore SIGTERM are KILLed
//      after the grace period; no survivors
//   3. a setsid() escapee left behind by a normally exiting child is swept
//   4. CLI exit status mirrors the command; invalid deadlines refuse
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const {supervise, exitStatus} = require('../tools/native-supervise.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'native-supervise-'));
const now = () => Date.now() / 1000;
const alive = pid => { try { process.kill(pid, 0); } catch (e) { return e.code === 'EPERM'; }
  // A zombie still answers kill(0); treat it as dead.
  try { const s = cp.execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], {encoding: 'utf8'}).trim(); return !!s && s[0] !== 'Z'; } catch { return false; } };
async function gone(pid, ms = 2000) { const end = Date.now() + ms; while (alive(pid) && Date.now() < end) await new Promise(r => setTimeout(r, 25)); return !alive(pid); }

// Fixture scripts. A stubborn process ignores SIGTERM and lives forever.
const stubborn = path.join(tmp, 'stubborn.js');
fs.writeFileSync(stubborn, "process.on('SIGTERM',()=>{});require('fs').writeFileSync(process.argv[2],String(process.pid));setInterval(()=>{},1000);\n");
const parent = path.join(tmp, 'parent.js');
fs.writeFileSync(parent, `const cp=require('child_process'),fs=require('fs');
const [mode,pidFile,childPidFile]=process.argv.slice(2);
fs.writeFileSync(pidFile,String(process.pid));
const g=cp.spawn(process.execPath,[${JSON.stringify(stubborn)},childPidFile],{stdio:'ignore',detached:mode==='escape'});
if(mode==='escape'){g.unref();setTimeout(()=>process.exit(0),1200);}
else{process.on('SIGTERM',()=>{});setInterval(()=>{},1000);}
`);
const waitFile = async f => { for (let i = 0; i < 200 && !fs.existsSync(f); i++) await new Promise(r => setTimeout(r, 20)); return Number(fs.readFileSync(f, 'utf8')); };

async function main() {
  let checks = 0;
  const quiet = {stdio: 'ignore'};

  // 1. Normal exit.
  {
    const run = path.join(tmp, 'normal');
    const r = await supervise(run, ['sh', '-c', 'exit 3'], {deadline: now() + 20, cleanup_deadline: now() + 30, grace: 1, ...quiet});
    assert.equal(r.exit, 3); assert.equal(r.signal, null); assert.equal(r.leaked, false); assert.equal(r.terminated, null);
    const disk = JSON.parse(fs.readFileSync(path.join(run, 'receipt.json'), 'utf8'));
    for (const k of ['command', 'startedAt', 'finishedAt', 'exit', 'signal', 'level', 'deadline', 'cleanupDeadline', 'leaked']) assert(k in disk, 'receipt field ' + k);
    assert.deepEqual(disk.command, ['sh', '-c', 'exit 3']); assert.equal(exitStatus(disk), 3);
    await assert.rejects(supervise(run, ['true'], {deadline: now() + 5, cleanup_deadline: now() + 6}), /receipt already exists/);
    checks++;
  }

  // 2. Deadline kill of a TERM-ignoring tree.
  {
    const run = path.join(tmp, 'deadline'), p = path.join(tmp, 'deadline.parent'), g = path.join(tmp, 'deadline.child');
    const began = Date.now();
    const pending = supervise(run, [process.execPath, parent, 'tree', p, g], {deadline: now() + 1.5, cleanup_deadline: now() + 8, grace: 0.5, ...quiet});
    const parentPid = await waitFile(p), childPid = await waitFile(g);
    assert(alive(parentPid) && alive(childPid));
    const r = await pending;
    assert.equal(r.terminated, 'deadline'); assert.equal(r.signal, r.level.startsWith('pidns') ? r.signal : 'SIGKILL');
    assert.equal(r.leaked, false);
    assert(r.events.some(e => e.kind === 'signal' && e.signal === 'SIGTERM'));
    assert(r.events.some(e => e.kind === 'signal' && e.signal === 'SIGKILL'), 'TERM was ignored, so KILL must follow');
    assert(await gone(parentPid) && await gone(childPid), 'no survivors');
    assert(Date.now() - began < 7000);
    assert.notEqual(exitStatus(r), 0);
    checks++;
  }

  // 3. A setsid() escapee outlives its normally exiting parent; the sweep kills it.
  {
    const run = path.join(tmp, 'escape'), p = path.join(tmp, 'escape.parent'), g = path.join(tmp, 'escape.child');
    const pending = supervise(run, [process.execPath, parent, 'escape', p, g], {deadline: now() + 20, cleanup_deadline: now() + 25, grace: 0.5, ...quiet});
    const childPid = await waitFile(g);
    const r = await pending;
    assert.equal(r.exit, 0); assert.equal(r.leaked, false); assert.equal(r.terminated, 'sweep after exit');
    assert(r.tracked.includes(childPid), 'escapee was tracked');
    assert(await gone(childPid), 'escapee killed');
    checks++;
  }

  // 4. CLI and refusals.
  {
    const run = path.join(tmp, 'cli');
    const res = cp.spawnSync(process.execPath, [path.join(__dirname, '../tools/native-supervise.cjs'), run, String(now() + 20), String(now() + 30), '--grace=1', '--', 'sh', '-c', 'exit 7'], {encoding: 'utf8'});
    assert.equal(res.status, 7, res.stderr);
    assert.equal(JSON.parse(fs.readFileSync(path.join(run, 'receipt.json'), 'utf8')).exit, 7);
    const bad = cp.spawnSync(process.execPath, [path.join(__dirname, '../tools/native-supervise.cjs'), run], {encoding: 'utf8'});
    assert.equal(bad.status, 2);
    await assert.rejects(supervise(path.join(tmp, 'expired'), ['true'], {deadline: now() - 1, cleanup_deadline: now() + 5}), /deadlines/);
    await assert.rejects(supervise(path.join(tmp, 'order'), ['true'], {deadline: now() + 5, cleanup_deadline: now() + 4}), /deadlines/);
    await assert.rejects(supervise(path.join(tmp, 'vector'), 'true', {deadline: now() + 5, cleanup_deadline: now() + 6}), /command vector/);
    checks++;
  }

  fs.rmSync(tmp, {recursive: true, force: true});
  console.log(`PASS test-native-supervise (${checks} groups)`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
