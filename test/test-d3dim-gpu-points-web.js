#!/usr/bin/env node
'use strict';
// Byte parity against the actual WAT POINTLIST software helpers, with WebGL1
// and WebGL2. No game fixture is needed. Compile only after acquiring runtime.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const puppeteer = require('puppeteer');
const extraWat = String.raw`
  (func (export "point_storage") (result i32)
    (call $g2w (call $heap_alloc (i32.const 4096))))
  (func (export "point_setup") (param $dib i32) (param $bpp i32) (param $fmt i32)
    (param $pitch i32) (param $clip i32) (param $l i32) (param $t i32) (param $r i32) (param $b i32)
    (store.field DxObject width (global.get $DX_OBJECTS) (i32.const 8))
    (store.field DxObject height (global.get $DX_OBJECTS) (i32.const 8))
    (store.field DxObject bpp (global.get $DX_OBJECTS) (local.get $bpp))
    (store.field DxObject pitch (global.get $DX_OBJECTS) (local.get $pitch))
    (store.field DxObject misc1 (global.get $DX_OBJECTS) (local.get $dib))
    (call $dx_surf_fmt_set (global.get $DX_OBJECTS) (local.get $fmt))
    (global.set $d3dim_clip_on (local.get $clip))
    (global.set $d3dim_clip_x0 (local.get $l)) (global.set $d3dim_clip_y0 (local.get $t))
    (global.set $d3dim_clip_x1 (local.get $r)) (global.set $d3dim_clip_y1 (local.get $b)))
  (func (export "point_software") (param $x f32) (param $y f32) (param $color i32)
    (call $viewport_fill_rect (global.get $DX_OBJECTS)
      (call $d3dim_coord_i (local.get $x)) (call $d3dim_coord_i (local.get $y))
      (i32.const 2) (i32.const 2) (local.get $color)))
`;
const points = [[-.51, 1.49, 0x00123456], [-.5, -.5, 0x804a92d3],
  [2.4999998, 3.5, 0xffd78129], [6.5, 6.5, 0x00336699],
  [2, 3, 0x00abcdef], ['NaN', 5, 0x00e13277], ['Infinity', 0, 0xff123456],
  [-1000001, -1000001, 0xff123456], [1000001, 1000001, 0xff123456]];
const cases = [];
for (const format of [1, 2, 3, 6]) for (const clip of [null, [1, 2, 7, 6]])
  for (const batchDraws of [false, true]) cases.push({ format, bpp: format === 6 ? 32 : 16,
    clip, batchDraws, points: points.map(([x,y,c]) => [x,y, format === 6 ? (c | 0xff000000) >>> 0 : c]) });
cases.push(...cases.filter(c => c.format === 1).map(c => ({ ...c, boundedReadback: false })));

