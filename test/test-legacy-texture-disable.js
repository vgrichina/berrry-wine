#!/usr/bin/env node
'use strict';
// Reuse the authentic one-page WAT excerpt fixture. Nearby diagnostics are
// maintained explicitly in their own test, without runtime assertion removal.
const fs = require('fs'), path = require('path'), Module = require('module');
const file = path.join(__dirname, 'test-legacy-texture-operation-caps.js');
const source = fs.readFileSync(file, 'utf8');
const boundary = source.indexOf('\ntry {\n  const f = makeFixture(assembled);');
if (boundary < 0) throw Error('fixture boundary missing');
let probe;
if (process.argv.includes('--nearby')) {
  require(file);
  return;
} else {
  probe = String.raw`
// The mocked GPU lowering arm (the deleted JS executor lib/d3dim-gpu.js run on
// a WAT describe record) is gone; DISABLE through the WAT GPU stream producer
// is rendered by test-legacy-texture-operation-web.js --offline (gps).
function semanticReject(label,pattern,fn) {
  assert.throws(fn,e=>e instanceof assert.AssertionError && pattern.test(e.message),label);
  receipts.controls.push(label);
}
function disabled(f, checkPixels = true) {
  for (let stage=1;stage<8;stage++)
    assert.equal(f.e.d3dim_tss_load(4096,stage,1),1,'subsequent stages initialized disabled');
  for (const bound of [true,false]) for (const alpha of [1,2,3,4]) {
    f.dv.setUint32(4096+2824,bound?1:0,true);
    // Disabled stages do not evaluate even unsupported operands or color keys.
    for (const type of [2,3,5,6]) f.e.d3dim_set_tss(1,0,type,0x22);
    f.dv.setUint32(4096+420,1,true);
    f.dv.setUint32(8192+28,0x100,true);
    f.setOps(1,alpha);
    assert.equal(f.dv.getUint32(4096+2824,true),bound?1:0,'disabling must retain binding state');
    f.softwareUnbound(); // Both actual front ends must choose existing diffuse route.
    for (const bits of [0,256,512,768])
      assert.equal(f.e.d3dim_texture_stage_combine(tex,diffuse,1|bits,alpha|bits)>>>0,diffuse,
        'disable preserves incoming RGBA before independent operand selection');
    if (bound && checkPixels) {
      // Directly exercise the actual textured triangle/raster/span combiner as
      // well as production routing; unequal alpha and nonwhite texels matter.
      new Uint8Array(f.e.memory.buffer,32768,16).fill(0);
      f.e.d3dim_draw_tl_triangle_textured(1,24576,8192,0,20480,20512,20544);
      assert.equal(f.dv.getUint32(32768,true)>>>0,diffuse,'real software span disabled RGBA');
    }
  }
}
if (process.argv.includes('--baseline-software')) {
  const f=makeFixture(assembled);f.setOps(1,2);f.softwareOuter(diffuse);
} else {
  disabled(makeFixture(assembled));
  // Re-enable after DISABLE on the same object: the stored texture must still
  // participate, with independent diffuse alpha, through both real front ends.
  const resumed = makeFixture(assembled);
  resumed.setOps(1,2);
  resumed.softwareUnbound();
  resumed.setOps(2,3);
  resumed.softwareOuter(0x80c08040);
  receipts.controls.push('disable then re-enable retains bound texture and independent alpha');
  // Independent discriminating reversions: restore each actual old decision.
  const oldRoute = assembled.replace(
    '(if (i32.eq (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 1)) (i32.const 1))',
    '(if (i32.const 0)');
  assert.notEqual(oldRoute,assembled);
  semanticReject('old bound-texture route',/unbound routes to diffuse triangle/,()=>disabled(makeFixture(oldRoute)));
  const oldCombine = assembled.replace(
    '(if (i32.eq (i32.and (local.get $colorop) (i32.const 255)) (i32.const 1))',
    '(if (i32.const 0)');
  assert.notEqual(oldCombine,assembled);
  semanticReject('old disabled combiner',/disable preserves incoming RGBA/,()=>disabled(makeFixture(oldCombine)));
  receipts.status='PASS';
  console.log('PASS disabled stage: 8 bound/unbound alpha configurations, real span RGBA, both diffuse routes, 2 rejecting reversions');
}
if(process.env.LEGACY_DISABLE_RECEIPT) fs.writeFileSync(process.env.LEGACY_DISABLE_RECEIPT,JSON.stringify(receipts,null,2)+'\n');
`;
}
const m = new Module(file, module);
m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
m._compile(source.slice(0,boundary)+'\n'+probe,file);
