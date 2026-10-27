#!/usr/bin/env node
'use strict';

// Run against an exact original script, not a helper reimplementation:
// node --max-old-space-size=512 test/test-region-census-build-gates.js ORIGINAL_JS OUTPUT_DIR
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const assert = require('assert');
const { stage } = require('./helpers/region-census-cli-fixture');
const repo = path.resolve(__dirname, '..');
const original = path.resolve(process.argv[2] || path.join(__dirname, 'fixtures/region-census-build-gates/original-region-census.js.txt'));
assert.strictEqual(require('crypto').createHash('sha256').update(fs.readFileSync(original)).digest('hex'),
  '58bf809d531f908341874bb72b2a6faed37903dc2f34e98bb288bb1e5fa781a2', 'exact pinned original CLI oracle');
const out = process.argv[3] ? path.resolve(process.argv[3]) : fs.mkdtempSync(path.join(require('os').tmpdir(), 'region-census-build-gates-'));
fs.mkdirSync(out, { recursive: true });
const roots = ['original', 'candidate'].map(n => path.join(out, n));
const gates = ['js-copies', 'embedded-wat', 'dup-payloads', 'hand-rolled'];
let serial = 0;
const results = [];
function reset() { roots.forEach((r, i) => stage(repo, r, i ? undefined : original)); }
function run(root, args, extra = []) {
  const id = String(++serial).padStart(4, '0');
  const argv = ['--max-old-space-size=512', ...extra, path.join(root, 'tools/region-census.js'), ...args];
  // Run from outside the fixture to exercise __dirname-based resolution.
  const r = cp.spawnSync(process.execPath, argv, { cwd: out, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: 15000 });
  fs.writeFileSync(path.join(out, `${id}.stdout`), r.stdout || '');
  fs.writeFileSync(path.join(out, `${id}.stderr`), r.stderr || '');
  assert.ifError(r.error);
  assert.notStrictEqual(r.status, null);
  results.push({ id, root: path.basename(root), args, status: r.status });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function independent(root, extra = []) {
  let stdout = '', stderr = '', status = 0;
  for (const g of gates) {
    const r = run(root, [`--${g}`], extra);
    stdout += r.stdout; stderr += r.stderr; status = r.status;
    if (status) break;
  }
  return { status, stdout, stderr };
}
// Stack frame line numbers necessarily move when code is added. Keep the
// diagnostic and filesystem identity; retain the entire original stderr too.
function normalized(r) {
  return { ...r, stderr: r.stderr.replaceAll(roots[0], '<ROOT>').replaceAll(roots[1], '<ROOT>')
    .split('\n').filter(l => !/^\s*at |^Node\.js |^node:|^\s*throw |^\s*\^|^\s*$/.test(l)).join('\n') };
}
function compare(label, mutate = () => {}, expected = 0) {
  reset(); roots.forEach(mutate);
  const a = independent(roots[0]);
  const b = run(roots[1], ['--build-gates']);
  assert.strictEqual(a.status, expected, `${label}: original`);
  assert.deepStrictEqual(normalized(b), normalized(a), label);
}
function append(root, rel, text) { fs.appendFileSync(path.join(root, rel), `\n${text}\n`); }
reset();
const layout = require(path.join(roots[0], 'tools/region-layout')).layout();
const pinned = new Set(layout.regions.filter(r => r.kind !== 'alloc').map(r => r.base));
const victim = layout.regions.find(r => r.kind === 'alloc' && r.base >= 0x20000 && !pinned.has(r.base));
assert(victim);
const name = victim.name.replace(/^\$/, '');
const hex = n => '0x' + n.toString(16);
const base = hex(victim.base);
const plants = [
  r => append(r, 'host.js', `const bad = ${base};`),
  r => append(r, 'host.js', 'const extraWat = String.raw`(func (i32.load (i32.const ' + (victim.base + 1) + ')))`;'),
  r => append(r, 'src/01-header.wat', `(data (region.addr $${name} 0) "NEW-DUP")\n(data (region.addr $${name} 8) "NEW-DUP")`),
  r => append(r, 'src/01-header.wat', `(global $${name} i32 (region.addr $${name} 0))\n(func (i32.add (global.get $${name}) (i32.const 1)))`),
];

// The first candidate execution is the exact production CLI success path.
compare('clean production CLI');
for (let mask = 1; mask < 16; mask++) {
  compare(`violations ${mask}: ordered first failure`, r => plants.forEach((p, i) => { if (mask & (1 << i)) p(r); }), 1);
}
compare('coverage floor cannot pass vacuously', r => {
  const f = path.join(r, 'src/01-header.wat');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\(data \(region\.addr/g, '(data (other.addr'));
}, 1);
compare('out of region cannot hide behind baseline', r => {
  append(r, 'src/01-header.wat', `(global $${name} i32 (region.addr $${name} 0))\n(func (i32.add (global.get $${name}) (i32.const ${victim.size})))`);
  const f = path.join(r, 'tools/region-census.baseline.json');
  const b = JSON.parse(fs.readFileSync(f)); b.handRolledByFile = { 'src/01-header.wat': 1000 }; fs.writeFileSync(f, JSON.stringify(b));
}, 1);
compare('missing optional host retains legacy skip', r => fs.unlinkSync(path.join(r, 'host.js')));
compare('missing JS directory', r => fs.rmSync(path.join(r, 'test'), { recursive: true }), 1);
compare('missing manifest', r => fs.unlinkSync(path.join(r, 'src/main.watx')), 1);
compare('missing declarations', r => fs.unlinkSync(path.join(r, 'src/00-regions.wat')), 1);
compare('missing WAT part', r => fs.unlinkSync(path.join(r, 'src/01-header.wat')), 1);
compare('malformed baseline', r => fs.writeFileSync(path.join(r, 'tools/region-census.baseline.json'), '{'), 1);
compare('missing baseline retains legacy empty ratchets', r => fs.unlinkSync(path.join(r, 'tools/region-census.baseline.json')));
compare('changed layout recomputes across invocations', r => {
  append(r, 'src/00-regions.wat', '(region.declare $CLI_FRESH (size 0x1000) (align 16))');
});
// All individual/default/combined-legacy modes retain their old behavior and writes.
for (const args of [[], ['--gate'], ['--json'], ['--loose', '--json'], ['--region=' + name], ['--file=src/01-header.wat'],
  ...gates.map(g => [`--${g}`]), ['--js-copies', '--embedded-wat', '--dup-payloads', '--hand-rolled'],
  ['--unknown'], ['--record'], ['--hand-rolled', '--record'], ['--dup-payloads', '--record'],
  ['--js-copies', '--record'], ['--embedded-wat', '--record'], ['--gate', '--record']]) {
  reset();
  assert.deepStrictEqual(normalized(run(roots[1], args)), normalized(run(roots[0], args)), `legacy ${args}`);
  assert.strictEqual(fs.readFileSync(path.join(roots[1], 'tools/region-census.baseline.json'), 'utf8'),
    fs.readFileSync(path.join(roots[0], 'tools/region-census.baseline.json'), 'utf8'), `baseline writes ${args}`);
}
for (const option of ['--record', '--gate', '--json', '--loose', '--region=X', '--file=X', '--unknown', '--js-copies', '--embedded-wat', '--dup-payloads', '--hand-rolled', '--build-gates', 'extra']) {
  reset();
  const before = fs.readFileSync(path.join(roots[1], 'tools/region-census.baseline.json'));
  const r = run(roots[1], ['--build-gates', option]);
  assert.strictEqual(r.status, 1);
  assert.strictEqual(r.stderr, 'region-census: --build-gates must be used alone (read-only build gates)\n');
  assert.deepStrictEqual(fs.readFileSync(path.join(roots[1], 'tools/region-census.baseline.json')), before);
}
// Every omission mutation must be rejected by a planted CLI violation.
for (let i = 0; i < gates.length; i++) {
  reset(); plants[i](roots[1]);
  const file = path.join(roots[1], 'tools/region-census.js');
  const text = fs.readFileSync(file, 'utf8');
  const ordered = "['js-copies', 'embedded-wat', 'dup-payloads', 'hand-rolled']";
  assert(text.includes(ordered));
  fs.writeFileSync(file, text.replace(ordered, JSON.stringify(gates.filter((_, j) => j !== i))));
  assert.strictEqual(run(roots[1], ['--build-gates']).status, 0, `omission control ${gates[i]} unexpectedly failed`);
  // The accepted runner must fail on the same unchanged reproducer.
  fs.copyFileSync(path.join(repo, 'tools/region-census.js'), file);
  assert.strictEqual(run(roots[1], ['--build-gates']).status, 1, `omission ${gates[i]} not caught`);
}
// Text is read afresh at each scanner boundary: a stale source mutation must
// fail the unchanged producer/consumer test below. This also exercises sources
// isolation and mutable returned-result isolation through the exported API.
reset();
const preload = path.join(out, 'between-gates.cjs');
fs.writeFileSync(preload, `const fs = require('fs'), path = require('path');
const read = fs.readFileSync;
fs.readFileSync = function(file, ...rest) {
  const text = read.call(this, file, ...rest);
  if (path.basename(String(file)) === 'host.js' && String(text).includes('const clean = 1;')) {
    fs.writeFileSync(file, ${JSON.stringify('const extraWat = `(func (i32.load (i32.const ' + (victim.base + 1) + ')))`;\n')});
  }
  return text;
};\n`);
const afterRead = independent(roots[0], ['--require', preload]);
assert.strictEqual(afterRead.status, 1);
assert.deepStrictEqual(normalized(run(roots[1], ['--build-gates'], ['--require', preload])), normalized(afterRead));
reset();
const staleFile = path.join(roots[1], 'tools/region-census.js');
const staleText = fs.readFileSync(staleFile, 'utf8');
fs.writeFileSync(staleFile, staleText.replace("const path = require('path');", `const path = require('path');
const unsafeRead = fs.readFileSync; let staleHost;
fs.readFileSync = function(file, ...rest) {
  if (path.basename(String(file)) === 'host.js') {
    return staleHost === undefined ? (staleHost = unsafeRead.call(this, file, ...rest)) : staleHost;
  }
  return unsafeRead.call(this, file, ...rest);
};`));
assert.strictEqual(run(roots[1], ['--build-gates'], ['--require', preload]).status, 0, 'stale-source mutation control');
fs.copyFileSync(path.join(repo, 'tools/region-census.js'), staleFile);
fs.writeFileSync(path.join(roots[1], 'host.js'), 'const clean = 1;\n');
assert.strictEqual(run(roots[1], ['--build-gates'], ['--require', preload]).status, 1, 'stale-source mutation rejected');
// Discovery stays independent too: a new file after the JS scan is visible
// to the embedded-WAT gate. The mutation deliberately freezes that discovery.
reset();
const discovery = path.join(out, 'directory-change.cjs');
fs.writeFileSync(discovery, `const fs=require('fs'),path=require('path'),read=fs.readFileSync;let once=false;
fs.readFileSync=function(file,...args){const text=read.call(this,file,...args);
if(!once&&path.basename(String(file))==='host.js'){once=true;
fs.writeFileSync(path.join(path.dirname(String(file)),'test/new.js'),${JSON.stringify('const extraWat=`(func (i32.load (i32.const ' + (victim.base + 1) + ')))`;\n')});}
return text;};\n`);
assert.strictEqual(run(roots[1], ['--build-gates'], ['--require', discovery]).status, 1);
fs.unlinkSync(path.join(roots[1], 'test/new.js'));
const discoveryFile = path.join(roots[1], 'tools/region-census.js');
let discoveryText = fs.readFileSync(discoveryFile, 'utf8').replace('function jsCopyTargets() {',
  'let unsafeTargets;\nfunction jsCopyTargets() {\n if (unsafeTargets) return unsafeTargets;');
const discoveryAt = discoveryText.indexOf('  return targets;', discoveryText.indexOf('function jsCopyTargets()'));
assert(discoveryAt > 0);
discoveryText = discoveryText.slice(0, discoveryAt) + discoveryText.slice(discoveryAt)
  .replace('  return targets;', '  return (unsafeTargets = targets);');
fs.writeFileSync(discoveryFile, discoveryText);
assert.strictEqual(run(roots[1], ['--build-gates'], ['--require', discovery]).status, 0, 'stale-directory control');
fs.unlinkSync(path.join(roots[1], 'test/new.js'));
fs.copyFileSync(path.join(repo, 'tools/region-census.js'), discoveryFile);
assert.strictEqual(run(roots[1], ['--build-gates'], ['--require', discovery]).status, 1, 'stale-directory mutation rejected');
fs.unlinkSync(path.join(roots[1], 'test/new.js'));
reset();
const api = require(path.join(roots[1], 'tools/region-census'));
assert.strictEqual(api.jsCopies().hits.length, 0);
plants[0](roots[1]);
assert(api.jsCopies().hits.some(h => h.file === 'host.js'));
const sourceMap = new Map([['host.js', `const bad = ${base};`]]);
const first = api.jsCopies({ sources: sourceMap });
assert.strictEqual(first.hits.length, 1); first.hits.length = 0;
assert.strictEqual(api.jsCopies({ sources: sourceMap }).hits.length, 1);
sourceMap.set('host.js', 'const clean = 1;');
assert.strictEqual(api.jsCopies({ sources: sourceMap }).hits.length, 0);

const build = fs.readFileSync(path.join(repo, 'tools/build.sh'), 'utf8');
const commands = build.split('\n').filter(l => /^node tools\/(region-census|gen-region-map)\.js/.test(l));
assert.deepStrictEqual(commands, ['node tools/region-census.js --gate', 'node tools/gen-region-map.js --check', 'node tools/region-census.js --build-gates']);
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ pass: true, victim: { name, base }, commands, invocations: results }, null, 2) + '\n');
console.log(`PASS: ${results.length} actual production CLI invocations; 15 violation combinations, guards, unavailable inputs, legacy/record/unsupported modes, omission controls and API isolation`);
