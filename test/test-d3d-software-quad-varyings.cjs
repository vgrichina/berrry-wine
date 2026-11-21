'use strict';
const assert = require('assert/strict');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "quad_varyings") (param $vm i32) (param $vertices i32) (param $weights i32) (param $mask i32)
      (call $d3d_software_quad_varyings (local.get $vm) (local.get $vertices)
        (i32.add (local.get $vertices) (i32.const 160)) (i32.add (local.get $vertices) (i32.const 320))
        (local.get $mask) (v128.load (local.get $weights)) (v128.load offset=16 (local.get $weights))
        (v128.load offset=32 (local.get $weights)) (v128.load offset=48 (local.get $weights))
        (v128.load offset=64 (local.get $weights))))
    (func (export "scalar_varying") (param $vertices i32) (param $weights i32) (param $offset i32) (param $lane i32) (result i32)
      (local.set $weights (i32.add (local.get $weights) (i32.shl (local.get $lane) (i32.const 2))))
      (i32.reinterpret_f32 (call $d3d_software_perspective
        (call $d3d_software_interp (local.get $vertices) (i32.add (local.get $vertices) (i32.const 160))
          (i32.add (local.get $vertices) (i32.const 320)) (local.get $offset)
          (f32.load (local.get $weights)) (f32.load offset=16 (local.get $weights)) (f32.load offset=32 (local.get $weights)))
        (f32.load offset=48 (local.get $weights)) (f32.load offset=64 (local.get $weights)))))
  ` });
  const alloc = n => e.guest_to_wasm(e.guest_alloc(n)) >>> 0;
  const vm = alloc(25000), vertices = alloc(480), weights = alloc(80);
  const u32 = new Uint32Array(memory.buffer), f32 = new Float32Array(memory.buffer);
  const bits = new Uint32Array(1);
  const values = [0, -0, 1, -1, 0.3, 1e-40, -1e-40, 3.4028234663852886e38, Infinity, -Infinity, NaN];
  let checks = 0;
  for (let trial = 0; trial < 33; trial++) {
    for (let vertex = 0; vertex < 3; vertex++)
      for (let j = 0; j < 32; j++) {
        const offset = j < 28 ? 16 + 4 * j : 144 + 4 * (j - 28);
        f32[(vertices + vertex * 160 + offset) / 4] = values[(trial + vertex * 3 + j) % values.length];
        if (Number.isNaN(f32[(vertices + vertex * 160 + offset) / 4]))
          u32[(vertices + vertex * 160 + offset) / 4] = vertex & 1 ? 0xffc00456 : 0x7f800123;
      }
    for (let lane = 0; lane < 4; lane++) {
      f32[weights / 4 + lane] = [0.25, -0.25, 0, 1][lane];
      f32[weights / 4 + 4 + lane] = [0.5, 0.75, -0, -1][lane];
      f32[weights / 4 + 8 + lane] = [0.25, 0.5, 1, 1][lane];
      const iw = values[(trial + lane) % values.length];
      f32[weights / 4 + 12 + lane] = iw;
      f32[weights / 4 + 16 + lane] = 1 / f32[weights / 4 + 12 + lane];
    }
    for (const mask of [-1, 0, 0x55555555, 0x80000001]) {
      e.quad_varyings(vm, vertices, weights, mask);
      for (let j = 0; j < 32; j++) {
        const bank = j < 4 ? 8224 + 16 * j : j < 28 ? 24608 + 16 * (j - 4) : 8288 + 16 * (j - 28);
        const offset = j < 28 ? 16 + 4 * j : 144 + 4 * (j - 28);
        for (let lane = 0; lane < 4; lane++) {
          bits[0] = (mask >>> j) & 1 ? e.scalar_varying(vertices, weights, offset, lane) : 0;
          const actual = u32[(vm + bank) / 4 + lane];
          assert.equal(actual, bits[0], `trial ${trial}, mask ${mask}, varying ${j}, lane ${lane}`);
          checks++;
        }
      }
    }
  }
  console.log(`PASS quad varying scalar equivalence: ${checks} lanes, signed zeros, subnormals, infinities, NaNs, mixed fallback, masks`);

  // Empty quads must not initialize a VM that will never execute. Poison both
  // disjoint banks before those quads, then let later covered quads execute:
  // their temps must be reset and their inputs refreshed, including helpers.
  const { Device } = require('../lib/d3d9-software-backend');
  let reference;
  for (const budget of [256, 1, 3]) {
    const device = new Device({ width: 16, height: 16, quadBudget: budget,
      getExports: () => e, getMemory: () => memory.buffer });
    const base = device.bytes, vertices = new Uint8Array(6 * 20), view = new DataView(vertices.buffer);
    [[0,0],[16,0],[0,16],[16,0],[16,16],[0,16]].forEach(([x,y], i) => {
      [x,y,.5,1].forEach((v,j) => view.setFloat32(i*20+j*4,v,true));
      vertices.set(i < 3 ? [0,0,255,255] : [0,255,0,255], i*20+16);
    });
    const command = { primitive: 4, primitiveCount: 2, stride: 20, vertices,
      attributes: [{register:0,usage:9,usageIndex:0,type:3,offset:0},
        {register:1,usage:10,usageIndex:0,type:4,offset:16}],
      vertexShader: null,
      pixelShader: new Uint32Array([0xffff0101,1,0x800f0000,0x90e40000,0xffff]),
      fixedFunction: {lighting:false,specular:false,fog:false,textureFactor:0xffffffff,
        stages:[{colorOp:2,colorArg1:0,colorArg2:1,alphaOp:2,alphaArg1:0,alphaArg2:1,
          constant:0xffffffff,texCoordIndex:0,transformFlags:0},{colorOp:1}]},
      state: {cull:1,zenable:false} };
    const draw = device.prepare(command);
    let status = 1, skipped = 0, steps = 0;
    while (status === 1) {
      const ctx = draw.context, vm = u32[(ctx+148)/4];
      // First triangle only; strict inequality excludes every covered/helper
      // boundary quad. One-unit stepping also checks the unchanged tile cost.
      const empty = budget === 1 && u32[(ctx+192)/4] && u32[(ctx+128)/4] === 0
        && u32[(ctx+132)/4] + u32[(ctx+136)/4] > 16;
      const offsets = [32, 8224, 24608];
      if (empty) for (const offset of offsets) u32.fill(0x3f400000,(vm+offset)/4,(vm+offset)/4+4);
      status = device.step(draw);
      assert(++steps < 1000);
      if (empty) {
        for (const offset of offsets)
          assert(u32.slice((vm+offset)/4,(vm+offset)/4+4).every(v => v === 0x3f400000),
            'empty quad skips temp and SIMD varying writes');
        skipped++;
      }
    }
    assert.equal(status, 0);
    if (budget === 1) assert(skipped > 0);
    device.completeDraw(draw);device.release(draw);
    const pixels = device.readPixels();
    assert.equal(device.lastDrawSamples, 256n, 'shared diagonal shaded exactly once');
    for (let i=0;i<pixels.length;i+=4)
      assert(pixels[i+2] === 0 && pixels[i+3] === 255 &&
        ((pixels[i+1] === 0 && pixels[i] === 255) || (pixels[i+1] === 255 && pixels[i] === 0)),
      `fresh colour after empty quads at ${i/4}: ${Array.from(pixels.slice(i,i+4))}`);
    if (reference) assert.deepEqual(pixels, reference, 'resume budget preserves ordering and pixels');
    else reference = pixels;
    assert.equal(device.bytes, base, 'draw-owned allocations released');
    device.destroy();
  }
  console.log('PASS empty quad work elision, subsequent temp/input reset, shared edge, budgets 1/3/256 and release');

  // A single draw changes edge directions repeatedly, including after a
  // degenerate and after clipping. The oracle evaluates the original f32
  // edge expression at integer pixel centers, independently of tile walking.
  const triangles = [
    [[0,0],[16,0],[0,16]], [[16,0],[16,16],[0,16]],
    [[1,1],[1,14],[14,1]], [[2,2],[13,2],[13,13]],
    [[-4,-2],[18,1],[3,18]], [[7,7],[7,7],[7,7]],
    [[0.00000011920928955078125,0],[16,16],[0,1]],
    [[2,2.000000238418579],[14,2],[2,14]],
    [[16,16],[0,16],[16,0]],
  ];
  const f = Math.fround;
  const edge = (a,b,x,y) => f(f(f(b[0]-a[0])*f(y-a[1])) - f(f(b[1]-a[1])*f(x-a[0])));
  const inside = (a,b,e) => e > 0 || (e === 0 && (b[1] < a[1] || (b[1] === a[1] && b[0] > a[0])));
  const expected = new Uint8Array(256);
  let expectedSamples = 0;
  for (let [a,b,c] of triangles) {
    const area = edge(a,b,c[0],c[1]);
    if (!area) continue;
    if (area < 0) [b,c] = [c,b];
    for (let y=0;y<16;y++) for (let x=0;x<16;x++)
      if (inside(b,c,edge(b,c,x,y)) && inside(c,a,edge(c,a,x,y)) && inside(a,b,edge(a,b,x,y))) {
        expected[y*16+x] = 1; expectedSamples++;
      }
  }
  for (const budget of [1,3,256]) {
    const device = new Device({width:16,height:16,quadBudget:budget,getExports:()=>e,getMemory:()=>memory.buffer});
    const base = device.bytes, vertices = new Uint8Array(triangles.length*3*20), view = new DataView(vertices.buffer);
    triangles.flat().forEach(([x,y],i)=>{
      [x,y,0.5,1].forEach((v,j)=>view.setFloat32(i*20+j*4,v,true));
      vertices.set([255,255,255,255],i*20+16);
    });
    device.clear([0,0,0,0],1);
    const draw = device.prepare({primitive:4,primitiveCount:triangles.length,stride:20,vertices,
      attributes:[{register:0,usage:9,usageIndex:0,type:3,offset:0},{register:1,usage:10,usageIndex:0,type:4,offset:16}],
      vertexShader:null,pixelShader:new Uint32Array([0xffff0101,1,0x800f0000,0x90e40000,0xffff]),
      fixedFunction:{lighting:false,specular:false,fog:false,textureFactor:0xffffffff,
        stages:[{colorOp:2,colorArg1:0,colorArg2:1,alphaOp:2,alphaArg1:0,alphaArg2:1,
          constant:0xffffffff,texCoordIndex:0,transformFlags:0},{colorOp:1}]},
      state:{cull:1,zenable:false}});
    vertices.fill(0); // caller storage is no longer the prepared snapshot
    let status = 1, steps = 0;
    while (status === 1) { status=device.step(draw); assert(++steps<2000); }
    assert.equal(status,0);device.completeDraw(draw);device.release(draw);
    assert.equal(device.lastDrawSamples,BigInt(expectedSamples),'exact edge ownership sample count');
    const pixels=device.readPixels();
    for(let i=0;i<256;i++) assert.equal(pixels[i*4+3]!==0,!!expected[i],`edge coverage ${i}, budget ${budget}`);
    assert.equal(device.bytes,base,'snapshot allocations released');device.destroy();
  }
  console.log('PASS edge ownership oracle, winding changes, clipped/degenerate geometry, adjacent f32 boundaries, snapshot lifetime and resume');
})().catch(error => { console.error(error); process.exitCode = 1; });
