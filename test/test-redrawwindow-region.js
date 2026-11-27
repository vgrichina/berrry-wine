#!/usr/bin/env node
'use strict';
// Public USER/GDI calls and real guest callbacks, with literal pixel oracles.
// RedrawWindow: a non-NULL HRGN takes precedence over lprcUpdate.
// RDW_INVALIDATE accumulates exact damage; NULL/NULL means full client. Capacity FALSE below is an explicit
// bounded-runtime failure policy, not a claim about Windows last-error values.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-redrawwindow
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getrgnbox
const assert=require('assert'),fs=require('fs'),crypto=require('crypto');
const {bootRenderHarness}=require('./render-helper');
const {compileSrcWasm}=require('./compile-src');
const {makeFixture,iat}=require('../tools/kernel32-native-fixture');
const u32=v=>[v,v>>>8,v>>>16,v>>>24].map(b=>b&255);
async function main(){
  const bytes=process.env.REDRAWWINDOW_TEST_MODULE?fs.readFileSync(process.env.REDRAWWINDOW_TEST_MODULE):compileSrcWasm();
  console.log(JSON.stringify({moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',prebuiltModule:new WebAssembly.Module(bytes)});
  const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_api_log(0);
  const alloc=n=>e.guest_alloc(n)>>>0,w=(p,v)=>e.guest_write32(p,v),r=p=>e.guest_read32(p)>>>0;
  const code=b=>{const p=alloc(b.length);b.forEach((v,i)=>e.guest_write8(p+i,v));return p;};
  const str=s=>code([...Buffer.from(s),0]),put=(p,a)=>a.forEach((v,i)=>w(p+4*i,v));
  const read=p=>[0,4,8,12].map(o=>r(p+o));
  const stack=alloc(32768)+16384;let calls=0,checks=0,failureCount=0,context='setup';const failures=[],failureGroups={},examples={};
  function call(address,args){
    w(stack,0);args.forEach((v,i)=>w(stack+4+i*4,v));e.set_esp(stack);e.clear_yield();e.set_eip(address);
    for(let i=0;i<256&&e.get_eip();i++)e.run(2048);
    assert.strictEqual(e.get_eip(),0,'guest returned');assert.strictEqual(e.get_esp()>>>0,stack+4+args.length*4,'stdcall ESP');
    assert.strictEqual(e.get_sync_msg_depth(),0,'guest callback unwound');calls++;return e.get_eax()>>>0;
  }
  const libs={},entries={};
  for(const dll of ['user32.dll','gdi32.dll']){libs[dll]=call(r(iat('LoadLibraryA')),[str(dll)]);assert(libs[dll]);}
  function entry(dll,name){const k=dll+':'+name;entries[k]||=call(r(iat('GetProcAddress')),[libs[dll],str(name)]);assert(entries[k],k);return entries[k];}
  const user=(n,...a)=>call(entry('user32.dll',n),a),gdi=(n,...a)=>call(entry('gdi32.dll',n),a);
  const redraw=(h,src)=>user('RedrawWindow',h,0,src,1);
  function eq(a,b,label){checks++;if(JSON.stringify(a)!==JSON.stringify(b)){failureCount++;failureGroups[context]=(failureGroups[context]||0)+1;const f={context,label,actual:a,expected:b};if(failures.length<30)failures.push(f);examples[context]||=[];if(examples[context].length<3)examples[context].push(f);}}
  const box=alloc(16),ps=alloc(64),all=alloc(16),rect=alloc(16),record=alloc(16),samples=alloc(16*14*4);
  put(all,[0,0,16,14]);
  const output=gdi('CreateRectRgn',0,0,0,0),red=gdi('CreateSolidBrush',0xff),black=gdi('CreateSolidBrush',0);
  const quiet=code([0xb8,...u32(1),0xc2,16,0]);
  function window(parent=0,width=16){
    const h=user('CreateWindowExA',0,str('STATIC'),str('RedrawWindow exact'),parent?0x50000000:0x90000000,0,0,width,14,parent,0,0x400000,0);assert(h);
    assert(user('SetWindowLongA',h,-4,quiet));assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));return h;
  }
  const mainWindow=window(),child=window(mainWindow),other=window();eq(e.get_main_hwnd()>>>0,mainWindow,'actual main');
  // Creating the child can expose its parent after the parent's startup paint.
  for(const h of [mainWindow,child,other]){assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));}
  const blank='................',stripe='..##............';
  const disjoint=[blank,blank,...Array(8).fill(stripe),blank,blank,'#...............',blank];
  const single=[blank,blank,...Array(8).fill(stripe),...Array(4).fill(blank)];
  const hole=[blank,'.###########....','.###########....','.###########....','.###....####....','.###....####....',
    '.###....####....','.###....####....','.###########....','.###########....',blank,blank,blank,blank];
  const clipped=['###.............','###.............',...Array(10).fill(blank),'..............##','..............##'];
  const union=[blank,blank,...Array(8).fill(stripe),blank,blank,'#...........##..','............##..'];
  const full=Array(14).fill('################'),empty=Array(14).fill(blank);
  function mask(label,fn,rows){eq(rows.length,14,label+' rows');for(let y=0;y<14;y++){
    eq(rows[y].length,16,label+' columns');for(let x=0;x<16;x++)eq(!!fn(x,y),rows[y][x]==='#',label+` [${x},${y}]`);}}
  function region(rs,cut){
    const h=gdi('CreateRectRgn',0,0,0,0);assert(h);
    for(const a of rs){const q=gdi('CreateRectRgn',...a);assert(q);assert(gdi('CombineRgn',h,h,q,2));assert(gdi('DeleteObject',q));}
    if(cut){const q=gdi('CreateRectRgn',...cut);assert(q);assert(gdi('CombineRgn',h,h,q,4));assert(gdi('DeleteObject',q));}return h;
  }
  function query(label,h,rows,kind,bounds){
    for(let i=0;i<2;i++){
      eq(user('GetUpdateRgn',h,output,0),kind,label+' query kind');eq(gdi('GetRgnBox',output,box),kind,label+' output kind');
      eq(read(box),bounds,label+' bbox');mask(label+' output',(x,y)=>gdi('PtInRegion',output,x,y),rows);
    }
  }
  const visible=entry('gdi32.dll','PtVisible');
  function callback(ret,capture=true){
    const b=[0xff,0x05,...u32(record),0x8b,0x44,0x24,4,0xa3,...u32(record+4),0x8b,0x44,0x24,12,0xa3,...u32(record+8)];
    if(capture)for(let y=0;y<14;y++)for(let x=0;x<16;x++)b.push(0x68,...u32(y),0x68,...u32(x),0xff,0x35,...u32(record+8),
      0xb8,...u32(visible),0xff,0xd0,0xa3,...u32(samples+4*(y*16+x)));
    b.push(0xb8,...u32(ret),0xc2,16,0);
    return code([0x83,0x7c,0x24,8,0x0f,0x75,11,0xff,0x05,...u32(record+12),0x31,0xc0,0xc2,16,0,
      0x83,0x7c,0x24,8,0x14,0x74,5,0x31,0xc0,0xc2,16,0,...b]);
  }
  const cbFalse=callback(0),cbTrue=callback(7);
  function paint(label,h,rows,bounds,erase,ret){
    put(record,[0,0,0,0]);const dc=user('BeginPaint',h,ps);assert(dc);
    eq(read(ps+8),bounds,label+' rcPaint');eq(r(record),erase?1:0,label+' erase callbacks');
    eq(r(ps+4),erase&&!ret?1:0,label+' fErase');
    if(erase){eq(r(record+4),h,label+' erase HWND');mask(label+' callback clip',(x,y)=>r(samples+4*(y*16+x)),rows);}
    mask(label+' paint clip',(x,y)=>gdi('PtVisible',dc,x,y),rows);
    assert(user('FillRect',dc,all,red));eq(user('GetUpdateRgn',h,output,0),1,label+' consumed');assert(user('EndPaint',h,ps));
    const rd=user('GetDC',h);assert(rd);mask(label+' literal pixels',(x,y)=>gdi('GetPixel',rd,x,y)===0xff,rows);assert(user('ReleaseDC',h,rd));
  }
  const cases=[
    ['single',[[2,2,4,10]],null,single,2,[2,2,4,10]],
    ['disjoint',[[0,12,1,13],[2,2,4,10]],null,disjoint,3,[0,2,4,13]],
    ['hole',[[1,1,12,10]],[4,4,8,8],hole,3,[1,1,12,10]],
    ['client clipping',[[-3,-2,3,2],[14,12,20,17]],null,clipped,3,[0,0,16,14]],
    ['empty',[],null,empty,1,[0,0,0,0]],
    ['outside',[[20,20,23,23]],null,empty,1,[0,0,0,0]],
    ['NULL',null,null,full,2,[0,0,16,14]],
  ];
  for(const h of [mainWindow,child,other])for(const erase of [0])for(const ret of [7])for(const [name,rs,cut,rows,kind,bounds] of cases){
    context=`${h}/${erase}/${ret}/${name}`;
    // Parent paints may expose native children between cases. Consume only
    // that pre-existing setup damage before installing this case's callback.
    assert(user('SetWindowLongA',h,-4,quiet));assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));
    assert(user('SetWindowLongA',h,-4,erase?ret?cbTrue:cbFalse:cbTrue));
    const clear=user('GetDC',h);assert(user('FillRect',clear,all,black));assert(user('ReleaseDC',h,clear));
    const src=rs===null?0:region(rs,cut);
    const sourceKind=src?gdi('GetRgnBox',src,box):0,sourceBox=src?read(box):null;
    const cleanCounts=Array.from({length:5},(_,i)=>e.paint_work_count(i));
    put(record,[0,0,0,0]);
    eq(redraw(h,src),1,name+' succeeds');eq(r(record),0,name+' no synchronous erase');
    eq(r(record+12),0,name+' no synchronous paint');
    if(kind===1)eq(Array.from({length:5},(_,i)=>e.paint_work_count(i)),cleanCounts,name+' no paint notification');
    if(src){
      eq(gdi('GetRgnBox',src,box),sourceKind,name+' source kind untouched');eq(read(box),sourceBox,name+' source bounds untouched');
      if(name!=='client clipping')mask(name+' source membership untouched',(x,y)=>gdi('PtInRegion',src,x,y),rows);
      assert(gdi('SetRectRgn',src,7,11,9,13));assert(gdi('DeleteObject',src));
    }
    query(name,h,rows,kind,bounds);eq(r(record),0,name+' queries do not erase');
    if(kind!==1)paint(name,h,rows,bounds,erase,ret);
    else eq(user('GetUpdateRect',h,0,0),0,name+' clean');
  }
  // Prior damage and erase requests survive the exact union.
  context='union and isolation';for(const h of [mainWindow,child,other])for(const firstErase of [0,1]){
    assert(user('SetWindowLongA',h,-4,quiet));assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));
    assert(user('SetWindowLongA',h,-4,cbTrue));
    const clear=user('GetDC',h);assert(user('FillRect',clear,all,black));assert(user('ReleaseDC',h,clear));
    put(rect,[12,12,14,14]);assert(user('InvalidateRect',h,rect,firstErase));
    const src=region([[0,12,1,13],[2,2,4,10]]);assert(redraw(h,src));
    assert(gdi('SetRectRgn',src,8,8,9,9));assert(gdi('DeleteObject',src));
    query('union',h,union,3,[0,2,14,14]);paint('union',h,union,[0,2,14,14],firstErase,7);
  }
  // The documented HRGN precedence also applies when a disjoint RECT is set.
  context='HRGN precedence';
  put(rect,[12,12,14,14]);
  for(const h of [mainWindow,child,other])for(const rs of [[[2,2,4,10]],[]]){
    assert(user('SetWindowLongA',h,-4,quiet));assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));
    const clear=user('GetDC',h);assert(user('FillRect',clear,all,black));assert(user('ReleaseDC',h,clear));
    const src=region(rs);eq(user('RedrawWindow',h,rect,src,1),1,'both inputs');assert(gdi('DeleteObject',src));
    query('HRGN overrides RECT',h,rs.length?single:empty,rs.length?2:1,rs.length?[2,2,4,10]:[0,0,0,0]);
    if(rs.length)paint('precedence',h,single,[2,2,4,10],0,7);
    // Clean BeginPaint has a historical full-client fallback outside this fix.
    else eq(user('GetUpdateRect',h,0,0),0,'empty HRGN keeps window clean');
  }
  context='rectangle, no-area flags and validation';
  const flags=[0,0x80,0x180,0x20,0x10,0x40];
  for(const h of [mainWindow,child]){
    assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));
    put(rect,[2,2,4,10]);eq(user('RedrawWindow',h,rect,0,1),1,'RECT only');
    for(const f of flags){eq(user('RedrawWindow',h,0,0,f),1,'no area mutation');query('flags preserve damage',h,single,2,[2,2,4,10]);}
    eq(user('RedrawWindow',h,rect,0,8),1,'existing rectangle validation');query('validated',h,empty,1,[0,0,0,0]);
    for(const f of flags){eq(user('RedrawWindow',h,0,0,f),1,'clean no-area');eq(user('GetUpdateRect',h,0,0),0,'still clean');}
  }
  for(const h of [mainWindow,child,other]){assert(user('SetWindowLongA',h,-4,quiet));assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));}
  const src=region([[0,12,1,13],[2,2,4,10]]),childSrc=region([[2,2,4,10]]);
  assert(redraw(mainWindow,src));assert(redraw(child,childSrc));
  query('main isolation',mainWindow,disjoint,3,[0,2,4,13]);query('child isolation',child,single,2,[2,2,4,10]);
  assert(user('BeginPaint',child,ps));assert(user('EndPaint',child,ps));
  query('main after child paint',mainWindow,disjoint,3,[0,2,4,13]);
  assert(user('BeginPaint',mainWindow,ps));assert(user('EndPaint',mainWindow,ps));
  assert(gdi('DeleteObject',src));assert(gdi('DeleteObject',childSrc));
  // 208 exact spans fit. A single two-span call causing 209 fails as one
  // transaction, preserving all earlier damage and both erase-bit directions.
  context='capacity';const wide=window(0,432),capacity=region(Array.from({length:208},(_,i)=>[i*2,2,i*2+1,3]));
  const extra=region([[0,2,1,3],[418,2,419,3]]),wideTrue=callback(7,false);
  for(const erase of [0,1]){
    assert(user('SetWindowLongA',wide,-4,wideTrue));eq(redraw(wide,capacity),1,'208 bands succeed');
    if(erase){put(rect,[0,2,1,3]);assert(user('InvalidateRect',wide,rect,1));}
    const beforeCounts=Array.from({length:5},(_,i)=>e.paint_work_count(i));
    const beforeFree=freeRegions();
    const held=[];for(let i=0;i<256;i++){const q=gdi('CreateRectRgn',0,0,0,0);if(!q)break;held.push(q);}
    eq(redraw(wide,extra),0,'capacity failure FALSE');
    eq(Array.from({length:5},(_,i)=>e.paint_work_count(i)),beforeCounts,'capacity notification counts atomic');
    for(const q of held)assert(gdi('DeleteObject',q));eq(freeRegions(),beforeFree,'capacity failure leaks no HRGN');
    eq(gdi('GetRgnBox',extra,box),3,'failed input kind unchanged');eq(read(box),[0,2,419,3],'failed input bbox unchanged');
    for(let x=0;x<432;x++)eq(!!gdi('PtInRegion',extra,x,2),x===0||x===418,'failed input membership '+x);
    eq(user('GetUpdateRgn',wide,output,0),3,'capacity kind');eq(gdi('GetRgnBox',output,box),3,'capacity output');eq(read(box),[0,2,415,3],'capacity bbox atomic');
    for(let x=0;x<432;x++)eq(!!gdi('PtInRegion',output,x,2),x<416&&x%2===0,'capacity membership '+x);
    put(record,[0,0,0,0]);const dc=user('BeginPaint',wide,ps);assert(dc);eq(r(record),erase,'capacity erase atomic');
    eq(read(ps+8),[0,2,415,3],'capacity rcPaint atomic');
    for(let x=0;x<432;x++)eq(!!gdi('PtVisible',dc,x,2),x<416&&x%2===0,'capacity paint '+x);
    assert(user('EndPaint',wide,ps));
  }
  assert(user('DestroyWindow',wide));assert(gdi('DeleteObject',capacity));assert(gdi('DeleteObject',extra));
  function freeRegions(){const hs=[];for(let i=0;i<256;i++){const h=gdi('CreateRectRgn',0,0,0,0);if(!h)break;hs.push(h);}for(const h of hs)assert(gdi('DeleteObject',h));return hs.length;}
  const available=freeRegions(),stable=region([[0,12,1,13],[2,2,4,10]]);
  // No temporary public HRGN allocation is needed even with the table full.
  const held=[];for(let i=0;i<256;i++){const h=gdi('CreateRectRgn',0,0,0,0);if(!h)break;held.push(h);}
  eq(redraw(other,stable),1,'HRGN exhaustion permits invalidation');
  query('no temporary handle',other,disjoint,3,[0,2,4,13]);for(const h of held)assert(gdi('DeleteObject',h));
  assert(user('BeginPaint',other,ps));assert(user('EndPaint',other,ps));
  for(let i=0;i<16;i++){
    const h=window();assert(redraw(h,stable));
    if(i%2===0){assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));}assert(user('DestroyWindow',h));
  }
  assert(gdi('DeleteObject',stable));eq(freeRegions(),available,'no persistent HRGN leaks');
  for(const h of [child,other,mainWindow])assert(user('DestroyWindow',h));
  for(const h of [output,red,black])assert(gdi('DeleteObject',h));eq(freeRegions(),255,'all region slots recovered');
  console.log(JSON.stringify({checks,calls,failureCount,failureGroups,failures,examples,entries}));
  assert.strictEqual(failureCount,0,'public RedrawWindow checks');console.log(`PASS public RedrawWindow exact (${checks} checks)`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
