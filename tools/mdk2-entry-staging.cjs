'use strict';

// Small accepted-entry inputs only. No runtime/source-tree/.git transfer.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ROOT = path.resolve(__dirname, '..');
const ACCEPTED = '6d5121b5f96ee6032a9e347e2db64db29c478518';
const SOURCE = '1329b1ba6eb00144ff77d4cd92a8513d4fc953ad';
const OBSERVER = 'de6a33f257d93e8814d666bdec62361161569ac4';
const ENTRY = 'tools/mdk2-construction-driver-integration.cjs';
const OBSERVER_FILE = 'tools/mdk2-lua-construction-observer.cjs';
const ENTRY_SHA = '6cdfd208f802daac8cb5f3fd67f51f07c5195b294a9c86a58d8c168a973a378f';
const BASE = 'scratch/runs/20261104-mdk2-entry-staging-inputs';
const PROOF = BASE + '/git-proof';
const META = ['runtime-pins.json.gz', 'seal.json.gz'].map(n => 'scratch/runs/20261104-mdk2-fresh-pending-scene/' + n);
const DEPENDENCIES = ['host.js', 'lib/guest-worker.js', 'lib/guest-rpc.js', 'lib/guest-thread-host.js'];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const oid = (type, bytes) => crypto.createHash('sha1').update(Buffer.from(`${type} ${bytes.length}\0`)).update(bytes).digest('hex');
function environment(gitDirectory) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  return {...env, GIT_CONFIG_NOSYSTEM:'1', GIT_CONFIG_GLOBAL:'/dev/null', GIT_NO_REPLACE_OBJECTS:'1',
    ...(gitDirectory ? {GIT_DIR:gitDirectory, GIT_WORK_TREE:path.resolve(gitDirectory, '../../../..')} : {})};
}
function git(root, args) {
  return cp.execFileSync('git', args, {cwd:root, env:environment(), maxBuffer:4000000});
}
function readRetained(root, name) {
  const file = path.join(root, name);
  return fs.existsSync(file) ? fs.readFileSync(file) : zlib.gunzipSync(fs.readFileSync(file + '.gz'));
}
function loadEntry(bytes, root) {
  assert.equal(sha(bytes), ENTRY_SHA, 'accepted integration entry mismatch');
  const filename = path.join(root, ENTRY), m = new Module(filename, module);
  m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
  m._compile(bytes.toString(), filename);
  assert.equal(m.exports.SOURCE, SOURCE); assert.equal(m.exports.OBSERVER, OBSERVER);
  return m.exports;
}
function treeEntry(bytes, name) {
  let start = 0;
  while (start < bytes.length) {
    const space = bytes.indexOf(32, start), end = bytes.indexOf(0, space);
    assert(space > start && end > space && end + 21 <= bytes.length, 'invalid Git tree');
    if (bytes.subarray(space + 1, end).toString() === name)
      return bytes.subarray(end + 1, end + 21).toString('hex');
    start = end + 21;
  }
  throw Error('missing Git tree path: ' + name);
}
function prepare(root = ROOT) {
  root = path.resolve(root);
  const objects = new Map();
  function object(id, type) {
    const bytes = git(root, ['cat-file', type, id]);
    assert.equal(oid(type, bytes), id, 'Git object identity mismatch');
    objects.set(id, {id, type, data:bytes.toString('base64')});
    return bytes;
  }
  function file(commit, name) {
    const header = object(commit, 'commit').toString();
    let id = /^tree ([0-9a-f]{40})\n/.exec(header)?.[1];
    assert(id, 'invalid commit root');
    const parts = name.split('/');
    for (const part of parts) id = treeEntry(object(id, 'tree'), part);
    return object(id, 'blob');
  }
  const entry = file(ACCEPTED, ENTRY), api = loadEntry(entry, root);
  const observer = file(OBSERVER, OBSERVER_FILE);
  for (const name of DEPENDENCIES) file(SOURCE, name);
  const inputs = new Map([[ENTRY, entry], [OBSERVER_FILE, observer]]);
  for (const [name, hash] of Object.entries({...api.CLOSURE, ...api.HELPERS})) {
    const bytes = readRetained(root, 'scratch/runs/' + name);
    assert.equal(sha(bytes), hash, 'retained helper mismatch: ' + name);
    inputs.set('scratch/runs/' + name, bytes);
  }
  for (const name of META) inputs.set(name, fs.readFileSync(path.join(root, name)));
  const payload = {version:1, accepted:ACCEPTED, objects:[...objects.values()],
    inputs:[...inputs].map(([name, bytes]) => ({path:name, data:bytes.toString('base64')}))};
  validate(payload);
  return payload;
}
function validate(payload) {
  assert.equal(payload.version, 1); assert.equal(payload.accepted, ACCEPTED);
  assert(Buffer.byteLength(JSON.stringify(payload)) < 3000000, 'oversized entry inputs');
  const objects = new Map(), used = new Set();
  for (const row of payload.objects) {
    assert(['commit','tree','blob'].includes(row.type));
    const bytes = Buffer.from(row.data, 'base64');
    assert.equal(oid(row.type, bytes), row.id, 'Git object identity mismatch');
    assert(!objects.has(row.id), 'duplicate Git object');
    objects.set(row.id, {type:row.type, bytes});
  }
  function object(id, type) {
    const row = objects.get(id); assert(row && row.type === type, 'missing Git proof object ' + id);
    used.add(id); return row.bytes;
  }
  function file(commit, name) {
    let id = /^tree ([0-9a-f]{40})\n/.exec(object(commit, 'commit').toString())?.[1];
    assert(id, 'invalid Git commit');
    for (const part of name.split('/')) id = treeEntry(object(id, 'tree'), part);
    return object(id, 'blob');
  }
  const entry = file(ACCEPTED, ENTRY), api = loadEntry(entry, ROOT);
  const expected = new Map([[ENTRY, sha(entry)], [OBSERVER_FILE, sha(file(OBSERVER, OBSERVER_FILE))],
    ...Object.entries({...api.CLOSURE,...api.HELPERS}).map(([p,h])=>['scratch/runs/'+p,h])]);
  const inputs = new Map();
  for (const row of payload.inputs) {
    assert(!inputs.has(row.path), 'duplicate input');
    assert(expected.has(row.path) || META.includes(row.path), 'unexpected input path: ' + row.path);
    const bytes = Buffer.from(row.data, 'base64');
    if (expected.has(row.path)) assert.equal(sha(bytes), expected.get(row.path), 'entry input mismatch: ' + row.path);
    inputs.set(row.path, bytes);
  }
  for (const name of [...expected.keys(),...META]) assert(inputs.has(name), 'missing entry input: ' + name);
  const pinsBytes = zlib.gunzipSync(inputs.get(META[0]));
  assert.equal(sha(pinsBytes), '4a8bb12508a5f6b402880a3af9532e28ca4bd7fc18fb94bd0ccaf6c9c3ceb4ed');
  const pins = JSON.parse(pinsBytes), seal = JSON.parse(zlib.gunzipSync(inputs.get(META[1])));
  const pinSeal = (Array.isArray(seal) ? seal : seal.files).find(row=>row.path==='runtime-pins.json');
  assert(pinSeal); assert.equal(pinSeal.sha256, sha(pinsBytes)); assert.equal(pinSeal.bytes, pinsBytes.length);
  assert.equal(pins.commit, SOURCE); assert.equal(pins.files.length, 432);
  for (const name of DEPENDENCIES) {
    const bytes = file(SOURCE, name), pin = pins.files.find(row=>row.path===name);
    assert(pin); assert.equal(bytes.length, pin.bytes); assert.equal(sha(bytes), pin.sha256, 'original Git dependency mismatch');
  }
  assert.equal(used.size, objects.size, 'unrelated Git objects forbidden');
  return {inputs, objects, pins, helpers:expected.size - 2};
}
function target(root, name) {
  const destination = path.join(root, name);
  // Do not follow inherited helper/source symlinks while writing.
  let cursor = root;
  for (const part of name.split('/')) {
    cursor = path.join(cursor, part);
    let stat;
    try {stat = fs.lstatSync(cursor);} catch (error) {if (error.code === 'ENOENT') break; throw error;}
    assert(!stat.isSymbolicLink(), 'symlink staging destination: ' + cursor);
  }
  return destination;
}
function stage(payload, runtimeRoot) {
  const {inputs, objects, pins, helpers} = validate(payload);
  const root = fs.realpathSync(runtimeRoot);
  assert(!fs.existsSync(path.join(root, '.git')), 'never stage over a Git checkout');
  const proof = target(root, PROOF);
  assert(!fs.existsSync(proof), 'entry proof already exists; validate it instead');
  const changes = [], missing = [];
  target(root, BASE + '/inputs.json');
  // Fail on inherited tracked entry disagreement. Only the pinned ignored
  // helper set may be repaired (including the demonstrated old wrapper).
  for (const [name, bytes] of inputs) {
    const destination = target(root, name);
    if (fs.existsSync(destination)) {
      const old = fs.readFileSync(destination);
      if (sha(old) !== sha(bytes)) {
        assert(name.startsWith('scratch/runs/') && !META.includes(name), 'inherited entry mismatch: ' + name);
        changes.push({path:name, previousSHA256:sha(old), sha256:sha(bytes)});
      }
    } else missing.push(name);
  }
  for (const row of pins.moduleFiles) {
    const reference = path.join(root, row.localReference);
    const bytes = readRetained(root, row.path);
    assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256, 'inherited original module mismatch');
    if (fs.existsSync(reference) || fs.existsSync(reference+'.gz')) {
      const retained = readRetained(root, row.localReference);
      assert.equal(sha(retained), row.sha256, 'inherited retained module mismatch');
    }
  }
  for (const [name, bytes] of inputs) {
    const destination = target(root, name);
    fs.mkdirSync(path.dirname(destination), {recursive:true});
    // Replace the directory entry, preserving any inherited hardlink peers.
    const temporary = destination + '.staging-' + crypto.randomBytes(6).toString('hex');
    try {fs.writeFileSync(temporary, bytes, {flag:'wx'}); fs.renameSync(temporary, destination);}
    finally {if (fs.existsSync(temporary)) fs.unlinkSync(temporary);}
  }
  // Construct a new, deliberately partial bare object database. No .git,
  // history, refs, source checkout, alternates or module/media bytes copied.
  fs.mkdirSync(proof, {recursive:true});
  cp.execFileSync('git', ['init','--bare','--quiet','--template=',proof], {env:environment()});
  for (const [id, row] of objects) {
    const filename = path.join(proof, 'objects', id.slice(0,2), id.slice(2));
    fs.mkdirSync(path.dirname(filename), {recursive:true});
    fs.writeFileSync(filename, zlib.deflateSync(Buffer.concat([Buffer.from(`${row.type} ${row.bytes.length}\0`),row.bytes])), {flag:'wx'});
  }
  for (const row of pins.moduleFiles) {
    const reference = path.join(root, row.localReference);
    if (!fs.existsSync(reference) && !fs.existsSync(reference+'.gz')) {
      target(root, row.localReference);
      fs.mkdirSync(path.dirname(reference), {recursive:true});
      const suffix = fs.existsSync(path.join(root,row.path)) ? '' : '.gz';
      fs.symlinkSync(path.relative(path.dirname(reference), path.join(root,row.path)+suffix), reference+suffix);
    }
  }
  fs.writeFileSync(path.join(root, BASE, 'inputs.json'), JSON.stringify(payload));
  return {status:'exact-entry-inputs-staged', helpers, inputs:inputs.size, gitObjects:objects.size,
    inputBytes:[...inputs.values()].reduce((n,b)=>n+b.length,0), missing, repaired:changes,
    runtime:'Inherited original modules referenced in place; no runtime execution or allocation.'};
}
function invoke(runtimeRoot, args) {
  const root = fs.realpathSync(runtimeRoot), proof = path.join(root, PROOF);
  const payload = JSON.parse(fs.readFileSync(path.join(root,BASE,'inputs.json')));
  const {inputs, objects} = validate(payload);
  for (const [name, bytes] of inputs)
    assert.equal(sha(fs.readFileSync(path.join(root,name))), sha(bytes), 'staged input mismatch: '+name);
  // A valid manifest cannot hide replaced/corrupt objects in the live store.
  for (const [id, row] of objects) {
    const stored = zlib.inflateSync(fs.readFileSync(path.join(proof,'objects',id.slice(0,2),id.slice(2))));
    assert(stored.equals(Buffer.concat([Buffer.from(`${row.type} ${row.bytes.length}\0`),row.bytes])), 'staged Git object mismatch');
  }
  assert(!fs.existsSync(path.join(proof,'objects/info/alternates')), 'Git alternates forbidden');
  assert(!fs.existsSync(path.join(proof,'refs/replace')) || !fs.readdirSync(path.join(proof,'refs/replace')).length, 'Git replacements forbidden');
  const result = cp.spawnSync(process.execPath, [path.join(root,ENTRY), ...args],
    {cwd:root, env:environment(proof), encoding:'utf8', maxBuffer:4000000});
  assert.equal(result.status, 0, 'accepted entry failed: ' + result.stderr);
  return result.stdout;
}
module.exports = {ACCEPTED, SOURCE, OBSERVER, ENTRY, PROOF, BASE, DEPENDENCIES, sha, oid, prepare, validate, stage, invoke, environment};
if (require.main === module) {
  try {
    const [mode, first, second] = process.argv.slice(2);
    if (mode === '--prepare' && first && !second) {
      const payload = prepare(); fs.writeFileSync(first, JSON.stringify(payload), {flag:'wx'});
      console.log(JSON.stringify({status:'prepared', bytes:fs.statSync(first).size, sha256:sha(fs.readFileSync(first))}));
    } else if (mode === '--stage' && first && second) console.log(JSON.stringify(stage(JSON.parse(fs.readFileSync(first)),second),null,2));
    else if (mode === '--check' && first && !second) process.stdout.write(invoke(first,['--check']));
    else if (mode === '--run' && first && second) process.stdout.write(invoke(first,['--run',second]));
    else throw Error('usage: --prepare INPUT.json | --stage INPUT.json INHERITED_ROOT | --check INHERITED_ROOT | --run INHERITED_ROOT ABSOLUTE_FRESH_RUN');
  } catch (error) {console.error(error.message); process.exitCode=2;}
}
