#!/usr/bin/env node
'use strict';

// Run actual x86 through the CLI: ExitProcess sets EIP=0 after host_exit,
// whereas xor eax,eax; call eax reaches zero without requesting an exit.
// No corpus executable or compiler is needed; use the existing built module.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const WASM = path.resolve(process.env.WINE_ASSEMBLY_WASM || path.join(ROOT, 'build', 'wine-assembly.wasm'));

function fixture(exitCode) {
  const header = Buffer.alloc(0x200);
  const body = Buffer.alloc(0x400);
  header.write('MZ');
  header.writeUInt32LE(0x40, 0x3c);
  header.write('PE\0\0', 0x40, 'latin1');
  header.writeUInt16LE(0x14c, 0x44);
  header.writeUInt16LE(1, 0x46);
  header.writeUInt16LE(224, 0x54);
  header.writeUInt16LE(0x0102, 0x56);
  const oh = 0x58;
  header.writeUInt16LE(0x10b, oh);
  for (const [offset, value] of [
    [16, 0x1000], [28, 0x400000], [32, 0x1000], [36, 0x200],
    [56, 0x2000], [60, 0x200], [72, 0x100000], [76, 0x1000],
    [80, 0x100000], [84, 0x1000], [92, 16], [104, 0x1100], [108, 40],
  ]) header.writeUInt32LE(value, oh + offset);
  header.writeUInt16LE(4, oh + 40);
  header.writeUInt16LE(4, oh + 48);
  header.writeUInt16LE(2, oh + 68);
  const sh = oh + 224;
  header.write('.text', sh);
  for (const [offset, value] of [[8, 0x400], [12, 0x1000], [16, 0x400],
    [20, 0x200], [36, 0xe0000060]]) header.writeUInt32LE(value, sh + offset);
  // Import ExitProcess from KERNEL32.dll, IAT at guest 0x401150.
  body.writeUInt32LE(0x1140, 0x100);
  body.writeUInt32LE(0x1160, 0x10c);
  body.writeUInt32LE(0x1150, 0x110);
  body.writeUInt32LE(0x1180, 0x140);
  body.writeUInt32LE(0x1180, 0x150);
  body.write('KERNEL32.dll\0', 0x160, 'latin1');
  body.write('ExitProcess\0', 0x182, 'latin1');
  if (exitCode === null) {
    body.set([0x31, 0xc0, 0xff, 0xd0]); // xor eax,eax; call eax
  } else {
    body.set([0x68, 0, 0, 0, 0, 0xff, 0x15, 0x50, 0x11, 0x40, 0]);
    body.writeUInt32LE(exitCode >>> 0, 1); // push code; call [ExitProcess]
  }
  return Buffer.concat([header, body]);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-exit-diagnostic-'));
try {
  for (const code of [0, 23, null]) {
    const exe = path.join(temp, code === null ? 'null-call.exe' : `exit-${code}.exe`);
    fs.writeFileSync(exe, fixture(code));
    const run = spawnSync(process.execPath, [path.join(__dirname, 'run.js'),
      `--exe=${exe}`, '--no-build', `--wasm=${WASM}`, '--max-batches=3', '--batch-size=100',
      '--max-seconds=10', '--quiet-api', '--quiet-blocks', '--no-close',
    ], { cwd: ROOT, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    const output = `${run.stdout || ''}${run.stderr || ''}`;
    assert.ifError(run.error);
    assert.strictEqual(run.status, 0, output);
    assert(!/WASM trap|RuntimeError|unimplemented/i.test(output), output);
    if (code === null) {
      assert(!output.includes('[Exit]'), output);
      assert.strictEqual((output.match(/\[eip-zero\] guest called through NULL/g) || []).length,
        1, `a real NULL call must be reported exactly once:\n${output}`);
      assert(output.includes('dbg_prev_eip='), output);
      assert(output.includes('Stack around ESP='), output);
    } else {
      assert(output.includes(`[Exit] code=${code}`), output);
      assert(!output.includes('[eip-zero]'), output);
      assert(!output.includes('guest called through NULL'), output);
    }
    console.log(`PASS CLI ${code === null ? 'NULL call preserves diagnostic' : `ExitProcess(${code}) preserves exit without false NULL`}`);
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
