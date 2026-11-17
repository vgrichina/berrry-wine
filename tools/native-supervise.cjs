#!/usr/bin/env node
'use strict';
// L2 run supervisor: plain Node, no ptrace. Replaces the retired Linux kernel
// custody layer (tools/native_kernel_custody.py and its publication observers).
//
//   supervise(RUN, [cmd...], {deadline, cleanup_deadline, grace})
//        |
//        +-- spawn detached (own process group); on Linux, when permitted:
//        |     setpriv --pdeathsig KILL      supervisor dies -> run dies
//        |     unshare --pid --fork --kill-child   the run is its own PID
//        |       namespace: when its init dies the kernel kills every member,
//        |       including daemons that setsid() out of the process group
//        +-- poll the process table; remember every descendant (pid + start
//        |   token), so a setsid() escapee is still signalled at pgid level
//        +-- runtime deadline: TERM the group + known descendants, KILL after
//        |   `grace` seconds; also sweeps leftovers after a normal exit
//        +-- cleanup deadline: anything still alive is a hard failure
//        +-- RUN/receipt.json {command, startedAt, finishedAt, exit, signal,
//              level, deadline, cleanupDeadline, leaked:false|[pids], ...}
//
// Deadlines are epoch SECONDS (same as the Python supervise they replace).
// Guarantees: the whole tree is dead by the cleanup deadline or the call fails;
// the direct child's exit code / signal is recorded. Not kept on purpose: the
// per-task kernel fork/exec/exit journal.
//
// Under the `pidns*` levels the command is PID 1 of its namespace, so the
// kernel only delivers TERM to it if it installed a TERM handler; KILL after
// `grace` is unconditional. Its descendants get TERM normally.
//
// CLI: node tools/native-supervise.cjs RUN DEADLINE CLEANUP_DEADLINE [--grace=S] -- cmd [args...]
// Exit status: the command's exit code, 128+signal when it was signalled,
// 1 when anything leaked or the supervisor failed, 2 on bad usage.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), os = require('node:os');
const proc = require('./native-proc.cjs');

const LEVELS = ['pidns+pdeathsig', 'pidns', 'pdeathsig', 'pgid'];
const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));

function probe(argv) {
  try { return cp.spawnSync(argv[0], argv.slice(1), {stdio: 'ignore', timeout: 5000}).status === 0; }
  catch { return false; }
}
let probed = null;
// Strongest isolation this host permits. Cached per process.
function availableLevel() {
  if (probed) return probed;
  if (process.platform !== 'linux') return (probed = 'pgid');
  const setpriv = probe(['setpriv', '--pdeathsig', 'KILL', 'true']);
  const unshare = ['unshare', '--pid', '--fork', '--kill-child', 'true'];
  if (setpriv && probe(['setpriv', '--pdeathsig', 'KILL', ...unshare])) return (probed = 'pidns+pdeathsig');
  if (probe(unshare)) return (probed = 'pidns');
  return (probed = setpriv ? 'pdeathsig' : 'pgid');
}
function wrap(level, command) {
  const ns = ['unshare', '--pid', '--fork', '--kill-child', '--'];
  const death = ['setpriv', '--pdeathsig', 'KILL', '--'];
  if (level === 'pidns+pdeathsig') return [...death, ...ns, ...command];
  if (level === 'pidns') return [...ns, ...command];
  if (level === 'pdeathsig') return [...death, ...command];
  return command;
}

// pid -> {ppid, pgid, state, token} for every visible process.
function table() {
  const rows = new Map();
  if (proc.linux) {
    for (const name of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(name)) continue;
      let s; try { s = fs.readFileSync(`/proc/${name}/stat`, 'utf8'); } catch { continue; }
      const f = s.slice(s.lastIndexOf(')') + 2).split(/\s+/);
      rows.set(Number(name), {ppid: Number(f[1]), pgid: Number(f[2]), state: f[0], token: f[19]});
    }
    return rows;
  }
  const out = cp.execFileSync('ps', ['-A', '-o', 'pid=,ppid=,pgid=,stat=,lstart='], {encoding: 'utf8', maxBuffer: 1 << 26});
  for (const line of out.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*\S)\s*$/.exec(line);
    if (m) rows.set(Number(m[1]), {ppid: Number(m[2]), pgid: Number(m[3]), state: m[4][0], token: m[5]});
  }
  return rows;
}
const dead = row => !row || row.state === 'Z' || row.state === 'X';

