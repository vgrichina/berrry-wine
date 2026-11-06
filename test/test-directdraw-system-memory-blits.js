#!/usr/bin/env node
'use strict';

// Public COM system-memory Blt qualification against the unmodified shipped
// module. Expected bytes use immutable source pixels and coordinate arithmetic.
// Microsoft semantics and measured boundary: docs/re-notes/kknd-system-memory-caps-20261106.md.
// Run --compat for the compat module; KKND_COM_TRACE=1 retains every ABI call.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const families = new Map();
const slots = {ddraw:{0:'QueryInterface',1:'AddRef',2:'Release',4:'CreateClipper',6:'CreateSurface',11:'GetCaps',20:'SetCooperativeLevel'},surface:{0:'QueryInterface',1:'AddRef',2:'Release',5:'Blt',7:'BltFast',22:'GetSurfaceDesc',25:'Lock',28:'SetClipper',29:'SetColorKey',32:'Unlock'},clipper:{2:'Release',7:'SetClipList'}};
const { bootRenderHarness } = require('./render-helper');
const regions = require('../lib/region-map.generated');
const apiTable = require('../src/api_table.json');
const arities = {QueryInterface:3,AddRef:1,Release:1,SetCooperativeLevel:3,CreateSurface:4,GetCaps:3,GetSurfaceDesc:2,Lock:5,Unlock:2,Blt:6,BltFast:6,SetClipper:2,CreateClipper:4,SetClipList:3,SetColorKey:3};
const methodArity = name => arities[name.split('_').pop()];
const POISON = 0xa5a5a5a5;
const trace = [];
const observations = [];
let moduleMeta = {};
const tailCalls = !process.argv.includes('--compat');

