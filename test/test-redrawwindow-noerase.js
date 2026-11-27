#!/usr/bin/env node
'use strict';
// Public USER/GDI imports and real x86 callbacks, with literal pixel masks.
// RDW_NOERASE suppresses any pending WM_ERASEBKGND without adding damage:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-redrawwindow
// Capacity FALSE is this bounded runtime's atomic failure policy.
const assert=require('assert'),fs=require('fs'),crypto=require('crypto');
const {bootRenderHarness}=require('./render-helper');
const {compileSrcWasm}=require('./compile-src');
const {makeFixture,iat}=require('../tools/kernel32-native-fixture');
const u32=v=>[v,v>>>8,v>>>16,v>>>24].map(b=>b&255);
async function main(){
  const bytes=process.env.REDRAWWINDOW_NOERASE_TEST_MODULE?fs.readFileSync(process.env.REDRAWWINDOW_NOERASE_TEST_MODULE):compileSrcWasm();
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

  const notch=[blank,...Array(3).fill('...#########....'),...Array(4).fill('...#....####....'),
    ...Array(2).fill('...#########....'),blank,blank,blank,blank];
  const cutComplex=[blank,...Array(2).fill('...#######......'),'...#########....',...Array(4).fill('...#....####....'),
    ...Array(2).fill('...#########....'),blank,blank,blank,blank];
  const forms=[['alone NULL',0,0,hole,3,[1,1,12,10]],
    ['alone RECT',0,1,hole,3,[1,1,12,10]],['alone HRGN',0,2,hole,3,[1,1,12,10]],
    ['validate RECT',8,1,notch,3,[3,1,12,10]],['validate HRGN',8,2,cutComplex,3,[3,1,12,10]],
    ['validate NULL',8,0,empty,1,[0,0,0,0]],['validate empty HRGN',8,3,hole,3,[1,1,12,10]],
    ['validate reversed RECT',8,4,hole,3,[1,1,12,10]],['validate outside RECT',8,5,hole,3,[1,1,12,10]],
    ['validate full HRGN',8,6,empty,1,[0,0,0,0]],['validate full RECT',8,7,empty,1,[0,0,0,0]],
    ['alone invalid inputs',0,9,hole,3,[1,1,12,10]]];
  function seed(h,source){
    if(source==='InvalidateRect')eq(user('InvalidateRect',h,0,1),1,'seed RECT erase');
    if(source==='InvalidateRgn')eq(user('InvalidateRgn',h,0,1),1,'seed region erase');
    if(source==='RDW_ERASE')eq(user('RedrawWindow',h,0,0,5),1,'seed RDW erase');
    if(source==='Scroll flags')eq(user('ScrollWindowEx',h,16,0,0,0,0,0,6),2,'seed scroll exposure erase');
    const outside=region([[0,0,16,14]]);
    const wanted=region([[1,1,12,10]],[4,4,8,8]);
    assert(gdi('CombineRgn',outside,outside,wanted,4));
    eq(user('ValidateRgn',h,outside),1,'retain exact hole damage');
    assert(gdi('DeleteObject',outside));assert(gdi('DeleteObject',wanted));
  }
  for(const h of [mainWindow,child])for(const source of ['InvalidateRect','InvalidateRgn','RDW_ERASE','Scroll flags']){
    // A positive control proves each public source really left pending erase.
    context=h+'/'+source+'/positive';reset(h,callback(0));seed(h,source);paint(h,hole,[1,1,12,10],true,0);
    for(const [name,flags,form,rows,kind,bounds] of forms)for(const delivery of ['paint','rgn','rect']){
      context=h+'/'+source+'/'+name+'/'+delivery;reset(h,callback(0));seed(h,source);
      put(rect,form===4?[8,8,4,4]:form===5?[20,20,30,30]:form===7?[0,0,16,14]:[1,1,3,10]);
      const src=form===2?region([[1,1,3,10],[10,1,12,3]]):form===3?region([]):form===6?region([[0,0,16,14]]):0;
      const copy=src?gdi('CreateRectRgn',0,0,0,0):0;if(src)assert(gdi('CombineRgn',copy,src,0,5));
      const before=Array.from({length:5},(_,i)=>e.paint_work_count(i));
      eq(user('RedrawWindow',h,form===9?0xdeadbeef:[1,4,5,7].includes(form)||src?rect:0,form===9?0xdeadbeef:src,0x20|flags),1,'NOERASE return');
      eq(r(record),0,'NOERASE defers all callbacks');eq(r(record+12),0,'NOERASE defers paint');
      if(!flags)for(const i of [0,1,3,4])eq(e.paint_work_count(i),before[i],'NOERASE leaves non-erase work unchanged');
      if(src){eq(gdi('EqualRgn',src,copy),1,'source immutable');assert(gdi('SetRectRgn',src,0,0,16,14));assert(gdi('DeleteObject',src));assert(gdi('DeleteObject',copy));}
      put(rect,[0,0,16,14]);query(h,rows,kind,bounds);pixels('deferred pixels',h,empty);
      if(delivery!=='paint'){query(h,rows,kind,bounds,1,delivery);eq(r(record),0,'TRUE query suppressed erase');}
      // A clean BeginPaint has a historical full-client fallback. After full
      // validation, prove no old damage survives by adding a fresh small area.
      if(kind===1){put(rect,[2,2,4,10]);assert(user('InvalidateRect',h,rect,0));paint(h,single,[2,2,4,10],false,0);}
      else paint(h,rows,bounds,false,0);
      eq(r(record),0,'BeginPaint suppressed erase');
      // Suppression affects the pending request, not future invalidations.
      reset(h,callback(0));put(rect,[2,2,4,10]);assert(user('InvalidateRect',h,rect,1));
      if(delivery!=='paint'){
        query(h,single,2,[2,2,4,10],1,delivery);eq(r(record),1,'fresh TRUE query erases');
        // Unhandled erase is still pending for BeginPaint. Clear callback pixels.
        const dc=user('GetDC',h);assert(user('FillRect',dc,all,black));assert(user('ReleaseDC',h,dc));
      }
      paint(h,single,[2,2,4,10],true,0);
    }
  }
  // Suppressing one window must not consume another window's pending erase.
  const otherWindow=window();
  for(const target of [mainWindow,child]){
    const other=otherWindow;
    context='isolation/'+target;reset(target,callback(7));reset(other,callback(7));
    seed(target,'RDW_ERASE');seed(other,'InvalidateRgn');
    eq(user('RedrawWindow',target,0,0,0x20),1,'isolated NOERASE');
    query(other,hole,3,[1,1,12,10]);paint(other,hole,[1,1,12,10],true,7);
    const dc=user('GetDC',target);assert(user('FillRect',dc,all,black));assert(user('ReleaseDC',target,dc));
    put(record,[0,0,0,0,0,0,0,0]);paint(target,hole,[1,1,12,10],false,7);
  }
  // Reentrant TRUE query in a real erase callback sees the snapshot once.
  // A callback may also renew damage; NOERASE suppresses that pending request.
  for(const h of [mainWindow,child])for(const delivery of ['paint','rgn','rect']){
    context='nested/'+h+'/'+delivery;reset(h,callback(0,{renew:true}));seed(h,'RDW_ERASE');
    if(delivery==='paint'){const dc=user('BeginPaint',h,ps);assert(dc);eq(read(ps+8),[1,1,12,10],'outer snapshot');assert(user('EndPaint',h,ps));}
    else {
      eq(delivery==='rgn'?user('GetUpdateRgn',h,output,1):user('GetUpdateRect',h,box,1),delivery==='rgn'?3:1,'outer query return');
      if(delivery==='rgn'){eq(gdi('GetRgnBox',output,box),3,'outer snapshot kind');mask('outer snapshot',(x,y)=>gdi('PtInRegion',output,x,y),hole);}
      eq(read(box),[1,1,12,10],'outer query snapshot bounds');
    }
    eq(r(record),1,'nested TRUE query does not recurse');eq(r(record+16),1,'nested RedrawWindow return');
    eq(user('RedrawWindow',h,0,0,0x20),1,'suppress renewed erase');
    assert(user('SetWindowLongA',h,-4,callback(0)));
    const expected=delivery==='paint'?renewed:hole.map((s,y)=>[...s].map((c,x)=>c==='#'||renewed[y][x]==='#'?'#':'.').join(''));
    const dc=user('GetDC',h);assert(user('FillRect',dc,all,black));assert(user('ReleaseDC',h,dc));
    put(record,[0,0,0,0,0,0,0,0]);paint(h,expected,delivery==='paint'?[12,12,14,14]:[1,1,14,14],false,0);
  }
  // Subtracting a vertical cut through 208 one-row spans needs 416 spans.
  // Capacity failure must retain both exact damage and the pending erase.
  const capacity=region(Array.from({length:208},(_,i)=>[0,i*2,12,i*2+1]));
  const split=region([[4,0,8,416]]),wideRect=alloc(16);put(wideRect,[0,0,16,432]);
  function freeRegions(){const hs=[];for(let i=0;i<256;i++){const q=gdi('CreateRectRgn',0,0,0,0);if(!q)break;hs.push(q);}for(const q of hs)assert(gdi('DeleteObject',q));return hs.length;}
  for(const h of [mainWindow,child])assert(user('SetWindowPos',h,0,0,0,16,432,0x16));
  for(const h of [mainWindow,child])for(const form of ['RECT','HRGN']){
    context='capacity/'+h+'/'+form;reset(h,callback(0,{capture:false}));
    assert(user('RedrawWindow',h,0,capacity,5));put(rect,[4,0,8,416]);
    const before=Array.from({length:5},(_,i)=>e.paint_work_count(i)),available=freeRegions(),held=[];
    for(let i=0;i<256;i++){const q=gdi('CreateRectRgn',0,0,0,0);if(!q)break;held.push(q);}
    eq(gdi('CreateRectRgn',0,0,1,1),0,'exhaustion');
    eq(user('RedrawWindow',h,rect,form==='HRGN'?split:0,0x28),0,'capacity FALSE transaction');
    for(const q of held)assert(gdi('DeleteObject',q));
    eq(freeRegions(),available,'no allocation leak');eq(Array.from({length:5},(_,i)=>e.paint_work_count(i)),before,'failure retains paint work');
    eq(user('GetUpdateRgn',h,output,0),3,'capacity prior shape');
    eq(gdi('EqualRgn',output,capacity),1,'exact prior damage');eq(gdi('GetRgnBox',split,box),2,'source kind');eq(read(box),[4,0,8,416],'source intact');
    const dc=user('BeginPaint',h,ps);assert(dc);eq(r(record),1,'failure retains erase');eq(r(ps+4),1,'unhandled retained fErase');eq(read(ps+8),[0,0,12,415],'capacity paint bounds');
    for(let y=0;y<432;y++)for(const x of [0,3,4,7,8,11,12,15])eq(!!gdi('PtVisible',dc,x,y),y<416&&y%2===0&&x<12,'capacity clip');
    assert(user('EndPaint',h,ps));
    reset(h,callback(0,{capture:false}));assert(user('RedrawWindow',h,0,capacity,5));
    eq(user('RedrawWindow',h,0,0,0x20),1,'NOERASE capacity recovery');
    const recovered=user('BeginPaint',h,ps);assert(recovered);eq(r(record),0,'recovery suppressed');eq(r(ps+4),0,'recovery fErase');assert(user('EndPaint',h,ps));
  }
  // Invalid HRGN keeps the existing validation no-op contract; suppression is
  // still a successful flag action. No invented semantics for conflicting flags.
  for(const h of [mainWindow,child]){
    context='invalid-region/'+h;reset(h,callback(0,{capture:false}));
    put(rect,[2,2,4,10]);assert(user('InvalidateRect',h,rect,1));
    eq(user('RedrawWindow',h,rect,0xdeadbeef,0x28),1,'invalid region preserves published return');
    eq(user('GetUpdateRgn',h,output,0),2,'invalid HRGN overrides RECT');
    eq(gdi('GetRgnBox',output,box),2,'prior region');eq(read(box),[2,2,4,10],'invalid source leaves damage');
    const dc=user('BeginPaint',h,ps);assert(dc);eq(r(record),0,'successful NOERASE with invalid region');eq(r(ps+4),0,'invalid source fErase');assert(user('EndPaint',h,ps));
  }
  for(const q of [capacity,split,output,nestedOutput,red,black])assert(gdi('DeleteObject',q));
  for(const h of [otherWindow,child,mainWindow])assert(user('DestroyWindow',h));eq(freeRegions(),255,'regions recovered');
  console.log(JSON.stringify({checks,calls,failureCount,failureGroups,failures,entries}));assert.strictEqual(failureCount,0,'public RedrawWindow NOERASE');
  console.log(`PASS public RedrawWindow NOERASE (${checks} checks)`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
