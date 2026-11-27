#!/usr/bin/env node
'use strict';
// Actual USER/GDI thunks. Expected masks are independent literal pixels.
// Ownership: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getdcex
// Screen-space system regions: https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getrandomrgn
const assert = require('assert'), fs = require('fs'), crypto = require('crypto');
const {bootRenderHarness} = require('./render-helper');
const {compileSrcWasm} = require('./compile-src');
const {makeFixture, iat} = require('../tools/kernel32-native-fixture');
const u32 = v => [v,v>>>8,v>>>16,v>>>24].map(b=>b&255);
async function main() {
  const bytes = process.env.GETDCEX_HIERARCHY_MODULE ? fs.readFileSync(process.env.GETDCEX_HIERARCHY_MODULE) : compileSrcWasm();
  console.log(JSON.stringify({moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
  const {exports:e,memory} = await bootRenderHarness({fonts:'none',prebuiltModule:new WebAssembly.Module(bytes)});
  const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_api_log(0);
  const alloc=n=>e.guest_alloc(n)>>>0,w=(p,v)=>e.guest_write32(p,v),r=p=>e.guest_read32(p)>>>0;
  const code=b=>{const p=alloc(b.length);b.forEach((v,i)=>e.guest_write8(p+i,v));return p;};
  const str=s=>code([...Buffer.from(s),0]),put=(p,a)=>a.forEach((v,i)=>w(p+4*i,v));
  const stack=alloc(32768)+16384;let calls=0,checks=0;
  function call(entry,args) {
    w(stack,0);args.forEach((v,i)=>w(stack+4+i*4,v));e.set_esp(stack);e.clear_yield();e.set_eip(entry);
    for(let i=0;i<256&&e.get_eip();i++)e.run(2048);
    assert.strictEqual(e.get_eip(),0,'public call returned');
    assert.strictEqual(e.get_esp()>>>0,stack+4+args.length*4,'stdcall ESP');
    assert.strictEqual(e.get_sync_msg_depth(),0,'callback context unwound');calls++;return e.get_eax()>>>0;
  }
  const libs={},entries={};
  for(const dll of ['user32.dll','gdi32.dll']){libs[dll]=call(r(iat('LoadLibraryA')),[str(dll)]);assert(libs[dll]);}
  function entry(dll,name){const k=dll+':'+name;entries[k]||=call(r(iat('GetProcAddress')),[libs[dll],str(name)]);assert(entries[k],k);return entries[k];}
  const user=(n,...a)=>call(entry('user32.dll',n),a),gdi=(n,...a)=>call(entry('gdi32.dll',n),a);
  const failures=[],counts={};
  function check(a,b,label){checks++;try{assert.deepStrictEqual(a,b,label);}catch(err){counts[label]=(counts[label]||0)+1;if(failures.length<20)failures.push(err.message);}}
  const eq=(a,b,label)=>{checks++;assert.deepStrictEqual(a,b,label);};
  const rect=alloc(16),point=alloc(8),box=alloc(16),ps=alloc(64),all=alloc(16);put(all,[0,0,12,10]);
  const red=gdi('CreateSolidBrush',0xff),black=gdi('CreateSolidBrush',0);
  const quiet=code([0xb8,...u32(1),0xc2,16,0]);
  function window(parent,x,y,width=72,height=64,style=0) {
    const h=user('CreateWindowExA',0,str('STATIC'),str('GetDCEx clip'),(parent?0x50000000:0x10000000)|style,
      x,y,width,height,parent,0,0x400000,0);assert(h);
    assert(user('SetWindowLongA',h,-4,quiet));assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));
    user('ValidateRect',h,0);return h;
  }

  const root=window(0,23,31,160,140,0x00c00000|0x00800000);
  const upper=window(root,27,17,4,5),target=window(root,19,17,30,28),kid=window(target,2,2,4,4);
  const grand=window(kid,1,1,2,2);
  const lower=window(root,19,24,6,3),hidden=window(target,0,0,3,2),away=window(target,40,40,4,4);
  user('ShowWindow',hidden,0);
  const mainKid=window(root,2,2,4,4);
  const full=Array(10).fill('############'),empty=Array(10).fill('............');
  const children=['############','############','##....######','##....######','##....######','##....######',...Array(4).fill('############')];
  const siblings=[...Array(5).fill('########....'),...Array(5).fill('############')];
  const both=children.map((s,y)=>[...s].map((c,x)=>c==='#'&&siblings[y][x]==='#'?'#':'.').join(''));
  const shifted=['############','############','############','###....#####','###....#####','###....#####','###....#####','############','############','############'];
  const band=Array(10).fill('######......'),and=(a,b)=>a.map((s,y)=>[...s].map((c,x)=>c==='#'&&b[y][x]==='#'?'#':'.').join(''));
  const frame=['############','#..........#','#..........#','#..........#','#..........#','#..........#','#..........#','#..........#','#..........#','############'];
  const output=gdi('CreateRectRgn',0,0,0,0),app=gdi('CreateRectRgn',0,0,3,10);
  function mask(label,dc,rows,draw=false){assert.strictEqual(rows.length,10);assert(rows.every(row=>row.length===12));for(let y=0;y<10;y++)for(let x=0;x<12;x++)check(draw?gdi('GetPixel',dc,x,y)===0xff:!!gdi('PtVisible',dc,x,y),rows[y][x]==='#',label);}
  function origin(h,whole){if(whole){assert(user('GetWindowRect',h,rect));return[r(rect)|0,r(rect+4)|0];}put(point,[0,0]);assert(user('ClientToScreen',h,point));return[r(point)|0,r(point+4)|0];}
  let cases=0;
  function run(h,flags,rows,label,regionFlag=0,hole=false){
    cases++;const clear=user('GetDCEx',h,0,flags&1);assert(clear);assert(user('FillRect',clear,all,black));assert(user('ReleaseDC',h,clear));
    const [x,y]=origin(h,flags&1),src=regionFlag?gdi('CreateRectRgn',x,y,x+(hole?12:6),y+10):0;
    if(hole){const inner=gdi('CreateRectRgn',x+1,y+1,x+11,y+9);assert(gdi('CombineRgn',src,src,inner,4));assert(gdi('DeleteObject',inner));}
    const dc=user('GetDCEx',h,src,flags|regionFlag);assert(dc,label);
    const operand=hole?frame:band,opposite=operand.map(row=>[...row].map(c=>c==='#'?'.':'#').join(''));
    const expected=regionFlag===0x80?and(rows,operand):regionFlag===0x40?and(rows,opposite):rows;
    mask(label,dc,expected);check(gdi('GetClipRgn',dc,output),0,label+' app absent');assert(gdi('SaveDC',dc));assert(gdi('SelectClipRgn',dc,app));
    mask(label+' app intersection',dc,and(expected,Array(10).fill('###.........')));assert(gdi('RestoreDC',dc,-1));mask(label+' restore',dc,expected);
    assert(user('FillRect',dc,all,red));assert(user('ReleaseDC',h,dc));
    const read=user('GetDCEx',h,0,flags&1);assert(read);mask(label+' actual pixels',read,expected,true);assert(user('ReleaseDC',h,read));
  }
  for(const whole of [0,1])for(const regionFlag of [0,0x40,0x80]){
    run(target,whole,full,'styleless no flags',regionFlag);
    run(target,whole|8,children,'explicit children',regionFlag);
    run(target,whole|16,siblings,'explicit siblings',regionFlag);
    run(target,whole|24,both,'explicit both',regionFlag);
    run(root,whole|8,whole?full:children,'main explicit children origins',regionFlag);
  }
  for(const flag of [0x40,0x80])for(const whole of [0,1])run(target,whole|24,both,'complex hole hierarchy',flag,true);
  // Style clipping remains intact for ordinary acquisitions and explicit flags
  // additionally work without the corresponding style bits.
  user('SetWindowLongA',target,-16,0x52000000);run(target,0,children,'WS_CLIPCHILDREN');run(target,16,both,'child style plus explicit sibling');
  user('SetWindowLongA',target,-16,0x54000000);run(target,0,siblings,'WS_CLIPSIBLINGS');run(target,8,both,'sibling style plus explicit child');
  const ordinary=user('GetDC',target);mask('ordinary GetDC style',ordinary,siblings);assert(user('ReleaseDC',target,ordinary));
  user('SetWindowLongA',target,-16,0x50000000);
  const windowDC=user('GetWindowDC',target);mask('ordinary GetWindowDC unchanged',windowDC,full);assert(user('ReleaseDC',target,windowDC));
  const held=user('GetDCEx',target,0,24);assert(held);mask('held initial',held,both);
  user('ShowWindow',kid,0);mask('hidden child refresh',held,siblings);
  user('ShowWindow',upper,0);mask('hidden sibling refresh',held,full);
  user('ShowWindow',kid,5);mask('shown child refresh',held,children);
  user('ShowWindow',upper,5);mask('shown sibling refresh',held,both);
  user('ShowWindow',target,0);mask('hidden target',held,empty);user('ShowWindow',target,5);mask('shown target',held,both);
  assert(user('ReleaseDC',target,held));run(target,0,full,'released hierarchy not retained');
  // A positioned bordered child distinguishes client and window origins.
  const bordered=window(root,65,40,30,28,0x00800000),borderKid=window(bordered,2,2,4,4);
  assert.notDeepStrictEqual(origin(bordered,false),origin(bordered,true),'bordered origins differ');
  run(bordered,8,children,'bordered client children');run(bordered,9,shifted,'bordered window children');
  // Parent client bounds clip a partly-outside child even with explicit flags.
  const edge=window(target,24,12,20,20);run(edge,24,Array(10).fill('######......'),'ancestor client clipping');user('ShowWindow',edge,0);
  assert(user('LockWindowUpdate',root));const locked=user('GetDCEx',target,0,24),bypass=user('GetDCEx',target,0,0x418);assert(locked&&bypass);
  mask('lock applies',locked,empty);mask('explicit hierarchy lock bypass',bypass,both);assert(user('LockWindowUpdate',0));mask('unlock refresh retains flags',locked,both);
  assert(user('ReleaseDC',target,locked));assert(user('ReleaseDC',target,bypass));

  // The grandchild is clipped to its immediate parent's client bounds.
  run(kid,8,['####........','#..#........','#..#........','####........',...Array(6).fill('............')],'grandchild exclusion');
  const clippedKid=window(bordered,-2,-2,4,4);
  run(bordered,9,['############','#..#########','#..#########','###....#####','###....#####','###....#####','###....#####','############','############','############'],'child clipped to client in window DC');
  user('ShowWindow',clippedKid,0);
  // Refresh must preserve the immutable supplied operand as well as flags.
  const [tx,ty]=origin(target,false),request=gdi('CreateRectRgn',tx,ty,tx+6,ty+10),requestDc=user('GetDCEx',target,request,0x98);assert(requestDc);
  mask('held supplied AND hierarchy',requestDc,and(both,band));user('ShowWindow',kid,0);mask('held supplied refresh',requestDc,band);
  user('ShowWindow',kid,5);mask('held supplied restored hierarchy',requestDc,and(both,band));assert(user('ReleaseDC',target,requestDc));
  // Allocation failures retain caller ownership and free the acquired DC.
  const source=gdi('CreateRectRgn',tx,ty,tx+6,ty+10),heldRegions=[];
  for(let i=0;i<256;i++){const q=gdi('CreateRectRgn',0,0,1,1);if(!q)break;heldRegions.push(q);}assert(heldRegions.length>200);
  for(let slots=0;slots<3;slots++){
    for(const supplied of [false,true]){
      const before=e.gdi_dc_state_used(),dc=user('GetDCEx',target,supplied?source:0,24|(supplied?0x80:0));
      check(dc,0,'exhausted region capacity '+slots+' source='+supplied);if(dc)user('ReleaseDC',target,dc);
      check(e.gdi_dc_state_used(),before,'failed acquisition no DC leak');check(gdi('GetRgnBox',source,box),2,'failed acquisition retains source');
    }
    assert(gdi('DeleteObject',heldRegions.pop()));
  }
  for(const q of heldRegions)assert(gdi('DeleteObject',q));assert(gdi('DeleteObject',source));run(target,24,both,'capacity recovery');
  const used=e.gdi_dc_state_used();for(let i=0;i<600;i++){const dc=user('GetDCEx',target,0,24);assert(dc);assert(gdi('SaveDC',dc));assert(user('ReleaseDC',target,dc));}check(e.gdi_dc_state_used(),used,'600 releases no DC leak');
  for(const q of [output,app,red,black])assert(gdi('DeleteObject',q));
  console.log(JSON.stringify({cases,calls,checks,failures:counts,examples:failures}));assert.strictEqual(failures.length,0,'GetDCEx hierarchy public masks');
  console.log('PASS GetDCEx explicit hierarchy flags, public pixels and lifecycle');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
