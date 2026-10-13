'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apis = require('../src/api_table.json');
const extraWat = `
 (func (export "mmio_protect_test") (param $p i32) (param $protection i32)
   (drop (call $guest_page_protect_range (local.get $p) (i32.const 4096) (local.get $protection))))
 (func (export "invoke_mmio_write_test") (param $id i32) (param $a i32) (param $b i32) (param $c i32)
   (param $sp i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (local.get $sp))
   (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b) (local.get $c)
     (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
`;
(async () => {
  let e, position = 0, writeCalls = 0, limit = 100, fail = false, access;
  const disk = new Uint8Array(100).fill(0xa7), diskHandle = 0x70000191;
  const boot = await bootRenderHarness({ extraWat, fonts: 'none', extraHostOverrides: {
    fs_create_file(path, mode) { access = mode >>> 0; return diskHandle; },
    fs_set_file_pointer(h, offset, origin) {
      if (h !== diskHandle) return -1;
      position = origin === 1 ? position + offset : offset; return position;
    },
    fs_write_file(h, p, n, out) {
      writeCalls++;
      if (h !== diskHandle || fail) return 0;
      const count = Math.min(n, limit, disk.length - position);
      for (let i = 0; i < count; i++) disk[position++] = e.guest_read8(p + i);
      e.guest_write32(out, count); return 1;
    },
  }});
  e = boot.exports;
  const stack = e.guest_alloc(128) + 16, info = e.guest_alloc(72);
  const src = e.guest_alloc(64), dst = e.guest_alloc(40) + 4;
  const read = (p, n) => Array.from({length:n}, (_, i) => e.guest_read8(p + i));
  const fill = (p, n, v) => { for (let i = 0; i < n; i++) e.guest_write8(p + i, v); };
  const call = (name, a, b = 0, c = 0) => {
    const api = apis.find(x => x.name === name), end = stack + 4 * (api.nargs + 1);
    e.guest_write32(end, 0x12345678);
    const result = e.invoke_mmio_write_test(api.id, a, b, c, stack);
    assert.strictEqual(e.get_esp(), end, name + ' stack');
    assert.strictEqual(e.guest_read32(end), 0x12345678, name + ' stack guard');
    assert.strictEqual(e.guest_span_cursor_bytes(), 0, name + ' releases spans');
    return result;
  };
  const open = (p, size, flags = 0x1002) => {
    fill(info, 72, 0); e.guest_write32(info + 4, 0x204d454d);
    e.guest_write32(info + 20, size); e.guest_write32(info + 24, p);
    const h = call('mmioOpenA', 0, info, flags); assert(h > 0); return h;
  };
  const state = h => {
    assert.strictEqual(call('mmioGetInfo', h, info), 0);
    return [28, 32, 36].map(off => e.guest_read32(info + off));
  };
  for (let i = 0; i < 64; i++) e.guest_write8(src + i, i + 1);
  fill(dst - 4, 40, 0xa7);
  const h = open(dst, 32);
  assert.strictEqual(call('mmioWrite', h, src, 12), 12);
  assert.deepStrictEqual(read(dst, 12), read(src, 12), 'actual stored bytes');
  assert.deepStrictEqual(state(h), [dst + 12, dst + 12, dst + 32]);
  assert.strictEqual(call('mmioSeek', h, 4, 0), 4);
  assert.strictEqual(call('mmioWrite', h, src + 20, 4), 4);
  assert.deepStrictEqual(read(dst + 4, 4), read(src + 20, 4));
  assert.deepStrictEqual(state(h), [dst + 8, dst + 12, dst + 32], 'overwrite retains length');
  assert.strictEqual(call('mmioSeek', h, 0, 2), 12);
  assert.strictEqual(call('mmioWrite', h, src, 64), 20, 'short write to fixed capacity');
  assert.deepStrictEqual(read(dst + 12, 20), read(src, 20));
  assert.strictEqual(call('mmioWrite', h, src, 1), 0, 'full buffer accepts zero');
  assert.deepStrictEqual(state(h), [dst + 32, dst + 32, dst + 32]);
  const back = e.guest_alloc(64);
  call('mmioSeek', h, 0, 0);
  assert.strictEqual(call('mmioRead', h, back, 64), 32, 'readback stops at written length');
  assert.deepStrictEqual(read(back, 32), read(dst, 32));
  assert.deepStrictEqual(read(dst - 4, 4), [167,167,167,167]);
  assert.deepStrictEqual(read(dst + 32, 4), [167,167,167,167]);
  call('mmioSeek', h, 0, 0);
  const snapshot = read(dst, 32);
  for (const [p, n] of [[src,-1], [0,4], [0xfffffffe,4], [0x39000000,4]]) {
    assert.strictEqual(call('mmioWrite', h, p, n), -1);
    assert.deepStrictEqual(read(dst, 32), snapshot);
    assert.deepStrictEqual(state(h), [dst, dst + 32, dst + 32]);
  }
  assert.strictEqual(call('mmioWrite', h, 0, 0), 0);
  assert.strictEqual(call('mmioSeek', h, 0, 1), 0);
  call('mmioClose', h);
  assert.strictEqual(call('mmioWrite', h, src, 4), -1, 'closed handle');
  assert.strictEqual(call('mmioWrite', 0, src, 4), -1, 'invalid handle');
  const ro = open(dst, 32, 0);
  assert.strictEqual(call('mmioWrite', ro, src, 4), -1, 'read-only memory file');
  call('mmioClose', ro);

  // Both ranges cross sparse pages whose physical backing is non-adjacent.
  const base = 0x38000000, other = base + 0x10000, target = base + 0x20000;
  for (const p of [base, other, base + 4096, target, other + 4096, target + 4096])
    e.test_virtual_map_commit(p, 4096);
  assert.notStrictEqual(e.guest_to_wasm(base + 4096), e.guest_to_wasm(base) + 4096);
  fill(other, 8192, 0x91);
  for (let i = 0; i < 24; i++) e.guest_write8(base + 4088 + i, i + 60);
  const sparse = open(target + 4092, 24);
  assert.strictEqual(call('mmioWrite', sparse, base + 4088, 24), 24);
  assert.deepStrictEqual(read(target + 4092, 24), read(base + 4088, 24));
  assert(read(other, 8192).every(v => v === 0x91), 'unrelated backing untouched');
  call('mmioSeek', sparse, 0, 0);
  e.mmio_protect_test(target + 4096, 2);
  const beforeProtected = read(target + 4092, 24);
  assert.strictEqual(call('mmioWrite', sparse, src, 24), -1, 'read-only destination tail');
  assert.deepStrictEqual(read(target + 4092, 24), beforeProtected);
  assert.strictEqual(call('mmioSeek', sparse, 0, 1), 0);
  e.mmio_protect_test(target + 4096, 4);
  e.mmio_protect_test(base + 4096, 1);
  assert.strictEqual(call('mmioWrite', sparse, base + 4088, 24), -1, 'no-access source tail');
  assert.deepStrictEqual(read(target + 4092, 24), beforeProtected);
  e.mmio_protect_test(base + 4096, 4);
  call('mmioClose', sparse);
  const partial = open(target + 8188, 8);
  fill(target + 8188, 4, 0xa7);
  assert.strictEqual(call('mmioWrite', partial, src, 8), -1, 'unmapped destination tail');
  assert.deepStrictEqual(read(target + 8188, 4), [167,167,167,167]);
  assert.strictEqual(call('mmioSeek', partial, 0, 1), 0);
  call('mmioClose', partial);
  const badSource = open(dst, 32);
  assert.strictEqual(call('mmioWrite', badSource, base + 8188, 8), -1, 'unmapped source tail');
  assert.deepStrictEqual(read(dst, 32), snapshot);
  call('mmioClose', badSource);

  // Chaos Gate's first call is 0x27880 bytes, far larger than the default
  // buffered-file block. An owned memory file must retain the entire payload.
  const largeSize = 0x27880, largeSource = e.guest_alloc(largeSize);
  for (let i = 0; i < largeSize; i++) e.guest_write8(largeSource + i, (i * 17 + 3) & 255);
  const owned = open(0, largeSize, 0x11011); // observed Chaos Gate write-mode flags
  const ownedBuffer = state(owned)[0];
  assert(ownedBuffer !== 0);
  assert.strictEqual(call('mmioWrite', owned, largeSource, largeSize), largeSize);
  assert.deepStrictEqual(read(ownedBuffer, largeSize), read(largeSource, largeSize));
  assert.deepStrictEqual(state(owned), [ownedBuffer + largeSize, ownedBuffer + largeSize, ownedBuffer + largeSize]);
  call('mmioClose', owned);

  for (const [flags, expected] of [[0,0x80000000],[1,0x40000000],[2,0xc0000000],[0x1000,0xc0000000]]) {
    call('mmioOpenA', src, 0, flags); assert.strictEqual(access, expected);
  }
  assert.strictEqual(call('mmioWrite', diskHandle, src, 12), 12);
  assert.deepStrictEqual(Array.from(disk.slice(0,12)), read(src,12));
  limit = 3;
  assert.strictEqual(call('mmioWrite', diskHandle, src + 20, 9), 3);
  assert.strictEqual(position, 15);
  assert.deepStrictEqual(Array.from(disk.slice(12,15)), read(src + 20,3));
  const beforeCalls = writeCalls;
  assert.strictEqual(call('mmioWrite', diskHandle, 0, 0), 0);
  assert.strictEqual(writeCalls, beforeCalls, 'zero count never truncates');
  assert.strictEqual(disk[15], 0xa7);
  assert.strictEqual(call('mmioWrite', diskHandle, 0, 4), -1);
  assert.strictEqual(call('mmioWrite', diskHandle, src, -1), -1);
  assert.strictEqual(writeCalls, beforeCalls, 'invalid source/count never reaches host');
  fail = true;
  assert.strictEqual(call('mmioWrite', diskHandle, src, 4), -1);
  assert.strictEqual(position, 15);
  console.log('PASS: mmioWrite real memory/file bytes, positions, lengths, short/error/zero writes, sparse boundaries, guards and stdcall');
})().catch(err => { console.error(err.stack || err); process.exit(1); });
