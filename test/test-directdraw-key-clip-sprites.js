#!/usr/bin/env node
'use strict';

// Real shipped WASM and published COM vtables; caller-owned guarded pixel storage.
// Default: regression for equal-size keyed/clipped Blt self-overlap.
// --frontier: diagnostic for known separate range/destination-key defects;
// intentionally exits nonzero until those semantics are implemented.
// RGNDATA valid lists never overlap; overlapping-list controls only preserve
// the emulator's existing extension, without claiming Windows conformance.
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
      const target=read(read(object)+slot*4);
      assert(target,'published COM method');
      const wa=(target-e.get_image_base()+e.get_guest_base())>>>0;
      const view=new DataView(memory.buffer);
      assert.equal(view.getUint32(wa,true),0xcaca0010,'public COM dispatch thunk');
      const names={0:'QueryInterface',2:'Release',4:'CreateClipper',5:'Blt',6:'CreateSurface',7:'SetClipList',20:'SetCooperativeLevel',25:'Lock',28:'SetClipper',29:'SetColorKey',32:'Unlock'};
      assert.equal(apis[view.getUint32(wa+4,true)].name.split('_').pop(),names[slot],'published slot identity');
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
    return {obj,base,pixels,pitch,size,bps, seed(salt=0) {
      fill(base,size+guard*2,0xa7);
      for(let y=0;y<height;y++) for(let x=0;x<width;x++) for(let b=0;b<bps;b++)
        e.guest_write8(pixels+y*pitch+x*bps+b,(1+y*29+x*11+b*47+salt)&255);
      return snapshot(base,size+guard*2);
    }};
  }

  const frontier = process.argv.includes('--frontier');
  const pixel = (bytes, at, bps) => bytes.slice(at,at+bps).reduce((n,v,i)=>(n+v*2**(8*i))>>>0,0);
  // Literal oracle controls: source keys exclude; destination keys admit writes.
  const allowed = (s,d,sk,dk) => (!sk || s<sk[0] || s>sk[1]) && (!dk || (d>=dk[0] && d<=dk[1]));
  assert.equal(allowed(3,9,[2,4],null),false);
  assert.equal(allowed(5,9,[2,4],[8,10]),true);
  assert.equal(allowed(5,7,null,[8,10]),false);
  function clipsFor(dst,clips) {
    if(!clips) { assert([0,0x88760238].includes(com(dst.obj,28,0))); return; }
    ok(com(dd,4,0,out,0)); const c=read(out), p=alloc(32+16*clips.length);
    fill(p,32+16*clips.length,0);
    [32,1,clips.length,16*clips.length,0,0,width,height,...clips.flat()].forEach((v,i)=>write(p+4*i,v));
    ok(com(c,7,p,0)); ok(com(dst.obj,28,c)); com(c,2);
    // SetClipList must own its copy, independent of later caller mutation.
    fill(p,32+16*clips.length,0xcc);
  }
  function check(dst,src,obj,dr,sr,name,clips,mode) {
    dst.seed(113); if(src!==dst)src.seed();
    if(frontier) for(const [surface,low] of [[src,32],[dst,64]]) {
      // Exercise below/low/interior/high/above endpoints at every pixel depth.
      // High 32-bit values also keep unsigned comparisons observable.
      const bias=surface.bps===4?0x80000000:0;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
        const value=bias+low-1+x;
        for(let b=0;b<surface.bps;b++)e.guest_write8(surface.pixels+y*surface.pitch+x*surface.bps+b,(value>>>(8*b))&255);
      }
    }
    const before=snapshot(dst.base,dst.size+guard*2);
    const source=src===dst?before:snapshot(src.base,src.size+guard*2), want=before.slice();
    const keyAt=guard+src.pitch+src.bps;
    const value=pixel(source,keyAt,src.bps), mask=src.bps===4?0xffffffff:2**(8*src.bps)-1;
    const range=mode==='range'||mode==='dest-range';
    const sk=mode==='source'||mode==='range'?[value, range?Math.min(mask,value+3):value]:null;
    const dv=pixel(before,keyAt,dst.bps);
    const dk=mode==='dest'||mode==='dest-range'?[dv,range?Math.min(mask,dv+3):dv]:null;
    if(sk||dk){const p=alloc(8), k=sk||dk;write(p,k[0]);write(p+4,k[1]);ok(com(sk?src.obj:dst.obj,29,(sk?8:2)|(range?1:0),p));}
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      if(x<dr[0]||x>=dr[2]||y<dr[1]||y>=dr[3])continue;
      if(clips&&!clips.some(r=>x>=r[0]&&x<r[2]&&y>=r[1]&&y<r[3]))continue;
      const sx=sr[0]+x-dr[0],sy=sr[1]+y-dr[1];
      if(sx<0||sx>=width||sy<0||sy>=height)continue;
      const si=guard+sy*src.pitch+sx*src.bps,di=guard+y*dst.pitch+x*dst.bps;
      if(!allowed(pixel(source,si,src.bps),pixel(before,di,dst.bps),sk,dk))continue;
      for(let b=0;b<dst.bps;b++)want[di+b]=source[si+b];
    }
    const hr=com(obj,5,rect(dr),src===dst?obj:src.obj,rect(sr),0x1000000|(sk?0x8000:0)|(dk?0x2000:0),0);
    ok(hr);
    const got=snapshot(dst.base,dst.size+guard*2), i=got.findIndex((v,i)=>v!==want[i]);
    if(i!==-1)failures.push({name,mode,bpp:dst.bps*8,hr,byte:i,actual:got[i],expected:want[i]});
    assert.deepEqual(got.slice(0,guard),before.slice(0,guard),'leading canary');
    assert.deepEqual(got.slice(guard+dst.size),before.slice(guard+dst.size),'trailing canary');
    if(src!==dst)assert.deepEqual(snapshot(src.base,src.size+guard*2),source,'source storage preserved');
    cases++;
  }
  for(const bpp of [8,16,24,32]) {
    const s=surface(bpp),other=surface(bpp);
    for(const [version,iid] of surfaceIids) {
      ok(com(s.obj,0,iid,out));const obj=read(out);
      // Valid RGNDATA is sorted and non-overlapping. The overlapping-list case
      // only preserves this implementation's accepted union extension.
      for(const [clipName,clips] of [
        ['none',null],['disjoint',[[0,0,3,2],[1,3,7,6]]],
        ['full',[[0,0,7,6]]],['overlapping-extension',[[0,0,5,4],[2,2,7,6]]],
      ]) {
        clipsFor(s,clips);
        for(const mode of frontier?['range','dest','dest-range']:['plain','source']) {
          for(const [name,dr,sr] of [
            ['right',[1,0,7,6],[0,0,6,6]], ['left',[0,0,6,6],[1,0,7,6]],
            ['down',[0,1,7,6],[0,0,7,5]], ['up',[0,0,7,5],[0,1,7,6]],
            ['down-right',[1,1,7,6],[0,0,6,5]], ['up-right',[1,0,7,5],[0,1,6,6]],
            ['identity',[0,0,7,6],[0,0,7,6]], ['disjoint',[0,4,7,6],[0,0,7,2]],
            ['clipped-down',[-1,1,6,7],[0,0,7,6]],
          ]) {
            if(frontier)continue; // isolate direction/range semantics from overlap
            if(!clips&&mode==='plain')continue; // predecessor already qualified this
            check(s,s,obj,dr,sr,version+'/'+clipName+'/'+name,clips,mode);
          }
          check(s,other,obj,[0,0,7,6],[0,0,7,6],version+'/'+clipName+'/distinct',clips,mode);
        }
      }
      ok(com(s.obj,28,0)); com(obj,2);
    }
    com(s.obj,2);com(other.obj,2);
  }
  com(dd,2);
  console.log(JSON.stringify({cases,calls,frontier,failures},null,2));
  assert.equal(failures.length,0,'exact pre-call source/destination pixels, padding and canaries');
  console.log('PASS shipped COM keyed and clipped sprite copies');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
