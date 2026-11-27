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
  const blank='................',stripe='..##............';
  const disjoint=[blank,blank,...Array(8).fill(stripe),blank,blank,'#...............',blank];
  const single=[blank,blank,...Array(8).fill(stripe),blank,blank,blank,blank];
  const overlap=[blank,blank,'..#####.........','..#####.........','..########......','..########......',
    '..########......','.....#####......','.....#####......',blank,blank,blank,blank,blank];
  const hole=[blank,'.###########....','.###########....','.###########....','.###....####....',
    '.###....####....','.###....####....','.###....####....','.###########....','.###########....',blank,blank,blank,blank];
  const cutDisjoint=[blank,blank,stripe,stripe,blank,blank,blank,stripe,stripe,stripe,blank,blank,'#...............',blank];
  function mask(label,fn,rows) {
    eq(rows.length,14,label+' oracle rows');
    for(let y=0;y<14;y++){eq(rows[y].length,16,label+' oracle columns');for(let x=0;x<16;x++)eq(!!fn(x,y),rows[y][x]==='#',label+` [${x},${y}]`);}
  }
  function dirty(h,rs,erase=0){for(const a of rs){put(rect,a);assert(user('InvalidateRect',h,rect,erase));}}
  function query(label,h,rows,kind,bounds) {
    eq(user('GetUpdateRgn',h,output,0),kind,label+' complexity');
    eq(gdi('GetRgnBox',output,box),kind,label+' output complexity');eq(read(box),bounds,label+' output bbox');
    mask(label+' output',(x,y)=>gdi('PtInRegion',output,x,y),rows);
    // Clean RECT output belongs to the separate GetUpdateRect regression;
    // its NULL-output form isolates this store's unchanged BOOL convention.
    eq(user('GetUpdateRect',h,kind===1?0:box,0),kind===1?0:1,label+' bounding BOOL');
    if(kind!==1)eq(read(box),bounds,label+' bounding rectangle');
  }
  const cases=[
    ['single',[[2,2,4,10]],null,single,2,[2,2,4,10]],
    ['proven disjoint',[[0,12,1,13],[2,2,4,10]],null,disjoint,3,[0,2,4,13]],
    ['reverse disjoint',[[2,2,4,10],[0,12,1,13]],null,disjoint,3,[0,2,4,13]],
    ['adjacent coalesce',[[2,2,3,10],[3,2,4,10]],null,single,2,[2,2,4,10]],
    ['duplicate idempotent',[[2,2,4,10],[2,2,4,10]],null,single,2,[2,2,4,10]],
    ['overlap',[[2,2,7,7],[5,4,10,9]],null,overlap,3,[2,2,10,9]],
    ['interior validation',[[1,1,12,10]],[4,4,8,8],hole,3,[1,1,12,10]],
    ['disjoint partial validation',[[0,12,1,13],[2,2,4,10]],[2,4,4,7],cutDisjoint,3,[0,2,4,13]],
    ['empty validation',[[0,12,1,13],[2,2,4,10]],[2,4,2,7],disjoint,3,[0,2,4,13]],
    ['unrelated validation',[[0,12,1,13],[2,2,4,10]],[8,4,10,7],disjoint,3,[0,2,4,13]],
    ['bbox shrinks',[[0,12,1,13],[2,2,4,10]],[0,12,1,13],single,2,[2,2,4,10]],
    ['empty input',[[2,2,2,10],[5,5,3,9]],null,Array(14).fill(blank),1,[0,0,0,0]],
    ['complete validation',[[0,12,1,13],[2,2,4,10]],[0,0,16,14],Array(14).fill(blank),1,[0,0,0,0]],
  ];
  for(const h of [main,child,other])for(const [name,rs,validate,rows,kind,bounds] of cases) {
    assert(user('ValidateRect',h,0));dirty(h,rs);
    if(validate){put(rect,validate);assert(user('ValidateRect',h,rect));}
    query(name,h,rows,kind,bounds);
    // Empty BeginPaint retains the runtime's established full-client fallback.
    if(kind===1)continue;
    const dc0=user('GetDC',h);assert(dc0);assert(user('FillRect',dc0,all,black));assert(user('ReleaseDC',h,dc0));
    const dc=user('BeginPaint',h,ps);assert(dc);eq(read(ps+8),bounds,name+' rcPaint');
    mask(name+' paint clip',(x,y)=>gdi('PtVisible',dc,x,y),rows);
    gdi('SelectClipRgn',dc,full);
    mask(name+' replaced app clip',(x,y)=>gdi('PtVisible',dc,x,y),rows);
    assert(user('FillRect',dc,all,red));eq(user('GetUpdateRgn',h,output,0),1,'BeginPaint consumed before EndPaint');
    assert(user('EndPaint',h,ps));
    const readDC=user('GetDC',h);assert(readDC);
    mask(name+' actual painted pixels',(x,y)=>gdi('GetPixel',readDC,x,y)===0xff,rows);
    assert(user('ReleaseDC',h,readDC));
  }
  // Independent pending shapes on parent and child; validating one cannot
  // mutate the other or a previously copied output region.
  assert(user('ValidateRect',main,0));assert(user('ValidateRect',child,0));
  dirty(main,[[0,12,1,13],[2,2,4,10]]);dirty(child,[[2,2,4,10]]);
  query('parent isolated',main,disjoint,3,[0,2,4,13]);
  assert(user('ValidateRect',main,0));mask('copied snapshot',(x,y)=>gdi('PtInRegion',output,x,y),disjoint);
  query('child isolated',child,single,2,[2,2,4,10]);assert(user('ValidateRect',child,0));

  // An erase callback sees the exact snapshot. BeginPaint validates before
  // entry; GetUpdateRgn does not. A real nested BeginPaint consumes fresh
  // damage, then a still newer invalidation survives both EndPaint calls.
  const record=alloc(64),sample=alloc(16*14*4),nestedSample=alloc(16*14*4),nestedPS=alloc(64);
  const renewed=alloc(16),latest=alloc(16);put(renewed,[8,3,10,5]);put(latest,[12,10,14,12]);
  const latestMask=[...Array(10).fill(blank),'............##..','............##..',blank,blank];
  const renewedMask=[blank,blank,blank,'........##......','........##......',...Array(9).fill(blank)];
  const invalidate=entry('user32.dll','InvalidateRect'),get=entry('user32.dll','GetUpdateRgn');
  const begin=entry('user32.dll','BeginPaint'),end=entry('user32.dll','EndPaint'),visible=entry('gdi32.dll','PtVisible');
  function callback(nest) {
    const b=[0xff,0x05,...u32(record),0x8b,0x44,0x24,4,0xa3,...u32(record+4),
      0x8b,0x44,0x24,12,0xa3,...u32(record+8)];
    const push=a=>b.push(...a),imm=v=>[0x68,...u32(v)],mem=p=>[0xff,0x35,...u32(p)];
    function invoke(address,args){for(const arg of [...args].reverse())push(arg);push([0xb8,...u32(address),0xff,0xd0]);}
    function capture(dc,dst){for(let y=0;y<14;y++)for(let x=0;x<16;x++){
      invoke(visible,[mem(dc),imm(x),imm(y)]);push([0xa3,...u32(dst+4*(y*16+x))]);}}
    invoke(get,[mem(record+4),imm(output),imm(1)]);push([0xa3,...u32(record+12)]);
    if(nest){
      invoke(invalidate,[mem(record+4),imm(renewed),imm(0)]);
      invoke(begin,[mem(record+4),imm(nestedPS)]);push([0xa3,...u32(record+16)]);
      capture(record+16,nestedSample);
      invoke(invalidate,[mem(record+4),imm(latest),imm(0)]);
      invoke(end,[mem(record+4),imm(nestedPS)]);
    }
    invoke(entry('gdi32.dll','SelectClipRgn'),[mem(record+8),imm(full)]);
    capture(record+8,sample);push([0xb8,...u32(7),0xc2,16,0]);
    return code([0x83,0x7c,0x24,8,0x14,0x74,5,0x31,0xc0,0xc2,16,0,...b]);
  }
  for(const paint of [false,true]) {
    assert(user('ValidateRect',other,0));put(record,Array(16).fill(0));
    assert(user('SetWindowLongA',other,-4,callback(paint)));
    dirty(other,[[0,12,1,13],[2,2,4,10]],1);
    if(paint){const dc=user('BeginPaint',other,ps);assert(dc);eq(r(record+12),1,'callback sees consumed update');
      mask('nested fresh clip',(x,y)=>r(nestedSample+4*(y*16+x)),renewedMask);
      mask('outer snapshot after nested paint',(x,y)=>gdi('PtVisible',dc,x,y),disjoint);
      assert(user('EndPaint',other,ps));query('newest survives EndPaint',other,latestMask,2,[12,10,14,12]);
    }else{eq(user('GetUpdateRgn',other,output,1),3,'erase query returns complex');eq(r(record+12),3,'query callback leaves update');
      query('query nonvalidating',other,disjoint,3,[0,2,4,13]);}
    eq(r(record),1,'erase callback exactly once');mask('erase callback clip',(x,y)=>r(sample+4*(y*16+x)),disjoint);
    assert(user('SetWindowLongA',other,-4,quiet));
  }

  // Bounded storage: 208 disjoint spans fit, the 209th fails atomically.
  // No expected mask comes from CombineRgn/GetRgnData or private storage.
  const wide=window(0,432);assert(user('ValidateRect',wide,0));
  for(let x=0;x<416;x+=2)dirty(wide,[[x,2,x+1,3]]);
  eq(user('GetUpdateRgn',wide,output,0),3,'capacity shape');
  put(rect,[418,2,419,3]);eq(user('InvalidateRect',wide,rect,0),0,'overflow reports failure');
  eq(user('GetUpdateRgn',wide,output,0),3,'overflow keeps prior damage');
  for(let x=0;x<432;x++)eq(!!gdi('PtInRegion',output,x,2),x<416&&x%2===0,'bounded exact span '+x);
  // Splitting every span in two also exceeds capacity and leaves it intact.
  assert(user('ValidateRect',wide,0));for(let x=0;x<416;x+=2)dirty(wide,[[x,1,x+1,6]]);
  put(rect,[0,3,432,4]);eq(user('ValidateRect',wide,rect),0,'subtraction overflow reports failure');
  eq(user('GetUpdateRgn',wide,output,0),3,'failed subtraction preserves shape');
  for(let x=0;x<432;x++)eq(!!gdi('PtInRegion',output,x,3),x<416&&x%2===0,'failed subtraction exact '+x);
  const wideDC=user('BeginPaint',wide,ps);assert(wideDC);eq(read(ps+8),[0,1,415,6],'capacity rcPaint');
  for(let x=0;x<432;x++)eq(!!gdi('PtVisible',wideDC,x,3),x<416&&x%2===0,'capacity paint clip '+x);
  eq(user('GetUpdateRgn',wide,output,0),1,'capacity BeginPaint consumes');assert(user('EndPaint',wide,ps));
  assert(user('DestroyWindow',wide));
  // Exhaust only public region handles. Pending damage still lives in its
  // private bounded store; failed paint-clip setup cannot validate it or
  // return an unconstrained DC. Releasing the handles allows a normal retry.
  assert(user('ValidateRect',other,0));dirty(other,[[0,12,1,13],[2,2,4,10]]);
  const held=[];for(let i=0;i<256;i++){const h=gdi('CreateRectRgn',0,0,0,0);if(!h)break;held.push(h);}
  eq(user('BeginPaint',other,ps),0,'region exhaustion fails paint preparation');eq(r(ps),0,'failed paint has no DC');
  query('failed paint preserves exact damage',other,disjoint,3,[0,2,4,13]);
  for(const h of held)assert(gdi('DeleteObject',h));
  const retryDC=user('BeginPaint',other,ps);assert(retryDC);
  mask('paint after resource recovery',(x,y)=>gdi('PtVisible',retryDC,x,y),disjoint);assert(user('EndPaint',other,ps));
  function freeRegions(){const hs=[];for(let i=0;i<256;i++){const h=gdi('CreateRectRgn',0,0,0,0);if(!h)break;hs.push(h);}
    for(const h of hs)assert(gdi('DeleteObject',h));return hs.length;}
  const available=freeRegions();
  // More than the entire HRGN table and repeated HWND-slot reuse. Alternate
  // dirty teardown and consumed paints so both lifetimes are exercised.
  for(let i=0;i<260;i++){
    const h=window();eq(user('GetUpdateRgn',h,output,0),1,'recycled slot clean');
    dirty(h,[[0,12,1,13],[2,2,4,10]]);
    if(i%2===0){assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));}
    assert(user('DestroyWindow',h));
  }
  eq(freeRegions(),available,'paint and dirty teardown leak no HRGN handles');
  for(const h of [child,other,main])assert(user('DestroyWindow',h));
  for(const h of [output,full,red,black])assert(gdi('DeleteObject',h));
  eq(freeRegions(),255,'all public region slots recovered after teardown');
  console.log(JSON.stringify({checks,calls,entries}));console.log(`PASS exact public update regions (${checks} checks)`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
