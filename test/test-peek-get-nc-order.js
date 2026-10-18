#!/usr/bin/env node
'use strict';
// Uses only the shipped module and ordinary API thunks; never compiles WAT.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = process.env.WA_TEST_ROOT || path.resolve(__dirname, '..');
const { createHostImports } = require(path.join(root, 'lib/host-imports'));
const regions = require(path.join(root, 'lib/region-map.generated'));
const apis = require(path.join(root, 'src/api_table.json'));
(async () => {
  const wasm = fs.readFileSync(process.env.WA_TEST_WASM || path.join(root, 'build/wine-assembly.wasm'));
  const memory = new WebAssembly.Memory({initial:8192, maximum:8192, shared:true});
  const view = new DataView(memory.buffer);
  const ctx = {getMemory:()=>memory.buffer, resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}}};
  const imports = createHostImports(ctx);
  let pending = [], last = null, dequeues = 0;
  Object.assign(imports.host, {memory, log(){}, log_i32(){},
    check_input(){ last = pending.shift(); if(last) dequeues++; return last ? (last[2]<<16)|last[1] : 0; },
    check_input_hwnd(){return last[0];}, check_input_lparam(){return last[3];},
    get_tick_count(){return 1234;},
    get_window_rect(hwnd, ptr){ [10,20,210,120].forEach((n,i)=>view.setInt32(ptr+i*4,n,true)); }
  });
  const {instance} = await WebAssembly.instantiate(wasm, imports);
  const e = ctx.exports = instance.exports;
  const image=0x400000, thunk=0x7500000, msg=0x520000, stack=0x510000, hwnd=0x10001;
  const names=['PeekMessageA','GetMessageA','CreateWindowExA'];
  e.init_thread(0,image,image,0x600000,thunk,thunk+names.length*8,names.length,0);
  names.forEach((name,i)=>view.setUint32(regions.BASE.THUNK_BASE+i*8+4,apis.find(a=>a.name===name).id,true));
  e.set_hwnd_base(hwnd+1); e.wnd_table_set(hwnd,0x401000); e.wnd_set_style_export(hwnd,0x10000000);
  const wa = g => g-image+e.get_guest_base();
  function call(get=false, remove=0, min=0, max=0) {
    const args = get ? [msg,0,min,max] : [msg,0,min,max,remove];
    [0,...args].forEach((n,i)=>view.setUint32(wa(stack)+i*4,n,true));
    e.clear_yield(); e.set_esp(stack); e.set_eip(thunk+(get?8:0)); e.run(100);
    assert.strictEqual(e.get_eip(),0,'API returned to sentinel');
    return {ok:e.get_eax(), tuple:[0,4,8,12].map(off=>view.getUint32(wa(msg)+off,true))};
  }
  const results=[];
  function normalize(result) {
    if(result.tuple[1]!==0x83) return result;
    // NCCALCSIZE owns scratch storage; compare the pointed-to rectangle too.
    return {...result, tuple:[...result.tuple.slice(0,3), [0,4,8,12].map(off=>view.getInt32(wa(result.tuple[3])+off,true))]};
  }
  for(const removeWith of ['get','peek']) for(const bit of [0,1,4]) for(const key of [0,0x100,0x101]) {
    if(!bit&&!key) continue;
    assert.strictEqual(call().ok,0,'starts idle');
    const before=dequeues;
    if(bit===1)e.nc_post_paint(hwnd);
    if(bit===4)e.nc_post_calcsize(hwnd);
    if(key)pending.push([hwnd,key,0x26,key===0x100?0x1480001:0xc1480001]);
    const peek=call(); const removed=call(removeWith==='get',1);
    const row={removeWith,bit,key,peek,removed,equal:JSON.stringify(normalize(peek))===JSON.stringify(normalize(removed)), inputFirst:!key||peek.tuple[1]===key};
    const delivered=[removed.tuple];
    for(let i=0;i<4;i++){const next=call(false,1);if(!next.ok)break;delivered.push(next.tuple);}
    row.delivered=delivered; row.dequeues=dequeues-before; row.flags=e.nc_flags_test(hwnd);
    assert.strictEqual(delivered.filter(t=>t[1]===key).length,key?1:0,'key delivered once');
    if(bit) assert.strictEqual(delivered.filter(t=>t[1]===(bit===1?0x85:0x83)).length,1,'NC delivered once');
    assert.strictEqual(row.dequeues,key?1:0,'host dequeues once');
    assert.strictEqual(row.flags & 5,0,'NC consumed');
    results.push(row);
  }
  // Posted messages precede deferred NC work in both message APIs too.
  for (const bit of [1,4]) {
    e[bit===1?'nc_post_paint':'nc_post_calcsize'](hwnd);
    assert.strictEqual(e.post_message_q(hwnd,0x401,0x1234,0x5678),1);
    const peek=call();
    assert.deepStrictEqual(peek.tuple,[hwnd,0x401,0x1234,0x5678],'posted work precedes NC');
    assert.deepStrictEqual(call(true),peek,'posted Peek/Get agree');
    assert.strictEqual(call(false,1).tuple[1],bit===1?0x85:0x83);
    assert.strictEqual(call().ok,0,'posted case drained');
  }
  // A range-filtered peek may skip hardware, but must retain it for GetMessage.
  for (const bit of [1,4]) {
    const nc=bit===1?0x85:0x83;
    e[bit===1?'nc_post_paint':'nc_post_calcsize'](hwnd);
    pending.push([hwnd,0x100,0x26,0x1480001]);
    const peek=call(false,0,nc,nc);
    const removed=call(false,1,nc,nc);
    assert.deepStrictEqual(normalize(peek),normalize(removed),'NC filter selects retained frame work');
    assert.deepStrictEqual(call(true).tuple,[hwnd,0x100,0x26,0x1480001],'filter preserves key');
    assert.strictEqual(call().ok,0,'filtered case drained exactly once');
  }
  const other=hwnd+1;
  e.set_hwnd_base(other+1); e.wnd_table_set(other,0x401000); e.wnd_set_style_export(other,0x10000000);
  for(const target of [hwnd,other]) { e.nc_post_paint(target); e.nc_post_calcsize(target); }
  assert.strictEqual(e.test_shared_post(other,0x402,0x4321,0x8765),1);
  const shared=call();
  assert.deepStrictEqual(shared.tuple,[other,0x402,0x4321,0x8765],'shared posted work precedes NC');
  assert.deepStrictEqual(call(),shared,'repeated NOREMOVE retains shared message');
  assert.deepStrictEqual(call(true),shared,'shared Peek/Get agree');
  for(const expected of [[hwnd,0x83],[other,0x83],[hwnd,0x85],[other,0x85]]) {
    const peek=call();
    assert.deepStrictEqual(peek.tuple.slice(0,2),expected,'independent per-window NC selection');
    assert.deepStrictEqual(normalize(call()),normalize(peek),'repeated NOREMOVE retains NC');
    assert.deepStrictEqual(normalize(call(true)),normalize(peek),'Get consumes selected NC once');
  }
  assert.strictEqual(call().ok,0,'two windows drained');
  // Create a hidden native window through USER so its initial main WM_SIZE
  // is genuinely pending, then expose it without ShowWindow consuming size.
  const className=0x530000;
  new Uint8Array(memory.buffer).set(Buffer.from('STATIC\0'),wa(className));
  e.heap_init(0x600000);
  [0,0,className,0,0,10,20,200,100,0,0,0,0].forEach((n,i)=>view.setUint32(wa(stack)+i*4,n,true));
  e.clear_yield(); e.set_esp(stack); e.set_eip(thunk+16); e.run(100);
  assert.strictEqual(e.get_eip(),0,'CreateWindowExA returned');
  const main=e.get_eax(); assert(main,'native main window created');
  assert.strictEqual(e.get_main_hwnd(),main);
  e.wnd_set_style_export(main,0x10000000);
  pending.push([main,0x100,0x26,0x1480001]);
  assert.strictEqual(e.post_message_q(main,0x403,1,2),1);
  assert.strictEqual(e.test_shared_post(main,0x404,3,4),1);
  for(const message of [0x100,0x403,0x404,5,0x83]) {
    const peek=call();
    assert.strictEqual(peek.tuple[1],message,'hardware/local/shared/size/NC phase order');
    assert.strictEqual(peek.tuple[0],main);
    assert.deepStrictEqual(normalize(call()),normalize(peek),'pending main size survives repeated peeks');
    assert.deepStrictEqual(normalize(call(true)),normalize(peek),'each phase removed exactly once');
  }
  for(let i=0;i<4;i++) { const next=call(false,1); if(!next.ok)break;
    assert(![0x100,0x403,0x404,5,0x83].includes(next.tuple[1]),'no duplicate phase message'); }
  console.log(JSON.stringify(results,null,2));
  assert(results.every(r=>r.equal),'stationary PeekMessage(PM_NOREMOVE) and removing call must select same message');
  assert(results.every(r=>r.inputFirst),'both APIs select hardware before pending NC work');
  console.log('PASS Peek/Get NC and input ordering, controls and exactly-once delivery');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
