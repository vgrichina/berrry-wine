#!/usr/bin/env node
'use strict';
// Public imports and real x86 stdcall callbacks; no private paint helpers.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getupdaterect
const assert = require('assert'), fs = require('fs'), crypto = require('crypto');
const {bootRenderHarness} = require('./render-helper');
const {compileSrcWasm} = require('./compile-src');
const {makeFixture, iat} = require('../tools/kernel32-native-fixture');
const u32 = v => [v, v >>> 8, v >>> 16, v >>> 24].map(b => b & 255);
async function main() {
  const bytes = process.env.GETUPDATERECT_TEST_MODULE
    ? fs.readFileSync(process.env.GETUPDATERECT_TEST_MODULE) : compileSrcWasm();
  console.log(JSON.stringify({moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
  const {exports:e, memory} = await bootRenderHarness({fonts:'none', prebuiltModule:new WebAssembly.Module(bytes)});
  const pe = makeFixture(); new Uint8Array(memory.buffer).set(pe,e.get_staging());
  assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => e.guest_alloc(n) >>> 0, w = (p,v) => e.guest_write32(p,v);
  const r = p => e.guest_read32(p) >>> 0;
  const code = b => {const p=alloc(b.length); b.forEach((v,i)=>e.guest_write8(p+i,v)); return p;};
  const str = s => code([...Buffer.from(s),0]);
  const stack = alloc(16384)+8192;
  function call(entry,args) {
    w(stack,0); args.forEach((v,i)=>w(stack+4+i*4,v));
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for(let i=0;i<128 && e.get_eip();i++)e.run(1024);
    assert.strictEqual(e.get_eip(),0,'guest returns to caller');
    assert.strictEqual(e.get_esp()>>>0,stack+4+args.length*4,'public stdcall stack');
    assert.strictEqual(e.get_sync_msg_depth(),0,'callback context unwound');
    return e.get_eax()>>>0;
  }
  const libs={}, entries={}, calls={};
  for(const dll of ['user32.dll','gdi32.dll']) {libs[dll]=call(r(iat('LoadLibraryA')),[str(dll)]);assert(libs[dll]);}
  function entry(dll,name) {
    const key=dll+':'+name;
    entries[key] ||= call(r(iat('GetProcAddress')),[libs[dll],str(name)]);
    assert(entries[key],key);return entries[key];
  }
  function api(dll,name,...args) {const key=dll+':'+name;calls[key]=(calls[key]||0)+1;return call(entry(dll,name),args);}
  const user=(name,...args)=>api('user32.dll',name,...args), gdi=(name,...args)=>api('gdi32.dll',name,...args);
  const failures=[];let checks=0;
  function eq(label,actual,expected) {checks++;if(JSON.stringify(actual)!==JSON.stringify(expected))failures.push({label,actual,expected});}
  const put=(p,a)=>a.forEach((v,i)=>w(p+4*i,v)), read=p=>[0,4,8,12].map(o=>r(p+o));
  const damage=alloc(16), fresh=alloc(16), box=alloc(16), ps=alloc(64);
  const rect=[3,4,12,15], renewed=[12,4,18,15];put(damage,rect);put(fresh,renewed);
  const output=alloc(24)+4; w(output-4,0x12345678); w(output+16,0x76543210);
  const full=gdi('CreateRectRgn',0,0,200,200), nestedOutput=alloc(16);
  function inspect(label,expected) {
    eq(label+' box',read(output),expected);
    eq(label+' guards',[r(output-4),r(output+16)],[0x12345678,0x76543210]);
  }
  function pending(label,h,expected) {eq(label+' pending',user('GetUpdateRect',h,box,0),1);eq(label+' damage',read(box),expected);}
  function window(proc,parent=0) {
    const h=user('CreateWindowExA',0,str('STATIC'),str('Erase query'),parent?0x50000000:0x90000000,
      0,0,64,48,parent,0,0x400000,0);assert(h);
    // Creation marks its initial background for erase. Drain that request
    // through public BeginPaint before testing a new FALSE invalidation.
    assert(user('SetWindowLongA',h,-4,code([0xb8,...u32(1),0xc2,16,0])));
    assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));
    assert(user('SetWindowLongA',h,-4,proc));assert(user('ValidateRect',h,0));return h;
  }
  const update=entry('user32.dll','GetUpdateRect'), invalidate=entry('user32.dll','InvalidateRect');
  const clip=entry('gdi32.dll','GetClipBox'), select=entry('gdi32.dll','SelectClipRgn');
  // Every callback first checks the message, so creation/destruction are harmless.
  function proc(record,handled,{nested=0,renew=false}={}) {
    const body=[0xff,0x05,...u32(record), // count
      ...[4,8,12,16].flatMap((o,i)=>[0x8b,0x44,0x24,o,0xa3,...u32(record+4+i*4)]),
      0x89,0xe0,0xa3,...u32(record+20)];
    const invoke=(address,args)=>{for(const arg of [...args].reverse())body.push(0x68,...u32(arg));body.push(0xb8,...u32(address),0xff,0xd0);};
    const dcCall=(address,last)=>{body.push(0x68,...u32(last),0xff,0x35,...u32(record+12),0xb8,...u32(address),0xff,0xd0);};
    dcCall(clip,record+32);body.push(0xa3,...u32(record+24));
    dcCall(select,full);dcCall(clip,record+48);
    // Same-window query while the erase is in flight must not resend it.
    body.push(0x6a,1,0x68,...u32(nestedOutput),0xff,0x35,...u32(record+4),0xb8,...u32(update),0xff,0xd0,0xa3,...u32(record+28));
    if(nested)invoke(update,[nested,nestedOutput,1]);
    if(renew) {body.push(0x6a,2,0x68,...u32(fresh),0xff,0x35,...u32(record+4),0xb8,...u32(invalidate),0xff,0xd0);}
    // Deliberately disturb saved registers; the synchronous sender owns context.
    for(const op of [0xb9,0xba,0xbb,0xbd,0xbe,0xbf])body.push(op,...u32(0xaabbccdd));
    body.push(0xb8,...u32(handled),0xc2,16,0);
    return code([0x83,0x7c,0x24,8,0x14,0x74,5,0x31,0xc0,0xc2,16,0,...body]);
  }
  // Guest caller checks continuation, API EAX and all nonvolatile registers.
  const context=alloc(32);
  function query(h,erase,destination=output) {
    const b=[0x53,0x55,0x56,0x57];
    for(const [op,val] of [[0xbb,0x11223344],[0xbd,0x22334455],[0xbe,0x33445566],[0xbf,0x44556677]])b.push(op,...u32(val));
    b.push(0x68,...u32(erase),0x68,...u32(destination),0x68,...u32(h),0xb8,...u32(update),0xff,0xd0,0xa3,...u32(context));
    for(const [mod,off] of [[0x1d,4],[0x2d,8],[0x35,12],[0x3d,16]])b.push(0x89,mod,...u32(context+off));
    b.push(0x5f,0x5e,0x5d,0x5b,0xc3);call(code(b),[]);
    eq('query continuation context',[4,8,12,16].map(o=>r(context+o)),[0x11223344,0x22334455,0x33445566,0x44556677]);
    return r(context);
  }
  const windows=[];
  const parent=window(code([0xb8,...u32(1),0xc2,16,0])); windows.push(parent);
  for(const parentHwnd of [0,parent])for(const handled of [0,1,7,0x10000])for(const erase of [0,1,2]) {
    const record=alloc(64), wndproc=proc(record,handled);
    const h=parentHwnd ? window(wndproc,parentHwnd) : parent;
    if(parentHwnd) windows.push(h); else {
      // A zero-result previous callback leaves its erase request outstanding,
      // even after painting. Drain it before this independent main-window case.
      assert(user('SetWindowLongA',h,-4,code([0xb8,...u32(1),0xc2,16,0])));
      assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));
      assert(user('SetWindowLongA',h,-4,wndproc));
    }
    eq('clean TRUE FALSE',query(h,1),0);eq('clean no callback',r(record),0);
    inspect('clean destination',[0,0,0,0]);
    assert(user('InvalidateRect',h,damage,0));eq('dirty unmarked TRUE',query(h,1),1);
    eq('unmarked no callback',r(record),0);pending('unmarked',h,rect);
    assert(user('InvalidateRect',h,damage,1));eq('marked query',query(h,erase),1);
    eq('marked callback count',r(record),erase?1:0);inspect('destination',rect);pending('query leaves damage',h,rect);
    if(erase && r(record)) {
      eq('callback arguments',[r(record+4),r(record+8),r(record+16)],[h,0x14,0]);
      assert(r(record+12),'erase receives DC');assert(r(record+20)<stack,'callback has nested stack');
      eq('clip type',r(record+24),2);eq('erase DC clip',read(record+32),rect);
      eq('replacing application clip cannot escape update',read(record+48),rect);
      eq('nested query BOOL',r(record+28),1);
    }
    const before=r(record);eq('second marked query',query(h,1),1);
    eq('callback result governs pending erase',r(record)-before,erase && handled?0:1);
    pending('second query',h,rect);
    const n=r(record);assert(user('BeginPaint',h,ps));eq('BeginPaint remaining erase',r(record)-n,handled?0:1);
    eq('BeginPaint fErase',r(ps+4),handled?0:1);assert(user('EndPaint',h,ps));
    eq('clean after paint',query(h,1),0);eq('clean pending bit does not send',r(record),n+(handled?0:1));
  }
  // Cross-window nested callbacks and a fresh erase request during successful erase.
  const innerRecord=alloc(64), inner=window(proc(innerRecord,7));windows.push(inner);
  const outerRecord=alloc(64), outer=window(proc(outerRecord,7,{nested:inner,renew:true}),inner);windows.push(outer);
  assert(user('InvalidateRect',inner,damage,1));assert(user('InvalidateRect',outer,damage,1));
  eq('nested outer query',query(outer,2),1);eq('outer count',r(outerRecord),1);eq('inner count',r(innerRecord),1);
  inspect('outer output snapshot survives nesting',rect);
  pending('inner remains unvalidated',inner,rect);pending('outer new damage survives',outer,[3,4,18,15]);
  const n=r(outerRecord);assert(user('BeginPaint',outer,ps));eq('renewed erase retained',r(outerRecord),n+1);
  eq('renewed BeginPaint bounds',read(ps+8),[3,4,18,15]);assert(user('EndPaint',outer,ps));
  pending('EndPaint preserves callback reinvalidation',outer,renewed);
  // NULL output still sends an outstanding erase, with the same BOOL result.
  const nullRecord=alloc(64), nullWindow=window(proc(nullRecord,7),parent);windows.push(nullWindow);
  eq('NULL clean TRUE',query(nullWindow,1,0),0);eq('NULL clean callback',r(nullRecord),0);
  assert(user('InvalidateRect',nullWindow,damage,1));
  eq('NULL dirty FALSE',query(nullWindow,0,0),1);eq('NULL FALSE callback',r(nullRecord),0);
  eq('NULL dirty TRUE',query(nullWindow,2,0),1);eq('NULL TRUE callback',r(nullRecord),1);
  pending('NULL does not validate',nullWindow,rect);
  // Invalid HWND output remains unspecified; preserve FALSE and memory guards.
  for(const h of [0,0x7ffffffe]) {
    eq('invalid HWND TRUE',user('GetUpdateRect',h,output,1),0);
    eq('invalid HWND NULL TRUE',user('GetUpdateRect',h,0,2),0);
    eq('invalid HWND guards',[r(output-4),r(output+16)],[0x12345678,0x76543210]);
  }
  // Destroy children before parents and release every test-owned region.
  for(const h of windows.reverse())assert(user('DestroyWindow',h));
  for(const h of [full])assert(gdi('DeleteObject',h));
  console.log(JSON.stringify({checks,calls,entries,failures}));
  assert.deepStrictEqual(failures,[],'public GetUpdateRect synchronous erase contract');
  console.log(`PASS public GetUpdateRect synchronous erase (${checks} checks)`);
}
main().catch(e=>{console.error(e);process.exit(1);});
