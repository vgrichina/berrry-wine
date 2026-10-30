#!/usr/bin/env node
'use strict';

// Compile the actual production handlers and stdio cores, without the guest,
// renderer, or 512 MiB full-module memory. Only host I/O, address translation,
// allocation and uncontended locking are fixtures. No handler is reimplemented.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { compile } = require('../tools/watx');
const source = fs.readFileSync(process.env.CRT_UNGETC_SOURCE ||
  path.join(__dirname, '../src/09a6-handlers-crt.wat'), 'utf8');
function fn(name) {
  const start = source.search(new RegExp(`\\(func \\$${name}\\s`));
  assert(start >= 0, name);
  let depth = 0, result = '';
  for (const line of source.slice(start).split('\n')) {
    for (const c of line.replace(/;;.*/, '') + '\n') {
      result += c;
      if (c === '(') depth++;
      if (c === ')' && --depth === 0) return result;
    }
  }
  throw Error(`unterminated ${name}`);
}
const names = ['handle_ungetc', 'handle_getc', 'handle_fgetc', 'handle_fgets', 'handle_fread',
  'crt_stream_lookup', 'crt_stream_link', 'crt_stream_unlink', 'crt_file_init',
  'crt_file_flags', 'crt_file_set_flags', 'crt_file_reset_buffer', 'crt_stream_handle',
  'crt_stream_is_console', 'crt_file_read', 'crt_file_unread', 'crt_park'];
const wrappers = ['ungetc','getc','fgetc','fgets','fread'].map(name => `
  (func (export "${name}") (param $a i32) (param $b i32) (param $c i32) (param $d i32)
    (call $handle_${name} (local.get $a) (local.get $b) (local.get $c)
      (local.get $d) (i32.const 0) (i32.const 0)))`).join('\n');
