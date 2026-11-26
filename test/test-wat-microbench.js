#!/usr/bin/env node
'use strict';

// tools/wat-microbench: every generated variant of a program computes the same
// guest work. Generates all modules; when wat2wasm (WABT) is on PATH or in
// $WAT2WASM, compiles each one and runs it in this node at a small size, and
// requires every variant of a program to return the control's checksum, and
// the `~copy` null-band module to be byte-identical to its control. Without
// wat2wasm only the generator's structure is checked.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { generate } = require('../tools/wat-microbench/gen.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wat-microbench-test-'));
const w2w = process.env.WAT2WASM || (spawnSync('sh', ['-c', 'command -v wat2wasm'], { encoding: 'utf8' }).stdout || '').trim() || null;

try {
  const manifest = generate(dir, { wat2wasm: w2w });
  const progs = {};
  for (const m of manifest) (progs[`${m.family}.${m.program}`] ||= []).push(m);
  assert.ok(Object.keys(progs).length >= 13, 'expected at least 13 programs');
  for (const [pk, ms] of Object.entries(progs)) {
    assert.strictEqual(ms.filter((m) => m.control).length, 1, `${pk}: exactly one control`);
    const copy = ms.find((m) => m.copyOf);
    assert.ok(copy, `${pk}: has a ~copy null-band module`);
    const ctl = ms.find((m) => m.control);
    assert.strictEqual(fs.readFileSync(path.join(dir, copy.id + '.wat'), 'utf8'), fs.readFileSync(path.join(dir, ctl.id + '.wat'), 'utf8'), `${pk}: copy is identical`);
    for (const m of ms) assert.ok(m.opsPerIter > 0 && m.kPerCall > 0, `${m.id}: work sizes`);
  }
  if (!w2w) {
    console.log(`test-wat-microbench: generator ok (${manifest.length} modules); wat2wasm not found, checksums not run`);
    process.exit(0);
  }
  let ran = 0;
  const skipped = [];
  for (const [pk, ms] of Object.entries(progs)) {
    let ref = null;
    for (const m of ms) {
      let r;
      try {
        const inst = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(dir, m.id + '.wasm'))), {});
        const k = Math.max(1, m.kPerCall >> 6);
        inst.exports.run(k);
        r = inst.exports.run(k) >>> 0;
      } catch (e) {
        // A feature this node lacks (e.g. memory64 on an old V8) is not a
        // generator bug; anything else is.
        if (/memory64|multi.?memory|invalid memory limits/i.test(String(e))) { skipped.push(m.id); continue; }
        throw new Error(`${m.id}: ${e}`);
      }
      if (ref === null) ref = r;
      assert.strictEqual(r, ref, `${m.id}: checksum ${r} != ${ref}`);
      ran++;
    }
  }
  console.log(`test-wat-microbench: ${ran} modules agree within their programs${skipped.length ? `; skipped ${skipped.join(',')}` : ''}`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
