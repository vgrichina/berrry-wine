#!/usr/bin/env node
'use strict';
// Independent stop acceptance. Production forms are extracted, compiled and run;
// host notifications and the interpreter run endpoint are explicit test doubles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { compile } = require('../tools/watx');
const source = fs.readFileSync(path.join(__dirname, '../src/09a3-handlers-audio.wat'), 'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
function extract(kind, name) {
  // Strip line comments before balanced scanning, preserving all executable text.
  const text = source.replace(/;;[^\n]*/g, '');
  const begin = text.indexOf(`(${kind} $${name} `);
  assert(begin >= 0, name);
  let depth = 0;
  for (let i = begin; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return text.slice(begin, i + 1);
  }
  throw Error('unterminated ' + name);
}
const functions = ['handle_midiStreamOpen', 'handle_midiStreamOut', 'handle_midiStreamStop',
  'midi_stream_notify_done', 'midi_stream_service', 'handle_midiStreamRestart'];
const globals = [...source.matchAll(/\(global \$(midi_stream_\w+) /g)].map(m => m[1]);
const fragments = [...globals.map(n => extract('global', n)), ...functions.map(n => extract('func', n))];
const provenance = {sourceSHA256: hash(source), extraction: 'ordered globals in source order; functions as listed; strip ;; line comments then balanced forms',
  forms: [...globals, ...functions].map((n, i) => ({name:n, bytes:Buffer.byteLength(fragments[i]), sha256:hash(fragments[i])}))};
const mapping = 0x30000, reg = 0x200, stack = 0x18000, handle = 0x7654;
const glue = `
 (import "h" "open" (func $host_midi_out_open (param i32 i32 i32 i32) (result i32)))
 (import "h" "short" (func $host_midi_out_short_msg (param i32 i32) (result i32)))
 (import "h" "ticks" (func $host_get_ticks (result i32)))
 (import "h" "event" (func $host_set_event (param i32) (result i32)))
 (import "h" "window" (func $post_queue_push (param i32 i32 i32 i32) (result i32)))
 (import "h" "thread" (func $handle_PostThreadMessageA (param i32 i32 i32 i32 i32 i32)))
 (import "h" "run" (func $run (param i32)))
 (import "h" "enter" (func $sync_depth_enter))
 (import "h" "leave" (func $sync_depth_leave))
 (memory 8)
 (export "memory" (memory 0))
 (global $reg_base i32 (i32.const ${reg}))
 (global $sync_msg_ret_thunk i32 (i32.const 0x4567))
 (global $eip (mut i32) (i32.const 0x111))
 (global $steps (mut i32) (i32.const 0x222))
 (global $handler_set_eip (mut i32) (i32.const 3))
 (global $yield_reason (mut i32) (i32.const 4))
 (global $yield_flag (mut i32) (i32.const 5))
 (func $g2w (param $p i32) (result i32) (i32.add (local.get $p) (i32.const ${mapping})))
 (func $w2g (param $p i32) (result i32) (i32.sub (local.get $p) (i32.const ${mapping})))
 (func $gl32 (param $p i32) (result i32) (i32.load (call $g2w (local.get $p))))
 (func $gs32 (param $p i32) (param $v i32) (i32.store (call $g2w (local.get $p)) (local.get $v)))
 (func $heap_alloc (param $n i32) (result i32) (i32.const 0x1000))
 (func $zero_memory (param $p i32) (param $n i32) (memory.fill (local.get $p) (i32.const 0) (local.get $n)))
`;
function binary(mutant) {
  let body = fragments.join('\n');
  if (mutant) {
    const stop = extract('func', 'handle_midiStreamStop');
    const changed = stop.replace('(global.set $midi_stream_running (i32.const 0))',
      '(global.set $midi_stream_running (i32.const 0)) (global.set $midi_stream_tempo (i32.const 500000))');
    assert.notEqual(stop, changed);
    body = body.replace(stop, changed);
  }
  const exports = [...globals, 'eip', 'steps', 'handler_set_eip', 'yield_reason', 'yield_flag']
    .map(n => `(export "${n}" (global $${n}))`).join('\n') + functions.map(n => `(export "${n}" (func $${n}))`).join('\n');
  const result = compile(glue + body + exports, new Map(), {mode:'production'});
  assert(result.success, result.error); assert(WebAssembly.validate(result.wasmBinary));
  return result.wasmBinary;
}
async function fixture(bytes, kind = 3, callback = 0xCAFE) {
  let e, dv, depth = 0, hook = () => {}, result = 1, hangs = false;
  const notices = [], short = [], runs = [];
  const read = a => dv.getUint32(a, true), write = (a,v) => dv.setUint32(a,v,true);
  const g = n => e['midi_stream_' + n].value;
  const set = (n,v) => { e['midi_stream_' + n].value = v; };
  const h = {
    open: () => handle, ticks: () => 900,
    short: (h,m) => { assert.equal(h, handle); short.push(m); return 0; },
    window: (...a) => { notices.push(['window', ...a]); hook(); return result; },
    event: a => { notices.push(['event', a]); hook(); return result; },
    thread: (...a) => {
      notices.push(['thread', ...a]); hook();
      for (let i=0;i<8;i++) write(reg+4*i,0xBAD000+i);
      write(reg,result);
    },
    enter: () => { depth++; }, leave: () => { depth--; },
    run: budget => {
      assert.equal(budget,1000000); assert(depth >= 1);
      const sp=read(reg+16), frame=Array.from({length:6},(_,i)=>read(mapping+sp+i*4));
      runs.push(frame); assert.equal(e.eip.value,callback);
      assert.deepEqual(frame.slice(0,4),[0x4567,handle,0x3C9,0xABCD]);
      assert.equal(frame[5],0);
      // Run endpoint supplies RET 20 or deliberately refuses to return.
      if (!hangs) { notices.push(['function',frame[4]]); hook(frame[4]); }
      for (let i=0;i<8;i++) write(reg+4*i,0xDEAD00+i);
      write(reg+16,hangs ? sp : sp+24); e.steps.value=9; e.handler_set_eip.value=9;
      e.yield_reason.value=9; e.yield_flag.value=9;
      e.eip.value=hangs ? callback : 0;
    },
  };
  e=(await WebAssembly.instantiate(bytes,{h})).instance.exports; dv=new DataView(e.memory.buffer);
  function invoke(name,args,pop) {
    const saved=Array.from({length:8},(_,i)=>0x1010+i);
    saved[4]=stack; saved.forEach((v,i)=>write(reg+i*4,v));
    e[name](...args,...Array(6-args.length).fill(0));
    assert.equal(read(reg+16),stack+pop,'stdcall stack cleanup');
    for (const i of [1,2,3,5,6,7]) assert.equal(read(reg+i*4),saved[i],'preserved register '+i);
    return read(reg);
  }
  write(mapping+stack+24,kind<<16); write(mapping+0x900,0);
  assert.equal(invoke('handle_midiStreamOpen',[0x800,0x900,1,callback,0xABCD],28),0);
  set('tempo',654321); set('division',96);
  function header(a,extra=0) {
    write(mapping+a,a+0x40);write(mapping+a+4,12);write(mapping+a+8,12);
    write(mapping+a+16,(0x802|extra)>>>0);write(mapping+a+0x40,96);write(mapping+a+0x48,0x643C90);
  }
  function queue(a) {
    // Use current stack so reentrant Out never overwrites the outer snapshot.
    const sp=read(reg+16); e.handle_midiStreamOut(handle,a,64,0,0,0);
    assert.equal(read(reg),0);assert.equal(read(reg+16),sp+16);write(reg+16,sp);
  }
  const stop=()=>invoke('handle_midiStreamStop',[handle],8);
  return {e,dv,read,write,g,set,invoke,header,queue,stop,notices,short,runs,
    hook: f=>{hook=f;}, result:v=>{result=v;}, hangs:v=>{hangs=v;}, depth:()=>depth};
}
function preserved(f) {
  assert.equal(f.g('tempo'),654321,'tempo preserved across stop');
  assert.equal(f.g('division'),96,'division preserved across stop');
  for (const n of ['running','due_ms','event_pending','paused_at']) assert.equal(f.g(n),0,n+' cleared');
  assert.equal(f.g('handle'),handle);
  assert.deepEqual(['eip','steps','handler_set_eip','yield_reason','yield_flag'].map(n=>f.e[n].value),[0x111,0x222,3,4,5]);
  assert.equal(f.depth(),0);
}
async function adversarial(bytes) {
  const f=await fixture(bytes), originals=Array.from({length:31},(_,i)=>0x2000+i*0x100);
  f.set('queue_head',17);f.set('queue_tail',17);
  originals.forEach((a,i)=>{f.header(a,i%2 ? 0x40000000:0);f.queue(a);});
  for (let i=0;i<31;i++) f.write(f.g('queue_wa')+((17+i)&31)*8+4,i*12);
  f.set('running',1);f.set('due_ms',0x7fffff);f.set('event_pending',1);f.set('paused_at',876);
  const before=Buffer.from(f.e.memory.buffer), state=globals.map(n=>f.e[n].value);
  for (const bad of [0,handle+1,0xffffffff]) {
    assert.equal(f.invoke('handle_midiStreamStop',[bad],8),5);
    assert.deepEqual(globals.map(n=>f.e[n].value),state,'invalid handle globals untouched');
    assert.deepEqual(Buffer.from(f.e.memory.buffer).subarray(mapping),before.subarray(mapping),'invalid handle guest queue/headers/stack untouched');
  }
  assert.equal(f.short.length,0);assert.equal(f.notices.length,0);
  let first=true;
  f.hook(a=>{
    if (!first) return;
    first=false;assert.equal(a,originals[0]);
    assert.equal(f.g('queue_head'),f.g('queue_tail'),'all original ownership detached before first callback');
    originals.forEach((p,i)=>assert.equal(f.read(mapping+p+16),(0x803|(i%2?0x40000000:0))>>>0,'all flags returned before first callback'));
    for (let i=0;i<64;i++) assert.equal(f.read(f.g('queue_wa')+i*4),0,'ring pointer and consumed offset cleared');
    // Requeue a returned original, then nested stop must deliver only that header.
    f.queue(a);
    const sp=f.read(reg+16);f.e.handle_midiStreamStop(handle,0,0,0,0,0);
    assert.equal(f.read(reg),0);assert.equal(f.read(reg+16),sp+8);f.write(reg+16,sp);
    // New ownership survives outer notifications, which retain original metadata.
    f.header(0x14000);f.queue(0x14000);
    f.set('callback',0xDEAD);f.set('instance',0xFFFF);f.set('callback_type',5);
  });
  assert.equal(f.stop(),0);preserved(f);
  assert.deepEqual(f.notices,[originals[0],originals[0],...originals.slice(1)].map(a=>['function',a]),'nested queue-stop and outer FIFO exactly once');
  assert.equal(f.g('queue_tail'),(f.g('queue_head')+1)&31);
  assert.equal(f.read(mapping+0x14010),0x812,'new header stays queued');
  f.e.midi_stream_service(0x7fffffff);assert.equal(f.short.length,64,'paused service emits no queued events');
  const controls=Array.from({length:16},(_,ch)=>[0x40B0|ch,0x7BB0|ch]).flat();
  assert.deepEqual(f.short,[...controls,...controls],'only sustain release and All Notes Off, no program/bank changes');
  // Completion endpoint matrix including callback zero and unsupported types.
  for (const kind of [0,1,2,3,4,5,6,7]) for (const cb of [0,0xCAFE]) {
    const t=await fixture(bytes,kind,cb);t.header(0x2000);t.queue(0x2000);
    assert.equal(t.stop(),cb && [4,6,7].includes(kind)?1:0,'callback type result');preserved(t);
    const expected=!cb || kind===0 || [4,6,7].includes(kind)?[]:
      kind===1?[['window',cb,0x3C9,handle,0x2000]]:
      kind===2?[['thread',cb,0x3C9,handle,0x2000,0,0]]:
      kind===5?[['event',cb]]:[['function',0x2000]];
    assert.deepEqual(t.notices,expected,'callback endpoint arguments');
  }
  for (const kind of [1,2,5]) {
    const t=await fixture(bytes,kind);for (const a of [0x2000,0x3000]) {t.header(a);t.queue(a);}
    t.result(0);t.hook(()=>{if(t.notices.length===2)t.result(1);});
    assert.equal(t.stop(),1,'early notification failure retained despite later success');
    assert.equal(t.notices.length,2,'failure must not strand remaining headers');preserved(t);
  }
  const timeout=await fixture(bytes);for(const a of [0x2000,0x3000]) {timeout.header(a);timeout.queue(a);}
  timeout.hangs(true);assert.equal(timeout.stop(),1);assert.equal(timeout.runs.length,128,'64 bounded runs per nonreturning callback');preserved(timeout);
  assert.equal(timeout.g('queue_head'),timeout.g('queue_tail'));
  for(const a of [0x2000,0x3000]) assert.equal(timeout.read(mapping+a+16),0x803);
  assert.equal(timeout.stop(),0,'empty stop has no timed-out callback to repeat');assert.equal(timeout.runs.length,128);
}
(async()=>{
  const normal=binary(false);await adversarial(normal);
  // Executable state mutant validates and runs, but destroys custom tempo.
  const mutant=binary(true);
  await assert.rejects(adversarial(mutant),e=>e.code==='ERR_ASSERTION' && /tempo preserved across stop/.test(e.message));
  console.log('PASS independent compiled WAT: 31-slot wrap, invalid-handle immutability, flags/FIFO, nested queue-stop, metadata snapshot, callback matrix/failures, timeout/ABI/state; tempo-reset mutant rejected');
  console.log(JSON.stringify({...provenance,wasmSHA256:hash(normal),mutantSHA256:hash(mutant)}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
