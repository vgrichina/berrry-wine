'use strict';

// Public guest thunks, live CreateIcon pixels, and the documented BOOL contract:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-drawicon
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-drawiconex
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { compileSrcWasm } = require('./compile-src');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

// Only fixture construction: Win16 CreateIcon owns this legacy bitmap wrapper.
// Its public DrawIcon/Ex consumers below still execute the real guest thunks.
// Modern Win32 CreateIcon exercises the cursor/AND-XOR path separately.
const legacyWat = `
  (func (export "drawicon_fixture_bitmap_wrapper") (param $bitmap i32) (result i32)
    (call $icon_private_slot (global.get $ICON_FROM_BITMAP) (local.get $bitmap)))
`;

async function main() {
  const file = process.env.DRAWICON_TEST_MODULE;
  const bytes = file ? (file.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(file)) : fs.readFileSync(file)) :
    compileSrcWasm((name,source)=>name==='13-exports.wat'?source+legacyWat:source);
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', prebuiltModule: new WebAssembly.Module(bytes) });
  const pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => { const p=e.guest_alloc(n)>>>0; assert(p); return p; };
  const w=(p,v)=>e.guest_write32(p,v), r=p=>e.guest_read32(p)>>>0;
  const str=s=>{const p=alloc(s.length+1);Buffer.from(s+'\0').forEach((v,i)=>e.guest_write8(p+i,v));return p;};
  const stack=alloc(4096)+2048,entries={},dlls={};let calls=0,checks=0;
  function call(entry,args) {
    w(stack-4,0xa55aa55a); w(stack,0);args.forEach((v,i)=>w(stack+4+i*4,v));w(stack+4+args.length*4,0x5aa55aa5);
    e.set_esp(stack);e.clear_yield();e.set_eip(entry);
    for(let i=0;i<64&&e.get_eip();i++)e.run(64);
    assert.equal(e.get_eip(),0,'public guest return');
    assert.equal(e.get_esp()>>>0,stack+4+args.length*4,'stdcall ESP');
    assert.equal(r(stack-4),0xa55aa55a);assert.equal(r(stack+4+args.length*4),0x5aa55aa5);
    calls++;return e.get_eax()>>>0;
  }
  function api(name,...args) {
    if(!entries[name]) {
      const dll=/^(DrawIcon|DrawIconEx|CreateIcon|DestroyIcon|LoadIconA|CopyIcon)$/.test(name)?'user32.dll':'gdi32.dll';
      dlls[dll] ||= call(r(iat('LoadLibraryA')),[str(dll)]);
      entries[name]=call(r(iat('GetProcAddress')),[dlls[dll],str(name)]);assert(entries[name],name);
    }
    return call(entries[name],args);
  }
  const W=48,H=48,bmi=alloc(40),out=alloc(4),point=alloc(8),box=alloc(16);
  [40,W,-H,1|(32<<16),0,0,0,0,0,0].forEach((v,i)=>w(bmi+i*4,v));
  const initial=[e.gdi_dc_state_used(),e.gdi_object_used()];
  const dc=api('CreateCompatibleDC',0),bitmap=api('CreateDIBSection',dc,bmi,0,out,0,0);assert(dc&&bitmap);
  const bits=r(out),old=api('SelectObject',dc,bitmap);assert(old);
  const bg=0x73512f,fg=0x224466;
  const fill=()=>{for(let i=0;i<W*H;i++)w(bits+i*4,bg);};
  const pixels=()=>Array.from({length:W*H},(_,i)=>r(bits+i*4)&0xffffff);
  const and=alloc(128),xor=alloc(4096);
  for(let i=0;i<1024;i++)w(xor+i*4,fg);
  function create() {const icon=api('CreateIcon',0,32,32,1,32,and,xor);assert(icon);return icon;}
  const clip=api('CreateRectRgn',5,4,37,38),hole=api('CreateRectRgn',12,13,18,21),readClip=api('CreateRectRgn',0,0,0,0);
  assert(api('CombineRgn',clip,clip,hole,4));
  function state() {
    const s={};
    for(const name of ['GetTextColor','GetBkColor','GetBkMode','GetROP2','GetPolyFillMode','GetStretchBltMode','GetMapMode','GetTextAlign'])s[name]=api(name,dc);
    for(const kind of [1,2,6,7])s['object'+kind]=api('GetCurrentObject',dc,kind);
    for(const name of ['GetCurrentPositionEx','GetBrushOrgEx','GetWindowOrgEx','GetWindowExtEx','GetViewportOrgEx','GetViewportExtEx']) {
      assert.equal(api(name,dc,point),1);s[name]=[r(point),r(point+4)];
    }
    s.clip=api('GetClipRgn',dc,readClip);
    if(s.clip===1){assert(api('GetRgnBox',readClip,box));s.box=[0,4,8,12].map(i=>r(box+i));assert.equal(api('EqualRgn',readClip,clip),1);}
    return s;
  }
  const draw=(name,hdc,icon)=>name==='DrawIcon'?api(name,hdc,3,2,icon):api(name,hdc,3,2,icon,32,32,0,0,3);
  const baseline=process.env.DRAWICON_BASELINE==='1',failures=[];
  let cases=0;
  for(const name of ['DrawIcon','DrawIconEx'])for(const mapped of [false,true])for(const clipped of [false,true]) {
    assert(api('SetMapMode',dc,1));assert(api('SetWindowOrgEx',dc,mapped?2:0,mapped?-1:0,0));
    assert(api('SetViewportOrgEx',dc,mapped?5:0,mapped?3:0,0));assert(api('SelectClipRgn',dc,clipped?clip:0));
    api('SetTextColor',dc,0x123456);api('SetBkColor',dc,0xabcdef);api('SetBkMode',dc,1);
    api('SetROP2',dc,7);api('SetPolyFillMode',dc,2);api('SetStretchBltMode',dc,3);
    api('SetTextAlign',dc,6);api('MoveToEx',dc,19,18,0);api('SetBrushOrgEx',dc,2,3,0);
    const icon=create(),beforeState=state(),saved=api('SaveDC',dc);assert(saved);fill();
    assert.equal(draw(name,dc,icon),1,'live icon drawing succeeds');
    const x0=mapped?6:3,y0=mapped?6:2;
    const drawn=pixels();let changed=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
      const visible=x>=x0&&y>=y0&&x<x0+32&&y<y0+32&&(!clipped||(x>=5&&y>=4&&x<37&&y<38&&!(x>=12&&y>=13&&x<18&&y<21)));
      assert.equal(drawn[y*W+x],visible?fg:bg,'valid pixels, mapping and exact clip');checks++;if(visible)changed++;
    }
    assert(changed);assert.deepEqual(state(),beforeState);
    const deadDC=api('CreateCompatibleDC',0);assert(deadDC);assert.equal(api('DeleteDC',deadDC),1);
    // Test the stale DC before any allocator can reuse its slot.
    for(const badDC of [deadDC,0,0xdeadbeef]) {
      const result=draw(name,badDC,icon);assert.equal(result,baseline?1:0,'invalid DC must fail');
      failures.push({name,kind:'invalidDC',handle:badDC,result});assert.deepEqual(pixels(),drawn);assert.deepEqual(state(),beforeState);
    }
    assert.equal(api('DestroyIcon',icon),1);
    for(const badIcon of [icon,0,0xdeadbeef]) {
      const result=draw(name,dc,badIcon);assert.equal(result,baseline?1:0,'destroyed/invalid icon must fail');
      failures.push({name,kind:badIcon===icon?'destroyedIcon':'invalidIcon',handle:badIcon,result});
      assert.deepEqual(pixels(),drawn);assert.deepEqual(state(),beforeState);
    }
    assert.equal(api('RestoreDC',dc,saved),1);assert.deepEqual(state(),beforeState);cases++;
  }
  // Opaque system copies still have no renderer: propagate its existing zero.
  const opaque=api('CopyIcon',api('LoadIconA',0,32512));assert(opaque);
  for(const name of ['DrawIcon','DrawIconEx']) {const before=pixels();assert.equal(draw(name,dc,opaque),baseline?1:0);assert.deepEqual(pixels(),before);}
  assert.equal(api('DestroyIcon',opaque),1);
  let legacyCases=0;
  if(e.drawicon_fixture_bitmap_wrapper) {
    const used=[e.gdi_dc_state_used(),e.gdi_object_used()];
    // Transfer a real public CreateBitmap result into the legacy owned wrapper.
    // Repeated valid and failing blits must release their temporary source DC.
    const source=api('CreateBitmap',32,32,1,32,xor);assert(source);
    const legacy=e.drawicon_fixture_bitmap_wrapper(source)>>>0;assert(legacy);
    for(let i=0;i<600;i++)for(const name of ['DrawIcon','DrawIconEx']) {
      fill();const occupied=[e.gdi_dc_state_used(),e.gdi_object_used()];
      assert.equal(draw(name,dc,legacy),1);const before=pixels();
      for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
        const visible=x>=6&&y>=6&&x<38&&y<38&&x>=5&&x<37&&y>=4&&y<38&&!(x>=12&&y>=13&&x<18&&y<21);
        assert.equal(before[y*W+x],visible?fg:bg,'legacy pixels, mapping and exact clip');checks++;
      }
      const beforeState=state();
      for(const bad of [0,0xdeadbeef]) {
        assert.equal(draw(name,bad,legacy),baseline?1:0,'legacy BitBlt failure reaches public BOOL');
        assert.deepEqual(pixels(),before);assert.deepEqual(state(),beforeState);legacyCases++;
      }
      assert.deepEqual([e.gdi_dc_state_used(),e.gdi_object_used()],occupied,'temporary source DC released');
    }
    const crowded=[],before=pixels(),beforeState=state(),saved=api('SaveDC',dc);assert(saved);
    for(let i=0;i<e.gdi_dc_state_capacity()+1;i++) {
      const extra=api('CreateCompatibleDC',0);if(!extra)break;crowded.push(extra);
    }
    assert.equal(api('CreateCompatibleDC',0),0,'source DC allocation really exhausted');
    for(const name of ['DrawIcon','DrawIconEx']) {
      assert.equal(draw(name,dc,legacy),baseline?1:0,'temporary DC allocation failure propagates');
      assert.deepEqual(pixels(),before);assert.deepEqual(state(),beforeState);
    }
    for(const extra of crowded)assert.equal(api('DeleteDC',extra),1);
    assert.equal(api('RestoreDC',dc,saved),1);assert.deepEqual(state(),beforeState);
    assert.equal(draw('DrawIconEx',dc,legacy),1,'drawing recovers after DC exhaustion');
    assert.equal(api('DestroyIcon',legacy),1);
    for(const name of ['DrawIcon','DrawIconEx'])assert.equal(draw(name,dc,legacy),baseline?1:0);
    assert.deepEqual([e.gdi_dc_state_used(),e.gdi_object_used()],used,'legacy bitmap ownership released');
  }
  for(let i=0;i<600;i++) {
    const used=[e.gdi_dc_state_used(),e.gdi_object_used()],icon=create();
    assert.equal(draw(i%2?'DrawIcon':'DrawIconEx',dc,icon),1);assert.equal(api('DestroyIcon',icon),1);
    assert.deepEqual([e.gdi_dc_state_used(),e.gdi_object_used()],used,'icon/draw lifetime');
  }
  assert(api('SelectObject',dc,old));assert.equal(api('DeleteObject',bitmap),1);assert.equal(api('DeleteDC',dc),1);
  for(const handle of [clip,hole,readClip])assert.equal(api('DeleteObject',handle),1);
  assert.deepEqual([e.gdi_dc_state_used(),e.gdi_object_used()],initial,'all DCs and objects released');
  const report={passed:true,baseline,cases,calls,checks,lifetimes:600,legacyCases,failures};
  if(process.env.DRAWICON_TEST_REPORT)fs.writeFileSync(process.env.DRAWICON_TEST_REPORT,JSON.stringify(report)+'\n');
  console.log(JSON.stringify(report));
}
if(require.main===module)main().catch(err=>{console.error(err.stack);process.exitCode=1;});
module.exports={main,legacyWat};
