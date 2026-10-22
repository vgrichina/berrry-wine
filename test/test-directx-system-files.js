#!/usr/bin/env node
'use strict';

// The DirectX DLLs we dispatch statically must also exist as files in
// C:\WINDOWS\SYSTEM: installers look for the file before they read its
// version. File presence keeps those lookups working; it supplies no version
// provenance and must not satisfy an installer's version requirement alone.
//
// Checks the shared boot helper mounts each one, that a version read through
// the file reports no invented DirectX version, that a shipped file is kept, and that
// LoadLibrary is not offered the stub as a PE to map.

const assert = require('assert');
const boot = require('../lib/process-boot');
const { buildVersionBlob, buildVersionPe } = require('../tools/pe-version');
const fixture = process.argv.includes('--source-fixture');
const { createHostImports } = require(fixture ? './version-source-fixture' : '../lib/host-imports');
const { compileSrcWasm } = require(fixture ? './version-source-fixture' : './compile-src');

async function main() {
  const shippedVfs = { files: new Map() };
  const shipped = { data: new Uint8Array([1, 2, 3]), attrs: 0x20 };
  shippedVfs.files.set('c:\\windows\\system\\ddraw.dll', shipped);
  boot.mountSystemDataFiles(shippedVfs, []);
  assert.strictEqual(shippedVfs.files.get('c:\\windows\\system\\ddraw.dll'), shipped,
    'a file already at the path is not replaced');
  const oldPlaceholder = {data: buildVersionPe(buildVersionBlob([
    0xFEEF04BD, 0x10000, 0x00040006, 0x00030206])), attrs: 0x20, staticModule: true};
  const retained = {files: new Map([['c:\\windows\\system\\ddraw.dll', oldPlaceholder]])};
  boot.mountDirectXSystemModules(retained);
  assert.notStrictEqual(retained.files.get('c:\\windows\\system\\ddraw.dll'), oldPlaceholder,
    'known synthetic snapshot placeholder is refreshed');
  assert.strictEqual(boot.mountDirectXSystemModules(retained), 0, 'mount remains idempotent');

  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  imports.host.create_thread = () => 0;
  imports.host.exit_thread = () => 0;
  imports.host.terminate_thread = () => 0;
  imports.host.create_event = () => 0;
  imports.host.set_event = () => 0;
  imports.host.reset_event = () => 0;
  imports.host.wait_single = () => 0;
  imports.host.wait_multiple = () => 0;
  imports.host.com_create_instance = () => 0x80004002;
  boot.mountSystemDataFiles(ctx.vfs, []);

  const { instance } = await WebAssembly.instantiate(compileSrcWasm(), imports);
  const e = instance.exports;
  ctx.exports = e;
  const u8 = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer);
  const wa = gp => gp - e.get_image_base() + e.get_guest_base();
  const writeStr = (s, wide) => {
    const step = wide ? 2 : 1;
    const g = e.guest_alloc((s.length + 1) * step);
    for (let i = 0; i <= s.length; i++) {
      const ch = i < s.length ? s.charCodeAt(i) : 0;
      if (wide) dv.setUint16(wa(g) + i * 2, ch, true); else u8[wa(g) + i] = ch;
    }
    return g;
  };

  for (const file of boot.DIRECTX_SYSTEM_MODULE_FILES) {
    const full = 'C:\\WINDOWS\\SYSTEM\\' + file;
    assert.strictEqual(ctx.vfs.getFileAttributes(full), 0x20, `${file} exists`);
    if (!fixture) assert.strictEqual(imports.host.has_dll_file(wa(writeStr(full, false))), 0,
      `${file} is not offered to LoadLibrary as a PE`);
    // The CLI's LoadLibrary byte lookup must agree with the page: mapping the
    // stub zeroed every DDRAW import of NFS III's softtria.dll/d3da.dll.
    for (const name of [full, file, file.toLowerCase()]) {
      assert.strictEqual(boot.findVfsDllBytes(ctx.vfs, file.toLowerCase(), name), null,
        `${name} is not handed to the CLI loader as DLL bytes`);
    }

    const wide = writeStr(full, true);
    const size = e.test_call_GetFileVersionInfoSizeW(wide, 0) >>> 0;
    if (file !== 'OPENGL32.DLL') {
      assert.strictEqual(size, 0, `${file} has no invented version resource`);
      const handleOut = e.guest_alloc(4);
      dv.setUint32(wa(handleOut), 0xdeadbeef, true);
      const ansi = writeStr(full, false);
      assert.strictEqual(e.test_call_GetFileVersionInfoSizeA(ansi, handleOut), 0);
      if (fixture) assert.strictEqual(e.get_esp(), 0x00b0000c, 'ret + two arguments');
      assert.strictEqual(dv.getUint32(wa(handleOut), true), 0, 'DWORD handle output cleared');
      const output = e.guest_alloc(96);
      u8.fill(0xa5, wa(output), wa(output) + 96);
      assert.strictEqual(e.test_call_GetFileVersionInfoA(ansi, 0, 92, output), 0);
      if (fixture) assert.strictEqual(e.get_esp(), 0x00b00014, 'ret + four arguments');
      assert.strictEqual(e.test_call_GetFileVersionInfoW(wide, 0, 92, output), 0);
      assert(u8.subarray(wa(output), wa(output) + 96).every(v => v === 0xa5), 'no data fabricated on failure');
      continue;
    }
    assert(size >= 92, `${file} has a version resource (${size})`);
    const block = e.guest_alloc(size);
    assert.strictEqual(e.test_call_GetFileVersionInfoW(wide, 0, size, block), 1,
      `${file} version resource reads`);
    const outPtr = e.guest_alloc(4);
    const outLen = e.guest_alloc(4);
    assert.strictEqual(e.test_call_VerQueryValueA(block, writeStr('\\', false), outPtr, outLen), 1,
      `${file} root query`);
    const fixed = wa(dv.getUint32(wa(outPtr), true));
    assert.strictEqual(dv.getUint32(fixed, true), 0xFEEF04BD, `${file} signature`);
    // Preserve unrelated OpenGL placeholder behavior in this narrow repair.
    const expected = [0x0004000a, 0x000008ae];
    assert.deepStrictEqual([dv.getUint32(fixed + 8, true), dv.getUint32(fixed + 12, true)],
      expected, `${file} file version`);
  }
  // A real DLL in the same lookup is still found.
  const realDll = { data: new Uint8Array([0x4d, 0x5a]), attrs: 0x20 };
  ctx.vfs.files.set('c:\\plugins\\real.dll', realDll);
  assert.strictEqual(boot.findVfsDllBytes(ctx.vfs, 'real.dll', 'real.dll'), realDll.data);
  console.log('PASS  DirectX file presence preserves static loading without invented versions');
}

main().catch(err => { console.error(err); process.exit(1); });
