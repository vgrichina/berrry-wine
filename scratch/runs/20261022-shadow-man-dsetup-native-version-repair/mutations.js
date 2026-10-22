'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const Module = require('module'), cp = require('child_process');
const root = path.resolve(__dirname, '../../..');
const pins = JSON.parse(fs.readFileSync(path.join(__dirname, 'source-pins.json')));
const baseline = file => fs.readFileSync(pins.files.find(r => r.path === file).source, 'utf8');
function replaceModule(file, text) {
  const target = path.join(root, file), m = new Module(target, module);
  m.filename = target; m.paths = Module._nodeModulePaths(path.dirname(target));
  require.cache[target] = m; m._compile(text, target);
}
if (process.env.DSETUP_MUTATION) {
  const kind = process.env.DSETUP_MUTATION;
  if (kind === 'skipped-load') replaceModule('lib/dll-registry.js', baseline('lib/dll-registry.js'));
  if (kind === 'fabricated-file') replaceModule('lib/process-boot.js', baseline('lib/process-boot.js'));
  if (kind === 'fabricated-registry') replaceModule('lib/storage.js', baseline('lib/storage.js'));
  if (kind === 'fabricated-ansi') {
    const {sourceFunction} = require(path.join(root, 'test/wat-source-function'));
    const fixture = require(path.join(root, 'test/version-source-fixture'));
    const original = fixture.compileSrcWasm;
    let source = fs.readFileSync(path.join(root, 'src/09a1-comctl-handlers.wat'), 'utf8');
    const old = baseline('src/09a1-comctl-handlers.wat');
    for (const name of ['handle_GetFileVersionInfoSizeA', 'handle_GetFileVersionInfoA'])
      source = source.replace(sourceFunction(source, name), sourceFunction(old, name));
    const header = baseline('src/01-header.wat');
    const start = header.indexOf('  (data (region.addr $DX_VERSION_INFO 0)');
    const end = header.indexOf('\n\n', start);
    const data = header.slice(start, end).replace('(region.addr $DX_VERSION_INFO 0)', '(i32.const 0x2000)');
    // Classifier boundary restricted to this fixture's known DDRAW filename;
    // the actual old A handlers and exact old data block run verbatim.
    const extraWat = `(global $DX_VERSION_INFO i32 (i32.const 0x2000))
      (global $DX_VERSION_INFO_SIZE i32 (i32.const 92))
      (func $name_is_static_dx_dll (param i32) (result i32) (i32.const 1))\n` + data;
    fixture.compileSrcWasm = () => original(undefined, {source, extraWat});
  }
} else {
  const cases = [
    ['skipped-load', 'test/test-dsetup-loading.js', []],
    ['fabricated-file', 'test/test-directx-system-files.js', ['--source-fixture']],
    ['fabricated-registry', 'test/test-directx-registry-metadata.js', []],
    ['fabricated-ansi', 'test/test-directx-system-files.js', ['--source-fixture']],
  ];
  const outcomes = [];
  for (const [mutation, file, args] of cases) {
    const result = cp.spawnSync(process.execPath, ['--require', __filename, file, ...args],
      {cwd: root, env: {...process.env, DSETUP_MUTATION: mutation}, encoding:'utf8', timeout:20000});
    assert.strictEqual(result.status, 1, mutation + ': regression must reject');
    assert(result.stderr.includes('AssertionError'), mutation + ': must reach semantic assertion');
    assert(!result.stderr.includes('Compilation failed'), mutation + ': compilation failure is not a control');
    outcomes.push({mutation, exit:result.status, stdout:result.stdout, stderr:result.stderr});
    console.log('PASS rejecting control', mutation);
  }
  fs.writeFileSync(path.join(__dirname, 'mutation-results.json'), JSON.stringify(outcomes, null, 2)+'\n');
}
