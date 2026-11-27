#!/usr/bin/env node
'use strict';
// Public USER/GDI calls and real x86 callbacks. Contract sources:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-redrawwindow
// https://learn.microsoft.com/en-us/windows/win32/gdi/wm-paint
const assert=require('assert'),fs=require('fs'),crypto=require('crypto');
const {bootRenderHarness}=require('./render-helper');
const {compileSrcWasm}=require('./compile-src');
const {makeFixture,iat}=require('../tools/kernel32-native-fixture');
const u32=v=>[v,v>>>8,v>>>16,v>>>24].map(b=>b&255);
async function main(){
  const bytes=process.env.REDRAWWINDOW_INTERNALPAINT_TEST_MODULE?fs.readFileSync(process.env.REDRAWWINDOW_INTERNALPAINT_TEST_MODULE):compileSrcWasm();
  console.log(JSON.stringify({moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',prebuiltModule:new WebAssembly.Module(bytes)});
  const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_api_log(0);
  const alloc=n=>e.guest_alloc(n)>>>0,w=(p,v)=>e.guest_write32(p,v),r=p=>e.guest_read32(p)>>>0;
  const code=b=>{const p=alloc(b.length);b.forEach((v,i)=>e.guest_write8(p+i,v));return p;};
  const str=s=>code([...Buffer.from(s),0]),put=(p,a)=>a.forEach((v,i)=>w(p+4*i,v)),read=p=>[0,4,8,12].map(o=>r(p+o));
  const stack=alloc(32768)+16384;let calls=0,checks=0,context='setup';const failures=[];
  function call(address,args){
    w(stack,0);args.forEach((v,i)=>w(stack+4+i*4,v));e.set_esp(stack);e.clear_yield();e.set_eip(address);
    try{for(let i=0;i<256&&e.get_eip();i++)e.run(2048);}catch(err){console.error({context,calls});throw err;}
    assert.strictEqual(e.get_eip(),0,'guest returned '+context);assert.strictEqual(e.get_esp()>>>0,stack+4+args.length*4,'stdcall ESP');
    assert.strictEqual(e.get_sync_msg_depth(),0,'callback context unwound');calls++;return e.get_eax()>>>0;
  }
  const libs={},entries={};for(const dll of ['user32.dll','gdi32.dll']){libs[dll]=call(r(iat('LoadLibraryA')),[str(dll)]);assert(libs[dll]);}
  function entry(dll,name){const k=dll+':'+name;entries[k]||=call(r(iat('GetProcAddress')),[libs[dll],str(name)]);assert(entries[k],k);return entries[k];}
  const user=(n,...a)=>call(entry('user32.dll',n),a),gdi=(n,...a)=>call(entry('gdi32.dll',n),a);
  function eq(a,b,label){checks++;if(JSON.stringify(a)!==JSON.stringify(b))failures.push({context,label,actual:a,expected:b,lastMessage:read(msg)});}
  const ps=alloc(64),msg=alloc(32),rect=alloc(16),box=alloc(16),all=alloc(16),record=alloc(32);
  put(all,[0,0,16,14]);put(rect,[2,3,6,8]);const output=gdi('CreateRectRgn',0,0,0,0);
  const quiet=code([0xb8,...u32(1),0xc2,16,0]);
  function window(parent=0,initialPaint=true){
    const h=user('CreateWindowExA',0,str('STATIC'),str('internal paint'),parent?0x50000000:0x90000000,0,0,16,14,parent,0,0x400000,0);assert(h);
    assert(user('SetWindowLongA',h,-4,quiet));if(initialPaint){assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));}return h;
  }
  const mainWindow=window(),child=window(mainWindow),other=window();eq(e.get_main_hwnd()>>>0,mainWindow,'actual main');
  for(let i=0;i<128;i++){if(!user('PeekMessageA',msg,0,0,0,1))break;assert(i<127,'startup drain finite');}
  for(const h of [mainWindow,child,other]){assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));}
  const redraw=(h,flags)=>user('RedrawWindow',h,0,0,flags);
  function peek(filter=0,min=15,max=15,remove=1){put(msg,[0xcccccccc,0xcccccccc,0,0,0,0,0,0]);return user('PeekMessageA',msg,filter,min,max,remove);}
  function paintMessage(h,remove=1,filter=h){eq(peek(filter,15,15,remove),1,'PeekMessage paint available');eq(read(msg),[h,15,0,0],'public paint MSG');}
  // This first failure is deliberately the actual public queue contract,
  // before inspecting any implementation state or adding real damage.
  context='first empty internal public PeekMessage';eq(redraw(mainWindow,2),1,'request');paintMessage(mainWindow,0);
  if(failures.length){console.log(JSON.stringify({checks,calls,failures}));assert.fail('public PeekMessage missed RDW_INTERNALPAINT with empty update region');}
  eq(redraw(mainWindow,16),1,'cancel');
  for(const h of [mainWindow,child]){
    context='coalesced/no-remove/'+h;
    for(let i=0;i<3;i++)eq(redraw(h,2),1,'repeat request');
    paintMessage(h,0);paintMessage(h,0);paintMessage(h,1);eq(peek(h),0,'removed once');
    eq(redraw(h,2),1,'subsequent request');paintMessage(h);eq(peek(h),0,'subsequent once');
    context='validation independent/'+h;eq(redraw(h,2),1,'request');eq(redraw(h,8),1,'VALIDATE');paintMessage(h);eq(peek(h),0,'validation kept exactly one');
    context='cancellation/'+h;eq(redraw(h,2),1,'request');eq(redraw(h,16),1,'NOINTERNALPAINT');eq(peek(h),0,'cancelled clean paint');
    context='GetMessage/'+h;eq(redraw(h,2),1,'request');
    eq(user('GetMessageA',msg,h,15,15),1,'GetMessage return');eq(read(msg),[h,15,0,0],'GetMessage paint MSG');eq(peek(h),0,'GetMessage consumed');
  }
  const red=gdi('CreateSolidBrush',0xff),black=gdi('CreateSolidBrush',0);
  const eraseProc=code([0x83,0x7c,0x24,8,0x14,0x75,6,0xff,0x05,...u32(record),0xb8,...u32(1),0xc2,16,0]);
  function clean(h){assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));eq(redraw(h,16),1,'reset internal');
    if(h===mainWindow){assert(user('BeginPaint',child,ps));assert(user('EndPaint',child,ps));eq(redraw(child,16),1,'reset propagated child');}}
  function drainStartup(){for(let i=0;i<128;i++){if(!user('PeekMessageA',msg,0,0,0,1))return;assert(i<127,'startup drain finite');}}
  function pixels(h){const dc=user('GetDC',h);assert(dc);for(let y=0;y<14;y++)for(let x=0;x<16;x++)eq(gdi('GetPixel',dc,x,y),0,'internal paint leaves pixels');assert(user('ReleaseDC',h,dc));}
  for(const h of [mainWindow,child])for(const delivery of ['pending','peek','get']){
    context='empty queries/BeginPaint/'+h+'/'+delivery;clean(h);assert(user('SetWindowLongA',h,-4,eraseProc));w(record,0);
    const dc=user('GetDC',h);assert(dc);assert(user('FillRect',dc,all,black));assert(user('ReleaseDC',h,dc));
    if(h===mainWindow)clean(child); // Existing parent drawing exposes children.
    eq(redraw(h,2),1,'request');
    if(delivery==='peek')paintMessage(h);
    if(delivery==='get'){eq(user('GetMessageA',msg,h,15,15),1,'get empty');eq(read(msg),[h,15,0,0],'get empty MSG');}
    eq(user('GetUpdateRect',h,box,1),0,'clean rectangle query');eq(read(box),[0,0,0,0],'clean query bounds');
    eq(user('GetUpdateRgn',h,output,1),1,'clean region query');eq(gdi('GetRgnBox',output,box),1,'NULLREGION');eq(r(record),0,'queries do not erase');
    if(delivery==='pending')paintMessage(h,0);
    const pd=user('BeginPaint',h,ps);assert(pd);eq(read(ps+8),[0,0,0,0],'empty rcPaint');eq(r(ps+4),0,'empty fErase');
    for(let y=0;y<14;y++)for(let x=0;x<16;x++)eq(gdi('PtVisible',pd,x,y),0,'empty paint clip');
    assert(user('FillRect',pd,all,red));assert(user('EndPaint',h,ps));eq(r(record),0,'empty BeginPaint does not erase');pixels(h);if(h===mainWindow)clean(child);eq(peek(h),0,'BeginPaint consumed internal');
    assert(user('SetWindowLongA',h,-4,quiet));
  }
  for(const h of [mainWindow,child])for(const remove of [0,1]){
    context='filters/'+h+'/'+remove;clean(h);eq(redraw(h,2),1,'request');
    eq(peek(-1,15,15,remove),0,'thread-only hwnd excludes paint');eq(peek(other,15,15,remove),0,'foreign hwnd filter');
    eq(peek(h,16,16,remove),0,'message range excludes paint');eq(peek(h,0x400,0x500,remove),0,'user range excludes paint');
    paintMessage(h,0,h===child?mainWindow:0);paintMessage(h,1);eq(peek(h),0,'filters left one paint');clean(h);
  }
  for(const h of [mainWindow,child])for(const flags of [2,3,7])for(const validate of [false,true]){
    context='mixed real damage/'+h+'/'+flags+'/'+validate;clean(h);w(record,0);assert(user('SetWindowLongA',h,-4,eraseProc));
    eq(user('InvalidateRect',h,rect,1),1,'real damage and erase');eq(redraw(h,flags),1,'internal request');
    if(validate){eq(redraw(h,8),1,'validate real damage');paintMessage(h);eq(user('GetUpdateRect',h,box,0),0,'validation cleared damage');}
    else {
      eq(redraw(h,16),1,'suppress only internal');paintMessage(h,0);paintMessage(h);eq(user('GetUpdateRgn',h,output,0),2,'real damage survives');
      eq(gdi('GetRgnBox',output,box),2,'surviving damage kind');eq(read(box),flags===2?[2,3,6,8]:[0,0,16,14],'surviving bounds');
    }
    const pd=user('BeginPaint',h,ps);assert(pd);eq(r(record),validate?0:1,'normal damage retains erase');eq(r(ps+4),0,'handled erase');assert(user('EndPaint',h,ps));if(h===mainWindow)clean(child);eq(peek(h),0,'mixed consumed');assert(user('SetWindowLongA',h,-4,quiet));
  }
  context='matching selection skips earlier internal request';clean(mainWindow);clean(child);
  eq(redraw(mainWindow,2),1,'main pending');eq(redraw(child,2),1,'child pending');paintMessage(child);paintMessage(mainWindow);eq(peek(),0,'both consumed');
  context='posted queue priority';clean(mainWindow);eq(redraw(mainWindow,2),1,'pending behind post');eq(user('PostMessageA',other,0x402,7,9),1,'post');
  eq(peek(0,0,0,0),1,'posted no-remove');eq(read(msg),[other,0x402,7,9],'posted priority');eq(peek(0,0,0,1),1,'posted remove');eq(read(msg),[other,0x402,7,9],'same posted message');paintMessage(mainWindow);
  const tid=e.get_current_thread_id()>>>0;assert(tid);
  for(const h of [mainWindow,child]){context='thread ownership/'+h;clean(h);
    eq(redraw(h,2),1,'owner request');e.set_current_thread_id(tid+1);eq(peek(h),0,'other thread cannot consume');e.set_current_thread_id(tid);paintMessage(h);}
  const redrawEntry=entry('user32.dll','RedrawWindow'),updateEntry=entry('user32.dll','UpdateWindow'),destroyEntry=entry('user32.dll','DestroyWindow');
  function callback({renew=false,nested=false,destroy=false,message=15,returnValue=0}={}){
    const b=[0xff,0x05,...u32(record),0x8b,0x44,0x24,4,0xa3,...u32(record+4)];
    if(renew){
      const request=[0x6a,2,0x6a,0,0x6a,0,0xff,0x35,...u32(record+4),0xb8,...u32(redrawEntry),0xff,0xd0,0xa3,...u32(record+8)];
      if(nested)request.push(0xff,0x35,...u32(record+4),0xb8,...u32(updateEntry),0xff,0xd0,0xa3,...u32(record+12));
      b.push(0x83,0x3d,...u32(record),1,0x75,request.length,...request);
    }
    if(destroy)b.push(0xff,0x35,...u32(record+4),0xb8,...u32(destroyEntry),0xff,0xd0,0xa3,...u32(record+16));
    return code([0x83,0x7c,0x24,8,message,0x74,3,0xc2,16,0,...b,0xb8,...u32(returnValue),0xc2,16,0]);
  }
  for(const h of [mainWindow,child])for(const nested of [false,true]){
    context='reentrant UpdateWindow/'+h+'/'+nested;clean(h);put(record,[0,0,0,0,0,0,0,0]);assert(user('SetWindowLongA',h,-4,callback({renew:true,nested})));
    eq(redraw(h,2),1,'request');eq(user('UpdateWindow',h),1,'synchronous update');eq(r(record),nested?2:1,'nested paint count');eq(r(record+8),1,'callback requested again');
    if(nested)eq(peek(h),0,'nested consumed new request');else {paintMessage(h);eq(peek(h),0,'renewal survives callback return');}
    assert(user('SetWindowLongA',h,-4,quiet));clean(h);
  }
  for(const h of [mainWindow,child]){
    context='request during BeginPaint erase callback/'+h;clean(h);put(record,[0,0,0,0,0,0,0,0]);assert(user('SetWindowLongA',h,-4,callback({renew:true,message:20,returnValue:1})));
    eq(user('InvalidateRect',h,rect,1),1,'seed erase');const pd=user('BeginPaint',h,ps);assert(pd);eq(r(record),1,'one erase callback');eq(r(record+8),1,'callback requested internal');assert(user('EndPaint',h,ps));
    if(h===mainWindow)clean(child);paintMessage(h);eq(user('GetUpdateRect',h,box,0),0,'renewal has no damage');const empty=user('BeginPaint',h,ps);assert(empty);eq(read(ps+8),[0,0,0,0],'renewal empty paint');eq(r(record),1,'no repeated erase');assert(user('EndPaint',h,ps));assert(user('SetWindowLongA',h,-4,quiet));
  }
  context='callback destruction and slot reuse';const doomed=window(mainWindow);drainStartup();clean(doomed);put(record,[0,0,0,0,0,0,0,0]);assert(user('SetWindowLongA',doomed,-4,callback({destroy:true})));
  eq(redraw(doomed,2),1,'doomed request');eq(user('UpdateWindow',doomed),1,'destroying callback returns');eq(r(record),1,'one callback');eq(r(record+16),1,'destroy succeeded');eq(peek(doomed),0,'destroyed paint absent');
  for(let i=0;i<32;i++){
    const h=window(mainWindow,false);
    // Drain only startup messages; never retrieve WM_PAINT or call BeginPaint
    // before checking that slot recycling discarded the old internal bit.
    for(let n=0;n<8;n++){if(!peek(0,1,14,1))break;assert(n<7,'startup finite');}
    eq(redraw(h,8),1,'validate creation damage without cancelling internal');eq(peek(h),0,'reused slot has no internal state');
    eq(redraw(h,2),1,'new lifetime request');paintMessage(h);eq(redraw(h,2),1,'pending before destruction');assert(user('DestroyWindow',h));eq(peek(h),0,'destroyed pending cancelled');
  }
  context='native control consumes mixed request';
  const native=user('CreateWindowExA',0,str('STATIC'),str('native'),0x50000000,0,0,16,14,mainWindow,0,0x400000,0);assert(native);
  for(let i=0;i<8;i++){if(!peek(0,1,14,1))break;assert(i<7,'native startup finite');}
  clean(mainWindow); // Earlier child destruction may expose the parent.
  assert(user('BeginPaint',native,ps));assert(user('EndPaint',native,ps));
  eq(redraw(native,3),1,'native real plus internal');eq(peek(native),0,'native painter consumes combined request');eq(user('GetUpdateRect',native,box,0),0,'native damage consumed');eq(peek(native),0,'no leftover internal paint');
  eq(redraw(native,2),1,'fresh native internal only');paintMessage(native);eq(peek(native),0,'native internal once');assert(user('DestroyWindow',native));
  eq(e.paint_work_audit(),0,'paint counters consistent');
  console.log(JSON.stringify({checks,calls,failureCount:failures.length,failures:failures.slice(0,30),entries}));
  assert.strictEqual(failures.length,0,'public internal paint contract');
  for(const h of [other,child,mainWindow])assert(user('DestroyWindow',h));for(const q of [output,red,black])assert(gdi('DeleteObject',q));
  console.log(`PASS public RedrawWindow internal paint (${checks} checks)`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
