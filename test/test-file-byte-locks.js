'use strict';
const assert = require('assert');
const { VirtualFS, createFilesystemImports } = require('../lib/filesystem');
const path = 'c:\\locks.bin';
function fixture() {
  const vfs = new VirtualFS();
  vfs.files.set(path, { data: Uint8Array.from({ length: 32 }, (_, i) => i), attrs: 32 });
  const open = (access = 0xc0000000) => vfs.createFile(path, access, 3);
  const a = open(), b = open();
  const lock = (h, start, length, unlock = false) => {
    start = BigInt(start); length = BigInt(length);
    return vfs.lockFile(h, Number(start & 0xffffffffn), Number(start >> 32n),
      Number(length & 0xffffffffn), Number(length >> 32n), unlock);
  };
  return { vfs, a, b, open, lock };
}

{
  const { vfs, a, b, lock } = fixture();
  assert.equal(lock(a, 8, 8), 0);
  for (const h of [a, b]) for (const [start, size] of [[8, 8], [0, 9], [15, 1], [9, 2]]) {
    assert.equal(lock(h, start, size), 33);
  }
  assert.equal(lock(b, 0, 8), 0);
  assert.equal(lock(b, 16, 8), 0);
  assert.equal(lock(b, 8, 8, true), 158);
  assert.equal(lock(a, 8, 7, true), 158);
  const bytes = new Uint8Array(16).fill(0xcc), original = [...vfs.files.get(path).data];
  vfs.setFilePointer(b, 4, 0);
  assert.equal(vfs.readFile(b, bytes, 16).error, 33);
  assert(bytes.every(x => x === 0xcc));
  assert.equal(vfs.getOpenFile(b).pos, 4);
  assert.equal(vfs.writeFile(b, bytes, 16).error, 33);
  assert.deepEqual([...vfs.files.get(path).data], original);
  assert.equal(vfs.getOpenFile(b).pos, 4);
  vfs.setFilePointer(a, 8, 0);
  assert.equal(vfs.readFile(a, bytes, 8).bytesRead, 8);
  assert.equal(lock(a, 8, 8, true), 0);
  assert.equal(lock(a, 8, 8, true), 158);
}
{
  const { vfs, a, b, lock } = fixture();
  assert.equal(lock(a, 0, 4), 0);
  const duplicate = vfs.duplicateFileHandle(a, 0, true, 2);
  assert.equal(vfs.readFile(duplicate, new Uint8Array(4), 4).bytesRead, 4);
  assert.equal(lock(duplicate, 0, 4, true), 0);
  assert.equal(lock(duplicate, 0, 4), 0);
  assert.equal(vfs.duplicateFileHandle(a, 0, true, 2, false), -6);
  assert(vfs.closeHandle(a));
  assert.equal(lock(b, 0, 4), 33, 'first duplicate close retains lock');
  assert(vfs.closeHandle(duplicate));
  assert.equal(lock(b, 0, 4), 0, 'last duplicate close releases');
  assert.equal(lock(a, 0, 4), 6);
  const moved = vfs.duplicateFileHandle(b, 0, false, 3);
  assert(moved > 0);
  assert.equal(lock(moved, 0, 4, true), 0, 'close-source retains surviving owner');
}
{
  const { vfs, a, b, open, lock } = fixture();
  assert.equal(lock(open(0), 0, 1), 5);
  assert.equal(lock(0xffffffff, 0, 1), 6);
  const high = (1n << 53n) + 3n;
  assert.equal(lock(a, high, 3), 0);
  assert.equal(lock(b, high + 2n, 1), 33);
  assert.equal(lock(b, high + 3n, 1), 0);
  assert.equal(lock(a, (1n << 64n) - 1n, 1), 0);
  assert.equal(lock(b, (1n << 64n) - 1n, 2), 87);
  assert.equal(lock(a, 100, 0), 0);
  assert.equal(lock(b, 90, 10), 0);
  assert.equal(lock(b, 100, 10), 33);
  assert.equal(lock(a, 100, 1, true), 158);
  assert.equal(lock(a, 100, 0, true), 0);
  const append = open(4);
  assert.equal(lock(a, 32, 4), 0);
  assert.equal(vfs.writeFile(append, Uint8Array.of(1), 1).error, 33);
  assert.equal(vfs.getOpenFile(append).pos, 0, 'failed append preserves position');
}
{
  const { vfs, a, b, lock } = fixture();
  assert.equal(lock(a, 0, 4), 0);
  assert.equal(vfs.duplicateFileHandle(a, 0, false, 3, false), -6);
  assert.equal(vfs.getOpenFile(a), null, 'failed cross-process close-source closes original');
  assert.equal(lock(b, 0, 4), 0, 'failed transfer releases the final owner lock');
}
{
  const { vfs, a, b, lock } = fixture();
  const retained = vfs.duplicateFileHandle(a, 0, false, 2);
  assert.equal(lock(a, 0, 4), 0);
  assert.equal(vfs.duplicateFileHandle(a, 0, false, 3, false), -6);
  assert.equal(vfs.getOpenFile(a), null);
  assert.equal(lock(b, 0, 4), 33, 'failed transfer must not release surviving duplicate locks');
  assert(vfs.closeHandle(retained));
  assert.equal(lock(b, 0, 4), 0);
}
{
  const { vfs, a, b, lock } = fixture();
  assert.equal(lock(a, 0, 4), 0);
  assert(vfs.moveFile(path, 'c:\\renamed.bin'));
  assert.equal(vfs.flushFileBuffers(a), 0, 'flush follows opened identity after rename');
  assert.equal(vfs.readFile(b, new Uint8Array(4), 4).error, 33);
  const fresh = vfs.createFile(path, 0xc0000000, 2);
  assert.equal(lock(fresh, 0, 4), 0, 'recreated pathname has distinct identity');
  const child = new VirtualFS();
  child.adoptFrom(vfs);
  assert.equal(child.getOpenFile(a), null, 'disk handles are not inherited');
  const childHandle = child.createFile('c:\\renamed.bin', 0xc0000000, 3);
  assert.equal(child.readFile(childHandle, new Uint8Array(4), 4).error, 33);
  vfs.closeAllDiskHandles();
  assert.equal(vfs.flushFileBuffers(a), 6, 'closed renamed handle cannot flush');
  assert.equal(child.readFile(childHandle, new Uint8Array(4), 4).bytesRead, 4);
  assert.equal(vfs.createFileResult(path, 0xc0000000, 3).error, 6, 'late worker cannot reopen');
  child.closeAllDiskHandles();
}
{
  const { vfs, a, b, lock } = fixture();
  const memory = new ArrayBuffer(256), view = new Uint8Array(memory);
  const host = createFilesystemImports({ vfs, getMemory: () => memory });
  view.fill(0xcc);
  assert.equal(lock(a, 8, 4), 0);
  assert.equal(host.fs_read_file_result(b, 64, 16, 32), 33);
  assert(view.subarray(64, 80).every(x => x === 0xcc));
  assert.equal(new DataView(memory).getUint32(32, true), 0);
  assert.equal(vfs.getOpenFile(b).pos, 0);
  assert.equal(host.fs_lock_file(a, 8, 0, 4, 0, 1), 0);
  assert.equal(host.fs_read_file_result(b, 64, 16, 32), 0);
  assert.deepEqual([...view.subarray(64, 80)], [...Array(16).keys()]);
}
{
  // Force four-byte scatter runs: a lock in the third run must reject the
  // entire request before the first two runs reach guest memory.
  const { vfs, a, b, lock } = fixture();
  const mu = require('../lib/mem-utils'), regions = require('../lib/region-map.generated');
  const originalSpan = mu.g2wSpan;
  const memory = new ArrayBuffer(0x40000), guest = 0x400040;
  const offset = regions.g2w(guest, 0x400000);
  new Uint8Array(memory, offset, 16).fill(0xcc);
  const host = createFilesystemImports({ vfs, getMemory: () => memory,
    exports: { get_image_base: () => 0x400000, guest_map_alloc: () => 0x410000 } });
  try {
    mu.g2wSpan = (_address, maximum) => Math.min(4, maximum);
    assert.equal(lock(a, 8, 4), 0);
    assert.equal(host.fs_read_file_result(b, guest, 16, 0), 33);
    assert(new Uint8Array(memory, offset, 16).every(x => x === 0xcc));
    assert.equal(vfs.getOpenFile(b).pos, 0);
    const section = host.fs_create_file_mapping(b, 2, 0, 0, 0);
    assert(section);
    const mapped = host.fs_map_view_of_file(section, 4, 0, 0, 16);
    assert(mapped, 'file mapping ignores byte locks');
    assert.deepEqual([...new Uint8Array(memory, regions.g2w(mapped, 0x400000), 16)],
      [...Array(16).keys()]);
    assert.equal(host.fs_unmap_view(mapped), 1);
    assert.equal(host.fs_close_handle(section), 1);
  } finally { mu.g2wSpan = originalSpan; }
}