function validCommand(command) {
  return Array.isArray(command) && command.length > 0 && command.every(a => typeof a === 'string');
}

async function supervise(run, command, {deadline, cleanup_deadline, grace = 5, level, stdio = 'inherit', env, cwd, pollMs} = {}) {
  if (!validCommand(command)) throw Error('literal command vector required');
  const startedSec = Date.now() / 1000;
  if (!(Number.isFinite(deadline) && Number.isFinite(cleanup_deadline) && startedSec < deadline && deadline < cleanup_deadline))
    throw Error('expired or invalid deadlines (epoch seconds; now < deadline < cleanup_deadline)');
  if (!(Number.isFinite(grace) && grace >= 0)) throw Error('grace must be a non-negative number of seconds');
  run = path.resolve(run); fs.mkdirSync(run, {recursive: true});
  const receiptPath = path.join(run, 'receipt.json');
  if (fs.existsSync(receiptPath)) throw Error('receipt already exists: ' + receiptPath);
  const available = availableLevel();
  level = level || process.env.NATIVE_SUPERVISE_LEVEL || available;
  if (!LEVELS.includes(level)) throw Error('unknown level ' + level);
  if (LEVELS.indexOf(level) < LEVELS.indexOf(available)) throw Error(`level ${level} not permitted here (best: ${available})`);
  pollMs = pollMs || (proc.linux ? 100 : 250);

  const startedAt = new Date().toISOString();
  const argv = wrap(level, command);
  const child = cp.spawn(argv[0], argv.slice(1), {detached: true, stdio, env, cwd});
  const pgid = child.pid;
  const events = [];
  const note = (kind, extra = {}) => events.push({at: Date.now() / 1000, kind, ...extra});
  let status = null, spawnError = null;
  const exited = new Promise(resolve => {
    child.once('error', e => { spawnError = String(e && e.message || e); resolve(); });
    child.once('exit', (code, signal) => { status = {exit: code, signal}; resolve(); });
  });

  // Descendant tracking: pid -> start token, seeded with the group leader.
  const known = new Map();
  const remember = rows => {
    if (pgid && !known.has(pgid) && rows.has(pgid)) known.set(pgid, rows.get(pgid).token);
    for (const [pid, row] of rows) {
      if (pid === process.pid || known.has(pid)) continue;
      if (row.pgid === pgid) { known.set(pid, row.token); continue; }
      for (let p = row.ppid, hops = 0; p > 1 && hops < 64; hops++) {
        const up = rows.get(p);
        if (known.has(p) && up && up.token === known.get(p)) { known.set(pid, row.token); break; }
        if (!up) break; p = up.ppid;
      }
    }
  };
  const survivors = () => {
    const rows = table(); remember(rows);
    const left = [];
    for (const [pid, token] of known) { const row = rows.get(pid); if (!dead(row) && row.token === token) left.push(pid); }
    if (pgid) for (const [pid, row] of rows) if (row.pgid === pgid && !dead(row) && !left.includes(pid) && pid !== process.pid) left.push(pid);
    return left.sort((a, b) => a - b);
  };
  const signalTree = sig => {
    const targets = survivors();
    if (pgid) try { process.kill(-pgid, sig); } catch {}
    for (const pid of targets) try { process.kill(pid, sig); } catch {}
    note('signal', {signal: sig, targets});
    return targets;
  };

  let polling = !!pgid, pollError = null;
  const poller = (async () => { while (polling) { try { remember(table()); } catch (e) { pollError = String(e); } await sleep(pollMs); } })();

  let reason = null;
  let escalation = null;
  const terminate = why => {
    if (reason) return; reason = why; note('terminate', {reason: why});
    signalTree('SIGTERM');
    const killAt = Math.min(Date.now() + grace * 1000, cleanup_deadline * 1000);
    escalation = setTimeout(() => signalTree('SIGKILL'), Math.max(0, killAt - Date.now()));
  };
  const deadlineTimer = setTimeout(() => terminate('deadline'), Math.min(2 ** 31 - 1, deadline * 1000 - Date.now()));
  const onSignal = sig => terminate('supervisor ' + sig);
  const sigs = ['SIGTERM', 'SIGINT', 'SIGHUP'];
  for (const s of sigs) process.on(s, onSignal);

  let cleanupTimer;
  const cleanupReached = new Promise(r => { cleanupTimer = setTimeout(r, Math.min(2 ** 31 - 1, cleanup_deadline * 1000 - Date.now())); });
  await Promise.race([exited, cleanupReached]);
  if (status) note('exit', status);

  // The direct child is gone (or the cleanup deadline passed): sweep whatever
  // of the tree is left, TERM then KILL, bounded by the cleanup deadline.
  let leaked = [];
  try {
    let left = survivors();
    if (left.length) {
      if (!reason) { reason = status ? 'sweep after exit' : 'cleanup deadline'; note('terminate', {reason}); signalTree('SIGTERM'); }
      const killAt = Math.min(Date.now() + grace * 1000, cleanup_deadline * 1000);
      while ((left = survivors()).length && Date.now() < killAt) await sleep(50);
      if (left.length) signalTree('SIGKILL');
      while ((left = survivors()).length && Date.now() < cleanup_deadline * 1000) await sleep(50);
    }
    leaked = left;
  } finally {
    polling = false; clearTimeout(deadlineTimer); clearTimeout(escalation); clearTimeout(cleanupTimer);
    for (const s of sigs) process.removeListener(s, onSignal);
    await poller;
  }
  if (!status && !spawnError) { await Promise.race([exited, sleep(100)]); if (status) note('exit', status); }

  const receipt = {
    command, wrapped: argv, level, availableLevel: available,
    startedAt, finishedAt: new Date().toISOString(),
    deadline, cleanupDeadline: cleanup_deadline, grace,
    pid: pgid ?? null, exit: status ? status.exit : null, signal: status ? status.signal : null,
    spawnError, terminated: reason, tracked: [...known.keys()].sort((a, b) => a - b),
    leaked: leaked.length ? leaked : false, pollError, events, platform: process.platform,
  };
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
  if (leaked.length) { const e = Error('processes survived the cleanup deadline: ' + leaked.join(',')); e.receipt = receipt; throw e; }
  if (spawnError) { const e = Error('spawn failed: ' + spawnError); e.receipt = receipt; throw e; }
  return receipt;
}

