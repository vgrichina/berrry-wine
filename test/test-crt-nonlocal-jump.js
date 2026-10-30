#!/usr/bin/env node
'use strict';
// Focused production execution: unchanged run(), next/dispatch-next, decoded
// CALL/JMP handlers, full Win32 dispatcher, generated setjmp dispatch page,
// and RtlUnwind's real state machine. Only the code-cache contents, address
// translation and unrelated host/subsystem services are fixtures. Unexercised
// APIs trap. No original game, full-module build, or JS longjmp implementation.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { compile } = require('../tools/watx');
const root = path.join(__dirname, '..');
function read(p) {
  const file = path.join(root, p);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') :
    zlib.gunzipSync(fs.readFileSync(file + '.gz')).toString();
}
const sources = {};
for (const p of ['09a6-handlers-crt','09b-dispatch','09b2-dispatch-table.generated',
  '11-seh','13-exports','04-cache','05-alu','06b-core-handlers']) sources[p] = read(`src/${p}.wat`);
if (process.env.CRT_JUMP_SOURCE) sources['09a6-handlers-crt'] = fs.readFileSync(process.env.CRT_JUMP_SOURCE,'utf8');
// Balanced extraction ignores line comments and strings. Every selected body
// is copied verbatim, including the run-loop thunk return/continuation logic.
function form(source, start) {
  let depth=0, str=false, comment=false;
  for (let i=start;i<source.length;i++) {
    const c=source[i];
    if (comment) { if(c==='\n') comment=false; continue; }
    if (!str && c===';' && source[i+1]===';') { comment=true; continue; }
    if (c==='"' && source[i-1]!=='\\') str=!str;
    if (str) continue;
    if(c==='(') depth++;
    if(c===')' && --depth===0) return source.slice(start,i+1);
  }
  throw Error('unterminated source form');
}
function extract(file,name,kind='func') {
  const source=sources[file];
  const at=kind==='func' ? source.search(new RegExp('\\(func \\$'+name+'(?=[\\s)])')) : source.indexOf(`(${kind} ${name}`);
  assert(at>=0,`${file}: ${name}`);
  return form(source,at);
}
const apis=JSON.parse(read('src/api_table.json'));
const ids=Object.fromEntries(apis.map(a=>[a.name,a.id]));
assert.equal(apis[ids.longjmp].convention,'cdecl');
assert.equal(apis[ids.longjmp].nargs,2);
const selected=[];
for (const name of ['crt_jump_buffer','handle__setjmp3','crt_longjmp_continue','handle_longjmp'])
  selected.push(extract('09a6-handlers-crt',name));
for (const name of ['restore_win32_nonvolatile','spin_is_clock_read','win32_dispatch','win32_dispatch_inner'])
  selected.push(extract('09b-dispatch',name));
