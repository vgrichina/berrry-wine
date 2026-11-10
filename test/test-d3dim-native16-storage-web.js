#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const puppeteer = require('puppeteer');

// A captured control is supplied by Git, never by rewriting the shared tree.
// Without NATIVE16_CONTROL, compare with the full-target storage path.
(async () => {
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  try {
    const results = [];
    for (const control of [true, false]) {
      const page = await browser.newPage();
      for (const name of ['gpu-backend', 'd3d9-shader', 'd3d9-fixed', 'render-clear', 'd3d9-backend'])
        await page.addScriptTag({ path: path.join(__dirname, '../lib', name + '.js') });
      const revision = control ? process.env.NATIVE16_CONTROL : process.env.NATIVE16_CANDIDATE;
      const source = revision
        ? cp.execFileSync('git', ['show', revision + ':lib/d3dim-gpu.js'], { encoding: 'utf8' })
        : fs.readFileSync(path.join(__dirname, '../lib/d3dim-gpu.js'), 'utf8');
      await page.addScriptTag({ content: source });
      results.push(await page.evaluate((full) => {
        const output = [];
        for (const version of [1, 2]) for (const format of [1, 2, 3, 4]) for (const batchDraws of [false, true]) {
          const width = 64, height = 48, pitch = width * 2 + 8;
          const memory = new ArrayBuffer(262144), dv = new DataView(memory), u8 = new Uint8Array(memory);
          const desc = 4096, vertices = 8192, call = 2048, rt = 65536, dib = 131072, clear = 3072;
          const set = (i, v) => dv.setUint32(desc + i * 4, v, true);
          [rt,width,height,16,pitch,dib,format].forEach((v,i) => set(i,v));
          set(17, 4); set(20, 5); set(21, 6); set(27, 1); set(28, 2);
          [width,height,16,pitch].forEach((v,i) => dv.setUint16(rt+12+i*2,v,true));
          dv.setUint32(rt+20,dib,true);
          for (let i = 0; i < pitch * height; i++) u8[dib+i] = (i * 73 + 19) & 255;
          const errors = [], copies = [], frames = [];
          const gpu = new D3DIMGpu.D3DIMGpu({ webglVersion: version, batchDraws,
            getMemory: () => memory, getExports: () => ({ guest_to_wasm: a => a,
              d3dim_gpu_describe: () => desc, d3dim_gpu_surface_fmt: () => format,
              d3dim_gpu_decode_texture: () => 98304 }),
            createCanvas: (w,h) => { const c = document.createElement('canvas'); c.width=w; c.height=h; return c; },
            onError: e => errors.push(e) });
          const store = gpu._storeNative16;
          let stores = 0, inject = false;
          gpu._storeNative16 = function(t, bounds) {
            stores++;
            const gl = t.device.gpu.gl;
            if (!gl.storageMeasured) {
              const copy = gl.copyTexSubImage2D.bind(gl);
              gl.copyTexSubImage2D = (...a) => { copies.push(a.slice(2)); return copy(...a); };
              gl.storageMeasured = true;
            }
            if (inject && --inject === 0) gl.enable(0xdead); // Real GL error at a bounded store.
            return store.call(this, t, full ? undefined : bounds);
          };
          const check = v => { if (v !== 1) throw Error('rejected: ' + errors.join(';')); };
          function draw(primitive = 4, uncertain = false) {
            const per = primitive === 4 ? 3 : primitive === 2 ? 2 : 1, count = per * 19;
            [1,primitive,3,vertices,count].forEach((v,i) => dv.setUint32(call+i*4,v,true));
            for (let n = 0; n < 19; n++) for (let k = 0; k < per; k++) {
              const p = vertices + (n*per+k)*32;
              const x = (n%5)*9-3.25, y = (n%4)*8-2.75;
              [x+(k===1?23:0),y+(k===2?21:0),n%3===0?.8:.2,
                uncertain && n%4===1 && k===0 ? -1 : (k+1)*.4].forEach((v,j) => dv.setFloat32(p+j*4,v,true));
              dv.setUint32(p+16, ((n*29+31)&255)*0x1000000 + ((n*0x1b3571+0x123456)&0xffffff), true);
              dv.setFloat32(p+24,k/2,true); dv.setFloat32(p+28,(n%3)/2,true);
            }
            check(gpu.call(D3DIMGpu.OPCODES.DRAW,call));
          }
          function snapshot() {
            check(gpu.fence());
            const t = gpu.targets.get(rt), g = t.device.gpu, gl = g.gl;
            g.bindImplicitTarget();
            const rgba = new Uint8Array(width*height*4);
            gl.readPixels(0,g.renderHeight-height,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
            if (gl.getError() !== gl.NO_ERROR) throw Error('read error');
            frames.push({ dib: Array.from(u8.slice(dib,dib+pitch*height)), rgba: Array.from(rgba) });
          }
          draw(); snapshot();
          // An arbitrary nonnative clear must be normalized even in gaps.
          [rt,3,0x71935a27].forEach((v,i) => dv.setUint32(clear+i*4,v,true));
          dv.setFloat32(clear+12,1,true);
          [0,0,width,height].forEach((v,i) => dv.setInt32(clear+16+i*4,v,true));
          check(gpu.call(D3DIMGpu.OPCODES.CLEAR,clear));
          set(19,1); draw(); draw(); draw(); snapshot();
          set(16,1); set(18,1); set(29,5); set(30,105); draw(); draw(); snapshot();
          set(34,1); [7,5,43,37].forEach((v,i) => set(35+i,v));
          set(20,7); set(21,8); draw(); draw(4,true); snapshot();
          // Textured alpha participates in overlapping native stores too.
          [70000,2,2,32,8,98304].forEach((v,i) => set(7+i,v));
          u8.set([19,83,171,45, 231,17,99,129, 57,197,33,203, 103,61,223,255],98304);
          set(22,4); set(23,4); set(41,2); set(42,0); set(43,2); set(44,0);
          set(24,3); set(25,3); set(45,2); set(46,2);
          draw(); draw(); snapshot();
          draw(2); if (format !== 4) draw(1); snapshot();
          const beforeFailure = stores;
          inject = 3; gpu.batchDraws = false;
          dv.setUint32(call+4,4,true); dv.setUint32(call+16,9,true);
          const rejected = gpu.call(D3DIMGpu.OPCODES.DRAW,call);
          inject = false;
          const stats = gpu.snapshot(); gpu.stop();
          output.push({version,format,batchDraws,frames,copies,stores,beforeFailure,rejected,stats,errors});
        }
        return output;
      }, control && !process.env.NATIVE16_CONTROL));
      await page.close();
    }
    const [baseline, candidate] = results;
    for (let i = 0; i < candidate.length; i++) {
      const a = baseline[i], b = candidate[i];
      assert.deepEqual(b.frames, a.frames, `exact native DIB and RGBA: ${b.version}/${b.format}/${b.batchDraws}`);
      assert.equal(b.stores, a.stores, 'retain every primitive store');
      assert.deepEqual(b.errors, a.errors, 'same GL failure');
      assert.equal(b.rejected, 0); assert.equal(b.stats.errors, 1);
      assert.equal(b.stores-b.beforeFailure,3,'stop at the failing primitive');
      const pixels = c => c.copies.reduce((n,a) => n+a[4]*a[5],0);
      assert(pixels(b) < pixels(a)*.65, 'bounded copies reduce actual converted area');
    }
    const summary = { passed: true, cases: candidate.length, snapshots: candidate.reduce((n,c)=>n+c.frames.length,0),
      baselinePixels: baseline.reduce((n,c)=>n+c.copies.reduce((s,a)=>s+a[4]*a[5],0),0),
      candidatePixels: candidate.reduce((n,c)=>n+c.copies.reduce((s,a)=>s+a[4]*a[5],0),0) };
    if (process.env.NATIVE16_RESULT) fs.writeFileSync(process.env.NATIVE16_RESULT, JSON.stringify({summary,baseline,candidate}));
    console.log(JSON.stringify(summary));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
