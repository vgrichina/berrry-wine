'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHostImports } = require('../lib/host-imports');
const { createServiceClock } = require('../lib/batch-clock');
const memory = new WebAssembly.Memory({initial:8192, maximum:8192, shared:true});
const clock = createServiceClock(5000);
let queued = false;
const ctx = {getMemory:()=>memory.buffer, guestNowMs:()=>clock.batchTicks()};
const imports = createHostImports(ctx);
imports.host.memory = memory;
imports.host.check_input = () => { if (!queued) return 0; queued=false; return 0x00410100; };
imports.host.check_input_hwnd = () => 0;
imports.host.check_input_lparam = () => 1;
clock.wrapImports(imports.host);
const extraWat = `
 (func (export "peek_prepare") (param $msg i32)
  (global.set $thunk_guest_base (i32.const 0x07500000))
  (call $update_thunk_end)
  (i32.store (call $thunk_metadata_addr (i32.const 0)) (i32.const 0))
  (i32.store offset=4 (call $thunk_metadata_addr (i32.const 0)) (global.get $API_ID_PeekMessageA))
  (i32.store offset=16 (global.get $reg_base) (i32.const 0x401000))
  (call $gs32 (i32.const 0x401000) (i32.const 0x402000))
  (call $gs32 (i32.const 0x401004) (local.get $msg))
  (call $gs32 (i32.const 0x401008) (i32.const 0))
  (call $gs32 (i32.const 0x40100c) (i32.const 0))
  (call $gs32 (i32.const 0x401010) (i32.const 0))
  (call $gs32 (i32.const 0x401014) (i32.const 1)))
 (func (export "peek_dispatch") (call $win32_dispatch (i32.const 0)))`;
const bytes = require('./compile-src').compileSrcWasm((file,text)=>file==='13-exports.wat'?text+extraWat:text);
console.log('NATIVE_MODULE_SHA256', require('node:crypto').createHash('sha256').update(bytes).digest('hex'));
const raw = new WebAssembly.Instance(new WebAssembly.Module(bytes), imports);
const instance = clock.wrapInstance(raw), e=instance.exports;
ctx.exports=e;
e.init_thread(1,0x400000,0,0,0,0,0);
const msg=0x400800;
for(let i=0;i<e.get_spin_park_k();i++) {e.peek_prepare(msg);e.peek_dispatch();}
assert.equal(e.get_yield_reason(),15,'compiled dispatcher parks the empty PeekMessage frame');
assert.equal(e.get_esp(),0x401000,'park preserves the stdcall argument frame');
queued=true;
const before=clock.batchTicks();
const source=process.env.PEEK_RESUME_BASELINE === '1'
  ? require('node:child_process').execFileSync('git',['show','HEAD:test/run.js'],{encoding:'utf8'})
  : fs.readFileSync('test/run.js','utf8');
const start=source.indexOf('    {\n      const spinYield =');
assert(start>=0);
const snippet=source.slice(start,source.indexOf('    // Handle the virtual LAN',start));
const stats={clockWaits:0,peekWaits:0,guestMsAdded:0};
vm.runInNewContext(snippet,{instance,serviceClock:true,batchClock:clock,SPIN_PARK:stats,TRACE_YIELD:false});
assert.equal(e.get_yield_reason(),0,'service-clock CLI must resume the parked poll');
assert.equal(clock.batchTicks(),before,'empty peek resume must not advance guest time');
assert.equal(stats.peekWaits,1);
e.peek_dispatch();
assert.equal(e.get_esp(),0x401018,'resumed stdcall consumes exactly five arguments and return address');
assert.equal(queued,false,'resumed normal dispatcher consumes queued host input');
assert.equal(e.guest_read32(msg+4),0x100);
assert.equal(e.guest_read32(msg+8),0x41);
console.log('PASS compiled PeekMessage park -> actual CLI service-clock resume -> queued keyboard delivery without clock charge');
