'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {createCapture,validateCapture,CaptureStop,ADDRESS}=require('../tools/shadow-man-null-capture.cjs');
const {compile}=require('../tools/watx.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/re-notes/shadow-man-null-capture-mechanism-20261023');
const source=fs.readFileSync(path.join(root,'src/13-exports.wat'),'utf8');
const hook=source.slice(0,source.indexOf('  ;; End opt-in NULL boundary diagnostic declarations.'));
function formAt(text,start) { let depth=0;for(let i=start;i<text.length;i++){if(text[i]==='(')depth++;if(text[i]===')'&&!--depth)return text.slice(start,i+1);}throw Error('unbalanced form'); }
const trace=formAt(source,source.indexOf('(if (global.get $trace_eip_flag)'));
const zero=source.slice(source.indexOf('      (if (i32.eqz (global.get $eip))'),source.indexOf('      ;; A block whose quantum'));
const names=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
const globals=['eip','last_run_halt','dlg_pump_hwnd','dlg_ret_addr','dlg_ended','sync_msg_depth','trace_eip_flag','trace_eip_lo','trace_eip_hi'];
let wat=`(import "host" "log_eip" (func $host_log_eip (param i32))) (memory 128 128) (export "memory" (memory 0))\n`;
wat+=globals.map(n=>`(global $${n} (mut i32) (i32.const 0))`).join('\n');
wat+='(global $SHARED_DLG_PUMP_HWND i32 (i32.const 128)) (global $SHARED_DLG_ENDED i32 (i32.const 132)) (global $invocation_root i64 (i64.const 9)) (func $invocation_current (result i64) (i64.const 10))\n'+hook;
wat+=names.map((n,i)=>`(func (export "get_${n}") (result i32) (i32.load (i32.const ${i*4})))`).join('\n');
wat+=`(func (export "get_eip") (result i32) (global.get $eip))
(func (export "guest_read8") (param $a i32) (result i32) (i32.load8_u (local.get $a)))
(func (export "set_bp") (param i32))
(func (export "set_trace_eip_range") (param $f i32) (param $lo i32) (param $hi i32) (global.set $trace_eip_flag (local.get $f)) (global.set $trace_eip_lo (local.get $lo)) (global.set $trace_eip_hi (local.get $hi)))
(func $block (export "block") (param $a i32) (global.set $eip (local.get $a)) ${trace} (i32.store (i32.const 64) (i32.const 1)))
(func (export "nested") (call $block (i32.const ${ADDRESS})))
(func (export "event") (param $kind i32) (call $null_diag_event (local.get $kind) (i32.const 111) (i32.const 222)))
(func (export "zero") (global.set $eip (i32.const 0)) (block $halt ${zero}) (i32.store (i32.const 64) (i32.const 1)))
`;
fs.writeFileSync(path.join(out,'fixture.wat'),wat);
const compiled=compile(wat,new Map(),{mode:"production"});assert(compiled.success,JSON.stringify(compiled.diagnostics));const binary=compiled.wasmBinary;
async function fixture(options={}) {
 let capture,ex;const retained=[];
 const imports={host:{log_eip:eip=>capture.log(eip)}};
 const wasmModule=await WebAssembly.compile(binary);
 // Exact pinned runner call form: instantiate(Module, imports) returns Instance.
 const instance = await WebAssembly.instantiate(wasmModule, imports);
 ex=instance.exports;
 const mem=new Uint8Array(ex.memory.buffer),dv=new DataView(mem.buffer);
 names.forEach((n,i)=>dv.setUint32(i*4,n==='esp'?0x600000:0x100+i,true));
 for(let i=0;i<128;i++)mem[0x600000-32+i]=i;
 for(let i=0;i<64;i++)mem[ADDRESS+i]=255-i;
 capture=createCapture({metadata:{fixture:true},retain:r=>retained.push(r),stop:()=>{},...options});capture.arm(ex);
 return {ex,mem,dv,capture,retained};
}
(async()=>{
 let f=await fixture(); f.ex.block(ADDRESS+1);assert.equal(f.retained.length,0);assert.equal(f.dv.getUint32(64,true),1);f.dv.setUint32(64,0,true);
 assert.throws(()=>f.capture.run(()=>f.ex.nested()),CaptureStop);assert.equal(f.dv.getUint32(64,true),0);assert.equal(f.retained.length,1);
 const original=f.retained[0];assert(validateCapture(original));assert.equal(original.record.registers.ebp,0x105);assert.equal(original.record.stack.bytes.length,256);assert.equal(original.record.code.bytes.slice(0,4),'fffe');
 f.mem.fill(0,0x600000-32,0x600000+96);assert(validateCapture(original));assert.equal(original.record.stack.bytes.slice(0,8),'00010203');assert(Object.isFrozen(original.record.registers));
 assert.throws(()=>f.capture.run(()=>f.ex.nested()),CaptureStop);assert.equal(f.retained.length,1);
 const mutate=fn=>{const r=JSON.parse(JSON.stringify(original));fn(r.record);r.sha256=crypto.createHash('sha256').update(JSON.stringify(r.record)).digest('hex');assert.throws(()=>validateCapture(r));};
 mutate(r=>delete r.registers.ebp);mutate(r=>r.registers.eip++);mutate(r=>r.stack.bytes='00');mutate(r=>r.continuation='continued');
 assert.throws(()=>validateCapture(original,{expectedStack:'ff'.repeat(128)}));
 f=await fixture();assert.throws(()=>f.capture.run(()=>f.ex.block(ADDRESS+1)),/without terminal/);
 f=await fixture();assert.throws(()=>f.capture.run(()=>{try{f.ex.nested();}catch(_){} f.dv.setUint32(64,1,true);}),/without terminal/); // swallowed observer is explicitly rejected
 f=await fixture({retain:()=>{throw Error('disk failure');}});assert.throws(()=>f.capture.run(()=>f.ex.nested()),/disk failure/);assert.equal(f.dv.getUint32(64,true),0);
 f=await fixture({untilZero:true});for(const n of [1,2,3,4])f.ex.event(n);f.ex.nested();f.dv.setUint32(64,0,true);assert.throws(()=>f.capture.run(()=>f.ex.zero()),CaptureStop);assert.equal(f.dv.getUint32(64,true),0);assert.equal(f.retained.at(-1).record.kind,'first-zero');assert.equal(f.retained[0].record.boundary.savedEsp,222);assert.equal(f.retained[0].record.boundary.token,'10');
 f=await fixture({untilZero:true,maxRecords:1});f.ex.event(1);assert.throws(()=>f.ex.event(2),/record limit/);assert.equal(f.retained.length,1);
 // A broken/returning host observer still cannot continue after zero; off stays off.
 const raw=await WebAssembly.instantiate(binary,{host:{log_eip:()=>{}}});raw.instance.exports.zero();raw.instance.exports.set_null_diag(1);assert.throws(()=>raw.instance.exports.zero(),WebAssembly.RuntimeError);
 const quota=await WebAssembly.instantiate(binary,{host:{log_eip:()=>{}}});quota.instance.exports.event(1);quota.instance.exports.set_null_diag(1);for(let i=0;i<32;i++)quota.instance.exports.event(1);assert.throws(()=>quota.instance.exports.event(1),WebAssembly.RuntimeError);
 let missing=createCapture({metadata:{},retain:()=>{},stop:()=>{}});assert.throws(()=>missing.arm({}),/missing export/);
 const pinned=fs.readFileSync(path.join(root,'test/run.js'),'utf8');assert(pinned.includes('const instance = await WebAssembly.instantiate(wasmModule, imports);'));assert(pinned.includes('h.log_eip = (eip) => {'));
 const fixturePath=path.join(out,'fixture.wasm');fs.writeFileSync(fixturePath,binary);
 const driver=path.join(out,'preload-driver.cjs');fs.writeFileSync(driver,`const fs=require('fs');(async()=>{const imports={host:{log_eip:()=>{}}};const wasmModule=await WebAssembly.compile(fs.readFileSync(process.argv.find(x=>x.startsWith('--wasm=')).slice(7)));const instance = await WebAssembly.instantiate(wasmModule, imports);new DataView(instance.exports.memory.buffer).setUint32(16,0x600000,true);instance.exports.event(1);instance.exports.zero();throw Error('continued');})();`);
 const output=path.join(out,'preload-record.jsonl');try{fs.unlinkSync(output);}catch(_){}
 const child=cp.spawnSync(process.execPath,['--require',path.join(root,'tools/shadow-man-null-preload.cjs'),driver,'--wasm='+fixturePath],{env:{...process.env,SHADOW_NULL_OUTPUT:output,SHADOW_NULL_UNTIL_ZERO:'1',SHADOW_NULL_REVISED_SHA:crypto.createHash('sha256').update(binary).digest('hex')},encoding:'utf8'});
 assert.equal(child.status,86,child.stderr);const lines=fs.readFileSync(output,'utf8').trim().split('\n').map(JSON.parse);assert.equal(lines.at(-1).terminal,true);assert.equal(lines.at(-2).record.kind,'first-zero');
 const result={exit:0,nativeFragmentBytes:binary.length,arenaBytes:8388608,tests:['address filter','recursive synchronous block stop','all registers and immutable bytes','first block only','missing/wrong/changed/continued rejects','missing export','retention failure stops','bounded events','sender/modal schema callbacks','first-zero before continuation','guard off and returning observer trap','exact runner instantiate form','preload child fsync and OS exit86'],sourceCallSites:'NOT EXECUTED in full handlers; hook function + actual trace/zero predicates executed natively',canonicalModule:'NOT BUILT / NOT RUN'};fs.writeFileSync(path.join(out,'tests.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
