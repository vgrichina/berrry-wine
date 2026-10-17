#!/usr/bin/env node
'use strict';
// Source-only planning by default. --execute requires a separately granted slot.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function manifest(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e => {
    const rel = path.posix.join(prefix, e.name);
    assert(!e.isSymbolicLink(), 'capture contains symlink');
    return e.isDirectory() ? manifest(root, rel) : [{path:rel, sha256:sha(path.join(root,rel))}];
  });
}
function peIdentity(file) {
  const b = fs.readFileSync(file);
  assert(b.length >= 64 && b.readUInt16LE(0) === 0x5a4d, 'child lacks MZ header');
  const pe = b.readUInt32LE(60);
  assert(pe <= b.length - 26 && b.readUInt32LE(pe) === 0x4550, 'child is not PE');
  assert.equal(b.readUInt16LE(pe + 4), 0x14c, 'child is not x86');
  assert.equal(b.readUInt16LE(pe + 24), 0x10b, 'child is not PE32');
  assert.equal(b.readUInt16LE(pe + 22) & 0x2000, 0, 'child is a DLL');
  return {sha256:sha(file), bytes:b.length, format:'PE32', machine:'i386'};
}
function receiptExe(capture, launch) {
  assert.equal(launch.schemaVersion, 1);
  const expectedGuest = path.win32.normalize('c:/windows/temp/_ins0432._mp');
  assert.equal(launch.guestExe.toLowerCase(), expectedGuest, 'unexpected child; review before replay');
  assert.equal(typeof launch.args, 'string');
  assert.equal(typeof launch.directory, 'string');
  assert.equal(path.win32.parse(launch.directory).root.toLowerCase(), path.win32.normalize('c:/'));
  assert.equal(typeof launch.exe, 'string');
  const relative = launch.exe.split(path.win32.sep).join('/');
  assert.equal(relative.toLowerCase(), 'windows/temp/_ins0432._mp', 'unexpected captured path');
  const exe = path.resolve(capture, relative);
  assert.equal(path.relative(path.resolve(capture), exe).split(path.sep).join('/'), relative);
  return exe;
}
function sealCapture(c, save) {
  let receipt = null;
  try {
    const capture = path.join(c.output, 'capture');
    receipt = read(path.join(capture, 'launch.json'));
    const exe = receiptExe(capture, receipt);
    const captureManifest = manifest(capture); // Reject symlinks before reading the image.
    save('captured-child.json', {...receipt, identity:peIdentity(exe), captureManifest,
      registrySha256:sha(path.join(c.output, 'bootstrap', 'registry.json'))});
  } catch (error) {
    save('capture-failure.json', {receipt, error:error.stack});
    throw error;
  }
}

function plan(c, stage) {
  for (const key of ['root', 'fixture', 'wasm', 'output']) assert(path.isAbsolute(c[key]), key);
  assert(['capture', 'replay'].includes(stage), 'stage must be capture or replay');
  const capture = path.join(c.output, 'capture');
  const out = path.join(c.output, stage === 'capture' ? 'bootstrap' : 'child');
  let launch = { exe: path.join(c.fixture, 'setup.exe') };
  if (stage === 'replay') {
    launch = read(path.join(capture, 'launch.json'));
    launch.exe = receiptExe(capture, launch);
    assert(fs.statSync(launch.exe).isFile());
    const sealed = read(path.join(c.output, 'bootstrap', 'captured-child.json'));
    assert.deepEqual(manifest(capture), sealed.captureManifest, 'captured tree or receipt changed');
    assert.equal(sha(path.join(c.output, 'bootstrap', 'registry.json')), sealed.registrySha256, 'registry changed');
    assert.deepEqual(peIdentity(launch.exe), sealed.identity, 'captured child changed');
    for (const key of ['guestExe', 'args', 'directory']) assert.equal(launch[key], sealed[key], 'launch receipt changed');
    assert.equal(read(path.join(c.output, 'bootstrap', 'terminal.json')).code, 0);
    assert.equal(read(path.join(c.output, 'bootstrap', 'postflight.json')).identitiesUnchanged, true);
    read(path.join(c.output, 'bootstrap', 'registry.json'));
  }
  const args = ['test/run.js', `--exe=${launch.exe}`, '--no-build', `--wasm=${c.wasm}`,
    '--quiet-api', '--no-close', '--no-threads', '--batch-size=200000',
    '--max-batches=10000000', '--max-seconds=120', '--control=8129',
    `--png=${out}/final.png`, `--save-vfs=${out}/vfs`, `--reg-export=${out}/registry.json`];
  if (stage === 'capture') args.push(`--vfs-tree=${c.fixture}`, `--capture-launch=${capture}`);
  else args.push(`--vfs-tree=${capture}`, `--exe-guest-path=${launch.guestExe}`,
    `--cwd=${launch.directory}`, `--args=${launch.args}`,
    `--reg-import=${c.output}/bootstrap/registry.json`);
  return { stage, cwd:c.root, out, args, outerMs:150000 };
}

