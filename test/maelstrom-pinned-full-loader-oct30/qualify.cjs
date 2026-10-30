#!/usr/bin/env node
'use strict';
// Launch supervision only. Production test/run.js owns imports, PE/DLL loading,
// stack/thread initialization and guest execution. No synthetic guest state here.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const PINS = require('./pins.json');
const KEYS = ['node', 'runner', 'wasm', 'exe', 'sdl', 'sdl-net', 'msvcrt'];
const OPTIONS = [...KEYS, 'tree', 'manifest', 'out', 'max-seconds', 'max-batches', 'memory-mb', 'wall-seconds', 'output-bytes'];
function check(ok, message) { if (!ok) throw Error(message); }
function absolute(p) {
  check(typeof p === 'string' && p.length <= 1024 && path.isAbsolute(p) && !/[\x00-\x1f]/.test(p), 'absolute path required');
  check(path.normalize(p) === p, 'normalized absolute path required');
  return p;
}
function parse(argv) {
  const c = {};
  for (const a of argv) {
    const m = /^--([a-z-]+)=(.+)$/.exec(a);
    check(m && OPTIONS.includes(m[1]) && !(m[1] in c), 'unknown, duplicate or malformed option');
    c[m[1]] = m[2];
  }
  for (const k of [...KEYS, 'tree', 'manifest', 'out']) absolute(c[k]);
  for (const [k, fallback, min, max] of [
    ['max-seconds', 10, 1, 60], ['max-batches', 200, 1, 100000],
    ['memory-mb', 512, 512, 2048], ['wall-seconds', 20, 1, 90], ['output-bytes', 131072, 1024, 262144],
  ]) {
    const v = c[k] === undefined ? fallback : Number(c[k]);
    check(Number.isSafeInteger(v) && v >= min && v <= max, 'invalid bound: ' + k);
    c[k] = v;
  }
  check(c['wall-seconds'] >= c['max-seconds'], 'wall bound must cover guest loop bound');
  // getArgs() splits commas even in --vfs-tree; --dlls also trims each item.
  for (const k of ['tree', 'sdl', 'sdl-net', 'msvcrt'])
    check(!c[k].includes(',') && c[k].trim() === c[k], 'runner list path is ambiguous: ' + k);
  for (const [k, name] of [['sdl', 'sdl.dll'], ['sdl-net', 'sdl_net.dll'], ['msvcrt', 'msvcrt.dll']])
    check(path.basename(c[k]).toLowerCase() === name, 'wrong DLL name: ' + k);
  check(path.basename(c.runner) === 'run.js' && path.basename(path.dirname(c.runner)) === 'test', 'production test/run.js required');
  return c;
}
function jsonFile(p, max) {
  const st = fs.lstatSync(p);
  check(st.isFile() && st.size <= max, 'oversized/non-file JSON');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function hashFile(p, expected) {
  const st = fs.lstatSync(p);
  check(st.isFile() && expected && Number.isSafeInteger(expected.bytes) && expected.bytes === st.size &&
    /^[a-f0-9]{64}$/.test(expected.sha256), 'file size/type/manifest mismatch: ' + p);
  const h = crypto.createHash('sha256'), b = Buffer.alloc(65536);
  const fd = fs.openSync(p, 'r');
  try { let n; while ((n = fs.readSync(fd, b, 0, b.length, null))) h.update(b.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  check(h.digest('hex') === expected.sha256, 'SHA256 mismatch: ' + p);
}
function validate(c, pins) {
  const m = jsonFile(c.manifest, 1048576);
  check(m.schema === 'maelstrom-loader-inputs/v1', 'manifest schema');
  for (const k of KEYS) {
    check(m.inputs?.[k]?.path === c[k], 'manifest path mismatch: ' + k);
    hashFile(c[k], m.inputs[k]);
  }
  hashFile(c.wasm, pins.wasm); // Mandatory complete transformed module identity.
  const root = path.dirname(path.dirname(c.runner));
  for (const [relative, pin] of Object.entries(pins.sources)) hashFile(path.join(root, relative), pin);
  check(m.tree?.path === c.tree && Array.isArray(m.tree.files) && m.tree.files.length <= 4096, 'tree manifest required');
  const wanted = new Map();
  let bytes = 0;
  for (const f of m.tree.files) {
    check(typeof f.path === 'string' && f.path.length <= 1024 && f.path && !path.isAbsolute(f.path) &&
      !f.path.split('/').some(s => !s || s === '.' || s === '..') && !f.path.includes('\\') && !/[\x00-\x1f]/.test(f.path) && !wanted.has(f.path), 'invalid tree member');
    check(Number.isSafeInteger(f.bytes) && f.bytes >= 0, 'invalid tree bytes');
    bytes += f.bytes; wanted.set(f.path, f);
  }
  check(bytes <= 512 * 1048576, 'tree byte bound');
  let count = 0;
  function walk(dir, prefix = '', depth = 0) {
    check(depth <= 32 && fs.lstatSync(dir).isDirectory(), 'tree directory/depth');
    const d = fs.opendirSync(dir);
    try {
      let entry;
      while ((entry = d.readSync())) {
        check(++count <= 8192, 'tree entry bound');
        const relative = prefix + entry.name, p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p, relative + '/', depth + 1);
        else {
          check(entry.isFile() && wanted.has(relative), 'unlisted/non-file tree member');
          hashFile(p, wanted.get(relative)); wanted.delete(relative);
        }
      }
    } finally { d.closeSync(); }
  }
  walk(c.tree); check(wanted.size === 0, 'missing tree member');
  return { manifestSHA256: crypto.createHash('sha256').update(fs.readFileSync(c.manifest)).digest('hex'), treeFiles: m.tree.files.length, treeBytes: bytes };
}
// Offline builder does no I/O and accepts only already parsed configuration.
function buildArgv(c) {
  return ['--max-old-space-size=192', c.runner, '--no-build', `--wasm=${c.wasm}`, `--exe=${c.exe}`,
    `--dlls=${[c.sdl, c['sdl-net'], c.msvcrt].join(',')}`, `--vfs-tree=${c.tree}`,
    `--max-seconds=${c['max-seconds']}`, `--max-batches=${c['max-batches']}`, `--memory-mb=${c['memory-mb']}`,
    '--no-renderer', '--quiet-api', '--quiet-blocks'];
}
function assertInvocation(c, argv) {
  check(argv[0] === '--max-old-space-size=192' && argv[1] === c.runner && argv.includes('--no-build') &&
    argv.filter(x => x.startsWith('--wasm=')).length === 1 && argv.includes(`--wasm=${c.wasm}`), 'unsafe invocation identity/no-build');
}
function supervise(c, argv) {
  return new Promise(resolve => {
    const chunks = [], started = Date.now(); let stored = 0, seen = 0, reason = null, error = null, child;
    let done = false, timer;
    const kill = () => { if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') error = e.message; } } };
    function stop(r) { reason ||= r; kill(); }
    function finish(code, signal) {
      if (done) return; done = true; clearTimeout(timer);
      // Also kill descendants which outlive a successful parent or keep pipes open.
      kill(); process.removeListener('SIGTERM', term); process.removeListener('SIGINT', interrupt);
      resolve({ code, signal, reason, error, elapsedMs: Date.now() - started, outputBytesSeen: seen,
        outputBytesStored: stored, output: Buffer.concat(chunks) });
    }
    const term = () => stop('SIGTERM'), interrupt = () => stop('SIGINT');
    process.on('SIGTERM', term); process.on('SIGINT', interrupt);
    try {
      // Environment allowlist prevents NODE_OPTIONS/preloads and inherited Wasm overrides.
      child = spawn(c.node, argv, { detached: true, cwd: path.dirname(path.dirname(c.runner)),
        env: { PATH: path.dirname(c.node) + ':/usr/bin:/bin', LANG: 'C', TZ: 'UTC' }, stdio: ['ignore', 'pipe', 'pipe'] });
      function data(b) {
        seen += b.length;
        const keep = b.subarray(0, Math.max(0, c['output-bytes'] - stored));
        if (keep.length) { chunks.push(keep); stored += keep.length; }
        if (seen > c['output-bytes']) stop('output_limit');
      }
      child.stdout.on('data', data); child.stderr.on('data', data);
      child.on('error', e => { error = e.message; });
      child.on('exit', () => kill());
      child.on('close', finish);
      timer = setTimeout(() => stop('wall_limit'), c['wall-seconds'] * 1000);
    } catch (e) { error = e.message; finish(null, null); }
  });
}
function classify(child) {
  const output = child.output.toString('utf8');
  const diagnostic = /(?:\berror\b|\brejected\b|\bdisabled\b|\bunreachable\b|\btrap\b|\bfailed\b)/i.test(output);
  const schemas = ['maelstrom-select-frozen-record/v1', 'maelstrom-original-native-errno/v1'];
  return { status: child.error || child.reason ? 'invocation_failure' : child.code !== 0 || child.signal || diagnostic
    ? 'loader_or_diagnostic_rejection' : 'runtime_observations_unqualified',
  diagnosticMarkerPresent: diagnostic, observerSchemaTextPresent: schemas.filter(s => output.includes(s)),
  // Text is evidence to inspect, never an authenticated adapter event.
  select: 'unqualified', nativeReturn: 'unqualified', errno: 'unqualified', loaderAcceptance: 'unqualified' };
}
async function main(argv, contractControl = null) {
  let c, outputReady = false;
  const receipt = { schema: 'maelstrom-full-loader-wrapper/v1', executionKind: contractControl ? 'contract-control-only' : 'production-loader-invocation',
    revision: PINS.revision, status: 'invocation_failure', guestAcceptance: false, runtimeQualification: 'OPEN',
    limitations: 'Launch contract only; no select/native-return/errno, kernel, browser or gameplay acceptance is inferred.' };
  try {
    c = parse(argv);
    check(!KEYS.some(k => c[k] === c.out || c[k].startsWith(c.out + '/')) && !c.tree.startsWith(c.out + '/') &&
      !c.out.startsWith(c.tree + '/') && c.out !== c.tree, 'output overlaps inputs');
    if (!fs.existsSync(c.out)) fs.mkdirSync(c.out);
    check(fs.lstatSync(c.out).isDirectory() && fs.readdirSync(c.out).length === 0, 'output must be empty directory');
    outputReady = true;
    receipt.inputs = validate(c, contractControl?.pins || PINS);
    const childArgv = buildArgv(c); assertInvocation(c, childArgv);
    receipt.invocation = { executable: c.node, argv: childArgv, wallSeconds: c['wall-seconds'], outputLimit: c['output-bytes'] };
    const child = await supervise(c, childArgv);
    Object.assign(receipt, classify(child));
    fs.writeFileSync(path.join(c.out, 'child.log'), child.output, { flag: 'wx' });
    delete child.output; receipt.child = child;
  } catch (e) { receipt.status = 'invocation_failure'; receipt.error = String(e.message).slice(0, 2048); }
  if (outputReady) {
    const text = JSON.stringify(receipt, null, 2) + '\n'; check(Buffer.byteLength(text) <= 32768, 'receipt bound');
    fs.writeFileSync(path.join(c.out, 'receipt.json'), text, { flag: 'wx' });
  }
  return receipt;
}
function exitCode(r) {
  return r.status === 'runtime_observations_unqualified' ? 0 :
    (Number.isInteger(r.child?.code) && r.child.code > 0 && r.child.code <= 255 ? r.child.code : 2);
}
if (require.main === module) main(process.argv.slice(2)).then(r => {
  console.log(JSON.stringify(r));
  process.exitCode = exitCode(r);
}).catch(e => { console.error(String(e.message).slice(0, 2048)); process.exitCode = 2; });
module.exports = { parse, buildArgv, assertInvocation, main, classify, exitCode };
