#!/usr/bin/env node
'use strict';

// Compile the actual production handlers and stdio cores, without the guest,
// renderer, or 512 MiB full-module memory. Only host I/O, address translation,
// allocation and uncontended locking are fixtures. No handler is reimplemented.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { compile } = require('../tools/watx');
const source = fs.readFileSync(process.env.CRT_SETBUF_SOURCE ||
  path.join(__dirname, '../src/09a6-handlers-crt.wat'), 'utf8');
function fn(name) {
  const start = source.indexOf(`(func $${name} `);
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
const names = ['handle_setbuf', 'handle_setvbuf', 'crt_stream_lookup',
  'crt_stream_link', 'crt_stream_unlink', 'crt_file_init', 'crt_file_flags',
  'crt_file_set_flags', 'crt_file_reset_buffer', 'crt_fdopen_error',
  'crt_stream_is_console', 'crt_stream_handle', 'crt_handle_write',
  'crt_file_write', 'crt_file_read'];
const wrappers = ['setbuf', 'setvbuf'].map(name => `
  (func (export "${name}") (param $f i32) (param $b i32) (param $mode i32) (param $size i32)
    (call $handle_${name} (local.get $f) (local.get $b) (local.get $mode)
      (local.get $size) (i32.const 0) (i32.const 0)))`).join('\n');
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
  ${names.map(fn).join('\n')}
  ${wrappers}
  (export "init" (func $crt_file_init))
  (export "link" (func $crt_stream_link))
  (export "unlink" (func $crt_stream_unlink))
  (export "read" (func $crt_file_read))
  (export "write" (func $crt_file_write))`;
const built = compile(wat, new Map(), { mode: 'production' });
assert(built.success, built.error);
assert(WebAssembly.validate(built.wasmBinary), 'compiled production stdio validates');
let memory, position = 0, data = [], calls = 0;
const host = {
  write(handle, buf, len, count) {
    assert.equal(handle, 7); calls++;
    const bytes = new Uint8Array(memory.buffer);
    for (let i = 0; i < len; i++) data[position++] = bytes[buf + i];
    new DataView(memory.buffer).setUint32(count, len, true);
    return 1;
  },
  read(handle, buf, len, count) {
    assert.equal(handle, 7); calls++;
    const n = Math.min(len, data.length - position);
    new Uint8Array(memory.buffer).set(data.slice(position, position + n), buf);
    position += n;
    new DataView(memory.buffer).setUint32(count, n, true);
    return 0;
  },
  seek() { throw Error('setbuf must not seek'); },
};
const e = new WebAssembly.Instance(new WebAssembly.Module(built.wasmBinary), { host }).exports;
memory = e.memory;
const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
const put = (p, v) => view.setUint32(p, v >>> 0, true);
const get = p => view.getUint32(p, true);
const F = 0x1000, REC = 0x800, BUF = 0x2000, IO = 0x3000, SP = 0xf000;
function open(flags) {
  e.init(F, 7, flags);
  put(REC, 0); put(REC + 4, 7); put(REC + 8, F); put(REC + 12, 0);
  put(512 + 8, 0); e.link(REC);
}
function call(f, buf, name = 'setbuf', mode = 0, size = 512) {
  put(256, 0x12345678); put(272, SP);
  const frame = [0xfeedbeef, 0x00423cc7, f, buf, mode, size, 0xdeadcafe];
  frame.forEach((v, i) => put(SP - 4 + i * 4, v));
  const oldCalls = calls;
  e[name](f, buf, mode, size);
  assert.equal(get(272), SP + 4, 'cdecl pops only return address');
  assert.deepEqual(frame.map((_, i) => get(SP - 4 + i * 4)), frame,
    'return address, arguments and frame guards survive');
  if (name === 'setbuf') assert.equal(get(256), 0x12345678, 'void preserves EAX');
  assert.equal(calls, oldCalls, 'configuration emits no I/O');
}
// Both supported setbuf modes match this CRT's setvbuf semantics. BUFSIZ is
// 512 in MSVCRT, not the 8192 used by some host C libraries.
for (const buf of [0, BUF]) {
  open(2); bytes.fill(0xa5, BUF, BUF + 512);
  const before = bytes.slice(F, F + 32);
  put(1536, 77); call(F, buf);
  assert.equal(get(1536), 77, 'success leaves errno');
  assert.deepEqual(bytes.slice(F, F + 32), before, 'canonical immediate-I/O FILE retained');
  assert.deepEqual(bytes.slice(BUF, BUF + 512), new Uint8Array(512).fill(0xa5), 'caller buffer untouched');
  call(F, buf, 'setvbuf', buf ? 0 : 4);
  assert.equal(get(256), 0, 'corresponding setvbuf accepted');
  position = 0; data = [];
  bytes.set([65, 0, 255, 10], IO);
  assert.equal(e.write(F, IO, 4), 4);
  call(F, buf ? 0 : BUF); // Switching modes after immediate writes loses nothing.
  assert.deepEqual(data, [65, 0, 255, 10]);
  bytes.set([66, 67], IO);
  assert.equal(e.write(F, IO, 2), 2);
  assert.deepEqual(data, [65, 0, 255, 10, 66, 67]);
  open(1); position = 0;
  assert.equal(e.read(F, IO, 2), 2);
  call(F, buf);
  assert.equal(e.read(F, IO + 2, 8), 4);
  assert.deepEqual(Array.from(bytes.slice(IO, IO + 6)), data, 'no skipped/duplicated input');
  assert(get(F + 12) & 0x10, 'EOF latched');
  const eofFlags = get(F + 12); call(F, buf);
  assert.equal(get(F + 12), eofFlags, 'setbuf does not clear EOF');
}
// Unknown, copied, unlinked/closed and closed standard-stream records must
// not be dereferenced or rewritten. An out-of-range pointer catches loads
// before lookup. Both buffer modes return with the same cdecl contract.
for (const buf of [0, BUF]) {
  bytes.set(bytes.slice(F, F + 32), F + 32);
  for (const f of [0, 0x4000, 0xfffffff0, F + 32]) {
    bytes.fill(0x5a, 0x4000, 0x4020);
    const before = bytes.slice(0x4000, 0x4020);
    call(f, buf); assert.equal(get(1536), 22);
    assert.deepEqual(bytes.slice(0x4000, 0x4020), before);
  }
  open(2); e.unlink(REC); const closed = bytes.slice(F, F + 32);
  call(F, buf); assert.equal(get(1536), 22);
  assert.deepEqual(bytes.slice(F, F + 32), closed);
  open(0); put(F + 12, 0); call(F, buf);
  assert.equal(get(1536), 22, 'closed standard stream rejected');
  assert.equal(get(F + 12), 0);
}
assert(fn('handle_setbuf').includes('(i32.const 512)'), 'default MSVCRT BUFSIZ');
console.log('PASS real setbuf/setvbuf, NULL/nonNULL, MSVCRT BUFSIZ, stream validity, immediate read/write integrity, cdecl frame/return/EAX');
