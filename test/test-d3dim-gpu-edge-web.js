#!/usr/bin/env node
'use strict';

// NFS III's cockpit tiles use integer screen edges and half-texel UVs.
// The excluded bottom edge must not wrap back to the opaque roof row.
const assert = require('assert');
const path = require('path');
const puppeteer = require('puppeteer');
const { startStaticServer, closeServer } = require('./static-server');

(async () => {
  const server = await startStaticServer({ root: path.join(__dirname, '..') });
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate(() => {
      const memory = new ArrayBuffer(0x10000), dv = new DataView(memory);
      const DESC = 0x1000, VERTS = 0x2000, CALL = 0x3000, DIB = 0x4000, TEX = 0x5000, RGBA = 0x6000;
      const desc = [0x7000, 8, 8, 16, 16, DIB, 1, 0x7100, 4, 4, 16, 8, TEX,
        0, 0, 0, 0, 4, 0, 1, 5, 6, 0, 0, 1, 1, 1, 1, 2, 5, 0, 0, 0, 0];
      desc.forEach((v, i) => dv.setUint32(DESC + i * 4, v, true));
      // White background; opaque black roof in row 0, transparent elsewhere.
      new Uint16Array(memory, DIB, 64).fill(0xffff);
      for (let x = 0; x < 4; x++) dv.setUint32(RGBA + x * 4, 0xff000000, true);
      const errors = [];
      const gpu = new D3DIMGpu.D3DIMGpu({
        getMemory: () => memory,
        getExports: () => ({ guest_to_wasm: x => x,
          d3dim_gpu_describe: () => DESC, d3dim_gpu_decode_texture: () => RGBA }),
        createCanvas: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
        onError: error => errors.push(error),
      });
      const vertices = [[0,0], [4,0], [4,4], [0,0], [4,4], [0,4]];
      vertices.forEach(([x,y], i) => {
        const p = VERTS + i * 32;
        [x,y,0,1].forEach((v,j) => dv.setFloat32(p+j*4,v,true));
        dv.setUint32(p+16,0xffffffff,true);
        dv.setFloat32(p+24,(x+0.5)/4,true);
        dv.setFloat32(p+28,(y+0.5)/4,true);
      });
      [1,4,3,VERTS,6].forEach((v,i)=>dv.setUint32(CALL+i*4,v,true));
      const taken = gpu.call(D3DIMGpu.OPCODES.DRAW, CALL);
      gpu.fence();
      const rows = Array.from({length:8},(_,y)=>dv.getUint16(DIB+y*16+2,true));
      return { taken, rows, errors, stats: gpu.snapshot() };
    });
    assert.strictEqual(result.taken, 1);
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.rows[0], 0, 'top edge belongs to the roof tile');
    assert.strictEqual(result.rows[4], 0xffff, 'bottom edge must not repeat the roof into the windshield');
    assert.strictEqual(result.rows[5], 0xffff, 'background below tile stays unchanged');
    console.log('PASS D3DIM textured tile excludes its bottom edge');
  } finally {
    await browser.close();
    await closeServer(server);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
