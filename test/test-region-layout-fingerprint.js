#!/usr/bin/env node

'use strict';

// The wasm and lib/region-map.generated.js are two halves of one memory map,
// and since wave 3 the bases in both are the region ALLOCATOR's output. Pair a
// shaken artifact with the canonical mirror and nothing fails: every host
// import reads guest memory at the address the mirror names, the guest wrote it
// somewhere else, and the app draws a plausible wrong picture — the worst
// possible failure mode, because it looks like a rendering bug.
// tools/region-shake-smoke.js pairs them on purpose; `run.js --wasm=shaken.wasm`
// with no $WINE_REGION_MAP did not, and had no way to notice.
//
// So both halves carry a fingerprint of the placement they were built for, and
// the hosts compare them at load. This covers the fingerprint itself and the
// wasm section it travels in; test/run.js's refusal is exercised end to end by
// the `--wasm=` mismatch check at the bottom, which is the actual hole.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const H = require('../tools/region-layout-hash.js');
const RegionMap = require('../lib/region-map.generated.js');

let checks = 0;
const check = (cond, what) => { assert.ok(cond, what); checks++; };

// Byte-only CLI preflight fixtures are independent of the compiler, built
// artifacts and guest binaries. The preload makes accidental engine/compiler
// use or process launches in the CLI fail, including on successful checks.
const fixtureDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'region-preflight-'));
try {
  const write = (name, bytes) => {
    const file = path.join(fixtureDir, name);
    fs.writeFileSync(file, bytes);
    return file;
  };
  const preload = write('no-engine.cjs', `
    const fail = () => { throw new Error('forbidden engine/compiler/app launch'); };
    for (const key of ['Module', 'Instance', 'compile', 'instantiate', 'validate', 'compileStreaming', 'instantiateStreaming']) WebAssembly[key] = fail;
    for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) require('child_process')[key] = fail;
    const Module = require('module'), load = Module._load;
    Module._load = function (id, ...args) {
      if (/region-layout\\.js|compile-wat|build-compile|test[\\/]run\\.js/.test(id)) fail();
      return load.call(this, id, ...args);
    };
  `);
  const header = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
  const hash = '0123456789abcdef', otherHash = 'fedcba9876543210';
  const stamped = write('stamped.wasm', H.appendSection(header, hash));
  const unstamped = write('unstamped.wasm', header);
  const matchingMirror = write('matching.cjs', `module.exports = { LAYOUT_HASH: '${hash}' };`);
  const otherMirror = write('other.cjs', `module.exports = { LAYOUT_HASH: '${otherHash}' };`);
  const cli = (args, envMirror) => {
    let status = 0, output;
    const env = { ...process.env };
    delete env.WINE_REGION_MAP;
    if (envMirror) env.WINE_REGION_MAP = envMirror;
    try {
      output = execFileSync(process.execPath, ['--require', preload,
        path.join(ROOT, 'tools/region-layout-hash.js'), ...args],
      { cwd: fixtureDir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      status = err.status;
      output = `${err.stdout || ''}${err.stderr || ''}`;
    }
    check(!/forbidden engine/.test(output), 'preflight does not compile/instantiate/launch');
    return { status, output };
  };
  const args = ['--check', `--wasm=${stamped}`];
  let result = cli([...args, `--mirror=${matchingMirror}`]);
  check(result.status === 0 && /layout MATCH/.test(result.output), 'explicit matching mirror succeeds');
  result = cli(args, matchingMirror);
  check(result.status === 0 && result.output.includes(matchingMirror), 'environment selects actual mirror');
  result = cli([...args, `--mirror=${matchingMirror}`], otherMirror);
  check(result.status === 0, 'explicit mirror overrides environment');
  result = cli(args, otherMirror);
  check(result.status === 1 && /MISMATCH/.test(result.output) &&
    result.output.includes(hash) && result.output.includes(otherHash) &&
    result.output.includes(stamped) && result.output.includes(otherMirror), 'mismatch names both files and hashes');
  const canonicalFixture = write('canonical.wasm', H.appendSection(header, RegionMap.LAYOUT_HASH));
  result = cli(['--check', `--wasm=${canonicalFixture}`]);
  check(result.status === 0 && result.output.includes(path.join(ROOT, 'lib/region-map.generated.js')),
    'no override selects repository mirror even from another working directory');
  result = cli(['--check', `--wasm=${unstamped}`, `--mirror=${matchingMirror}`]);
  check(result.status === 1 && /UNKNOWN/.test(result.output) && /UNSTAMPED/.test(result.output),
    'unstamped means unknown, never a compatibility pass');
  const unrelated = Buffer.concat([Buffer.from([0, 0x83, 1, 1, 120]), Buffer.alloc(129)]);
  const middle = write('middle.wasm', Buffer.concat([header, unrelated, H.encodeSection(hash), unrelated]));
  result = cli(['--check', `--wasm=${middle}`, `--mirror=${matchingMirror}`]);
  check(result.status === 0, 'walks multibyte lengths and finds stamp between unrelated sections');
  result = cli([`--wasm=${stamped}`]);
  check(result.status === 0 && result.output.trim() === hash, 'legacy stamp reporting is unchanged');
  result = cli([`--wasm=${unstamped}`]);
  check(result.status === 1 && /carries no/.test(result.output), 'legacy unstamped reporting is unchanged');

  const badFixtures = [
    Buffer.alloc(0), Buffer.from('not wasm'),
    Buffer.from([0, 97, 115, 109, 2, 0, 0, 0]),
    Buffer.concat([header, Buffer.from([0, 0x80])]),
    Buffer.concat([header, Buffer.from([0, 0xff, 0xff, 0xff, 0xff, 0x10])]),
    Buffer.concat([header, Buffer.from([0, 0x80, 0x80, 0x80, 0x80, 0x80, 0])]),
    Buffer.concat([header, Buffer.from([0, 5, 0])]),
    Buffer.concat([header, Buffer.from([0, 1, 5])]),
    Buffer.concat([header, Buffer.from([0, 0])]),
    Buffer.concat([header, Buffer.from([0, 2, 1, 0xff])]),
    Buffer.concat([header, Buffer.from([255, 0])]),
    H.appendSection(header, ''), H.appendSection(header, 'bad'),
    Buffer.concat([header, H.encodeSection(hash), H.encodeSection(hash)]),
    Buffer.concat([header, H.encodeSection(hash), Buffer.from([0, 0x80])]),
  ];
  for (const [i, bytes] of badFixtures.entries()) {
    result = cli(['--check', `--wasm=${write(`bad-${i}.wasm`, bytes)}`, `--mirror=${matchingMirror}`]);
    check(result.status === 2 && !/layout MATCH/.test(result.output), `malformed fixture ${i} is invalid input`);
  }
  const invalidMirror = write('invalid.cjs', 'module.exports = {};');
  for (const badArgs of [
    ['--check'], ['--check', '--wasm'], ['--check', '--wasm='],
    [...args, '--lines'], [...args, '--shake'], [...args, '--check'],
    [...args, '--unknown'], [...args, '--check=false'],
    [...args, '--mirror='], [`--mirror=${matchingMirror}`],
    [...args, `--mirror=${invalidMirror}`], [...args, '--mirror=missing.cjs'],
    ['--check', '--wasm=missing.wasm', `--mirror=${matchingMirror}`],
  ]) {
    result = cli(badArgs);
    check(result.status === 2, `invalid invocation is rejected: ${badArgs.join(' ')}`);
  }
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}

if (process.argv.includes('--preflight-only')) {
  console.log(`PASS byte-only region layout preflight (${checks} checks)`);
  process.exit(0);
}
const { layout } = require('../tools/region-layout.js');

// 1. The hash is a function of the PLACEMENT and nothing else: same regions in
//    a different order hash the same, one region moved hashes differently.
const regions = layout().regions;
const canonical = H.layoutHash(regions);
check(/^[0-9a-f]{16}$/.test(canonical), `the hash is 16 hex chars (got ${canonical})`);
check(H.layoutHash([...regions].reverse()) === canonical,
  'declaration order does not change the hash');

const moved = regions.map((r, i) => (i === 0 ? { ...r, base: (r.base + 0x1000) >>> 0 } : r));
check(H.layoutHash(moved) !== canonical, 'moving one region changes the hash');
const resized = regions.map((r, i) => (i === 0 ? { ...r, size: (r.size + 0x10) >>> 0 } : r));
check(H.layoutHash(resized) !== canonical, 'resizing one region changes the hash');
check(H.layoutHash(regions.slice(1)) !== canonical, 'dropping a region changes the hash');

// 2. A `$` on a name must not fork the hash — the tree spells region names both
//    ways and the two halves are computed by different callers.
check(H.layoutHash(regions.map(r => ({ ...r, name: `$${String(r.name).replace(/^\$/, '')}` })))
  === canonical, 'a leading $ on a name does not change the hash');

// 3. The section round-trips, and appending it leaves the module valid and
//    every other byte where it was — the point of using a custom section is
//    that it is inert.
const base = fs.readFileSync(path.join(ROOT, 'build', 'wine-assembly.wasm'));
const probe = H.appendSection(base, canonical);
check(H.readSection(probe) === canonical, 'the appended section reads back');
// STAMPING IS IDEMPOTENT. Re-stamping an already-stamped artifact with the same
// hash must reproduce it byte for byte, and with a different hash must REPLACE
// the old section rather than leave two — every reader takes the first, so a
// second section would make the check read the hash the module used to have.
check(probe.equals(base), 're-stamping with the same hash is byte-identical');
const restamped = H.appendSection(base, 'deadbeefdeadbeef');
check(H.readSection(restamped) === 'deadbeefdeadbeef', 'a different hash replaces the old one');
check(WebAssembly.Module.customSections(new WebAssembly.Module(restamped), H.SECTION_NAME).length === 1,
  're-stamping leaves exactly one wine-region-layout section');
new WebAssembly.Module(probe);
checks++;

// 4. WebAssembly.Module.customSections is the reader both hosts actually use
//    (it is the only one the browser has), so assert the encoder agrees with it
//    rather than only with our own parser.
const viaEngine = WebAssembly.Module.customSections(new WebAssembly.Module(probe), H.SECTION_NAME);
check(viaEngine.length === 1, 'the engine finds exactly one wine-region-layout section');
check(new TextDecoder().decode(viaEngine[0]) === canonical,
  'the engine reads the same hash our parser does');

// 5. THE SHIPPED PAIR AGREES. This is the standing assertion — a rebuilt
//    artifact beside a stale mirror, or the reverse, is caught here as well as
//    at run.js load.
const shipped = H.readSection(base);
check(shipped === RegionMap.LAYOUT_HASH,
  `build/wine-assembly.wasm (${shipped}) and lib/region-map.generated.js ` +
  `(${RegionMap.LAYOUT_HASH}) describe the same layout`);
check(shipped === canonical,
  `the shipped artifact matches the layout src/00-regions.wat places today (${canonical})`);
const compat = H.readSection(fs.readFileSync(path.join(ROOT, 'build', 'wine-assembly.compat.wasm')));
check(compat === shipped, 'the compat artifact carries the same layout hash');

// 6. AND THE HOST REFUSES A MISMATCHED PAIR. Everything above is arithmetic;
//    this is the behaviour the finding was about. Rewriting the stamp in a copy
//    of the artifact is a shaken build as far as the check is concerned, and is
//    seconds rather than the two full compiles a real shake costs.
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'region-fingerprint-'));
try {
  const stripped = base.subarray(0, base.length - H.encodeSection(canonical).length);
  check(H.readSection(stripped) === null, 'the stamp is the last section, and comes off cleanly');
  const wrong = path.join(tmp, 'wrong-layout.wasm');
  fs.writeFileSync(wrong, H.appendSection(stripped, '0123456789abcdef'));

  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, ['test/run.js', '--app=sol', '--max-batches=50',
      '--quiet-api', '--no-close', '--no-build', `--wasm=${wrong}`],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    code = err.status;
    out = `${err.stdout || ''}${err.stderr || ''}`;
  }
  check(code !== 0, `run.js REFUSES a wasm whose layout hash is not the mirror's (exit ${code})`);
  check(/region layout MISMATCH/.test(out), 'and says so in those words');
  check(out.includes('0123456789abcdef') && out.includes(RegionMap.LAYOUT_HASH),
    'naming BOTH hashes, so the reader knows which half to rebuild');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`PASS  the wasm and the JS mirror cannot be run as a mismatched pair ` +
  `(${checks} checks, layout ${canonical})`);
