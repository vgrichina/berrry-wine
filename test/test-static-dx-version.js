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
  const wasmPath = process.env.WA_TEST_WASM;
  const wasmBytes = wasmPath ? fs.readFileSync(wasmPath) : compileSrcWasm();
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
  // Filesystem imports translate guest buffers through the instance exports.
  ctx.exports = e;
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

  // VERSION chooses a file first, then reads that file's resource. A nearer
  // file without RT_VERSION must not expose a later file's version instead.
  const put = (name, version) => ctx.vfs.files.set(name.toLowerCase(), {
    data: version === null ? Buffer.from('no version resource') :
      buildVersionPe(buildVersionBlob([0xFEEF04BD, 0x10000, version, 0])), attrs: 0x20,
  });
  const searchName = 'version-search.dll';
  const dirs = ['D:\\Program Files\\Version', 'C:\\work',
    'C:\\WINDOWS\\SYSTEM', 'C:\\WINDOWS', 'C:\\WINDOWS\\COMMAND'];
  const imageName = 'Program Files\\Version\\probe.exe';
  u8.set(Buffer.from(imageName), e.get_staging());
  e.set_exe_name(e.get_staging(), imageName.length);
  e.set_exe_drive(68);
  ctx.vfs.dirs.add('c:\\work');
  check('VERSION fixture uses a distinct existing current directory', ctx.vfs.setCurrentDirectory('C:\\work'));
  const writeName = (name, wide) => {
    if (!wide) return writeAscii(name);
    const g = e.guest_alloc((name.length + 1) * 2);
    for (let i = 0; i <= name.length; i++) dv.setUint16(wa(g) + i * 2, name.charCodeAt(i) || 0, true);
    return g;
  };
  function readVersion(name, wide) {
    const ptr = writeName(name, wide), suffix = wide ? 'W' : 'A';
    const size = e['test_call_GetFileVersionInfoSize' + suffix](ptr, 0) >>> 0;
    const block = e.guest_alloc(Math.max(size, 92));
    u8.fill(0xa5, wa(block), wa(block) + Math.max(size, 92));
    const filled = e['test_call_GetFileVersionInfo' + suffix](ptr, 0, Math.max(size, 92), block);
    if (!size) {
      check(`${suffix} missing resource fails without fabricating output: ${name}`,
        filled === 0 && u8.subarray(wa(block), wa(block) + Math.max(size, 92)).every(v => v === 0xa5));
      return 0;
    }
    const found = e.test_call_VerQueryValueA(block, writeAscii('\\'), outPtr, outLen);
    check(`${suffix} chosen file version root reads: ${name}`, filled === 1 && found === 1);
    return dv.getUint32(wa(dv.getUint32(wa(outPtr), true)) + 8, true);
  }
  for (let i = 0; i < dirs.length; i++) put(dirs[i] + '\\' + searchName, 0x00040010 + i);
  for (let i = 0; i < dirs.length; i++) {
    for (const wide of [false, true]) check(`VERSION ${wide ? 'W' : 'A'} directory precedence ${i}`,
      readVersion(searchName, wide) === 0x00040010 + i);
    ctx.vfs.files.delete((dirs[i] + '\\' + searchName).toLowerCase());
  }
  put(dirs[2] + '\\' + searchName, 0x00040025);
  put(dirs[0] + '\\' + searchName, null);
  put(dirs[2] + '\\version-explicit.dll', 0x00040029);
  for (const wide of [false, true]) {
    check('nearer unversioned file shadows versioned system file', readVersion(searchName, wide) === 0);
    check('absolute VERSION path bypasses nearer unversioned file',
      readVersion(dirs[2] + '\\' + searchName, wide) === 0x00040025);
    check('missing explicit path does not fall back to system basename',
      readVersion('C:\\absent\\version-explicit.dll', wide) === 0);
    check('rooted path is not redirected to a system basename',
      readVersion('\\absent\\version-explicit.dll', wide) === 0);
    check('missing bare name fails without invented version', readVersion('version-missing.dll', wide) === 0);
    put(dirs[0] + '\\sub\\' + searchName, 0x00040026);
    check('relative subdirectory uses application directory', readVersion('sub\\' + searchName, wide) === 0x00040026);
  }
  put(dirs[2] + '\\version-\u03bb.dll', 0x00040027);
  check('wide VERSION search preserves Unicode filename', readVersion('version-\u03bb.dll', true) === 0x00040027);
  put(dirs[2] + '\\version-\u00e9.dll', 0x00040028);
  check('ANSI VERSION search preserves CP1252 filename', readVersion('version-\u00e9.dll', false) === 0x00040028);
  // Optional retained original input, never a synthetic replacement. The pin
  // is the DX7a member recorded by the real installer checkpoint. Metadata
  // reads below do not execute or load the native file.
  if (process.env.WA_TEST_DDRAW_GZIP) {
    const bytes = require('zlib').gunzipSync(fs.readFileSync(process.env.WA_TEST_DDRAW_GZIP));
    const hash = require('crypto').createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== 352528 || hash !== '0a37a508dc6703f0998fb41d8fd5b03d7bbb5d466165dce5b45559d85174ca26')
      throw new Error('authentic DDRAW input differs from recorded original');
    ctx.vfs.files.set('c:\\windows\\system\\ddraw.dll', {data:bytes, attrs:0x20});
    for (const wide of [false, true]) {
      const actualMs = readVersion('ddraw.dll', wide);
      check('authentic installed-target DDRAW basename supplies exact 4.7 file MS',
        actualMs === 0x00040007);
      check('authentic DDRAW resource supplies exact 0.700 file LS',
        actualMs === 0x00040007 && dv.getUint32(wa(dv.getUint32(wa(outPtr), true)) + 12, true) === 0x000002bc);
      check('authentic explicit DDRAW path supplies identical metadata',
        readVersion('C:\\WINDOWS\\SYSTEM\\ddraw.dll', wide) === 0x00040007);
    }
    check('authentic DDRAW bytes remain unchanged',
      require('crypto').createHash('sha256').update(bytes).digest('hex') === hash);
  }

  console.log(`--- static-dx-version: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