for (const name of ['rtl_unwind_begin','rtl_unwind_step','rtl_unwind_continue']) selected.push(extract('11-seh',name));
selected.push(extract('13-exports','run'));
selected.push(extract('04-cache','next'));
selected.push(extract('04-cache','(dispatch-next)','defmacro'));
selected.push(extract('04-cache','(read-thread-word)','defmacro'));
for(const name of ['th_call_r','th_jmp_r','th_jmp_ind']) selected.push(extract('06b-core-handlers',name));
for(const n of ['th_mov_r_i32','th_mov_m32_i32','th_ret','th_ret_imm','th_ret_guard16']) selected.push(extract('05-alu',n));
selected.push(extract('09b2-dispatch-table.generated','dispatch_api_table'));
selected.push(extract('09b2-dispatch-table.generated',`dispatch_api_table_page_${Math.floor(ids._setjmp3/256)}`));
// Optional executable mutations exercise the same acceptance assertions.
if (process.env.CRT_JUMP_MUTANT==='zero-buffer') {
  const i=selected.findIndex(s=>s.startsWith('(func $handle__setjmp3 '));
  selected[i]=`(func $handle__setjmp3 (param $arg0 i32) (param i32 i32 i32 i32 i32)
    (call $zero_memory (call $g2w (local.get $arg0)) (i32.const 64))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))`;
}
if (process.env.CRT_JUMP_MUTANT==='return-success') {
  const i=selected.findIndex(s=>s.startsWith('(func $handle_longjmp '));
  selected[i]=`(func $handle_longjmp (param i32 i32 i32 i32 i32 i32)
    (i32.store (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))`;
}
if (process.env.CRT_JUMP_MUTANT==='restore-caller') {
  const i=selected.findIndex(s=>s.startsWith('(func $win32_dispatch_inner '));
  selected[i]=selected[i].replace('(call $handle_longjmp\n',`(call $restore_win32_nonvolatile (local.get $saved_ebx) (local.get $saved_esi) (local.get $saved_edi) (local.get $saved_ebp))\n        (call $handle_longjmp\n`)
    .replace('(if (global.get $api_log_on) (then (call $host_log_api_exit)))\n        (return)))\n\n    ;; Delegate',`(call $restore_win32_nonvolatile (local.get $saved_ebx) (local.get $saved_esi) (local.get $saved_edi) (local.get $saved_ebp))\n        (return)))\n\n    ;; Delegate`);
}
const fixture=`
 (layout PaintRect (field left i32) (field top i32) (field right i32) (field bottom i32))
 (memory 4 4 shared) (export "memory" (memory 0))
 (type $handler_t (func (param i32)))
 (table $handlers 5 funcref)
 (elem (i32.const 0) $th_mov_r_i32 $test_stop $th_ret $th_ret_imm $th_mov_m32_i32)
 (defmacro (thunk-contains $p) (i32.and (i32.ge_u $p (i32.const 0x10000)) (i32.lt_u $p (i32.const 0x11000))))
 (func $g2w (param $p i32) (result i32)
   (select (local.get $p) (i32.const 0xf0) (i32.lt_u (local.get $p) (i32.const 0x40000))))
 (func $gl32 (param $p i32) (result i32) (i32.load (call $g2w (local.get $p))))
 (func $gs32 (param $p i32) (param $v i32) (i32.store (call $g2w (local.get $p)) (local.get $v)))
 (func $zero_memory (param $p i32) (param $n i32)
   (memory.fill (local.get $p) (i32.const 0) (local.get $n)))
 (func $thunk_metadata_addr (param $i i32) (result i32) (i32.add (i32.const 0x1000) (i32.shl (local.get $i) (i32.const 3))))
 (global $test_thunk_count (mut i32) (i32.const 2))
 (func $com_cont_thunk (param $marker i32) (result i32) (local $i i32)
   (local.set $i (global.get $test_thunk_count))
   (global.set $test_thunk_count (i32.add (local.get $i) (i32.const 1)))
   (i32.store (call $thunk_metadata_addr (local.get $i)) (local.get $marker))
   (i32.store offset=4 (call $thunk_metadata_addr (local.get $i)) (i32.const 0))
   (i32.add (i32.const 0x10000) (i32.shl (local.get $i) (i32.const 3))))
 (import "fixture" "page" (func $page_resolve (param i32) (result i32)))
 (import "fixture" "stop" (func $test_event))
 (func $test_stop (param i32) (call $test_event) (global.set $eip (i32.const 0)))
 (func $read_addr (result i32) (read-thread-word))
 (func (export "call") (param $ret i32) (param $idx i32)
   (global.set $steps (i32.const 256))
   (global.set $ip (i32.const 0x3000))
   (i32.store (i32.const 0x3000) (i32.const 2))
   (i32.store offset=8 (global.get $reg_base) (i32.add (i32.const 0x10000) (i32.shl (local.get $idx) (i32.const 3))))
   (call $th_call_r (local.get $ret)))
 (func (export "jump") (param $idx i32)
   (global.set $steps (i32.const 256))
   (global.set $ip (i32.const 0x3000))
   (i32.store (i32.const 0x3000) (i32.const 2))
   (i32.store offset=8 (global.get $reg_base) (i32.add (i32.const 0x10000) (i32.shl (local.get $idx) (i32.const 3))))
   (call $th_jmp_r (i32.const 2)))
 (func (export "jump_ind") (param $idx i32)
   (global.set $steps (i32.const 256))
   (global.set $ip (i32.const 0x3000))
   (i32.store (i32.const 0x3000) (i32.const 0x3020))
   (i32.store (i32.const 0x3020) (i32.add (i32.const 0x10000) (i32.shl (local.get $idx) (i32.const 3))))
   (call $th_jmp_ind (i32.const 0)))
 (export "dispatch" (func $win32_dispatch))
`;
// Unrelated dependencies of the exact full dispatcher/run bodies are imports.
// Infer their arity/result from the selected source tree; only explicitly
// allowlisted housekeeping can run, all other imports throw if reached.
const token=/\(;[\s\S]*?;\)|;;[^\n]*|"(?:\\.|[^"\\])*"|[()]|[^\s()]+/g;
function parse(s) {
  const roots=[], stack=[roots];
  for(const t of s.match(token)||[]) {
    if(t.startsWith(';;')||t.startsWith('(;')) continue;
    if(t==='(') { const a=[];stack.at(-1).push(a);stack.push(a); }
    else if(t===')') stack.pop(); else stack.at(-1).push(t);
  }
  assert.equal(stack.length,1); return roots;
}
const all=selected.join('\n')+'\n'+fixture, ast=parse(all), defs=new Set(), globals=new Set(), calls=new Map();
function walk(n,parent=null,fnResult=false) {
  if(!Array.isArray(n)) return;
  if(n[0]==='func') { if(typeof n[1]==='string'&&n[1].startsWith('$')) defs.add(n[1]);fnResult=n.some(c=>Array.isArray(c)&&c[0]==='result'); }
  if(n[0]==='global') defs.add(n[1]);
  if(n[0]==='global.get'||n[0]==='global.set') globals.add(n[1]);
  if(n[0]==='call'||n[0]==='return_call') {
    const name=n[1], args=n.slice(2).filter(Array.isArray).length;
    const statement=['func','then','else','loop','block'].includes(parent?.[0]);
    let result=n[0]==='return_call'?fnResult:!statement;
    if(parent?.[0]==='return') result=fnResult;
    const old=calls.get(name);calls.set(name,{args,result:result||old?.result});
  }
  for(const c of n) if(Array.isArray(c)) walk(c,n,fnResult);
}
for(const n of ast) walk(n);
const noops=new Set(['anim_service','apc_resume_alert_sleep','dx_sync_thread_vtables_if_needed',
  'branch_end','cs_pop','pop_rsrc_ctx','rsrc_release_api_pins','host_log_i32','host_log_api_exit']);