const wat = `
  (import "host" "write" (func $host_fs_write_file (param i32 i32 i32 i32) (result i32)))
  (import "host" "read" (func $host_fs_read_file_result (param i32 i32 i32 i32) (result i32)))
  (import "host" "seek" (func $host_fs_set_file_pointer (param i32 i32 i32) (result i32)))
  (memory 2 2 shared)
  (export "memory" (memory 0))
  (global $reg_base i32 (i32.const 256))
  (region.declare-fixed $CRT_STREAM_STATE (base 512) (size 16) (align 16))
  (global $CRT_STREAM_STATE i32 (region.addr $CRT_STREAM_STATE 0))
  (global $msvcrt_errno_ptr (mut i32) (i32.const 1536))
  (global $CRT_READ_PARKED i32 (i32.const -2))
  (func $g2w (param $p i32) (result i32) (local.get $p))
  (func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
  (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
  (func $lock_acquire (param i32)) (func $lock_release (param i32))
  (func $heap_alloc (param i32) (result i32) (i32.const 1536))
  (func $console_std_handle_get (param i32) (result i32) (i32.const 99))
  (func $console_buffer_record (param i32) (result i32) (i32.const 0))
  (func $console_write (param i32 i32 i32 i32) (result i32) (unreachable))
  (func $crash_unimplemented (param i32) (unreachable))
  (func $gl8 (param $p i32) (result i32) (i32.load8_u (local.get $p)))
  (func $gs8 (param $p i32) (param $v i32) (i32.store8 (local.get $p) (local.get $v)))
  (import "host" "park" (func $io_block (param i32)))
  ${names.map(fn).join('\n')}
  ${wrappers}
  (export "init" (func $crt_file_init))
  (export "link" (func $crt_stream_link))
  (export "unlink" (func $crt_stream_unlink))
  (export "read" (func $crt_file_read))
`;
const built = compile(wat, new Map(), { mode: 'production' });
assert(built.success, built.error);
assert(WebAssembly.validate(built.wasmBinary), 'compiled production stdio validates');
let memory, parked = 0, calls = 0;
const files = new Map();
const host = {
  read(h, buf, len, count) {
    calls++;
    const f = files.get(h);
    if (f.parkAt === f.pos) return 997;
    if (f.error) return 6;
    const n = Math.min(len, f.data.length - f.pos);
    new Uint8Array(memory.buffer).set(f.data.slice(f.pos, f.pos + n), buf);
    f.pos += n; new DataView(memory.buffer).setUint32(count, n, true); return 0;
  },
  seek(h, off, mode) { assert.equal(mode, 1); return files.get(h).pos += off; },
  write() { throw Error('unexpected write'); },
  park() { parked++; },
};
const e = new WebAssembly.Instance(new WebAssembly.Module(built.wasmBinary), { host }).exports;
memory = e.memory;
const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
const put = (p,v) => view.setUint32(p,v >>> 0,true), get = p => view.getInt32(p,true);
const F=0x1000, G=0x1100, IO=0x3000, SP=0xf000;
function open(f=F, flags=1, data=[65,66,10]) {
  const rec=f-64,h=f;
  e.init(f,h,flags); put(rec+4,h); put(rec+8,f); put(rec+12,0); e.link(rec);
  files.set(h,{data,pos:0});
}
function call(name,a,b=0,c=0,d=0,parks=false) {
  put(256,0x12345678); put(272,SP);
  const frame=[0x0041894e,a,b,c,d,0x13579bdf];
  frame.forEach((v,i)=>put(SP+i*4,v));
  e[name](a,b,c,d);
  assert.equal(get(272),parks ? SP : SP+4,'cdecl return-only stack cleanup / parked frame');
  assert.equal(get(SP),0x0041894e,'return address retained');
  if(name==='ungetc') assert.deepEqual(frame.map((_,i)=>get(SP+i*4)>>>0),frame.map(v=>v>>>0),'ungetc argument order/frame guards');
  return get(256);
}
open(); open(G);
assert.equal(call('ungetc',0x66,F),0x66,'original GLTron character');
assert.equal(get(F+4),1,'real FILE pending count');
assert.equal(call('ungetc',88,F),-1,'full one-byte pushback fails');
assert.equal(call('fgetc',G),65,'other stream unaffected');
assert.equal(call('getc',F),0x66); assert.equal(files.get(F).pos,0);
assert.equal(call('fgetc',F),65,'following read uses underlying next byte');
assert.equal(call('ungetc',0x1ff,F),255,'unsigned-byte conversion');
assert.equal(call('fread',IO,1,3,F),3); assert.deepEqual([...bytes.slice(IO,IO+3)],[255,66,10]);
assert.equal(call('getc',F),-1); assert(get(F+12)&16,'EOF set by read');
put(F+12,get(F+12)|32);
assert.equal(call('ungetc',255,F),255); assert.equal(get(F+12)&16,0,'EOF cleared');
assert(get(F+12)&32,'error flag retained'); assert.equal(call('getc',F),255);
assert.equal(call('getc',F),-1,'EOF after pushback');
for(const [f,flags] of [[0,0],[0xfffffff0,0],[G,0],[G,2],[G,0x82],[G,0x41]]) {
  if(f===G) e.init(G,G,flags);
  const before=bytes.slice(G,G+32); assert.equal(call('ungetc',70,f),-1);
  assert.deepEqual(bytes.slice(G,G+32),before,'invalid/closed/write/string untouched');
}
e.unlink(F-64); assert.equal(call('ungetc',70,F),-1,'unlinked stream');
put(520,0); open();
assert.equal(call('ungetc',90,F),90);
let before=bytes.slice(F,F+32); assert.equal(call('ungetc',-1,F),-1);
assert.deepEqual(bytes.slice(F,F+32),before,'EOF argument changes nothing');
assert.equal(e.read(F,IO,0),0); assert.equal(get(F+4),1,'zero read preserves pushback');
// A pending byte must survive a parked multi-byte fread, with no double host advance.
files.get(F).parkAt=0;
call('fread',IO,1,3,F,true); assert.equal(parked,1); assert.equal(get(F+4),1);
delete files.get(F).parkAt;
assert.equal(call('fread',IO,1,3,F),3); assert.deepEqual([...bytes.slice(IO,IO+3)],[90,65,66]);
// fgets consumed a synthetic byte and one underlying byte before parking.
put(520,0); open(); call('ungetc',88,F); files.get(F).parkAt=1;
call('fgets',IO,8,F,0,true); assert.equal(parked,2);
assert.equal(files.get(F).pos,0,'rollback rewinds only underlying input');
assert.equal(get(F+4),1); delete files.get(F).parkAt;
assert.equal(call('fgets',IO,8,F),IO);
assert.deepEqual([...bytes.slice(IO,IO+5)],[88,65,66,10,0],'retry retains arbitrary pushed byte');
// Host failure still returns already available input and latches error.
call('ungetc',81,F); files.get(F).error=true;
assert.equal(call('fread',IO,1,2,F),1); assert.equal(bytes[IO],81); assert(get(F+12)&32);
console.log('PASS production ungetc/read/getc/fgetc/fread/fgets: ordering, EOF/errors, unsigned byte, ownership/isolation, parked retry/rollback, cdecl');
