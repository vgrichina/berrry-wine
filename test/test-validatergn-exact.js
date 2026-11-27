#!/usr/bin/env node
'use strict';
// Actual USER/GDI imports, literal pixel masks, and real x86 callbacks.
// No private helper exports or helper-derived expected regions.
const assert = require('assert'), fs = require('fs'), crypto = require('crypto');
const {bootRenderHarness} = require('./render-helper');
const {compileSrcWasm} = require('./compile-src');
const {makeFixture, iat} = require('../tools/kernel32-native-fixture');
const u32 = v => [v,v>>>8,v>>>16,v>>>24].map(b=>b&255);
async function main() {
  const bytes = process.env.UPDATE_REGION_TEST_MODULE
    ? fs.readFileSync(process.env.UPDATE_REGION_TEST_MODULE) : compileSrcWasm();
  console.log(JSON.stringify({moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
  const {exports:e,memory} = await bootRenderHarness({fonts:'none',prebuiltModule:new WebAssembly.Module(bytes)});
  const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_api_log(0);
  const alloc=n=>e.guest_alloc(n)>>>0,w=(p,v)=>e.guest_write32(p,v),r=p=>e.guest_read32(p)>>>0;
  const code=b=>{const p=alloc(b.length);b.forEach((v,i)=>e.guest_write8(p+i,v));return p;};
  const str=s=>code([...Buffer.from(s),0]),put=(p,a)=>a.forEach((v,i)=>w(p+4*i,v));
  const read=p=>[0,4,8,12].map(o=>r(p+o));
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
  const eq=(a,b,label)=>{checks++;assert.deepStrictEqual(a,b,label);};
  const rect=alloc(16),box=alloc(16),ps=alloc(64),all=alloc(16);put(all,[0,0,16,14]);
  const output=gdi('CreateRectRgn',90,91,98,99),full=gdi('CreateRectRgn',0,0,1000,1000);
  const red=gdi('CreateSolidBrush',0xff),black=gdi('CreateSolidBrush',0);
  const quiet=code([0xb8,...u32(1),0xc2,16,0]);
  function window(parent=0,width=16) {
    const h=user('CreateWindowExA',0,str('STATIC'),str('Exact damage'),parent?0x50000000:0x90000000,
      0,0,width,14,parent,0,0x400000,0);assert(h);
    assert(user('SetWindowLongA',h,-4,quiet));assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));
    assert(user('ValidateRect',h,0));return h;
  }
  const main=window(),child=window(main),other=window();
  eq(e.get_main_hwnd()>>>0,main,'actual main HWND');
  // The expected pixels below are literals, independent of the region engine.
  // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-validatergn
  // NULL removes the client area. A valid empty HRGN removes no pixels.
  // Invalid HRGN return semantics are unspecified; preserve historical no-op.
  const blank='................',empty=Array(14).fill(blank);
  const base=[blank,...Array(9).fill('.###########....'),...Array(4).fill(blank)];
  const disjoint=[blank,'.###########....',...Array(6).fill('.#..####..##....'),
    '.###########....','.###########....',...Array(4).fill(blank)];
  const hole=[blank,'.###########....','.#.........#....','.#.........#....',
    ...Array(3).fill('.#..####...#....'),'.#.........#....','.#.........#....',
    '.###########....',...Array(4).fill(blank)];
  const overlap=[blank,'.###########....',...Array(2).fill('.#.....#####....'),
    ...Array(2).fill('.#........##....'),...Array(2).fill('.####.....##....'),
    '.###########....','.###########....',...Array(4).fill(blank)];
  const gap=[...Array(3).fill(blank),...Array(3).fill('.....##.........'),...Array(8).fill(blank)];
  const island=[...Array(4).fill(blank),...Array(3).fill('....####........'),...Array(7).fill(blank)];
  const newest=[...Array(10).fill(blank),'............##..','............##..',blank,blank];
  const repeated=[blank,'.###########....',...Array(6).fill('.#......####....'),
    '.###########....','.###########....','............##..','............##..',blank,blank];
  const failures=[],failureCounts={};
  const check=(a,b,label)=>{checks++;try{assert.deepStrictEqual(a,b,label);}catch(e){
    const group=label.split(' [')[0];failureCounts[group]=(failureCounts[group]||0)+1;
    if(failures.length<24)failures.push(e.message);}};
  function mask(label,fn,rows){eq(rows.length,14,label+' rows');for(let y=0;y<14;y++){
    eq(rows[y].length,16,label+' columns');for(let x=0;x<16;x++)check(!!fn(x,y),rows[y][x]==='#',label+` [${x},${y}]`);}}
  function dirty(h,rs,erase=0){for(const a of rs){put(rect,a);assert(user('InvalidateRect',h,rect,erase));}}
  function query(label,h,rows,kind,bounds){
    check(user('GetUpdateRgn',h,output,0),kind,label+' complexity');
    check(gdi('GetRgnBox',output,box),kind,label+' region complexity');check(read(box),bounds,label+' bbox');
    mask(label+' query',(x,y)=>gdi('PtInRegion',output,x,y),rows);
    check(user('GetUpdateRect',h,box,0),kind===1?0:1,label+' bounding BOOL');check(read(box),bounds,label+' update bbox');
  }
  function paint(label,h,rows,bounds){
    const dc0=user('GetDC',h);assert(dc0);assert(user('FillRect',dc0,all,black));assert(user('ReleaseDC',h,dc0));
    const dc=user('BeginPaint',h,ps);assert(dc);check(read(ps+8),bounds,label+' rcPaint');
    mask(label+' BeginPaint',(x,y)=>gdi('PtVisible',dc,x,y),rows);
    gdi('SelectClipRgn',dc,full);mask(label+' immutable USER clip',(x,y)=>gdi('PtVisible',dc,x,y),rows);
    assert(user('FillRect',dc,all,red));check(user('GetUpdateRgn',h,output,0),1,label+' consumed');assert(user('EndPaint',h,ps));
    const rd=user('GetDC',h);assert(rd);mask(label+' painted pixels',(x,y)=>gdi('GetPixel',rd,x,y)===0xff,rows);assert(user('ReleaseDC',h,rd));
  }
  function shape(kind){
    if(kind==='NULL')return 0;
    const a=gdi('CreateRectRgn',...(kind==='empty'?[0,0,0,0]:kind==='full'?[-20,-20,40,40]:
      kind==='hole'?[2,2,11,9]:[2,2,4,8]));assert(a);
    if(['disjoint','hole','overlap'].includes(kind)){
      const b=gdi('CreateRectRgn',...(kind==='disjoint'?[8,2,10,8]:kind==='hole'?[4,4,8,7]:[5,4,10,8]));assert(b);
      if(kind==='overlap')assert(gdi('SetRectRgn',a,2,2,7,6));
      assert(gdi('CombineRgn',a,a,b,kind==='hole'?4:2));assert(gdi('DeleteObject',b));
    }return a;
  }
  const cases=[['disjoint','disjoint',[[1,1,12,10]],disjoint,3,[1,1,12,10]],
    ['hole','hole',[[1,1,12,10]],hole,3,[1,1,12,10]],
    ['overlap','overlap',[[1,1,12,10]],overlap,3,[1,1,12,10]],
    ['gap survives','disjoint',[[5,3,7,6]],gap,2,[5,3,7,6]],
    ['hole survives','hole',[[4,4,8,7]],island,2,[4,4,8,7]],
    ['empty unchanged','empty',[[1,1,12,10]],base,2,[1,1,12,10]],
    ['full cleared','full',[[1,1,12,10]],empty,1,[0,0,0,0]],
    ['NULL cleared','NULL',[[1,1,12,10]],empty,1,[0,0,0,0]],
    ['already clean','disjoint',[],empty,1,[0,0,0,0]]];
  for(const h of [main,child,other])for(const [name,kind,damage,rows,complexity,bounds] of cases){
    assert(user('ValidateRect',h,0));dirty(h,damage,1);const src=shape(kind);
    const sourceBox=src?(gdi('GetRgnBox',src,box),read(box)):null;
    const sourcePoint=src?gdi('PtInRegion',src,5,5):0;
    check(user('ValidateRgn',h,src),1,name+' BOOL');
    // Validation takes a snapshot, never owns or aliases the caller's HRGN.
    if(src){gdi('GetRgnBox',src,box);check(read(box),sourceBox,name+' source bbox untouched');
      check(gdi('PtInRegion',src,5,5),sourcePoint,name+' source shape untouched');
      assert(gdi('SetRectRgn',src,0,0,16,14));assert(gdi('DeleteObject',src));}
    query(name,h,rows,complexity,bounds);
    if(complexity!==1)paint(name,h,rows,bounds);
    else {assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));}
  }
  // Main/child isolation and a previously queried region snapshot.
  assert(user('ValidateRect',main,0));assert(user('ValidateRect',child,0));
  dirty(main,[[1,1,12,10]]);dirty(child,[[4,4,8,7]]);
  const s=shape('hole');assert(user('ValidateRgn',main,s));assert(gdi('DeleteObject',s));
  query('main independent',main,hole,3,[1,1,12,10]);assert(user('ValidateRgn',main,0));
  mask('query snapshot survives validation',(x,y)=>gdi('PtInRegion',output,x,y),hole);
  query('child independent',child,island,2,[4,4,8,7]);
  // Repeated subtraction and new invalidations keep their exact union.
  assert(user('ValidateRect',other,0));dirty(other,[[1,1,12,10]]);
  const repeat=shape('disjoint');assert(user('ValidateRgn',other,repeat));assert(user('ValidateRgn',other,repeat));
  assert(gdi('SetRectRgn',repeat,4,2,8,8));assert(user('ValidateRgn',other,repeat));
  assert(gdi('SetRectRgn',repeat,8,2,10,8));put(rect,[8,2,10,8]);assert(user('InvalidateRect',other,rect,0));
  dirty(other,[[12,10,14,12]]);assert(gdi('DeleteObject',repeat));
  query('repeated/new damage',other,repeated,3,[1,1,14,12]);paint('repeated/new damage',other,repeated,[1,1,14,12]);
  // Historical NULL-HWND and invalid-region behavior is a no-op. The docs
  // require a created HRGN and promise no specific invalid-handle result.
  dirty(other,[[12,10,14,12]]);check(user('ValidateRgn',0,full),1,'NULL HWND historical BOOL');
  check(user('ValidateRgn',other,0x12345678),1,'invalid HRGN historical BOOL');
  query('invalid HRGN unchanged',other,newest,2,[12,10,14,12]);
  assert(user('ValidateRect',other,0));dirty(other,[[1,1,12,10]]);
  const noSpareSource=shape('disjoint'),noSpare=[];
  for(let i=0;i<256;i++){const h=gdi('CreateRectRgn',0,0,0,0);if(!h)break;noSpare.push(h);}
  check(user('ValidateRgn',other,noSpareSource),1,'exact validation needs no spare HRGN');
  for(const h of noSpare)assert(gdi('DeleteObject',h));assert(gdi('DeleteObject',noSpareSource));
  query('no spare HRGN exact result',other,disjoint,3,[1,1,12,10]);paint('no spare HRGN exact result',other,disjoint,[1,1,12,10]);
  // A failed 416-span result must preserve all 208 old spans, notification,
  // and erase state, without needing a spare public HRGN handle.
  const wide=window(0,432),record=alloc(16),widePS=alloc(64),wideSample=alloc(432*3*4);
  const begin=entry('user32.dll','BeginPaint'),end=entry('user32.dll','EndPaint');
  const eraseProc=code([0x83,0x7c,0x24,8,0x14,0x75,6,0xff,0x05,...u32(record+4),
    0xb8,...u32(1),0xc2,16,0]);
  // WM_PAINT invokes the real BeginPaint/EndPaint; WM_ERASEBKGND counts.
  const paintBody=[
    0xff,0x05,...u32(record),0x68,...u32(widePS),0xff,0x74,0x24,8,
    0xb8,...u32(begin),0xff,0xd0];
  const visible=entry('gdi32.dll','PtVisible');
  for(let row=0;row<3;row++)for(let x=0;x<432;x++)paintBody.push(
    0x68,...u32(1+row*2),0x68,...u32(x),0xff,0x35,...u32(widePS),
    0xb8,...u32(visible),0xff,0xd0,0xa3,...u32(wideSample+4*(row*432+x)));
  paintBody.push(0x68,...u32(widePS),0x68,...u32(wide),0xb8,...u32(end),0xff,0xd0,0xb8,...u32(1),0xc2,16,0);
  const proc=code([0x83,0x7c,0x24,8,0x0f,0x74,7,0xb8,...u32(eraseProc),0xff,0xe0,...paintBody]);
  assert(user('SetWindowLongA',wide,-4,proc));
  console.log(JSON.stringify({beforeCapacity:true,checks,failureCounts,failures}));
  for(let pass=0;pass<2;pass++){
    assert(user('ValidateRect',wide,0));put(record,[0,0,0,0]);
    for(let x=0;x<416;x+=2)dirty(wide,[[x,1,x+1,6]],1);
    const cut=gdi('CreateRectRgn',0,3,432,4);assert(cut);
    // Add an outside disjoint piece so this is a genuinely complex HRGN.
    const outside=gdi('CreateRectRgn',0,10,1,11);assert(outside);assert(gdi('CombineRgn',cut,cut,outside,2));assert(gdi('DeleteObject',outside));
    const held=[];if(pass)for(let i=0;i<256;i++){const h=gdi('CreateRectRgn',0,0,0,0);if(!h)break;held.push(h);}
    check(user('ValidateRgn',wide,cut),0,'capacity BOOL FALSE');
    for(const h of held)assert(gdi('DeleteObject',h));assert(gdi('DeleteObject',cut));
    check(user('GetUpdateRgn',wide,output,0),3,'capacity old complexity');
    for(let y=0;y<7;y++)for(let x=0;x<432;x++)check(!!gdi('PtInRegion',output,x,y),
      x<416&&x%2===0&&y>=1&&y<6,'capacity preserved ['+x+','+y+']');
    assert(user('UpdateWindow',wide));check(r(record),1,'failed subtraction retains paint request');
    check(r(record+4),1,'failed subtraction retains erase request');check(read(widePS+8),[0,1,415,6],'failed subtraction paint bbox');
    for(let row=0;row<3;row++)for(let x=0;x<432;x++)check(!!r(wideSample+4*(row*432+x)),
      x<416&&x%2===0,'capacity BeginPaint exact ['+x+','+(1+row*2)+']');
    check(user('GetUpdateRgn',wide,output,0),1,'paint consumed capacity shape');
  }
  assert(user('DestroyWindow',wide));
  function freeRegions(){const hs=[];for(let i=0;i<256;i++){const h=gdi('CreateRectRgn',0,0,0,0);if(!h)break;hs.push(h);}
    for(const h of hs)assert(gdi('DeleteObject',h));return hs.length;}
  const available=freeRegions();
  for(let i=0;i<260;i++){
    const h=window(),src=shape('disjoint');dirty(h,[[1,1,12,10]]);assert(user('ValidateRgn',h,src));assert(gdi('DeleteObject',src));
    if(i%2===0){assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));}assert(user('DestroyWindow',h));
  }
  check(freeRegions(),available,'validation/paint/teardown leak no region handles');
  for(const h of [child,other,main])assert(user('DestroyWindow',h));
  for(const h of [output,full,red,black])assert(gdi('DeleteObject',h));check(freeRegions(),255,'all public slots recovered');
  console.log(JSON.stringify({checks,calls,failureCounts,failures}));assert.strictEqual(failures.length,0,'public ValidateRgn failures');
  console.log(`PASS exact public ValidateRgn (${checks} checks)`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