const zeros=new Set(['thunk_patch_changed','build_eflags']);
const imports={}, stubs=[];
for(const [name,{args,result}] of calls) if(!defs.has(name)) {
  const key=name.slice(1);
  stubs.push(`(import "fixture" "${key}" (func ${name} ${args?`(param ${Array(args).fill('i32').join(' ')})`:''} ${result?'(result i32)':''}))`);
  imports[key]=(...a)=>{if(noops.has(key)) return; if(zeros.has(key)) return 0;throw Error(`unexercised dependency reached: ${key}(${a})`);};
}
const constants={reg_base:0x100,fs_base:0x200,thunk_guest_base:0x10000,THREAD_END:0x3f000,
 THREAD_BASE:0x20000,thread_alloc:0x20000,bp_addr:-1,SHARED_COUNTERS:0x400};
const globalWat=[...globals].filter(g=>!defs.has(g)).map(g=>{
  const name=g.slice(1),type=name==='rsrc_api_pins'?'i64':'i32';
  const value=name.startsWith('API_ID_')?(ids[name.slice(7)]??-999):constants[name]??0;
  return `(global ${g} (mut ${type}) (${type}.const ${value})) (export "${name}" (global ${g}))`;
}).join('\n');
const wat=globalWat+'\n'+stubs.join('\n')+'\n'+all;
const built=compile(wat,new Map(),{mode:'production',standardWat:true,runtimeBuiltins:false,tailCalls:true,strictDeclarations:true});
assert(built.success,built.error);
assert(WebAssembly.validate(built.wasmBinary),'focused production boundary module validates');
console.log('compiled production boundary; executing '+(process.env.CRT_JUMP_MUTANT||'repair'));
let e,view,events=0,expectedIP=0,callback=null;
imports.page=ip=>{if(callback) { const p=callback(ip);if(p) return p; }assert.equal(ip>>>0,expectedIP>>>0,'run reached captured continuation');return 0x3100;};
imports.stop=()=>events++;
e=new WebAssembly.Instance(new WebAssembly.Module(built.wasmBinary),{fixture:imports}).exports;
view=new DataView(e.memory.buffer);
const put=(p,v)=>view.setUint32(p,v>>>0,true), get=p=>view.getUint32(p,true), reg=(i,v)=>v===undefined?get(0x100+4*i):put(0x100+4*i,v);
const set=(name,v)=>{assert(e[name],name);e[name].value=v;};
const SP=0xc000,BUF=0x2000,CONT=0x418d02, WRONG=0x418c9f;
const saved=[0x55667788,0x11223344,0x22334455,0x33445566]; // EBP, EBX, EDI, ESI
function init() {
  for(const g of ['eip','yield_reason','yield_flag','resume_ip','eip_redirected','handler_set_eip','steps']) set(g,0);
  put(0x200,-1);put(0x204,0xe000);put(0x208,0x8000);
  put(0x1000,0x80000000);put(0x1004,ids._setjmp3);put(0x1008,0x80000000);put(0x100c,ids.longjmp);
  // Predecoded continuation: MOV EDX,0x12345678; terminal fixture.
  put(0x3100,0);put(0x3104,2);put(0x3108,0x12345678);put(0x310c,1);put(0x3110,0);
  [5,3,7,6].forEach((r,i)=>reg(r,saved[i]));
}
function capture(buf=BUF,sp=SP,cont=CONT,count=0,extra=[],entry='call') {
  reg(4,sp+4);put(sp+4,buf);put(sp+8,count);extra.forEach((v,i)=>put(sp+12+4*i,v));
  set('eip',0x401000);
  if(entry==='indirect') {reg(4,sp);put(sp,cont);e.jump_ind(0);} else e.call(cont,0);
  assert.equal(reg(0),0,'initial return zero');assert.equal(reg(4),sp+4,'cdecl pops only saved return');
  assert.equal(e.eip.value>>>0,cont,'decoded caller resumes normally after setjmp');
}
function clobber() {for(const r of [3,5,6,7]) reg(r,0x77770000+r);reg(0,99);}
function jump(buf,value,entry='call') {
  clobber();reg(4,0xaff4);put(0xaff4,buf);put(0xaff8,value);set('eip',0x401234);
  if(entry==='call') e.call(WRONG,1);
  else if(entry==='jump'||entry==='indirect') {reg(4,0xaff0);put(0xaff0,WRONG);entry==='jump'?e.jump(1):e.jump_ind(1);}
  else {reg(4,0xaff0);put(0xaff0,WRONG);set('eip',0x10008);e.run(10);}
}
function restored(buf,value,sp=SP,cont=CONT) {
  assert.equal(e.eip.value>>>0,cont,'longjmp abandoned its caller');
  assert.equal(reg(4),sp+4,'saved entry ESP plus return pop');
  assert.deepEqual([5,3,7,6].map(r=>reg(r)),[0,4,8,12].map(o=>get(buf+o)),'all nonvolatiles restored through production dispatch');
  assert.equal(reg(0),value>>>0,'subsequent value (zero becomes one)');
  assert.equal(e.resume_ip.value,0,'abandoned decoded stream');
}
init();capture(BUF,SP,CONT,0,[],'indirect');
assert.deepEqual(Array.from({length:10},(_,i)=>get(BUF+4*i)),[...saved,SP,CONT,0xffffffff,0xffffffff,0x56433230,0],'MSVC buffer ABI');
for(const [value,entry] of [[7,'call'],[0,'jump'],[-12,'indirect']]) {
  jump(BUF,value,entry);restored(BUF,value||1);expectedIP=CONT;const before=events;e.run(10);
  assert.equal(events,before+1);assert.equal(reg(2),0x12345678,'real interpreter MOV executed at saved continuation');
  assert.equal(reg(0),(value||1)>>>0);
}
// A second live buffer never replaces the first; repeated use is legal while
// the saving frame remains live.
init();capture(BUF);[5,3,7,6].forEach((r,i)=>reg(r,saved[i]+1));capture(BUF+128,SP-256,CONT+32);
jump(BUF+128,31);restored(BUF+128,31,SP-256,CONT+32);
jump(BUF,17);restored(BUF,17);
// The actual run-loop thunk entry must also retain the restored EIP/ESP.
expectedIP=CONT;jump(BUF,23,'thunk');assert.equal(events,4);assert.equal(reg(0),23);assert.equal(reg(4),SP+4);
// Invalid contexts must never manufacture success or return to longjmp caller.
for(const bad of [0,0xfffffff0,0x80000000,BUF+512]) {init();assert.throws(()=>jump(bad,1),WebAssembly.RuntimeError);}
init();capture();put(BUF+32,0);assert.throws(()=>jump(BUF,1),WebAssembly.RuntimeError);
init();capture();put(0x208,SP+8);assert.throws(()=>jump(BUF,1),WebAssembly.RuntimeError,'foreign thread stack');
init();capture();put(BUF+24,0x9000);assert.throws(()=>jump(BUF,1),WebAssembly.RuntimeError,'missing saved registration');
// Real RtlUnwind with a synthetic dispatcher node: unlink it before restore.
init();capture();put(0x9000,-1);put(0x9004,0);put(0x200,0x9000);
jump(BUF,9);assert.equal(e.eip.value>>>0,0x10010,'global unwind returns via production CRT continuation thunk');
e.run(10);assert.equal(get(0x200),0xffffffff);assert.equal(reg(0),9);assert.equal(reg(4),SP+4);
// Execute a real guest cdecl SEH handler and its RET through the production
// RtlUnwind continuation, followed by the saved setjmp continuation.
init();capture();put(0x9000,-1);put(0x9004,0x450000);put(0x200,0x9000);
put(0x3200,0);put(0x3204,0);put(0x3208,0);put(0x320c,2);put(0x3210,0);
let sehCalls=0;
callback=ip=>{if(ip!==0x450000) return 0;
  sehCalls++;assert.equal(reg(5),saved[0],'saving EBP available to SEH cleanup');const sp=reg(4),record=get(sp+4);
  assert.equal(get(sp+8),0x9000);assert.equal(get(record+4)&2,2,'real unwind exception flag');
  return 0x3200;
};
jump(BUF,41);e.run(20);assert.equal(sehCalls,1);assert.equal(reg(0),41);
assert.equal(get(0x200),0xffffffff);assert.equal(reg(4),SP+4);callback=null;
// _setjmp3's explicit stdcall unwind callback receives the authentic buffer,
// all six varargs survive, and caller cleanup runs at the saved continuation.
init();put(0x200,0x9000);put(0x9000,-1);put(0x9004,0);put(0x900c,5);
capture(BUF,SP,CONT,8,[0x460000,3,11,22,33,44,55,66]);
assert.equal(get(BUF+24),0x9000);assert.equal(get(BUF+28),3);
assert.deepEqual(Array.from({length:6},(_,i)=>get(BUF+40+4*i)),[11,22,33,44,55,66]);
// Guest callback: change the try level, clobber EBX, then RET 4 (stdcall).
[4,0,0x900c,3,0,3,0xabcdef,3,4].forEach((v,i)=>put(0x3300+4*i,v));
let unwindCalls=0;
callback=ip=>{if(ip!==0x460000)return 0;unwindCalls++;assert.equal(reg(5),saved[0],'native CRT restores EBP before UnwindFunc');assert.equal(get(reg(4)+4),BUF);return 0x3300;};
jump(BUF,53);e.run(20);assert.equal(unwindCalls,1);assert.equal(reg(0),53);
assert.equal(reg(3),saved[1]);assert.equal(get(0x900c),3);assert.equal(get(0x200),0x9000);assert.equal(reg(4),SP+4);callback=null;
// A different thread uses its own TIB and stack; its buffer cannot replace ours.
init();capture(BUF);put(0x240,-1);put(0x244,0x18000);put(0x248,0x14000);set('fs_base',0x240);
[5,3,7,6].forEach((r,i)=>reg(r,saved[i]+2));capture(BUF+128,0x17000,CONT+64);
jump(BUF+128,61);restored(BUF+128,61,0x17000,CONT+64);
assert.throws(()=>jump(BUF,1),WebAssembly.RuntimeError);set('fs_base',0x200);jump(BUF,67);restored(BUF,67);
console.log(JSON.stringify({PASS:true,events,productionFunctions:selected.filter(s=>s.startsWith('(func')).length,
 sourceHashes:Object.fromEntries(Object.entries(sources).map(([n,s])=>[n,crypto.createHash('sha256').update(s).digest('hex')])),
 moduleSHA256:crypto.createHash('sha256').update(built.wasmBinary).digest('hex')}));
