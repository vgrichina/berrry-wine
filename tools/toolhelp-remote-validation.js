#!/usr/bin/env node
'use strict';
// Separate-process guard for the admitted remote Toolhelp validation lane.
// Run from the reviewed checkout; no source/fixture edits or retries here.
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const [name, command, ...args] = process.argv.slice(2);
if (!name || !command || !/^[a-z0-9-]+$/.test(name)) throw Error('name command args required');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'scratch/runs/20261019-toolhelp-remote-validation');
fs.mkdirSync(dir, {recursive: true});
const git = args => cp.execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
git(['diff', '--exit-code', '29f3655cf42efddb128283955dc51062959790df', '--', 'src', 'lib', 'host.js', 'test']);
git(['diff', '--exit-code']);
const head = git(['rev-parse', 'HEAD']);
const admission = 2 ** 31 + (128 + 512) * 1024 ** 2;
const stop = 2 ** 31 + 64 * 1024 ** 2;
const free = () => {const s = fs.statfsSync(dir); return s.bavail * s.bsize;};
let minFree = free(), reason = null;
if (minFree <= admission) throw Error(`admission ${minFree} <= ${admission}`);
const log = path.join(dir, name + '.log'), fd = fs.openSync(log, 'wx');
const start = Date.now();
const child = cp.spawn(command, args, {cwd: root, detached: true, stdio: ['ignore', fd, fd]});
const kill = signal => {
  if (child.pid) try {process.kill(-child.pid, signal);} catch (e) {if (e.code !== 'ESRCH') throw e;}
};
const absent = () => {
  if (!child.pid) return true;
  try {process.kill(-child.pid, 0); return false;} catch (e) {if (e.code === 'ESRCH') return true; throw e;}
};
process.on('exit', () => kill('SIGKILL'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {reason = signal; kill('SIGKILL');});
const timer = setInterval(() => {
  minFree = Math.min(minFree, free());
  if (minFree <= stop) reason ||= 'disk';
  if (Date.now() - start > 180000) reason ||= 'deadline';
  if (fs.fstatSync(fd).size > 4 * 1024 ** 2) reason ||= 'log';
  if (reason) kill('SIGKILL');
}, 100);
child.on('error', error => {reason = 'spawn: ' + error.message;});
child.on('close', async (code, signal) => {
  clearInterval(timer);
  if (!absent()) {reason ||= 'descendants-after-exit'; kill('SIGKILL');}
  for (let i = 0; i < 20 && !absent(); i++) await new Promise(resolve => setTimeout(resolve, 100));
  fs.closeSync(fd);
  const result = {name, command, args, sourceHead: head, pid: child.pid || null,
    code, signal, guard: reason, groupAbsent: absent(), elapsedMs: Date.now() - start,
    minFree, admission, stop, logBytes: fs.statSync(log).size,
    sourceUnchanged: git(['status', '--porcelain', '--untracked-files=no']) === ''};
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  process.exitCode = code === 0 && !reason && result.groupAbsent && result.sourceUnchanged ? 0 : 1;
});
