'use strict';

// NULL-mask contract and ROP4 packing:
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-maskblt
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-makerop4
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { bootRenderHarness } = require('./render-helper');
const { compileSrcWasm } = require('./compile-src');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

async function main() {
  const file = process.env.MASKBLT_TEST_MODULE;
  const bytes = file ? (file.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(file)) : fs.readFileSync(file)) : compileSrcWasm();
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', prebuiltModule: new WebAssembly.Module(bytes) });
  const pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => { const p=e.guest_alloc(n)>>>0; assert(p); return p; };
  const w=(p,v)=>e.guest_write32(p,v), r=p=>e.guest_read32(p)>>>0;
  const str=s=>{const p=alloc(s.length+1);Buffer.from(s+'\0').forEach((v,i)=>e.guest_write8(p+i,v));return p;};
  const stack=alloc(4096)+2048, entries={}; let calls=0,cases=0,checks=0;
  function call(entry,args) {
    w(stack-4,0x1234abcd);w(stack,0);args.forEach((v,i)=>w(stack+4+i*4,v));w(stack+4+args.length*4,0xabcd1234);
    e.set_esp(stack);e.clear_yield();e.set_eip(entry);
    for(let i=0;i<64&&e.get_eip();i++)e.run(64);
    assert.equal(e.get_eip(),0,'public thunk returns');
    assert.equal(e.get_esp()>>>0,stack+4+args.length*4,'stdcall ESP');
    assert.equal(r(stack-4),0x1234abcd);assert.equal(r(stack+4+args.length*4),0xabcd1234);
    assert.deepEqual(args.map((_,i)=>r(stack+4+i*4)),args.map(v=>v>>>0),'arguments preserved');
    calls++;return e.get_eax()>>>0;
  }
  const dll=call(r(iat('LoadLibraryA')),[str('gdi32.dll')]);assert(dll);
  function api(name,...args) {
    if(!entries[name]){entries[name]=call(r(iat('GetProcAddress')),[dll,str(name)]);assert(entries[name],name);}
    return call(entries[name],args);
  }
  const W=16,H=12,bmi=alloc(40),out=alloc(4),point=alloc(8),rc=alloc(16);
  function dib(bottom=false) {
    const dc=api('CreateCompatibleDC',0);assert(dc);
    for(let i=0;i<40;i+=4)w(bmi+i,0);
    w(bmi,40);w(bmi+4,W);w(bmi+8,bottom?H:-H);w(bmi+12,1|(32<<16));
    const bitmap=api('CreateDIBSection',dc,bmi,0,out,0,0);assert(bitmap);
    const old=api('SelectObject',dc,bitmap);assert(old);
    return {dc,bitmap,old,bits:r(out),bottom};
  }
  const addr=(d,x,y)=>d.bits+((d.bottom?H-1-y:y)*W+x)*4;
  const color=(x,y,seed)=>((seed+x*0x170b+y*0x31207)&0xffffff);
  function fill(d,seed=0x231547){for(let y=0;y<H;y++)for(let x=0;x<W;x++)w(addr(d,x,y),color(x,y,seed));}
  const pixels=d=>Array.from({length:W*H},(_,i)=>r(addr(d,i%W,Math.floor(i/W)))&0xffffff);
  const close=d=>{assert(api('SelectObject',d.dc,d.old));assert.equal(api('DeleteObject',d.bitmap),1);assert.equal(api('DeleteDC',d.dc),1);};
  const a=dib(),b=dib(),src=dib(true);fill(src,0x713927);
  const rops=[0x00cc0020,0x00000042,0x00ff0062,0x00f00021];
  // This first strict comparison fails on the public pre-fix handler.
  function compare(rop,{dx=2,dy=2,width=7,height=5,sx=1,sy=1,source=src.dc,dest=true,background=0xaa,low=0xbeef,mx=-2147483648,my=2147483647}={}) {
    if(process.env.MASKBLT_TEST_TRACE)console.log(JSON.stringify({case:cases,rop,dx,dy,width,height,sx,sy,source,dest}));
    fill(a);fill(b);const srcBefore=pixels(src);
    const left=dest===true?a.dc:dest, right=dest===true?b.dc:dest;
    const sa=source==='self'?a.dc:source,sb=source==='self'?b.dc:source;
    const bit=api('BitBlt',right,dx,dy,width,height,sb,sx,sy,rop);
    const mask=api('MaskBlt',left,dx,dy,width,height,sa,sx,sy,0,mx,my,((background<<24)|(rop&0xff0000)|low)>>>0);
    assert.equal(mask,bit,'NULL-mask MaskBlt return equals foreground BitBlt');
    assert.deepEqual(pixels(a),pixels(b),'all destination pixels equal foreground BitBlt');
    assert.deepEqual(pixels(src),srcBefore,'source immutable');
    checks+=W*H*3;cases++;return {bit,pixels:pixels(a)};
  }
  const first=compare(rops[0]);assert.equal(first.bit,1);
  assert.equal(first.pixels[2*W+2],color(1,1,0x713927),'positive SRCCOPY source pixel');
  const pattern=dib();fill(pattern,0x923167);
  const brush=api('CreatePatternBrush',pattern.bitmap);assert(brush);close(pattern);
  const clip=api('CreateRectRgn',1,1,14,10),hole=api('CreateRectRgn',5,4,9,8),retained=api('CreateRectRgn',0,0,0,0);
  assert(clip&&hole&&retained);assert(api('CombineRgn',clip,clip,hole,4));
  function state(dc) {
    const s={};
    for(const name of ['GetMapMode','GetTextColor','GetBkColor','GetBkMode','GetROP2','GetStretchBltMode'])s[name]=api(name,dc);
    for(const kind of [1,2,6,7])s['object'+kind]=api('GetCurrentObject',dc,kind);
    for(const name of ['GetBrushOrgEx','GetCurrentPositionEx','GetWindowOrgEx','GetWindowExtEx','GetViewportOrgEx','GetViewportExtEx']) {
      assert.equal(api(name,dc,point),1);s[name]=[r(point),r(point+4)];
    }
    s.clip=api('GetClipRgn',dc,retained);
    if(s.clip){s.clipType=api('GetRgnBox',retained,rc);s.clipBox=[0,4,8,12].map(i=>r(rc+i));assert.equal(api('EqualRgn',retained,clip),1);}
    return s;
  }
  for(const d of [a,b]){assert(api('SelectObject',d.dc,brush));api('SetBrushOrgEx',d.dc,2,-1,0);}
  for(const rop of rops)for(const source of rop===rops[0]?[src.dc,'self']:[src.dc,0,0xdead])
    for(const clipped of [false,true])for(const mapping of [0,1,2,3])for(const background of [0,0x33,0xcc,0xff]) {
      for(const d of [a,b,src]) {
        assert(api('SetMapMode',d.dc,8));assert(api('SetWindowExtEx',d.dc,1,1,0));
        assert(api('SetViewportExtEx',d.dc,mapping===2?2:1,mapping===3?-1:1,0));
        assert(api('SetWindowOrgEx',d.dc,mapping===1?1:0,mapping===1?-1:0,0));
        assert(api('SetViewportOrgEx',d.dc,mapping===1?3:0,mapping===3?10:0,0));
        assert(api('SelectClipRgn',d.dc,d===src?0:clipped?clip:0));
      }
      const before=[state(a.dc),state(b.dc),state(src.dc)];
      const saves=[a,b,src].map(d=>api('SaveDC',d.dc));assert(saves.every(Boolean));
      const result=compare(rop,{source,background});
      // Current BitBlt rejects negative device extents; the fallback must
      // preserve that result as well as successful positive mapped extents.
      assert.equal(result.bit,mapping===3?0:1,'foreground BitBlt extent contract');
      assert.deepEqual([state(a.dc),state(b.dc),state(src.dc)],before,'raster preserves DC state');
      for(const [i,d]of [a,b,src].entries()) {
        api('SetBrushOrgEx',d.dc,7,9,0);api('SelectClipRgn',d.dc,0);assert(api('RestoreDC',d.dc,saves[i]));
      }
      assert.deepEqual([state(a.dc),state(b.dc),state(src.dc)],before,'SaveDC/RestoreDC state');
    }
  for(const d of [a,b,src]) {
    api('SelectClipRgn',d.dc,0);api('SetMapMode',d.dc,1);api('SetWindowOrgEx',d.dc,0,0,0);api('SetViewportOrgEx',d.dc,0,0,0);
  }
  // Independent positive oracles prevent vacuous equality for source-free ROPs.
  for(const rop of rops.slice(1)) {
    const result=compare(rop,{source:0,background:0xcc});assert.equal(result.bit,1);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
      const inside=x>=2&&x<9&&y>=2&&y<7;
      const expected=!inside?color(x,y,0x231547):rop===rops[1]?0:rop===rops[2]?0xffffff:color((x-2+W)%W,(y+1)%H,0x923167);
      assert.equal(result.pixels[y*W+x],expected,'foreground constant/pattern and untouched outside');checks++;
    }
  }
  for(const [dx,dy,sx,sy]of [[3,2,1,1],[1,1,3,2],[2,3,2,1],[2,1,2,3]])compare(rops[0],{source:'self',dx,dy,sx,sy});
  for(const options of [{dest:0},{dest:0xdead},{source:0},{source:0xdead},
    {width:0},{height:0},{width:-1},{height:-1},
    {dx:0,width:65535},{dx:0,width:65536},{dy:0,height:65535},{dy:0,height:65536},
    {source:0,width:2147483647},{source:0,height:2147483647},
    {dx:2147483647},{dy:-2147483648},{sx:-2147483648},{sy:2147483647}])compare(rops[0],options);
  // Stale public handles and non-NULL mask rejection remain distinct.
  const dead=dib();close(dead);compare(rops[0],{source:dead.dc});compare(rops[0],{dest:dead.dc});
  fill(a);const before=pixels(a);
  for(const mask of [0xdead,a.bitmap]) {
    assert.equal(api('MaskBlt',a.dc,0,0,4,4,src.dc,0,0,mask,0,0,0xaacc0020),0,'non-NULL invalid/color mask fails');
    assert.deepEqual(pixels(a),before);
  }
  close(a);close(b);close(src);
  for(const h of [brush,clip,hole,retained])assert.equal(api('DeleteObject',h),1);
  console.log(JSON.stringify({passed:true,cases,calls,checks}));
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={main};
