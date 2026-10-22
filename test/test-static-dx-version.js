#!/usr/bin/env node
// A static component's handle/path alone must not invent a file version:
// GetModuleHandle("dplayx") -> GetModuleFileName -> GetFileVersionInfoSize ->
// GetFileVersionInfo -> VerQueryValue("\") -> compare VS_FIXEDFILEINFO.
// A real installed file resource remains readable independently of capability.

const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
const { buildVersionBlob, buildVersionPe } = require('../tools/pe-version');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const STATIC_SYS_DLL_HANDLE_BASE = 0x5D110000;

async function main() {
  const wasmBytes = compileSrcWasm();
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const base = createHostImports(ctx);
  base.host.memory = memory;
  base.host.create_thread = () => 0;
  base.host.exit_thread = () => 0;
  base.host.terminate_thread = () => 0;
  base.host.create_event = () => 0;
  base.host.set_event = () => 0;
  base.host.reset_event = () => 0;
  base.host.wait_single = () => 0;
  base.host.wait_multiple = () => 0;
  base.host.com_create_instance = () => 0x80004002;

  const { instance } = await WebAssembly.instantiate(wasmBytes, base);
  const e = instance.exports;
  const u8 = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer);
  const wa = gp => gp - e.get_image_base() + e.get_guest_base();

  let pass = 0, fail = 0;
  function check(name, ok, detail = '') {
    if (ok) { pass++; console.log('PASS  ' + name); }
    else { fail++; console.log('FAIL  ' + name + (detail ? '  ' + detail : '')); }
  }

  function writeAscii(s) {
    const g = e.guest_alloc(s.length + 1);
    const p = wa(g);
    for (let i = 0; i < s.length; i++) u8[p + i] = s.charCodeAt(i) & 0xFF;
    u8[p + s.length] = 0;
    return g;
  }

  function readAscii(gp) {
    let p = wa(gp), out = '';
    while (u8[p]) out += String.fromCharCode(u8[p++]);
    return out;
  }

  const hDPlay = e.test_call_GetModuleHandleA(writeAscii('dplayx')) >>> 0;
  check('GetModuleHandleA answers for a statically dispatched DirectX module',
    hDPlay !== 0 && hDPlay !== (e.get_image_base() >>> 0), '=0x' + hDPlay.toString(16));
  check('each static module gets its own handle',
    (e.test_call_GetModuleHandleA(writeAscii('ddraw.dll')) >>> 0) !== hDPlay);

  const buf = e.guest_alloc(260);
  const len = e.test_call_GetModuleFileNameA(hDPlay, buf, 260) >>> 0;
  const filename = readAscii(buf);
  check('GetModuleFileNameA names the module, not the EXE',
    filename.toLowerCase() === 'c:\\windows\\system\\dplayx.dll', filename);
  check('GetModuleFileNameA returns the character count', len === filename.length,
    `${len} vs ${filename.length}`);

  check('static handle/path without a file has no version',
    e.test_call_GetFileVersionInfoSizeA(buf, 0) === 0);
  const actual = buildVersionBlob([0xFEEF04BD, 0x10000, 0x00050006, 0x00070008]);
  ctx.vfs.files.set(filename.toLowerCase(), {data: buildVersionPe(actual), attrs: 0x20});
  const size = e.test_call_GetFileVersionInfoSizeA(buf, 0) >>> 0;
  check('the installed named file supplies its resource size', size === actual.length, String(size));

  const block = e.guest_alloc(size + 16);
  check('GetFileVersionInfoA fills the block',
    (e.test_call_GetFileVersionInfoA(buf, 0, size, block) >>> 0) === 1);

  const outPtr = e.guest_alloc(4);
  const outLen = e.guest_alloc(4);
  const ok = e.test_call_VerQueryValueA(block, writeAscii('\\'), outPtr, outLen) >>> 0;
  check('VerQueryValueA("\\") accepts the block', ok === 1);

  const ffi = dv.getUint32(wa(outPtr), true);
  check('VerQueryValueA reports sizeof(VS_FIXEDFILEINFO)',
    dv.getUint32(wa(outLen), true) === 52);
  check('the block carries the VS_FIXEDFILEINFO signature',
    dv.getUint32(wa(ffi), true) === 0xFEEF04BD >>> 0,
    '0x' + (dv.getUint32(wa(ffi), true) >>> 0).toString(16));

  const ms = dv.getUint32(wa(ffi) + 8, true) >>> 0;
  const ls = dv.getUint32(wa(ffi) + 12, true) >>> 0;
  const version = [ms >>> 16, ms & 0xFFFF, ls >>> 16, ls & 0xFFFF];
  check('the reported version is exactly the file resource, with no minimum policy',
    version.join('.') === '5.6.7.8',
    version.join('.'));

  // An absent unrelated named file also has no version resource.
  check('a non-DirectX filename does not get the DirectX block',
    (e.test_call_GetFileVersionInfoSizeA(writeAscii('C:\\SOMEAPP.EXE'), 0) >>> 0) !== size ||
    size === 0);

  console.log(`--- static-dx-version: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
