#!/usr/bin/env node
'use strict';

// Run only after the coordinator grants the sole remote lane. No installer,
// input automation, dependency install, build, network listener or guest patch.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { inspect } = require('./fifa98-preflight');
const inventory = require('../docs/fixtures/fifa98-demo-inventory.json');
const ROOT = '/home/user/wa-fifa98-startup';
const OUT = '/home/user/fifa98-startup-evidence-1';
const DONOR = '/home/user/wa-iw-combined-native';
const SOURCE = '7405b3f4803855e6d2e25506c74afab0d2184af9';
const MODULE = '04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17';
const DEP_RECEIPT = '/home/user/darkstone-menu-evidence-3/preflight.json';
const DEP_ROOT = '/home/user/wa-darkstone-validation/node_modules';
const DEP_HASH = '52d6d80b272fa670ef0a6c781bb4f3e7d8484d333bf0b2199a9ed106178faa30';
const FIXTURE = ROOT + '/test/binaries/candidates/fifa98-demo';
const WASM = ROOT + '/build/wine-assembly.wasm';
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const exec = (bin, args, cwd = ROOT) => cp.execFileSync(bin, args,
  { cwd, encoding: 'utf8', timeout: 30000, maxBuffer: 64 * 1024 * 1024 });
const save = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
function idle() {
  const all = exec('ps', ['-eo', 'pid,ppid,pgid,stat,comm'], '/home/user');
  const active = all.split('\n').filter(line => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s*$/.exec(line);
    return m && Number(m[1]) !== process.pid && !m[4].startsWith('Z') &&
      /^(node|MainThread|chrome|chromium|firefox|wat2wasm)$/.test(m[5]);
  });
  assert.equal(active.length, 0, active.join('\n'));
  return { all, active };
}
function dependencies() {
  assert.equal(hash(DEP_RECEIPT), DEP_HASH, 'admitted dependency receipt');
  const rows = JSON.parse(fs.readFileSync(DEP_RECEIPT)).dependencies;
  assert.equal(rows.length, 2394);
  for (const row of rows) {
    assert(row.path.startsWith(DEP_ROOT + '/'));
    assert.equal(hash(row.path), row.sha256, row.path);
  }
  assert.equal(fs.realpathSync(ROOT + '/node_modules'), DEP_ROOT);
  return rows;
}
function sources() {
  assert.equal(exec('git', ['rev-parse', 'HEAD']).trim(), SOURCE);
  const rows = exec('git', ['ls-files', '--stage', '-z']).split('\0').filter(Boolean);
  const result = [];
  for (const row of rows) {
    const m = /^(\d+) ([a-f0-9]{40}) 0\t(.+)$/.exec(row); assert(m);
    const p = ROOT + '/' + m[3];
    const bytes = m[1] === '120000' ? Buffer.from(fs.readlinkSync(p)) : fs.readFileSync(p);
    const blob = crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
    assert.equal(blob, m[2], 'source differs: ' + m[3]);
    result.push({ path: m[3], sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
  return result;
}
function preflight() {
  const processes = idle();
  assert.equal(hash(DONOR + '/build/wine-assembly.wasm'), MODULE);
  assert.equal(hash(WASM), MODULE);
  const source = sources(), deps = dependencies();
  const fixture = inspect(FIXTURE); assert.deepEqual(fixture, inventory);
  const disk = fs.statfsSync(ROOT); assert(disk.bavail * disk.bsize > 2 * 1024 ** 3);
  return { at: new Date().toISOString(), processes, source, dependencies: deps,
    fixture, sourceCommit: SOURCE, moduleSha256: MODULE, node: process.version,
    regionMapSha256: hash(ROOT + '/lib/region-map.generated.js'), freeBytes: disk.bavail * disk.bsize };
}
function prepare() {
  idle();
  assert(!fs.existsSync(ROOT), 'dedicated checkout already exists; preserve it');
  assert.equal(hash(DONOR + '/build/wine-assembly.wasm'), MODULE);
  assert.equal(hash(DEP_RECEIPT), DEP_HASH);
  exec('git', ['clone', '--shared', '--no-checkout', DONOR, ROOT], '/home/user');
  exec('git', ['checkout', '--detach', SOURCE]);
  fs.symlinkSync(DEP_ROOT, ROOT + '/node_modules');
  fs.mkdirSync(ROOT + '/build', { recursive: true });
  fs.copyFileSync(DONOR + '/build/wine-assembly.wasm', WASM);
  sources(); dependencies();
  console.log(JSON.stringify({ prepared: ROOT, source: SOURCE, module: MODULE,
    next: 'Transfer original pinned fixture, then rerun without --prepare only after runtime grant.' }));
}
function run() {
  assert(!fs.existsSync(OUT), 'never overwrite evidence');
  const before = preflight();
  fs.mkdirSync(OUT); save('preflight.json', before);
  fs.copyFileSync(__filename, OUT + '/remote-controller.js');
  const args = ['test/run.js', '--app=fifa98_demo', '--no-build', '--wasm=' + WASM,
    '--quiet-api', '--max-seconds=90', '--max-batches=6000', '--batch-size=100000',
    '--png=' + OUT + '/startup.png'];
  // Remove inherited runner overrides; explicitly bind the matching map.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !key.startsWith('WINE_') && !key.startsWith('WA_') && key !== 'NODE_OPTIONS' && key !== 'NODE_PATH'));
  env.WINE_REGION_MAP = ROOT + '/lib/region-map.generated.js';
  save('invocation.json', { executable: process.execPath, args, cwd: ROOT,
    controllerPid: process.pid, sourceCommit: SOURCE, moduleSha256: MODULE,
    regionMap: env.WINE_REGION_MAP, input: [], outerTimeoutMs: 120000 });
  const fd = fs.openSync(OUT + '/startup.log', 'wx');
  let child;
  try {
    child = cp.spawnSync(process.execPath, args, { cwd: ROOT, env,
      stdio: ['ignore', fd, fd], timeout: 120000, killSignal: 'SIGKILL' });
  } finally { fs.closeSync(fd); }
  save('terminal.json', { at: new Date().toISOString(), status: child.status,
    signal: child.signal, error: child.error?.message ?? null });
  save('postflight.json', preflight());
  // Startup success is deliberately not translated into gameplay success.
  save('review-pending.json', { candidateId: 'fifa98-demo', checkpoint: 'startup',
    reviewed: false, gameplay: 'not-attempted', input: [], terminalStatus: child.status });
  process.exitCode = child.status === 0 ? 0 : 1;
}
if (require.main === module) {
  try {
    assert(process.argv.length <= 3);
    if (process.argv[2] === '--prepare') prepare();
    else if (process.argv[2] === '--postflight') {
      const receipt = preflight(); save('independent-postflight.json', receipt);
      console.log(JSON.stringify({ passed: true, at: receipt.at }));
    } else { assert(!process.argv[2]); run(); }
  } catch (error) {
    if (fs.existsSync(OUT)) save('controller-error-' + Date.now() + '.json', { error: error.stack });
    console.error(error.stack); process.exitCode = 1;
  }
}
module.exports = { SOURCE, MODULE, ROOT, OUT, FIXTURE, WASM };
