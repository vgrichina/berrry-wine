'use strict';

// Contract: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-scrolldc
// Public PE import and GetProcAddress thunks; no private scroll entry points.
const assert = require('assert');
const fs = require('fs');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const bytes = process.env.SCROLLDC_PUBLIC_TEST_MODULE
    ? fs.readFileSync(process.env.SCROLLDC_PUBLIC_TEST_MODULE) : compileSrcWasm();
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
      const dll = !/^(CreateWindowExA|GetDC|GetWindowDC|ReleaseDC|DestroyWindow|ScrollDC|GetClientRect|ValidateRect|InvalidateRect|GetUpdateRgn|GetUpdateRect|BeginPaint|EndPaint|LockWindowUpdate)$/.test(name)
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
  const hwnd=api('CreateWindowExA',0,str('STATIC'),str('ScrollDC'),0x90000000,20,30,16,14,0,0,0x400000,0);
  const windowDC=api('GetDC',hwnd), memoryDC=api('CreateCompatibleDC',windowDC);
  const bitmap=api('CreateCompatibleBitmap',windowDC,16,14);
  assert(hwnd&&windowDC&&memoryDC&&bitmap);
  const oldBitmap=api('SelectObject',memoryDC,bitmap);
  const input=alloc(16),clip=alloc(16),output=alloc(24),box=alloc(16),damage=alloc(16),data=alloc(8192);
  const region=api('CreateRectRgn',91,92,97,99),retained=api('CreateRectRgn',0,0,0,0);
  const update=api('CreateRectRgn',0,0,0,0),app=api('CreateRectRgn',1,1,15,13),hole=api('CreateRectRgn',6,4,9,9);
  assert(api('CombineRgn',app,app,hole,4));
  const inside=(a,x,y)=>x>=a[0]&&y>=a[1]&&x<a[2]&&y<a[3];
  const color=(x,y)=>0x110000+y*256+x;
  const scenarios=[
    ...[[2,0],[-2,0],[0,3],[0,-3],[2,3],[-2,-3]].map(d=>({s:[2,2,12,10],c:[2,2,12,10],d})),
    ...[[2,3],[-2,-3],[0,0]].map(d=>({s:[2,2,12,10],c:[4,3,10,9],d})),
    {s:[2,2,12,10],c:[0,0,16,14],d:[20,-20]},
    {s:null,c:null,d:[-2,3]},
    {s:[-3,-2,12,10],c:[-5,1,10,13],d:[2,-3]},
    {s:[12,2,2,10],c:null,d:[2,3]},
    {s:[2,2,12,10],c:[20,20,25,25],d:[2,3]},
  ];
  let cases=0;
  for(const [kind,dc] of [['memory',memoryDC],['window',windowDC]])
    for(const scenario of scenarios) for(const selected of [false,true]) for(const outputs of [0,1,2,3,4,5]) {
      const label=`${kind}/${cases++}`;
      api('SelectClipRgn',dc,0);
      for(let y=0;y<14;y++) for(let x=0;x<16;x++) api('SetPixel',dc,x,y,color(x,y));
      api('ValidateRect',hwnd,0);rect(damage,[0,12,1,13]);api('InvalidateRect',hwnd,damage,1);
      api('GetUpdateRgn',hwnd,update,0);
      if(selected) assert(api('SelectClipRgn',dc,app));
      const saved=api('SaveDC',dc);assert(saved);
      rect(input,scenario.s||[0,0,16,14]);rect(clip,scenario.c||[0,0,16,14]);
      rect(output,[71,72,73,74]);w(output+16,0x76543210);api('SetRectRgn',region,91,92,97,99);
      const outPtr=outputs===4?input:outputs===5?clip:outputs&2?output:0;
      const outRgn=outputs&1||outputs>=4?region:0;
      assert.strictEqual(api('ScrollDC',dc,...scenario.d,scenario.s?input:0,scenario.c?clip:0,outRgn,outPtr),1,label+' BOOL');
      const s=scenario.s||[0,0,16,14],c=scenario.c||[0,0,16,14];
      const source=(x,y)=>inside([0,0,16,14],x,y)&&inside(s,x,y);
      const visible=(x,y)=>!selected||(inside([1,1,15,13],x,y)&&!inside([6,4,9,9],x,y));
      const expected=[],copied=[];
      for(let y=0;y<14;y++) for(let x=0;x<16;x++) {
        const affected=source(x,y)&&inside(c,x,y)&&visible(x,y);
        const moved=source(x-scenario.d[0],y-scenario.d[1]);
        if(affected&&!moved) expected.push([x,y]);copied.push(affected&&moved);
        if(outRgn) assert.strictEqual(!!api('PtInRegion',region,x,y),affected&&!moved,label+' exposure');
      }
      const bounds=expected.length?[Math.min(...expected.map(p=>p[0])),Math.min(...expected.map(p=>p[1])),
        Math.max(...expected.map(p=>p[0]))+1,Math.max(...expected.map(p=>p[1]))+1]:[0,0,0,0];
      if(outPtr) assert.deepStrictEqual(readRect(outPtr),bounds,label+' RECT');
      else assert.deepStrictEqual(readRect(output),[71,72,73,74]);
      assert.strictEqual(r(output+16),0x76543210);
      if(outRgn) {
        assert(api('GetRegionData',region,8192,data));
        const bands=Array.from({length:r(data+8)},(_,i)=>readRect(data+32+i*16));
        for(let y=-1;y<=14;y++) for(let x=-1;x<=16;x++)
          assert.strictEqual(bands.some(a=>inside(a,x,y)),expected.some(p=>p[0]===x&&p[1]===y),label+' data');
        assert.deepStrictEqual(readRect(data+16),bounds);
      } else {api('GetRgnBox',region,box);assert.deepStrictEqual(readRect(box),[91,92,97,99]);}
      assert.strictEqual(api('GetClipRgn',dc,retained),selected?1:0);
      if(selected) assert.strictEqual(api('EqualRgn',retained,app),1);
      assert.strictEqual(api('GetUpdateRgn',hwnd,retained,0),2);
      assert.strictEqual(api('EqualRgn',retained,update),1,label+' update state');
      assert(api('RestoreDC',dc,saved));
      assert.strictEqual(api('GetClipRgn',dc,retained),selected?1:0);
      if(selected) assert.strictEqual(api('EqualRgn',retained,app),1);
      api('SelectClipRgn',dc,0);
      for(let y=0;y<14;y++) for(let x=0;x<16;x++) {
        assert.strictEqual(api('GetPixel',dc,x,y),copied[y*16+x]?color(x-scenario.d[0],y-scenario.d[1]):color(x,y),label+' pixel '+x+','+y);
        checks++;
      }
    }
  rect(input,[2,2,12,10]);rect(clip,[2,2,12,10]);
  for(const action of ['bad DC','bad region','origin','scale','extreme']) {
    const saved=api('SaveDC',memoryDC);
    rect(output,[71,72,73,74]);api('SetRectRgn',region,91,92,97,99);
    if(action==='origin') api('SetViewportOrgEx',memoryDC,2,3,0);
    if(action==='scale') {api('SetMapMode',memoryDC,8);api('SetViewportExtEx',memoryDC,2,3,0);}
    assert.strictEqual(api('ScrollDC',action==='bad DC'?0xdead:memoryDC,action==='extreme'?0x7fffffff:2,3,
      input,clip,action==='bad region'?0xdead:region,output),0,action);
    assert.deepStrictEqual(readRect(output),[71,72,73,74]);api('GetRgnBox',region,box);
    assert.deepStrictEqual(readRect(box),[91,92,97,99]);api('RestoreDC',memoryDC,saved);
  }
  const ncDC=api('GetWindowDC',hwnd);assert(ncDC);
  assert.strictEqual(api('ScrollDC',ncDC,2,3,input,clip,region,output),0,'nonclient explicitly unsupported');
  api('ReleaseDC',hwnd,ncDC);
  assert(api('LockWindowUpdate',hwnd));
  assert.strictEqual(api('ScrollDC',windowDC,2,3,input,clip,region,output),0,'locked window explicitly unsupported');
  assert.deepStrictEqual(readRect(output),[71,72,73,74]);
  assert(api('LockWindowUpdate',0));
  const held=[];let h;
  while((h=api('CreateRectRgn',0,0,0,0))) held.push(h);
  for(let free=0;free<3;free++) {
    if(free) api('DeleteObject',held.pop());rect(output,[71,72,73,74]);
    const before=api('GetPixel',memoryDC,4,5);
    assert.strictEqual(api('ScrollDC',memoryDC,2,3,input,clip,region,output),0,'capacity '+free);
    assert.deepStrictEqual(readRect(output),[71,72,73,74]);
    assert.strictEqual(api('GetPixel',memoryDC,4,5),before);
    api('GetRgnBox',region,box);assert.deepStrictEqual(readRect(box),[91,92,97,99]);
    assert.strictEqual(api('ScrollDC',memoryDC,0,0,input,clip,0,0),1,'NULL outputs need no HRGN allocation');
  }
  held.forEach(h=>api('DeleteObject',h));
  // A literal diagonal L, including the distinction from its bounding box.
  assert.strictEqual(api('ScrollDC',memoryDC,2,3,input,clip,region,output),1);
  const upper=api('CreateRectRgn',2,2,12,5),left=api('CreateRectRgn',2,5,4,10);
  assert(api('CombineRgn',upper,upper,left,2));
  assert.strictEqual(api('EqualRgn',region,upper),1);
  api('DeleteObject',upper);api('DeleteObject',left);
  // Selected clip handles are copied by SelectClipRgn: publishing exposure
  // into the caller's original handle must preserve the DC's private clip.
  assert(api('SelectClipRgn',memoryDC,app));
  assert.strictEqual(api('ScrollDC',memoryDC,2,3,input,clip,app,output),1);
  assert.strictEqual(api('GetClipRgn',memoryDC,retained),1);
  assert.strictEqual(!!api('PtInRegion',retained,12,10),true);
  assert.strictEqual(!!api('PtInRegion',retained,7,5),false);
  api('SelectClipRgn',memoryDC,0);
  // Region capacity is separate from HRGN allocation capacity. 208 disjoint
  // full-height strips fit, but a diagonal subtraction adds a lower band
  // for the leftmost strip and exceeds the 208 rectangle store. Pixels and both
  // outputs must remain intact when the exact result cannot be represented.
  const bigDC=api('CreateCompatibleDC',windowDC),bigBmp=api('CreateCompatibleBitmap',windowDC,512,14);
  const bigOld=api('SelectObject',bigDC,bigBmp),stripes=api('CreateRectRgn',0,0,0,0);
  const stripe=api('CreateRectRgn',0,0,0,0);
  for(let i=0;i<208;i++) {
    api('SetRectRgn',stripe,2*i,0,2*i+1,14);
    assert(api('CombineRgn',stripes,stripes,stripe,2));
  }
  api('SetPixel',bigDC,4,5,0x123456);assert(api('SelectClipRgn',bigDC,stripes));
  rect(input,[0,0,512,14]);rect(output,[71,72,73,74]);api('SetRectRgn',region,91,92,97,99);
  assert.strictEqual(api('ScrollDC',bigDC,2,3,input,0,region,output),0,'rectangle capacity');
  assert.deepStrictEqual(readRect(output),[71,72,73,74]);
  api('GetRgnBox',region,box);assert.deepStrictEqual(readRect(box),[91,92,97,99]);
  assert.strictEqual(api('GetPixel',bigDC,4,5),0x123456);
  api('SelectClipRgn',bigDC,0);
  assert.strictEqual(api('ScrollDC',bigDC,2,3,input,0,region,output),1,'rectangle capacity recovery');
  api('SelectObject',bigDC,bigOld);api('DeleteObject',bigBmp);api('DeleteDC',bigDC);
  api('DeleteObject',stripes);api('DeleteObject',stripe);
  rect(input,[2,2,12,10]);
  for(let i=0;i<300;i++) assert.strictEqual(api('ScrollDC',memoryDC,0,0,input,clip,region,output),1);
  // A positioned child DC shares its parent's surface. Pixel origins must
  // translate exactly once while exposure remains in child client coordinates.
  const child=api('CreateWindowExA',0,str('STATIC'),str('child'),0x50000000,3,2,8,6,hwnd,100,0x400000,0);
  const childDC=api('GetDC',child);assert(child&&childDC);
  for(let y=0;y<6;y++) for(let x=0;x<8;x++) api('SetPixel',childDC,x,y,color(x,y));
  api('ValidateRect',child,0);rect(input,[0,0,8,6]);
  assert.strictEqual(api('ScrollDC',childDC,2,2,input,0,region,output),1);
  assert.deepStrictEqual(readRect(output),[0,0,8,6]);
  for(let y=0;y<6;y++) for(let x=0;x<8;x++) {
    assert.strictEqual(api('GetPixel',childDC,x,y),x>=2&&y>=2?color(x-2,y-2):color(x,y));
    assert.strictEqual(!!api('PtInRegion',region,x,y),x<2||y<2);
  }
  assert.strictEqual(api('GetUpdateRect',child,damage,0),0);
  api('ReleaseDC',child,childDC);api('DestroyWindow',child);
  api('SelectObject',memoryDC,oldBitmap);api('DeleteObject',bitmap);api('DeleteDC',memoryDC);
  assert.strictEqual(api('ScrollDC',memoryDC,2,3,input,clip,region,output),0,'deleted DC');
  api('ReleaseDC',hwnd,windowDC);
  for(const h of [region,retained,update,app,hole]) api('DeleteObject',h);
  api('DestroyWindow',hwnd);
  console.log(JSON.stringify({pass:true,cases,calls,pixelChecks:checks}));

}
main().catch(error => { console.error(error); process.exitCode = 1; });