(async () => {
  const modulePath=process.env.KKND_MODULE||path.join(__dirname,'../build',tailCalls?'wine-assembly.wasm':'wine-assembly.compat.wasm');
  const moduleBytes = fs.readFileSync(modulePath);
  moduleMeta={module:modulePath,moduleBytes:moduleBytes.length,moduleSha256:crypto.createHash('sha256').update(moduleBytes).digest('hex'),engine:process.version};
  const compiled = await WebAssembly.compile(moduleBytes);
  const { exports: e, memory, module: instantiatedModule } = await bootRenderHarness({
    fonts: 'none', prebuiltModule: compiled, width: 997, height: 731,
  });
  assert.equal(instantiatedModule, compiled);
  const pe = fs.readFileSync(path.join(__dirname,'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length), 'PE initializes normal API and continuation thunks');
  e.init_dx_com_thunks();
  const read = p => e.guest_read32(p) >>> 0;
  const write = (p, n) => e.guest_write32(p, n >>> 0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const zero = (p, n) => { for (let i = 0; i < n; i += 4) write(p + i, 0); };
  const guard = n => {
    const base = alloc(n + 8), p = base + 4;
    for (let i = 0; i < n + 8; i += 4) write(base + i, POISON);
    return { p, check: () => {
      assert.strictEqual(read(base), POISON, 'leading output guard');
      assert.strictEqual(read(p + n), POISON, 'trailing output guard');
    } };
  };
  const guid = words => { const p = alloc(16); words.forEach((n, i) => write(p + 4 * i, n)); return p; };
  const iid7 = guid([0x15e65ec0, 0x11d23b9c, 0x60002fb9, 0x5bea9797]);
  const iid4 = guid([0x9c59509a, 0x11d139bd, 0xc0004a8c, 0xc530d94f]);
  const iid1 = guid([0x6c14db80, 0x11cea733, 0x200021a5, 0x60e50baf]);
  const iidSurface4 = guid([0x0b2b8630, 0x11d0ad35, 0x6000a68e, 0x5bea9797]);
  const iidSurface7 = guid([0x06675a80, 0x11d23b9b, 0x60002fb9, 0x5bea9797]);
  const iidUnknown = guid([0, 0, 0xc0, 0x46000000]);
  const iidTexture2 = guid([0x93281502, 0x11d08cf8, 0xa000ab89, 0x294105c9]);
  const iidSurface1 = guid([0x6c14db81, 0x11cea733, 0x200021a5, 0x60e50baf]);
  const iidSurface2 = guid([0x57805885, 0x11cf6eec, 0x23a84194, 0x270ec103]);
  const iidSurface3 = guid([0xda044e00, 0x11d069b2, 0xaa00d5a1, 0xbbdfb800]);
  const stack = alloc(8192) + 4096;
  const directDrawVersions = new Map(); // Published vtable -> independently acquired IID version.

  // Each operation executes PUSH arguments + indirect CALL from x86. No
  // handler/helper exports, seeded vtables, or synthetic surface records.
  // Unique code allocations avoid relying on guest code-cache invalidation.
  function invoke(label, args, object, slot, target) {
    const code = [], word = n => code.push(n & 255, (n >>> 8) & 255,
      (n >>> 16) & 255, n >>> 24);
    for (const arg of args.slice().reverse()) { code.push(0x68); word(arg); }
    let vtable = 0;
    if (object) {
      vtable = read(object); target = read(vtable + slot * 4);
      assert(vtable && target, `${label}: published vtable/slot`);
      // Check the published method against an independent COM ABI contract.
      // A wrong slot must not consume a different number of guest arguments.
      const targetWa = (target - e.get_image_base() + e.get_guest_base()) >>> 0;
      const thunkView = new DataView(memory.buffer);
      assert.strictEqual(thunkView.getUint32(targetWa, true), 0xcaca0010,
        `${label}: COM thunk marker`);
      const method = apiTable[thunkView.getUint32(targetWa + 4, true)];
      assert(method, `${label}: published API identity`);
      const family=families.get(object);assert(family, 'independently acquired interface family');
      assert.equal(method.name.split('_').pop(),slots[family][slot], 'independent published COM slot contract');
      assert.strictEqual(args.length, (method.name === 'IDirectDrawSurface_GetCaps' ? 2 : methodArity(method.name)),
        `${method.name}: COM argument count including this`);
      code.push(0xb8); word(object); // mov eax,this
      code.push(0x8b, 0x00, 0xff, 0x90); word(slot * 4); // call [vtable+slot]
    } else { code.push(0xb8); word(target); code.push(0xff, 0xd0); }
    const result = alloc(8);
    code.push(0xa3); word(result); // mov [result],eax
    code.push(0x89, 0x25); word(result + 4); // mov [result+4],esp
    code.push(0xc3);
    const pc = alloc(code.length + 4);
    code.forEach((b, i) => e.guest_write8(pc + i, b));
    e.set_esp(stack);
    e.call_func(pc, 0, 0, 0, 0);
    for (let n = 0; n < 100 && e.get_eip(); n++) e.run(10000);
    const row = { label, object, vtable, slot, target, result: read(result),
      esp: read(result + 4), finalEsp: e.get_esp() >>> 0, eip: e.get_eip() >>> 0 };
    trace.push(row);
    assert.strictEqual(row.eip, 0, `${label}: bounded guest completion`);
    assert.strictEqual(row.esp, stack - 20, `${label}: exact stdcall cleanup`);
    assert.strictEqual(row.finalEsp, stack - 16, `${label}: caller RET`);
    return row.result;
  }
  const com = (obj, slot, ...args) => invoke(`COM slot ${slot}`, [obj, ...args], obj, slot);
  const ok = (hr, label) => assert.strictEqual(hr, 0, label);
  const out = guard(4);
  // Catalog thunk routing exercises public dispatch, not PE IAT/EAT resolution.
  const thunkWa = regions.BASE.THUNK_BASE;
  const thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
  const dv = new DataView(memory.buffer), saved = dv.getUint32(thunkWa + 4, true);
  function api(name, ...args) {
    const entry = apiTable.find(a => a.name === name); assert(entry);
    try {
      dv.setUint32(thunkWa + 4, entry.id, true);
      return invoke(name, args, 0, null, thunk);
    } finally { dv.setUint32(thunkWa + 4, saved, true); }
  }
  ok(api('DirectDrawCreateEx', 0, out.p, iid7, 0), 'factory');
  out.check();
  const dd = read(out.p); assert(dd && dd !== POISON);
  directDrawVersions.set(read(dd), 7); families.set(dd,'ddraw');
  ok(com(dd, 20, 0, 8), 'DDSCL_NORMAL cooperative level');

  const check = (label, fn) => { try { fn(); observations.push({label, pass:true}); }
    catch(error) { observations.push({label, pass:false, error:error.message}); } };
  const rect = a => { const p=alloc(16); a.forEach((v,i)=>write(p+i*4,v)); return p; };
  function describe(obj) {
    const b=guard(124); write(b.p,124); ok(com(obj,22,b.p),'GetSurfaceDesc'); b.check(); return b.p;
  }
  function make(format, caps, external=false) {
    const {bpp,r=0,g=0,b=0,a=0}=format;
    const w=5,h=4,bps=bpp/8,pitch=((w*bps+3)&~3)+(external?8:0);
    const p=alloc(124); zero(p,124); write(p,124); write(p+4,0x1007|(external?0x808:0));
    write(p+8,h); write(p+12,w); write(p+72,32); write(p+76,bpp===8?0x60:a?0x41:0x40);
    write(p+84,bpp);write(p+88,r);write(p+92,g);write(p+96,b);write(p+100,a);
    write(p+104,0x40|caps);
    const backing=external?guard(pitch*h):null;
    if(external){write(p+16,pitch);write(p+36,backing.p);}
    ok(com(dd,6,p,out.p,0),'CreateSurface'); out.check(); const obj=read(out.p); families.set(obj,'surface');
    const d=describe(obj); assert.equal(read(d+84),bpp);assert.deepStrictEqual([88,92,96,100].map(o=>read(d+o)),[r,g,b,a]); assert.equal(read(d+104)&0x4800,caps);
    const l=guard(124); write(l.p,124); ok(com(obj,25,0,l.p,1,0),'Lock'); l.check();
    const actualPitch=read(l.p+16),data=read(l.p+36); assert(actualPitch>=w*bps);
    if(external){assert.equal(actualPitch,pitch);assert.equal(data,backing.p);}
    ok(com(obj,32,0),'Unlock');
    return {obj,bpp,bps,w,h,pitch:actualPitch,data,backing};
  }
  const bytes=s=>Array.from({length:s.pitch*s.h},(_,i)=>e.guest_read8(s.data+i));
  const seed=(s,k)=>{for(let i=0;i<s.pitch*s.h;i++)e.guest_write8(s.data+i,(i*37+k)&255);};
  function expected(dst,src,before,source,dr,sr,clip=null,key=null) {
    const want=before.slice();
    for(let y=0;y<dst.h;y++)for(let x=0;x<dst.w;x++){
      if(x<dr[0]||y<dr[1]||x>=dr[2]||y>=dr[3])continue;
      if(clip&&!clip.some(r=>x>=r[0]&&y>=r[1]&&x<r[2]&&y<r[3]))continue;
      const sx=sr[0]+Math.floor((x-dr[0])*(sr[2]-sr[0])/(dr[2]-dr[0]));
      const sy=sr[1]+Math.floor((y-dr[1])*(sr[3]-sr[1])/(dr[3]-dr[1]));
      if(sx<0||sy<0||sx>=src.w||sy>=src.h)continue;
      const offset=sy*src.pitch+sx*src.bps;
      const pixel=source.slice(offset,offset+src.bps).reduce((a,v,b)=>(a+v*2**(8*b))>>>0,0);
      if(key!==null&&pixel===key)continue;
      for(let b=0;b<dst.bps;b++)want[y*dst.pitch+x*dst.bps+b]=source[offset+b];
    }return want;
  }
  // Oracle controls have literal expected bytes, independent of production WAT.
  assert.deepStrictEqual(expected({w:3,h:1,pitch:4,bps:1},{w:3,h:1,pitch:4,bps:1},[9,9,9,99],[1,2,3,88],[1,0,3,1],[0,0,2,1]),[9,1,2,99]);
  for(const size of [316,364,380]){
    const hal=guard(size),hel=guard(size);write(hal.p,size);write(hel.p,size);
    ok(com(dd,11,hal.p,hel.p),'GetCaps');hal.check();hel.check();
    assert.equal(read(hal.p+4)&0x80000000,0,'CPU fixtures establish no hardware system-memory capability');
    assert.equal(read(hel.p+4)>>>31,1,'qualified system-memory Blt is available in HEL');
    for(const offset of [172,216,260]){
      assert.equal(read(hal.p+offset),0,'no directional hardware claim');
      assert.equal(read(hel.p+offset),0x40,'directional HEL promises ordinary Blt only');
      assert.equal(read(hel.p+offset+4),0,'no additional directional key capability claim');
      assert.equal(read(hel.p+offset+8),0,'no additional directional effect capability claim');
    }
    observations.push({label:'GetCaps',size,hal:read(hal.p+4),hel:read(hel.p+4),pass:true});
  }
  const formats=[{name:'indexed8',bpp:8},{name:'RGB565',bpp:16,r:0xf800,g:0x7e0,b:0x1f},{name:'RGB555',bpp:16,r:0x7c00,g:0x3e0,b:0x1f},{name:'ARGB1555',bpp:16,r:0x7c00,g:0x3e0,b:0x1f,a:0x8000},{name:'ARGB4444',bpp:16,r:0xf00,g:0xf0,b:0xf,a:0xf000},{name:'BGR24',bpp:24,r:0xff0000,g:0xff00,b:0xff},{name:'XRGB32',bpp:32,r:0xff0000,g:0xff00,b:0xff},{name:'ARGB32',bpp:32,r:0xff0000,g:0xff00,b:0xff,a:0xff000000}];
  for(const format of formats)for(const [direction,sc,dc,se,de] of [
    ['allocated-system-system',0x800,0x800,false,false],
    ['caller-system-video',0x800,0x4000,true,false],
    ['video-caller-system',0x4000,0x800,false,true],
    ['caller-system-system',0x800,0x800,true,true],
  ]){
    const bpp=format.bpp;const src=make(format,sc,se),dst=make(format,dc,de);
    for(const [name,dr,sr] of [
      ['whole',[0,0,5,4],[0,0,5,4]],['subrect',[1,1,4,3],[0,0,3,2]],
      ['edge-clip',[-1,-1,4,3],[0,0,5,4]],['stretch',[0,0,5,4],[1,1,4,3]],
    ])check(`${format.name}/${direction}/${name}`,()=>{
      seed(src,11);seed(dst,199);const before=bytes(dst),source=bytes(src);
      ok(com(dst.obj,5,rect(dr),src.obj,rect(sr),0x1000000,0),'Blt');
      assert.deepStrictEqual(bytes(dst),expected(dst,src,before,source,dr,sr));assert.deepStrictEqual(bytes(src),source);
      src.backing?.check();dst.backing?.check();
    });
    check(`${format.name}/${direction}/existing-extension-BltFast`,()=>{
      seed(src,11);seed(dst,199);const before=bytes(dst),source=bytes(src),sr=[0,0,3,2],dr=[1,1,4,3];
      ok(com(dst.obj,7,1,1,src.obj,rect(sr),0x10),'BltFast');assert.deepStrictEqual(bytes(dst),expected(dst,src,before,source,dr,sr));
    });
    function keyed(name,dr,sr,clips=null){check(`${format.name}/${direction}/${name}`,()=>{
      seed(src,11);seed(dst,199);const before=bytes(dst),source=bytes(src);
      const key=source.slice(0,src.bps).reduce((a,v,b)=>(a+v*2**(8*b))>>>0,0);
      const range=alloc(8);write(range,key);write(range+4,key);ok(com(src.obj,29,8,range),'SetColorKey');
      ok(com(dst.obj,5,rect(dr),src.obj,rect(sr),0x1008000,0),'keyed Blt');
      assert.deepStrictEqual(bytes(dst),expected(dst,src,before,source,dr,sr,clips,key));
      src.backing?.check();dst.backing?.check();
    });}
    keyed('source-key',[0,0,5,4],[0,0,5,4]);
    keyed('source-key-stretch',[0,0,5,4],[0,0,3,2]);
    // Explicit clip list is a public COM object with an independently owned ref.
    ok(com(dd,4,0,out.p,0),'CreateClipper');const clipper=read(out.p);families.set(clipper,'clipper');
    const clips=[[0,0,2,2],[3,2,5,4]],region=alloc(64);zero(region,64);
    write(region,32);write(region+4,1);write(region+8,2);write(region+12,32);
    [0,0,5,4].forEach((v,i)=>write(region+16+4*i,v));
    clips.flat().forEach((v,i)=>write(region+32+4*i,v));
    ok(com(clipper,7,region,0),'SetClipList');ok(com(dst.obj,28,clipper),'SetClipper');
    check(`${format.name}/${direction}/clip-list`,()=>{
      seed(src,11);seed(dst,199);const before=bytes(dst),source=bytes(src);
      ok(com(dst.obj,5,0,src.obj,0,0x1000000,0),'Blt clip-list');
      assert.deepStrictEqual(bytes(dst),expected(dst,src,before,source,[0,0,5,4],[0,0,5,4],clips));
    });
    keyed('source-key-clip-list',[0,0,5,4],[0,0,5,4],clips);
    check(`${format.name}/${direction}/BltFast-rejects-clipper`,()=>{
      const before=bytes(dst);
      assert.equal(com(dst.obj,7,0,0,src.obj,0,0x10),0x80004001,'DDERR_UNSUPPORTED with attached clipper');
      assert.deepStrictEqual(bytes(dst),before);
    });
    ok(com(dst.obj,28,0),'detach clipper');assert.equal(com(clipper,2),0,'clipper ref ownership');
    check(`${format.name}/${direction}/color-fill`,()=>{
      seed(dst,199);const before=bytes(dst),want=before.slice(),color=0x00563412;
      const fx=alloc(100);zero(fx,100);write(fx,100);write(fx+80,color);
      ok(com(dst.obj,5,rect([1,1,4,3]),0,0,0x400,fx),'color fill');
      for(let y=1;y<3;y++)for(let x=1;x<4;x++)for(let b=0;b<dst.bps;b++)want[y*dst.pitch+x*dst.bps+b]=(color>>>(8*b))&255;
      assert.deepStrictEqual(bytes(dst),want);dst.backing?.check();
    });
    for(const s of [src,dst])check(`${format.name}/${direction}/lifetime-${s===src?'source':'destination'}`,()=>{
      const snapshot=bytes(s);assert.equal(com(s.obj,1),2,'blits acquired no surface references');
      assert.equal(com(s.obj,2),1);assert.equal(com(s.obj,2),0);
      if(s.backing){s.backing.check();assert.deepStrictEqual(bytes(s),snapshot,'release leaves caller storage');}
    });
  }
  check('GetCaps rejects both NULL outputs',()=>assert.equal(com(dd,11,0,0),0x80070057));
  check('GetCaps rejects malformed second buffer atomically',()=>{
    const hal=guard(316),hel=guard(316);write(hal.p,316);write(hel.p,0);
    const beforeHal=Array.from({length:316/4},(_,i)=>read(hal.p+4*i));
    const beforeHel=Array.from({length:316/4},(_,i)=>read(hel.p+4*i));
    assert(com(dd,11,hal.p,hel.p)&0x80000000);hal.check();hel.check();
    assert.deepStrictEqual(Array.from({length:316/4},(_,i)=>read(hal.p+4*i)),beforeHal);
    assert.deepStrictEqual(Array.from({length:316/4},(_,i)=>read(hel.p+4*i)),beforeHel);
  });
  check('legacy DD1/Surface1 indexed caller-to-video ABI',()=>{
    ok(com(dd,0,iid1,out.p),'QI DD1');const legacy=read(out.p);families.set(legacy,'ddraw');
    const hal=guard(316),hel=guard(316);write(hal.p,316);write(hel.p,316);
    ok(com(legacy,11,hal.p,hel.p),'legacy size-316 GetCaps');hal.check();hel.check();
    assert.equal(read(hal.p+4)&0x80000000,0);
    assert.equal(read(hel.p+4)>>>31,1,'KKnD generation can admit demonstrated HEL support');
    const surfaces=[];
    for(const caller of [true,false]){
      const d=alloc(108);zero(d,108);write(d,108);write(d+4,0x1007|(caller?0x808:0));
      write(d+8,4);write(d+12,5);write(d+72,32);write(d+76,0x60);write(d+84,8);
      write(d+104,0x40|(caller?0x800:0x4000));
      const external=caller?guard(48):null;if(caller){write(d+16,12);write(d+36,external.p);}
      ok(com(legacy,6,d,out.p,0),'legacy CreateSurface');const obj=read(out.p); families.set(obj,'surface');
      const l=guard(108);write(l.p,108);ok(com(obj,25,0,l.p,1,0),'legacy Lock');l.check();
      const data=read(l.p+36),pitch=read(l.p+16);ok(com(obj,32,data),'legacy Unlock pointer');
      surfaces.push({obj,data,pitch,w:5,h:4,bps:1,backing:external});
    }
    const [src,dst]=surfaces;seed(src,11);seed(dst,199);const before=bytes(dst),source=bytes(src);
    ok(com(dst.obj,5,0,src.obj,0,0x1000000,0),'legacy indexed Blt');
    assert.deepStrictEqual(bytes(dst),expected(dst,src,before,source,[0,0,5,4],[0,0,5,4]));
    for(const s of surfaces){assert.equal(com(s.obj,2),0);s.backing?.check();}
    assert.equal(com(legacy,2),0);
  });
  assert.equal(com(dd,2),0,'factory lifetime');

  assert(observations.every(row=>row.pass),'system-memory matrix failures above');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;}).finally(()=>console.log(JSON.stringify({...moduleMeta,checks:observations.length,comCalls:trace.length,observations:process.env.KKND_COM_TRACE?observations:observations.filter(r=>!r.pass),trace:process.env.KKND_COM_TRACE?trace:undefined},null,2)));
