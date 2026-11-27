'use strict';

// Public thunks and actual DIB bytes. Contract, not a pixel-exact Windows oracle:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-drawframecontrol
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const file = process.env.DRAWFRAMECONTROL_TEST_MODULE;
  const bytes = file ? (file.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(file)) : fs.readFileSync(file)) : compileSrcWasm();
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', prebuiltModule: new WebAssembly.Module(bytes) });
  const pe = makeFixture(), raw = rva => rva - 0x1000 + 0x200;
  pe.writeUInt32LE(60, 0x80 + 24 + 108);
  pe.writeUInt32LE(0x1b00, raw(0x1814)); pe.writeUInt32LE(0x1b80, raw(0x1820));
  pe.writeUInt32LE(0x1b00, raw(0x1824)); pe.write('user32.dll\0', raw(0x1b80));
  pe.writeUInt32LE(0x1bc0, raw(0x1b00)); pe.write('DrawFrameControl\0', raw(0x1bc2));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const w = (p,v) => e.guest_write32(p,v), r = p => e.guest_read32(p) >>> 0;
  const rect = (p,a) => a.forEach((v,i) => w(p+4*i,v));
  const str = s => { const p=alloc(s.length+1); Buffer.from(s+'\0').forEach((v,i)=>e.guest_write8(p+i,v)); return p; };
  const stack=alloc(4096)+2048, entries={}, dlls={}; let calls=0, checks=0;
  function call(entry,args) {
    w(stack,0); args.forEach((v,i)=>w(stack+4+i*4,v));
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for(let i=0;i<64&&e.get_eip();i++) e.run(64);
    assert.equal(e.get_eip(),0,'guest returned');
    assert.equal(e.get_esp()>>>0,stack+4+args.length*4,'stdcall ESP');
    calls++; return e.get_eax()>>>0;
  }
  function api(name,...args) {
    if(!entries[name]) {
      const dll=/^(DrawFrameControl|DrawEdge|CreateWindowExA|GetDCEx|GetDC|ReleaseDC|DestroyWindow)$/.test(name)?'user32.dll':/^(VirtualAlloc|VirtualFree)$/.test(name)?'kernel32.dll':'gdi32.dll';
      dlls[dll] ||= call(r(iat('LoadLibraryA')),[str(dll)]);
      entries[name]=call(r(iat('GetProcAddress')),[dlls[dll],str(name)]); assert(entries[name],name);
    }
    return call(entries[name],args);
  }
  const imported=r(0x401b00); assert(imported,'public USER32 import');
  const bmi=alloc(48),out=alloc(4),rc=alloc(16), W=32,H=28, sentinel=0x73512f;
  function dib(bottom=false,bpp=32) {
    const dc=api('CreateCompatibleDC',0); assert(dc);
    rect(bmi,[40,W,bottom?H:-H,1|(bpp<<16)]); for(let i=16;i<48;i+=4)w(bmi+i,0);
    if(bpp===1)w(bmi+44,0xffffff);
    const bitmap=api('CreateDIBSection',dc,bmi,0,out,0,0); assert(bitmap);
    const old=api('SelectObject',dc,bitmap); assert(old);
    const bits=r(out),stride=((W*bpp+31)>>>5)*4;
    return {dc,bitmap,old,bits,stride,bottom,bpp};
  }
  const pixel=(d,x,y)=> d.bpp===32?r(d.bits+((d.bottom?H-1-y:y)*d.stride+x*4))&0xffffff:
    (e.guest_read8(d.bits+(d.bottom?H-1-y:y)*d.stride+(x>>>3))&(128>>>(x&7))?0xffffff:0);
  function fill(d) { for(let i=0;i<d.stride*H;i++)e.guest_write8(d.bits+i,d.bpp===32?[0x2f,0x51,0x73,0][i%4]:0x55); }
  const pixels=d=>Array.from({length:W*H},(_,i)=>pixel(d,i%W,Math.floor(i/W)));
  const close=d=>{assert(api('SelectObject',d.dc,d.old));assert.equal(api('DeleteObject',d.bitmap),1);assert.equal(api('DeleteDC',d.dc),1);};
  const a=dib(),b=dib(); fill(a);fill(b);rect(rc,[4,4,24,24]);
  assert.equal(call(imported,[a.dc,rc,4,0]),1);
  assert.equal(api('DrawFrameControl',b.dc,rc,4,0x400),1);
  const unchecked=pixels(a),checked=pixels(b),changes=checked.filter((v,i)=>v!==unchecked[i]).length;
  if(process.env.DRAWFRAMECONTROL_BASELINE==='1') {
    assert.equal(changes,0,'published bug: checked and unchecked masks identical');
    console.log(JSON.stringify({baseline:true,changes,unchecked,checked,calls})); close(a);close(b);return;
  }
  assert(changes>0,'checked adds an interior mark');
  close(a);close(b);
  const inside=(bounds,x,y)=>x>=bounds[0]&&y>=bounds[1]&&x<bounds[2]&&y<bounds[3];
  const point=alloc(8),retained=api('CreateRectRgn',0,0,0,0);
  function state(dc) {
    const result={};
    for(const name of ['GetTextColor','GetBkColor','GetBkMode','GetROP2','GetPolyFillMode','GetStretchBltMode','GetMapMode','GetTextAlign'])result[name]=api(name,dc);
    for(const kind of [1,2,6,7])result['object'+kind]=api('GetCurrentObject',dc,kind);
    for(const name of ['GetCurrentPositionEx','GetBrushOrgEx','GetWindowOrgEx','GetWindowExtEx','GetViewportOrgEx','GetViewportExtEx']) {
      assert.equal(api(name,dc,point),1,name);result[name]=[r(point),r(point+4)];
    }
    result.clip=api('GetClipRgn',dc,retained);
    if(result.clip===1){assert.equal(api('GetRgnBox',retained,rc)>0,true);result.clipBox=[0,4,8,12].map(i=>r(rc+i));}
    return result;
  }
  const app=api('CreateRectRgn',3,2,27,25),hole=api('CreateRectRgn',11,9,17,17);
  assert(api('CombineRgn',app,app,hole,4));
  const empty=api('CreateRectRgn',0,0,0,0),pen=api('CreatePen',1,3,0x123456),brush=api('CreateSolidBrush',0xabcdef);
  assert(app&&hole&&empty&&pen&&brush&&retained);
  const mappings=[{sx:1,sy:1,wx:0,wy:0,vx:0,vy:0},
    {sx:1,sy:1,wx:3,wy:-2,vx:5,vy:1},
    {sx:2,sy:1,wx:0,wy:0,vx:0,vy:0},
    {sx:-1,sy:-1,wx:0,wy:0,vx:28,vy:26}];
  const boundsList=[[4,4,24,24],[2,3,15,16],[3,2,30,13],[-5,-4,15,16],[-100,-100,-80,-80],
    [30,25,45,40],[4,4,5,5],[4,4,6,6],[4,4,11,11],[4,4,4,20],[20,4,4,20],[4,20,20,4]];
  let cases=0;
  for(const bottom of [false,true]) for(const bpp of [32,1]) {
    const u=dib(bottom,bpp),c=dib(bottom,bpp);
    for(const m of mappings)for(const bounds of boundsList)for(const clip of [0,app,empty]) {
      cases++;const before=[];
      for(const d of [u,c]) {
        api('SelectClipRgn',d.dc,0);api('SelectObject',d.dc,pen);api('SelectObject',d.dc,brush);
        api('SetTextColor',d.dc,0x223344);api('SetBkColor',d.dc,0x8899aa);api('SetBkMode',d.dc,1);
        api('SetROP2',d.dc,7);api('SetPolyFillMode',d.dc,2);api('SetStretchBltMode',d.dc,3);
        api('SetTextAlign',d.dc,6);api('MoveToEx',d.dc,19,18,0);api('SetBrushOrgEx',d.dc,2,3,0);
        assert(api('SetMapMode',d.dc,8)); assert(api('SetWindowExtEx',d.dc,1,1,0));
        assert(api('SetViewportExtEx',d.dc,m.sx,m.sy,0));assert(api('SetWindowOrgEx',d.dc,m.wx,m.wy,0));
        assert(api('SetViewportOrgEx',d.dc,m.vx,m.vy,0)); assert(api('SelectClipRgn',d.dc,clip));
        fill(d);before.push(pixels(d));
      }
      const mapped=[(bounds[0]-m.wx)*m.sx+m.vx,(bounds[1]-m.wy)*m.sy+m.vy,
        (bounds[2]-m.wx)*m.sx+m.vx,(bounds[3]-m.wy)*m.sy+m.vy];
      const box=[Math.min(mapped[0],mapped[2]),Math.min(mapped[1],mapped[3]),Math.max(mapped[0],mapped[2]),Math.max(mapped[1],mapped[3])];
      const valid=bounds[2]>bounds[0]&&bounds[3]>bounds[1];
      for(const [index,d]of [u,c].entries()) {
        const expectedState=state(d.dc),saved=api('SaveDC',d.dc);assert(saved);
        rect(rc,bounds);const guard=Array.from({length:16},(_,i)=>e.guest_read8(rc+i));
        assert.equal(index?api('DrawFrameControl',d.dc,rc,4,0x400):call(imported,[d.dc,rc,4,0]),valid?1:0,'RECT validity');
        assert.deepEqual(Array.from({length:16},(_,i)=>e.guest_read8(rc+i)),guard,'input RECT immutable');
        assert.deepEqual(state(d.dc),expectedState,'drawing state immutable');
        if(clip)assert.equal(api('EqualRgn',retained,clip),1,'exact clip including hole');
        assert(api('RestoreDC',d.dc,saved));assert.deepEqual(state(d.dc),expectedState,'SaveDC/RestoreDC');
      }
      const up=pixels(u),cp=pixels(c);let marked=0;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
        const i=y*W+x,visible=valid&&inside(box,x,y)&&(!clip||(clip===app&&inside([3,2,27,25],x,y)&&!inside([11,9,17,17],x,y)));
        if(!visible){assert.equal(up[i],before[0][i],'unchecked outside rect/system/app clip');assert.equal(cp[i],before[1][i],'checked outside rect/system/app clip');}
        else {
          const edge=x===box[0]||x===box[2]-1||y===box[1]||y===box[3]-1;
          assert.equal(up[i],edge?0:0xffffff,'unchecked black frame/white interior');
          assert(cp[i]===0||cp[i]===0xffffff,'checked monochrome');
          if(up[i]!==cp[i]){assert(!edge,'mark stays inside frame');assert.equal(cp[i],0,'checked adds black');marked++;}
        }
        checks+=3;
      }
      if(valid&&!clip&&inside([0,0,W+1,H+1],box[0],box[1])&&box[2]<=W&&box[3]<=H&&box[2]-box[0]>=9&&box[3]-box[1]>=9)assert(marked>0,'visible interior mark');
    }
    close(u);close(c);
  }
  // Every byte split, including unaligned DWORD fields on separately backed pages.
  const d=dib(),reference=dib();rect(rc,[4,4,24,24]);fill(reference);assert.equal(api('DrawFrameControl',reference.dc,rc,4,0x400),1);
  for(let cut=1;cut<16;cut++) {
    const base=api('VirtualAlloc',0,65536,0x2000,4);assert(base);
    assert.equal(api('VirtualAlloc',base,4096,0x1000,4),base);
    const gap=api('VirtualAlloc',0,65536,0x3000,4);assert(gap);
    assert.equal(api('VirtualAlloc',base+4096,4096,0x1000,4),base+4096);
    assert.notEqual(e.guest_to_wasm(base+4096)>>>0,(e.guest_to_wasm(base)>>>0)+4096,'separate backing');
    const split=base+4096-cut;
    for(let i=-8;i<24;i++)e.guest_write8(split+i,0xa5);
    rect(split,[4,4,24,24]);fill(d);
    assert.equal(api('DrawFrameControl',d.dc,split,4,0x400),1,'split RECT');assert.deepEqual(pixels(d),pixels(reference));
    for(let i=-8;i<24;i++)assert.equal(e.guest_read8(split+i),i<0||i>=16?0xa5:((([4,4,24,24][i>>>2])>>>((i&3)*8))&255),'RECT/guard unchanged');
    for(let i=0;i<65536;i+=4096)assert.equal(r(gap+i),0,'gap unchanged');
    assert.equal(api('VirtualFree',base,0,0x8000),1);assert.equal(api('VirtualFree',gap,0,0x8000),1);
  }
  fill(d);const untouched=pixels(d);
  for(const [dc,ptr,bounds]of [[0,rc,[1,1,10,10]],[0xdead,rc,[1,1,10,10]],[d.dc,0,[1,1,10,10]],
    [d.dc,rc,[-2147483648,0,2147483647,20]]]) {
    rect(rc,bounds);assert.equal(api('DrawFrameControl',dc,ptr,4,0x400),0,'invalid input fails');assert.deepEqual(pixels(d),untouched);
  }
  assert(api('SetWindowOrgEx',d.dc,-2147483648,0,0));rect(rc,[4,4,24,24]);
  assert.equal(api('DrawFrameControl',d.dc,rc,4,0x400),0,'mapping overflow fails before writes');assert.deepEqual(pixels(d),untouched);
  assert(api('SetWindowOrgEx',d.dc,0,0,0));
  // Other types and any additional flags keep the original DrawEdge fallback.
  for(const [type,flags]of [[1,0],[2,0x400],[3,0],[4,1],[4,0x10],[4,0x100],[4,0x200],[4,0x1000],[4,0x4000],[4,0x8000],[4,0x80000400]]) {
    fill(d);fill(reference);rect(rc,[4,4,24,24]);
    assert.equal(api('DrawFrameControl',d.dc,rc,type,flags),api('DrawEdge',reference.dc,rc,5,15));
    assert.deepEqual(pixels(d),pixels(reference),'unchanged fallback type/flags');
  }
  close(d);close(reference);
  // Consume the generated monochrome DIB as the documented MaskBlt mask.
  const mask=dib(false,1),src=dib(),dst=dib();fill(src);
  for(const checkedState of [0,0x400]) {
    fill(mask);rect(rc,[4,4,24,24]);assert.equal(api('DrawFrameControl',mask.dc,rc,4,checkedState),1);
    const before=pixels(mask);
    for(let i=0;i<W*H;i++)w(dst.bits+i*4,0x251637);
    assert.equal(api('MaskBlt',dst.dc,0,0,W,H,src.dc,0,0,mask.bitmap,0,0,0xaacc0020),1);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
      assert.equal(pixel(dst,x,y),before[y*W+x]===0xffffff?sentinel:0x251637,'generated mask selects ROP4');checks++;
    }
    assert.deepEqual(pixels(mask),before,'MaskBlt leaves generated mask intact');
  }
  close(mask);close(src);close(dst);
  for(let i=0;i<600;i++) {
    const life=dib(i%2===0,i%3?32:1),saved=api('SaveDC',life.dc);assert(saved);
    rect(rc,[3,3,18,18]);assert.equal(api('DrawFrameControl',life.dc,rc,4,0),1);
    assert.equal(api('DrawFrameControl',life.dc,rc,4,0x400),1);assert(api('RestoreDC',life.dc,saved));close(life);
  }
  for(const handle of [app,hole,empty,pen,brush,retained])assert.equal(api('DeleteObject',handle),1);
  const report={passed:true,cases,calls,checks,changes,unchecked,checked,lifetimes:600,splitRects:15};
  if(process.env.DRAWFRAMECONTROL_TEST_REPORT)fs.writeFileSync(process.env.DRAWFRAMECONTROL_TEST_REPORT,JSON.stringify(report)+'\n');
  console.log(JSON.stringify({...report,unchecked:undefined,checked:undefined}));
}
if(require.main===module)main().catch(err=>{console.error(err.stack);process.exitCode=1;});
module.exports={main};