const SIGNUM = os.constants.signals;
function exitStatus(receipt) {
  if (receipt.leaked || receipt.spawnError) return 1;
  if (receipt.signal) return 128 + (SIGNUM[receipt.signal] || 0);
  return receipt.exit ?? 1;
}

async function main(argv) {
  const sep = argv.indexOf('--');
  if (sep < 0 || sep + 1 >= argv.length) {
    console.error('usage: node tools/native-supervise.cjs RUN DEADLINE CLEANUP_DEADLINE [--grace=S] [--level=L] -- cmd [args...]');
    return 2;
  }
  const head = argv.slice(0, sep), command = argv.slice(sep + 1);
  const opts = {}, pos = [];
  for (const a of head) {
    if (a.startsWith('--grace=')) opts.grace = Number(a.slice(8));
    else if (a.startsWith('--level=')) opts.level = a.slice(8);
    else pos.push(a);
  }
  if (pos.length !== 3) { console.error('RUN DEADLINE CLEANUP_DEADLINE required'); return 2; }
  try {
    const receipt = await supervise(pos[0], command, {...opts, deadline: Number(pos[1]), cleanup_deadline: Number(pos[2])});
    return exitStatus(receipt);
  } catch (e) {
    console.error('native-supervise: ' + (e && e.message || e));
    return 1;
  }
}

module.exports = {supervise, availableLevel, exitStatus, LEVELS};
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
