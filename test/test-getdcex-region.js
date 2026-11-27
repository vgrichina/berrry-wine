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
  const bytes = process.env.GETDCEX_TEST_MODULE ? fs.readFileSync(process.env.GETDCEX_TEST_MODULE) : compileSrcWasm();
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
  const root=window(0,23,31,160,140,0x00c00000|0x00800000),child=window(root,19,17,40,34,0x00800000);
  function origin(h,whole){
    if(!h||h===0x10000)return [0,0];
    if(whole){assert(user('GetWindowRect',h,rect));return [r(rect)|0,r(rect+4)|0];}
    put(point,[0,0]);assert(user('ClientToScreen',h,point));return [r(point)|0,r(point+4)|0];
  }
  assert.notDeepStrictEqual(origin(root,false),origin(root,true),'main nonclient/client origins differ');
  assert.notDeepStrictEqual(origin(child,false),origin(child,true),'bordered child origins differ');
  assert(origin(child,true)[0]>origin(root,false)[0],'child position contributes to screen origin');
  const blank='............',full=Array(10).fill('############'),empty=Array(10).fill(blank);
  const disjoint=[blank,'.###........','.###........','.###........',blank,'.......###..','.......###..','.......###..',blank,blank];
  const hole=[blank,'.#########..','.#.......#..','.#.......#..','.#.......#..','.#.......#..','.#.......#..','.#########..',blank,blank];
  const invert=rows=>rows.map(s=>[...s].map(c=>c==='#'?'.':'#').join(''));
  function mask(label,fn,rows){eq(rows.length,10,label+' rows');for(let y=0;y<10;y++){eq(rows[y].length,12,label+' columns');for(let x=0;x<12;x++)check(!!fn(x,y),rows[y][x]==='#',label);}}
  const shapeRects={disjoint:[[1,1,4,4],[7,5,10,8]],hole:[[1,1,10,8],[2,2,9,7]],empty:[]};
  function region(shape,ox,oy){
    const out=gdi('CreateRectRgn',0,0,0,0);assert(out);
    for(const [i,a] of shapeRects[shape].entries()){
      const q=gdi('CreateRectRgn',a[0]+ox,a[1]+oy,a[2]+ox,a[3]+oy);assert(q);
      assert(gdi('CombineRgn',out,out,q,shape==='hole'&&i===1?4:2));assert(gdi('DeleteObject',q));
    }return out;
  }
  const output=gdi('CreateRectRgn',0,0,0,0),app=gdi('CreateRectRgn',0,0,3,10);
  const broad=gdi('CreateRectRgn',-10000,-10000,10000,10000);
  function ordinary(h,whole){const dc=user('GetDCEx',h,0,whole?1:0);assert(dc);return dc;}
  function runCase(h,whole,shape,flag,rows,extra=0,baseRows=full){
    const label=`hwnd=${h} whole=${whole} ${shape} flag=${flag} extra=${extra}`;
    const [ox,oy]=origin(h,whole),clear=ordinary(h,whole);assert(user('FillRect',clear,all,black));assert(user('ReleaseDC',h,clear));
    const src=shape==='null'?0:region(shape,ox,oy);
    const dc=user('GetDCEx',h,src,(whole?1:0)|flag|extra);assert(dc,label);
    mask(label+' PtVisible',(x,y)=>gdi('PtVisible',dc,x,y),rows);
    check(gdi('GetClipRgn',dc,output),0,label+' no application clip');
    // Expanding or removing app clipping cannot expand USER's request.
    assert(gdi('SelectClipRgn',dc,broad));mask(label+' broad app',(x,y)=>gdi('PtVisible',dc,x,y),rows);
    assert(gdi('SelectClipRgn',dc,0));const saved=gdi('SaveDC',dc);assert(saved);
    assert(gdi('SelectClipRgn',dc,app));check(gdi('GetClipRgn',dc,output),1,label+' selected app clip');
    check(gdi('EqualRgn',output,app),1,label+' GetClipRgn is app only');
    mask(label+' app AND system',(x,y)=>gdi('PtVisible',dc,x,y),rows.map(s=>s.slice(0,3)+'.'.repeat(9)));
    assert(gdi('RestoreDC',dc,-1));check(gdi('GetClipRgn',dc,output),0,label+' restored app absent');
    mask(label+' restored system',(x,y)=>gdi('PtVisible',dc,x,y),rows);
    assert(user('FillRect',dc,all,red));assert(user('ReleaseDC',h,dc));
    // Once ownership transferred the caller does not touch src again.
    if(src&&!flag)assert(gdi('DeleteObject',src),'flags absent retains caller ownership');
    const read=ordinary(h,whole);mask(label+' drawing',(x,y)=>gdi('GetPixel',read,x,y)===0xff,rows);
    mask(label+' reacquire no retained clip',(x,y)=>gdi('PtVisible',read,x,y),baseRows);assert(user('ReleaseDC',h,read));
  }
  for(const h of [root,child])for(const whole of [false,true]){
    for(const [shape,rows] of [['disjoint',disjoint],['hole',hole],['empty',empty]]){
      runCase(h,whole,shape,0x80,rows);runCase(h,whole,shape,0x40,invert(rows));
    }
    runCase(h,whole,'null',0x80,empty);runCase(h,whole,'null',0x40,full);
    runCase(h,whole,'hole',0,full);
  }
  for(const h of [0,0x10000])for(const flag of [0x40,0x80])runCase(h,false,'disjoint',flag,flag===0x80?disjoint:invert(disjoint));
  const ignored=user('GetDCEx',child,0x7fffff00,0);assert(ignored,'without region flags even invalid hrgnClip is ignored');assert(user('ReleaseDC',child,ignored));
  const parent=window(root,70,5,30,34);
  const edge=window(parent,24,0,40,34),six=Array(10).fill('######......');
  const intersectEdge=[blank,'.###........','.###........','.###........',...Array(6).fill(blank)];
  const excludeEdge=['######......','#...##......','#...##......','#...##......',...Array(6).fill('######......')];
  for(const whole of [false,true]){
    runCase(edge,whole,'disjoint',0x80,intersectEdge,0,six);
    runCase(edge,whole,'disjoint',0x40,excludeEdge,0,six);
  }
  // Lock then acquire: bypass must retain its supplied shape; ordinary must
  // remain empty. Unlock/visibility refresh must not discard that shape.
  assert(user('LockWindowUpdate',root));
  const [ox,oy]=origin(child,false),locked=user('GetDCEx',child,region('hole',ox,oy),0x80);
  const bypass=user('GetDCEx',child,region('disjoint',ox,oy),0x480);assert(locked&&bypass);
  mask('locked request',(x,y)=>gdi('PtVisible',locked,x,y),empty);
  mask('bypass request',(x,y)=>gdi('PtVisible',bypass,x,y),disjoint);
  assert(user('LockWindowUpdate',0));
  mask('unlock retains request',(x,y)=>gdi('PtVisible',locked,x,y),hole);
  mask('unlock retains bypass request',(x,y)=>gdi('PtVisible',bypass,x,y),disjoint);
  user('ShowWindow',child,0);user('ShowWindow',child,5);
  mask('visibility refresh retains request',(x,y)=>gdi('PtVisible',locked,x,y),hole);
  assert(user('ReleaseDC',child,locked));assert(user('ReleaseDC',child,bypass));
  if(failures.length){console.log(JSON.stringify({calls,checks,failures:counts,examples:failures}));assert.fail('public pixel/clip failures before lifecycle stress');}
  // More than the DC table capacity, including outstanding SaveDC nodes.
  const used=e.gdi_dc_state_used();
  for(let i=0;i<600;i++){
    const src=region('hole',ox,oy),dc=user('GetDCEx',child,src,0x80);assert(dc);
    assert(gdi('SaveDC',dc));assert(gdi('SelectClipRgn',dc,app));assert(user('ReleaseDC',child,dc));
  }
  eq(e.gdi_dc_state_used(),used,'600 releases with saved state do not leak DCs');
  // Exhaust public HRGNs. Failure must preserve caller ownership and release
  // the acquired DC. Each available-slot boundary exercises partial setup.
  const source=region('hole',ox,oy),held=[];
  for(let i=0;i<256;i++){const q=gdi('CreateRectRgn',0,0,1,1);if(!q)break;held.push(q);}
  assert(held.length>200,'real region capacity exhausted');
  for(let slots=0;slots<3;slots++){
    const before=e.gdi_dc_state_used(),dc=user('GetDCEx',child,source,0x80);
    check(dc,0,'atomic failure with '+slots+' free regions');if(dc)user('ReleaseDC',child,dc);
    check(e.gdi_dc_state_used(),before,'failed call leaves no DC');
    check(gdi('GetRgnBox',source,box),3,'failed call retains source');
    if(held.length)assert(gdi('DeleteObject',held.pop()));
  }
  for(const q of held)assert(gdi('DeleteObject',q));
  assert(gdi('DeleteObject',source));runCase(child,false,'hole',0x80,hole);
  // A representable 200-hole input can require more than 208 output bands
  // when subtracted. Boolean overflow must fail atomically, not fall back to
  // the bounding rectangle or consume the caller's region.
  const [rx,ry]=origin(root,false),many=gdi('CreateRectRgn',0,0,0,0);
  for(let y=0;y<20;y++)for(let x=0;x<10;x++){
    const q=gdi('CreateRectRgn',rx+2+x*3,ry+2+y*3,rx+3+x*3,ry+3+y*3);
    assert(q);assert(gdi('CombineRgn',many,many,q,2));assert(gdi('DeleteObject',q));
  }
  const copy=gdi('CreateRectRgn',0,0,0,0);assert(gdi('CombineRgn',copy,many,0,5));
  const beforeOverflow=e.gdi_dc_state_used(),overflow=user('GetDCEx',root,many,0x40);
  check(overflow,0,'unrepresentable difference fails');if(overflow)user('ReleaseDC',root,overflow);
  check(gdi('EqualRgn',many,copy),1,'overflow preserves source');
  check(e.gdi_dc_state_used(),beforeOverflow,'overflow releases failed DC');
  assert(gdi('DeleteObject',many));assert(gdi('DeleteObject',copy));runCase(root,false,'hole',0x40,invert(hole));
  const invalid=region('hole',ox,oy);check(user('GetDCEx',0x7fffff00,invalid,0x80),0,'invalid hwnd fails');
  eq(gdi('GetRgnBox',invalid,box),3,'failed invalid hwnd preserves source');assert(gdi('DeleteObject',invalid));
  for(const q of [output,app,broad,red,black])assert(gdi('DeleteObject',q));
  console.log(JSON.stringify({calls,checks,failures:counts,examples:failures}));
  assert.strictEqual(failures.length,0,'GetDCEx region contract failures');
  console.log('PASS GetDCEx exact immutable system clipping, public drawing and lifecycle');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
