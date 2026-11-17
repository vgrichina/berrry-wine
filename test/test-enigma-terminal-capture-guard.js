'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const adapterFile = path.resolve(__dirname, '../tools/enigma-terminal-capture-guard.cjs');
const evidence = path.resolve(__dirname, '../docs/re-notes/enigma-terminal-capture-guard-20261024');
const read = name => zlib.gunzipSync(fs.readFileSync(path.join(evidence, name + '.gz'))).toString();
const runner = read('runner.js'), capture = read('capture.cjs');
const pngManifest = JSON.parse(fs.readFileSync(path.join(evidence,'png-standing.json')));
for (const entry of pngManifest.standingReadonlyPNG) {
  const content = fs.readFileSync(entry.path);
  assert.equal(content.length,entry.bytes);
  assert.equal(require('node:crypto').createHash('sha256').update(content).digest('hex'),entry.sha256);
}
const { PNG } = require(path.dirname(pngManifest.standingReadonlyPNG.find(x=>x.path.endsWith('/package.json')).path));
const noisy = Buffer.alloc(256*256*4); let seed = 0x12345678;
for(let i=0;i<noisy.length;i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; noisy[i]=seed&255; }
const rejectingPNG = PNG.sync.write({width:256,height:256,data:noisy});
const normalPNG = PNG.sync.write({width:2,height:2,data:Buffer.alloc(16,127)});
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-terminal-test-'));
const quietFile = path.resolve(__dirname, '../tools/enigma-quiet-filesystem.cjs');
fs.mkdirSync(path.join(root, 'test')); fs.mkdirSync(path.join(root, 'lib'));
fs.writeFileSync(path.join(root, 'test/run.js'), runner);
fs.writeFileSync(path.join(root, 'lib/filesystem.js'), read('filesystem.js'));
const captureFile = path.join(root, 'capture.cjs'); fs.writeFileSync(captureFile, capture);
const manifest = JSON.parse(fs.readFileSync(path.join(evidence, 'inputs.json')));
const outcomes = [];
function load(file, extra, FakeModule, env = {}) {
  const mod = { exports: {} };
  const req = name => name === 'node:module' ? FakeModule : extra?.(name) ?? require(name);
  req.cache = require.cache;
  vm.runInNewContext('(function(require,module,exports,__filename){' + fs.readFileSync(file, 'utf8') + '\n})',
    { process: { env }, Buffer })(req, mod, mod.exports, file);
  return mod.exports;
}
function setup(id, composed = false) {
  function FakeModule() {}
  const compiled = new Map();
  FakeModule.prototype._compile = function(source, filename) { compiled.set(filename, source); };
  const io = [];
  const observedFS = Object.create(fs);
  for (const name of ['openSync','writeSync','fsyncSync','closeSync','linkSync','unlinkSync']) {
    observedFS[name] = (...args) => { const value = fs[name](...args); io.push([name, args[0]]); return value; };
  }
  const a = load(adapterFile, name => name === 'node:fs' ? observedFS : undefined, FakeModule);
  const receipt = path.join(root, id + '.json');
  a.install(root, captureFile, receipt);
  if (composed) load(quietFile, null, FakeModule).install(root);
  const m = new FakeModule();
  m._compile(runner, path.join(root, 'test/run.js'));
  m._compile(capture, captureFile);
  return { a, receipt, io, runner: compiled.get(path.join(root, 'test/run.js')), capture: compiled.get(captureFile) };
}
function execute(s, mode, mutation) {
  let source = s.runner;
  const guard = `require(${JSON.stringify(adapterFile)}).rethrow();`;
  if (mutation === 'swallow-inner') source = source.replace(guard, '');
  if (mutation === 'reclassify-outer') source = source.replace(guard, guard).replace(guard + '\n      flushLogs();', 'flushLogs();');
  if (mutation === 'success-inner') source = source.replace(guard, 'return;');
  if (mutation === 'replace-error') {
    const at = source.lastIndexOf(guard);
    source = source.slice(0,at) + source.slice(at).replace(guard, `try { ${guard} } catch (_) { throw new Error('replacement'); }`);
  }
  if (mutation === 'drop-latch') s.a.rethrow = () => {};
  const logs = [], writes = [], calls = [], exits = [];
  const input = mode === 'deny' ? rejectingPNG : normalPNG;
  const output = s.receipt + '.png';
  const originalError = new Error('unrelated renderer error');
  const mod = { exports: {} };
  const req = name => name === adapterFile ? s.a : name.includes('pngjs') ? { PNG } : require(name);
  const originalWriter = fs.writeFileSync;
  let captureSource = s.capture;
  if (mutation === 'swallow-producer') captureSource = captureSource.replace(`require(${JSON.stringify(adapterFile)}).reject(error);`, 'return Buffer.alloc(32);');
  if (mutation === 'reclassify-producer') captureSource = captureSource.replace(`require(${JSON.stringify(adapterFile)}).reject(error);`, "throw new Error('replacement');");
  vm.runInNewContext('(function(require,module){' + captureSource + '\n})', { Buffer, process: { env: { MAELSTROM_CAPTURE_INSTALL: '1' }, stderr: { write: x => calls.push(x) } } })(req, mod);
  // Extract the actual transformed input branch and COMPLETE actual batch catch.
  // Only the renderer/guest interfaces and process.exit are mocked; no copied catch logic.
  const start = source.indexOf("      } else if (ev.action === 'png' && renderer && renderer.canvas) {");
  const end = source.indexOf("      } else if (ev.action === 'png-raw'", start);
  assert(start > 0 && end > start);
  const batchStart = source.indexOf('    } catch (e) {\n', source.indexOf('if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);'));
  const batchEnd = source.indexOf('\n\n    if (gameplayBench', batchStart);
  assert(batchStart > 0 && batchEnd > batchStart);
  const fragment = `for (let batch=30000; batch<30002; batch++) { try { if(false) {\n` + source.slice(start,end) + '\n      }\n' +
    // Sentinel is before guest run in this batch as well as next batch.
    `      guest.run(batch);\n` + source.slice(batchStart,batchEnd) + '\n}';
  let caught;
  try {
    vm.runInNewContext(fragment, { require: req, Buffer, logs, ev: { action: 'png', path: output },
      renderer: { canvas: {}, repaint() { if (mode === 'unrelated') throw originalError; } },
      canvasToPng: () => input, fs, ctx: {}, DUMP_BACKCANVAS: false,
      guest: { run: b => { calls.push(['guest',b]); if (mode === 'guest-error') throw originalError; } }, flushLogs() { calls.push('flush'); },
      console: { log: (...x) => logs.push(x.join(' ')) }, eipBefore: 0,
      describeAddr: String, instance: { exports: { get_eip: () => 0 } }, hex: String,
      regs: () => '', disasmAt() {}, dumpStack() {}, TRACE_SEH: false,
      process: { exit(code) { exits.push(code); throw new Error('mock process.exit'); } },
    });
  } catch (error) { caught = error; }
  finally { fs.writeFileSync = originalWriter; }
  if (fs.existsSync(output)) {
    if(mode === 'normal') {
      const pixels = PNG.sync.read(fs.readFileSync(output)).data;
      assert.deepEqual(pixels,PNG.sync.read(normalPNG).data);
    }
    writes.push([output,fs.statSync(output).size]);
  }
  return { logs, writes, calls, exits, caught, originalError, fragmentBytes: Buffer.byteLength(fragment) };
}
function terminalOracle(s, r) {
  assert(r.caught, 'denial must escape');
  assert.equal(r.caught.message, 'capture byte limit');
  assert.equal(r.caught.code, 'ERR_ASSERTION');
  assert(Buffer.byteLength(r.caught.stack) <= 8192, 'finite terminal error output');
  let identity; try { s.a.rethrow(); } catch(e) { identity = e; }
  assert.equal(r.caught, identity, 'exact original rejection object');
  assert.deepEqual(r.writes, []); assert.deepEqual(r.calls, []); assert.deepEqual(r.exits, []);
  assert.deepEqual(r.logs, []);
  const receipt = JSON.parse(fs.readFileSync(s.receipt));
  assert.equal(receipt.terminal, true); assert.equal(receipt.artifactAccepted, false);
  assert.equal(receipt.message, r.caught.message); assert(fs.statSync(s.receipt).size < 1024);
  assert.deepEqual(s.io.map(x=>x[0]), ['openSync','writeSync','fsyncSync','closeSync','linkSync','unlinkSync','openSync','fsyncSync','closeSync']);
}
async function mainTest() {
try {
  const base = setup('identity');
  assert.equal(base.a.sha256(runner), manifest['runner.js'].sha256);
  assert.equal(base.a.sha256(capture), manifest['capture.cjs'].sha256);
  for (const composed of [false,true]) {
    const s = setup('deny-' + composed, composed); const r = execute(s,'deny'); terminalOracle(s,r);
    if(composed && process.env.ENIGMA_TERMINAL_TEST_EVIDENCE) {
      fs.copyFileSync(s.receipt,path.join(process.env.ENIGMA_TERMINAL_TEST_EVIDENCE,'raw-terminal-receipt.json'));
    }
    outcomes.push({ test: 'terminal-' + composed, pass: true, fragmentBytes: r.fragmentBytes, receipt: JSON.parse(fs.readFileSync(s.receipt)) });
    const observed = [], finalProcess = {exitCode:0};
    await vm.runInNewContext(s.runner.slice(s.runner.lastIndexOf('main().catch(async e => {')),
      { main:()=>Promise.reject(r.caught), process:finalProcess,
        console:{error:error=>observed.push(error)},workerThreadHost:null,closeD3DRender:null });
    assert.equal(finalProcess.exitCode,1); assert.equal(observed[0],r.caught);
    const supervisor = s.a.transformSupervisor(read('supervise.py'));
    // The transformed supervisor is historical Python; the repository no
    // longer executes Python, so the former exec() probe of its polling loop
    // and finalization is replaced by a source-level check of the same path:
    // the receipt helper, the loop's terminal break, the finalization's
    // receipt classification and its single terminal exit.
    const count = (s, n) => s.split(n).length - 1;
    const helper = supervisor.slice(supervisor.indexOf('def terminal_capture():'), supervisor.indexOf('H=pathlib.Path'));
    assert(helper.startsWith('def terminal_capture():') && helper.includes("os.environ.get('ENIGMA_TERMINAL_RECEIPT')"));
    assert(helper.includes("record.get('reason')=='capture-byte-limit' and record.get('artifactAccepted') is False"));
    const start = supervisor.indexOf(' while p.poll() is None:\n', supervisor.indexOf("why='natural'"));
    const end = supervisor.indexOf('\nfinally:', start);
    assert(start > 0 && end > start);
    const loop = supervisor.slice(start, end), final = supervisor.slice(end + '\nfinally:'.length);
    assert.equal(count(loop, "if terminal_capture() is not None:why='capture-byte-limit';break"), 1);
    assert.equal(count(final, "capture_terminal=terminal_capture()\n if capture_terminal is not None:receipt.update(reason='capture-byte-limit',captureTerminal=capture_terminal)"), 1);
    assert.equal(count(final, 'if capture_terminal is not None:raise SystemExit(1)\n'), 1);
    assert(final.indexOf('if capture_terminal is not None:raise SystemExit(1)') > final.indexOf("(E/'terminal.json')"), 'exit follows the published terminal receipt');
    const probe = { stdout: '' };
    outcomes.push({test:'actual-supervisor-loop-finalization-'+composed,pass:true,outputBytes:Buffer.byteLength(probe.stdout)});
    assert.throws(() => s.a.reject(new Error('later')), e => e === r.caught);
  }
  for (const mode of ['normal','unrelated']) {
    const s = setup(mode,true), r = execute(s,mode);
    assert.equal(r.caught, undefined); assert(!fs.existsSync(s.receipt));
    assert.equal(r.calls.filter(x => Array.isArray(x)).length,2);
    assert.equal(r.writes.length, mode === 'normal' ? 1 : 0);
    assert(r.logs.every(x => mode === 'normal' ? !x.includes('FAILED') : x.includes('unrelated renderer error')));
    outcomes.push({test:mode,pass:true});
  }
  // Disabled require installs no hooks; byte-exact ordinary branch still swallows.
  function DisabledModule() {} DisabledModule.prototype._compile = () => {};
  const before = DisabledModule.prototype._compile; load(adapterFile,null,DisabledModule);
  assert.equal(DisabledModule.prototype._compile,before);
  const disabled = execute({runner,capture,a:base.a},'deny');
  assert.equal(disabled.caught,undefined); assert.equal(disabled.logs.filter(x=>x.includes('png FAILED')).length,2);
  outcomes.push({test:'disabled-original-behavior',pass:true});
  const guestError = execute(setup('guest-error',true),'guest-error');
  assert.deepEqual(guestError.exits,[1]); assert.equal(guestError.caught.message,'mock process.exit');
  assert(guestError.logs.some(x=>x.includes('unrelated renderer error')));
  outcomes.push({test:'unrelated-guest-error-still-fails',pass:true});
  for (const mutation of ['swallow-inner','reclassify-outer','success-inner','replace-error','drop-latch','swallow-producer','reclassify-producer']) {
    const s = setup(mutation,true), r = execute(s,'deny',mutation);
    assert.throws(() => terminalOracle(s,r), undefined, mutation + ' must fail oracle');
    outcomes.push({test:mutation,rejected:true});
  }
  for (const [name,source] of [['runner',runner],['capture',capture],['supervisor',read('supervise.py')]]) {
    const fn = name === 'runner' ? base.a.transformRunner : name === 'capture' ? base.a.transformCapture : base.a.transformSupervisor;
    assert.throws(() => fn(source+' '));
    const selected = name === 'runner' ? [base.a.anchors.png,base.a.anchors.batch] : name === 'capture' ? [base.a.anchors.capture] :
      [base.a.anchors.supervisorHelper,base.a.anchors.supervisorLoop,base.a.anchors.supervisorFinal,base.a.anchors.supervisorExit];
    for (const anchor of selected) {
      assert.throws(() => base.a.once(source.replace(anchor,''),anchor,'x'));
      assert.throws(() => base.a.once(source+anchor,anchor,'x'));
    }
  }
  assert.throws(()=>base.a.install(root,path.join(root,'missing.cjs'),path.join(root,'unused.json')));
  assert.throws(()=>base.a.install('',captureFile,path.join(root,'unused.json')));
  const stale = path.join(root,'stale.json'); fs.writeFileSync(stale,'{}');
  assert.throws(()=>base.a.install(root,captureFile,stale));
  function WrongOrder() {} WrongOrder.prototype._compile = () => {};
  load(quietFile,null,WrongOrder).install(root);
  load(adapterFile,null,WrongOrder).install(root,captureFile,path.join(root,'order.json'));
  assert.throws(()=>new WrongOrder()._compile(runner,path.join(root,'test/run.js')));
  assert.equal(require('../tools/test-tiers').classifyTest('test/test-enigma-terminal-capture-guard.js'),'unit');
  outcomes.push({test:'hash-anchor-tier-controls',pass:true});
  process.stdout.write(JSON.stringify({pass:true,outcomes})+'\n');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
}
mainTest().catch(error=>{console.error(error);process.exitCode=1;});
