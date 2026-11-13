#!/usr/bin/env node
'use strict';

// Real shipped WASM and published COM vtables; caller-owned guarded pixel storage.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createHostImports } = require('../lib/host-imports');
const regions = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');

(async () => {
  const modulePath = process.argv[2] || path.join(__dirname, '../build/wine-assembly.wasm');
  const wasm = fs.readFileSync(modulePath);
  console.log('module sha256', crypto.createHash('sha256').update(wasm).digest('hex'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  Object.assign(imports.host, { memory, create_thread: () => 0, exit_thread: () => 0,
    terminate_thread: () => 0, create_event: () => 0, set_event: () => 0,
    reset_event: () => 0, wait_single: () => 0, wait_multiple: () => 0,
    com_create_instance: () => 0x80004002 });
  const { instance: { exports: e } } = await WebAssembly.instantiate(wasm, imports);
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length));
  e.init_dx_com_thunks();
  const read = p => e.guest_read32(p) >>> 0;
  const write = (p, n) => e.guest_write32(p, n >>> 0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const snapshot = (p, n) => Array.from({ length: n }, (_, i) => e.guest_read8(p + i));
  const fill = (p, n, value) => { for (let i = 0; i < n; i++) e.guest_write8(p + i, value); };
  const stack = alloc(8192) + 4096;
  let calls = 0;
  function invoke(args, object, slot, target) {
    const code = [], word = n => code.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24);
    for (const arg of args.slice().reverse()) { code.push(0x68); word(arg); }
    if (object) {
      assert(read(read(object) + slot * 4), 'published COM method');
      code.push(0xb8); word(object);
      code.push(0x8b, 0x00, 0xff, 0x90); word(slot * 4);
    } else { code.push(0xb8); word(target); code.push(0xff, 0xd0); }
    const result = alloc(8);
    code.push(0xa3); word(result);
    code.push(0x89, 0x25); word(result + 4); code.push(0xc3);
    const pc = alloc(code.length);
    code.forEach((b, i) => e.guest_write8(pc + i, b));
    e.set_esp(stack); e.call_func(pc, 0, 0, 0, 0);
    for (let n = 0; n < 100 && e.get_eip(); n++) e.run(10000);
    assert.equal(e.get_eip(), 0, 'bounded guest return');
    assert.equal(read(result + 4), stack - 20, 'exact COM stdcall cleanup');
    assert.equal(e.get_esp() >>> 0, stack - 16, 'caller RET');
    calls++;
    return read(result);
  }
  const com = (obj, slot, ...args) => invoke([obj, ...args], obj, slot);
  const ok = hr => assert.equal(hr, 0);
  const guid = words => { const p = alloc(16); words.forEach((n, i) => write(p + i * 4, n)); return p; };
  const iid7 = guid([0x15e65ec0, 0x11d23b9c, 0x60002fb9, 0x5bea9797]);
  const surfaceIids = [
    [1, [0x6c14db81, 0x11cea733, 0x200021a5, 0x60e50baf]],
    [2, [0x57805885, 0x11cf6eec, 0x23a84194, 0x270ec103]],
    [3, [0xda044e00, 0x11d069b2, 0xaa00d5a1, 0xbbdfb800]],
    [4, [0x0b2b8630, 0x11d0ad35, 0x6000a68e, 0x5bea9797]],
    [7, [0x06675a80, 0x11d23b9b, 0x60002fb9, 0x5bea9797]],
  ].map(([v, words]) => [v, guid(words)]);
  const out = alloc(4), dv = new DataView(memory.buffer);
  const thunkWa = regions.BASE.THUNK_BASE;
  const thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
  const saved = dv.getUint32(thunkWa + 4, true);
  try {
    dv.setUint32(thunkWa + 4, apis.find(a => a.name === 'DirectDrawCreateEx').id, true);
    ok(invoke([0, out, iid7, 0], 0, 0, thunk));
  } finally { dv.setUint32(thunkWa + 4, saved, true); }
  const dd = read(out); assert(dd); ok(com(dd, 20, 0, 8));
  const width = 7, height = 6, guard = 32, failures = [];
  let cases = 0;
  const rect = values => { const p = alloc(16); values.forEach((v, i) => write(p + i * 4, v)); return p; };
  function surface(bpp) {
    const bps = bpp / 8, pitch = ((width * bps + 3) & ~3) + 8, size = pitch * height;
    const base = alloc(size + guard * 2), pixels = base + guard, desc = alloc(124);
    fill(base, size + guard * 2, 0xa7); fill(desc, 124, 0);
    for (const [o, v] of [[0,124],[4,0x180f],[8,height],[12,width],[16,pitch],[36,pixels],
      [72,32],[76,bpp === 8 ? 0x60 : 0x40],[84,bpp],
      [88,bpp === 16 ? 0xf800 : bpp === 8 ? 0 : 0xff0000],
      [92,bpp === 16 ? 0x7e0 : bpp === 8 ? 0 : 0xff00],
      [96,bpp === 16 ? 0x1f : bpp === 8 ? 0 : 0xff],[104,0x840]]) write(desc + o,v);
    ok(com(dd,6,desc,out,0)); const obj = read(out);
    write(desc,124); ok(com(obj,25,0,desc,1,0));
    assert.equal(read(desc+36),pixels); assert.equal(read(desc+16),pitch);
    ok(com(obj,32,0));
    return {obj,base,pixels,pitch,size,bps, seed() {
      fill(base,size+guard*2,0xa7);
      for(let y=0;y<height;y++) for(let x=0;x<width;x++) for(let b=0;b<bps;b++)
        e.guest_write8(pixels+y*pitch+x*bps+b,(1+y*29+x*11+b*47)&255);
      return snapshot(base,size+guard*2);
    }};
  }
  // Immutable-source coordinate oracle, deliberately independent of row traversal.
  function check(dst,src,obj,method,dr,sr,name,unchanged=false) {
    const before = dst.seed(), source = src === dst ? before : src.seed(), want = before.slice();
    if (!unchanged) for(let y=0;y<sr[3]-sr[1];y++) for(let x=0;x<sr[2]-sr[0];x++) {
      const tx=dr[0]+x, ty=dr[1]+y, sx=sr[0]+x, sy=sr[1]+y;
      if(tx<0||ty<0||tx>=width||ty>=height||sx<0||sy<0||sx>=width||sy>=height) continue;
      for(let b=0;b<dst.bps;b++) want[guard+ty*dst.pitch+tx*dst.bps+b]=source[guard+sy*src.pitch+sx*src.bps+b];
    }
    const sp=rect(sr), dp=rect(dr);
    const hr=method===5 ? com(obj,5,dp,src===dst?obj:src.obj,sp,0x1000000,0)
      : com(obj,7,dr[0],dr[1],src===dst?obj:src.obj,sp,0x10);
    ok(hr);
    const got=snapshot(dst.base,dst.size+guard*2);
    const mismatch=got.findIndex((v,i)=>v!==want[i]);
    if(mismatch!==-1) failures.push({name,method,bpp:dst.bps*8,hr,byte:mismatch,actual:got[mismatch],expected:want[mismatch]});
    if(src!==dst) assert.deepEqual(snapshot(src.base,src.size+guard*2),source,'source and canaries preserved');
    cases++;
  }
  for(const bpp of [8,16,24,32]) {
    const s=surface(bpp), other=surface(bpp);
    for(const [version,iid] of surfaceIids) {
      ok(com(s.obj,0,iid,out)); const obj=read(out);
      for(const method of [5,7]) for(const [name,dr,sr] of [
        ['identity',[0,0,7,6],[0,0,7,6]], ['right',[1,0,7,6],[0,0,6,6]],
        ['left',[0,0,6,6],[1,0,7,6]], ['down',[0,1,7,6],[0,0,7,5]],
        ['up',[0,0,7,5],[0,1,7,6]], ['down-right',[1,1,7,6],[0,0,6,5]],
        ['down-left',[0,1,6,6],[1,0,7,5]], ['up-right',[1,0,7,5],[0,1,6,6]],
        ['disjoint',[0,4,7,6],[0,0,7,2]],
      ]) check(s,s,obj,method,dr,sr,version+'/'+name);
      for(const [name,dr,sr] of [
        ['negative-origin',[-2,-1,5,5],[0,0,7,6]],
        ['right-bottom',[2,2,9,8],[0,0,7,6]],
        ['source-negative',[0,0,7,6],[-2,-1,5,5]],
      ]) check(s,other,obj,5,dr,sr,version+'/'+name);
      for(const [name,dr,sr] of [
        ['clipped-down',[-1,1,6,7],[0,0,7,6]],
        ['clipped-down-right',[1,1,8,7],[0,0,7,6]],
        ['source-clipped-down',[0,1,7,7],[-1,0,6,6]],
      ]) check(s,s,obj,5,dr,sr,version+'/'+name);
      // Extreme matching rectangles exercise signed subtraction and paired clipping
      // without stretching or requiring undocumented behavior for invalid input.
      for(const [dr,sr] of [
        [[-2147483648,0,2147483647,1],[-2147483648,0,2147483647,1]],
        [[0,-2147483648,1,2147483647],[0,-2147483648,1,2147483647]],
        [[2147483646,0,2147483647,1],[0,0,1,1]],
        [[0,2147483646,1,2147483647],[0,0,1,1]],
        [[3,1,2,3],[3,1,2,3]], [[1,3,3,2],[1,3,3,2]],
        [[2,2,2,4],[2,2,2,4]],
      ]) check(s,other,obj,5,dr,sr,version+'/signed-bounds',true);
      // Preserve the current bounded no-op compatibility behavior for requests
      // whose origins lie completely outside. BltFast's documented contract
      // excludes clipping; these are safety controls, not a native HRESULT claim.
      for(const [dr,sr] of [
        [[-2147483648,0,0,0],[0,0,1,1]],
        [[2147483647,0,0,0],[0,0,1,1]],
        [[0,2147483647,0,0],[0,0,1,1]],
        [[0,0,0,0],[-2147483648,0,2147483647,1]],
        [[0,0,0,0],[0,-2147483648,1,2147483647]],
        [[0,0,0,0],[2,2,2,4]],
      ]) check(s,other,obj,7,dr,sr,version+'/fast-signed-safety',true);
      com(obj,2);
    }
    com(s.obj,2); com(other.obj,2);
  }
  com(dd,2);
  console.log(JSON.stringify({cases,calls,failures},null,2));
  assert.equal(failures.length,0,'exact pixels, padding and allocation canaries');
  console.log('PASS shipped COM Blt/BltFast overlap, clipping and signed bounds at 8/16/24/32 bpp');
})().catch(error => { console.error(error.stack || error); process.exitCode=1; });

