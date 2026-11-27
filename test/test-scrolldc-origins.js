'use strict';

// Contract: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-scrolldc
// Public PE import and GetProcAddress thunks; no private scroll entry points.
const assert = require('assert');
const fs = require('fs');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const bytes = process.env.SCROLLDC_ORIGINS_TEST_MODULE
    ? fs.readFileSync(process.env.SCROLLDC_ORIGINS_TEST_MODULE) : compileSrcWasm();
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none',
    prebuiltModule: new WebAssembly.Module(bytes) });
  const pe = makeFixture();
  // A real USER32 import descriptor in addition to dynamic resolution.
  const raw = rva => rva - 0x1000 + 0x200;
  pe.writeUInt32LE(60, 0x80 + 24 + 108);
  pe.writeUInt32LE(0x1b00, raw(0x1814));
  pe.writeUInt32LE(0x1b80, raw(0x1820));
  pe.writeUInt32LE(0x1b00, raw(0x1824));
  pe.write('user32.dll\0', raw(0x1b80));
  pe.writeUInt32LE(0x1bc0, raw(0x1b00));
  pe.write('ScrollDC\0', raw(0x1bc2));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => e.guest_alloc(n) >>> 0;
  const w = (p, v) => e.guest_write32(p, v);
  const r = p => e.guest_read32(p) | 0;
  const rect = (p, values) => values.forEach((v, i) => w(p + 4 * i, v));
  const readRect = p => [0, 4, 8, 12].map(o => r(p + o));
  const str = s => { const p = alloc(s.length + 1);
    Buffer.from(s + '\0').forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  const stack = alloc(4096) + 2048;
  let calls = 0, checks = 0;
  function call(entry, args) {
    w(stack, 0); args.forEach((v, i) => w(stack + 4 + i * 4, v));
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 64 && e.get_eip(); i++) e.run(64);
    assert.strictEqual(e.get_eip(), 0, 'guest returned');
    assert.strictEqual(e.get_esp() >>> 0, stack + 4 + args.length * 4, 'stdcall ESP');
    calls++; return e.get_eax() >>> 0;
  }
  const entries = {}, dlls = {};
  function api(name, ...args) {
    if (!entries[name]) {
      const dll = !/^(CreateWindowExA|GetDCEx|ClientToScreen|GetDC|GetWindowDC|ReleaseDC|DestroyWindow|ScrollDC|GetClientRect|ValidateRect|InvalidateRect|GetUpdateRgn|GetUpdateRect|BeginPaint|EndPaint|LockWindowUpdate)$/.test(name)
        ? 'gdi32.dll' : 'user32.dll';
      dlls[dll] ||= call(e.guest_read32(iat('LoadLibraryA')), [str(dll)]);
      entries[name] = call(e.guest_read32(iat('GetProcAddress')), [dlls[dll], str(name)]);
      assert(entries[name], name);
    }
    return call(entries[name], args);
  }
  const imported = e.guest_read32(0x401b00) >>> 0;
  assert(imported, 'public ScrollDC import resolves');
  assert.strictEqual(call(imported, [0, 0, 0, 0, 0, 0, 0]), 0, 'invalid HDC fails');
  assert.strictEqual(api('ScrollDC',0,0,0,0,0,0,0),0);

  // MM_TEXT: device = logical + viewport - window. dx/dy stay in
  // device units; exact HRGN and prcUpdate remain client/device coordinates.
  const hwnd=api('CreateWindowExA',0,str('STATIC'),str('origins'),0x90000000,23,31,40,32,0,0,0x400000,0);
  const child=api('CreateWindowExA',0,str('STATIC'),str('child'),0x50000000,7,5,16,14,hwnd,100,0x400000,0);
  const childDC=api('GetDC',child),memoryDC=api('CreateCompatibleDC',childDC);
  const bitmap=api('CreateCompatibleBitmap',childDC,16,14),oldBitmap=api('SelectObject',memoryDC,bitmap);
  assert(hwnd&&child&&childDC&&memoryDC&&bitmap);
  const input=alloc(16),clip=alloc(16),output=alloc(24),box=alloc(16),data=alloc(8192),point=alloc(8),damage=alloc(16);
  const region=api('CreateRectRgn',91,92,97,99),retained=api('CreateRectRgn',0,0,0,0),update=api('CreateRectRgn',0,0,0,0);
  const app=api('CreateRectRgn',1,1,15,13),hole=api('CreateRectRgn',6,4,9,9);
  assert(api('CombineRgn',app,app,hole,4));
  const origin=(dc,v,wnd)=>{assert(api('SetViewportOrgEx',dc,...v,0));assert(api('SetWindowOrgEx',dc,...wnd,0));};
  // The first translated public call must fail on the strict 730b baseline.
  origin(memoryDC,[3,2],[0,0]);rect(input,[0,0,10,10]);
  assert.strictEqual(api('ScrollDC',memoryDC,2,3,input,0,region,output),1,'translated MM_TEXT public baseline');
  origin(memoryDC,[0,0],[0,0]);
  rect(point,[0,0]);assert(api('ClientToScreen',child,point));
  const [sx,sy]=readRect(point);
  const system=api('CreateRectRgn',sx,sy,sx+16,sy+14),systemHole=api('CreateRectRgn',sx+3,sy+3,sx+5,sy+8);
  assert(api('CombineRgn',system,system,systemHole,4));api('DeleteObject',systemHole);
  const systemDC=api('GetDCEx',child,system,0x82);assert(systemDC);
  const inside=(a,x,y)=>x>=a[0]&&y>=a[1]&&x<a[2]&&y<a[3];
  const color=(x,y)=>0x110000+y*256+x;
  const bounds=points=>points.length?[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),
    Math.max(...points.map(p=>p[0]))+1,Math.max(...points.map(p=>p[1]))+1]:[0,0,0,0];
  const mappings=[[[3,2],[0,0]],[[-3,-2],[0,0]],[[0,0],[3,2]],[[0,0],[-3,-2]],
    [[4,-3],[-2,1]],[[-4,3],[2,-1]],[[3,-2],[3,-2]]];
  const scenarios=[...[[2,0],[-2,0],[0,3],[0,-3],[2,3],[-2,-3],[2,-3],[-2,3],[0,0]].map(d=>({s:[1,1,12,10],c:[0,0,14,12],d})),
    {s:null,c:null,d:[-2,3]},{s:null,c:[1,2,12,11],d:[2,-3]},
    {s:[1,1,12,10],c:null,d:[2,3]}, {s:[12,2,2,10],c:null,d:[2,3]},
    {s:[1,1,12,10],c:[20,20,25,25],d:[-2,-3]}];
  let cases=0;
  for(const [kind,dc,readDC] of [['memory',memoryDC,memoryDC],['child',childDC,childDC],['system',systemDC,childDC]])
    for(const [v,wnd] of mappings)for(const scenario of scenarios)for(const selected of [false,true])for(const outputs of [0,1,2,3,4,5]) {
      const label=kind+'/'+cases++;
      api('SelectClipRgn',dc,0);origin(dc,[0,0],[0,0]);origin(readDC,[0,0],[0,0]);
      for(let y=0;y<14;y++)for(let x=0;x<16;x++)api('SetPixel',readDC,x,y,color(x,y));
      api('ValidateRect',child,0);rect(damage,[0,12,1,13]);api('InvalidateRect',child,damage,1);api('GetUpdateRgn',child,update,0);
      if(selected)assert(api('SelectClipRgn',dc,app));
      origin(dc,v,wnd);const saved=api('SaveDC',dc);assert(saved);
      rect(input,scenario.s||[0,0,16,14]);rect(clip,scenario.c||[0,0,16,14]);
      rect(output,[71,72,73,74]);w(output+16,0x76543210);api('SetRectRgn',region,91,92,97,99);
      const outPtr=outputs===4?input:outputs===5?clip:outputs&2?output:0,outRgn=outputs&1||outputs>=4?region:0;
      assert.strictEqual(api('ScrollDC',dc,...scenario.d,scenario.s?input:0,scenario.c?clip:0,outRgn,outPtr),1,label+' BOOL');
      const tx=v[0]-wnd[0],ty=v[1]-wnd[1],map=a=>a?[a[0]+tx,a[1]+ty,a[2]+tx,a[3]+ty]:[0,0,16,14];
      const s=map(scenario.s),c=map(scenario.c),source=(x,y)=>inside([0,0,16,14],x,y)&&inside(s,x,y);
      const visible=(x,y)=>(!selected||(inside([1,1,15,13],x,y)&&!inside([6,4,9,9],x,y)))&&
        (kind!=='system'||!inside([3,3,5,8],x,y));
      const expected=[],copied=[];
      for(let y=0;y<14;y++)for(let x=0;x<16;x++) {
        const affected=source(x,y)&&inside(c,x,y)&&visible(x,y),moved=source(x-scenario.d[0],y-scenario.d[1]);
        if(affected&&!moved)expected.push([x,y]);copied.push(affected&&moved);
        if(outRgn)assert.strictEqual(!!api('PtInRegion',region,x,y),affected&&!moved,label+' device exposure');
      }
      if(outPtr)assert.deepStrictEqual(readRect(outPtr),bounds(expected),label+' client RECT');
      else assert.deepStrictEqual(readRect(output),[71,72,73,74]);
      assert.strictEqual(r(output+16),0x76543210);
      if(outRgn){assert(api('GetRegionData',region,8192,data));const bands=Array.from({length:r(data+8)},(_,i)=>readRect(data+32+i*16));
        assert.deepStrictEqual(readRect(data+16),bounds(expected));
        for(let y=-1;y<=14;y++)for(let x=-1;x<=16;x++)assert.strictEqual(bands.some(a=>inside(a,x,y)),expected.some(p=>p[0]===x&&p[1]===y),label+' bands');
      }else{api('GetRgnBox',region,box);assert.deepStrictEqual(readRect(box),[91,92,97,99]);}
      assert.strictEqual(api('GetClipRgn',dc,retained),selected?1:0);if(selected)assert.strictEqual(api('EqualRgn',retained,app),1);
      assert.strictEqual(api('GetUpdateRgn',child,retained,0),2);assert.strictEqual(api('EqualRgn',retained,update),1);
      // ScrollDC cannot consume a save frame or change the mapping state.
      api('GetViewportOrgEx',dc,point);assert.deepStrictEqual([r(point),r(point+4)],v);
      api('GetWindowOrgEx',dc,point);assert.deepStrictEqual([r(point),r(point+4)],wnd);
      origin(dc,[8,9],[-1,-2]);api('SelectClipRgn',dc,0);assert(api('RestoreDC',dc,saved));
      api('GetViewportOrgEx',dc,point);assert.deepStrictEqual([r(point),r(point+4)],v);
      api('GetWindowOrgEx',dc,point);assert.deepStrictEqual([r(point),r(point+4)],wnd);
      assert.strictEqual(api('GetClipRgn',dc,retained),selected?1:0);if(selected)assert.strictEqual(api('EqualRgn',retained,app),1);
      api('SelectClipRgn',dc,0);origin(dc,[0,0],[0,0]);
      for(let y=0;y<14;y++)for(let x=0;x<16;x++) {
        assert.strictEqual(api('GetPixel',readDC,x,y),copied[y*16+x]?color(x-scenario.d[0],y-scenario.d[1]):color(x,y),label+' overlap pixel '+x+','+y);checks++;
      }
    }
  function failure(dc,dx,dy,s,c,h,label) {
    const before=[];const save=api('SaveDC',dc);assert(save);origin(dc,[0,0],[0,0]);api('SelectClipRgn',dc,0);
    for(let y=0;y<14;y++)for(let x=0;x<16;x++)before.push(api('GetPixel',dc,x,y));
    assert(api('RestoreDC',dc,save));rect(output,[71,72,73,74]);api('SetRectRgn',region,91,92,97,99);
    api('GetUpdateRgn',child,update,0);
    assert.strictEqual(api('ScrollDC',dc,dx,dy,s,c,h,output),0,label);
    assert.deepStrictEqual(readRect(output),[71,72,73,74]);api('GetRgnBox',region,box);assert.deepStrictEqual(readRect(box),[91,92,97,99]);
    api('GetUpdateRgn',child,retained,0);assert.strictEqual(api('EqualRgn',retained,update),1);
    const saved=api('SaveDC',dc);assert(saved);origin(dc,[0,0],[0,0]);api('SelectClipRgn',dc,0);
    for(let y=0;y<14;y++)for(let x=0;x<16;x++)assert.strictEqual(api('GetPixel',dc,x,y),before[y*16+x],label+' atomic pixels');
    assert(api('RestoreDC',dc,saved));
  }
  origin(memoryDC,[3,2],[0,0]);rect(input,[-1,0,9,8]);rect(clip,[-3,-2,13,12]);
  failure(memoryDC,2,3,input,clip,0xdead,'invalid HRGN');
  for(const a of [0x7fffffff,-0x80000000,1048577,-1048577]){
    failure(memoryDC,a,3,input,clip,region,'extreme dx');failure(memoryDC,2,a,input,clip,region,'extreme dy');
    for(const index of [0,1,2,3])for(const p of [input,clip]){const old=readRect(p);w(p+4*index,a);failure(memoryDC,2,3,input,clip,region,'extreme RECT');rect(p,old);}
    for(const which of [0,1]){origin(memoryDC,which?[3,2]:[a,2],which?[a,0]:[0,0]);failure(memoryDC,2,3,input,clip,region,'extreme origin');}
    origin(memoryDC,[3,2],[0,0]);
  }
  origin(memoryDC,[0x7fffffff,-0x80000000],[0x7fffffff,-0x80000000]);
  failure(memoryDC,2,3,input,clip,region,'canceling extreme origins');
  origin(memoryDC,[1048576,0],[-1048576,0]);failure(memoryDC,2,3,input,clip,region,'translation exceeds bound');
  origin(memoryDC,[1048576,0],[0,0]);failure(memoryDC,2,3,input,clip,region,'translated RECT exceeds bound');
  origin(memoryDC,[3,2],[0,0]);
  origin(memoryDC,[0,0],[0,0]);api('SetMapMode',memoryDC,8);
  assert.strictEqual(api('ScrollDC',memoryDC,0,0,input,clip,region,output),1,'published zero-origin identity mode retained');
  origin(memoryDC,[3,2],[0,0]);failure(memoryDC,2,3,input,clip,region,'non-MM_TEXT translation unsupported');
  api('SetMapMode',memoryDC,8);api('SetViewportExtEx',memoryDC,2,3,0);failure(memoryDC,2,3,input,clip,region,'scale unsupported');
  api('SetMapMode',memoryDC,1);origin(memoryDC,[3,2],[0,0]);
  const nc=api('GetWindowDC',child);assert(nc);failure(nc,2,3,input,clip,region,'nonclient unsupported');api('ReleaseDC',child,nc);
  const lockBefore=[];for(let y=0;y<14;y++)for(let x=0;x<16;x++)lockBefore.push(api('GetPixel',childDC,x,y));
  api('GetUpdateRgn',child,update,0);
  origin(childDC,[3,2],[0,0]);assert(api('LockWindowUpdate',child));
  rect(output,[71,72,73,74]);assert.strictEqual(api('ScrollDC',childDC,2,3,input,clip,region,output),0,'locked unsupported');
  assert.deepStrictEqual(readRect(output),[71,72,73,74]);assert(api('LockWindowUpdate',0));origin(childDC,[0,0],[0,0]);
  for(let y=0;y<14;y++)for(let x=0;x<16;x++)assert.strictEqual(api('GetPixel',childDC,x,y),lockBefore[y*16+x],'locked pixels');
  api('GetUpdateRgn',child,retained,0);assert.strictEqual(api('EqualRgn',retained,update),1,'locked damage state');
  const held=[];let h;while((h=api('CreateRectRgn',0,0,0,0)))held.push(h);
  for(let free=0;free<3;free++){if(free)assert(api('DeleteObject',held.pop()));
    // No SaveDC in this scope: its clip snapshot itself can require a HRGN.
    rect(output,[71,72,73,74]);api('SetRectRgn',region,91,92,97,99);
    const before=[];origin(memoryDC,[0,0],[0,0]);for(let y=0;y<14;y++)for(let x=0;x<16;x++)before.push(api('GetPixel',memoryDC,x,y));
    origin(memoryDC,[3,2],[0,0]);assert.strictEqual(api('ScrollDC',memoryDC,2,3,input,clip,region,output),0,'capacity '+free);
    assert.strictEqual(api('ScrollDC',memoryDC,2,3,input,clip,region,0),0,'HRGN-only capacity '+free);
    assert.strictEqual(api('ScrollDC',memoryDC,2,3,input,clip,0,output),0,'RECT-only capacity '+free);
    assert.deepStrictEqual(readRect(output),[71,72,73,74]);api('GetRgnBox',region,box);assert.deepStrictEqual(readRect(box),[91,92,97,99]);
    origin(memoryDC,[0,0],[0,0]);for(let y=0;y<14;y++)for(let x=0;x<16;x++)assert.strictEqual(api('GetPixel',memoryDC,x,y),before[y*16+x]);
    origin(memoryDC,[3,2],[0,0]);assert.strictEqual(api('ScrollDC',memoryDC,0,0,input,clip,0,0),1,'no output no allocation');
  }held.forEach(h=>assert(api('DeleteObject',h)));
  assert.strictEqual(api('ScrollDC',memoryDC,2,3,input,clip,region,output),1,'allocation recovery');
  // Caller HRGN can be the original selected clip handle: SelectClipRgn owns
  // its copy, while ScrollDC replaces only the caller's output region.
  assert(api('SelectClipRgn',memoryDC,app));assert.strictEqual(api('ScrollDC',memoryDC,2,3,input,clip,app,output),1);
  assert.strictEqual(api('GetClipRgn',memoryDC,retained),1);assert(api('PtInRegion',retained,12,10));assert.strictEqual(api('PtInRegion',retained,7,5),0);
  api('SelectClipRgn',memoryDC,0);
  const bigDC=api('CreateCompatibleDC',childDC),bigBmp=api('CreateCompatibleBitmap',childDC,512,14),bigOld=api('SelectObject',bigDC,bigBmp);
  const stripes=api('CreateRectRgn',0,0,0,0),stripe=api('CreateRectRgn',0,0,0,0);
  for(let i=0;i<208;i++){api('SetRectRgn',stripe,2*i,0,2*i+1,14);assert(api('CombineRgn',stripes,stripes,stripe,2));}
  for(let y=0;y<14;y++)for(let x=0;x<512;x++)api('SetPixel',bigDC,x,y,color(x,y));
  assert(api('SelectClipRgn',bigDC,stripes));origin(bigDC,[3,2],[0,0]);
  rect(input,[-3,-2,509,12]);rect(output,[71,72,73,74]);api('SetRectRgn',region,91,92,97,99);
  assert.strictEqual(api('ScrollDC',bigDC,2,3,input,0,region,output),0,'exact 208 overflow atomic');
  assert.strictEqual(api('ScrollDC',bigDC,2,3,input,0,region,0),0,'exact 208 HRGN-only overflow');
  assert.strictEqual(api('ScrollDC',bigDC,2,3,input,0,0,output),0,'exact 208 RECT-only overflow');
  assert.deepStrictEqual(readRect(output),[71,72,73,74]);api('GetRgnBox',region,box);assert.deepStrictEqual(readRect(box),[91,92,97,99]);
  assert.strictEqual(api('GetClipRgn',bigDC,retained),1);assert.strictEqual(api('EqualRgn',retained,stripes),1,'208 clip unchanged');
  origin(bigDC,[0,0],[0,0]);api('SelectClipRgn',bigDC,0);
  for(let y=0;y<14;y++)for(let x=0;x<512;x++)assert.strictEqual(api('GetPixel',bigDC,x,y),color(x,y),'208 overflow atomic pixels');
  origin(bigDC,[3,2],[0,0]);
  assert.strictEqual(api('ScrollDC',bigDC,2,3,input,0,region,output),1,'exact capacity recovery');
  api('SelectObject',bigDC,bigOld);api('DeleteObject',bigBmp);api('DeleteDC',bigDC);api('DeleteObject',stripes);api('DeleteObject',stripe);
  rect(input,[-1,0,9,8]);rect(clip,[-3,-2,13,12]);
  for(let i=0;i<300;i++){origin(memoryDC,...mappings[i%mappings.length]);assert.strictEqual(api('ScrollDC',memoryDC,0,0,input,clip,region,output),1);}
  const used=e.gdi_dc_state_used();
  api('ReleaseDC',child,systemDC);
  for(let i=0;i<100;i++){
    const dc=api('GetDC',child);assert(dc);api('GetViewportOrgEx',dc,point);assert.deepStrictEqual([r(point),r(point+4)],[0,0]);
    api('GetWindowOrgEx',dc,point);assert.deepStrictEqual([r(point),r(point+4)],[0,0]);origin(dc,[3,2],[-1,-2]);
    assert(api('SaveDC',dc));assert.strictEqual(api('ScrollDC',dc,0,0,input,clip,region,output),1);assert(api('ReleaseDC',child,dc));
  }
  assert(e.gdi_dc_state_used()<=used,'release cycles do not leak DC state');
  api('SelectObject',memoryDC,oldBitmap);api('DeleteObject',bitmap);api('DeleteDC',memoryDC);
  assert.strictEqual(api('ScrollDC',memoryDC,2,3,input,clip,region,output),0,'deleted DC');
  api('ReleaseDC',child,childDC);for(const h of [region,retained,update,app,hole])assert(api('DeleteObject',h));
  api('DestroyWindow',child);api('DestroyWindow',hwnd);
  console.log(JSON.stringify({pass:true,cases,calls,pixelChecks:checks}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
