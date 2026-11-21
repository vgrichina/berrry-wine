'use strict';

// Resident guest I/O and asynchronous durable checkpoints are distinct. A
// checkpoint queued behind a failed publication must not erase its failure.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { bootRenderHarness } = require('./render-helper');
const { VirtualFS } = require('../lib/filesystem');
const { nodeDirStore } = require('../lib/overlay-store');
const { attach } = require('../lib/vfs-overlay');

const extraWat = `
  (func (export "failure_map") (param $p i32) (result i32)
    (call $virtual_map_commit (local.get $p) (i32.const 4096)))
  (func $failure_result (result i64)
    (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (global.get $last_error)) (i64.const 32))))
  (func (export "failure_write") (param $h i32) (param $p i32) (param $out i32) (result i64)
    (global.set $last_error (i32.const 4660))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
    (call $handle_WriteFile (local.get $h) (local.get $p) (i32.const 3)
      (local.get $out) (i32.const 0) (i32.const 0))
    (call $failure_result))
  ${['FlushFileBuffers', 'CloseHandle'].map(api => `
  (func (export "failure_${api}") (param $h i32) (result i64)
    (global.set $last_error (i32.const 4660))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
    (call $handle_${api} (local.get $h) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $failure_result))`).join('')}
`;
const success = (1n | (4660n << 32n));

async function main() {
  const { exports: guest, hostCtx } = await bootRenderHarness({ fonts: 'none', extraWat });
  const vfs = hostCtx.vfs, p = 0x30000000;
  assert.equal(guest.failure_map(p) >>> 0, p);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfs-failure-'));
  const store = nodeDirStore(dir);
  let rejectFirst, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  let first = true;
  const overlay = attach(vfs, { store: { ...store, writeBatch(records) {
    if (!first) return store.writeBatch(records);
    first = false;
    entered();
    return new Promise((resolve, reject) => { rejectFirst = reject; });
  } } });
  function write(name, bytes) {
    const h = vfs.createFile(name, 0xc0000000, 2);
    assert.ok(h);
    bytes.forEach((b, i) => guest.guest_write8(p + i, b));
    assert.equal(guest.failure_write(h, p, p + 16), success);
    assert.equal(guest.guest_read8(p + 16), 3);
    assert.equal(guest.get_esp() >>> 0, 0x300018);
    assert.equal(guest.failure_FlushFileBuffers(h), success);
    assert.equal(guest.get_esp() >>> 0, 0x300008);
    assert.equal(guest.failure_CloseHandle(h), success);
    assert.equal(guest.failure_FlushFileBuffers(h), 6n << 32n);
    return h;
  }
  try {
    write('C:\\save.dat', [1, 2, 3]);
    const readOnly = vfs.createFile('C:\\save.dat', 0x80000000, 3);
    assert.equal(guest.failure_FlushFileBuffers(readOnly), 5n << 32n);
    assert.equal(guest.failure_CloseHandle(readOnly), success);
    const failing = overlay.flush();
    await ready;
    const empty = overlay.flush();
    // A successful different path must not hide the unresolved save failure.
    write('C:\\other.dat', [4, 5, 6]);
    const unrelated = overlay.flush();
    const emptyAfterOther = overlay.flush();
    rejectFirst(Object.assign(new Error('controlled ENOSPC'), { code: 'ENOSPC' }));
    assert.equal((await failing).failed, 1);
    assert.deepEqual([...vfs.files.get('c:\\save.dat').data], [1, 2, 3]);
    assert.equal(await store.read('c:\\save.dat'), null);
    const resident = vfs.createFile('C:\\save.dat', 0xc0000000, 3);
    assert.equal(guest.failure_FlushFileBuffers(resident), success,
      'guest resident flush does not become an async overlay checkpoint');
    assert.equal(guest.failure_CloseHandle(resident), success);
    assert.equal((await empty).failed, 1, 'queued empty checkpoint must retain failed publication');
    const otherReport = await unrelated;
    assert.equal(otherReport.written, 1);
    assert.equal(otherReport.failed, 1, 'unrelated success cannot acknowledge a failed save');
    assert.equal((await emptyAfterOther).failed, 1);
    assert.deepEqual([...await store.read('c:\\other.dat')], [4, 5, 6]);
    assert.deepEqual(overlay.dirtyPaths(), ['c:\\save.dat']);
    write('C:\\save.dat', [7, 8, 9]);
    const retry = overlay.flush(), queuedSuccess = overlay.flush();
    assert.equal((await retry).failed, 0);
    assert.equal((await queuedSuccess).failed, 0);
    assert.deepEqual(overlay.dirtyPaths(), []);
    const reload = new VirtualFS(), replay = attach(reload, { store: nodeDirStore(dir) });
    assert.equal((await replay.hydrate()).files, 2);
    assert.deepEqual([...reload.files.get('c:\\save.dat').data], [7, 8, 9]);
    assert.match(overlay.errors[0].message, /ENOSPC/);
    await replay.detach();
    console.log('PASS real compiled guest WriteFile/FlushFileBuffers/CloseHandle, controlled ENOSPC, queued empty/unrelated failure, latest-write retry and disk reload');
  } finally {
    await overlay.detach();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // One unreadable snapshot must not prevent another path being published,
  // nor let a later successful batch claim that all failures were recovered.
  const partialDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfs-partial-'));
  const partialVfs = new VirtualFS(), partialStore = nodeDirStore(partialDir);
  const partial = attach(partialVfs, { store: partialStore });
  const put = (name, value) => {
    const h = partialVfs.createFile(name, 0x40000000, 2);
    assert.equal(partialVfs.writeFile(h, Uint8Array.of(value), 1).ok, true);
    partialVfs.closeHandle(h);
  };
  try {
    put('C:\\bad.dat', 1); put('C:\\good.dat', 2);
    // Controlled read failure at the production recordFor boundary.
    const entry = partialVfs.files.get('c:\\bad.dat');
    Object.defineProperty(entry, 'data', { configurable: true, get() { throw new Error('controlled snapshot failure'); } });
    const a = partial.flush();
    put('C:\\third.dat', 3);
    const b = partial.flush();
    assert.equal((await a).failed, 1);
    assert.equal((await b).failed, 1);
    assert.deepEqual([...await partialStore.read('c:\\good.dat')], [2]);
    assert.deepEqual([...await partialStore.read('c:\\third.dat')], [3]);
    Object.defineProperty(entry, 'data', { configurable: true, writable: true, value: Uint8Array.of(9) });
    assert.equal((await partial.flush()).failed, 0);
    assert.deepEqual([...await partialStore.read('c:\\bad.dat')], [9]);
    assert.equal((await partial.flush()).failed, 0);
    console.log('PASS partial snapshot failure, successful siblings, recovery and clean checkpoint');
  } finally {
    await partial.detach();
    fs.rmSync(partialDir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
