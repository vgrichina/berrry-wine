'use strict';
// Host-only conformance controls; no guest/build/Worker/audio device.
const assert = require('node:assert/strict');
const { createHostImports } = require('../lib/host-imports');
const buffer = new ArrayBuffer(4096), bytes = new Uint8Array(buffer), dv = new DataView(buffer);
const writes = [];
const host = createHostImports({ getMemory: () => buffer,
  exports: { page_watch_write: (...args) => writes.push(args) } }).host;
const run = host.wave_error_text;
const string = (at, wide) => { let s=''; for(let n=0;n<256;n++){const c=wide?dv.getUint16(at+n*2,true):bytes[at+n];if(!c)return s;s+=String.fromCharCode(c);}throw Error('unterminated'); };
for (const code of [...Array(22).keys(), 32, 33, 34, 35]) {
  const count = run(code, 0, 0, 2); assert(count > 1 && count <= 256);
  bytes.fill(0xa5); writes.length=0;
  assert.equal(run(code, 256, 256, 0), 0);
  const text = string(256, false); assert(text.length > 0); assert.equal(text.length + 1, count);
  assert.equal(bytes[255], 0xa5); assert.equal(bytes[256 + count], 0xa5);
  assert.deepEqual(writes, [[256, count]]);
  assert.equal(run(code, 1024, 256, 1), 0); assert.equal(string(1024, true), text);
  assert.equal(bytes[1023],0xa5); assert.equal(bytes[1024+count*2],0xa5);
  for(const wide of [0,1]) for(const cap of [1,2,7,count,count+1,0xffffffff]) {
    bytes.fill(0xa5); const stride=wide?2:1, n=Math.min(text.length,cap-1);
    assert.equal(run(code,512,cap,wide),0);assert.equal(string(512,wide),text.slice(0,n));
    assert.equal(bytes[511],0xa5);assert.equal(bytes[512+(n+1)*stride],0xa5);
  }
}
for(const code of [22,31,36,64,0xffffffff]) {
  bytes.fill(0xa5);writes.length=0;
  assert.equal(run(code,256,256,0),9);assert.equal(run(code,256,256,1),9);
  assert.equal(run(code,0,0,2),0);assert(bytes.every(b=>b===0xa5));assert.equal(writes.length,0);
  assert.equal(run(code,256,0,0),0);assert.equal(run(code,256,0,1),0);
}
assert.equal(run(0,0,1,0),11);assert.equal(run(0,0,0,0),11);
bytes.fill(0xa5);assert.equal(run(0,4095,256,1),11);assert(bytes.every(b=>b===0xa5));
assert.equal(run(32,4095,1,0),0);assert.equal(bytes[4095],0);
assert.match((run(32,256,256,0),string(256,false)),/format/i);
assert.match((run(34,256,256,0),string(256,false)),/prepared/i);
const table = require('../src/api_table.json');
assert.equal(table[4590].name,'waveOutGetErrorTextA');assert.equal(table[4591].name,'waveOutGetErrorTextW');
assert.equal(table[4590].nargs,3);assert.equal(table[4591].nargs,3);
console.log('WinMM error descriptions A/W valid ranges, invalid numbers/pointers, truncation, NUL, canaries, unsigned capacity PASS');
