#!/usr/bin/env node
'use strict';
// Diagnostic of prerequisites, NOT a passing implementation test.
// Run with a repository/snapshot root containing the pinned source and compiler.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(process.argv[2] || path.join(__dirname, '../../..'));
const { compileClosure } = require(path.join(root, 'tools/watx-closure'));
const { createAudioHost } = require(path.join(root, 'lib/host-audio'));
const source = fs.readFileSync(path.join(root, 'src/09a3-handlers-audio.wat'), 'utf8')
  .replace(/;;[^\n]*/g, '');
function func(name) {
  const start = source.indexOf(`(func $${name} `);
  assert(start >= 0, name);
  let depth = 0;
  for (let end = start; end < source.length; end++) {
    if (source[end] === '(') depth++;
    if (source[end] === ')' && --depth === 0) return source.slice(start, end + 1);
  }
  throw Error(`unbalanced ${name}`);
}
const names = ['midiStreamOpen', 'midiStreamOut', 'midiStreamPause',
  'midiStreamRestart', 'midiStreamClose', 'midiOutReset'];
const globals = source.slice(source.indexOf('(global $midi_stream_handle'),
  source.indexOf('(func $midi_stream_service'));
const compiled = compileClosure({source: `
  (import "host" "memory" (memory 1))
  (import "host" "open" (func $host_midi_out_open (param i32 i32 i32 i32) (result i32)))
  (import "host" "close" (func $host_midi_out_close (param i32) (result i32)))
  (import "host" "reset" (func $host_midi_out_reset (param i32) (result i32)))
  (import "host" "short" (func $host_midi_out_short_msg (param i32 i32) (result i32)))
  (import "host" "ticks" (func $host_get_ticks (result i32)))
  (global $reg_base i32 (i32.const 64))
  (global $heap (mut i32) (i32.const 32768))
  (func $g2w (param $p i32) (result i32) (local.get $p))
  (func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
  (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
  (func $heap_alloc (param $n i32) (result i32) (local $p i32)
    (local.set $p (global.get $heap))
    (global.set $heap (i32.add (global.get $heap) (local.get $n))) (local.get $p))
  (func $zero_memory (param $p i32) (param $n i32)
    (memory.fill (local.get $p) (i32.const 0) (local.get $n)))
  ${globals}
  ${names.map(n => func('handle_' + n)).join('\n')}
  ${func('midi_stream_service')}
  ${names.map(n => `(export "${n}" (func $handle_${n}))`).join('\n')}
  (export "service" (func $midi_stream_service))
`, vfs:new Map()}, {tailCalls:false});
assert(compiled.success, compiled.error);
const moduleUnderTest = new WebAssembly.Module(compiled.wasmBinary);
const records = [];
function setup() {
  const memory = new WebAssembly.Memory({initial:1});
  const dv = new DataView(memory.buffer);
  let now = 100;
  const sent = [], notifications = [];
  const notes = new Set();
  class Synth {
    send([status, note, velocity]) {
      sent.push([status, note, velocity]);
      const key = `${status & 15}:${note}`;
      if ((status & 240) === 144 && velocity) notes.add(key);
      if ((status & 240) === 128 || ((status & 240) === 144 && !velocity)) notes.delete(key);
    }
    allSoundOff(ch) {
      for (const key of notes) if (key.startsWith(ch + ':')) notes.delete(key);
    }
  }
  const ac = {currentTime:0, state:'running'};
  const ctx = {getMemory:()=>memory.buffer, WebAudioTinySynth:Synth,
    _voices:{_ensureCtx:()=>ac}, exports:new Proxy({}, {
      get:(_, key)=>(...args)=>notifications.push([key, ...args])
    })};
  const host = createAudioHost(ctx, {
    getHost:()=>new Proxy({}, {get:(_,key)=>(...args)=>notifications.push([key,...args])}),
    profileNow:()=>0, profileEvent:()=>{}
  }).imports;
  ctx._voices._ensureCtx = () => ac;
  const e = new WebAssembly.Instance(moduleUnderTest, {host:{
    memory, open:host.midi_out_open, close:host.midi_out_close,
    reset:host.midi_out_reset, short:host.midi_out_short_msg, ticks:()=>now
  }}).exports;
  function call(name, ...args) {
    dv.setUint32(80, 4096, true);
    e[name](...Array.from({length:6}, (_,i)=>args[i] || 0));
    const count = {midiStreamOpen:6,midiStreamOut:3}[name] || 1;
    assert.equal(dv.getUint32(80,true), 4096+4*(count+1), name+' stdcall');
    return dv.getUint32(64,true);
  }
  function open() {
    dv.setUint32(4096+24, 0x30000, true); // CALLBACK_FUNCTION
    dv.setUint32(512, 0, true);
    assert.equal(call('midiStreamOpen', 516,512,1,0x123456,0x987654),0);
    return dv.getUint32(516,true);
  }
  function queue(h, hdr=1024, delay=480) {
    const data=hdr+128;
    dv.setUint32(hdr,data,true);
    dv.setUint32(hdr+4,12,true);
    dv.setUint32(hdr+8,12,true);
    dv.setUint32(hdr+16,2,true);
    dv.setUint32(data,delay,true);
    dv.setUint32(data+8,0x643c90,true);
    assert.equal(call('midiStreamOut',h,hdr,64),0);
  }
  return {e,dv,ctx,host,call,open,queue,notes,sent,notifications,setNow:v=>{now=v;}};
}
const table = JSON.parse(fs.readFileSync(path.join(root,'src/api_table.json')));
assert(!table.some(row=>row.name==='midiStreamStop'), 'baseline stop export absent');
records.push({case:'public export', observed:'midiStreamStop absent; no public ABI implementation'});
for (const state of ['queued', 'playing', 'paused']) {
  const s=setup(), h=s.open(); s.queue(h);
  if (state!=='queued') { assert.equal(s.call('midiStreamRestart',h),0); s.e.service(100); }
  if (state==='paused') { s.setNow(200); assert.equal(s.call('midiStreamPause',h),0); }
  assert.equal(s.call('midiOutReset',h),0);
  // This is a diagnosed defect, not desired behavior.
  assert.equal(s.dv.getUint32(1040,true),18, 'reset leaves PREPARED|INQUEUE');
  assert.equal(s.notifications.length,0);
  s.setNow(1000); assert.equal(s.call('midiStreamRestart',h),0);
  s.e.service(1000); s.e.service(2000);
  assert.equal(s.sent.filter(m=>(m[0]&240)===144).length,1, 'stale note plays after reset');
  assert.equal(s.dv.getUint32(1040,true),3, 'eventually sets DONE without callback');
  assert.equal(s.notifications.length,0);
  records.push({case:state, resetResult:0, flagsAfterReset:18,
    staleNoteOnsAfterRestart:1, flagsAfterService:3, notifications:0});
}
{
  const s=setup(), first=s.open(); s.queue(first);
  const second=s.open(); assert.notEqual(first,second);
  assert.equal(s.call('midiStreamRestart',first),5);
  assert(s.ctx._midiOut.devices.has(first), 'first host handle still open');
  assert.equal(s.dv.getUint32(1040,true),18);
  records.push({case:'second stream open', firstStillHostValid:true,
    firstRestartResult:5, orphanHeaderFlags:18});
}
{
  const s=setup();
  assert.equal(s.call('midiStreamRestart',0),0, 'baseline incorrectly accepts unopened NULL stream');
  assert.equal(s.call('midiStreamRestart',123),5);
  assert.equal(s.call('midiOutReset',123),5, 'real host rejects invalid MIDI handle');
  records.push({case:'invalid handles', nullRestart:0, foreignRestart:5, foreignReset:5});
}
{
  const s=setup(), a=s.open(), b=s.host.midi_out_open(0,0,0,0);
  s.host.midi_out_short_msg(a,0x643c90);
  s.host.midi_out_short_msg(b,0x644091);
  assert.equal(s.notes.size,2, 'positive note-on control');
  s.host.midi_out_short_msg(a,0x003c80);
  assert.deepEqual([...s.notes],['1:64'], 'targeted note-off control preserves sibling');
  s.host.midi_out_short_msg(a,0x643c90);
  assert.equal(s.host.midi_out_reset(a),0);
  assert.equal(s.notes.size,0, 'reset also stops sibling handle on shared synth');
  records.push({case:'reset alias negative control', siblingNoteSurvivesTargetedOff:true,
    siblingNoteSurvivesReset:false});
}
console.log(JSON.stringify({diagnosis:'BLOCKED: observations are defects, not WinMM conformance',
  moduleBytes:compiled.wasmBinary.length, cases:records},null,2));
if (process.argv.includes('--require-conformance')) {
  assert.equal(records.find(r=>r.case==='playing').flagsAfterReset,3,
    'WinMM contract: reset must return queued headers DONE, not INQUEUE');
}
