'use strict';
// Generate ordinary PE parent/child and DLL + NE inputs without compiling or
// instantiating wasm. Run the generated CLI recipe only after runtime release.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const { neLifecycleImage } = require('./helpers/ne-lifecycle-image');
const raw = rva => rva - 0x1000 + 0x200;
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];

function image(names, dll = false) {
  const b = makeFixture();
  if (dll) b.writeUInt16LE(0x210e, 0x80 + 22);
  b.fill(0, raw(0x1900), raw(0x1c00));
  let at = 0x1a00;
  names.forEach((name, i) => {
    b.writeUInt32LE(at, raw(0x1900 + 4 * i));
    b.write(name + '\0', raw(at + 2)); at += name.length + 3;
  });
  return b;
}

function launcher(name, { overwrite = false } = {}) {
  const b = image(['CreateProcessA', 'WaitForSingleObject', 'GetExitCodeProcess', 'ExitProcess',
    'CreateFileA', 'WriteFile', 'CloseHandle']);
  b.write(name + '\0', raw(0x2500));
  b.writeUInt32LE(68, raw(0x2600));
  const code = [], emit = (...bytes) => code.push(...bytes);
  const push = n => emit(0x68, ...u32(n));
  const call = i => emit(0xff, 0x15, ...u32(0x401900 + i * 4));
  if (overwrite) {
    b.write('c:\\windows\\system\\bootstrap.dat\0', raw(0x2700));
    b.write('BAD!', raw(0x2780));
    for (const arg of [0, 0, 2, 0, 1, 0x40000000, 0x402700]) push(arg);
    call(4); emit(0x89, 0xc6);
    for (const arg of [0, 0x402790, 4, 0x402780]) push(arg);
    emit(0x56); call(5); emit(0x56); call(6);
  }
  // Real STARTUPINFO/PROCESS_INFORMATION, no host shortcut to launching child.
  for (const arg of [0x402680, 0x402600, 0, 0, 0, 0, 0, 0, 0, 0x402500]) push(arg);
  call(0); emit(0x85, 0xc0, 0x75, 12); push(71); call(3); emit(0xcc);
  push(0xffffffff); emit(0xff, 0x35, ...u32(0x402680)); call(1);
  push(0x4026c0); emit(0xff, 0x35, ...u32(0x402680)); call(2);
  emit(0xff, 0x35, ...u32(0x4026c0)); call(3); emit(0xcc);
  assert(code.length < 0x500); b.set(code, raw(0x2000));
  return b;
}

function child() {
  const b = image(['LoadLibraryA', 'ExitProcess']);
  b.write('bootstrap.dll\0', raw(0x2500));
  b.set([0x68, ...u32(0x402500), 0xff, 0x15, ...u32(0x401900),
    0x85, 0xc0, 0x0f, 0x94, 0xc0, 0x0f, 0xb6, 0xc0, 0x50,
    0xff, 0x15, ...u32(0x401904), 0xcc], raw(0x2000));
  return b;
}

function fileDll() {
  const b = image(['CreateFileA', 'ReadFile', 'CloseHandle'], true);
  b.write('c:\\windows\\system\\bootstrap.dat\0', raw(0x2500));
  const code = [0x53, 0x56, 0x8b, 0x5c, 0x24, 12];
  for (const arg of [0, 0, 3, 0, 1, 0x80000000]) code.push(0x68, ...u32(arg));
  code.push(0x8d, 0x83, ...u32(0x2500), 0x50, 0xff, 0x93, ...u32(0x1900),
    0x89, 0xc6, 0x83, 0xf8, 0xff, 0x74, 0);
  const failureJump = code.length - 1;
  code.push(0x6a, 0, 0x8d, 0x83, ...u32(0x2604), 0x50, 0x6a, 4,
    0x8d, 0x83, ...u32(0x2600), 0x50, 0x56, 0xff, 0x93, ...u32(0x1904),
    0x81, 0xbb, ...u32(0x2600), ...u32(0x314c534c),
    0x0f, 0x94, 0xc0, 0x0f, 0xb6, 0xc0, 0x50, 0x56,
    0xff, 0x93, ...u32(0x1908), 0x58, 0x5e, 0x5b, 0xc2, 12, 0);
  const failure = code.length;
  code.push(0x31, 0xc0, 0x5e, 0x5b, 0xc2, 12, 0);
  code[failureJump] = failure - failureJump - 1;
  b.set(code, raw(0x2000)); return b;
}

function neDll() {
  const b = image(['GetModuleHandleA'], true);
  b.write('kernel32.dll\0', raw(0x2500));
  b.write('c:\\windows\\system\\BOOTNE.DLL\0', raw(0x2540));
  const code = [0x53, 0x56, 0x8b, 0x5c, 0x24, 12,
    0x8d, 0x83, ...u32(0x2500), 0x50, 0xff, 0x93, ...u32(0x1900),
    // Walk genuine guest KERNEL32 EAT to ordinal 35 (Win16 LoadLibrary).
    0x89, 0xc6, 0x8b, 0x56, 0x3c, 0x01, 0xf2, 0x8b, 0x52, 0x78, 0x01, 0xf2,
    0x8b, 0x4a, 0x10, 0x8b, 0x52, 0x1c, 0x01, 0xf2, 0xb8, ...u32(35),
    0x29, 0xc8, 0x8b, 0x04, 0x82, 0x01, 0xf0,
    0x8d, 0x93, ...u32(0x2540), 0x52, 0xff, 0xd0,
    0x83, 0xf8, 32, 0x0f, 0x93, 0xc0, 0x0f, 0xb6, 0xc0,
    0x5e, 0x5b, 0xc2, 12, 0];
  b.set(code, raw(0x2000)); return b;
}

