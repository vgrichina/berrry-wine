#!/usr/bin/env node
'use strict';

// The DirectX DLLs we dispatch statically must also exist as files in
// C:\WINDOWS\SYSTEM: installers look for the file before they read its
// version. NFS II's InstallShield script GetFileAttributes's SYSTEM\DDRAW.DLL
// and, when it was missing, reported "No versions of DirectX have been
// detected" and offered to install DirectX 3 over our DirectX 6.1a.
//
// Checks the shared boot helper mounts each one, that a version read through
// the file (GetFileVersionInfoW, which has no by-name answer) reports the same
// 4.6.3.518 as the by-name path, that a shipped file is kept, and that
// LoadLibrary is not offered the stub as a PE to map.

const assert = require('assert');
const boot = require('../lib/process-boot');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');

async function main() {
  const shippedVfs = { files: new Map() };
  const shipped = { data: new Uint8Array([1, 2, 3]), attrs: 0x20 };
  shippedVfs.files.set('c:\\windows\\system\\ddraw.dll', shipped);
  boot.mountSystemDataFiles(shippedVfs, []);
  assert.strictEqual(shippedVfs.files.get('c:\\windows\\system\\ddraw.dll'), shipped,
    'a file already at the path is not replaced');

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
    assert.strictEqual(imports.host.has_dll_file(wa(writeStr(full, false))), 0,
      `${file} is not offered to LoadLibrary as a PE`);
    // The CLI's LoadLibrary byte lookup must agree with the page: mapping the
    // stub zeroed every DDRAW import of NFS III's softtria.dll/d3da.dll.
    for (const name of [full, file, file.toLowerCase()]) {
      assert.strictEqual(boot.findVfsDllBytes(ctx.vfs, file.toLowerCase(), name), null,
        `${name} is not handed to the CLI loader as DLL bytes`);
    }

    const wide = writeStr(full, true);
    const size = e.test_call_GetFileVersionInfoSizeW(wide, 0) >>> 0;
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
    // The four by-name modules answer 4.6.3.518 (6.1a) either way; d3d8.dll is
    // the DirectX 8.1 runtime's 4.8.1.881, which GetDXVersion's 8.1 tier reads.
    // opengl32.dll is Win98 SE's 4.10.0.2222, not a DirectX version.
    const expected = file === 'D3D8.DLL' ? [0x00040008, 0x00010371]
      : file === 'OPENGL32.DLL' ? [0x0004000a, 0x000008ae] : [0x00040006, 0x00030206];
    assert.deepStrictEqual([dv.getUint32(fixed + 8, true), dv.getUint32(fixed + 12, true)],
      expected, `${file} file version`);
  }
  // A real DLL in the same lookup is still found.
  const realDll = { data: new Uint8Array([0x4d, 0x5a]), attrs: 0x20 };
  ctx.vfs.files.set('c:\\plugins\\real.dll', realDll);
  assert.strictEqual(boot.findVfsDllBytes(ctx.vfs, 'real.dll', 'real.dll'), realDll.data);
  console.log('PASS  DirectX system modules exist as versioned files in C:\\WINDOWS\\SYSTEM');
}

main().catch(err => { console.error(err); process.exit(1); });
