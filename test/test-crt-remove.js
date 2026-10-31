#!/usr/bin/env node
'use strict';
// Execute unchanged production handlers against the owning production VFS import.
const assert = require('assert'), fs = require('fs'), path = require('path');
const { compile } = require('../tools/watx');
const { VirtualFS, createFilesystemImports } = require('../lib/filesystem');
const source = fs.readFileSync(process.env.CRT_REMOVE_SOURCE || path.join(__dirname, '../src/09a6-handlers-crt.wat'), 'utf8');
function fn(name) {
  const start = source.indexOf(`(func $${name} `); assert(start >= 0, name);
  let depth = 0, result = '';
  for (const line of source.slice(start).split('\n')) {
    for (const c of line.replace(/;;.*/, '') + '\n') {
      result += c;
      if (c === '(') depth++;
      if (c === ')' && --depth === 0) return result;
    }
  }
  throw Error('unterminated ' + name);
}
const built = compile(`
(import "host" "delete" (func $host_fs_delete_file (param i32 i32) (result i32)))
(memory 1)
(export "memory" (memory 0))
(global $reg_base i32 (i32.const 256))
(func $g2w (param $p i32) (result i32) (i32.add (local.get $p) (i32.const 4096)))
${fn('handle_remove')} ${fn('handle__unlink')}
(export "remove" (func $handle_remove))`, new Map(), { mode: 'production' });
assert(built.success, built.error);
let memory;
const owner = new VirtualFS(), other = new VirtualFS();
const imports = createFilesystemImports({ vfs: owner, getMemory: () => memory.buffer });
const e = new WebAssembly.Instance(new WebAssembly.Module(built.wasmBinary), { host: { delete: imports.fs_delete_file } }).exports;
memory = e.memory;
const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
const put = (p,v) => view.setUint32(p,v>>>0,true);
const entries = ['c:\\games\\gltron\\save,1.tmp','c:\\games\\gltron\\neighbor.tmp','d:\\protected.tmp'];
for (const vfs of [owner, other]) for (const name of entries) vfs.files.set(vfs._resolvePath(name), {data: Uint8Array.of(65,66), attrs:32});
owner.setDriveReadOnly('d');
owner.createDirectory('c:\\games\\gltron\\dir');
const otherBefore = [...other.files], neighbor = owner.files.get(owner._resolvePath(entries[1]));
const handlesBefore = [...owner.handles], dirsBefore = [...owner.dirs];
function call(name, expected) {
  bytes.fill(0x5a, 256, 512); put(272, 8192);
  bytes.set(Buffer.from(name+'\0'), 4096+1024);
  const before = bytes.slice();
  e.remove(1024,0,0,0,0,0);
  assert.equal(view.getInt32(256,true), expected, 'actual deletion result');
  assert.equal(view.getUint32(272,true),8196,'cdecl return address only');
  const after = bytes.slice();
  after.set(before.slice(256,260),256); after.set(before.slice(272,276),272);
  assert.deepEqual(after,before,'all memory except EAX/ESP preserved, including frame/path/errno sentinel');
  assert.deepEqual([...other.files],otherBefore,'different filesystem owner unchanged');
  assert.deepEqual([...owner.handles],handlesBefore,'handles preserved');
  assert.deepEqual([...owner.dirs],dirsBefore,'directories preserved');
  assert.strictEqual(owner.files.get(owner._resolvePath(entries[1])),neighbor,'neighbor entry identity');
}
call('C:/GAMES/GLTRON/save,1.tmp',0);
assert(!owner.files.has(owner._resolvePath(entries[0])),'removed from owning namespace');
call(entries[0],-1); // repeated removal must fail; rejects always-success implementations
call('c:\\games\\gltron\\absent.tmp',-1);
call(entries[2],-1);
assert(owner.files.has(owner._resolvePath(entries[2])),'read-only file retained');
call('c:\\games\\gltron\\dir',-1);
call('',-1);
console.log('PASS production remove: real owner deletion, repeated/missing/empty/directory/read-only failure, translated ANSI path, comma/case/slashes, cdecl and unrelated state');
