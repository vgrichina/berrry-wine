'use strict';
// Bounded blocker reproduction, not a startup implementation or runtime test.
// Run from this repository: node docs/reviews/shell-startup-show-contract-20261020.js OUTPUT_DIR
const fs = require('fs');
const cp = require('child_process');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const revision = 'ea6f896e8099fc8072009fbf0014b52fa06bbedd';
const out = process.argv[2];
const result = { revision, status: 'blocked', inputs: {}, checks: [], rejectedAcceptanceOracles: [], capacity: [] };
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function source(file) {
  const text = cp.execFileSync('git', ['show', `${revision}:${file}`],
    { encoding: 'utf8', maxBuffer: 16 * 1024 ** 2 });
  result.inputs[file] = sha(text);
  return text;
}
function gate() {
  const stat = fs.statfsSync(out || '.');
  const available = stat.bavail * stat.bsize;
  const required = 2210398208 + 33554432 + 25165824 + 8388608;
  assert(available >= required, `CAPACITY BLOCKER ${available} < ${required}; no cleanup/retry`);
  result.capacity.push({ available, required });
}
function check(name, run) { run(); result.checks.push(name); }
function rejects(name, run) {
  let error;
  try { run(); } catch (e) { error = e.message; }
  assert(error, `expected acceptance oracle to reject: ${name}`);
  result.rejectedAcceptanceOracles.push({ name, error });
}
function watFunction(text, name) {
  const clean = text.replace(/;;[^\n]*/g, '');
  const start = clean.indexOf(`(func $${name} `);
  assert(start >= 0, name);
  let depth = 0;
  for (let at = start; at < clean.length; ++at) {
    if (clean[at] === '(') ++depth;
    if (clean[at] === ')' && --depth === 0) return clean.slice(start, at + 1);
  }
  throw Error(`unbalanced ${name}`);
}
async function main() {
  gate();
  const compiler = { console: { log() {}, warn() {}, error() {} }, TextEncoder, TextDecoder,
    Uint8Array, Float32Array, Float64Array, ArrayBuffer, Map, Set, RegExp, Array, Object,
    String, Number, Math, Promise, Date, setTimeout, clearTimeout, setImmediate, parseInt, parseFloat, isNaN };
  vm.createContext(compiler);
  for (const file of ['compiler-parser.js', 'compiler-stages.js', 'compiler-codegen.js', 'compiler.js']) {
    vm.runInContext(source(`tools/watx-src/${file}`), compiler, { filename: file });
  }
  const sync = source('src/09a-handlers3-sync.wat');
  const base = source('src/09a0-handlers-base.wat');
  const wat = `
    (memory 1) (export "memory" (memory 0))
    (global $reg_base i32 (i32.const 128))
    (func $guest_memset (param $p i32) (param $v i32) (param $n i32)
      (memory.fill (local.get $p) (local.get $v) (local.get $n)))
    (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
    (func $gs16 (param $p i32) (param $v i32) (i32.store16 (local.get $p) (local.get $v)))
    ${watFunction(sync, 'startup_info_init')}
    ${watFunction(base, 'handle_GetStartupInfoA')}
    ${watFunction(sync, 'handle_GetStartupInfoW')}
    (export "A" (func $handle_GetStartupInfoA))
    (export "W" (func $handle_GetStartupInfoW))
  `;
  const compiled = compiler.compile(wat, new Map(), { mode: 'production' });
  assert(compiled.success, compiled.error);
  result.module = { sourceSha256: sha(wat), wasmSha256: sha(compiled.wasmBinary),
    bytes: compiled.wasmBinary.length, adapters: 'identity guest memory; memset/gs16/gs32 only' };
  const e = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
  const bytes = new Uint8Array(e.memory.buffer);
  const view = new DataView(e.memory.buffer);
  for (const encoding of ['A', 'W']) {
    bytes.fill(0xa7);
    view.setUint32(144, 4096, true);
    e[encoding](1024, 0, 0, 0, 0, 0);
    check(`${encoding}: actual GetStartupInfo initializes cb, flags, normal and stdcall stack`, () => {
      assert.equal(view.getUint32(1024, true), 68);
      assert.equal(view.getUint32(1068, true), 1);
      assert.equal(view.getUint16(1072, true), 1);
      assert.equal(view.getUint32(144, true), 4104);
      assert.equal(bytes[1023], 0xa7);
      assert.equal(bytes[1092], 0xa7);
    });
    for (const requested of [0, 2]) rejects(`${encoding}: current consumer cannot report startup ${requested}`, () => {
      assert.equal(view.getUint16(1072, true), requested);
    });
  }

  // Execute the complete production process_spawn callback. Count==0 reaches
  // the production delegation expression; its callee is an argument recorder.
  // No fork, VFS export, file cleanup, VM, or child runtime is executed.
  const cli = source('test/run.js');
  const start = cli.indexOf('  h.process_spawn = (cmdWa, dirWa, childIp, specWa, count, forceSpawn, showCmd) => {');
  const end = cli.indexOf('\n  };', start) + '\n  };'.length;
  assert(start >= 0 && end > start);
  const handoff = cli.slice(start, end);
  const calls = [];
  const c = { h: {}, threadSnapshotSystemIncomplete: false,
    readStr: p => p === 100 ? '"C:\\child.exe"' : 'C:\\',
    spawnVfsChild: (...args) => { calls.push(args); return 123; } };
  vm.createContext(c);
  vm.runInContext(handoff, c);
  result.cliHandoffSha256 = sha(handoff);
  for (const requested of [0, 1, 2]) {
    check(`CLI startup ${requested}: production spawn reaches VFS delegation`, () => {
      assert.equal(c.h.process_spawn(100, 200, 0, 0, 0, 1, requested), 123);
      assert.deepEqual(calls.at(-1).slice(0, 3), ['"C:\\child.exe"', 'C:\\', true]);
    });
    rejects(`CLI startup ${requested}: show choice omitted from production delegation`, () => {
      assert.equal(calls.at(-1)[3], requested);
    });
  }

  // Execute the actual browser loadExe call expression, not a recreation of
  // its option object. wine.loadExe is an observation boundary, not a VM.
  const browser = source('lib/browser-shell.js');
  const callStart = browser.indexOf('      const ok = await wine.loadExe(app.exe, {');
  const callEnd = browser.indexOf('\n      });', callStart) + '\n      });'.length;
  assert(callStart >= 0 && callEnd > callStart);
  const call = browser.slice(callStart, callEnd);
  const browserCall = new Function('wine', 'app', 'launchArgs', 'dynamicExeBytes', 'launchOpts',
    `return (async () => { ${call}; return ok; })();`);
  result.browserHandoffSha256 = sha(call);
  for (const requested of [0, 1, 2]) {
    let observed;
    const returned = await browserCall({ loadExe: async (exe, opts) => {
      observed = opts; return true;
    } }, { exe: 'child.exe', exeGuestPath: 'C:\\child.exe' }, '/arg', null,
    { hidden: requested === 0, showCmd: requested });
    check(`browser startup ${requested}: actual loadExe handoff executes`, () => {
      assert.equal(returned, true);
      assert.equal(observed.guestPath, 'C:\\child.exe');
      assert.equal(observed.args, '/arg');
    });
    rejects(`browser startup ${requested}: show choice omitted from production PE options`, () => {
      assert.equal(observed.showCmd, requested);
    });
  }

  const windows = source('src/09a5-handlers-window.wat');
  const dispatch = source('src/09b-dispatch.wat');
  const show = watFunction(windows, 'handle_ShowWindow');
  const create = watFunction(windows, 'handle_CreateWindowExA');
  result.staticTrace = {
    showWindowSha256: sha(show), createWindowSha256: sha(create),
    note: 'Source inspection only: complete ShowWindow, CreateWindowEx and continuation were not compiled/executed.',
  };
  check('source: explicit ShowWindow forwards caller argument directly to host and WAT state', () => {
    assert(show.includes('(call $host_show_window (local.get $arg0) (local.get $arg1))'));
    assert(show.includes('(call $wnd_apply_show_state (local.get $arg0) (local.get $arg1))'));
    assert(!show.includes('startup_info'));
  });
  check('source: WS_VISIBLE creation uses independent host-create and activation continuation', () => {
    assert(create.includes('(call $host_create_window'));
    assert(create.includes('(global.set $createwnd_implicit_show (i32.const 1))'));
    assert(dispatch.includes('(if (global.get $createwnd_implicit_show)'));
    assert(dispatch.includes('(global.set $show_window_activated (i32.const 1))'));
  });
  // Hash the additional production boundaries inspected for the blocker.
  for (const file of ['host.js', 'lib/process-boot.js', 'lib/renderer.js',
    'src/01-header.wat', 'src/09d7-pipes.wat', 'src/09a7d-handlers-shell-file.wat']) source(file);
  result.limits = [
    'No production changes; expected acceptance failures reproduce the retained candidate, not a fix.',
    'No actual PE child, browser, WorkerRPC, CreateWindowEx callback, ShowWindow or implicit-show continuation execution.',
    'CLI VFS delegation and browser PE option construction execute production source with recording callees.',
    'A/W refers to GetStartupInfo consumers here, not a newly tested full ShellExecuteEx A/W launch chain.',
    'Unsupported masks, process aliases, window lookup, main and protected laptop tasks untouched.',
  ];
  if (out) {
    gate();
    fs.writeFileSync(path.join(out, 'tests.json'), JSON.stringify(result, null, 2) + '\n');
  }
  console.log(JSON.stringify({ status: result.status, checks: result.checks.length,
    rejectedAcceptanceOracles: result.rejectedAcceptanceOracles.length, module: result.module }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