(async () => {
  const { vfs, a, b, lock } = fixture();
  let reads = 0;
  // Install a provider before opening handles: existing opens retain identity.
  vfs.setProviderFile('c:\\lazy.bin', { provider: { size: 32,
    async readRange(offset, length) { reads++; return new Uint8Array(length).fill(7); } } });
  const x = vfs.createFile('c:\\lazy.bin', 0xc0000000, 3);
  const y = vfs.createFile('c:\\lazy.bin', 0xc0000000, 3);
  assert.equal(lock(x, 0, 8), 0);
  assert.equal(vfs.readFile(y, new Uint8Array(8), 8).error, 33);
  assert.equal(reads, 0);
  assert.equal(lock(x, 0, 8, true), 0);
  const memory = new ArrayBuffer(256);
  const host = createFilesystemImports({ vfs, getMemory: () => memory });
  assert.equal(host.fs_read_file_result(y, 64, 8, 32), 997);
  assert.equal(lock(x, 0, 8), 33, 'pending full request prevents conflicting lock');
  await vfs.fillPendingRead(vfs.getPendingRead());
  assert.equal(host.fs_read_file_result(y, 64, 8, 32), 0);
  assert.equal(lock(x, 0, 8), 0, 'read completion releases reservation');
  assert.equal(reads, 1);
  vfs.closeAllDiskHandles();
  console.log('file byte locks: PASS (range, ownership, lifecycle, host I/O, lazy reservation)');
})().catch(error => { console.error(error); process.exitCode = 1; });
