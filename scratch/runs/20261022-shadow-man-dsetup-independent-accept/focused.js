'use strict';
const assert = require('assert');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const boot = require(root + '/lib/process-boot');
const storage = require(root + '/lib/storage');
const {buildVersionBlob, buildVersionPe, findVersionBlob} = require(root + '/tools/pe-version');
const fixture = require(root + '/test/version-source-fixture');

async function main() {
  const blob = buildVersionBlob([0xFEEF04BD, 0x10000, 0x00040006, 0x00030206]);
  const pe = buildVersionPe(blob); // Same numbers as old fabrication: provenance cannot be guessed.
  for (const file of boot.DIRECTX_SYSTEM_MODULE_FILES.filter(n => n !== 'OPENGL32.DLL')) {
    const key = 'c:\\windows\\system\\' + file.toLowerCase();
    const supplied = {data: pe, attrs: 1, custom: 'supplied'};
    const vfs = {files: new Map([[key, supplied]])};
    boot.mountDirectXSystemModules(vfs);
    assert.strictEqual(vfs.files.get(key), supplied, file + ': unmarked supplied file preserved');
    assert.deepStrictEqual(findVersionBlob(Buffer.from(supplied.data)), blob);
    const synthetic = {...supplied, staticModule: true};
    vfs.files.set(key, synthetic);
    boot.mountDirectXSystemModules(vfs);
    const refreshed = vfs.files.get(key);
    assert.notStrictEqual(refreshed, synthetic);
    assert.strictEqual(findVersionBlob(Buffer.from(refreshed.data)), null);
    assert.strictEqual(boot.findVfsDllBytes(vfs, file, key), null);
    assert.strictEqual(boot.mountDirectXSystemModules(vfs), 0);
  }
  storage.clearStore();
  storage.setRegValue('HKLM\\SOFTWARE\\Microsoft\\DirectX', 'Version', 1, '4.07.00.0700');
  storage.setRegValue('HKLM\\SOFTWARE\\Microsoft\\DirectX', 'InstalledVersion', 3,
    [0, 0, 0, 4, 7, 0, 0, 0]);
  const snapshot = storage.exportStore();
  storage.clearStore(); storage.importStore(snapshot);
  assert.deepStrictEqual(storage.exportStore(), snapshot, 'historical numeric equality must not trigger purge');

  const memory = new WebAssembly.Memory({initial: 256, maximum: 8192, shared: true});
  const ctx = {getMemory: () => memory.buffer, resourceJson: {}, renderer: null};
  const imports = fixture.createHostImports(ctx); imports.host.memory = memory;
  const {instance} = await WebAssembly.instantiate(fixture.compileSrcWasm(), imports);
  const e = instance.exports; ctx.exports = e;
  const bytes = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const wa = p => p - e.get_image_base() + e.get_guest_base();
  const filename = 'C:\\Windows\\System\\DDRAW.DLL';
  ctx.vfs.files.set(filename.toLowerCase(), {data: pe, attrs: 0x20});
  for (const wide of [false, true]) {
    const suffix = wide ? 'W' : 'A';
    const text = Buffer.from(filename + '\0', wide ? 'utf16le' : 'latin1');
    const name = e.guest_alloc(text.length); bytes.set(text, wa(name));
    const handle = e.guest_alloc(8); bytes.fill(0xa5, wa(handle), wa(handle) + 8);
    assert.strictEqual(e['test_call_GetFileVersionInfoSize' + suffix](name, handle), blob.length);
    assert.strictEqual(e.get_esp(), 0xb0000c);
    assert.strictEqual(dv.getUint32(wa(handle), true), 0);
    assert.strictEqual(dv.getUint32(wa(handle) + 4, true), 0xa5a5a5a5);
    for (const capacity of [0, 1, blob.length - 1, blob.length, blob.length + 7]) {
      const out = e.guest_alloc(blob.length + 16); bytes.fill(0xa5, wa(out), wa(out) + blob.length + 16);
      assert.strictEqual(e['test_call_GetFileVersionInfo' + suffix](name, 123, capacity, out), 1);
      assert.strictEqual(e.get_esp(), 0xb00014);
      const copied = Math.min(capacity, blob.length);
      assert.deepStrictEqual(Buffer.from(bytes.subarray(wa(out), wa(out) + copied)), blob.subarray(0, copied));
      assert(bytes.subarray(wa(out) + copied, wa(out) + blob.length + 16).every(v => v === 0xa5));
    }
    ctx.vfs.files.delete(filename.toLowerCase());
    dv.setUint32(wa(handle), 0xdeadbeef, true);
    assert.strictEqual(e['test_call_GetFileVersionInfoSize' + suffix](name, handle), 0);
    assert.strictEqual(dv.getUint32(wa(handle), true), 0);
    const out = e.guest_alloc(96); bytes.fill(0xa5, wa(out), wa(out) + 96);
    assert.strictEqual(e['test_call_GetFileVersionInfo' + suffix](name, 0, 92, out), 0);
    assert.strictEqual(e.get_esp(), 0xb00014);
    assert(bytes.subarray(wa(out), wa(out) + 96).every(v => v === 0xa5));
    ctx.vfs.files.set(filename.toLowerCase(), {data: pe, attrs: 0x20});
  }
  console.log('PASS five staticModule refreshes; five supplied same-number resources preserved; exact old-number registry roundtrip; A/W 0/1/short/exact/oversized copies, DWORD canaries, missing-file controls and stdcall cleanup. Existing zero-capacity success semantics preserved; no native x86.');
}
main().catch(e => {console.error(e); process.exitCode = 1;});
