#!/usr/bin/env node
'use strict';
// Public USER/GDI imports and real x86 callbacks, with literal pixel masks.
// RDW_ERASE needs RDW_INVALIDATE and defers erase until repaint/query:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-redrawwindow
// Capacity FALSE is this bounded runtime's atomic failure policy.
const assert=require('assert'),fs=require('fs'),crypto=require('crypto');
const {bootRenderHarness}=require('./render-helper');
const {compileSrcWasm}=require('./compile-src');
const {makeFixture,iat}=require('../tools/kernel32-native-fixture');
const u32=v=>[v,v>>>8,v>>>16,v>>>24].map(b=>b&255);
async function main(){
  const bytes=process.env.REDRAWWINDOW_ERASE_TEST_MODULE?fs.readFileSync(process.env.REDRAWWINDOW_ERASE_TEST_MODULE):compileSrcWasm();
  console.log(JSON.stringify({moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',prebuiltModule:new WebAssembly.Module(bytes)});
  const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_api_log(0);
  const alloc=n=>e.guest_alloc(n)>>>0,w=(p,v)=>e.guest_write32(p,v),r=p=>e.guest_read32(p)>>>0;
  const code=b=>{const p=alloc(b.length);b.forEach((v,i)=>e.guest_write8(p+i,v));return p;};
  const str=s=>code([...Buffer.from(s),0]),put=(p,a)=>a.forEach((v,i)=>w(p+4*i,v)),read=p=>[0,4,8,12].map(o=>r(p+o));
  const stack=alloc(32768)+16384;let calls=0,checks=0,failureCount=0,context='setup';const failures=[],failureGroups={};
  function call(address,args){
    w(stack,0);args.forEach((v,i)=>w(stack+4+i*4,v));e.set_esp(stack);e.clear_yield();e.set_eip(address);
    for(let i=0;i<256&&e.get_eip();i++)e.run(2048);
    assert.strictEqual(e.get_eip(),0,'guest returned');assert.strictEqual(e.get_esp()>>>0,stack+4+args.length*4,'stdcall ESP');
    assert.strictEqual(e.get_sync_msg_depth(),0,'callback context unwound');calls++;return e.get_eax()>>>0;
  }
  const libs={},entries={};
  for(const dll of ['user32.dll','gdi32.dll']){libs[dll]=call(r(iat('LoadLibraryA')),[str(dll)]);assert(libs[dll]);}
  function entry(dll,name){const k=dll+':'+name;entries[k]||=call(r(iat('GetProcAddress')),[libs[dll],str(name)]);assert(entries[k],k);return entries[k];}
  const user=(n,...a)=>call(entry('user32.dll',n),a),gdi=(n,...a)=>call(entry('gdi32.dll',n),a);
  function eq(a,b,label){checks++;if(JSON.stringify(a)!==JSON.stringify(b)){failureCount++;failureGroups[context]=(failureGroups[context]||0)+1;if(failures.length<30)failures.push({context,label,actual:a,expected:b});}}
  const rect=alloc(16),fresh=alloc(16),box=alloc(16),ps=alloc(64),all=alloc(16),record=alloc(32),samples=alloc(16*14*4);
  put(all,[0,0,16,14]);put(fresh,[12,12,14,14]);
  const output=gdi('CreateRectRgn',0,0,0,0),nestedOutput=gdi('CreateRectRgn',0,0,0,0);
  const red=gdi('CreateSolidBrush',0xff),black=gdi('CreateSolidBrush',0);
  const quiet=code([0xb8,...u32(1),0xc2,16,0]);
  function window(parent=0,width=16){
    const h=user('CreateWindowExA',0,str('STATIC'),str('RedrawWindow erase'),parent?0x50000000:0x90000000,0,0,width,14,parent,0,0x400000,0);assert(h);
    assert(user('SetWindowLongA',h,-4,quiet));assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));return h;
  }
  const mainWindow=window(),child=window(mainWindow);eq(e.get_main_hwnd()>>>0,mainWindow,'actual main');
  function reset(h,proc){
    assert(user('SetWindowLongA',h,-4,quiet));assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));
    assert(user('SetWindowLongA',h,-4,proc));put(record,[0,0,0,0,0,0,0,0]);
    const dc=user('GetDC',h);assert(dc);assert(user('FillRect',dc,all,black));assert(user('ReleaseDC',h,dc));
  }
  const blank='................',empty=Array(14).fill(blank),full=Array(14).fill('################');
  const disjoint=[blank,blank,...Array(8).fill('..##............'),blank,blank,'#...............',blank];
  const hole=[blank,'.###########....','.###########....','.###########....','.###....####....','.###....####....',
    '.###....####....','.###....####....','.###########....','.###########....',blank,blank,blank,blank];
  const single=[blank,blank,...Array(8).fill('..##............'),...Array(4).fill(blank)];
  const renewed=[...Array(12).fill(blank),'............##..','............##..'];
  const union=disjoint.map((s,y)=>[...s].map((c,x)=>c==='#'||renewed[y][x]==='#'?'#':'.').join(''));
  function mask(label,fn,rows){for(let y=0;y<14;y++)for(let x=0;x<16;x++)eq(!!fn(x,y),rows[y][x]==='#',label+` [${x},${y}]`);}
  function pixels(label,h,rows){const dc=user('GetDC',h);assert(dc);mask(label,(x,y)=>gdi('GetPixel',dc,x,y)===0xff,rows);assert(user('ReleaseDC',h,dc));}
  function region(rs,cut){
    const h=gdi('CreateRectRgn',0,0,0,0);assert(h);
    for(const a of rs){const q=gdi('CreateRectRgn',...a);assert(q);assert(gdi('CombineRgn',h,h,q,2));assert(gdi('DeleteObject',q));}
    if(cut){const q=gdi('CreateRectRgn',...cut);assert(q);assert(gdi('CombineRgn',h,h,q,4));assert(gdi('DeleteObject',q));}return h;
  }
  function query(h,rows,kind,bounds,erase=0,which='rgn'){
    eq(which==='rgn'?user('GetUpdateRgn',h,output,erase):user('GetUpdateRect',h,box,erase),which==='rgn'?kind:kind===1?0:1,'query return');
    if(which==='rect')eq(read(box),bounds,'query rectangle');
    eq(user('GetUpdateRgn',h,output,0),kind,'snapshot kind');eq(gdi('GetRgnBox',output,box),kind,'region kind');eq(read(box),bounds,'region bounds');
    mask('exact damage',(x,y)=>gdi('PtInRegion',output,x,y),rows);
  }
  const visible=entry('gdi32.dll','PtVisible'),fill=entry('user32.dll','FillRect');
  const update=entry('user32.dll','GetUpdateRgn'),redraw=entry('user32.dll','RedrawWindow');
  function callback(ret,{renew=false,capture=true}={}){
    const b=[0xff,0x05,...u32(record),0x8b,0x44,0x24,4,0xa3,...u32(record+4),0x8b,0x44,0x24,12,0xa3,...u32(record+8),
      0x8b,0x44,0x24,16,0xa3,...u32(record+20)];
    if(capture){
      for(let y=0;y<14;y++)for(let x=0;x<16;x++)b.push(0x68,...u32(y),0x68,...u32(x),0xff,0x35,...u32(record+8),
        0xb8,...u32(visible),0xff,0xd0,0xa3,...u32(samples+4*(y*16+x)));
      b.push(0x68,...u32(red),0x68,...u32(all),0xff,0x35,...u32(record+8),0xb8,...u32(fill),0xff,0xd0);
    }
    // A TRUE query during the in-flight erase must not recursively deliver it.
    b.push(0x6a,1,0x68,...u32(nestedOutput),0xff,0x35,...u32(record+4),0xb8,...u32(update),0xff,0xd0,0xa3,...u32(record+24));
    if(renew)b.push(0x6a,5,0x6a,0,0x68,...u32(fresh),0xff,0x35,...u32(record+4),0xb8,...u32(redraw),0xff,0xd0,0xa3,...u32(record+16));
    b.push(0xb8,...u32(ret),0xc2,16,0);
    return code([0x83,0x7c,0x24,8,0x0f,0x75,11,0xff,0x05,...u32(record+12),0x31,0xc0,0xc2,16,0,
      0x83,0x7c,0x24,8,0x14,0x74,5,0x31,0xc0,0xc2,16,0,...b]);
  }
  function paint(h,rows,bounds,erase,ret){
    const before=r(record),dc=user('BeginPaint',h,ps);assert(dc);
    eq(r(record)-before,erase?1:0,'BeginPaint erase count');eq(r(ps+4),erase&&!ret?1:0,'callback return controls fErase');eq(read(ps+8),bounds,'rcPaint');
    if(erase){eq(r(record+4),h,'callback HWND');eq(r(record+8),dc,'callback borrows paint DC');eq(r(record+20),0,'callback lParam');
      mask('callback exact clip',(x,y)=>r(samples+4*(y*16+x)),rows);}
    mask('paint exact clip',(x,y)=>gdi('PtVisible',dc,x,y),rows);
    assert(user('FillRect',dc,all,red));eq(user('GetUpdateRgn',h,output,0),1,'BeginPaint consumed damage');assert(user('EndPaint',h,ps));
    pixels('exact DC pixels',h,rows);
  }
  const cases=[['disjoint',[[0,12,1,13],[2,2,4,10]],null,disjoint,3,[0,2,4,13]],
    ['hole',[[1,1,12,10]],[4,4,8,8],hole,3,[1,1,12,10]],['NULL',null,null,full,2,[0,0,16,14]],
    ['RECT',undefined,null,single,2,[2,2,4,10]]];
  for(const h of [mainWindow,child])for(const flags of [1,5])for(const ret of [0,1,7,0x10000])for(const delivery of ['paint','rgn','rect'])for(const [name,rs,cut,rows,kind,bounds] of cases){
    context=`${h}/${flags}/${ret}/${delivery}/${name}`;reset(h,callback(ret));put(rect,[2,2,4,10]);
    const src=rs===null||rs===undefined?0:region(rs,cut),copy=src?region(rs,cut):0;
    eq(user('RedrawWindow',h,rs===undefined?rect:0,src,flags),1,'invalidate succeeds');eq(r(record),0,'erase deferred');eq(r(record+12),0,'paint deferred');
    if(rs===undefined)put(rect,[12,12,14,14]); // RECT is also copied, not retained.
    if(src){eq(gdi('EqualRgn',src,copy),1,'source immutable');assert(gdi('SetRectRgn',src,12,12,14,14));assert(gdi('DeleteObject',src));assert(gdi('DeleteObject',copy));}
    query(h,rows,kind,bounds);eq(r(record),0,'FALSE query defers erase');pixels('no drawing before delivery',h,empty);
    if(delivery!=='paint'){
      query(h,rows,kind,bounds,1,delivery);eq(r(record),flags===5?1:0,'explicit query erase count');
      if(flags===5){mask('query callback exact clip',(x,y)=>r(samples+4*(y*16+x)),rows);pixels('query erase exact pixels',h,rows);}
      query(h,rows,kind,bounds);eq(r(record),flags===5?1:0,'FALSE query does not redeliver');
    }
    paint(h,rows,bounds,flags===5&&(delivery==='paint'||!ret),ret);
  }
  for(const h of [mainWindow,child]){
    context=`${h}/no-area`;
    for(const f of [0,4,0x10,0x20,0x40]){
      reset(h,callback(7));eq(user('RedrawWindow',h,0,0,f),1,'no-area flags succeed');query(h,empty,1,[0,0,0,0],1);eq(r(record),0,'clean no callback');
      put(rect,[2,2,4,10]);assert(user('RedrawWindow',h,rect,0,1));eq(user('RedrawWindow',h,0,0,f),1,'dirty no-area flags succeed');
      paint(h,single,[2,2,4,10],false,7);
    }
    for(const [rs,cut] of [[[],null],[[[20,20,30,30]],null]]){
      reset(h,callback(7));const src=region(rs,cut),before=Array.from({length:5},(_,i)=>e.paint_work_count(i));
      put(rect,[2,2,4,10]);eq(user('RedrawWindow',h,rect,src,5),1,'empty HRGN overrides RECT');assert(gdi('DeleteObject',src));
      eq(Array.from({length:5},(_,i)=>e.paint_work_count(i)),before,'empty no notifications');query(h,empty,1,[0,0,0,0],1);eq(r(record),0,'empty no erase');
      assert(user('RedrawWindow',h,rect,0,1));paint(h,single,[2,2,4,10],false,7);
    }
    // A later no-erase union never clears an earlier erase request. Conversely,
    // the new erase applies to the whole accumulated exact update region.
    for(const [first,second] of [[5,1],[1,5]]){
      context=`${h}/prior/${first}/${second}`;reset(h,callback(7));put(rect,[12,12,14,14]);assert(user('RedrawWindow',h,rect,0,first));
      const src=region([[0,12,1,13],[2,2,4,10]]);assert(user('RedrawWindow',h,0,src,second));assert(gdi('DeleteObject',src));
      query(h,union,3,[0,2,14,14]);paint(h,union,[0,2,14,14],true,7);
    }
    for(const delivery of ['paint','rgn','rect']){
      context=`${h}/nested/${delivery}`;reset(h,callback(7,{renew:true}));const src=region([[0,12,1,13],[2,2,4,10]]);
      assert(user('RedrawWindow',h,0,src,5));assert(gdi('DeleteObject',src));
      if(delivery==='paint'){
        const dc=user('BeginPaint',h,ps);assert(dc);eq(r(record),1,'nested no repeated erase');eq(r(ps+4),0,'outer handled');eq(read(ps+8),[0,2,4,13],'outer snapshot');
        mask('outer snapshot clip',(x,y)=>gdi('PtVisible',dc,x,y),disjoint);assert(user('EndPaint',h,ps));query(h,renewed,2,[12,12,14,14]);
      }else{
        eq(delivery==='rgn'?user('GetUpdateRgn',h,output,1):user('GetUpdateRect',h,box,1),delivery==='rgn'?3:1,'outer query return');
        if(delivery==='rgn'){eq(readAfterBox(output),[0,2,4,13],'outer query snapshot');mask('outer snapshot exact',(x,y)=>gdi('PtInRegion',output,x,y),disjoint);}
        else eq(read(box),[0,2,4,13],'outer RECT snapshot');
        eq(r(record),1,'nested no repeated erase');query(h,union,3,[0,2,14,14]);
      }
      eq(r(record+16),1,'callback RedrawWindow succeeds');assert(user('SetWindowLongA',h,-4,callback(7)));
      const clear=user('GetDC',h);assert(clear);assert(user('FillRect',clear,all,black));assert(user('ReleaseDC',h,clear));
      paint(h,delivery==='paint'?renewed:union,delivery==='paint'?[12,12,14,14]:[0,2,14,14],true,7);
    }
  }
  context='main/child isolation';
  reset(mainWindow,callback(7));reset(child,callback(7));
  const isolation=region([[1,1,12,10]],[4,4,8,8]);put(rect,[2,2,4,10]);
  assert(user('RedrawWindow',mainWindow,0,isolation,5));assert(user('RedrawWindow',child,rect,0,1));assert(gdi('DeleteObject',isolation));
  paint(child,single,[2,2,4,10],false,7);query(mainWindow,hole,3,[1,1,12,10]);paint(mainWindow,hole,[1,1,12,10],true,7);
  // 208 spans fit; a transaction requiring 209 fails before changing erase,
  // update bands, notifications or the source. Exercise HRGN and RECT paths.
  const capacityWindow=window(0,432),capacity=region(Array.from({length:208},(_,i)=>[i*2,2,i*2+1,3]));
  const extra=region([[0,2,1,3],[418,2,419,3]]),wideProc=callback(7,{capture:false});
  const wideRect=alloc(16);put(wideRect,[0,0,432,14]);
  for(const h of [mainWindow,child])assert(user('SetWindowPos',h,0,0,0,432,14,0x16));
  function freeRegions(){const hs=[];for(let i=0;i<256;i++){const q=gdi('CreateRectRgn',0,0,0,0);if(!q)break;hs.push(q);}for(const q of hs)assert(gdi('DeleteObject',q));return hs.length;}
  for(const wide of [mainWindow,child,capacityWindow])for(const priorErase of [0,1])for(const form of ['rgn','rect']){
    context=`capacity/${wide}/${priorErase}/${form}`;reset(wide,wideProc);
    const clear=user('GetDC',wide);assert(clear);assert(user('FillRect',clear,wideRect,black));assert(user('ReleaseDC',wide,clear));
    assert(user('RedrawWindow',wide,0,capacity,priorErase?5:1));
    const before=Array.from({length:5},(_,i)=>e.paint_work_count(i)),available=freeRegions(),held=[];put(rect,[418,2,419,3]);
    for(let i=0;i<256;i++){const q=gdi('CreateRectRgn',0,0,0,0);if(!q)break;held.push(q);}
    eq(gdi('CreateRectRgn',0,0,1,1),0,'allocation failure before failed union');
    eq(user('RedrawWindow',wide,form==='rect'?rect:0,form==='rgn'?extra:0,priorErase?1:5),0,'capacity FALSE');
    for(const q of held)assert(gdi('DeleteObject',q));
    eq(Array.from({length:5},(_,i)=>e.paint_work_count(i)),before,'failure notifications atomic');eq(freeRegions(),available,'failure leaks no region');
    eq(user('GetUpdateRgn',wide,output,0),3,'prior kind');eq(readAfterBox(output),[0,2,415,3],'prior bounds');
    for(let x=0;x<432;x++)eq(!!gdi('PtInRegion',output,x,2),x<416&&x%2===0,'prior exact bands '+x);
    eq(readAfterBox(extra),[0,2,419,3],'source bounds immutable');for(let x=0;x<432;x++)eq(!!gdi('PtInRegion',extra,x,2),x===0||x===418,'source exact '+x);
    put(record,[0,0,0,0,0,0,0,0]);const dc=user('BeginPaint',wide,ps);assert(dc);eq(r(record),priorErase,'prior erase atomic');eq(r(ps+4),0,'handled prior erase');
    for(let x=0;x<432;x++)eq(!!gdi('PtVisible',dc,x,2),x<416&&x%2===0,'prior paint '+x);
    assert(user('FillRect',dc,wideRect,red));assert(user('EndPaint',wide,ps));
    const pixels=user('GetDC',wide);assert(pixels);for(let x=0;x<432;x++)eq(gdi('GetPixel',pixels,x,2)===0xff,x<416&&x%2===0,'atomic pixels '+x);assert(user('ReleaseDC',wide,pixels));
    assert(user('RedrawWindow',wide,rect,0,5));put(record,[0,0,0,0,0,0,0,0]);assert(user('BeginPaint',wide,ps));eq(r(record),1,'recovery erase');assert(user('EndPaint',wide,ps));
  }
  function readAfterBox(h){assert(gdi('GetRgnBox',h,box));return read(box);}
  // No temporary HRGN is needed by union/marking, even when none can allocate.
  context='HRGN exhaustion';reset(child,callback(7));const src=region([[1,1,12,10]],[4,4,8,8]),available=freeRegions(),held=[];
  for(let i=0;i<256;i++){const q=gdi('CreateRectRgn',0,0,0,0);if(!q)break;held.push(q);}eq(gdi('CreateRectRgn',0,0,1,1),0,'allocation failure');
  eq(user('RedrawWindow',child,0,src,5),1,'exhausted union succeeds');query(child,hole,3,[1,1,12,10]);
  for(const q of held)assert(gdi('DeleteObject',q));eq(freeRegions(),available,'allocation failure preserves handles');paint(child,hole,[1,1,12,10],true,7);
  for(const q of [src,capacity,extra])assert(gdi('DeleteObject',q));
  for(const h of [capacityWindow,child,mainWindow])assert(user('DestroyWindow',h));
  for(const q of [output,nestedOutput,red,black])assert(gdi('DeleteObject',q));eq(freeRegions(),255,'all test region slots recovered');
  console.log(JSON.stringify({checks,calls,failureCount,failureGroups,failures,entries}));assert.strictEqual(failureCount,0,'public RedrawWindow deferred erase');
  console.log(`PASS public RedrawWindow deferred erase (${checks} checks)`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