function untitledModal() {
  const b = image(['ExitProcess']);
  // Second ordinary import descriptor: USER32, no host-created windows.
  for (const [rva, value] of [[0x1814, 0x1940], [0x1820, 0x18a0], [0x1824, 0x1940]])
    b.writeUInt32LE(value, raw(rva));
  b.writeUInt32LE(60, 0x80 + 24 + 108);
  b.write('user32.dll\0', raw(0x18a0));
  let at = 0x1b00;
  for (const [i, name] of ['RegisterClassA', 'DefWindowProcA', 'CreateWindowExA', 'MessageBoxA'].entries()) {
    b.writeUInt32LE(at, raw(0x1940 + 4 * i)); b.write(name + '\0', raw(at + 2)); at += name.length + 3;
  }
  b.write('SimsUntitledFixture\0', raw(0x2500));
  b.write('InstallShield\0', raw(0x2540));
  b.write('Generated owned progress modal. Cancel exits this fixture.\0', raw(0x2580));
  b.writeUInt32LE(0x400000, raw(0x2610));
  b.writeUInt32LE(6, raw(0x261c));
  b.writeUInt32LE(0x402500, raw(0x2624));
  const code = [0xa1, ...u32(0x401944), 0xa3, ...u32(0x402604)];
  const emit = (...bytes) => code.push(...bytes), push = n => emit(0x68, ...u32(n));
  const call = i => emit(0xff, 0x15, ...u32(0x401940 + i * 4));
  push(0x402600); call(0);
  for (const arg of [0, 0x400000, 0, 0, 360, 640, 100, 80, 0x90000000, 0x402570, 0x402500, 0]) push(arg);
  call(2); emit(0x89, 0xc6);
  push(1); push(0x402540); push(0x402580); emit(0x56); call(3);
  emit(0x83, 0xf8, 2, 0x0f, 0x95, 0xc0, 0x0f, 0xb6, 0xc0, 0x50,
    0xff, 0x15, ...u32(0x401900), 0xcc);
  b.set(code, raw(0x2000)); return b;
}

function generate(directory, { mode = 'file', wrong = false, nested = false, overwrite = false } = {}) {
  assert(['file', 'ne'].includes(mode));
  const out = path.resolve(directory); fs.mkdirSync(out, { recursive: true });
  const put = (name, bytes) => fs.writeFileSync(path.join(out, name), bytes, { flag: 'wx' });
  put('parent.exe', launcher(nested ? 'c:\\middle.exe' : 'c:\\child.exe', { overwrite }));
  if (nested) put('middle.exe', launcher('c:\\child.exe'));
  put('child.exe', child()); put('bootstrap.dll', mode === 'ne' ? neDll() : fileDll());
  put('explicit-input.dat', mode === 'ne' ? neLifecycleImage({ result: wrong ? 0 : 1 }) : Buffer.from(wrong ? 'BAD!' : 'LSL1'));
  const guest = 'C:\\Windows\\System\\' + (mode === 'ne' ? 'BOOTNE.DLL' : 'bootstrap.dat');
  const cli = ['test/run.js', '--exe=' + path.join(out, 'parent.exe'), '--no-build', '--spawn-processes',
    '--vfs-include=*.exe', '--vfs-include=*.dll', '--dll-seed=' + path.join(out, 'bootstrap.dll'),
    '--cwd=C:\\', '--real-ticks', '--max-seconds=20', '--max-batches=100000000', '--stuck-after=0', '--quiet-api', '--quiet-blocks',
    '--vfs-mount=' + path.join(out, 'explicit-input.dat') + '=' + guest];
  put('generated-recipe.json', JSON.stringify({ fixtureOnly: true, originalExecuted: false,
    mode, wrong, nested, overwrite, args: [process.execPath, ...cli], guest, expectedExit: wrong || overwrite ? 1 : 0 }, null, 2) + '\n');
  return { out, cli, guest };
}

module.exports = { generate, untitledModal };
if (require.main === module) {
  const out = process.argv[2]; assert(out, 'output directory required; generation only');
  if (process.argv.includes('--ui')) {
    fs.mkdirSync(out, { recursive: true });
    const file = path.join(out, 'untitled-modal.exe');
    fs.writeFileSync(file, untitledModal(), { flag: 'wx' });
    console.log(JSON.stringify({ fixtureOnly: true, originalExecuted: false, file }));
  } else {
    console.log(JSON.stringify(generate(out, { mode: process.argv.includes('--ne') ? 'ne' : 'file',
      nested: process.argv.includes('--nested'), wrong: process.argv.includes('--wrong'), overwrite: process.argv.includes('--overwrite') })));
  }
}
