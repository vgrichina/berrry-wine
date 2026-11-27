#!/usr/bin/env node
'use strict';
// Public display-DC contract: pending client damage is excluded, never consumed.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-excludeupdatergn
// https://learn.microsoft.com/en-us/windows/win32/gdi/excluding-the-update-region
const assert=require('assert'),fs=require('fs'),crypto=require('crypto'),zlib=require('zlib');
const {bootRenderHarness}=require('./render-helper');
const {compileSrcWasm}=require('./compile-src');
const {makeFixture,iat}=require('../tools/kernel32-native-fixture');
const u32=v=>[v,v>>>8,v>>>16,v>>>24].map(b=>b&255);
async function main(){
  const file=process.env.EXCLUDEUPDATERGN_MODULE;
  const bytes=file?(file.endsWith('.gz')?zlib.gunzipSync(fs.readFileSync(file)):fs.readFileSync(file)):compileSrcWasm();
  console.log(JSON.stringify({moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',prebuiltModule:new WebAssembly.Module(bytes)});
  const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_api_log(0);
  const alloc=n=>e.guest_alloc(n)>>>0,w=(p,v)=>e.guest_write32(p,v),r=p=>e.guest_read32(p)>>>0;
  const code=b=>{const p=alloc(b.length);b.forEach((v,i)=>e.guest_write8(p+i,v));return p;};
  const str=s=>code([...Buffer.from(s),0]),put=(p,a)=>a.forEach((v,i)=>w(p+4*i,v));
  const stack=alloc(32768)+16384;let calls=0,checks=0,cases=0;
  function call(p,args){w(stack,0);args.forEach((v,i)=>w(stack+4+i*4,v));e.set_esp(stack);e.clear_yield();e.set_eip(p);
    for(let i=0;i<256&&e.get_eip();i++)e.run(2048);
    assert.strictEqual(e.get_eip(),0,'public call returned');assert.strictEqual(e.get_esp()>>>0,stack+4+args.length*4,'stdcall ESP');
    assert.strictEqual(e.get_sync_msg_depth(),0,'callbacks unwound');calls++;return e.get_eax()>>>0;}
  const libs={},entries={};for(const dll of ['user32.dll','gdi32.dll']){libs[dll]=call(r(iat('LoadLibraryA')),[str(dll)]);assert(libs[dll]);}
  function entry(dll,name){const k=dll+':'+name;entries[k]||=call(r(iat('GetProcAddress')),[libs[dll],str(name)]);assert(entries[k],k);return entries[k];}
  const user=(n,...a)=>call(entry('user32.dll',n),a),gdi=(n,...a)=>call(entry('gdi32.dll',n),a);
  const eq=(a,b,label)=>{checks++;assert.deepStrictEqual(a,b,label);};
  const rect=alloc(16),box=alloc(16),ps=alloc(64),point=alloc(8),all=alloc(16),counts=alloc(8);
  // Count WM_PAINT and WM_ERASEBKGND without calling any paint API.
  const proc=code([0x8b,0x44,0x24,8,0x83,0xf8,15,0x75,6,0xff,5,...u32(counts),0x83,0xf8,20,0x75,6,0xff,5,...u32(counts+4),0x31,0xc0,0xc2,16,0]);
  function window(parent,x,y,width,height,style=0){const h=user('CreateWindowExA',0,str('STATIC'),str('ExcludeUpdateRgn'),(parent?0x50000000:0x10000000)|style,x,y,width,height,parent,0,0x400000,0);assert(h);assert(user('SetWindowLongA',h,-4,proc));assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));user('ValidateRect',h,0);return h;}
  const main=window(0,23,31,80,60),child=window(main,17,13,12,10);
  const baseline=user('GetDC',child);assert(baseline);
  if(process.env.EXCLUDEUPDATERGN_BASELINE){
    // A strict preimplementation run must reach the public unresolved thunk.
    user('ExcludeUpdateRgn',baseline,child);throw Error('baseline unexpectedly implemented');
  }
  assert(user('ReleaseDC',child,baseline));
  const red=gdi('CreateSolidBrush',0xff),black=gdi('CreateSolidBrush',0),out=gdi('CreateRectRgn',0,0,0,0),before=gdi('CreateRectRgn',0,0,0,0);
  function region(rects){const q=gdi('CreateRectRgn',0,0,0,0);assert(q);for(const a of rects){const t=gdi('CreateRectRgn',...a);assert(t);assert(gdi('CombineRgn',q,q,t,2));assert(gdi('DeleteObject',t));}return q;}
  const inside=(a,x,y)=>a.some(([l,t,r,b])=>x>=l&&x<r&&y>=t&&y<b);
  function visible(dc,width,height,expected,label){for(let y=0;y<height;y++)for(let x=0;x<width;x++)eq(!!gdi('PtVisible',dc,x,y),expected(x,y),label+` case=${cases} [${x},${y}]`);}
  function pending(h,q,label){eq(user('GetUpdateRgn',h,out,0),gdi('GetRgnBox',q,box),label+' complexity');eq(gdi('EqualRgn',out,q),1,label+' exact damage');}
  function counters(){return[r(counts),r(counts+4)];}
  const patterns=[[],[[2,2,6,7]],[[1,1,3,3],[7,6,9,8]],[[0,0,10,2],[0,2,2,8],[8,2,10,8],[0,8,10,10]],[[0,0,10,10]],[[0,0,5,10]]];
  for(const h of [main,child]){
    assert(user('GetClientRect',h,box));const width=r(box+8),height=r(box+12);assert(width>=10&&height>=10);put(all,[0,0,width,height]);
    for(const sourceRects of patterns)for(const appRects of [null,[[0,0,10,10]],[[0,0,5,10]],[[0,0,2,10],[8,0,10,10]]]){
      cases++;const full=sourceRects.length===1&&sourceRects[0][2]===10&&sourceRects[0][3]===10&&sourceRects[0][0]===0?[[0,0,width,height]]:sourceRects;
      const damage=region(full),app=appRects&&region(appRects);user('ValidateRect',h,0);if(full.length)assert(user('InvalidateRgn',h,damage,1));pending(h,damage,'before');
      const clear=user('GetDC',h);assert(clear);assert(user('FillRect',clear,all,black));assert(user('ReleaseDC',h,clear));
      const dc=user('GetDC',h);assert(dc);if(app)assert(gdi('SelectClipRgn',dc,app));
      const saved=gdi('SaveDC',dc);assert(saved);const oldCounts=counters(),oldFlags=[e.nc_flags_test(h),e.paint_flag_test(h),...Array.from({length:5},(_,i)=>e.paint_work_count(i))];
      const expected=region(appRects||[[0,0,width,height]]);assert(gdi('CombineRgn',expected,expected,damage,4));
      const kind=gdi('GetRgnBox',expected,box);eq(user('ExcludeUpdateRgn',dc,h),kind,'result complexity');
      const mask=(x,y)=>(!appRects||inside(appRects,x,y))&&!inside(full,x,y);
      visible(dc,width,height,mask,'excluded points');eq(gdi('GetClipRgn',dc,out),1,'application clip exists');eq(gdi('EqualRgn',out,expected),1,'exact resulting clip');
      eq(user('ExcludeUpdateRgn',dc,h),kind,'repeated exclusion');pending(h,damage,'after');eq(counters(),oldCounts,'no premature paint/erase');
      eq([e.nc_flags_test(h),e.paint_flag_test(h),...Array.from({length:5},(_,i)=>e.paint_work_count(i))],oldFlags,'erase and pending paint preserved');
      assert(user('FillRect',dc,all,red));assert(gdi('RestoreDC',dc,saved));visible(dc,width,height,(x,y)=>!appRects||inside(appRects,x,y),'restore points');
      assert(user('ReleaseDC',h,dc));const read=user('GetDC',h);assert(read);for(let y=0;y<height;y++)for(let x=0;x<width;x++)eq(gdi('GetPixel',read,x,y)===0xff,mask(x,y),'actual pixels');
      assert(user('ReleaseDC',h,read));pending(h,damage,'draw does not validate');eq(counters(),oldCounts,'drawing does not paint/erase');
      if(full.length){const paint=user('BeginPaint',h,ps);assert(paint);eq(r(ps+4),1,'erase debt preserved');eq(counters()[1],oldCounts[1]+1,'erase occurs only on BeginPaint');
        eq(user('GetUpdateRgn',h,out,0),1,'BeginPaint consumes');assert(user('EndPaint',h,ps));}
      for(const q of [damage,app,expected])if(q)assert(gdi('DeleteObject',q));
    }
  }
  // In-place changes to pending damage never reinterpret a retained DC clip.
  user('ValidateRect',child,0);put(rect,[2,2,6,7]);assert(user('InvalidateRect',child,rect,1));
  const held=user('GetDC',child);assert(held);assert(user('ExcludeUpdateRgn',held,child));
  assert(user('ValidateRect',child,0));put(rect,[7,1,9,3]);assert(user('InvalidateRect',child,rect,0));
  visible(held,12,10,(x,y)=>!inside([[2,2,6,7]],x,y),'immutable exclusion');
  assert(gdi('SelectClipRgn',held,0));visible(held,12,10,()=>true,'explicit application reset');
  assert(user('ReleaseDC',child,held));
  // Supplied GetDCEx regions are screen-space; application clipping remains
  // device-space and cannot expand retained USER parent/hierarchy operands.
  const kid=window(child,3,3,2,2),sibling=window(main,17,13,2,2);
  for(const flags of [0,4,8,16,24,28])for(const mode of [0,0x40,0x80]){
    user('ValidateRect',child,0);put(rect,[2,1,7,8]);assert(user('InvalidateRect',child,rect,1));
    put(point,[0,0]);assert(user('ClientToScreen',child,point));const ox=r(point)|0,oy=r(point+4)|0;
    const src=mode?region([[ox,oy,ox+8,oy+9]]):0,dc=user('GetDCEx',child,src,flags|mode);assert(dc);
    const initial=Array.from({length:120},(_,i)=>!!gdi('PtVisible',dc,i%12,Math.floor(i/12)));
    const save=gdi('SaveDC',dc);assert(save);assert(user('ExcludeUpdateRgn',dc,child));
    const expected=(x,y)=>initial[y*12+x]&&!inside([[2,1,7,8]],x,y);
    visible(dc,12,10,expected,'GetDCEx intersection');
    user('ShowWindow',kid,0);user('ShowWindow',kid,5);visible(dc,12,10,expected,'GetDCEx refresh retains app exclusion');
    assert(gdi('RestoreDC',dc,save));visible(dc,12,10,(x,y)=>initial[y*12+x],'GetDCEx restored USER clip');
    assert(user('ReleaseDC',child,dc));
  }
  user('ShowWindow',kid,0);user('ShowWindow',sibling,0);
  // Invalid handles and unsupported DC associations fail without creating a
  // clip or consuming update/erase/paint state. No mapping contract is guessed
  // for memory or differently associated display DCs.
  user('ValidateRect',child,0);put(rect,[2,1,7,8]);assert(user('InvalidateRect',child,rect,1));
  const valid=user('GetDC',child),memoryDC=gdi('CreateCompatibleDC',valid),whole=user('GetWindowDC',child),other=user('GetDC',main);assert(valid&&memoryDC&&whole&&other);
  const snapshot=()=>[e.nc_flags_test(child),e.paint_flag_test(child),...counters()];
  const oldState=snapshot();assert(user('GetUpdateRgn',child,before,0));
  for(const [dc,h] of [[0,child],[0x7ffffffe,child],[valid,0],[valid,0x7ffffffe],[memoryDC,child],[other,child]]){
    eq(user('ExcludeUpdateRgn',dc,h),0,'invalid/unsupported failure');eq(snapshot(),oldState,'failure flags atomic');pending(child,before,'failure damage atomic');
  }
  const stale=user('GetDC',child);assert(stale);assert(user('ReleaseDC',child,stale));eq(user('ExcludeUpdateRgn',stale,child),0,'released HDC fails');
  assert(gdi('DeleteDC',memoryDC));assert(user('ReleaseDC',child,whole));assert(user('ReleaseDC',main,other));
  // Device-space damage stays fixed under changed logical mapping. Querying
  // logical points must invert the translation, not transform update bands.
  assert(gdi('SetWindowOrgEx',valid,3,4,0));assert(gdi('SetViewportOrgEx',valid,7,9,0));
  assert(user('ExcludeUpdateRgn',valid,child));
  for(let y=0;y<10;y++)for(let x=0;x<12;x++)eq(!!gdi('PtVisible',valid,x-4,y-5),!inside([[2,1,7,8]],x,y),'translated MM_TEXT device damage');
  assert(user('ReleaseDC',child,valid));
  // Bordered window DCs (including DCX_PARENTCLIP) use a physical window
  // origin. The update store still uses the client origin: translate once.
  const bordered=window(main,35,5,16,16,0x00800000);
  put(point,[0,0]);assert(user('ClientToScreen',bordered,point));assert(user('GetWindowRect',bordered,box));
  const dx=(r(point)-r(box))|0,dy=(r(point+4)-r(box+4))|0;eq([dx,dy],[1,1],'border client offset');
  for(const flags of [1,4,5]){
    user('ValidateRect',bordered,0);put(rect,[2,2,6,7]);assert(user('InvalidateRect',bordered,rect,1));
    const dc=user('GetDCEx',bordered,0,flags);assert(dc);const initial=Array.from({length:144},(_,i)=>!!gdi('PtVisible',dc,i%12,Math.floor(i/12)));
    assert(user('ExcludeUpdateRgn',dc,bordered));visible(dc,12,12,(x,y)=>initial[y*12+x]&&!inside([[2+dx,2+dy,6+dx,7+dy]],x,y),'window-origin physical offset');
    assert(user('ReleaseDC',bordered,dc));
  }
  assert(user('DestroyWindow',bordered));
  // Exact store at its 208-band boundary. Excluding a single full-height
  // stripe from an already 208-band app clip overflows GDI's result capacity.
  const large=window(main,0,0,40,44),many=[];
  for(let y=0;y<13;y++)for(let x=0;x<16;x++)many.push([x*2,y*2,x*2+1,y*2+1]);
  const damage208=region(many);assert(user('InvalidateRgn',large,damage208,1));pending(large,damage208,'208 exact pending');
  const largeDC=user('GetDC',large);assert(largeDC);const result208=user('ExcludeUpdateRgn',largeDC,large);
  eq(result208,0,'208 damage complement exceeds GDI result capacity');
  eq(gdi('GetClipRgn',largeDC,out),0,'208 result capacity failure leaves no clip');visible(largeDC,32,26,()=>true,'208 result failure points');
  pending(large,damage208,'208 exclusion preserves pending');assert(user('ReleaseDC',large,largeDC));
  for(const appRects of [[[0,0,40,44]],[[0,0,1,26]]]){
    const app=region(appRects),dc=user('GetDC',large);assert(dc);assert(gdi('SelectClipRgn',dc,app));
    if(appRects[0][2]===40){eq(user('ExcludeUpdateRgn',dc,large),0,'208 result failure with existing app clip');eq(gdi('GetClipRgn',dc,out),1,'208 preserves app ownership');eq(gdi('EqualRgn',out,app),1,'208 preserves app bands');}
    else{eq(user('ExcludeUpdateRgn',dc,large),3,'208 source succeeds with bounded intersection');visible(dc,32,26,(x,y)=>x<1&&!inside(many,x,y),'208 source exact intersection');}
    pending(large,damage208,'208 source immutable');assert(user('ReleaseDC',large,dc));assert(gdi('DeleteObject',app));
  }
  user('ValidateRect',large,0);assert(user('DestroyWindow',large));assert(gdi('DeleteObject',damage208));
  // Exhaust HRGNs after acquiring the DC, both without and with an app clip.
  for(const appPresent of [false,true]){
    const dc=user('GetDC',child);assert(dc);const app=region([[0,0,8,10]]);if(appPresent)assert(gdi('SelectClipRgn',dc,app));
    const old=snapshot(),regions=[];assert(user('GetUpdateRgn',child,before,0));
    for(let i=0;i<256;i++){const q=gdi('CreateRectRgn',0,0,1,1);if(!q)break;regions.push(q);}assert(regions.length>200);
    for(let i=0;i<4;i++){eq(user('ExcludeUpdateRgn',dc,child),0,'no HRGN capacity');eq(snapshot(),old,'capacity flags atomic');pending(child,before,'capacity damage atomic');eq(gdi('GetClipRgn',dc,out),appPresent?1:0,'capacity clip ownership');if(appPresent)eq(gdi('EqualRgn',out,app),1,'capacity exact app clip');}
    assert(gdi('DeleteObject',regions.pop()));assert(user('ExcludeUpdateRgn',dc,child),'one free HRGN suffices');
    for(const q of regions)assert(gdi('DeleteObject',q));assert(gdi('DeleteObject',app));assert(user('ReleaseDC',child,dc));
  }
  const used=e.gdi_dc_state_used();
  for(let i=0;i<600;i++){const dc=user('GetDC',child);assert(dc);eq(gdi('GetClipRgn',dc,out),0,'reacquire resets app clip');assert(gdi('SaveDC',dc));assert(user('ExcludeUpdateRgn',dc,child));if(i%2){assert(gdi('RestoreDC',dc,-1));eq(gdi('GetClipRgn',dc,out),0,'restore empty clip');}assert(user('ReleaseDC',child,dc));}
  eq(e.gdi_dc_state_used(),used,'600 DC lifetimes no leak');
  for(const q of [red,black,out,before])assert(gdi('DeleteObject',q));
  console.log(JSON.stringify({cases,calls,checks}));console.log('PASS ExcludeUpdateRgn public pending damage, clips, pixels and lifecycle');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