function verify(c) {
  const git = args => cp.execFileSync('git', ['-C', c.root, ...args], {encoding:'utf8'}).trim();
  assert.match(c.sourceTree, /^[a-f0-9]{40}$/);
  assert.equal(git(['write-tree']), c.sourceTree);
  assert.equal(git(['diff-files', '--name-only']), '');
  assert.equal(sha(c.wasm), c.moduleSha256);
  const inventory = read(path.join(c.root, 'docs/re-notes/jedi-knight-demo-inventory.json'));
  assert.equal(inventory.files.length, 39);
  for (const f of inventory.files) assert.equal(sha(path.join(c.fixture, f.name)), f.sha256, f.name);
}

async function execute(c, p) {
  verify(c);
  // Exclusive directory creation prevents mixing evidence from earlier runs.
  fs.mkdirSync(c.output, {recursive:true});
  fs.mkdirSync(p.out);
  const save = (name, data) => fs.writeFileSync(path.join(p.out, name), JSON.stringify(data, null, 2) + '\n');
  if (p.stage === 'capture') assert(!fs.existsSync(path.join(c.output, 'capture')), 'capture already exists');
  save('launch.json', p);
  save('identity.json', c);
  fs.copyFileSync(__filename, path.join(p.out, 'controller.js'));
  const fd = fs.openSync(path.join(p.out, 'output.log'), 'wx');
  const child = cp.spawn(process.execPath, p.args, {cwd:p.cwd, stdio:['ignore', fd, fd]});
  save('child.json', {pid:child.pid, startedAt:new Date().toISOString()});
  const timer = setTimeout(() => child.kill('SIGKILL'), p.outerMs);
  try {
    const terminal = await new Promise(resolve => {
      child.once('error', error => resolve({code:null, error:error.message}));
      child.once('exit', (code, signal) => resolve({code, signal}));
    });
    save('terminal.json', {...terminal, finishedAt:new Date().toISOString()});
    try {
      verify(c);
      save('postflight.json', {identitiesUnchanged:true});
    } catch (error) {
      save('postflight-failure.json', {error:error.stack});
      throw error;
    }
    assert.equal(terminal.code, 0, 'guest process failed; review evidence');
    if (p.stage === 'capture') {
      sealCapture(c, save);
    }
  } finally { clearTimeout(timer); fs.closeSync(fd); }
}

if (require.main === module) {
  Promise.resolve().then(async () => {
    const [stage, config, flag] = process.argv.slice(2);
    assert(config, 'usage: node tools/jedi-knight-installer-handoff.js capture|replay CONFIG.json [--execute]');
    assert(flag === undefined || flag === '--execute');
    const c = read(config), p = plan(c, stage);
    if (flag) await execute(c, p);
    else console.log(JSON.stringify(p, null, 2));
  }).catch(e => { console.error(e.stack); process.exitCode = 1; });
}
module.exports = {plan, verify, peIdentity, manifest, sealCapture};