(async () => {
  const native = await bootRenderHarness({ extraWat, fonts: 'none' });
  const wat = native.exports, dib = wat.point_storage(), all = new Uint8Array(native.memory.buffer);
  for (const c of cases) {
    c.pitch = 8 * c.bpp / 8 + 8; // Preserve row padding as well as untouched alpha.
    c.initial = Array.from({ length: c.pitch * 8 }, (_, i) => (i * 37 + 11) & 255);
    all.set(c.initial, dib);
    wat.point_setup(dib, c.bpp, c.format, c.pitch, c.clip ? 1 : 0, ...(c.clip || [0,0,8,8]));
    for (const [x, y, color] of c.points) wat.point_software(Number(x), Number(y), color);
    c.expected = Array.from(all.slice(dib, dib + c.pitch * 8));
  }
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const evidence = { browser: await browser.version(), cases, versions: [] };
    const page = await browser.newPage();
    for (const name of ['gpu-backend', 'd3d9-shader', 'd3d9-fixed', 'd3d9-backend', 'd3dim-gpu'])
      await page.addScriptTag({ path: path.join(__dirname, '../lib', name + '.js') });
    for (const version of [1, 2]) {
      const results = await page.evaluate(({ cases, version }) => cases.map(c => {
        const memory = new ArrayBuffer(65536), dv = new DataView(memory), u8 = new Uint8Array(memory);
        const desc = 4096, vertices = 8192, call = 12288, dib = 32768;
        const fields = [16384, 8, 8, c.bpp, c.pitch, dib, c.format,
          24576, 2, 2, 32, 8, 28672, 1, 0, 0, 1, 1, 1, 1, 5, 6, 4, 4, 1, 1, 1, 3, 1, 1, 255, 1, 0xff654321, 3,
          c.clip ? 1 : 0, ...(c.clip || [0,0,8,8])];
        fields.forEach((v, i) => dv.setUint32(desc + i * 4, v, true));
        u8.set(c.initial, dib);
        const errors = [], contexts = [];
        const gpu = new D3DIMGpu.D3DIMGpu({ getMemory: () => memory, batchDraws: c.batchDraws,
          boundedReadback: c.boundedReadback !== false,
          getExports: () => ({ d3dim_gpu_describe: () => desc, guest_to_wasm: a => a,
            d3dim_gpu_decode_texture: () => { throw new Error('POINTLIST decoded an ignored texture'); } }),
          createCanvas: (w,h) => {
            const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
            const get = canvas.getContext.bind(canvas);
            canvas.getContext = (kind, ...args) => {
              if (version === 1 && kind === 'webgl2') return null;
              const gl = get(kind, ...args); if (gl) contexts.push(gl); return gl;
            };
            return canvas;
          }, onError: e => errors.push(e) });
        const accepted = [];
        // Multi-point call plus single-point calls exercise independent draw
        // order, batching, and guest buffer reuse before the final fence.
        const draw = points => {
          [1,1,3,vertices,points.length].forEach((v,i) => dv.setUint32(call+i*4,v,true));
          points.forEach(([x,y,color],i) => {
            const p = vertices + i * 32;
            [Number(x),Number(y),NaN,-1].forEach((v,j) => dv.setFloat32(p+j*4,v,true));
            dv.setUint32(p+16,color,true);
          });
          accepted.push(gpu.call(D3DIMGpu.OPCODES.DRAW, call));
        };
        draw(c.points.slice(0,2));
        c.points.slice(2).forEach(p => draw([p]));
        u8.fill(255, vertices, vertices + 64);
        gpu.fence();
        const actual = Array.from(u8.slice(dib, dib + c.pitch * 8));
        const glErrors = contexts.map(gl => gl.getError());
        const actualVersion = contexts[0].getParameter(contexts[0].VERSION);
        const stats = gpu.snapshot(); gpu.stop();
        return { actual, accepted, errors, glErrors, actualVersion, stats };
      }), { cases, version });
      results.forEach((r, i) => {
        assert.deepEqual(r.errors, []); assert(r.accepted.every(v => v === 1));
        assert(r.glErrors.every(v => v === 0));
        assert(r.actualVersion.includes(`WebGL ${version}.0`), r.actualVersion);
        assert.deepEqual(r.actual, cases[i].expected, `WebGL${version} case${i} format${cases[i].format} exact WAT bytes`);
        assert.equal(r.stats.points, points.length);
      });
      const transitions = await page.evaluate(version => {
        const memory = new ArrayBuffer(65536), dv = new DataView(memory);
        const desc = 4096, vertices = 8192, call = 12288, dib = 32768;
        const set = (i,v) => dv.setUint32(desc + i * 4, v, true);
        [16384,8,8,16,16,dib,1].forEach((v,i) => set(i,v));
        set(16,1); set(17,2); set(18,1); set(20,5); set(21,6); set(27,1); set(28,2);
        const gpu = new D3DIMGpu.D3DIMGpu({ getMemory: () => memory,
          getExports: () => ({ d3dim_gpu_describe: () => desc, guest_to_wasm: a => a }),
          createCanvas: (w,h) => {
            const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
            const get = canvas.getContext.bind(canvas);
            canvas.getContext = (kind,...args) => version === 1 && kind === 'webgl2' ? null : get(kind,...args);
            return canvas;
          }, onError: e => { throw new Error(e); } });
        const draw = (primitive,color,z) => {
          const xy = primitive === 1 ? [[2,2]] : [[-10,-10],[30,-10],[-10,30]];
          [1,primitive,3,vertices,xy.length].forEach((v,i) => dv.setUint32(call+i*4,v,true));
          xy.forEach(([x,y],i) => {
            const p=vertices+i*32; [x,y,z,1].forEach((v,j)=>dv.setFloat32(p+j*4,v,true));
            dv.setUint32(p+16,color,true);
          });
          if (gpu.call(D3DIMGpu.OPCODES.DRAW,call) !== 1) throw new Error('transition draw rejected');
        };
        draw(4,0xffff0000,.25); // Establish near red geometry and its depth.
        draw(1,0xff0000ff,0); // Points ignore depth test/write: overwrite blue.
        draw(4,0xff00ff00,.5); // Far green still fails against original .25.
        gpu.fence(); const retained = dv.getUint16(dib+2*16+2*2,true);
        draw(4,0xff00ff00,.1); // Near green wins: depth state restored after point.
        gpu.fence(); const replaced = dv.getUint16(dib+2*16+2*2,true);
        set(16,0); set(18,0); set(19,1);
        draw(1,0x00ff0000,1); // Alpha zero still overwrites red, no blending.
        draw(4,0x000000ff,0); // Alpha-zero triangle must retain that red.
        gpu.fence(); const blendRestored = dv.getUint16(dib+2*16+2*2,true);
        const gl = gpu.targets.get(16384).device.gpu.gl, error = gl.getError();
        gpu.stop(); return { retained, replaced, blendRestored, error };
      }, version);
      assert.deepEqual(transitions, { retained: 31, replaced: 2016, blendRestored: 63488, error: 0 },
        `WebGL${version} points preserve depth and restore subsequent triangle blend/depth state`);
      evidence.versions.push({ version, results, transitions });
      if (process.env.POINTLIST_EVIDENCE)
        fs.writeFileSync(process.env.POINTLIST_EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
      console.log(`PASS WebGL${version}: ${results.length} exact native WAT point pixel cases; texture/depth/blend/fog/alpha ignored, clipping, overlap, batching, padding and neighboring alpha`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
